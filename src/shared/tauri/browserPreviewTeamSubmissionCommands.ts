import type { TeamSubmissionMergePreview } from "@/types/team";
import { cloneValue } from "./browserPreviewFileMocks";
import type { BrowserPreviewState } from "./browserPreviewStateMocks";
import { pushTeamActivity } from "./browserPreviewTeamActivityMocks";

export function invokeBrowserPreviewTeamSubmissionCommand<T>(
  state: BrowserPreviewState,
  command: string,
  args: Record<string, unknown> | undefined,
) {
  switch (command) {
case "team_submission_list": {
  const teamId = args?.teamId as string;
  return cloneValue(state.submissionsByTeamId[teamId] ?? []) as T;
}
case "team_submission_merge_preview": {
  const submissionId = args?.submissionId as string;
  const submission = Object.values(state.submissionsByTeamId)
    .flat()
    .find((item) => item.id === submissionId);
  if (!submission) {
    throw new Error(`团队提交不存在: ${submissionId}`);
  }

  const preview: TeamSubmissionMergePreview = {
    submissionId,
    baseVersion: submission.baseTeamVersionId
      ? { id: submission.baseTeamVersionId, versionNumber: 2, revisionHash: submission.baseRevisionHash ?? submission.baseTeamVersionId }
      : undefined,
    currentVersion: submission.teamSkillId
      ? { id: submission.baseTeamVersionId ?? "team-version-2", versionNumber: 2, revisionHash: submission.baseRevisionHash ?? "team-version-2" }
      : undefined,
    staleBase: false,
    canAutoMerge: true,
    requiresManualMerge: false,
    changedFiles: ["SKILL.md", "README.md"],
    concurrentlyChangedFiles: [],
    conflictingFiles: [],
    addedFiles: [],
    modifiedFiles: ["SKILL.md", "README.md"],
    deletedFiles: [],
    summary: submission.teamSkillId ? "clean" : "new_skill",
  };
  return cloneValue(preview) as T;
}
case "team_submission_merge": {
  const input = args?.input as {
    submissionId: string;
    mergedBy: string;
    changeSummary?: string;
    resolutionMode?: "auto" | "manual_override" | "manual_files";
    fileResolutions?: { filePath: string; resolution: "incoming" | "current" }[];
  };
  const createdAt = Date.now();
  for (const teamId of Object.keys(state.submissionsByTeamId)) {
    const submission = state.submissionsByTeamId[teamId].find((item) => item.id === input.submissionId);
    if (!submission) continue;
    submission.status = "merged";
    submission.resolvedAt = createdAt;
    const teamSkill = state.teamSkillsByTeamId[teamId]?.[0];
    const teamVersionId = `team-version-${createdAt}`;
    state.teamDeliveryTargetsBySkillId[submission.sourceSkillId] = {
      ...(state.teamDeliveryTargetsBySkillId[submission.sourceSkillId] ?? {}),
      [teamId]: {
        snapshotId: submission.sourceSnapshotId,
        teamSkillId: submission.teamSkillId ?? teamSkill?.id,
        teamVersionId,
        teamVersionNumber: 3,
        deliveredAt: createdAt,
      },
    };
    pushTeamActivity(state, {
      teamId,
      actor: input.mergedBy,
      action: "merge_submission",
      targetType: "team_version",
      targetId: teamVersionId,
      targetLabel: teamSkill?.name,
      detail: input.changeSummary ?? "v3",
      createdAt,
    });
    return cloneValue({
      id: teamVersionId,
      teamSkillId: submission.teamSkillId ?? teamSkill?.id ?? "team-skill-1",
      versionNumber: 3,
      snapshotPath: "preview",
      revisionHash: teamVersionId,
      changeSummary: input.changeSummary,
      mergedFromSubmissionId: input.submissionId,
      mergedBy: input.mergedBy,
      mergedAt: createdAt,
      isRecommended: false,
    }) as T;
  }
  throw new Error(`团队提交不存在: ${input.submissionId}`);
}
case "team_submission_reject": {
  const input = args?.input as { submissionId: string; actor: string };
  const resolvedAt = Date.now();
  for (const teamId of Object.keys(state.submissionsByTeamId)) {
    const submission = state.submissionsByTeamId[teamId].find((item) => item.id === input.submissionId);
    if (!submission) continue;
    submission.status = "rejected";
    submission.resolvedAt = resolvedAt;
    pushTeamActivity(state, {
      teamId,
      actor: input.actor,
      action: "reject_submission",
      targetType: "submission",
      targetId: submission.id,
      targetLabel: state.teamSkillsByTeamId[teamId]?.[0]?.name ?? submission.sourceSkillId,
      detail: "团队已拒绝当前提交",
      createdAt: resolvedAt,
    });
    return undefined as T;
  }
  throw new Error(`团队提交不存在: ${input.submissionId}`);
}
case "team_version_set_recommended": {
  const input = args?.input as { versionId: string; actor: string };
  if (!input.versionId) {
    throw new Error("版本不存在");
  }
  for (const targets of Object.values(state.teamDeliveryTargetsBySkillId)) {
    const matched = Object.entries(targets).find(([, target]) => target.teamVersionId === input.versionId);
    if (matched) {
      const [teamId, target] = matched;
      pushTeamActivity(state, {
        teamId,
        actor: input.actor,
        action: "set_recommended_version",
        targetType: "team_version",
        targetId: input.versionId,
        targetLabel: state.teamSkillsByTeamId[teamId]?.find((skill) => skill.id === target.teamSkillId)?.name,
        detail: target.teamVersionNumber ? `v${target.teamVersionNumber}` : undefined,
        createdAt: Date.now(),
      });
      break;
    }
  }
  return undefined as T;
}
    default:
      return undefined;
  }
}
