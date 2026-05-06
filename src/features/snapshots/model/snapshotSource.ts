import type { SkillSnapshot } from "@/types/skill";

export const MANUAL_SNAPSHOT_SOURCE = "manual" as const;
export const SYSTEM_SNAPSHOT_SOURCE = "system" as const;

export function getSnapshotSource(snapshot: Pick<SkillSnapshot, "source"> | null | undefined) {
  const normalizedSource = snapshot?.source?.trim().toLowerCase();
  return normalizedSource || MANUAL_SNAPSHOT_SOURCE;
}

export function isSystemSnapshot(snapshot: Pick<SkillSnapshot, "source"> | null | undefined) {
  return getSnapshotSource(snapshot) === SYSTEM_SNAPSHOT_SOURCE;
}

export function getManualSnapshots(snapshots: SkillSnapshot[]) {
  return snapshots.filter((snapshot) => !isSystemSnapshot(snapshot));
}

export function getSystemSnapshots(snapshots: SkillSnapshot[]) {
  return snapshots.filter((snapshot) => isSystemSnapshot(snapshot));
}

export function getActiveManualSnapshot(snapshots: SkillSnapshot[]) {
  return getManualSnapshots(snapshots).find((snapshot) => snapshot.isActive) ?? null;
}

export function getLatestManualSnapshot(snapshots: SkillSnapshot[]) {
  return getManualSnapshots(snapshots)[0] ?? null;
}
