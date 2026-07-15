use tauri::Runtime;
use uuid::Uuid;

use crate::domain::{
    CreateTeamInput, CreateTeamMemberInput, SetTeamStatusInput, Team, TeamMember, TeamSkill,
    TeamSkillVersion, UpdateTeamInput, UpdateTeamMemberInput,
};
use crate::store::{get_conn, now_ms};

fn normalize_optional_text(value: Option<&str>) -> Option<String> {
    let trimmed = value.unwrap_or_default().trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn normalize_required_text(field: &str, value: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(format!("{} 不能为空", field));
    }

    Ok(trimmed.to_string())
}

fn validate_team_status(status: &str) -> Result<(), String> {
    match status {
        "active" | "archived" => Ok(()),
        _ => Err(format!("未知团队状态: {}", status)),
    }
}

fn validate_member_role(role: &str) -> Result<(), String> {
    match role {
        "owner" | "maintainer" | "reviewer" | "contributor" | "viewer" => Ok(()),
        _ => Err(format!("未知成员角色: {}", role)),
    }
}

fn validate_member_status(status: &str) -> Result<(), String> {
    match status {
        "active" | "invited" | "disabled" => Ok(()),
        _ => Err(format!("未知成员状态: {}", status)),
    }
}

fn ensure_team_exists(conn: &rusqlite::Connection, team_id: &str) -> Result<(), String> {
    conn.query_row(
        "SELECT id FROM teams WHERE id = ?1",
        rusqlite::params![team_id],
        |row| row.get::<_, String>(0),
    )
    .map(|_| ())
    .map_err(|_| format!("团队不存在: {}", team_id))
}

fn count_active_owners(
    conn: &rusqlite::Connection,
    team_id: &str,
    excluding_member_id: Option<&str>,
) -> Result<i64, String> {
    let sql = if excluding_member_id.is_some() {
        "SELECT COUNT(1) FROM team_members
         WHERE team_id = ?1
           AND role = 'owner'
           AND status = 'active'
           AND id <> ?2"
    } else {
        "SELECT COUNT(1) FROM team_members
         WHERE team_id = ?1
           AND role = 'owner'
           AND status = 'active'"
    };

    if let Some(member_id) = excluding_member_id {
        conn.query_row(sql, rusqlite::params![team_id, member_id], |row| row.get(0))
            .map_err(|e| format!("统计团队负责人失败: {}", e))
    } else {
        conn.query_row(sql, rusqlite::params![team_id], |row| row.get(0))
            .map_err(|e| format!("统计团队负责人失败: {}", e))
    }
}

fn ensure_unique_member_name(
    conn: &rusqlite::Connection,
    team_id: &str,
    user_name: &str,
    excluding_member_id: Option<&str>,
) -> Result<(), String> {
    let sql = if excluding_member_id.is_some() {
        "SELECT COUNT(1) FROM team_members
         WHERE team_id = ?1
           AND lower(user_name) = lower(?2)
           AND id <> ?3"
    } else {
        "SELECT COUNT(1) FROM team_members
         WHERE team_id = ?1
           AND lower(user_name) = lower(?2)"
    };

    let count: i64 = if let Some(member_id) = excluding_member_id {
        conn.query_row(
            sql,
            rusqlite::params![team_id, user_name, member_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("检查成员名称唯一性失败: {}", e))?
    } else {
        conn.query_row(sql, rusqlite::params![team_id, user_name], |row| row.get(0))
            .map_err(|e| format!("检查成员名称唯一性失败: {}", e))?
    };

    if count > 0 {
        return Err(format!("团队内已存在成员名称: {}", user_name));
    }

    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn insert_activity(
    conn: &rusqlite::Connection,
    team_id: &str,
    actor: &str,
    action: &str,
    target_type: &str,
    target_id: Option<&str>,
    target_label: Option<&str>,
    detail: Option<&str>,
    created_at: i64,
) -> Result<(), String> {
    super::activity::insert_team_activity_log(
        conn,
        super::activity::TeamActivityDraft {
            team_id: team_id.to_string(),
            actor: actor.to_string(),
            action: action.to_string(),
            target_type: target_type.to_string(),
            target_id: target_id.map(str::to_string),
            target_label: target_label.map(str::to_string),
            detail: detail.map(str::to_string),
            created_at,
        },
    )
    .map(|_| ())
}

pub fn list_teams<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<Vec<Team>, String> {
    let conn = get_conn(app)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, description, created_at, updated_at, status
             FROM teams
             ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, updated_at DESC, created_at ASC",
        )
        .map_err(|e| e.to_string())?;
    let teams = stmt
        .query_map([], super::map_team_row)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(teams)
}

pub fn create_team<R: Runtime>(
    app: &tauri::AppHandle<R>,
    input: &CreateTeamInput,
) -> Result<Team, String> {
    let mut conn = get_conn(app)?;
    let id = Uuid::new_v4().to_string();
    let now = now_ms();
    let name = normalize_required_text("团队名称", &input.name)?;
    let description = normalize_optional_text(input.description.as_deref());
    let owner_name = input
        .actor
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("jensen")
        .to_string();

    let tx = conn
        .transaction()
        .map_err(|e| format!("开启事务失败: {}", e))?;
    tx.execute(
        "INSERT INTO teams (id, name, description, created_at, updated_at, status)
         VALUES (?1, ?2, ?3, ?4, ?4, 'active')",
        rusqlite::params![id, name, description, now],
    )
    .map_err(|e| format!("创建团队失败: {}", e))?;

    if owner_name == "jensen" {
        super::sql::insert_default_team_member(&tx, &id, now)?;
    } else {
        super::sql::insert_team_owner_member(&tx, &id, &owner_name, now)?;
    }

    insert_activity(
        &tx,
        &id,
        &owner_name,
        "create_team",
        "team",
        Some(&id),
        Some(&name),
        description.as_deref(),
        now,
    )?;

    tx.commit().map_err(|e| format!("提交事务失败: {}", e))?;

    Ok(Team {
        id,
        name,
        description,
        created_at: now,
        updated_at: now,
        status: "active".to_string(),
    })
}

pub fn update_team<R: Runtime>(
    app: &tauri::AppHandle<R>,
    input: &UpdateTeamInput,
) -> Result<Team, String> {
    let mut conn = get_conn(app)?;
    let now = now_ms();
    let name = normalize_required_text("团队名称", &input.name)?;
    let description = normalize_optional_text(input.description.as_deref());
    let actor = super::permissions::normalize_actor(input.actor.as_deref())?;

    super::permissions::ensure_actor_can(
        &conn,
        &input.team_id,
        &actor,
        super::permissions::TeamPermission::Own,
    )?;

    let tx = conn
        .transaction()
        .map_err(|e| format!("开启事务失败: {}", e))?;
    let affected = tx
        .execute(
            "UPDATE teams
             SET name = ?1,
                 description = ?2,
                 updated_at = ?3
             WHERE id = ?4",
            rusqlite::params![name, description, now, input.team_id],
        )
        .map_err(|e| format!("更新团队失败: {}", e))?;

    if affected == 0 {
        return Err(format!("团队不存在: {}", input.team_id));
    }

    let team = tx
        .query_row(
            "SELECT id, name, description, created_at, updated_at, status FROM teams WHERE id = ?1",
            rusqlite::params![input.team_id],
            super::map_team_row,
        )
        .map_err(|e| format!("读取更新后的团队失败: {}", e))?;

    insert_activity(
        &tx,
        &team.id,
        &actor,
        "update_team",
        "team",
        Some(&team.id),
        Some(&team.name),
        team.description.as_deref(),
        now,
    )?;
    tx.commit().map_err(|e| format!("提交事务失败: {}", e))?;
    Ok(team)
}

pub fn set_team_status<R: Runtime>(
    app: &tauri::AppHandle<R>,
    input: &SetTeamStatusInput,
) -> Result<Team, String> {
    validate_team_status(&input.status)?;
    let mut conn = get_conn(app)?;
    let now = now_ms();
    let actor = super::permissions::normalize_actor(input.actor.as_deref())?;

    super::permissions::ensure_actor_can(
        &conn,
        &input.team_id,
        &actor,
        super::permissions::TeamPermission::Own,
    )?;
    let tx = conn
        .transaction()
        .map_err(|e| format!("开启事务失败: {}", e))?;
    let affected = tx
        .execute(
            "UPDATE teams
             SET status = ?1,
                 updated_at = ?2
             WHERE id = ?3",
            rusqlite::params![input.status, now, input.team_id],
        )
        .map_err(|e| format!("更新团队状态失败: {}", e))?;

    if affected == 0 {
        return Err(format!("团队不存在: {}", input.team_id));
    }

    let team = tx
        .query_row(
            "SELECT id, name, description, created_at, updated_at, status FROM teams WHERE id = ?1",
            rusqlite::params![input.team_id],
            super::map_team_row,
        )
        .map_err(|e| format!("读取团队状态失败: {}", e))?;
    let action = if input.status == "archived" {
        "archive_team"
    } else {
        "restore_team"
    };
    insert_activity(
        &tx,
        &team.id,
        &actor,
        action,
        "team",
        Some(&team.id),
        Some(&team.name),
        Some(&team.status),
        now,
    )?;
    tx.commit().map_err(|e| format!("提交事务失败: {}", e))?;
    Ok(team)
}

pub fn delete_team<R: Runtime>(
    app: &tauri::AppHandle<R>,
    team_id: &str,
    actor: Option<&str>,
) -> Result<(), String> {
    let mut conn = get_conn(app)?;
    let actor = super::permissions::normalize_actor(actor)?;
    super::permissions::ensure_actor_can(
        &conn,
        team_id,
        &actor,
        super::permissions::TeamPermission::Own,
    )?;
    let team_status: String = conn
        .query_row(
            "SELECT status FROM teams WHERE id = ?1",
            rusqlite::params![team_id],
            |row| row.get(0),
        )
        .map_err(|_| format!("团队不存在: {}", team_id))?;

    if team_status != "archived" {
        return Err("请先归档团队，再执行删除".to_string());
    }

    let skill_ids: Vec<String> = {
        let mut stmt = conn
            .prepare("SELECT id FROM team_skills WHERE team_id = ?1")
            .map_err(|e| e.to_string())?;
        let ids = stmt
            .query_map(rusqlite::params![team_id], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        ids
    };
    let submission_ids: Vec<String> = {
        let mut stmt = conn
            .prepare("SELECT id FROM team_submissions WHERE team_id = ?1")
            .map_err(|e| e.to_string())?;
        let ids = stmt
            .query_map(rusqlite::params![team_id], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        ids
    };

    let tx = conn
        .transaction()
        .map_err(|e| format!("开启事务失败: {}", e))?;
    tx.execute(
        "DELETE FROM team_members WHERE team_id = ?1",
        rusqlite::params![team_id],
    )
    .map_err(|e| format!("删除团队成员失败: {}", e))?;
    tx.execute(
        "DELETE FROM team_submissions WHERE team_id = ?1",
        rusqlite::params![team_id],
    )
    .map_err(|e| format!("删除团队提交失败: {}", e))?;
    tx.execute(
        "DELETE FROM team_delivery_targets WHERE team_id = ?1",
        rusqlite::params![team_id],
    )
    .map_err(|e| format!("删除团队承接状态失败: {}", e))?;
    tx.execute(
        "DELETE FROM team_delivery_logs WHERE team_id = ?1",
        rusqlite::params![team_id],
    )
    .map_err(|e| format!("删除团队交付记录失败: {}", e))?;
    tx.execute(
        "DELETE FROM team_activity_logs WHERE team_id = ?1",
        rusqlite::params![team_id],
    )
    .map_err(|e| format!("删除团队活动记录失败: {}", e))?;
    for skill_id in &skill_ids {
        tx.execute(
            "DELETE FROM team_skill_versions WHERE team_skill_id = ?1",
            rusqlite::params![skill_id],
        )
        .map_err(|e| format!("删除团队版本失败: {}", e))?;
    }
    tx.execute(
        "DELETE FROM team_skills WHERE team_id = ?1",
        rusqlite::params![team_id],
    )
    .map_err(|e| format!("删除团队 Skill 失败: {}", e))?;
    tx.execute(
        "DELETE FROM teams WHERE id = ?1",
        rusqlite::params![team_id],
    )
    .map_err(|e| format!("删除团队失败: {}", e))?;
    tx.commit().map_err(|e| format!("提交事务失败: {}", e))?;

    for skill_id in &skill_ids {
        let _ = std::fs::remove_dir_all(super::paths::team_versions_dir(app).join(skill_id));
    }
    for submission_id in &submission_ids {
        let _ = std::fs::remove_dir_all(super::paths::team_staging_path(app, submission_id));
    }
    Ok(())
}

pub fn list_team_skills<R: Runtime>(
    app: &tauri::AppHandle<R>,
    team_id: &str,
) -> Result<Vec<TeamSkill>, String> {
    let conn = get_conn(app)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, team_id, name, slug, description, created_at
             FROM team_skills
             WHERE team_id = ?1
             ORDER BY created_at ASC",
        )
        .map_err(|e| e.to_string())?;
    let skills = stmt
        .query_map(rusqlite::params![team_id], super::map_team_skill_row)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(skills)
}

pub fn list_team_skill_versions<R: Runtime>(
    app: &tauri::AppHandle<R>,
    team_skill_id: &str,
) -> Result<Vec<TeamSkillVersion>, String> {
    let conn = get_conn(app)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, team_skill_id, version_number, snapshot_path, revision_hash, change_summary, merged_from_submission_id, merged_by, merged_at, is_recommended
             FROM team_skill_versions
             WHERE team_skill_id = ?1
             ORDER BY version_number DESC",
        )
        .map_err(|e| e.to_string())?;
    let versions = stmt
        .query_map(
            rusqlite::params![team_skill_id],
            super::map_team_skill_version_row,
        )
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(versions)
}

pub fn list_team_members<R: Runtime>(
    app: &tauri::AppHandle<R>,
    team_id: &str,
) -> Result<Vec<TeamMember>, String> {
    let conn = get_conn(app)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, team_id, user_name, email, role, status, joined_at, updated_at
             FROM team_members
             WHERE team_id = ?1
             ORDER BY CASE role
                 WHEN 'owner' THEN 0
                 WHEN 'maintainer' THEN 1
                 WHEN 'reviewer' THEN 2
                 WHEN 'contributor' THEN 3
                 ELSE 4
             END,
             joined_at ASC",
        )
        .map_err(|e| e.to_string())?;

    let members = stmt
        .query_map(rusqlite::params![team_id], super::map_team_member_row)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(members)
}

pub fn create_team_member<R: Runtime>(
    app: &tauri::AppHandle<R>,
    input: &CreateTeamMemberInput,
) -> Result<TeamMember, String> {
    validate_member_role(&input.role)?;
    let mut conn = get_conn(app)?;
    let now = now_ms();
    let user_name = normalize_required_text("成员名称", &input.user_name)?;
    let email = normalize_optional_text(input.email.as_deref());
    let actor = super::permissions::normalize_actor(input.actor.as_deref())?;

    ensure_team_exists(&conn, &input.team_id)?;
    super::permissions::ensure_team_active(&conn, &input.team_id)?;
    super::permissions::ensure_actor_can(
        &conn,
        &input.team_id,
        &actor,
        super::permissions::TeamPermission::Own,
    )?;
    ensure_unique_member_name(&conn, &input.team_id, &user_name, None)?;

    let member = TeamMember {
        id: Uuid::new_v4().to_string(),
        team_id: input.team_id.clone(),
        user_name,
        email,
        role: input.role.clone(),
        status: "active".to_string(),
        joined_at: now,
        updated_at: now,
    };

    let tx = conn
        .transaction()
        .map_err(|e| format!("开启事务失败: {}", e))?;
    tx.execute(
        "INSERT INTO team_members (id, team_id, user_name, email, role, status, joined_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            member.id,
            member.team_id,
            member.user_name,
            member.email,
            member.role,
            member.status,
            member.joined_at,
            member.updated_at
        ],
    )
    .map_err(|e| format!("创建团队成员失败: {}", e))?;

    tx.execute(
        "UPDATE teams SET updated_at = ?1 WHERE id = ?2",
        rusqlite::params![now, input.team_id],
    )
    .map_err(|e| format!("刷新团队更新时间失败: {}", e))?;

    insert_activity(
        &tx,
        &member.team_id,
        &actor,
        "create_member",
        "member",
        Some(&member.id),
        Some(&member.user_name),
        Some(&member.role),
        now,
    )?;
    tx.commit().map_err(|e| format!("提交事务失败: {}", e))?;

    Ok(member)
}

pub fn update_team_member<R: Runtime>(
    app: &tauri::AppHandle<R>,
    input: &UpdateTeamMemberInput,
) -> Result<TeamMember, String> {
    validate_member_role(&input.role)?;
    validate_member_status(&input.status)?;
    let mut conn = get_conn(app)?;
    let now = now_ms();
    let user_name = normalize_required_text("成员名称", &input.user_name)?;
    let email = normalize_optional_text(input.email.as_deref());
    let actor = super::permissions::normalize_actor(input.actor.as_deref())?;

    let existing: TeamMember = conn
        .query_row(
            "SELECT id, team_id, user_name, email, role, status, joined_at, updated_at
             FROM team_members
             WHERE id = ?1",
            rusqlite::params![input.member_id],
            super::map_team_member_row,
        )
        .map_err(|_| format!("团队成员不存在: {}", input.member_id))?;

    super::permissions::ensure_team_active(&conn, &existing.team_id)?;
    super::permissions::ensure_actor_can(
        &conn,
        &existing.team_id,
        &actor,
        super::permissions::TeamPermission::Own,
    )?;
    ensure_unique_member_name(&conn, &existing.team_id, &user_name, Some(&existing.id))?;

    if existing.role == "owner" && (input.role != "owner" || input.status != "active") {
        let owner_count = count_active_owners(&conn, &existing.team_id, Some(&existing.id))?;
        if owner_count == 0 {
            return Err("团队至少需要保留一名启用中的负责人".to_string());
        }
    }

    let tx = conn
        .transaction()
        .map_err(|e| format!("开启事务失败: {}", e))?;
    tx.execute(
        "UPDATE team_members
         SET user_name = ?1,
             email = ?2,
             role = ?3,
             status = ?4,
             updated_at = ?5
         WHERE id = ?6",
        rusqlite::params![
            user_name,
            email,
            input.role,
            input.status,
            now,
            input.member_id
        ],
    )
    .map_err(|e| format!("更新团队成员失败: {}", e))?;

    tx.execute(
        "UPDATE teams SET updated_at = ?1 WHERE id = ?2",
        rusqlite::params![now, existing.team_id],
    )
    .map_err(|e| format!("刷新团队更新时间失败: {}", e))?;

    let updated = tx
        .query_row(
            "SELECT id, team_id, user_name, email, role, status, joined_at, updated_at
         FROM team_members
         WHERE id = ?1",
            rusqlite::params![input.member_id],
            super::map_team_member_row,
        )
        .map_err(|e| format!("读取更新后的团队成员失败: {}", e))?;
    let detail = format!("{} / {}", updated.role, updated.status);
    insert_activity(
        &tx,
        &updated.team_id,
        &actor,
        "update_member",
        "member",
        Some(&updated.id),
        Some(&updated.user_name),
        Some(&detail),
        now,
    )?;
    tx.commit().map_err(|e| format!("提交事务失败: {}", e))?;
    Ok(updated)
}

pub fn remove_team_member<R: Runtime>(
    app: &tauri::AppHandle<R>,
    member_id: &str,
    actor: Option<&str>,
) -> Result<(), String> {
    let mut conn = get_conn(app)?;
    let actor = super::permissions::normalize_actor(actor)?;
    let member: TeamMember = conn
        .query_row(
            "SELECT id, team_id, user_name, email, role, status, joined_at, updated_at
             FROM team_members
             WHERE id = ?1",
            rusqlite::params![member_id],
            super::map_team_member_row,
        )
        .map_err(|_| format!("团队成员不存在: {}", member_id))?;

    super::permissions::ensure_team_active(&conn, &member.team_id)?;
    super::permissions::ensure_actor_can(
        &conn,
        &member.team_id,
        &actor,
        super::permissions::TeamPermission::Own,
    )?;

    if member.role == "owner" && member.status == "active" {
        let owner_count = count_active_owners(&conn, &member.team_id, Some(&member.id))?;
        if owner_count == 0 {
            return Err("团队至少需要保留一名启用中的负责人".to_string());
        }
    }

    let now = now_ms();
    let tx = conn
        .transaction()
        .map_err(|e| format!("开启事务失败: {}", e))?;
    tx.execute(
        "DELETE FROM team_members WHERE id = ?1",
        rusqlite::params![member_id],
    )
    .map_err(|e| format!("移除团队成员失败: {}", e))?;

    tx.execute(
        "UPDATE teams SET updated_at = ?1 WHERE id = ?2",
        rusqlite::params![now, member.team_id],
    )
    .map_err(|e| format!("刷新团队更新时间失败: {}", e))?;

    let detail = format!("{} / {}", member.role, member.status);
    insert_activity(
        &tx,
        &member.team_id,
        &actor,
        "remove_member",
        "member",
        Some(&member.id),
        Some(&member.user_name),
        Some(&detail),
        now,
    )?;
    tx.commit().map_err(|e| format!("提交事务失败: {}", e))?;

    Ok(())
}
