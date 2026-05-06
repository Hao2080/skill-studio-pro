import {
  formatCountLabel,
  formatVersion,
  getActionLabel,
} from "./skillOverviewFormatters";
import type {
  SkillOverviewAction,
  SkillOverviewDerivedState,
  SkillOverviewMode,
  SkillOverviewNextStep,
  SkillOverviewTone,
  UiLanguage,
} from "./skillOverviewTypes";

export function getDominantMode(state: SkillOverviewDerivedState): SkillOverviewMode {
  if (!state.hasSnapshots) {
    return "setup";
  }

  if (state.hasChanges) {
    return "drafting";
  }

  if (!state.activeSnapshot || state.activeVersionBehindLatest) {
    return "decision";
  }

  if (state.pendingTeamCount > 0) {
    return "reviewing";
  }

  if (
    (state.platformStateLoaded &&
      (state.currentVersionPlatformCount === 0 || state.otherVersionPlatformCount > 0 || state.availablePlatformCount === 0)) ||
    (state.deliveryStateLoaded &&
      (state.currentVersionTeamCount === 0 || state.otherVersionTeamCount > 0))
  ) {
    return "attention";
  }

  return "ready";
}

export function getDominantModeLabel(mode: SkillOverviewMode, locale: UiLanguage = "zh-CN") {
  if (locale === "en-US") {
    switch (mode) {
      case "setup":
        return "Not Set Up";
      case "drafting":
        return "Drafting";
      case "decision":
        return "Needs Decision";
      case "reviewing":
        return "In Transit";
      case "attention":
        return "Needs Convergence";
      default:
        return "Stable";
    }
  }

  switch (mode) {
    case "setup":
      return "待建立";
    case "drafting":
      return "草稿中";
    case "decision":
      return "待决策";
    case "reviewing":
      return "流转中";
    case "attention":
      return "需收敛";
    default:
      return "稳定";
  }
}

export function getDominantModeTone(mode: SkillOverviewMode): SkillOverviewTone {
  switch (mode) {
    case "setup":
    case "decision":
    case "attention":
      return "warning";
    case "drafting":
    case "reviewing":
      return "active";
    default:
      return "ready";
  }
}

export function buildHelperText(state: SkillOverviewDerivedState, locale: UiLanguage = "zh-CN") {
  if (!state.activeSnapshot) {
    return locale === "en-US"
      ? "The overview only judges the object's overall state. Platform and team flows cannot align until the current version is explicitly set in Versions."
      : "概览页只判断对象总状态。只有在版本区明确当前版本后，平台和团队链路才会真正对齐。";
  }

  if (state.hasChanges) {
    return locale === "en-US"
      ? "Workspace drafts do not automatically enter platform release or team delivery. Only snapshot objects move into downstream external flows."
      : "工作副本草稿不会自动进入平台同步或团队交付。只有快照对象才会进入后续外部链路。";
  }

  if (state.otherVersionPlatformCount > 0 || state.otherVersionTeamCount > 0) {
    return locale === "en-US"
      ? "The current version already exists, but external carrying has not fully converged yet. The overview prioritizes drift and pending work."
      : "当前版本已经存在，但外部承接尚未完全收敛。概览页优先提示链路偏移与待处理事项。";
  }

  if (state.pendingTeamCount > 0) {
    return locale === "en-US"
      ? "Team delivery and platform release are independent. The overview is currently focused on pending review flow so you can return to Versions and continue."
      : "团队交付与平台同步相互独立。当前概览聚焦待审流转，便于你回到版本页继续处理。";
  }

  return locale === "en-US"
    ? `The current control baseline is ${formatVersion(state.activeSnapshot, locale)}. The overview only keeps status, risk, and next-step entry points.`
    : `当前总控以 ${formatVersion(state.activeSnapshot, locale)} 为对象基线，概览页只保留状态、风险与下一步入口。`;
}

export function buildNextStep(state: SkillOverviewDerivedState, locale: UiLanguage = "zh-CN"): SkillOverviewNextStep {
  const continueEditingAction: SkillOverviewAction = {
    type: "open_files",
    label: getActionLabel("continueEditing", locale),
    filePath: state.entryPoint.path,
    emphasis: "ghost",
  };
  const versionDetailAction: SkillOverviewAction = {
    type: "open_versions",
    label: getActionLabel("openVersions", locale),
    section: "detail",
    emphasis: "ghost",
  };

  if (!state.hasSnapshots) {
    return {
      title: locale === "en-US" ? "Create the first snapshot" : "创建首个快照",
      reason: state.hasChanges
        ? (locale === "en-US"
          ? "The workspace already changed, but there is still no version baseline."
          : "工作区已有改动，但还没有建立任何版本基线。")
        : (locale === "en-US"
          ? "This skill has not entered a trackable version flow yet."
          : "当前技能还没有进入可追踪的版本链路。"),
      expectedResult: locale === "en-US"
        ? "Create the first snapshot, then continue with current version, platform carrying, and team delivery."
        : "先形成首个快照对象，再进入当前版本、平台承接和团队交付。",
      primaryAction: {
        type: "open_versions",
        label: getActionLabel("createFirstSnapshot", locale),
        section: "detail",
        action: "create_snapshot",
        emphasis: "primary",
      },
      secondaryActions: [continueEditingAction, versionDetailAction],
    };
  }

  if (state.hasChanges) {
    return {
      title: locale === "en-US" ? "Close out the current draft" : "收口当前草稿",
      reason: locale === "en-US"
        ? `${formatCountLabel(state.changedFileCount, locale, "file", "个文件")} are still outside snapshots. External flows will not read these changes.`
        : `工作区仍有 ${state.changedFileCount} 个文件未入快照，外部链路不会读取这些改动。`,
      expectedResult: locale === "en-US"
        ? "Capture the current workspace as a new snapshot, then decide whether to promote the current version."
        : "把当前工作副本收成新快照，再继续评估是否升级当前版本。",
      primaryAction: {
        type: "open_versions",
        label: getActionLabel("createNewSnapshot", locale),
        section: "detail",
        action: "create_snapshot",
        emphasis: "primary",
      },
      secondaryActions: [continueEditingAction, versionDetailAction],
    };
  }

  if (!state.activeSnapshot) {
    return {
      title: locale === "en-US" ? "Set the current version" : "明确当前版本",
      reason: locale === "en-US"
        ? "Snapshots already exist, but no external baseline has been chosen yet. Platform and team flows cannot stabilize."
        : "技能已经有快照，但还没有指定对外基线，平台和团队链路都无法稳定依附。",
      expectedResult: locale === "en-US"
        ? "Once the current version is set, the overview can judge the real external carrying state."
        : "设置当前版本后，概览页才能判断真实的对外承接状态。",
      primaryAction: {
        type: "open_versions",
        label: getActionLabel("setCurrentVersion", locale),
        section: "detail",
        action: "set_active",
        emphasis: "primary",
      },
      secondaryActions: [versionDetailAction, continueEditingAction],
    };
  }

  if (state.activeVersionBehindLatest) {
    return {
      title: locale === "en-US" ? "Review whether to promote the latest snapshot" : "审查最新快照是否升级",
      reason: locale === "en-US"
        ? `${formatVersion(state.activeSnapshot, locale)} is still current, but the latest snapshot is already ${formatVersion(state.latestSnapshot, locale)}.`
        : `${formatVersion(state.activeSnapshot, locale)} 仍是当前版本，但最新快照已经推进到 ${formatVersion(state.latestSnapshot, locale)}。`,
      expectedResult: locale === "en-US"
        ? "Review in Versions whether the latest snapshot should become the current version so external flows stay aligned."
        : "在版本页确认是否把最新快照升级为当前版本，避免对外链路与对象现状脱节。",
      primaryAction: {
        type: "open_versions",
        label: getActionLabel("reviewVersionDiff", locale),
        section: "detail",
        action: "review_latest",
        emphasis: "primary",
      },
      secondaryActions: [versionDetailAction, continueEditingAction],
    };
  }

  if (state.platformStateLoaded && state.availablePlatformCount > 0 && state.currentVersionPlatformCount === 0) {
    return {
      title: locale === "en-US" ? "Let the current version enter platform carrying" : "让当前版本进入平台承接",
      reason: locale === "en-US"
        ? `${formatVersion(state.activeSnapshot, locale)} is already current, but no platform is carrying it yet.`
        : `${formatVersion(state.activeSnapshot, locale)} 已经是当前版本，但还没有任何平台承接该版本。`,
      expectedResult: locale === "en-US"
        ? "Push the current version into the platform flow so it becomes a stable external release object."
        : "把当前版本推入平台链路，形成稳定的对外发布对象。",
      primaryAction: {
        type: "open_versions",
        label: getActionLabel("releaseCurrentVersion", locale),
        section: "release",
        emphasis: "primary",
      },
      secondaryActions: [
        versionDetailAction,
        { type: "open_settings", label: getActionLabel("platformSettings", locale), emphasis: "ghost" },
      ],
    };
  }

  if (state.deliveryStateLoaded && state.deliveryEntryCount > 0 && state.currentVersionTeamCount === 0) {
    return {
      title: locale === "en-US" ? "Let the current version enter team delivery" : "让当前版本进入团队交付",
      reason: locale === "en-US"
        ? `${formatVersion(state.activeSnapshot, locale)} has not entered any team's current carrying or pending review flow yet.`
        : `${formatVersion(state.activeSnapshot, locale)} 还没有进入任何团队的当前承接或待审链路。`,
      expectedResult: locale === "en-US"
        ? "Send the current version into the team workspace so its delivery state can be tracked."
        : "把当前版本送入团队空间，后续交付状态才能被持续追踪。",
      primaryAction: {
        type: "open_versions",
        label: getActionLabel("deliverCurrentVersion", locale),
        section: "team",
        emphasis: "primary",
      },
      secondaryActions: [
        versionDetailAction,
        { type: "open_teams", label: getActionLabel("teamManagement", locale), emphasis: "ghost" },
      ],
    };
  }

  if (state.deliveryStateLoaded && state.pendingTeamCount > 0) {
    return {
      title: locale === "en-US" ? "Follow up on pending team deliveries" : "跟进待审团队交付",
      reason: locale === "en-US"
        ? `${formatCountLabel(state.pendingTeamCount, locale, "team", "个团队")} are still pending review. The delivery flow has not settled yet.`
        : `当前有 ${state.pendingTeamCount} 个团队处于待审状态，交付链路还没有完全落稳。`,
      expectedResult: locale === "en-US"
        ? "Return to the team delivery workspace to review, revise, or withdraw."
        : "回到团队交付视图继续查看待审、改交或撤回动作。",
      primaryAction: {
        type: "open_versions",
        label: getActionLabel("viewTeamDelivery", locale),
        section: "team",
        emphasis: "primary",
      },
      secondaryActions: [
        versionDetailAction,
        { type: "open_teams", label: getActionLabel("teamManagement", locale), emphasis: "ghost" },
      ],
    };
  }

  if (state.platformStateLoaded && state.availablePlatformCount === 0) {
    return {
      title: locale === "en-US" ? "Set up platform entries" : "补齐平台入口",
      reason: locale === "en-US"
        ? "The current version is clear, but the overview has not found any available platform entry yet."
        : "当前版本已经明确，但概览页还没有发现任何可承接的平台入口。",
      expectedResult: locale === "en-US"
        ? "Once a platform is connected and enabled, the overview can show the real platform carrying distribution."
        : "接入并启用平台后，概览页才能显示真实的平台承接分布。",
      primaryAction: {
        type: "open_settings",
        label: getActionLabel("openPlatformSettings", locale),
        emphasis: "primary",
      },
      secondaryActions: [
        versionDetailAction,
        { type: "open_teams", label: getActionLabel("teamManagement", locale), emphasis: "ghost" },
      ],
    };
  }

  if (state.deliveryEntryCount === 0) {
    return {
      title: locale === "en-US" ? "Set up team collaboration" : "补齐团队空间入口",
      reason: locale === "en-US"
        ? "This skill has no team collaboration entry yet, so the team flow cannot form a closed loop."
        : "当前技能还没有任何团队空间入口，团队链路无法形成完整闭环。",
      expectedResult: locale === "en-US"
        ? "After teams exist, each version's delivery target and history can be retained."
        : "建立团队后，后续每个版本的交付对象与流转记录才能被持续保留。",
      primaryAction: {
        type: "open_teams",
        label: getActionLabel("openTeamManagement", locale),
        emphasis: "primary",
      },
      secondaryActions: [
        versionDetailAction,
        { type: "open_settings", label: getActionLabel("platformSettings", locale), emphasis: "ghost" },
      ],
    };
  }

  if (state.otherVersionPlatformCount > 0 || state.otherVersionTeamCount > 0) {
    return {
      title: locale === "en-US" ? "Converge external carrying" : "收敛外部承接分叉",
      reason:
        locale === "en-US"
          ? (
            state.otherVersionPlatformCount > 0 && state.otherVersionTeamCount > 0
              ? `There are still ${formatCountLabel(state.otherVersionPlatformCount, locale, "platform", "个平台")} and ${formatCountLabel(state.otherVersionTeamCount, locale, "team", "个团队")} on older versions.`
              : state.otherVersionPlatformCount > 0
                ? `There are still ${formatCountLabel(state.otherVersionPlatformCount, locale, "platform", "个平台")} on older versions.`
                : `There are still ${formatCountLabel(state.otherVersionTeamCount, locale, "team", "个团队")} on older versions.`
          )
          : (
            state.otherVersionPlatformCount > 0 && state.otherVersionTeamCount > 0
              ? `仍有 ${state.otherVersionPlatformCount} 个平台和 ${state.otherVersionTeamCount} 个团队停留在旧版本。`
              : state.otherVersionPlatformCount > 0
                ? `仍有 ${state.otherVersionPlatformCount} 个平台停留在旧版本。`
                : `仍有 ${state.otherVersionTeamCount} 个团队停留在旧版本。`
          ),
      expectedResult: locale === "en-US"
        ? "Return to Versions and republish or redeliver so the current version becomes the single external baseline."
        : "回到版本页统一改发或改交，让当前版本成为真正一致的外部基线。",
      primaryAction: {
        type: "open_versions",
        label: getActionLabel("viewExternalCarrying", locale),
        section: state.otherVersionPlatformCount > 0 ? "release" : "team",
        emphasis: "primary",
      },
      secondaryActions: [versionDetailAction, continueEditingAction],
    };
  }

  return {
    title: locale === "en-US" ? "The current flow is largely stable" : "当前链路已基本稳定",
    reason: locale === "en-US"
      ? `${formatVersion(state.activeSnapshot, locale)} is already the current object version, and there are no obvious blockers in the external flow.`
      : `${formatVersion(state.activeSnapshot, locale)} 已经成为对象当前版本，外部链路也没有明显阻塞。`,
    expectedResult: locale === "en-US"
      ? "The overview only keeps state judgments. Go deeper in Versions when you need to release, deliver, or review."
      : "概览页只保留状态判断；继续发布、交付或审查时再进入版本页深度处理。",
    primaryAction: {
      type: "open_versions",
      label: getActionLabel("openVersionWorkbench", locale),
      section: "detail",
      emphasis: "primary",
    },
    secondaryActions: [continueEditingAction],
  };
}
