import { useMemo, useState } from "react";
import { AlertTriangle, Archive, CheckCircle2, FileArchive, FolderOpen, Github, PackageSearch, ShieldAlert, Store, TerminalSquare } from "lucide-react";
import { PageHeader, StatusBadge } from "@/shared/components/pro";
import { lifecycleApi, type LifecycleApi } from "@/features/lifecycle/api/lifecycleApi";
import type { ImportConflictAction, ImportPlanInput, ImportResult, ImportSourceType, InstallPlan } from "@/features/lifecycle/model";
import "../styles.css";

export interface DiscoverPageProps {
  api?: LifecycleApi;
}

type IntakeMode = Exclude<ImportSourceType, "marketplace">;

const sourceCards: Array<{ mode: IntakeMode | "marketplace"; icon: typeof FolderOpen; title: string; copy: string; action: string }> = [
  { mode: "local_directory", icon: FolderOpen, title: "本地目录", copy: "选择一个或多个本地 Skill 目录", action: "使用本地路径" },
  { mode: "zip_archive", icon: FileArchive, title: "ZIP 压缩包", copy: "安全解压并检查路径与文件数量", action: "使用 ZIP 路径" },
  { mode: "git_repository", icon: Github, title: "Git 仓库", copy: "固定分支、commit 和可选子目录", action: "使用 Git URL" },
  { mode: "marketplace", icon: Store, title: "市场浏览", copy: "市场来源也进入同一安全预览流水线", action: "市场入口待选择" },
];

export function DiscoverPage({ api = lifecycleApi }: DiscoverPageProps) {
  const [mode, setMode] = useState<IntakeMode>("git_repository");
  const [source, setSource] = useState("");
  const [gitRef, setGitRef] = useState("");
  const [subdir, setSubdir] = useState("");
  const [plan, setPlan] = useState<InstallPlan | null>(null);
  const [selections, setSelections] = useState<Record<string, ImportConflictAction>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState("");

  const sourceLabel = mode === "git_repository" ? "仓库 URL" : mode === "local_directory" ? "本地目录路径" : "ZIP 文件路径";
  const sourcePlaceholder = mode === "git_repository" ? "https://github.com/org/repo.git" : mode === "local_directory" ? "C:\\path\\to\\skill" : "C:\\path\\to\\skills.zip";
  const canExecute = Boolean(plan?.candidates.length) && plan!.candidates.every((candidate) => selections[candidate.id] !== "cancel");

  function selectMode(next: IntakeMode) {
    setMode(next);
    setSource("");
    setPlan(null);
    setResult(null);
    setError("");
  }

  function buildInput(): ImportPlanInput {
    const common = { sourceType: mode } as ImportPlanInput;
    if (mode === "git_repository") {
      return { ...common, gitUrl: source.trim(), gitRef: gitRef.trim() || undefined, repoSubdir: subdir.trim() || undefined };
    }
    if (mode === "local_directory") return { ...common, localPath: source.trim() };
    return { ...common, zipPath: source.trim() };
  }

  async function preview() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const nextPlan = await api.createImportPlan(buildInput());
      setPlan(nextPlan);
      setSelections(Object.fromEntries(nextPlan.candidates.map((candidate) => [candidate.id, candidate.conflicts.length ? "cancel" : "install"])));
    } catch (reason) {
      setPlan(null);
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }

  async function execute() {
    if (!plan || !canExecute) return;
    setExecuting(true);
    setError("");
    try {
      const nextResult = await api.executeImportPlan({
        planId: plan.id,
        planHash: plan.planHash,
        selections: plan.candidates.map((candidate) => {
          const action = selections[candidate.id] ?? "cancel";
          const conflict = candidate.conflicts[0];
          return {
            candidateId: candidate.id,
            action,
            targetName: action === "rename" ? `${candidate.name}-imported` : undefined,
            existingSkillId: action === "update" ? conflict?.existingSkillId : undefined,
          };
        }),
      });
      setResult(nextResult);
      if (nextResult.status === "success") setPlan(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setExecuting(false);
    }
  }

  const totals = useMemo(() => plan?.candidates.reduce((summary, candidate) => ({
    files: summary.files + candidate.fileCount,
    scripts: summary.scripts + candidate.scripts.length,
    conflicts: summary.conflicts + candidate.conflicts.length,
  }), { files: 0, scripts: 0, conflicts: 0 }), [plan]);

  return (
    <div className="pro-page discover-page"><div className="pro-page__inner">
      <PageHeader eyebrow="SAFE INTAKE" title="发现与安装" subtitle="所有来源先进入暂存区与安装预览，不执行外部 Skill 自带脚本。" />
      <section className="discover-source-grid">
        {sourceCards.map(({ mode: cardMode, icon: Icon, title, copy, action }) => <article key={title} className="glass-panel"><span><Icon size={20}/></span><h2>{title}</h2><p>{copy}</p><button type="button" disabled={cardMode === "marketplace"} onClick={() => cardMode !== "marketplace" && selectMode(cardMode)}>{action}</button></article>)}
      </section>
      <div className="discover-workspace">
        <section className="glass-panel panel-padding git-intake">
          <div><span>{mode === "git_repository" ? <Github size={18}/> : mode === "local_directory" ? <FolderOpen size={18}/> : <FileArchive size={18}/>}</span><div><h2>{mode === "git_repository" ? "从 Git 导入" : mode === "local_directory" ? "从本地目录导入" : "从 ZIP 导入"}</h2><p>真实后端只创建暂存与只读计划；不会执行来源脚本。</p></div><StatusBadge label="真实安装计划" tone="info"/></div>
          <label>{sourceLabel}<input value={source} placeholder={sourcePlaceholder} onChange={(event) => { setSource(event.target.value); setPlan(null); }} /></label>
          {mode === "git_repository" ? <div className="git-intake__row"><label>分支、tag 或 commit<input value={gitRef} onChange={(event) => setGitRef(event.target.value)} placeholder="main（可选）" /></label><label>Skill 子目录<input value={subdir} onChange={(event) => setSubdir(event.target.value)} placeholder="skills/example（可选）" /></label></div> : null}
          <button type="button" className="pro-button pro-button--primary" onClick={preview} disabled={!source.trim() || loading}><PackageSearch size={14}/>{loading ? "正在分析…" : "生成安装预览"}</button>
          <p className="git-intake__safety"><ShieldAlert size={13}/>预览不会写入中央库，也不会运行安装命令或 Hook。</p>
          {error ? <p className="is-warning" role="alert"><AlertTriangle size={13}/>{error}</p> : null}
          {result ? <div role="status" className={`provider-result is-${result.status === "success" ? "success" : "warning"}`}><CheckCircle2 size={14}/><span>导入结果：{result.status}，成功 {result.imported.length} 项；Agent 发布保持延后。</span></div> : null}
        </section>
        <section className="glass-panel panel-padding install-plan">
          <div className="skill-detail-section-head"><div><h2>安装计划</h2><p>确认目标、脚本和冲突后才能继续。</p></div>{plan?<StatusBadge label="预览就绪" tone="success"/>:<StatusBadge label="等待来源" tone="neutral"/>}</div>
          {plan ? <><div className="install-plan__skill"><span><Archive size={18}/></span><div><strong>{plan.candidates.length} 个 Skill 候选</strong><small>{plan.provenance.sourceLabel}</small></div><CheckCircle2 size={16}/></div><dl><div><dt>来源固定信息</dt><dd><code>{plan.provenance.commit ?? plan.provenance.sourceRef ?? "本地内容哈希"}</code></dd></div><div><dt>文件</dt><dd>{totals?.files ?? 0} 个</dd></div><div><dt>脚本</dt><dd className="is-warning"><TerminalSquare size={12}/>{totals?.scripts ?? 0} 个 · 不会执行</dd></div><div><dt>名称冲突</dt><dd>{totals?.conflicts ?? 0} 项</dd></div><div><dt>计划哈希</dt><dd><code>{plan.planHash.slice(0, 12)}…</code></dd></div></dl>{plan.candidates.map((candidate) => <label key={candidate.id}>{candidate.name}<select aria-label={`${candidate.name} 冲突动作`} value={selections[candidate.id] ?? "cancel"} onChange={(event) => setSelections((current) => ({ ...current, [candidate.id]: event.target.value as ImportConflictAction }))}><option value="install" disabled={candidate.conflicts.length > 0}>作为新 Skill 导入</option><option value="rename">改名后导入</option><option value="update" disabled={!candidate.conflicts.length}>更新现有 Skill（先建恢复点）</option><option value="cancel">取消此候选</option></select></label>)}<div className="install-plan__actions"><button type="button" className="pro-button" onClick={() => setPlan(null)}>取消预览</button><button type="button" className="pro-button pro-button--primary" disabled={!canExecute || executing} onClick={execute}>{executing ? "正在导入…" : "导入中央库"}</button></div></> : <div className="install-plan__empty"><PackageSearch size={27}/><p>选择本地、Git 或 ZIP 来源并生成真实预览。</p></div>}
        </section>
      </div>
    </div></div>
  );
}
