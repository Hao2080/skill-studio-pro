import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Button from "antd/es/button";
import Modal from "antd/es/modal";
import { Compass, FolderTree, History } from "lucide-react";
import "@/styles/detail-workspace.css";
import "@/styles/detail-workspace/version-console.css";
import "@/styles/detail-workspace/overview-console.css";
import { useI18n } from "@/features/settings/state/I18nContext";
import { VersionHistoryPanel } from "@/features/snapshots/components/VersionHistoryPanel";
import { FileExplorerPanel, type FileExplorerPanelHandle } from "@/features/skills/components/FileExplorerPanel";
import { SkillOverviewPanel } from "@/features/skills/components/SkillOverviewPanel";
import { SkillDetailHeader } from "@/features/skills/components/SkillDetailHeader";
import { useSkillContext } from "@/features/skills/state/SkillContext";
import { useSnapshotContext } from "@/features/snapshots/state/SnapshotContext";
import { useTeamContext } from "@/features/teams/state/TeamContext";
import { listSkillFiles, listSkillSources } from "@/features/skills/api/skillsApi";
import { getSkillPlatformReleases } from "@/features/snapshots/api/snapshotsApi";
import { getSkillTeamDeliveries } from "@/features/teams/api/teamsApi";
import type { SkillFileNode, SkillPlatformReleaseOverview, SkillSource } from "@/types/skill";
import type { SkillTeamDeliveryOverview } from "@/types/team";
import { buildSkillOverviewModel, type SkillOverviewAction } from "../model/skillOverview";
import type { SkillDetailIntent, SkillDetailTab } from "../model/detailNavigation";

type PendingFilesExit = {
  proceed: () => void;
};
type SkillDetailVersionsIntent = Extract<SkillDetailIntent, { tab: "Versions" }>;

export function SkillDetailWorkspacePage() {
  const navigate = useNavigate();
  const { skillId } = useParams<{ skillId: string }>();
  const { resolvedLanguage } = useI18n();
  const { skills, selectSkill, changeStatusMap } = useSkillContext();
  const { browseRefreshToken, loadSnapshots, snapshots } = useSnapshotContext();
  const { teams } = useTeamContext();
  const fileExplorerRef = useRef<FileExplorerPanelHandle | null>(null);
  const [detailIntent, setDetailIntent] = useState<SkillDetailIntent>({ tab: "Overview" });
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [openCreateSnapshotRequest, setOpenCreateSnapshotRequest] = useState(0);
  const [pendingFilesExit, setPendingFilesExit] = useState<PendingFilesExit | null>(null);
  const [resolvingFilesExit, setResolvingFilesExit] = useState(false);
  const [skillFileTree, setSkillFileTree] = useState<SkillFileNode | null>(null);
  const [platformReleaseOverview, setPlatformReleaseOverview] = useState<SkillPlatformReleaseOverview | null>(null);
  const [teamDeliveryOverview, setTeamDeliveryOverview] = useState<SkillTeamDeliveryOverview | null>(null);
  const [primarySource, setPrimarySource] = useState<SkillSource | null>(null);
  const detailTabs: { key: SkillDetailTab; label: string; icon: typeof Compass }[] = resolvedLanguage === "en-US"
    ? [
        { key: "Overview", label: "Overview", icon: Compass },
        { key: "Files", label: "Files", icon: FolderTree },
        { key: "Versions", label: "Versions", icon: History },
      ]
    : [
        { key: "Overview", label: "概览", icon: Compass },
        { key: "Files", label: "文件", icon: FolderTree },
        { key: "Versions", label: "版本", icon: History },
      ];
  const copy = resolvedLanguage === "en-US"
    ? {
        stage: "Skill workspace content",
        nav: "Skill workspace navigation",
        unsavedTitle: "There are unsaved changes in the current file",
        cancel: "Cancel",
        discard: "Discard Changes",
        saveContinue: "Save and Continue",
        unsavedBody: "Before leaving this file, decide how the unsaved content should be handled.",
      }
    : {
        stage: "技能工作副本内容",
        nav: "技能工作区导航",
        unsavedTitle: "当前文件有未保存更改",
        cancel: "取消",
        discard: "放弃更改",
        saveContinue: "保存后继续",
        unsavedBody: "离开当前文件前，请先决定如何处理未保存内容。",
      };

  const selectedSkill = useMemo(() => skills.find((skill) => skill.id === skillId) ?? null, [skillId, skills]);
  const activeTab = detailIntent.tab;
  const changeStatus = selectedSkill ? changeStatusMap[selectedSkill.id] : null;
  const activeSnapshot = snapshots.find((snapshot) => snapshot.isActive) ?? null;

  const requestFilesExit = useCallback(
    (proceed: () => void) => {
      if (activeTab !== "Files" || !fileExplorerRef.current?.hasUnsavedChanges()) {
        proceed();
        return;
      }

      setPendingFilesExit({ proceed });
    },
    [activeTab],
  );

  const openFilesStage = useCallback(
    (filePath?: string | null, notice?: "unsnapshotted") => {
      if (filePath === undefined && activeTab === "Files" && notice === undefined) {
        return;
      }

      requestFilesExit(() => {
        if (filePath !== undefined) {
          setSelectedFile(filePath ?? null);
        }
        setDetailIntent({ tab: "Files", notice });
      });
    },
    [activeTab, requestFilesExit],
  );

  const openVersionsStage = useCallback(
    (options?: Omit<SkillDetailVersionsIntent, "tab">) => {
      requestFilesExit(() => {
        setDetailIntent({
          tab: "Versions",
          section: options?.section ?? "detail",
          action: options?.action,
        });
        if (options?.action === "create_snapshot") {
          setOpenCreateSnapshotRequest((value) => value + 1);
        }
      });
    },
    [requestFilesExit],
  );

  const openOverviewStage = useCallback(() => {
    if (activeTab === "Overview") {
      return;
    }

    requestFilesExit(() => {
      setDetailIntent({ tab: "Overview" });
    });
  }, [activeTab, requestFilesExit]);
  const overviewModel = useMemo(
    () =>
      buildSkillOverviewModel({
        description: selectedSkill?.description ?? null,
        changeStatus,
        snapshots,
        teamCount: teams.length,
        fileTree: skillFileTree,
        platformReleaseOverview,
        teamDeliveryOverview,
        language: resolvedLanguage,
      }),
    [
      changeStatus,
      platformReleaseOverview,
      selectedSkill?.description,
      skillFileTree,
      snapshots,
      teamDeliveryOverview,
      teams.length,
    ],
  );

  const tabHints: Record<SkillDetailTab, { visible: boolean; tone: "active" | "neutral" | "ready" | "warning" }> = {
    Overview: {
      visible: overviewModel.attentionItems.length > 0,
      tone: overviewModel.attentionItems.some((item) => item.severity === "blocker") ? "warning" : "active",
    },
    Files: {
      visible: Boolean(changeStatus?.hasChanges),
      tone: changeStatus?.hasChanges ? "warning" : "ready",
    },
    Versions: {
      visible: snapshots.length === 0 || !activeSnapshot,
      tone: snapshots.length === 0 || !activeSnapshot ? "warning" : "active",
    },
  };

  useEffect(() => {
    if (!skillId) {
      return;
    }

    setDetailIntent({ tab: "Overview" });
    setSelectedFile(null);
    selectSkill(skillId);
    void loadSnapshots(skillId);
  }, [loadSnapshots, selectSkill, skillId]);

  useEffect(() => {
    const currentSkillId = selectedSkill?.id;
    if (!currentSkillId) {
      setPrimarySource(null);
      return;
    }
    const targetSkillId = currentSkillId;

    let cancelled = false;

    async function loadPrimarySource() {
      try {
        const sources = await listSkillSources(targetSkillId);
        if (!cancelled) {
          setPrimarySource(sources.find((item) => item.isPrimary) ?? sources[0] ?? null);
        }
      } catch {
        if (!cancelled) {
          setPrimarySource(null);
        }
      }
    }

    void loadPrimarySource();

    return () => {
      cancelled = true;
    };
  }, [selectedSkill?.id]);

  useEffect(() => {
    if (activeTab !== "Overview") {
      return;
    }

    if (!selectedSkill?.id) {
      setSkillFileTree(null);
      setPlatformReleaseOverview(null);
      setTeamDeliveryOverview(null);
      return;
    }

    const currentSkillId = selectedSkill.id;

    let cancelled = false;

    async function loadOverviewContext() {
      const [treeResult, releaseResult, deliveryResult] = await Promise.allSettled([
        listSkillFiles(currentSkillId),
        getSkillPlatformReleases(currentSkillId),
        getSkillTeamDeliveries(currentSkillId),
      ]);

      if (cancelled) {
        return;
      }

      setSkillFileTree(treeResult.status === "fulfilled" ? treeResult.value : null);
      setPlatformReleaseOverview(releaseResult.status === "fulfilled" ? releaseResult.value : null);
      setTeamDeliveryOverview(deliveryResult.status === "fulfilled" ? deliveryResult.value : null);
    }

    void loadOverviewContext();

    return () => {
      cancelled = true;
    };
  }, [activeTab, browseRefreshToken, selectedSkill?.id]);

  const handleOverviewAction = (action: SkillOverviewAction) => {
    if (action.type === "open_files") {
      openFilesStage(action.filePath ?? null);
      return;
    }

    if (action.type === "open_versions") {
      openVersionsStage({
        section: action.section,
        action: action.action,
      });
      return;
    }

    if (action.type === "open_settings") {
      navigate("/settings");
      return;
    }

    if (action.type === "open_teams") {
      navigate("/teams");
      return;
    }

    navigate("/teams");
  };

  const handleSaveAndContinue = async () => {
    if (!pendingFilesExit || !fileExplorerRef.current) {
      return;
    }

    setResolvingFilesExit(true);
    const didSave = await fileExplorerRef.current.saveChanges();
    setResolvingFilesExit(false);

    if (!didSave) {
      return;
    }

    const proceed = pendingFilesExit.proceed;
    setPendingFilesExit(null);
    proceed();
  };

  const handleDiscardAndContinue = () => {
    if (!pendingFilesExit) {
      return;
    }

    fileExplorerRef.current?.discardChanges();
    const proceed = pendingFilesExit.proceed;
    setPendingFilesExit(null);
    proceed();
  };

  const renderStage = () => {
    if (activeTab === "Overview") {
      return (
        <section aria-label={copy.stage} className="skill-detail-stage__panel skill-detail-stage__panel--overview">
          <SkillOverviewPanel skillId={selectedSkill?.id ?? skillId ?? ""} model={overviewModel} onAction={handleOverviewAction} />
        </section>
      );
    }

    if (activeTab === "Files") {
      return (
        <section aria-label={copy.stage} className="skill-detail-stage__panel">
          <FileExplorerPanel
            ref={fileExplorerRef}
            selectedFile={selectedFile}
            onFileSelect={setSelectedFile}
            browseRefreshToken={browseRefreshToken}
            onRequestNavigateAway={requestFilesExit}
            onOpenVersions={() => openVersionsStage({ section: "detail" })}
          />
        </section>
      );
    }

    return (
      <section aria-label={copy.stage} className="skill-detail-stage__panel">
        <VersionHistoryPanel
          navigationIntent={detailIntent.tab === "Versions" ? detailIntent : null}
          openCreateSnapshotRequest={openCreateSnapshotRequest}
          onOpenFiles={() => openFilesStage()}
          onOpenSettings={() => navigate("/settings")}
          onOpenTeams={() => navigate("/teams")}
        />
      </section>
    );
  };

  return (
    <div className="skill-detail-page">
      <SkillDetailHeader
        skill={selectedSkill}
        primarySource={primarySource}
        onBack={() => requestFilesExit(() => navigate("/workspace"))}
        onOpenFiles={() => openFilesStage()}
        onOpenVersions={() => openVersionsStage({ section: "detail" })}
        onOpenSettings={() => requestFilesExit(() => navigate("/settings"))}
      />

      <div className="skill-detail-shell">
        <div className="skill-detail-nav-shell">
          <div role="tablist" aria-label={copy.nav} className="skill-detail-nav">
            {detailTabs.map((tab) => {
              const TabIcon = tab.icon;

              return (
                <button
                  key={tab.key}
                  className="skill-detail-nav__tab"
                  aria-label={tab.label}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  onClick={() => {
                    if (tab.key === "Overview") {
                      openOverviewStage();
                      return;
                    }

                    if (tab.key === "Files") {
                      openFilesStage();
                      return;
                    }

                    openVersionsStage({ section: "detail" });
                  }}
                >
                  <span className="skill-detail-nav__tab-icon" aria-hidden="true">
                    <TabIcon size={15} />
                  </span>
                  <span className="skill-detail-nav__tab-copy">
                    <span className="skill-detail-nav__tab-label">{tab.label}</span>
                    {tabHints[tab.key].visible ? (
                      <span
                        aria-hidden="true"
                        className={`skill-detail-nav__tab-dot skill-detail-nav__tab-dot--${tabHints[tab.key].tone}`}
                      />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <section className={`skill-detail-canvas skill-detail-canvas--${activeTab.toLowerCase()}`}>
          <section className={`skill-detail-stage skill-detail-stage--${activeTab.toLowerCase()}`}>{renderStage()}</section>
        </section>
      </div>

      <Modal
        title={copy.unsavedTitle}
        open={pendingFilesExit !== null}
        onCancel={() => {
          if (!resolvingFilesExit) {
            setPendingFilesExit(null);
          }
        }}
        footer={[
          <Button key="cancel" onClick={() => setPendingFilesExit(null)} disabled={resolvingFilesExit}>
            {copy.cancel}
          </Button>,
          <Button key="discard" danger onClick={handleDiscardAndContinue} disabled={resolvingFilesExit}>
            {copy.discard}
          </Button>,
          <Button key="save" type="primary" loading={resolvingFilesExit} onClick={() => void handleSaveAndContinue()}>
            {copy.saveContinue}
          </Button>,
        ]}
      >
        <p>{copy.unsavedBody}</p>
      </Modal>
    </div>
  );
}
