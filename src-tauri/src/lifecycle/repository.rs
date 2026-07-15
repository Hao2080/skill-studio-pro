use rusqlite::{Connection, OptionalExtension};
use uuid::Uuid;

use super::model::{MappingImpact, OperationListInput, OperationLog, TrashEntry};

#[allow(clippy::too_many_arguments)]
pub fn insert_operation(
    conn: &Connection,
    operation_type: &str,
    entity_type: &str,
    entity_id: Option<&str>,
    target_label: &str,
    plan_json: Option<&str>,
    before_hash: Option<&str>,
    after_hash: Option<&str>,
    snapshot_id: Option<&str>,
    status: &str,
    error_code: Option<&str>,
    error_summary: Option<&str>,
    created_at: i64,
    completed_at: Option<i64>,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let safe_error = error_summary.map(redact_error);
    conn.execute(
        "INSERT INTO operation_logs (
            id, operation_type, entity_type, entity_id, target_label, plan_json,
            before_hash, after_hash, snapshot_id, status, error_code, error_summary,
            created_at, completed_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        rusqlite::params![
            id,
            operation_type,
            entity_type,
            entity_id,
            target_label,
            plan_json,
            before_hash,
            after_hash,
            snapshot_id,
            status,
            error_code,
            safe_error,
            created_at,
            completed_at,
        ],
    )
    .map_err(|error| format!("写入操作记录失败: {error}"))?;
    Ok(id)
}

pub fn list_operations(
    conn: &Connection,
    input: &OperationListInput,
) -> Result<Vec<OperationLog>, String> {
    let limit = input.limit.unwrap_or(100).clamp(1, 500) as i64;
    let offset = input.offset.unwrap_or(0) as i64;
    let mut statement = conn
        .prepare(
            "SELECT id, operation_type, entity_type, entity_id, target_label, plan_json,
                    before_hash, after_hash, snapshot_id, status, error_code, error_summary,
                    created_at, completed_at
             FROM operation_logs
             WHERE (?1 IS NULL OR operation_type = ?1)
               AND (?2 IS NULL OR entity_id = ?2)
               AND (?3 IS NULL OR status = ?3)
             ORDER BY created_at DESC, id DESC LIMIT ?4 OFFSET ?5",
        )
        .map_err(|error| format!("准备操作记录查询失败: {error}"))?;
    let rows = statement
        .query_map(
            rusqlite::params![
                input.operation_type.as_deref(),
                input.entity_id.as_deref(),
                input.status.as_deref(),
                limit,
                offset,
            ],
            |row| {
                Ok(OperationLog {
                    id: row.get(0)?,
                    operation_type: row.get(1)?,
                    entity_type: row.get(2)?,
                    entity_id: row.get(3)?,
                    target_label: row.get(4)?,
                    plan_json: row.get(5)?,
                    before_hash: row.get(6)?,
                    after_hash: row.get(7)?,
                    snapshot_id: row.get(8)?,
                    status: row.get(9)?,
                    error_code: row.get(10)?,
                    error_summary: row.get(11)?,
                    created_at: row.get(12)?,
                    completed_at: row.get(13)?,
                })
            },
        )
        .map_err(|error| format!("查询操作记录失败: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("读取操作记录失败: {error}"))?;
    Ok(rows)
}

pub fn list_mapping_impacts(
    conn: &Connection,
    skill_id: &str,
) -> Result<Vec<MappingImpact>, String> {
    let mut statement = conn
        .prepare(
            "SELECT platform_name, COALESCE(target_path, ''), sync_mode, snapshot_id, drift_status
             FROM platform_release_targets WHERE skill_id = ?1 ORDER BY platform_name",
        )
        .map_err(|error| format!("准备映射影响查询失败: {error}"))?;
    let rows = statement
        .query_map([skill_id], |row| {
            Ok(MappingImpact {
                platform_name: row.get(0)?,
                target_path: row.get(1)?,
                sync_mode: row.get(2)?,
                snapshot_id: row.get(3)?,
                drift_status: row.get(4)?,
            })
        })
        .map_err(|error| format!("查询映射影响失败: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("读取映射影响失败: {error}"))?;
    Ok(rows)
}

pub fn sources_json(conn: &Connection, skill_id: &str) -> Result<String, String> {
    let mut statement = conn
        .prepare(
            "SELECT source_type, source_label, source_ref, source_path, metadata_json, is_primary
             FROM skill_sources WHERE skill_id = ?1 ORDER BY is_primary DESC, created_at",
        )
        .map_err(|error| format!("准备来源查询失败: {error}"))?;
    let values = statement
        .query_map([skill_id], |row| {
            Ok(serde_json::json!({
                "sourceType": row.get::<_, String>(0)?,
                "sourceLabel": row.get::<_, String>(1)?,
                "sourceRef": row.get::<_, Option<String>>(2)?,
                "sourcePath": row.get::<_, Option<String>>(3)?,
                "metadataJson": row.get::<_, Option<String>>(4)?,
                "isPrimary": row.get::<_, i64>(5)? != 0,
            }))
        })
        .map_err(|error| format!("查询来源失败: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("读取来源失败: {error}"))?;
    serde_json::to_string(&values).map_err(|error| format!("序列化来源失败: {error}"))
}

pub fn insert_trash_entry(conn: &Connection, entry: &TrashEntry) -> Result<(), String> {
    conn.execute(
        "INSERT INTO trash_entries (
            id, entity_type, entity_id, display_name, original_path, trash_path,
            manifest_path, related_state_json, content_hash, status, deleted_at,
            restored_at, permanently_deleted_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        rusqlite::params![
            entry.id,
            entry.entity_type,
            entry.entity_id,
            entry.display_name,
            entry.original_path,
            entry.trash_path,
            entry.manifest_path,
            entry.related_state_json,
            entry.content_hash,
            entry.status,
            entry.deleted_at,
            entry.restored_at,
            entry.permanently_deleted_at,
        ],
    )
    .map_err(|error| format!("写入回收站记录失败: {error}"))?;
    Ok(())
}

pub fn get_trash_entry(conn: &Connection, id: &str) -> Result<TrashEntry, String> {
    conn.query_row(
        "SELECT id, entity_type, entity_id, display_name, original_path, trash_path,
                manifest_path, related_state_json, content_hash, status, deleted_at,
                restored_at, permanently_deleted_at
         FROM trash_entries WHERE id = ?1",
        [id],
        map_trash_entry,
    )
    .optional()
    .map_err(|error| format!("读取回收站记录失败: {error}"))?
    .ok_or_else(|| format!("TRASH_ENTRY_NOT_FOUND: {id}"))
}

pub fn list_trash_entries(conn: &Connection) -> Result<Vec<TrashEntry>, String> {
    let mut statement = conn
        .prepare(
            "SELECT id, entity_type, entity_id, display_name, original_path, trash_path,
                    manifest_path, related_state_json, content_hash, status, deleted_at,
                    restored_at, permanently_deleted_at
             FROM trash_entries WHERE status = 'trashed' ORDER BY deleted_at DESC, id",
        )
        .map_err(|error| format!("准备回收站查询失败: {error}"))?;
    let rows = statement
        .query_map([], map_trash_entry)
        .map_err(|error| format!("查询回收站失败: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("读取回收站失败: {error}"))?;
    Ok(rows)
}

fn map_trash_entry(row: &rusqlite::Row<'_>) -> rusqlite::Result<TrashEntry> {
    Ok(TrashEntry {
        id: row.get(0)?,
        entity_type: row.get(1)?,
        entity_id: row.get(2)?,
        display_name: row.get(3)?,
        original_path: row.get(4)?,
        trash_path: row.get(5)?,
        manifest_path: row.get(6)?,
        related_state_json: row.get(7)?,
        content_hash: row.get(8)?,
        status: row.get(9)?,
        deleted_at: row.get(10)?,
        restored_at: row.get(11)?,
        permanently_deleted_at: row.get(12)?,
    })
}

pub fn redact_error(value: &str) -> String {
    let bearer =
        regex::Regex::new(r"(?i)bearer\s+[A-Za-z0-9._~+/=-]{8,}").expect("固定脱敏正则必须有效");
    let assignments =
        regex::Regex::new(r"(?i)(api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,;]+")
            .expect("固定脱敏正则必须有效");
    let redacted = bearer.replace_all(value, "Bearer [REDACTED]");
    assignments
        .replace_all(&redacted, "$1=[REDACTED]")
        .chars()
        .take(2_000)
        .collect()
}

#[cfg(test)]
mod tests {
    #[test]
    fn operation_errors_remove_tokens_and_secret_assignments() {
        let bearer = format!("{}{}", "Bearer ", "abcdefghijklmnop");
        let value = super::redact_error(&format!(
            "{bearer} api_key=top-secret password:do-not-store"
        ));
        assert!(!value.contains("abcdefghijklmnop"));
        assert!(!value.contains("top-secret"));
        assert!(!value.contains("do-not-store"));
        assert!(value.contains("[REDACTED]"));
    }
}
