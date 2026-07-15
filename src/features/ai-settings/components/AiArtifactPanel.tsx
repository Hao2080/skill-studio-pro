import { AlertTriangle, Ban, LoaderCircle, RotateCcw, Sparkles, Tags } from "lucide-react";
import { ModelAttribution } from "@/shared/model-attribution/ModelAttribution";
import { StatusBadge } from "@/shared/components/pro";
import type { AiArtifact, AiProviderConfig, AiTaskRoute, AiTaskType } from "../model";
import "../styles.css";

export type ArtifactRunState = "idle" | "running" | "success" | "error" | "cancelled" | "stale";

interface AiArtifactPanelProps {
  artifacts: AiArtifact[];
  providers: AiProviderConfig[];
  routes: AiTaskRoute[];
  runState: ArtifactRunState;
  errors: Array<{ taskType: AiTaskType; message: string }>;
  cacheHit: boolean;
  onGenerate(force: boolean): void;
  onCancel(): void;
}

function latest(artifacts: AiArtifact[], taskType: AiTaskType) {
  return artifacts
    .filter((artifact) => artifact.taskType === taskType)
    .sort((left, right) => right.createdAt - left.createdAt)[0];
}

function contentObject(artifact?: AiArtifact): Record<string, unknown> {
  return artifact?.content && typeof artifact.content === "object" && !Array.isArray(artifact.content)
    ? artifact.content as Record<string, unknown>
    : {};
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function attribution(artifact: AiArtifact) {
  return {
    provider: artifact.providerId,
    modelId: artifact.modelId,
    responsibility: artifact.responsibility,
    generatedAt: new Date(artifact.createdAt).toLocaleString(),
    state: artifact.status === "failed" ? "failed" as const : artifact.staleAt ? "stale" as const : "fresh" as const,
  };
}

export function AiArtifactPanel({
  artifacts,
  providers,
  routes,
  runState,
  errors,
  cacheHit,
  onGenerate,
  onCancel,
}: AiArtifactPanelProps) {
  const summary = latest(artifacts, "final_summary");
  const usage = latest(artifacts, "extract_usage");
  const tags = latest(artifacts, "suggest_tags");
  const classification = latest(artifacts, "classify");
  const stale = [summary, usage, tags, classification].some((artifact) => Boolean(artifact?.staleAt));
  const summaryContent = contentObject(summary);
  const usageContent = contentObject(usage);
  const tagContent = contentObject(tags);
  const classificationContent = contentObject(classification);
  const runningRoutes = routes
    .filter((route) => ["extract_usage", "suggest_tags", "classify", "final_summary"].includes(route.taskType))
    .map((route) => ({
      ...route,
      provider: providers.find((provider) => provider.providerId === route.providerId),
    }));

  return (
    <section className="glass-panel panel-padding ai-artifact-panel" aria-label="AI 简介与用法">
      <div className="skill-detail-section-head">
        <div>
          <h2>AI 简介与用法</h2>
          <p>按需发送当前 Skill 的最小必要内容；AI 生成内容可能有误，请以原文为准。</p>
        </div>
        <StatusBadge
          label={runState === "running" ? "running" : stale ? "stale" : runState}
          tone={runState === "error" ? "danger" : stale ? "warning" : runState === "success" ? "success" : "neutral"}
        />
      </div>

      {runState === "running" ? (
        <div className="ai-artifact-panel__running" role="status">
          <LoaderCircle size={18} />
          <div><strong>正在生成结构化用法与最终简介</strong>{runningRoutes.map((route) => <span key={route.taskType}>{route.taskType} · {route.provider?.displayName ?? route.providerId} · {route.modelId} · {route.responsibility}</span>)}</div>
          <button type="button" className="pro-button" onClick={onCancel}><Ban size={14} />取消</button>
        </div>
      ) : (
        <div className="ai-artifact-panel__actions">
          {!summary && !usage ? <button type="button" className="pro-button pro-button--primary" onClick={() => onGenerate(false)}><Sparkles size={14} />生成简介/用法</button> : null}
          {summary || usage ? <button type="button" className="pro-button" onClick={() => onGenerate(true)}><RotateCcw size={14} />{stale ? "重新生成过期内容" : "强制重新生成"}</button> : null}
          {cacheHit ? <span>本次命中现有缓存，没有重复计费。</span> : null}
        </div>
      )}

      {runState === "cancelled" ? <div className="ai-artifact-panel__notice" role="status">生成已取消；本地编辑、同步和回收站不受影响。</div> : null}
      {errors.length ? <div className="ai-artifact-panel__errors" role="alert"><AlertTriangle size={16} /><div><strong>部分任务失败，已保留成功结果</strong>{errors.map((error) => <span key={`${error.taskType}-${error.message}`}>{error.taskType}: {error.message}</span>)}</div></div> : null}

      <div className="ai-artifact-panel__results">
        <article>
          <h3>最终简介</h3>
          <strong>{typeof summaryContent.oneLineSummary === "string" ? summaryContent.oneLineSummary : "尚未生成最终简介"}</strong>
          {typeof summaryContent.details === "string" ? <p>{summaryContent.details}</p> : null}
          {summary ? <ModelAttribution {...attribution(summary)} compact onRegenerate={summary.staleAt ? () => onGenerate(true) : undefined} /> : null}
        </article>
        <article>
          <h3>结构化用法</h3>
          {stringList(usageContent.usagePoints).length ? <ul>{stringList(usageContent.usagePoints).map((item) => <li key={item}>{item}</li>)}</ul> : <p>尚未生成用法要点。</p>}
          {usage ? <ModelAttribution {...attribution(usage)} compact onRegenerate={usage.staleAt ? () => onGenerate(true) : undefined} /> : null}
        </article>
      </div>

      {tags || classification ? <div className="ai-artifact-panel__collection"><Tags size={14} /><span>{stringList(tagContent.tags).join(" · ") || "无标签候选"}</span><span>{typeof classificationContent.category === "string" ? `分类候选：${classificationContent.category}` : ""}</span></div> : null}
    </section>
  );
}
