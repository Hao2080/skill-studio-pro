import type { ReactNode } from "react";

interface MetricCardProps {
  icon: ReactNode;
  value: string | number;
  label: string;
  trend?: string;
}

export function MetricCard({ icon, value, label, trend }: MetricCardProps) {
  return (
    <article className="metric-card glass-panel">
      <div className="metric-card__top">
        <span className="metric-card__icon" aria-hidden="true">{icon}</span>
        {trend ? <span className="metric-card__trend">{trend}</span> : null}
      </div>
      <div className="metric-card__value">{value}</div>
      <div className="metric-card__label">{label}</div>
    </article>
  );
}
