import type {
  ExternalMarketSkill,
  ExternalMarketSkillDetail,
  Skill,
} from "@/types/skill";
import {
  type ExternalStateFilter,
  type MarketRiskLevel,
  type MarketSourceKey,
  type MarketVerificationState,
  type UiLanguage,
} from "./marketTypes";
import { buildExternalSourceRef, formatExternalInstallCount, slugifySkillName } from "./marketUtils";

export type MarketVerificationFilter = "all" | MarketVerificationState;
export type TopicFilter = "all" | "security" | "office";
export type UnifiedSourceFilter = "all" | MarketSourceKey;

export interface MarketDiscoveryEntry {
  external: ExternalMarketSkill;
  sourceKey: MarketSourceKey;
  sourceKeys: MarketSourceKey[];
  sourceLabel: string;
  publisherLabel: string;
  nativeCategory: string;
  normalizedCategory: string;
  lensPrimary: string;
  lensSecondary: string;
  lensTertiary: string;
  verification: MarketVerificationState;
  risk: MarketRiskLevel;
  status: ExternalStateFilter;
  compatiblePlatforms: string[];
  sourceCount: number;
  installedSkill: Skill | null;
  conflictSkill: Skill | null;
}

export interface MarketDiscoveryFilterState {
  activeSource: MarketSourceKey;
  selectedRepository: string;
  selectedSourcePrimary: string;
  selectedSourceSecondary: string;
  selectedState: ExternalStateFilter;
  selectedTopic: TopicFilter;
  selectedUnifiedSource: UnifiedSourceFilter;
  selectedVerification: MarketVerificationFilter;
}

export interface MarketFilterOption {
  value: string;
  label: string;
  count: number;
}

export interface DetailFact {
  label: string;
  value: string;
}

export interface PreviewSection {
  label: string;
  items: string[];
}

export interface MarketSourceLensLabels {
  primary: string;
  secondary: string;
  tertiary: string;
  mode: string;
}

export function getAvailabilityLabel(sourceKey: MarketSourceKey, language: UiLanguage) {
  if (sourceKey === "all") {
    return language === "en-US" ? "Aggregate" : "聚合视图";
  }

  return language === "en-US" ? "Live" : "已接入";
}

export function getGoalSearchPlaceholder(sourceKey: MarketSourceKey, language: UiLanguage) {
  if (language === "en-US") {
    switch (sourceKey) {
      case "officialskills":
        return "Search categories, official teams, or skills";
      case "clawskills":
        return "Search categories, publishers, or curated skills";
      case "clawhub":
        return "Search publishers, packages, or capability tags";
      case "skillssh":
        return "Search by goal, skill, or repository";
      case "all":
        return "What do you want this skill to help with?";
      default:
        return "Search skills";
    }
  }

  switch (sourceKey) {
    case "officialskills":
      return "按分类、官方团队或技能搜索";
    case "clawskills":
      return "按分类、发布者或技能搜索";
    case "clawhub":
      return "按发布者、能力标签或包搜索";
    case "skillssh":
      return "按任务、技能或仓库搜索";
    case "all":
      return "你想让 skill 帮你做什么？";
    default:
      return "搜索技能";
  }
}

export function getResultsCountLabel(count: number, language: UiLanguage) {
  return language === "en-US" ? `${count} results` : `当前结果 ${count} 项`;
}

export function getSourceCoverageLabel(count: number, language: UiLanguage) {
  return language === "en-US" ? `${count} source${count > 1 ? "s" : ""}` : `${count} 个来源`;
}

export function getRecommendedOrderLabel(language: UiLanguage) {
  return language === "en-US" ? "Composite Recommendation" : "综合推荐";
}

export function getTopicOptions(language: UiLanguage) {
  return language === "en-US"
    ? [
        { value: "all" as const, label: "All Topics" },
        { value: "security" as const, label: "Security Audits" },
        { value: "office" as const, label: "Office" },
      ]
    : [
        { value: "all" as const, label: "全部专题" },
        { value: "security" as const, label: "安全审计" },
        { value: "office" as const, label: "办公效率" },
      ];
}

export function getPreviewSections(sourceKey: MarketSourceKey, language: UiLanguage): PreviewSection[] {
  if (language === "en-US") {
    switch (sourceKey) {
      case "officialskills":
        return [
          { label: "Category", items: ["Development", "Docs", "Security"] },
          { label: "Team", items: ["OpenAI", "VoltAgent", "Platform"] },
          { label: "Rank", items: ["Top 10", "Top 50", "Rising"] },
        ];
      case "clawskills":
        return [
          { label: "Category", items: ["Git & GitHub", "Browser Automation", "Office & Docs"] },
          { label: "Publisher", items: ["yazelin", "openclaw", "community"] },
          { label: "Downloads", items: ["1k-4.9k", "5k-19.9k", "20k+"] },
        ];
      case "clawhub":
        return [
          { label: "Publisher", items: ["mixerboxai", "ant-intl", "cyz9827"] },
          { label: "Channel", items: ["Official", "Community"] },
          { label: "Capability", items: ["General", "Requires Sensitive Credentials", "Agent"] },
        ];
      default:
        return [];
    }
  }

  switch (sourceKey) {
    case "officialskills":
      return [
        { label: "分类", items: ["开发", "文档", "安全"] },
        { label: "团队", items: ["OpenAI", "VoltAgent", "平台"] },
        { label: "榜位", items: ["前 10", "前 50", "上升中"] },
      ];
    case "clawskills":
      return [
        { label: "分类", items: ["Git 与 GitHub", "浏览器自动化", "办公与文档"] },
        { label: "发布者", items: ["yazelin", "openclaw", "社区"] },
        { label: "下载量", items: ["1k-4.9k", "5k-19.9k", "20k+"] },
      ];
    case "clawhub":
      return [
        { label: "发布者", items: ["mixerboxai", "ant-intl", "cyz9827"] },
        { label: "来源频道", items: ["官方", "社区"] },
        { label: "能力类型", items: ["通用", "需要敏感凭据", "Agent"] },
      ];
    default:
      return [];
  }
}

export function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function getSourceBrandLabel(sourceKey: MarketSourceKey) {
  switch (sourceKey) {
    case "officialskills":
      return "officialskills.sh";
    case "clawskills":
      return "clawskills.sh";
    case "clawhub":
      return "ClawHub";
    default:
      return "skills.sh";
  }
}

function translateExternalFacetValue(value: string, language: UiLanguage) {
  if (language === "en-US") {
    return value;
  }

  const normalized = value.trim().toLowerCase();
  const dictionary: Record<string, string> = {
    official: "官方",
    community: "社区",
    general: "通用",
    agent: "Agent",
    "requires sensitive credentials": "需要敏感凭据",
    "office & docs": "办公与文档",
    "browser automation": "浏览器自动化",
    "git & github": "Git 与 GitHub",
  };

  return dictionary[normalized] ?? value;
}

function translateExternalFacetLabel(label: string, language: UiLanguage) {
  if (language === "en-US") {
    return label;
  }

  const normalized = label.trim().toLowerCase();
  const dictionary: Record<string, string> = {
    publisher: "发布者",
    channel: "来源频道",
    capability: "能力类型",
    category: "分类",
    team: "团队",
    rank: "榜位",
    downloads: "下载量",
  };

  return dictionary[normalized] ?? label;
}

export function getFacetValue(item: ExternalMarketSkill, index: number, language: UiLanguage) {
  const value = item.facets[index]?.value ??
    (index === 0 ? item.publisher : index === 1 ? item.category : language === "en-US" ? "General" : "通用");

  return translateExternalFacetValue(value, language);
}

export function getFacetLabel(item: ExternalMarketSkill, index: number, fallback: string, language: UiLanguage = "en-US") {
  return translateExternalFacetLabel(item.facets[index]?.label ?? fallback, language);
}

export function asVerificationState(value: string): MarketVerificationState {
  if (value === "official" || value === "reviewing" || value === "unverified") {
    return value;
  }

  return "verified";
}

export function asRiskLevel(value: string): MarketRiskLevel {
  if (value === "high" || value === "medium") {
    return value;
  }

  return "low";
}

export function buildExternalSlugConflictMap(
  externalItems: ExternalMarketSkill[],
  installedExternalSkillMap: Record<string, Skill>,
  skills: Skill[],
) {
  const nextMap: Record<string, Skill> = {};

  for (const item of externalItems) {
    const externalRef = buildExternalSourceRef(item);
    if (installedExternalSkillMap[externalRef]) {
      continue;
    }

    const slug = slugifySkillName(item.name);
    if (!slug) {
      continue;
    }

    const conflictSkill = skills.find((skill) => skill.slug === slug);
    if (conflictSkill) {
      nextMap[externalRef] = conflictSkill;
    }
  }

  return nextMap;
}

export function buildMarketDiscoveryEntries(input: {
  activeSource: MarketSourceKey;
  externalItems: ExternalMarketSkill[];
  externalSlugConflictMap: Record<string, Skill>;
  installedExternalSkillMap: Record<string, Skill>;
  language: UiLanguage;
}) {
  const { activeSource, externalItems, externalSlugConflictMap, installedExternalSkillMap, language } = input;

  return externalItems.map((item) => {
    const externalRef = buildExternalSourceRef(item);
    const installedSkill = installedExternalSkillMap[externalRef] ?? null;
    const conflictSkill = installedSkill ? null : externalSlugConflictMap[externalRef] ?? null;
    const status = installedSkill ? "installed" : conflictSkill ? "conflict" : "available";
    const sourceKey = (item.marketSource === "all" ? activeSource : item.marketSource) as MarketSourceKey;
    const sourceKeys = (item.sourceKeys.length > 0 ? item.sourceKeys : [sourceKey]).filter(
      (value): value is MarketSourceKey => value !== "user",
    );

    return {
      external: item,
      sourceKey,
      sourceKeys,
      sourceLabel: getSourceBrandLabel(sourceKey),
      publisherLabel: item.publisher || item.sourceLabel || item.source,
      nativeCategory: item.category || (language === "en-US" ? "General" : "通用"),
      normalizedCategory: item.category || (language === "en-US" ? "General" : "通用"),
      lensPrimary: getFacetValue(item, 0, language),
      lensSecondary: getFacetValue(item, 1, language),
      lensTertiary: getFacetValue(item, 2, language),
      verification: asVerificationState(item.verification),
      risk: asRiskLevel(item.risk),
      status,
      compatiblePlatforms: ["Codex"],
      sourceCount: sourceKeys.length,
      installedSkill,
      conflictSkill,
    } satisfies MarketDiscoveryEntry;
  });
}

export function buildFacetOptions(
  entries: MarketDiscoveryEntry[],
  allLabel: string,
  resolveValue: (entry: MarketDiscoveryEntry) => string,
  language: UiLanguage,
): MarketFilterOption[] {
  const counts = entries.reduce<Record<string, number>>((current, entry) => {
    const value = resolveValue(entry);
    current[value] = (current[value] ?? 0) + 1;
    return current;
  }, {});

  return [
    { value: "all", label: allLabel, count: entries.length },
    ...Object.entries(counts)
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, language)),
  ];
}

export function matchesMarketDiscoveryFilters(
  entry: MarketDiscoveryEntry,
  filters: MarketDiscoveryFilterState,
  ignoreState = false,
) {
  if (filters.activeSource !== "all" && entry.sourceKey !== filters.activeSource) {
    return false;
  }

  if (
    !ignoreState &&
    filters.activeSource !== "all" &&
    filters.selectedState !== "all" &&
    entry.status !== filters.selectedState
  ) {
    return false;
  }

  if (filters.activeSource === "all") {
    if (filters.selectedUnifiedSource !== "all" && !entry.sourceKeys.includes(filters.selectedUnifiedSource)) {
      return false;
    }

    if (filters.selectedVerification !== "all" && entry.verification !== filters.selectedVerification) {
      return false;
    }

    return true;
  }

  if (filters.activeSource === "skillssh") {
    if (filters.selectedRepository !== "all" && entry.publisherLabel !== filters.selectedRepository) {
      return false;
    }

    if (!matchesTopic(entry, filters.selectedTopic)) {
      return false;
    }

    return true;
  }

  if (filters.selectedSourcePrimary !== "all" && entry.lensPrimary !== filters.selectedSourcePrimary) {
    return false;
  }

  if (filters.selectedSourceSecondary !== "all" && entry.lensSecondary !== filters.selectedSourceSecondary) {
    return false;
  }

  return true;
}

export function buildMarketStateCounts(
  entries: MarketDiscoveryEntry[],
  filters: MarketDiscoveryFilterState,
) {
  return entries.reduce<Record<ExternalStateFilter, number>>(
    (counts, entry) => {
      if (!matchesMarketDiscoveryFilters(entry, filters, true)) {
        return counts;
      }

      counts.all += 1;
      counts[entry.status] += 1;
      return counts;
    },
    { all: 0, available: 0, installed: 0, conflict: 0 },
  );
}

export function buildMarketSourceCounts(input: {
  activeSource: MarketSourceKey;
  aggregateEntriesLength: number;
  aggregateSourceCounts: Record<MarketSourceKey, number>;
  liveSourceEntries: MarketDiscoveryEntry[];
}) {
  const { activeSource, aggregateEntriesLength, aggregateSourceCounts, liveSourceEntries } = input;
  const counts: Record<MarketSourceKey, number> = {
    all: activeSource === "all" ? aggregateEntriesLength : aggregateSourceCounts.all,
    skillssh: activeSource === "all" ? 0 : aggregateSourceCounts.skillssh,
    officialskills: activeSource === "all" ? 0 : aggregateSourceCounts.officialskills,
    clawskills: activeSource === "all" ? 0 : aggregateSourceCounts.clawskills,
    clawhub: activeSource === "all" ? 0 : aggregateSourceCounts.clawhub,
    user: 0,
  };

  for (const entry of liveSourceEntries) {
    const keys = activeSource === "all" ? entry.sourceKeys : [entry.sourceKey];
    keys.forEach((key) => {
      if (key !== "all" && key !== "user") {
        counts[key] += 1;
      }
    });
  }

  if (activeSource !== "all") {
    counts[activeSource] = liveSourceEntries.length;
  }

  return counts;
}

export function getSourceLensLabels(sourceKey: MarketSourceKey, language: UiLanguage): MarketSourceLensLabels | null {
  switch (sourceKey) {
    case "officialskills":
      return {
        primary: language === "en-US" ? "Category" : "分类",
        secondary: language === "en-US" ? "Team" : "团队",
        tertiary: language === "en-US" ? "Rank" : "榜位",
        mode: language === "en-US" ? "Official Directory" : "官方目录",
      };
    case "clawskills":
      return {
        primary: language === "en-US" ? "Category" : "分类",
        secondary: language === "en-US" ? "Publisher" : "发布者",
        tertiary: language === "en-US" ? "Downloads" : "下载量",
        mode: language === "en-US" ? "Curated Community" : "精选社区",
      };
    case "clawhub":
      return {
        primary: language === "en-US" ? "Publisher" : "发布者",
        secondary: language === "en-US" ? "Channel" : "来源频道",
        tertiary: language === "en-US" ? "Capability" : "能力类型",
        mode: language === "en-US" ? "Registry Index" : "注册表索引",
      };
    default:
      return null;
  }
}

export function formatAllFilterLabel(label: string, language: UiLanguage) {
  return language === "en-US" ? `All ${label}` : `全部${label}`;
}

export function matchesTopic(entry: MarketDiscoveryEntry, topic: TopicFilter) {
  if (topic === "all") {
    return true;
  }

  const haystack = [entry.nativeCategory, entry.external.summary, entry.publisherLabel, ...entry.external.tags]
    .join(" ")
    .toLowerCase();

  if (topic === "security") {
    return /security|audit|审计|安全/.test(haystack);
  }

  return /office|办公/.test(haystack);
}

export function getTopicSignal(entry: MarketDiscoveryEntry, language: UiLanguage) {
  if (matchesTopic(entry, "security")) {
    return language === "en-US" ? "Security Audits" : "安全审计";
  }

  if (matchesTopic(entry, "office")) {
    return language === "en-US" ? "Office" : "办公效率";
  }

  return null;
}

export function getDocumentationSourceLabel(detail: ExternalMarketSkillDetail | null, language: UiLanguage) {
  const path = detail?.documentationPath?.toLowerCase() ?? "";
  if (path.endsWith("skill.md")) {
    return language === "en-US" ? "From SKILL.md" : "来自 SKILL.md";
  }

  if (path.endsWith("readme.md")) {
    return language === "en-US" ? "From README.md" : "来自 README.md";
  }

  return language === "en-US" ? "Platform Summary" : "摘要来自平台整理";
}

export function getDetailScenarioValue(
  entry: MarketDiscoveryEntry,
  language: UiLanguage,
) {
  const scenarioValue = uniqueStrings([entry.nativeCategory, ...entry.external.tags.slice(0, 2)]).join(" / ");
  return scenarioValue || (language === "en-US" ? "General purpose skill workflows" : "通用技能工作流");
}

export function buildDetailFacts(
  entry: MarketDiscoveryEntry,
  detail: ExternalMarketSkillDetail | null,
  language: UiLanguage,
): DetailFact[] {
  const installSignal = language === "en-US"
    ? `${formatExternalInstallCount(entry.external.installs)} installs`
    : `安装量 ${formatExternalInstallCount(entry.external.installs)}`;
  const sourcePath = detail?.sourceSubpath ?? entry.external.sourceSubpath ?? "--";
  const platformValue = entry.compatiblePlatforms.length > 0
    ? language === "en-US"
      ? entry.compatiblePlatforms.join(", ")
      : entry.compatiblePlatforms.join(" / ")
    : "--";
  const facts =
    language === "en-US"
      ? [
          { label: "Best For", value: getDetailScenarioValue(entry, language) },
          { label: "Platforms", value: platformValue },
          { label: "Repository", value: entry.external.source },
          { label: "Skill ID", value: entry.external.skillId },
          detail?.version ? { label: "Version", value: detail.version } : null,
          { label: "Path", value: sourcePath },
          { label: "Install Signal", value: installSignal },
        ]
      : [
          { label: "适用场景", value: getDetailScenarioValue(entry, language) },
          { label: "适配平台", value: platformValue },
          { label: "来源仓库", value: entry.external.source },
          { label: "资产标识", value: entry.external.skillId },
          detail?.version ? { label: "版本", value: detail.version } : null,
          { label: "仓库路径", value: sourcePath },
          { label: "热度信号", value: installSignal },
        ];

  return facts.filter((fact): fact is DetailFact => fact !== null);
}
