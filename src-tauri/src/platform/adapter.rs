use std::fs;
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone)]
pub struct PlatformContext {
    pub home: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DetectionResult {
    pub detected: bool,
    pub skills_dir: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SymlinkCapability {
    Supported,
    UnsupportedPlatform,
    RequiresPrivilegeProbe,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlatformError {
    pub code: &'static str,
    pub message: String,
}

impl std::fmt::Display for PlatformError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "{}: {}", self.code, self.message)
    }
}

pub trait PlatformAdapter: Send + Sync {
    fn id(&self) -> &str;
    fn display_name(&self) -> &str;
    fn detect(&self, ctx: &PlatformContext) -> DetectionResult;
    fn default_global_skills_dir(&self, home: &Path) -> Option<PathBuf>;
    fn validate_target(&self, configured_root: &Path, target: &Path) -> Result<(), PlatformError>;
    fn supports_symlink(&self) -> bool;
    fn supports_copy(&self) -> bool;
    fn is_dedicated(&self) -> bool;
    fn normalize_target_name(&self, value: &str) -> Result<String, PlatformError>;

    fn symlink_capability(&self) -> SymlinkCapability {
        if !self.supports_symlink() {
            SymlinkCapability::UnsupportedPlatform
        } else if cfg!(windows) {
            SymlinkCapability::RequiresPrivilegeProbe
        } else {
            SymlinkCapability::Supported
        }
    }
}

#[derive(Debug, Clone)]
pub struct DirectoryPlatformAdapter {
    id: String,
    display_name: String,
    relative_skills_dir: Option<PathBuf>,
    configured_skills_dir: Option<PathBuf>,
    supports_symlink: bool,
    supports_copy: bool,
    dedicated: bool,
}

impl DirectoryPlatformAdapter {
    pub fn built_in(
        id: impl Into<String>,
        display_name: impl Into<String>,
        relative_skills_dir: PathBuf,
        dedicated: bool,
    ) -> Self {
        Self {
            id: id.into(),
            display_name: display_name.into(),
            relative_skills_dir: Some(relative_skills_dir),
            configured_skills_dir: None,
            supports_symlink: true,
            supports_copy: true,
            dedicated,
        }
    }

    pub fn custom(
        id: impl Into<String>,
        display_name: impl Into<String>,
        configured_skills_dir: PathBuf,
        supports_symlink: bool,
        supports_copy: bool,
    ) -> Self {
        Self {
            id: id.into(),
            display_name: display_name.into(),
            relative_skills_dir: None,
            configured_skills_dir: Some(configured_skills_dir),
            supports_symlink,
            supports_copy,
            dedicated: false,
        }
    }

    fn configured_or_default(&self, home: &Path) -> Option<PathBuf> {
        self.configured_skills_dir.clone().or_else(|| {
            self.relative_skills_dir
                .as_ref()
                .map(|path| home.join(path))
        })
    }
}

impl PlatformAdapter for DirectoryPlatformAdapter {
    fn id(&self) -> &str {
        &self.id
    }

    fn display_name(&self) -> &str {
        &self.display_name
    }

    fn detect(&self, ctx: &PlatformContext) -> DetectionResult {
        let skills_dir = self
            .configured_or_default(&ctx.home)
            .unwrap_or_else(|| ctx.home.join(".missing-skill-adapter"));
        DetectionResult {
            detected: skills_dir.is_dir(),
            skills_dir,
        }
    }

    fn default_global_skills_dir(&self, home: &Path) -> Option<PathBuf> {
        self.configured_or_default(home)
    }

    fn validate_target(&self, configured_root: &Path, target: &Path) -> Result<(), PlatformError> {
        if !configured_root.is_absolute() || !target.is_absolute() {
            return Err(platform_error(
                "TARGET_NOT_ABSOLUTE",
                "发布根和目标必须是绝对路径",
            ));
        }
        let root_meta = fs::symlink_metadata(configured_root).map_err(|error| {
            platform_error(
                "PLATFORM_ROOT_UNAVAILABLE",
                format!("无法读取平台根 {}: {error}", configured_root.display()),
            )
        })?;
        if !root_meta.is_dir() || root_meta.file_type().is_symlink() {
            return Err(platform_error(
                "PLATFORM_ROOT_UNSAFE",
                format!("平台根不是普通目录: {}", configured_root.display()),
            ));
        }
        let canonical_root = configured_root.canonicalize().map_err(|error| {
            platform_error(
                "PLATFORM_ROOT_UNAVAILABLE",
                format!("无法规范化平台根 {}: {error}", configured_root.display()),
            )
        })?;
        let parent = target
            .parent()
            .ok_or_else(|| platform_error("TARGET_OUTSIDE_ROOT", "发布目标缺少父目录"))?;
        let canonical_parent = parent.canonicalize().map_err(|error| {
            platform_error(
                "TARGET_PARENT_UNAVAILABLE",
                format!("无法规范化目标父目录 {}: {error}", parent.display()),
            )
        })?;
        if canonical_parent != canonical_root {
            return Err(platform_error(
                "TARGET_OUTSIDE_ROOT",
                format!("发布目标必须直接位于已配置平台根: {}", target.display()),
            ));
        }
        if let Ok(metadata) = fs::symlink_metadata(target) {
            if metadata.file_type().is_symlink() {
                return Ok(());
            }
            let canonical_target = target.canonicalize().map_err(|error| {
                platform_error("TARGET_UNAVAILABLE", format!("无法规范化发布目标: {error}"))
            })?;
            if !canonical_target.starts_with(&canonical_root) {
                return Err(platform_error(
                    "TARGET_LINK_ESCAPE",
                    format!("目标通过链接逃逸平台根: {}", target.display()),
                ));
            }
        }
        Ok(())
    }

    fn supports_symlink(&self) -> bool {
        self.supports_symlink
    }

    fn supports_copy(&self) -> bool {
        self.supports_copy
    }

    fn is_dedicated(&self) -> bool {
        self.dedicated
    }

    fn normalize_target_name(&self, value: &str) -> Result<String, PlatformError> {
        let value = value.trim();
        if value.is_empty() || value == "." || value == ".." {
            return Err(platform_error("INVALID_TARGET_NAME", "目标目录名不能为空"));
        }
        let path = Path::new(value);
        if path.is_absolute()
            || path.components().count() != 1
            || !matches!(path.components().next(), Some(Component::Normal(_)))
            || value.contains(['/', '\\'])
        {
            return Err(platform_error(
                "INVALID_TARGET_NAME",
                "目标目录名不能包含路径分隔符或跳转片段",
            ));
        }
        Ok(value.to_string())
    }
}

fn platform_error(code: &'static str, message: impl Into<String>) -> PlatformError {
    PlatformError {
        code,
        message: message.into(),
    }
}
