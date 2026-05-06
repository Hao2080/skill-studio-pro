import { createContext, useContext, useReducer, useCallback, useMemo, type ReactNode } from "react";
import message from "antd/es/message";
import type { SkillSnapshot, SnapshotDiffResult } from "@/types/skill";
import {
  createSnapshot as createSnapshotRecord,
  deleteSnapshot as deleteSnapshotRecord,
  diffSnapshots,
  listSnapshots,
  restoreSnapshot as restoreSnapshotRecord,
  setActiveSnapshot as setActiveSnapshotRecord,
  updateSnapshotSummary as updateSnapshotSummaryRecord,
} from "../api/snapshotsApi";
import { useI18n } from "@/features/settings/state/I18nContext";
import { useSkillContext } from "@/features/skills/state/SkillContext";

type SnapshotMutationKind = "create" | "restore" | "delete" | "set_active";

export interface CreateSnapshotUiFeedback {
  scrollToSnapshotId: string;
  highlightedSnapshotId: string;
}

export function getCreateSnapshotUiFeedback(snapshotId: string): CreateSnapshotUiFeedback {
  return {
    scrollToSnapshotId: snapshotId,
    highlightedSnapshotId: snapshotId,
  };
}

export function shouldRefreshBrowseAfterSnapshotMutation(kind: SnapshotMutationKind) {
  return kind === "restore";
}

export function shouldRefreshChangeStatusAfterSnapshotMutation(kind: SnapshotMutationKind) {
  return kind === "create" || kind === "restore" || kind === "delete";
}

export async function runPostSnapshotMutationEffects(
  kind: SnapshotMutationKind,
  refreshChangeStatuses: () => Promise<void>,
) {
  if (!shouldRefreshChangeStatusAfterSnapshotMutation(kind)) {
    return;
  }

  await refreshChangeStatuses();
}

interface SnapshotState {
  snapshots: SkillSnapshot[];
  selectedSnapshotIds: [string, string] | null;
  loading: boolean;
  diffLoading: boolean;
  diffResult: SnapshotDiffResult | null;
  createSnapshotUiFeedback: CreateSnapshotUiFeedback | null;
  browseRefreshToken: number;
}

type SnapshotAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_DIFF_LOADING"; payload: boolean }
  | { type: "SET_SNAPSHOTS"; payload: SkillSnapshot[] }
  | { type: "SELECT_FOR_DIFF"; payload: string }
  | { type: "CLEAR_DIFF" }
  | { type: "SET_DIFF_RESULT"; payload: SnapshotDiffResult }
  | { type: "REMOVE_SNAPSHOT"; payload: string }
  | { type: "ADD_SNAPSHOT"; payload: SkillSnapshot }
  | { type: "SET_ACTIVE"; payload: string }
  | { type: "UPDATE_SNAPSHOT"; payload: SkillSnapshot }
  | { type: "SET_CREATE_SNAPSHOT_UI_FEEDBACK"; payload: CreateSnapshotUiFeedback | null }
  | { type: "TRIGGER_BROWSE_REFRESH" };

interface SnapshotContextValue extends SnapshotState {
  loadSnapshots: (skillId: string) => Promise<void>;
  createSnapshot: (skillId: string, summary: string) => Promise<void>;
  restoreSnapshot: (snapshotId: string) => Promise<void>;
  deleteSnapshot: (snapshotId: string) => Promise<void>;
  updateSnapshotSummary: (snapshotId: string, summary: string) => Promise<void>;
  selectForDiff: (snapshotId: string) => void;
  clearDiff: () => void;
  computeDiff: (idA: string, idB: string) => Promise<void>;
  setActiveSnapshot: (snapshotId: string) => Promise<void>;
  clearCreateSnapshotUiFeedback: () => void;
}

const SnapshotContext = createContext<SnapshotContextValue | null>(null);

function snapshotReducer(state: SnapshotState, action: SnapshotAction): SnapshotState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_DIFF_LOADING":
      return { ...state, diffLoading: action.payload };
    case "SET_SNAPSHOTS":
      return { ...state, snapshots: action.payload, loading: false };
    case "SELECT_FOR_DIFF": {
      const id = action.payload;
      const current = state.selectedSnapshotIds;
      if (!current) {
        return { ...state, selectedSnapshotIds: [id, ""] as [string, string] };
      }
      if (!current[1]) {
        return { ...state, selectedSnapshotIds: [current[0], id] as [string, string] };
      }
      return { ...state, selectedSnapshotIds: [id, ""] as [string, string] };
    }
    case "CLEAR_DIFF":
      return { ...state, selectedSnapshotIds: null, diffResult: null };
    case "SET_DIFF_RESULT":
      return { ...state, diffResult: action.payload, diffLoading: false };
    case "REMOVE_SNAPSHOT":
      return {
        ...state,
        snapshots: state.snapshots.filter((snapshot) => snapshot.id !== action.payload),
        selectedSnapshotIds:
          state.selectedSnapshotIds &&
          (state.selectedSnapshotIds[0] === action.payload || state.selectedSnapshotIds[1] === action.payload)
            ? null
            : state.selectedSnapshotIds,
      };
    case "ADD_SNAPSHOT":
      return {
        ...state,
        snapshots: [action.payload, ...state.snapshots],
        createSnapshotUiFeedback: getCreateSnapshotUiFeedback(action.payload.id),
      };
    case "SET_ACTIVE":
      return {
        ...state,
        snapshots: state.snapshots.map((snapshot) => ({
          ...snapshot,
          isActive: snapshot.id === action.payload,
        })),
      };
    case "UPDATE_SNAPSHOT":
      return {
        ...state,
        snapshots: state.snapshots.map((snapshot) =>
          snapshot.id === action.payload.id ? action.payload : snapshot,
        ),
      };
    case "SET_CREATE_SNAPSHOT_UI_FEEDBACK":
      return { ...state, createSnapshotUiFeedback: action.payload };
    case "TRIGGER_BROWSE_REFRESH":
      return { ...state, browseRefreshToken: state.browseRefreshToken + 1 };
    default:
      return state;
  }
}

const initialState: SnapshotState = {
  snapshots: [],
  selectedSnapshotIds: null,
  loading: false,
  diffLoading: false,
  diffResult: null,
  createSnapshotUiFeedback: null,
  browseRefreshToken: 0,
};

export function SnapshotProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(snapshotReducer, initialState);
  const { resolvedLanguage } = useI18n();
  const { loadChangeStatuses } = useSkillContext();
  const copy = useMemo(() => (
    resolvedLanguage === "en-US"
      ? {
          loadFailedPrefix: "Failed to load snapshots: ",
          createSuccess: "Snapshot created",
          createFailedPrefix: "Failed to create snapshot: ",
          restoreSuccess: "Workspace restored; active version unchanged",
          restoreFailedPrefix: "Restore failed: ",
          deleteSuccess: "Snapshot deleted",
          deleteFailedPrefix: "Failed to delete snapshot: ",
          updateSummarySuccess: "Version note updated",
          updateSummaryFailedPrefix: "Failed to update version note: ",
          compareFailedPrefix: "Diff failed: ",
          setActiveSuccess: "Set as active version",
          actionFailedPrefix: "Action failed: ",
        }
      : {
          loadFailedPrefix: "加载快照失败: ",
          createSuccess: "快照已创建",
          createFailedPrefix: "创建快照失败: ",
          restoreSuccess: "已恢复工作副本，同步版本未变更",
          restoreFailedPrefix: "恢复失败: ",
          deleteSuccess: "快照已删除",
          deleteFailedPrefix: "删除快照失败: ",
          updateSummarySuccess: "版本说明已更新",
          updateSummaryFailedPrefix: "更新版本说明失败: ",
          compareFailedPrefix: "对比失败: ",
          setActiveSuccess: "已设为生效版本",
          actionFailedPrefix: "操作失败: ",
        }
  ), [resolvedLanguage]);

  const loadSnapshots = useCallback(async (skillId: string) => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "CLEAR_DIFF" });
    try {
      const result = await listSnapshots(skillId);
      dispatch({ type: "SET_SNAPSHOTS", payload: result });
    } catch (error) {
      message.error(`${copy.loadFailedPrefix}${error}`);
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [copy.loadFailedPrefix]);

  const createSnapshot = useCallback(async (skillId: string, summary: string) => {
    try {
      const result = await createSnapshotRecord(skillId, summary);
      dispatch({ type: "ADD_SNAPSHOT", payload: result });
      await runPostSnapshotMutationEffects("create", loadChangeStatuses);
      message.success(copy.createSuccess);
    } catch (error) {
      message.error(`${copy.createFailedPrefix}${error}`);
    }
  }, [copy.createFailedPrefix, copy.createSuccess, loadChangeStatuses]);

  const restoreSnapshot = useCallback(async (snapshotId: string) => {
    try {
      const skillId = await restoreSnapshotRecord(snapshotId);
      const updated = await listSnapshots(skillId);
      dispatch({ type: "SET_SNAPSHOTS", payload: updated });
      if (shouldRefreshBrowseAfterSnapshotMutation("restore")) {
        dispatch({ type: "TRIGGER_BROWSE_REFRESH" });
      }
      await runPostSnapshotMutationEffects("restore", loadChangeStatuses);
      message.success(copy.restoreSuccess);
    } catch (error) {
      message.error(`${copy.restoreFailedPrefix}${error}`);
    }
  }, [copy.restoreFailedPrefix, copy.restoreSuccess, loadChangeStatuses]);

  const deleteSnapshot = useCallback(async (snapshotId: string) => {
    try {
      await deleteSnapshotRecord(snapshotId);
      dispatch({ type: "REMOVE_SNAPSHOT", payload: snapshotId });
      await runPostSnapshotMutationEffects("delete", loadChangeStatuses);
      message.success(copy.deleteSuccess);
    } catch (error) {
      message.error(`${copy.deleteFailedPrefix}${error}`);
    }
  }, [copy.deleteFailedPrefix, copy.deleteSuccess, loadChangeStatuses]);

  const updateSnapshotSummary = useCallback(async (snapshotId: string, summary: string) => {
    try {
      const updated = await updateSnapshotSummaryRecord(snapshotId, summary);
      dispatch({ type: "UPDATE_SNAPSHOT", payload: updated });
      message.success(copy.updateSummarySuccess);
    } catch (error) {
      message.error(`${copy.updateSummaryFailedPrefix}${error}`);
      throw error;
    }
  }, [copy.updateSummaryFailedPrefix, copy.updateSummarySuccess]);

  const selectForDiff = useCallback((snapshotId: string) => {
    dispatch({ type: "SELECT_FOR_DIFF", payload: snapshotId });
  }, []);

  const clearDiff = useCallback(() => {
    dispatch({ type: "CLEAR_DIFF" });
  }, []);

  const computeDiff = useCallback(async (idA: string, idB: string) => {
    dispatch({ type: "SET_DIFF_LOADING", payload: true });
    try {
      const result = await diffSnapshots(idA, idB);
      dispatch({ type: "SET_DIFF_RESULT", payload: result });
    } catch (error) {
      message.error(`${copy.compareFailedPrefix}${error}`);
      dispatch({ type: "SET_DIFF_LOADING", payload: false });
    }
  }, [copy.compareFailedPrefix]);

  const setActiveSnapshot = useCallback(async (snapshotId: string) => {
    try {
      const result = await setActiveSnapshotRecord(snapshotId);
      const updated = await listSnapshots(result.skillId);
      dispatch({ type: "SET_SNAPSHOTS", payload: updated });
      message.success(copy.setActiveSuccess);
    } catch (error) {
      message.error(`${copy.actionFailedPrefix}${error}`);
    }
  }, [copy.actionFailedPrefix, copy.setActiveSuccess]);

  const clearCreateSnapshotUiFeedback = useCallback(() => {
    dispatch({ type: "SET_CREATE_SNAPSHOT_UI_FEEDBACK", payload: null });
  }, []);

  return (
    <SnapshotContext.Provider
      value={{
        ...state,
        loadSnapshots,
        createSnapshot,
        restoreSnapshot,
        deleteSnapshot,
        updateSnapshotSummary,
        selectForDiff,
        clearDiff,
        computeDiff,
        setActiveSnapshot,
        clearCreateSnapshotUiFeedback,
      }}
    >
      {children}
    </SnapshotContext.Provider>
  );
}

export function useSnapshotContext() {
  const context = useContext(SnapshotContext);
  if (!context) {
    throw new Error("useSnapshotContext must be used within SnapshotProvider");
  }
  return context;
}
