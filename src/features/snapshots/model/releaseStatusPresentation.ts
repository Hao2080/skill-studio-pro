import type {
  PlatformReleaseRecord,
  SkillPlatformReleaseStatus,
  SkillSnapshot,
} from "@/types/skill";
import { isSystemSnapshot } from "@/features/snapshots/model/snapshotSource";
import type { UiLanguage } from "./presentationTypes";

export function formatReleaseTime(timestamp: number, locale: UiLanguage) {
  return new Date(timestamp).toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPlatformCount(count: number, language: UiLanguage) {
  if (language === "en-US") {
    return `${count} platform${count === 1 ? "" : "s"}`;
  }

  return `${count} 个平台`;
}

export function getReleaseActionLabel(action: string, language: UiLanguage) {
  const labels = language === "en-US"
    ? {
        publish: "Publish",
        republish: "Republish",
        switch: "Switch",
        remove: "Remove",
        park: "Park",
        restore: "Restore",
        sync: "Sync",
      }
    : {
        publish: "发布",
        republish: "重发",
        switch: "改发",
        remove: "移除",
        park: "停放",
        restore: "恢复",
        sync: "同步",
      };

  switch (action) {
    case "publish":
      return labels.publish;
    case "republish":
      return labels.republish;
    case "switch":
      return labels.switch;
    case "remove":
      return labels.remove;
    case "park":
      return labels.park;
    case "restore":
      return labels.restore;
    default:
      return labels.sync;
  }
}

export function getPrimaryActionLabel(
  release: SkillPlatformReleaseStatus,
  selectedSnapshot: SkillSnapshot | null,
  language: UiLanguage,
) {
  if (!selectedSnapshot || isSystemSnapshot(selectedSnapshot) || !release.detected || !release.enabled || !release.skillsDir) {
    return null;
  }

  if (release.currentTarget?.snapshotId === selectedSnapshot.id) {
    return language === "en-US" ? "Republish" : "重新发布";
  }

  return release.currentTarget
    ? (language === "en-US" ? "Switch to This Version" : "改发为此版本")
    : (language === "en-US" ? "Sync This Version" : "同步此版本");
}

export function getPlatformState(
  release: SkillPlatformReleaseStatus,
  selectedSnapshot: SkillSnapshot | null,
  language: UiLanguage,
) {
  if (!release.detected) {
    return {
      tone: "warning" as const,
      label: language === "en-US" ? "Not Detected" : "未检测到",
      detail: language === "en-US"
        ? "The current platform directory is unavailable, so new versions cannot be published."
        : "当前平台目录不可用，暂时无法同步新版本。",
    };
  }

  if (release.currentTarget && selectedSnapshot && release.currentTarget.snapshotId === selectedSnapshot.id) {
    return {
      tone: "ready" as const,
      label: language === "en-US" ? "Serving Current Version" : "承接当前版本",
      detail: language === "en-US"
        ? "This platform is already serving the currently selected snapshot."
        : "该平台已经承接当前选中的快照。",
    };
  }

  if (release.currentTarget) {
    return {
      tone: "active" as const,
      label: language === "en-US"
        ? `Serving v${release.currentTarget.snapshotNumber}`
        : `承接 v${release.currentTarget.snapshotNumber}`,
      detail: language === "en-US"
        ? "This platform is serving another snapshot and can be switched directly."
        : "该平台当前承接的是另一份快照，可以直接改发。",
    };
  }

  if (!release.enabled) {
    return {
      tone: "neutral" as const,
      label: language === "en-US" ? "Connected but Disabled" : "已接入未启用",
      detail: language === "en-US"
        ? "Enable this platform before publishing snapshots to it."
        : "启用后才允许将快照发布到该平台。",
    };
  }

  return {
    tone: "neutral" as const,
    label: language === "en-US" ? "Ready to Publish" : "待发布",
    detail: language === "en-US"
      ? "This platform is not serving any snapshot yet and can publish this version directly."
      : "该平台尚未承接任何快照，可以直接同步此版本。",
  };
}

export function getRecordHeadline(record: PlatformReleaseRecord, language: UiLanguage) {
  const snapshotLabel = record.snapshotNumber != null ? ` · v${record.snapshotNumber}` : "";
  const statusLabel = language === "en-US"
    ? (record.status === "success" ? "Success" : "Failed")
    : (record.status === "success" ? "成功" : "失败");
  return language === "en-US"
    ? `${getReleaseActionLabel(record.action, language)} · ${statusLabel}${snapshotLabel}`
    : `${getReleaseActionLabel(record.action, language)}${statusLabel}${snapshotLabel}`;
}

export function getRecordDetail(record: PlatformReleaseRecord, language: UiLanguage) {
  if (record.errorMessage) {
    return record.errorMessage;
  }

  if (record.changeSummary?.trim()) {
    return record.changeSummary.trim();
  }

  return language === "en-US" ? "The platform release record has been written." : "已写入平台同步记录。";
}

export function getPlatformLabel(platformName: string, displayName?: string) {
  return displayName?.trim() || platformName;
}

export function getReleaseStatusCopy(language: UiLanguage) {
  return language === "en-US"
    ? {
        title: "Platform Sync",
        released: "Served",
        pending: "Ready to Release",
        requireSnapshot: "Select Snapshot",
        blocked: "Unavailable",
        subtitle:
          "Manage platform serving, switching, republishing, and removal by snapshot instead of relying on session-only feedback.",
        publish: "Sync to Platforms",
        openSettings: "Open Settings",
        currentTarget: "Current Target",
        otherTarget: "Other Targets",
        latestAction: "Latest Action",
        currentObject: "Current Object",
        workspaceDraft: "Working Copy Draft",
        directBlocked: "Not publishable",
        noRecord: "None",
        focusActive: "Focus Active Version",
        dirReady: "Directory Connected",
        dirMissing: "Directory Missing",
        enabled: "Enabled",
        disabled: "Disabled",
        servedAt: (time: string) => `Served at ${time}`,
        currentServing: "Current Target",
        latestRecord: "Latest Record",
        noTarget: "Not Serving",
        noSummary: "A version is currently served, but no summary has been provided yet.",
        noRelease: "This platform is not serving any version yet and can publish a new snapshot directly.",
        disabledOnly: "This platform is disabled, so only status and record views are available.",
        viewRecords: "View Records",
        remove: "Remove from Platform",
        emptyTitle: "No platform release data yet",
        emptyDescription: "Once platforms are detected and connected, their current targets and recent records will appear here.",
        recordsTitle: "Sync Records",
        recordsDescription: "Recent actions stay visible after re-entering the page.",
        viewAll: "View All Platforms",
        noRecordWithFilter: (label: string) => `${label} has no records yet`,
        noRecords: "No release records yet",
        noRecordsDescription: "After publish, switch, republish, or remove, recent actions will remain here.",
        summaryAria: "Platform release summary",
        workbenchAria: "Platform release workbench",
        recordsAria: "Platform release records",
        restorePoint: (snapshotNumber: number) => `Restore Point v${snapshotNumber}`,
        currentVersionServedBy: (count: number) => `Current version is served by ${formatPlatformCount(count, "en-US")}`,
        otherVersionsServedBy: (count: number) =>
          `${formatPlatformCount(count, "en-US")} ${count === 1 ? "still serves" : "still serve"} other versions and can be switched below.`,
        selectedCoverageStable: "The selected snapshot already has stable external platform coverage.",
        currentVersionNotReleased: "Current version has not been released yet",
        switchOtherVersions: "Some platforms serve other versions and can be switched to the current snapshot below.",
        publishPerPlatform: "Publish the current snapshot per platform below and keep a readable record afterwards.",
        noRecordItem: "No Record",
      }
    : {
        title: "平台同步",
        released: "已承接",
        pending: "待发布",
        requireSnapshot: "需选快照",
        blocked: "不可发布",
        subtitle: "按快照管理平台承接、改发、重发与移除，不再依赖一次性会话结果。",
        publish: "同步到平台",
        openSettings: "前往设置",
        currentTarget: "当前版本承接",
        otherTarget: "其他版本承接",
        latestAction: "最近操作",
        currentObject: "当前查看对象",
        workspaceDraft: "工作副本草稿",
        directBlocked: "不可直接发布",
        noRecord: "暂无",
        focusActive: "聚焦当前生效版本",
        dirReady: "目录已接入",
        dirMissing: "目录缺失",
        enabled: "已启用",
        disabled: "未启用",
        servedAt: (time: string) => `最近承接于 ${time}`,
        currentServing: "当前承接",
        latestRecord: "最近记录",
        noTarget: "未承接",
        noSummary: "当前平台已有承接版本，但还没有填写说明。",
        noRelease: "当前平台还没有承接版本，可直接同步新的快照。",
        disabledOnly: "当前平台尚未启用，只保留状态与记录展示。",
        viewRecords: "查看记录",
        remove: "从平台移除",
        emptyTitle: "暂无平台同步信息",
        emptyDescription: "检测并接入平台后，这里会显示各平台当前承接的快照与最近记录。",
        recordsTitle: "同步记录",
        recordsDescription: "保留最近操作，后续再次进入页面时仍可回看。",
        viewAll: "查看全部平台",
        noRecordWithFilter: (label: string) => `${label} 暂无记录`,
        noRecords: "暂无同步记录",
        noRecordsDescription: "执行发布、改发、重发或移除后，这里会持续保留最近操作结果。",
        summaryAria: "平台同步摘要",
        workbenchAria: "平台同步管理",
        recordsAria: "平台同步记录",
        restorePoint: (snapshotNumber: number) => `恢复点 v${snapshotNumber}`,
        currentVersionServedBy: (count: number) => `当前版本已承接到 ${formatPlatformCount(count, "zh-CN")}`,
        otherVersionsServedBy: (count: number) => `${formatPlatformCount(count, "zh-CN")}仍停留在其他版本，可直接在下方改发。`,
        selectedCoverageStable: "当前选中快照已经形成稳定的对外承接。",
        currentVersionNotReleased: "当前版本尚未发布",
        switchOtherVersions: "已有平台承接其他版本，可在下方直接改发为当前快照。",
        publishPerPlatform: "下方可按平台同步当前快照，并保留后续可回读的同步记录。",
        noRecordItem: "暂无记录",
      };
}
