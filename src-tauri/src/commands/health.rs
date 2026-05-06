use tauri::AppHandle;

use crate::{db, domain::DbHealthResponse, store, workspace};

#[tauri::command]
pub fn db_health_check(app: AppHandle) -> Result<DbHealthResponse, String> {
    let conn = store::get_conn(&app)?;
    let tables = db::get_table_names(&conn)?;
    let health = workspace::health_snapshot()?;

    Ok(DbHealthResponse {
        ok: true,
        workspace_path: health.workspace_path,
        db_path: health.db_path,
        settings_path: health.settings_path,
        skills_path: health.skills_path,
        projects_path: health.projects_path,
        snapshots_path: health.snapshots_path,
        tables,
    })
}

#[tauri::command]
pub fn open_skill_folder(app: AppHandle, skill_id: String) -> Result<String, String> {
    crate::commands::validate_required_id("skillId", &skill_id)?;
    let conn = store::get_conn(&app)?;
    let slug: String = conn
        .query_row(
            "SELECT slug FROM skills WHERE id = ?1",
            rusqlite::params![skill_id],
            |row| row.get(0),
        )
        .map_err(|_| format!("skill 不存在: {}", skill_id))?;

    let skill_dir = workspace::skill_dir(&slug)?;
    if !skill_dir.exists() {
        std::fs::create_dir_all(&skill_dir).map_err(|e| format!("创建目录失败: {}", e))?;
    }

    open::that(&skill_dir).map_err(|e| format!("打开目录失败: {}", e))?;

    Ok(skill_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_skill_folder_path(app: AppHandle, skill_id: String) -> Result<String, String> {
    crate::commands::validate_required_id("skillId", &skill_id)?;
    let conn = store::get_conn(&app)?;
    let slug: String = conn
        .query_row(
            "SELECT slug FROM skills WHERE id = ?1",
            rusqlite::params![skill_id],
            |row| row.get(0),
        )
        .map_err(|_| format!("skill 不存在: {}", skill_id))?;

    let skill_dir = workspace::skill_dir(&slug)?;
    Ok(skill_dir.to_string_lossy().to_string())
}
