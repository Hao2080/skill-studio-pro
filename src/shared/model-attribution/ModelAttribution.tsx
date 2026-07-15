import { Bot, Clock3, RotateCcw, Sparkles } from "lucide-react";
import type { ModelAttributionData } from "@/shared/mock/proMockData";
import { StatusBadge } from "@/shared/components/pro";
import "./styles.css";

interface ModelAttributionProps extends ModelAttributionData {
  compact?: boolean;
  onRegenerate?: () => void;
}

const statePresentation = {
  fresh: { label: "最新", tone: "success" as const },
  stale: { label: "已过期", tone: "warning" as const },
  failed: { label: "生成失败", tone: "danger" as const },
  disabled: { label: "已禁用", tone: "neutral" as const },
};

export function ModelAttribution({ provider, modelId, responsibility, generatedAt, state, compact = false, onRegenerate }: ModelAttributionProps) {
  const presentation = statePresentation[state];
  return (
    <section className={`model-attribution${compact ? " model-attribution--compact" : ""}`} aria-label="模型归属信息">
      <div className="model-attribution__leading">
        <span className="model-attribution__icon" aria-hidden="true"><Sparkles size={15} /></span>
        <div>
          <div className="model-attribution__identity"><strong>{provider}</strong><code>{modelId}</code></div>
          <div className="model-attribution__role"><Bot size={12} aria-hidden="true" />{responsibility}</div>
        </div>
      </div>
      <div className="model-attribution__meta">
        <span><Clock3 size={12} aria-hidden="true" />{generatedAt}</span>
        <StatusBadge label={presentation.label} tone={presentation.tone} />
        {state === "stale" && onRegenerate ? (
          <button type="button" className="model-attribution__action" onClick={onRegenerate} aria-label="重新生成模型内容"><RotateCcw size={13} />重新生成</button>
        ) : null}
      </div>
    </section>
  );
}
