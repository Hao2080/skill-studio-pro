use std::path::{Component, Path, PathBuf};

const WORKSPACE_DIR_NAME: &str = ".skill-studio-pro";
const CONFIG_APP_DIR_NAME: &str = "skill-studio-pro";
const HOME_OVERRIDE_ENV: &str = "SKILL_STUDIO_PRO_HOME";
const CONFIG_OVERRIDE_ENV: &str = "SKILL_STUDIO_PRO_CONFIG_HOME";
const WORKSPACE_OVERRIDE_ENV: &str = "SKILL_STUDIO_PRO_WORKSPACE";

fn absolute_env_path(name: &str) -> Result<Option<PathBuf>, String> {
    let Some(raw) = std::env::var_os(name).filter(|value| !value.is_empty()) else {
        return Ok(None);
    };
    let path = PathBuf::from(raw);
    if !path.is_absolute() {
        return Err(format!("{name} 必须是绝对路径"));
    }
    Ok(Some(normalize_components(&path)))
}

pub fn home_dir_path() -> Result<PathBuf, String> {
    if let Some(path) = absolute_env_path(HOME_OVERRIDE_ENV)? {
        return Ok(path);
    }
    dirs::home_dir().ok_or_else(|| "无法解析用户主目录".to_string())
}

pub fn default_workspace_root_path() -> Result<PathBuf, String> {
    if let Some(path) = workspace_override_path()? {
        return Ok(path);
    }
    home_dir_path().map(|home| home.join(WORKSPACE_DIR_NAME))
}

pub fn workspace_override_path() -> Result<Option<PathBuf>, String> {
    absolute_env_path(WORKSPACE_OVERRIDE_ENV)
}

pub fn config_root_path() -> Result<PathBuf, String> {
    if let Some(path) = absolute_env_path(CONFIG_OVERRIDE_ENV)? {
        return Ok(path);
    }
    if std::env::var_os(HOME_OVERRIDE_ENV).is_some() {
        return home_dir_path().map(|home| home.join(".config").join(CONFIG_APP_DIR_NAME));
    }
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
        home_dir_path()?
    } else if trimmed.starts_with("~/") || trimmed.starts_with("~\\") {
        home_dir_path()?.join(&trimmed[2..])
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
