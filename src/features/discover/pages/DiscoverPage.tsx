import { useState } from "react";
import { Archive, CheckCircle2, FileArchive, FolderOpen, Github, PackageSearch, ShieldAlert, Store, TerminalSquare } from "lucide-react";
import { PageHeader, StatusBadge } from "@/shared/components/pro";
import { createMockInstallPlan, type MockInstallPlan } from "../api/mockInstallApi";
import "../styles.css";

export function DiscoverPage() {
  const [source, setSource] = useState("https://github.com/acme-labs/design-system-auditor.git");
  const [plan, setPlan] = useState<MockInstallPlan | null>(null);
  const [loading, setLoading] = useState(false);

  async function preview() {
    setLoading(true);
    setPlan(await createMockInstallPlan(source));
    setLoading(false);
  }

  return (
    <div className="pro-page discover-page"><div className="pro-page__inner">
      <PageHeader eyebrow="SAFE INTAKE" title="发现与安装" subtitle="所有来源先进入暂存区与安装预览，不执行外部 Skill 自带脚本。" />
      <section className="discover-source-grid">
        {[{icon:FolderOpen,title:"本地目录",copy:"选择一个或多个本地 Skill 目录",action:"选择目录"},{icon:FileArchive,title:"ZIP 压缩包",copy:"安全解压并检查路径与文件数量",action:"选择 ZIP"},{icon:Github,title:"Git 仓库",copy:"固定分支、commit 和可选子目录",action:"使用下方 URL"},{icon:Store,title:"市场浏览",copy:"浏览上游可用市场来源",action:"打开市场"}].map(({icon:Icon,title,copy,action})=><article key={title} className="glass-panel"><span><Icon size={20}/></span><h2>{title}</h2><p>{copy}</p><button type="button">{action}</button></article>)}
      </section>
      <div className="discover-workspace">
        <section className="glass-panel panel-padding git-intake">
          <div><span><Github size={18}/></span><div><h2>从 Git 导入</h2><p>此处使用类型化 Mock，不发起网络请求。</p></div><StatusBadge label="Mock API" tone="info"/></div>
          <label>仓库 URL<input value={source} onChange={(event)=>setSource(event.target.value)} /></label>
          <div className="git-intake__row"><label>分支或 commit<input placeholder="main（可选）" /></label><label>Skill 子目录<input placeholder="skills/example（可选）" /></label></div>
          <button type="button" className="pro-button pro-button--primary" onClick={preview} disabled={!source || loading}><PackageSearch size={14}/>{loading ? "正在分析…" : "生成安装预览"}</button>
          <p className="git-intake__safety"><ShieldAlert size={13}/>预览不会写入中央库，也不会运行安装命令或 Hook。</p>
        </section>
        <section className="glass-panel panel-padding install-plan">
          <div className="skill-detail-section-head"><div><h2>安装计划</h2><p>确认目标、脚本和冲突后才能继续。</p></div>{plan?<StatusBadge label="预览就绪" tone="success"/>:<StatusBadge label="等待来源" tone="neutral"/>}</div>
          {plan ? <><div className="install-plan__skill"><span><Archive size={18}/></span><div><strong>{plan.skillName}</strong><small>{plan.source}</small></div><CheckCircle2 size={16}/></div><dl><div><dt>固定 commit</dt><dd><code>{plan.commit}</code></dd></div><div><dt>文件</dt><dd>{plan.fileCount} 个</dd></div><div><dt>脚本</dt><dd className="is-warning"><TerminalSquare size={12}/>{plan.scriptCount} 个 · 不会执行</dd></div><div><dt>名称冲突</dt><dd>无</dd></div><div><dt>中央目标</dt><dd><code>{plan.target}</code></dd></div></dl><div className="install-plan__actions"><button type="button" className="pro-button">取消预览</button><button type="button" className="pro-button pro-button--primary">导入中央库</button></div></> : <div className="install-plan__empty"><PackageSearch size={27}/><p>填写 Git 来源并生成预览，或从上方选择本地与 ZIP 来源。</p></div>}
        </section>
      </div>
    </div></div>
  );
}
