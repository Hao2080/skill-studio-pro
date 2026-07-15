import type {
  AppSettings,
  ExternalMarketSkillDetail,
  PlatformReleaseRecord,
  SkillImportRecord,
  SkillPlatformReleaseOverview,
  SkillSnapshot,
  SnapshotDiffResult,
  TextDiffEntry,
} from "@/types/skill";
import type {
  SkillTeamDeliveryOverview,
  TeamDeliveryRecord,
} from "@/types/team";
import { buildFileTree, cloneValue, createTextDiff } from "./browserPreviewFileMocks";
import type { BrowserPreviewState } from "./browserPreviewStateMocks";
import { createBrowserPreviewState } from "./browserPreviewStateMocks";
import { invokeBrowserPreviewPlatformCommand } from "./browserPreviewPlatformCommands";
import { invokeBrowserPreviewTeamCommand } from "./browserPreviewTeamCommands";

const SYSTEM_SNAPSHOT_SOURCE = "system";

function isSystemSnapshot(snapshot: { source?: string | null } | null | undefined) {
  return snapshot?.source?.trim().toLowerCase() === SYSTEM_SNAPSHOT_SOURCE;
}

let browserPreviewState: BrowserPreviewState | null = null;

function getBrowserPreviewState() {
  if (!browserPreviewState) {
    browserPreviewState = createBrowserPreviewState();
  }

  return browserPreviewState;
}

function getSkillFiles(state: BrowserPreviewState, skillId: string) {
  const files = state.currentFilesBySkillId[skillId];
  if (!files) {
    throw new Error(`预览 Skill 不存在: ${skillId}`);
  }

  return files;
}

function getSnapshots(state: BrowserPreviewState, skillId: string) {
  const snapshots = state.snapshotsBySkillId[skillId];
  if (!snapshots) {
    throw new Error(`预览快照不存在: ${skillId}`);
  }

  return snapshots;
}

function buildWorkingDiff(state: BrowserPreviewState, skillId: string): SnapshotDiffResult {
  const currentFiles = getSkillFiles(state, skillId);
  const latestSnapshot = getSnapshots(state, skillId)[0];
  const latestSnapshotFiles = latestSnapshot ? state.snapshotFilesBySnapshotId[latestSnapshot.id] ?? {} : {};
  const changeStatus = state.changeStatusBySkillId[skillId];
  const textDiffs: Record<string, TextDiffEntry> = {};

  for (const path of changeStatus.modifiedFiles) {
    textDiffs[path] = createTextDiff(path, latestSnapshotFiles[path] ?? "", currentFiles[path] ?? "");
  }

  for (const path of changeStatus.addedFiles) {
    textDiffs[path] = {
      filePath: path,
      unifiedDiff: `--- ${path}\n+++ ${path}\n@@ -0,0 +1,4 @@\n+# Release Checklist\n+\n+1. Review the latest snapshot.\n+2. Confirm the active version.`,
      oldLines: 0,
      newLines: (currentFiles[path] ?? "").split("\n").length,
    };
  }

  return {
    modifiedFiles: [...changeStatus.modifiedFiles],
    addedFiles: [...changeStatus.addedFiles],
    deletedFiles: [...changeStatus.deletedFiles],
    textDiffs,
  };
}

function buildSnapshotDiff(state: BrowserPreviewState, snapshotIdA: string, snapshotIdB: string): SnapshotDiffResult {
  const filesA = state.snapshotFilesBySnapshotId[snapshotIdA] ?? {};
  const filesB = state.snapshotFilesBySnapshotId[snapshotIdB] ?? {};
  const allPaths = Array.from(new Set([...Object.keys(filesA), ...Object.keys(filesB)])).sort();
  const modifiedFiles: string[] = [];
  const addedFiles: string[] = [];
  const deletedFiles: string[] = [];
  const textDiffs: Record<string, TextDiffEntry> = {};

  allPaths.forEach((path) => {
    const before = filesA[path];
    const after = filesB[path];

    if (before == null && after != null) {
      addedFiles.push(path);
      textDiffs[path] = {
        filePath: path,
        unifiedDiff: `--- ${path}\n+++ ${path}\n@@ -0,0 +1,1 @@\n+${after.split("\n")[0] ?? ""}`,
        oldLines: 0,
        newLines: after.split("\n").length,
      };
      return;
    }

    if (before != null && after == null) {
      deletedFiles.push(path);
      textDiffs[path] = {
        filePath: path,
        unifiedDiff: `--- ${path}\n+++ ${path}\n@@ -1,1 +0,0 @@\n-${before.split("\n")[0] ?? ""}`,
        oldLines: before.split("\n").length,
        newLines: 0,
      };
      return;
    }

    if (before !== after) {
      modifiedFiles.push(path);
      textDiffs[path] = createTextDiff(path, before ?? "", after ?? "");
    }
  });

  return {
    modifiedFiles,
    addedFiles,
    deletedFiles,
    textDiffs,
  };
}

function createSnapshotFromPreview(state: BrowserPreviewState, skillId: string, changeSummary?: string) {
  const snapshots = getSnapshots(state, skillId);
  const nextNumber = Math.max(...snapshots.map((snapshot) => snapshot.snapshotNumber), 0) + 1;
  const snapshotId = `snap-${nextNumber}`;
  const nextSnapshot: SkillSnapshot = {
    id: snapshotId,
    skillId,
    snapshotNumber: nextNumber,
    snapshotPath: `preview/${snapshotId}`,
    revisionHash: `rev-${nextNumber}`,
    changeSummary: changeSummary || "浏览器预览中新建的快照",
    source: "manual",
    createdAt: Date.now(),
    isCurrent: false,
    isActive: false,
  };

  state.snapshotsBySkillId[skillId] = [nextSnapshot, ...snapshots];
  state.snapshotFilesBySnapshotId[snapshotId] = cloneValue(getSkillFiles(state, skillId));
  state.changeStatusBySkillId[skillId] = {
    hasChanges: false,
    modifiedFiles: [],
    addedFiles: [],
    deletedFiles: [],
  };

  return nextSnapshot;
}

function setActiveSnapshotInPreview(state: BrowserPreviewState, snapshotId: string) {
  const target = Object.values(state.snapshotsBySkillId)
    .flat()
    .find((snapshot) => snapshot.id === snapshotId);

  if (!target) {
    throw new Error(`目标快照不存在: ${snapshotId}`);
  }

  if (isSystemSnapshot(target)) {
    throw new Error("系统恢复点不能设为生效版本");
  }

  state.snapshotsBySkillId[target.skillId] = getSnapshots(state, target.skillId).map((snapshot) => ({
    ...snapshot,
    isActive: snapshot.id === snapshotId,
  }));

  return state.snapshotsBySkillId[target.skillId].find((snapshot) => snapshot.id === snapshotId)!;
}

function updateSnapshotSummaryInPreview(state: BrowserPreviewState, snapshotId: string, changeSummary?: string) {
  const target = Object.values(state.snapshotsBySkillId)
    .flat()
    .find((snapshot) => snapshot.id === snapshotId);

  if (!target) {
    throw new Error(`目标快照不存在: ${snapshotId}`);
  }

  const normalizedSummary = changeSummary?.trim() ? changeSummary.trim() : undefined;
  state.snapshotsBySkillId[target.skillId] = getSnapshots(state, target.skillId).map((snapshot) =>
    snapshot.id === snapshotId
      ? {
          ...snapshot,
          changeSummary: normalizedSummary,
        }
      : snapshot,
  );

  return state.snapshotsBySkillId[target.skillId].find((snapshot) => snapshot.id === snapshotId)!;
}

function buildReleaseOverview(state: BrowserPreviewState, skillId: string): SkillPlatformReleaseOverview {
  const snapshots = getSnapshots(state, skillId);
  const snapshotById = Object.fromEntries(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  const targets = state.platformReleaseTargetsBySkillId[skillId] ?? {};
  const records = state.platformReleaseRecordsBySkillId[skillId] ?? [];
  const latestRecordByPlatform = new Map<string, PlatformReleaseRecord>();

  records.forEach((record) => {
    if (!latestRecordByPlatform.has(record.platformName)) {
      latestRecordByPlatform.set(record.platformName, record);
    }
  });

  const releases = state.platforms.map((platform) => {
    const currentTargetState = targets[platform.platformName];
    const targetSnapshot = currentTargetState ? snapshotById[currentTargetState.snapshotId] : undefined;

    return {
      platformName: platform.platformName,
      displayName: platform.displayName,
      detected: platform.detected,
      enabled: platform.enabled,
      skillsDir: platform.skillsDir,
      currentTarget:
        currentTargetState && targetSnapshot
          ? {
              platformName: platform.platformName,
              displayName: platform.displayName,
              snapshotId: targetSnapshot.id,
              snapshotNumber: targetSnapshot.snapshotNumber,
              changeSummary: targetSnapshot.changeSummary,
              releasedAt: currentTargetState.releasedAt,
            }
          : undefined,
      lastRecord: latestRecordByPlatform.get(platform.platformName),
    };
  });

  return {
    releases,
    recentRecords: cloneValue(records),
  };
}

function buildTeamDeliveryOverview(state: BrowserPreviewState, skillId: string): SkillTeamDeliveryOverview {
  const skill = state.skills.find((item) => item.id === skillId);
  const snapshots = getSnapshots(state, skillId);
  const snapshotById = Object.fromEntries(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  const targets = state.teamDeliveryTargetsBySkillId[skillId] ?? {};
  const records = state.teamDeliveryRecordsBySkillId[skillId] ?? [];
  const latestRecordByTeam = new Map<string, TeamDeliveryRecord>();

  records.forEach((record) => {
    if (!latestRecordByTeam.has(record.teamId)) {
      latestRecordByTeam.set(record.teamId, record);
    }
  });

  const deliveries = state.teams.map((team) => {
    const teamSkill = state.teamSkillsByTeamId[team.id]?.find((item) => item.slug === skill?.slug);
    const pendingSubmission = (state.submissionsByTeamId[team.id] ?? [])
      .filter((submission) => submission.sourceSkillId === skillId && submission.status === "pending")
      .sort((left, right) => right.submittedAt - left.submittedAt)[0];
    const targetState = targets[team.id];
    const targetSnapshot = targetState ? snapshotById[targetState.snapshotId] : undefined;
    const pendingSnapshot = pendingSubmission ? snapshotById[pendingSubmission.sourceSnapshotId] : undefined;

    return {
      teamId: team.id,
      teamName: team.name,
      teamDescription: team.description,
      currentTarget:
        targetState && targetSnapshot
          ? {
              teamId: team.id,
              teamName: team.name,
              sourceSkillId: skillId,
              sourceSnapshotId: targetSnapshot.id,
              sourceSnapshotNumber: targetSnapshot.snapshotNumber,
              changeSummary: targetSnapshot.changeSummary,
              teamSkillId: targetState.teamSkillId,
              teamSkillName: teamSkill?.name,
              teamVersionId: targetState.teamVersionId,
              teamVersionNumber: targetState.teamVersionNumber,
              deliveredAt: targetState.deliveredAt,
            }
          : undefined,
      pendingDelivery:
        pendingSubmission && pendingSnapshot
          ? {
              submissionId: pendingSubmission.id,
              teamId: team.id,
              teamName: team.name,
              teamSkillId: pendingSubmission.teamSkillId,
              sourceSnapshotId: pendingSnapshot.id,
              sourceSnapshotNumber: pendingSnapshot.snapshotNumber,
              changeSummary: pendingSnapshot.changeSummary,
              submitter: pendingSubmission.submitter,
              submitMessage: pendingSubmission.submitMessage,
              submittedAt: pendingSubmission.submittedAt,
            }
          : undefined,
      lastRecord: latestRecordByTeam.get(team.id),
    };
  });

  return {
    deliveries,
    recentRecords: cloneValue(records),
  };
}

export function shouldUseBrowserPreviewMocks() {
  if (typeof window === "undefined") {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  const isLocalHost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "";

  return isLocalHost && params.get("preview") === "skill-detail";
}


export async function invokeBrowserPreviewCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const state = getBrowserPreviewState();

  switch (command) {
    case "get_app_settings":
      return cloneValue(state.settings) as T;
    case "save_app_settings":
      state.settings = { ...state.settings, ...(args?.settings as Partial<AppSettings>) };
      return undefined as T;
    case "skill_list":
      return cloneValue(state.skills) as T;
    case "skill_import_record_list":
      return [] as SkillImportRecord[] as T;
    case "market_external_detail":
      return {
        id: "openai/skills/browser",
        source: "openai/skills",
        skillId: "browser",
        name: "browser",
        repoUrl: "https://github.com/openai/skills.git",
        sourceSubpath: "skills/browser",
        summary: "用于浏览器自动化与页面验证。",
        documentationTitle: "Browser",
        documentationPath: "skills/browser/README.md",
        documentationExcerpt: "用于浏览器自动化与页面验证。\n支持页面打开与元素交互。",
      } as ExternalMarketSkillDetail as T;
    case "detect_changes": {
      const skillId = args?.skillId as string;
      return cloneValue(state.changeStatusBySkillId[skillId]) as T;
    }
    case "list_skill_files": {
      const skillId = args?.skillId as string;
      return buildFileTree(getSkillFiles(state, skillId)) as T;
    }
    case "read_skill_file": {
      const skillId = args?.skillId as string;
      const relativePath = args?.relativePath as string;
      const content = getSkillFiles(state, skillId)[relativePath];
      if (content == null) {
        throw new Error(`预览文件不存在: ${relativePath}`);
      }
      return content as T;
    }
    case "write_skill_file": {
      const skillId = args?.skillId as string;
      const relativePath = args?.relativePath as string;
      const content = args?.content as string;
      const files = getSkillFiles(state, skillId);
      files[relativePath] = content;

      const currentStatus = state.changeStatusBySkillId[skillId];
      if (!currentStatus.addedFiles.includes(relativePath) && !currentStatus.modifiedFiles.includes(relativePath)) {
        currentStatus.modifiedFiles = [...currentStatus.modifiedFiles, relativePath];
      }
      currentStatus.hasChanges = true;

      return undefined as T;
    }
    case "open_file_in_editor":
      return undefined as T;
    case "open_skill_folder": {
      const skillId = args?.skillId as string;
      const skill = state.skills.find((item) => item.id === skillId);
      return (skill?.sourcePath ?? "D:/Preview/skills") as T;
    }
    case "snapshot_list": {
      const skillId = args?.skillId as string;
      return cloneValue(getSnapshots(state, skillId)) as T;
    }
    case "snapshot_create": {
      const input = args?.input as { skillId: string; changeSummary?: string };
      return createSnapshotFromPreview(state, input.skillId, input.changeSummary) as T;
    }
    case "snapshot_restore": {
      const snapshotId = args?.snapshotId as string;
      const snapshot = Object.values(state.snapshotsBySkillId)
        .flat()
        .find((item) => item.id === snapshotId);

      if (!snapshot) {
        throw new Error(`目标快照不存在: ${snapshotId}`);
      }

      state.currentFilesBySkillId[snapshot.skillId] = cloneValue(state.snapshotFilesBySnapshotId[snapshotId] ?? {});
      state.changeStatusBySkillId[snapshot.skillId] = {
        hasChanges: false,
        modifiedFiles: [],
        addedFiles: [],
        deletedFiles: [],
      };

      return snapshot.skillId as T;
    }
    case "snapshot_delete": {
      const snapshotId = args?.snapshotId as string;
      const target = Object.entries(state.snapshotsBySkillId).find(([, snapshots]) =>
        snapshots.some((snapshot) => snapshot.id === snapshotId),
      );

      if (!target) {
        throw new Error(`目标快照不存在: ${snapshotId}`);
      }

      const [skillId, snapshots] = target;
      state.snapshotsBySkillId[skillId] = snapshots.filter((snapshot) => snapshot.id !== snapshotId);
      delete state.snapshotFilesBySnapshotId[snapshotId];
      return undefined as T;
    }
    case "snapshot_update_summary": {
      const input = args?.input as { snapshotId: string; changeSummary?: string };
      return cloneValue(updateSnapshotSummaryInPreview(state, input.snapshotId, input.changeSummary)) as T;
    }
    case "snapshot_set_active": {
      const snapshotId = args?.snapshotId as string;
      return cloneValue(setActiveSnapshotInPreview(state, snapshotId)) as T;
    }
    case "diff_working_directory": {
      const skillId = args?.skillId as string;
      return buildWorkingDiff(state, skillId) as T;
    }
    case "diff_snapshots": {
      const input = args?.input as { snapshotIdA: string; snapshotIdB: string };
      return buildSnapshotDiff(state, input.snapshotIdA, input.snapshotIdB) as T;
    }
    case "save_platform_connection":
    case "create_custom_platform":
    case "delete_custom_platform":
    case "test_platform_path":
    case "platform_detect":
    case "get_skill_platform_releases":
    case "publish_snapshot_to_platforms":
    case "remove_skill_from_platforms":
    case "sync_skill_to_platforms":
      return invokeBrowserPreviewPlatformCommand<T>(state, command, args, {
        getSnapshots,
        isSystemSnapshot,
        buildReleaseOverview,
      }) as T;
    case "team_list":
    case "team_create":
    case "team_update":
    case "team_set_status":
    case "team_delete":
    case "team_skill_list":
    case "team_member_list":
    case "team_member_create":
    case "team_member_update":
    case "team_member_remove":
    case "team_activity_list":
    case "team_submission_list":
    case "team_submission_merge_preview":
    case "team_submission_merge":
    case "team_submission_reject":
    case "team_version_set_recommended":
    case "team_skill_delivery_get":
    case "team_submit":
    case "team_snapshot_submit_to_teams":
    case "team_pending_delivery_withdraw":
    case "team_skill_remove_from_teams":
      return invokeBrowserPreviewTeamCommand<T>(state, command, args, {
        getSnapshots,
        buildTeamDeliveryOverview,
        isSystemSnapshot,
      }) as T;
    default:
      throw new Error(`浏览器预览暂未实现命令: ${command}`);
  }
}
