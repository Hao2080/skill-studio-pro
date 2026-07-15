import { type KeyboardEvent, type ReactNode } from "react";
import Button from "antd/es/button";
import Checkbox from "antd/es/checkbox";
import Empty from "antd/es/empty";
import Input from "antd/es/input";
import Segmented from "antd/es/segmented";
import Select from "antd/es/select";
import Space from "antd/es/space";
import Spin from "antd/es/spin";
import Tag from "antd/es/tag";
import Tooltip from "antd/es/tooltip";
import Typography from "antd/es/typography";
import {
  Activity,
  ArrowLeft,
  Boxes,
  Braces,
  Cable,
  CheckCircle2,
  Clock3,
  FolderPlus,
  GitBranch,
  Layers3,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import type { PlatformConnection, TestPlatformPathResult } from "@/types/skill";
import type {
  ProjectDetail,
  ProjectPlatformConnection,
  ProjectSkillAssignment,
  ProjectSummary,
  ProjectSyncPlanRecord,
} from "../model/projectTypes";
import {
  actionLabel,
  assignmentRuntimeStatus,
  buildSyncPlanMessage,
  formatDate,
  getProjectPlatformGovernanceState,
  hasRuntimeIssue,
  pathModeLabel,
  projectHasRisk,
  statusLabel,
  statusTone,
  syncModeLabel,
} from "../model/projectPresentation";
import type { ProjectFilter, ProjectPlatformGovernanceState, ProjectSort } from "../model/projectPresentation";
import type { ProjectCopy } from "../model/projectCopy";

const { Text, Title } = Typography;

interface ImpactItem {
  label: string;
  value: ReactNode;
}

export function ProjectsHomeView({
  copy,
  loading,
  projects,
  stats,
  search,
  filter,
  sort,
  onSearchChange,
  onFilterChange,
  onSortChange,
  onCreateProject,
  onOpenProject,
  onEditProject,
  onDeleteProject,
  onRescanProject,
}: {
  copy: ProjectCopy;
  loading: boolean;
  projects: ProjectSummary[];
  stats: { total: number; risk: number; ready: number };
  search: string;
  filter: ProjectFilter;
  sort: ProjectSort;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: ProjectFilter) => void;
  onSortChange: (value: ProjectSort) => void;
  onCreateProject: () => void;
  onOpenProject: (project: ProjectSummary) => void;
  onEditProject: (project: ProjectSummary) => void;
  onDeleteProject: (project: ProjectSummary) => void;
  onRescanProject: (projectId: string) => void;
}) {
  return (
    <main className="projects-home">
      <section className="projects-home__header">
        <div>
          <Title level={1}>{copy.projects}</Title>
          <Text className="projects-home__summary">
            {stats.total} {copy.projects} · {stats.ready} {copy.filterReady} · {stats.risk} {copy.filterRisk}
          </Text>
        </div>
        <Button className="projects-button projects-button--primary" icon={<FolderPlus size={15} />} onClick={onCreateProject}>
          {copy.actionCreateProject}
        </Button>
      </section>

      <section className="projects-home__controls">
        <Input
          allowClear
          prefix={<Search size={14} />}
          placeholder={copy.searchPlaceholder}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        <Segmented
          value={filter}
          onChange={(value) => onFilterChange(value as ProjectFilter)}
          options={[
            { label: `${copy.all} ${stats.total}`, value: "all" },
            { label: `${copy.filterRisk} ${stats.risk}`, value: "risk" },
            { label: `${copy.filterReady} ${stats.ready}`, value: "ready" },
          ]}
        />
        <Select
          value={sort}
          onChange={(value) => onSortChange(value)}
          suffixIcon={<SlidersHorizontal size={14} />}
          options={[
            { value: "updated", label: copy.latestUpdated },
            { value: "risk", label: copy.readyFirst },
            { value: "name", label: copy.sortByName },
          ]}
        />
      </section>

      <section className="projects-gallery">
        <div className="projects-gallery__header">
          <Title level={4}>{copy.projects}</Title>
          <Text>{projects.length} / {stats.total}</Text>
        </div>
        <div className="projects-gallery__body">
          {loading ? (
            <div className="projects-gallery__loading"><Spin /></div>
          ) : projects.length === 0 ? (
            <div className="projects-gallery__empty">
              <Empty description={copy.emptyProjects} />
            </div>
          ) : (
            <div className="projects-grid">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  copy={copy}
                  onOpen={() => onOpenProject(project)}
                  onEdit={() => onEditProject(project)}
                  onDelete={() => onDeleteProject(project)}
                  onRescan={() => onRescanProject(project.id)}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function ProjectCard({
  copy,
  project,
  onOpen,
  onEdit,
  onDelete,
  onRescan,
}: {
  copy: ProjectCopy;
  project: ProjectSummary;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRescan: () => void;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  }

  const risk = projectHasRisk(project);
  return (
    <article
      className={`project-tile${risk ? " has-risk" : ""}`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
    >
      <div className="project-tile__top">
        <StatusChip tone={statusTone(project.status)}>{statusLabel(project.status, copy.language)}</StatusChip>
        <span>{formatDate(project.updatedAt, copy.language)}</span>
      </div>
      <h3>{project.name}</h3>
      {project.description ? <p className="project-tile__description">{project.description}</p> : null}
      <p className="project-tile__path">{project.rootPath}</p>
      <div className="project-tile__metrics">
        <span>{project.platformCount} {copy.platform}</span>
        <span>{project.assignmentCount} {copy.projectBinding}</span>
        <span>{project.driftCount} {copy.filterRisk}</span>
      </div>
      <div className="project-tile__footer">
        <StatusChip tone={project.lastSyncStatus ? statusTone(project.lastSyncStatus) : "neutral"}>
          {project.lastSyncStatus ? statusLabel(project.lastSyncStatus, copy.language) : copy.notSynced}
        </StatusChip>
        <Space size={4} onClick={(event) => event.stopPropagation()}>
          <Button className="projects-icon-action" size="small" type="text" title={copy.rescanProjectStatus} aria-label={copy.rescanProjectStatus} icon={<RefreshCw size={13} />} onClick={onRescan} />
          <Button className="projects-icon-action" size="small" type="text" title={copy.editProject} aria-label={copy.editProject} icon={<Pencil size={13} />} onClick={onEdit} />
          <Button className="projects-icon-action" size="small" type="text" danger title={copy.actionDelete} aria-label={copy.actionDelete} icon={<Trash2 size={13} />} onClick={onDelete} />
        </Space>
      </div>
    </article>
  );
}

export function ProjectDetailView({
  copy,
  detail,
  detailLoading,
  activePlatformName,
  setActivePlatformName,
  visiblePlatforms,
  visibleLogs,
  issueAssignments,
  platformRegistryByName,
  platformReadOnlyCount,
  platformPausedCount,
  alignedAssignments,
  enabledAssignments,
  latestSyncAt,
  onBack,
  canCreatePlatform,
  createPlatformDisabledReason,
  onCreatePlatform,
  onEditProject,
  onDeleteProject,
  onRescanProject,
  onBindSkill,
  onEditPlatform,
  onDeletePlatform,
  onSyncPlatform,
  onEditAssignment,
  onToggleAssignment,
  onDeleteAssignment,
}: {
  copy: ProjectCopy;
  detail?: ProjectDetail;
  detailLoading: boolean;
  activePlatformName: string;
  setActivePlatformName: (value: string) => void;
  visiblePlatforms: ProjectPlatformConnection[];
  visibleLogs: ProjectDetail["recentLogs"];
  issueAssignments: ProjectSkillAssignment[];
  platformRegistryByName: Map<string, PlatformConnection>;
  platformReadOnlyCount: number;
  platformPausedCount: number;
  alignedAssignments: number;
  enabledAssignments: number;
  latestSyncAt: number;
  onBack: () => void;
  canCreatePlatform: boolean;
  createPlatformDisabledReason: string;
  onCreatePlatform: () => void;
  onEditProject: () => void;
  onDeleteProject: () => void;
  onRescanProject: () => void;
  onBindSkill: (connection: ProjectPlatformConnection) => void;
  onEditPlatform: (connection: ProjectPlatformConnection) => void;
  onDeletePlatform: (connection: ProjectPlatformConnection) => void;
  onSyncPlatform: (connection: ProjectPlatformConnection) => void;
  onEditAssignment: (assignment: ProjectSkillAssignment) => void;
  onToggleAssignment: (assignment: ProjectSkillAssignment) => void;
  onDeleteAssignment: (assignment: ProjectSkillAssignment) => void;
}) {
  if (detailLoading) {
    return <div className="projects-main__loading"><Spin /></div>;
  }

  if (!detail) {
    return (
      <div className="projects-empty">
        <Boxes size={38} />
        <Title level={3}>{copy.projectNotFound}</Title>
        <Button icon={<ArrowLeft size={14} />} onClick={onBack}>{copy.projects}</Button>
      </div>
    );
  }

  return (
    <main className="project-detail">
      <section className="project-detail__hero">
        <div className="project-detail__commandbar">
          <div className="project-detail__nav">
            <Button type="link" className="project-detail__back" icon={<ArrowLeft size={14} />} onClick={onBack}>{copy.projects}</Button>
          </div>
        </div>

        <div className="project-detail__summary">
          <div className="project-detail__identity">
            <Title level={1}>{detail.project.name}</Title>
            <Text className="projects-path">{detail.project.rootPath}</Text>
            <div className="project-detail__meta">
              <StatusChip tone={statusTone(detail.project.status)}>{statusLabel(detail.project.status, copy.language)}</StatusChip>
              <span className="project-detail__meta-item">
                <Clock3 size={13} />
                {copy.actionSync} {formatDate(latestSyncAt || undefined, copy.language)}
              </span>
              <span className="project-detail__meta-item">
                <Activity size={13} />
                {copy.rescan} {detail.project.lastScannedAt ? formatDate(detail.project.lastScannedAt, copy.language) : copy.notScanned}
              </span>
            </div>
            {detail.project.description ? (
              <Text className="project-detail__description">{detail.project.description}</Text>
            ) : null}
          </div>
          <div className="project-detail__actions">
            <Tooltip title={copy.rescanProjectStatus}>
              <Button className="projects-button projects-button--secondary" icon={<RefreshCw size={14} />} onClick={onRescanProject}>{copy.rescan}</Button>
            </Tooltip>
            <Button className="projects-button projects-button--secondary" icon={<Pencil size={14} />} onClick={onEditProject}>{copy.actionEdit}</Button>
            <Button className="projects-button projects-button--danger" danger icon={<Trash2 size={14} />} onClick={onDeleteProject}>{copy.actionDelete}</Button>
          </div>
        </div>
      </section>

      <section className="project-detail__metrics">
        <Metric icon={<Cable size={16} />} label={copy.platform} value={detail.platforms.length} />
        <Metric icon={<Layers3 size={16} />} label={copy.projectBindings} value={enabledAssignments} />
        <Metric icon={<CheckCircle2 size={16} />} label={copy.filterReady} value={alignedAssignments} />
        <Metric
          icon={<ShieldAlert size={16} />}
          label={copy.filterRisk}
          value={issueAssignments.length + platformReadOnlyCount + platformPausedCount}
        />
      </section>

      <section className="project-detail__toolbar">
        <Segmented
          className="projects-platform-tabs"
          value={activePlatformName}
          onChange={(value) => setActivePlatformName(String(value))}
          options={[
            { label: `${copy.all} ${detail.platforms.length}`, value: "all" },
            ...detail.platforms.map((platform) => ({
              label: platform.displayName ?? platform.platformName,
              value: platform.platformName,
            })),
          ]}
        />
        <div className="project-detail__toolbar-actions">
          <Text>{visiblePlatforms.length} {copy.platform} · {detail.assignments.length} {copy.projectBinding}</Text>
          {canCreatePlatform ? (
            <Button className="projects-button projects-button--secondary" icon={<Plus size={15} />} onClick={onCreatePlatform}>{copy.addProjectPlatform}</Button>
          ) : (
            <Tooltip title={createPlatformDisabledReason}>
              <span className="project-detail__toolbar-button-wrap">
                <Button className="projects-button projects-button--secondary" icon={<Plus size={15} />} disabled>
                  {copy.addProjectPlatform}
                </Button>
              </span>
            </Tooltip>
          )}
        </div>
      </section>

      {platformReadOnlyCount > 0 || platformPausedCount > 0 ? (
        <section className="project-detail__noticebar">
          {platformReadOnlyCount > 0 ? (
            <span className="project-detail__noticechip project-detail__noticechip--warning">
              {copy.platformBlockedByCenter} {platformReadOnlyCount}
            </span>
          ) : null}
          {platformPausedCount > 0 ? (
            <span className="project-detail__noticechip project-detail__noticechip--neutral">
              {copy.platformPausedInProject} {platformPausedCount}
            </span>
          ) : null}
          <Text>
            {platformReadOnlyCount > 0
              ? (copy.platformBlockedByCenter)
              : (copy.platformPausedInProject)}
          </Text>
        </section>
      ) : null}

      <div className="project-detail__workspace">
        <section className="project-board">
          <div className="project-board__header">
            <Title level={4}>{copy.projectBindings}</Title>
            <Text>{visiblePlatforms.length} {copy.platform} · {detail.assignments.length} {copy.projectBinding}</Text>
          </div>
          <div className="project-board__body">
            {detail.platforms.length === 0 ? (
              <Empty description={copy.emptyPlatforms} />
            ) : (
              <div className="projects-platform-stack">
              {visiblePlatforms.map((connection) => {
                const assignments = detail.assignments.filter(
                  (assignment) => assignment.platformName === connection.platformName,
                );
                const governanceState = getProjectPlatformGovernanceState(
                  connection,
                  platformRegistryByName.get(connection.platformName),
                  copy.language,
                );
                const platformIssues = assignments.filter((assignment) =>
                  hasRuntimeIssue(assignmentRuntimeStatus(assignment)),
                );
                return (
                  <PlatformSection
                    key={connection.id}
                    connection={connection}
                    assignments={assignments}
                    issueCount={platformIssues.length + Number(governanceState.mode !== "active")}
                    governanceState={governanceState}
                    copy={copy}
                    onBindSkill={() => onBindSkill(connection)}
                    onEditPlatform={() => onEditPlatform(connection)}
                    onDeletePlatform={() => onDeletePlatform(connection)}
                      onSyncPlatform={() => onSyncPlatform(connection)}
                      onEditAssignment={onEditAssignment}
                      onToggleAssignment={onToggleAssignment}
                      onDeleteAssignment={onDeleteAssignment}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="project-detail__side">
          <section className="project-detail__panel">
            <div className="project-board__header">
              <Title level={4}>{copy.overview}</Title>
              <Text>{formatDate(detail.project.updatedAt, copy.language)}</Text>
            </div>
            <div className="project-detail__facts">
              <div className="project-detail__fact project-detail__fact--path">
                <span>{copy.rootDirectory}</span>
                <code>{detail.project.rootPath}</code>
              </div>
              <div className="project-detail__fact">
                <span>{copy.rescan}</span>
                <strong>{detail.project.lastScannedAt ? formatDate(detail.project.lastScannedAt, copy.language) : copy.notScanned}</strong>
              </div>
              <div className="project-detail__fact">
                <span>{copy.updated}</span>
                <strong>{formatDate(detail.project.updatedAt, copy.language)}</strong>
              </div>
              <div className="project-detail__fact">
                <span>{copy.actionSync}</span>
                <strong>{formatDate(latestSyncAt || undefined, copy.language)}</strong>
              </div>
            </div>
          </section>

          <section className="project-audit">
            <div className="project-board__header">
              <Title level={4}>{copy.audit}</Title>
              <Text>{copy.recentRecords} {visibleLogs.length}</Text>
            </div>
            <div className="projects-log-list">
              {visibleLogs.length === 0 ? (
                <Empty description={copy.emptyRecords} />
              ) : (
                visibleLogs.map((log) => (
                  <div key={log.id} className="projects-log">
                    <GitBranch size={14} />
                    <div>
                      <strong>{log.platformName}</strong>
                      <span>{log.detailMessage ?? log.errorMessage ?? actionLabel(log.action, copy.language)}</span>
                    </div>
                    <div className="projects-log__meta">
                      <StatusChip tone={statusTone(log.status)}>{statusLabel(log.status, copy.language)}</StatusChip>
                      <time>{formatDate(log.createdAt, copy.language)}</time>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

function PlatformSection({
  copy,
  connection,
  assignments,
  issueCount,
  governanceState,
  onBindSkill,
  onEditPlatform,
  onDeletePlatform,
  onSyncPlatform,
  onEditAssignment,
  onToggleAssignment,
  onDeleteAssignment,
}: {
  copy: ProjectCopy;
  connection: ProjectPlatformConnection;
  assignments: ProjectSkillAssignment[];
  issueCount: number;
  governanceState: ProjectPlatformGovernanceState;
  onBindSkill: () => void;
  onEditPlatform: () => void;
  onDeletePlatform: () => void;
  onSyncPlatform: () => void;
  onEditAssignment: (assignment: ProjectSkillAssignment) => void;
  onToggleAssignment: (assignment: ProjectSkillAssignment) => void;
  onDeleteAssignment: (assignment: ProjectSkillAssignment) => void;
}) {
  const canBind = !governanceState.readOnly;
  const canConfigure = !governanceState.readOnly;
  const canSync = !governanceState.syncBlocked;

  return (
    <article className="projects-platform">
      <div className="projects-platform__header">
        <div className="projects-platform__identity">
          <div className="projects-platform__titleline">
            <Title level={4}>{connection.displayName ?? connection.platformName}</Title>
            <StatusChip tone={statusTone(connection.status)}>{statusLabel(connection.status, copy.language)}</StatusChip>
            {governanceState.mode === "project_paused" && (
              <StatusChip tone="neutral">{copy.platformPausedInProject}</StatusChip>
            )}
            {governanceState.mode !== "project_paused" && governanceState.readOnly && governanceState.label && (
              <StatusChip tone={governanceState.tone ?? "warning"}>{governanceState.label}</StatusChip>
            )}
          </div>
          <Text className="projects-path">{connection.skillsDir}</Text>
        </div>
      </div>

      <div className="projects-platform__toolbar">
        <div className="projects-platform__statusbar">
          <span>{assignments.length} {copy.projectBinding}</span>
          <span>{issueCount} {copy.filterRisk}</span>
          <span>{pathModeLabel(connection.pathMode, copy.language)}</span>
          <span>{syncModeLabel(connection.syncMode, copy.language)}</span>
          <span>{formatDate(connection.lastSyncAt, copy.language)}</span>
        </div>
        <Space wrap className="projects-platform__actions">
          {governanceState.mode !== "active" && governanceState.reason ? (
            <Tooltip title={governanceState.reason}>
              <span className="projects-platform__readonly">
                {governanceState.mode === "project_paused" ? copy.platformPausedInProject : copy.platformReadOnly}
              </span>
            </Tooltip>
          ) : null}
          {canBind ? (
            <Button className="projects-button projects-button--secondary" size="small" icon={<Plus size={14} />} onClick={onBindSkill}>{copy.actionMount}</Button>
          ) : (
            <Tooltip title={governanceState.reason}>
              <span className="projects-platform__action-wrap">
                <Button className="projects-button projects-button--secondary" size="small" icon={<Plus size={14} />} disabled>{copy.actionMount}</Button>
              </span>
            </Tooltip>
          )}
          {canConfigure ? (
            <Button className="projects-button projects-button--ghost" size="small" onClick={onEditPlatform}>{copy.actionEdit}</Button>
          ) : (
            <Tooltip title={governanceState.reason}>
              <span className="projects-platform__action-wrap">
                <Button className="projects-button projects-button--ghost" size="small" disabled>{copy.actionEdit}</Button>
              </span>
            </Tooltip>
          )}
          {canSync ? (
            <Button className="projects-button projects-button--ghost" size="small" onClick={onSyncPlatform}>{copy.actionSync}</Button>
          ) : (
            <Tooltip title={governanceState.syncReason ?? governanceState.reason}>
              <span className="projects-platform__action-wrap">
                <Button className="projects-button projects-button--ghost" size="small" disabled>{copy.actionSync}</Button>
              </span>
            </Tooltip>
          )}
          <Button className="projects-button projects-button--icon-danger projects-icon-action" size="small" danger icon={<Trash2 size={13} />} onClick={onDeletePlatform} />
        </Space>
      </div>

      {governanceState.mode !== "active" && governanceState.reason ? (
        <div className={`projects-platform__notice projects-platform__notice--${governanceState.tone ?? "warning"}`}>
          <strong>{governanceState.label ?? copy.blocked}</strong>
          <span>{governanceState.reason}</span>
        </div>
      ) : null}

      <div className="projects-matrix">
        {assignments.length === 0 ? (
          <div className="projects-platform__empty">{copy.emptyBindings}</div>
        ) : (
          <>
            <div className="projects-matrix__head">
              <span>{copy.skill}</span>
              <span>{copy.directory}</span>
              <span>{copy.version}</span>
              <span>{copy.status}</span>
              <span>{copy.actionEdit}</span>
            </div>
            {assignments.map((assignment) => {
                const runtimeStatus = assignmentRuntimeStatus(assignment);
                return (
                  <div key={assignment.id} className="projects-matrix__row">
                    <div className="projects-matrix__skill" data-label={copy.skill}>
                      <Braces size={15} />
                      <div>
                        <strong>{assignment.skillName}</strong>
                        <span>{assignment.skillSlug}</span>
                      </div>
                    </div>
                    <div className="projects-matrix__target" data-label={copy.directory}>{assignment.targetDirName}</div>
                    <div className="projects-matrix__version" data-label={copy.version}>v{assignment.snapshotNumber}</div>
                    <div className="projects-matrix__status" data-label={copy.status}>
                      <StatusChip tone={statusTone(runtimeStatus)}>{statusLabel(runtimeStatus, copy.language)}</StatusChip>
                    </div>
                    <div className="projects-matrix__actions" data-label={copy.actionEdit}>
                      {governanceState.readOnly ? (
                        <Tooltip title={governanceState.reason}>
                          <span className="projects-matrix__readonly">{copy.platformReadOnly}</span>
                        </Tooltip>
                      ) : (
                        <>
                          <Button className="projects-table-action" size="small" type="text" onClick={() => onEditAssignment(assignment)}>{copy.version}</Button>
                          <Button className="projects-table-action" size="small" type="text" onClick={() => onToggleAssignment(assignment)}>
                            {assignment.enabled ? copy.actionDisable : copy.actionEnable}
                          </Button>
                        </>
                      )}
                      <Button className="projects-table-action" size="small" type="text" danger onClick={() => onDeleteAssignment(assignment)}>
                        {copy.actionDelete}
                      </Button>
                    </div>
                  </div>
                );
              })}
          </>
        )}
      </div>
    </article>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="projects-metric">
      <span>{icon}</span>
      <strong>{value}</strong>
      <em>{label}</em>
      <CheckCircle2 size={13} />
    </div>
  );
}

function StatusChip({
  tone,
  children,
}: {
  tone: "success" | "error" | "warning" | "processing" | "neutral";
  children: ReactNode;
}) {
  return <span className={`projects-chip projects-chip--${tone}`}>{children}</span>;
}

export function ActionImpactPreview({
  items,
  note,
}: {
  items: ImpactItem[];
  note?: ReactNode;
}) {
  return (
    <div className="projects-impact">
      {items.map((item) => (
        <div key={item.label} className="projects-impact__item">
          <span>{item.label}</span>
          <div className="projects-impact__value">{item.value}</div>
        </div>
      ))}
      {note ? <div className="projects-impact__note">{note}</div> : null}
    </div>
  );
}

export function ProjectPlatformPathTestResultCard({
  copy,
  result,
}: {
  copy: ProjectCopy;
  result: TestPlatformPathResult;
}) {
  const stateText = result.exists
    ? result.isDirectory
      ? copy.pathExistingDirectory
      : copy.pathExistingNotDirectory
    : copy.pathCurrentMissing;
  const followText = result.ok
    ? result.exists
      ? copy.pathReadyExisting
      : copy.pathReadyWillCreate
    : copy.pathRequiresFix;

  return (
    <div className={`projects-inline-result projects-inline-result--${result.ok ? "success" : "warning"}`}>
      <div className="projects-inline-result__head">
        <StatusChip tone={result.ok ? "success" : "warning"}>{result.ok ? copy.pathReady : copy.pathRequiresAction}</StatusChip>
        <span>{result.message}</span>
      </div>
      <code>{result.normalizedPath}</code>
      <div className="projects-inline-result__meta">
        <span>{stateText}</span>
        <span>{followText}</span>
      </div>
    </div>
  );
}

export function SyncPlanGroup({
  copy,
  title,
  description,
  tone,
  records,
  selectable = false,
  selectedAssignmentIds = [],
  onToggleSelection,
}: {
  copy: ProjectCopy;
  title: string;
  description: string;
  tone: "success" | "warning" | "error" | "neutral";
  records: ProjectSyncPlanRecord[];
  selectable?: boolean;
  selectedAssignmentIds?: string[];
  onToggleSelection?: (assignmentId: string, checked: boolean) => void;
}) {
  if (records.length === 0) {
    return null;
  }

  return (
    <section className={`projects-sync-plan__group projects-sync-plan__group--${tone}`}>
      <div className="projects-sync-plan__group-head">
        <div>
          <strong>{title}</strong>
          <span>{description}</span>
        </div>
        <StatusChip tone={tone}>{records.length}</StatusChip>
      </div>
      <div className="projects-sync-plan__group-body">
        {records.map((record) => (
          <div key={record.assignmentId} className="projects-sync-plan__item">
            <div className="projects-sync-plan__item-head">
              <div>
                <strong>{record.skillName}</strong>
                <span>{buildSyncPlanMessage(record, copy.language)}</span>
              </div>
              <div className="projects-sync-plan__item-tags">
                {selectable && onToggleSelection ? (
                  <Checkbox
                    checked={selectedAssignmentIds.includes(record.assignmentId)}
                    onChange={(event) =>
                      onToggleSelection(record.assignmentId, event.target.checked)
                    }
                  >
                    {copy.actionConfirmTakeover}
                  </Checkbox>
                ) : null}
                <Tag color={statusTone(record.status)}>{statusLabel(record.status, copy.language)}</Tag>
                <Tag>{actionLabel(record.plannedAction, copy.language)}</Tag>
              </div>
            </div>
            <code>{record.targetPath}</code>
          </div>
        ))}
      </div>
    </section>
  );
}
