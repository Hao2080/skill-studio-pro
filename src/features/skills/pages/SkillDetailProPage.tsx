import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import AntApp from "antd/es/app";
import { AlertTriangle, ArrowLeft, Boxes, CheckCircle2, Clock3, FileText, FolderTree, GitBranch, History, LoaderCircle, MapPin, PackageCheck, RotateCcw, Send, ShieldCheck, Trash2 } from "lucide-react";
import { SourceConfidence } from "@/shared/components/SourceConfidence";
import { PageHeader, StatusBadge } from "@/shared/components/pro";
import type { SourceConfidenceData } from "@/shared/model/proTypes";
import { inventoryApi, type InventoryApi } from "@/features/inventory/api/inventoryApi";
import type { SkillInstanceDetail } from "@/features/inventory/model";
import { libraryApi, type LibraryApi } from "@/features/library/api/libraryApi";
import type { CentralSkill, DriftPolicy, MappingState, PublishPlan, SyncMode } from "@/features/library/model";
import { aiApi, type AiApi } from "@/features/ai-settings/api/aiApi";
import { generateArtifactBundle } from "@/features/ai-settings/model";
import type { AiArtifact, AiProviderConfig, AiTaskRoute, AiTaskType } from "@/features/ai-settings/model";
import { AiArtifactPanel, type ArtifactRunState } from "@/features/ai-settings/components/AiArtifactPanel";
import { activityApi, type ActivityApi } from "@/features/activity/api/activityApi";
import type { OperationLog } from "@/features/activity/model";
import { listSkillFiles, openFileInEditor, readSkillFile } from "@/features/skills/api/skillsApi";
import { diffWorkingDirectory, listSnapshots } from "@/features/snapshots/api/snapshotsApi";
import { lifecycleApi, type LifecycleApi } from "@/features/lifecycle/api/lifecycleApi";
import type { SaveTextFileResult } from "@/features/lifecycle/model";
import { trashApi, type TrashApi } from "@/features/trash/api/trashApi";
import type { DeletePlan } from "@/features/trash/model";
import { SkillEditorWorkspace } from "@/features/editor/components/SkillEditorWorkspace";
import { hasUnsavedNavigationChanges, NAVIGATION_DIRTY_MESSAGE } from "@/features/editor/navigationGuard";
import type { SkillFileNode, SkillSnapshot, SnapshotDiffResult } from "@/types/skill";
import "../styles/pro-detail.css";

const tabs = [
  { id: "overview", label: "概览", icon: Boxes },
  { id: "markdown", label: "SKILL.md", icon: FileText },
  { id: "files", label: "文件", icon: FolderTree },
  { id: "source", label: "来源", icon: ShieldCheck },
  { id: "locations", label: "安装位置", icon: MapPin },
  { id: "versions", label: "版本", icon: GitBranch },
  { id: "activity", label: "操作记录", icon: History },
] as const;

type TabId = typeof tabs[number]["id"];

export interface SkillDetailDependencies {
  inventory: InventoryApi;
  library: LibraryApi;
  lifecycle: LifecycleApi;
  trash: TrashApi;
  ai: AiApi;
  activity: ActivityApi;
  readCentralFile(skillId: string, relativePath: string): Promise<string>;
  listCentralFiles(skillId: string): Promise<SkillFileNode>;
  listSnapshots(skillId: string): Promise<SkillSnapshot[]>;
  diffWorkingDirectory(skillId: string): Promise<SnapshotDiffResult>;
  openCentralFile(skillId: string, relativePath: string): Promise<void>;
}

const defaultDependencies: SkillDetailDependencies = {
  inventory: inventoryApi,
  library: libraryApi,
  lifecycle: lifecycleApi,
  trash: trashApi,
  ai: aiApi,
  activity: activityApi,
  readCentralFile: readSkillFile,
  listCentralFiles: listSkillFiles,
  listSnapshots,
  diffWorkingDirectory,
  openCentralFile: openFileInEditor,
};

interface DetailView {
  id: string;
  name: string;
  description: string;
  path: string;
  platforms: string[];
  parseStatus: string;
  hasScripts?: boolean;
  fileCount: number;
  contentHash?: string;
  updatedAt: number;
  source: SourceConfidenceData;
  evidence: string[];
}

function inventoryView(detail: SkillInstanceDetail): DetailView {
  const { instance, resolution } = detail;
  const evidence = detail.evidence.map((item) => item.evidenceValue ?? item.evidenceKey);
  return {
    id: instance.id,
    name: instance.parsedName ?? instance.folderName,
    description: instance.shortDescription ?? instance.description ?? "暂无说明；请查看 SKILL.md 原文。",
    path: instance.absolutePath,
    platforms: [instance.platformName ?? instance.scopeType],
    parseStatus: instance.parseStatus,
    hasScripts: instance.hasScripts || instance.hasExecutables,
    fileCount: instance.fileCount,
    contentHash: instance.contentHash,
    updatedAt: instance.lastModifiedAt ?? instance.lastSeenAt,
    source: resolution ? {
      label: resolution.sourceLabel,
      type: resolution.sourceType,
      score: resolution.confidence,
      status: resolution.resolutionStatus,
      rationale: resolution.rationale,
      evidence,
    } : {
      label: "未知来源", type: "unknown", score: 0, status: "unknown",
      rationale: "当前没有足够的可验证来源证据", evidence,
    },
    evidence,
  };
}

function libraryView(skill: CentralSkill, mappings: MappingState[]): DetailView {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description ?? "中央库主副本",
    path: skill.storagePath,
    platforms: mappings.map((mapping) => mapping.platformName),
    parseStatus: skill.lifecycleState,
    fileCount: 0,
    contentHash: skill.activeContentHash,
    updatedAt: skill.updatedAt,
    source: {
      label: "Skill Studio Pro 中央库", type: "central_library", score: 100, status: "confirmed",
      rationale: `应用管理的稳定 UUID：${skill.id}`,
      evidence: ["中央库数据库记录", `稳定存储路径：${skill.storageRelPath}`],
    },
    evidence: ["中央库数据库记录", `稳定存储路径：${skill.storageRelPath}`],
  };
}

function flattenTree(node: SkillFileNode): Array<{ path: string; type: string }> {
  const current = node.path ? [{ path: node.path, type: node.isDir ? "目录" : "文件" }] : [];
  return [...current, ...node.children.flatMap(flattenTree)];
}

export function SkillDetailProPage({ dependencies = defaultDependencies }: { dependencies?: SkillDetailDependencies }) {
  const { modal } = AntApp.useApp();
  const { skillId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isLibrary = location.pathname.startsWith("/library");
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [detail, setDetail] = useState<DetailView | null>(null);
  const [instanceDetail, setInstanceDetail] = useState<SkillInstanceDetail | null>(null);
  const [markdown, setMarkdown] = useState("");
  const [files, setFiles] = useState<Array<{ path: string; type: string; size?: number }>>([]);
  const [mappings, setMappings] = useState<MappingState[]>([]);
  const [snapshots, setSnapshots] = useState<SkillSnapshot[]>([]);
  const [workingDiff, setWorkingDiff] = useState<SnapshotDiffResult | null>(null);
  const [activities, setActivities] = useState<OperationLog[]>([]);
  const [artifacts, setArtifacts] = useState<AiArtifact[]>([]);
  const [providers, setProviders] = useState<AiProviderConfig[]>([]);
  const [routes, setRoutes] = useState<AiTaskRoute[]>([]);
  const [artifactRunState, setArtifactRunState] = useState<ArtifactRunState>("idle");
  const [artifactErrors, setArtifactErrors] = useState<Array<{ taskType: AiTaskType; message: string }>>([]);
  const [artifactCacheHit, setArtifactCacheHit] = useState(false);
  const activeCancellationIds = useRef(new Set<string>());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [partial, setPartial] = useState("");
  const [registerPlan, setRegisterPlan] = useState<{ id: string; planHash: string; targetPath: string } | null>(null);
  const [publishPlan, setPublishPlan] = useState<PublishPlan | null>(null);
  const [deletePlan, setDeletePlan] = useState<DeletePlan | null>(null);
  const [publishTarget, setPublishTarget] = useState("codex");
  const [publishSyncMode, setPublishSyncMode] = useState<SyncMode>("copy");
  const [publishDriftPolicy, setPublishDriftPolicy] = useState<DriftPolicy>("abort");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (background = false) => {
    if (!skillId) return;
    if (!background) setLoading(true);
    setError("");
    setPartial("");
    try {
      if (isLibrary) {
        const [skill, mappingResult, markdownResult, fileResult, snapshotResult, diffResult, activityResult, artifactResult, providerResult, routeResult] = await Promise.allSettled([
          dependencies.library.get(skillId),
          dependencies.library.detectDrift(skillId),
          dependencies.readCentralFile(skillId, "SKILL.md"),
          dependencies.listCentralFiles(skillId),
          dependencies.listSnapshots(skillId),
          dependencies.diffWorkingDirectory(skillId),
          dependencies.activity.list({ entityId: skillId, limit: 100, offset: 0 }),
          dependencies.ai.listArtifacts({ skillId, includeStale: true }),
          dependencies.ai.listProviders(),
          dependencies.ai.listTaskRoutes(),
        ]);
        if (skill.status === "rejected") throw skill.reason;
        const nextMappings = mappingResult.status === "fulfilled" ? mappingResult.value : [];
        setDetail(libraryView(skill.value, nextMappings));
        setMappings(nextMappings);
        setMarkdown(markdownResult.status === "fulfilled" ? markdownResult.value : "");
        setFiles(fileResult.status === "fulfilled" ? flattenTree(fileResult.value).filter((item) => item.type === "文件") : []);
        setSnapshots(snapshotResult.status === "fulfilled" ? snapshotResult.value : []);
        setWorkingDiff(diffResult.status === "fulfilled" ? diffResult.value : null);
        setActivities(activityResult.status === "fulfilled" ? activityResult.value : []);
        const nextArtifacts = artifactResult.status === "fulfilled" ? artifactResult.value : [];
        setArtifacts(nextArtifacts);
        setProviders(providerResult.status === "fulfilled" ? providerResult.value : []);
        setRoutes(routeResult.status === "fulfilled" ? routeResult.value : []);
        setArtifactRunState(nextArtifacts.some((artifact) => artifact.staleAt) ? "stale" : nextArtifacts.length ? "success" : "idle");
        const failed = [mappingResult, markdownResult, fileResult, snapshotResult, diffResult, activityResult, artifactResult, providerResult, routeResult].filter((item) => item.status === "rejected").length;
        if (failed) setPartial(`${failed} 个详情分区加载失败，中央主副本信息仍可用。`);
      } else {
        const base = await dependencies.inventory.getInstance(skillId);
        setInstanceDetail(base);
        setDetail(inventoryView(base));
        setFiles(base.files.map((file) => ({ path: file.relativePath, type: file.fileType, size: file.sizeBytes })));
        const [markdownResult, activityResult, artifactResult, providerResult, routeResult] = await Promise.allSettled([
          dependencies.inventory.readInstanceFile(skillId, "SKILL.md"),
          dependencies.activity.list({ entityId: skillId, limit: 100, offset: 0 }),
          dependencies.ai.listArtifacts({ instanceId: skillId, includeStale: true }),
          dependencies.ai.listProviders(),
          dependencies.ai.listTaskRoutes(),
        ]);
        setMarkdown(markdownResult.status === "fulfilled" ? markdownResult.value : "");
        setActivities(activityResult.status === "fulfilled" ? activityResult.value : []);
        const nextArtifacts = artifactResult.status === "fulfilled" ? artifactResult.value : [];
        setArtifacts(nextArtifacts);
        setProviders(providerResult.status === "fulfilled" ? providerResult.value : []);
        setRoutes(routeResult.status === "fulfilled" ? routeResult.value : []);
        setArtifactRunState(nextArtifacts.some((artifact) => artifact.staleAt) ? "stale" : nextArtifacts.length ? "success" : "idle");
        const failed = [markdownResult, activityResult, artifactResult, providerResult, routeResult].filter((item) => item.status === "rejected").length;
        if (failed) setPartial(`${failed} 个详情分区加载失败，本地索引与来源证据仍可用。`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setDetail(null);
    } finally {
      if (!background) setLoading(false);
    }
  }, [dependencies, isLibrary, skillId]);

  useEffect(() => { void load(); }, [load]);

  async function recalculate() {
    if (!skillId || isLibrary) return;
    try {
      await dependencies.inventory.recalculateOrigin(skillId);
      await load();
      setNotice("来源证据已按确定性规则重新计算。");
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }

  async function createRegisterPlan() {
    try {
      const plan = await dependencies.library.createRegisterPlan({ instanceId: skillId });
      setRegisterPlan({ id: plan.id, planHash: plan.planHash, targetPath: plan.targetPath });
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }

  async function executeRegisterPlan() {
    if (!registerPlan) return;
    try {
      const skill = await dependencies.library.executeRegisterPlan({ planId: registerPlan.id, planHash: registerPlan.planHash });
      setNotice(`已创建中央主副本 ${skill.name}；外部实例未移动。`);
      setRegisterPlan(null);
      navigate(`/library/${skill.id}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }

  async function createPublishPlan() {
    const snapshot = snapshots.find((item) => item.isActive) ?? snapshots.find((item) => item.isCurrent) ?? snapshots[0];
    if (!snapshot) { setError("没有可发布快照，请先创建快照。"); return; }
    try {
      setPublishPlan(await dependencies.library.createPublishPlan({ skillId, snapshotId: snapshot.id, targets: [{ platformName: publishTarget, syncMode: publishSyncMode, driftPolicy: publishDriftPolicy }] }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }

  async function executePublishPlan() {
    if (!publishPlan) return;
    try {
      const result = await dependencies.library.executePublishPlan({ planId: publishPlan.id, planHash: publishPlan.planHash });
      setNotice(`发布结果：${result.status}；${result.targets.filter((item) => item.status === "success").length}/${result.targets.length} 个目标成功。`);
      setPublishPlan(null);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }

  async function createDeletePlan() {
    try {
      setDeletePlan(await dependencies.trash.createDeletePlan(skillId));
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }

  async function executeDeletePlan() {
    if (!deletePlan) return;
    try {
      await dependencies.trash.executeDelete(deletePlan.id, deletePlan.planHash);
      navigate("/trash");
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }

  async function generateArtifacts(force: boolean) {
    if (artifactRunState === "running") return;
    const existingIds = new Set(artifacts.map((artifact) => artifact.id));
    setArtifactRunState("running");
    setArtifactErrors([]);
    setArtifactCacheHit(false);
    try {
      const result = await generateArtifactBundle({
        api: dependencies.ai,
        subject: isLibrary ? { skillId } : { instanceId: skillId },
        skillMd: markdown,
        metadata: {
          name: detail?.name,
          description: detail?.description,
          contentHash: detail?.contentHash,
          sourceType: detail?.source.type,
        },
        force,
        onTaskStart: (_taskType, cancellationId) => activeCancellationIds.current.add(cancellationId),
        onTaskSettled: (_taskType, cancellationId) => activeCancellationIds.current.delete(cancellationId),
      });
      setArtifactErrors(result.errors);
      setArtifactCacheHit(Boolean(result.artifacts.length) && result.artifacts.every((artifact) => existingIds.has(artifact.id)));
      const refreshed = await dependencies.ai.listArtifacts({
        ...(isLibrary ? { skillId } : { instanceId: skillId }),
        includeStale: true,
      });
      setArtifacts(refreshed);
      setArtifactRunState(result.errors.length && !result.artifacts.length ? "error" : "success");
    } catch (reason) {
      setArtifactErrors([{ taskType: "final_summary", message: reason instanceof Error ? reason.message : String(reason) }]);
      setArtifactRunState("error");
    }
  }

  async function cancelArtifacts() {
    const ids = [...activeCancellationIds.current];
    await Promise.allSettled(ids.map((cancellationId) => dependencies.ai.cancelArtifact(cancellationId)));
    setArtifactRunState("cancelled");
  }

  async function handleSaved(result: SaveTextFileResult) {
    setNotice(`已保存 ${result.relativePath}；恢复点 ${result.recoverySnapshotId}，${result.outdatedMappingCount} 个映射已标记过期。`);
    await load(true);
  }

  function confirmDiscard(action: () => void) {
    if (!hasUnsavedNavigationChanges()) {
      action();
      return;
    }
    modal.confirm({
      centered: true,
      title: "放弃未保存修改？",
      content: NAVIGATION_DIRTY_MESSAGE,
      okText: "放弃并继续",
      cancelText: "继续编辑",
      onOk: action,
    });
  }

  function selectTab(nextTab: TabId) {
    if (nextTab === activeTab) return;
    confirmDiscard(() => setActiveTab(nextTab));
  }

  const parentRoute = isLibrary ? "/library" : "/inventory";

  if (loading) return <div className="pro-page"><div className="pro-page__inner"><div className="pro-empty glass-panel" role="status"><div><LoaderCircle size={28}/><strong>正在加载 Skill 详情</strong></div></div></div></div>;
  if (error && !detail) return <div className="pro-page"><div className="pro-page__inner"><div className="pro-empty glass-panel" role="alert"><div><AlertTriangle size={28}/><strong>Skill 详情加载失败</strong><p>{error}</p><button className="pro-button" type="button" onClick={() => void load()}>重试</button></div></div></div></div>;
  if (!detail) return null;

  return (
    <div className="pro-page skill-detail-pro"><div className="pro-page__inner">
      <button type="button" className="skill-detail-pro__back" onClick={() => confirmDiscard(() => navigate(parentRoute))}><ArrowLeft size={14}/>返回{isLibrary ? "中央库" : "本机 Skill"}</button>
      <PageHeader eyebrow={isLibrary ? "CENTRAL SKILL" : "LOCAL INSTANCE"} title={detail.name} subtitle={detail.description} actions={isLibrary ? <><button type="button" className="pro-button pro-button--danger" onClick={createDeletePlan}><Trash2 size={15}/>移入回收站</button><button type="button" className="pro-button pro-button--primary" onClick={createPublishPlan}><Send size={15}/>创建发布计划</button></> : <><button type="button" className="pro-button" onClick={recalculate}><RotateCcw size={15}/>重算来源</button><button type="button" className="pro-button pro-button--primary" onClick={createRegisterPlan} disabled={Boolean(instanceDetail?.instance.centralSkillId)}><Send size={15}/>纳入中央库</button></>} />
      {error ? <div className="trash-notice glass-panel" role="alert"><StatusBadge label="操作失败" tone="danger"/><span>{error}</span></div> : null}
      {partial ? <div className="trash-notice glass-panel" role="status"><StatusBadge label="部分加载" tone="warning"/><span>{partial}</span></div> : null}
      {notice ? <div className="trash-notice glass-panel" role="status"><StatusBadge label="操作完成" tone="success"/><span>{notice}</span></div> : null}
      {registerPlan ? <section className="glass-panel panel-padding"><h2>纳管计划已就绪</h2><p>中央目标：<code>{registerPlan.targetPath}</code>。执行只复制到中央库，原实例保持不动。</p><button className="pro-button" type="button" onClick={()=>setRegisterPlan(null)}>取消</button><button className="pro-button pro-button--primary" type="button" onClick={executeRegisterPlan}>确认纳管</button></section> : null}
      {publishPlan ? <section className="glass-panel panel-padding"><h2>发布计划已就绪</h2>{publishPlan.targets.map((target)=><p key={target.platformName}>{target.displayName} · {target.syncMode} · {target.driftStatus} · {target.status}</p>)}<button className="pro-button" type="button" onClick={()=>setPublishPlan(null)}>取消</button><button className="pro-button pro-button--primary" type="button" disabled={publishPlan.targets.some((target)=>target.status==="blocked")} onClick={executePublishPlan}>{publishPlan.targets.some((target)=>target.driftPolicy==="overwrite" && target.driftStatus!=="in_sync" && target.driftStatus!=="not_published") ? "确认覆盖并发布" : "执行发布"}</button></section> : null}
      {deletePlan ? <section className="glass-panel panel-padding"><h2>移入回收站影响确认</h2><p>中央主副本将移动到应用受控回收站；已发布映射会解除，外部未受管实例不会删除。</p><dl><div><dt>中央文件</dt><dd>{deletePlan.fileCount} 个 · {deletePlan.totalBytes} bytes</dd></div><div><dt>原位置</dt><dd><code>{deletePlan.originalPath}</code></dd></div><div><dt>内容哈希</dt><dd><code>{deletePlan.sourceHash}</code></dd></div></dl>{deletePlan.mappings.map((mapping)=><p key={mapping.platformName}>{mapping.platformName} · {mapping.syncMode} · {mapping.driftStatus}</p>)}<button className="pro-button" type="button" onClick={()=>setDeletePlan(null)}>取消删除</button><button className="pro-button pro-button--danger" type="button" onClick={executeDeletePlan}>确认移入回收站</button></section> : null}
      {isLibrary ? <section className="glass-panel panel-padding"><label>发布目标 <select value={publishTarget} onChange={(event)=>setPublishTarget(event.target.value)}><option value="codex">Codex</option><option value="claude">Claude Code</option><option value="cursor">Cursor</option><option value="windsurf">Windsurf</option><option value="gemini">Gemini CLI</option></select></label><label>同步模式 <select aria-label="发布同步模式" value={publishSyncMode} onChange={(event)=>setPublishSyncMode(event.target.value as SyncMode)}><option value="copy">复制（默认）</option><option value="symlink">符号链接（需系统与平台支持）</option></select></label><label>漂移处理策略 <select aria-label="漂移处理策略" value={publishDriftPolicy} onChange={(event)=>setPublishDriftPolicy(event.target.value as DriftPolicy)}><option value="abort">检测到漂移时停止（默认）</option><option value="overwrite">明确覆盖目标变更</option></select></label><span>{publishSyncMode === "symlink" ? "创建计划时会执行真实能力检测；不可用时将明确失败，不会静默降级为复制。" : publishDriftPolicy === "overwrite" ? "计划将显示受影响目标；只有再次点击“确认覆盖并发布”才会覆盖已检测到的漂移。" : "默认复制；检测到漂移时停止覆盖。"}</span></section> : null}
      <div className="skill-detail-pro__identity glass-panel"><span className="skill-card__glyph">{detail.name.slice(0,2).toUpperCase()}</span><div className="skill-detail-pro__path"><span>{isLibrary ? "中央主副本" : "当前实例"}</span><code>{detail.path}</code></div><div className="skill-detail-pro__badges"><StatusBadge label={detail.parseStatus} tone={detail.parseStatus === "error" ? "danger" : "success"}/>{detail.hasScripts == null ? null : <StatusBadge label={detail.hasScripts ? "包含脚本" : "纯内容"} tone={detail.hasScripts ? "warning" : "neutral"}/>} {detail.platforms.map((platform)=><StatusBadge key={platform} label={platform} tone="info"/>)}</div></div>
      <nav className="skill-detail-tabs glass-panel" aria-label="Skill 详情标签页" role="tablist">{tabs.map(({id,label,icon:Icon})=><button key={id} type="button" role="tab" aria-selected={activeTab===id} onClick={()=>selectTab(id)}><Icon size={14}/>{label}</button>)}</nav>
      <div className="skill-detail-pro__content" role="tabpanel">
        {activeTab === "overview" ? <><OverviewTab detail={detail}/><AiArtifactPanel artifacts={artifacts} providers={providers} routes={routes} runState={artifactRunState} errors={artifactErrors} cacheHit={artifactCacheHit} onGenerate={(force)=>void generateArtifacts(force)} onCancel={()=>void cancelArtifacts()}/></> : null}
        {activeTab === "markdown" ? <SkillEditorWorkspace skillId={skillId} isLibrary={isLibrary} files={files} initialContent={markdown} readFile={(relativePath)=>isLibrary ? dependencies.readCentralFile(skillId, relativePath) : dependencies.inventory.readInstanceFile(skillId, relativePath)} saveFile={isLibrary ? (input)=>dependencies.lifecycle.saveTextFile(input) : undefined} openExternal={isLibrary ? (relativePath)=>dependencies.openCentralFile(skillId, relativePath) : undefined} onSaved={handleSaved} onExternalChange={async()=>{ await load(); }} onRequestRegister={createRegisterPlan}/> : null}
        {activeTab === "files" ? <FilesTab files={files}/> : null}
        {activeTab === "source" ? <SourceTab detail={detail}/> : null}
        {activeTab === "locations" ? <LocationsTab mappings={mappings} platforms={detail.platforms}/> : null}
        {activeTab === "versions" ? <VersionsTab snapshots={snapshots} workingDiff={workingDiff}/> : null}
        {activeTab === "activity" ? <ActivityTab activities={activities}/> : null}
      </div>
    </div></div>
  );
}

function OverviewTab({ detail }: { detail: DetailView }) {
  return <div className="skill-overview-grid"><section className="glass-panel panel-padding skill-summary-panel"><div className="skill-detail-section-head"><div><h2>本地快速理解</h2><p>确定性解析始终可用，不依赖模型。</p></div><StatusBadge label="本地解析" tone="neutral"/></div><div className="skill-summary-panel__lead"><span><FileText size={17}/></span><p>{detail.description}</p></div></section><aside className="skill-overview-side"><SourceConfidence source={detail.source}/><section className="glass-panel panel-padding skill-meta-panel"><h2>本地元数据</h2><dl><div><dt>文件数量</dt><dd>{detail.fileCount || "按需加载"}</dd></div><div><dt>内容哈希</dt><dd><code>{detail.contentHash ? `${detail.contentHash.slice(0,10)}…` : "未记录"}</code></dd></div><div><dt>最近修改</dt><dd>{new Date(detail.updatedAt).toLocaleString()}</dd></div><div><dt>状态</dt><dd>{detail.parseStatus}</dd></div></dl></section></aside></div>;
}

function FilesTab({ files }: { files: Array<{path:string;type:string;size?:number}> }) { return <section className="glass-panel panel-padding"><div className="skill-detail-section-head"><div><h2>完整文件树</h2><p>正文按需读取，列表只保留摘要。</p></div><StatusBadge label={`${files.length} 个已索引文件`} tone="info"/></div><div className="pro-file-list">{files.map((file)=><button key={file.path} type="button"><FileText size={14}/><span><strong>{file.path}</strong><small>{file.type}</small></span><em>{file.size == null ? "" : `${file.size} B`}</em></button>)}</div></section>; }
function SourceTab({ detail }: { detail: DetailView }) { return <div className="pro-grid-2"><SourceConfidence source={detail.source}/><section className="glass-panel panel-padding evidence-panel"><h2>证据解释</h2><p>结论由本地确定性规则生成；可信度不是安全评分。</p>{detail.evidence.map((item,index)=><article key={`${item}-${index}`}><span>{index+1}</span><div><strong>{item}</strong></div><CheckCircle2 size={15}/></article>)}</section></div>; }
function LocationsTab({ mappings, platforms }: { mappings: MappingState[]; platforms: string[] }) { const shown = mappings.length ? mappings : platforms.map((platform)=>({platformName:platform,driftStatus:"external",targetPath:"外部扫描实例",syncMode:"copy" as const})); return <section className="glass-panel panel-padding"><div className="skill-detail-section-head"><div><h2>安装位置与发布状态</h2><p>中央映射使用复制模式为默认，漂移不会静默覆盖。</p></div></div><div className="location-list">{shown.map((mapping)=><article key={mapping.platformName}><span className="platform-monogram">{mapping.platformName.slice(0,2).toUpperCase()}</span><div><strong>{mapping.platformName}</strong><code>{mapping.targetPath}</code></div><StatusBadge label={mapping.driftStatus} tone={mapping.driftStatus==="in_sync"?"success":mapping.driftStatus==="drifted"?"warning":"neutral"}/><span>{mapping.syncMode}</span></article>)}</div></section>; }
function VersionsTab({ snapshots, workingDiff }: { snapshots: SkillSnapshot[]; workingDiff: SnapshotDiffResult | null }) { const changed = workingDiff ? [...workingDiff.addedFiles, ...workingDiff.modifiedFiles, ...workingDiff.deletedFiles] : []; return <section className="glass-panel panel-padding"><div className="skill-detail-section-head"><div><h2>版本、恢复点与当前差异</h2><p>编辑、覆盖发布与删除前都会保留恢复路径。</p></div><StatusBadge label={`${changed.length} 个工作区差异`} tone={changed.length ? "warning" : "success"}/></div>{changed.length?<div className="pro-file-list">{changed.map((path)=><div key={path}><FileText size={14}/><span><strong>{path}</strong><small>{workingDiff?.addedFiles.includes(path)?"新增":workingDiff?.deletedFiles.includes(path)?"删除":"修改"}</small></span></div>)}</div>:null}<div className="version-timeline">{snapshots.map((item,index)=><article key={item.id}><span>{index===0?<PackageCheck size={15}/>:<Clock3 size={15}/>}</span><div><strong>v{item.snapshotNumber} · {item.isActive?"生效版本":item.source}</strong><p>{item.changeSummary ?? "无变更摘要"}</p></div><time>{new Date(item.createdAt).toLocaleString()}</time></article>)}{!snapshots.length?<p>外部实例没有中央快照。</p>:null}</div></section>; }
function ActivityTab({ activities }: { activities: OperationLog[] }) { return <section className="glass-panel panel-padding"><div className="skill-detail-section-head"><div><h2>操作记录</h2><p>只显示与此 Skill ID 相关的审计记录。</p></div></div><div className="detail-activity-list">{activities.map((item)=><article key={item.id}><span className={`is-${item.status}`}>{item.status==="failed"?<AlertTriangle size={14}/>:<CheckCircle2 size={14}/>}</span><div><strong>{item.operationType}</strong><p>{item.errorSummary ?? item.targetLabel}</p></div><time>{new Date(item.createdAt).toLocaleString()}</time></article>)}{!activities.length?<p>尚无相关操作记录。</p>:null}</div></section>; }
