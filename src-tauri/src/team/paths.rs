use tauri::Runtime;

use crate::workspace;

pub fn team_versions_dir<R: Runtime>(app: &tauri::AppHandle<R>) -> std::path::PathBuf {
    let _ = app;
    workspace::team_versions_root().expect("无法获取团队版本目录")
}

pub fn team_staging_dir<R: Runtime>(app: &tauri::AppHandle<R>) -> std::path::PathBuf {
    let _ = app;
    workspace::team_staging_root().expect("无法获取团队暂存目录")
}

pub fn team_version_path<R: Runtime>(
    app: &tauri::AppHandle<R>,
    team_skill_id: &str,
    version_id: &str,
) -> std::path::PathBuf {
    team_versions_dir(app).join(team_skill_id).join(version_id)
}

pub fn team_staging_path<R: Runtime>(
    app: &tauri::AppHandle<R>,
    submission_id: &str,
) -> std::path::PathBuf {
    team_staging_dir(app).join(submission_id)
}

pub fn empty_diff_dir<R: Runtime>(app: &tauri::AppHandle<R>) -> std::path::PathBuf {
    let _ = app;
    workspace::team_empty_diff_root().expect("无法获取空 diff 目录")
}
