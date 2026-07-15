use rusqlite::{Connection, OptionalExtension};

use super::model::{SourceEvidence, SourceResolution};

pub fn list_evidence(conn: &Connection, instance_id: &str) -> Result<Vec<SourceEvidence>, String> {
    let mut statement = conn
        .prepare(
            "SELECT id, instance_id, skill_id, evidence_type, evidence_key, evidence_value,
                    source_candidate, weight, is_conflict, resolver_version, observed_at
             FROM source_evidence WHERE instance_id = ?1
             ORDER BY observed_at ASC, id ASC",
        )
        .map_err(|e| format!("准备来源证据查询失败: {e}"))?;
    let evidence = statement
        .query_map(rusqlite::params![instance_id], |row| {
            Ok(SourceEvidence {
                id: row.get(0)?,
                instance_id: row.get(1)?,
                skill_id: row.get(2)?,
                evidence_type: row.get(3)?,
                evidence_key: row.get(4)?,
                evidence_value: row.get(5)?,
                source_candidate: row.get(6)?,
                weight: row.get(7)?,
                is_conflict: row.get::<_, i64>(8)? != 0,
                resolver_version: row.get(9)?,
                observed_at: row.get(10)?,
            })
        })
        .map_err(|e| format!("查询来源证据失败: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("读取来源证据失败: {e}"))?;
    Ok(evidence)
}

pub fn get_resolution(
    conn: &Connection,
    instance_id: &str,
) -> Result<Option<SourceResolution>, String> {
    conn.query_row(
        "SELECT id, instance_id, source_type, source_label, source_ref, confidence,
                resolution_status, rationale, user_confirmed, evidence_hash, resolved_at, updated_at
         FROM source_resolutions WHERE instance_id = ?1",
        rusqlite::params![instance_id],
        |row| {
            Ok(SourceResolution {
                id: row.get(0)?,
                instance_id: row.get(1)?,
                source_type: row.get(2)?,
                source_label: row.get(3)?,
                source_ref: row.get(4)?,
                confidence: row.get(5)?,
                resolution_status: row.get(6)?,
                rationale: row.get(7)?,
                user_confirmed: row.get::<_, i64>(8)? != 0,
                evidence_hash: row.get(9)?,
                resolved_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        },
    )
    .optional()
    .map_err(|e| format!("读取来源结论失败: {e}"))
}

pub fn replace_automatic_evidence(
    conn: &Connection,
    instance_id: &str,
    evidence: &[SourceEvidence],
) -> Result<(), String> {
    conn.execute(
        "DELETE FROM source_evidence
         WHERE instance_id = ?1 AND evidence_type <> 'user_confirmed'",
        rusqlite::params![instance_id],
    )
    .map_err(|e| format!("清理旧来源证据失败: {e}"))?;
    for item in evidence {
        insert_evidence(conn, instance_id, item)?;
    }
    Ok(())
}

pub fn insert_evidence(
    conn: &Connection,
    instance_id: &str,
    item: &SourceEvidence,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO source_evidence (
            id, instance_id, skill_id, evidence_type, evidence_key, evidence_value,
            source_candidate, weight, is_conflict, resolver_version, observed_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        rusqlite::params![
            item.id,
            instance_id,
            item.skill_id,
            item.evidence_type,
            item.evidence_key,
            item.evidence_value,
            item.source_candidate,
            item.weight,
            i64::from(item.is_conflict),
            item.resolver_version,
            item.observed_at,
        ],
    )
    .map_err(|e| format!("写入来源证据失败: {e}"))?;
    Ok(())
}

pub fn upsert_resolution(conn: &Connection, item: &SourceResolution) -> Result<(), String> {
    conn.execute(
        "INSERT INTO source_resolutions (
            id, instance_id, source_type, source_label, source_ref, confidence,
            resolution_status, rationale, user_confirmed, evidence_hash, resolved_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
         ON CONFLICT(instance_id) DO UPDATE SET
            source_type = excluded.source_type,
            source_label = excluded.source_label,
            source_ref = excluded.source_ref,
            confidence = excluded.confidence,
            resolution_status = excluded.resolution_status,
            rationale = excluded.rationale,
            user_confirmed = excluded.user_confirmed,
            evidence_hash = excluded.evidence_hash,
            resolved_at = excluded.resolved_at,
            updated_at = excluded.updated_at",
        rusqlite::params![
            item.id,
            item.instance_id,
            item.source_type,
            item.source_label,
            item.source_ref,
            item.confidence,
            item.resolution_status,
            item.rationale,
            i64::from(item.user_confirmed),
            item.evidence_hash,
            item.resolved_at,
            item.updated_at,
        ],
    )
    .map_err(|e| format!("写入来源结论失败: {e}"))?;
    Ok(())
}
