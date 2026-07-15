import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, LoaderCircle, Radar, RefreshCw } from "lucide-react";
import { PageHeader, StatusBadge } from "@/shared/components/pro";
import type { CatalogSkill, SourceConfidenceData } from "@/shared/model/proTypes";
import { isTauriRuntime } from "@/shared/tauri/runtime";
import {
  inventoryApi,
  listenInventoryScanProgress,
  type InventoryApi,
} from "../api/inventoryApi";
import type { ScanProgressEvent, SkillInstance, SkillInstanceDetail, SourceEvidence, SourceResolution } from "../model";
import { SkillCatalog } from "../components/SkillCatalog";
import "../styles.css";

export interface InventoryPageProps {
  api?: InventoryApi;
}

function formatTime(value?: number) {
  return value ? new Date(value).toLocaleString() : "时间未知";
}

function sourceView(resolution: SourceResolution | undefined, evidence: SourceEvidence[] = []): SourceConfidenceData {
  if (!resolution) {
    return {
      label: "未知来源",
      type: "unknown",
      score: 0,
      status: "unknown",
      rationale: "当前索引没有足够的可验证来源证据",
      evidence: evidence.map((item) => item.evidenceValue ?? item.evidenceKey),
    };
  }
  return {
    label: resolution.sourceLabel,
    type: resolution.sourceType,
    score: resolution.confidence,
    status: resolution.resolutionStatus,
    rationale: resolution.rationale,
    evidence: evidence.map((item) => item.evidenceValue ?? item.evidenceKey),
  };
}

function catalogView(instance: SkillInstance, resolution?: SourceResolution, detail?: SkillInstanceDetail): CatalogSkill {
  const metadataTags = Array.isArray(instance.metadata.tags)
    ? instance.metadata.tags.filter((item): item is string => typeof item === "string")
    : [];
  const hasConflict = instance.duplicateKinds.includes("same_name_different_content");
  return {
    id: instance.id,
    name: instance.parsedName ?? instance.folderName,
    description: instance.shortDescription ?? instance.description ?? "暂无说明；可查看 SKILL.md 原文。",
    tags: metadataTags.length ? metadataTags : instance.headings.slice(0, 3),
    platforms: [instance.platformName ?? instance.scopeType],
    path: instance.absolutePath,
    source: sourceView(resolution ?? detail?.resolution, detail?.evidence),
    libraryState: instance.centralSkillId ? "managed" : "external",
    updatedAt: formatTime(instance.lastModifiedAt ?? instance.lastSeenAt),
    hasScripts: instance.hasScripts || instance.hasExecutables,
    duplicateState: hasConflict ? "conflict" : instance.duplicateKinds.length ? "duplicate" : "clean",
    fileCount: instance.fileCount,
  };
}

export function InventoryPage({ api = inventoryApi }: InventoryPageProps) {
  const [skills, setSkills] = useState<CatalogSkill[]>([]);
  const [rootCount, setRootCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [partialError, setPartialError] = useState("");
  const [scan, setScan] = useState<ScanProgressEvent | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setPartialError("");
    try {
      const [roots, result] = await Promise.all([
        api.listRoots(),
        api.listInstances({ includeMissing: false, limit: 200, offset: 0 }),
      ]);
      setRootCount(roots.filter((root) => root.enabled && root.available).length);
      const unresolved = result.items.filter((instance) => !result.resolutions?.[instance.id]);
      const detailResults = await Promise.allSettled(unresolved.map((instance) => api.getInstance(instance.id)));
      const detailById = new Map<string, SkillInstanceDetail>();
      let failedDetails = 0;
      detailResults.forEach((entry) => {
        if (entry.status === "fulfilled") detailById.set(entry.value.instance.id, entry.value);
        else failedDetails += 1;
      });
      setSkills(result.items.map((instance) => catalogView(instance, result.resolutions?.[instance.id], detailById.get(instance.id))));
      if (failedDetails) {
        setPartialError(`${failedDetails} 个实例的来源详情加载失败，列表仍显示本地索引字段。`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setSkills([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listenInventoryScanProgress((progress) => {
      if (disposed) return;
      setScan(progress);
      if (progress.status === "completed" || progress.status === "failed" || progress.status === "cancelled") {
        void load();
      }
    }).then((stop) => {
      if (disposed) stop();
      else unlisten = stop;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [load]);

  async function startScan() {
    setError("");
    try {
      const run = await api.startScan({ mode: "incremental" });
      setScan({
        runId: run.id,
        status: run.status,
        rootsTotal: run.rootsTotal,
        rootsCompleted: run.rootsCompleted,
        candidatesSeen: run.candidatesSeen,
        instancesChanged: run.instancesChanged,
        errorCount: run.errorCount,
      });
      if (run.status !== "running") await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  const scanLabel = useMemo(() => {
    if (!scan) return `${rootCount} 个扫描根在线`;
    if (scan.status === "running") return `扫描中 ${scan.rootsCompleted}/${scan.rootsTotal}`;
    if (scan.status === "failed") return `扫描失败 · ${scan.errorCount} 个错误`;
    if (scan.status === "cancelled") return "扫描已取消";
    return `扫描完成 · ${scan.instancesChanged} 项变化`;
  }, [rootCount, scan]);

  return (
    <div className="pro-page inventory-page">
      <div className="pro-page__inner">
        <PageHeader
          eyebrow="LOCAL INVENTORY"
          title="本机 Skill"
          subtitle="来自 Agent、插件缓存与项目目录的只读盘点。纳管前不会移动原文件。"
          actions={<><StatusBadge label={scanLabel} tone={scan?.status === "failed" ? "danger" : scan?.status === "running" ? "info" : "success"} /><button className="pro-button" type="button" onClick={startScan} disabled={scan?.status === "running"}><RefreshCw size={15} />重新扫描</button><button className="pro-button pro-button--primary" type="button"><Radar size={15} />管理扫描根</button></>}
        />
        {loading ? <div className="pro-empty glass-panel" role="status"><div><LoaderCircle size={28} /><strong>正在加载本机索引</strong><p>从 SQLite 读取现有结果，不会触碰外部 Skill。</p></div></div> : null}
        {error ? <div className="pro-empty glass-panel" role="alert"><div><AlertTriangle size={28} /><strong>本机索引加载失败</strong><p>{error}</p><button className="pro-button" type="button" onClick={load}>重试</button></div></div> : null}
        {partialError ? <div className="trash-notice glass-panel" role="status"><StatusBadge label="部分加载" tone="warning" /><span>{partialError}</span></div> : null}
        {!loading && !error ? <SkillCatalog skills={skills} statusLabel="真实本地索引 · 来源证据按实例加载" /> : null}
      </div>
    </div>
  );
}
