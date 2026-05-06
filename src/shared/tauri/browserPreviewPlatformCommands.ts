import type {
  CreateCustomPlatformInput,
  DeleteCustomPlatformInput,
  PlatformConnection,
  PlatformReleaseRecord,
  SavePlatformConnectionInput,
  SyncResult,
} from "@/types/skill";
import { cloneValue } from "./browserPreviewFileMocks";
import type { BrowserPreviewState } from "./browserPreviewStateMocks";
import {
  evaluatePreviewPath,
  getPreviewDefaultSkillsDir,
  normalizePreviewPath,
  normalizePreviewPlatformKey,
  resolvePreviewDetectDir,
  resolvePreviewSyncMode,
  sortPreviewPlatforms,
} from "./browserPreviewPlatformMocks";

type GetSnapshots = (state: BrowserPreviewState, skillId: string) => BrowserPreviewState["snapshotsBySkillId"][string];
type IsSystemSnapshot = (snapshot: { source?: string | null } | null | undefined) => boolean;
type BuildReleaseOverview = (state: BrowserPreviewState, skillId: string) => unknown;

function getPreviewPlatformOrThrow(state: BrowserPreviewState, platformName: string) {
  const platform = state.platforms.find((item) => item.platformName === platformName);

  if (!platform) {
    throw new Error(`预览平台不存在: ${platformName}`);
  }

  return platform;
}

export function invokeBrowserPreviewPlatformCommand<T>(
  state: BrowserPreviewState,
  command: string,
  args: Record<string, unknown> | undefined,
  helpers: {
    getSnapshots: GetSnapshots;
    isSystemSnapshot: IsSystemSnapshot;
    buildReleaseOverview: BuildReleaseOverview;
  },
) {
  switch (command) {
    case "save_platform_connection": {
      const input = args?.input as SavePlatformConnectionInput;
      const currentPlatform = getPreviewPlatformOrThrow(state, input.platformName);
      const requestedSkillsDir = normalizePreviewPath(input.skillsDir ?? "");
      const fallbackSkillsDir =
        currentPlatform.skillsDir ??
        (currentPlatform.platformType === "built_in"
          ? getPreviewDefaultSkillsDir(currentPlatform.platformName)
          : undefined);
      const nextSkillsDir = requestedSkillsDir || fallbackSkillsDir;
      const nextDetectDir = resolvePreviewDetectDir(currentPlatform, nextSkillsDir);
      const shouldRecalculateDetected =
        Boolean(nextDetectDir) &&
        normalizePreviewPath(nextDetectDir ?? "") !== normalizePreviewPath(currentPlatform.detectDir ?? "");

      const nextPlatform: PlatformConnection = {
        ...currentPlatform,
        enabled: input.enabled,
        skillsDir: nextSkillsDir,
        detectDir: nextDetectDir,
        syncMode: resolvePreviewSyncMode(
          input.syncMode,
          currentPlatform.supportsCopy,
          currentPlatform.supportsSymlink,
        ),
        detected:
          shouldRecalculateDetected && nextDetectDir
            ? evaluatePreviewPath(nextDetectDir).ok
            : currentPlatform.detected,
      };

      state.platforms = sortPreviewPlatforms(
        state.platforms.map((platform) =>
          platform.platformName === currentPlatform.platformName ? nextPlatform : platform,
        ),
      );

      return cloneValue(nextPlatform) as T;
    }
    case "create_custom_platform": {
      const input = args?.input as CreateCustomPlatformInput;
      const platformName = normalizePreviewPlatformKey(input.platformName);
      const displayName = input.displayName.trim();
      const pathResult = evaluatePreviewPath(input.skillsDir);

      if (!platformName) {
        throw new Error("平台标识不能为空");
      }

      if (!displayName) {
        throw new Error("平台名称不能为空");
      }

      if (state.platforms.some((platform) => platform.platformName === platformName)) {
        throw new Error(`平台 '${platformName}' 已存在`);
      }

      const createdPlatform: PlatformConnection = {
        id: `platform-${platformName}`,
        platformName,
        displayName,
        platformType: "custom",
        detected: pathResult.ok,
        enabled: true,
        skillsDir: pathResult.normalizedPath,
        detectDir: pathResult.normalizedPath,
        syncMode: resolvePreviewSyncMode(
          input.syncMode,
          input.supportsCopy,
          input.supportsSymlink,
        ),
        supportsProjectScope: input.supportsProjectScope,
        supportsSymlink: input.supportsSymlink,
        supportsCopy: input.supportsCopy,
      };

      state.platforms = sortPreviewPlatforms([...state.platforms, createdPlatform]);

      return cloneValue(createdPlatform) as T;
    }
    case "delete_custom_platform": {
      const input = args?.input as DeleteCustomPlatformInput;
      const platformName = normalizePreviewPlatformKey(input.platformName);
      const existing = state.platforms.find((platform) => platform.platformName === platformName);

      if (!existing) {
        throw new Error(`平台不存在: ${platformName}`);
      }

      if (existing.platformType !== "custom") {
        throw new Error("仅支持删除自定义平台");
      }

      state.platforms = sortPreviewPlatforms(
        state.platforms.filter((platform) => platform.platformName !== platformName),
      );

      for (const targets of Object.values(state.platformReleaseTargetsBySkillId)) {
        if (targets[platformName]) {
          delete targets[platformName];
        }
      }

      return undefined as T;
    }
    case "test_platform_path": {
      const input = args?.input as { skillsDir: string };
      return evaluatePreviewPath(input.skillsDir) as T;
    }
    case "platform_detect":
      return { platforms: cloneValue(sortPreviewPlatforms(state.platforms)) } as T;
    case "get_skill_platform_releases": {
      const skillId = args?.skillId as string;
      return cloneValue(helpers.buildReleaseOverview(state, skillId)) as T;
    }
    case "publish_snapshot_to_platforms": {
      const input = args?.input as { skillId: string; snapshotId: string; platformNames: string[] };
      const snapshots = helpers.getSnapshots(state, input.skillId);
      const snapshot = snapshots.find((item) => item.id === input.snapshotId);

      if (!snapshot) {
        throw new Error(`目标快照不存在: ${input.snapshotId}`);
      }

      if (helpers.isSystemSnapshot(snapshot)) {
        throw new Error("系统恢复点不能直接同步到平台");
      }

      const currentTargets = state.platformReleaseTargetsBySkillId[input.skillId] ?? {};
      state.platformReleaseTargetsBySkillId[input.skillId] = currentTargets;

      const nextRecords = [...(state.platformReleaseRecordsBySkillId[input.skillId] ?? [])];
      const createdAt = Date.now();
      const results = input.platformNames.map((platformName, index) => {
        const currentTarget = currentTargets[platformName];
        const action =
          currentTarget?.snapshotId === snapshot.id
            ? "republish"
            : currentTarget
              ? "switch"
              : "publish";

        currentTargets[platformName] = {
          snapshotId: snapshot.id,
          releasedAt: createdAt + index,
        };

        state.platforms = state.platforms.map((platform) =>
          platform.platformName === platformName
            ? {
                ...platform,
                lastSyncAt: createdAt + index,
              }
            : platform,
        );

        const record: PlatformReleaseRecord = {
          id: `release-${createdAt + index}`,
          platformName,
          displayName: state.platforms.find((platform) => platform.platformName === platformName)?.displayName,
          snapshotId: snapshot.id,
          snapshotNumber: snapshot.snapshotNumber,
          changeSummary: snapshot.changeSummary,
          action,
          status: "success",
          createdAt: createdAt + index,
        };
        nextRecords.unshift(record);
        return record;
      });

      state.platformReleaseRecordsBySkillId[input.skillId] = nextRecords;
      return cloneValue(results) as T;
    }
    case "remove_skill_from_platforms": {
      const input = args?.input as { skillId: string; platformNames: string[] };
      const currentTargets = state.platformReleaseTargetsBySkillId[input.skillId] ?? {};
      const snapshots = helpers.getSnapshots(state, input.skillId);
      const snapshotById = Object.fromEntries(snapshots.map((snapshot) => [snapshot.id, snapshot]));
      const nextRecords = [...(state.platformReleaseRecordsBySkillId[input.skillId] ?? [])];
      const createdAt = Date.now();

      const results = input.platformNames.map((platformName, index) => {
        const currentTarget = currentTargets[platformName];
        const snapshot = currentTarget ? snapshotById[currentTarget.snapshotId] : undefined;
        delete currentTargets[platformName];

        const record: PlatformReleaseRecord = {
          id: `release-${createdAt + index}`,
          platformName,
          displayName: state.platforms.find((platform) => platform.platformName === platformName)?.displayName,
          snapshotId: snapshot?.id,
          snapshotNumber: snapshot?.snapshotNumber,
          changeSummary: snapshot?.changeSummary,
          action: "remove",
          status: "success",
          createdAt: createdAt + index,
        };
        nextRecords.unshift(record);
        return record;
      });

      state.platformReleaseTargetsBySkillId[input.skillId] = currentTargets;
      state.platformReleaseRecordsBySkillId[input.skillId] = nextRecords;
      return cloneValue(results) as T;
    }
    case "sync_skill_to_platforms": {
      const results: SyncResult[] = state.platforms
        .filter((platform) => platform.detected && platform.enabled)
        .map((platform) => ({
          platform: platform.platformName,
          status: "success",
        }));

      return results as T;
    }
    default:
      return undefined;
  }
}
