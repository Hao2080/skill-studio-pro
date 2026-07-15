use tauri::Runtime;

use crate::domain::{is_system_snapshot_source, SkillSnapshot, UpdateSnapshotSummaryInput};
use crate::store::{copy_dir_recursive, get_conn, now_ms};

pub fn restore_snapshot<R: Runtime>(
    app: &tauri::AppHandle<R>,
    snapshot_id: &str,
) -> Result<String, String> {
    let conn = get_conn(app)?;
    let snapshot = conn
        .query_row(
            "SELECT id, skill_id, snapshot_number, snapshot_path, revision_hash, change_summary, source, created_at, is_current, is_active
             FROM skill_snapshots WHERE id = ?1",
            rusqlite::params![snapshot_id],
            super::map_snapshot_row,
        )
        .map_err(|_| format!("快照不存在: {}", snapshot_id))?;

    let skill = super::load_skill(app, &snapshot.skill_id)?;
    let skill_source_dir = super::skill_source_dir(app, &skill.id)?;
    let bak_dir = {
        let mut path = skill_source_dir.clone().into_os_string();
        path.push(".bak-restore");
        std::path::PathBuf::from(path)
    };
    let staging_dir = {
        let mut path = skill_source_dir.clone().into_os_string();
        path.push(".staging");
        std::path::PathBuf::from(path)
    };

    if bak_dir.exists() {
        std::fs::remove_dir_all(&bak_dir).map_err(|e| format!("清理旧备份目录失败: {}", e))?;
    }
    if staging_dir.exists() {
        std::fs::remove_dir_all(&staging_dir)
            .map_err(|e| format!("清理旧 staging 目录失败: {}", e))?;
    }

    let workspace_existed = skill_source_dir.exists();
    if workspace_existed {
        std::fs::rename(&skill_source_dir, &bak_dir)
            .map_err(|e| format!("备份工作区失败: {}", e))?;
    }

    if let Err(error) =
        copy_dir_recursive(std::path::Path::new(&snapshot.snapshot_path), &staging_dir)
    {
        if bak_dir.exists() {
            let _ = std::fs::rename(&bak_dir, &skill_source_dir);
        }
        let _ = std::fs::remove_dir_all(&staging_dir);
        return Err(format!("复制快照到 staging 失败: {}", error));
    }

    if let Err(error) = std::fs::rename(&staging_dir, &skill_source_dir) {
        if bak_dir.exists() {
            let _ = std::fs::rename(&bak_dir, &skill_source_dir);
        }
        let _ = std::fs::remove_dir_all(&staging_dir);
        return Err(format!("替换工作区失败: {}", error));
    }

    let now = now_ms();
    conn.execute_batch("BEGIN;")
        .map_err(|e| format!("开启事务失败: {}", e))?;
    let db_result = (|| -> Result<(), String> {
        conn.execute(
            "UPDATE skill_snapshots SET is_current = 0 WHERE skill_id = ?1",
            rusqlite::params![snapshot.skill_id],
        )
        .map_err(|e| format!("清零 is_current 失败: {}", e))?;

        conn.execute(
            "UPDATE skill_snapshots SET is_current = 1 WHERE id = ?1",
            rusqlite::params![snapshot_id],
        )
        .map_err(|e| format!("设置 is_current 失败: {}", e))?;

        conn.execute(
            "UPDATE skills SET updated_at = ?1 WHERE id = ?2",
            rusqlite::params![now, snapshot.skill_id],
        )
        .map_err(|e| format!("更新 skill 时间戳失败: {}", e))?;

        Ok(())
    })();

    match db_result {
        Ok(()) => {
            conn.execute_batch("COMMIT;")
                .map_err(|e| format!("提交事务失败: {}", e))?;
        }
        Err(error) => {
            let _ = conn.execute_batch("ROLLBACK;");
            let staging_tmp = {
                let mut path = skill_source_dir.clone().into_os_string();
                path.push(".staging-rollback");
                std::path::PathBuf::from(path)
            };
            if skill_source_dir.exists() {
                let _ = std::fs::rename(&skill_source_dir, &staging_tmp);
            }
            if bak_dir.exists() {
                let _ = std::fs::rename(&bak_dir, &skill_source_dir);
            }
            let _ = std::fs::remove_dir_all(&staging_tmp);
            return Err(format!("数据库更新失败，文件系统已回滚: {}", error));
        }
    }

    if bak_dir.exists() {
        std::fs::remove_dir_all(&bak_dir).map_err(|e| format!("删除备份目录失败: {}", e))?;
    }

    Ok(snapshot.skill_id)
}

pub fn delete_snapshot<R: Runtime>(
    app: &tauri::AppHandle<R>,
    snapshot_id: &str,
) -> Result<(), String> {
    let conn = get_conn(app)?;
    let (snapshot_path, skill_id, is_active, is_current): (String, String, bool, bool) = conn
        .query_row(
            "SELECT snapshot_path, skill_id, is_active, is_current FROM skill_snapshots WHERE id = ?1",
            rusqlite::params![snapshot_id],
            |row| {
                let is_active: i64 = row.get(2)?;
                let is_current: i64 = row.get(3)?;
                Ok((row.get(0)?, row.get(1)?, is_active != 0, is_current != 0))
            },
        )
        .map_err(|_| format!("快照不存在: {}", snapshot_id))?;

    if is_active {
        return Err("无法删除当前生效版本，请先切换到其他版本".to_string());
    }

    let platform_reference_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM platform_release_targets WHERE snapshot_id = ?1",
            rusqlite::params![snapshot_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("检查平台引用失败: {}", e))?;
    if platform_reference_count > 0 {
        return Err(format!(
            "无法删除该快照，仍有 {} 个平台承接此版本，请先从平台发布中移除",
            platform_reference_count
        ));
    }

    let team_target_reference_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM team_delivery_targets WHERE source_snapshot_id = ?1",
            rusqlite::params![snapshot_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("检查团队承接引用失败: {}", e))?;
    if team_target_reference_count > 0 {
        return Err(format!(
            "无法删除该快照，仍有 {} 个团队正在承接此版本，请先解除团队承接",
            team_target_reference_count
        ));
    }

    let pending_submission_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM team_submissions WHERE source_snapshot_id = ?1 AND status = 'pending'",
            rusqlite::params![snapshot_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("检查团队待审引用失败: {}", e))?;
    if pending_submission_count > 0 {
        return Err(format!(
            "无法删除该快照，仍有 {} 条团队待审提交引用此版本，请先撤回或处理待审",
            pending_submission_count
        ));
    }

    let path = std::path::Path::new(&snapshot_path);
    if path.exists() {
        std::fs::remove_dir_all(path).map_err(|e| format!("删除快照目录失败: {}", e))?;
    }

    conn.execute(
        "DELETE FROM skill_snapshots WHERE id = ?1",
        rusqlite::params![snapshot_id],
    )
    .map_err(|e: rusqlite::Error| format!("删除快照记录失败: {}", e))?;

    if is_current {
        conn.execute(
            "UPDATE skill_snapshots SET is_current = 1
             WHERE skill_id = ?1
               AND snapshot_number = (
                   SELECT MAX(snapshot_number) FROM skill_snapshots WHERE skill_id = ?1
               )",
            rusqlite::params![skill_id],
        )
        .map_err(|e: rusqlite::Error| format!("回补 latest 标记失败: {}", e))?;
    }

    Ok(())
}

pub fn set_active_snapshot<R: Runtime>(
    app: &tauri::AppHandle<R>,
    snapshot_id: &str,
) -> Result<SkillSnapshot, String> {
    let conn = get_conn(app)?;
    let snapshot = conn
        .query_row(
            "SELECT id, skill_id, snapshot_number, snapshot_path, revision_hash, change_summary, source, created_at, is_current, is_active
             FROM skill_snapshots WHERE id = ?1",
            rusqlite::params![snapshot_id],
            super::map_snapshot_row,
        )
        .map_err(|_| format!("快照不存在: {}", snapshot_id))?;

    if is_system_snapshot_source(&snapshot.source) {
        return Err("系统恢复点不能设为生效版本".to_string());
    }

    conn.execute_batch("BEGIN;")
        .map_err(|e| format!("开启事务失败: {}", e))?;

    let result = (|| -> Result<(), String> {
        conn.execute(
            "UPDATE skill_snapshots SET is_active = 0 WHERE skill_id = ?1",
            rusqlite::params![snapshot.skill_id],
        )
        .map_err(|e| format!("清除 is_active 失败: {}", e))?;

        conn.execute(
            "UPDATE skill_snapshots SET is_active = 1 WHERE id = ?1",
            rusqlite::params![snapshot_id],
        )
        .map_err(|e| format!("设置 is_active 失败: {}", e))?;

        Ok(())
    })();

    match result {
        Ok(()) => {
            conn.execute_batch("COMMIT;")
                .map_err(|e| format!("提交事务失败: {}", e))?;
        }
        Err(error) => {
            let _ = conn.execute_batch("ROLLBACK;");
            return Err(error);
        }
    }

    Ok(SkillSnapshot {
        is_active: true,
        ..snapshot
    })
}

pub fn update_snapshot_summary<R: Runtime>(
    app: &tauri::AppHandle<R>,
    input: &UpdateSnapshotSummaryInput,
) -> Result<SkillSnapshot, String> {
    let conn = get_conn(app)?;
    let snapshot = conn
        .query_row(
            "SELECT id, skill_id, snapshot_number, snapshot_path, revision_hash, change_summary, source, created_at, is_current, is_active
             FROM skill_snapshots WHERE id = ?1",
            rusqlite::params![input.snapshot_id],
            super::map_snapshot_row,
        )
        .map_err(|_| format!("快照不存在: {}", input.snapshot_id))?;

    let now = now_ms();
    conn.execute_batch("BEGIN;")
        .map_err(|e| format!("开启事务失败: {}", e))?;

    let result = (|| -> Result<(), String> {
        conn.execute(
            "UPDATE skill_snapshots SET change_summary = ?1 WHERE id = ?2",
            rusqlite::params![input.change_summary, input.snapshot_id],
        )
        .map_err(|e| format!("更新快照说明失败: {}", e))?;

        conn.execute(
            "UPDATE skills SET updated_at = ?1 WHERE id = ?2",
            rusqlite::params![now, snapshot.skill_id],
        )
        .map_err(|e| format!("更新技能时间戳失败: {}", e))?;

        Ok(())
    })();

    match result {
        Ok(()) => {
            conn.execute_batch("COMMIT;")
                .map_err(|e| format!("提交事务失败: {}", e))?;
        }
        Err(error) => {
            let _ = conn.execute_batch("ROLLBACK;");
            return Err(error);
        }
    }

    Ok(SkillSnapshot {
        change_summary: input.change_summary.clone(),
        ..snapshot
    })
}
