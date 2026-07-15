import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, FolderPlus, LoaderCircle, Pause, Play, Radar, RefreshCw, Save } from "lucide-react";
import { PageHeader, StatusBadge } from "@/shared/components/pro";
import { isTauriRuntime } from "@/shared/tauri/runtime";
import { inventoryApi, listenInventoryScanProgress, type InventoryApi } from "../api/inventoryApi";
import type { ScanProgressEvent, ScanRoot, ScanRootType } from "../model";
import "../styles.css";

interface ScanRootDraft {
  rootType: ScanRootType;
  platformName: string;
  path: string;
  enabled: boolean;
  recursive: boolean;
  watchEnabled: boolean;
}

export interface ScanRootsPanelProps {
  api?: InventoryApi;
  pickDirectory?(): Promise<string | null>;
  listenProgress?: typeof listenInventoryScanProgress;
}

const NEW_ROOT: ScanRootDraft = {
  rootType: "custom",
  platformName: "",
  path: "",
  enabled: true,
  recursive: true,
  watchEnabled: true,
};

function draftFromRoot(root: ScanRoot): ScanRootDraft {
  return {
    rootType: root.rootType,
    platformName: root.platformName ?? "",
    path: root.path,
    enabled: root.enabled,
    recursive: root.recursive,
    watchEnabled: root.watchEnabled,
  };
}

export function ScanRootsPanel({ api = inventoryApi, pickDirectory, listenProgress }: ScanRootsPanelProps) {
  const [roots, setRoots] = useState<ScanRoot[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ScanRootDraft>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [newRoot, setNewRoot] = useState<ScanRootDraft>(NEW_ROOT);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [partialErrors, setPartialErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const activeRunId = useRef("");
  const pendingProgress = useRef(new Map<string, ScanProgressEvent>());
  const progressListener = listenProgress ?? (isTauriRuntime() ? listenInventoryScanProgress : undefined);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await api.listRoots();
      setRoots(next);
      setDrafts(Object.fromEntries(next.map((root) => [root.id, draftFromRoot(root)])));
      setSelectedIds((current) => new Set([...current].filter((id) => next.some((root) => root.id === id))));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  const applyProgress = useCallback((progress: ScanProgressEvent) => {
    pendingProgress.current.set(progress.runId, progress);
    if (progress.runId !== activeRunId.current) return;
    setNotice(`扫描 ${progress.status}：${progress.rootsCompleted}/${progress.rootsTotal} 个根，发现 ${progress.candidatesSeen} 个候选，${progress.errorCount} 个错误。`);
    if (progress.status !== "running") {
      activeRunId.current = "";
      setScanning(false);
      void load();
    }
  }, [load]);

  useEffect(() => {
    if (!progressListener) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void progressListener((progress) => {
      if (!disposed) applyProgress(progress);
    }).then((stop) => {
      if (disposed) stop();
      else unlisten = stop;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [applyProgress, progressListener]);

  const activeCount = useMemo(() => roots.filter((root) => root.enabled).length, [roots]);
  const availableCount = useMemo(() => roots.filter((root) => root.available).length, [roots]);

  function updateDraft(id: string, patch: Partial<ScanRootDraft>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }

  async function saveRoot(root: ScanRoot, patch: Partial<ScanRootDraft> = {}) {
    const draft = { ...(drafts[root.id] ?? draftFromRoot(root)), ...patch };
    setSavingId(root.id);
    setPartialErrors((current) => ({ ...current, [root.id]: "" }));
    try {
      const saved = await api.upsertRoot({
        id: root.id,
        rootType: draft.rootType,
        platformName: draft.platformName.trim() || undefined,
        path: draft.path.trim(),
        enabled: draft.enabled,
        recursive: draft.recursive,
        watchEnabled: draft.watchEnabled,
        ignoreRules: root.ignoreRules,
      });
      setRoots((current) => current.map((item) => item.id === saved.id ? saved : item));
      setDrafts((current) => ({ ...current, [saved.id]: draftFromRoot(saved) }));
      setNotice(`${saved.path} 的扫描根配置已保存；磁盘目录未被移动或删除。`);
    } catch (reason) {
      setPartialErrors((current) => ({ ...current, [root.id]: reason instanceof Error ? reason.message : String(reason) }));
    } finally {
      setSavingId("");
    }
  }

  async function createRoot() {
    if (!newRoot.path.trim()) {
      setError("请先选择或输入扫描根目录。");
      return;
    }
    setSavingId("new");
    setError("");
    try {
      const saved = await api.upsertRoot({
        rootType: newRoot.rootType,
        platformName: newRoot.platformName.trim() || undefined,
        path: newRoot.path.trim(),
        enabled: newRoot.enabled,
        recursive: newRoot.recursive,
        watchEnabled: newRoot.watchEnabled,
        ignoreRules: [],
      });
      setRoots((current) => [...current, saved]);
      setDrafts((current) => ({ ...current, [saved.id]: draftFromRoot(saved) }));
      setNewRoot(NEW_ROOT);
      setAdding(false);
      setNotice("扫描根已添加。首次扫描仍只建立索引，不会修改目录内容。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSavingId("");
    }
  }

  async function chooseDirectory(target: "new" | string) {
    if (!pickDirectory) return;
    const selected = await pickDirectory();
    if (!selected) return;
    if (target === "new") setNewRoot((current) => ({ ...current, path: selected }));
    else updateDraft(target, { path: selected });
  }

  async function scan(mode: "incremental" | "full") {
    if (!selectedIds.size) {
      setError("请至少选择一个扫描根。");
      return;
    }
    setScanning(true);
    setError("");
    try {
      const run = await api.startScan({ mode, rootIds: [...selectedIds] });
      activeRunId.current = run.id;
      setNotice(`扫描 ${run.status}：${run.rootsCompleted}/${run.rootsTotal} 个根，发现 ${run.candidatesSeen} 个候选，${run.errorCount} 个错误。`);
      const progress = pendingProgress.current.get(run.id);
      if (progress) applyProgress(progress);
      else if (run.status !== "running") {
        activeRunId.current = "";
        setScanning(false);
        await load();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      activeRunId.current = "";
      setScanning(false);
    }
  }

  return (
    <section className="scan-roots-panel" aria-label="扫描根管理">
      <PageHeader eyebrow="INVENTORY ROOTS" title="扫描根管理" subtitle="添加、编辑、停用和扫描选定目录。停用只更新应用配置，不删除磁盘目录。" actions={<><button type="button" className="pro-button" onClick={() => void scan("incremental")} disabled={scanning || !selectedIds.size}><Radar size={14} />扫描选定根</button><button type="button" className="pro-button" onClick={() => void scan("full")} disabled={scanning || !selectedIds.size}><RefreshCw size={14} />强制全量扫描</button><button type="button" className="pro-button pro-button--primary" onClick={() => setAdding((value) => !value)}><FolderPlus size={14} />添加扫描根</button></>} />
      <div className="platform-summary glass-panel"><div><Radar size={15}/>扫描根 <strong>{roots.length}</strong></div><div><Play size={15}/>已启用 <strong>{activeCount}</strong></div><div><RefreshCw size={15}/>可用 <strong>{availableCount}</strong></div><StatusBadge label={scanning ? "扫描中" : "可手动扫描"} tone={scanning ? "info" : "success"}/></div>
      {error ? <div className="trash-notice glass-panel" role="alert"><StatusBadge label="扫描根错误" tone="danger"/><span>{error}</span><button type="button" className="pro-button" onClick={() => void load()}>重试</button></div> : null}
      {notice ? <div className="trash-notice glass-panel" role="status"><StatusBadge label="状态" tone="success"/><span>{notice}</span></div> : null}
      {loading ? <div className="pro-empty glass-panel" role="status"><div><LoaderCircle size={24}/><strong>正在读取扫描根</strong></div></div> : null}

      {adding ? <div className="scan-root-editor glass-panel"><label>根类型<select value={newRoot.rootType} onChange={(event)=>setNewRoot((current)=>({...current,rootType:event.target.value as ScanRootType}))}><option value="custom">自定义</option><option value="plugin_cache">插件缓存</option><option value="project">项目</option></select></label><label>平台（可选）<input value={newRoot.platformName} onChange={(event)=>setNewRoot((current)=>({...current,platformName:event.target.value}))}/></label><label className="is-path">绝对路径<span><input value={newRoot.path} onChange={(event)=>setNewRoot((current)=>({...current,path:event.target.value}))}/>{pickDirectory?<button type="button" className="pro-button" onClick={()=>void chooseDirectory("new")}>选择目录</button>:null}</span></label><label><input type="checkbox" checked={newRoot.recursive} onChange={(event)=>setNewRoot((current)=>({...current,recursive:event.target.checked}))}/>递归</label><label><input type="checkbox" checked={newRoot.watchEnabled} onChange={(event)=>setNewRoot((current)=>({...current,watchEnabled:event.target.checked}))}/>文件监听</label><button type="button" className="pro-button pro-button--primary" onClick={()=>void createRoot()} disabled={savingId==="new"}><Save size={14}/>保存扫描根</button></div> : null}

      <div className="scan-root-list">
        {roots.map((root) => {
          const draft = drafts[root.id] ?? draftFromRoot(root);
          return <article key={root.id} className="scan-root-card glass-panel"><label className="scan-root-card__select"><input type="checkbox" checked={selectedIds.has(root.id)} onChange={(event)=>setSelectedIds((current)=>{const next=new Set(current);if(event.target.checked)next.add(root.id);else next.delete(root.id);return next;})} aria-label={`选择扫描根 ${root.path}`}/></label><div className="scan-root-card__body"><div className="scan-root-card__head"><div><strong>{root.platformName ?? root.rootType}</strong><code>{root.normalizedPath}</code></div><StatusBadge label={root.available?"可用":"不可用"} tone={root.available?"success":"danger"}/><StatusBadge label={draft.watchEnabled?(root.available?"监听已配置":"监听不可用"):"监听关闭"} tone={draft.watchEnabled&&root.available?"info":"neutral"}/></div><div className="scan-root-editor is-inline"><label className="is-path">目录<span><input value={draft.path} onChange={(event)=>updateDraft(root.id,{path:event.target.value})}/>{pickDirectory?<button type="button" className="pro-button" onClick={()=>void chooseDirectory(root.id)}>选择</button>:null}</span></label><label><input type="checkbox" checked={draft.recursive} onChange={(event)=>updateDraft(root.id,{recursive:event.target.checked})}/>递归</label><label><input type="checkbox" checked={draft.watchEnabled} onChange={(event)=>updateDraft(root.id,{watchEnabled:event.target.checked})}/>监听</label><button type="button" className="pro-button" onClick={()=>void saveRoot(root)} disabled={savingId===root.id}><Save size={14}/>保存</button><button type="button" className="pro-button" onClick={()=>void saveRoot(root,{enabled:!draft.enabled})} disabled={savingId===root.id}>{draft.enabled?<><Pause size={14}/>停用</>:<><Play size={14}/>启用</>}</button></div><small>最近扫描：{root.lastScanAt?new Date(root.lastScanAt).toLocaleString():"尚未扫描"}</small>{partialErrors[root.id]?<div className="scan-root-card__error" role="alert"><AlertTriangle size={14}/>{partialErrors[root.id]}</div>:null}</div></article>;
        })}
        {!loading && !roots.length ? <div className="pro-empty glass-panel"><div><strong>尚未配置扫描根</strong><p>添加目录后可只扫描选定根。</p></div></div> : null}
      </div>
    </section>
  );
}
