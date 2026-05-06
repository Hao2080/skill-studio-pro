import { formatCountLabel, formatEventTime, formatVersion, getActionLabel } from "./skillOverviewFormatters";
import type {
  SkillOverviewAction,
  SkillOverviewActivityItem,
  SkillOverviewAttentionItem,
  SkillOverviewDerivedState,
  SkillOverviewLifecycleNode,
  SkillOverviewSummaryItem,
  UiLanguage,
} from "./skillOverviewTypes";

export function buildSummaryItems(
  state: SkillOverviewDerivedState,
  latestActivity: SkillOverviewActivityItem | null,
  locale: UiLanguage = "zh-CN",
): SkillOverviewSummaryItem[] {
  const workspaceAction: SkillOverviewAction = {
    type: "open_files",
    label: getActionLabel("openFiles", locale),
    filePath: state.entryPoint.path,
    emphasis: "ghost",
  };
  const versionAction: SkillOverviewAction = {
    type: "open_versions",
    label: getActionLabel("openVersions", locale),
    section: "detail",
    emphasis: "ghost",
  };
  const releaseAction: SkillOverviewAction =
    state.platformStateLoaded && state.availablePlatformCount === 0
      ? { type: "open_settings", label: getActionLabel("platformSettings", locale), emphasis: "ghost" }
      : { type: "open_versions", label: getActionLabel("viewPlatformRelease", locale), section: "release", emphasis: "ghost" };
  const deliveryAction: SkillOverviewAction =
    state.deliveryEntryCount === 0
      ? { type: "open_teams", label: getActionLabel("teamManagement", locale), emphasis: "ghost" }
      : { type: "open_versions", label: getActionLabel("viewTeamDelivery", locale), section: "team", emphasis: "ghost" };

  const releaseValue = !state.activeSnapshot
    ? (locale === "en-US" ? "Needs Baseline" : "待设基线")
    : !state.platformStateLoaded
      ? (locale === "en-US" ? "Loading" : "读取中")
      : state.currentVersionPlatformCount > 0
        ? (locale === "en-US"
          ? formatCountLabel(state.currentVersionPlatformCount, locale, "platform", "个平台")
          : `${state.currentVersionPlatformCount} 个平台`)
        : state.availablePlatformCount === 0
          ? (locale === "en-US" ? "No Platforms" : "暂无平台")
          : (locale === "en-US" ? "Not Carrying" : "未承接");
  const releaseMeta = !state.activeSnapshot
    ? (locale === "en-US" ? "Set the current version first" : "需要先明确当前版本")
    : !state.platformStateLoaded
      ? (locale === "en-US" ? "Reading platform carrying state" : "正在读取平台承接状态")
      : state.currentVersionPlatformCount > 0
        ? state.otherVersionPlatformCount > 0
          ? (locale === "en-US"
            ? `${formatCountLabel(state.otherVersionPlatformCount, locale, "older-version platform", "个旧版本平台")} remain`
            : `另有 ${state.otherVersionPlatformCount} 个旧版本平台`)
          : (locale === "en-US" ? "The current version is already in the platform flow" : "当前版本已进入平台链路")
        : state.availablePlatformCount === 0
          ? (locale === "en-US" ? "Enable a platform in settings and continue" : "前往设置启用平台后再继续")
          : (locale === "en-US"
            ? `${formatCountLabel(state.availablePlatformCount, locale, "platform", "个平台")} can carry it right away`
            : `${state.availablePlatformCount} 个平台可直接承接`);
  const releaseTone = !state.activeSnapshot
    ? "warning"
    : !state.platformStateLoaded
      ? "neutral"
      : state.currentVersionPlatformCount > 0
        ? state.otherVersionPlatformCount > 0
          ? "active"
          : "ready"
        : state.availablePlatformCount === 0
          ? "neutral"
          : "warning";

  const deliveryValue = state.deliveryEntryCount === 0
    ? (locale === "en-US" ? "No Teams" : "暂无团队")
    : !state.deliveryStateLoaded
      ? (locale === "en-US"
        ? `Recognized ${formatCountLabel(state.deliveryEntryCount, locale, "team", "个团队")}`
        : `已识别 ${state.deliveryEntryCount} 个团队`)
      : state.currentVersionTeamCount > 0
        ? (locale === "en-US"
          ? formatCountLabel(state.currentVersionTeamCount, locale, "team", "个团队")
          : `${state.currentVersionTeamCount} 个团队`)
        : state.pendingTeamCount > 0
          ? (locale === "en-US"
            ? `${formatCountLabel(state.pendingTeamCount, locale, "pending team", "个待审团队")}`
            : `${state.pendingTeamCount} 个待审`)
          : (locale === "en-US" ? "Not Delivered" : "未进入交付");
  const deliveryMeta = state.deliveryEntryCount === 0
    ? (locale === "en-US" ? "Delivery flow starts after teams exist" : "建立团队后才有交付链路")
    : !state.deliveryStateLoaded
      ? (locale === "en-US" ? "Reading team carrying state" : "正在读取团队承接状态")
      : state.currentVersionTeamCount > 0
        ? state.currentVersionPendingTeamCount > 0
          ? (locale === "en-US"
            ? `${formatCountLabel(state.currentVersionPendingTeamCount, locale, "team", "个团队")} are still under review`
            : `${state.currentVersionPendingTeamCount} 个团队仍在待审`)
          : state.otherVersionTeamCount > 0
            ? (locale === "en-US"
              ? `${formatCountLabel(state.otherVersionTeamCount, locale, "older-version team", "个旧版本团队")} remain`
              : `另有 ${state.otherVersionTeamCount} 个旧版本团队`)
            : (locale === "en-US" ? "The current version is already in the team flow" : "当前版本已进入团队链路")
        : state.pendingTeamCount > 0
          ? (locale === "en-US" ? "There are pending deliveries to follow up on" : "存在待审交付，需要继续跟进")
          : (locale === "en-US" ? "The current version has not entered any team yet" : "当前版本尚未进入任何团队");
  const deliveryTone = state.deliveryEntryCount === 0
    ? "neutral"
    : !state.deliveryStateLoaded
      ? "neutral"
      : state.currentVersionTeamCount > 0
        ? state.currentVersionPendingTeamCount > 0 || state.otherVersionTeamCount > 0
          ? "active"
          : "ready"
        : state.pendingTeamCount > 0
          ? "warning"
          : "warning";

  return [
    {
      key: "workspace",
      label: locale === "en-US" ? "Workspace" : "工作区",
      value: state.hasChanges
        ? (locale === "en-US"
          ? `${formatCountLabel(state.changedFileCount, locale, "file", "个文件")} pending snapshot`
          : `${state.changedFileCount} 个待入快照`)
        : state.hasSnapshots
          ? (locale === "en-US" ? "Aligned with snapshots" : "已与快照对齐")
          : (locale === "en-US" ? "No snapshot baseline yet" : "尚未建立快照基线"),
      meta: state.hasChanges
        ? state.entryPoint.reason
        : state.latestSnapshot
          ? (locale === "en-US"
            ? `Based on ${formatVersion(state.latestSnapshot, locale)}`
            : `基于 ${formatVersion(state.latestSnapshot, locale)}`)
          : (locale === "en-US" ? "Create the first snapshot first" : "尚未建立快照基线"),
      tone: state.hasChanges ? "active" : state.hasSnapshots ? "ready" : "warning",
      action: workspaceAction,
    },
    {
      key: "version",
      label: locale === "en-US" ? "Current Version" : "当前版本",
      value: formatVersion(state.activeSnapshot, locale),
      meta: !state.hasSnapshots
        ? (locale === "en-US" ? "Create the first snapshot first" : "先创建首个快照")
        : !state.activeSnapshot
          ? (locale === "en-US"
            ? `Latest snapshot ${formatVersion(state.latestSnapshot, locale)} is waiting to become current`
            : `最新快照 ${formatVersion(state.latestSnapshot, locale)} 等待设为当前版本`)
          : state.activeVersionBehindLatest
            ? (locale === "en-US"
              ? `Latest snapshot ${formatVersion(state.latestSnapshot, locale)} has not been promoted yet`
              : `最新快照 ${formatVersion(state.latestSnapshot, locale)} 尚未升级`)
            : (locale === "en-US" ? "The current version is aligned with the latest snapshot" : "当前版本已与最新快照对齐"),
      tone: !state.activeSnapshot ? "warning" : state.activeVersionBehindLatest ? "warning" : "ready",
      action: versionAction,
    },
    {
      key: "release",
      label: locale === "en-US" ? "Platform Carrying" : "平台承接",
      value: releaseValue,
      meta: releaseMeta,
      tone: releaseTone,
      action: releaseAction,
    },
    {
      key: "delivery",
      label: locale === "en-US" ? "Team Delivery" : "团队交付",
      value: deliveryValue,
      meta: deliveryMeta,
      tone: deliveryTone,
      action: deliveryAction,
    },
    {
      key: "recent",
      label: locale === "en-US" ? "Recent Activity" : "最近动作",
      value: latestActivity ? latestActivity.meta : locale === "en-US" ? "No Activity Yet" : "暂无动作",
      meta: latestActivity
        ? latestActivity.title
        : locale === "en-US"
          ? "Snapshots, releases, and deliveries will appear here once they happen"
          : "创建快照、发布或交付后会出现在这里",
      tone: latestActivity?.tone ?? "neutral",
      action: latestActivity?.action ?? versionAction,
    },
  ];
}

export function buildLifecycleNodes(
  state: SkillOverviewDerivedState,
  locale: UiLanguage = "zh-CN",
): SkillOverviewLifecycleNode[] {
  const currentVersionLabel = formatVersion(state.activeSnapshot, locale);

  return [
    {
      key: "workspace",
      label: locale === "en-US" ? "Workspace" : "工作区",
      status: state.hasChanges
        ? (locale === "en-US" ? "Needs Wrap-up" : "待收口")
        : state.hasSnapshots
          ? (locale === "en-US" ? "Converged" : "已收敛")
          : (locale === "en-US" ? "Not Set Up" : "待建立"),
      value: state.hasChanges
        ? (locale === "en-US"
          ? `${formatCountLabel(state.changedFileCount, locale, "file", "个文件")} pending snapshot`
          : `${state.changedFileCount} 个文件待入快照`)
        : state.hasSnapshots
          ? (locale === "en-US"
            ? `Workspace aligned to ${formatVersion(state.latestSnapshot, locale)}`
            : `工作区已对齐 ${formatVersion(state.latestSnapshot, locale)}`)
          : (locale === "en-US" ? "No trackable baseline yet" : "还没有形成可追踪基线"),
      detail: state.hasChanges
        ? (locale === "en-US"
          ? `Current work is still in the local file area. Continue from ${state.entryPoint.name}.`
          : `当前工作仍停留在本地文件区，建议从 ${state.entryPoint.name} 继续收口。`)
        : state.hasSnapshots
          ? (locale === "en-US" ? "The current workspace is aligned with the version flow." : "当前工作副本没有偏离版本链路。")
          : (locale === "en-US" ? "Build skill content in Files first, then enter the snapshot flow." : "先在文件区建立技能内容，再进入快照流程。"),
      meta: state.hasChanges ? state.entryPoint.reason : null,
      tone: state.hasChanges ? "active" : state.hasSnapshots ? "ready" : "warning",
      action: {
        type: "open_files",
        label: getActionLabel("openFiles", locale),
        filePath: state.entryPoint.path,
        emphasis: "ghost",
      },
    },
    {
      key: "version",
      label: locale === "en-US" ? "Current Version" : "当前版本",
      status: !state.hasSnapshots
        ? (locale === "en-US" ? "Not Set Up" : "待建立")
        : !state.activeSnapshot
          ? (locale === "en-US" ? "Needs Setting" : "待设置")
          : state.activeVersionBehindLatest
            ? (locale === "en-US" ? "Needs Review" : "待审查")
            : (locale === "en-US" ? "Defined" : "已明确"),
      value: !state.hasSnapshots
        ? (locale === "en-US" ? "No snapshot baseline" : "没有快照基线")
        : !state.activeSnapshot
          ? (locale === "en-US"
            ? `Latest snapshot ${formatVersion(state.latestSnapshot, locale)} awaits confirmation`
            : `最新快照 ${formatVersion(state.latestSnapshot, locale)} 等待确认`)
          : (locale === "en-US" ? `Current version ${currentVersionLabel}` : `当前版本 ${currentVersionLabel}`),
      detail: !state.hasSnapshots
        ? (locale === "en-US"
          ? "Without a snapshot, there is no object for platform or team flows to carry."
          : "没有快照就没有可被平台或团队承接的对象。")
        : !state.activeSnapshot
          ? (locale === "en-US"
            ? "Set the current version first so platform and team flows share one baseline."
            : "先指定当前版本，后续平台与团队链路才有统一基线。")
          : state.activeVersionBehindLatest
            ? (locale === "en-US"
              ? `${formatVersion(state.latestSnapshot, locale)} already exists, but external flows still use ${currentVersionLabel}.`
              : `${formatVersion(state.latestSnapshot, locale)} 已经生成，但对外仍以 ${currentVersionLabel} 为准。`)
            : (locale === "en-US" ? "The latest snapshot is aligned with the current version." : "最新快照与当前版本已经对齐。"),
      meta: state.latestSnapshot
        ? (locale === "en-US"
          ? `Latest snapshot ${formatVersion(state.latestSnapshot, locale)}`
          : `最新快照 ${formatVersion(state.latestSnapshot, locale)}`)
        : null,
      tone: !state.hasSnapshots || !state.activeSnapshot ? "warning" : state.activeVersionBehindLatest ? "warning" : "ready",
      action: {
        type: "open_versions",
        label: getActionLabel("openVersions", locale),
        section: "detail",
        action: !state.activeSnapshot ? "set_active" : state.activeVersionBehindLatest ? "review_latest" : undefined,
        emphasis: "ghost",
      },
    },
    {
      key: "release",
      label: locale === "en-US" ? "Platform Sync" : "平台同步",
      status: !state.activeSnapshot
        ? (locale === "en-US" ? "Not Started" : "未启动")
        : !state.platformStateLoaded
          ? (locale === "en-US" ? "Loading" : "读取中")
          : state.availablePlatformCount === 0
            ? (locale === "en-US" ? "Needs Setup" : "待配置")
            : state.currentVersionPlatformCount === 0
              ? (locale === "en-US" ? "Ready to Release" : "待发布")
              : state.otherVersionPlatformCount > 0
                ? (locale === "en-US" ? "Needs Convergence" : "待收敛")
                : (locale === "en-US" ? "Carrying" : "已承接"),
      value: !state.activeSnapshot
        ? (locale === "en-US" ? "No current version" : "没有当前版本")
        : !state.platformStateLoaded
          ? (locale === "en-US" ? "Reading platform carrying" : "正在读取平台承接")
          : state.currentVersionPlatformCount > 0
            ? (locale === "en-US"
              ? `${formatCountLabel(state.currentVersionPlatformCount, locale, "platform", "个平台")} carrying ${currentVersionLabel}`
              : `${state.currentVersionPlatformCount} 个平台承接 ${currentVersionLabel}`)
            : state.availablePlatformCount === 0
              ? (locale === "en-US" ? "No platform available for release" : "当前没有可发布平台")
              : (locale === "en-US" ? `${currentVersionLabel} is not in platform carrying yet` : `${currentVersionLabel} 尚未进入平台承接`),
      detail: !state.activeSnapshot
        ? (locale === "en-US"
          ? "Without a current version, the platform release flow does not start."
          : "没有当前版本时，平台同步链路不会启动。")
        : !state.platformStateLoaded
          ? (locale === "en-US" ? "The overview is syncing platform carrying state." : "概览页正在同步平台承接状态。")
          : state.availablePlatformCount === 0
            ? (locale === "en-US"
              ? "Connect and enable a platform in Settings first, then push the current version into the external flow."
              : "先在设置中接入并启用平台，再把当前版本推入对外链路。")
            : state.currentVersionPlatformCount === 0
              ? (locale === "en-US"
                ? "No platform is carrying the current version yet. You can release it directly from Versions."
                : "当前版本还没有被任何平台承接，可直接进入版本页发布。")
              : state.otherVersionPlatformCount > 0
                ? (locale === "en-US"
                  ? `${formatCountLabel(state.otherVersionPlatformCount, locale, "platform", "个平台")} are still on other versions. Continue republishing to converge.`
                  : `已有 ${state.otherVersionPlatformCount} 个平台仍停留在其他版本，建议继续改发收敛。`)
                : (locale === "en-US" ? "Platform carrying is already aligned with the current version." : "平台承接已经与当前版本一致。"),
      meta: state.latestReleaseRecord
        ? (locale === "en-US"
          ? `Latest platform action ${formatEventTime(state.latestReleaseRecord.createdAt, locale)}`
          : `最近平台动作 ${formatEventTime(state.latestReleaseRecord.createdAt, locale)}`)
        : null,
      tone: !state.activeSnapshot
        ? "warning"
        : !state.platformStateLoaded
          ? "neutral"
          : state.availablePlatformCount === 0
            ? "neutral"
            : state.currentVersionPlatformCount === 0
              ? "warning"
              : state.otherVersionPlatformCount > 0
                ? "active"
                : "ready",
      action:
        state.platformStateLoaded && state.availablePlatformCount === 0
          ? { type: "open_settings", label: getActionLabel("platformSettings", locale), emphasis: "ghost" }
          : { type: "open_versions", label: getActionLabel("viewPlatformRelease", locale), section: "release", emphasis: "ghost" },
    },
    {
      key: "delivery",
      label: locale === "en-US" ? "Team Delivery" : "团队交付",
      status: state.deliveryEntryCount === 0
        ? (locale === "en-US" ? "Not Set Up" : "待建立")
        : !state.deliveryStateLoaded
          ? (locale === "en-US" ? "Loading" : "读取中")
          : state.currentVersionPendingTeamCount > 0
            ? (locale === "en-US" ? "Pending Review" : "待审")
            : state.currentVersionStableTeamCount > 0
              ? state.otherVersionTeamCount > 0
                ? (locale === "en-US" ? "Needs Convergence" : "待收敛")
                : (locale === "en-US" ? "Carrying" : "已承接")
              : state.pendingTeamCount > 0
                ? (locale === "en-US" ? "Needs Follow-up" : "待跟进")
                : (locale === "en-US" ? "Ready to Deliver" : "待交付"),
      value: state.deliveryEntryCount === 0
        ? (locale === "en-US" ? "No team entry yet" : "当前没有团队入口")
        : !state.deliveryStateLoaded
          ? (locale === "en-US"
            ? `Recognized ${formatCountLabel(state.deliveryEntryCount, locale, "team", "个团队")}`
            : `已识别 ${state.deliveryEntryCount} 个团队`)
          : state.currentVersionTeamCount > 0
            ? (locale === "en-US"
              ? `${formatCountLabel(state.currentVersionTeamCount, locale, "team", "个团队")} handling ${currentVersionLabel}`
              : `${state.currentVersionTeamCount} 个团队处理 ${currentVersionLabel}`)
            : state.pendingTeamCount > 0
              ? (locale === "en-US"
                ? `${formatCountLabel(state.pendingTeamCount, locale, "team", "个团队")} pending review`
                : `${state.pendingTeamCount} 个团队存在待审`)
              : (locale === "en-US" ? `${currentVersionLabel} has not entered any team yet` : `${currentVersionLabel} 尚未进入团队`),
      detail: state.deliveryEntryCount === 0
        ? (locale === "en-US"
          ? "Once teams exist, the overview can keep tracking where each version is delivered."
          : "建立团队后，概览页才能持续跟踪不同版本对应的交付去向。")
        : !state.deliveryStateLoaded
          ? (locale === "en-US" ? "The overview is syncing team carrying and pending review state." : "概览页正在同步团队承接与待审状态。")
          : state.currentVersionPendingTeamCount > 0
            ? (locale === "en-US"
              ? "The current version is already in the team review queue. Continue following the outcome."
              : "当前版本已经进入团队待审队列，建议继续跟进流转结果。")
            : state.currentVersionStableTeamCount > 0
              ? state.otherVersionTeamCount > 0
                ? (locale === "en-US"
                  ? `${formatCountLabel(state.otherVersionTeamCount, locale, "team", "个团队")} are still on other versions. The delivery flow has not fully converged yet.`
                  : `仍有 ${state.otherVersionTeamCount} 个团队停留在其他版本，交付链路尚未完全收敛。`)
                : (locale === "en-US" ? "Team carrying is already aligned with the current version." : "团队承接已经与当前版本一致。")
              : state.pendingTeamCount > 0
                ? (locale === "en-US"
                  ? "There are teams under review, but the current version has not entered any team's current carrying state yet."
                  : "存在团队待审，但当前版本还没有进入团队当前承接。")
                : (locale === "en-US" ? "The current version has not entered any team's delivery flow yet." : "当前版本还没有进入任何团队的交付链路。"),
      meta: state.latestDeliveryRecord
        ? (locale === "en-US"
          ? `Latest team action ${formatEventTime(state.latestDeliveryRecord.createdAt, locale)}`
          : `最近团队动作 ${formatEventTime(state.latestDeliveryRecord.createdAt, locale)}`)
        : null,
      tone: state.deliveryEntryCount === 0
        ? "neutral"
        : !state.deliveryStateLoaded
          ? "neutral"
          : state.currentVersionPendingTeamCount > 0
            ? "active"
            : state.currentVersionStableTeamCount > 0
              ? state.otherVersionTeamCount > 0
                ? "active"
                : "ready"
              : state.pendingTeamCount > 0
                ? "warning"
                : "warning",
      action:
        state.deliveryEntryCount === 0
          ? { type: "open_teams", label: getActionLabel("teamManagement", locale), emphasis: "ghost" }
          : { type: "open_versions", label: getActionLabel("viewTeamDelivery", locale), section: "team", emphasis: "ghost" },
    },
  ];
}

export function buildAttentionItems(
  state: SkillOverviewDerivedState,
  locale: UiLanguage = "zh-CN",
): SkillOverviewAttentionItem[] {
  const items = [
    !state.hasSnapshots
      ? {
          key: "no-snapshot",
          severity: "blocker" as const,
          title: locale === "en-US" ? "The first snapshot does not exist yet" : "还没有建立首个快照",
          detail: locale === "en-US"
            ? "The skill is still only in the workspace layer. Version, platform, and team flows cannot start stably yet."
            : "当前技能仍停留在工作区层，后续版本、平台和团队链路都无法稳定启动。",
          impact: locale === "en-US"
            ? "Create the first snapshot before judging the current version."
            : "先创建首个快照，再进入当前版本判断。",
          action: {
            type: "open_versions",
            label: getActionLabel("createFirstSnapshot", locale),
            section: "detail",
            action: "create_snapshot",
          } as SkillOverviewAction,
        }
      : null,
    state.hasSnapshots && !state.activeSnapshot
      ? {
          key: "missing-active",
          severity: "blocker" as const,
          title: locale === "en-US" ? "The current version is not set yet" : "还没有设置当前版本",
          detail: locale === "en-US"
            ? "Snapshots already exist, but the overview cannot tell which version is the external baseline."
            : "快照已经存在，但概览页无法判断哪个版本才是对外基线。",
          impact: locale === "en-US"
            ? "Platform carrying and team delivery lose a unified judgment baseline."
            : "平台承接和团队交付都会失去统一判断标准。",
          action: {
            type: "open_versions",
            label: getActionLabel("setCurrentVersion", locale),
            section: "detail",
            action: "set_active",
          } as SkillOverviewAction,
        }
      : null,
    state.activeVersionBehindLatest
      ? {
          key: "active-behind-latest",
          severity: "attention" as const,
          title: locale === "en-US" ? "The latest snapshot is not current yet" : "最新快照尚未进入当前版本",
          detail: locale === "en-US"
            ? `${formatVersion(state.latestSnapshot, locale)} already exists, but external flows still depend on ${formatVersion(state.activeSnapshot, locale)}.`
            : `${formatVersion(state.latestSnapshot, locale)} 已经生成，但当前外部链路仍依附 ${formatVersion(state.activeSnapshot, locale)}。`,
          impact: locale === "en-US"
            ? "The object state and the external baseline may keep diverging."
            : "对象现状和对外基线可能继续分叉。",
          action: {
            type: "open_versions",
            label: getActionLabel("reviewVersionDiff", locale),
            section: "detail",
            action: "review_latest",
          } as SkillOverviewAction,
        }
      : null,
    state.hasChanges
      ? {
          key: "unsnapshotted-workspace",
          severity: "attention" as const,
          title: locale === "en-US" ? "Workspace changes are still outside snapshots" : "工作区改动尚未入快照",
          detail: locale === "en-US"
            ? `${formatCountLabel(state.changedFileCount, locale, "file", "个文件")} are still local drafts. External flows will not read these changes.`
            : `${state.changedFileCount} 个文件仍停留在本地草稿区，外部链路不会读取这些改动。`,
          impact: locale === "en-US"
            ? "Before releasing or delivering, capture the workspace as a new snapshot first."
            : "继续发布或交付前，建议先把工作区收口成新快照。",
          action: {
            type: "open_versions",
            label: getActionLabel("createNewSnapshot", locale),
            section: "detail",
            action: "create_snapshot",
          } as SkillOverviewAction,
        }
      : null,
    state.platformStateLoaded && state.activeSnapshot && state.availablePlatformCount > 0 && state.currentVersionPlatformCount === 0
      ? {
          key: "missing-platform-carry",
          severity: "attention" as const,
          title: locale === "en-US" ? "The current version is not in platform carrying yet" : "当前版本尚未进入平台承接",
          detail: locale === "en-US"
            ? `${formatVersion(state.activeSnapshot, locale)} is already current, but no platform is actually carrying it yet.`
            : `${formatVersion(state.activeSnapshot, locale)} 已经是当前版本，但还没有平台真正承接该版本。`,
          impact: locale === "en-US"
            ? "The overview only reflects the object baseline. It does not mean external release has taken effect."
            : "概览页看到的只是对象基线，不代表对外发布已经生效。",
          action: {
            type: "open_versions",
            label: getActionLabel("viewPlatformRelease", locale),
            section: "release",
          } as SkillOverviewAction,
        }
      : null,
    state.deliveryStateLoaded && state.pendingTeamCount > 0
      ? {
          key: "pending-team-review",
          severity: "attention" as const,
          title: locale === "en-US" ? "There are pending team deliveries" : "存在待审团队交付",
          detail:
            locale === "en-US"
              ? (
                state.currentVersionPendingTeamCount > 0
                  ? `${formatCountLabel(state.currentVersionPendingTeamCount, locale, "team", "个团队")} are reviewing the current version.`
                  : "Some team deliveries are still under review and need follow-up."
              )
              : (
                state.currentVersionPendingTeamCount > 0
                  ? `当前版本已有 ${state.currentVersionPendingTeamCount} 个团队正在审查。`
                  : "已有团队交付仍处于待审状态，需要继续跟进处理结果。"
              ),
          impact: locale === "en-US"
            ? "The team flow is still moving. The overview should not be treated as fully stable yet."
            : "团队链路仍在流转中，不宜把概览误判为完全稳定。",
          action: {
            type: "open_versions",
            label: getActionLabel("viewTeamDelivery", locale),
            section: "team",
          } as SkillOverviewAction,
        }
      : null,
    state.platformStateLoaded && state.activeSnapshot && state.otherVersionPlatformCount > 0
      ? {
          key: "stale-platform-carry",
          severity: "watch" as const,
          title: locale === "en-US" ? "Some platforms are still on older versions" : "仍有平台停留在旧版本",
          detail: locale === "en-US"
            ? `${formatCountLabel(state.otherVersionPlatformCount, locale, "platform", "个平台")} are still carrying older versions. The platform flow has not fully converged yet.`
            : `${state.otherVersionPlatformCount} 个平台仍承接历史版本，平台链路还没有完全收敛。`,
          impact: locale === "en-US"
            ? "Users may see different skill versions across platforms."
            : "用户可能在不同平台上看到不同版本的技能结果。",
          action: {
            type: "open_versions",
            label: getActionLabel("convergePlatformCarrying", locale),
            section: "release",
          } as SkillOverviewAction,
        }
      : null,
    state.deliveryStateLoaded && state.activeSnapshot && state.deliveryEntryCount > 0 && state.currentVersionTeamCount === 0
      ? {
          key: "missing-team-delivery",
          severity: "watch" as const,
          title: locale === "en-US" ? "The current version has not entered team delivery yet" : "当前版本尚未进入团队交付",
          detail: locale === "en-US"
            ? `${formatVersion(state.activeSnapshot, locale)} has not entered any team's current carrying or pending review flow yet.`
            : `${formatVersion(state.activeSnapshot, locale)} 还没有进入任何团队的当前承接或待审链路。`,
          impact: locale === "en-US"
            ? "Teams may still see an older version or no state at all."
            : "团队侧看到的仍可能是旧版本或空白状态。",
          action: {
            type: "open_versions",
            label: getActionLabel("startTeamDelivery", locale),
            section: "team",
          } as SkillOverviewAction,
        }
      : null,
    state.deliveryStateLoaded && state.activeSnapshot && state.otherVersionTeamCount > 0
      ? {
          key: "stale-team-delivery",
          severity: "watch" as const,
          title: locale === "en-US" ? "Some teams are still on older versions" : "仍有团队停留在旧版本",
          detail: locale === "en-US"
            ? `${formatCountLabel(state.otherVersionTeamCount, locale, "team", "个团队")} are not carrying the current version.`
            : `${state.otherVersionTeamCount} 个团队当前承接的不是当前版本。`,
          impact: locale === "en-US"
            ? "Teams may continue collaborating on different versions, which distorts later delivery judgments."
            : "不同团队会基于不同版本继续协作，后续交付判断容易失真。",
          action: {
            type: "open_versions",
            label: getActionLabel("convergeTeamDelivery", locale),
            section: "team",
          } as SkillOverviewAction,
        }
      : null,
    state.platformStateLoaded && state.activeSnapshot && state.availablePlatformCount === 0
      ? {
          key: "no-platform-entry",
          severity: "watch" as const,
          title: locale === "en-US" ? "There is no available platform entry yet" : "还没有可用平台入口",
          detail: locale === "en-US"
            ? "The skill already has a current version, but the overview has not found any platform that can carry it."
            : "当前技能已经有当前版本，但概览页没有发现可承接的平台。",
          impact: locale === "en-US"
            ? "The platform release flow still has nowhere executable to go."
            : "平台同步链路还没有可执行去向。",
          action: {
            type: "open_settings",
            label: getActionLabel("platformSettings", locale),
          } as SkillOverviewAction,
        }
      : null,
    state.activeSnapshot && state.deliveryEntryCount === 0
      ? {
          key: "no-team-entry",
          severity: "watch" as const,
          title: locale === "en-US" ? "There is no team collaboration entry yet" : "还没有团队空间入口",
          detail: locale === "en-US"
            ? "The current skill still cannot continuously deliver a version for team-side carrying."
            : "当前技能还无法把某个版本持续交付给团队侧承接。",
          impact: locale === "en-US"
            ? "Team delivery records and later readback ability will not form yet."
            : "团队交付记录与后续回读能力都不会形成。",
          action: {
            type: "open_teams",
            label: getActionLabel("teamManagement", locale),
          } as SkillOverviewAction,
        }
      : null,
    state.descriptionMissing
      ? {
          key: "missing-description",
          severity: "watch" as const,
          title: locale === "en-US" ? "The skill description is still thin" : "技能说明仍然偏弱",
          detail: locale === "en-US"
            ? "The top description is the first entry for restoring skill context. It is worth strengthening a bit."
            : "顶部描述是恢复技能上下文的第一入口，当前建议再补强一点。",
          impact: locale === "en-US"
            ? "Later retrieval, handoff, and readback efficiency will all suffer."
            : "后续检索、交接和回读效率都会受影响。",
          action: {
            type: "open_files",
            label: getActionLabel("enhanceDescription", locale),
            filePath: state.entryPoint.path,
          } as SkillOverviewAction,
        }
      : null,
  ];

  return items.filter((item): item is SkillOverviewAttentionItem => Boolean(item)).slice(0, 4);
}
