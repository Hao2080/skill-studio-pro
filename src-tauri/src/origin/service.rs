use rusqlite::Connection;

use super::confidence;
use super::evidence;
use super::model::{OriginConfirmInput, SourceResolution};
use super::repository;

pub fn get(conn: &Connection, instance_id: &str) -> Result<SourceResolution, String> {
    repository::get_resolution(conn, instance_id)?
        .ok_or_else(|| format!("实例不存在来源结论: {instance_id}"))
}

pub fn confirm(
    conn: &Connection,
    input: &OriginConfirmInput,
    now: i64,
) -> Result<SourceResolution, String> {
    validate_source_type(&input.source_type)?;
    if input.instance_id.trim().is_empty() || input.source_label.trim().is_empty() {
        return Err("instanceId 和 sourceLabel 不能为空".to_string());
    }
    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM skill_instances WHERE id = ?1",
            rusqlite::params![input.instance_id],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|e| format!("检查实例失败: {e}"))?
        > 0;
    if !exists {
        return Err(format!("Skill 实例不存在: {}", input.instance_id));
    }
    let confirmation = evidence::user_confirmation(
        &input.instance_id,
        &input.source_type,
        input.source_label.trim(),
        input.source_ref.clone(),
        now,
    );
    repository::insert_evidence(conn, &input.instance_id, &confirmation)?;
    recalculate(conn, &input.instance_id, now)
}

pub fn recalculate(
    conn: &Connection,
    instance_id: &str,
    now: i64,
) -> Result<SourceResolution, String> {
    let evidence = repository::list_evidence(conn, instance_id)?;
    let resolution = confidence::resolve(instance_id, &evidence, now);
    repository::upsert_resolution(conn, &resolution)?;
    get(conn, instance_id)
}

fn validate_source_type(value: &str) -> Result<(), String> {
    const TYPES: &[&str] = &[
        "system",
        "plugin",
        "git_repository",
        "marketplace",
        "local_import",
        "manual",
        "platform_scan",
        "central_library",
        "unknown",
    ];
    if TYPES.contains(&value) {
        Ok(())
    } else {
        Err(format!("不支持的来源类型: {value}"))
    }
}
