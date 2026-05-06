import type { SkillSnapshot } from "@/types/skill";

export const WORKING_DIR_VALUE = "__working_dir__" as const;

export interface CompareState {
  baseSnapshotId: string | null;
  targetId: string | null;
}

export const EMPTY_COMPARE_STATE: CompareState = {
  baseSnapshotId: null,
  targetId: null,
};

export function applyTimelineClick(state: CompareState, snapshotId: string): CompareState {
  const { baseSnapshotId, targetId } = state;

  if (snapshotId === baseSnapshotId) {
    return { ...state, baseSnapshotId: null };
  }
  if (snapshotId === targetId) {
    return { ...state, targetId: null };
  }
  if (!baseSnapshotId) {
    return { ...state, baseSnapshotId: snapshotId };
  }
  if (!targetId) {
    return { ...state, targetId: snapshotId };
  }
  return { ...state, targetId: snapshotId };
}

export function compareWithWorkspace(state: CompareState): CompareState {
  if (!state.baseSnapshotId) {
    return state;
  }

  return {
    ...state,
    targetId: WORKING_DIR_VALUE,
  };
}

export function clearCompare(): CompareState {
  return EMPTY_COMPARE_STATE;
}

export function buildCompareLabels(
  state: CompareState,
  snapshots: SkillSnapshot[],
  labels?: {
    unselected?: string;
    workspace?: string;
  },
): { labelA: string; labelB: string } {
  const unselectedLabel = labels?.unselected ?? "未选择";
  const workspaceLabel = labels?.workspace ?? "工作区";
  const snapA = state.baseSnapshotId
    ? snapshots.find((s) => s.id === state.baseSnapshotId)
    : null;
  const labelA = snapA ? `v${snapA.snapshotNumber}` : unselectedLabel;

  if (state.targetId === WORKING_DIR_VALUE) {
    return { labelA, labelB: workspaceLabel };
  }

  const snapB = state.targetId ? snapshots.find((s) => s.id === state.targetId) : null;
  const labelB = snapB ? `v${snapB.snapshotNumber}` : unselectedLabel;
  return { labelA, labelB };
}
