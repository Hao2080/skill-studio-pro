use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::{Connection, OptionalExtension};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::lifecycle::file_transaction::{
    assert_owned_path, atomic_write, safe_remove_dir_all, tree_stats,
};
use crate::lifecycle::journal::JournalStore;
use crate::lifecycle::model::*;
use crate::lifecycle::repository;
use crate::services::library_service::{
    acquire_locks, calculate_plan_hash, hash_skill_directory, load_plan, normalized_lock_path,
    persist_plan, release_locks, validate_execute_plan, ExecutePlanInput, PLAN_TTL_MS,
};
use crate::services::lifecycle_service::{create_snapshot_record, ensure_name_available};
use crate::services::mapping_service::{MappingService, RemoveMappingInput};
use crate::store::{now_ms, slugify};

const PURGE_TOKEN_TTL_MS: i64 = 2 * 60 * 1000;

pub struct TrashService {
    workspace_root: PathBuf,
    home: PathBuf,
    fault: Option<LifecycleFaultPoint>,
}

impl TrashService {
    pub fn new(workspace_root: PathBuf, home: PathBuf) -> Result<Self, String> {
        if !workspace_root.is_absolute() || !home.is_absolute() {
            return Err("回收站工作区和 Home 必须是绝对路径".to_string());
        }
        for relative in ["trash/skills", "trash/manifests", "staging/journals"] {
            fs::create_dir_all(workspace_root.join(relative))
                .map_err(|error| format!("创建回收站目录失败: {error}"))?;
        }
        Ok(Self {
            workspace_root,
            home,
            fault: None,
        })
    }

    pub fn with_fault(
        workspace_root: PathBuf,
        home: PathBuf,
        fault: LifecycleFaultPoint,
    ) -> Result<Self, String> {
        let mut service = Self::new(workspace_root, home)?;
        service.fault = Some(fault);
        Ok(service)
    }

    fn open_connection(&self) -> Result<Connection, String> {
        crate::db::init_db_at_path(&self.workspace_root)
    }

    pub fn create_delete_plan(&self, skill_id: &str) -> Result<DeletePlan, String> {
        let conn = self.open_connection()?;
        let (name, storage_rel_path, lifecycle): (String, String, String) = conn
            .query_row(
                "SELECT name, COALESCE(storage_rel_path, slug), lifecycle_state
                 FROM skills WHERE id = ?1",
                [skill_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .map_err(|_| format!("中央 Skill 不存在: {skill_id}"))?;
        if lifecycle != "active" {
            return Err("SKILL_NOT_ACTIVE: 只有活动 Skill 可移入回收站".to_string());
        }
        let original = self.workspace_root.join("skills").join(storage_rel_path);
        assert_owned_path(&self.workspace_root.join("skills"), &original)?;
        let source_hash = hash_skill_directory(&original)?;
        let (file_count, total_bytes) = tree_stats(&original)?;
        let now = now_ms();
        let mut plan = DeletePlan {
            id: Uuid::new_v4().to_string(),
            skill_id: skill_id.to_string(),
            display_name: name,
            original_path: original.to_string_lossy().to_string(),
            source_hash,
            file_count,
            total_bytes,
            mappings: repository::list_mapping_impacts(&conn, skill_id)?,
            sources_json: repository::sources_json(&conn, skill_id)?,
            plan_hash: String::new(),
            created_at: now,
            expires_at: now + PLAN_TTL_MS,
        };
        plan.plan_hash = calculate_plan_hash(&plan)?;
        persist_plan(&conn, "trash", skill_id, &plan, &plan.source_hash)?;
        Ok(plan)
    }

    pub fn execute_delete(&self, input: &DeleteExecuteInput) -> Result<TrashEntry, String> {
        let conn = self.open_connection()?;
        let plan: DeletePlan = load_plan(&conn, &input.plan_id, "trash")?;
        validate_execute_plan(
            &plan.plan_hash,
            plan.expires_at,
            &ExecutePlanInput {
                plan_id: input.plan_id.clone(),
                plan_hash: input.plan_hash.clone(),
            },
        )?;
        let original = PathBuf::from(&plan.original_path);
        assert_owned_path(&self.workspace_root.join("skills"), &original)?;
        if hash_skill_directory(&original)? != plan.source_hash {
            return Err("PLAN_STALE: 中央 Skill 内容已变化，请重新预览删除影响".to_string());
        }
        let observed_mappings = repository::list_mapping_impacts(&conn, &plan.skill_id)?;
        if observed_mappings != plan.mappings {
            return Err("PLAN_STALE: Agent 映射已变化，请重新预览删除影响".to_string());
        }
        let operation_id = Uuid::new_v4().to_string();
        acquire_locks(
            &conn,
            &operation_id,
            &[
                format!("skill:{}", plan.skill_id),
                format!("path:{}", normalized_lock_path(&original)),
            ],
        )?;
        let result = (|| -> Result<TrashEntry, String> {
            let mapping_service =
                MappingService::new(self.workspace_root.clone(), self.home.clone())?;
            for mapping in &plan.mappings {
                mapping_service.remove_mapping_under_skill_lock(
                    &RemoveMappingInput {
                        skill_id: plan.skill_id.clone(),
                        platform_name: mapping.platform_name.clone(),
                    },
                    &operation_id,
                )?;
            }
            let _recovery = create_snapshot_record(
                &conn,
                &self.workspace_root,
                &plan.skill_id,
                &original,
                "system",
                Some("移入回收站前恢复点"),
            )?;
            let trash_id = Uuid::new_v4().to_string();
            let trash_container = self.workspace_root.join("trash/skills").join(&trash_id);
            let trash_path = trash_container.join("content");
            let manifest_path = self
                .workspace_root
                .join("trash/manifests")
                .join(format!("{trash_id}.json"));
            fs::create_dir_all(&trash_container)
                .map_err(|error| format!("创建回收站容器失败: {error}"))?;
            let mappings_json = serde_json::to_value(&plan.mappings)
                .map_err(|error| format!("序列化映射状态失败: {error}"))?;
            let related = serde_json::json!({
                "skillId": plan.skill_id,
                "sources": serde_json::from_str::<serde_json::Value>(&plan.sources_json)
                    .unwrap_or(serde_json::Value::Null),
                "mappings": mappings_json,
                "activeSnapshotId": active_snapshot_id(&conn, &plan.skill_id)?,
                "operationId": operation_id,
            });
            let manifest = serde_json::json!({
                "version": 1,
                "trashEntryId": trash_id,
                "skillId": plan.skill_id,
                "name": plan.display_name,
                "originalPath": plan.original_path,
                "deletedAt": now_ms(),
                "contentHash": plan.source_hash,
                "relatedState": related,
            });
            atomic_write(
                &manifest_path,
                &serde_json::to_vec_pretty(&manifest)
                    .map_err(|error| format!("序列化回收站 manifest 失败: {error}"))?,
            )?;
            let journal = JournalStore::new(self.workspace_root.clone())?;
            journal.write(
                &conn,
                &StagingJournal {
                    id: operation_id.clone(),
                    operation_type: "trash".to_string(),
                    phase: "before_move".to_string(),
                    source_path: Some(original.to_string_lossy().to_string()),
                    target_path: Some(trash_path.to_string_lossy().to_string()),
                    backup_path: None,
                    staging_path: None,
                    entity_id: Some(plan.skill_id.clone()),
                    expected_hash: Some(plan.source_hash.clone()),
                    updated_at: now_ms(),
                },
            )?;
            fs::rename(&original, &trash_path)
                .map_err(|error| format!("移动 Skill 到回收站失败: {error}"))?;
            self.fail_if(LifecycleFaultPoint::AfterTrashMove)?;
            let now = now_ms();
            let entry = TrashEntry {
                id: trash_id,
                entity_type: "skill".to_string(),
                entity_id: plan.skill_id.clone(),
                display_name: plan.display_name.clone(),
                original_path: plan.original_path.clone(),
                trash_path: trash_path.to_string_lossy().to_string(),
                manifest_path: manifest_path.to_string_lossy().to_string(),
                related_state_json: related.to_string(),
                content_hash: plan.source_hash.clone(),
                status: "trashed".to_string(),
                deleted_at: now,
                restored_at: None,
                permanently_deleted_at: None,
            };
            conn.execute_batch("BEGIN IMMEDIATE")
                .map_err(|error| format!("开启回收事务失败: {error}"))?;
            let db_result = (|| -> Result<(), String> {
                repository::insert_trash_entry(&conn, &entry)?;
                conn.execute(
                    "UPDATE skills SET lifecycle_state = 'trashed', trashed_at = ?2,
                        updated_at = ?2 WHERE id = ?1",
                    rusqlite::params![plan.skill_id, now],
                )
                .map_err(|error| format!("更新 Skill 回收状态失败: {error}"))?;
                conn.execute(
                    "UPDATE library_operation_plans SET status = 'executed', executed_at = ?2
                     WHERE id = ?1",
                    rusqlite::params![plan.id, now],
                )
                .map_err(|error| format!("更新删除计划失败: {error}"))?;
                repository::insert_operation(
                    &conn,
                    "trash_move",
                    "skill",
                    Some(&plan.skill_id),
                    &plan.display_name,
                    serde_json::to_string(&plan).ok().as_deref(),
                    Some(&plan.source_hash),
                    Some(&plan.source_hash),
                    None,
                    "success",
                    None,
                    None,
                    plan.created_at,
                    Some(now),
                )?;
                Ok(())
            })();
            match db_result {
                Ok(()) => {
                    if let Err(error) = conn.execute_batch("COMMIT") {
                        let _ = conn.execute_batch("ROLLBACK");
                        let _ = fs::rename(&trash_path, &original);
                        let _ = fs::remove_file(&manifest_path);
                        let _ = safe_remove_dir_all(
                            &self.workspace_root.join("trash/skills"),
                            &trash_container,
                        );
                        return Err(format!("提交回收事务失败: {error}"));
                    }
                }
                Err(error) => {
                    let _ = conn.execute_batch("ROLLBACK");
                    let _ = fs::rename(&trash_path, &original);
                    let _ = fs::remove_file(&manifest_path);
                    let _ = safe_remove_dir_all(
                        &self.workspace_root.join("trash/skills"),
                        &trash_container,
                    );
                    return Err(error);
                }
            }
            journal.complete(&conn, &operation_id)?;
            Ok(entry)
        })();
        release_locks(&conn, &operation_id);
        if let Err(error) = &result {
            let _ = repository::insert_operation(
                &conn,
                "trash_move",
                "skill",
                Some(&plan.skill_id),
                &plan.display_name,
                serde_json::to_string(&plan).ok().as_deref(),
                Some(&plan.source_hash),
                None,
                None,
                "failed",
                Some(error_code(error)),
                Some(error),
                plan.created_at,
                Some(now_ms()),
            );
        }
        result
    }

    pub fn list(&self) -> Result<Vec<TrashEntry>, String> {
        repository::list_trash_entries(&self.open_connection()?)
    }

    pub fn create_restore_plan(&self, input: &RestorePlanInput) -> Result<RestorePlan, String> {
        let conn = self.open_connection()?;
        let entry = repository::get_trash_entry(&conn, &input.trash_entry_id)?;
        if entry.status != "trashed" {
            return Err("TRASH_ENTRY_NOT_RESTORABLE".to_string());
        }
        let source = PathBuf::from(&entry.trash_path);
        assert_owned_path(&self.workspace_root.join("trash/skills"), &source)?;
        let hash = hash_skill_directory(&source)?;
        if hash != entry.content_hash {
            return Err("TRASH_CONTENT_TAMPERED: 回收站内容哈希不匹配".to_string());
        }
        let (current_name, current_slug): (String, String) = conn
            .query_row(
                "SELECT name, slug FROM skills WHERE id = ?1",
                [&entry.entity_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|_| "回收站关联 Skill 记录不存在".to_string())?;
        let (target_name, target_slug, target) = match input.mode {
            RestoreMode::Original => (
                current_name,
                current_slug,
                PathBuf::from(&entry.original_path),
            ),
            RestoreMode::NewName => {
                let name = input
                    .new_name
                    .as_deref()
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .ok_or_else(|| "RESTORE_NEW_NAME_REQUIRED".to_string())?;
                let slug = slugify(name);
                ensure_name_available(&conn, name, &slug, Some(&entry.entity_id))?;
                (
                    name.to_string(),
                    slug.clone(),
                    self.workspace_root
                        .join("skills")
                        .join(&entry.entity_id)
                        .join(slug),
                )
            }
        };
        ensure_restore_target(&self.workspace_root.join("skills"), &target)?;
        let conflict = target.exists().then(|| "target_exists".to_string());
        let now = now_ms();
        let mut plan = RestorePlan {
            id: Uuid::new_v4().to_string(),
            trash_entry_id: entry.id,
            skill_id: entry.entity_id,
            display_name: entry.display_name,
            target_name,
            target_slug,
            target_path: target.to_string_lossy().to_string(),
            source_hash: hash,
            conflict,
            mappings_will_be_republished: false,
            plan_hash: String::new(),
            created_at: now,
            expires_at: now + PLAN_TTL_MS,
        };
        plan.plan_hash = calculate_plan_hash(&plan)?;
        persist_plan(&conn, "restore", &plan.skill_id, &plan, &plan.source_hash)?;
        Ok(plan)
    }

    pub fn execute_restore(&self, input: &RestoreExecuteInput) -> Result<TrashEntry, String> {
        let conn = self.open_connection()?;
        let plan: RestorePlan = load_plan(&conn, &input.plan_id, "restore")?;
        validate_execute_plan(
            &plan.plan_hash,
            plan.expires_at,
            &ExecutePlanInput {
                plan_id: input.plan_id.clone(),
                plan_hash: input.plan_hash.clone(),
            },
        )?;
        if plan.conflict.is_some() {
            return Err("RESTORE_CONFLICT: 目标位置已存在，请选择新名称重新预览".to_string());
        }
        let mut entry = repository::get_trash_entry(&conn, &plan.trash_entry_id)?;
        let source = PathBuf::from(&entry.trash_path);
        let target = PathBuf::from(&plan.target_path);
        assert_owned_path(&self.workspace_root.join("trash/skills"), &source)?;
        ensure_restore_target(&self.workspace_root.join("skills"), &target)?;
        if target.exists() || hash_skill_directory(&source)? != plan.source_hash {
            return Err("PLAN_STALE: 恢复来源或目标已变化".to_string());
        }
        let operation_id = Uuid::new_v4().to_string();
        acquire_locks(
            &conn,
            &operation_id,
            &[
                format!("skill:{}", plan.skill_id),
                format!("path:{}", normalized_lock_path(&target)),
            ],
        )?;
        let result = (|| -> Result<TrashEntry, String> {
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent)
                    .map_err(|error| format!("创建恢复目标目录失败: {error}"))?;
            }
            let journal = JournalStore::new(self.workspace_root.clone())?;
            journal.write(
                &conn,
                &StagingJournal {
                    id: operation_id.clone(),
                    operation_type: "restore".to_string(),
                    phase: "before_move".to_string(),
                    source_path: Some(source.to_string_lossy().to_string()),
                    target_path: Some(target.to_string_lossy().to_string()),
                    backup_path: None,
                    staging_path: None,
                    entity_id: Some(plan.skill_id.clone()),
                    expected_hash: Some(plan.source_hash.clone()),
                    updated_at: now_ms(),
                },
            )?;
            fs::rename(&source, &target).map_err(|error| format!("恢复 Skill 失败: {error}"))?;
            self.fail_if(LifecycleFaultPoint::AfterRestoreMove)?;
            let storage_rel_path = target
                .strip_prefix(self.workspace_root.join("skills"))
                .map_err(|_| "RESTORE_TARGET_ESCAPE".to_string())?
                .to_string_lossy()
                .replace('\\', "/");
            let now = now_ms();
            conn.execute_batch("BEGIN IMMEDIATE")
                .map_err(|error| format!("开启恢复事务失败: {error}"))?;
            let db_result = (|| -> Result<(), String> {
                conn.execute(
                    "UPDATE skills SET name = ?2, slug = ?3, storage_rel_path = ?4,
                        canonical_name = lower(trim(?2)), lifecycle_state = 'active',
                        trashed_at = NULL, active_content_hash = ?5, updated_at = ?6
                     WHERE id = ?1",
                    rusqlite::params![
                        plan.skill_id,
                        plan.target_name,
                        plan.target_slug,
                        storage_rel_path,
                        plan.source_hash,
                        now,
                    ],
                )
                .map_err(|error| format!("更新恢复 Skill 失败: {error}"))?;
                conn.execute(
                    "UPDATE trash_entries SET status = 'restored', restored_at = ?2,
                        confirmation_token_hash = NULL, confirmation_expires_at = NULL
                     WHERE id = ?1",
                    rusqlite::params![plan.trash_entry_id, now],
                )
                .map_err(|error| format!("更新回收站状态失败: {error}"))?;
                conn.execute(
                    "UPDATE library_operation_plans SET status = 'executed', executed_at = ?2
                     WHERE id = ?1",
                    rusqlite::params![plan.id, now],
                )
                .map_err(|error| format!("更新恢复计划失败: {error}"))?;
                repository::insert_operation(
                    &conn,
                    "trash_restore",
                    "skill",
                    Some(&plan.skill_id),
                    &plan.target_name,
                    serde_json::to_string(&plan).ok().as_deref(),
                    Some(&plan.source_hash),
                    Some(&plan.source_hash),
                    None,
                    "success",
                    None,
                    None,
                    plan.created_at,
                    Some(now),
                )?;
                Ok(())
            })();
            match db_result {
                Ok(()) => {
                    if let Err(error) = conn.execute_batch("COMMIT") {
                        let _ = conn.execute_batch("ROLLBACK");
                        let _ = fs::rename(&target, &source);
                        return Err(format!("提交恢复事务失败: {error}"));
                    }
                }
                Err(error) => {
                    let _ = conn.execute_batch("ROLLBACK");
                    let _ = fs::rename(&target, &source);
                    return Err(error);
                }
            }
            journal.complete(&conn, &operation_id)?;
            entry.status = "restored".to_string();
            entry.restored_at = Some(now);
            Ok(entry)
        })();
        release_locks(&conn, &operation_id);
        if let Err(error) = &result {
            let _ = repository::insert_operation(
                &conn,
                "trash_restore",
                "skill",
                Some(&plan.skill_id),
                &plan.target_name,
                serde_json::to_string(&plan).ok().as_deref(),
                Some(&plan.source_hash),
                None,
                None,
                "failed",
                Some(error_code(error)),
                Some(error),
                plan.created_at,
                Some(now_ms()),
            );
        }
        result
    }

    pub fn create_purge_confirmation(
        &self,
        trash_entry_id: &str,
    ) -> Result<PurgeConfirmation, String> {
        let conn = self.open_connection()?;
        let entry = repository::get_trash_entry(&conn, trash_entry_id)?;
        if entry.status != "trashed" {
            return Err("PURGE_ONLY_FROM_TRASH".to_string());
        }
        let token = format!("PURGE-{}-{}", entry.id, Uuid::new_v4());
        let hash = format!("{:x}", Sha256::digest(token.as_bytes()));
        let expires_at = now_ms() + PURGE_TOKEN_TTL_MS;
        conn.execute(
            "UPDATE trash_entries SET confirmation_token_hash = ?2,
                confirmation_expires_at = ?3 WHERE id = ?1",
            rusqlite::params![entry.id, hash, expires_at],
        )
        .map_err(|error| format!("保存永久删除确认令牌失败: {error}"))?;
        Ok(PurgeConfirmation {
            trash_entry_id: entry.id,
            confirmation_token: token,
            expires_at,
        })
    }

    pub fn execute_purge(&self, input: &PurgeExecuteInput) -> Result<(), String> {
        let conn = self.open_connection()?;
        let entry = repository::get_trash_entry(&conn, &input.trash_entry_id)?;
        if entry.status != "trashed" {
            return Err("PURGE_ONLY_FROM_TRASH".to_string());
        }
        let (expected_hash, expires_at): (Option<String>, Option<i64>) = conn
            .query_row(
                "SELECT confirmation_token_hash, confirmation_expires_at
                 FROM trash_entries WHERE id = ?1",
                [&entry.id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|error| format!("读取永久删除确认失败: {error}"))?;
        let actual_hash = format!("{:x}", Sha256::digest(input.confirmation_token.as_bytes()));
        if expected_hash.as_deref() != Some(actual_hash.as_str())
            || expires_at.is_none_or(|value| value < now_ms())
        {
            return Err("PURGE_CONFIRMATION_INVALID_OR_EXPIRED".to_string());
        }
        let trash_path = PathBuf::from(&entry.trash_path);
        assert_owned_path(&self.workspace_root.join("trash/skills"), &trash_path)?;
        if hash_skill_directory(&trash_path)? != entry.content_hash {
            return Err("TRASH_CONTENT_TAMPERED".to_string());
        }
        let operation_id = Uuid::new_v4().to_string();
        acquire_locks(
            &conn,
            &operation_id,
            &[format!("skill:{}", entry.entity_id)],
        )?;
        let result = (|| -> Result<(), String> {
            let purge_staging = self
                .workspace_root
                .join("staging")
                .join(format!("purge-{}", entry.id));
            let journal = JournalStore::new(self.workspace_root.clone())?;
            journal.write(
                &conn,
                &StagingJournal {
                    id: operation_id.clone(),
                    operation_type: "purge".to_string(),
                    phase: "before_move".to_string(),
                    source_path: Some(trash_path.to_string_lossy().to_string()),
                    target_path: Some(purge_staging.to_string_lossy().to_string()),
                    backup_path: None,
                    staging_path: None,
                    entity_id: Some(entry.id.clone()),
                    expected_hash: Some(entry.content_hash.clone()),
                    updated_at: now_ms(),
                },
            )?;
            fs::rename(&trash_path, &purge_staging)
                .map_err(|error| format!("暂存永久删除内容失败: {error}"))?;
            self.fail_if(LifecycleFaultPoint::AfterPurgeMove)?;
            let snapshot_paths = snapshot_paths(&conn, &entry.entity_id)?;
            conn.execute_batch("BEGIN IMMEDIATE")
                .map_err(|error| format!("开启永久删除事务失败: {error}"))?;
            let db_result = purge_skill_records(&conn, &entry);
            match db_result {
                Ok(()) => {
                    if let Err(error) = conn.execute_batch("COMMIT") {
                        let _ = conn.execute_batch("ROLLBACK");
                        let _ = fs::rename(&purge_staging, &trash_path);
                        let _ = journal.complete(&conn, &operation_id);
                        return Err(format!("提交永久删除事务失败: {error}"));
                    }
                }
                Err(error) => {
                    let _ = conn.execute_batch("ROLLBACK");
                    let _ = fs::rename(&purge_staging, &trash_path);
                    let _ = journal.complete(&conn, &operation_id);
                    return Err(error);
                }
            }
            safe_remove_dir_all(&self.workspace_root.join("staging"), &purge_staging)?;
            let manifest = PathBuf::from(&entry.manifest_path);
            if manifest.exists() {
                assert_owned_path(&self.workspace_root.join("trash/manifests"), &manifest)?;
                fs::remove_file(&manifest)
                    .map_err(|error| format!("删除回收站 manifest 失败: {error}"))?;
            }
            for path in snapshot_paths {
                if path.exists() {
                    assert_owned_path(&self.workspace_root.join("snapshots"), &path)?;
                    safe_remove_dir_all(&self.workspace_root.join("snapshots"), &path)?;
                }
            }
            let container = trash_path
                .parent()
                .ok_or_else(|| "回收站容器路径无效".to_string())?;
            if container.exists() {
                safe_remove_dir_all(&self.workspace_root.join("trash/skills"), container)?;
            }
            journal.complete(&conn, &operation_id)?;
            Ok(())
        })();
        release_locks(&conn, &operation_id);
        if let Err(error) = &result {
            let _ = repository::insert_operation(
                &conn,
                "trash_purge",
                "trash_entry",
                Some(&entry.id),
                &entry.display_name,
                None,
                Some(&entry.content_hash),
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

    fn fail_if(&self, point: LifecycleFaultPoint) -> Result<(), String> {
        if self.fault == Some(point) {
            Err(format!("FAULT_INJECTED: {point:?}"))
        } else {
            Ok(())
        }
    }
}

fn active_snapshot_id(conn: &Connection, skill_id: &str) -> Result<Option<String>, String> {
    conn.query_row(
        "SELECT id FROM skill_snapshots WHERE skill_id = ?1 AND is_active = 1 LIMIT 1",
        [skill_id],
        |row| row.get(0),
    )
    .optional()
    .map_err(|error| format!("读取活动快照失败: {error}"))
}

fn ensure_restore_target(skills_root: &Path, target: &Path) -> Result<(), String> {
    if !skills_root.is_absolute() || !target.is_absolute() || target == skills_root {
        return Err("RESTORE_TARGET_INVALID".to_string());
    }
    let root = skills_root
        .canonicalize()
        .map_err(|error| format!("规范化中央库根失败: {error}"))?;
    let relative = target
        .strip_prefix(skills_root)
        .map_err(|_| "RESTORE_TARGET_ESCAPE".to_string())?;
    if relative.as_os_str().is_empty()
        || relative.components().any(|component| {
            matches!(
                component,
                std::path::Component::ParentDir
                    | std::path::Component::RootDir
                    | std::path::Component::Prefix(_)
            )
        })
    {
        return Err("RESTORE_TARGET_ESCAPE".to_string());
    }
    let parent = target
        .parent()
        .ok_or_else(|| "RESTORE_TARGET_INVALID".to_string())?;
    fs::create_dir_all(parent).map_err(|error| format!("创建恢复父目录失败: {error}"))?;
    let parent = parent
        .canonicalize()
        .map_err(|error| format!("规范化恢复父目录失败: {error}"))?;
    if !parent.starts_with(root) {
        return Err("RESTORE_TARGET_ESCAPE".to_string());
    }
    Ok(())
}

fn snapshot_paths(conn: &Connection, skill_id: &str) -> Result<Vec<PathBuf>, String> {
    let mut statement = conn
        .prepare("SELECT snapshot_path FROM skill_snapshots WHERE skill_id = ?1")
        .map_err(|error| format!("准备快照路径查询失败: {error}"))?;
    let paths = statement
        .query_map([skill_id], |row| row.get::<_, String>(0).map(PathBuf::from))
        .map_err(|error| format!("查询快照路径失败: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("读取快照路径失败: {error}"))?;
    Ok(paths)
}

fn purge_skill_records(conn: &Connection, entry: &TrashEntry) -> Result<(), String> {
    let skill_id = &entry.entity_id;
    conn.execute(
        "UPDATE skill_instances SET central_skill_id = NULL WHERE central_skill_id = ?1",
        [skill_id],
    )
    .map_err(|error| format!("解除实例关联失败: {error}"))?;
    for (table, column) in [
        ("project_skill_assignments", "skill_id"),
        ("team_delivery_logs", "source_skill_id"),
        ("team_delivery_targets", "source_skill_id"),
        ("team_submissions", "source_skill_id"),
        ("platform_release_targets", "skill_id"),
        ("sync_logs", "skill_id"),
        ("edit_recovery_points", "skill_id"),
        ("skill_tag_relations", "skill_id"),
        ("collection_items", "skill_id"),
        ("skill_sources", "skill_id"),
        ("ai_artifacts", "skill_id"),
        ("source_evidence", "skill_id"),
    ] {
        conn.execute(
            &format!("DELETE FROM {table} WHERE {column} = ?1"),
            [skill_id],
        )
        .map_err(|error| format!("清理 {table} 失败: {error}"))?;
    }
    conn.execute(
        "DELETE FROM skill_snapshots WHERE skill_id = ?1",
        [skill_id],
    )
    .map_err(|error| format!("删除快照记录失败: {error}"))?;
    conn.execute("DELETE FROM skills WHERE id = ?1", [skill_id])
        .map_err(|error| format!("删除 Skill 记录失败: {error}"))?;
    repository::insert_operation(
        conn,
        "trash_purge",
        "trash_entry",
        Some(&entry.id),
        &entry.display_name,
        None,
        Some(&entry.content_hash),
        None,
        None,
        "success",
        None,
        None,
        now_ms(),
        Some(now_ms()),
    )?;
    conn.execute("DELETE FROM trash_entries WHERE id = ?1", [&entry.id])
        .map_err(|error| format!("删除回收站记录失败: {error}"))?;
    Ok(())
}

fn error_code(error: &str) -> &str {
    error.split(':').next().unwrap_or("TRASH_ERROR")
}
