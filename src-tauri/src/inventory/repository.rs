use std::path::Path;

use rusqlite::{Connection, OptionalExtension, Row};
use uuid::Uuid;

use super::duplicates::{self, DuplicateInput};
use super::hashing::normalize_configured_path;
use super::model::{
    IndexedSkill, InstanceListInput, InstanceListResult, ScanRoot, ScanRootUpsertInput, ScanRun,
    ScanStartInput, SkillInstance, SkillInstanceDetail, SkillInstanceFile,
};

pub fn discover_platform_roots(conn: &Connection, home: &Path, now: i64) -> Result<(), String> {
    for definition in crate::store::inventory_platform_definitions(home) {
        if !definition.skills_dir.is_dir() {
            continue;
        }
        let (path, normalized_path) = normalize_configured_path(&definition.skills_dir)?;
        conn.execute(
            "INSERT OR IGNORE INTO scan_roots (
                id, root_type, platform_name, path, normalized_path, enabled, recursive,
                watch_enabled, ignore_rules_json, created_at, updated_at
             ) VALUES (?1, 'agent_global', ?2, ?3, ?4, 1, 1, 1, '[]', ?5, ?5)",
            rusqlite::params![
                format!("platform:{}", definition.name),
                definition.name,
                path,
                normalized_path,
                now,
            ],
        )
        .map_err(|e| format!("登记平台扫描根失败: {e}"))?;
    }
    for (id, platform, path) in [
        ("plugin:codex", "codex", home.join(".codex/plugins/cache")),
        (
            "plugin:claude",
            "claude",
            home.join(".claude/plugins/cache"),
        ),
    ] {
        if !path.is_dir() {
            continue;
        }
        let (path, normalized_path) = normalize_configured_path(&path)?;
        conn.execute(
            "INSERT OR IGNORE INTO scan_roots (
                id, root_type, platform_name, path, normalized_path, enabled, recursive,
                watch_enabled, ignore_rules_json, created_at, updated_at
             ) VALUES (?1, 'plugin_cache', ?2, ?3, ?4, 1, 1, 1, '[]', ?5, ?5)",
            rusqlite::params![id, platform, path, normalized_path, now],
        )
        .map_err(|e| format!("登记插件扫描根失败: {e}"))?;
    }
    Ok(())
}

pub fn list_roots(conn: &Connection) -> Result<Vec<ScanRoot>, String> {
    let mut statement = conn
        .prepare(
            "SELECT id, root_type, platform_name, path, normalized_path, enabled, recursive,
                    watch_enabled, ignore_rules_json, last_scan_at, created_at, updated_at
             FROM scan_roots ORDER BY root_type, platform_name, normalized_path",
        )
        .map_err(|e| format!("准备扫描根查询失败: {e}"))?;
    let roots = statement
        .query_map([], scan_root_from_row)
        .map_err(|e| format!("查询扫描根失败: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("读取扫描根失败: {e}"))?;
    Ok(roots)
}

pub fn upsert_root(
    conn: &Connection,
    input: &ScanRootUpsertInput,
    now: i64,
) -> Result<ScanRoot, String> {
    validate_root_type(&input.root_type)?;
    let (path, normalized_path) = normalize_configured_path(Path::new(input.path.trim()))?;
    let existing_id = conn
        .query_row(
            "SELECT id FROM scan_roots WHERE normalized_path = ?1",
            rusqlite::params![normalized_path],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|e| format!("查找扫描根失败: {e}"))?;
    let id = input
        .id
        .as_ref()
        .filter(|value| !value.trim().is_empty())
        .cloned()
        .or(existing_id)
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    let ignore_rules = serde_json::to_string(&input.ignore_rules)
        .map_err(|e| format!("序列化忽略规则失败: {e}"))?;
    conn.execute(
        "INSERT INTO scan_roots (
            id, root_type, platform_name, path, normalized_path, enabled, recursive,
            watch_enabled, ignore_rules_json, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)
         ON CONFLICT(id) DO UPDATE SET
            root_type = excluded.root_type,
            platform_name = excluded.platform_name,
            path = excluded.path,
            normalized_path = excluded.normalized_path,
            enabled = excluded.enabled,
            recursive = excluded.recursive,
            watch_enabled = excluded.watch_enabled,
            ignore_rules_json = excluded.ignore_rules_json,
            updated_at = excluded.updated_at",
        rusqlite::params![
            id,
            input.root_type,
            input.platform_name,
            path,
            normalized_path,
            i64::from(input.enabled.unwrap_or(true)),
            i64::from(input.recursive.unwrap_or(true)),
            i64::from(input.watch_enabled.unwrap_or(true)),
            ignore_rules,
            now,
        ],
    )
    .map_err(|e| format!("保存扫描根失败: {e}"))?;
    get_root(conn, &id)
}

pub fn get_root(conn: &Connection, id: &str) -> Result<ScanRoot, String> {
    conn.query_row(
        "SELECT id, root_type, platform_name, path, normalized_path, enabled, recursive,
                watch_enabled, ignore_rules_json, last_scan_at, created_at, updated_at
         FROM scan_roots WHERE id = ?1",
        rusqlite::params![id],
        scan_root_from_row,
    )
    .map_err(|e| format!("读取扫描根失败: {e}"))
}

pub fn selected_roots(conn: &Connection, root_ids: &[String]) -> Result<Vec<ScanRoot>, String> {
    let roots = list_roots(conn)?;
    Ok(roots
        .into_iter()
        .filter(|root| {
            root.enabled && (root_ids.is_empty() || root_ids.iter().any(|id| id == &root.id))
        })
        .collect())
}

pub fn create_scan_run(
    conn: &Connection,
    input: &ScanStartInput,
    roots_total: i64,
    now: i64,
) -> Result<ScanRun, String> {
    let run = ScanRun {
        id: Uuid::new_v4().to_string(),
        mode: input.mode.as_str().to_string(),
        status: "running".to_string(),
        roots_total,
        roots_completed: 0,
        candidates_seen: 0,
        instances_changed: 0,
        error_count: 0,
        started_at: now,
        completed_at: None,
        cancelled_at: None,
        error_summary: None,
    };
    conn.execute(
        "INSERT INTO scan_runs (
            id, mode, status, roots_total, roots_completed, candidates_seen,
            instances_changed, error_count, started_at
         ) VALUES (?1, ?2, ?3, ?4, 0, 0, 0, 0, ?5)",
        rusqlite::params![
            run.id,
            run.mode,
            run.status,
            run.roots_total,
            run.started_at
        ],
    )
    .map_err(|e| format!("创建扫描运行失败: {e}"))?;
    Ok(run)
}

pub fn update_scan_run(conn: &Connection, run: &ScanRun) -> Result<(), String> {
    conn.execute(
        "UPDATE scan_runs SET status = ?2, roots_completed = ?3, candidates_seen = ?4,
                instances_changed = ?5, error_count = ?6, completed_at = ?7,
                cancelled_at = ?8, error_summary = ?9 WHERE id = ?1",
        rusqlite::params![
            run.id,
            run.status,
            run.roots_completed,
            run.candidates_seen,
            run.instances_changed,
            run.error_count,
            run.completed_at,
            run.cancelled_at,
            run.error_summary,
        ],
    )
    .map_err(|e| format!("更新扫描运行失败: {e}"))?;
    Ok(())
}

pub fn previous_signature(
    conn: &Connection,
    normalized_path: &str,
) -> Result<Option<String>, String> {
    conn.query_row(
        "SELECT scan_signature FROM skill_instances WHERE normalized_path = ?1",
        rusqlite::params![normalized_path],
        |row| row.get(0),
    )
    .optional()
    .map_err(|e| format!("读取增量摘要失败: {e}"))
}

pub fn touch_unchanged(
    conn: &Connection,
    normalized_path: &str,
    root: &ScanRoot,
    now: i64,
) -> Result<Option<String>, String> {
    conn.query_row(
        "UPDATE skill_instances SET scan_root_id = ?2, platform_name = ?3, scope_type = ?4,
                last_seen_at = ?5, missing_at = NULL WHERE normalized_path = ?1 RETURNING id",
        rusqlite::params![
            normalized_path,
            root.id,
            root.platform_name,
            root.root_type,
            now
        ],
        |row| row.get(0),
    )
    .optional()
    .map_err(|e| format!("更新未变化实例失败: {e}"))
}

pub fn upsert_indexed_skill(
    conn: &mut Connection,
    root: &ScanRoot,
    indexed: &IndexedSkill,
    evidence: &[crate::origin::model::SourceEvidence],
    now: i64,
) -> Result<String, String> {
    let existing_id = conn
        .query_row(
            "SELECT id FROM skill_instances WHERE normalized_path = ?1",
            rusqlite::params![indexed.normalized_path],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|e| format!("查找现有实例失败: {e}"))?;
    let id = existing_id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let metadata_json = json_string(&indexed.parsed.metadata)?;
    let headings_json = json_string(&indexed.parsed.headings)?;
    let warnings_json = json_string(&indexed.parsed.warnings)?;
    let risks_json = json_string(&indexed.risk_flags)?;
    let plugin_manifest_json = indexed
        .plugin_manifest
        .as_ref()
        .map(json_string)
        .transpose()?;
    let parse_status = if indexed.parsed.error.is_some() {
        "error"
    } else {
        "ok"
    };
    let transaction = conn
        .transaction()
        .map_err(|e| format!("开启实例索引事务失败: {e}"))?;
    transaction
        .execute(
            "INSERT INTO skill_instances (
                id, scan_root_id, platform_name, scope_type, absolute_path, normalized_path,
                folder_name, parsed_name, canonical_name, description, short_description,
                metadata_json, headings_json, content_hash, skill_md_hash, manifest_hash,
                scan_signature, file_count, has_scripts, has_executables, risk_flags_json,
                duplicate_kinds_json, parse_status, parse_error, parse_warnings_json,
                git_remote, git_commit, plugin_manifest_json, first_seen_at, last_seen_at,
                last_modified_at, missing_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14,
                       ?15, ?16, ?17, ?18, ?19, ?20, ?21, '[]', ?22, ?23, ?24, ?25, ?26,
                       ?27, ?28, ?28, ?29, NULL)
             ON CONFLICT(normalized_path) DO UPDATE SET
                scan_root_id = excluded.scan_root_id,
                platform_name = excluded.platform_name,
                scope_type = excluded.scope_type,
                absolute_path = excluded.absolute_path,
                folder_name = excluded.folder_name,
                parsed_name = excluded.parsed_name,
                canonical_name = excluded.canonical_name,
                description = excluded.description,
                short_description = excluded.short_description,
                metadata_json = excluded.metadata_json,
                headings_json = excluded.headings_json,
                content_hash = excluded.content_hash,
                skill_md_hash = excluded.skill_md_hash,
                manifest_hash = excluded.manifest_hash,
                scan_signature = excluded.scan_signature,
                file_count = excluded.file_count,
                has_scripts = excluded.has_scripts,
                has_executables = excluded.has_executables,
                risk_flags_json = excluded.risk_flags_json,
                parse_status = excluded.parse_status,
                parse_error = excluded.parse_error,
                parse_warnings_json = excluded.parse_warnings_json,
                git_remote = excluded.git_remote,
                git_commit = excluded.git_commit,
                plugin_manifest_json = excluded.plugin_manifest_json,
                last_seen_at = excluded.last_seen_at,
                last_modified_at = excluded.last_modified_at,
                missing_at = NULL",
            rusqlite::params![
                id,
                root.id,
                root.platform_name,
                root.root_type,
                indexed.absolute_path,
                indexed.normalized_path,
                indexed.folder_name,
                indexed.parsed.name,
                indexed.canonical_name,
                indexed.parsed.description,
                indexed.parsed.short_description,
                metadata_json,
                headings_json,
                indexed.content_hash,
                indexed.skill_md_hash,
                indexed.manifest_hash,
                indexed.scan_signature,
                indexed.files.len() as i64,
                i64::from(indexed.has_scripts),
                i64::from(indexed.has_executables),
                risks_json,
                parse_status,
                indexed.parsed.error,
                warnings_json,
                indexed.git_remote,
                indexed.git_commit,
                plugin_manifest_json,
                now,
                indexed.last_modified_at,
            ],
        )
        .map_err(|e| format!("写入 Skill 实例失败: {e}"))?;
    transaction
        .execute(
            "DELETE FROM skill_instance_files WHERE instance_id = ?1",
            rusqlite::params![id],
        )
        .map_err(|e| format!("清理实例文件索引失败: {e}"))?;
    for file in &indexed.files {
        transaction
            .execute(
                "INSERT INTO skill_instance_files (
                    instance_id, relative_path, file_type, size_bytes, modified_at,
                    content_hash, risk_flags_json
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                rusqlite::params![
                    id,
                    file.relative_path,
                    file.file_type,
                    file.size_bytes,
                    file.modified_at,
                    file.content_hash,
                    json_string(&file.risk_flags)?,
                ],
            )
            .map_err(|e| format!("写入实例文件索引失败: {e}"))?;
    }
    crate::origin::repository::replace_automatic_evidence(&transaction, &id, evidence)?;
    let all_evidence = crate::origin::repository::list_evidence(&transaction, &id)?;
    let resolution = crate::origin::confidence::resolve(&id, &all_evidence, now);
    crate::origin::repository::upsert_resolution(&transaction, &resolution)?;
    transaction
        .commit()
        .map_err(|e| format!("提交实例索引事务失败: {e}"))?;
    Ok(id)
}

pub fn mark_missing_for_root(
    conn: &Connection,
    root_id: &str,
    run_started_at: i64,
    now: i64,
) -> Result<Vec<String>, String> {
    let mut statement = conn
        .prepare(
            "SELECT id FROM skill_instances
             WHERE scan_root_id = ?1 AND last_seen_at < ?2 AND missing_at IS NULL",
        )
        .map_err(|e| format!("准备失踪实例查询失败: {e}"))?;
    let ids = statement
        .query_map(rusqlite::params![root_id, run_started_at], |row| row.get(0))
        .map_err(|e| format!("查询失踪实例失败: {e}"))?
        .collect::<Result<Vec<String>, _>>()
        .map_err(|e| format!("读取失踪实例失败: {e}"))?;
    drop(statement);
    conn.execute(
        "UPDATE skill_instances SET missing_at = ?3
         WHERE scan_root_id = ?1 AND last_seen_at < ?2 AND missing_at IS NULL",
        rusqlite::params![root_id, run_started_at, now],
    )
    .map_err(|e| format!("标记失踪实例失败: {e}"))?;
    Ok(ids)
}

pub fn mark_root_scanned(conn: &Connection, root_id: &str, now: i64) -> Result<(), String> {
    conn.execute(
        "UPDATE scan_roots SET last_scan_at = ?2, updated_at = ?2 WHERE id = ?1",
        rusqlite::params![root_id, now],
    )
    .map_err(|e| format!("更新扫描根时间失败: {e}"))?;
    Ok(())
}

pub fn recalculate_duplicates(conn: &Connection) -> Result<Vec<String>, String> {
    let mut statement = conn
        .prepare(
            "SELECT id, canonical_name, content_hash FROM skill_instances WHERE missing_at IS NULL",
        )
        .map_err(|e| format!("准备重复查询失败: {e}"))?;
    let inputs = statement
        .query_map([], |row| {
            Ok(DuplicateInput {
                id: row.get(0)?,
                canonical_name: row.get(1)?,
                content_hash: row.get(2)?,
            })
        })
        .map_err(|e| format!("查询重复实例失败: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("读取重复实例失败: {e}"))?;
    drop(statement);
    let classified = duplicates::classify(&inputs);
    let mut changed = Vec::new();
    for input in inputs {
        let kinds = classified.get(&input.id).cloned().unwrap_or_default();
        let serialized = json_string(&kinds)?;
        let old: String = conn
            .query_row(
                "SELECT duplicate_kinds_json FROM skill_instances WHERE id = ?1",
                rusqlite::params![input.id],
                |row| row.get(0),
            )
            .map_err(|e| format!("读取旧重复状态失败: {e}"))?;
        if old != serialized {
            conn.execute(
                "UPDATE skill_instances SET duplicate_kinds_json = ?2 WHERE id = ?1",
                rusqlite::params![input.id, serialized],
            )
            .map_err(|e| format!("更新重复状态失败: {e}"))?;
            changed.push(input.id);
        }
    }
    Ok(changed)
}

pub fn list_instances(
    conn: &Connection,
    input: &InstanceListInput,
) -> Result<InstanceListResult, String> {
    let search = input
        .search
        .as_ref()
        .map(|value| format!("%{}%", value.trim()));
    let duplicate = input
        .duplicate_kind
        .as_ref()
        .map(|value| format!("%\"{}\"%", value.trim()));
    let include_missing = input.include_missing.unwrap_or(false);
    let total = conn
        .query_row(
            "SELECT COUNT(*) FROM skill_instances
             WHERE (?1 IS NULL OR parsed_name LIKE ?1 OR folder_name LIKE ?1 OR description LIKE ?1)
               AND (?2 IS NULL OR platform_name = ?2)
               AND (?3 IS NULL OR parse_status = ?3)
               AND (?4 IS NULL OR duplicate_kinds_json LIKE ?4)
               AND (?5 = 1 OR missing_at IS NULL)",
            rusqlite::params![
                search,
                input.platform_name,
                input.parse_status,
                duplicate,
                i64::from(include_missing),
            ],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|e| format!("统计实例失败: {e}"))?;
    let mut statement = conn
        .prepare(
            "SELECT id, central_skill_id, scan_root_id, platform_name, scope_type, absolute_path,
                    normalized_path, folder_name, parsed_name, canonical_name, description,
                    short_description, metadata_json, headings_json, content_hash, skill_md_hash,
                    manifest_hash, file_count, has_scripts, has_executables, risk_flags_json,
                    duplicate_kinds_json, parse_status, parse_error, parse_warnings_json,
                    git_remote, git_commit, plugin_manifest_json, first_seen_at, last_seen_at,
                    last_modified_at, missing_at
             FROM skill_instances
             WHERE (?1 IS NULL OR parsed_name LIKE ?1 OR folder_name LIKE ?1 OR description LIKE ?1)
               AND (?2 IS NULL OR platform_name = ?2)
               AND (?3 IS NULL OR parse_status = ?3)
               AND (?4 IS NULL OR duplicate_kinds_json LIKE ?4)
               AND (?5 = 1 OR missing_at IS NULL)
             ORDER BY missing_at IS NOT NULL, last_modified_at DESC, canonical_name ASC
             LIMIT ?6 OFFSET ?7",
        )
        .map_err(|e| format!("准备实例列表失败: {e}"))?;
    let items = statement
        .query_map(
            rusqlite::params![
                search,
                input.platform_name,
                input.parse_status,
                duplicate,
                i64::from(include_missing),
                input.limit.unwrap_or(100).clamp(1, 500),
                input.offset.unwrap_or(0).max(0),
            ],
            skill_instance_from_row,
        )
        .map_err(|e| format!("查询实例列表失败: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("读取实例列表失败: {e}"))?;
    Ok(InstanceListResult { items, total })
}

pub fn get_instance(conn: &Connection, instance_id: &str) -> Result<SkillInstanceDetail, String> {
    let instance = conn
        .query_row(
            "SELECT id, central_skill_id, scan_root_id, platform_name, scope_type, absolute_path,
                    normalized_path, folder_name, parsed_name, canonical_name, description,
                    short_description, metadata_json, headings_json, content_hash, skill_md_hash,
                    manifest_hash, file_count, has_scripts, has_executables, risk_flags_json,
                    duplicate_kinds_json, parse_status, parse_error, parse_warnings_json,
                    git_remote, git_commit, plugin_manifest_json, first_seen_at, last_seen_at,
                    last_modified_at, missing_at
             FROM skill_instances WHERE id = ?1",
            rusqlite::params![instance_id],
            skill_instance_from_row,
        )
        .map_err(|e| format!("读取 Skill 实例失败: {e}"))?;
    let mut statement = conn
        .prepare(
            "SELECT relative_path, file_type, size_bytes, modified_at, content_hash, risk_flags_json
             FROM skill_instance_files WHERE instance_id = ?1 ORDER BY relative_path",
        )
        .map_err(|e| format!("准备实例文件查询失败: {e}"))?;
    let files = statement
        .query_map(rusqlite::params![instance_id], |row| {
            Ok(SkillInstanceFile {
                relative_path: row.get(0)?,
                file_type: row.get(1)?,
                size_bytes: row.get(2)?,
                modified_at: row.get(3)?,
                content_hash: row.get(4)?,
                risk_flags: json_or_default(row.get::<_, String>(5)?),
            })
        })
        .map_err(|e| format!("查询实例文件失败: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("读取实例文件失败: {e}"))?;
    Ok(SkillInstanceDetail {
        instance,
        files,
        resolution: crate::origin::repository::get_resolution(conn, instance_id)?,
        evidence: crate::origin::repository::list_evidence(conn, instance_id)?,
    })
}

/// Central-library services call this inside the same transaction that creates
/// the central Skill, after they have copied and verified the source hash.
pub fn attach_central_skill(
    conn: &Connection,
    instance_id: &str,
    central_skill_id: &str,
) -> Result<(), String> {
    let changed = conn
        .execute(
            "UPDATE skill_instances SET central_skill_id = ?2 WHERE id = ?1",
            rusqlite::params![instance_id, central_skill_id],
        )
        .map_err(|e| format!("关联中央 Skill 失败: {e}"))?;
    if changed == 1 {
        Ok(())
    } else {
        Err(format!("Skill 实例不存在: {instance_id}"))
    }
}

fn scan_root_from_row(row: &Row<'_>) -> rusqlite::Result<ScanRoot> {
    let path: String = row.get(3)?;
    Ok(ScanRoot {
        id: row.get(0)?,
        root_type: row.get(1)?,
        platform_name: row.get(2)?,
        available: Path::new(&path).is_dir(),
        path,
        normalized_path: row.get(4)?,
        enabled: row.get::<_, i64>(5)? != 0,
        recursive: row.get::<_, i64>(6)? != 0,
        watch_enabled: row.get::<_, i64>(7)? != 0,
        ignore_rules: json_or_default(row.get::<_, String>(8)?),
        last_scan_at: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
    })
}

fn skill_instance_from_row(row: &Row<'_>) -> rusqlite::Result<SkillInstance> {
    Ok(SkillInstance {
        id: row.get(0)?,
        central_skill_id: row.get(1)?,
        scan_root_id: row.get(2)?,
        platform_name: row.get(3)?,
        scope_type: row.get(4)?,
        absolute_path: row.get(5)?,
        normalized_path: row.get(6)?,
        folder_name: row.get(7)?,
        parsed_name: row.get(8)?,
        canonical_name: row.get(9)?,
        description: row.get(10)?,
        short_description: row.get(11)?,
        metadata: json_value_or_default(row.get::<_, String>(12)?, serde_json::json!({})),
        headings: json_or_default(row.get::<_, String>(13)?),
        content_hash: row.get(14)?,
        skill_md_hash: row.get(15)?,
        manifest_hash: row.get(16)?,
        file_count: row.get(17)?,
        has_scripts: row.get::<_, i64>(18)? != 0,
        has_executables: row.get::<_, i64>(19)? != 0,
        risk_flags: json_or_default(row.get::<_, String>(20)?),
        duplicate_kinds: json_or_default(row.get::<_, String>(21)?),
        parse_status: row.get(22)?,
        parse_error: row.get(23)?,
        parse_warnings: json_or_default(row.get::<_, String>(24)?),
        git_remote: row.get(25)?,
        git_commit: row.get(26)?,
        plugin_manifest: row
            .get::<_, Option<String>>(27)?
            .map(|value| json_value_or_default(value, serde_json::json!({}))),
        first_seen_at: row.get(28)?,
        last_seen_at: row.get(29)?,
        last_modified_at: row.get(30)?,
        missing_at: row.get(31)?,
    })
}

fn validate_root_type(value: &str) -> Result<(), String> {
    if matches!(
        value,
        "agent_global" | "plugin_cache" | "project" | "custom" | "central_library"
    ) {
        Ok(())
    } else {
        Err(format!("不支持的扫描根类型: {value}"))
    }
}

fn json_string<T: serde::Serialize + ?Sized>(value: &T) -> Result<String, String> {
    serde_json::to_string(value).map_err(|e| format!("序列化索引字段失败: {e}"))
}

fn json_or_default<T: serde::de::DeserializeOwned + Default>(value: String) -> T {
    serde_json::from_str(&value).unwrap_or_default()
}

fn json_value_or_default(value: String, default: serde_json::Value) -> serde_json::Value {
    serde_json::from_str(&value).unwrap_or(default)
}
