import { useCallback, useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { AlertTriangle, CheckCircle2, CircleAlert, Download, Filter, History, LoaderCircle, RefreshCw, Search } from "lucide-react";
import { PageHeader, StatusBadge } from "@/shared/components/pro";
import { isTauriRuntime } from "@/shared/tauri/runtime";
import { activityApi, type ActivityApi } from "../api/activityApi";
import type { OperationLog } from "../model";
import "../styles.css";

export interface ActivityPageProps {
  api?: ActivityApi;
}

function tone(status: string) {
  if (status === "success" || status === "completed") return "success" as const;
  if (status === "failed") return "danger" as const;
  return "warning" as const;
}

function statusLabel(status: string) {
  if (status === "success" || status === "completed") return "成功";
  if (status === "partial_success") return "部分完成";
  if (status === "failed") return "失败";
  if (status === "planned") return "已预览";
  return status;
}

export function ActivityPage({ api = activityApi }: ActivityPageProps) {
  const [items, setItems] = useState<OperationLog[]>([]);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await api.list({ limit: 200, offset: 0 }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let stop: (() => void) | undefined;
    void listen("operation://updated", () => void load()).then((unlisten) => { stop = unlisten; });
    return () => stop?.();
  }, [load]);

  const filtered = useMemo(() => items.filter((item) => {
    const matchesFilter = filter === "all" || (filter === "warning" ? item.status === "partial_success" || item.status === "planned" : item.status === filter || (filter === "success" && item.status === "completed"));
    const normalized = query.trim().toLowerCase();
    const matchesQuery = !normalized || [item.operationType, item.targetLabel, item.entityId, item.errorSummary].filter(Boolean).join(" ").toLowerCase().includes(normalized);
    return matchesFilter && matchesQuery;
  }), [filter, items, query]);

  return (
    <div className="pro-page activity-page"><div className="pro-page__inner">
      <PageHeader eyebrow="LOCAL AUDIT TRAIL" title="操作记录" subtitle="回答“刚才发生了什么”。记录结果与恢复线索，不保存 API Key 或敏感正文。" actions={<><button className="pro-button" type="button" onClick={load}><RefreshCw size={14}/>刷新</button><button className="pro-button" type="button" disabled><Download size={14}/>导出记录</button></>} />
      <section className="activity-toolbar glass-panel"><label><Search size={14}/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="搜索 Skill、平台或操作" aria-label="搜索操作记录" /></label><div><Filter size={13}/><select value={filter} onChange={(event)=>setFilter(event.target.value)} aria-label="结果筛选"><option value="all">全部结果</option><option value="success">成功</option><option value="warning">部分完成/计划</option><option value="failed">失败</option></select></div><span>{filtered.length} 条真实记录</span></section>
      <section className="activity-timeline glass-panel panel-padding" aria-label="操作时间线">
        {loading ? <div className="pro-empty" role="status"><div><LoaderCircle size={26}/><p>正在加载操作记录。</p></div></div> : null}
        {error ? <div className="pro-empty" role="alert"><div><AlertTriangle size={26}/><strong>操作记录加载失败</strong><p>{error}</p><button className="pro-button" type="button" onClick={load}>重试</button></div></div> : null}
        {!loading && !error ? filtered.map((item) => <article key={item.id}><span className={`activity-timeline__icon is-${item.status}`}>{tone(item.status) === "success" ? <CheckCircle2 size={16}/>:<CircleAlert size={16}/>}</span><div><div><strong>{item.operationType}</strong><StatusBadge label={statusLabel(item.status)} tone={tone(item.status)}/></div><h2>{item.targetLabel}</h2><p>{item.errorSummary ?? `实体：${item.entityType}${item.entityId ? ` · ${item.entityId}` : ""}`}</p></div><time>{new Date(item.createdAt).toLocaleString()}</time>{item.status !== "success" && item.status !== "completed" ? <button type="button" disabled><RefreshCw size={12}/>查看下一步</button> : <span className="activity-timeline__spacer" />}</article>) : null}
        {!loading && !error && !filtered.length ? <div className="pro-empty"><div><History size={26}/><p>当前筛选下没有记录。</p></div></div> : null}
      </section>
    </div></div>
  );
}
