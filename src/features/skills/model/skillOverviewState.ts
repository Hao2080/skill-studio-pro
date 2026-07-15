import type { ChangeStatus, SkillFileNode } from "@/types/skill";
import {
  getActiveManualSnapshot,
  getLatestManualSnapshot,
  isSystemSnapshot,
} from "@/features/snapshots/model/snapshotSource";
import type {
  BuildSkillOverviewInput,
  SkillOverviewDerivedState,
  SkillOverviewEntryPoint,
  UiLanguage,
} from "./skillOverviewTypes";

function flattenTree(node: SkillFileNode | null): string[] {
  if (!node) {
    return [];
  }

  if (!node.isDir) {
    return [node.path];
  }

  return node.children.flatMap((child) => flattenTree(child));
}

function getUniqueChangedFiles(changeStatus: ChangeStatus | null) {
  if (!changeStatus) {
    return [];
  }

  return Array.from(
    new Set([...changeStatus.modifiedFiles, ...changeStatus.addedFiles, ...changeStatus.deletedFiles]),
  );
}

function findPriorityFile(paths: string[], candidates: string[]) {
  for (const candidate of candidates) {
    const matched = paths.find((path) => path.toLowerCase() === candidate.toLowerCase());
    if (matched) {
      return matched;
    }
  }

  return null;
}

function buildEntryPoint(
  changeStatus: ChangeStatus | null,
  fileTree: SkillFileNode | null,
  locale: UiLanguage = "zh-CN",
): SkillOverviewEntryPoint {
  const filePaths = flattenTree(fileTree);
  const changedFiles = getUniqueChangedFiles(changeStatus);

  if (changedFiles.includes("SKILL.md")) {
    return {
      path: "SKILL.md",
      name: "SKILL.md",
      reason:
        locale === "en-US"
          ? "The core entry changed recently. Continue tightening the skill semantics here."
          : "核心入口已改动，适合继续收口当前技能语义。",
    };
  }

  const priorityPath = findPriorityFile(filePaths, ["SKILL.md", "README.md"]);
  if (priorityPath) {
    return {
      path: priorityPath,
      name: priorityPath.split("/").pop() ?? priorityPath,
      reason:
        locale === "en-US"
          ? "The primary spec entry is the fastest way to restore context."
          : "核心说明入口可直接恢复对象上下文。",
    };
  }

  const recentChangedPath = changedFiles[0];
  if (recentChangedPath) {
    return {
      path: recentChangedPath,
      name: recentChangedPath.split("/").pop() ?? recentChangedPath,
      reason:
        locale === "en-US"
          ? "Recent work is concentrated in this file. Continue from here."
          : "最近工作集中在该文件，适合继续处理。",
    };
  }

  const firstFile = filePaths[0];
  if (firstFile) {
    return {
      path: firstFile,
      name: firstFile.split("/").pop() ?? firstFile,
      reason:
        locale === "en-US"
          ? "Resume from the current file structure entry point."
          : "从现有文件结构入口继续恢复工作。",
    };
  }

  return {
    path: "SKILL.md",
    name: "SKILL.md",
    reason:
      locale === "en-US"
        ? "Create the core spec entry first so the skill regains a maintainable structure."
        : "建议先建立核心说明入口，帮助技能恢复可维护结构。",
  };
}

export function deriveOverviewState(input: BuildSkillOverviewInput): SkillOverviewDerivedState {
  const {
    description,
    changeStatus,
    snapshots,
    teamCount = 0,
    fileTree = null,
    platformReleaseOverview = null,
    teamDeliveryOverview = null,
  } = input;
  const locale = input.language ?? "zh-CN";
  const hasChanges = changeStatus?.hasChanges ?? false;
  const changedFileCount = changeStatus
    ? changeStatus.addedFiles.length + changeStatus.modifiedFiles.length + changeStatus.deletedFiles.length
    : 0;
  const versionSnapshots = snapshots.filter((snapshot) => !isSystemSnapshot(snapshot));
  const latestSnapshot = getLatestManualSnapshot(versionSnapshots);
  const activeSnapshot = getActiveManualSnapshot(versionSnapshots);
  const activeVersionBehindLatest = Boolean(latestSnapshot && activeSnapshot && latestSnapshot.id !== activeSnapshot.id);
  const entryPoint = buildEntryPoint(changeStatus, fileTree, locale);
  const releases = platformReleaseOverview?.releases ?? [];
  const deliveries = teamDeliveryOverview?.deliveries ?? [];
  const activeSnapshotId = activeSnapshot?.id ?? null;

  const availablePlatformCount = releases.filter((release) => release.detected && release.enabled && release.skillsDir).length;
  const totalCarryingPlatformCount = releases.filter((release) => Boolean(release.currentTarget)).length;
  const currentVersionPlatformCount = activeSnapshotId
    ? releases.filter((release) => release.currentTarget?.snapshotId === activeSnapshotId).length
    : 0;
  const otherVersionPlatformCount = activeSnapshotId
    ? releases.filter((release) => release.currentTarget && release.currentTarget.snapshotId !== activeSnapshotId).length
    : totalCarryingPlatformCount;

  const pendingTeamCount = deliveries.filter((delivery) => Boolean(delivery.pendingDelivery)).length;
  const currentVersionPendingTeamCount = activeSnapshotId
    ? deliveries.filter((delivery) => delivery.pendingDelivery?.sourceSnapshotId === activeSnapshotId).length
    : 0;
  const currentVersionStableTeamCount = activeSnapshotId
    ? deliveries.filter((delivery) => delivery.currentTarget?.sourceSnapshotId === activeSnapshotId).length
    : 0;
  const currentVersionTeamCount = activeSnapshotId
    ? deliveries.filter(
        (delivery) =>
          delivery.pendingDelivery?.sourceSnapshotId === activeSnapshotId ||
          delivery.currentTarget?.sourceSnapshotId === activeSnapshotId,
      ).length
    : 0;
  const otherVersionTeamCount = activeSnapshotId
    ? deliveries.filter(
        (delivery) =>
          (delivery.pendingDelivery && delivery.pendingDelivery.sourceSnapshotId !== activeSnapshotId) ||
          (delivery.currentTarget && delivery.currentTarget.sourceSnapshotId !== activeSnapshotId),
      ).length
    : deliveries.filter((delivery) => delivery.pendingDelivery || delivery.currentTarget).length;

  return {
    hasSnapshots: versionSnapshots.length > 0,
    hasChanges,
    changedFileCount,
    latestSnapshot,
    activeSnapshot,
    activeVersionBehindLatest,
    entryPoint,
    platformStateLoaded: platformReleaseOverview !== null,
    deliveryStateLoaded: teamDeliveryOverview !== null,
    availablePlatformCount,
    currentVersionPlatformCount,
    otherVersionPlatformCount,
    totalCarryingPlatformCount,
    deliveryEntryCount: Math.max(teamCount, deliveries.length),
    pendingTeamCount,
    currentVersionPendingTeamCount,
    currentVersionStableTeamCount,
    currentVersionTeamCount,
    otherVersionTeamCount,
    latestReleaseRecord: platformReleaseOverview?.recentRecords[0] ?? null,
    latestDeliveryRecord: teamDeliveryOverview?.recentRecords[0] ?? null,
    descriptionMissing: !description?.trim(),
  };
}
