import type { PlatformReleaseRecord, SkillSnapshot } from "@/types/skill";
import type { TeamDeliveryRecord } from "@/types/team";
import type { UiLanguage } from "./skillOverviewTypes";

export function formatEventTime(timestamp: number | null | undefined, locale: UiLanguage = "zh-CN") {
  if (!timestamp) {
    return locale === "en-US" ? "No records yet" : "暂无记录";
  }

  return new Date(timestamp).toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatVersion(snapshot: SkillSnapshot | null, locale: UiLanguage = "zh-CN") {
  return snapshot ? `v${snapshot.snapshotNumber}` : locale === "en-US" ? "Not Set" : "未设置";
}

export type SkillOverviewActionLabelKey =
  | "continueEditing"
  | "openVersions"
  | "createFirstSnapshot"
  | "createNewSnapshot"
  | "setCurrentVersion"
  | "reviewVersionDiff"
  | "releaseCurrentVersion"
  | "platformSettings"
  | "deliverCurrentVersion"
  | "teamManagement"
  | "viewTeamDelivery"
  | "openPlatformSettings"
  | "openTeamManagement"
  | "viewExternalCarrying"
  | "openFiles"
  | "viewPlatformRelease"
  | "startTeamDelivery"
  | "convergePlatformCarrying"
  | "convergeTeamDelivery"
  | "enhanceDescription"
  | "openVersionWorkbench";

export function formatCountLabel(
  count: number,
  locale: UiLanguage,
  singular: string,
  zhUnit: string,
  plural = `${singular}s`,
) {
  return locale === "en-US"
    ? `${count} ${count === 1 ? singular : plural}`
    : `${count} ${zhUnit}`;
}

export function getActionLabel(action: SkillOverviewActionLabelKey, locale: UiLanguage = "zh-CN") {
  if (locale === "en-US") {
    switch (action) {
      case "continueEditing":
        return "Continue Editing";
      case "openVersions":
        return "Open Versions";
      case "createFirstSnapshot":
        return "Create First Snapshot";
      case "createNewSnapshot":
        return "Create New Snapshot";
      case "setCurrentVersion":
        return "Set Current Version";
      case "reviewVersionDiff":
        return "Review Version Differences";
      case "releaseCurrentVersion":
        return "Release Current Version";
      case "platformSettings":
        return "Platform Settings";
      case "deliverCurrentVersion":
        return "Deliver Current Version";
      case "teamManagement":
        return "Team Management";
      case "viewTeamDelivery":
        return "View Team Deliveries";
      case "openPlatformSettings":
        return "Open Platform Settings";
      case "openTeamManagement":
        return "Open Team Management";
      case "viewExternalCarrying":
        return "View External Carrying";
      case "openFiles":
        return "Open Files";
      case "viewPlatformRelease":
        return "View Platform Syncs";
      case "startTeamDelivery":
        return "Start Team Delivery";
      case "convergePlatformCarrying":
        return "Converge Platform Carrying";
      case "convergeTeamDelivery":
        return "Converge Team Delivery";
      case "enhanceDescription":
        return "Strengthen Description";
      default:
        return "Open Version Workbench";
    }
  }

  switch (action) {
    case "continueEditing":
      return "继续编辑";
    case "openVersions":
      return "查看版本区";
    case "createFirstSnapshot":
      return "创建首个快照";
    case "createNewSnapshot":
      return "创建新快照";
    case "setCurrentVersion":
      return "设置当前版本";
    case "reviewVersionDiff":
      return "审查版本差异";
    case "releaseCurrentVersion":
      return "发布当前版本";
    case "platformSettings":
      return "平台设置";
    case "deliverCurrentVersion":
      return "交付当前版本";
    case "teamManagement":
      return "团队管理";
    case "viewTeamDelivery":
      return "查看团队交付";
    case "openPlatformSettings":
      return "前往平台设置";
    case "openTeamManagement":
      return "前往团队管理";
    case "viewExternalCarrying":
      return "查看外部承接";
    case "openFiles":
      return "打开文件区";
    case "viewPlatformRelease":
      return "查看平台同步";
    case "startTeamDelivery":
      return "发起团队交付";
    case "convergePlatformCarrying":
      return "收敛平台承接";
    case "convergeTeamDelivery":
      return "收敛团队交付";
    case "enhanceDescription":
      return "补充说明";
    default:
      return "查看版本管理";
  }
}

function getPlatformLabel(record: PlatformReleaseRecord) {
  return record.displayName?.trim() || record.platformName;
}

export function getReleaseRecordTitle(record: PlatformReleaseRecord, locale: UiLanguage = "zh-CN") {
  const versionLabel = record.snapshotNumber != null ? `v${record.snapshotNumber}` : locale === "en-US" ? "current skill" : "当前技能";
  const platformLabel = getPlatformLabel(record);

  if (record.status === "failed") {
    return locale === "en-US" ? `${platformLabel} release failed` : `${platformLabel} 发布失败`;
  }

  switch (record.action) {
    case "publish":
      return locale === "en-US"
        ? `Published ${versionLabel} to ${platformLabel}`
        : `已发布 ${versionLabel} 到 ${platformLabel}`;
    case "republish":
      return locale === "en-US"
        ? `Republished ${versionLabel} to ${platformLabel}`
        : `已向 ${platformLabel} 重发 ${versionLabel}`;
    case "switch":
      return locale === "en-US"
        ? `Switched ${platformLabel} to ${versionLabel}`
        : `已将 ${platformLabel} 改发为 ${versionLabel}`;
    case "remove":
      return locale === "en-US"
        ? `Removed skill from ${platformLabel}`
        : `已从 ${platformLabel} 移除技能`;
    case "park":
      return locale === "en-US"
        ? `Parked skill on ${platformLabel}`
        : `已在 ${platformLabel} 停放技能`;
    case "restore":
      return locale === "en-US"
        ? `Restored skill on ${platformLabel}`
        : `已在 ${platformLabel} 恢复技能`;
    default:
      return locale === "en-US"
        ? `${platformLabel} skill assignment updated`
        : `${platformLabel} 已更新技能承接`;
  }
}

export function getReleaseRecordDetail(record: PlatformReleaseRecord, locale: UiLanguage = "zh-CN") {
  if (record.errorMessage?.trim()) {
    return record.errorMessage.trim();
  }

  if (record.changeSummary?.trim()) {
    return record.changeSummary.trim();
  }

  return locale === "en-US" ? "Platform release record recorded." : "平台同步记录已写入。";
}

export function getDeliveryRecordTitle(record: TeamDeliveryRecord, locale: UiLanguage = "zh-CN") {
  const versionLabel = record.sourceSnapshotNumber != null ? `v${record.sourceSnapshotNumber}` : locale === "en-US" ? "current skill" : "当前技能";

  if (record.status === "failed") {
    return locale === "en-US" ? `${record.teamName} delivery failed` : `${record.teamName} 交付失败`;
  }

  switch (record.action) {
    case "submit":
    case "replace_pending":
    case "resubmit":
    case "switch":
      return locale === "en-US"
        ? `Submitted ${versionLabel} to ${record.teamName}`
        : `已向 ${record.teamName} 提交 ${versionLabel}`;
    case "merge":
      return locale === "en-US"
        ? `${record.teamName} is now carrying ${versionLabel}`
        : `团队 ${record.teamName} 已承接 ${versionLabel}`;
    case "withdraw":
      return locale === "en-US"
        ? `Withdrew pending delivery for ${record.teamName}`
        : `已撤回 ${record.teamName} 的待审交付`;
    case "remove":
      return locale === "en-US"
        ? `Removed skill assignment from ${record.teamName}`
        : `已解除 ${record.teamName} 的技能承接`;
    default:
      return locale === "en-US"
        ? `${record.teamName} delivery status updated`
        : `${record.teamName} 已更新交付状态`;
  }
}

export function getDeliveryRecordDetail(record: TeamDeliveryRecord, locale: UiLanguage = "zh-CN") {
  if (record.note?.trim()) {
    return record.note.trim();
  }

  if (record.teamVersionNumber != null && record.action === "merge") {
    return locale === "en-US"
      ? `Moved into team version v${record.teamVersionNumber}.`
      : `已进入团队版本 v${record.teamVersionNumber}。`;
  }

  if (record.changeSummary?.trim()) {
    return record.changeSummary.trim();
  }

  return record.status === "pending"
    ? (locale === "en-US" ? "Waiting for the team to process the current delivery." : "等待团队处理当前交付。")
    : (locale === "en-US" ? "Team delivery record recorded." : "团队交付记录已写入。");
}
