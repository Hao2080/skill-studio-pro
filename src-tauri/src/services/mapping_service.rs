use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::platform::{PlatformAdapter, PlatformRegistry, SymlinkCapability};
use crate::store::now_ms;

use super::library_service::{
    acquire_locks, calculate_plan_hash, copy_skill_tree, ensure_lexically_within,
    hash_skill_directory, load_plan, normalized_lock_path, persist_plan, release_locks,
    remove_owned_if_exists, validate_execute_plan, ExecutePlanInput, LibraryService,
    MANAGED_MARKER, PLAN_TTL_MS,
};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PublishFailurePoint {
    AfterStaging,
    AfterBackup,
    AfterReplace,
    BeforeDatabaseCommit,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishTargetInput {
    pub platform_name: String,
    pub sync_mode: Option<String>,
    #[serde(default)]
    pub drift_policy: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishPlanInput {
    pub skill_id: String,
    pub snapshot_id: String,
    pub targets: Vec<PublishTargetInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PublishTargetPlan {
    pub platform_name: String,
    pub display_name: String,
    pub target_path: String,
    pub sync_mode: String,
    pub observed_hash: Option<String>,
    pub published_hash: Option<String>,
    pub drift_status: String,
    pub drift_policy: String,
    pub status: String,
    pub blocking_reason: Option<String>,
    pub symlink_capability: SymlinkCapability,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PublishPlan {
    pub id: String,
    pub skill_id: String,
    pub snapshot_id: String,
    pub source_path: String,
    pub source_hash: String,
    pub targets: Vec<PublishTargetPlan>,
    pub plan_hash: String,
    pub created_at: i64,
    pub expires_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PublishTargetResult {
    pub platform_name: String,
    pub target_path: String,
    pub status: String,
    pub content_hash: Option<String>,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PublishResult {
    pub plan_id: String,
    pub status: String,
    pub targets: Vec<PublishTargetResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MappingState {
    pub skill_id: String,
    pub platform_name: String,
    pub snapshot_id: String,
    pub target_path: String,
    pub sync_mode: String,
    pub published_content_hash: Option<String>,
    pub observed_target_hash: Option<String>,
    pub drift_status: String,
    pub last_checked_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveMappingInput {
    pub skill_id: String,
    pub platform_name: String,
}

#[derive(Debug, Clone)]
struct ConfiguredPlatform {
    name: String,
    display_name: String,
    root: PathBuf,
    enabled: bool,
    detected: bool,
    supports_symlink: bool,
    supports_copy: bool,
    default_sync_mode: String,
}

#[derive(Debug, Clone)]
struct ExistingMapping {
    snapshot_id: String,
    target_path: String,
    sync_mode: String,
    published_hash: Option<String>,
    ownership_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OwnershipMarker {
    application: String,
    skill_id: String,
    platform_name: String,
    ownership_token: String,
}

pub struct MappingService {
    library: LibraryService,
    home: PathBuf,
    failure_at: Option<PublishFailurePoint>,
}

impl MappingService {
    pub fn new(workspace_root: PathBuf, home: PathBuf) -> Result<Self, String> {
        Ok(Self {
            library: LibraryService::new(workspace_root)?,
            home,
            failure_at: None,
        })
    }

    pub fn with_failure(
        workspace_root: PathBuf,
        home: PathBuf,
        failure_at: PublishFailurePoint,
    ) -> Result<Self, String> {
        Ok(Self {
            library: LibraryService::new(workspace_root)?,
            home,
            failure_at: Some(failure_at),
        })
    }

    pub fn create_publish_plan(&self, input: &PublishPlanInput) -> Result<PublishPlan, String> {
        if input.skill_id.trim().is_empty() || input.snapshot_id.trim().is_empty() {
            return Err("skillId 和 snapshotId 不能为空".to_string());
        }
        if input.targets.is_empty() {
            return Err("至少选择一个发布目标".to_string());
        }
        let conn = self.library.open_connection()?;
        let (slug, source_path) = load_publish_source(&conn, &input.skill_id, &input.snapshot_id)?;
        let source_path = PathBuf::from(source_path);
        ensure_lexically_within(
            &self.library.workspace_root().join("snapshots"),
            &source_path,
        )?;
        let source_hash = hash_skill_directory(&source_path)?;
        let registry = self.build_registry(&conn)?;
        let mut seen = std::collections::HashSet::new();
        let mut targets = Vec::with_capacity(input.targets.len());
        for requested in &input.targets {
            if !seen.insert(requested.platform_name.clone()) {
                return Err(format!("发布目标重复: {}", requested.platform_name));
            }
            let configured = load_configured_platform(&conn, &requested.platform_name)?;
            let adapter = registry.get(&configured.name).ok_or_else(|| {
                format!(
                    "PLATFORM_ADAPTER_MISSING: {} 没有已注册 Adapter",
                    configured.name
                )
            })?;
            let existing = load_existing_mapping(&conn, &input.skill_id, &configured.name)?;
            let target_path = match existing
                .as_ref()
                .map(|mapping| mapping.target_path.trim())
                .filter(|path| !path.is_empty())
            {
                Some(path) => PathBuf::from(path),
                None => {
                    let target_name = adapter
                        .normalize_target_name(&slug)
                        .map_err(|e| e.to_string())?;
                    configured.root.join(target_name)
                }
            };
            adapter
                .validate_target(&configured.root, &target_path)
                .map_err(|e| e.to_string())?;
            let sync_mode = normalize_sync_mode(
                requested
                    .sync_mode
                    .as_deref()
                    .unwrap_or(&configured.default_sync_mode),
            )?;
            validate_sync_capability(adapter.as_ref(), &sync_mode)?;
            if (sync_mode == "copy" && !configured.supports_copy)
                || (sync_mode == "symlink" && !configured.supports_symlink)
            {
                return Err(format!("SYNC_MODE_UNSUPPORTED: 平台配置不支持 {sync_mode}"));
            }
            let observed = observe_target(
                &target_path,
                &input.skill_id,
                &configured.name,
                existing.as_ref(),
            )?;
            let (drift_status, status, blocking_reason) = plan_target_status(
                target_path.exists() || fs::symlink_metadata(&target_path).is_ok(),
                &observed,
                existing.as_ref(),
                requested.drift_policy.as_str(),
            );
            targets.push(PublishTargetPlan {
                platform_name: configured.name,
                display_name: configured.display_name,
                target_path: target_path.to_string_lossy().to_string(),
                sync_mode,
                observed_hash: observed,
                published_hash: existing.and_then(|mapping| mapping.published_hash),
                drift_status,
                drift_policy: normalize_drift_policy(&requested.drift_policy),
                status,
                blocking_reason,
                symlink_capability: adapter.symlink_capability(),
            });
        }
        let now = now_ms();
        let mut plan = PublishPlan {
            id: Uuid::new_v4().to_string(),
            skill_id: input.skill_id.clone(),
            snapshot_id: input.snapshot_id.clone(),
            source_path: source_path.to_string_lossy().to_string(),
            source_hash,
            targets,
            plan_hash: String::new(),
            created_at: now,
            expires_at: now + PLAN_TTL_MS,
        };
        plan.plan_hash = calculate_plan_hash(&plan)?;
        persist_plan(&conn, "publish", &plan.skill_id, &plan, &plan.source_hash)?;
        Ok(plan)
    }

    pub fn execute_publish_plan(&self, input: &ExecutePlanInput) -> Result<PublishResult, String> {
        let conn = self.library.open_connection()?;
        let plan: PublishPlan = load_plan(&conn, &input.plan_id, "publish")?;
        validate_execute_plan(&plan.plan_hash, plan.expires_at, input)?;
        let source = PathBuf::from(&plan.source_path);
        ensure_lexically_within(&self.library.workspace_root().join("snapshots"), &source)?;
        if hash_skill_directory(&source)? != plan.source_hash {
            return Err("PLAN_STALE: 发布快照内容已变化".to_string());
        }
        let mut results = Vec::with_capacity(plan.targets.len());
        for target_plan in &plan.targets {
            let result = self.execute_target(&plan, target_plan);
            results.push(match result {
                Ok(content_hash) => PublishTargetResult {
                    platform_name: target_plan.platform_name.clone(),
                    target_path: target_plan.target_path.clone(),
                    status: "success".to_string(),
                    content_hash: Some(content_hash),
                    error_code: None,
                    error_message: None,
                },
                Err(error) => {
                    self.record_target_failure(&plan, target_plan, &error);
                    PublishTargetResult {
                        platform_name: target_plan.platform_name.clone(),
                        target_path: target_plan.target_path.clone(),
                        status: "failed".to_string(),
                        content_hash: None,
                        error_code: Some(error_code(&error)),
                        error_message: Some(error),
                    }
                }
            });
        }
        let now = now_ms();
        conn.execute(
            "UPDATE library_operation_plans SET status = 'executed', executed_at = ?2
             WHERE id = ?1 AND status = 'planned'",
            rusqlite::params![plan.id, now],
        )
        .map_err(|e| format!("更新发布计划状态失败: {e}"))?;
        let successes = results
            .iter()
            .filter(|result| result.status == "success")
            .count();
        let status = if successes == results.len() {
            "success"
        } else if successes == 0 {
            "failed"
        } else {
            "partial_success"
        };
        Ok(PublishResult {
            plan_id: plan.id,
            status: status.to_string(),
            targets: results,
        })
    }

    pub fn detect_drift(&self, skill_id: &str) -> Result<Vec<MappingState>, String> {
        let conn = self.library.open_connection()?;
        let mut statement = conn
            .prepare(
                "SELECT platform_name, snapshot_id, target_path, sync_mode,
                        published_content_hash, ownership_token
                 FROM platform_release_targets WHERE skill_id = ?1 ORDER BY platform_name",
            )
            .map_err(|e| format!("准备映射漂移查询失败: {e}"))?;
        let rows = statement
            .query_map(rusqlite::params![skill_id], |row| {
                Ok(ExistingMapping {
                    snapshot_id: row.get(1)?,
                    target_path: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                    sync_mode: row.get(3)?,
                    published_hash: row.get(4)?,
                    ownership_token: row.get(5)?,
                })
            })
            .map_err(|e| format!("查询映射漂移失败: {e}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("读取映射漂移失败: {e}"))?;
        drop(statement);
        let mut states = Vec::with_capacity(rows.len());
        for mapping in rows {
            let platform_name: String = conn
                .query_row(
                    "SELECT platform_name FROM platform_release_targets
                     WHERE skill_id = ?1 AND target_path = ?2",
                    rusqlite::params![skill_id, mapping.target_path],
                    |row| row.get(0),
                )
                .map_err(|e| format!("读取映射平台失败: {e}"))?;
            let observed = observe_target(
                Path::new(&mapping.target_path),
                skill_id,
                &platform_name,
                Some(&mapping),
            )?;
            let drift = classify_drift(observed.as_deref(), mapping.published_hash.as_deref());
            let now = now_ms();
            conn.execute(
                "UPDATE platform_release_targets
                 SET observed_target_hash = ?3, drift_status = ?4, last_checked_at = ?5
                 WHERE skill_id = ?1 AND platform_name = ?2",
                rusqlite::params![skill_id, platform_name, observed, drift, now],
            )
            .map_err(|e| format!("更新漂移状态失败: {e}"))?;
            states.push(MappingState {
                skill_id: skill_id.to_string(),
                platform_name,
                snapshot_id: mapping.snapshot_id,
                target_path: mapping.target_path,
                sync_mode: mapping.sync_mode,
                published_content_hash: mapping.published_hash,
                observed_target_hash: observed,
                drift_status: drift,
                last_checked_at: Some(now),
            });
        }
        Ok(states)
    }

    pub fn remove_mapping(
        &self,
        input: &RemoveMappingInput,
    ) -> Result<PublishTargetResult, String> {
        let mut conn = self.library.open_connection()?;
        let mapping = load_existing_mapping(&conn, &input.skill_id, &input.platform_name)?
            .ok_or_else(|| "MAPPING_NOT_FOUND: 映射不存在".to_string())?;
        let configured = load_configured_platform(&conn, &input.platform_name)?;
        let registry = self.build_registry(&conn)?;
        let adapter = registry
            .get(&input.platform_name)
            .ok_or_else(|| "PLATFORM_ADAPTER_MISSING: 平台 Adapter 不存在".to_string())?;
        let target = PathBuf::from(&mapping.target_path);
        adapter
            .validate_target(&configured.root, &target)
            .map_err(|e| e.to_string())?;
        verify_owned_target(&target, &input.skill_id, &input.platform_name, &mapping)?;
        let operation_id = Uuid::new_v4().to_string();
        let keys = vec![
            format!("skill:{}", input.skill_id),
            format!("path:{}", normalized_lock_path(&target)),
        ];
        acquire_locks(&conn, &operation_id, &keys)?;
        let backup = configured
            .root
            .join(format!(".skill-studio-pro-remove-{operation_id}"));
        let marker = marker_path(&target, &mapping.sync_mode)?;
        let marker_backup = configured
            .root
            .join(format!(".skill-studio-pro-marker-{operation_id}"));
        let result = (|| -> Result<(), String> {
            if fs::symlink_metadata(&target).is_ok() {
                fs::rename(&target, &backup).map_err(|e| format!("备份待移除映射失败: {e}"))?;
            }
            if marker.exists() {
                fs::rename(&marker, &marker_backup)
                    .map_err(|e| format!("备份映射所有权标记失败: {e}"))?;
            }
            let now = now_ms();
            let tx = conn
                .transaction()
                .map_err(|e| format!("开启移除映射事务失败: {e}"))?;
            let db_result = (|| -> Result<(), String> {
                tx.execute(
                    "DELETE FROM platform_release_targets WHERE skill_id = ?1 AND platform_name = ?2",
                    rusqlite::params![input.skill_id, input.platform_name],
                )
                .map_err(|e| format!("删除映射记录失败: {e}"))?;
                insert_sync_log(
                    &tx,
                    &operation_id,
                    &input.skill_id,
                    &input.platform_name,
                    Some(&mapping.snapshot_id),
                    "remove",
                    "success",
                    Some(&mapping.target_path),
                    Some(&mapping.sync_mode),
                    mapping.published_hash.as_deref(),
                    None,
                    None,
                    now,
                )?;
                Ok(())
            })();
            if let Err(error) = db_result {
                drop(tx);
                restore_backup(&backup, &target, &marker_backup, &marker);
                return Err(error);
            }
            if let Err(error) = tx.commit() {
                restore_backup(&backup, &target, &marker_backup, &marker);
                return Err(format!("提交移除映射事务失败: {error}"));
            }
            remove_owned_if_exists(&configured.root, &backup)?;
            if marker_backup.exists() {
                fs::remove_file(&marker_backup)
                    .map_err(|e| format!("清理所有权标记备份失败: {e}"))?;
            }
            Ok(())
        })();
        release_locks(&conn, &operation_id);
        result?;
        Ok(PublishTargetResult {
            platform_name: input.platform_name.clone(),
            target_path: mapping.target_path,
            status: "success".to_string(),
            content_hash: None,
            error_code: None,
            error_message: None,
        })
    }

    fn execute_target(
        &self,
        plan: &PublishPlan,
        target_plan: &PublishTargetPlan,
    ) -> Result<String, String> {
        if target_plan.status == "blocked" {
            return Err(format!(
                "DRIFT_BLOCKED: {}",
                target_plan
                    .blocking_reason
                    .as_deref()
                    .unwrap_or("发布目标被阻止")
            ));
        }
        let mut conn = self.library.open_connection()?;
        let configured = load_configured_platform(&conn, &target_plan.platform_name)?;
        let registry = self.build_registry(&conn)?;
        let adapter = registry
            .get(&target_plan.platform_name)
            .ok_or_else(|| "PLATFORM_ADAPTER_MISSING: 平台 Adapter 不存在".to_string())?;
        let target = PathBuf::from(&target_plan.target_path);
        adapter
            .validate_target(&configured.root, &target)
            .map_err(|e| e.to_string())?;
        let expected_target = configured.root.join(
            target
                .file_name()
                .ok_or_else(|| "发布目标缺少目录名".to_string())?,
        );
        if expected_target != target {
            return Err("PLAN_STALE: 平台目标配置已变化".to_string());
        }
        let existing = load_existing_mapping(&conn, &plan.skill_id, &target_plan.platform_name)?;
        let observed = observe_target(
            &target,
            &plan.skill_id,
            &target_plan.platform_name,
            existing.as_ref(),
        )?;
        if observed != target_plan.observed_hash {
            return Err("PLAN_STALE: 发布目标状态在预览后发生变化".to_string());
        }
        if fs::symlink_metadata(&target).is_ok() && existing.is_none() {
            return Err("UNMANAGED_TARGET: 禁止覆盖非应用拥有的目录".to_string());
        }
        if let Some(mapping) = existing.as_ref() {
            verify_owned_target(&target, &plan.skill_id, &target_plan.platform_name, mapping)?;
        }
        let operation_id = format!("{}:{}", plan.id, target_plan.platform_name);
        let keys = vec![
            format!("skill:{}", plan.skill_id),
            format!("path:{}", normalized_lock_path(&target)),
        ];
        acquire_locks(&conn, &operation_id, &keys)?;
        let result = self.publish_one(
            &mut conn,
            plan,
            target_plan,
            &configured,
            &target,
            existing.as_ref(),
            &operation_id,
        );
        let staging_root = configured.root.join(format!(
            ".skill-studio-pro-staging-{}",
            operation_id.replace(':', "_")
        ));
        let _ = remove_owned_if_exists(&configured.root, &staging_root);
        release_locks(&conn, &operation_id);
        result
    }

    #[allow(clippy::too_many_arguments)]
    fn publish_one(
        &self,
        conn: &mut Connection,
        plan: &PublishPlan,
        target_plan: &PublishTargetPlan,
        configured: &ConfiguredPlatform,
        target: &Path,
        existing: Option<&ExistingMapping>,
        operation_id: &str,
    ) -> Result<String, String> {
        let source = PathBuf::from(&plan.source_path);
        let staging_root = configured.root.join(format!(
            ".skill-studio-pro-staging-{}",
            operation_id.replace(':', "_")
        ));
        let staged = staging_root.join("skill");
        remove_owned_if_exists(&configured.root, &staging_root)?;
        fs::create_dir_all(&staging_root).map_err(|e| format!("创建发布 staging 失败: {e}"))?;
        if target_plan.sync_mode == "copy" {
            copy_skill_tree(&source, &staged)?;
            if hash_skill_directory(&staged)? != plan.source_hash {
                return Err("HASH_MISMATCH: 发布 staging 哈希不一致".to_string());
            }
        } else {
            create_directory_symlink(&source, &staged)?;
        }
        self.fail_if(PublishFailurePoint::AfterStaging)?;

        let backup = configured
            .root
            .join(format!(".skill-studio-pro-backup-{}", Uuid::new_v4()));
        let new_marker = marker_path(target, &target_plan.sync_mode)?;
        let previous_marker = existing
            .map(|mapping| marker_path(target, &mapping.sync_mode))
            .transpose()?
            .unwrap_or_else(|| new_marker.clone());
        let marker_backup = configured.root.join(format!(
            ".skill-studio-pro-marker-backup-{}",
            Uuid::new_v4()
        ));
        let had_target = fs::symlink_metadata(target).is_ok();
        if had_target {
            fs::rename(target, &backup).map_err(|e| format!("备份原发布目标失败: {e}"))?;
        }
        if previous_marker.exists() {
            fs::rename(&previous_marker, &marker_backup)
                .map_err(|e| format!("备份所有权标记失败: {e}"))?;
        }
        if let Err(error) = self.fail_if(PublishFailurePoint::AfterBackup) {
            restore_backup(&backup, target, &marker_backup, &previous_marker);
            return Err(error);
        }
        if let Err(error) = fs::rename(&staged, target) {
            restore_backup(&backup, target, &marker_backup, &previous_marker);
            return Err(format!("原子替换发布目标失败: {error}"));
        }
        let ownership_token = existing
            .and_then(|mapping| mapping.ownership_token.clone())
            .unwrap_or_else(|| Uuid::new_v4().to_string());
        let ownership = OwnershipMarker {
            application: "skill-studio-pro".to_string(),
            skill_id: plan.skill_id.clone(),
            platform_name: target_plan.platform_name.clone(),
            ownership_token: ownership_token.clone(),
        };
        if let Err(error) = write_marker_atomic(&new_marker, &ownership) {
            let _ = remove_target_path(target);
            restore_backup(&backup, target, &marker_backup, &previous_marker);
            return Err(error);
        }
        if let Err(error) = self.fail_if(PublishFailurePoint::AfterReplace) {
            let _ = remove_target_path(target);
            let _ = fs::remove_file(&new_marker);
            restore_backup(&backup, target, &marker_backup, &previous_marker);
            return Err(error);
        }
        let observed_hash = if target_plan.sync_mode == "copy" {
            hash_skill_directory(target)?
        } else {
            plan.source_hash.clone()
        };
        if observed_hash != plan.source_hash {
            let _ = remove_target_path(target);
            let _ = fs::remove_file(&new_marker);
            restore_backup(&backup, target, &marker_backup, &previous_marker);
            return Err("HASH_MISMATCH: 原子替换后目标校验失败".to_string());
        }
        if let Err(error) = self.fail_if(PublishFailurePoint::BeforeDatabaseCommit) {
            let _ = remove_target_path(target);
            let _ = fs::remove_file(&new_marker);
            restore_backup(&backup, target, &marker_backup, &previous_marker);
            return Err(error);
        }
        let now = now_ms();
        let tx = conn
            .transaction()
            .map_err(|e| format!("开启发布数据库事务失败: {e}"))?;
        let db_result = (|| -> Result<(), String> {
            tx.execute(
                "INSERT INTO platform_release_targets (
                    id, skill_id, platform_name, snapshot_id, target_path, sync_mode,
                    published_content_hash, observed_target_hash, drift_status,
                    last_checked_at, ownership_token, released_at, created_at, updated_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, 'in_sync', ?8, ?9, ?8, ?8, ?8)
                 ON CONFLICT(skill_id, platform_name) DO UPDATE SET
                    snapshot_id = excluded.snapshot_id,
                    target_path = excluded.target_path,
                    sync_mode = excluded.sync_mode,
                    published_content_hash = excluded.published_content_hash,
                    observed_target_hash = excluded.observed_target_hash,
                    drift_status = 'in_sync',
                    last_checked_at = excluded.last_checked_at,
                    ownership_token = excluded.ownership_token,
                    released_at = excluded.released_at,
                    updated_at = excluded.updated_at",
                rusqlite::params![
                    format!("{}:{}", plan.skill_id, target_plan.platform_name),
                    plan.skill_id,
                    target_plan.platform_name,
                    plan.snapshot_id,
                    target.to_string_lossy(),
                    target_plan.sync_mode,
                    plan.source_hash,
                    now,
                    ownership_token,
                ],
            )
            .map_err(|e| format!("写入发布映射失败: {e}"))?;
            tx.execute(
                "UPDATE platform_connections SET last_sync_at = ?1 WHERE platform_name = ?2",
                rusqlite::params![now, target_plan.platform_name],
            )
            .map_err(|e| format!("更新平台同步时间失败: {e}"))?;
            insert_sync_log(
                &tx,
                operation_id,
                &plan.skill_id,
                &target_plan.platform_name,
                Some(&plan.snapshot_id),
                if existing.is_some() {
                    "republish"
                } else {
                    "publish"
                },
                "success",
                Some(&target.to_string_lossy()),
                Some(&target_plan.sync_mode),
                existing.and_then(|mapping| mapping.published_hash.as_deref()),
                Some(&plan.source_hash),
                Some(&plan.id),
                now,
            )?;
            tx.execute(
                "INSERT INTO operation_logs (
                    id, operation_type, entity_type, entity_id, target_label, plan_json,
                    before_hash, after_hash, snapshot_id, status, created_at, completed_at
                 ) VALUES (?1, 'publish', 'mapping', ?2, ?3, ?4, ?5, ?6, ?7,
                           'success', ?8, ?8)",
                rusqlite::params![
                    Uuid::new_v4().to_string(),
                    plan.skill_id,
                    target_plan.platform_name,
                    serde_json::to_string(target_plan).map_err(|e| e.to_string())?,
                    existing.and_then(|mapping| mapping.published_hash.as_deref()),
                    plan.source_hash,
                    plan.snapshot_id,
                    now,
                ],
            )
            .map_err(|e| format!("记录发布操作失败: {e}"))?;
            Ok(())
        })();
        if let Err(error) = db_result {
            drop(tx);
            let _ = remove_target_path(target);
            let _ = fs::remove_file(&new_marker);
            restore_backup(&backup, target, &marker_backup, &previous_marker);
            return Err(error);
        }
        if let Err(error) = tx.commit() {
            let _ = remove_target_path(target);
            let _ = fs::remove_file(&new_marker);
            restore_backup(&backup, target, &marker_backup, &previous_marker);
            return Err(format!("提交发布数据库事务失败: {error}"));
        }
        if had_target {
            remove_owned_if_exists(&configured.root, &backup)?;
        }
        if marker_backup.exists() {
            fs::remove_file(&marker_backup).map_err(|e| format!("清理标记备份失败: {e}"))?;
        }
        let _ = remove_owned_if_exists(&configured.root, &staging_root);
        Ok(observed_hash)
    }

    fn build_registry(&self, conn: &Connection) -> Result<PlatformRegistry, String> {
        let mut registry = PlatformRegistry::from_upstream(&self.home);
        let mut statement = conn
            .prepare(
                "SELECT platform_name, display_name, skills_dir, supports_symlink, supports_copy
                 FROM platform_connections WHERE platform_type = 'custom' AND skills_dir IS NOT NULL",
            )
            .map_err(|e| format!("准备自定义 Adapter 查询失败: {e}"))?;
        let rows = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, i64>(3)? != 0,
                    row.get::<_, i64>(4)? != 0,
                ))
            })
            .map_err(|e| format!("查询自定义 Adapter 失败: {e}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("读取自定义 Adapter 失败: {e}"))?;
        for (name, display, path, symlink, copy) in rows {
            registry.register_custom(name, display, PathBuf::from(path), symlink, copy);
        }
        Ok(registry)
    }

    fn fail_if(&self, point: PublishFailurePoint) -> Result<(), String> {
        if self.failure_at.as_ref() == Some(&point) {
            Err(format!("FAULT_INJECTED: {point:?}"))
        } else {
            Ok(())
        }
    }

    fn record_target_failure(&self, plan: &PublishPlan, target: &PublishTargetPlan, error: &str) {
        let Ok(conn) = self.library.open_connection() else {
            return;
        };
        let log_id = Uuid::new_v4().to_string();
        let _ = insert_sync_log(
            &conn,
            &log_id,
            &plan.skill_id,
            &target.platform_name,
            Some(&plan.snapshot_id),
            "publish",
            "failed",
            Some(&target.target_path),
            Some(&target.sync_mode),
            target.observed_hash.as_deref(),
            None,
            Some(&plan.id),
            now_ms(),
        );
        let _ = conn.execute(
            "UPDATE sync_logs SET error_message = ?2, detail_message = ?3 WHERE id = ?1",
            rusqlite::params![log_id, error, target.blocking_reason],
        );
    }
}

fn load_publish_source(
    conn: &Connection,
    skill_id: &str,
    snapshot_id: &str,
) -> Result<(String, String), String> {
    conn.query_row(
        "SELECT s.slug, ss.snapshot_path
         FROM skills s INNER JOIN skill_snapshots ss ON ss.skill_id = s.id
         WHERE s.id = ?1 AND ss.id = ?2 AND s.lifecycle_state = 'active'",
        rusqlite::params![skill_id, snapshot_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )
    .map_err(|_| "PUBLISH_SOURCE_NOT_FOUND: 中央 Skill 或快照不存在".to_string())
}

fn load_configured_platform(conn: &Connection, name: &str) -> Result<ConfiguredPlatform, String> {
    let platform = conn
        .query_row(
            "SELECT platform_name, display_name, skills_dir, enabled, detected,
                    supports_symlink, supports_copy, platform_type, sync_mode
             FROM platform_connections WHERE platform_name = ?1",
            rusqlite::params![name],
            |row| {
                Ok(ConfiguredPlatform {
                    name: row.get(0)?,
                    display_name: row.get(1)?,
                    root: PathBuf::from(row.get::<_, String>(2)?),
                    enabled: row.get::<_, i64>(3)? != 0,
                    detected: row.get::<_, i64>(4)? != 0,
                    supports_symlink: row.get::<_, i64>(5)? != 0,
                    supports_copy: row.get::<_, i64>(6)? != 0,
                    default_sync_mode: row.get(8)?,
                })
            },
        )
        .optional()
        .map_err(|e| format!("读取平台配置失败: {e}"))?
        .ok_or_else(|| format!("PLATFORM_NOT_CONFIGURED: {name}"))?;
    if !platform.enabled || !platform.detected {
        return Err(format!(
            "PLATFORM_NOT_READY: {} 未启用或未检测到",
            platform.name
        ));
    }
    if !platform.root.is_absolute() || !platform.root.is_dir() {
        return Err(format!(
            "PLATFORM_ROOT_UNAVAILABLE: {}",
            platform.root.display()
        ));
    }
    Ok(platform)
}

fn load_existing_mapping(
    conn: &Connection,
    skill_id: &str,
    platform_name: &str,
) -> Result<Option<ExistingMapping>, String> {
    conn.query_row(
        "SELECT snapshot_id, COALESCE(target_path, ''), sync_mode,
                published_content_hash, ownership_token
         FROM platform_release_targets WHERE skill_id = ?1 AND platform_name = ?2",
        rusqlite::params![skill_id, platform_name],
        |row| {
            Ok(ExistingMapping {
                snapshot_id: row.get(0)?,
                target_path: row.get(1)?,
                sync_mode: row.get(2)?,
                published_hash: row.get(3)?,
                ownership_token: row.get(4)?,
            })
        },
    )
    .optional()
    .map_err(|e| format!("读取现有映射失败: {e}"))
}

fn normalize_sync_mode(value: &str) -> Result<String, String> {
    match value.trim().to_ascii_lowercase().as_str() {
        "" | "copy" => Ok("copy".to_string()),
        "symlink" => Ok("symlink".to_string()),
        other => Err(format!("UNSUPPORTED_SYNC_MODE: {other}")),
    }
}

fn normalize_drift_policy(value: &str) -> String {
    if value.trim().eq_ignore_ascii_case("overwrite") {
        "overwrite".to_string()
    } else {
        "abort".to_string()
    }
}

fn validate_sync_capability(adapter: &dyn PlatformAdapter, sync_mode: &str) -> Result<(), String> {
    if sync_mode == "copy" && !adapter.supports_copy() {
        return Err("SYNC_MODE_UNSUPPORTED: Adapter 不支持复制".to_string());
    }
    if sync_mode == "symlink" && !adapter.supports_symlink() {
        return Err("SYNC_MODE_UNSUPPORTED: Adapter 不支持符号链接".to_string());
    }
    Ok(())
}

fn plan_target_status(
    target_exists: bool,
    observed: &Option<String>,
    existing: Option<&ExistingMapping>,
    drift_policy: &str,
) -> (String, String, Option<String>) {
    let Some(mapping) = existing else {
        return if target_exists {
            (
                "unmanaged".to_string(),
                "blocked".to_string(),
                Some("目标已存在且不属于 Skill Studio Pro，禁止覆盖".to_string()),
            )
        } else {
            ("not_published".to_string(), "ready".to_string(), None)
        };
    };
    let drift = classify_drift(observed.as_deref(), mapping.published_hash.as_deref());
    if drift == "in_sync" {
        return (drift, "ready".to_string(), None);
    }
    if normalize_drift_policy(drift_policy) == "overwrite" && drift != "ownership_mismatch" {
        return (drift, "ready".to_string(), None);
    }
    (
        drift,
        "blocked".to_string(),
        Some("目标发生漂移；必须明确选择 overwrite 后重新生成计划".to_string()),
    )
}

fn classify_drift(observed: Option<&str>, published: Option<&str>) -> String {
    match (observed, published) {
        (None, _) => "missing".to_string(),
        (Some("ownership_mismatch"), _) => "ownership_mismatch".to_string(),
        (Some("invalid_target_type"), _) => "ownership_mismatch".to_string(),
        (Some(observed), Some(published)) if observed == published => "in_sync".to_string(),
        (Some(_), Some(_)) => "drifted".to_string(),
        (Some(_), None) => "unknown".to_string(),
    }
}

fn observe_target(
    target: &Path,
    skill_id: &str,
    platform_name: &str,
    mapping: Option<&ExistingMapping>,
) -> Result<Option<String>, String> {
    let Ok(metadata) = fs::symlink_metadata(target) else {
        return Ok(None);
    };
    let Some(mapping) = mapping else {
        return Ok(Some("unmanaged".to_string()));
    };
    if read_owned_marker(target, skill_id, platform_name, mapping).is_err() {
        return Ok(Some("ownership_mismatch".to_string()));
    }
    if metadata.file_type().is_symlink() {
        let destination = fs::read_link(target)
            .map_err(|e| format!("读取目标符号链接失败 {}: {e}", target.display()))?;
        let resolved = if destination.is_absolute() {
            destination
        } else {
            target.parent().unwrap_or(Path::new(".")).join(destination)
        };
        return hash_skill_directory(&resolved).map(Some);
    }
    if metadata.is_dir() {
        return hash_skill_directory(target).map(Some);
    }
    Ok(Some("invalid_target_type".to_string()))
}

fn verify_owned_target(
    target: &Path,
    skill_id: &str,
    platform_name: &str,
    mapping: &ExistingMapping,
) -> Result<(), String> {
    if fs::symlink_metadata(target).is_err() {
        return Ok(());
    }
    read_owned_marker(target, skill_id, platform_name, mapping).map(|_| ())
}

fn marker_path(target: &Path, sync_mode: &str) -> Result<PathBuf, String> {
    if sync_mode == "copy" {
        return Ok(target.join(MANAGED_MARKER));
    }
    let name = target
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "发布目标目录名不是有效 UTF-8".to_string())?;
    Ok(target
        .parent()
        .ok_or_else(|| "发布目标缺少父目录".to_string())?
        .join(format!(".{name}.skill-studio-pro-managed.json")))
}

fn read_owned_marker(
    target: &Path,
    skill_id: &str,
    platform_name: &str,
    mapping: &ExistingMapping,
) -> Result<OwnershipMarker, String> {
    let marker_path = marker_path(target, &mapping.sync_mode)?;
    let marker: OwnershipMarker = serde_json::from_slice(
        &fs::read(&marker_path)
            .map_err(|_| "OWNERSHIP_MISMATCH: 缺少受管目标所有权标记".to_string())?,
    )
    .map_err(|_| "OWNERSHIP_MISMATCH: 所有权标记损坏".to_string())?;
    if marker.application != "skill-studio-pro"
        || marker.skill_id != skill_id
        || marker.platform_name != platform_name
        || mapping.ownership_token.as_deref() != Some(marker.ownership_token.as_str())
    {
        return Err("OWNERSHIP_MISMATCH: 目标不属于当前映射".to_string());
    }
    Ok(marker)
}

fn write_marker_atomic(path: &Path, marker: &OwnershipMarker) -> Result<(), String> {
    let temporary = path.with_extension(format!("tmp-{}", Uuid::new_v4()));
    let content =
        serde_json::to_vec_pretty(marker).map_err(|e| format!("序列化所有权标记失败: {e}"))?;
    fs::write(&temporary, content).map_err(|e| format!("写入所有权标记失败: {e}"))?;
    fs::rename(&temporary, path).map_err(|e| format!("原子写入所有权标记失败: {e}"))
}

fn create_directory_symlink(source: &Path, target: &Path) -> Result<(), String> {
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(source, target)
            .map_err(|e| format!("SYMLINK_UNAVAILABLE: 创建符号链接失败: {e}"))
    }
    #[cfg(windows)]
    {
        std::os::windows::fs::symlink_dir(source, target)
            .map_err(|e| format!("SYMLINK_UNAVAILABLE: 创建符号链接失败: {e}"))
    }
}

fn remove_target_path(target: &Path) -> Result<(), String> {
    let Ok(metadata) = fs::symlink_metadata(target) else {
        return Ok(());
    };
    if metadata.file_type().is_symlink() || metadata.is_file() {
        fs::remove_file(target).map_err(|e| format!("清理替换目标失败: {e}"))
    } else {
        fs::remove_dir_all(target).map_err(|e| format!("清理替换目标失败: {e}"))
    }
}

fn restore_backup(backup: &Path, target: &Path, marker_backup: &Path, marker: &Path) {
    let _ = remove_target_path(target);
    let _ = fs::remove_file(marker);
    if backup.exists() || fs::symlink_metadata(backup).is_ok() {
        let _ = fs::rename(backup, target);
    }
    if marker_backup.exists() {
        let _ = fs::rename(marker_backup, marker);
    }
}

#[allow(clippy::too_many_arguments)]
fn insert_sync_log(
    conn: &Connection,
    id: &str,
    skill_id: &str,
    platform_name: &str,
    snapshot_id: Option<&str>,
    action: &str,
    status: &str,
    target_path: Option<&str>,
    sync_mode: Option<&str>,
    before_hash: Option<&str>,
    after_hash: Option<&str>,
    plan_id: Option<&str>,
    now: i64,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO sync_logs (
            id, skill_id, platform_name, snapshot_id, action, status, target_path,
            sync_mode, before_hash, after_hash, plan_id, synced_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        rusqlite::params![
            id,
            skill_id,
            platform_name,
            snapshot_id,
            action,
            status,
            target_path,
            sync_mode,
            before_hash,
            after_hash,
            plan_id,
            now,
        ],
    )
    .map_err(|e| format!("写入同步日志失败: {e}"))?;
    Ok(())
}

fn error_code(error: &str) -> String {
    error
        .split_once(':')
        .map(|(code, _)| code.trim().to_string())
        .unwrap_or_else(|| "PUBLISH_FAILED".to_string())
}
