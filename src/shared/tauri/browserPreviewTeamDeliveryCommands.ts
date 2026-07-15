import type { TeamDeliveryRecord, TeamSubmission } from "@/types/team";
import { cloneValue } from "./browserPreviewFileMocks";
import type { BrowserPreviewState } from "./browserPreviewStateMocks";
import { pushTeamActivity } from "./browserPreviewTeamActivityMocks";
import type { BrowserPreviewTeamCommandHelpers } from "./browserPreviewTeamCommandTypes";

export function invokeBrowserPreviewTeamDeliveryCommand<T>(
  state: BrowserPreviewState,
  command: string,
  args: Record<string, unknown> | undefined,
  helpers: BrowserPreviewTeamCommandHelpers,
) {
  switch (command) {
case "team_skill_delivery_get": {
  const skillId = args?.skillId as string;
  return cloneValue(helpers.buildTeamDeliveryOverview(state, skillId)) as T;
}
case "team_submit": {
  const input = args?.input as {
    teamId: string;
    teamSkillId?: string;
    sourceSkillId: string;
    sourceSnapshotId: string;
    submitter: string;
    submitMessage?: string;
  };

  const nextSubmission: TeamSubmission = {
    id: `submission-${Date.now()}`,
    teamId: input.teamId,
    teamSkillId: input.teamSkillId ?? state.teamSkillsByTeamId[input.teamId]?.[0]?.id,
    baseTeamVersionId: state.teamDeliveryTargetsBySkillId[input.sourceSkillId]?.[input.teamId]?.teamVersionId,
    baseRevisionHash: state.teamDeliveryTargetsBySkillId[input.sourceSkillId]?.[input.teamId]?.teamVersionId,
    sourceSkillId: input.sourceSkillId,
    sourceSnapshotId: input.sourceSnapshotId,
    submitter: input.submitter,
    submitMessage: input.submitMessage,
    submittedAt: Date.now(),
    status: "pending",
  };

  state.submissionsByTeamId[input.teamId] = [nextSubmission, ...(state.submissionsByTeamId[input.teamId] ?? [])];
  pushTeamActivity(state, {
    teamId: input.teamId,
    actor: input.submitter,
    action: "submit",
    targetType: "submission",
    targetId: nextSubmission.id,
    targetLabel: state.skills.find((item) => item.id === input.sourceSkillId)?.name ?? input.sourceSkillId,
    detail: input.submitMessage,
    createdAt: nextSubmission.submittedAt,
  });
  return cloneValue(nextSubmission) as T;
}
case "team_snapshot_submit_to_teams": {
  const input = args?.input as {
    skillId: string;
    snapshotId: string;
    teamIds: string[];
    submitter: string;
    submitMessage?: string;
  };
  const snapshots = helpers.getSnapshots(state, input.skillId);
  const snapshot = snapshots.find((item) => item.id === input.snapshotId);

  if (!snapshot) {
    throw new Error(`目标快照不存在: ${input.snapshotId}`);
  }

  if (helpers.isSystemSnapshot(snapshot)) {
    throw new Error("系统恢复点不能直接交付团队");
  }

  const currentTargets = state.teamDeliveryTargetsBySkillId[input.skillId] ?? {};
  state.teamDeliveryTargetsBySkillId[input.skillId] = currentTargets;

  const nextRecords = [...(state.teamDeliveryRecordsBySkillId[input.skillId] ?? [])];
  const createdAt = Date.now();
  const results = input.teamIds.map((teamId, index) => {
    const team = state.teams.find((item) => item.id === teamId);
    if (!team) {
      throw new Error(`目标团队不存在: ${teamId}`);
    }

    const currentTarget = currentTargets[teamId];
    const teamSkill = state.teamSkillsByTeamId[teamId]?.[0];
    const submissions = [...(state.submissionsByTeamId[teamId] ?? [])];
    const existingPending = submissions.find(
      (submission) => submission.sourceSkillId === input.skillId && submission.status === "pending",
    );
    const action =
      existingPending?.sourceSnapshotId === snapshot.id
        ? "resubmit"
        : existingPending
          ? "replace_pending"
          : currentTarget?.snapshotId === snapshot.id
            ? "resubmit"
            : currentTarget
              ? "switch"
              : "submit";

    if (existingPending) {
      existingPending.status = "withdrawn";
      existingPending.resolvedAt = createdAt + index - 1;
    }

    const nextSubmission: TeamSubmission = {
      id: `submission-${createdAt + index}`,
      teamId,
      teamSkillId: teamSkill?.id,
      baseTeamVersionId: currentTarget?.teamVersionId,
      baseRevisionHash: currentTarget?.teamVersionId,
      sourceSkillId: input.skillId,
      sourceSnapshotId: snapshot.id,
      submitter: input.submitter,
      submitMessage: input.submitMessage,
      submittedAt: createdAt + index,
      status: "pending",
    };

    state.submissionsByTeamId[teamId] = [nextSubmission, ...submissions];

    const record: TeamDeliveryRecord = {
      id: `team-record-${createdAt + index}`,
      teamId,
      teamName: team.name,
      sourceSkillId: input.skillId,
      sourceSnapshotId: snapshot.id,
      sourceSnapshotNumber: snapshot.snapshotNumber,
      changeSummary: snapshot.changeSummary,
      teamSkillId: teamSkill?.id,
      teamSkillName: teamSkill?.name,
      submissionId: nextSubmission.id,
      action,
      status: "pending",
      actor: input.submitter,
      note: input.submitMessage,
      createdAt: createdAt + index,
    };
    nextRecords.unshift(record);
    pushTeamActivity(state, {
      teamId,
      actor: input.submitter,
      action: "submit",
      targetType: "submission",
      targetId: nextSubmission.id,
      targetLabel: teamSkill?.name ?? state.skills.find((item) => item.id === input.skillId)?.name,
      detail: input.submitMessage,
      createdAt: createdAt + index,
    });
    return record;
  });

  state.teamDeliveryRecordsBySkillId[input.skillId] = nextRecords;
  return cloneValue(results) as T;
}
case "team_pending_delivery_withdraw": {
  const input = args?.input as { skillId: string; teamIds: string[]; actor?: string };
  const snapshots = helpers.getSnapshots(state, input.skillId);
  const snapshotById = Object.fromEntries(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  const nextRecords = [...(state.teamDeliveryRecordsBySkillId[input.skillId] ?? [])];
  const createdAt = Date.now();
  const results = input.teamIds.map((teamId, index) => {
    const team = state.teams.find((item) => item.id === teamId);
    if (!team) {
      throw new Error(`目标团队不存在: ${teamId}`);
    }

    const submissions = [...(state.submissionsByTeamId[teamId] ?? [])];
    const pendingSubmission = submissions.find(
      (submission) => submission.sourceSkillId === input.skillId && submission.status === "pending",
    );
    const snapshot = pendingSubmission ? snapshotById[pendingSubmission.sourceSnapshotId] : undefined;

    if (pendingSubmission) {
      pendingSubmission.status = "withdrawn";
      pendingSubmission.resolvedAt = createdAt + index;
    }

    state.submissionsByTeamId[teamId] = submissions;

    const record: TeamDeliveryRecord = {
      id: `team-record-${createdAt + index}`,
      teamId,
      teamName: team.name,
      sourceSkillId: input.skillId,
      sourceSnapshotId: snapshot?.id,
      sourceSnapshotNumber: snapshot?.snapshotNumber,
      changeSummary: snapshot?.changeSummary,
      teamSkillId: pendingSubmission?.teamSkillId,
      teamSkillName: state.teamSkillsByTeamId[teamId]?.[0]?.name,
      submissionId: pendingSubmission?.id,
      action: "withdraw",
      status: pendingSubmission ? "success" : "failed",
      actor: input.actor,
      note: pendingSubmission ? pendingSubmission.submitMessage : "当前没有待审交付",
      createdAt: createdAt + index,
    };
    nextRecords.unshift(record);
    if (pendingSubmission) {
      pushTeamActivity(state, {
        teamId,
        actor: input.actor?.trim() || "jensen",
        action: "withdraw_submission",
        targetType: "submission",
        targetId: pendingSubmission.id,
        targetLabel: snapshot ? `Snapshot ${snapshot.snapshotNumber}` : input.skillId,
        detail: pendingSubmission.submitMessage,
        createdAt: createdAt + index,
      });
    }
    return record;
  });

  state.teamDeliveryRecordsBySkillId[input.skillId] = nextRecords;
  return cloneValue(results) as T;
}
case "team_skill_remove_from_teams": {
  const input = args?.input as { skillId: string; teamIds: string[]; actor?: string };
  const snapshots = helpers.getSnapshots(state, input.skillId);
  const snapshotById = Object.fromEntries(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  const currentTargets = state.teamDeliveryTargetsBySkillId[input.skillId] ?? {};
  const nextRecords = [...(state.teamDeliveryRecordsBySkillId[input.skillId] ?? [])];
  const createdAt = Date.now();
  const results = input.teamIds.map((teamId, index) => {
    const team = state.teams.find((item) => item.id === teamId);
    if (!team) {
      throw new Error(`目标团队不存在: ${teamId}`);
    }

    const currentTarget = currentTargets[teamId];
    const snapshot = currentTarget ? snapshotById[currentTarget.snapshotId] : undefined;

    if (currentTarget) {
      delete currentTargets[teamId];
    }

    const record: TeamDeliveryRecord = {
      id: `team-record-${createdAt + index}`,
      teamId,
      teamName: team.name,
      sourceSkillId: input.skillId,
      sourceSnapshotId: snapshot?.id,
      sourceSnapshotNumber: snapshot?.snapshotNumber,
      changeSummary: snapshot?.changeSummary,
      teamSkillId: currentTarget?.teamSkillId,
      teamSkillName: state.teamSkillsByTeamId[teamId]?.[0]?.name,
      teamVersionId: currentTarget?.teamVersionId,
      teamVersionNumber: currentTarget?.teamVersionNumber,
      action: "remove",
      status: currentTarget ? "success" : "failed",
      actor: input.actor,
      note: currentTarget ? "仅解除当前团队承接，不删除团队历史版本。" : "当前团队尚未承接该技能",
      createdAt: createdAt + index,
    };
    nextRecords.unshift(record);
    if (currentTarget) {
      pushTeamActivity(state, {
        teamId,
        actor: input.actor?.trim() || "jensen",
        action: "remove_serving",
        targetType: "team_skill",
        targetId: currentTarget.teamVersionId ?? currentTarget.teamSkillId ?? input.skillId,
        targetLabel: state.teamSkillsByTeamId[teamId]?.[0]?.name ?? input.skillId,
        detail: "仅解除当前团队承接，不删除团队历史版本。",
        createdAt: createdAt + index,
      });
    }
    return record;
  });

  state.teamDeliveryTargetsBySkillId[input.skillId] = currentTargets;
  state.teamDeliveryRecordsBySkillId[input.skillId] = nextRecords;
  return cloneValue(results) as T;
}
    default:
      return undefined;
  }
}
