mod config;
mod paths;

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::domain::Project;

pub use config::{bootstrap_config_path, load_bootstrap_config, WorkspaceBootstrapConfig};

#[derive(Debug, Clone)]
pub struct WorkspaceHealthSnapshot {
    pub workspace_path: String,
    pub db_path: String,
    pub settings_path: String,
    pub skills_path: String,
    pub projects_path: String,
    pub snapshots_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
#[serde(rename_all = "camelCase")]
struct WorkspaceManifest {
    version: u32,
    workspace_path: String,
    created_at: i64,
    updated_at: i64,
}

impl Default for WorkspaceManifest {
    fn default() -> Self {
        let now = current_timestamp_ms();
        Self {
            version: 1,
            workspace_path: String::new(),
            created_at: now,
            updated_at: now,
        }
    }
}

fn current_timestamp_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0)
}

fn resolve_workspace_root(config: &WorkspaceBootstrapConfig) -> Result<PathBuf, String> {
    match config.workspace_path.as_deref() {
        Some(raw) => match paths::normalize_workspace_path(raw) {
            Ok(path) => Ok(path),
            Err(_) => paths::default_workspace_root_path(),
        },
        None => paths::default_workspace_root_path(),
    }
}

fn ensure_workspace_layout(root: &std::path::Path) -> Result<(), String> {
    paths::ensure_dir(root)?;
    paths::ensure_dir(&root.join("skills"))?;
    paths::ensure_dir(&root.join("projects"))?;
    paths::ensure_dir(&root.join("snapshots"))?;
    paths::ensure_dir(&root.join("imports"))?;
    paths::ensure_dir(&root.join("staging"))?;
    paths::ensure_dir(&root.join("logs"))?;
    paths::ensure_dir(&root.join("team"))?;
    paths::ensure_dir(&root.join("team").join("versions"))?;
    paths::ensure_dir(&root.join("team").join("staging"))?;
    Ok(())
}

fn ensure_workspace_manifest(workspace_root: &std::path::Path) -> Result<(), String> {
    let manifest_path = workspace_root.join("workspace.json");
    let mut manifest = match fs::read_to_string(&manifest_path) {
        Ok(raw) => serde_json::from_str::<WorkspaceManifest>(&raw).unwrap_or_default(),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => WorkspaceManifest::default(),
        Err(err) => return Err(format!("读取工作区清单失败: {}", err)),
    };

    let now = current_timestamp_ms();
    if manifest.workspace_path.is_empty() {
        manifest.created_at = now;
    }
    manifest.updated_at = now;
    manifest.workspace_path = paths::path_to_string(workspace_root);

    let content = serde_json::to_string_pretty(&manifest)
        .map_err(|err| format!("序列化工作区清单失败: {}", err))?;
    fs::write(manifest_path, content).map_err(|err| format!("写入工作区清单失败: {}", err))
}

fn build_health_snapshot(
    config: &WorkspaceBootstrapConfig,
) -> Result<WorkspaceHealthSnapshot, String> {
    let workspace_root = resolve_workspace_root(config)?;

    Ok(WorkspaceHealthSnapshot {
        workspace_path: paths::path_to_string(&workspace_root),
        db_path: paths::path_to_string(&workspace_root.join("metadata.db")),
        settings_path: paths::path_to_string(&workspace_root.join("settings.json")),
        skills_path: paths::path_to_string(&workspace_root.join("skills")),
        projects_path: paths::path_to_string(&workspace_root.join("projects")),
        snapshots_path: paths::path_to_string(&workspace_root.join("snapshots")),
    })
}

pub fn prepare() -> Result<WorkspaceHealthSnapshot, String> {
    let mut config = config::load_bootstrap_config()?;
    let workspace_root = resolve_workspace_root(&config)?;

    config.workspace_path = Some(paths::path_to_string(&workspace_root));
    ensure_workspace_layout(&workspace_root)?;
    ensure_workspace_manifest(&workspace_root)?;
    config::save_bootstrap_config(&config)?;
    build_health_snapshot(&config)
}

pub fn health_snapshot() -> Result<WorkspaceHealthSnapshot, String> {
    let config = config::load_bootstrap_config()?;
    build_health_snapshot(&config)
}

pub fn workspace_root() -> Result<PathBuf, String> {
    resolve_workspace_root(&config::load_bootstrap_config()?)
}

pub fn db_path() -> Result<PathBuf, String> {
    Ok(workspace_root()?.join("metadata.db"))
}

pub fn settings_path() -> Result<PathBuf, String> {
    Ok(workspace_root()?.join("settings.json"))
}

pub fn skills_root() -> Result<PathBuf, String> {
    Ok(workspace_root()?.join("skills"))
}

pub fn skill_dir(slug: &str) -> Result<PathBuf, String> {
    Ok(skills_root()?.join(slug))
}

pub fn snapshots_root() -> Result<PathBuf, String> {
    Ok(workspace_root()?.join("snapshots"))
}

pub fn projects_root() -> Result<PathBuf, String> {
    Ok(workspace_root()?.join("projects"))
}

pub fn project_dir(project_id: &str) -> Result<PathBuf, String> {
    Ok(projects_root()?.join(project_id))
}

pub fn project_bindings_dir(project_id: &str) -> Result<PathBuf, String> {
    Ok(project_dir(project_id)?.join("bindings"))
}

pub fn project_manifests_dir(project_id: &str) -> Result<PathBuf, String> {
    Ok(project_dir(project_id)?.join("manifests"))
}

pub fn project_artifacts_dir(project_id: &str) -> Result<PathBuf, String> {
    Ok(project_dir(project_id)?.join("artifacts"))
}

pub fn project_staging_dir(project_id: &str) -> Result<PathBuf, String> {
    Ok(project_dir(project_id)?.join("staging"))
}

pub fn project_metadata_path(project_id: &str) -> Result<PathBuf, String> {
    Ok(project_dir(project_id)?.join("project.json"))
}

pub fn imports_root() -> Result<PathBuf, String> {
    Ok(workspace_root()?.join("imports"))
}

pub fn temp_imports_root() -> Result<PathBuf, String> {
    Ok(imports_root()?.join("tmp"))
}

pub fn staging_root() -> Result<PathBuf, String> {
    Ok(workspace_root()?.join("staging"))
}

pub fn logs_root() -> Result<PathBuf, String> {
    Ok(workspace_root()?.join("logs"))
}

pub fn team_root() -> Result<PathBuf, String> {
    Ok(workspace_root()?.join("team"))
}

pub fn team_versions_root() -> Result<PathBuf, String> {
    Ok(team_root()?.join("versions"))
}

pub fn team_staging_root() -> Result<PathBuf, String> {
    Ok(team_root()?.join("staging"))
}

pub fn team_empty_diff_root() -> Result<PathBuf, String> {
    Ok(team_root()?.join(".diff_empty"))
}

pub fn ensure_project_workspace(project: &Project) -> Result<(), String> {
    let root = project_dir(&project.id)?;
    paths::ensure_dir(&root)?;
    paths::ensure_dir(&project_bindings_dir(&project.id)?)?;
    paths::ensure_dir(&project_manifests_dir(&project.id)?)?;
    paths::ensure_dir(&project_artifacts_dir(&project.id)?)?;
    paths::ensure_dir(&project_staging_dir(&project.id)?)?;

    let content = serde_json::to_string_pretty(project)
        .map_err(|err| format!("序列化项目清单失败: {}", err))?;
    fs::write(project_metadata_path(&project.id)?, content)
        .map_err(|err| format!("写入项目清单失败: {}", err))
}

pub fn remove_project_workspace(project_id: &str) -> Result<(), String> {
    let root = project_dir(project_id)?;
    if root.exists() {
        fs::remove_dir_all(&root).map_err(|err| format!("删除项目工作区失败: {}", err))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::paths;

    #[test]
    fn normalize_workspace_path_rejects_relative_path() {
        let result = paths::normalize_workspace_path("data/workspace");
        assert!(result.is_err());
    }

    #[test]
    fn normalize_components_removes_dot_segments() {
        let raw = std::path::PathBuf::from("C:\\Users\\demo\\.skill-studio\\..\\workspace");
        let normalized = paths::normalize_components(&raw);
        assert!(normalized.to_string_lossy().contains("workspace"));
    }
}
