import type { SkillSnapshot } from "@/types/skill";
import { WORKING_DIR_VALUE } from "@/features/snapshots/model/versionCompareState";
import {
  getActiveManualSnapshot,
  getLatestManualSnapshot,
  getSystemSnapshots,
} from "@/features/snapshots/model/snapshotSource";

export type SelectedEntity = { type: "workspace" } | { type: "snapshot"; snapshotId: string };

export interface CompareDraft {
  baseSnapshotId: string | null;
  targetId: string | null;
  selectingTarget: boolean;
}

export const WORKSPACE_ENTITY: SelectedEntity = { type: "workspace" };

export const EMPTY_COMPARE_DRAFT: CompareDraft = {
  baseSnapshotId: null,
  targetId: null,
  selectingTarget: false,
};

export function getDefaultSelectedEntity(snapshots: SkillSnapshot[]): SelectedEntity {
  const activeSnapshot = getActiveManualSnapshot(snapshots);

  if (activeSnapshot) {
    return { type: "snapshot", snapshotId: activeSnapshot.id };
  }

  const latestManualSnapshot = getLatestManualSnapshot(snapshots);
  if (latestManualSnapshot) {
    return { type: "snapshot", snapshotId: latestManualSnapshot.id };
  }

  const [latestSystemSnapshot] = getSystemSnapshots(snapshots);
  if (latestSystemSnapshot) {
    return { type: "snapshot", snapshotId: latestSystemSnapshot.id };
  }

  return WORKSPACE_ENTITY;
}

export function getSelectedSnapshot(selectedEntity: SelectedEntity | null, snapshots: SkillSnapshot[]) {
  if (!selectedEntity || selectedEntity.type !== "snapshot") {
    return null;
  }

  return snapshots.find((snapshot) => snapshot.id === selectedEntity.snapshotId) ?? null;
}

export function sanitizeCompareDraft(compareDraft: CompareDraft, snapshots: SkillSnapshot[]): CompareDraft {
  if (!compareDraft.baseSnapshotId) {
    return EMPTY_COMPARE_DRAFT;
  }

  const hasBase = snapshots.some((snapshot) => snapshot.id === compareDraft.baseSnapshotId);
  if (!hasBase) {
    return EMPTY_COMPARE_DRAFT;
  }

  if (compareDraft.targetId === WORKING_DIR_VALUE) {
    return compareDraft;
  }

  if (!compareDraft.targetId) {
    return compareDraft;
  }

  const hasTarget = snapshots.some((snapshot) => snapshot.id === compareDraft.targetId);
  if (!hasTarget) {
    return {
      baseSnapshotId: compareDraft.baseSnapshotId,
      targetId: null,
      selectingTarget: true,
    };
  }

  return compareDraft;
}
