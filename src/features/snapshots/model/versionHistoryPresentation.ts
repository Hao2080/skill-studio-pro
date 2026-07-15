import type { SkillSnapshot } from "@/types/skill";
import type { SkillTeamDeliveryOverview } from "@/types/team";
import type { VersionDecisionModel } from "./versionDecision";
import type { UiLanguage } from "./presentationTypes";

export function formatSnapshotTime(createdAt: number, locale: UiLanguage) {
  return new Date(createdAt).toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getCompareBaseLabel(snapshotNumber: number | null, language: UiLanguage) {
  return snapshotNumber == null
    ? (language === "en-US" ? "No Base Set" : "未设置基准")
    : `v${snapshotNumber}`;
}

export function getPlatformLabel(platformName: string, displayName?: string) {
  return displayName?.trim() || platformName;
}

export function getSnapshotGroupTitle(systemGroup: boolean, language: UiLanguage) {
  return systemGroup
    ? (language === "en-US" ? "System Restore Points" : "系统恢复点")
    : (language === "en-US" ? "Formal Versions" : "正式版本");
}

export function buildVersionTimelineGroups(input: {
  copy: VersionHistoryCopy;
  language: UiLanguage;
  manualSnapshots: SkillSnapshot[];
  systemSnapshots: SkillSnapshot[];
}) {
  const { copy, language, manualSnapshots, systemSnapshots } = input;

  return [
    {
      key: "manual",
      title: getSnapshotGroupTitle(false, language),
      description: copy.manualGroupDescription,
      snapshots: manualSnapshots,
      systemGroup: false,
    },
    {
      key: "system",
      title: getSnapshotGroupTitle(true, language),
      description: copy.systemGroupDescription,
      snapshots: systemSnapshots,
      systemGroup: true,
    },
  ].filter((group) => group.snapshots.length > 0);
}

export function getLatestTeamSnapshotId(teamDeliveryOverview: SkillTeamDeliveryOverview | null) {
  const teamDeliveries = teamDeliveryOverview?.deliveries ?? [];
  const latestPending = teamDeliveries
    .flatMap((delivery) =>
      delivery.pendingDelivery
        ? [
            {
              snapshotId: delivery.pendingDelivery.sourceSnapshotId,
              createdAt: delivery.pendingDelivery.submittedAt,
            },
          ]
        : [],
    )
    .sort((left, right) => right.createdAt - left.createdAt)[0];

  if (latestPending?.snapshotId) {
    return latestPending.snapshotId;
  }

  return teamDeliveryOverview?.recentRecords.find((record) => record.sourceSnapshotId)?.sourceSnapshotId ?? null;
}

export function getWorkspaceBaseSummary(input: {
  copy: VersionHistoryCopy;
  hasChanges: boolean;
  workspaceBaseSnapshot: SkillSnapshot | null | undefined;
  isSystemSnapshot: (snapshot: SkillSnapshot | null | undefined) => boolean;
}) {
  const { copy, hasChanges, workspaceBaseSnapshot } = input;

  if (!workspaceBaseSnapshot) {
    return copy.noBaseline;
  }

  if (hasChanges) {
    return input.isSystemSnapshot(workspaceBaseSnapshot)
      ? copy.basedOnRestore(workspaceBaseSnapshot.snapshotNumber)
      : copy.basedOnSnapshot(workspaceBaseSnapshot.snapshotNumber);
  }

  return input.isSystemSnapshot(workspaceBaseSnapshot)
    ? copy.alignedWithRestore(workspaceBaseSnapshot.snapshotNumber)
    : copy.alignedWithSnapshot(workspaceBaseSnapshot.snapshotNumber);
}

export function getVersionDecisionKey(input: {
  selectedSkillId?: string | null;
  versionDecision: VersionDecisionModel;
}) {
  const { selectedSkillId, versionDecision } = input;

  return [
    selectedSkillId ?? "",
    versionDecision.tone,
    versionDecision.status,
    versionDecision.title,
    versionDecision.description,
    versionDecision.primaryAction.type,
    versionDecision.secondaryAction?.type ?? "",
  ].join("|");
}

export function getVersionHistoryCopy(language: UiLanguage) {
  return language === "en-US"
    ? {
        unknownError: "Unknown error",
        compareFailed: "Compare failed",
        selectSnapshotBeforePublish: "Select a snapshot on the left before publishing to platforms.",
        systemCannotPublish: "System restore points cannot be published directly. Please select a formal version.",
        noEnabledPlatform: "There are no enabled platforms yet. Enable one in Settings first.",
        publishedTo: "Published to ",
        publishFailedPrefix: "Publish failed: ",
        selectSnapshotBeforeDeliver: "Select a snapshot on the left before delivering to teams.",
        systemCannotDeliver: "System restore points cannot be delivered directly. Please select a formal version.",
        noDeliverableTeams: "There are no available teams yet.",
        submittedToTeams: "Submitted to teams ",
        submitFailedPrefix: "Submit failed: ",
        removeFromPlatform: "Removed from platforms ",
        removeFailedPrefix: "Remove failed: ",
        deliveryFailedPrefix: "Team delivery failed: ",
        withdrawFromTeams: "Withdrawn from team pending queue ",
        withdrawFailedPrefix: "Withdraw failed: ",
        removeTeamServing: "Removed team serving ",
        removeTeamFailedPrefix: "Remove serving failed: ",
        compareNeedsBase: "At least one snapshot or restore point is required as the compare base.",
        noSkillSelected: "Select a skill to view versions",
        versionsEyebrow: "Version Ops",
        versionsTitle: "Version Workbench",
        localVersions: "Formal Versions",
        restorePoints: "Restore Points",
        countLabel: (count: number) => `${count}`,
        compareDescription:
          "Handle snapshots, active versions, platform releases, and team collaboration from one version workbench.",
        createSnapshot: "Create Snapshot",
        compareVersions: "Compare Versions",
        primaryActions: "Version Primary Actions",
        localVersionsCountAria: (count: number) => `Formal versions ${count}`,
        versionCountsAria: (manualCount: number, systemCount: number) =>
          `Formal versions ${manualCount}, restore points ${systemCount}`,
        decisionAria: "Version Decision",
        decisionActionsAria: "Version Decision Actions",
        dismissDecision: "Dismiss version decision",
        compareDraftAria: "Compare Draft",
        compareDraft: "Compare Draft",
        awaitingTarget: "Awaiting compare target",
        compareDraftSummary: "Compare draft summary",
        base: "Base",
        target: "Target",
        pending: "Pending",
        compareWorkspace: "Compare Workspace",
        cancelCompare: "Cancel Compare",
        currentObject: "Current Object",
        workspace: "Workspace",
        draft: "Draft",
        stable: "Stable",
        workspaceDraftSummary: (count: number) => `${count} files are still in draft state`,
        workspaceAligned: "Workspace is aligned with the current baseline",
        basedOnRestore: (snapshotNumber: number) => `Continue editing from restore point v${snapshotNumber}`,
        basedOnSnapshot: (snapshotNumber: number) => `Continue editing from v${snapshotNumber}`,
        alignedWithRestore: (snapshotNumber: number) => `Aligned with restore point v${snapshotNumber}`,
        alignedWithSnapshot: (snapshotNumber: number) => `Aligned with v${snapshotNumber}`,
        noBaseline: "No baseline",
        timelineTitle: "Version Timeline",
        compareReady: "Current version is set as compare base",
        compareReadyTitle: (snapshotNumber: number) => `Latest snapshot v${snapshotNumber} is ready as compare base`,
        compareTargetHint: "Compare target mode is active. Click to set the target.",
        manualGroupDescription: "Set active versions, publish to platforms, or deliver to teams.",
        systemGroupDescription: "Used only for workspace recovery and excluded from formal release and collaboration.",
        summaryFallback: "No summary provided",
        baseBadge: "Base",
        restoreBadge: "Restore Point",
        activeBadge: "Active",
        latestRestoreBadge: "Latest Restore Point",
        latestBadge: "Latest",
        noSnapshots: "No snapshots yet",
        noSnapshotsDescription: "Create the first snapshot to start version management.",
        releaseStatus: "Sync Status",
        consoleTabsAria: "Version Console",
        tabDetail: "Snapshot Details",
        tabRelease: "Platform Sync",
        tabTeam: "Team Delivery",
        syncingAria: "Syncing",
        pendingAria: "Pending",
        createSnapshotTitle: "Create Snapshot",
        createSnapshotConfirm: "Create",
        cancel: "Cancel",
        summaryPlaceholder: "Enter a version summary (optional)",
        releaseModalTitle: (isSystem: boolean, snapshotNumber: number) =>
          `${isSystem ? "Restore Point" : "Release Snapshot"} v${snapshotNumber}`,
        releaseModalFallback: "Sync to Platforms",
        publish: "Publish",
        releaseHintRestore: (snapshotNumber: number) =>
          `Restore point v${snapshotNumber} is selected. Restore points only recover the workspace and cannot be published directly.`,
        releaseHintSnapshot: (snapshotNumber: number) =>
          `Snapshot v${snapshotNumber} will be published to the selected platforms. If a platform is already serving another version, it will be switched to this snapshot.`,
        releaseHintEmpty: "Select a snapshot on the left before publishing to platforms.",
        teamModalTitle: (isSystem: boolean, snapshotNumber: number) =>
          `${isSystem ? "Restore Point" : "Deliver Snapshot"} v${snapshotNumber} to Teams`,
        teamModalFallback: "Deliver to Teams",
        submit: "Submit",
        teamHintRestore: (snapshotNumber: number) =>
          `Restore point v${snapshotNumber} is selected. Restore points only recover the workspace and cannot be delivered to teams.`,
        teamHintSnapshot: (snapshotNumber: number) =>
          `Snapshot v${snapshotNumber} will be submitted to the selected teams. If a team already has another target or pending review, it will be switched to this snapshot.`,
        teamHintEmpty: "Select a snapshot on the left before delivering to teams.",
        submitterPlaceholder: "Submitter",
        submitMessagePlaceholder: "Delivery note, optional",
        teamPending: (snapshotNumber: number) => `Pending v${snapshotNumber}`,
        teamCurrent: (snapshotNumber: number) => `Serving v${snapshotNumber}`,
        teamNone: "Not Serving",
      }
    : {
        unknownError: "未知错误",
        compareFailed: "对比失败",
        selectSnapshotBeforePublish: "请先在左侧选择一个快照，再同步到平台。",
        systemCannotPublish: "系统恢复点不能直接同步到平台，请先选择正式版本。",
        noEnabledPlatform: "没有已启用的平台，请先在设置中启用",
        publishedTo: "已发布到 ",
        publishFailedPrefix: "发布失败: ",
        selectSnapshotBeforeDeliver: "请先在左侧选择一个快照，再交付到团队。",
        systemCannotDeliver: "系统恢复点不能直接交付团队，请先选择正式版本。",
        noDeliverableTeams: "当前没有可交付的团队。",
        submittedToTeams: "已提交到团队 ",
        submitFailedPrefix: "提交失败: ",
        removeFromPlatform: "已从平台移除 ",
        removeFailedPrefix: "移除失败: ",
        deliveryFailedPrefix: "团队交付失败: ",
        withdrawFromTeams: "已撤回团队待审 ",
        withdrawFailedPrefix: "撤回失败: ",
        removeTeamServing: "已解除团队承接 ",
        removeTeamFailedPrefix: "解除承接失败: ",
        compareNeedsBase: "至少需要一个快照或恢复点作为对比基准。",
        noSkillSelected: "选择一个技能后查看版本",
        versionsEyebrow: "版本操作",
        versionsTitle: "版本管理",
        localVersions: "本地版本",
        restorePoints: "恢复点",
        countLabel: (count: number) => `${count} 个`,
        compareDescription: "在这里处理快照、生效版本、平台同步与团队空间四条对象链路。",
        createSnapshot: "创建快照",
        compareVersions: "对比版本",
        primaryActions: "版本主操作",
        localVersionsCountAria: (count: number) => `本地版本 ${count} 个`,
        versionCountsAria: (manualCount: number, systemCount: number) =>
          `正式版本 ${manualCount} 个，系统恢复点 ${systemCount} 个`,
        decisionAria: "版本决策提示",
        decisionActionsAria: "版本决策操作",
        dismissDecision: "关闭版本决策提示",
        compareDraftAria: "对比草稿",
        compareDraft: "对比草稿",
        awaitingTarget: "等待选择对比目标",
        compareDraftSummary: "对比草稿摘要",
        base: "基准",
        target: "目标",
        pending: "待选",
        compareWorkspace: "对比工作区",
        cancelCompare: "取消对比",
        currentObject: "当前对象",
        workspace: "工作区",
        draft: "草稿中",
        stable: "稳定",
        workspaceDraftSummary: (count: number) => `${count} 个文件仍在草稿态`,
        workspaceAligned: "工作副本与当前基线一致",
        basedOnRestore: (snapshotNumber: number) => `基于恢复点 v${snapshotNumber} 继续编辑`,
        basedOnSnapshot: (snapshotNumber: number) => `基于 v${snapshotNumber} 继续编辑`,
        alignedWithRestore: (snapshotNumber: number) => `与恢复点 v${snapshotNumber} 一致`,
        alignedWithSnapshot: (snapshotNumber: number) => `与 v${snapshotNumber} 一致`,
        noBaseline: "未建立基线",
        timelineTitle: "版本时间线",
        compareReady: "已将当前版本设为对比基准",
        compareReadyTitle: (snapshotNumber: number) => `已将最新快照 v${snapshotNumber} 设为对比基准`,
        compareTargetHint: "对比准备中，点选后设为目标",
        manualGroupDescription: "可设为生效版本、同步到平台、交付给团队",
        systemGroupDescription: "仅用于恢复工作副本，不进入正式发布与协作链路",
        summaryFallback: "未填写说明",
        baseBadge: "基准",
        restoreBadge: "恢复点",
        activeBadge: "生效中",
        latestRestoreBadge: "最新恢复点",
        latestBadge: "最新",
        noSnapshots: "暂无快照",
        noSnapshotsDescription: "创建首个快照后开始管理版本。",
        releaseStatus: "同步状态",
        consoleTabsAria: "版本操作区",
        tabDetail: "快照详情",
        tabRelease: "平台同步",
        tabTeam: "团队交付",
        syncingAria: "同步中",
        pendingAria: "待处理",
        createSnapshotTitle: "创建快照",
        createSnapshotConfirm: "创建",
        cancel: "取消",
        summaryPlaceholder: "输入版本说明（可选）",
        releaseModalTitle: (isSystem: boolean, snapshotNumber: number) =>
          `${isSystem ? "恢复点" : "发布快照"} v${snapshotNumber}`,
        releaseModalFallback: "同步到平台",
        publish: "发布",
        releaseHintRestore: (snapshotNumber: number) =>
          `当前选中的是恢复点 v${snapshotNumber}。恢复点仅用于回到工作区，不能直接同步到平台。`,
        releaseHintSnapshot: (snapshotNumber: number) =>
          `当前将把快照 v${snapshotNumber} 发布到所选平台。若平台已承接其他版本，本次会直接改发为当前快照。`,
        releaseHintEmpty: "请先从左侧选择一个快照，再执行平台同步。",
        teamModalTitle: (isSystem: boolean, snapshotNumber: number) =>
          `${isSystem ? "恢复点" : "交付快照"} v${snapshotNumber} 到团队`,
        teamModalFallback: "交付到团队",
        submit: "提交",
        teamHintRestore: (snapshotNumber: number) =>
          `当前选中的是恢复点 v${snapshotNumber}。恢复点仅用于回到工作区，不能直接交付到团队。`,
        teamHintSnapshot: (snapshotNumber: number) =>
          `当前将把快照 v${snapshotNumber} 提交到所选团队。若团队已有待审或承接其他版本，本次会自动改交为当前快照。`,
        teamHintEmpty: "请先从左侧选择一个快照，再执行团队交付。",
        submitterPlaceholder: "提交人",
        submitMessagePlaceholder: "本次交付说明，可选",
        teamPending: (snapshotNumber: number) => `待审 v${snapshotNumber}`,
        teamCurrent: (snapshotNumber: number) => `当前承接 v${snapshotNumber}`,
        teamNone: "尚未承接",
      };
}

export type VersionHistoryCopy = ReturnType<typeof getVersionHistoryCopy>;
