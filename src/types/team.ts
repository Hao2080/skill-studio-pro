import type { SnapshotDiffResult } from "./skill";

export interface Team {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  status: "active" | "archived";
}

export interface TeamMember {
  id: string;
  teamId: string;
  userName: string;
  email?: string;
  role: TeamMemberRole;
  status: "active" | "invited" | "disabled";
  joinedAt: number;
  updatedAt: number;
}

export type TeamMemberRole = "owner" | "maintainer" | "reviewer" | "contributor" | "viewer";

export interface TeamSkill {
  id: string;
  teamId: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: number;
}

export interface TeamSkillVersion {
  id: string;
  teamSkillId: string;
  versionNumber: number;
  snapshotPath: string;
  revisionHash: string;
  changeSummary?: string;
  mergedFromSubmissionId?: string;
  mergedBy?: string;
  mergedAt: number;
  isRecommended: boolean;
}

export interface TeamSubmission {
  id: string;
  teamId: string;
  teamSkillId?: string;
  baseTeamVersionId?: string;
  baseRevisionHash?: string;
  sourceSkillId: string;
  sourceSnapshotId: string;
  submitter: string;
  submitMessage?: string;
  submittedAt: number;
  status: "pending" | "merged" | "rejected" | "withdrawn";
  resolvedAt?: number;
}

export interface TeamPendingDelivery {
  submissionId: string;
  teamId: string;
  teamName: string;
  teamSkillId?: string;
  sourceSnapshotId: string;
  sourceSnapshotNumber: number;
  changeSummary?: string;
  submitter: string;
  submitMessage?: string;
  submittedAt: number;
}

export interface TeamDeliveryTarget {
  teamId: string;
  teamName: string;
  sourceSkillId: string;
  sourceSnapshotId: string;
  sourceSnapshotNumber: number;
  changeSummary?: string;
  teamSkillId?: string;
  teamSkillName?: string;
  teamVersionId?: string;
  teamVersionNumber?: number;
  deliveredAt: number;
}

export interface TeamDeliveryRecord {
  id: string;
  teamId: string;
  teamName: string;
  sourceSkillId: string;
  sourceSnapshotId?: string;
  sourceSnapshotNumber?: number;
  changeSummary?: string;
  teamSkillId?: string;
  teamSkillName?: string;
  teamVersionId?: string;
  teamVersionNumber?: number;
  submissionId?: string;
  action: string;
  status: "pending" | "success" | "failed";
  actor?: string;
  note?: string;
  createdAt: number;
}

export interface TeamActivityLog {
  id: string;
  teamId: string;
  actor: string;
  action: string;
  targetType: string;
  targetId?: string;
  targetLabel?: string;
  detail?: string;
  createdAt: number;
}

export interface SkillTeamDeliveryStatus {
  teamId: string;
  teamName: string;
  teamDescription?: string;
  currentTarget?: TeamDeliveryTarget;
  pendingDelivery?: TeamPendingDelivery;
  lastRecord?: TeamDeliveryRecord;
}

export interface SkillTeamDeliveryOverview {
  deliveries: SkillTeamDeliveryStatus[];
  recentRecords: TeamDeliveryRecord[];
}

export interface CreateTeamInput {
  name: string;
  description?: string;
  actor?: string;
}

export interface UpdateTeamInput {
  teamId: string;
  name: string;
  description?: string;
  actor?: string;
}

export interface SetTeamStatusInput {
  teamId: string;
  status: Team["status"];
  actor?: string;
}

export interface CreateTeamMemberInput {
  teamId: string;
  userName: string;
  email?: string;
  role: TeamMemberRole;
  actor?: string;
}

export interface UpdateTeamMemberInput {
  memberId: string;
  userName: string;
  email?: string;
  role: TeamMemberRole;
  status: TeamMember["status"];
  actor?: string;
}

export interface SubmitToTeamInput {
  teamId: string;
  teamSkillId?: string;
  sourceSkillId: string;
  sourceSnapshotId: string;
  submitter: string;
  submitMessage?: string;
}

export interface MergeSubmissionInput {
  submissionId: string;
  mergedBy: string;
  changeSummary?: string;
  resolutionMode?: "auto" | "manual_override" | "manual_files";
  fileResolutions?: TeamSubmissionFileResolutionInput[];
}

export interface TeamSubmissionFileResolutionInput {
  filePath: string;
  resolution: "incoming" | "current";
}

export interface RejectSubmissionInput {
  submissionId: string;
  actor: string;
}

export interface SubmitSnapshotToTeamsInput {
  skillId: string;
  snapshotId: string;
  teamIds: string[];
  submitter: string;
  submitMessage?: string;
}

export interface WithdrawPendingTeamDeliveriesInput {
  skillId: string;
  teamIds: string[];
  actor?: string;
}

export interface RemoveSkillFromTeamsInput {
  skillId: string;
  teamIds: string[];
  actor?: string;
}

export interface PullTeamVersionInput {
  teamVersionId: string;
  mode: "new_skill" | "append_snapshot";
  targetSkillId?: string;
}

export interface SetRecommendedVersionInput {
  versionId: string;
  actor: string;
}

export type TeamDiffResult = SnapshotDiffResult;

export interface TeamSubmissionDiffInput {
  submissionId: string;
}

export interface TeamVersionDiffInput {
  teamVersionId: string;
}

export interface CheckPullImpactInput {
  teamVersionId: string;
  mode: "new_skill" | "append_snapshot";
  targetSkillId?: string;
}

export interface TeamPullImpact {
  hasLocalChanges: boolean;
}

export interface TeamSubmissionMergeVersionRef {
  id: string;
  versionNumber: number;
  revisionHash: string;
}

export interface TeamSubmissionMergePreview {
  submissionId: string;
  baseVersion?: TeamSubmissionMergeVersionRef;
  currentVersion?: TeamSubmissionMergeVersionRef;
  staleBase: boolean;
  canAutoMerge: boolean;
  requiresManualMerge: boolean;
  changedFiles: string[];
  concurrentlyChangedFiles: string[];
  conflictingFiles: string[];
  addedFiles: string[];
  modifiedFiles: string[];
  deletedFiles: string[];
  summary: "new_skill" | "clean" | "stale_clean" | "conflict" | string;
}
