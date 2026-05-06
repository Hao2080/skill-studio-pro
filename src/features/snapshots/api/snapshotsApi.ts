import type {
  PlatformReleaseRecord,
  SkillSnapshot,
  SkillPlatformReleaseOverview,
  SnapshotDiffResult,
  SyncResult,
} from "@/types/skill";
import { invokeCommand } from "@/shared/tauri/invokeCommand";

export async function listSnapshots(skillId: string): Promise<SkillSnapshot[]> {
  return invokeCommand<SkillSnapshot[]>("snapshot_list", { skillId });
}

export async function createSnapshot(skillId: string, changeSummary: string): Promise<SkillSnapshot> {
  return invokeCommand<SkillSnapshot>("snapshot_create", {
    input: {
      skillId,
      changeSummary: changeSummary || undefined,
    },
  });
}

export async function restoreSnapshot(snapshotId: string): Promise<string> {
  return invokeCommand<string>("snapshot_restore", { snapshotId });
}

export async function deleteSnapshot(snapshotId: string): Promise<void> {
  return invokeCommand<void>("snapshot_delete", { snapshotId });
}

export async function updateSnapshotSummary(snapshotId: string, changeSummary: string): Promise<SkillSnapshot> {
  const normalizedSummary = changeSummary.trim();
  return invokeCommand<SkillSnapshot>("snapshot_update_summary", {
    input: {
      snapshotId,
      changeSummary: normalizedSummary ? normalizedSummary : undefined,
    },
  });
}

export async function diffSnapshots(snapshotIdA: string, snapshotIdB: string): Promise<SnapshotDiffResult> {
  return invokeCommand<SnapshotDiffResult>("diff_snapshots", {
    input: {
      snapshotIdA,
      snapshotIdB,
    },
  });
}

export async function diffWorkingDirectory(skillId: string): Promise<SnapshotDiffResult> {
  return invokeCommand<SnapshotDiffResult>("diff_working_directory", { skillId });
}

export async function setActiveSnapshot(snapshotId: string): Promise<SkillSnapshot> {
  return invokeCommand<SkillSnapshot>("snapshot_set_active", { snapshotId });
}

export async function syncSkillToPlatforms(skillId: string): Promise<SyncResult[]> {
  return invokeCommand<SyncResult[]>("sync_skill_to_platforms", { skillId });
}

export async function getSkillPlatformReleases(skillId: string): Promise<SkillPlatformReleaseOverview> {
  return invokeCommand<SkillPlatformReleaseOverview>("get_skill_platform_releases", { skillId });
}

export async function publishSnapshotToPlatforms(
  skillId: string,
  snapshotId: string,
  platformNames: string[],
): Promise<PlatformReleaseRecord[]> {
  return invokeCommand<PlatformReleaseRecord[]>("publish_snapshot_to_platforms", {
    input: {
      skillId,
      snapshotId,
      platformNames,
    },
  });
}

export async function removeSkillFromPlatforms(
  skillId: string,
  platformNames: string[],
): Promise<PlatformReleaseRecord[]> {
  return invokeCommand<PlatformReleaseRecord[]>("remove_skill_from_platforms", {
    input: {
      skillId,
      platformNames,
    },
  });
}
