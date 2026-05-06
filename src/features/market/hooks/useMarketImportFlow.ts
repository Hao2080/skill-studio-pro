import { useMemo, useState } from "react";
import type { Skill } from "@/types/skill";
import type { MarketCopy } from "../model/marketCopy";
import type { ImportMode, ImportProgressState, UiLanguage } from "../model/marketTypes";
import { buildRunningImportStatus, buildSourceLabel, extractExistingSlug, wait } from "../model/marketUtils";

interface MarketImportActionOptions {
  mode: ImportMode;
  action: () => Promise<Skill>;
  successMessage: string;
  errorTitle: string;
  errorPrefix: string;
  afterSuccess?: () => void;
}

interface UseMarketImportFlowOptions {
  copy: MarketCopy;
  language: UiLanguage;
  skills: Skill[];
  loadSkills: () => Promise<void>;
  loadImportHistory: () => Promise<void>;
  openSkillWorkspace: (skillId: string) => void;
  onOpenActivity: () => void;
  onSuccessMessage: (content: string) => void;
  onErrorMessage: (content: string) => void;
}

export function useMarketImportFlow({
  copy,
  language,
  skills,
  loadSkills,
  loadImportHistory,
  openSkillWorkspace,
  onOpenActivity,
  onSuccessMessage,
  onErrorMessage,
}: UseMarketImportFlowOptions) {
  const [busyImport, setBusyImport] = useState<ImportMode>(null);
  const [importProgress, setImportProgress] = useState<ImportProgressState | null>(null);

  const currentImportStepIndex = useMemo(() => {
    if (!importProgress) {
      return -1;
    }

    return copy.importSteps.findIndex((step) => step.key === importProgress.stage);
  }, [copy.importSteps, importProgress]);

  const resolveFriendlyImportDetail = (detail: string) => {
    const slug = extractExistingSlug(detail);
    if (!slug) {
      return detail;
    }

    const conflictSkill = skills.find((skill) => skill.slug === slug);
    if (conflictSkill) {
      return copy.importSlugConflictWithSkill(slug, conflictSkill.name);
    }

    return copy.importSlugConflict(slug);
  };

  const finishImport = async (skill: Skill, successMessage: string) => {
    await loadSkills();
    onSuccessMessage(successMessage);
    openSkillWorkspace(skill.id);
  };

  const beginImportFlow = async (mode: ImportMode) => {
    setImportProgress(buildRunningImportStatus(mode, "prepare", language));
    await wait(90);
    setImportProgress(buildRunningImportStatus(mode, "dispatch", language));
    await wait(120);
    setImportProgress(buildRunningImportStatus(mode, "processing", language));
  };

  const handleImportSuccess = async (mode: ImportMode, skill: Skill, successMessage: string) => {
    setImportProgress({
      mode,
      sourceLabel: buildSourceLabel(mode, language),
      stage: "done",
      status: "success",
      title: copy.importCompletedTitle(skill.name),
      detail: successMessage,
      targetName: skill.name,
    });
    await loadImportHistory();
    await wait(180);
    await finishImport(skill, successMessage);
  };

  const handleImportError = (mode: ImportMode, title: string, error: unknown) => {
    const detail = resolveFriendlyImportDetail(error instanceof Error ? error.message : String(error));
    setImportProgress({
      mode,
      sourceLabel: buildSourceLabel(mode, language),
      stage: "processing",
      status: "error",
      title,
      detail,
    });
    return detail;
  };

  const runImportAction = async (options: MarketImportActionOptions) => {
    setBusyImport(options.mode);
    onOpenActivity();
    try {
      await beginImportFlow(options.mode);
      const skill = await options.action();
      options.afterSuccess?.();
      await handleImportSuccess(options.mode, skill, options.successMessage);
    } catch (error) {
      const detail = handleImportError(options.mode, options.errorTitle, error);
      onErrorMessage(`${options.errorPrefix}: ${detail}`);
      await loadImportHistory();
    } finally {
      setBusyImport(null);
    }
  };

  return {
    busyImport,
    currentImportStepIndex,
    importProgress,
    runImportAction,
  };
}
