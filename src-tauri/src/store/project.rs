use std::fs;
use std::path::{Component, Path, PathBuf};

use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::Runtime;
use uuid::Uuid;

use crate::domain::{
    CreateProjectInput, DeleteProjectPlatformConnectionInput, ExecuteProjectSyncInput, Project,
    ProjectDetail, ProjectPlatformConnection, ProjectSkillAssignment, ProjectSummary,
    ProjectSyncLog, ProjectSyncPlan, ProjectSyncPlanRecord, ProjectSyncResult,
    SaveProjectPlatformConnectionInput, SaveProjectSkillAssignmentInput, TestPlatformPathResult,
    TestProjectPlatformPathInput, UpdateProjectInput,
};
use crate::workspace;

use super::{compute_directory_revision, copy_dir_recursive, get_conn, now_ms, slugify};

#[derive(Debug, Clone)]
struct SkillLite {
    slug: String,
    is_archived: bool,
}

#[derive(Debug, Clone)]
struct SnapshotLite {
    id: String,
    skill_id: String,
}

#[derive(Debug, Clone)]
struct PlatformLite {
    platform_name: String,
    display_name: String,
    enabled: bool,
    sync_mode: String,
    supports_project_scope: bool,
    supports_copy: bool,
}

#[derive(Debug, Clone)]
struct AssignmentRow {
    id: String,
    project_id: String,
    platform_name: String,
    skill_id: String,
    skill_name: String,
    skill_slug: String,
    skill_archived: bool,
    snapshot_id: String,
    snapshot_number: i64,
    snapshot_path: String,
    snapshot_revision_hash: String,
    snapshot_change_summary: Option<String>,
    target_dir_name: String,
    enabled: bool,
    sort_order: i64,
    runtime_status: String,
    last_synced_snapshot_id: Option<String>,
    last_synced_hash: Option<String>,
    last_checked_at: Option<i64>,
    created_at: i64,
    updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectSkillManifest {
    project_id: String,
    platform_name: String,
    assignment_id: String,
    skill_id: String,
    snapshot_id: String,
    target_dir_name: String,
    revision_hash: String,
    sync_mode: String,
    synced_at: i64,
}

pub fn list_projects<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<Vec<ProjectSummary>, String> {
    let conn = get_conn(app)?;
    let mut stmt = conn
        .prepare(
            "SELECT
                p.id,
                p.name,
                p.root_path,
                p.description,
                p.status,
                p.last_scanned_at,
                p.created_at,
                p.updated_at,
                (SELECT COUNT(*) FROM project_platform_connections pc WHERE pc.project_id = p.id),
                (SELECT COUNT(*) FROM project_skill_assignments pa WHERE pa.project_id = p.id),
                (SELECT COUNT(*) FROM project_skill_assignments pa
                 WHERE pa.project_id = p.id
                   AND pa.runtime_status IN ('project_changed', 'target_missing', 'missing_snapshot', 'skill_archived')),
                (SELECT MAX(created_at) FROM project_sync_logs pl WHERE pl.project_id = p.id),
                (SELECT status FROM project_sync_logs pl
                 WHERE pl.project_id = p.id
                 ORDER BY created_at DESC
                 LIMIT 1)
             FROM projects p
             ORDER BY p.updated_at DESC",
        )
        .map_err(|e| format!("准备项目列表查询失败: {}", e))?;

    let projects = stmt
        .query_map([], |row| {
            Ok(ProjectSummary {
                id: row.get(0)?,
                name: row.get(1)?,
                root_path: row.get(2)?,
                description: row.get(3)?,
                status: row.get(4)?,
                last_scanned_at: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
                platform_count: row.get(8)?,
                assignment_count: row.get(9)?,
                drift_count: row.get(10)?,
                last_sync_at: row.get(11)?,
                last_sync_status: row.get(12)?,
            })
        })
        .map_err(|e| format!("查询项目列表失败: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("读取项目列表失败: {}", e))?;
    Ok(projects)
}

pub fn get_project_detail<R: Runtime>(
    app: &tauri::AppHandle<R>,
    project_id: &str,
) -> Result<ProjectDetail, String> {
    Ok(ProjectDetail {
        project: load_project(&get_conn(app)?, project_id)?,
        platforms: list_project_platform_connections(app, project_id)?,
        assignments: list_project_skill_assignments(app, project_id, None)?,
        recent_logs: list_project_sync_logs(app, project_id, 20)?,
    })
}

pub fn rescan_project<R: Runtime>(
    app: &tauri::AppHandle<R>,
    project_id: &str,
) -> Result<ProjectDetail, String> {
    let conn = get_conn(app)?;
    let project = load_project(&conn, project_id)?;
    let now = now_ms();
    let project_status = project_status(&project.root_path);

    conn.execute(
        "UPDATE projects
         SET status = ?1, last_scanned_at = ?2, updated_at = ?3
         WHERE id = ?4",
        rusqlite::params![project_status, now, now, project_id],
    )
    .map_err(|e| format!("刷新项目状态失败: {}", e))?;

    let platforms = list_project_platform_connections(app, project_id)?;
    for platform in platforms {
        let platform_status = project_platform_status(&project.root_path, &platform.skills_dir);
        conn.execute(
            "UPDATE project_platform_connections
             SET status = ?1, last_error_message = NULL, updated_at = ?2
             WHERE project_id = ?3 AND platform_name = ?4",
            rusqlite::params![platform_status, now, project_id, platform.platform_name],
        )
        .map_err(|e| format!("刷新项目平台状态失败: {}", e))?;

        let assignments = load_assignment_rows(&conn, project_id, Some(&platform.platform_name))?;
        for assignment in assignments {
            let record = build_sync_plan_record(&platform, &assignment);
            let runtime_status = runtime_status_from_plan(&platform, &assignment, &record);
            update_assignment_checked_status(&conn, &assignment.id, &runtime_status, now)?;
        }
    }

    get_project_detail(app, project_id)
}

pub fn create_project<R: Runtime>(
    app: &tauri::AppHandle<R>,
    input: &CreateProjectInput,
) -> Result<Project, String> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err("项目名称不能为空".to_string());
    }

    let root_path = normalize_absolute_path(&input.root_path)?;
    let status = project_status(&root_path);
    let now = now_ms();
    let id = Uuid::new_v4().to_string();
    let conn = get_conn(app)?;

    conn.execute(
        "INSERT INTO projects (id, name, root_path, description, status, last_scanned_at, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6, ?7)",
        rusqlite::params![
            id,
            name,
            root_path,
            optional_trimmed(input.description.as_deref()),
            status,
            now,
            now
        ],
    )
    .map_err(|e| format!("创建项目失败: {}", e))?;

    let project = load_project(&conn, &id)?;
    workspace::ensure_project_workspace(&project)?;
    Ok(project)
}

pub fn update_project<R: Runtime>(
    app: &tauri::AppHandle<R>,
    input: &UpdateProjectInput,
) -> Result<Project, String> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err("项目名称不能为空".to_string());
    }

    let root_path = normalize_absolute_path(&input.root_path)?;
    let status = project_status(&root_path);
    let now = now_ms();
    let conn = get_conn(app)?;
    conn.execute(
        "UPDATE projects
         SET name = ?1, root_path = ?2, description = ?3, status = ?4, updated_at = ?5
         WHERE id = ?6",
        rusqlite::params![
            name,
            root_path,
            optional_trimmed(input.description.as_deref()),
            status,
            now,
            input.project_id
        ],
    )
    .map_err(|e| format!("更新项目失败: {}", e))?;

    let project = load_project(&conn, &input.project_id)?;
    workspace::ensure_project_workspace(&project)?;
    Ok(project)
}

pub fn delete_project<R: Runtime>(
    app: &tauri::AppHandle<R>,
    project_id: &str,
) -> Result<(), String> {
    let conn = get_conn(app)?;
    let project = load_project(&conn, project_id)?;
    conn.execute_batch("BEGIN;")
        .map_err(|e| format!("开启项目删除事务失败: {}", e))?;
    let result = (|| -> Result<(), String> {
        conn.execute(
            "DELETE FROM project_sync_logs WHERE project_id = ?1",
            rusqlite::params![project_id],
        )
        .map_err(|e| format!("删除项目同步日志失败: {}", e))?;
        conn.execute(
            "DELETE FROM project_skill_assignments WHERE project_id = ?1",
            rusqlite::params![project_id],
        )
        .map_err(|e| format!("删除项目绑定失败: {}", e))?;
        conn.execute(
            "DELETE FROM project_platform_connections WHERE project_id = ?1",
            rusqlite::params![project_id],
        )
        .map_err(|e| format!("删除项目平台连接失败: {}", e))?;
        conn.execute(
            "DELETE FROM projects WHERE id = ?1",
            rusqlite::params![project_id],
        )
        .map_err(|e| format!("删除项目失败: {}", e))?;
        Ok(())
    })();

    match result {
        Ok(()) => {
            conn.execute_batch("COMMIT;")
                .map_err(|e| format!("提交项目删除事务失败: {}", e))?;
            workspace::remove_project_workspace(&project.id)?;
            Ok(())
        }
        Err(error) => {
            let _ = conn.execute_batch("ROLLBACK;");
            Err(error)
        }
    }
}

pub fn list_project_platform_connections<R: Runtime>(
    app: &tauri::AppHandle<R>,
    project_id: &str,
) -> Result<Vec<ProjectPlatformConnection>, String> {
    let conn = get_conn(app)?;
    let mut stmt = conn
        .prepare(
            "SELECT pc.id, pc.project_id, pc.platform_name, p.display_name, pc.path_mode,
                    pc.relative_skills_dir, pc.skills_dir, pc.disabled_dir, pc.sync_mode,
                    pc.enabled, pc.status, pc.last_sync_at, pc.last_sync_status,
                    pc.last_error_message, pc.created_at, pc.updated_at
             FROM project_platform_connections pc
             LEFT JOIN platform_connections p ON p.platform_name = pc.platform_name
             WHERE pc.project_id = ?1
             ORDER BY p.display_name COLLATE NOCASE ASC, pc.platform_name COLLATE NOCASE ASC",
        )
        .map_err(|e| format!("准备项目平台连接查询失败: {}", e))?;

    let connections = stmt
        .query_map(
            rusqlite::params![project_id],
            map_project_platform_connection,
        )
        .map_err(|e| format!("查询项目平台连接失败: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("读取项目平台连接失败: {}", e))?;
    Ok(connections)
}

pub fn save_project_platform_connection<R: Runtime>(
    app: &tauri::AppHandle<R>,
    input: &SaveProjectPlatformConnectionInput,
) -> Result<ProjectPlatformConnection, String> {
    let mut conn = get_conn(app)?;
    let project = load_project(&conn, &input.project_id)?;
    let platform = load_platform(app, &conn, &input.platform_name)?;
    if !platform.supports_project_scope {
        return Err(format!("平台 {} 不支持项目级目录", platform.display_name));
    }
    let existing_connection =
        load_project_platform_connection_optional(&conn, &input.project_id, &input.platform_name)?;

    let sync_mode = normalize_sync_mode(input.sync_mode.as_deref(), &platform)?;
    let path_mode = input
        .path_mode
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("derived");
    let (relative_skills_dir, skills_dir) =
        resolve_project_skills_dir(&project, &platform, path_mode, input)?;
    let status = if Path::new(&project.root_path).is_dir() {
        "ready"
    } else {
        "blocked"
    };
    let enabled = input.enabled.unwrap_or(true);
    let now = now_ms();
    let id = existing_connection
        .as_ref()
        .map(|connection| connection.id.clone())
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    let previous_enabled = existing_connection
        .as_ref()
        .map(|connection| connection.enabled)
        .unwrap_or(false);

    let tx = conn
        .transaction()
        .map_err(|e| format!("开启项目平台保存事务失败: {}", e))?;

    tx.execute(
        "INSERT INTO project_platform_connections (
            id, project_id, platform_name, path_mode, relative_skills_dir, skills_dir,
            disabled_dir, sync_mode, enabled, status, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, ?7, ?8, ?9, ?10, ?11)
         ON CONFLICT(project_id, platform_name) DO UPDATE SET
            path_mode = excluded.path_mode,
            relative_skills_dir = excluded.relative_skills_dir,
            skills_dir = excluded.skills_dir,
            sync_mode = excluded.sync_mode,
            enabled = excluded.enabled,
            status = excluded.status,
            updated_at = excluded.updated_at,
            last_error_message = NULL",
        rusqlite::params![
            id,
            input.project_id,
            input.platform_name,
            path_mode,
            relative_skills_dir,
            skills_dir,
            sync_mode,
            enabled as i64,
            status,
            now,
            now
        ],
    )
    .map_err(|e| format!("保存项目平台连接失败: {}", e))?;

    let saved_connection =
        load_project_platform_connection(&tx, &input.project_id, &input.platform_name)?;
    let assignments = load_assignment_rows(&tx, &input.project_id, Some(&input.platform_name))?;

    if previous_enabled && !enabled {
        if let Some(previous_connection) = existing_connection.as_ref() {
            park_assignments_for_platform(
                &tx,
                previous_connection,
                &assignments,
                "项目平台已停用，已撤下绑定副本",
            )?;
        }
    } else if !previous_enabled && enabled {
        if platform.enabled {
            restore_assignments_for_platform(
                &tx,
                &saved_connection,
                &assignments,
                "项目平台重新启用，已恢复绑定副本",
            )?;
        } else {
            for assignment in &assignments {
                let runtime_status = if assignment.enabled {
                    "pending_sync"
                } else {
                    "disabled"
                };
                update_assignment_runtime_status(&tx, &assignment.id, runtime_status, None, None)?;
            }
        }
    } else if !enabled {
        for assignment in &assignments {
            let runtime_status = if assignment.enabled {
                "pending_sync"
            } else {
                "disabled"
            };
            update_assignment_runtime_status(&tx, &assignment.id, runtime_status, None, None)?;
        }
    }

    tx.commit()
        .map_err(|e| format!("提交项目平台保存事务失败: {}", e))?;

    load_project_platform_connection(&conn, &input.project_id, &input.platform_name)
}

pub fn delete_project_platform_connection<R: Runtime>(
    app: &tauri::AppHandle<R>,
    input: &DeleteProjectPlatformConnectionInput,
) -> Result<(), String> {
    let mut conn = get_conn(app)?;
    let platform =
        load_project_platform_connection(&conn, &input.project_id, &input.platform_name)?;
    let assignments = load_assignment_rows(&conn, &input.project_id, Some(&input.platform_name))?;
    for assignment in &assignments {
        remove_assignment_managed_copy(&platform, assignment)?;
    }

    let tx = conn
        .transaction()
        .map_err(|e| format!("开启项目平台删除事务失败: {}", e))?;
    tx.execute(
        "DELETE FROM project_skill_assignments WHERE project_id = ?1 AND platform_name = ?2",
        rusqlite::params![input.project_id, input.platform_name],
    )
    .map_err(|e| format!("删除项目平台绑定失败: {}", e))?;
    tx.execute(
        "DELETE FROM project_platform_connections WHERE project_id = ?1 AND platform_name = ?2",
        rusqlite::params![input.project_id, input.platform_name],
    )
    .map_err(|e| format!("删除项目平台连接失败: {}", e))?;
    tx.commit()
        .map_err(|e| format!("提交项目平台删除事务失败: {}", e))
}

pub fn test_project_platform_path<R: Runtime>(
    app: &tauri::AppHandle<R>,
    input: &TestProjectPlatformPathInput,
) -> Result<TestPlatformPathResult, String> {
    let conn = get_conn(app)?;
    let project = load_project(&conn, &input.project_id)?;
    let platform = load_platform(app, &conn, &input.platform_name)?;
    let save_input = SaveProjectPlatformConnectionInput {
        project_id: input.project_id.clone(),
        platform_name: input.platform_name.clone(),
        path_mode: input.path_mode.clone(),
        relative_skills_dir: input.relative_skills_dir.clone(),
        skills_dir: input.skills_dir.clone(),
        sync_mode: None,
        enabled: Some(true),
    };
    let (_, normalized_path) = resolve_project_skills_dir(
        &project,
        &platform,
        input.path_mode.as_deref().unwrap_or("derived"),
        &save_input,
    )?;
    let path = Path::new(&normalized_path);
    let exists = path.exists();
    let is_directory = path.is_dir();
    let ok = if exists {
        is_directory
    } else {
        path.parent().map(Path::exists).unwrap_or(false)
    };

    Ok(TestPlatformPathResult {
        ok,
        normalized_path,
        exists,
        is_directory,
        message: if ok {
            "目录检查通过".to_string()
        } else {
            "目录不存在，且父目录不可用".to_string()
        },
    })
}

pub fn list_project_skill_assignments<R: Runtime>(
    app: &tauri::AppHandle<R>,
    project_id: &str,
    platform_name: Option<&str>,
) -> Result<Vec<ProjectSkillAssignment>, String> {
    let conn = get_conn(app)?;
    let rows = load_assignment_rows(&conn, project_id, platform_name)?;
    Ok(rows.into_iter().map(to_project_skill_assignment).collect())
}

pub fn save_project_skill_assignment<R: Runtime>(
    app: &tauri::AppHandle<R>,
    input: &SaveProjectSkillAssignmentInput,
) -> Result<ProjectSkillAssignment, String> {
    let mut conn = get_conn(app)?;
    let connection =
        load_project_platform_connection(&conn, &input.project_id, &input.platform_name)?;
    let platform = load_platform(app, &conn, &input.platform_name)?;
    let skill = load_skill(&conn, &input.skill_id)?;
    if skill.is_archived {
        return Err("已归档 skill 不能绑定到项目区".to_string());
    }

    let snapshot = match input.snapshot_id.as_deref() {
        Some(snapshot_id) if !snapshot_id.trim().is_empty() => {
            load_snapshot(&conn, snapshot_id, Some(&input.skill_id))?
        }
        _ => load_default_snapshot(&conn, &input.skill_id)?,
    };

    let target_dir_name = input
        .target_dir_name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| skill.slug.clone());
    validate_target_dir_name(&target_dir_name)?;

    let existing_id = conn
        .query_row(
            "SELECT id FROM project_skill_assignments
             WHERE project_id = ?1 AND platform_name = ?2 AND skill_id = ?3",
            rusqlite::params![input.project_id, input.platform_name, input.skill_id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|e| format!("读取项目绑定失败: {}", e))?;

    let conflict: Option<String> = conn
        .query_row(
            "SELECT id FROM project_skill_assignments
             WHERE project_id = ?1 AND platform_name = ?2 AND target_dir_name = ?3
               AND (?4 IS NULL OR id <> ?4)",
            rusqlite::params![
                input.project_id,
                input.platform_name,
                target_dir_name,
                existing_id.as_deref()
            ],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| format!("检查项目目录名冲突失败: {}", e))?;
    if conflict.is_some() {
        return Err(format!(
            "目标目录名 {} 已被当前项目平台使用",
            target_dir_name
        ));
    }

    let next_sort_order: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) + 1
             FROM project_skill_assignments
             WHERE project_id = ?1 AND platform_name = ?2",
            rusqlite::params![input.project_id, input.platform_name],
            |row| row.get(0),
        )
        .map_err(|e| format!("计算项目绑定顺序失败: {}", e))?;
    let now = now_ms();
    let id = existing_id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let enabled = input.enabled.unwrap_or(true);
    let existing_row = load_assignment_rows(&conn, &input.project_id, Some(&input.platform_name))?
        .into_iter()
        .find(|row| row.id == id);
    let previous_enabled = existing_row
        .as_ref()
        .map(|row| row.enabled)
        .unwrap_or(false);

    let tx = conn
        .transaction()
        .map_err(|e| format!("开启项目绑定保存事务失败: {}", e))?;
    tx.execute(
        "INSERT INTO project_skill_assignments (
            id, project_id, platform_name, skill_id, snapshot_id, target_dir_name,
            enabled, sort_order, runtime_status, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'pending_sync', ?9, ?10)
         ON CONFLICT(project_id, platform_name, skill_id) DO UPDATE SET
            snapshot_id = excluded.snapshot_id,
            target_dir_name = excluded.target_dir_name,
            enabled = excluded.enabled,
            runtime_status = 'pending_sync',
            updated_at = excluded.updated_at",
        rusqlite::params![
            id,
            input.project_id,
            input.platform_name,
            input.skill_id,
            snapshot.id,
            target_dir_name,
            enabled as i64,
            next_sort_order,
            now,
            now
        ],
    )
    .map_err(|e| format!("保存项目 skill 绑定失败: {}", e))?;

    let saved_row = load_assignment_rows(&tx, &input.project_id, Some(&input.platform_name))?
        .into_iter()
        .find(|row| row.id == id)
        .ok_or_else(|| "保存后读取项目 skill 绑定失败".to_string())?;

    if previous_enabled && !enabled {
        if let Some(previous_row) = existing_row.as_ref() {
            park_assignment_target(&connection, previous_row)?;
        }
        update_assignment_runtime_status(&tx, &saved_row.id, "disabled", None, None)?;
        insert_sync_log(
            &tx,
            &saved_row.project_id,
            &saved_row.platform_name,
            Some(&saved_row.skill_id),
            Some(&saved_row.snapshot_id),
            "park",
            "success",
            Some("绑定已停用，已撤下副本"),
            None,
        )?;
    } else if !previous_enabled && enabled {
        if connection.enabled && platform.enabled {
            restore_assignment_target(&connection, &saved_row)?;
            update_assignment_runtime_status(
                &tx,
                &saved_row.id,
                "in_sync",
                Some(&saved_row.snapshot_id),
                Some(&saved_row.snapshot_revision_hash),
            )?;
            insert_sync_log(
                &tx,
                &saved_row.project_id,
                &saved_row.platform_name,
                Some(&saved_row.skill_id),
                Some(&saved_row.snapshot_id),
                "restore",
                "success",
                Some("绑定已启用，已恢复副本"),
                None,
            )?;
        } else {
            update_assignment_runtime_status(&tx, &saved_row.id, "pending_sync", None, None)?;
        }
    } else if !enabled {
        update_assignment_runtime_status(&tx, &saved_row.id, "disabled", None, None)?;
    }

    tx.commit()
        .map_err(|e| format!("提交项目绑定保存事务失败: {}", e))?;

    load_assignment_rows(&conn, &input.project_id, Some(&input.platform_name))?
        .into_iter()
        .find(|row| row.id == id)
        .map(to_project_skill_assignment)
        .ok_or_else(|| "保存后读取项目 skill 绑定失败".to_string())
}

pub fn delete_project_skill_assignment<R: Runtime>(
    app: &tauri::AppHandle<R>,
    assignment_id: &str,
) -> Result<(), String> {
    let mut conn = get_conn(app)?;
    let assignment = conn
        .query_row(
            "SELECT project_id, platform_name FROM project_skill_assignments WHERE id = ?1",
            rusqlite::params![assignment_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        )
        .map_err(|_| format!("项目绑定不存在: {}", assignment_id))?;
    let platform = load_project_platform_connection(&conn, &assignment.0, &assignment.1)?;
    let assignment_row = load_assignment_rows(&conn, &assignment.0, Some(&assignment.1))?
        .into_iter()
        .find(|row| row.id == assignment_id)
        .ok_or_else(|| format!("项目绑定不存在: {}", assignment_id))?;
    remove_assignment_managed_copy(&platform, &assignment_row)?;

    let tx = conn
        .transaction()
        .map_err(|e| format!("开启项目绑定删除事务失败: {}", e))?;
    tx.execute(
        "DELETE FROM project_skill_assignments WHERE id = ?1",
        rusqlite::params![assignment_id],
    )
    .map_err(|e| format!("删除项目 skill 绑定失败: {}", e))?;
    tx.commit()
        .map_err(|e| format!("提交项目绑定删除事务失败: {}", e))?;
    Ok(())
}

pub fn build_project_sync_plan<R: Runtime>(
    app: &tauri::AppHandle<R>,
    project_id: &str,
    platform_name: &str,
) -> Result<ProjectSyncPlan, String> {
    let conn = get_conn(app)?;
    let platform = load_project_platform_connection(&conn, project_id, platform_name)?;
    let assignments = load_assignment_rows(&conn, project_id, Some(platform_name))?;
    let mut records = Vec::new();

    if let Some(reason) = sync_block_reason(app, &conn, &platform)? {
        return Ok(blocking_sync_plan(
            project_id,
            platform_name,
            assignments,
            reason,
        ));
    }

    for assignment in assignments {
        records.push(build_sync_plan_record(&platform, &assignment));
    }

    let status = if records.iter().any(|record| record.status == "blocked") {
        "blocked"
    } else {
        "ready"
    };

    Ok(ProjectSyncPlan {
        project_id: project_id.to_string(),
        platform_name: platform_name.to_string(),
        status: status.to_string(),
        records,
    })
}

pub fn sync_project_platform<R: Runtime>(
    app: &tauri::AppHandle<R>,
    input: &ExecuteProjectSyncInput,
) -> Result<ProjectSyncResult, String> {
    let project_id = input.project_id.as_str();
    let platform_name = input.platform_name.as_str();
    let conn = get_conn(app)?;
    let platform = load_project_platform_connection(&conn, project_id, platform_name)?;
    let assignments = load_assignment_rows(&conn, project_id, Some(platform_name))?;
    if let Some(reason) = sync_block_reason(app, &conn, &platform)? {
        let records = assignments
            .into_iter()
            .map(|assignment| blocked_record(assignment, &reason))
            .collect::<Vec<_>>();
        return Ok(ProjectSyncResult {
            project_id: project_id.to_string(),
            platform_name: platform_name.to_string(),
            status: "failed".to_string(),
            synced_count: 0,
            skipped_count: 0,
            failed_count: records.len() as i64,
            records,
        });
    }
    let mut records = Vec::new();
    let mut synced_count = 0;
    let mut skipped_count = 0;
    let mut failed_count = 0;
    let confirmed_assignment_ids = input
        .confirmed_assignment_ids
        .iter()
        .map(String::as_str)
        .collect::<std::collections::HashSet<_>>();

    fs::create_dir_all(&platform.skills_dir).map_err(|e| format!("创建项目平台目录失败: {}", e))?;

    for assignment in assignments {
        let mut record = build_sync_plan_record(&platform, &assignment);
        if record.requires_user_confirmation
            && !confirmed_assignment_ids.contains(record.assignment_id.as_str())
        {
            skipped_count += 1;
            record.status = "skipped".to_string();
            record.detail_message = Some("未确认接管，本次保持现状".to_string());
            insert_sync_log(
                &conn,
                project_id,
                platform_name,
                Some(&assignment.skill_id),
                Some(&assignment.snapshot_id),
                "confirmation_pending",
                "skipped",
                record.detail_message.as_deref(),
                None,
            )?;
            records.push(record);
            continue;
        }

        if record.status == "blocked" && !record.requires_user_confirmation {
            failed_count += 1;
            insert_sync_log(
                &conn,
                project_id,
                platform_name,
                Some(&assignment.skill_id),
                Some(&assignment.snapshot_id),
                &record.planned_action,
                "blocked",
                record.detail_message.as_deref(),
                record.blocking_reason.as_deref(),
            )?;
            update_assignment_runtime_status(&conn, &assignment.id, "project_changed", None, None)?;
            records.push(record);
            continue;
        }

        match record.planned_action.as_str() {
            "noop" => {
                skipped_count += 1;
                record.status = "success".to_string();
                update_assignment_runtime_status(
                    &conn,
                    &assignment.id,
                    if manifest_path(
                        &assignment.project_id,
                        &platform.platform_name,
                        &assignment.target_dir_name,
                    )?
                    .exists()
                    {
                        "in_sync"
                    } else {
                        "in_sync_unverified"
                    },
                    Some(&assignment.snapshot_id),
                    Some(&assignment.snapshot_revision_hash),
                )?;
                insert_sync_log(
                    &conn,
                    project_id,
                    platform_name,
                    Some(&assignment.skill_id),
                    Some(&assignment.snapshot_id),
                    "noop",
                    "success",
                    Some("目标目录内容已和绑定版本一致"),
                    None,
                )?;
            }
            "park_managed" => match park_assignment_target(&platform, &assignment) {
                Ok(_) => {
                    synced_count += 1;
                    record.status = "success".to_string();
                    update_assignment_runtime_status(
                        &conn,
                        &assignment.id,
                        "disabled",
                        None,
                        None,
                    )?;
                    insert_sync_log(
                        &conn,
                        project_id,
                        platform_name,
                        Some(&assignment.skill_id),
                        Some(&assignment.snapshot_id),
                        "park",
                        "success",
                        Some("已撤下停用绑定的托管目录"),
                        None,
                    )?;
                }
                Err(error) => {
                    failed_count += 1;
                    record.status = "failed".to_string();
                    record.blocking_reason = Some(error.clone());
                    insert_sync_log(
                        &conn,
                        project_id,
                        platform_name,
                        Some(&assignment.skill_id),
                        Some(&assignment.snapshot_id),
                        "park",
                        "failed",
                        None,
                        Some(&error),
                    )?;
                }
            },
            "copy_create" | "copy_replace_owned" | "copy_replace_confirmed" => {
                match execute_copy_sync(&platform, &assignment) {
                    Ok(()) => {
                        synced_count += 1;
                        record.status = "success".to_string();
                        update_assignment_runtime_status(
                            &conn,
                            &assignment.id,
                            "in_sync",
                            Some(&assignment.snapshot_id),
                            Some(&assignment.snapshot_revision_hash),
                        )?;
                        insert_sync_log(
                            &conn,
                            project_id,
                            platform_name,
                            Some(&assignment.skill_id),
                            Some(&assignment.snapshot_id),
                            &record.planned_action,
                            "success",
                            Some("已将绑定版本落地到项目平台目录"),
                            None,
                        )?;
                    }
                    Err(error) => {
                        failed_count += 1;
                        record.status = "failed".to_string();
                        record.blocking_reason = Some(error.clone());
                        update_assignment_runtime_status(
                            &conn,
                            &assignment.id,
                            "project_changed",
                            None,
                            None,
                        )?;
                        insert_sync_log(
                            &conn,
                            project_id,
                            platform_name,
                            Some(&assignment.skill_id),
                            Some(&assignment.snapshot_id),
                            &record.planned_action,
                            "failed",
                            None,
                            Some(&error),
                        )?;
                    }
                }
            }
            _ => {
                failed_count += 1;
                record.status = "blocked".to_string();
            }
        }
        records.push(record);
    }

    let status = if failed_count > 0 && synced_count > 0 {
        "partial_success"
    } else if failed_count > 0 {
        "failed"
    } else {
        "success"
    };
    let now = now_ms();
    conn.execute(
        "UPDATE project_platform_connections
         SET last_sync_at = ?1, last_sync_status = ?2, last_error_message = NULL, status = 'ready', updated_at = ?3
         WHERE project_id = ?4 AND platform_name = ?5",
        rusqlite::params![now, status, now, project_id, platform_name],
    )
    .map_err(|e| format!("更新项目平台同步状态失败: {}", e))?;

    Ok(ProjectSyncResult {
        project_id: project_id.to_string(),
        platform_name: platform_name.to_string(),
        status: status.to_string(),
        synced_count,
        skipped_count,
        failed_count,
        records,
    })
}

fn blocking_sync_plan(
    project_id: &str,
    platform_name: &str,
    assignments: Vec<AssignmentRow>,
    reason: String,
) -> ProjectSyncPlan {
    ProjectSyncPlan {
        project_id: project_id.to_string(),
        platform_name: platform_name.to_string(),
        status: "blocked".to_string(),
        records: assignments
            .into_iter()
            .map(|assignment| blocked_record(assignment, &reason))
            .collect(),
    }
}

fn sync_block_reason<R: Runtime>(
    app: &tauri::AppHandle<R>,
    conn: &Connection,
    platform: &ProjectPlatformConnection,
) -> Result<Option<String>, String> {
    if !platform.enabled {
        return Ok(Some("项目平台连接已停用".to_string()));
    }

    let registry_platform = match load_platform(app, conn, &platform.platform_name) {
        Ok(value) => value,
        Err(_) => return Ok(Some("平台中心缺失，当前平台不可同步".to_string())),
    };

    if !registry_platform.enabled {
        return Ok(Some("平台中心已停用，当前平台不可同步".to_string()));
    }
    if !registry_platform.supports_project_scope {
        return Ok(Some(
            "平台中心未启用项目区支持，当前平台不可同步".to_string(),
        ));
    }

    Ok(None)
}

pub fn list_project_sync_logs<R: Runtime>(
    app: &tauri::AppHandle<R>,
    project_id: &str,
    limit: i64,
) -> Result<Vec<ProjectSyncLog>, String> {
    let conn = get_conn(app)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, platform_name, skill_id, snapshot_id, action, status,
                    detail_message, error_message, created_at
             FROM project_sync_logs
             WHERE project_id = ?1
             ORDER BY created_at DESC
             LIMIT ?2",
        )
        .map_err(|e| format!("准备项目同步日志查询失败: {}", e))?;

    let logs = stmt
        .query_map(rusqlite::params![project_id, limit], |row| {
            Ok(ProjectSyncLog {
                id: row.get(0)?,
                project_id: row.get(1)?,
                platform_name: row.get(2)?,
                skill_id: row.get(3)?,
                snapshot_id: row.get(4)?,
                action: row.get(5)?,
                status: row.get(6)?,
                detail_message: row.get(7)?,
                error_message: row.get(8)?,
                created_at: row.get(9)?,
            })
        })
        .map_err(|e| format!("查询项目同步日志失败: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("读取项目同步日志失败: {}", e))?;
    Ok(logs)
}

fn load_project(conn: &Connection, project_id: &str) -> Result<Project, String> {
    conn.query_row(
        "SELECT id, name, root_path, description, status, last_scanned_at, created_at, updated_at
         FROM projects WHERE id = ?1",
        rusqlite::params![project_id],
        |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                root_path: row.get(2)?,
                description: row.get(3)?,
                status: row.get(4)?,
                last_scanned_at: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        },
    )
    .map_err(|_| format!("项目不存在: {}", project_id))
}

fn load_project_platform_connection(
    conn: &Connection,
    project_id: &str,
    platform_name: &str,
) -> Result<ProjectPlatformConnection, String> {
    conn.query_row(
        "SELECT pc.id, pc.project_id, pc.platform_name, p.display_name, pc.path_mode,
                pc.relative_skills_dir, pc.skills_dir, pc.disabled_dir, pc.sync_mode,
                pc.enabled, pc.status, pc.last_sync_at, pc.last_sync_status,
                pc.last_error_message, pc.created_at, pc.updated_at
         FROM project_platform_connections pc
         LEFT JOIN platform_connections p ON p.platform_name = pc.platform_name
         WHERE pc.project_id = ?1 AND pc.platform_name = ?2",
        rusqlite::params![project_id, platform_name],
        map_project_platform_connection,
    )
    .map_err(|_| format!("项目平台连接不存在: {}", platform_name))
}

fn load_project_platform_connection_optional(
    conn: &Connection,
    project_id: &str,
    platform_name: &str,
) -> Result<Option<ProjectPlatformConnection>, String> {
    conn.query_row(
        "SELECT pc.id, pc.project_id, pc.platform_name, p.display_name, pc.path_mode,
                pc.relative_skills_dir, pc.skills_dir, pc.disabled_dir, pc.sync_mode,
                pc.enabled, pc.status, pc.last_sync_at, pc.last_sync_status,
                pc.last_error_message, pc.created_at, pc.updated_at
         FROM project_platform_connections pc
         LEFT JOIN platform_connections p ON p.platform_name = pc.platform_name
         WHERE pc.project_id = ?1 AND pc.platform_name = ?2",
        rusqlite::params![project_id, platform_name],
        map_project_platform_connection,
    )
    .optional()
    .map_err(|e| format!("读取项目平台连接失败: {}", e))
}

fn load_project_platform_connections_by_platform(
    conn: &Connection,
    platform_name: &str,
) -> Result<Vec<ProjectPlatformConnection>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT pc.id, pc.project_id, pc.platform_name, p.display_name, pc.path_mode,
                    pc.relative_skills_dir, pc.skills_dir, pc.disabled_dir, pc.sync_mode,
                    pc.enabled, pc.status, pc.last_sync_at, pc.last_sync_status,
                    pc.last_error_message, pc.created_at, pc.updated_at
             FROM project_platform_connections pc
             LEFT JOIN platform_connections p ON p.platform_name = pc.platform_name
             WHERE pc.platform_name = ?1
             ORDER BY pc.project_id ASC",
        )
        .map_err(|e| format!("准备平台项目连接查询失败: {}", e))?;

    let rows = stmt
        .query_map(
            rusqlite::params![platform_name],
            map_project_platform_connection,
        )
        .map_err(|e| format!("查询平台项目连接失败: {}", e))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("读取平台项目连接失败: {}", e))
}

fn map_project_platform_connection(
    row: &rusqlite::Row,
) -> rusqlite::Result<ProjectPlatformConnection> {
    Ok(ProjectPlatformConnection {
        id: row.get(0)?,
        project_id: row.get(1)?,
        platform_name: row.get(2)?,
        display_name: row.get(3)?,
        path_mode: row.get(4)?,
        relative_skills_dir: row.get(5)?,
        skills_dir: row.get(6)?,
        disabled_dir: row.get(7)?,
        sync_mode: row.get(8)?,
        enabled: row.get::<_, i64>(9)? != 0,
        status: row.get(10)?,
        last_sync_at: row.get(11)?,
        last_sync_status: row.get(12)?,
        last_error_message: row.get(13)?,
        created_at: row.get(14)?,
        updated_at: row.get(15)?,
    })
}

fn load_platform<R: Runtime>(
    app: &tauri::AppHandle<R>,
    conn: &Connection,
    platform_name: &str,
) -> Result<PlatformLite, String> {
    let row = load_platform_from_db(conn, platform_name)?;
    if let Some(row) = row {
        return Ok(row);
    }

    let _ = super::platform::detect_platforms(app)?;
    load_platform_from_db(conn, platform_name)?
        .ok_or_else(|| format!("平台不存在: {}", platform_name))
}

fn load_platform_from_db(
    conn: &Connection,
    platform_name: &str,
) -> Result<Option<PlatformLite>, String> {
    conn.query_row(
        "SELECT platform_name, display_name, enabled, sync_mode, supports_project_scope,
                supports_copy
         FROM platform_connections
         WHERE platform_name = ?1",
        rusqlite::params![platform_name],
        |row| {
            Ok(PlatformLite {
                platform_name: row.get(0)?,
                display_name: row.get(1)?,
                enabled: row.get::<_, i64>(2)? != 0,
                sync_mode: row.get(3)?,
                supports_project_scope: row.get::<_, i64>(4)? != 0,
                supports_copy: row.get::<_, i64>(5)? != 0,
            })
        },
    )
    .optional()
    .map_err(|e| format!("读取平台失败: {}", e))
}

fn load_skill(conn: &Connection, skill_id: &str) -> Result<SkillLite, String> {
    conn.query_row(
        "SELECT slug, is_archived FROM skills WHERE id = ?1",
        rusqlite::params![skill_id],
        |row| {
            Ok(SkillLite {
                slug: row.get(0)?,
                is_archived: row.get::<_, i64>(1)? != 0,
            })
        },
    )
    .map_err(|_| format!("skill 不存在: {}", skill_id))
}

fn load_snapshot(
    conn: &Connection,
    snapshot_id: &str,
    expected_skill_id: Option<&str>,
) -> Result<SnapshotLite, String> {
    let snapshot = conn
        .query_row(
            "SELECT id, skill_id
             FROM skill_snapshots
             WHERE id = ?1",
            rusqlite::params![snapshot_id],
            |row| {
                Ok(SnapshotLite {
                    id: row.get(0)?,
                    skill_id: row.get(1)?,
                })
            },
        )
        .map_err(|_| format!("snapshot 不存在: {}", snapshot_id))?;

    if let Some(skill_id) = expected_skill_id {
        if snapshot.skill_id != skill_id {
            return Err("snapshot 不属于当前 skill".to_string());
        }
    }

    Ok(snapshot)
}

fn load_default_snapshot(conn: &Connection, skill_id: &str) -> Result<SnapshotLite, String> {
    let snapshot_id: String = conn
        .query_row(
            "SELECT id
             FROM skill_snapshots
             WHERE skill_id = ?1
             ORDER BY is_active DESC, is_current DESC, snapshot_number DESC
             LIMIT 1",
            rusqlite::params![skill_id],
            |row| row.get(0),
        )
        .map_err(|_| "当前 skill 尚无可绑定 snapshot，请先创建版本".to_string())?;
    load_snapshot(conn, &snapshot_id, Some(skill_id))
}

fn load_assignment_rows(
    conn: &Connection,
    project_id: &str,
    platform_name: Option<&str>,
) -> Result<Vec<AssignmentRow>, String> {
    let sql = if platform_name.is_some() {
        "SELECT pa.id, pa.project_id, pa.platform_name, pa.skill_id, s.name, s.slug, s.is_archived,
                pa.snapshot_id, ss.snapshot_number, ss.snapshot_path, ss.revision_hash,
                ss.change_summary, pa.target_dir_name, pa.enabled, pa.sort_order,
                pa.runtime_status, pa.last_synced_snapshot_id, pa.last_synced_hash,
                pa.last_checked_at, pa.created_at, pa.updated_at
         FROM project_skill_assignments pa
         JOIN skills s ON s.id = pa.skill_id
         JOIN skill_snapshots ss ON ss.id = pa.snapshot_id
         WHERE pa.project_id = ?1 AND pa.platform_name = ?2
         ORDER BY pa.sort_order ASC, s.name COLLATE NOCASE ASC"
    } else {
        "SELECT pa.id, pa.project_id, pa.platform_name, pa.skill_id, s.name, s.slug, s.is_archived,
                pa.snapshot_id, ss.snapshot_number, ss.snapshot_path, ss.revision_hash,
                ss.change_summary, pa.target_dir_name, pa.enabled, pa.sort_order,
                pa.runtime_status, pa.last_synced_snapshot_id, pa.last_synced_hash,
                pa.last_checked_at, pa.created_at, pa.updated_at
         FROM project_skill_assignments pa
         JOIN skills s ON s.id = pa.skill_id
         JOIN skill_snapshots ss ON ss.id = pa.snapshot_id
         WHERE pa.project_id = ?1
         ORDER BY pa.platform_name COLLATE NOCASE ASC, pa.sort_order ASC, s.name COLLATE NOCASE ASC"
    };

    let mut stmt = conn
        .prepare(sql)
        .map_err(|e| format!("准备项目绑定查询失败: {}", e))?;

    let mapper = |row: &rusqlite::Row| {
        Ok(AssignmentRow {
            id: row.get(0)?,
            project_id: row.get(1)?,
            platform_name: row.get(2)?,
            skill_id: row.get(3)?,
            skill_name: row.get(4)?,
            skill_slug: row.get(5)?,
            skill_archived: row.get::<_, i64>(6)? != 0,
            snapshot_id: row.get(7)?,
            snapshot_number: row.get(8)?,
            snapshot_path: row.get(9)?,
            snapshot_revision_hash: row.get(10)?,
            snapshot_change_summary: row.get(11)?,
            target_dir_name: row.get(12)?,
            enabled: row.get::<_, i64>(13)? != 0,
            sort_order: row.get(14)?,
            runtime_status: row.get(15)?,
            last_synced_snapshot_id: row.get(16)?,
            last_synced_hash: row.get(17)?,
            last_checked_at: row.get(18)?,
            created_at: row.get(19)?,
            updated_at: row.get(20)?,
        })
    };

    if let Some(platform_name) = platform_name {
        stmt.query_map(rusqlite::params![project_id, platform_name], mapper)
            .map_err(|e| format!("查询项目绑定失败: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("读取项目绑定失败: {}", e))
    } else {
        stmt.query_map(rusqlite::params![project_id], mapper)
            .map_err(|e| format!("查询项目绑定失败: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("读取项目绑定失败: {}", e))
    }
}

fn to_project_skill_assignment(row: AssignmentRow) -> ProjectSkillAssignment {
    ProjectSkillAssignment {
        id: row.id,
        project_id: row.project_id,
        platform_name: row.platform_name,
        platform_display_name: None,
        skill_id: row.skill_id,
        skill_name: row.skill_name,
        skill_slug: row.skill_slug,
        snapshot_id: row.snapshot_id,
        snapshot_number: row.snapshot_number,
        snapshot_revision_hash: row.snapshot_revision_hash,
        snapshot_change_summary: row.snapshot_change_summary,
        target_dir_name: row.target_dir_name,
        enabled: row.enabled,
        sort_order: row.sort_order,
        runtime_status: row.runtime_status,
        last_synced_snapshot_id: row.last_synced_snapshot_id,
        last_synced_hash: row.last_synced_hash,
        last_checked_at: row.last_checked_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

fn build_sync_plan_record(
    platform: &ProjectPlatformConnection,
    assignment: &AssignmentRow,
) -> ProjectSyncPlanRecord {
    if !assignment.enabled {
        let target = target_path(platform, assignment);
        if target.is_dir() && is_owned_target(platform, assignment) {
            return ProjectSyncPlanRecord {
                assignment_id: assignment.id.clone(),
                skill_id: assignment.skill_id.clone(),
                skill_name: assignment.skill_name.clone(),
                snapshot_id: assignment.snapshot_id.clone(),
                target_path: target.to_string_lossy().replace('\\', "/"),
                planned_action: "park_managed".to_string(),
                status: "ready".to_string(),
                requires_user_confirmation: false,
                blocking_reason: None,
                detail_message: Some("绑定已停用，将撤下当前托管目录".to_string()),
            };
        }
        return ProjectSyncPlanRecord {
            assignment_id: assignment.id.clone(),
            skill_id: assignment.skill_id.clone(),
            skill_name: assignment.skill_name.clone(),
            snapshot_id: assignment.snapshot_id.clone(),
            target_path: target_path(platform, assignment)
                .to_string_lossy()
                .replace('\\', "/"),
            planned_action: "noop".to_string(),
            status: "skipped".to_string(),
            requires_user_confirmation: false,
            blocking_reason: Some("当前绑定已停用".to_string()),
            detail_message: None,
        };
    }

    if assignment.skill_archived {
        return blocked_record(assignment.clone(), "绑定的 skill 已归档");
    }

    let source = Path::new(&assignment.snapshot_path);
    if !source.is_dir() {
        return blocked_record(assignment.clone(), "绑定的 snapshot 目录不存在");
    }

    let target = target_path(platform, assignment);
    let target_path_text = target.to_string_lossy().replace('\\', "/");
    if !path_is_inside(&target, Path::new(&platform.skills_dir)) {
        return ProjectSyncPlanRecord {
            assignment_id: assignment.id.clone(),
            skill_id: assignment.skill_id.clone(),
            skill_name: assignment.skill_name.clone(),
            snapshot_id: assignment.snapshot_id.clone(),
            target_path: target_path_text,
            planned_action: "blocked_path_out_of_scope".to_string(),
            status: "blocked".to_string(),
            requires_user_confirmation: false,
            blocking_reason: Some("目标目录越过项目平台目录边界".to_string()),
            detail_message: None,
        };
    }

    if !target.exists() {
        return ProjectSyncPlanRecord {
            assignment_id: assignment.id.clone(),
            skill_id: assignment.skill_id.clone(),
            skill_name: assignment.skill_name.clone(),
            snapshot_id: assignment.snapshot_id.clone(),
            target_path: target_path_text,
            planned_action: "copy_create".to_string(),
            status: "ready".to_string(),
            requires_user_confirmation: false,
            blocking_reason: None,
            detail_message: Some("目标目录不存在，将创建新目录".to_string()),
        };
    }

    if !target.is_dir() {
        return ProjectSyncPlanRecord {
            assignment_id: assignment.id.clone(),
            skill_id: assignment.skill_id.clone(),
            skill_name: assignment.skill_name.clone(),
            snapshot_id: assignment.snapshot_id.clone(),
            target_path: target_path_text,
            planned_action: "copy_replace_confirmed".to_string(),
            status: "ready".to_string(),
            requires_user_confirmation: true,
            blocking_reason: None,
            detail_message: Some("目标路径已存在且不是目录，确认后将替换为绑定目录".to_string()),
        };
    }

    let current_hash = match compute_directory_revision(&target) {
        Ok(hash) => hash,
        Err(error) => {
            return ProjectSyncPlanRecord {
                assignment_id: assignment.id.clone(),
                skill_id: assignment.skill_id.clone(),
                skill_name: assignment.skill_name.clone(),
                snapshot_id: assignment.snapshot_id.clone(),
                target_path: target_path_text,
                planned_action: "blocked_permission".to_string(),
                status: "blocked".to_string(),
                requires_user_confirmation: false,
                blocking_reason: Some(error),
                detail_message: None,
            };
        }
    };

    if current_hash == assignment.snapshot_revision_hash {
        return ProjectSyncPlanRecord {
            assignment_id: assignment.id.clone(),
            skill_id: assignment.skill_id.clone(),
            skill_name: assignment.skill_name.clone(),
            snapshot_id: assignment.snapshot_id.clone(),
            target_path: target_path_text,
            planned_action: "noop".to_string(),
            status: "ready".to_string(),
            requires_user_confirmation: false,
            blocking_reason: None,
            detail_message: Some("目标目录已和绑定版本一致".to_string()),
        };
    }

    if is_owned_target(platform, assignment) {
        return ProjectSyncPlanRecord {
            assignment_id: assignment.id.clone(),
            skill_id: assignment.skill_id.clone(),
            skill_name: assignment.skill_name.clone(),
            snapshot_id: assignment.snapshot_id.clone(),
            target_path: target_path_text,
            planned_action: "copy_replace_owned".to_string(),
            status: "ready".to_string(),
            requires_user_confirmation: true,
            blocking_reason: None,
            detail_message: Some("目标目录由项目区托管，将覆盖为绑定版本".to_string()),
        };
    }

    ProjectSyncPlanRecord {
        assignment_id: assignment.id.clone(),
        skill_id: assignment.skill_id.clone(),
        skill_name: assignment.skill_name.clone(),
        snapshot_id: assignment.snapshot_id.clone(),
        target_path: target_path_text,
        planned_action: "copy_replace_confirmed".to_string(),
        status: "ready".to_string(),
        requires_user_confirmation: true,
        blocking_reason: None,
        detail_message: Some(
            "目标目录已有内容且不在项目托管清单内，确认后将接管并覆盖".to_string(),
        ),
    }
}

fn blocked_record(assignment: AssignmentRow, reason: &str) -> ProjectSyncPlanRecord {
    ProjectSyncPlanRecord {
        assignment_id: assignment.id,
        skill_id: assignment.skill_id,
        skill_name: assignment.skill_name,
        snapshot_id: assignment.snapshot_id,
        target_path: assignment.target_dir_name,
        planned_action: "blocked_conflict".to_string(),
        status: "blocked".to_string(),
        requires_user_confirmation: false,
        blocking_reason: Some(reason.to_string()),
        detail_message: None,
    }
}

fn execute_copy_sync(
    platform: &ProjectPlatformConnection,
    assignment: &AssignmentRow,
) -> Result<(), String> {
    let target = target_path(platform, assignment);
    let tmp = sync_tmp_dir(
        &assignment.project_id,
        &platform.platform_name,
        &assignment.id,
        &assignment.snapshot_id,
    )?;
    remove_path_if_exists(&tmp)?;
    if let Some(parent) = tmp.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建临时目录失败: {}", e))?;
    }
    copy_dir_recursive(Path::new(&assignment.snapshot_path), &tmp)?;
    let tmp_hash = compute_directory_revision(&tmp)?;
    if tmp_hash != assignment.snapshot_revision_hash {
        let _ = remove_path_if_exists(&tmp);
        return Err("临时目录哈希与 snapshot 不一致".to_string());
    }

    let backup = backup_dir(
        &assignment.project_id,
        &platform.platform_name,
        &assignment.id,
        now_ms(),
    )?;
    let backup_file = backup.with_extension("file");
    let had_existing_target = target.exists();

    if had_existing_target {
        backup_existing_target(&target, &backup, &backup_file)?;
        remove_path_if_exists(&target)?;
    }
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目标父目录失败: {}", e))?;
    }

    let sync_result = copy_dir_recursive(&tmp, &target);
    let _ = remove_path_if_exists(&tmp);
    if let Err(error) = sync_result {
        let _ = remove_path_if_exists(&target);
        if had_existing_target {
            let _ = restore_backup_target(&backup, &backup_file, &target);
        }
        return Err(format!("替换目标目录失败: {}", error));
    }

    write_manifest(platform, assignment)?;
    Ok(())
}

fn is_owned_target(platform: &ProjectPlatformConnection, assignment: &AssignmentRow) -> bool {
    let manifest = match read_manifest(
        platform,
        &assignment.project_id,
        &assignment.target_dir_name,
    ) {
        Ok(Some(manifest)) => manifest.assignment_id == assignment.id,
        _ => false,
    };
    manifest
        || (assignment.last_synced_snapshot_id.is_some()
            && assignment.last_synced_hash.is_some()
            && target_path(platform, assignment).is_dir())
}

fn write_manifest(
    platform: &ProjectPlatformConnection,
    assignment: &AssignmentRow,
) -> Result<(), String> {
    let path = manifest_path(
        &assignment.project_id,
        &platform.platform_name,
        &assignment.target_dir_name,
    )?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建 manifest 目录失败: {}", e))?;
    }
    let manifest = ProjectSkillManifest {
        project_id: assignment.project_id.clone(),
        platform_name: assignment.platform_name.clone(),
        assignment_id: assignment.id.clone(),
        skill_id: assignment.skill_id.clone(),
        snapshot_id: assignment.snapshot_id.clone(),
        target_dir_name: assignment.target_dir_name.clone(),
        revision_hash: assignment.snapshot_revision_hash.clone(),
        sync_mode: platform.sync_mode.clone(),
        synced_at: now_ms(),
    };
    let content = serde_json::to_string_pretty(&manifest)
        .map_err(|e| format!("序列化 manifest 失败: {}", e))?;
    fs::write(path, content).map_err(|e| format!("写入 manifest 失败: {}", e))
}

fn read_manifest(
    platform: &ProjectPlatformConnection,
    project_id: &str,
    target_dir_name: &str,
) -> Result<Option<ProjectSkillManifest>, String> {
    let path = manifest_path(project_id, &platform.platform_name, target_dir_name)?;
    if !path.is_file() {
        return Ok(None);
    }
    let content = fs::read_to_string(path).map_err(|e| format!("读取 manifest 失败: {}", e))?;
    serde_json::from_str(&content)
        .map(Some)
        .map_err(|e| format!("解析 manifest 失败: {}", e))
}

fn insert_sync_log(
    conn: &Connection,
    project_id: &str,
    platform_name: &str,
    skill_id: Option<&str>,
    snapshot_id: Option<&str>,
    action: &str,
    status: &str,
    detail_message: Option<&str>,
    error_message: Option<&str>,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO project_sync_logs (
            id, project_id, platform_name, skill_id, snapshot_id, action, status,
            detail_message, error_message, created_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![
            Uuid::new_v4().to_string(),
            project_id,
            platform_name,
            skill_id,
            snapshot_id,
            action,
            status,
            detail_message,
            error_message,
            now_ms()
        ],
    )
    .map_err(|e| format!("写入项目同步日志失败: {}", e))?;
    Ok(())
}

fn update_assignment_runtime_status(
    conn: &Connection,
    assignment_id: &str,
    runtime_status: &str,
    last_synced_snapshot_id: Option<&str>,
    last_synced_hash: Option<&str>,
) -> Result<(), String> {
    conn.execute(
        "UPDATE project_skill_assignments
         SET runtime_status = ?1,
             last_synced_snapshot_id = COALESCE(?2, last_synced_snapshot_id),
             last_synced_hash = COALESCE(?3, last_synced_hash),
             last_checked_at = ?4,
             updated_at = ?5
         WHERE id = ?6",
        rusqlite::params![
            runtime_status,
            last_synced_snapshot_id,
            last_synced_hash,
            now_ms(),
            now_ms(),
            assignment_id
        ],
    )
    .map_err(|e| format!("更新项目绑定状态失败: {}", e))?;
    Ok(())
}

fn update_assignment_checked_status(
    conn: &Connection,
    assignment_id: &str,
    runtime_status: &str,
    checked_at: i64,
) -> Result<(), String> {
    conn.execute(
        "UPDATE project_skill_assignments
         SET runtime_status = ?1,
             last_checked_at = ?2,
             updated_at = ?3
         WHERE id = ?4",
        rusqlite::params![runtime_status, checked_at, checked_at, assignment_id],
    )
    .map_err(|e| format!("刷新项目绑定状态失败: {}", e))?;
    Ok(())
}

fn resolve_project_skills_dir(
    project: &Project,
    platform: &PlatformLite,
    path_mode: &str,
    input: &SaveProjectPlatformConnectionInput,
) -> Result<(Option<String>, String), String> {
    match path_mode {
        "derived" => {
            let relative = input
                .relative_skills_dir
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(ToOwned::to_owned)
                .or_else(|| {
                    super::platform::project_relative_skill_dir(&platform.platform_name)
                        .map(ToOwned::to_owned)
                })
                .unwrap_or_else(|| format!(".{}/skills", platform.platform_name));
            validate_relative_path(&relative)?;
            let skills_dir = Path::new(&project.root_path).join(&relative);
            Ok((Some(relative), normalize_pathbuf(skills_dir)))
        }
        "custom" => {
            let skills_dir = input
                .skills_dir
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .ok_or_else(|| "自定义项目平台目录不能为空".to_string())?;
            let normalized = normalize_absolute_path(skills_dir)?;
            if !path_is_inside(Path::new(&normalized), Path::new(&project.root_path)) {
                return Err("自定义项目平台目录必须位于项目根目录内".to_string());
            }
            Ok((None, normalized))
        }
        _ => Err("pathMode 仅支持 derived 或 custom".to_string()),
    }
}

fn normalize_sync_mode(value: Option<&str>, platform: &PlatformLite) -> Result<String, String> {
    let mode = value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(platform.sync_mode.as_str());
    match mode {
        "copy" if platform.supports_copy => Ok("copy".to_string()),
        "symlink" => Err("项目区一期仅支持复制同步，软链接留到 P1".to_string()),
        _ => Ok("copy".to_string()),
    }
}

fn project_status(root_path: &str) -> String {
    let path = Path::new(root_path);
    if !path.is_dir() {
        return "missing_path".to_string();
    }
    match fs::read_dir(path) {
        Ok(_) => "ready".to_string(),
        Err(_) => "permission_blocked".to_string(),
    }
}

fn project_platform_status(project_root: &str, skills_dir: &str) -> String {
    let root = Path::new(project_root);
    if !root.is_dir() {
        return "blocked".to_string();
    }

    let path = Path::new(skills_dir);
    if path.is_dir() {
        return match fs::read_dir(path) {
            Ok(_) => "ready".to_string(),
            Err(_) => "permission_blocked".to_string(),
        };
    }

    if path.exists() {
        return "blocked".to_string();
    }

    if path.parent().map(Path::exists).unwrap_or(false) {
        "ready".to_string()
    } else {
        "missing_path".to_string()
    }
}

fn runtime_status_from_plan(
    platform: &ProjectPlatformConnection,
    assignment: &AssignmentRow,
    record: &ProjectSyncPlanRecord,
) -> String {
    if !assignment.enabled {
        return "disabled".to_string();
    }
    if assignment.skill_archived {
        return "skill_archived".to_string();
    }

    if record.status == "blocked" {
        if record.planned_action == "blocked_permission" {
            return "permission_blocked".to_string();
        }
        if record
            .blocking_reason
            .as_deref()
            .unwrap_or_default()
            .contains("snapshot")
        {
            return "missing_snapshot".to_string();
        }
        return "project_changed".to_string();
    }

    match record.planned_action.as_str() {
        "noop" => {
            if manifest_path(
                &assignment.project_id,
                &platform.platform_name,
                &assignment.target_dir_name,
            )
            .map(|path| path.is_file())
            .unwrap_or(false)
            {
                "in_sync".to_string()
            } else {
                "in_sync_unverified".to_string()
            }
        }
        "copy_create" => "target_missing".to_string(),
        "copy_replace_owned" => "pending_sync".to_string(),
        _ => "pending_sync".to_string(),
    }
}

fn optional_trimmed(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn target_path(platform: &ProjectPlatformConnection, assignment: &AssignmentRow) -> PathBuf {
    Path::new(&platform.skills_dir).join(&assignment.target_dir_name)
}

fn manifest_path(
    project_id: &str,
    platform_name: &str,
    target_dir_name: &str,
) -> Result<PathBuf, String> {
    Ok(workspace::project_manifests_dir(project_id)?
        .join(platform_scope_name(platform_name))
        .join(format!("{}.json", target_dir_name)))
}

fn sync_tmp_dir(
    project_id: &str,
    platform_name: &str,
    assignment_id: &str,
    snapshot_id: &str,
) -> Result<PathBuf, String> {
    Ok(workspace::project_staging_dir(project_id)?
        .join("sync")
        .join(platform_scope_name(platform_name))
        .join(format!("{}-{}", assignment_id, snapshot_id)))
}

fn backup_dir(
    project_id: &str,
    platform_name: &str,
    assignment_id: &str,
    synced_at: i64,
) -> Result<PathBuf, String> {
    Ok(workspace::project_artifacts_dir(project_id)?
        .join("backups")
        .join(platform_scope_name(platform_name))
        .join(assignment_id)
        .join(synced_at.to_string()))
}

fn parked_assignment_dir(
    project_id: &str,
    platform_name: &str,
    assignment_id: &str,
) -> Result<PathBuf, String> {
    Ok(workspace::project_artifacts_dir(project_id)?
        .join("parked")
        .join(platform_scope_name(platform_name))
        .join(assignment_id)
        .join("current"))
}

fn remove_path_if_exists(path: &Path) -> Result<(), String> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => {
            return Err(format!("读取路径元信息失败 {}: {}", path.display(), error));
        }
    };

    let file_type = metadata.file_type();
    if file_type.is_symlink() {
        if path.is_dir() {
            fs::remove_dir(path)
                .map_err(|e| format!("删除目录链接失败 {}: {}", path.display(), e))?;
        } else {
            fs::remove_file(path)
                .map_err(|e| format!("删除文件链接失败 {}: {}", path.display(), e))?;
        }
    } else if metadata.is_dir() {
        fs::remove_dir_all(path).map_err(|e| format!("删除目录失败 {}: {}", path.display(), e))?;
    } else {
        fs::remove_file(path).map_err(|e| format!("删除文件失败 {}: {}", path.display(), e))?;
    }
    Ok(())
}

fn backup_existing_target(
    target: &Path,
    backup_dir: &Path,
    backup_file: &Path,
) -> Result<(), String> {
    remove_path_if_exists(backup_dir)?;
    remove_path_if_exists(backup_file)?;
    if let Some(parent) = backup_dir.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建备份目录失败: {}", e))?;
    }

    if target.is_dir() {
        copy_dir_recursive(target, backup_dir).map_err(|e| format!("备份旧目录失败: {}", e))?;
    } else {
        fs::copy(target, backup_file).map_err(|e| format!("备份旧目标失败: {}", e))?;
    }
    Ok(())
}

fn restore_backup_target(
    backup_dir: &Path,
    backup_file: &Path,
    target: &Path,
) -> Result<(), String> {
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目标父目录失败: {}", e))?;
    }

    if backup_dir.is_dir() {
        copy_dir_recursive(backup_dir, target).map_err(|e| format!("恢复备份目录失败: {}", e))?;
    } else if backup_file.is_file() {
        fs::copy(backup_file, target).map_err(|e| format!("恢复备份文件失败: {}", e))?;
    }
    Ok(())
}

fn move_dir_copy_then_remove(source: &Path, target: &Path) -> Result<(), String> {
    remove_path_if_exists(target)?;
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("创建目录失败 {}: {}", parent.display(), e))?;
    }
    if let Err(error) = copy_dir_recursive(source, target) {
        let _ = remove_path_if_exists(target);
        return Err(error);
    }
    remove_path_if_exists(source)
}

fn park_assignment_target(
    platform: &ProjectPlatformConnection,
    assignment: &AssignmentRow,
) -> Result<bool, String> {
    let target = target_path(platform, assignment);
    let parked = parked_assignment_dir(
        &assignment.project_id,
        &platform.platform_name,
        &assignment.id,
    )?;

    if !target.exists() {
        return Ok(false);
    }
    if !target.is_dir() {
        return Err(format!("目标路径不是目录，无法停放: {}", target.display()));
    }
    if !is_owned_target(platform, assignment) {
        return Err(format!(
            "目标目录不由项目区托管，无法停放: {}",
            target.display()
        ));
    }

    move_dir_copy_then_remove(&target, &parked)?;
    Ok(true)
}

fn restore_assignment_target(
    platform: &ProjectPlatformConnection,
    assignment: &AssignmentRow,
) -> Result<bool, String> {
    let target = target_path(platform, assignment);
    let parked = parked_assignment_dir(
        &assignment.project_id,
        &platform.platform_name,
        &assignment.id,
    )?;

    if target.exists() {
        if !target.is_dir() {
            return Err(format!("目标路径不是目录，无法恢复: {}", target.display()));
        }
        if !is_owned_target(platform, assignment) {
            return Err(format!(
                "目标目录已存在且不由项目区托管，无法恢复: {}",
                target.display()
            ));
        }
        let current_hash = compute_directory_revision(&target)?;
        if current_hash == assignment.snapshot_revision_hash {
            let _ = remove_path_if_exists(&parked);
            write_manifest(platform, assignment)?;
            return Ok(false);
        }
    }

    if parked.is_dir() {
        let parked_hash = compute_directory_revision(&parked)?;
        if parked_hash == assignment.snapshot_revision_hash {
            if target.exists() {
                remove_path_if_exists(&target)?;
            }
            move_dir_copy_then_remove(&parked, &target)?;
            write_manifest(platform, assignment)?;
            return Ok(true);
        }
    }

    execute_copy_sync(platform, assignment)?;
    let _ = remove_path_if_exists(&parked);
    Ok(true)
}

fn remove_assignment_managed_copy(
    platform: &ProjectPlatformConnection,
    assignment: &AssignmentRow,
) -> Result<(), String> {
    let target = target_path(platform, assignment);
    let parked = parked_assignment_dir(
        &assignment.project_id,
        &platform.platform_name,
        &assignment.id,
    )?;

    if target.exists() {
        if !target.is_dir() {
            return Err(format!("目标路径不是目录，无法移除: {}", target.display()));
        }
        if !is_owned_target(platform, assignment) {
            return Err(format!(
                "目标目录不由项目区托管，无法移除: {}",
                target.display()
            ));
        }
        remove_path_if_exists(&target)?;
    }
    remove_path_if_exists(&parked)?;
    let manifest = manifest_path(
        &assignment.project_id,
        &platform.platform_name,
        &assignment.target_dir_name,
    )?;
    if manifest.is_file() {
        fs::remove_file(&manifest)
            .map_err(|e| format!("删除 manifest 失败 {}: {}", manifest.display(), e))?;
    }
    Ok(())
}

fn park_assignments_for_platform(
    conn: &Connection,
    platform: &ProjectPlatformConnection,
    assignments: &[AssignmentRow],
    reason: &str,
) -> Result<(), String> {
    for assignment in assignments {
        let parked = park_assignment_target(platform, assignment)?;
        let runtime_status = if assignment.enabled {
            "pending_sync"
        } else {
            "disabled"
        };
        update_assignment_runtime_status(conn, &assignment.id, runtime_status, None, None)?;
        if parked {
            insert_sync_log(
                conn,
                &assignment.project_id,
                &platform.platform_name,
                Some(&assignment.skill_id),
                Some(&assignment.snapshot_id),
                "park",
                "success",
                Some(reason),
                None,
            )?;
        }
    }
    Ok(())
}

fn restore_assignments_for_platform(
    conn: &Connection,
    platform: &ProjectPlatformConnection,
    assignments: &[AssignmentRow],
    reason: &str,
) -> Result<(), String> {
    for assignment in assignments {
        if !assignment.enabled {
            update_assignment_runtime_status(conn, &assignment.id, "disabled", None, None)?;
            continue;
        }

        let restored = restore_assignment_target(platform, assignment)?;
        update_assignment_runtime_status(
            conn,
            &assignment.id,
            "in_sync",
            Some(&assignment.snapshot_id),
            Some(&assignment.snapshot_revision_hash),
        )?;
        if restored {
            insert_sync_log(
                conn,
                &assignment.project_id,
                &platform.platform_name,
                Some(&assignment.skill_id),
                Some(&assignment.snapshot_id),
                "restore",
                "success",
                Some(reason),
                None,
            )?;
        }
    }
    Ok(())
}

pub(super) fn apply_registry_platform_state(
    conn: &Connection,
    platform_name: &str,
    registry_enabled: bool,
) -> Result<(), String> {
    let connections = load_project_platform_connections_by_platform(conn, platform_name)?;
    for platform in connections {
        let assignments = load_assignment_rows(conn, &platform.project_id, Some(platform_name))?;
        if registry_enabled {
            if platform.enabled {
                restore_assignments_for_platform(
                    conn,
                    &platform,
                    &assignments,
                    "平台中心重新启用，已恢复项目副本",
                )?;
            }
        } else {
            park_assignments_for_platform(
                conn,
                &platform,
                &assignments,
                "平台中心已停用，已撤下项目副本",
            )?;
        }
    }
    Ok(())
}

fn platform_scope_name(platform_name: &str) -> String {
    let slug = slugify(platform_name);
    if slug.is_empty() {
        "platform".to_string()
    } else {
        slug
    }
}

fn normalize_absolute_path(value: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err("路径不能为空".to_string());
    }
    let path = PathBuf::from(trimmed);
    let absolute = if path.is_absolute() {
        path
    } else {
        std::env::current_dir()
            .map_err(|e| format!("获取当前目录失败: {}", e))?
            .join(path)
    };
    Ok(normalize_pathbuf(absolute))
}

fn normalize_pathbuf(path: PathBuf) -> String {
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                normalized.pop();
            }
            _ => normalized.push(component.as_os_str()),
        }
    }
    normalized.to_string_lossy().replace('\\', "/")
}

fn validate_relative_path(value: &str) -> Result<(), String> {
    let path = Path::new(value);
    if value.trim().is_empty() || path.is_absolute() {
        return Err("相对目录不能为空，且不能是绝对路径".to_string());
    }
    for component in path.components() {
        if matches!(
            component,
            Component::ParentDir | Component::RootDir | Component::Prefix(_)
        ) {
            return Err("相对目录不能包含越界路径片段".to_string());
        }
    }
    Ok(())
}

fn validate_target_dir_name(value: &str) -> Result<(), String> {
    if value.is_empty() || value == "." || value == ".." {
        return Err("目标目录名不能为空或特殊目录".to_string());
    }
    if value.contains('/') || value.contains('\\') {
        return Err("目标目录名不能包含路径分隔符".to_string());
    }
    if !value
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.'))
    {
        let slug = slugify(value);
        return Err(format!(
            "目标目录名仅支持英文、数字、点、短横线和下划线，可改为 {}",
            slug
        ));
    }
    Ok(())
}

fn path_is_inside(child: &Path, parent: &Path) -> bool {
    let child = normalize_pathbuf(child.to_path_buf()).to_lowercase();
    let parent = normalize_pathbuf(parent.to_path_buf()).to_lowercase();
    child == parent || child.starts_with(&(parent.trim_end_matches('/').to_string() + "/"))
}

#[cfg(test)]
mod tests {
    use super::{
        apply_registry_platform_state, build_sync_plan_record, compute_directory_revision,
        load_assignment_rows, load_project_platform_connection, parked_assignment_dir,
        path_is_inside, target_path, update_assignment_runtime_status, validate_relative_path,
        validate_target_dir_name, write_manifest, AssignmentRow,
    };
    use crate::domain::{Project, ProjectPlatformConnection};
    use crate::{db, workspace};
    use rusqlite::Connection;
    use serde_json::json;
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::sync::{Mutex, MutexGuard, OnceLock};

    fn workspace_test_lock() -> MutexGuard<'static, ()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
            .lock()
            .expect("获取工作区测试锁失败")
    }

    struct WorkspaceConfigGuard {
        _lock: MutexGuard<'static, ()>,
        config_path: PathBuf,
        original_content: Option<Vec<u8>>,
    }

    impl WorkspaceConfigGuard {
        fn new(workspace_root: &Path) -> Self {
            let lock = workspace_test_lock();
            let config_path = workspace::bootstrap_config_path().expect("读取工作区配置路径失败");
            let original_content = fs::read(&config_path).ok();
            if let Some(parent) = config_path.parent() {
                fs::create_dir_all(parent).expect("创建工作区配置目录失败");
            }
            fs::write(
                &config_path,
                serde_json::to_vec_pretty(&json!({
                    "workspacePath": workspace_root.to_string_lossy().replace('\\', "/")
                }))
                .expect("序列化工作区配置失败"),
            )
            .expect("写入工作区配置失败");

            Self {
                _lock: lock,
                config_path,
                original_content,
            }
        }
    }

    impl Drop for WorkspaceConfigGuard {
        fn drop(&mut self) {
            match &self.original_content {
                Some(content) => {
                    let _ = fs::write(&self.config_path, content);
                }
                None => {
                    let _ = fs::remove_file(&self.config_path);
                }
            }
        }
    }

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir()
            .join("skill-studio-pro-tests")
            .join(format!("{}-{}", name, uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).expect("创建测试目录失败");
        dir
    }

    fn sample_platform(skills_dir: &Path) -> ProjectPlatformConnection {
        ProjectPlatformConnection {
            id: "platform-1".to_string(),
            project_id: "project-1".to_string(),
            platform_name: "cursor".to_string(),
            display_name: Some("Cursor".to_string()),
            path_mode: "derived".to_string(),
            relative_skills_dir: Some(".cursor/skills".to_string()),
            skills_dir: skills_dir.to_string_lossy().replace('\\', "/"),
            disabled_dir: None,
            sync_mode: "copy".to_string(),
            enabled: true,
            status: "ready".to_string(),
            last_sync_at: None,
            last_sync_status: None,
            last_error_message: None,
            created_at: 0,
            updated_at: 0,
        }
    }

    fn sample_assignment(enabled: bool, target_dir_name: &str) -> AssignmentRow {
        AssignmentRow {
            id: "assignment-1".to_string(),
            project_id: "project-1".to_string(),
            platform_name: "cursor".to_string(),
            skill_id: "skill-1".to_string(),
            skill_name: "Demo Skill".to_string(),
            skill_slug: "demo-skill".to_string(),
            skill_archived: false,
            snapshot_id: "snapshot-1".to_string(),
            snapshot_number: 1,
            snapshot_path: "D:/snapshots/demo-skill".to_string(),
            snapshot_revision_hash: "hash-1".to_string(),
            snapshot_change_summary: None,
            target_dir_name: target_dir_name.to_string(),
            enabled,
            sort_order: 0,
            runtime_status: "pending_sync".to_string(),
            last_synced_snapshot_id: Some("snapshot-1".to_string()),
            last_synced_hash: Some("hash-1".to_string()),
            last_checked_at: None,
            created_at: 0,
            updated_at: 0,
        }
    }

    fn seed_snapshot_dir(name: &str, content: &str) -> (PathBuf, String) {
        let dir = temp_dir(name);
        std::fs::write(dir.join("SKILL.md"), content).expect("写入 snapshot 文件失败");
        let hash = compute_directory_revision(&dir).expect("计算 snapshot 哈希失败");
        (dir, hash)
    }

    fn seed_registry_control_fixture() -> (
        WorkspaceConfigGuard,
        Connection,
        ProjectPlatformConnection,
        AssignmentRow,
        PathBuf,
        PathBuf,
    ) {
        let workspace_root = temp_dir("project-registry-workspace");
        let project_root = workspace_root.join("repo");
        let skills_dir = project_root.join(".cursor").join("skills");
        fs::create_dir_all(&skills_dir).expect("创建项目平台目录失败");

        let guard = WorkspaceConfigGuard::new(&workspace_root);
        workspace::prepare().expect("初始化工作区布局失败");

        let conn = db::init_db_at_path(&workspace_root).expect("初始化数据库失败");
        let project = Project {
            id: "project-1".to_string(),
            name: "Demo Project".to_string(),
            root_path: project_root.to_string_lossy().replace('\\', "/"),
            description: Some("demo".to_string()),
            status: "ready".to_string(),
            last_scanned_at: None,
            created_at: 1,
            updated_at: 1,
        };
        workspace::ensure_project_workspace(&project).expect("初始化项目工作区失败");

        conn.execute(
            "INSERT INTO projects (
                id, name, root_path, description, status, last_scanned_at, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                project.id,
                project.name,
                project.root_path,
                project.description,
                project.status,
                project.last_scanned_at,
                project.created_at,
                project.updated_at
            ],
        )
        .expect("插入项目失败");
        conn.execute(
            "INSERT INTO platform_connections (
                id, platform_name, display_name, platform_type, detected, enabled, skills_dir,
                detect_dir, sync_mode, supports_project_scope, supports_symlink, supports_copy,
                last_sync_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            rusqlite::params![
                "registry-cursor",
                "cursor",
                "Cursor",
                "built_in",
                1_i64,
                1_i64,
                Option::<String>::None,
                Option::<String>::None,
                "copy",
                1_i64,
                1_i64,
                1_i64,
                Option::<i64>::None
            ],
        )
        .expect("插入平台中心记录失败");
        conn.execute(
            "INSERT INTO skills (
                id, name, slug, description, source_type, source_path, created_at, updated_at, is_archived
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            rusqlite::params![
                "skill-1",
                "Demo Skill",
                "demo-skill",
                Option::<String>::None,
                "local",
                Option::<String>::None,
                1_i64,
                1_i64,
                0_i64
            ],
        )
        .expect("插入技能失败");

        let (snapshot_dir, snapshot_hash) =
            seed_snapshot_dir("registry-control-snapshot", "snapshot");
        conn.execute(
            "INSERT INTO skill_snapshots (
                id, skill_id, snapshot_number, snapshot_path, revision_hash, change_summary,
                source, created_at, is_current, is_active
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            rusqlite::params![
                "snapshot-1",
                "skill-1",
                1_i64,
                snapshot_dir.to_string_lossy().replace('\\', "/"),
                snapshot_hash,
                Option::<String>::None,
                "manual",
                1_i64,
                1_i64,
                1_i64
            ],
        )
        .expect("插入快照失败");
        conn.execute(
            "INSERT INTO project_platform_connections (
                id, project_id, platform_name, path_mode, relative_skills_dir, skills_dir,
                disabled_dir, sync_mode, enabled, status, last_sync_at, last_sync_status,
                last_error_message, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            rusqlite::params![
                "project-platform-1",
                "project-1",
                "cursor",
                "derived",
                ".cursor/skills",
                skills_dir.to_string_lossy().replace('\\', "/"),
                Option::<String>::None,
                "copy",
                1_i64,
                "ready",
                Option::<i64>::None,
                Option::<String>::None,
                Option::<String>::None,
                1_i64,
                1_i64
            ],
        )
        .expect("插入项目平台接入失败");
        conn.execute(
            "INSERT INTO project_skill_assignments (
                id, project_id, platform_name, skill_id, snapshot_id, target_dir_name, enabled,
                sort_order, runtime_status, last_synced_snapshot_id, last_synced_hash,
                last_checked_at, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
            rusqlite::params![
                "assignment-1",
                "project-1",
                "cursor",
                "skill-1",
                "snapshot-1",
                "demo-skill",
                1_i64,
                0_i64,
                "pending_sync",
                Option::<String>::None,
                Option::<String>::None,
                Option::<i64>::None,
                1_i64,
                1_i64
            ],
        )
        .expect("插入项目绑定失败");

        let platform = load_project_platform_connection(&conn, "project-1", "cursor")
            .expect("读取项目平台失败");
        let assignment = load_assignment_rows(&conn, "project-1", Some("cursor"))
            .expect("读取项目绑定失败")
            .into_iter()
            .next()
            .expect("缺少项目绑定");
        let live_target = target_path(&platform, &assignment);
        fs::create_dir_all(&live_target).expect("创建项目侧 live 目录失败");
        fs::write(live_target.join("SKILL.md"), "project-live").expect("写入项目侧 live 文件失败");
        write_manifest(&platform, &assignment).expect("写入项目 manifest 失败");
        update_assignment_runtime_status(
            &conn,
            &assignment.id,
            "in_sync",
            Some(&assignment.snapshot_id),
            Some(&assignment.snapshot_revision_hash),
        )
        .expect("刷新项目绑定同步状态失败");

        (guard, conn, platform, assignment, live_target, snapshot_dir)
    }

    #[test]
    fn rejects_unsafe_relative_paths() {
        assert!(validate_relative_path("../skills").is_err());
        assert!(validate_relative_path("/tmp/skills").is_err());
        assert!(validate_relative_path(".codex/skills").is_ok());
    }

    #[test]
    fn rejects_target_dir_with_separators() {
        assert!(validate_target_dir_name("../x").is_err());
        assert!(validate_target_dir_name("safe_skill").is_ok());
    }

    #[test]
    fn detects_path_scope_lexically() {
        assert!(path_is_inside(
            Path::new("D:/root/.codex/skills/a"),
            Path::new("D:/root/.codex/skills")
        ));
        assert!(!path_is_inside(
            Path::new("D:/root-other/a"),
            Path::new("D:/root")
        ));
    }

    #[test]
    fn disabled_owned_assignment_is_planned_for_park() {
        let skills_dir = temp_dir("project-park-plan");
        std::fs::create_dir_all(skills_dir.join("demo-skill")).expect("创建托管目录失败");

        let platform = sample_platform(&skills_dir);
        let assignment = sample_assignment(false, "demo-skill");

        let record = build_sync_plan_record(&platform, &assignment);

        assert_eq!(record.planned_action, "park_managed");
        assert_eq!(record.status, "ready");
    }

    #[test]
    fn disabled_assignment_without_owned_target_is_skipped() {
        let skills_dir = temp_dir("project-disabled-skip");
        let platform = sample_platform(&skills_dir);
        let assignment = sample_assignment(false, "demo-skill");

        let record = build_sync_plan_record(&platform, &assignment);

        assert_eq!(record.planned_action, "noop");
        assert_eq!(record.status, "skipped");
    }

    #[test]
    fn unmanaged_directory_requires_confirmation_before_takeover() {
        let skills_dir = temp_dir("project-confirm-dir-target");
        let (snapshot_dir, snapshot_hash) =
            seed_snapshot_dir("project-confirm-dir-source", "snapshot");
        let target = skills_dir.join("demo-skill");
        std::fs::create_dir_all(&target).expect("创建目标目录失败");
        std::fs::write(target.join("SKILL.md"), "local").expect("写入目标目录文件失败");

        let platform = sample_platform(&skills_dir);
        let mut assignment = sample_assignment(true, "demo-skill");
        assignment.snapshot_path = snapshot_dir.to_string_lossy().replace('\\', "/");
        assignment.snapshot_revision_hash = snapshot_hash;
        assignment.last_synced_snapshot_id = None;
        assignment.last_synced_hash = None;

        let record = build_sync_plan_record(&platform, &assignment);

        assert_eq!(record.planned_action, "copy_replace_confirmed");
        assert_eq!(record.status, "ready");
        assert!(record.requires_user_confirmation);
    }

    #[test]
    fn file_target_requires_confirmation_before_takeover() {
        let skills_dir = temp_dir("project-confirm-file-target");
        let (snapshot_dir, snapshot_hash) =
            seed_snapshot_dir("project-confirm-file-source", "snapshot");
        let target = skills_dir.join("demo-skill");
        std::fs::write(&target, "local").expect("写入目标文件失败");

        let platform = sample_platform(&skills_dir);
        let mut assignment = sample_assignment(true, "demo-skill");
        assignment.snapshot_path = snapshot_dir.to_string_lossy().replace('\\', "/");
        assignment.snapshot_revision_hash = snapshot_hash;
        assignment.last_synced_snapshot_id = None;
        assignment.last_synced_hash = None;

        let record = build_sync_plan_record(&platform, &assignment);

        assert_eq!(record.planned_action, "copy_replace_confirmed");
        assert_eq!(record.status, "ready");
        assert!(record.requires_user_confirmation);
    }

    #[test]
    fn registry_disable_parks_project_assignment_copy_and_writes_log() {
        let (_guard, conn, platform, assignment, live_target, _snapshot_dir) =
            seed_registry_control_fixture();
        let parked_target = parked_assignment_dir(
            &assignment.project_id,
            &platform.platform_name,
            &assignment.id,
        )
        .expect("计算停放目录失败");

        apply_registry_platform_state(&conn, "cursor", false).expect("应用平台停用状态失败");

        assert!(!live_target.exists(), "停用后项目 live 目录应被撤下");
        assert!(parked_target.is_dir(), "停用后项目副本应进入 parked 目录");
        assert!(
            parked_target.join("SKILL.md").is_file(),
            "停放目录中应保留技能文件"
        );

        let assignment_after = load_assignment_rows(&conn, "project-1", Some("cursor"))
            .expect("重新读取项目绑定失败")
            .into_iter()
            .next()
            .expect("停用后项目绑定丢失");
        assert_eq!(assignment_after.runtime_status, "pending_sync");
        assert_eq!(
            assignment_after.last_synced_snapshot_id.as_deref(),
            Some("snapshot-1")
        );

        let latest_log: (String, String, Option<String>) = conn
            .query_row(
                "SELECT action, status, detail_message
                 FROM project_sync_logs
                 WHERE project_id = ?1
                 ORDER BY created_at DESC
                 LIMIT 1",
                rusqlite::params!["project-1"],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .expect("读取项目同步日志失败");
        assert_eq!(latest_log.0, "park");
        assert_eq!(latest_log.1, "success");
        assert_eq!(
            latest_log.2.as_deref(),
            Some("平台中心已停用，已撤下项目副本")
        );
    }

    #[test]
    fn registry_reenable_restores_project_assignment_copy_and_writes_log() {
        let (_guard, conn, platform, assignment, live_target, _snapshot_dir) =
            seed_registry_control_fixture();
        let parked_target = parked_assignment_dir(
            &assignment.project_id,
            &platform.platform_name,
            &assignment.id,
        )
        .expect("计算停放目录失败");
        apply_registry_platform_state(&conn, "cursor", false).expect("预先停用平台失败");

        apply_registry_platform_state(&conn, "cursor", true).expect("重新启用平台失败");

        assert!(live_target.is_dir(), "重新启用后项目 live 目录应恢复");
        assert!(
            live_target.join("SKILL.md").is_file(),
            "恢复后的 live 目录应包含技能文件"
        );
        assert!(!parked_target.exists(), "恢复后 parked 目录应被回收");

        let assignment_after = load_assignment_rows(&conn, "project-1", Some("cursor"))
            .expect("重新读取项目绑定失败")
            .into_iter()
            .next()
            .expect("重新启用后项目绑定丢失");
        assert_eq!(assignment_after.runtime_status, "in_sync");
        assert_eq!(
            assignment_after.last_synced_snapshot_id.as_deref(),
            Some("snapshot-1")
        );
        assert_eq!(
            assignment_after.last_synced_hash.as_deref(),
            Some(assignment.snapshot_revision_hash.as_str())
        );

        let latest_log: (String, String, Option<String>) = conn
            .query_row(
                "SELECT action, status, detail_message
                 FROM project_sync_logs
                 WHERE project_id = ?1
                 ORDER BY created_at DESC
                 LIMIT 1",
                rusqlite::params!["project-1"],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .expect("读取项目同步日志失败");
        assert_eq!(latest_log.0, "restore");
        assert_eq!(latest_log.1, "success");
        assert_eq!(
            latest_log.2.as_deref(),
            Some("平台中心重新启用，已恢复项目副本")
        );
    }
}
