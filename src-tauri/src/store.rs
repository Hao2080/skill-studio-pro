use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

#[path = "store/common.rs"]
mod common;
#[path = "store/description.rs"]
mod description;
#[path = "store/files.rs"]
mod files;
#[path = "store/import.rs"]
mod import;
#[path = "store/organization.rs"]
mod organization;
#[path = "store/platform.rs"]
mod platform;
#[path = "store/project.rs"]
mod project;
#[path = "store/settings.rs"]
mod settings;

use crate::domain::{CreateSkillInput, Skill, SkillSource};
use crate::workspace;
use common::escape_like;
use description::read_skill_description_from_dir;

pub use common::{
    compute_directory_revision, compute_revision, copy_dir_recursive, now_ms, slugify,
};
pub use description::extract_skill_description;
pub use files::{list_skill_files, open_file_in_editor, read_skill_file, write_skill_file};
pub use import::{import_skill, list_market_catalog, list_skill_import_records};
pub use organization::{
    batch_apply_skill_organization, create_skill_collection, delete_skill_collection,
    delete_skill_tag, ensure_skill_tags, get_skill_organization_snapshot, update_skill_collection,
    update_skill_tag,
};
pub use platform::{
    batch_import_platform_skills, create_custom_platform, delete_custom_platform, detect_changes,
    detect_platforms, get_platform_governance_impact, get_skill_platform_releases,
    import_platform_skill, publish_snapshot_to_platforms, remove_skill_from_platforms,
    save_platform_connection, scan_platform_skills, sync_all_to_platforms, sync_skill_to_platforms,
    test_platform_path,
};
pub use project::{
    build_project_sync_plan, create_project, delete_project, delete_project_platform_connection,
    delete_project_skill_assignment, get_project_detail, list_project_platform_connections,
    list_project_skill_assignments, list_project_sync_logs, list_projects, rescan_project,
    save_project_platform_connection, save_project_skill_assignment, sync_project_platform,
    test_project_platform_path, update_project,
};
pub use settings::{get_app_settings, save_app_settings};

/// 获取 skill 源文件存储目录
fn skills_storage_dir<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> PathBuf {
    let _ = app;
    workspace::skills_root().expect("无法获取技能工作区目录")
}

/// 获取 skill 的源文件目录（按 slug 组织）
fn skill_dir<R: tauri::Runtime>(app: &tauri::AppHandle<R>, slug: &str) -> PathBuf {
    skills_storage_dir(app).join(slug)
}

fn hydrate_skill_description<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    conn: &Connection,
    skill: &mut Skill,
) -> Result<(), String> {
    if skill
        .description
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_some()
    {
        return Ok(());
    }

    let description = match read_skill_description_from_dir(&skill_dir(app, &skill.slug)) {
        Some(value) => value,
        None => return Ok(()),
    };

    conn.execute(
        "UPDATE skills SET description = ?1 WHERE id = ?2",
        rusqlite::params![description.as_str(), skill.id.as_str()],
    )
    .map_err(|e| format!("更新 skill 描述失败: {}", e))?;

    skill.description = Some(description);
    Ok(())
}

/// 获取快照存储根目录
fn snapshots_storage_dir<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> PathBuf {
    let _ = app;
    workspace::snapshots_root().expect("无法获取快照工作区目录")
}

/// 获取某个 skill 某个版本的快照目录
pub fn snapshot_dir<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    slug: &str,
    version: i64,
) -> PathBuf {
    snapshots_storage_dir(app)
        .join(slug)
        .join(format!("v{}", version))
}

/// 获取数据库连接
pub fn get_conn<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<Connection, String> {
    let _ = app;
    let db_path = workspace::db_path()?;
    Connection::open(&db_path).map_err(|e| format!("打开数据库失败: {}", e))
}

// ─── Skill CRUD ────────────────────────────────────────────────────────────────

/// 列出所有 skill（未归档优先）
pub fn list_skills<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<Vec<Skill>, String> {
    let conn = get_conn(app)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, slug, description, source_type, source_path, created_at, updated_at, is_archived
             FROM skills
             ORDER BY is_archived ASC, updated_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let mut skills = stmt
        .query_map([], |row| {
            Ok(Skill {
                id: row.get(0)?,
                name: row.get(1)?,
                slug: row.get(2)?,
                description: row.get(3)?,
                source_type: row.get(4)?,
                source_path: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
                is_archived: row.get::<_, i64>(8)? != 0,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    drop(stmt);
    for skill in &mut skills {
        hydrate_skill_description(app, &conn, skill)?;
    }

    Ok(skills)
}

/// 获取单个 skill
pub fn get_skill<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    skill_id: &str,
) -> Result<Skill, String> {
    let conn = get_conn(app)?;
    let mut skill = conn.query_row(
        "SELECT id, name, slug, description, source_type, source_path, created_at, updated_at, is_archived
         FROM skills WHERE id = ?1",
        rusqlite::params![skill_id],
        |row| {
            Ok(Skill {
                id: row.get(0)?,
                name: row.get(1)?,
                slug: row.get(2)?,
                description: row.get(3)?,
                source_type: row.get(4)?,
                source_path: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
                is_archived: row.get::<_, i64>(8)? != 0,
            })
        },
    )
    .map_err(|e| format!("获取 skill 失败: {}", e))?;

    hydrate_skill_description(app, &conn, &mut skill)?;
    Ok(skill)
}

pub fn list_skill_sources<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    skill_id: &str,
) -> Result<Vec<SkillSource>, String> {
    let conn = get_conn(app)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, skill_id, source_type, source_label, source_ref, source_path, metadata_json, is_primary, created_at, updated_at
             FROM skill_sources
             WHERE skill_id = ?1
             ORDER BY is_primary DESC, updated_at DESC, created_at DESC",
        )
        .map_err(|e| format!("准备来源查询失败: {}", e))?;

    let sources = stmt
        .query_map(rusqlite::params![skill_id], |row| {
            Ok(SkillSource {
                id: row.get(0)?,
                skill_id: row.get(1)?,
                source_type: row.get(2)?,
                source_label: row.get(3)?,
                source_ref: row.get(4)?,
                source_path: row.get(5)?,
                metadata_json: row.get(6)?,
                is_primary: row.get::<_, i64>(7)? != 0,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .map_err(|e| format!("查询来源记录失败: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("读取来源记录失败: {}", e))?;

    Ok(sources)
}

pub fn create_skill<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    input: &CreateSkillInput,
) -> Result<Skill, String> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err("skill 名称不能为空".to_string());
    }

    let slug = slugify(name);
    let now = now_ms();
    let id = Uuid::new_v4().to_string();
    let conn = get_conn(app)?;

    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM skills WHERE slug = ?1",
            rusqlite::params![slug],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|e| e.to_string())?
        > 0;

    if exists {
        return Err(format!("slug '{}' 已存在", slug));
    }

    conn.execute(
        "INSERT INTO skills (id, name, slug, description, source_type, source_path, created_at, updated_at, is_archived)
         VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6, ?7, 0)",
        rusqlite::params![
            id,
            name,
            slug,
            input.description.as_deref().map(str::trim).filter(|value| !value.is_empty()),
            "manual",
            now,
            now,
        ],
    )
    .map_err(|e| format!("创建 skill 失败: {}", e))?;

    let target = skill_dir(app, &slug);
    fs::create_dir_all(&target).map_err(|e| format!("创建 skill 目录失败: {}", e))?;

    let entry_file = target.join("skill.md");
    let content = match input
        .description
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        Some(description) => format!("# {}\n\n{}\n", name, description),
        None => format!("# {}\n", name),
    };
    fs::write(&entry_file, content).map_err(|e| format!("写入 skill.md 失败: {}", e))?;

    let skill = Skill {
        id: id.clone(),
        name: name.to_string(),
        slug: slug.clone(),
        description: input
            .description
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string),
        source_type: "manual".to_string(),
        source_path: None,
        created_at: now,
        updated_at: now,
        is_archived: false,
    };

    import::replace_primary_skill_source(
        &conn,
        &skill.id,
        &import::SkillSourceSeed {
            source_type: "manual".to_string(),
            source_label: "手动创建".to_string(),
            source_ref: None,
            source_path: None,
            metadata_json: None,
        },
    )?;

    let baseline_input = crate::domain::CreateSnapshotInput {
        skill_id: id,
        change_summary: Some("初始创建".to_string()),
        source: "manual".to_string(),
    };
    if let Ok(baseline) = crate::snapshot::create_snapshot(app, &baseline_input) {
        let _ = crate::snapshot::set_active_snapshot(app, &baseline.id);
    }

    Ok(skill)
}

fn load_team_submission_ids_by_skill(
    conn: &Connection,
    skill_id: &str,
) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare("SELECT id FROM team_submissions WHERE source_skill_id = ?1")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(rusqlite::params![skill_id], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

fn delete_skill_records(conn: &mut Connection, skill_id: &str) -> Result<Vec<String>, String> {
    let submission_ids = load_team_submission_ids_by_skill(conn, skill_id)?;
    let tx = conn
        .transaction()
        .map_err(|e| format!("开启事务失败: {}", e))?;
    tx.execute(
        "DELETE FROM platform_release_targets WHERE skill_id = ?1",
        rusqlite::params![skill_id],
    )
    .map_err(|e| format!("删除平台承接状态失败: {}", e))?;
    tx.execute(
        "DELETE FROM sync_logs WHERE skill_id = ?1",
        rusqlite::params![skill_id],
    )
    .map_err(|e| format!("删除平台发布记录失败: {}", e))?;
    tx.execute(
        "DELETE FROM team_delivery_targets WHERE source_skill_id = ?1",
        rusqlite::params![skill_id],
    )
    .map_err(|e| format!("删除团队承接状态失败: {}", e))?;
    tx.execute(
        "DELETE FROM team_delivery_logs WHERE source_skill_id = ?1",
        rusqlite::params![skill_id],
    )
    .map_err(|e| format!("删除团队交付记录失败: {}", e))?;
    tx.execute(
        "DELETE FROM team_submissions WHERE source_skill_id = ?1",
        rusqlite::params![skill_id],
    )
    .map_err(|e| format!("删除团队提交记录失败: {}", e))?;
    tx.execute(
        "DELETE FROM skill_tag_relations WHERE skill_id = ?1",
        rusqlite::params![skill_id],
    )
    .map_err(|e| format!("删除技能标签关系失败: {}", e))?;
    tx.execute(
        "DELETE FROM collection_items WHERE skill_id = ?1",
        rusqlite::params![skill_id],
    )
    .map_err(|e| format!("删除技能集合关系失败: {}", e))?;
    tx.execute(
        "DELETE FROM skill_sources WHERE skill_id = ?1",
        rusqlite::params![skill_id],
    )
    .map_err(|e| format!("删除技能来源记录失败: {}", e))?;
    tx.execute(
        "DELETE FROM skill_snapshots WHERE skill_id = ?1",
        rusqlite::params![skill_id],
    )
    .map_err(|e| format!("删除快照记录失败: {}", e))?;
    tx.execute(
        "DELETE FROM skills WHERE id = ?1",
        rusqlite::params![skill_id],
    )
    .map_err(|e| format!("删除 skill 记录失败: {}", e))?;
    tx.commit().map_err(|e| format!("提交事务失败: {}", e))?;

    Ok(submission_ids)
}

/// 删除 skill（包括源文件和所有快照）
pub fn delete_skill<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    skill_id: &str,
) -> Result<(), String> {
    let skill = get_skill(app, skill_id)?;

    let mut conn = get_conn(app)?;
    let submission_ids = delete_skill_records(&mut conn, skill_id)?;

    // 删除源文件目录（容错）
    let skill_target = skill_dir(app, &skill.slug);
    if skill_target.exists() {
        if let Err(e) = fs::remove_dir_all(&skill_target) {
            log_cleanup_warning("删除 skill 源文件失败", &e);
        }
    }

    // 删除关联的快照目录（容错）
    let snapshot_root = snapshots_storage_dir(app).join(&skill.slug);
    if snapshot_root.exists() {
        if let Err(e) = fs::remove_dir_all(&snapshot_root) {
            log_cleanup_warning("删除快照目录失败", &e);
        }
    }
    for submission_id in &submission_ids {
        let staging_dir = workspace::team_staging_root()?.join(submission_id);
        if staging_dir.exists() {
            if let Err(e) = fs::remove_dir_all(&staging_dir) {
                log_cleanup_warning("删除团队暂存目录失败", &e);
            }
        }
    }

    Ok(())
}

/// 搜索 skill（按名称或描述模糊匹配）
pub fn search_skills<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    keyword: &str,
) -> Result<Vec<Skill>, String> {
    let conn = get_conn(app)?;
    let escaped = escape_like(keyword);
    let pattern = format!("%{}%", escaped);
    let mut stmt = conn
        .prepare(
            "SELECT id, name, slug, description, source_type, source_path, created_at, updated_at, is_archived
             FROM skills
             WHERE name LIKE ?1 ESCAPE '\\' OR description LIKE ?1 ESCAPE '\\'
             ORDER BY updated_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let skills = stmt
        .query_map(rusqlite::params![pattern], |row| {
            Ok(Skill {
                id: row.get(0)?,
                name: row.get(1)?,
                slug: row.get(2)?,
                description: row.get(3)?,
                source_type: row.get(4)?,
                source_path: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
                is_archived: row.get::<_, i64>(8)? != 0,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(skills)
}

fn log_cleanup_warning(context: &str, error: &std::io::Error) {
    eprintln!("[cleanup] {}: {}", context, error);
}
