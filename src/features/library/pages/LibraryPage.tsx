import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, FilePlus2, GitPullRequestArrow, Library, LoaderCircle, Plus, Radio } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader, StatusBadge } from "@/shared/components/pro";
import type { CatalogSkill } from "@/shared/model/proTypes";
import { SkillCatalog } from "@/features/inventory/components/SkillCatalog";
import { libraryApi, type LibraryApi } from "../api/libraryApi";
import type { CentralSkill, MappingState } from "../model";
import "@/features/inventory/styles.css";
import "../styles.css";

export interface LibraryPageProps {
  api?: LibraryApi;
}

interface LibraryRow {
  skill: CentralSkill;
  mappings: MappingState[];
}

function toCatalog({ skill, mappings }: LibraryRow): CatalogSkill {
  const drifted = mappings.some((mapping) => ["drifted", "ownership_mismatch"].includes(mapping.driftStatus));
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description ?? "中央库主副本；打开详情查看文件、快照与发布状态。",
    tags: [],
    platforms: mappings.map((mapping) => mapping.platformName),
    path: skill.storagePath,
    source: {
      label: "Skill Studio Pro 中央库",
      type: "central_library",
      score: 100,
      status: "confirmed",
      rationale: `应用管理的稳定 UUID：${skill.id}`,
      evidence: ["中央库数据库记录与受管存储路径一致", "显示名称和 slug 变更不会改变内部身份"],
    },
    libraryState: drifted ? "drifted" : "managed",
    updatedAt: new Date(skill.updatedAt).toLocaleString(),
    duplicateState: "clean",
  };
}

export function LibraryPage({ api = libraryApi }: LibraryPageProps) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<LibraryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [partialError, setPartialError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setPartialError("");
    try {
      const skills = await api.list();
      const states = await Promise.allSettled(skills.map((skill) => api.detectDrift(skill.id)));
      let failed = 0;
      setRows(skills.map((skill, index) => {
        const state = states[index];
        if (state.status === "rejected") failed += 1;
        return { skill, mappings: state.status === "fulfilled" ? state.value : [] };
      }));
      if (failed) setPartialError(`${failed} 个主副本的映射状态检查失败，主副本列表仍可用。`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const catalog = useMemo(() => rows.map(toCatalog), [rows]);
  const mappingCount = rows.reduce((total, row) => total + row.mappings.length, 0);
  const driftCount = rows.reduce((total, row) => total + row.mappings.filter((mapping) => ["drifted", "ownership_mismatch"].includes(mapping.driftStatus)).length, 0);
  const outdatedCount = rows.reduce((total, row) => total + row.mappings.filter((mapping) => mapping.driftStatus === "outdated").length, 0);

  return (
    <div className="pro-page library-page">
      <div className="pro-page__inner">
        <PageHeader eyebrow="SINGLE SOURCE OF TRUTH" title="中央库" subtitle="以唯一主副本服务多个 Agent。发布、编辑和删除都有明确恢复路径。" actions={<><button type="button" className="pro-button"><Plus size={15} />新建 Skill</button><button type="button" className="pro-button pro-button--primary" onClick={() => navigate("/discover")}><FilePlus2 size={15} />导入中央库</button></>} />
        <section className="library-strip glass-panel">
          <div><Library size={17} /><span><strong>{rows.length}</strong> 个主副本</span></div>
          <div><Radio size={17} /><span><strong>{mappingCount}</strong> 个 Agent 映射</span></div>
          <div><GitPullRequestArrow size={17} /><span><strong>{outdatedCount}</strong> 项未发布修改</span></div>
          <StatusBadge label={`${driftCount} 项漂移需处理`} tone={driftCount ? "warning" : "success"} />
        </section>
        {loading ? <div className="pro-empty glass-panel" role="status"><div><LoaderCircle size={28} /><strong>正在加载中央库</strong><p>读取稳定 UUID 主副本与映射状态。</p></div></div> : null}
        {error ? <div className="pro-empty glass-panel" role="alert"><div><AlertTriangle size={28} /><strong>中央库加载失败</strong><p>{error}</p><button className="pro-button" type="button" onClick={load}>重试</button></div></div> : null}
        {partialError ? <div className="trash-notice glass-panel" role="status"><StatusBadge label="部分加载" tone="warning" /><span>{partialError}</span></div> : null}
        {!loading && !error ? <SkillCatalog skills={catalog} mode="library" statusLabel="中央库真实记录 · 映射状态已校验" /> : null}
      </div>
    </div>
  );
}
