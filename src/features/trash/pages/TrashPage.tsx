import { useState } from "react";
import Modal from "antd/es/modal";
import { AlertTriangle, ArchiveRestore, MapPin, ShieldAlert, Trash2, X } from "lucide-react";
import { PageHeader, StatusBadge } from "@/shared/components/pro";
import { mockTrashEntries, type MockTrashEntry } from "@/shared/mock/proMockData";
import { purgeMockTrashEntry, restoreMockTrashEntry } from "../api/mockTrashApi";
import "../styles.css";

export function TrashPage() {
  const [entries, setEntries] = useState(mockTrashEntries);
  const [purging, setPurging] = useState<MockTrashEntry | null>(null);
  const [stage, setStage] = useState<1 | 2>(1);
  const [confirmation, setConfirmation] = useState("");
  const [notice, setNotice] = useState("");

  async function restore(entry: MockTrashEntry) {
    await restoreMockTrashEntry(entry.id);
    setEntries((items) => items.filter((item) => item.id !== entry.id));
    setNotice(`${entry.name} 已在 Mock 状态中恢复；未写入文件系统。`);
  }

  async function purge() {
    if (!purging || confirmation !== purging.name) return;
    await purgeMockTrashEntry(purging.id, confirmation);
    setEntries((items) => items.filter((item) => item.id !== purging.id));
    setNotice(`${purging.name} 已从 Mock 列表移除；未执行真实删除。`);
    closeModal();
  }

  function closeModal() {
    setPurging(null);
    setStage(1);
    setConfirmation("");
  }

  return (
    <div className="pro-page trash-page"><div className="pro-page__inner">
      <PageHeader eyebrow="RECOVERABLE BY DEFAULT" title="回收站" subtitle="中央 Skill 的删除默认进入应用回收站。第一代不会自动清空，也不提供列表外的任意路径删除。" />
      {notice ? <div className="trash-notice glass-panel" role="status"><StatusBadge label="Mock 操作完成" tone="info"/><span>{notice}</span><button type="button" aria-label="关闭提示" onClick={()=>setNotice("")}><X size={13}/></button></div> : null}
      <section className="trash-guard glass-panel"><span><ShieldAlert size={20}/></span><div><h2>安全边界已启用</h2><p>恢复冲突不会静默覆盖。永久删除只能从这里触发，并需要两步确认。</p></div><StatusBadge label={`${entries.length} 个项目`} tone="neutral"/></section>
      <div className="trash-list">
        {entries.map((entry) => <article key={entry.id} className="trash-card glass-panel"><div className="trash-card__icon"><Trash2 size={19}/></div><div className="trash-card__main"><div><h2>{entry.name}</h2><StatusBadge label={entry.size} tone="neutral"/></div><p><MapPin size={12}/><code>{entry.originalPath}</code></p><dl><div><dt>来源</dt><dd>{entry.source}</dd></div><div><dt>删除时间</dt><dd>{entry.deletedAt}</dd></div><div><dt>原映射</dt><dd>{entry.mappings.join(" · ")}</dd></div><div><dt>原因</dt><dd>{entry.reason}</dd></div></dl></div><div className="trash-card__actions"><button type="button" className="pro-button" onClick={()=>restore(entry)}><ArchiveRestore size={14}/>恢复</button><button type="button" className="pro-button pro-button--danger" onClick={()=>setPurging(entry)}><Trash2 size={14}/>永久删除</button></div></article>)}
        {!entries.length ? <div className="pro-empty glass-panel"><div><ArchiveRestore size={28}/><strong>回收站为空</strong><p>被恢复或永久移除的 Mock 项目不会再显示。</p></div></div> : null}
      </div>

      <Modal open={Boolean(purging)} onCancel={closeModal} footer={null} centered width={480} className="pro-confirm-modal" title={stage === 1 ? "确认影响范围" : "最终确认永久删除"}>
        {purging && stage === 1 ? <div className="purge-confirm"><span className="purge-confirm__warning"><AlertTriangle size={21}/></span><p>此操作将永久移除 <strong>{purging.name}</strong> 的回收站内容与恢复 manifest，之后无法从 Skill Studio Pro 恢复。</p><ul><li>回收站内容：{purging.size}</li><li>原映射记录：{purging.mappings.join("、")}</li><li>不会删除中央库与回收站以外的路径</li></ul><div className="purge-confirm__actions"><button type="button" className="pro-button" onClick={closeModal}>取消</button><button type="button" className="pro-button pro-button--danger" onClick={()=>setStage(2)}>继续最终确认</button></div></div> : null}
        {purging && stage === 2 ? <div className="purge-confirm"><p>输入 <strong>{purging.name}</strong> 以确认。此操作不可撤销。</p><label>Skill 名称<input autoFocus value={confirmation} onChange={(event)=>setConfirmation(event.target.value)} /></label><div className="purge-confirm__actions"><button type="button" className="pro-button" onClick={()=>setStage(1)}>返回</button><button type="button" className="pro-button pro-button--danger" disabled={confirmation !== purging.name} onClick={purge}>永久删除</button></div></div> : null}
      </Modal>
    </div></div>
  );
}
