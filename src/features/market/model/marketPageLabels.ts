import type { ExternalMarketBoard } from "@/types/skill";
import { getResultsCountLabel } from "./marketDiscovery";
import {
  getExternalBoardLabel,
  getExternalStateFilterLabel,
} from "./marketUtils";
import {
  getMarketSourceDescriptor,
  getMarketVerificationLabel,
} from "./marketSources";
import type {
  ExternalStateFilter,
  MarketSourceKey,
  ResultSummaryItem,
  UiLanguage,
} from "./marketTypes";
import type { MarketVerificationFilter, UnifiedSourceFilter } from "./marketDiscovery";

export interface MarketPageLabels {
  pageTitle: string;
  resultContextLabel: string;
  searchLabel: string;
  activityLabel: string;
  manualIntakeLabel: string;
  sourceTabsRegionLabel: string;
  sourceFilterLabel: string;
  currentSourceLabel: string;
  repositoryLabel: string;
  stateLabel: string;
  verificationLabel: string;
  filtersLabel: string;
  resultsLabel: string;
  boardLabel: string;
  topicLabel: string;
  topicViewLabel: string;
  viewAllSourcesLabel: string;
  openSourceLabel: string;
  detailFactsLabel: string;
  detailReadmeLabel: string;
  plannedSourceActionLabel: string;
  activityHistoryLabel: string;
  recentAssetsLabel: string;
  paginationPreviousLabel: string;
  paginationNextLabel: string;
  allRepositoriesLabel: string;
  allVerificationLabel: string;
  allLiveSourcesLabel: string;
  currentModeLabel: string;
}

export function getMarketPageLabels(language: UiLanguage): MarketPageLabels {
  const isEnglish = language === "en-US";

  return {
    pageTitle: isEnglish ? "Market & Import" : "市场与导入",
    resultContextLabel: isEnglish ? "Results" : "结果",
    searchLabel: isEnglish ? "Search" : "搜索",
    activityLabel: isEnglish ? "Import Records" : "导入记录",
    manualIntakeLabel: isEnglish ? "Manual Import" : "手动导入",
    sourceTabsRegionLabel: isEnglish ? "Market Source Tabs" : "来源切换标签",
    sourceFilterLabel: isEnglish ? "Source Filter" : "来源筛选",
    currentSourceLabel: isEnglish ? "Current Source" : "当前来源",
    repositoryLabel: isEnglish ? "Source Repository" : "来源仓库",
    stateLabel: isEnglish ? "Install State" : "安装状态",
    verificationLabel: isEnglish ? "Verification" : "验证状态",
    filtersLabel: isEnglish ? "Filters" : "筛选",
    resultsLabel: isEnglish ? "Results" : "结果",
    boardLabel: isEnglish ? "Leaderboards" : "榜单",
    topicLabel: isEnglish ? "Topics" : "专题",
    topicViewLabel: isEnglish ? "Topic View" : "专题视角",
    viewAllSourcesLabel: isEnglish ? "Back to All Sources" : "查看全部来源",
    openSourceLabel: isEnglish ? "View Repository" : "查看仓库",
    detailFactsLabel: isEnglish ? "Key Facts" : "关键信息",
    detailReadmeLabel: isEnglish ? "Documentation Summary" : "文档摘要",
    plannedSourceActionLabel: isEnglish ? "Open Manual Import" : "打开手动导入",
    activityHistoryLabel: isEnglish ? "Recent Records" : "最近记录",
    recentAssetsLabel: isEnglish ? "Recently Imported Assets" : "最近导入资产",
    paginationPreviousLabel: isEnglish ? "Previous" : "上一页",
    paginationNextLabel: isEnglish ? "Next" : "下一页",
    allRepositoriesLabel: isEnglish ? "All Repositories" : "全部仓库",
    allVerificationLabel: isEnglish ? "All Verification" : "全部验证状态",
    allLiveSourcesLabel: isEnglish ? "All External Sources" : "全部外部来源",
    currentModeLabel: isEnglish ? "Browse Mode" : "浏览模式",
  };
}

export interface BuildMarketSummaryItemsInput {
  activeSource: MarketSourceKey;
  activeSourceLabel: string;
  externalBoard: ExternalMarketBoard;
  filteredCount: number;
  hasMeaningfulStateFilter: boolean;
  isSkillsshTopicMode: boolean;
  labels: Pick<
    MarketPageLabels,
    "boardLabel" | "currentModeLabel" | "currentSourceLabel" | "filtersLabel" | "resultsLabel" | "topicViewLabel"
  >;
  language: UiLanguage;
  recommendationLabel: string;
  selectedRepository: string;
  selectedSourcePrimary: string;
  selectedSourceSecondary: string;
  selectedState: ExternalStateFilter;
  selectedTopicLabel: string;
  selectedUnifiedSource: UnifiedSourceFilter;
  selectedVerification: MarketVerificationFilter;
  sourceLensModeLabel?: string;
}

export function buildMarketSummaryItems(input: BuildMarketSummaryItemsInput): ResultSummaryItem[] {
  const activeFilters: string[] = [];

  if (input.activeSource === "all") {
    if (input.selectedUnifiedSource !== "all") {
      activeFilters.push(getMarketSourceDescriptor(input.selectedUnifiedSource, input.language).label);
    }
    if (input.selectedVerification !== "all") {
      activeFilters.push(getMarketVerificationLabel(input.selectedVerification, input.language));
    }
  } else if (input.activeSource === "skillssh") {
    if (input.selectedRepository !== "all") {
      activeFilters.push(input.selectedRepository);
    }
    if (input.hasMeaningfulStateFilter && input.selectedState !== "all") {
      activeFilters.push(getExternalStateFilterLabel(input.selectedState, input.language));
    }
  } else {
    if (input.selectedSourcePrimary !== "all") {
      activeFilters.push(input.selectedSourcePrimary);
    }
    if (input.selectedSourceSecondary !== "all") {
      activeFilters.push(input.selectedSourceSecondary);
    }
    if (input.hasMeaningfulStateFilter && input.selectedState !== "all") {
      activeFilters.push(getExternalStateFilterLabel(input.selectedState, input.language));
    }
  }

  const items: ResultSummaryItem[] = [];

  if (input.activeSource === "all") {
    items.push({
      key: "source",
      label: input.labels.currentSourceLabel,
      value: input.activeSourceLabel,
    });
  }

  items.push({
    key: "mode",
    label:
      input.activeSource === "skillssh"
        ? input.isSkillsshTopicMode
          ? input.labels.topicViewLabel
          : input.labels.boardLabel
        : input.labels.currentModeLabel,
    value:
      input.activeSource === "skillssh"
        ? input.isSkillsshTopicMode
          ? input.selectedTopicLabel
          : getExternalBoardLabel(input.externalBoard, input.language)
        : input.activeSource === "all"
          ? input.recommendationLabel
          : input.sourceLensModeLabel ?? input.recommendationLabel,
  });

  if (activeFilters.length > 0) {
    items.push({
      key: "filters",
      label: input.labels.filtersLabel,
      value: activeFilters.join(" / "),
    });
  }

  items.push({
    key: "results",
    label: input.labels.resultsLabel,
    value: getResultsCountLabel(input.filteredCount, input.language),
  });

  return items;
}
