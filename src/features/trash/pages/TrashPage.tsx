import { useCallback, useEffect, useState } from "react";
import Modal from "antd/es/modal";
import { AlertTriangle, ArchiveRestore, LoaderCircle, MapPin, ShieldAlert, Trash2, X } from "lucide-react";
import { PageHeader, StatusBadge } from "@/shared/components/pro";
import { trashApi, type TrashApi } from "../api/trashApi";
import type { TrashEntry } from "../model";
import "../styles.css";

export interface TrashPageProps {
  api?: TrashApi;
}

function mappingNames(entry: TrashEntry): string[] {
  try {
    const related = JSON.parse(entry.relatedStateJson) as { mappings?: Array<{ platformName?: string }> };
    return related.mappings?.map((mapping) => mapping.platformName).filter((value): value is string => Boolean(value)) ?? [];
  } catch {
    return [];
  }
}

export function TrashPage({ api = trashApi }: TrashPageProps) {
  const [entries, setEntries] = useState<TrashEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [purging, setPurging] = useState<TrashEntry | null>(null);
  const [stage, setStage] = useState<1 | 2>(1);
  const [confirmation, setConfirmation] = useState("");
  const [restoreConflict, setRestoreConflict] = useState<TrashEntry | null>(null);
  const [restoreName, setRestoreName] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setEntries(await api.list());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  async function executeRestore(entry: TrashEntry, mode: "original" | "new_name", newName?: string) {
    setError("");
    try {
      const plan = await api.createRestorePlan({ trashEntryId: entry.id, mode, newName });
      if (plan.conflict) {
        setRestoreConflict(entry);
        setRestoreName(`${entry.displayName}-restored`);
        setNotice(`原位置存在冲突：${plan.conflict}。未覆盖任何文件。`);
        return;
      }
      await api.executeRestore(plan.id, plan.planHash);
      setEntries((items) => items.filter((item) => item.id !== entry.id));
      setRestoreConflict(null);
      setNotice(`${entry.displayName} 已恢复；原 Agent 映射不会自动重新发布。`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  async function purge() {
    if (!purging || confirmation !== purging.displayName) return;
    setError("");
    try {
      const token = await api.createPurgeConfirmation(purging.id);
      await api.executePurge(purging.id, token.confirmationToken);
      setEntries((items) => items.filter((item) => item.id !== purging.id));
      setNotice(`${purging.displayName} 已永久删除。后端仅按回收站 ID 解析受限路径。`);
      closePurgeModal();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  function closePurgeModal() {
    setPurging(null);
    setStage(1);
    setConfirmation("");
  }

  return (
    <div className="pro-page trash-page"><div className="pro-page__inner">
      <PageHeader eyebrow="RECOVERABLE BY DEFAULT" title="回收站" subtitle="中央 Skill 的删除默认进入应用回收站。第一代不会自动清空，也不提供列表外的任意路径删除。" />
      {notice ? <div className="trash-notice glass-panel" role="status"><StatusBadge label="操作状态" tone="info"/><span>{notice}</span><button type="button" aria-label="关闭提示" onClick={()=>setNotice("")}><X size={13}/></button></div> : null}
      {error ? <div className="trash-notice glass-panel" role="alert"><StatusBadge label="操作失败" tone="danger"/><span>{error}</span><button type="button" aria-label="关闭错误" onClick={()=>setError("")}><X size={13}/></button></div> : null}
      <section className="trash-guard glass-panel"><span><ShieldAlert size={20}/></span><div><h2>安全边界已启用</h2><p>恢复冲突不会静默覆盖。永久删除只能从这里触发，并需要两步确认和后端短期 Token。</p></div><StatusBadge label={`${entries.length} 个项目`} tone="neutral"/></section>
      {loading ? <div className="pro-empty glass-panel" role="status"><div><LoaderCircle size={28}/><strong>正在加载回收站</strong></div></div> : null}
      {!loading ? <div className="trash-list">
        {entries.map((entry) => { const mappings = mappingNames(entry); return <article key={entry.id} className="trash-card glass-panel"><div className="trash-card__icon"><Trash2 size={19}/></div><div className="trash-card__main"><div><h2>{entry.displayName}</h2><StatusBadge label={`哈希 ${entry.contentHash.slice(0, 8)}…`} tone="neutral"/></div><p><MapPin size={12}/><code>{entry.originalPath}</code></p><dl><div><dt>实体</dt><dd>{entry.entityType}</dd></div><div><dt>删除时间</dt><dd>{new Date(entry.deletedAt).toLocaleString()}</dd></div><div><dt>原映射</dt><dd>{mappings.length ? mappings.join(" · ") : "无"}</dd></div><div><dt>状态</dt><dd>{entry.status}</dd></div></dl></div><div className="trash-card__actions"><button type="button" className="pro-button" onClick={()=>void executeRestore(entry, "original")}><ArchiveRestore size={14}/>恢复</button><button type="button" className="pro-button pro-button--danger" onClick={()=>setPurging(entry)}><Trash2 size={14}/>永久删除</button></div></article>; })}
        {!entries.length ? <div className="pro-empty glass-panel"><div><ArchiveRestore size={28}/><strong>回收站为空</strong><p>当前没有可恢复项目。</p></div></div> : null}
      </div> : null}

      <Modal open={Boolean(restoreConflict)} onCancel={() => setRestoreConflict(null)} footer={null} centered width={480} className="pro-confirm-modal" title="恢复为新名称">
        {restoreConflict ? <div className="purge-confirm"><p>原位置冲突，不会静默覆盖。输入新名称后重新创建恢复计划。</p><label>新名称<input value={restoreName} onChange={(event)=>setRestoreName(event.target.value)} /></label><div className="purge-confirm__actions"><button type="button" className="pro-button" onClick={()=>setRestoreConflict(null)}>取消</button><button type="button" className="pro-button pro-button--primary" disabled={!restoreName.trim()} onClick={()=>void executeRestore(restoreConflict, "new_name", restoreName.trim())}>恢复为新名称</button></div></div> : null}
      </Modal>

      <Modal open={Boolean(purging)} onCancel={closePurgeModal} footer={null} centered width={480} className="pro-confirm-modal" title={stage === 1 ? "确认影响范围" : "最终确认永久删除"}>
        {purging && stage === 1 ? <div className="purge-confirm"><span className="purge-confirm__warning"><AlertTriangle size={21}/></span><p>此操作将永久移除 <strong>{purging.displayName}</strong> 的回收站内容与恢复 manifest，之后无法从 Skill Studio Pro 恢复。</p><ul><li>回收站条目：{purging.id}</li><li>原映射记录：{mappingNames(purging).join("、") || "无"}</li><li>后端不接受任意文件路径</li></ul><div className="purge-confirm__actions"><button type="button" className="pro-button" onClick={closePurgeModal}>取消</button><button type="button" className="pro-button pro-button--danger" onClick={()=>setStage(2)}>继续最终确认</button></div></div> : null}
        {purging && stage === 2 ? <div className="purge-confirm"><p>输入 <strong>{purging.displayName}</strong> 以确认。此操作不可撤销。</p><label>Skill 名称<input autoFocus value={confirmation} onChange={(event)=>setConfirmation(event.target.value)} /></label><div className="purge-confirm__actions"><button type="button" className="pro-button" onClick={()=>setStage(1)}>返回</button><button type="button" className="pro-button pro-button--danger" disabled={confirmation !== purging.displayName} onClick={()=>void purge()}>永久删除</button></div></div> : null}
      </Modal>
    </div></div>
  );
}
