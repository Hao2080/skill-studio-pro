use tauri::Runtime;
use uuid::Uuid;

use crate::domain::{normalize_snapshot_source, CreateSnapshotInput, SkillSnapshot};
use crate::store::{
    compute_directory_revision, copy_dir_recursive, get_conn, now_ms, snapshot_dir,
};

pub fn create_snapshot<R: Runtime>(
    app: &tauri::AppHandle<R>,
    input: &CreateSnapshotInput,
) -> Result<SkillSnapshot, String> {
    let conn = get_conn(app)?;
    let skill = super::load_skill(app, &input.skill_id)?;

    let next_num: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(snapshot_number), 0) + 1 FROM skill_snapshots WHERE skill_id = ?1",
            rusqlite::params![input.skill_id],
            |row| row.get(0),
        )
        .map_err(|e: rusqlite::Error| e.to_string())?;

    let skill_source_dir = super::skill_source_dir(app, &skill.id)?;
    let revision_hash = compute_directory_revision(&skill_source_dir)?;

    let target = snapshot_dir(app, &skill.id, next_num);
    if target.exists() {
        std::fs::remove_dir_all(&target).map_err(|e| format!("清理快照目录失败: {}", e))?;
    }
    copy_dir_recursive(&skill_source_dir, &target)?;

    let now = now_ms();
    let id = Uuid::new_v4().to_string();
    let snapshot_path = target.to_string_lossy().to_string();
    let source = normalize_snapshot_source(Some(input.source.as_str()));

    conn.execute_batch("BEGIN;")
        .map_err(|e| format!("开启事务失败: {}", e))?;

    let result = (|| -> Result<(), String> {
        conn.execute(
            "UPDATE skill_snapshots SET is_current = 0 WHERE skill_id = ?1",
            rusqlite::params![input.skill_id],
        )
        .map_err(|e| format!("更新 is_current 失败: {}", e))?;

        conn.execute(
            "INSERT INTO skill_snapshots (id, skill_id, snapshot_number, snapshot_path, revision_hash, change_summary, source, created_at, is_current, is_active)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1, 0)",
            rusqlite::params![
                id,
                input.skill_id,
                next_num,
                snapshot_path,
                revision_hash,
                input.change_summary,
                &source,
                now
            ],
        )
        .map_err(|e| format!("插入快照记录失败: {}", e))?;

        conn.execute(
            "UPDATE skills SET updated_at = ?1 WHERE id = ?2",
            rusqlite::params![now, input.skill_id],
        )
        .map_err(|e| format!("更新 skill 时间戳失败: {}", e))?;

        Ok(())
    })();

    match result {
        Ok(()) => {
            conn.execute_batch("COMMIT;")
                .map_err(|e| format!("提交事务失败: {}", e))?;
        }
        Err(error) => {
            let _ = conn.execute_batch("ROLLBACK;");
            if target.exists() {
                let _ = std::fs::remove_dir_all(&target);
            }
            return Err(error);
        }
    }

    let snapshot = SkillSnapshot {
        id,
        skill_id: input.skill_id.clone(),
        snapshot_number: next_num,
        snapshot_path,
        revision_hash,
        change_summary: input.change_summary.clone(),
        source,
        created_at: now,
        is_current: true,
        is_active: false,
    };

    cleanup_excess_snapshots(app, &input.skill_id);

    Ok(snapshot)
}

fn cleanup_excess_snapshots<R: Runtime>(app: &tauri::AppHandle<R>, skill_id: &str) {
    let settings = match crate::store::get_app_settings(app) {
        Ok(settings) => settings,
        Err(error) => {
            eprintln!("[snapshot cleanup] 读取设置失败: {}", error);
            return;
        }
    };
    let max = match settings.snapshot_max_count {
        Some(max) if max > 0 => max,
        _ => return,
    };
    let conn = match crate::store::get_conn(app) {
        Ok(conn) => conn,
        Err(error) => {
            eprintln!("[snapshot cleanup] 获取连接失败: {}", error);
            return;
        }
    };
    let total: i64 = match conn.query_row(
        "SELECT COUNT(*) FROM skill_snapshots WHERE skill_id = ?1",
        rusqlite::params![skill_id],
        |row| row.get(0),
    ) {
        Ok(total) => total,
        Err(error) => {
            eprintln!("[snapshot cleanup] 查询总数失败: {}", error);
            return;
        }
    };
    let excess = total - max as i64;
    if excess <= 0 {
        return;
    }
    let mut stmt = match conn.prepare(
        "SELECT id FROM skill_snapshots
         WHERE skill_id = ?1 AND is_active = 0
         ORDER BY CASE WHEN source = 'system' THEN 0 ELSE 1 END ASC,
                  snapshot_number ASC
         LIMIT ?2",
    ) {
        Ok(stmt) => stmt,
        Err(error) => {
            eprintln!("[snapshot cleanup] 准备查询失败: {}", error);
            return;
        }
    };
    let ids: Vec<String> =
        match stmt.query_map(rusqlite::params![skill_id, excess], |row| row.get(0)) {
            Ok(rows) => rows.filter_map(|row| row.ok()).collect(),
            Err(error) => {
                eprintln!("[snapshot cleanup] 查询待删除快照失败: {}", error);
                return;
            }
        };
    drop(stmt);
    drop(conn);
    for id in ids {
        if let Err(error) = super::delete_snapshot(app, &id) {
            eprintln!("[snapshot cleanup] 删除快照 {} 失败: {}", id, error);
        }
    }
}
