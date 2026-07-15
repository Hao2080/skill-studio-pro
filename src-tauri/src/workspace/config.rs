use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use super::paths;

const BOOTSTRAP_FILE_NAME: &str = "workspace-config.json";

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceBootstrapConfig {
    pub workspace_path: Option<String>,
}

pub fn bootstrap_config_path() -> Result<PathBuf, String> {
    Ok(paths::config_root_path()?.join(BOOTSTRAP_FILE_NAME))
}

pub fn load_bootstrap_config() -> Result<WorkspaceBootstrapConfig, String> {
    let path = bootstrap_config_path()?;
    let raw = match fs::read_to_string(&path) {
        Ok(raw) => raw,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            return Ok(WorkspaceBootstrapConfig::default());
        }
        Err(err) => return Err(format!("读取工作区配置失败: {}", err)),
    };

    serde_json::from_str(&raw).map_err(|err| format!("解析工作区配置失败: {}", err))
}

pub fn save_bootstrap_config(config: &WorkspaceBootstrapConfig) -> Result<(), String> {
    let path = bootstrap_config_path()?;
    if let Some(parent) = path.parent() {
        paths::ensure_dir(parent)?;
    }

    let content = serde_json::to_string_pretty(config)
        .map_err(|err| format!("序列化工作区配置失败: {}", err))?;
    fs::write(&path, content).map_err(|err| format!("写入工作区配置失败: {}", err))
}
