import { BadgeCheck, CircleHelp, GitBranch, ShieldCheck } from "lucide-react";
import type { SourceConfidenceData } from "@/shared/model/proTypes";
import { StatusBadge } from "./pro";
import "./source-confidence.css";

interface SourceConfidenceProps {
  source: SourceConfidenceData;
  compact?: boolean;
}

const statusCopy = {
  confirmed: { label: "已确认", tone: "success" as const, Icon: BadgeCheck },
  inferred: { label: "推断", tone: "warning" as const, Icon: GitBranch },
  unknown: { label: "未知", tone: "neutral" as const, Icon: CircleHelp },
};

export function SourceConfidence({ source, compact = false }: SourceConfidenceProps) {
  const state = statusCopy[source.status];
  return (
    <section className={`source-confidence${compact ? " source-confidence--compact" : ""}`} aria-label={`来源可信度 ${source.score}%`}>
      <div className="source-confidence__header">
        <span className="source-confidence__icon" aria-hidden="true"><state.Icon size={16} /></span>
        <div className="source-confidence__title-wrap">
          <span className="source-confidence__kicker">来源结论</span>
          <strong>{source.label}</strong>
        </div>
        <span className="source-confidence__score" aria-label={`可信度百分比 ${source.score}%`}>{source.score}<small>%</small></span>
      </div>
      <div className="source-confidence__meter" aria-hidden="true"><span style={{ width: `${source.score}%` }} /></div>
      <div className="source-confidence__summary">
        <StatusBadge label={state.label} tone={state.tone} />
        <span>{source.rationale}</span>
      </div>
      {!compact ? (
        <ul className="source-confidence__evidence">
          {source.evidence.map((item) => <li key={item}><ShieldCheck size={13} aria-hidden="true" />{item}</li>)}
        </ul>
      ) : null}
      <p className="source-confidence__notice">可信度描述来源判断强度，不代表安全评分。</p>
    </section>
  );
}
