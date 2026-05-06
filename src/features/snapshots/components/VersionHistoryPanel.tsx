import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import App from "antd/es/app";
import { useI18n } from "@/features/settings/state/I18nContext";
import { useSkillContext } from "@/features/skills/state/SkillContext";
import { useSnapshotContext } from "@/features/snapshots/state/SnapshotContext";
import { buildVersionDecision, type VersionDecisionAction } from "@/features/snapshots/model/versionDecision";
import { buildCompareLabels, WORKING_DIR_VALUE } from "@/features/snapshots/model/versionCompareState";
import {
  buildVersionTimelineGroups,
  getLatestTeamSnapshotId,
  getPlatformLabel,
  getVersionHistoryCopy,
  getVersionDecisionKey,
  getWorkspaceBaseSummary,
} from "@/features/snapshots/model/versionHistoryPresentation";
import { CompareModeShell } from "@/features/snapshots/components/CompareModeShell";
import {
  getActiveManualSnapshot,
  getLatestManualSnapshot,
  getSystemSnapshots,
  isSystemSnapshot,
} from "@/features/snapshots/model/snapshotSource";
import {
  EMPTY_COMPARE_DRAFT,
  getDefaultSelectedEntity,
  getSelectedSnapshot,
  sanitizeCompareDraft,
  WORKSPACE_ENTITY,
  type CompareDraft,
  type SelectedEntity,
} from "@/features/snapshots/model/versionSelection";
import { VersionDecisionBar } from "@/features/snapshots/components/VersionDecisionBar";
import { VersionTimelineSidebar } from "@/features/snapshots/components/VersionTimelineSidebar";
import { VersionConsoleShell, type VersionConsoleTab } from "@/features/snapshots/components/VersionConsoleShell";
import {
  CreateSnapshotModal,
  ReleaseSnapshotModal,
  TeamSubmitModal,
} from "@/features/snapshots/components/VersionHistoryModals";
import type { SkillDetailIntent } from "@/features/skills/model/detailNavigation";
import type { PlatformConnection, SnapshotDiffResult, SkillPlatformReleaseOverview } from "@/types/skill";
import type { SkillTeamDeliveryOverview } from "@/types/team";
import {
  diffSnapshots as loadSnapshotDiff,
  diffWorkingDirectory,
  getSkillPlatformReleases,
  publishSnapshotToPlatforms,
  removeSkillFromPlatforms,
} from "../api/snapshotsApi";
import {
  getSkillTeamDeliveries,
  removeSkillFromTeams,
  submitSnapshotToTeams,
  withdrawPendingTeamDeliveries,
} from "@/features/teams/api/teamsApi";
import { listPlatformConnections } from "@/features/platforms/api/platformsApi";

interface VersionHistoryPanelProps {
  navigationIntent?: Extract<SkillDetailIntent, { tab: "Versions" }> | null;
  openCreateSnapshotRequest?: number;
  onOpenFiles?: () => void;
  onOpenSettings?: () => void;
  onOpenTeams?: () => void;
}

export function VersionHistoryPanel({
  navigationIntent = null,
  openCreateSnapshotRequest = 0,
  onOpenFiles,
  onOpenSettings,
  onOpenTeams,
}: VersionHistoryPanelProps) {
  const { resolvedLanguage } = useI18n();
  const { selectedSkillId, loadSkills, loadChangeStatuses, changeStatusMap } = useSkillContext();
  const {
    snapshots,
    loading: snapshotsLoading,
    createSnapshot,
    restoreSnapshot,
    deleteSnapshot,
    updateSnapshotSummary,
    setActiveSnapshot,
    loadSnapshots,
    createSnapshotUiFeedback,
    clearCreateSnapshotUiFeedback,
  } = useSnapshotContext();
  const { message } = App.useApp();
  const copy = getVersionHistoryCopy(resolvedLanguage);

  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity | null>(null);
  const [compareDraft, setCompareDraft] = useState<CompareDraft>(EMPTY_COMPARE_DRAFT);
  const [diffResult, setDiffResult] = useState<SnapshotDiffResult | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diffMode, setDiffMode] = useState<"unified" | "split">("unified");
  const [modalOpen, setModalOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [platforms, setPlatforms] = useState<PlatformConnection[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [releaseOverview, setReleaseOverview] = useState<SkillPlatformReleaseOverview | null>(null);
  const [releaseOverviewLoading, setReleaseOverviewLoading] = useState(false);
  const [busyPlatforms, setBusyPlatforms] = useState<string[]>([]);
  const [teamDeliveryOverview, setTeamDeliveryOverview] = useState<SkillTeamDeliveryOverview | null>(null);
  const [teamDeliveryLoading, setTeamDeliveryLoading] = useState(false);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [highlightedSnapshotId, setHighlightedSnapshotId] = useState<string | null>(null);
  const [teamSubmitting, setTeamSubmitting] = useState(false);
  const [teamSubmitModalOpen, setTeamSubmitModalOpen] = useState(false);
  const [teamSubmitter, setTeamSubmitter] = useState("jensen");
  const [teamSubmitMessage, setTeamSubmitMessage] = useState("");
  const [busyTeams, setBusyTeams] = useState<string[]>([]);
  const [activeConsoleTab, setActiveConsoleTab] = useState<VersionConsoleTab>("detail");
  const [dismissedDecisionKey, setDismissedDecisionKey] = useState<string | null>(null);

  const timelineRef = useRef<HTMLDivElement | null>(null);
  const handledNavigationIntentRef = useRef<Extract<SkillDetailIntent, { tab: "Versions" }> | null>(null);

  const manualSnapshots = useMemo(
    () => snapshots.filter((snapshot) => !isSystemSnapshot(snapshot)),
    [snapshots],
  );
  const systemSnapshots = useMemo(
    () => getSystemSnapshots(snapshots),
    [snapshots],
  );
  const activeSnapshot = useMemo(
    () => getActiveManualSnapshot(snapshots),
    [snapshots],
  );
  const latestSnapshot = useMemo(
    () => getLatestManualSnapshot(snapshots),
    [snapshots],
  );
  const latestAnySnapshot = snapshots[0] ?? null;
  const changeStatus = changeStatusMap?.[selectedSkillId ?? ""] ?? null;
  const hasChanges = changeStatus?.hasChanges ?? false;
  const changedFileCount = changeStatus
    ? changeStatus.addedFiles.length + changeStatus.modifiedFiles.length + changeStatus.deletedFiles.length
    : 0;
  const previewSnapshot = getSelectedSnapshot(selectedEntity, snapshots);
  const compareBaseSnapshot = useMemo(
    () => snapshots.find((snapshot) => snapshot.id === compareDraft.baseSnapshotId) ?? null,
    [compareDraft.baseSnapshotId, snapshots],
  );
  const enabledPlatforms = useMemo(
    () => platforms.filter((platform) => platform.enabled && platform.detected),
    [platforms],
  );
  const teamDeliveries = teamDeliveryOverview?.deliveries ?? [];
  const hasPendingTeamDelivery = useMemo(
    () => teamDeliveries.some((delivery) => Boolean(delivery.pendingDelivery)),
    [teamDeliveries],
  );
  const latestTeamSnapshotId = useMemo(
    () => getLatestTeamSnapshotId(teamDeliveryOverview),
    [teamDeliveryOverview],
  );
  const workspaceBaseSnapshot = latestSnapshot ?? latestAnySnapshot;
  const workspaceBaseSummary = getWorkspaceBaseSummary({
    copy,
    hasChanges,
    workspaceBaseSnapshot,
    isSystemSnapshot,
  });
  const compareTargetHint = copy.compareTargetHint;
  const selectedSnapshot = previewSnapshot;
  const selectedSystemSnapshot = isSystemSnapshot(selectedSnapshot);
  const versionDecision = useMemo(
    () =>
      buildVersionDecision({
        hasChanges,
        changedFileCount,
        latestSnapshot,
        activeSnapshot,
        enabledPlatforms,
        hasPendingTeamDelivery,
        language: resolvedLanguage,
      }),
    [activeSnapshot, changedFileCount, enabledPlatforms, hasChanges, hasPendingTeamDelivery, latestSnapshot, resolvedLanguage],
  );
  const timelineGroups = useMemo(
    () =>
      buildVersionTimelineGroups({
        copy,
        language: resolvedLanguage,
        manualSnapshots,
        systemSnapshots,
      }),
    [copy, manualSnapshots, resolvedLanguage, systemSnapshots],
  );
  const versionDecisionKey = useMemo(
    () => getVersionDecisionKey({ selectedSkillId, versionDecision }),
    [selectedSkillId, versionDecision],
  );
  const showVersionDecision = dismissedDecisionKey !== versionDecisionKey;

  const loadPlatformState = useCallback(async () => {
    try {
      const detectedPlatforms = await listPlatformConnections();
      setPlatforms(detectedPlatforms);
      return detectedPlatforms;
    } catch {
      setPlatforms([]);
      return [];
    }
  }, []);

  const loadReleaseOverview = useCallback(async (skillId: string) => {
    setReleaseOverviewLoading(true);
    try {
      const overview = await getSkillPlatformReleases(skillId);
      setReleaseOverview(overview);
      return overview;
    } catch {
      setReleaseOverview(null);
      return null;
    } finally {
      setReleaseOverviewLoading(false);
    }
  }, []);

  const refreshReleaseConsole = useCallback(
    async (skillId: string) => {
      await loadPlatformState();
      return loadReleaseOverview(skillId);
    },
    [loadPlatformState, loadReleaseOverview],
  );

  const loadTeamDeliveryOverview = useCallback(async (skillId: string) => {
    setTeamDeliveryLoading(true);
    try {
      const overview = await getSkillTeamDeliveries(skillId);
      setTeamDeliveryOverview(overview);
      return overview;
    } catch {
      setTeamDeliveryOverview(null);
      return null;
    } finally {
      setTeamDeliveryLoading(false);
    }
  }, []);

  const refreshTeamDeliveryConsole = useCallback(
    async (skillId: string) => loadTeamDeliveryOverview(skillId),
    [loadTeamDeliveryOverview],
  );

  useEffect(() => {
    if (selectedSkillId) {
      void loadSnapshots(selectedSkillId);
      void refreshReleaseConsole(selectedSkillId);
      void refreshTeamDeliveryConsole(selectedSkillId);
    }
  }, [refreshReleaseConsole, refreshTeamDeliveryConsole, selectedSkillId, loadSnapshots]);

  useEffect(() => {
    setSelectedEntity(null);
    setCompareDraft(EMPTY_COMPARE_DRAFT);
    setDiffResult(null);
    setSelectedFile(null);
    setDiffMode("unified");
    setReleaseOverview(null);
    setTeamDeliveryOverview(null);
    setBusyPlatforms([]);
    setBusyTeams([]);
    setDismissedDecisionKey(null);
  }, [selectedSkillId]);

  useEffect(() => {
    setSelectedEntity((current) => {
      if (current && (current.type === "workspace" || snapshots.some((snapshot) => snapshot.id === current.snapshotId))) {
        return current;
      }

      return getDefaultSelectedEntity(snapshots);
    });

    setCompareDraft((current) => sanitizeCompareDraft(current, snapshots));
  }, [snapshots]);

  useEffect(() => {
    if (!selectedSkillId || !compareDraft.baseSnapshotId || !compareDraft.targetId) {
      setDiffResult(null);
      setSelectedFile(null);
      return;
    }

    let cancelled = false;

    async function runDiff() {
      setDiffLoading(true);
      setSelectedFile(null);

      try {
        const currentSkillId = selectedSkillId;
        const baseSnapshotId = compareDraft.baseSnapshotId;
        const targetSnapshotId = compareDraft.targetId;
        if (!currentSkillId || !baseSnapshotId || !targetSnapshotId) {
          return;
        }

        const result: SnapshotDiffResult =
          targetSnapshotId === WORKING_DIR_VALUE
            ? await diffWorkingDirectory(currentSkillId)
            : await loadSnapshotDiff(baseSnapshotId, targetSnapshotId);

        if (!cancelled) {
          setDiffResult(result);
        }
      } catch (error) {
        if (!cancelled) {
          message.error?.(`${copy.compareFailed}: ${error}`);
        }
      } finally {
        if (!cancelled) {
          setDiffLoading(false);
        }
      }
    }

    void runDiff();

    return () => {
      cancelled = true;
    };
  }, [compareDraft, copy.compareFailed, selectedSkillId, message]);

  useEffect(() => {
    if (openCreateSnapshotRequest > 0) {
      setCompareDraft(EMPTY_COMPARE_DRAFT);
      setDiffResult(null);
      setSelectedFile(null);
      setDiffMode("unified");
      setSelectedEntity(WORKSPACE_ENTITY);
      setActiveConsoleTab("detail");
      setModalOpen(true);
    }
  }, [openCreateSnapshotRequest]);

  useEffect(() => {
    if (!navigationIntent) {
      handledNavigationIntentRef.current = null;
      return;
    }

    if (handledNavigationIntentRef.current === navigationIntent) {
      return;
    }

    handledNavigationIntentRef.current = navigationIntent;
    setCompareDraft(EMPTY_COMPARE_DRAFT);
    setDiffResult(null);
    setSelectedFile(null);
    setDiffMode("unified");

    if (navigationIntent.section) {
      setActiveConsoleTab(navigationIntent.section);
    }

    if (navigationIntent.action === "create_snapshot") {
      setSelectedEntity(WORKSPACE_ENTITY);
      setActiveConsoleTab("detail");
      return;
    }

    if ((navigationIntent.action === "set_active" || navigationIntent.action === "review_latest") && latestSnapshot) {
      setSelectedEntity({ type: "snapshot", snapshotId: latestSnapshot.id });
      setActiveConsoleTab("detail");
    }
  }, [latestSnapshot, navigationIntent]);

  useEffect(() => {
    if (!createSnapshotUiFeedback) {
      return;
    }

    setHighlightedSnapshotId(createSnapshotUiFeedback.highlightedSnapshotId);

    const scrollTimer = window.setTimeout(() => {
      const target = timelineRef.current?.querySelector<HTMLElement>(
        `[data-snapshot-id="${createSnapshotUiFeedback.scrollToSnapshotId}"]`,
      );
      target?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 0);

    const clearTimer = window.setTimeout(() => {
      setHighlightedSnapshotId(null);
      clearCreateSnapshotUiFeedback();
    }, 2000);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [createSnapshotUiFeedback, clearCreateSnapshotUiFeedback]);

  const reportPlatformActionResult = useCallback(
    (
      records: { platformName: string; displayName?: string; status: string; errorMessage?: string }[],
      successPrefix: string,
      failurePrefix: string,
    ) => {
      const successes = records.filter((record) => record.status === "success");
      const failures = records.filter((record) => record.status === "failed");

      if (successes.length > 0) {
        message.success?.(
          `${successPrefix}${successes
            .map((record) => getPlatformLabel(record.platformName, record.displayName))
            .join("、")}`,
        );
      }

      if (failures.length > 0) {
        message.error?.(
          `${failurePrefix}${failures
            .map(
              (record) =>
                `${getPlatformLabel(record.platformName, record.displayName)}: ${record.errorMessage || copy.unknownError}`,
            )
            .join("；")}`,
        );
      }
    },
    [copy.unknownError, message],
  );

  const reportTeamActionResult = useCallback(
    (
      records: { teamName: string; status: string; note?: string }[],
      successPrefix: string,
      failurePrefix: string,
    ) => {
      const successes = records.filter((record) => record.status !== "failed");
      const failures = records.filter((record) => record.status === "failed");

      if (successes.length > 0) {
        message.success?.(`${successPrefix}${successes.map((record) => record.teamName).join("、")}`);
      }

      if (failures.length > 0) {
        message.error?.(
          `${failurePrefix}${failures
            .map((record) => `${record.teamName}: ${record.note || copy.unknownError}`)
            .join("；")}`,
        );
      }
    },
    [copy.unknownError, message],
  );

  const handleSyncClick = useCallback(async () => {
    if (!selectedSnapshot) {
      message.warning?.(copy.selectSnapshotBeforePublish);
      return;
    }

    if (isSystemSnapshot(selectedSnapshot)) {
      message.warning?.(copy.systemCannotPublish);
      return;
    }

    const detectedPlatforms = await loadPlatformState();
    const enabled = detectedPlatforms.filter((platform) => platform.enabled && platform.detected);
    if (enabled.length === 0) {
      message.warning?.(copy.noEnabledPlatform);
      return;
    }

    setSelectedPlatforms(enabled.map((platform) => platform.platformName));
    setSyncModalOpen(true);
  }, [copy.noEnabledPlatform, copy.selectSnapshotBeforePublish, copy.systemCannotPublish, loadPlatformState, message, selectedSnapshot]);

  const handleCreate = async () => {
    if (!selectedSkillId) {
      return;
    }

    await createSnapshot(selectedSkillId, summary);
    setModalOpen(false);
    setSummary("");
    loadSkills();
    loadChangeStatuses();
  };

  const handleSyncConfirm = async () => {
    if (!selectedSkillId || !selectedSnapshot || selectedPlatforms.length === 0) {
      return;
    }

    if (isSystemSnapshot(selectedSnapshot)) {
      message.warning?.(copy.systemCannotPublish);
      return;
    }

    setSyncing(true);
    setSyncModalOpen(false);
    try {
      const records = await publishSnapshotToPlatforms(selectedSkillId, selectedSnapshot.id, selectedPlatforms);
      reportPlatformActionResult(records, copy.publishedTo, copy.publishFailedPrefix);
      await refreshReleaseConsole(selectedSkillId);
    } catch (error) {
      message.error?.(`${copy.publishFailedPrefix}${error}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenTeamSubmitModal = useCallback(() => {
    if (!selectedSnapshot) {
      message.warning?.(copy.selectSnapshotBeforeDeliver);
      return;
    }

    if (isSystemSnapshot(selectedSnapshot)) {
      message.warning?.(copy.systemCannotDeliver);
      return;
    }

    if (teamDeliveries.length === 0) {
      message.warning?.(copy.noDeliverableTeams);
      return;
    }

    setSelectedTeams(teamDeliveries.map((delivery) => delivery.teamId));
    setTeamSubmitModalOpen(true);
  }, [copy.noDeliverableTeams, copy.selectSnapshotBeforeDeliver, copy.systemCannotDeliver, message, selectedSnapshot, teamDeliveries]);

  const handleTeamSubmitConfirm = useCallback(async () => {
    if (!selectedSkillId || !selectedSnapshot || selectedTeams.length === 0) {
      return;
    }

    if (isSystemSnapshot(selectedSnapshot)) {
      message.warning?.(copy.systemCannotDeliver);
      return;
    }

    setTeamSubmitting(true);
    setTeamSubmitModalOpen(false);
    try {
      const records = await submitSnapshotToTeams({
        skillId: selectedSkillId,
        snapshotId: selectedSnapshot.id,
        teamIds: selectedTeams,
        submitter: teamSubmitter.trim() || "jensen",
        submitMessage: teamSubmitMessage.trim() || undefined,
      });
      reportTeamActionResult(records, copy.submittedToTeams, copy.submitFailedPrefix);
      await refreshTeamDeliveryConsole(selectedSkillId);
    } catch (error) {
      message.error?.(`${copy.submitFailedPrefix}${error}`);
    } finally {
      setTeamSubmitting(false);
    }
  }, [
    copy.submitFailedPrefix,
    copy.submittedToTeams,
    copy.systemCannotDeliver,
    message,
    refreshTeamDeliveryConsole,
    reportTeamActionResult,
    selectedSkillId,
    selectedSnapshot,
    selectedTeams,
    teamSubmitMessage,
    teamSubmitter,
  ]);

  const handlePublishPlatform = useCallback(
    async (platformName: string) => {
      if (!selectedSkillId || !selectedSnapshot) {
        message.warning?.(copy.selectSnapshotBeforePublish);
        return;
      }

      if (isSystemSnapshot(selectedSnapshot)) {
        message.warning?.(copy.systemCannotPublish);
        return;
      }

      setBusyPlatforms([platformName]);
      try {
        const records = await publishSnapshotToPlatforms(selectedSkillId, selectedSnapshot.id, [platformName]);
        reportPlatformActionResult(records, copy.publishedTo, copy.publishFailedPrefix);
        await refreshReleaseConsole(selectedSkillId);
      } catch (error) {
        message.error?.(`${copy.publishFailedPrefix}${error}`);
      } finally {
        setBusyPlatforms([]);
      }
    },
    [
      copy.publishFailedPrefix,
      copy.publishedTo,
      copy.selectSnapshotBeforePublish,
      copy.systemCannotPublish,
      message,
      refreshReleaseConsole,
      reportPlatformActionResult,
      selectedSkillId,
      selectedSnapshot,
    ],
  );

  const handleRemovePlatform = useCallback(
    async (platformName: string) => {
      if (!selectedSkillId) {
        return;
      }

      setBusyPlatforms([platformName]);
      try {
        const records = await removeSkillFromPlatforms(selectedSkillId, [platformName]);
        reportPlatformActionResult(records, copy.removeFromPlatform, copy.removeFailedPrefix);
        await refreshReleaseConsole(selectedSkillId);
      } catch (error) {
        message.error?.(`${copy.removeFailedPrefix}${error}`);
      } finally {
        setBusyPlatforms([]);
      }
    },
    [copy.removeFailedPrefix, copy.removeFromPlatform, message, refreshReleaseConsole, reportPlatformActionResult, selectedSkillId],
  );

  const handleSubmitTeam = useCallback(
    async (teamId: string) => {
      if (!selectedSkillId || !selectedSnapshot) {
        message.warning?.(copy.selectSnapshotBeforeDeliver);
        return;
      }

      if (isSystemSnapshot(selectedSnapshot)) {
        message.warning?.(copy.systemCannotDeliver);
        return;
      }

      setBusyTeams([teamId]);
      try {
        const records = await submitSnapshotToTeams({
          skillId: selectedSkillId,
          snapshotId: selectedSnapshot.id,
          teamIds: [teamId],
          submitter: teamSubmitter.trim() || "jensen",
          submitMessage: teamSubmitMessage.trim() || undefined,
        });
        reportTeamActionResult(records, copy.submittedToTeams, copy.submitFailedPrefix);
        await refreshTeamDeliveryConsole(selectedSkillId);
      } catch (error) {
        message.error?.(`${copy.deliveryFailedPrefix}${error}`);
      } finally {
        setBusyTeams([]);
      }
    },
    [
      copy.deliveryFailedPrefix,
      copy.selectSnapshotBeforeDeliver,
      copy.submitFailedPrefix,
      copy.submittedToTeams,
      copy.systemCannotDeliver,
      message,
      refreshTeamDeliveryConsole,
      reportTeamActionResult,
      selectedSkillId,
      selectedSnapshot,
      teamSubmitMessage,
      teamSubmitter,
    ],
  );

  const handleWithdrawTeam = useCallback(
    async (teamId: string) => {
      if (!selectedSkillId) {
        return;
      }

      setBusyTeams([teamId]);
      try {
        const records = await withdrawPendingTeamDeliveries({
          skillId: selectedSkillId,
          teamIds: [teamId],
          actor: teamSubmitter.trim() || "jensen",
        });
        reportTeamActionResult(records, copy.withdrawFromTeams, copy.withdrawFailedPrefix);
        await refreshTeamDeliveryConsole(selectedSkillId);
      } catch (error) {
        message.error?.(`${copy.withdrawFailedPrefix}${error}`);
      } finally {
        setBusyTeams([]);
      }
    },
    [copy.withdrawFailedPrefix, copy.withdrawFromTeams, message, refreshTeamDeliveryConsole, reportTeamActionResult, selectedSkillId, teamSubmitter],
  );

  const handleRemoveTeam = useCallback(
    async (teamId: string) => {
      if (!selectedSkillId) {
        return;
      }

      setBusyTeams([teamId]);
      try {
        const records = await removeSkillFromTeams({
          skillId: selectedSkillId,
          teamIds: [teamId],
          actor: teamSubmitter.trim() || "jensen",
        });
        reportTeamActionResult(records, copy.removeTeamServing, copy.removeTeamFailedPrefix);
        await refreshTeamDeliveryConsole(selectedSkillId);
      } catch (error) {
        message.error?.(`${copy.removeTeamFailedPrefix}${error}`);
      } finally {
        setBusyTeams([]);
      }
    },
    [copy.removeTeamFailedPrefix, copy.removeTeamServing, message, refreshTeamDeliveryConsole, reportTeamActionResult, selectedSkillId, teamSubmitter],
  );

  const handleStartCompare = useCallback((snapshotId: string) => {
    setSelectedEntity({ type: "snapshot", snapshotId });
    setCompareDraft({
      baseSnapshotId: snapshotId,
      targetId: null,
      selectingTarget: true,
    });
  }, []);

  const handleStartCompareFromWorkspace = useCallback(() => {
    if (!workspaceBaseSnapshot) {
      message.warning?.(copy.compareNeedsBase);
      return;
    }

    setSelectedEntity(WORKSPACE_ENTITY);
    setCompareDraft({
      baseSnapshotId: workspaceBaseSnapshot.id,
      targetId: null,
      selectingTarget: true,
    });
  }, [copy.compareNeedsBase, message, workspaceBaseSnapshot]);

  const handleSelectWorkspace = useCallback(() => {
    setSelectedEntity(WORKSPACE_ENTITY);
    setCompareDraft((current) => {
      if (!current.baseSnapshotId || !current.selectingTarget) {
        return current;
      }

      return {
        ...current,
        targetId: WORKING_DIR_VALUE,
        selectingTarget: false,
      };
    });
  }, []);

  const handleSelectSnapshot = useCallback((snapshotId: string) => {
    setSelectedEntity({ type: "snapshot", snapshotId });
    setCompareDraft((current) => {
      if (!current.baseSnapshotId || !current.selectingTarget || current.baseSnapshotId === snapshotId) {
        return current;
      }

      return {
        ...current,
        targetId: snapshotId,
        selectingTarget: false,
      };
    });
  }, []);

  const clearCompareDraft = useCallback(() => {
    setCompareDraft(EMPTY_COMPARE_DRAFT);
  }, []);

  const handleFocusActiveVersion = useCallback(() => {
    if (!activeSnapshot) {
      return;
    }

    setSelectedEntity({ type: "snapshot", snapshotId: activeSnapshot.id });
  }, [activeSnapshot]);

  const handleOpenSettings = useCallback(() => {
    setActiveConsoleTab("release");
    onOpenSettings?.();
  }, [onOpenSettings]);

  const handleOpenTeams = useCallback(() => {
    setActiveConsoleTab("team");
    onOpenTeams?.();
  }, [onOpenTeams]);
  const handleToolbarCompare = useCallback(() => {
    if (selectedEntity?.type === "snapshot" && selectedSnapshot) {
      handleStartCompare(selectedSnapshot.id);
      return;
    }

    handleStartCompareFromWorkspace();
  }, [handleStartCompare, handleStartCompareFromWorkspace, selectedEntity, selectedSnapshot]);
  const handleToolbarCreateSnapshot = useCallback(() => {
    setCompareDraft(EMPTY_COMPARE_DRAFT);
    setDiffResult(null);
    setSelectedFile(null);
    setDiffMode("unified");
    setSelectedEntity(WORKSPACE_ENTITY);
    setActiveConsoleTab("detail");
    setModalOpen(true);
  }, []);
  const handleDecisionAction = useCallback(
    (action: VersionDecisionAction) => {
      switch (action.type) {
        case "create_snapshot":
          handleToolbarCreateSnapshot();
          return;
        case "open_files":
          onOpenFiles?.();
          return;
        case "set_active":
        case "review_latest":
          if (latestSnapshot) {
            setSelectedEntity({ type: "snapshot", snapshotId: latestSnapshot.id });
          }
          setActiveConsoleTab("detail");
          return;
        case "open_release":
          if (activeSnapshot) {
            setSelectedEntity({ type: "snapshot", snapshotId: activeSnapshot.id });
          }
          setActiveConsoleTab("release");
          return;
        case "open_team":
          if (latestTeamSnapshotId) {
            setSelectedEntity({ type: "snapshot", snapshotId: latestTeamSnapshotId });
          }
          setActiveConsoleTab("team");
          return;
        case "open_settings":
          handleOpenSettings();
          return;
      }
    },
    [
      activeSnapshot,
      handleOpenSettings,
      handleToolbarCreateSnapshot,
      latestSnapshot,
      latestTeamSnapshotId,
      onOpenFiles,
    ],
  );

  const compareModeActive = !!compareDraft.baseSnapshotId && !!compareDraft.targetId;
  const compareLabels = compareModeActive
    ? buildCompareLabels(compareDraft, snapshots, {
        unselected: copy.pending,
        workspace: copy.workspace,
      })
    : null;
  const selectingCompareTarget = Boolean(compareDraft.baseSnapshotId && compareDraft.selectingTarget);
  const compareDraftTitle = selectingCompareTarget
    ? selectedEntity?.type === "workspace" && compareBaseSnapshot
      ? copy.compareReadyTitle(compareBaseSnapshot.snapshotNumber)
      : copy.compareReady
    : null;
  const releaseBusy = syncing || busyPlatforms.length > 0;
  const teamBusy = teamSubmitting || busyTeams.length > 0;

  if (!selectedSkillId) {
    return (
      <div className="workspace-panel-empty">
        <span>{copy.noSkillSelected}</span>
      </div>
    );
  }

  if (compareModeActive && compareLabels) {
    return (
      <div className="version-history-panel version-history-panel--dense">
        <div className="version-history-panel__compare-shell">
          <CompareModeShell
            labelA={compareLabels.labelA}
            labelB={compareLabels.labelB}
            hasChanges={hasChanges}
            diffResult={diffResult}
            diffLoading={diffLoading}
            selectedFile={selectedFile}
            diffMode={diffMode}
            onSelectFile={setSelectedFile}
            onDiffModeChange={setDiffMode}
            onBack={() => {
              setCompareDraft(EMPTY_COMPARE_DRAFT);
              setDiffResult(null);
              setSelectedFile(null);
              setDiffMode("unified");
            }}
            onCompareWorkspace={() =>
              setCompareDraft((current) =>
                current.baseSnapshotId
                  ? {
                      ...current,
                      targetId: WORKING_DIR_VALUE,
                      selectingTarget: false,
                    }
                  : current,
              )
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="version-history-panel version-history-panel--dense">
      {showVersionDecision ? (
        <VersionDecisionBar
          copy={copy}
          decision={versionDecision}
          onAction={handleDecisionAction}
          onDismiss={() => setDismissedDecisionKey(versionDecisionKey)}
        />
      ) : null}

      <div className="version-history-panel__body">
        <VersionTimelineSidebar
          copy={copy}
          language={resolvedLanguage}
          timelineRef={timelineRef}
          snapshotsLoading={snapshotsLoading}
          selectedEntity={selectedEntity}
          compareDraft={compareDraft}
          selectingCompareTarget={selectingCompareTarget}
          compareTargetHint={compareTargetHint}
          manualSnapshotCount={manualSnapshots.length}
          systemSnapshotCount={systemSnapshots.length}
          timelineGroups={timelineGroups}
          hasChanges={hasChanges}
          changedFileCount={changedFileCount}
          workspaceBaseSummary={workspaceBaseSummary}
          highlightedSnapshotId={highlightedSnapshotId}
          onSelectWorkspace={handleSelectWorkspace}
          onSelectSnapshot={handleSelectSnapshot}
        />

        <VersionConsoleShell
          copy={copy}
          language={resolvedLanguage}
          activeConsoleTab={activeConsoleTab}
          onConsoleTabChange={setActiveConsoleTab}
          releaseBusy={releaseBusy}
          hasPendingTeamDelivery={hasPendingTeamDelivery}
          teamBusy={teamBusy}
          snapshotsLength={snapshots.length}
          onCreateSnapshot={handleToolbarCreateSnapshot}
          onStartCompare={handleToolbarCompare}
          selectingCompareTarget={selectingCompareTarget}
          compareDraftTitle={compareDraftTitle}
          compareBaseSnapshotNumber={compareBaseSnapshot?.snapshotNumber ?? null}
          onSelectWorkspace={handleSelectWorkspace}
          onCancelCompare={clearCompareDraft}
          selectedEntity={selectedEntity}
          selectedSnapshot={selectedSnapshot}
          activeSnapshot={activeSnapshot}
          latestSnapshot={latestSnapshot}
          hasWorkspaceChanges={hasChanges}
          changedFileCount={changedFileCount}
          compareDraft={compareDraft}
          onRestoreSnapshot={restoreSnapshot}
          onSetActiveSnapshot={setActiveSnapshot}
          onDeleteSnapshot={deleteSnapshot}
          onUpdateSummary={updateSnapshotSummary}
          onOpenFiles={() => onOpenFiles?.()}
          releaseOverview={releaseOverview}
          releaseOverviewLoading={releaseOverviewLoading}
          busyPlatforms={busyPlatforms}
          onPublish={() => void handleSyncClick()}
          onPublishPlatform={(platformName) => void handlePublishPlatform(platformName)}
          onRemovePlatform={(platformName) => void handleRemovePlatform(platformName)}
          onOpenSettings={handleOpenSettings}
          onFocusActiveVersion={handleFocusActiveVersion}
          teamDeliveryOverview={teamDeliveryOverview}
          teamDeliveryLoading={teamDeliveryLoading}
          teamSubmitting={teamSubmitting}
          busyTeams={busyTeams}
          onSubmitTeams={() => void handleOpenTeamSubmitModal()}
          onSubmitTeam={(teamId) => void handleSubmitTeam(teamId)}
          onWithdrawTeam={(teamId) => void handleWithdrawTeam(teamId)}
          onRemoveTeam={(teamId) => void handleRemoveTeam(teamId)}
          onOpenTeams={handleOpenTeams}
        />
      </div>

      <CreateSnapshotModal
        copy={copy}
        open={modalOpen}
        summary={summary}
        onSummaryChange={setSummary}
        onConfirm={() => void handleCreate()}
        onCancel={() => {
          setModalOpen(false);
          setSummary("");
        }}
      />

      <ReleaseSnapshotModal
        copy={copy}
        open={syncModalOpen}
        selectedSnapshot={selectedSnapshot}
        selectedSystemSnapshot={selectedSystemSnapshot}
        enabledPlatforms={enabledPlatforms}
        selectedPlatforms={selectedPlatforms}
        releaseBusy={releaseBusy}
        onSelectedPlatformsChange={setSelectedPlatforms}
        onConfirm={() => void handleSyncConfirm()}
        onCancel={() => setSyncModalOpen(false)}
      />

      <TeamSubmitModal
        copy={copy}
        open={teamSubmitModalOpen}
        selectedSnapshot={selectedSnapshot}
        selectedSystemSnapshot={selectedSystemSnapshot}
        selectedTeams={selectedTeams}
        teamDeliveries={teamDeliveries}
        teamSubmitter={teamSubmitter}
        teamSubmitMessage={teamSubmitMessage}
        teamBusy={teamBusy}
        onSelectedTeamsChange={setSelectedTeams}
        onTeamSubmitterChange={setTeamSubmitter}
        onTeamSubmitMessageChange={setTeamSubmitMessage}
        onConfirm={() => void handleTeamSubmitConfirm()}
        onCancel={() => setTeamSubmitModalOpen(false)}
      />
    </div>
  );
}
