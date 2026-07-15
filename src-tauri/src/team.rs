use rusqlite::Row;

#[path = "team/activity.rs"]
mod activity;
#[path = "team/crud.rs"]
mod crud;
#[path = "team/delivery.rs"]
mod delivery;
#[path = "team/diff.rs"]
mod diff_support;
#[path = "team/diffs.rs"]
mod diffs;
#[path = "team/file_browser.rs"]
mod file_browser;
#[path = "team/paths.rs"]
mod paths;
#[path = "team/permissions.rs"]
mod permissions;
#[path = "team/pull.rs"]
mod pull;
#[path = "team/sql.rs"]
mod sql;
#[path = "team/submissions.rs"]
mod submissions;

use crate::domain::{Team, TeamMember, TeamSkill, TeamSkillVersion};

pub use activity::list_team_activity_logs;
pub use crud::{
    create_team, create_team_member, delete_team, list_team_members, list_team_skill_versions,
    list_team_skills, list_teams, remove_team_member, set_team_status, update_team,
    update_team_member,
};
pub use delivery::{
    get_skill_team_deliveries, remove_skill_from_teams, submit_snapshot_to_teams,
    withdraw_pending_team_deliveries,
};
pub use diff_support::{
    diff_against_optional_base_at, ensure_empty_diff_dir_at, validate_pull_mode,
};
pub use diffs::{
    team_pull_impact_check, team_submission_diff, team_submission_merge_preview, team_version_diff,
};
pub use pull::{
    list_team_version_files, pull_team_version, read_team_version_file, set_recommended_version,
};
pub use sql::{create_team_member_sql, list_team_submissions_sql};
pub use submissions::{list_team_submissions, merge_submission, reject_submission, submit_to_team};

fn map_team_row(row: &Row) -> rusqlite::Result<Team> {
    Ok(Team {
        id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
        status: row.get(5)?,
    })
}

fn map_team_member_row(row: &Row) -> rusqlite::Result<TeamMember> {
    Ok(TeamMember {
        id: row.get(0)?,
        team_id: row.get(1)?,
        user_name: row.get(2)?,
        email: row.get(3)?,
        role: row.get(4)?,
        status: row.get(5)?,
        joined_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

fn map_team_skill_row(row: &Row) -> rusqlite::Result<TeamSkill> {
    Ok(TeamSkill {
        id: row.get(0)?,
        team_id: row.get(1)?,
        name: row.get(2)?,
        slug: row.get(3)?,
        description: row.get(4)?,
        created_at: row.get(5)?,
    })
}

fn map_team_skill_version_row(row: &Row) -> rusqlite::Result<TeamSkillVersion> {
    Ok(TeamSkillVersion {
        id: row.get(0)?,
        team_skill_id: row.get(1)?,
        version_number: row.get(2)?,
        snapshot_path: row.get(3)?,
        revision_hash: row.get(4)?,
        change_summary: row.get(5)?,
        merged_from_submission_id: row.get(6)?,
        merged_by: row.get(7)?,
        merged_at: row.get(8)?,
        is_recommended: row.get::<_, i64>(9)? != 0,
    })
}
