import { buildActivityItems } from "./skillOverviewActivities";
import {
  buildAttentionItems,
  buildLifecycleNodes,
  buildSummaryItems,
} from "./skillOverviewSections";
import {
  buildHelperText,
  buildNextStep,
  getDominantMode,
  getDominantModeLabel,
  getDominantModeTone,
} from "./skillOverviewDecision";
import { deriveOverviewState } from "./skillOverviewState";
import type {
  BuildSkillOverviewInput,
  SkillOverviewViewModel,
} from "./skillOverviewTypes";

export type {
  BuildSkillOverviewInput,
  SkillOverviewAction,
  SkillOverviewActivityItem,
  SkillOverviewActivityKind,
  SkillOverviewAttentionItem,
  SkillOverviewAttentionSeverity,
  SkillOverviewLifecycleNode,
  SkillOverviewMode,
  SkillOverviewNextStep,
  SkillOverviewSummaryItem,
  SkillOverviewTone,
  SkillOverviewViewModel,
  UiLanguage,
} from "./skillOverviewTypes";

export function buildSkillOverviewModel(input: BuildSkillOverviewInput): SkillOverviewViewModel {
  const locale = input.language ?? "zh-CN";
  const state = deriveOverviewState(input);
  const dominantMode = getDominantMode(state);
  const activities = buildActivityItems(
    input.snapshots,
    input.platformReleaseOverview ?? null,
    input.teamDeliveryOverview ?? null,
    locale,
  );
  const latestActivity = activities[0] ?? null;

  return {
    dominantMode,
    dominantModeLabel: getDominantModeLabel(dominantMode, locale),
    dominantModeTone: getDominantModeTone(dominantMode),
    helperText: buildHelperText(state, locale),
    nextStep: buildNextStep(state, locale),
    summaryItems: buildSummaryItems(state, latestActivity, locale),
    lifecycleNodes: buildLifecycleNodes(state, locale),
    attentionItems: buildAttentionItems(state, locale),
    activities,
  };
}
