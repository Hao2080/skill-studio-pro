import { invokeCommand } from "@/shared/tauri/invokeCommand";
import type { SkillFileNode } from "@/types/skill";
import type {
  CreateTeamInput,
  CreateTeamMemberInput,
  MergeSubmissionInput,
  PullTeamVersionInput,
  RejectSubmissionInput,
  RemoveSkillFromTeamsInput,
  SetRecommendedVersionInput,
  SetTeamStatusInput,
  SkillTeamDeliveryOverview,
  Team,
  TeamActivityLog,
  TeamDeliveryRecord,
  TeamDiffResult,
  TeamMember,
  TeamPullImpact,
  TeamSkill,
  TeamSkillVersion,
  TeamSubmission,
  TeamSubmissionMergePreview,
  SubmitSnapshotToTeamsInput,
  SubmitToTeamInput,
  UpdateTeamInput,
  UpdateTeamMemberInput,
  WithdrawPendingTeamDeliveriesInput,
} from "@/types/team";

export async function listTeams(): Promise<Team[]> {
  return invokeCommand<Team[]>("team_list");
}

export async function createTeam(input: CreateTeamInput): Promise<Team> {
  return invokeCommand<Team>("team_create", { input });
}

export async function updateTeam(input: UpdateTeamInput): Promise<Team> {
  return invokeCommand<Team>("team_update", { input });
}

export async function setTeamStatus(input: SetTeamStatusInput): Promise<Team> {
  return invokeCommand<Team>("team_set_status", { input });
}

export async function deleteTeam(teamId: string, actor?: string): Promise<void> {
  return invokeCommand<void>("team_delete", { teamId, actor });
}

export async function listTeamSkills(teamId: string): Promise<TeamSkill[]> {
  return invokeCommand<TeamSkill[]>("team_skill_list", { teamId });
}

export async function listTeamMembers(teamId: string): Promise<TeamMember[]> {
  return invokeCommand<TeamMember[]>("team_member_list", { teamId });
}

export async function createTeamMember(input: CreateTeamMemberInput): Promise<TeamMember> {
  return invokeCommand<TeamMember>("team_member_create", { input });
}

export async function updateTeamMember(input: UpdateTeamMemberInput): Promise<TeamMember> {
  return invokeCommand<TeamMember>("team_member_update", { input });
}

export async function removeTeamMember(memberId: string, actor?: string): Promise<void> {
  return invokeCommand<void>("team_member_remove", { memberId, actor });
}

export async function listTeamActivityLogs(teamId: string, limit?: number): Promise<TeamActivityLog[]> {
  return invokeCommand<TeamActivityLog[]>("team_activity_list", { teamId, limit });
}

export async function listTeamSubmissions(teamId: string): Promise<TeamSubmission[]> {
  return invokeCommand<TeamSubmission[]>("team_submission_list", { teamId });
}

export async function listTeamSkillVersions(teamSkillId: string): Promise<TeamSkillVersion[]> {
  return invokeCommand<TeamSkillVersion[]>("team_skill_version_list", { teamSkillId });
}

export async function loadSubmissionDiff(submissionId: string): Promise<TeamDiffResult> {
  return invokeCommand<TeamDiffResult>("team_submission_diff", { submissionId });
}

export async function loadSubmissionMergePreview(submissionId: string): Promise<TeamSubmissionMergePreview> {
  return invokeCommand<TeamSubmissionMergePreview>("team_submission_merge_preview", { submissionId });
}

export async function loadVersionDiff(versionId: string): Promise<TeamDiffResult> {
  return invokeCommand<TeamDiffResult>("team_version_diff", { versionId });
}

export async function checkPullImpact(
  input: { teamVersionId: string; mode: "new_skill" | "append_snapshot"; targetSkillId?: string },
): Promise<TeamPullImpact> {
  return invokeCommand<TeamPullImpact>("team_pull_impact_check", { input });
}

export async function listTeamVersionFiles(versionId: string): Promise<SkillFileNode> {
  return invokeCommand<SkillFileNode>("team_version_list_files", { versionId });
}

export async function readTeamVersionFile(versionId: string, relativePath: string): Promise<string> {
  return invokeCommand<string>("team_version_read_file", { versionId, relativePath });
}

export async function submitToTeam(input: SubmitToTeamInput): Promise<TeamSubmission> {
  return invokeCommand<TeamSubmission>("team_submit", { input });
}

export async function mergeSubmission(input: MergeSubmissionInput): Promise<TeamSkillVersion> {
  return invokeCommand<TeamSkillVersion>("team_submission_merge", { input });
}

export async function rejectSubmission(input: RejectSubmissionInput): Promise<void> {
  return invokeCommand<void>("team_submission_reject", { input });
}

export async function pullTeamVersion(input: PullTeamVersionInput): Promise<string> {
  return invokeCommand<string>("team_version_pull", { input });
}

export async function setRecommendedVersion(input: SetRecommendedVersionInput): Promise<void> {
  return invokeCommand<void>("team_version_set_recommended", { input });
}

export async function getSkillTeamDeliveries(skillId: string): Promise<SkillTeamDeliveryOverview> {
  return invokeCommand<SkillTeamDeliveryOverview>("team_skill_delivery_get", { skillId });
}

export async function submitSnapshotToTeams(
  input: SubmitSnapshotToTeamsInput,
): Promise<TeamDeliveryRecord[]> {
  return invokeCommand<TeamDeliveryRecord[]>("team_snapshot_submit_to_teams", { input });
}

export async function withdrawPendingTeamDeliveries(
  input: WithdrawPendingTeamDeliveriesInput,
): Promise<TeamDeliveryRecord[]> {
  return invokeCommand<TeamDeliveryRecord[]>("team_pending_delivery_withdraw", { input });
}

export async function removeSkillFromTeams(
  input: RemoveSkillFromTeamsInput,
): Promise<TeamDeliveryRecord[]> {
  return invokeCommand<TeamDeliveryRecord[]>("team_skill_remove_from_teams", { input });
}
