import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Boxes, Filter, Grid2X2, List, Search, ShieldCheck, TerminalSquare } from "lucide-react";
import { SourceConfidence } from "@/shared/components/SourceConfidence";
import { StatusBadge } from "@/shared/components/pro";
import type { CatalogSkill } from "@/shared/model/proTypes";

interface SkillCatalogProps {
  skills: CatalogSkill[];
  mode?: "inventory" | "library";
  statusLabel?: string;
}

type ViewMode = "grid" | "list";

const libraryStatus = {
  managed: { label: "已纳管", tone: "success" as const },
  external: { label: "外部实例", tone: "neutral" as const },
  drifted: { label: "存在漂移", tone: "warning" as const },
};

export function SkillCatalog({ skills, mode = "inventory", statusLabel = "筛选在本地完成" }: SkillCatalogProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("all");
  const [source, setSource] = useState("all");
  const [riskOnly, setRiskOnly] = useState(false);
  const [view, setView] = useState<ViewMode>("grid");

  const platforms = Array.from(new Set(skills.flatMap((skill) => skill.platforms)));
  const filtered = useMemo(() => skills.filter((skill) => {
    const normalizedQuery = query.trim().toLowerCase();
    const matchesQuery = !normalizedQuery || [skill.name, skill.description, ...skill.tags].join(" ").toLowerCase().includes(normalizedQuery);
    const matchesPlatform = platform === "all" || skill.platforms.includes(platform);
    const matchesSource = source === "all" || skill.source.status === source;
    const matchesRisk = !riskOnly || skill.hasScripts || skill.duplicateState === "conflict";
    return matchesQuery && matchesPlatform && matchesSource && matchesRisk;
  }), [platform, query, riskOnly, skills, source]);

  const openSkill = (id: string) => navigate(mode === "library" ? `/library/${id}` : `/inventory/${id}`);

  return (
    <section className="skill-catalog" aria-label="Skill 目录">
      <div className="skill-catalog__toolbar glass-panel">
        <label className="skill-search">
          <Search size={15} aria-hidden="true" />
          <span className="sr-only">搜索 Skill</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称、说明或标签" />
          <kbd>⌘ K</kbd>
        </label>
        <div className="skill-filter-row">
          <label><Filter size={14} aria-hidden="true" /><span className="sr-only">平台筛选</span><select value={platform} onChange={(event) => setPlatform(event.target.value)}><option value="all">全部平台</option>{platforms.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><ShieldCheck size={14} aria-hidden="true" /><span className="sr-only">来源筛选</span><select value={source} onChange={(event) => setSource(event.target.value)}><option value="all">全部来源</option><option value="confirmed">已确认</option><option value="inferred">推断</option><option value="unknown">未知</option></select></label>
          <button type="button" className={riskOnly ? "is-active" : ""} aria-pressed={riskOnly} onClick={() => setRiskOnly((value) => !value)}><AlertTriangle size={14} />风险与冲突</button>
        </div>
        <div className="skill-view-toggle" aria-label="视图模式">
          <button type="button" aria-label="卡片视图" aria-pressed={view === "grid"} onClick={() => setView("grid")}><Grid2X2 size={14} /></button>
          <button type="button" aria-label="列表视图" aria-pressed={view === "list"} onClick={() => setView("list")}><List size={15} /></button>
        </div>
      </div>

      <div className="skill-catalog__summary"><span>显示 <strong>{filtered.length}</strong> 个 Skill</span><span>{statusLabel}</span></div>

      {filtered.length ? (
        <div className={`skill-catalog__items is-${view}`}>
          {filtered.map((skill) => <SkillCatalogItem key={skill.id} skill={skill} view={view} onOpen={() => openSkill(skill.id)} />)}
        </div>
      ) : (
        <div className="pro-empty glass-panel"><div><Boxes size={28} /><strong>没有匹配的 Skill</strong><p>调整筛选器或清空搜索词后再试。</p></div></div>
      )}
    </section>
  );
}

function SkillCatalogItem({ skill, view, onOpen }: { skill: CatalogSkill; view: ViewMode; onOpen: () => void }) {
  const state = libraryStatus[skill.libraryState];
  return (
    <article className={`skill-card glass-panel is-${view}`}>
      <button type="button" className="skill-card__hit-area" onClick={onOpen} aria-label={`打开 ${skill.name} 详情`} />
      <div className="skill-card__head">
        <span className="skill-card__glyph" aria-hidden="true">{skill.name.slice(0, 2).toUpperCase()}</span>
        <div className="skill-card__title"><h2>{skill.name}</h2><div>{skill.platforms.map((item) => <span key={item}>{item}</span>)}</div></div>
        <StatusBadge label={state.label} tone={state.tone} />
      </div>
      <p className="skill-card__description">{skill.description}</p>
      <div className="skill-card__tags">{skill.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
      <div className="skill-card__signals">
        {skill.hasScripts === true ? <span className="is-warning"><TerminalSquare size={12} />含脚本</span> : skill.hasScripts === false ? <span><ShieldCheck size={12} />纯内容</span> : <span>风险摘要待索引</span>}
        {skill.duplicateState !== "clean" ? <span className="is-warning"><AlertTriangle size={12} />{skill.duplicateState === "conflict" ? "内容冲突" : "发现重复"}</span> : <span>{skill.fileCount == null ? "文件数待加载" : `${skill.fileCount} 个文件`}</span>}
        <span>{skill.updatedAt}</span>
      </div>
      <div className="skill-card__source"><SourceConfidence source={skill.source} compact /></div>
    </article>
  );
}
