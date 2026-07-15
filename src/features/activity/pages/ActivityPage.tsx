import { useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, Download, Filter, History, RefreshCw, Search } from "lucide-react";
import { PageHeader, StatusBadge } from "@/shared/components/pro";
import { mockActivities } from "@/shared/mock/proMockData";
import "../styles.css";

export function ActivityPage() {
  const [filter, setFilter] = useState("all");
  const filtered = useMemo(() => filter === "all" ? mockActivities : mockActivities.filter((item) => item.status === filter), [filter]);
  return (
    <div className="pro-page activity-page"><div className="pro-page__inner">
      <PageHeader eyebrow="LOCAL AUDIT TRAIL" title="操作记录" subtitle="回答“刚才发生了什么”。记录结果与恢复线索，不保存 API Key 或敏感正文。" actions={<button className="pro-button" type="button"><Download size={14}/>导出记录</button>} />
      <section className="activity-toolbar glass-panel"><label><Search size={14}/><input placeholder="搜索 Skill、平台或操作" aria-label="搜索操作记录" /></label><div><Filter size={13}/><select value={filter} onChange={(event)=>setFilter(event.target.value)} aria-label="结果筛选"><option value="all">全部结果</option><option value="success">成功</option><option value="warning">警告</option><option value="failed">失败</option></select></div><span>{filtered.length} 条 Mock 记录</span></section>
      <section className="activity-timeline glass-panel panel-padding" aria-label="操作时间线">
        {filtered.map((item) => <article key={item.id}><span className={`activity-timeline__icon is-${item.status}`}>{item.status === "success" ? <CheckCircle2 size={16}/>:<CircleAlert size={16}/>}</span><div><div><strong>{item.title}</strong><StatusBadge label={item.status === "success" ? "成功" : item.status === "warning" ? "部分完成" : "失败"} tone={item.status === "success" ? "success" : item.status === "warning" ? "warning" : "danger"}/></div><h2>{item.target}</h2><p>{item.detail}</p></div><time>{item.time}</time>{item.status !== "success" ? <button type="button"><RefreshCw size={12}/>查看下一步</button> : <span className="activity-timeline__spacer" />}</article>)}
        {!filtered.length ? <div className="pro-empty"><div><History size={26}/><p>当前筛选下没有记录。</p></div></div> : null}
      </section>
    </div></div>
  );
}
