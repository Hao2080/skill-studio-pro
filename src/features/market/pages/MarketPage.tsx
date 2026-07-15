import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import App from "antd/es/app";
import Button from "antd/es/button";
import Typography from "antd/es/typography";
import { Search } from "lucide-react";
import type {
  ExternalMarketBoard,
  SkillImportRecord,
  SkillSource,
} from "@/types/skill";
import {
  importExternalMarketSkill,
  importMarketSkill,
  importSkill,
  importSkillFromGit,
  listSkillSources,
  openSkillImportDialog,
} from "@/features/skills/api/skillsApi";
import {
  getPrimarySkillSourceDetail,
  getPrimarySkillSourceLabel,
  getSkillSourceTypeLabel,
} from "@/features/skills/model/detailWorkspace";
import { useI18n } from "@/features/settings/state/I18nContext";
import { useSkillContext } from "@/features/skills/state/SkillContext";
import {
  MarketActivityDrawer,
  MarketManualIntakeDrawer,
} from "../components/MarketPageDrawers";
import { MarketResults } from "../components/MarketResults";
import { MarketSourceNavigator } from "../components/MarketSourceNavigator";
import { useExternalMarketItems } from "../hooks/useExternalMarketItems";
import { useInstalledExternalSkillMap } from "../hooks/useInstalledExternalSkillMap";
import { useMarketExternalDetail } from "../hooks/useMarketExternalDetail";
import { useMarketImportFlow } from "../hooks/useMarketImportFlow";
import { useMarketImportHistory } from "../hooks/useMarketImportHistory";
import { getMarketCopy } from "../model/marketCopy";
import { MarketExternalDetailDrawer } from "../components/MarketExternalDetailDrawer";
import {
  buildExternalSlugConflictMap,
  buildFacetOptions,
  buildDetailFacts,
  buildMarketDiscoveryEntries,
  buildMarketSourceCounts,
  buildMarketStateCounts,
  formatAllFilterLabel,
  getDocumentationSourceLabel,
  getFacetLabel,
  getGoalSearchPlaceholder,
  getRecommendedOrderLabel,
  getSourceLensLabels,
  getTopicOptions,
  matchesMarketDiscoveryFilters,
  uniqueStrings,
  type MarketDiscoveryEntry,
  type MarketVerificationFilter,
  type TopicFilter,
  type UnifiedSourceFilter,
} from "../model/marketDiscovery";
import {
  getMarketSourceDescriptor,
  getMarketSourceRegistry,
  getMarketVerificationLabel,
} from "../model/marketSources";
import {
  buildMarketSummaryItems,
  getMarketPageLabels,
} from "../model/marketPageLabels";
import {
  BROWSER_PAGE_SIZE,
  type ExternalStateFilter,
  type GovernanceSourceItem,
  type ImportMode,
  type MarketSourceKey,
} from "../model/marketTypes";
import {
  buildImportHistoryTitle,
  buildVisiblePages,
  getExternalStateFilterLabel,
  parseImportPayload,
  resolveImportModeFromPayload,
} from "../model/marketUtils";
import "../styles.css";
import "../styles/hub.css";
import "../styles/results.css";
import "../styles/results-workbench.css";
import "../styles/results-density.css";
import "../styles/results-density-next.css";
import "../styles/results-professional-finish.css";
import "../styles/results-tightening.css";
import "../styles/intake-detail.css";
import "../styles/drawers.css";

const { Title } = Typography;

export function MarketPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { resolvedLanguage } = useI18n();
  const copy = useMemo(() => getMarketCopy(resolvedLanguage), [resolvedLanguage]);
  const { skills, loadSkills, selectSkill } = useSkillContext();
  const isEnglish = resolvedLanguage === "en-US";

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [activeSource, setActiveSource] = useState<MarketSourceKey>("all");
  const [externalBoard, setExternalBoard] = useState<ExternalMarketBoard>("alltime");
  const [selectedRepository, setSelectedRepository] = useState("all");
  const [selectedState, setSelectedState] = useState<ExternalStateFilter>("all");
  const [selectedVerification, setSelectedVerification] = useState<MarketVerificationFilter>("all");
  const [selectedUnifiedSource, setSelectedUnifiedSource] = useState<UnifiedSourceFilter>("all");
  const [selectedTopic, setSelectedTopic] = useState<TopicFilter>("all");
  const [selectedSourcePrimary, setSelectedSourcePrimary] = useState("all");
  const [selectedSourceSecondary, setSelectedSourceSecondary] = useState("all");
  const [resultPage, setResultPage] = useState(1);
  const [aggregateSourceCounts, setAggregateSourceCounts] = useState<Record<MarketSourceKey, number>>({
    all: 0,
    skillssh: 0,
    officialskills: 0,
    clawskills: 0,
    clawhub: 0,
    user: 0,
  });
  const [manualIntakeOpen, setManualIntakeOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [gitUrl, setGitUrl] = useState("");
  const [gitSubdir, setGitSubdir] = useState("");
  const [primarySourceMap, setPrimarySourceMap] = useState<Record<string, SkillSource | null>>({});
  const [selectedSourceType, setSelectedSourceType] = useState("all");

  const labels = useMemo(() => getMarketPageLabels(resolvedLanguage), [resolvedLanguage]);
  const {
    activityHistoryLabel,
    activityLabel,
    allLiveSourcesLabel,
    allRepositoriesLabel,
    allVerificationLabel,
    boardLabel,
    detailFactsLabel,
    detailReadmeLabel,
    manualIntakeLabel,
    openSourceLabel,
    pageTitle,
    paginationNextLabel,
    paginationPreviousLabel,
    plannedSourceActionLabel,
    recentAssetsLabel,
    repositoryLabel,
    resultContextLabel,
    searchLabel,
    sourceFilterLabel,
    sourceTabsRegionLabel,
    stateLabel,
    topicLabel,
    topicViewLabel,
    verificationLabel,
    viewAllSourcesLabel,
  } = labels;
  const recommendationLabel = getRecommendedOrderLabel(resolvedLanguage);

  const topicOptions = useMemo(() => getTopicOptions(resolvedLanguage), [resolvedLanguage]);
  const selectedTopicLabel = useMemo(
    () => topicOptions.find((item) => item.value === selectedTopic)?.label ?? selectedTopic,
    [selectedTopic, topicOptions],
  );
  const isSkillsshTopicMode = activeSource === "skillssh" && selectedTopic !== "all";

  useEffect(() => {
    void loadImportHistory(true);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 280);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  const fetchBoard = activeSource === "skillssh" && selectedTopic === "all" ? externalBoard : "alltime";
  const {
    error: externalError,
    items: externalItems,
    loading: externalLoading,
    reload: reloadExternalItems,
  } = useExternalMarketItems({
    activeSource,
    debouncedSearchQuery,
    fetchBoard,
  });
  const installedExternalSkillMap = useInstalledExternalSkillMap(skills);
  const {
    historyError,
    historyLoading,
    importHistory,
    loadImportHistory,
  } = useMarketImportHistory();

  const externalSlugConflictMap = useMemo(() => {
    return buildExternalSlugConflictMap(externalItems, installedExternalSkillMap, skills);
  }, [externalItems, installedExternalSkillMap, skills]);

  const externalDetail = useMarketExternalDetail();
  const sourceRegistry = useMemo(() => getMarketSourceRegistry(resolvedLanguage), [resolvedLanguage]);
  const activeSourceDescriptor = useMemo(
    () => getMarketSourceDescriptor(activeSource, resolvedLanguage),
    [activeSource, resolvedLanguage],
  );
  const sourceLensLabels = useMemo(() => {
    const fallback = getSourceLensLabels(activeSource, resolvedLanguage);
    if (activeSource === "all" || externalItems.length === 0) {
      return fallback;
    }

    return {
      primary: getFacetLabel(externalItems[0], 0, fallback?.primary ?? (isEnglish ? "Facet A" : "维度 A"), resolvedLanguage),
      secondary: getFacetLabel(externalItems[0], 1, fallback?.secondary ?? (isEnglish ? "Facet B" : "维度 B"), resolvedLanguage),
      tertiary: getFacetLabel(externalItems[0], 2, fallback?.tertiary ?? (isEnglish ? "Facet C" : "维度 C"), resolvedLanguage),
      mode: fallback?.mode ?? activeSourceDescriptor.label,
    };
  }, [activeSource, activeSourceDescriptor.label, externalItems, isEnglish, resolvedLanguage]);

  const liveSourceEntries = useMemo<MarketDiscoveryEntry[]>(
    () =>
      buildMarketDiscoveryEntries({
        activeSource,
        externalItems,
        externalSlugConflictMap,
        installedExternalSkillMap,
        language: resolvedLanguage,
      }),
    [activeSource, externalItems, externalSlugConflictMap, installedExternalSkillMap, resolvedLanguage],
  );

  const aggregateEntries = liveSourceEntries;

  const activeBrowseEntries = useMemo(() => liveSourceEntries, [liveSourceEntries]);

  const discoveryEntryMap = useMemo(
    () => Object.fromEntries(liveSourceEntries.map((entry) => [entry.external.id, entry])),
    [liveSourceEntries],
  );

  const repositoryOptions = useMemo(() => {
    const counts = activeBrowseEntries.reduce<Record<string, number>>((current, entry) => {
      current[entry.publisherLabel] = (current[entry.publisherLabel] ?? 0) + 1;
      return current;
    }, {});

    return [
      { value: "all", label: allRepositoriesLabel, count: activeBrowseEntries.length },
      ...Object.entries(counts)
        .map(([value, count]) => ({ value, label: value, count }))
        .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, resolvedLanguage)),
    ];
  }, [activeBrowseEntries, allRepositoriesLabel, resolvedLanguage]);

  const sourcePrimaryOptions = useMemo(
    () =>
      buildFacetOptions(
        activeBrowseEntries,
        formatAllFilterLabel(sourceLensLabels?.primary ?? (isEnglish ? "Category" : "分类"), resolvedLanguage),
        (entry) => entry.lensPrimary,
        resolvedLanguage,
      ),
    [activeBrowseEntries, isEnglish, resolvedLanguage, sourceLensLabels?.primary],
  );

  const sourceSecondaryOptions = useMemo(
    () =>
      buildFacetOptions(
        activeBrowseEntries,
        formatAllFilterLabel(sourceLensLabels?.secondary ?? (isEnglish ? "Team" : "团队"), resolvedLanguage),
        (entry) => entry.lensSecondary,
        resolvedLanguage,
      ),
    [activeBrowseEntries, isEnglish, resolvedLanguage, sourceLensLabels?.secondary],
  );

  const verificationOptions = useMemo(
    () => [
      { value: "all", label: allVerificationLabel },
      { value: "verified", label: getMarketVerificationLabel("verified", resolvedLanguage) },
      { value: "official", label: getMarketVerificationLabel("official", resolvedLanguage) },
      { value: "reviewing", label: getMarketVerificationLabel("reviewing", resolvedLanguage) },
      { value: "unverified", label: getMarketVerificationLabel("unverified", resolvedLanguage) },
    ],
    [allVerificationLabel, resolvedLanguage],
  );

  const discoveryFilters = useMemo(
    () => ({
      activeSource,
      selectedRepository,
      selectedSourcePrimary,
      selectedSourceSecondary,
      selectedState,
      selectedTopic,
      selectedUnifiedSource,
      selectedVerification,
    }),
    [
      activeSource,
      selectedRepository,
      selectedSourcePrimary,
      selectedSourceSecondary,
      selectedState,
      selectedTopic,
      selectedUnifiedSource,
      selectedVerification,
    ],
  );
  const matchesSourceAwareFilters = (entry: MarketDiscoveryEntry, ignoreState = false) =>
    matchesMarketDiscoveryFilters(entry, discoveryFilters, ignoreState);

  const stateCounts = useMemo(() => {
    return buildMarketStateCounts(activeBrowseEntries, discoveryFilters);
  }, [activeBrowseEntries, discoveryFilters]);

  const stateSelectOptions = useMemo(
    () =>
      (["all", "available", "installed", "conflict"] as ExternalStateFilter[]).map((state) => ({
        value: state,
        label: `${getExternalStateFilterLabel(state, resolvedLanguage)} · ${stateCounts[state]}`,
      })),
    [resolvedLanguage, stateCounts],
  );

  const hasMeaningfulStateFilter = useMemo(
    () => (["available", "installed", "conflict"] as ExternalStateFilter[]).filter((state) => stateCounts[state] > 0).length > 1,
    [stateCounts],
  );
  const showRepositoryFilter = repositoryOptions.length > 2;
  const showSourcePrimaryFilter = sourcePrimaryOptions.length > 2;
  const showSourceSecondaryFilter = sourceSecondaryOptions.length > 2;

  const filteredEntries = useMemo(
    () => activeBrowseEntries.filter((entry) => matchesSourceAwareFilters(entry)),
    [activeBrowseEntries, discoveryFilters],
  );

  const sourceCounts = useMemo<Record<MarketSourceKey, number>>(
    () =>
      buildMarketSourceCounts({
        activeSource,
        aggregateEntriesLength: aggregateEntries.length,
        aggregateSourceCounts,
        liveSourceEntries,
      }),
    [activeSource, aggregateEntries.length, aggregateSourceCounts, liveSourceEntries],
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredEntries.length / BROWSER_PAGE_SIZE)),
    [filteredEntries.length],
  );
  const currentPage = Math.min(resultPage, totalPages);
  const pageStart = (currentPage - 1) * BROWSER_PAGE_SIZE;
  const paginatedEntries = useMemo(
    () => filteredEntries.slice(pageStart, pageStart + BROWSER_PAGE_SIZE),
    [filteredEntries, pageStart],
  );
  const visiblePages = useMemo(
    () => buildVisiblePages(totalPages, currentPage),
    [currentPage, totalPages],
  );

  useEffect(() => {
    setResultPage(1);
  }, [
    activeSource,
    externalBoard,
    selectedRepository,
    selectedSourcePrimary,
    selectedSourceSecondary,
    selectedState,
    selectedTopic,
    selectedUnifiedSource,
    selectedVerification,
    debouncedSearchQuery,
  ]);

  useEffect(() => {
    if (activeSource === "all" && selectedState !== "all") {
      setSelectedState("all");
    }
  }, [activeSource, selectedState]);

  useEffect(() => {
    if (activeSource === "skillssh" && !showRepositoryFilter && selectedRepository !== "all") {
      setSelectedRepository("all");
    }
  }, [activeSource, selectedRepository, showRepositoryFilter]);

  useEffect(() => {
    if (activeSource !== "all" && !hasMeaningfulStateFilter && selectedState !== "all") {
      setSelectedState("all");
    }
  }, [activeSource, hasMeaningfulStateFilter, selectedState]);

  useEffect(() => {
    if (activeSource !== "skillssh" && activeSource !== "all" && !showSourcePrimaryFilter && selectedSourcePrimary !== "all") {
      setSelectedSourcePrimary("all");
    }
  }, [activeSource, selectedSourcePrimary, showSourcePrimaryFilter]);

  useEffect(() => {
    if (activeSource !== "skillssh" && activeSource !== "all" && !showSourceSecondaryFilter && selectedSourceSecondary !== "all") {
      setSelectedSourceSecondary("all");
    }
  }, [activeSource, selectedSourceSecondary, showSourceSecondaryFilter]);

  useEffect(() => {
    if (activeSource !== "all") {
      return;
    }

    const nextCounts: Record<MarketSourceKey, number> = {
      all: liveSourceEntries.length,
      skillssh: 0,
      officialskills: 0,
      clawskills: 0,
      clawhub: 0,
      user: 0,
    };

    for (const entry of liveSourceEntries) {
      entry.sourceKeys.forEach((key) => {
        if (key !== "all" && key !== "user") {
          nextCounts[key] += 1;
        }
      });
    }

    setAggregateSourceCounts(nextCounts);
  }, [activeSource, liveSourceEntries]);

  const recentSkills = useMemo(
    () =>
      [...skills]
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, 10),
    [skills],
  );

  useEffect(() => {
    let cancelled = false;

    if (recentSkills.length === 0) {
      setPrimarySourceMap({});
      return;
    }

    async function loadPrimarySources() {
      const results = await Promise.allSettled(
        recentSkills.map(async (skill) => {
          const sources = await listSkillSources(skill.id);
          return {
            skillId: skill.id,
            primarySource: sources.find((item) => item.isPrimary) ?? sources[0] ?? null,
          };
        }),
      );

      if (cancelled) {
        return;
      }

      const nextMap: Record<string, SkillSource | null> = {};
      for (const result of results) {
        if (result.status === "fulfilled") {
          nextMap[result.value.skillId] = result.value.primarySource;
        }
      }

      setPrimarySourceMap(nextMap);
    }

    void loadPrimarySources();

    return () => {
      cancelled = true;
    };
  }, [recentSkills]);

  const sourceItems = useMemo<GovernanceSourceItem[]>(
    () =>
      recentSkills.map((skill) => {
        const primarySource = primarySourceMap[skill.id] ?? null;
        const sourceType = primarySource?.sourceType ?? skill.sourceType;
        return {
          skill,
          primarySource,
          sourceType,
          sourceLabel: getPrimarySkillSourceLabel(skill.sourceType, primarySource, resolvedLanguage),
          sourceDetail: getPrimarySkillSourceDetail(primarySource, resolvedLanguage),
        };
      }),
    [primarySourceMap, recentSkills, resolvedLanguage],
  );

  const sourceFilters = useMemo(() => {
    const sourceTypes = Array.from(new Set(sourceItems.map((item) => item.sourceType)));
    const options = sourceTypes
      .map((sourceType) => ({
        value: sourceType,
        label: getSkillSourceTypeLabel(sourceType, resolvedLanguage),
        count: sourceItems.filter((item) => item.sourceType === sourceType).length,
      }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, resolvedLanguage));

    return [
      {
        value: "all",
        label: copy.allSources,
        count: sourceItems.length,
      },
      ...options,
    ];
  }, [copy.allSources, resolvedLanguage, sourceItems]);

  const filteredSourceItems = useMemo(
    () => sourceItems.filter((item) => selectedSourceType === "all" || item.sourceType === selectedSourceType),
    [selectedSourceType, sourceItems],
  );

  const openSkillWorkspace = (skillId: string) => {
    selectSkill(skillId);
    navigate(`/workspace/${skillId}`);
  };

  const { busyImport, currentImportStepIndex, importProgress, runImportAction } = useMarketImportFlow({
    copy,
    language: resolvedLanguage,
    skills,
    loadSkills,
    loadImportHistory: () => loadImportHistory(),
    openSkillWorkspace,
    onOpenActivity: () => undefined,
    onSuccessMessage: (content) => {
      message.success(content);
    },
    onErrorMessage: (content) => {
      message.error(content);
    },
  });

  const selectedExternalEntry = externalDetail.selectedSkill ? discoveryEntryMap[externalDetail.selectedSkill.id] ?? null : null;

  const handleGitImport = async () => {
    if (!gitUrl.trim()) {
      message.warning(copy.gitRequired);
      return;
    }

    await runImportAction({
      mode: "git",
      action: () =>
        importSkillFromGit({
          gitUrl: gitUrl.trim(),
          repoSubdir: gitSubdir.trim() || undefined,
        }),
      successMessage: copy.gitImportSuccess,
      errorTitle: copy.gitImportErrorTitle,
      errorPrefix: copy.gitImportErrorPrefix,
      afterSuccess: () => {
        setGitUrl("");
        setGitSubdir("");
        setManualIntakeOpen(false);
      },
    });
  };

  const handleLocalImport = async () => {
    const folderPath = await openSkillImportDialog();
    if (!folderPath) {
      return;
    }

    await runImportAction({
      mode: "local",
      action: () =>
        importSkill({
          folderPath,
        }),
      successMessage: copy.localImportSuccess,
      errorTitle: copy.localImportErrorTitle,
      errorPrefix: copy.localImportErrorPrefix,
      afterSuccess: () => {
        setManualIntakeOpen(false);
      },
    });
  };

  const handleExternalImport = async (entry: MarketDiscoveryEntry) => {
    if (entry.installedSkill) {
      openSkillWorkspace(entry.installedSkill.id);
      return;
    }

    if (entry.conflictSkill) {
      openSkillWorkspace(entry.conflictSkill.id);
      return;
    }

    const mode: ImportMode = `external:${entry.external.id}`;
    await runImportAction({
      mode,
      action: () =>
        importExternalMarketSkill({
          marketSource: entry.external.marketSource,
          source: entry.external.source,
          skillId: entry.external.skillId,
          installs: entry.external.installs,
          packageName: entry.external.packageName,
          packageVersion: entry.external.packageVersion,
          ownerHandle: entry.external.ownerHandle,
          displayName: entry.external.name,
        }),
      successMessage: copy.externalImportSuccess(entry.external.name),
      errorTitle: copy.externalImportErrorTitle(entry.external.name),
      errorPrefix: copy.externalImportErrorPrefix,
    });
  };

  const handleRetryImportRecord = async (record: SkillImportRecord) => {
    const payload = parseImportPayload(record);
    if (!payload) {
      message.warning(copy.retryMissingPayload);
      return;
    }

    const mode = resolveImportModeFromPayload(payload);
    const title = buildImportHistoryTitle(record, resolvedLanguage);

    await runImportAction({
      mode,
      action: async () => {
        if (payload.sourceType === "market_catalog" && payload.marketItemId) {
          return importMarketSkill(payload.marketItemId);
        }

        if (payload.sourceType === "skillssh" && payload.externalSource && payload.externalSkillId) {
          return importExternalMarketSkill({
            marketSource: payload.externalMarketSource ?? "skillssh",
            source: payload.externalSource,
            skillId: payload.externalSkillId,
            installs: payload.externalInstalls,
            packageName: payload.externalPackageName,
            packageVersion: payload.externalPackageVersion,
            ownerHandle: payload.externalOwnerHandle,
            displayName: payload.displayName,
          });
        }

        if (payload.sourceType === "git_repository" && payload.gitUrl) {
          return importSkillFromGit({
            gitUrl: payload.gitUrl,
            repoSubdir: payload.repoSubdir,
            displayName: payload.displayName,
          });
        }

        return importSkill(payload);
      },
      successMessage: copy.retryImportSuccess(title),
      errorTitle: copy.retryImportErrorTitle(title),
      errorPrefix: copy.retryImportErrorPrefix,
    });
  };

  const handleOpenDetail = (entry: MarketDiscoveryEntry) => {
    externalDetail.openDetail(entry.external);
  };

  const handleSourceChange = (nextSource: MarketSourceKey) => {
    setActiveSource(nextSource);
    setSelectedState("all");
    setSelectedSourcePrimary("all");
    setSelectedSourceSecondary("all");

    if (nextSource !== "all") {
      setSelectedUnifiedSource("all");
      setSelectedVerification("all");
    }

    if (nextSource !== "skillssh") {
      setSelectedRepository("all");
      setSelectedTopic("all");
      setExternalBoard("alltime");
    }
  };

  const summaryItems = useMemo(
    () => buildMarketSummaryItems({
      activeSource,
      activeSourceLabel: activeSourceDescriptor.label,
      externalBoard,
      filteredCount: filteredEntries.length,
      hasMeaningfulStateFilter,
      isSkillsshTopicMode,
      labels,
      language: resolvedLanguage,
      recommendationLabel,
      selectedRepository,
      selectedSourcePrimary,
      selectedSourceSecondary,
      selectedState,
      selectedTopicLabel,
      selectedUnifiedSource,
      selectedVerification,
      sourceLensModeLabel: sourceLensLabels?.mode,
    }),
    [
      activeSource,
      activeSourceDescriptor.label,
      externalBoard,
      filteredEntries.length,
      hasMeaningfulStateFilter,
      isSkillsshTopicMode,
      labels,
      recommendationLabel,
      resolvedLanguage,
      selectedRepository,
      selectedSourcePrimary,
      selectedSourceSecondary,
      selectedState,
      selectedTopicLabel,
      selectedUnifiedSource,
      selectedVerification,
      sourceLensLabels?.mode,
    ],
  );

  const liveSourceOptions = useMemo(
    () => [
      { value: "all", label: allLiveSourcesLabel },
      ...sourceRegistry
        .filter((source) => source.key !== "all" && source.availability === "live")
        .map((source) => ({ value: source.key, label: source.label })),
    ],
    [allLiveSourcesLabel, sourceRegistry],
  );

  const detailFacts = selectedExternalEntry
    ? buildDetailFacts(selectedExternalEntry, externalDetail.detail, resolvedLanguage)
    : [];
  const selectedExternalStatusLabel = selectedExternalEntry
    ? selectedExternalEntry.installedSkill
      ? copy.externalInstalled
      : selectedExternalEntry.conflictSkill
        ? getExternalStateFilterLabel("conflict", resolvedLanguage)
        : getExternalStateFilterLabel("available", resolvedLanguage)
    : "";
  const selectedExternalStatusToneClass = selectedExternalEntry?.installedSkill
    ? " is-success"
    : selectedExternalEntry?.conflictSkill
      ? " is-warning"
      : "";
  const documentationSourceLabel = getDocumentationSourceLabel(externalDetail.detail, resolvedLanguage);
  const detailSummary = (externalDetail.detail?.summary ?? selectedExternalEntry?.external.summary ?? "").trim();
  const rawDocumentationParagraphs = uniqueStrings(
    (externalDetail.detail?.documentationExcerpt ?? "").split(/\r?\n/).map((line) => line.trim()),
  );
  const documentationParagraphs = rawDocumentationParagraphs
    .filter((paragraph) => paragraph && (paragraph !== detailSummary || rawDocumentationParagraphs.length === 1))
    .slice(0, 2);

  return (
    <div className={`market-page market-page--hub market-page--source-${activeSource}`}>
      <header className="market-page__topbar">
        <div className="market-page__topbar-main">
          <div className="market-page__topbar-copy">
            <Title level={2} className="market-page__page-title">
              {pageTitle}
            </Title>
          </div>
        </div>

        <aside className="market-page__topbar-rail">
          <div className="market-page__topbar-side">
            <Button onClick={() => setActivityOpen(true)}>{activityLabel}</Button>
            <Button type="primary" onClick={() => setManualIntakeOpen(true)}>
              {manualIntakeLabel}
            </Button>
          </div>
        </aside>

        <div className="market-page__search-shell market-page__search-shell--control market-page__topbar-search">
          <Search size={16} />
          <input
            value={searchQuery}
            aria-label={searchLabel}
            placeholder={getGoalSearchPlaceholder(activeSource, resolvedLanguage)}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
      </header>

      <div className="market-page__navigator-shell">
        <section className="market-page__source-switcher">
          <div className="market-page__source-tabs" aria-label={sourceTabsRegionLabel}>
            {sourceRegistry.map((source) => (
              <button
                key={source.key}
                type="button"
                className={`market-page__source-tab market-page__source-tab--${source.key}${activeSource === source.key ? " is-active" : ""}`}
                onClick={() => handleSourceChange(source.key)}
                aria-pressed={activeSource === source.key}
              >
                <span className="market-page__source-tab-main">
                  <strong>{source.label}</strong>
                  <span className="market-page__source-tab-count">{sourceCounts[source.key]}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <MarketSourceNavigator
          activeSource={activeSource}
          language={resolvedLanguage}
          stateLabel={stateLabel}
          selectedState={selectedState}
          stateSelectOptions={stateSelectOptions}
          sourceFilterLabel={sourceFilterLabel}
          selectedUnifiedSource={selectedUnifiedSource}
          liveSourceOptions={liveSourceOptions}
          verificationLabel={verificationLabel}
          selectedVerification={selectedVerification}
          verificationOptions={verificationOptions}
          boardLabel={boardLabel}
          externalBoard={externalBoard}
          isSkillsshTopicMode={isSkillsshTopicMode}
          topicViewLabel={topicViewLabel}
          topicOptions={topicOptions}
          selectedTopic={selectedTopic}
          showRepositoryFilter={showRepositoryFilter}
          repositoryLabel={repositoryLabel}
          selectedRepository={selectedRepository}
          repositoryOptions={repositoryOptions}
          hasMeaningfulStateFilter={hasMeaningfulStateFilter}
          sourceLensLabels={sourceLensLabels}
          showSourcePrimaryFilter={showSourcePrimaryFilter}
          selectedSourcePrimary={selectedSourcePrimary}
          sourcePrimaryOptions={sourcePrimaryOptions}
          showSourceSecondaryFilter={showSourceSecondaryFilter}
          selectedSourceSecondary={selectedSourceSecondary}
          sourceSecondaryOptions={sourceSecondaryOptions}
          onStateChange={setSelectedState}
          onUnifiedSourceChange={setSelectedUnifiedSource}
          onVerificationChange={setSelectedVerification}
          onExternalBoardChange={setExternalBoard}
          onTopicChange={setSelectedTopic}
          onRepositoryChange={setSelectedRepository}
          onSourcePrimaryChange={setSelectedSourcePrimary}
          onSourceSecondaryChange={setSelectedSourceSecondary}
        />
      </div>

      {importProgress ? (
        <section className={`market-page__activity-banner${importProgress.status === "error" ? " is-error" : importProgress.status === "success" ? " is-success" : ""}`}>
          <div>
            <span className="market-page__console-label">{copy.importStatusLabel}</span>
            <strong>{importProgress.title}</strong>
            <p>{importProgress.detail}</p>
          </div>
          <Button size="small" onClick={() => setActivityOpen(true)}>
            {activityLabel}
          </Button>
        </section>
      ) : null}

      <section className={`market-page__workspace-shell market-page__workspace-shell--${activeSource}`}>
        <MarketResults
          activeSource={activeSource}
          activeSourceDescriptor={activeSourceDescriptor}
          language={resolvedLanguage}
          isEnglish={isEnglish}
          externalLoading={externalLoading}
          externalError={externalError}
          copy={copy}
          resultContextLabel={resultContextLabel}
          summaryItems={summaryItems}
          filteredEntries={filteredEntries}
          paginatedEntries={paginatedEntries}
          currentPage={currentPage}
          totalPages={totalPages}
          visiblePages={visiblePages}
          paginationPreviousLabel={paginationPreviousLabel}
          paginationNextLabel={paginationNextLabel}
          busyImport={busyImport}
          isSkillsshTopicMode={isSkillsshTopicMode}
          externalBoard={externalBoard}
          boardLabel={boardLabel}
          verificationLabel={verificationLabel}
          sourceLensLabels={sourceLensLabels}
          topicLabel={topicLabel}
          viewAllSourcesLabel={viewAllSourcesLabel}
          plannedSourceActionLabel={plannedSourceActionLabel}
          onShowAllSources={() => setActiveSource("all")}
          onOpenManualIntake={() => setManualIntakeOpen(true)}
          onReload={reloadExternalItems}
          onPageChange={setResultPage}
          onOpenDetail={handleOpenDetail}
          onImport={handleExternalImport}
        />
      </section>

      <MarketExternalDetailDrawer
        open={externalDetail.open}
        titleSkill={externalDetail.selectedSkill}
        entry={selectedExternalEntry}
        detail={externalDetail.detail}
        detailFacts={detailFacts}
        documentationSourceLabel={documentationSourceLabel}
        documentationParagraphs={documentationParagraphs}
        statusLabel={selectedExternalStatusLabel}
        statusToneClass={selectedExternalStatusToneClass}
        detailLoading={externalDetail.loading}
        detailError={externalDetail.error}
        busyImport={busyImport}
        copy={copy}
        language={resolvedLanguage}
        detailFactsLabel={detailFactsLabel}
        detailReadmeLabel={detailReadmeLabel}
        openSourceLabel={openSourceLabel}
        onClose={externalDetail.closeDetail}
        onReload={externalDetail.reloadDetail}
        onImport={handleExternalImport}
      />

      <MarketManualIntakeDrawer
        open={manualIntakeOpen}
        title={manualIntakeLabel}
        copy={copy}
        isEnglish={isEnglish}
        busyImport={busyImport}
        importProgress={importProgress}
        currentImportStepIndex={currentImportStepIndex}
        gitUrl={gitUrl}
        gitSubdir={gitSubdir}
        onClose={() => setManualIntakeOpen(false)}
        onGitUrlChange={setGitUrl}
        onGitSubdirChange={setGitSubdir}
        onLocalImport={handleLocalImport}
        onGitImport={handleGitImport}
      />

      <MarketActivityDrawer
        open={activityOpen}
        title={activityLabel}
        copy={copy}
        language={resolvedLanguage}
        activityHistoryLabel={activityHistoryLabel}
        recentAssetsLabel={recentAssetsLabel}
        busyImport={busyImport}
        importProgress={importProgress}
        currentImportStepIndex={currentImportStepIndex}
        historyLoading={historyLoading}
        historyError={historyError}
        importHistory={importHistory}
        sourceFilters={sourceFilters}
        selectedSourceType={selectedSourceType}
        sourceItems={sourceItems}
        filteredSourceItems={filteredSourceItems}
        onClose={() => setActivityOpen(false)}
        onReloadHistory={() => void loadImportHistory(true)}
        onRetryImport={handleRetryImportRecord}
        onOpenSkill={openSkillWorkspace}
        onSourceTypeChange={setSelectedSourceType}
      />
    </div>
  );
}
