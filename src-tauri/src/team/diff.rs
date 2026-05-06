use std::path::{Path, PathBuf};

use tauri::Runtime;

use crate::diff;
use crate::domain::SnapshotDiffResult;

use super::paths::empty_diff_dir;

pub fn ensure_empty_diff_dir_at(path: &Path) -> Result<PathBuf, String> {
    let path = path.to_path_buf();
    std::fs::create_dir_all(&path).map_err(|e| format!("创建空 diff 目录失败: {}", e))?;
    Ok(path)
}

pub fn ensure_empty_diff_dir<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    ensure_empty_diff_dir_at(empty_diff_dir(app).as_path())
}

pub fn diff_against_optional_base_at(
    diff_root: &Path,
    base_dir: Option<&Path>,
    target_dir: &Path,
) -> Result<SnapshotDiffResult, String> {
    let fallback = ensure_empty_diff_dir_at(diff_root)?;
    let base_buf = base_dir.map(PathBuf::from).unwrap_or(fallback);
    diff::diff_directories(base_buf.as_path(), target_dir)
}

pub fn diff_against_optional_base<R: Runtime>(
    app: &tauri::AppHandle<R>,
    base_dir: Option<String>,
    target_dir: PathBuf,
) -> Result<SnapshotDiffResult, String> {
    let fallback = ensure_empty_diff_dir(app)?;
    let base_buf = base_dir.map(PathBuf::from).unwrap_or(fallback);
    diff::diff_directories(base_buf.as_path(), target_dir.as_path())
}

pub fn validate_pull_mode(mode: &str, target_skill_id: Option<&str>) -> Result<(), String> {
    match mode {
        "new_skill" => Ok(()),
        "append_snapshot" => {
            if target_skill_id.is_some() {
                Ok(())
            } else {
                Err("append_snapshot 模式需要 target_skill_id".to_string())
            }
        }
        _ => Err(format!("未知 mode: {}", mode)),
    }
}
