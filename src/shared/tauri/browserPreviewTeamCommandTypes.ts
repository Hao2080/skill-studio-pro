import type { BrowserPreviewState } from "./browserPreviewStateMocks";

export type GetSnapshots = (
  state: BrowserPreviewState,
  skillId: string,
) => BrowserPreviewState["snapshotsBySkillId"][string];

export type BuildTeamDeliveryOverview = (state: BrowserPreviewState, skillId: string) => unknown;

export type IsSystemSnapshot = (
  snapshot: { source?: string | null } | null | undefined,
) => boolean;

export interface BrowserPreviewTeamCommandHelpers {
  getSnapshots: GetSnapshots;
  buildTeamDeliveryOverview: BuildTeamDeliveryOverview;
  isSystemSnapshot: IsSystemSnapshot;
}
