import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Boxes, CheckCircle2, Clock3, Code2, ExternalLink, FileCode2, FileText, FolderTree, GitBranch, History, MapPin, PackageCheck, RotateCcw, Send, ShieldCheck } from "lucide-react";
import { ModelAttribution } from "@/shared/model-attribution/ModelAttribution";
import { SourceConfidence } from "@/shared/components/SourceConfidence";
import { PageHeader, StatusBadge } from "@/shared/components/pro";
import { mockActivities, mockFileTree, mockSkillMarkdown, mockSkills } from "@/shared/mock/proMockData";
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

export function SkillDetailProPage() {
  const { skillId = "skill-visual-profile" } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const skill = useMemo(() => mockSkills.find((item) => item.id === skillId) ?? mockSkills[0], [skillId]);
  const parentRoute = window.location.pathname.startsWith("/library") ? "/library" : "/inventory";

  return (
    <div className="pro-page skill-detail-pro">
      <div className="pro-page__inner">
        <button type="button" className="skill-detail-pro__back" onClick={() => navigate(parentRoute)}><ArrowLeft size={14} />返回{parentRoute === "/library" ? "中央库" : "本机 Skill"}</button>
        <PageHeader
          eyebrow="SKILL ASSET"
          title={skill.name}
          subtitle={skill.description}
          actions={<><button type="button" className="pro-button"><RotateCcw size={15} />重新解析</button><button type="button" className="pro-button pro-button--primary"><Send size={15} />纳入中央库</button></>}
        />

        <div className="skill-detail-pro__identity glass-panel">
          <span className="skill-card__glyph">HF</span>
          <div className="skill-detail-pro__path"><span>当前实例</span><code>{skill.path}</code></div>
          <div className="skill-detail-pro__badges"><StatusBadge label="解析正常" tone="success" /><StatusBadge label={skill.hasScripts ? "包含脚本" : "纯内容"} tone={skill.hasScripts ? "warning" : "neutral"} />{skill.platforms.map((platform) => <StatusBadge key={platform} label={platform} tone="info" />)}</div>
        </div>

        <nav className="skill-detail-tabs glass-panel" aria-label="Skill 详情标签页" role="tablist">
          {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={activeTab === id} onClick={() => setActiveTab(id)}><Icon size={14} />{label}</button>)}
        </nav>

        <div className="skill-detail-pro__content" role="tabpanel">
          {activeTab === "overview" ? <OverviewTab skill={skill} /> : null}
          {activeTab === "markdown" ? <MarkdownTab /> : null}
          {activeTab === "files" ? <FilesTab /> : null}
          {activeTab === "source" ? <SourceTab skill={skill} /> : null}
          {activeTab === "locations" ? <LocationsTab platforms={skill.platforms} /> : null}
          {activeTab === "versions" ? <VersionsTab /> : null}
          {activeTab === "activity" ? <ActivityTab /> : null}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ skill }: { skill: (typeof mockSkills)[number] }) {
  return (
    <div className="skill-overview-grid">
      <section className="glass-panel panel-padding skill-summary-panel">
        <div className="skill-detail-section-head"><div><h2>快速理解</h2><p>原文优先；以下说明便于快速浏览。</p></div><StatusBadge label={skill.model?.state === "fresh" ? "摘要最新" : "本地解析"} tone={skill.model?.state === "fresh" ? "success" : "neutral"} /></div>
        <div className="skill-summary-panel__lead"><span><FileCode2 size={17} /></span><p>{skill.description}</p></div>
        <h3>使用建议</h3>
        <ul><li>输入一位历史人物姓名，必要时补充朝代或视觉风格。</li><li>输出包含严格八段经历与八段画面描述。</li><li>画面描述可继续交给图像生成工作流使用。</li></ul>
        {skill.model ? <ModelAttribution {...skill.model} onRegenerate={() => undefined} /> : <div className="local-attribution"><Code2 size={14} />当前只显示本地确定性解析结果</div>}
      </section>
      <aside className="skill-overview-side">
        <SourceConfidence source={skill.source} />
        <section className="glass-panel panel-padding skill-meta-panel">
          <h2>本地元数据</h2>
          <dl><div><dt>文件数量</dt><dd>{skill.fileCount}</dd></div><div><dt>内容哈希</dt><dd><code>9f08…c4a1</code></dd></div><div><dt>最近修改</dt><dd>{skill.updatedAt}</dd></div><div><dt>解析状态</dt><dd>正常</dd></div></dl>
        </section>
      </aside>
    </div>
  );
}

function MarkdownTab() {
  return <section className="glass-panel markdown-view"><header><div><h2>SKILL.md</h2><span>只读预览</span></div><button type="button" className="pro-button"><ExternalLink size={13} />在外部编辑器打开</button></header><pre>{mockSkillMarkdown}</pre></section>;
}

function FilesTab() {
  return <section className="glass-panel panel-padding"><div className="skill-detail-section-head"><div><h2>完整文件树</h2><p>正文按需读取，列表只保留摘要。</p></div><StatusBadge label={`${mockFileTree.length} 个已索引文件`} tone="info" /></div><div className="pro-file-list">{mockFileTree.map((file) => <button key={file.path} type="button"><FileText size={14} /><span><strong>{file.path}</strong><small>{file.type}</small></span><em>{file.size}</em></button>)}</div></section>;
}

function SourceTab({ skill }: { skill: (typeof mockSkills)[number] }) {
  return <div className="pro-grid-2"><SourceConfidence source={skill.source} /><section className="glass-panel panel-padding evidence-panel"><h2>证据解释</h2><p>结论由本地确定性规则生成。人工确认优先于后续自动推断，同时保留原始证据。</p>{skill.source.evidence.map((item, index) => <article key={item}><span>{index + 1}</span><div><strong>{item}</strong><small>{index === 0 ? "+50 强证据" : "+15 辅助证据"}</small></div><CheckCircle2 size={15} /></article>)}<button type="button" className="pro-button">纠正来源</button></section></div>;
}

function LocationsTab({ platforms }: { platforms: string[] }) {
  return <section className="glass-panel panel-padding"><div className="skill-detail-section-head"><div><h2>安装位置</h2><p>从单个平台移除不会删除中央主副本。</p></div><button className="pro-button pro-button--primary" type="button"><Send size={14} />发布到 Agent</button></div><div className="location-list">{[...platforms, "Cursor"].map((platform, index) => <article key={`${platform}-${index}`}><span className="platform-monogram">{platform.slice(0,2).toUpperCase()}</span><div><strong>{platform}</strong><code>~/.{platform.toLowerCase().replace(" ", "-")}/skills/historical-figure-visual-profile</code></div><StatusBadge label={index === 2 ? "未发布" : "已同步"} tone={index === 2 ? "neutral" : "success"} /><button type="button">管理</button></article>)}</div></section>;
}

function VersionsTab() {
  return <section className="glass-panel panel-padding"><div className="skill-detail-section-head"><div><h2>版本与恢复点</h2><p>编辑、覆盖发布与删除前都会保留恢复路径。</p></div><button type="button" className="pro-button">创建快照</button></div><div className="version-timeline">{[{v:"v1.4",t:"当前版本",d:"更新历史画面构图规范"},{v:"v1.3",t:"系统恢复点",d:"发布到 Codex 前自动创建"},{v:"v1.2",t:"初始纳管",d:"从外部实例创建中央副本"}].map((item,index)=><article key={item.v}><span>{index===0?<PackageCheck size={15}/>:<Clock3 size={15}/>}</span><div><strong>{item.v} · {item.t}</strong><p>{item.d}</p></div><time>{index===0?"今天 14:32":index===1?"7 月 14 日":"7 月 10 日"}</time></article>)}</div></section>;
}

function ActivityTab() {
  return <section className="glass-panel panel-padding"><div className="skill-detail-section-head"><div><h2>操作记录</h2><p>只显示与此 Skill 有关的可读审计记录。</p></div></div><div className="detail-activity-list">{mockActivities.slice(0,4).map((item)=><article key={item.id}><span className={`is-${item.status}`}>{item.status === "warning" ? <AlertTriangle size={14}/>:<CheckCircle2 size={14}/>}</span><div><strong>{item.title}</strong><p>{item.detail}</p></div><time>{item.time}</time></article>)}</div></section>;
}
