import type { StatusTone } from "@/shared/mock/proMockData";

interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
  className?: string;
}

export function StatusBadge({ label, tone = "neutral", className = "" }: StatusBadgeProps) {
  return <span className={`status-badge status-badge--${tone} ${className}`.trim()}>{label}</span>;
}
