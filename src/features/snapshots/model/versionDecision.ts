import type { PlatformConnection, SkillSnapshot } from "@/types/skill";

export type VersionDecisionTone = "active" | "warning" | "ready" | "neutral";

export type VersionDecisionActionType =
  | "create_snapshot"
  | "open_files"
  | "set_active"
  | "review_latest"
  | "open_release"
  | "open_team"
  | "open_settings";

export interface VersionDecisionAction {
  type: VersionDecisionActionType;
  label: string;
}

export interface VersionDecisionModel {
  status: string;
  tone: VersionDecisionTone;
  title: string;
  description: string;
  primaryAction: VersionDecisionAction;
  secondaryAction?: VersionDecisionAction;
}

interface BuildVersionDecisionInput {
  hasChanges: boolean;
  changedFileCount: number;
  latestSnapshot: SkillSnapshot | null;
  activeSnapshot: SkillSnapshot | null;
  enabledPlatforms: PlatformConnection[];
  hasPendingTeamDelivery?: boolean;
  language?: "zh-CN" | "en-US";
}

export function buildVersionDecision({
  hasChanges,
  changedFileCount,
  latestSnapshot,
  activeSnapshot,
  enabledPlatforms,
  hasPendingTeamDelivery = false,
  language = "zh-CN",
}: BuildVersionDecisionInput): VersionDecisionModel {
  const copy = language === "en-US"
    ? {
        pendingSetup: "Pending Setup",
        createFirstTitle: "Create the first snapshot",
        createFirstDescription:
          "A version baseline has not been established yet, so neither the release flow nor the team flow has a stable anchor.",
        createFirstAction: "Create First Snapshot",
        openFilesAction: "Review Files First",
        draftStatus: "Draft",
        collectDraftTitle: "Snapshot the workspace first",
        collectDraftDescription: (snapshotNumber: number, changedCount: number) =>
          `${changedCount} files are still in workspace draft state compared with the latest snapshot v${snapshotNumber}.`,
        createSnapshotAction: "Create Snapshot",
        continueDraftAction: "Continue Organizing Drafts",
        pendingActive: "Pending Active",
        activeTitle: "Confirm the active version",
        activeDescription: (snapshotNumber: number) =>
          `The latest snapshot is already at v${snapshotNumber}, but the release and collaboration baseline is still undefined.`,
        setActiveAction: "Set Active Version",
        pendingReview: "Pending Review",
        reviewLatestTitle: "Review whether the latest snapshot should become the external baseline",
        reviewLatestDescription: (activeNumber: number, latestNumber: number) =>
          `The current active version is still v${activeNumber}, while the latest snapshot has already advanced to v${latestNumber}.`,
        reviewLatestAction: "Review Latest Snapshot",
        openReleaseAction: "Open Release Flow",
        pendingRelease: "Pending Release",
        platformTitle: "Complete platform serving",
        platformDescription: (snapshotNumber: number) =>
          `The active version is stable at v${snapshotNumber}, but there is no available platform to serve releases yet.`,
        configurePlatformAction: "Configure Platforms",
        releaseLayerAction: "View Release Layer",
        teamActive: "Team In Progress",
        teamTitle: "Follow the current team delivery flow",
        teamDescription:
          "A recent team submission is still in circulation. Confirm whether the team baseline still matches the local decision.",
        teamAction: "View Team Status",
        stable: "Stable",
        stableTitle: "The current version flow is stable",
        stableDescription: (snapshotNumber: number) =>
          `Active version v${snapshotNumber} already has release destinations. You can continue checking release and collaboration results.`,
        openTeamAction: "View Team Flow",
      }
    : {
        pendingSetup: "待建立",
        createFirstTitle: "先创建首个快照",
        createFirstDescription: "版本基线尚未建立，发布链路和团队链路都还没有稳定依附对象。",
        createFirstAction: "创建首个快照",
        openFilesAction: "先看文件",
        draftStatus: "草稿中",
        collectDraftTitle: "先把工作区收口成快照",
        collectDraftDescription: (snapshotNumber: number, changedCount: number) =>
          `相对最新快照 v${snapshotNumber}，当前还有 ${changedCount} 个文件停留在工作副本草稿态。`,
        createSnapshotAction: "创建快照",
        continueDraftAction: "继续整理草稿",
        pendingActive: "待设置",
        activeTitle: "明确当前生效版本",
        activeDescription: (snapshotNumber: number) =>
          `最新快照已经到 v${snapshotNumber}，但发布与协作基线仍未确定。`,
        setActiveAction: "设置生效版本",
        pendingReview: "待审查",
        reviewLatestTitle: "审查最新快照是否进入对外基线",
        reviewLatestDescription: (activeNumber: number, latestNumber: number) =>
          `当前生效版本仍是 v${activeNumber}，而最新快照已经推进到 v${latestNumber}。`,
        reviewLatestAction: "审查最新快照",
        openReleaseAction: "查看发布链路",
        pendingRelease: "待发布",
        platformTitle: "补齐平台承接入口",
        platformDescription: (snapshotNumber: number) =>
          `生效版本已稳定在 v${snapshotNumber}，但当前还没有可用平台承接发布动作。`,
        configurePlatformAction: "配置平台",
        releaseLayerAction: "查看发布层",
        teamActive: "团队处理中",
        teamTitle: "跟进团队当前流转状态",
        teamDescription: "最近一次团队提交流转中，需要确认团队看到的基线是否仍与本地决策一致。",
        teamAction: "查看团队状态",
        stable: "稳定",
        stableTitle: "当前版本链路已稳定",
        stableDescription: (snapshotNumber: number) =>
          `生效版本 v${snapshotNumber} 已具备发布去向，可继续检查发布与协作结果。`,
        openTeamAction: "查看团队链路",
      };
  if (!latestSnapshot) {
    return {
      status: copy.pendingSetup,
      tone: "warning",
      title: copy.createFirstTitle,
      description: copy.createFirstDescription,
      primaryAction: { type: "create_snapshot", label: copy.createFirstAction },
      secondaryAction: { type: "open_files", label: copy.openFilesAction },
    };
  }

  if (hasChanges) {
    return {
      status: copy.draftStatus,
      tone: "active",
      title: copy.collectDraftTitle,
      description: copy.collectDraftDescription(latestSnapshot.snapshotNumber, changedFileCount),
      primaryAction: { type: "create_snapshot", label: copy.createSnapshotAction },
      secondaryAction: { type: "open_files", label: copy.continueDraftAction },
    };
  }

  if (!activeSnapshot) {
    return {
      status: copy.pendingActive,
      tone: "warning",
      title: copy.activeTitle,
      description: copy.activeDescription(latestSnapshot.snapshotNumber),
      primaryAction: { type: "set_active", label: copy.setActiveAction },
    };
  }

  if (activeSnapshot.id !== latestSnapshot.id) {
    return {
      status: copy.pendingReview,
      tone: "warning",
      title: copy.reviewLatestTitle,
      description: copy.reviewLatestDescription(activeSnapshot.snapshotNumber, latestSnapshot.snapshotNumber),
      primaryAction: { type: "review_latest", label: copy.reviewLatestAction },
      secondaryAction: { type: "open_release", label: copy.openReleaseAction },
    };
  }

  if (enabledPlatforms.length === 0) {
    return {
      status: copy.pendingRelease,
      tone: "neutral",
      title: copy.platformTitle,
      description: copy.platformDescription(activeSnapshot.snapshotNumber),
      primaryAction: { type: "open_settings", label: copy.configurePlatformAction },
      secondaryAction: { type: "open_release", label: copy.releaseLayerAction },
    };
  }

  if (hasPendingTeamDelivery) {
    return {
      status: copy.teamActive,
      tone: "active",
      title: copy.teamTitle,
      description: copy.teamDescription,
      primaryAction: { type: "open_team", label: copy.teamAction },
      secondaryAction: { type: "open_release", label: copy.releaseLayerAction },
    };
  }

  return {
    status: copy.stable,
    tone: "ready",
    title: copy.stableTitle,
    description: copy.stableDescription(activeSnapshot.snapshotNumber),
    primaryAction: { type: "open_release", label: copy.openReleaseAction },
    secondaryAction: { type: "open_team", label: copy.openTeamAction },
  };
}
