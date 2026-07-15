import type { SkillPlatformReleaseOverview, SkillSnapshot } from "@/types/skill";
import type { SkillTeamDeliveryOverview } from "@/types/team";
import { isSystemSnapshot } from "@/features/snapshots/model/snapshotSource";
import {
  formatEventTime,
  getActionLabel,
  getDeliveryRecordDetail,
  getDeliveryRecordTitle,
  getReleaseRecordDetail,
  getReleaseRecordTitle,
} from "./skillOverviewFormatters";
import type { SkillOverviewAction, SkillOverviewActivityItem, UiLanguage } from "./skillOverviewTypes";

export function buildActivityItems(
  snapshots: SkillSnapshot[],
  platformReleaseOverview: SkillPlatformReleaseOverview | null,
  teamDeliveryOverview: SkillTeamDeliveryOverview | null,
  locale: UiLanguage = "zh-CN",
): SkillOverviewActivityItem[] {
  const snapshotActivities = snapshots.slice(0, 4).map((snapshot) => ({
    key: `snapshot-${snapshot.id}`,
    kind: "snapshot" as const,
    title: isSystemSnapshot(snapshot)
      ? (locale === "en-US"
        ? `System restore point created v${snapshot.snapshotNumber}`
        : `已创建系统恢复点 v${snapshot.snapshotNumber}`)
      : (locale === "en-US"
        ? `Snapshot created v${snapshot.snapshotNumber}`
        : `已创建快照 v${snapshot.snapshotNumber}`),
    detail: isSystemSnapshot(snapshot)
      ? snapshot.changeSummary?.trim() || (locale === "en-US" ? "System restore points are only used to recover the workspace." : "系统恢复点仅用于恢复工作副本。")
      : snapshot.isActive
        ? snapshot.changeSummary?.trim()
          ? (locale === "en-US"
            ? `Current version · ${snapshot.changeSummary.trim()}`
            : `当前版本 · ${snapshot.changeSummary.trim()}`)
          : (locale === "en-US" ? "Current version" : "当前版本")
        : snapshot.changeSummary?.trim() || (locale === "en-US" ? "This snapshot still has no version note." : "该快照还没有补充版本说明。"),
    meta: formatEventTime(snapshot.createdAt, locale),
    timestamp: snapshot.createdAt,
    tone: isSystemSnapshot(snapshot) ? ("warning" as const) : snapshot.isActive ? ("active" as const) : ("neutral" as const),
    action: {
      type: "open_versions",
      label: getActionLabel("openVersions", locale),
      section: "detail",
      emphasis: "ghost",
    } satisfies SkillOverviewAction,
  }));

  const releaseActivities = (platformReleaseOverview?.recentRecords ?? []).slice(0, 4).map((record) => ({
    key: `release-${record.id}`,
    kind: "release" as const,
    title: getReleaseRecordTitle(record, locale),
    detail: getReleaseRecordDetail(record, locale),
    meta: formatEventTime(record.createdAt, locale),
    timestamp: record.createdAt,
    tone: record.status === "success" ? ("ready" as const) : ("warning" as const),
    action: {
      type: "open_versions",
      label: getActionLabel("viewPlatformRelease", locale),
      section: "release",
      emphasis: "ghost",
    } satisfies SkillOverviewAction,
  }));

  const deliveryActivities = (teamDeliveryOverview?.recentRecords ?? []).slice(0, 4).map((record) => ({
    key: `delivery-${record.id}`,
    kind: "delivery" as const,
    title: getDeliveryRecordTitle(record, locale),
    detail: getDeliveryRecordDetail(record, locale),
    meta: formatEventTime(record.createdAt, locale),
    timestamp: record.createdAt,
    tone:
      record.status === "pending"
        ? ("active" as const)
        : record.status === "success"
          ? ("ready" as const)
          : ("warning" as const),
    action: {
      type: "open_versions",
      label: getActionLabel("viewTeamDelivery", locale),
      section: "team",
      emphasis: "ghost",
    } satisfies SkillOverviewAction,
  }));

  return [...snapshotActivities, ...releaseActivities, ...deliveryActivities]
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, 6);
}
