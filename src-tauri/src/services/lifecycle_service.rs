use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;

use rusqlite::{Connection, OptionalExtension};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::inventory::scanner::{discover_skill_roots, index_skill};
use crate::lifecycle::file_transaction::{
    atomic_write, resolve_write_target, safe_remove_dir_all, validate_text_content,
};
use crate::lifecycle::journal::JournalStore;
use crate::lifecycle::model::*;
use crate::lifecycle::{repository, source};
use crate::services::library_service::{
    acquire_locks, calculate_plan_hash, copy_skill_tree, hash_skill_directory, load_plan,
    normalized_lock_path, persist_plan, release_locks, validate_execute_plan, PLAN_TTL_MS,
};
use crate::store::{compute_directory_revision, now_ms, slugify};

pub struct LifecycleService {
    workspace_root: PathBuf,
    fault: Option<LifecycleFaultPoint>,
}

impl LifecycleService {
    pub fn new(workspace_root: PathBuf) -> Result<Self, String> {
        if !workspace_root.is_absolute() {
            return Err("生命周期工作区必须是绝对路径".to_string());
        }
        for relative in [
            "skills",
            "snapshots",
            "staging/import",
            "staging/journals",
            "trash/skills",
            "trash/manifests",
        ] {
            fs::create_dir_all(workspace_root.join(relative))
                .map_err(|error| format!("创建生命周期目录失败: {error}"))?;
        }
        Ok(Self {
            workspace_root,
            fault: None,
        })
    }

    pub fn with_fault(workspace_root: PathBuf, fault: LifecycleFaultPoint) -> Result<Self, String> {
        let mut service = Self::new(workspace_root)?;
        service.fault = Some(fault);
        Ok(service)
    }

    pub fn open_connection(&self) -> Result<Connection, String> {
        crate::db::init_db_at_path(&self.workspace_root)
    }

    pub fn create_import_plan(&self, input: &ImportPlanInput) -> Result<InstallPlan, String> {
        let plan_id = Uuid::new_v4().to_string();
        let staging = self.workspace_root.join("staging/import").join(&plan_id);
        fs::create_dir(&staging).map_err(|error| format!("创建导入 staging 失败: {error}"))?;
        let conn = self.open_connection()?;
        let journal = JournalStore::new(self.workspace_root.clone())?;
        journal.write(
            &conn,
            &StagingJournal {
                id: plan_id.clone(),
                operation_type: "import".to_string(),
                phase: "preparing_source".to_string(),
                source_path: input
                    .local_path
                    .clone()
                    .or(input.zip_path.clone())
                    .or(input.git_url.clone()),
                target_path: None,
                backup_path: None,
                staging_path: Some(staging.to_string_lossy().to_string()),
                entity_id: None,
                expected_hash: None,
                updated_at: now_ms(),
            },
        )?;

        let result = (|| -> Result<InstallPlan, String> {
            let prepared = source::prepare_source(input, &staging)?;
            self.fail_if(LifecycleFaultPoint::AfterSourceStaged)?;
            let mut roots =
                discover_skill_roots(&prepared.root, true, &AtomicBool::new(false)).skill_roots;
            roots.sort();
            roots.dedup();
            if roots.is_empty() {
                return Err("NO_SKILLS_DISCOVERED: staging 中未发现 SKILL.md".to_string());
            }
            let mut candidates = Vec::with_capacity(roots.len());
            for root in roots {
                let (indexed, _) = index_skill(&root, &prepared.root, None, now_ms())?;
                let relative_path = root
                    .strip_prefix(&prepared.root)
                    .map_err(|_| "STAGING_PATH_ESCAPE: Skill 候选越界".to_string())?
                    .to_string_lossy()
                    .replace('\\', "/");
                let name = indexed
                    .parsed
                    .name
                    .clone()
                    .filter(|value| !value.trim().is_empty())
                    .unwrap_or_else(|| indexed.folder_name.clone());
                let slug = slugify(&name);
                let conflicts = load_conflicts(&conn, &name, &slug, &indexed.content_hash)?;
                let scripts = indexed
                    .files
                    .iter()
                    .filter(|file| file.risk_flags.iter().any(|flag| flag == "script"))
                    .map(|file| file.relative_path.clone())
                    .collect::<Vec<_>>();
                let total_bytes = indexed
                    .files
                    .iter()
                    .filter(|file| file.file_type == "file")
                    .map(|file| file.size_bytes.max(0) as u64)
                    .sum();
                candidates.push(InstallCandidate {
                    id: Uuid::new_v4().to_string(),
                    name,
                    slug,
                    relative_path,
                    content_hash: indexed.content_hash,
                    file_count: indexed.files.len() as u64,
                    total_bytes,
                    scripts,
                    risk_flags: indexed.risk_flags,
                    conflicts,
                    target_agents: input.target_agents.clone(),
                });
            }
            let source_hash = plan_source_hash(&candidates);
            let now = now_ms();
            let mut plan = InstallPlan {
                id: plan_id.clone(),
                provenance: prepared.provenance,
                staging_path: staging.to_string_lossy().to_string(),
                source_hash,
                candidates,
                plan_hash: String::new(),
                created_at: now,
                expires_at: now + PLAN_TTL_MS,
            };
            plan.plan_hash = calculate_plan_hash(&plan)?;
            persist_plan(&conn, "import", &plan.id, &plan, &plan.source_hash)?;
            journal.write(
                &conn,
                &StagingJournal {
                    id: plan.id.clone(),
                    operation_type: "import".to_string(),
                    phase: "planned".to_string(),
                    source_path: None,
                    target_path: None,
                    backup_path: None,
                    staging_path: Some(plan.staging_path.clone()),
                    entity_id: None,
                    expected_hash: Some(plan.source_hash.clone()),
                    updated_at: now_ms(),
                },
            )?;
            record_import_log(&conn, &plan, "planned", None, None)?;
            Ok(plan)
        })();
        if let Err(error) = &result {
            let _ = safe_remove_dir_all(&self.workspace_root.join("staging/import"), &staging);
            let _ = repository::insert_operation(
                &conn,
                "import",
                "source",
                None,
                "导入计划",
                None,
                None,
                None,
                None,
                "failed",
                Some(error_code(error)),
                Some(error),
                now_ms(),
                Some(now_ms()),
            );
            let _ = conn.execute(
                "INSERT INTO skill_import_logs (
                    id, source_type, source_label, source_ref, source_path,
                    request_payload_json, status, error_message, created_at, updated_at, plan_id
                 ) VALUES (?1, ?2, '导入来源', ?3, ?4, ?5, 'failed', ?6, ?7, ?7, ?8)",
                rusqlite::params![
                    Uuid::new_v4().to_string(),
                    source_type_label(&input.source_type),
                    input.git_url.as_deref(),
                    input.local_path.as_deref().or(input.zip_path.as_deref()),
                    safe_import_request_json(input),
                    repository::redact_error(error),
                    now_ms(),
                    plan_id,
                ],
            );
            let _ = journal.complete(&conn, &plan_id);
        }
        result
    }

    pub fn execute_import_plan(&self, input: &ImportExecuteInput) -> Result<ImportResult, String> {
        let conn = self.open_connection()?;
        let plan: InstallPlan = load_plan(&conn, &input.plan_id, "import")?;
        let validation = validate_execute_plan(
            &plan.plan_hash,
            plan.expires_at,
            &crate::services::library_service::ExecutePlanInput {
                plan_id: input.plan_id.clone(),
                plan_hash: input.plan_hash.clone(),
            },
        );
        if let Err(error) = validation {
            if error.starts_with("PLAN_STALE") {
                let staging = PathBuf::from(&plan.staging_path);
                let _ = safe_remove_dir_all(&self.workspace_root.join("staging/import"), &staging);
                let _ = conn.execute(
                    "UPDATE library_operation_plans SET status = 'failed', executed_at = ?2 WHERE id = ?1",
                    rusqlite::params![plan.id, now_ms()],
                );
                let _ = record_import_log(&conn, &plan, "failed", None, Some(&error));
                let _ = JournalStore::new(self.workspace_root.clone())
                    .and_then(|journal| journal.complete(&conn, &plan.id));
            }
            return Err(error);
        }
        if let Err(error) = self.validate_staged_plan(&plan) {
            let staging = PathBuf::from(&plan.staging_path);
            let _ = safe_remove_dir_all(&self.workspace_root.join("staging/import"), &staging);
            let _ = conn.execute(
                "UPDATE library_operation_plans SET status = 'failed', executed_at = ?2 WHERE id = ?1",
                rusqlite::params![plan.id, now_ms()],
            );
            let _ = record_import_log(&conn, &plan, "failed", None, Some(&error));
            let _ = JournalStore::new(self.workspace_root.clone())
                .and_then(|journal| journal.complete(&conn, &plan.id));
            return Err(error);
        }
        let selections = resolve_selections(&plan, &input.selections)?;
        let mut results = Vec::new();
        let mut errors = Vec::new();
        for selection in selections {
            if selection.action == ImportConflictAction::Cancel {
                continue;
            }
            match self.execute_candidate(&conn, &plan, &selection) {
                Ok(result) => results.push(result),
                Err(error) => errors.push(error),
            }
        }
        let status = if errors.is_empty() {
            "success"
        } else if results.is_empty() {
            "failed"
        } else {
            "partial_success"
        };
        conn.execute(
            "UPDATE library_operation_plans SET status = ?2, executed_at = ?3 WHERE id = ?1",
            rusqlite::params![plan.id, status, now_ms()],
        )
        .map_err(|error| format!("更新导入计划状态失败: {error}"))?;
        record_import_log(
            &conn,
            &plan,
            status,
            results.first().map(|result| result.skill_id.as_str()),
            (!errors.is_empty()).then(|| errors.join(" | ")).as_deref(),
        )?;
        repository::insert_operation(
            &conn,
            "import",
            "import_plan",
            Some(&plan.id),
            &plan.provenance.source_label,
            serde_json::to_string(&plan).ok().as_deref(),
            Some(&plan.source_hash),
            results.last().map(|result| result.content_hash.as_str()),
            results.last().map(|result| result.snapshot_id.as_str()),
            status,
            (!errors.is_empty()).then_some("IMPORT_CANDIDATE_FAILED"),
            (!errors.is_empty()).then(|| errors.join(" | ")).as_deref(),
            plan.created_at,
            Some(now_ms()),
        )?;
        let staging = PathBuf::from(&plan.staging_path);
        safe_remove_dir_all(&self.workspace_root.join("staging/import"), &staging)?;
        JournalStore::new(self.workspace_root.clone())?.complete(&conn, &plan.id)?;
        if status == "failed" {
            return Err(format!("IMPORT_FAILED: {}", errors.join(" | ")));
        }
        Ok(ImportResult {
            plan_id: plan.id,
            status: status.to_string(),
            imported: results,
            publish_deferred: true,
            requested_target_agents: plan
                .candidates
                .first()
                .map(|candidate| candidate.target_agents.clone())
                .unwrap_or_default(),
        })
    }

    pub fn save_text_file(&self, input: &SaveTextFileInput) -> Result<SaveTextFileResult, String> {
        if input.skill_id.trim().is_empty() || input.edit_session_id.trim().is_empty() {
            return Err("skillId 和 editSessionId 不能为空".to_string());
        }
        let conn = self.open_connection()?;
        let (name, storage_rel_path, lifecycle_state): (String, String, String) = conn
            .query_row(
                "SELECT name, COALESCE(storage_rel_path, slug), lifecycle_state
                 FROM skills WHERE id = ?1",
                [&input.skill_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .map_err(|_| format!("中央 Skill 不存在: {}", input.skill_id))?;
        if lifecycle_state != "active" {
            return Err("SKILL_NOT_ACTIVE: 回收站中的 Skill 不可编辑".to_string());
        }
        let root = self.workspace_root.join("skills").join(storage_rel_path);
        let target = resolve_write_target(&root, &input.relative_path)?;
        validate_text_content(&target, &input.content)?;
        let operation_id = Uuid::new_v4().to_string();
        acquire_locks(
            &conn,
            &operation_id,
            &[
                format!("skill:{}", input.skill_id),
                format!("path:{}", normalized_lock_path(&target)),
            ],
        )?;
        let result = (|| -> Result<SaveTextFileResult, String> {
            let before_hash = target
                .is_file()
                .then(|| crate::inventory::hashing::sha256_file(&target))
                .transpose()?;
            let existing_recovery: Option<String> = conn
                .query_row(
                    "SELECT snapshot_id FROM edit_recovery_points
                     WHERE skill_id = ?1 AND session_id = ?2",
                    rusqlite::params![input.skill_id, input.edit_session_id],
                    |row| row.get(0),
                )
                .optional()
                .map_err(|error| format!("读取编辑恢复点失败: {error}"))?;
            let (recovery_snapshot_id, recovery_created) = match existing_recovery {
                Some(id) => (id, false),
                None => {
                    let id = create_snapshot_record(
                        &conn,
                        &self.workspace_root,
                        &input.skill_id,
                        &root,
                        "system",
                        Some("首次保存前自动恢复点"),
                    )?;
                    conn.execute(
                        "INSERT INTO edit_recovery_points (skill_id, session_id, snapshot_id, created_at)
                         VALUES (?1, ?2, ?3, ?4)",
                        rusqlite::params![input.skill_id, input.edit_session_id, id, now_ms()],
                    )
                    .map_err(|error| format!("记录编辑恢复点失败: {error}"))?;
                    (id, true)
                }
            };
            self.fail_if(LifecycleFaultPoint::BeforeAtomicEditReplace)?;
            atomic_write(&target, input.content.as_bytes())?;
            let after_hash = hash_skill_directory(&root)?;
            let now = now_ms();
            let outdated = conn
                .execute(
                    "UPDATE platform_release_targets
                     SET drift_status = 'outdated', observed_target_hash = NULL,
                         last_checked_at = ?2, updated_at = ?2
                     WHERE skill_id = ?1",
                    rusqlite::params![input.skill_id, now],
                )
                .map_err(|error| format!("标记映射过期失败: {error}"))?;
            conn.execute(
                "UPDATE skills SET active_content_hash = ?2, updated_at = ?3 WHERE id = ?1",
                rusqlite::params![input.skill_id, after_hash, now],
            )
            .map_err(|error| format!("更新中央 Skill 哈希失败: {error}"))?;
            conn.execute(
                "UPDATE ai_artifacts SET stale_at = ?2
                 WHERE skill_id = ?1 AND stale_at IS NULL",
                rusqlite::params![input.skill_id, now],
            )
            .map_err(|error| format!("标记 AI 产物过期失败: {error}"))?;
            repository::insert_operation(
                &conn,
                "edit_save",
                "skill",
                Some(&input.skill_id),
                &format!("{name}/{}", input.relative_path),
                None,
                before_hash.as_deref(),
                Some(&after_hash),
                Some(&recovery_snapshot_id),
                "success",
                None,
                None,
                now,
                Some(now),
            )?;
            Ok(SaveTextFileResult {
                skill_id: input.skill_id.clone(),
                relative_path: input.relative_path.clone(),
                before_hash,
                after_hash,
                recovery_snapshot_id,
                recovery_point_created: recovery_created,
                outdated_mapping_count: outdated as u64,
            })
        })();
        release_locks(&conn, &operation_id);
        if let Err(error) = &result {
            let _ = repository::insert_operation(
                &conn,
                "edit_save",
                "skill",
                Some(&input.skill_id),
                &format!("{name}/{}", input.relative_path),
                None,
                None,
                None,
                None,
                "failed",
                Some(error_code(error)),
                Some(error),
                now_ms(),
                Some(now_ms()),
            );
        }
        result
    }

    pub fn list_operations(&self, input: &OperationListInput) -> Result<Vec<OperationLog>, String> {
        repository::list_operations(&self.open_connection()?, input)
    }

    pub fn recover_staging(&self) -> Result<RecoveryReport, String> {
        let conn = self.open_connection()?;
        JournalStore::new(self.workspace_root.clone())?.recover(&conn)
    }

    fn validate_staged_plan(&self, plan: &InstallPlan) -> Result<(), String> {
        let staging = PathBuf::from(&plan.staging_path);
        let allowed = self.workspace_root.join("staging/import");
        crate::lifecycle::file_transaction::assert_owned_path(&allowed, &staging)?;
        let source_root = staging.join("source");
        let mut observed = Vec::with_capacity(plan.candidates.len());
        for candidate in &plan.candidates {
            let path = source_root.join(
                candidate
                    .relative_path
                    .replace('/', std::path::MAIN_SEPARATOR_STR),
            );
            let hash = hash_skill_directory(&path)?;
            if hash != candidate.content_hash {
                return Err("PLAN_STALE: staging 内容已变化，请重新预览".to_string());
            }
            observed.push(candidate.clone());
        }
        if plan_source_hash(&observed) != plan.source_hash {
            return Err("PLAN_STALE: 导入源摘要已变化，请重新预览".to_string());
        }
        Ok(())
    }

    fn execute_candidate(
        &self,
        conn: &Connection,
        plan: &InstallPlan,
        selection: &ImportSelection,
    ) -> Result<ImportedSkillResult, String> {
        let candidate = plan
            .candidates
            .iter()
            .find(|candidate| candidate.id == selection.candidate_id)
            .ok_or_else(|| "CANDIDATE_NOT_FOUND".to_string())?;
        let source = PathBuf::from(&plan.staging_path).join("source").join(
            candidate
                .relative_path
                .replace('/', std::path::MAIN_SEPARATOR_STR),
        );
        match selection.action {
            ImportConflictAction::Install | ImportConflictAction::Rename => {
                let name = selection
                    .target_name
                    .as_deref()
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .unwrap_or(&candidate.name);
                self.install_new(conn, plan, candidate, &source, name, &selection.action)
            }
            ImportConflictAction::Update => {
                let skill_id = selection
                    .existing_skill_id
                    .as_deref()
                    .ok_or_else(|| "UPDATE_REQUIRES_EXISTING_SKILL_ID".to_string())?;
                self.update_existing(conn, plan, candidate, &source, skill_id)
            }
            ImportConflictAction::Cancel => Err("CANDIDATE_CANCELLED".to_string()),
        }
    }

    fn install_new(
        &self,
        conn: &Connection,
        plan: &InstallPlan,
        candidate: &InstallCandidate,
        source: &Path,
        name: &str,
        action: &ImportConflictAction,
    ) -> Result<ImportedSkillResult, String> {
        let slug = slugify(name);
        ensure_name_available(conn, name, &slug, None)?;
        let skill_id = Uuid::new_v4().to_string();
        let storage_rel_path = format!("{skill_id}/{slug}");
        let target = self.workspace_root.join("skills").join(&storage_rel_path);
        let prepared = PathBuf::from(&plan.staging_path)
            .join("prepared")
            .join(&skill_id);
        copy_skill_tree(source, &prepared)?;
        let operation_id = Uuid::new_v4().to_string();
        acquire_locks(
            conn,
            &operation_id,
            &[
                format!("skill:{skill_id}"),
                format!("path:{}", normalized_lock_path(&target)),
            ],
        )?;
        let result = (|| -> Result<ImportedSkillResult, String> {
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent).map_err(|error| format!("创建中央目录失败: {error}"))?;
            }
            fs::rename(&prepared, &target)
                .map_err(|error| format!("原子导入中央库失败: {error}"))?;
            if let Err(error) = self.fail_if(LifecycleFaultPoint::AfterCentralReplace) {
                let _ = safe_remove_dir_all(&self.workspace_root.join("skills"), &target);
                return Err(error);
            }
            let now = now_ms();
            conn.execute_batch("BEGIN IMMEDIATE")
                .map_err(|error| format!("开启导入事务失败: {error}"))?;
            let db_result = (|| -> Result<ImportedSkillResult, String> {
                conn.execute(
                    "INSERT INTO skills (
                        id, name, slug, storage_rel_path, canonical_name, active_content_hash,
                        lifecycle_state, description, source_type, source_path,
                        created_at, updated_at, is_archived
                     ) VALUES (?1, ?2, ?3, ?4, lower(trim(?2)), ?5, 'active', NULL, ?6, ?7, ?8, ?8, 0)",
                    rusqlite::params![
                        skill_id,
                        name,
                        slug,
                        storage_rel_path,
                        candidate.content_hash,
                        source_type_label(&plan.provenance.source_type),
                        plan.provenance.source_path,
                        now,
                    ],
                )
                .map_err(|error| format!("创建中央 Skill 失败: {error}"))?;
                insert_source(conn, &skill_id, &plan.provenance, now)?;
                self.fail_if(LifecycleFaultPoint::BeforeDatabaseCommit)?;
                let snapshot_id = create_snapshot_record(
                    conn,
                    &self.workspace_root,
                    &skill_id,
                    &target,
                    "import",
                    Some("初始导入"),
                )?;
                let result = ImportedSkillResult {
                    candidate_id: candidate.id.clone(),
                    skill_id: skill_id.clone(),
                    name: name.to_string(),
                    slug: slug.clone(),
                    snapshot_id: snapshot_id.clone(),
                    content_hash: candidate.content_hash.clone(),
                    action: match action {
                        ImportConflictAction::Rename => "rename",
                        _ => "install",
                    }
                    .to_string(),
                };
                repository::insert_operation(
                    conn,
                    "install",
                    "skill",
                    Some(&skill_id),
                    name,
                    serde_json::to_string(plan).ok().as_deref(),
                    None,
                    Some(&candidate.content_hash),
                    Some(&snapshot_id),
                    "success",
                    None,
                    None,
                    now,
                    Some(now),
                )?;
                Ok(result)
            })();
            match db_result {
                Ok(value) => {
                    if let Err(error) = conn.execute_batch("COMMIT") {
                        let _ = conn.execute_batch("ROLLBACK");
                        let _ = safe_remove_dir_all(&self.workspace_root.join("skills"), &target);
                        let snapshot_root = self.workspace_root.join("snapshots").join(&skill_id);
                        let _ = safe_remove_dir_all(
                            &self.workspace_root.join("snapshots"),
                            &snapshot_root,
                        );
                        return Err(format!("提交导入事务失败: {error}"));
                    }
                    Ok(value)
                }
                Err(error) => {
                    let _ = conn.execute_batch("ROLLBACK");
                    let _ = safe_remove_dir_all(&self.workspace_root.join("skills"), &target);
                    Err(error)
                }
            }
        })();
        release_locks(conn, &operation_id);
        result
    }

    fn update_existing(
        &self,
        conn: &Connection,
        plan: &InstallPlan,
        candidate: &InstallCandidate,
        source: &Path,
        skill_id: &str,
    ) -> Result<ImportedSkillResult, String> {
        let (name, slug, storage_rel_path, lifecycle): (String, String, String, String) = conn
            .query_row(
                "SELECT name, slug, COALESCE(storage_rel_path, slug), lifecycle_state
                 FROM skills WHERE id = ?1",
                [skill_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .map_err(|_| format!("UPDATE_TARGET_NOT_FOUND: {skill_id}"))?;
        if lifecycle != "active" {
            return Err("UPDATE_TARGET_NOT_ACTIVE".to_string());
        }
        let target = self.workspace_root.join("skills").join(storage_rel_path);
        let prepared = PathBuf::from(&plan.staging_path)
            .join("prepared")
            .join(format!("update-{skill_id}"));
        let backup = PathBuf::from(&plan.staging_path)
            .join("backups")
            .join(skill_id);
        if let Some(parent) = prepared.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("创建更新 staging 失败: {error}"))?;
        }
        copy_skill_tree(source, &prepared)?;
        let operation_id = Uuid::new_v4().to_string();
        acquire_locks(
            conn,
            &operation_id,
            &[
                format!("skill:{skill_id}"),
                format!("path:{}", normalized_lock_path(&target)),
            ],
        )?;
        let result = (|| -> Result<ImportedSkillResult, String> {
            let before_hash = hash_skill_directory(&target)?;
            let recovery_snapshot = create_snapshot_record(
                conn,
                &self.workspace_root,
                skill_id,
                &target,
                "system",
                Some("导入更新前恢复点"),
            )?;
            if let Some(parent) = backup.parent() {
                fs::create_dir_all(parent)
                    .map_err(|error| format!("创建更新备份目录失败: {error}"))?;
            }
            fs::rename(&target, &backup)
                .map_err(|error| format!("备份中央 Skill 失败: {error}"))?;
            if let Err(error) = fs::rename(&prepared, &target) {
                let _ = fs::rename(&backup, &target);
                return Err(format!("替换中央 Skill 失败: {error}"));
            }
            conn.execute_batch("BEGIN IMMEDIATE")
                .map_err(|error| format!("开启更新事务失败: {error}"))?;
            let now = now_ms();
            let db_result = (|| -> Result<String, String> {
                conn.execute(
                    "UPDATE skills SET active_content_hash = ?2, source_type = ?3,
                        source_path = ?4, updated_at = ?5 WHERE id = ?1",
                    rusqlite::params![
                        skill_id,
                        candidate.content_hash,
                        source_type_label(&plan.provenance.source_type),
                        plan.provenance.source_path,
                        now,
                    ],
                )
                .map_err(|error| format!("更新中央 Skill 失败: {error}"))?;
                insert_source(conn, skill_id, &plan.provenance, now)?;
                conn.execute(
                    "UPDATE platform_release_targets SET drift_status = 'outdated',
                        observed_target_hash = NULL, updated_at = ?2 WHERE skill_id = ?1",
                    rusqlite::params![skill_id, now],
                )
                .map_err(|error| format!("标记映射过期失败: {error}"))?;
                conn.execute(
                    "UPDATE ai_artifacts SET stale_at = ?2
                     WHERE skill_id = ?1 AND stale_at IS NULL",
                    rusqlite::params![skill_id, now],
                )
                .map_err(|error| format!("标记 AI 产物过期失败: {error}"))?;
                create_snapshot_record(
                    conn,
                    &self.workspace_root,
                    skill_id,
                    &target,
                    "import",
                    Some("导入更新"),
                )
            })();
            let snapshot_id = match db_result {
                Ok(snapshot_id) => {
                    let snapshot_path: Option<String> = conn
                        .query_row(
                            "SELECT snapshot_path FROM skill_snapshots WHERE id = ?1",
                            [&snapshot_id],
                            |row| row.get(0),
                        )
                        .optional()
                        .map_err(|error| format!("读取更新快照路径失败: {error}"))?;
                    if let Err(error) = conn.execute_batch("COMMIT") {
                        let _ = conn.execute_batch("ROLLBACK");
                        let _ = safe_remove_dir_all(&self.workspace_root.join("skills"), &target);
                        let _ = fs::rename(&backup, &target);
                        if let Some(snapshot_path) = snapshot_path {
                            let _ = safe_remove_dir_all(
                                &self.workspace_root.join("snapshots"),
                                Path::new(&snapshot_path),
                            );
                        }
                        return Err(format!("提交更新事务失败: {error}"));
                    }
                    snapshot_id
                }
                Err(error) => {
                    let _ = conn.execute_batch("ROLLBACK");
                    let _ = safe_remove_dir_all(&self.workspace_root.join("skills"), &target);
                    let _ = fs::rename(&backup, &target);
                    return Err(error);
                }
            };
            safe_remove_dir_all(&PathBuf::from(&plan.staging_path), &backup)?;
            repository::insert_operation(
                conn,
                "import_update",
                "skill",
                Some(skill_id),
                &name,
                serde_json::to_string(plan).ok().as_deref(),
                Some(&before_hash),
                Some(&candidate.content_hash),
                Some(&recovery_snapshot),
                "success",
                None,
                None,
                now,
                Some(now),
            )?;
            Ok(ImportedSkillResult {
                candidate_id: candidate.id.clone(),
                skill_id: skill_id.to_string(),
                name,
                slug,
                snapshot_id,
                content_hash: candidate.content_hash.clone(),
                action: "update".to_string(),
            })
        })();
        release_locks(conn, &operation_id);
        result
    }

    fn fail_if(&self, point: LifecycleFaultPoint) -> Result<(), String> {
        if self.fault == Some(point) {
            Err(format!("FAULT_INJECTED: {point:?}"))
        } else {
            Ok(())
        }
    }
}

fn load_conflicts(
    conn: &Connection,
    name: &str,
    slug: &str,
    content_hash: &str,
) -> Result<Vec<InstallConflict>, String> {
    let mut statement = conn
        .prepare(
            "SELECT id, name, slug, active_content_hash FROM skills
             WHERE lower(name) = lower(?1) OR slug = ?2 OR active_content_hash = ?3",
        )
        .map_err(|error| format!("准备安装冲突查询失败: {error}"))?;
    let conflicts = statement
        .query_map(rusqlite::params![name, slug, content_hash], |row| {
            let existing_hash: Option<String> = row.get(3)?;
            Ok(InstallConflict {
                conflict_type: if existing_hash.as_deref() == Some(content_hash) {
                    "same_content".to_string()
                } else {
                    "name_or_slug".to_string()
                },
                existing_skill_id: row.get(0)?,
                existing_name: row.get(1)?,
                existing_slug: row.get(2)?,
                existing_content_hash: existing_hash,
            })
        })
        .map_err(|error| format!("查询安装冲突失败: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("读取安装冲突失败: {error}"))?;
    Ok(conflicts)
}

fn resolve_selections(
    plan: &InstallPlan,
    requested: &[ImportSelection],
) -> Result<Vec<ImportSelection>, String> {
    let map = requested
        .iter()
        .map(|selection| (selection.candidate_id.as_str(), selection))
        .collect::<HashMap<_, _>>();
    let mut resolved = Vec::with_capacity(plan.candidates.len());
    for candidate in &plan.candidates {
        if let Some(selection) = map.get(candidate.id.as_str()) {
            resolved.push((*selection).clone());
        } else if candidate.conflicts.is_empty() {
            resolved.push(ImportSelection {
                candidate_id: candidate.id.clone(),
                action: ImportConflictAction::Install,
                target_name: None,
                existing_skill_id: None,
            });
        } else {
            return Err(format!(
                "CONFLICT_DECISION_REQUIRED: 候选 {} 存在冲突",
                candidate.name
            ));
        }
    }
    Ok(resolved)
}

pub(crate) fn ensure_name_available(
    conn: &Connection,
    name: &str,
    slug: &str,
    excluding: Option<&str>,
) -> Result<(), String> {
    let exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM skills
             WHERE (lower(name) = lower(?1) OR slug = ?2) AND (?3 IS NULL OR id <> ?3)",
            rusqlite::params![name, slug, excluding],
            |row| row.get(0),
        )
        .map_err(|error| format!("检查名称冲突失败: {error}"))?;
    if exists > 0 {
        Err(format!("SKILL_NAME_CONFLICT: {name} / {slug}"))
    } else {
        Ok(())
    }
}

pub(crate) fn create_snapshot_record(
    conn: &Connection,
    workspace_root: &Path,
    skill_id: &str,
    source_dir: &Path,
    source: &str,
    summary: Option<&str>,
) -> Result<String, String> {
    let next: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(snapshot_number), 0) + 1 FROM skill_snapshots WHERE skill_id = ?1",
            [skill_id],
            |row| row.get(0),
        )
        .map_err(|error| format!("计算快照版本失败: {error}"))?;
    let snapshot_id = Uuid::new_v4().to_string();
    let target = workspace_root
        .join("snapshots")
        .join(skill_id)
        .join(format!("v{next}"));
    copy_skill_tree(source_dir, &target)?;
    let revision = compute_directory_revision(source_dir)?;
    let now = now_ms();
    let insert = conn.execute(
        "INSERT INTO skill_snapshots (
            id, skill_id, snapshot_number, snapshot_path, revision_hash,
            change_summary, source, created_at, is_current, is_active
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1, 0)",
        rusqlite::params![
            snapshot_id,
            skill_id,
            next,
            target.to_string_lossy(),
            revision,
            summary,
            source,
            now,
        ],
    );
    if let Err(error) = insert {
        let _ = safe_remove_dir_all(&workspace_root.join("snapshots"), &target);
        return Err(format!("记录快照失败: {error}"));
    }
    conn.execute(
        "UPDATE skill_snapshots SET is_current = CASE WHEN id = ?2 THEN 1 ELSE 0 END
         WHERE skill_id = ?1",
        rusqlite::params![skill_id, snapshot_id],
    )
    .map_err(|error| format!("更新当前快照失败: {error}"))?;
    Ok(snapshot_id)
}

fn insert_source(
    conn: &Connection,
    skill_id: &str,
    provenance: &ImportProvenance,
    now: i64,
) -> Result<(), String> {
    conn.execute(
        "UPDATE skill_sources SET is_primary = 0, updated_at = ?2
         WHERE skill_id = ?1 AND is_primary = 1",
        rusqlite::params![skill_id, now],
    )
    .map_err(|error| format!("更新主来源失败: {error}"))?;
    let metadata = serde_json::json!({
        "commit": provenance.commit,
        "branch": provenance.branch,
        "ref": provenance.git_ref,
        "subdir": provenance.repo_subdir,
        "marketSource": provenance.market_source,
    });
    conn.execute(
        "INSERT INTO skill_sources (
            id, skill_id, source_type, source_label, source_ref, source_path,
            metadata_json, is_primary, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, ?8, ?8)",
        rusqlite::params![
            Uuid::new_v4().to_string(),
            skill_id,
            source_type_label(&provenance.source_type),
            provenance.source_label,
            provenance.source_ref,
            provenance.source_path,
            metadata.to_string(),
            now,
        ],
    )
    .map_err(|error| format!("记录 Skill 来源失败: {error}"))?;
    Ok(())
}

fn record_import_log(
    conn: &Connection,
    plan: &InstallPlan,
    status: &str,
    target_skill_id: Option<&str>,
    error: Option<&str>,
) -> Result<(), String> {
    let now = now_ms();
    conn.execute(
        "INSERT INTO skill_import_logs (
            id, source_type, source_label, source_ref, source_path, request_payload_json,
            status, target_skill_id, detail_message, error_message, created_at, updated_at,
            source_commit, source_ref_name, source_subdir, plan_id
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11, ?12, ?13, ?14, ?15)",
        rusqlite::params![
            Uuid::new_v4().to_string(),
            source_type_label(&plan.provenance.source_type),
            plan.provenance.source_label,
            plan.provenance.source_ref,
            plan.provenance.source_path,
            serde_json::to_string(plan).ok(),
            status,
            target_skill_id,
            (status == "success").then_some("已导入中央库；平台发布保持待选择"),
            error.map(repository::redact_error),
            now,
            plan.provenance.commit,
            plan.provenance
                .git_ref
                .as_ref()
                .or(plan.provenance.branch.as_ref()),
            plan.provenance.repo_subdir,
            plan.id,
        ],
    )
    .map_err(|error| format!("写入导入记录失败: {error}"))?;
    Ok(())
}

fn source_type_label(source_type: &ImportSourceType) -> &'static str {
    match source_type {
        ImportSourceType::LocalDirectory => "local_import",
        ImportSourceType::GitRepository => "git_repository",
        ImportSourceType::ZipArchive => "zip_archive",
        ImportSourceType::Marketplace => "marketplace",
    }
}

fn plan_source_hash(candidates: &[InstallCandidate]) -> String {
    let mut values = candidates
        .iter()
        .map(|candidate| {
            (
                candidate.relative_path.as_str(),
                candidate.content_hash.as_str(),
            )
        })
        .collect::<Vec<_>>();
    values.sort();
    let mut hasher = Sha256::new();
    for (path, hash) in values {
        hasher.update(path.as_bytes());
        hasher.update([0]);
        hasher.update(hash.as_bytes());
    }
    format!("{:x}", hasher.finalize())
}

fn error_code(error: &str) -> &str {
    error.split(':').next().unwrap_or("LIFECYCLE_ERROR")
}

fn safe_import_request_json(input: &ImportPlanInput) -> Option<String> {
    let mut safe = input.clone();
    safe.git_url = safe.git_url.as_deref().map(source::sanitize_git_url);
    serde_json::to_string(&safe).ok()
}
