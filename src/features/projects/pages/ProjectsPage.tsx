import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import App from "antd/es/app";
import Form from "antd/es/form";
import type { PlatformConnection, Skill, TestPlatformPathResult } from "@/types/skill";
import { listPlatformConnections } from "@/features/platforms/api/platformsApi";
import { listSkills } from "@/features/skills/api/skillsApi";
import { listSnapshots } from "@/features/snapshots/api/snapshotsApi";
import { useI18n } from "@/features/settings/state/I18nContext";
import {
  buildProjectSyncPlan,
  createProject,
  deleteProject,
  deleteProjectPlatformConnection,
  deleteProjectSkillAssignment,
  getProject,
  listProjects,
  rescanProject,
  saveProjectPlatformConnection,
  saveProjectSkillAssignment,
  syncProjectPlatform,
  testProjectPlatformPath,
  updateProject,
} from "../api/projectsApi";
import type {
  BindSkillDraft,
  ProjectDetail,
  ProjectPlatformConnection,
  ProjectSkillAssignment,
  ProjectSummary,
  ProjectSyncPlan,
} from "../model/projectTypes";
import type { BindSkillFormValues, PlatformFormValues, ProjectFormValues } from "../model/projectForms";
import {
  assignmentRuntimeStatus,
  defaultTargetDirName,
  getProjectPlatformGovernanceState,
  hasRuntimeIssue,
  isProjectSummary,
  joinDisplayPath,
  projectHasRisk,
} from "../model/projectPresentation";
import type { ProjectFilter, ProjectSort } from "../model/projectPresentation";
import { getProjectCopy } from "../model/projectCopy";
import {
  ActionImpactPreview,
  ProjectDetailView,
  ProjectsHomeView,
} from "../components/ProjectViews";
import {
  ProjectBindingModal,
  ProjectEditorModal,
  ProjectPlatformModal,
  ProjectSyncPlanModal,
} from "../components/ProjectModals";
import "../styles.css";


const PROJECT_CONFIRM_MODAL_PROPS = {
  centered: true,
  icon: null,
  className: "projects-confirm-modal",
} as const;

export function ProjectsPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const { resolvedLanguage } = useI18n();
  const copy = getProjectCopy(resolvedLanguage);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [detail, setDetail] = useState<ProjectDetail>();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [platforms, setPlatforms] = useState<PlatformConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("all");
  const [projectSort, setProjectSort] = useState<ProjectSort>("updated");
  const [activePlatformName, setActivePlatformName] = useState("all");
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string>();
  const [platformModalOpen, setPlatformModalOpen] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<ProjectPlatformConnection>();
  const [bindDraft, setBindDraft] = useState<BindSkillDraft>();
  const [testingProjectPlatformPath, setTestingProjectPlatformPath] = useState(false);
  const [platformPathTestResult, setPlatformPathTestResult] = useState<TestPlatformPathResult>();
  const [syncPlanState, setSyncPlanState] = useState<{
    connection: ProjectPlatformConnection;
    plan: ProjectSyncPlan;
  }>();
  const [confirmedSyncAssignmentIds, setConfirmedSyncAssignmentIds] = useState<string[]>([]);
  const [projectForm] = Form.useForm<ProjectFormValues>();
  const [platformForm] = Form.useForm<PlatformFormValues>();
  const [bindForm] = Form.useForm<BindSkillFormValues>();

  const isDetailMode = Boolean(projectId);
  const platformRegistryByName = new Map(platforms.map((platform) => [platform.platformName, platform]));
  const connectedProjectPlatformNames = new Set(detail?.platforms.map((platform) => platform.platformName) ?? []);
  const enabledProjectPlatforms = platforms.filter((platform) => platform.supportsProjectScope && platform.enabled);
  const projectPlatformOptions = enabledProjectPlatforms
    .filter((platform) => !connectedProjectPlatformNames.has(platform.platformName))
    .map((platform) => ({
      value: platform.platformName,
      label: platform.displayName ?? platform.platformName,
      platform,
    }));
  const createPlatformDisabledReason = enabledProjectPlatforms.length === 0
    ? copy.noAvailableProjectPlatforms
    : copy.noMoreProjectPlatforms;
  const platformSelectOptions = editingPlatform
    ? [
      {
        value: editingPlatform.platformName,
        label: editingPlatform.displayName ?? editingPlatform.platformName,
      },
      ...projectPlatformOptions,
    ]
    : projectPlatformOptions;

  async function loadInitialData(nextProjectId?: string) {
    setLoading(true);
    try {
      const [projectList, platformList, skillList] = await Promise.all([
        listProjects(),
        listPlatformConnections(),
        listSkills(),
      ]);
      setProjects(projectList);
      setPlatforms(platformList);
      setSkills(skillList.filter((skill) => !skill.isArchived));

      if (nextProjectId) {
        await loadProjectDetail(nextProjectId);
      } else {
        setDetail(undefined);
      }
    } catch (error) {
      message.error(`${copy.projects}: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadProjectDetail(nextProjectId: string) {
    setDetailLoading(true);
    try {
      const nextDetail = await getProject(nextProjectId);
      setDetail(nextDetail);
    } catch (error) {
      setDetail(undefined);
      message.error(`${copy.project}: ${String(error)}`);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadInitialData(projectId);
  }, [projectId]);

  useEffect(() => {
    if (!detail || activePlatformName === "all") {
      return;
    }
    if (!detail.platforms.some((platform) => platform.platformName === activePlatformName)) {
      setActivePlatformName("all");
    }
  }, [activePlatformName, detail]);

  function openCreateProject() {
    setEditingProjectId(undefined);
    projectForm.resetFields();
    setProjectModalOpen(true);
  }

  function openEditProject(project?: ProjectSummary) {
    const source = project ?? detail?.project;
    if (!source) {
      return;
    }
    setEditingProjectId(source.id);
    projectForm.setFieldsValue({
      name: source.name,
      rootPath: source.rootPath,
      description: source.description,
    });
    setProjectModalOpen(true);
  }

  async function handleSaveProject(values: ProjectFormValues) {
    try {
      const saved = editingProjectId
        ? await updateProject({ projectId: editingProjectId, ...values })
        : await createProject(values);
      setProjectModalOpen(false);
      projectForm.resetFields();
      setEditingProjectId(undefined);
      message.success(editingProjectId ? copy.projectUpdated : copy.projectAdded);
      if (!editingProjectId) {
        navigate(`/projects/${saved.id}`);
        return;
      }
      await loadInitialData(projectId);
    } catch (error) {
      message.error(`${copy.actionSave} ${copy.project}: ${String(error)}`);
    }
  }

  function handleDeleteProject(project: ProjectSummary | ProjectDetail["project"]) {
    const relatedDetail = detail?.project.id === project.id ? detail : undefined;
    const platformCount = relatedDetail
      ? relatedDetail.platforms.length
      : isProjectSummary(project)
        ? project.platformCount
        : 0;
    const assignmentCount = relatedDetail
      ? relatedDetail.assignments.length
      : isProjectSummary(project)
        ? project.assignmentCount
        : 0;
    modal.confirm({
      ...PROJECT_CONFIRM_MODAL_PROPS,
      title: `${copy.actionDelete} ${copy.project}「${project.name}」`,
      content: (
        <ActionImpactPreview
          items={[
            { label: copy.platform, value: `${platformCount}` },
            { label: copy.projectBinding, value: `${assignmentCount}` },
            { label: copy.executionResult, value: copy.projectRemoveImpact },
          ]}
          note={copy.projectRemoveNote}
        />
      ),
      okText: copy.actionDelete,
      okButtonProps: { danger: true },
      cancelText: copy.actionCancel,
      onOk: async () => {
        await deleteProject(project.id);
        message.success(copy.projectRemoved);
        if (projectId === project.id) {
          navigate("/projects");
          return;
        }
        await loadInitialData(projectId);
      },
    });
  }

  function openCreatePlatform() {
    if (projectPlatformOptions.length === 0) {
      message.warning(createPlatformDisabledReason);
      return;
    }
    setEditingPlatform(undefined);
    setPlatformPathTestResult(undefined);
    platformForm.resetFields();
    platformForm.setFieldsValue({ pathMode: "derived", syncMode: "copy", enabled: true });
    setPlatformModalOpen(true);
  }

  function openEditPlatform(connection: ProjectPlatformConnection) {
    setEditingPlatform(connection);
    setPlatformPathTestResult(undefined);
    platformForm.setFieldsValue({
      platformName: connection.platformName,
      pathMode: connection.pathMode === "custom" ? "custom" : "derived",
      relativeSkillsDir: connection.relativeSkillsDir,
      skillsDir: connection.skillsDir,
      syncMode: "copy",
      enabled: connection.enabled,
    });
    setPlatformModalOpen(true);
  }

  async function persistProjectPlatform(values: PlatformFormValues) {
    if (!detail) {
      return;
    }
    await saveProjectPlatformConnection({
      projectId: detail.project.id,
      platformName: editingPlatform?.platformName ?? values.platformName,
      pathMode: values.pathMode,
      relativeSkillsDir: values.relativeSkillsDir,
      skillsDir: values.skillsDir,
      syncMode: values.syncMode,
      enabled: values.enabled,
    });
    setPlatformModalOpen(false);
    setEditingPlatform(undefined);
    setPlatformPathTestResult(undefined);
    platformForm.resetFields();
    await loadInitialData(detail.project.id);
    message.success(editingPlatform ? copy.projectPlatformUpdated : copy.projectPlatformConnected);
  }

  async function handleSavePlatform(values: PlatformFormValues) {
    if (!detail) {
      return;
    }
    const currentPlatformName = editingPlatform?.platformName ?? values.platformName;
    const currentAssignments = detail.assignments.filter(
      (assignment) => assignment.platformName === currentPlatformName,
    );
    const performSave = async () => {
      try {
        await persistProjectPlatform(values);
      } catch (error) {
        message.error(`${copy.actionSave} ${copy.platform}: ${String(error)}`);
      }
    };

    if (editingPlatform?.enabled && !values.enabled) {
      modal.confirm({
        ...PROJECT_CONFIRM_MODAL_PROPS,
        title: `${copy.actionDisable} ${copy.platform}「${editingPlatform.displayName ?? editingPlatform.platformName}」`,
        content: (
          <ActionImpactPreview
            items={[
              { label: copy.affectedBindings, value: `${currentAssignments.length}` },
              { label: copy.platformDirectory, value: <code>{editingPlatform.skillsDir}</code> },
              { label: copy.executionResult, value: copy.disablePlatformImpact },
            ]}
            note={copy.disablePlatformNote}
          />
        ),
        okText: copy.actionDisable,
        okButtonProps: { danger: true },
        cancelText: copy.actionCancel,
        onOk: performSave,
      });
      return;
    }

    await performSave();
  }

  function handleDeletePlatform(connection: ProjectPlatformConnection) {
    if (!detail) {
      return;
    }
    const assignmentCount = detail.assignments.filter(
      (assignment) => assignment.platformName === connection.platformName,
    ).length;
    modal.confirm({
      ...PROJECT_CONFIRM_MODAL_PROPS,
      title: `${copy.actionDelete} ${copy.platform}「${connection.displayName ?? connection.platformName}」`,
      content: (
        <ActionImpactPreview
          items={[
            { label: copy.affectedBindings, value: `${assignmentCount}` },
            { label: copy.platformDirectory, value: <code>{connection.skillsDir}</code> },
            { label: copy.executionResult, value: copy.removePlatformImpact },
          ]}
          note={copy.removePlatformNote}
        />
      ),
      okText: copy.actionDelete,
      okButtonProps: { danger: true },
      cancelText: copy.actionCancel,
      onOk: async () => {
        await deleteProjectPlatformConnection(detail.project.id, connection.platformName);
        setActivePlatformName("all");
        await loadInitialData(detail.project.id);
        message.success(copy.projectPlatformRemoved);
      },
    });
  }

  async function handleSkillChange(skillId: string) {
    const skill = skills.find((item) => item.id === skillId);
    bindForm.setFieldsValue({ targetDirName: defaultTargetDirName(skill), snapshotId: undefined });
    const snapshots = await listSnapshots(skillId);
    const defaultSnapshot =
      snapshots.find((snapshot) => snapshot.isActive)
      ?? snapshots.find((snapshot) => snapshot.isCurrent)
      ?? snapshots[0];
    setBindDraft((prev) =>
      prev ? { ...prev, skillId, snapshots, snapshotId: defaultSnapshot?.id } : prev,
    );
    bindForm.setFieldsValue({ snapshotId: defaultSnapshot?.id });
  }

  function openBindSkill(connection: ProjectPlatformConnection) {
    bindForm.resetFields();
    bindForm.setFieldsValue({ enabled: true });
    setBindDraft({
      platformName: connection.platformName,
      skillId: "",
      snapshots: [],
    });
  }

  async function openEditAssignment(assignment: ProjectSkillAssignment) {
    bindForm.resetFields();
    bindForm.setFieldsValue({
      skillId: assignment.skillId,
      snapshotId: assignment.snapshotId,
      targetDirName: assignment.targetDirName,
      enabled: assignment.enabled,
    });
    setBindDraft({
      platformName: assignment.platformName,
      assignmentId: assignment.id,
      skillId: assignment.skillId,
      snapshotId: assignment.snapshotId,
      targetDirName: assignment.targetDirName,
      snapshots: [],
    });
    const snapshots = await listSnapshots(assignment.skillId);
    setBindDraft((prev) => (prev ? { ...prev, snapshots } : prev));
  }

  async function handleBindSkill(values: BindSkillFormValues) {
    if (!detail || !bindDraft) {
      return;
    }
    try {
      await saveProjectSkillAssignment({
        projectId: detail.project.id,
        platformName: bindDraft.platformName,
        skillId: values.skillId || bindDraft.skillId,
        snapshotId: values.snapshotId,
        targetDirName: values.targetDirName,
        enabled: values.enabled,
      });
      setBindDraft(undefined);
      bindForm.resetFields();
      await loadInitialData(detail.project.id);
      message.success(bindDraft.assignmentId ? copy.assignmentUpdated : copy.assignmentMounted);
    } catch (error) {
      message.error(`${copy.actionSave} ${copy.projectBinding}: ${String(error)}`);
    }
  }

  async function handleToggleAssignment(assignment: ProjectSkillAssignment) {
    if (!detail) {
      return;
    }
    const platformConnection = detail.platforms.find(
      (connection) => connection.platformName === assignment.platformName,
    );
    if (!platformConnection) {
      return;
    }
    const governanceState = getProjectPlatformGovernanceState(
      platformConnection,
      platformRegistryByName.get(assignment.platformName),
      resolvedLanguage,
    );
    if (governanceState.readOnly) {
      message.warning(governanceState.reason ?? copy.bindingCanOnlyRemove);
      return;
    }
    const performToggle = async () => {
      try {
        await saveProjectSkillAssignment({
          projectId: detail.project.id,
          platformName: assignment.platformName,
          skillId: assignment.skillId,
          snapshotId: assignment.snapshotId,
          targetDirName: assignment.targetDirName,
          enabled: !assignment.enabled,
        });
        await loadInitialData(detail.project.id);
        message.success(assignment.enabled ? copy.assignmentDisabled : copy.assignmentEnabled);
      } catch (error) {
        message.error(`${copy.projectBinding}: ${String(error)}`);
      }
    };

    if (assignment.enabled) {
      modal.confirm({
        ...PROJECT_CONFIRM_MODAL_PROPS,
        title: `${copy.actionDisable} ${copy.projectBinding}「${assignment.skillName}」`,
        content: (
          <ActionImpactPreview
            items={[
              { label: copy.ownerPlatform, value: assignment.platformDisplayName ?? assignment.platformName },
              {
                label: copy.managedPath,
                value: platformConnection
                  ? <code>{joinDisplayPath(platformConnection.skillsDir, assignment.targetDirName)}</code>
                  : assignment.targetDirName,
              },
              { label: copy.executionResult, value: copy.disableAssignmentImpact },
            ]}
            note={copy.disableAssignmentNote}
          />
        ),
        okText: copy.actionDisable,
        okButtonProps: { danger: true },
        cancelText: copy.actionCancel,
        onOk: performToggle,
      });
      return;
    }

    await performToggle();
  }

  function handleDeleteAssignment(assignment: ProjectSkillAssignment) {
    if (!detail) {
      return;
    }
    const platformConnection = detail.platforms.find(
      (connection) => connection.platformName === assignment.platformName,
    );
    modal.confirm({
      ...PROJECT_CONFIRM_MODAL_PROPS,
      title: `${copy.actionDelete} ${copy.projectBinding}「${assignment.skillName}」`,
      content: (
        <ActionImpactPreview
          items={[
            { label: copy.ownerPlatform, value: assignment.platformDisplayName ?? assignment.platformName },
            {
              label: copy.managedPath,
              value: platformConnection
                ? <code>{joinDisplayPath(platformConnection.skillsDir, assignment.targetDirName)}</code>
                : assignment.targetDirName,
            },
            { label: copy.executionResult, value: copy.removeAssignmentImpact },
          ]}
          note={copy.removeAssignmentNote}
        />
      ),
      okText: copy.actionDelete,
      okButtonProps: { danger: true },
      cancelText: copy.actionCancel,
      onOk: async () => {
        await deleteProjectSkillAssignment(assignment.id);
        await loadInitialData(detail.project.id);
        message.success(copy.assignmentRemoved);
      },
    });
  }

  async function handleRescanProject(nextProjectId?: string) {
    const targetProjectId = nextProjectId ?? detail?.project.id;
    if (!targetProjectId) {
      return;
    }
    try {
      const nextDetail = await rescanProject(targetProjectId);
      if (projectId === targetProjectId) {
        setDetail(nextDetail);
      }
      await loadInitialData(projectId);
      message.success(copy.projectStatusRescanned);
    } catch (error) {
      message.error(`${copy.rescanProjectStatus}: ${String(error)}`);
    }
  }

  async function openSyncPlan(connection: ProjectPlatformConnection) {
    if (!detail) {
      return;
    }
    const governanceState = getProjectPlatformGovernanceState(
      connection,
      platformRegistryByName.get(connection.platformName),
      resolvedLanguage,
    );
    if (governanceState.syncBlocked) {
      message.warning(governanceState.syncReason ?? governanceState.reason ?? copy.syncBlocked);
      return;
    }
    try {
      const plan = await buildProjectSyncPlan(detail.project.id, connection.platformName);
      setConfirmedSyncAssignmentIds([]);
      setSyncPlanState({ connection, plan });
    } catch (error) {
      message.error(`${copy.syncPlan}: ${String(error)}`);
    }
  }

  async function executeSyncPlan() {
    if (!detail || !syncPlanState) {
      return;
    }
    try {
      const result = await syncProjectPlatform({
        projectId: detail.project.id,
        platformName: syncPlanState.connection.platformName,
        confirmedAssignmentIds: confirmedSyncAssignmentIds,
      });
      setSyncPlanState(undefined);
      setConfirmedSyncAssignmentIds([]);
      await loadInitialData(detail.project.id);
      message.success(copy.syncFinished(result.syncedCount, result.skippedCount));
    } catch (error) {
      message.error(`${copy.syncRun}: ${String(error)}`);
    }
  }

  function handleToggleSyncConfirmation(assignmentId: string, checked: boolean) {
    setConfirmedSyncAssignmentIds((current) => {
      if (checked) {
        return current.includes(assignmentId) ? current : [...current, assignmentId];
      }
      return current.filter((item) => item !== assignmentId);
    });
  }

  async function handleTestProjectPlatformPath() {
    if (!detail) {
      return;
    }
    const platformName = editingPlatform?.platformName ?? platformForm.getFieldValue("platformName");
    const pathMode = platformForm.getFieldValue("pathMode") ?? "derived";
    const relativeSkillsDir = platformForm.getFieldValue("relativeSkillsDir")?.trim();
    const skillsDir = platformForm.getFieldValue("skillsDir")?.trim();

    if (!platformName) {
      message.warning(copy.selectPlatform);
      return;
    }
    if (pathMode === "custom" && !skillsDir) {
      message.warning(copy.selectProjectDirectory);
      return;
    }

    setTestingProjectPlatformPath(true);
    try {
      const result = await testProjectPlatformPath({
        projectId: detail.project.id,
        platformName,
        pathMode,
        relativeSkillsDir,
        skillsDir,
      });
      setPlatformPathTestResult(result);
    } catch (error) {
      message.error(`${copy.actionTestPath}: ${String(error)}`);
    } finally {
      setTestingProjectPlatformPath(false);
    }
  }

  const selectedPlatformMode = Form.useWatch("pathMode", platformForm) ?? "derived";
  const selectedPlatformName = Form.useWatch("platformName", platformForm);
  const selectedRelativeSkillsDir = Form.useWatch("relativeSkillsDir", platformForm);
  const selectedSkillsDir = Form.useWatch("skillsDir", platformForm);
  const selectedPlatform = platforms.find((platform) => platform.platformName === selectedPlatformName);
  const searchText = projectSearch.trim().toLowerCase();
  const projectStats = {
    total: projects.length,
    risk: projects.filter(projectHasRisk).length,
    ready: projects.filter((project) => project.status === "ready" && project.driftCount === 0).length,
  };
  const filteredProjects = [...projects]
    .filter((project) => {
      const matchedSearch =
        !searchText
        || project.name.toLowerCase().includes(searchText)
        || project.rootPath.toLowerCase().includes(searchText);
      if (!matchedSearch) {
        return false;
      }
      if (projectFilter === "risk") {
        return projectHasRisk(project);
      }
      if (projectFilter === "ready") {
        return project.status === "ready" && project.driftCount === 0;
      }
      return true;
    })
    .sort((a, b) => {
      if (projectSort === "risk") {
        return Number(projectHasRisk(b)) - Number(projectHasRisk(a)) || b.updatedAt - a.updatedAt;
      }
      if (projectSort === "name") {
        return a.name.localeCompare(b.name, "zh-CN");
      }
      return b.updatedAt - a.updatedAt;
    });
  const visiblePlatforms = detail
    ? detail.platforms.filter(
      (platform) => activePlatformName === "all" || platform.platformName === activePlatformName,
    )
    : [];
  const visibleLogs = detail
    ? detail.recentLogs.filter(
      (log) => activePlatformName === "all" || log.platformName === activePlatformName,
    )
    : [];
  const issueAssignments = detail
    ? detail.assignments.filter((assignment) => hasRuntimeIssue(assignmentRuntimeStatus(assignment)))
    : [];
  const platformGovernanceStates = detail
    ? detail.platforms.map((platform) => ({
      platform,
      state: getProjectPlatformGovernanceState(
        platform,
        platformRegistryByName.get(platform.platformName),
        resolvedLanguage,
      ),
    }))
    : [];
  const platformGovernanceIssues = platformGovernanceStates.filter(({ state }) => state.readOnly);
  const platformPausedStates = platformGovernanceStates.filter(
    ({ state }) => state.mode === "project_paused",
  );
  const alignedAssignments = detail
    ? detail.assignments.filter((assignment) =>
      ["in_sync", "in_sync_unverified"].includes(assignmentRuntimeStatus(assignment)),
    ).length
    : 0;
  const enabledAssignments = detail
    ? detail.assignments.filter((assignment) => assignment.enabled).length
    : 0;
  const latestSyncAt = detail
    ? Math.max(0, ...detail.platforms.map((platform) => platform.lastSyncAt ?? 0))
    : 0;
  const syncPlanRecords = syncPlanState?.plan.records ?? [];
  const confirmedSyncAssignmentIdSet = new Set(confirmedSyncAssignmentIds);
  const readyRecords = syncPlanRecords.filter(
    (record) => record.status === "ready" && !record.requiresUserConfirmation,
  );
  const skippedRecords = syncPlanRecords.filter((record) => record.status === "skipped");
  const confirmationRecords = syncPlanRecords.filter((record) => record.requiresUserConfirmation);
  const confirmedRecords = confirmationRecords.filter((record) =>
    confirmedSyncAssignmentIdSet.has(record.assignmentId),
  );
  const pendingConfirmationRecords = confirmationRecords.filter(
    (record) => !confirmedSyncAssignmentIdSet.has(record.assignmentId),
  );
  const blockedRecords = syncPlanRecords.filter(
    (record) => record.status === "blocked" && !record.requiresUserConfirmation,
  );
  const executableRecordCount = readyRecords.length + confirmedRecords.length;
  const syncPlanCanExecute = blockedRecords.length === 0 && executableRecordCount > 0;

  useEffect(() => {
    if (!platformModalOpen) {
      setPlatformPathTestResult(undefined);
      return;
    }
    setPlatformPathTestResult(undefined);
  }, [
    platformModalOpen,
    selectedPlatformMode,
    selectedPlatformName,
    selectedRelativeSkillsDir,
    selectedSkillsDir,
  ]);

  return (
    <div className="projects-page">
      {isDetailMode ? (
        <ProjectDetailView
          copy={copy}
          detail={detail}
          detailLoading={detailLoading || loading}
          activePlatformName={activePlatformName}
          setActivePlatformName={setActivePlatformName}
          visiblePlatforms={visiblePlatforms}
          visibleLogs={visibleLogs}
          issueAssignments={issueAssignments}
          platformRegistryByName={platformRegistryByName}
          platformReadOnlyCount={platformGovernanceIssues.length}
          platformPausedCount={platformPausedStates.length}
          alignedAssignments={alignedAssignments}
          enabledAssignments={enabledAssignments}
          latestSyncAt={latestSyncAt}
          onBack={() => navigate("/projects")}
          canCreatePlatform={projectPlatformOptions.length > 0}
          createPlatformDisabledReason={createPlatformDisabledReason}
          onCreatePlatform={openCreatePlatform}
          onEditProject={() => openEditProject()}
          onDeleteProject={() => detail && handleDeleteProject(detail.project)}
          onRescanProject={() => void handleRescanProject()}
          onBindSkill={openBindSkill}
          onEditPlatform={openEditPlatform}
          onDeletePlatform={handleDeletePlatform}
          onSyncPlatform={(connection) => void openSyncPlan(connection)}
          onEditAssignment={(assignment) => void openEditAssignment(assignment)}
          onToggleAssignment={(assignment) => void handleToggleAssignment(assignment)}
          onDeleteAssignment={handleDeleteAssignment}
        />
      ) : (
        <ProjectsHomeView
          copy={copy}
          loading={loading}
          projects={filteredProjects}
          stats={projectStats}
          search={projectSearch}
          filter={projectFilter}
          sort={projectSort}
          onSearchChange={setProjectSearch}
          onFilterChange={setProjectFilter}
          onSortChange={setProjectSort}
          onCreateProject={openCreateProject}
          onOpenProject={(project) => navigate(`/projects/${project.id}`)}
          onEditProject={openEditProject}
          onDeleteProject={handleDeleteProject}
          onRescanProject={(nextProjectId) => void handleRescanProject(nextProjectId)}
        />
      )}

      <ProjectEditorModal
        copy={copy}
        form={projectForm}
        open={projectModalOpen}
        editingProjectId={editingProjectId}
        onCancel={() => {
          setProjectModalOpen(false);
          setEditingProjectId(undefined);
        }}
        onFinish={handleSaveProject}
      />

      <ProjectPlatformModal
        copy={copy}
        form={platformForm}
        open={platformModalOpen}
        editingPlatform={editingPlatform}
        platformSelectOptions={platformSelectOptions}
        selectedPlatformMode={selectedPlatformMode}
        selectedPlatform={selectedPlatform}
        selectedPlatformName={selectedPlatformName}
        projectPlatformOptionsCount={projectPlatformOptions.length}
        testingProjectPlatformPath={testingProjectPlatformPath}
        platformPathTestResult={platformPathTestResult}
        onCancel={() => {
          setPlatformModalOpen(false);
          setEditingPlatform(undefined);
          setPlatformPathTestResult(undefined);
        }}
        onFinish={handleSavePlatform}
        onTestPath={() => void handleTestProjectPlatformPath()}
      />

      <ProjectBindingModal
        copy={copy}
        form={bindForm}
        bindDraft={bindDraft}
        skills={skills}
        onCancel={() => setBindDraft(undefined)}
        onFinish={handleBindSkill}
        onSkillChange={(value) => void handleSkillChange(value)}
      />

      <ProjectSyncPlanModal
        copy={copy}
        open={Boolean(syncPlanState)}
        titleSuffix={syncPlanState?.connection.displayName ?? syncPlanState?.connection.platformName ?? ""}
        canExecute={syncPlanCanExecute}
        syncPlanRecords={syncPlanRecords}
        executableRecordCount={executableRecordCount}
        skippedRecords={skippedRecords}
        pendingConfirmationRecords={pendingConfirmationRecords}
        readyRecords={readyRecords}
        confirmationRecords={confirmationRecords}
        blockedRecords={blockedRecords}
        confirmedSyncAssignmentIds={confirmedSyncAssignmentIds}
        onCancel={() => {
          setSyncPlanState(undefined);
          setConfirmedSyncAssignmentIds([]);
        }}
        onExecute={() => executeSyncPlan()}
        onToggleSelection={handleToggleSyncConfirmation}
      />
    </div>
  );
}
