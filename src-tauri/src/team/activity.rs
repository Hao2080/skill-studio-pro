use rusqlite::Connection;
use tauri::Runtime;
use uuid::Uuid;

use crate::domain::TeamActivityLog;
use crate::store::get_conn;

pub(super) struct TeamActivityDraft {
    pub(super) team_id: String,
    pub(super) actor: String,
    pub(super) action: String,
    pub(super) target_type: String,
    pub(super) target_id: Option<String>,
    pub(super) target_label: Option<String>,
    pub(super) detail: Option<String>,
    pub(super) created_at: i64,
}

fn normalize_limit(limit: Option<i64>) -> i64 {
    limit.unwrap_or(100).clamp(1, 200)
}

pub(super) fn insert_team_activity_log(
    conn: &Connection,
    draft: TeamActivityDraft,
) -> Result<TeamActivityLog, String> {
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO team_activity_logs (
            id,
            team_id,
            actor,
            action,
            target_type,
            target_id,
            target_label,
            detail,
            created_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![
            id,
            draft.team_id,
            draft.actor,
            draft.action,
            draft.target_type,
            draft.target_id,
            draft.target_label,
            draft.detail,
            draft.created_at
        ],
    )
    .map_err(|e| format!("写入团队活动失败: {}", e))?;

    Ok(TeamActivityLog {
        id,
        team_id: draft.team_id,
        actor: draft.actor,
        action: draft.action,
        target_type: draft.target_type,
        target_id: draft.target_id,
        target_label: draft.target_label,
        detail: draft.detail,
        created_at: draft.created_at,
    })
}

pub fn list_team_activity_logs<R: Runtime>(
    app: &tauri::AppHandle<R>,
    team_id: &str,
    limit: Option<i64>,
) -> Result<Vec<TeamActivityLog>, String> {
    let conn = get_conn(app)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, team_id, actor, action, target_type, target_id, target_label, detail, created_at
             FROM team_activity_logs
             WHERE team_id = ?1
             ORDER BY created_at DESC, id DESC
             LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;
    let logs = stmt
        .query_map(rusqlite::params![team_id, normalize_limit(limit)], |row| {
            Ok(TeamActivityLog {
                id: row.get(0)?,
                team_id: row.get(1)?,
                actor: row.get(2)?,
                action: row.get(3)?,
                target_type: row.get(4)?,
                target_id: row.get(5)?,
                target_label: row.get(6)?,
                detail: row.get(7)?,
                created_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(logs)
}
