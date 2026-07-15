use std::fs;
use std::path::{Component, Path, PathBuf};

use rusqlite::{Connection, OptionalExtension};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::inventory::repository;
use crate::store::{compute_directory_revision, now_ms, slugify};

pub const PLAN_TTL_MS: i64 = 5 * 60 * 1000;
pub const LOCK_TTL_MS: i64 = 2 * 60 * 1000;
pub const MANAGED_MARKER: &str = ".skill-studio-pro-managed.json";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CentralSkill {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub storage_rel_path: String,
    pub storage_path: String,
    pub description: Option<String>,
    pub active_content_hash: Option<String>,
    pub lifecycle_state: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterInstancePlanInput {
    pub instance_id: String,
    pub slug: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RegisterInstancePlan {
    pub id: String,
    pub instance_id: String,
    pub central_skill_id: String,
    pub name: String,
    pub slug: String,
    pub source_path: String,
    pub source_hash: String,
    pub target_path: String,
    pub storage_rel_path: String,
    pub plan_hash: String,
    pub created_at: i64,
    pub expires_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutePlanInput {
    pub plan_id: String,
    pub plan_hash: String,
}

pub struct LibraryService {
    workspace_root: PathBuf,
}

impl LibraryService {
    pub fn new(workspace_root: PathBuf) -> Result<Self, String> {
        if !workspace_root.is_absolute() {
            return Err("中央工作区必须是绝对路径".to_string());
        }
        fs::create_dir_all(workspace_root.join("skills"))
            .map_err(|e| format!("创建中央库目录失败: {e}"))?;
        fs::create_dir_all(workspace_root.join("snapshots"))
            .map_err(|e| format!("创建快照目录失败: {e}"))?;
        fs::create_dir_all(workspace_root.join("staging/library"))
            .map_err(|e| format!("创建纳管暂存目录失败: {e}"))?;
        Ok(Self { workspace_root })
    }

    pub fn workspace_root(&self) -> &Path {
        &self.workspace_root
    }

    pub fn open_connection(&self) -> Result<Connection, String> {
        crate::db::init_db_at_path(&self.workspace_root)
    }

    pub fn list(&self) -> Result<Vec<CentralSkill>, String> {
        let conn = self.open_connection()?;
        let mut statement = conn
            .prepare(
                "SELECT id, name, slug, COALESCE(storage_rel_path, slug), description,
                        active_content_hash, lifecycle_state, created_at, updated_at
                 FROM skills ORDER BY updated_at DESC, id",
            )
            .map_err(|e| format!("准备中央 Skill 查询失败: {e}"))?;
        let skills = statement
            .query_map([], |row| central_skill_from_row(row, &self.workspace_root))
            .map_err(|e| format!("查询中央 Skill 失败: {e}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("读取中央 Skill 失败: {e}"))?;
        Ok(skills)
    }

    pub fn get(&self, skill_id: &str) -> Result<CentralSkill, String> {
        let conn = self.open_connection()?;
        conn.query_row(
            "SELECT id, name, slug, COALESCE(storage_rel_path, slug), description,
                    active_content_hash, lifecycle_state, created_at, updated_at
             FROM skills WHERE id = ?1",
            rusqlite::params![skill_id],
            |row| central_skill_from_row(row, &self.workspace_root),
        )
        .map_err(|_| format!("中央 Skill 不存在: {skill_id}"))
    }

    pub fn create_register_plan(
        &self,
        input: &RegisterInstancePlanInput,
    ) -> Result<RegisterInstancePlan, String> {
        if input.instance_id.trim().is_empty() {
            return Err("instanceId 不能为空".to_string());
        }
        let conn = self.open_connection()?;
        let detail = repository::get_instance(&conn, input.instance_id.trim())?;
        if detail.instance.missing_at.is_some() {
            return Err("INSTANCE_MISSING: 扫描实例已不存在，请重新扫描".to_string());
        }
        if detail.instance.central_skill_id.is_some() {
            return Err("INSTANCE_ALREADY_MANAGED: 该实例已纳入中央库".to_string());
        }
        let source = PathBuf::from(&detail.instance.absolute_path);
        validate_external_skill_source(&source)?;
        let current_hash = hash_skill_directory(&source)?;
        if current_hash != detail.instance.content_hash {
            return Err("PLAN_STALE: 实例内容已变化，请重新扫描后预览".to_string());
        }
        let name = detail
            .instance
            .parsed_name
            .clone()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| detail.instance.folder_name.clone());
        let slug = input
            .slug
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .map(slugify)
            .unwrap_or_else(|| slugify(&name));
        validate_slug(&slug)?;
        let slug_exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM skills WHERE slug = ?1)",
                rusqlite::params![slug],
                |row| row.get(0),
            )
            .map_err(|e| format!("检查中央库 slug 冲突失败: {e}"))?;
        if slug_exists {
            return Err(format!("SLUG_CONFLICT: 中央库 slug '{slug}' 已存在"));
        }
        let name_exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM skills WHERE name = ?1)",
                rusqlite::params![name],
                |row| row.get(0),
            )
            .map_err(|e| format!("检查中央库名称冲突失败: {e}"))?;
        if name_exists {
            return Err(format!("NAME_CONFLICT: 中央库名称 '{name}' 已存在"));
        }
        let now = now_ms();
        let skill_id = Uuid::new_v4().to_string();
        let storage_rel_path = format!("{skill_id}/{slug}");
        let target = self.workspace_root.join("skills").join(&storage_rel_path);
        ensure_lexically_within(&self.workspace_root.join("skills"), &target)?;
        if target.exists() {
            return Err("TARGET_CONFLICT: 中央库目标目录已存在".to_string());
        }
        let mut plan = RegisterInstancePlan {
            id: Uuid::new_v4().to_string(),
            instance_id: input.instance_id.trim().to_string(),
            central_skill_id: skill_id,
            name,
            slug,
            source_path: source.to_string_lossy().to_string(),
            source_hash: current_hash,
            target_path: target.to_string_lossy().to_string(),
            storage_rel_path,
            plan_hash: String::new(),
            created_at: now,
            expires_at: now + PLAN_TTL_MS,
        };
        plan.plan_hash = calculate_plan_hash(&plan)?;
        persist_plan(
            &conn,
            "register",
            &plan.central_skill_id,
            &plan,
            &plan.source_hash,
        )?;
        Ok(plan)
    }

    pub fn execute_register_plan(&self, input: &ExecutePlanInput) -> Result<CentralSkill, String> {
        let mut conn = self.open_connection()?;
        let plan: RegisterInstancePlan = load_plan(&conn, &input.plan_id, "register")?;
        validate_execute_plan(&plan.plan_hash, plan.expires_at, input)?;
        let source = PathBuf::from(&plan.source_path);
        validate_external_skill_source(&source)?;
        let current_hash = hash_skill_directory(&source)?;
        if current_hash != plan.source_hash {
            return Err("PLAN_STALE: 纳管来源内容已变化".to_string());
        }

        let target = PathBuf::from(&plan.target_path);
        let skills_root = self.workspace_root.join("skills");
        ensure_lexically_within(&skills_root, &target)?;
        let operation_id = plan.id.clone();
        let lock_keys = vec![
            format!("skill:{}", plan.central_skill_id),
            format!("path:{}", normalized_lock_path(&target)),
        ];
        acquire_locks(&conn, &operation_id, &lock_keys)?;

        let staging_root = self
            .workspace_root
            .join("staging/library")
            .join(&operation_id);
        let staged_skill = staging_root.join(&plan.slug);
        let snapshot_target = self
            .workspace_root
            .join("snapshots")
            .join(&plan.central_skill_id)
            .join("v1");
        let result = (|| -> Result<CentralSkill, String> {
            remove_owned_if_exists(&self.workspace_root.join("staging"), &staging_root)?;
            fs::create_dir_all(&staging_root).map_err(|e| format!("创建纳管 staging 失败: {e}"))?;
            copy_skill_tree(&source, &staged_skill)?;
            let staged_hash = hash_skill_directory(&staged_skill)?;
            if staged_hash != plan.source_hash {
                return Err("HASH_MISMATCH: staging 内容校验失败".to_string());
            }
            if target.exists() || snapshot_target.exists() {
                return Err("TARGET_CONFLICT: 中央目录或初始快照已存在".to_string());
            }
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent).map_err(|e| format!("创建中央目录父级失败: {e}"))?;
            }
            fs::rename(&staged_skill, &target).map_err(|e| format!("原子写入中央目录失败: {e}"))?;
            if let Some(parent) = snapshot_target.parent() {
                fs::create_dir_all(parent).map_err(|e| format!("创建初始快照父级失败: {e}"))?;
            }
            if let Err(error) = copy_skill_tree(&target, &snapshot_target) {
                let _ = remove_owned_if_exists(&skills_root, &target);
                return Err(format!("创建初始快照失败: {error}"));
            }
            let revision_hash = compute_directory_revision(&snapshot_target)?;
            let snapshot_id = Uuid::new_v4().to_string();
            let now = now_ms();
            let transaction = conn
                .transaction()
                .map_err(|e| format!("开启纳管数据库事务失败: {e}"))?;
            let db_result = (|| -> Result<(), String> {
                transaction
                    .execute(
                        "INSERT INTO skills (
                        id, name, slug, storage_rel_path, canonical_name, active_content_hash,
                        lifecycle_state, description, source_type, source_path,
                        created_at, updated_at, is_archived
                     ) VALUES (?1, ?2, ?3, ?4, lower(trim(?2)), ?5, 'active', ?6,
                               'central_library', ?7, ?8, ?8, 0)",
                        rusqlite::params![
                            plan.central_skill_id,
                            plan.name,
                            plan.slug,
                            plan.storage_rel_path,
                            plan.source_hash,
                            Option::<String>::None,
                            plan.source_path,
                            now,
                        ],
                    )
                    .map_err(|e| format!("创建中央 Skill 记录失败: {e}"))?;
                transaction
                    .execute(
                        "INSERT INTO skill_sources (
                        id, skill_id, source_type, source_label, source_ref, source_path,
                        metadata_json, is_primary, created_at, updated_at
                     ) VALUES (?1, ?2, 'platform_scan', '扫描实例纳管', ?3, ?4, ?5, 1, ?6, ?6)",
                        rusqlite::params![
                            Uuid::new_v4().to_string(),
                            plan.central_skill_id,
                            plan.instance_id,
                            plan.source_path,
                            serde_json::json!({"registrationPlanId": plan.id}).to_string(),
                            now,
                        ],
                    )
                    .map_err(|e| format!("写入中央 Skill 来源失败: {e}"))?;
                transaction
                    .execute(
                        "INSERT INTO skill_snapshots (
                        id, skill_id, snapshot_number, snapshot_path, revision_hash,
                        change_summary, source, created_at, is_current, is_active
                     ) VALUES (?1, ?2, 1, ?3, ?4, '纳管初始快照', 'register', ?5, 1, 1)",
                        rusqlite::params![
                            snapshot_id,
                            plan.central_skill_id,
                            snapshot_target.to_string_lossy(),
                            revision_hash,
                            now,
                        ],
                    )
                    .map_err(|e| format!("写入初始快照失败: {e}"))?;
                repository::attach_central_skill(
                    &transaction,
                    &plan.instance_id,
                    &plan.central_skill_id,
                )?;
                transaction
                    .execute(
                        "INSERT INTO source_evidence (
                        id, instance_id, skill_id, evidence_type, evidence_key, evidence_value,
                        source_candidate, weight, is_conflict, resolver_version, observed_at
                     ) VALUES (?1, ?2, ?3, 'app_install_record', 'central_skill_id', ?3,
                               'central_library', 50, 0, 'library-v1', ?4)",
                        rusqlite::params![
                            Uuid::new_v4().to_string(),
                            plan.instance_id,
                            plan.central_skill_id,
                            now,
                        ],
                    )
                    .map_err(|e| format!("写入纳管来源证据失败: {e}"))?;
                transaction
                    .execute(
                        "INSERT INTO operation_logs (
                        id, operation_type, entity_type, entity_id, target_label, plan_json,
                        before_hash, after_hash, snapshot_id, status, created_at, completed_at
                     ) VALUES (?1, 'register', 'skill', ?2, ?3, ?4, ?5, ?5, ?6,
                               'success', ?7, ?7)",
                        rusqlite::params![
                            Uuid::new_v4().to_string(),
                            plan.central_skill_id,
                            plan.name,
                            serde_json::to_string(&plan).map_err(|e| e.to_string())?,
                            plan.source_hash,
                            snapshot_id,
                            now,
                        ],
                    )
                    .map_err(|e| format!("记录纳管操作失败: {e}"))?;
                transaction
                    .execute(
                        "UPDATE library_operation_plans SET status = 'executed', executed_at = ?2
                     WHERE id = ?1 AND status = 'planned'",
                        rusqlite::params![plan.id, now],
                    )
                    .map_err(|e| format!("更新纳管计划状态失败: {e}"))?;
                Ok(())
            })();
            if let Err(error) = db_result {
                drop(transaction);
                let _ = remove_owned_if_exists(&skills_root, &target);
                let _ = remove_owned_if_exists(
                    &self.workspace_root.join("snapshots"),
                    &snapshot_target,
                );
                return Err(error);
            }
            if let Err(error) = transaction.commit() {
                let _ = remove_owned_if_exists(&skills_root, &target);
                let _ = remove_owned_if_exists(
                    &self.workspace_root.join("snapshots"),
                    &snapshot_target,
                );
                return Err(format!("提交纳管数据库事务失败: {error}"));
            }
            let _ = crate::origin::service::recalculate(&conn, &plan.instance_id, now);
            self.get(&plan.central_skill_id)
        })();

        let _ = remove_owned_if_exists(&self.workspace_root.join("staging"), &staging_root);
        release_locks(&conn, &operation_id);
        result
    }
}

fn central_skill_from_row(
    row: &rusqlite::Row<'_>,
    workspace_root: &Path,
) -> rusqlite::Result<CentralSkill> {
    let storage_rel_path: String = row.get(3)?;
    Ok(CentralSkill {
        id: row.get(0)?,
        name: row.get(1)?,
        slug: row.get(2)?,
        storage_path: workspace_root
            .join("skills")
            .join(&storage_rel_path)
            .to_string_lossy()
            .to_string(),
        storage_rel_path,
        description: row.get(4)?,
        active_content_hash: row.get(5)?,
        lifecycle_state: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

pub(crate) fn validate_external_skill_source(source: &Path) -> Result<(), String> {
    if !source.is_absolute() {
        return Err("SOURCE_NOT_ABSOLUTE: 纳管来源必须是绝对路径".to_string());
    }
    let metadata = fs::symlink_metadata(source)
        .map_err(|e| format!("SOURCE_UNAVAILABLE: 无法读取来源 {}: {e}", source.display()))?;
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return Err("SOURCE_UNSAFE: 纳管来源不能是符号链接或 junction".to_string());
    }
    let has_skill_md = fs::read_dir(source)
        .map_err(|e| format!("SOURCE_UNAVAILABLE: 无法读取来源目录: {e}"))?
        .filter_map(Result::ok)
        .any(|entry| {
            entry.file_type().is_ok_and(|file_type| file_type.is_file())
                && if cfg!(windows) {
                    entry
                        .file_name()
                        .to_string_lossy()
                        .eq_ignore_ascii_case("SKILL.md")
                } else {
                    entry.file_name() == "SKILL.md"
                }
        });
    if !has_skill_md {
        return Err("SOURCE_INVALID: 来源目录缺少 SKILL.md".to_string());
    }
    Ok(())
}

pub(crate) fn hash_skill_directory(path: &Path) -> Result<String, String> {
    let (indexed, _) = crate::inventory::scanner::index_skill(path, path, None, now_ms())?;
    Ok(indexed.content_hash)
}

pub(crate) fn copy_skill_tree(source: &Path, target: &Path) -> Result<(), String> {
    let canonical_source = source
        .canonicalize()
        .map_err(|e| format!("规范化复制来源失败: {e}"))?;
    if target.exists() {
        return Err(format!("复制目标已存在: {}", target.display()));
    }
    fs::create_dir_all(target).map_err(|e| format!("创建复制目标失败: {e}"))?;
    let mut stack = vec![(canonical_source.clone(), target.to_path_buf())];
    while let Some((source_dir, target_dir)) = stack.pop() {
        for entry in fs::read_dir(&source_dir).map_err(|e| format!("读取复制来源失败: {e}"))?
        {
            let entry = entry.map_err(|e| format!("读取复制条目失败: {e}"))?;
            let name = entry.file_name();
            if matches!(
                name.to_string_lossy().as_ref(),
                ".git" | "node_modules" | "target" | MANAGED_MARKER
            ) {
                continue;
            }
            let source_path = entry.path();
            let target_path = target_dir.join(&name);
            let metadata = fs::symlink_metadata(&source_path)
                .map_err(|e| format!("读取复制条目元数据失败: {e}"))?;
            if metadata.file_type().is_symlink() {
                let link = fs::read_link(&source_path)
                    .map_err(|e| format!("读取符号链接失败 {}: {e}", source_path.display()))?;
                if link.is_absolute() {
                    return Err(format!(
                        "SYMLINK_UNSAFE: 不复制绝对符号链接 {}",
                        source_path.display()
                    ));
                }
                let resolved = source_path
                    .parent()
                    .unwrap_or(&source_dir)
                    .join(&link)
                    .canonicalize()
                    .map_err(|e| format!("解析符号链接失败 {}: {e}", source_path.display()))?;
                if !resolved.starts_with(&canonical_source) {
                    return Err(format!(
                        "SYMLINK_ESCAPE: 符号链接逃逸来源目录 {}",
                        source_path.display()
                    ));
                }
                create_symlink(&link, &target_path, resolved.is_dir())?;
            } else if metadata.is_dir() {
                fs::create_dir(&target_path).map_err(|e| format!("创建复制子目录失败: {e}"))?;
                stack.push((source_path, target_path));
            } else if metadata.is_file() {
                fs::copy(&source_path, &target_path)
                    .map_err(|e| format!("复制文件 {} 失败: {e}", source_path.display()))?;
            } else {
                return Err(format!("SPECIAL_FILE_REJECTED: {}", source_path.display()));
            }
        }
    }
    Ok(())
}

#[cfg(unix)]
fn create_symlink(link: &Path, target: &Path, _is_dir: bool) -> Result<(), String> {
    std::os::unix::fs::symlink(link, target).map_err(|e| format!("创建符号链接失败: {e}"))
}

#[cfg(windows)]
fn create_symlink(link: &Path, target: &Path, is_dir: bool) -> Result<(), String> {
    if is_dir {
        std::os::windows::fs::symlink_dir(link, target)
    } else {
        std::os::windows::fs::symlink_file(link, target)
    }
    .map_err(|e| format!("创建符号链接失败: {e}"))
}

pub(crate) fn ensure_lexically_within(root: &Path, path: &Path) -> Result<(), String> {
    if !root.is_absolute() || !path.is_absolute() {
        return Err("PATH_NOT_ABSOLUTE: 递归操作路径必须是绝对路径".to_string());
    }
    let normalized_root = lexical_normalize(root);
    let normalized_path = lexical_normalize(path);
    if normalized_path == normalized_root || !normalized_path.starts_with(&normalized_root) {
        return Err(format!("PATH_OUTSIDE_ALLOWED_ROOT: {}", path.display()));
    }
    Ok(())
}

pub(crate) fn remove_owned_if_exists(root: &Path, path: &Path) -> Result<(), String> {
    ensure_lexically_within(root, path)?;
    let Ok(metadata) = fs::symlink_metadata(path) else {
        return Ok(());
    };
    if metadata.file_type().is_symlink() || metadata.is_file() {
        fs::remove_file(path).map_err(|e| format!("清理受管文件失败: {e}"))
    } else if metadata.is_dir() {
        fs::remove_dir_all(path).map_err(|e| format!("清理受管目录失败: {e}"))
    } else {
        Err("拒绝删除特殊文件".to_string())
    }
}

fn lexical_normalize(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                normalized.pop();
            }
            other => normalized.push(other.as_os_str()),
        }
    }
    normalized
}

fn validate_slug(slug: &str) -> Result<(), String> {
    let path = Path::new(slug);
    if slug.is_empty()
        || path.is_absolute()
        || path.components().count() != 1
        || !matches!(path.components().next(), Some(Component::Normal(_)))
    {
        return Err("INVALID_SLUG: slug 必须是单个安全目录名".to_string());
    }
    Ok(())
}

pub(crate) fn calculate_plan_hash<T: Serialize>(plan: &T) -> Result<String, String> {
    let value = serde_json::to_value(plan).map_err(|e| format!("序列化计划失败: {e}"))?;
    let mut object = value
        .as_object()
        .cloned()
        .ok_or_else(|| "计划必须是对象".to_string())?;
    object.remove("planHash");
    object.remove("plan_hash");
    let canonical = serde_json::to_vec(&object).map_err(|e| format!("序列化计划失败: {e}"))?;
    Ok(format!("{:x}", Sha256::digest(canonical)))
}

pub(crate) fn persist_plan<T: Serialize>(
    conn: &Connection,
    operation_type: &str,
    entity_id: &str,
    plan: &T,
    source_hash: &str,
) -> Result<(), String> {
    let value = serde_json::to_value(plan).map_err(|e| format!("序列化计划失败: {e}"))?;
    let id = value
        .get("id")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| "计划缺少 id".to_string())?;
    let plan_hash = value
        .get("planHash")
        .or_else(|| value.get("plan_hash"))
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| "计划缺少 planHash".to_string())?;
    let created_at = value
        .get("createdAt")
        .or_else(|| value.get("created_at"))
        .and_then(serde_json::Value::as_i64)
        .ok_or_else(|| "计划缺少 createdAt".to_string())?;
    let expires_at = value
        .get("expiresAt")
        .or_else(|| value.get("expires_at"))
        .and_then(serde_json::Value::as_i64)
        .ok_or_else(|| "计划缺少 expiresAt".to_string())?;
    conn.execute(
        "INSERT INTO library_operation_plans (
            id, operation_type, entity_id, plan_hash, payload_json, source_hash,
            status, created_at, expires_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'planned', ?7, ?8)",
        rusqlite::params![
            id,
            operation_type,
            entity_id,
            plan_hash,
            serde_json::to_string(plan).map_err(|e| e.to_string())?,
            source_hash,
            created_at,
            expires_at,
        ],
    )
    .map_err(|e| format!("保存操作计划失败: {e}"))?;
    Ok(())
}

pub(crate) fn load_plan<T: DeserializeOwned>(
    conn: &Connection,
    plan_id: &str,
    operation_type: &str,
) -> Result<T, String> {
    let payload: Option<String> = conn
        .query_row(
            "SELECT payload_json FROM library_operation_plans
             WHERE id = ?1 AND operation_type = ?2 AND status = 'planned'",
            rusqlite::params![plan_id, operation_type],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| format!("读取操作计划失败: {e}"))?;
    serde_json::from_str(&payload.ok_or_else(|| "PLAN_NOT_FOUND: 计划不存在或已执行".to_string())?)
        .map_err(|e| format!("解析操作计划失败: {e}"))
}

pub(crate) fn validate_execute_plan(
    expected_hash: &str,
    expires_at: i64,
    input: &ExecutePlanInput,
) -> Result<(), String> {
    if input.plan_hash != expected_hash {
        return Err("PLAN_HASH_MISMATCH: 计划哈希不匹配".to_string());
    }
    if now_ms() > expires_at {
        return Err("PLAN_STALE: 计划已过期，请重新预览".to_string());
    }
    Ok(())
}

pub(crate) fn acquire_locks(
    conn: &Connection,
    operation_id: &str,
    keys: &[String],
) -> Result<(), String> {
    let now = now_ms();
    conn.execute("DELETE FROM operation_locks WHERE expires_at <= ?1", [now])
        .map_err(|e| format!("清理过期操作锁失败: {e}"))?;
    for key in keys {
        if let Err(error) = conn.execute(
            "INSERT INTO operation_locks (resource_key, operation_id, acquired_at, expires_at)
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![key, operation_id, now, now + LOCK_TTL_MS],
        ) {
            release_locks(conn, operation_id);
            return Err(format!(
                "OPERATION_LOCKED: 资源正在被其他操作使用 ({error})"
            ));
        }
    }
    Ok(())
}

pub(crate) fn release_locks(conn: &Connection, operation_id: &str) {
    let _ = conn.execute(
        "DELETE FROM operation_locks WHERE operation_id = ?1",
        [operation_id],
    );
}

pub(crate) fn normalized_lock_path(path: &Path) -> String {
    let value = lexical_normalize(path).to_string_lossy().replace('\\', "/");
    if cfg!(windows) {
        value.to_lowercase()
    } else {
        value
    }
}
