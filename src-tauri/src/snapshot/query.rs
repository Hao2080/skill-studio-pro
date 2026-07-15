use tauri::Runtime;

use crate::domain::SkillSnapshot;
use crate::store::get_conn;

pub fn list_snapshots<R: Runtime>(
    app: &tauri::AppHandle<R>,
    skill_id: &str,
) -> Result<Vec<SkillSnapshot>, String> {
    let conn = get_conn(app)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, skill_id, snapshot_number, snapshot_path, revision_hash, change_summary, source, created_at, is_current, is_active
             FROM skill_snapshots
             WHERE skill_id = ?1
             ORDER BY snapshot_number DESC",
        )
        .map_err(|e: rusqlite::Error| e.to_string())?;

    let snapshots = stmt
        .query_map(rusqlite::params![skill_id], super::map_snapshot_row)
        .map_err(|e: rusqlite::Error| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e: rusqlite::Error| e.to_string())?;

    Ok(snapshots)
}
