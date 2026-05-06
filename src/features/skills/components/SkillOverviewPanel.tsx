import { useEffect, useMemo, useState } from "react";
import Button from "antd/es/button";
import { AlertTriangle, ArrowRight, X } from "lucide-react";
import { useI18n } from "@/features/settings/state/I18nContext";
import type {
  SkillOverviewAction,
  SkillOverviewActivityItem,
  SkillOverviewAttentionItem,
  SkillOverviewLifecycleNode,
  SkillOverviewSummaryItem,
  SkillOverviewViewModel,
} from "../model/skillOverview";

interface SkillOverviewPanelProps {
  skillId: string;
  model: SkillOverviewViewModel;
  onAction: (action: SkillOverviewAction) => void;
}

function getActionClassName(action: SkillOverviewAction) {
  switch (action.emphasis) {
    case "primary":
      return "skill-overview__action skill-overview__action--primary";
    case "ghost":
      return "skill-overview__action skill-overview__action--ghost";
    default:
      return "skill-overview__action skill-overview__action--secondary";
  }
}

function getToneClassName(tone: string) {
  switch (tone) {
    case "ready":
      return "is-ready";
    case "warning":
      return "is-warning";
    case "active":
      return "is-active";
    default:
      return "is-neutral";
  }
}

function getSeverityLabel(item: SkillOverviewAttentionItem, locale: "zh-CN" | "en-US") {
  if (locale === "en-US") {
    switch (item.severity) {
      case "blocker":
        return "Blocker";
      case "attention":
        return "Needs Action";
      default:
        return "Watch";
    }
  }

  switch (item.severity) {
    case "blocker":
      return "阻塞";
    case "attention":
      return "待处理";
    default:
      return "观察";
  }
}

function getSeverityTone(item: SkillOverviewAttentionItem) {
  switch (item.severity) {
    case "blocker":
      return "warning";
    case "attention":
      return "active";
    default:
      return "neutral";
  }
}

function getActivityKindLabel(item: SkillOverviewActivityItem, locale: "zh-CN" | "en-US") {
  if (locale === "en-US") {
    switch (item.kind) {
      case "release":
        return "Platform";
      case "delivery":
        return "Team";
      default:
        return "Snapshot";
    }
  }

  switch (item.kind) {
    case "release":
      return "平台";
    case "delivery":
      return "团队";
    default:
      return "快照";
  }
}

function renderSummaryItem(
  item: SkillOverviewSummaryItem,
  onAction: (action: SkillOverviewAction) => void,
  metricAria: (label: string, value: string) => string,
) {
  return (
    <button
      key={item.key}
      type="button"
      className={`skill-overview__metric ${getToneClassName(item.tone)}`}
      onClick={() => onAction(item.action)}
      aria-label={metricAria(item.label, item.value)}
    >
      <span className="skill-overview__metric-label">{item.label}</span>
      <strong className="skill-overview__metric-value">{item.value}</strong>
      <span className="skill-overview__metric-meta">{item.meta}</span>
      <span className="skill-overview__metric-arrow" aria-hidden="true">
        <ArrowRight size={13} />
      </span>
    </button>
  );
}

function renderLifecycleNode(
  node: SkillOverviewLifecycleNode,
  index: number,
  onAction: (action: SkillOverviewAction) => void,
) {
  return (
    <button
      key={node.key}
      type="button"
      className={`skill-overview__flow-row ${getToneClassName(node.tone)}`}
      onClick={() => onAction(node.action)}
    >
      <span className={`skill-overview__flow-index ${getToneClassName(node.tone)}`}>{index + 1}</span>

      <span className="skill-overview__flow-main">
        <span className="skill-overview__flow-head">
          <strong>{node.label}</strong>
          <span className={`skill-overview__flow-status ${getToneClassName(node.tone)}`}>{node.status}</span>
        </span>
        <span className="skill-overview__flow-subline">
          {node.detail}
          {node.meta ? <span className="skill-overview__flow-submeta">· {node.meta}</span> : null}
        </span>
      </span>

      <span className="skill-overview__flow-value">{node.value}</span>

      <span className="skill-overview__flow-arrow" aria-hidden="true">
        <ArrowRight size={13} />
      </span>
    </button>
  );
}

function renderAttentionItem(
  item: SkillOverviewAttentionItem,
  onAction: (action: SkillOverviewAction) => void,
  locale: "zh-CN" | "en-US",
) {
  const toneClassName = getToneClassName(getSeverityTone(item));

  return (
    <button
      key={item.key}
      type="button"
      className={`skill-overview__issue-row ${toneClassName}`}
      onClick={() => onAction(item.action)}
    >
      <span className={`skill-overview__issue-badge ${toneClassName}`}>{getSeverityLabel(item, locale)}</span>
      <span className="skill-overview__issue-copy">
        <strong>{item.title}</strong>
        <small>{item.detail}</small>
      </span>
      <span className="skill-overview__issue-action">{item.action.label}</span>
      <span className="skill-overview__issue-arrow" aria-hidden="true">
        <ArrowRight size={13} />
      </span>
    </button>
  );
}

function renderActivityItem(
  item: SkillOverviewActivityItem,
  onAction: (action: SkillOverviewAction) => void,
  locale: "zh-CN" | "en-US",
) {
  return (
    <button
      key={item.key}
      type="button"
      className={`skill-overview__activity-row ${getToneClassName(item.tone)}`}
      onClick={() => onAction(item.action)}
    >
      <span className={`skill-overview__activity-kind ${getToneClassName(item.tone)}`}>
        {getActivityKindLabel(item, locale)}
      </span>

      <span className="skill-overview__activity-main">
        <strong>{item.title}</strong>
        <small>{item.detail}</small>
      </span>

      <span className="skill-overview__activity-time">{item.meta}</span>

      <span className="skill-overview__activity-arrow" aria-hidden="true">
        <ArrowRight size={13} />
      </span>
    </button>
  );
}

function loadDismissedState(key: string) {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function SkillOverviewPanel({ skillId, model, onAction }: SkillOverviewPanelProps) {
  const { resolvedLanguage } = useI18n();
  const topAttention = model.attentionItems[0] ?? null;
  const visibleIssues = model.attentionItems.slice(0, 3);
  const visibleActivities = model.activities.slice(0, 4);
  const copy = resolvedLanguage === "en-US"
    ? {
        noticeClose: "Close Notice",
        topSummaryAria: "Overview top summary",
        mainActionsAria: "Overview main actions",
        summaryAria: "Overview summary",
        flowAria: "Overview status flow",
        sideAria: "Platforms and activity",
        flowTitle: "Flow Status",
        issueTitle: "Needs Attention",
        issueCount: `${visibleIssues.length} items`,
        noIssueTitle: "No obvious blockers right now",
        noIssueDetail: "The flow is already fairly clear. Go straight to Versions when you need to continue.",
        activityTitle: "Recent Activity",
        activityCount: `${visibleActivities.length} entries`,
        noActivityTitle: "No activity yet",
        noActivityDetail: "Snapshots, platform releases, and team deliveries will keep flowing back here.",
        noticeText: (title: string, impact: string) => `${title}. ${impact}`,
        metricAria: (label: string, value: string) => `${label}: ${value}`,
      }
    : {
        noticeClose: "关闭提示",
        topSummaryAria: "概览顶部摘要",
        mainActionsAria: "概览主操作",
        summaryAria: "概览摘要",
        flowAria: "概览状态总览",
        sideAria: "平台与动态",
        flowTitle: "流程状态",
        issueTitle: "待处理",
        issueCount: `${visibleIssues.length} 项`,
        noIssueTitle: "当前没有明显阻塞",
        noIssueDetail: "链路状态已经比较清晰，继续处理时可直接进入版本页。",
        activityTitle: "最近动作",
        activityCount: `${visibleActivities.length} 条`,
        noActivityTitle: "暂无动作记录",
        noActivityDetail: "创建快照、发布平台或交付团队后，会在这里持续回读。",
        noticeText: (title: string, impact: string) => `${title}。${impact}`,
        metricAria: (label: string, value: string) => `${label} ${value}`,
      };
  const dismissKey = useMemo(
    () => `skill-overview-attention-${skillId}-${topAttention?.key ?? "none"}`,
    [skillId, topAttention?.key],
  );
  const [attentionDismissed, setAttentionDismissed] = useState(() => loadDismissedState(dismissKey));

  useEffect(() => {
    setAttentionDismissed(loadDismissedState(dismissKey));
  }, [dismissKey]);

  function handleDismissAttention() {
    setAttentionDismissed(true);

    try {
      sessionStorage.setItem(dismissKey, "1");
    } catch {
      // ignore storage failures
    }
  }

  return (
    <section className="skill-overview">
      {topAttention && !attentionDismissed ? (
        <div
          className={`skill-overview__notice skill-overview__notice--${getSeverityTone(topAttention)}`}
          role="alert"
        >
          <span className="skill-overview__notice-icon" aria-hidden="true">
            <AlertTriangle size={14} />
          </span>
          <span className="skill-overview__notice-copy">
            {copy.noticeText(topAttention.title, topAttention.impact)}
          </span>
          <button
            type="button"
            className="skill-overview__notice-close"
            aria-label={copy.noticeClose}
            onClick={handleDismissAttention}
          >
            <X size={14} />
          </button>
        </div>
      ) : null}

      <section className="skill-overview__console">
        <section aria-label={copy.topSummaryAria}>
          <header className="skill-overview__toolbar">
            <div className="skill-overview__toolbar-main">
              <span
                className={`workspace-status-badge workspace-status-badge--compact workspace-status-badge--${model.dominantModeTone}`}
              >
                <strong>{model.dominantModeLabel}</strong>
              </span>
              <div className="skill-overview__toolbar-copy">
                <h2>{model.nextStep.title}</h2>
                <p>{model.nextStep.reason}</p>
              </div>
            </div>

            <div className="skill-overview__toolbar-actions" role="group" aria-label={copy.mainActionsAria}>
              <Button
                className={getActionClassName(model.nextStep.primaryAction)}
                onClick={() => onAction(model.nextStep.primaryAction)}
              >
                {model.nextStep.primaryAction.label}
              </Button>

              {model.nextStep.secondaryActions.slice(0, 2).map((action) => (
                <Button
                  key={`${action.type}-${action.label}`}
                  className={getActionClassName(action)}
                  onClick={() => onAction(action)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </header>

          <section className="skill-overview__metrics" aria-label={copy.summaryAria}>
            {model.summaryItems.map((item) => renderSummaryItem(item, onAction, copy.metricAria))}
          </section>
        </section>

        <section className="skill-overview__workspace">
          <section className="skill-overview__flow-panel" aria-label={copy.flowAria}>
            <div className="skill-overview__panel-head">
              <span className="skill-overview__panel-title">{copy.flowTitle}</span>
              <span className="skill-overview__panel-hint">{model.helperText}</span>
            </div>

            <div className="skill-overview__flow-table">
              {model.lifecycleNodes.map((node, index) => renderLifecycleNode(node, index, onAction))}
            </div>
          </section>

          <aside className="skill-overview__side-panel" aria-label={copy.sideAria}>
            <section className="skill-overview__side-section">
              <div className="skill-overview__panel-head">
                <span className="skill-overview__panel-title">{copy.issueTitle}</span>
                <span className="skill-overview__panel-count">{copy.issueCount}</span>
              </div>

              <div className="skill-overview__issue-list">
                {visibleIssues.length > 0 ? (
                  visibleIssues.map((item) => renderAttentionItem(item, onAction, resolvedLanguage))
                ) : (
                  <div className="skill-overview__empty-inline">
                    <strong>{copy.noIssueTitle}</strong>
                    <span>{copy.noIssueDetail}</span>
                  </div>
                )}
              </div>
            </section>

            <section className="skill-overview__side-section skill-overview__side-section--activity">
              <div className="skill-overview__panel-head">
                <span className="skill-overview__panel-title">{copy.activityTitle}</span>
                <span className="skill-overview__panel-count">{copy.activityCount}</span>
              </div>

              <div className="skill-overview__activity-list">
                {visibleActivities.length > 0 ? (
                  visibleActivities.map((item) => renderActivityItem(item, onAction, resolvedLanguage))
                ) : (
                  <div className="skill-overview__empty-inline">
                    <strong>{copy.noActivityTitle}</strong>
                    <span>{copy.noActivityDetail}</span>
                  </div>
                )}
              </div>
            </section>
          </aside>
        </section>
      </section>
    </section>
  );
}
