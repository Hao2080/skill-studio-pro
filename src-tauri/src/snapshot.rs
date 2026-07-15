use rusqlite::Row;
use std::path::PathBuf;
use tauri::Runtime;

#[path = "snapshot/create.rs"]
mod create;
#[path = "snapshot/query.rs"]
mod query;
#[path = "snapshot/state.rs"]
mod state;

use crate::domain::{Skill, SkillSnapshot};
use crate::store::get_conn;

pub use create::create_snapshot;
pub use query::list_snapshots;
pub use state::{delete_snapshot, restore_snapshot, set_active_snapshot, update_snapshot_summary};

fn skill_source_dir<R: Runtime>(
    app: &tauri::AppHandle<R>,
    skill_id: &str,
) -> Result<PathBuf, String> {
    crate::store::skill_storage_dir(app, skill_id)
}

fn load_skill<R: Runtime>(app: &tauri::AppHandle<R>, skill_id: &str) -> Result<Skill, String> {
    let conn = get_conn(app)?;
    conn.query_row(
        "SELECT id, name, slug, description, source_type, source_path, created_at, updated_at, is_archived
         FROM skills WHERE id = ?1",
        rusqlite::params![skill_id],
        |row| {
            Ok(Skill {
                id: row.get(0)?,
                name: row.get(1)?,
                slug: row.get(2)?,
                description: row.get(3)?,
                source_type: row.get(4)?,
                source_path: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
                is_archived: row.get::<_, i64>(8)? != 0,
            })
        },
    )
    .map_err(|_| format!("skill 不存在: {}", skill_id))
}

fn map_snapshot_row(row: &Row) -> rusqlite::Result<SkillSnapshot> {
    Ok(SkillSnapshot {
        id: row.get(0)?,
        skill_id: row.get(1)?,
        snapshot_number: row.get(2)?,
        snapshot_path: row.get(3)?,
        revision_hash: row.get(4)?,
        change_summary: row.get(5)?,
        source: row.get(6)?,
        created_at: row.get(7)?,
        is_current: row.get::<_, i64>(8)? != 0,
        is_active: row.get::<_, i64>(9)? != 0,
    })
}
