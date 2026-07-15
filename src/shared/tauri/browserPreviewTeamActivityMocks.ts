import type { TeamActivityLog } from "@/types/team";
import type { BrowserPreviewState } from "./browserPreviewStateMocks";

export function pushTeamActivity(
  state: BrowserPreviewState,
  input: Omit<TeamActivityLog, "id"> & { id?: string },
) {
  const record: TeamActivityLog = {
    id: input.id ?? `team-activity-${input.createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    teamId: input.teamId,
    actor: input.actor,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    targetLabel: input.targetLabel,
    detail: input.detail,
    createdAt: input.createdAt,
  };
  state.activityLogsByTeamId[input.teamId] = [record, ...(state.activityLogsByTeamId[input.teamId] ?? [])];
  return record;
}
