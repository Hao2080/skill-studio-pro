use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::domain::{TeamMember, TeamSubmission};

pub fn map_team_submission(row: &Row) -> rusqlite::Result<TeamSubmission> {
    Ok(TeamSubmission {
        id: row.get(0)?,
        team_id: row.get(1)?,
        team_skill_id: row.get(2)?,
        base_team_version_id: row.get(3)?,
        base_revision_hash: row.get(4)?,
        source_skill_id: row.get(5)?,
        source_snapshot_id: row.get(6)?,
        submitter: row.get(7)?,
        submit_message: row.get(8)?,
        submitted_at: row.get(9)?,
        status: row.get(10)?,
        resolved_at: row.get(11)?,
    })
}

pub fn list_team_submissions_sql() -> &'static str {
    "SELECT id, team_id, team_skill_id, base_team_version_id, base_revision_hash, source_skill_id, source_snapshot_id, submitter, submit_message, submitted_at, status, resolved_at
     FROM team_submissions
     WHERE team_id = ?1
       AND status = 'pending'
     ORDER BY submitted_at DESC, id DESC"
}

pub fn create_team_member_sql() -> &'static str {
    "INSERT INTO team_members (id, team_id, user_name, email, role, status, joined_at, updated_at)
     VALUES (?1, ?2, 'jensen', NULL, 'owner', 'active', ?3, ?3)"
}

pub fn insert_default_team_member(
    conn: &Connection,
    team_id: &str,
    joined_at: i64,
) -> Result<TeamMember, String> {
    insert_team_owner_member(conn, team_id, "jensen", joined_at)
}

pub fn insert_team_owner_member(
    conn: &Connection,
    team_id: &str,
    user_name: &str,
    joined_at: i64,
) -> Result<TeamMember, String> {
    let member = TeamMember {
        id: Uuid::new_v4().to_string(),
        team_id: team_id.to_string(),
        user_name: user_name.to_string(),
        email: None,
        role: "owner".to_string(),
        status: "active".to_string(),
        joined_at,
        updated_at: joined_at,
    };

    if user_name == "jensen" {
        conn.execute(
            create_team_member_sql(),
            params![member.id, member.team_id, member.joined_at],
        )
        .map_err(|e| format!("创建默认团队成员失败: {}", e))?;
    } else {
        conn.execute(
            "INSERT INTO team_members (id, team_id, user_name, email, role, status, joined_at, updated_at)
             VALUES (?1, ?2, ?3, NULL, 'owner', 'active', ?4, ?4)",
            params![member.id, member.team_id, member.user_name, member.joined_at],
        )
        .map_err(|e| format!("创建默认团队成员失败: {}", e))?;
    }

    Ok(member)
}

pub fn latest_team_version_path(
    conn: &Connection,
    team_skill_id: &str,
) -> Result<Option<String>, String> {
    conn.query_row(
        "SELECT snapshot_path FROM team_skill_versions WHERE team_skill_id = ?1 ORDER BY version_number DESC LIMIT 1",
        rusqlite::params![team_skill_id],
        |row: &Row| row.get(0),
    )
    .optional()
    .map_err(|e| format!("查询团队最新版本失败: {}", e))
}

pub fn latest_team_version_ref(
    conn: &Connection,
    team_skill_id: &str,
) -> Result<Option<(String, String)>, String> {
    conn.query_row(
        "SELECT id, revision_hash
         FROM team_skill_versions
         WHERE team_skill_id = ?1
         ORDER BY version_number DESC
         LIMIT 1",
        rusqlite::params![team_skill_id],
        |row: &Row| Ok((row.get(0)?, row.get(1)?)),
    )
    .optional()
    .map_err(|e| format!("查询团队最新版本引用失败: {}", e))
}

pub fn team_version_path_by_id(conn: &Connection, version_id: &str) -> Result<String, String> {
    conn.query_row(
        "SELECT snapshot_path FROM team_skill_versions WHERE id = ?1",
        rusqlite::params![version_id],
        |row: &Row| row.get(0),
    )
    .map_err(|_| format!("团队版本不存在: {}", version_id))
}

pub fn previous_team_version_path(
    conn: &Connection,
    version_id: &str,
) -> Result<Option<String>, String> {
    conn.query_row(
        "SELECT prev.snapshot_path
         FROM team_skill_versions current
         LEFT JOIN team_skill_versions prev
           ON prev.team_skill_id = current.team_skill_id
          AND prev.version_number = current.version_number - 1
         WHERE current.id = ?1",
        rusqlite::params![version_id],
        |row: &Row| row.get::<_, Option<String>>(0),
    )
    .map_err(|e| format!("查询团队上一版本失败: {}", e))
}

pub fn current_team_version_path(conn: &Connection, version_id: &str) -> Result<String, String> {
    conn.query_row(
        "SELECT snapshot_path FROM team_skill_versions WHERE id = ?1",
        rusqlite::params![version_id],
        |row: &Row| row.get(0),
    )
    .map_err(|_| format!("团队版本不存在: {}", version_id))
}

pub fn team_version_snapshot_path(conn: &Connection, version_id: &str) -> Result<String, String> {
    conn.query_row(
        "SELECT snapshot_path FROM team_skill_versions WHERE id = ?1",
        rusqlite::params![version_id],
        |row: &Row| row.get(0),
    )
    .map_err(|_| format!("团队版本不存在: {}", version_id))
}
