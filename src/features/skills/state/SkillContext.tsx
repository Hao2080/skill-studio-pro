import { createContext, useContext, useReducer, useCallback, useEffect, useRef, type ReactNode } from "react";
import message from "antd/es/message";
import type { Skill, ChangeStatus } from "@/types/skill";
import {
  createSkill as createSkillRecord,
  deleteSkill as deleteSkillRecord,
  detectChanges,
  importSkill as importSkillRecord,
  listSkills,
  openSkillImportDialog,
} from "../api/skillsApi";
import { useI18n } from "@/features/settings/state/I18nContext";

interface SkillState {
  skills: Skill[];
  selectedSkillId: string | null;
  loading: boolean;
  error: string | null;
  changeStatusMap: Record<string, ChangeStatus>;
}

type SkillAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_SKILLS"; payload: Skill[] }
  | { type: "SELECT_SKILL"; payload: string | null }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "ADD_SKILL"; payload: Skill }
  | { type: "REMOVE_SKILL"; payload: string }
  | { type: "SET_CHANGE_STATUS"; payload: { skillId: string; status: ChangeStatus } };

interface SkillContextValue extends SkillState {
  loadSkills: () => Promise<void>;
  selectSkill: (id: string | null) => void;
  importSkill: () => Promise<void>;
  createSkill: (input: { name: string; description?: string }) => Promise<Skill>;
  deleteSkill: (id: string) => Promise<void>;
  loadChangeStatuses: () => Promise<void>;
}

const SkillContext = createContext<SkillContextValue | null>(null);

function skillReducer(state: SkillState, action: SkillAction): SkillState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_SKILLS":
      return { ...state, skills: action.payload, loading: false, error: null };
    case "SELECT_SKILL":
      return { ...state, selectedSkillId: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload, loading: false };
    case "ADD_SKILL":
      return { ...state, skills: [...state.skills, action.payload] };
    case "REMOVE_SKILL":
      return {
        ...state,
        skills: state.skills.filter((skill) => skill.id !== action.payload),
        selectedSkillId: state.selectedSkillId === action.payload ? null : state.selectedSkillId,
      };
    case "SET_CHANGE_STATUS":
      return {
        ...state,
        changeStatusMap: {
          ...state.changeStatusMap,
          [action.payload.skillId]: action.payload.status,
        },
      };
    default:
      return state;
  }
}

const initialState: SkillState = {
  skills: [],
  selectedSkillId: null,
  loading: false,
  error: null,
  changeStatusMap: {},
};

export function SkillProvider({ children }: { children: ReactNode }) {
  const { resolvedLanguage } = useI18n();
  const [state, dispatch] = useReducer(skillReducer, initialState);
  const skillsRef = useRef(state.skills);
  skillsRef.current = state.skills;
  const copy = resolvedLanguage === "en-US"
    ? {
        createSuccess: "Created successfully",
        importSuccess: "Imported successfully",
        importFailedPrefix: "Import failed: ",
        deleteSuccess: "Deleted successfully",
        deleteFailedPrefix: "Delete failed: ",
      }
    : {
        createSuccess: "创建成功",
        importSuccess: "导入成功",
        importFailedPrefix: "导入失败: ",
        deleteSuccess: "已删除",
        deleteFailedPrefix: "删除失败: ",
      };

  const loadSkills = useCallback(async () => {
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const result = await listSkills();
      dispatch({ type: "SET_SKILLS", payload: result });
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: String(error) });
    }
  }, []);

  const selectSkill = useCallback((id: string | null) => {
    dispatch({ type: "SELECT_SKILL", payload: id });
  }, []);

  const createSkill = useCallback(async (input: { name: string; description?: string }) => {
    const result = await createSkillRecord(input);
    dispatch({ type: "ADD_SKILL", payload: result });
    dispatch({ type: "SELECT_SKILL", payload: result.id });
    message.success(copy.createSuccess);
    return result;
  }, [copy.createSuccess]);

  const importSkill = useCallback(async () => {
    try {
      const folderPath = await openSkillImportDialog();
      if (!folderPath) {
        return;
      }

      const result = await importSkillRecord({ folderPath, sourceType: "local" });
      dispatch({ type: "ADD_SKILL", payload: result });
      dispatch({ type: "SELECT_SKILL", payload: result.id });
      message.success(copy.importSuccess);
    } catch (error) {
      message.error(`${copy.importFailedPrefix}${error}`);
    }
  }, [copy.importFailedPrefix, copy.importSuccess]);

  const deleteSkill = useCallback(async (id: string) => {
    try {
      await deleteSkillRecord(id);
      dispatch({ type: "REMOVE_SKILL", payload: id });
      message.success(copy.deleteSuccess);
    } catch (error) {
      message.error(`${copy.deleteFailedPrefix}${error}`);
    }
  }, [copy.deleteFailedPrefix, copy.deleteSuccess]);

  const loadChangeStatuses = useCallback(async () => {
    const skills = skillsRef.current;

    for (const skill of skills) {
      try {
        const status = await detectChanges(skill.id);
        dispatch({ type: "SET_CHANGE_STATUS", payload: { skillId: skill.id, status } });
      } catch {
        // 忽略单个检测失败
      }
    }
  }, []);

  useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  useEffect(() => {
    if (state.skills.length > 0) {
      void loadChangeStatuses();
    }
  }, [state.skills.length, loadChangeStatuses]);

  return (
    <SkillContext.Provider
      value={{ ...state, loadSkills, selectSkill, importSkill, createSkill, deleteSkill, loadChangeStatuses }}
    >
      {children}
    </SkillContext.Provider>
  );
}

export function useSkillContext() {
  const context = useContext(SkillContext);
  if (!context) {
    throw new Error("useSkillContext must be used within SkillProvider");
  }
  return context;
}
