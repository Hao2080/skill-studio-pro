use tauri::AppHandle;

use crate::{
    domain::{
        CheckPullImpactInput, CreateTeamMemberInput, MergeSubmissionInput, PullTeamVersionInput,
        RejectSubmissionInput, RemoveSkillFromTeamsInput, SetRecommendedVersionInput,
        SetTeamStatusInput, SkillFileNode, SkillTeamDeliveryOverview, SnapshotDiffResult,
        SubmitSnapshotToTeamsInput, SubmitToTeamInput, Team, TeamActivityLog, TeamDeliveryRecord,
        TeamMember, TeamPullImpact, TeamSkill, TeamSkillVersion, TeamSubmission,
        TeamSubmissionMergePreview, UpdateTeamInput, UpdateTeamMemberInput,
        WithdrawPendingTeamDeliveriesInput,
    },
    team,
};

#[tauri::command]
pub fn team_list(app: AppHandle) -> Result<Vec<Team>, String> {
    team::list_teams(&app)
}

#[tauri::command]
pub fn team_create(app: AppHandle, input: crate::domain::CreateTeamInput) -> Result<Team, String> {
    team::create_team(&app, &input)
}

#[tauri::command]
pub fn team_update(app: AppHandle, input: UpdateTeamInput) -> Result<Team, String> {
    super::validate_required_id("teamId", &input.team_id)?;
    team::update_team(&app, &input)
}

#[tauri::command]
pub fn team_set_status(app: AppHandle, input: SetTeamStatusInput) -> Result<Team, String> {
    super::validate_required_id("teamId", &input.team_id)?;
    team::set_team_status(&app, &input)
}

#[tauri::command]
pub fn team_delete(app: AppHandle, team_id: String, actor: Option<String>) -> Result<(), String> {
    super::validate_required_id("teamId", &team_id)?;
    team::delete_team(&app, &team_id, actor.as_deref())
}

#[tauri::command]
pub fn team_member_list(app: AppHandle, team_id: String) -> Result<Vec<TeamMember>, String> {
    super::validate_required_id("teamId", &team_id)?;
    team::list_team_members(&app, &team_id)
}

#[tauri::command]
pub fn team_member_create(
    app: AppHandle,
    input: CreateTeamMemberInput,
) -> Result<TeamMember, String> {
    super::validate_required_id("teamId", &input.team_id)?;
    team::create_team_member(&app, &input)
}

#[tauri::command]
pub fn team_member_update(
    app: AppHandle,
    input: UpdateTeamMemberInput,
) -> Result<TeamMember, String> {
    super::validate_required_id("memberId", &input.member_id)?;
    team::update_team_member(&app, &input)
}

#[tauri::command]
pub fn team_member_remove(
    app: AppHandle,
    member_id: String,
    actor: Option<String>,
) -> Result<(), String> {
    super::validate_required_id("memberId", &member_id)?;
    team::remove_team_member(&app, &member_id, actor.as_deref())
}

#[tauri::command]
pub fn team_activity_list(
    app: AppHandle,
    team_id: String,
    limit: Option<i64>,
) -> Result<Vec<TeamActivityLog>, String> {
    super::validate_required_id("teamId", &team_id)?;
    team::list_team_activity_logs(&app, &team_id, limit)
}

#[tauri::command]
pub fn team_skill_list(app: AppHandle, team_id: String) -> Result<Vec<TeamSkill>, String> {
    super::validate_required_id("teamId", &team_id)?;
    team::list_team_skills(&app, &team_id)
}

#[tauri::command]
pub fn team_skill_version_list(
    app: AppHandle,
    team_skill_id: String,
) -> Result<Vec<TeamSkillVersion>, String> {
    super::validate_required_id("teamSkillId", &team_skill_id)?;
    team::list_team_skill_versions(&app, &team_skill_id)
}

#[tauri::command]
pub fn team_submit(app: AppHandle, input: SubmitToTeamInput) -> Result<TeamSubmission, String> {
    super::validate_required_id("teamId", &input.team_id)?;
    super::validate_optional_id("teamSkillId", input.team_skill_id.as_deref())?;
    super::validate_required_id("sourceSkillId", &input.source_skill_id)?;
    super::validate_required_id("sourceSnapshotId", &input.source_snapshot_id)?;
    team::submit_to_team(&app, &input)
}

#[tauri::command]
pub fn team_submission_list(
    app: AppHandle,
    team_id: String,
) -> Result<Vec<TeamSubmission>, String> {
    super::validate_required_id("teamId", &team_id)?;
    team::list_team_submissions(&app, &team_id)
}

#[tauri::command]
pub fn team_submission_merge(
    app: AppHandle,
    input: MergeSubmissionInput,
) -> Result<TeamSkillVersion, String> {
    super::validate_required_id("submissionId", &input.submission_id)?;
    team::merge_submission(&app, &input)
}

#[tauri::command]
pub fn team_submission_reject(app: AppHandle, input: RejectSubmissionInput) -> Result<(), String> {
    super::validate_required_id("submissionId", &input.submission_id)?;
    team::reject_submission(&app, &input)
}

#[tauri::command]
pub fn team_submission_diff(
    app: AppHandle,
    submission_id: String,
) -> Result<SnapshotDiffResult, String> {
    super::validate_required_id("submissionId", &submission_id)?;
    team::team_submission_diff(&app, &submission_id)
}

#[tauri::command]
pub fn team_submission_merge_preview(
    app: AppHandle,
    submission_id: String,
) -> Result<TeamSubmissionMergePreview, String> {
    super::validate_required_id("submissionId", &submission_id)?;
    team::team_submission_merge_preview(&app, &submission_id)
}

#[tauri::command]
pub fn team_version_diff(app: AppHandle, version_id: String) -> Result<SnapshotDiffResult, String> {
    super::validate_required_id("versionId", &version_id)?;
    team::team_version_diff(&app, &version_id)
}

#[tauri::command]
pub fn team_pull_impact_check(
    app: AppHandle,
    input: CheckPullImpactInput,
) -> Result<TeamPullImpact, String> {
    super::validate_required_id("teamVersionId", &input.team_version_id)?;
    super::validate_optional_id("targetSkillId", input.target_skill_id.as_deref())?;
    team::team_pull_impact_check(&app, &input)
}

#[tauri::command]
pub fn team_version_pull(app: AppHandle, input: PullTeamVersionInput) -> Result<String, String> {
    super::validate_required_id("teamVersionId", &input.team_version_id)?;
    super::validate_optional_id("targetSkillId", input.target_skill_id.as_deref())?;
    team::pull_team_version(&app, &input)
}

#[tauri::command]
pub fn team_version_read_file(
    app: AppHandle,
    version_id: String,
    relative_path: String,
) -> Result<String, String> {
    super::validate_required_id("versionId", &version_id)?;
    team::read_team_version_file(&app, &version_id, &relative_path)
}

#[tauri::command]
pub fn team_version_list_files(
    app: AppHandle,
    version_id: String,
) -> Result<SkillFileNode, String> {
    super::validate_required_id("versionId", &version_id)?;
    team::list_team_version_files(&app, &version_id)
}

#[tauri::command]
pub fn team_version_set_recommended(
    app: AppHandle,
    input: SetRecommendedVersionInput,
) -> Result<(), String> {
    super::validate_required_id("versionId", &input.version_id)?;
    team::set_recommended_version(&app, &input.version_id, &input.actor)
}

#[tauri::command]
pub fn team_skill_delivery_get(
    app: AppHandle,
    skill_id: String,
) -> Result<SkillTeamDeliveryOverview, String> {
    super::validate_required_id("skillId", &skill_id)?;
    team::get_skill_team_deliveries(&app, &skill_id)
}

#[tauri::command]
pub fn team_snapshot_submit_to_teams(
    app: AppHandle,
    input: SubmitSnapshotToTeamsInput,
) -> Result<Vec<TeamDeliveryRecord>, String> {
    super::validate_required_id("skillId", &input.skill_id)?;
    super::validate_required_id("snapshotId", &input.snapshot_id)?;
    team::submit_snapshot_to_teams(&app, &input)
}

#[tauri::command]
pub fn team_pending_delivery_withdraw(
    app: AppHandle,
    input: WithdrawPendingTeamDeliveriesInput,
) -> Result<Vec<TeamDeliveryRecord>, String> {
    super::validate_required_id("skillId", &input.skill_id)?;
    team::withdraw_pending_team_deliveries(&app, &input)
}

#[tauri::command]
pub fn team_skill_remove_from_teams(
    app: AppHandle,
    input: RemoveSkillFromTeamsInput,
) -> Result<Vec<TeamDeliveryRecord>, String> {
    super::validate_required_id("skillId", &input.skill_id)?;
    team::remove_skill_from_teams(&app, &input)
}
