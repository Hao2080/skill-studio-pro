import type { SkillDetailVersionAction, SkillDetailVersionSection } from "./detailNavigation";
import type {
  ChangeStatus,
  PlatformReleaseRecord,
  SkillFileNode,
  SkillPlatformReleaseOverview,
  SkillSnapshot,
} from "@/types/skill";
import type { SkillTeamDeliveryOverview, TeamDeliveryRecord } from "@/types/team";

export type SkillOverviewTone = "active" | "neutral" | "ready" | "warning";
export type SkillOverviewMode = "setup" | "drafting" | "decision" | "reviewing" | "ready" | "attention";
export type SkillOverviewAttentionSeverity = "blocker" | "attention" | "watch";
export type SkillOverviewActivityKind = "snapshot" | "release" | "delivery";
export type UiLanguage = "zh-CN" | "en-US";

export type SkillOverviewAction =
  | { type: "open_files"; label: string; filePath?: string | null; emphasis?: "primary" | "secondary" | "ghost" }
  | {
      type: "open_versions";
      label: string;
      section?: SkillDetailVersionSection;
      action?: SkillDetailVersionAction;
      emphasis?: "primary" | "secondary" | "ghost";
    }
  | { type: "open_settings"; label: string; emphasis?: "primary" | "secondary" | "ghost" }
  | { type: "open_teams"; label: string; emphasis?: "primary" | "secondary" | "ghost" };

export interface SkillOverviewNextStep {
  title: string;
  reason: string;
  expectedResult: string;
  primaryAction: SkillOverviewAction;
  secondaryActions: SkillOverviewAction[];
}

export interface SkillOverviewSummaryItem {
  key: "workspace" | "version" | "release" | "delivery" | "recent";
  label: string;
  value: string;
  meta: string;
  tone: SkillOverviewTone;
  action: SkillOverviewAction;
}

export interface SkillOverviewLifecycleNode {
  key: "workspace" | "version" | "release" | "delivery";
  label: string;
  status: string;
  value: string;
  detail: string;
  meta: string | null;
  tone: SkillOverviewTone;
  action: SkillOverviewAction;
}

export interface SkillOverviewAttentionItem {
  key: string;
  severity: SkillOverviewAttentionSeverity;
  title: string;
  detail: string;
  impact: string;
  action: SkillOverviewAction;
}

export interface SkillOverviewActivityItem {
  key: string;
  kind: SkillOverviewActivityKind;
  title: string;
  detail: string;
  meta: string;
  timestamp: number;
  tone: SkillOverviewTone;
  action: SkillOverviewAction;
}

export interface SkillOverviewViewModel {
  dominantMode: SkillOverviewMode;
  dominantModeLabel: string;
  dominantModeTone: SkillOverviewTone;
  helperText: string;
  nextStep: SkillOverviewNextStep;
  summaryItems: SkillOverviewSummaryItem[];
  lifecycleNodes: SkillOverviewLifecycleNode[];
  attentionItems: SkillOverviewAttentionItem[];
  activities: SkillOverviewActivityItem[];
}

export interface BuildSkillOverviewInput {
  description?: string | null;
  changeStatus: ChangeStatus | null;
  snapshots: SkillSnapshot[];
  teamCount?: number;
  fileTree?: SkillFileNode | null;
  platformReleaseOverview?: SkillPlatformReleaseOverview | null;
  teamDeliveryOverview?: SkillTeamDeliveryOverview | null;
  language?: UiLanguage;
}

export interface SkillOverviewEntryPoint {
  path: string;
  name: string;
  reason: string;
}

export interface SkillOverviewDerivedState {
  hasSnapshots: boolean;
  hasChanges: boolean;
  changedFileCount: number;
  latestSnapshot: SkillSnapshot | null;
  activeSnapshot: SkillSnapshot | null;
  activeVersionBehindLatest: boolean;
  entryPoint: SkillOverviewEntryPoint;
  platformStateLoaded: boolean;
  deliveryStateLoaded: boolean;
  availablePlatformCount: number;
  currentVersionPlatformCount: number;
  otherVersionPlatformCount: number;
  totalCarryingPlatformCount: number;
  deliveryEntryCount: number;
  pendingTeamCount: number;
  currentVersionPendingTeamCount: number;
  currentVersionStableTeamCount: number;
  currentVersionTeamCount: number;
  otherVersionTeamCount: number;
  latestReleaseRecord: PlatformReleaseRecord | null;
  latestDeliveryRecord: TeamDeliveryRecord | null;
  descriptionMissing: boolean;
}
