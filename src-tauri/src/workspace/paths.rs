use std::path::{Component, Path, PathBuf};

const WORKSPACE_DIR_NAME: &str = ".skill-studio-pro";
const CONFIG_APP_DIR_NAME: &str = "skill-studio-pro";

pub fn default_workspace_root_path() -> Result<PathBuf, String> {
    dirs::home_dir()
        .map(|home| home.join(WORKSPACE_DIR_NAME))
        .ok_or_else(|| "无法解析用户主目录".to_string())
}

pub fn config_root_path() -> Result<PathBuf, String> {
    match dirs::config_dir() {
        Some(config_dir) => Ok(config_dir.join(CONFIG_APP_DIR_NAME)),
        None => default_workspace_root_path().map(|root| root.join(".config")),
    }
}

pub fn normalize_workspace_path(raw: &str) -> Result<PathBuf, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("工作区路径不能为空".to_string());
    }

    let expanded = if trimmed == "~" {
        dirs::home_dir().ok_or_else(|| "无法解析用户主目录".to_string())?
    } else if trimmed.starts_with("~/") || trimmed.starts_with("~\\") {
        dirs::home_dir()
            .ok_or_else(|| "无法解析用户主目录".to_string())?
            .join(&trimmed[2..])
    } else {
        PathBuf::from(trimmed)
    };

    normalize_absolute_path(expanded)
}

pub fn normalize_absolute_path(path: PathBuf) -> Result<PathBuf, String> {
    if !path.is_absolute() {
        return Err("工作区路径必须是绝对路径".to_string());
    }

    Ok(normalize_components(&path))
}

pub fn normalize_components(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                normalized.pop();
            }
            other => normalized.push(other.as_os_str()),
        }
    }
    normalized
}

pub fn ensure_dir(path: &Path) -> Result<(), String> {
    std::fs::create_dir_all(path).map_err(|e| format!("创建目录失败: {}", e))
}

pub fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}
