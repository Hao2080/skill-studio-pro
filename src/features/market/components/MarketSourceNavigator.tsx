import Select from "antd/es/select";
import { Clock3, Star, TrendingUp } from "lucide-react";
import type { ExternalMarketBoard } from "@/types/skill";
import {
  getPreviewSections,
  type MarketSourceLensLabels,
  type MarketVerificationFilter,
  type TopicFilter,
  type UnifiedSourceFilter,
} from "../model/marketDiscovery";
import {
  EXTERNAL_MARKET_BOARDS,
  type ExternalStateFilter,
  type MarketSourceKey,
  type UiLanguage,
} from "../model/marketTypes";
import { getExternalBoardLabel } from "../model/marketUtils";

interface SelectOption<TValue extends string = string> {
  value: TValue;
  label: string;
  count?: number;
}

interface MarketSourceNavigatorProps {
  activeSource: MarketSourceKey;
  language: UiLanguage;
  stateLabel: string;
  selectedState: ExternalStateFilter;
  stateSelectOptions: SelectOption<ExternalStateFilter>[];
  sourceFilterLabel: string;
  selectedUnifiedSource: UnifiedSourceFilter;
  liveSourceOptions: SelectOption[];
  verificationLabel: string;
  selectedVerification: MarketVerificationFilter;
  verificationOptions: SelectOption[];
  boardLabel: string;
  externalBoard: ExternalMarketBoard;
  isSkillsshTopicMode: boolean;
  topicViewLabel: string;
  topicOptions: SelectOption<TopicFilter>[];
  selectedTopic: TopicFilter;
  showRepositoryFilter: boolean;
  repositoryLabel: string;
  selectedRepository: string;
  repositoryOptions: SelectOption[];
  hasMeaningfulStateFilter: boolean;
  sourceLensLabels: MarketSourceLensLabels | null;
  showSourcePrimaryFilter: boolean;
  selectedSourcePrimary: string;
  sourcePrimaryOptions: SelectOption[];
  showSourceSecondaryFilter: boolean;
  selectedSourceSecondary: string;
  sourceSecondaryOptions: SelectOption[];
  onStateChange: (value: ExternalStateFilter) => void;
  onUnifiedSourceChange: (value: UnifiedSourceFilter) => void;
  onVerificationChange: (value: MarketVerificationFilter) => void;
  onExternalBoardChange: (value: ExternalMarketBoard) => void;
  onTopicChange: (value: TopicFilter) => void;
  onRepositoryChange: (value: string) => void;
  onSourcePrimaryChange: (value: string) => void;
  onSourceSecondaryChange: (value: string) => void;
}

function withCounts(options: SelectOption[]) {
  return options.map(({ value, label, count }) => ({
    value,
    label: count == null ? label : `${label} · ${count}`,
  }));
}

export function MarketSourceNavigator({
  activeSource,
  language,
  stateLabel,
  selectedState,
  stateSelectOptions,
  sourceFilterLabel,
  selectedUnifiedSource,
  liveSourceOptions,
  verificationLabel,
  selectedVerification,
  verificationOptions,
  boardLabel,
  externalBoard,
  isSkillsshTopicMode,
  topicViewLabel,
  topicOptions,
  selectedTopic,
  showRepositoryFilter,
  repositoryLabel,
  selectedRepository,
  repositoryOptions,
  hasMeaningfulStateFilter,
  sourceLensLabels,
  showSourcePrimaryFilter,
  selectedSourcePrimary,
  sourcePrimaryOptions,
  showSourceSecondaryFilter,
  selectedSourceSecondary,
  sourceSecondaryOptions,
  onStateChange,
  onUnifiedSourceChange,
  onVerificationChange,
  onExternalBoardChange,
  onTopicChange,
  onRepositoryChange,
  onSourcePrimaryChange,
  onSourceSecondaryChange,
}: MarketSourceNavigatorProps) {
  if (activeSource === "all") {
    return (
      <section className="market-page__control-panel">
        <div className="market-page__navigator-section market-page__navigator-section--filters">
          <div className="market-page__filter-field">
            <span className="market-page__control-label">{stateLabel}</span>
            <Select
              value={selectedState}
              aria-label={stateLabel}
              className="market-page__filter-select"
              popupMatchSelectWidth={false}
              options={stateSelectOptions}
              onChange={(value) => onStateChange(value as ExternalStateFilter)}
            />
          </div>

          <div className="market-page__filter-field">
            <span className="market-page__control-label">{sourceFilterLabel}</span>
            <Select
              value={selectedUnifiedSource}
              aria-label={sourceFilterLabel}
              className="market-page__filter-select"
              popupMatchSelectWidth={false}
              options={liveSourceOptions}
              onChange={(value) => onUnifiedSourceChange(value as UnifiedSourceFilter)}
            />
          </div>

          <div className="market-page__filter-field">
            <span className="market-page__control-label">{verificationLabel}</span>
            <Select
              value={selectedVerification}
              aria-label={verificationLabel}
              className="market-page__filter-select"
              popupMatchSelectWidth={false}
              options={verificationOptions}
              onChange={(value) => onVerificationChange(value as MarketVerificationFilter)}
            />
          </div>
        </div>
      </section>
    );
  }

  if (activeSource === "skillssh") {
    return (
      <section className="market-page__control-panel market-page__control-panel--skills">
        <div className="market-page__navigator-grid market-page__navigator-grid--dense">
          <div className="market-page__navigator-strip market-page__navigator-strip--skills">
            <div className="market-page__navigator-inline-group market-page__navigator-inline-group--skills">
              <span className="market-page__control-label">{boardLabel}</span>
              <div className="market-page__board-row" role="tablist" aria-label={boardLabel}>
                {EXTERNAL_MARKET_BOARDS.map((board) => (
                  <button
                    key={board}
                    type="button"
                    className={`market-page__board-chip${!isSkillsshTopicMode && externalBoard === board ? " is-active" : ""}${isSkillsshTopicMode ? " is-muted" : ""}`}
                    onClick={() => {
                      onTopicChange("all");
                      onExternalBoardChange(board);
                    }}
                  >
                    {board === "alltime" ? <Star size={14} /> : board === "trending" ? <TrendingUp size={14} /> : <Clock3 size={14} />}
                    <span>{getExternalBoardLabel(board, language)}</span>
                  </button>
                ))}
              </div>
            </div>

            <span className="market-page__navigator-divider" aria-hidden="true" />

            <div className="market-page__navigator-inline-group market-page__navigator-inline-group--skills">
              <span className="market-page__control-label">{topicViewLabel}</span>
              <div className="market-page__category-row" role="group" aria-label={topicViewLabel}>
                {topicOptions
                  .filter((option) => option.value !== "all")
                  .map((option) => (
                    <button
                      type="button"
                      key={option.value}
                      className={`market-page__category-chip${selectedTopic === option.value ? " is-active" : ""}`}
                      onClick={() => {
                        const nextValue = selectedTopic === option.value ? "all" : option.value;
                        if (nextValue !== "all") {
                          onExternalBoardChange("alltime");
                        }
                        onTopicChange(nextValue);
                      }}
                    >
                      <span>{option.label}</span>
                    </button>
                  ))}
              </div>
            </div>

            {showRepositoryFilter || hasMeaningfulStateFilter ? (
              <span className="market-page__navigator-divider" aria-hidden="true" />
            ) : null}

            {showRepositoryFilter ? (
              <div className="market-page__filter-field market-page__filter-field--skills-inline">
                <span className="market-page__control-label">{repositoryLabel}</span>
                <Select
                  value={selectedRepository}
                  aria-label={repositoryLabel}
                  className="market-page__filter-select"
                  popupMatchSelectWidth={false}
                  showSearch
                  optionFilterProp="label"
                  options={withCounts(repositoryOptions)}
                  onChange={(value) => onRepositoryChange(value)}
                />
              </div>
            ) : null}

            {hasMeaningfulStateFilter ? (
              <div className="market-page__filter-field market-page__filter-field--skills-inline">
                <span className="market-page__control-label">{stateLabel}</span>
                <Select
                  value={selectedState}
                  aria-label={stateLabel}
                  className="market-page__filter-select"
                  popupMatchSelectWidth={false}
                  options={stateSelectOptions}
                  onChange={(value) => onStateChange(value as ExternalStateFilter)}
                />
              </div>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  if (!sourceLensLabels) {
    const sections = getPreviewSections(activeSource, language);

    return (
      <section className="market-page__control-panel market-page__control-panel--planned">
        <div className="market-page__navigator-grid">
          {sections.map((section) => (
            <div key={section.label} className="market-page__navigator-section">
              <span className="market-page__control-label">{section.label}</span>
              <div className="market-page__filter-preview">
                {section.items.map((item) => (
                  <span key={item} className="market-page__filter-preview-chip">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="market-page__control-panel">
      {showSourcePrimaryFilter || showSourceSecondaryFilter || hasMeaningfulStateFilter ? (
        <div className="market-page__navigator-section market-page__navigator-section--filters market-page__navigator-section--filters-tight">
          {showSourcePrimaryFilter ? (
            <div className="market-page__filter-field">
              <span className="market-page__control-label">{sourceLensLabels.primary}</span>
              <Select
                value={selectedSourcePrimary}
                aria-label={sourceLensLabels.primary}
                className="market-page__filter-select"
                popupMatchSelectWidth={false}
                showSearch
                optionFilterProp="label"
                options={withCounts(sourcePrimaryOptions)}
                onChange={(value) => onSourcePrimaryChange(value)}
              />
            </div>
          ) : null}

          {showSourceSecondaryFilter ? (
            <div className="market-page__filter-field">
              <span className="market-page__control-label">{sourceLensLabels.secondary}</span>
              <Select
                value={selectedSourceSecondary}
                aria-label={sourceLensLabels.secondary}
                className="market-page__filter-select"
                popupMatchSelectWidth={false}
                showSearch
                optionFilterProp="label"
                options={withCounts(sourceSecondaryOptions)}
                onChange={(value) => onSourceSecondaryChange(value)}
              />
            </div>
          ) : null}

          {hasMeaningfulStateFilter ? (
            <div className="market-page__filter-field">
              <span className="market-page__control-label">{stateLabel}</span>
              <Select
                value={selectedState}
                aria-label={stateLabel}
                className="market-page__filter-select"
                popupMatchSelectWidth={false}
                options={stateSelectOptions}
                onChange={(value) => onStateChange(value as ExternalStateFilter)}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
