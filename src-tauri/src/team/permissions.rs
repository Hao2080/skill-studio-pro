#[derive(Debug, Clone, Copy)]
pub(super) enum TeamPermission {
    Submit,
    Review,
    Maintain,
    Own,
}

fn permission_label(permission: TeamPermission) -> &'static str {
    match permission {
        TeamPermission::Submit => "提交",
        TeamPermission::Review => "审核",
        TeamPermission::Maintain => "维护",
        TeamPermission::Own => "管理",
    }
}

fn role_level(role: &str) -> i64 {
    match role {
        "owner" => 4,
        "maintainer" => 3,
        "reviewer" => 2,
        "contributor" => 1,
        _ => 0,
    }
}

fn required_level(permission: TeamPermission) -> i64 {
    match permission {
        TeamPermission::Submit => 1,
        TeamPermission::Review => 2,
        TeamPermission::Maintain => 3,
        TeamPermission::Own => 4,
    }
}

pub(super) fn normalize_actor(actor: Option<&str>) -> Result<String, String> {
    let actor = actor.unwrap_or_default().trim();
    if actor.is_empty() {
        return Err("缺少团队操作者".to_string());
    }

    Ok(actor.to_string())
}

pub(super) fn ensure_team_active(conn: &rusqlite::Connection, team_id: &str) -> Result<(), String> {
    let status: String = conn
        .query_row(
            "SELECT status FROM teams WHERE id = ?1",
            rusqlite::params![team_id],
            |row| row.get(0),
        )
        .map_err(|_| format!("团队不存在: {}", team_id))?;

    if status != "active" {
        return Err("团队已归档，不能执行该操作".to_string());
    }

    Ok(())
}

pub(super) fn ensure_actor_can(
    conn: &rusqlite::Connection,
    team_id: &str,
    actor: &str,
    permission: TeamPermission,
) -> Result<(), String> {
    let actor = normalize_actor(Some(actor))?;
    let member = conn
        .query_row(
            "SELECT role, status FROM team_members
             WHERE team_id = ?1
               AND lower(user_name) = lower(?2)",
            rusqlite::params![team_id, actor],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        )
        .map_err(|_| {
            format!(
                "{} 不是当前团队成员，无法执行{}操作",
                actor,
                permission_label(permission)
            )
        })?;

    if member.1 != "active" {
        return Err(format!(
            "{} 当前不是启用成员，无法执行{}操作",
            actor,
            permission_label(permission)
        ));
    }

    if role_level(&member.0) < required_level(permission) {
        return Err(format!(
            "{} 的角色权限不足，无法执行{}操作",
            actor,
            permission_label(permission)
        ));
    }

    Ok(())
}
