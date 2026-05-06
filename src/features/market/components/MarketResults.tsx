import Button from "antd/es/button";
import Card from "antd/es/card";
import Empty from "antd/es/empty";
import Spin from "antd/es/spin";
import {
  getAvailabilityLabel,
  getSourceCoverageLabel,
  getTopicSignal,
  type DetailFact,
  type MarketDiscoveryEntry,
  type MarketSourceLensLabels,
} from "../model/marketDiscovery";
import { getMarketCopy } from "../model/marketCopy";
import { getMarketVerificationLabel } from "../model/marketSources";
import type { ImportMode, MarketSourceDescriptor, MarketSourceKey, ResultSummaryItem, UiLanguage } from "../model/marketTypes";
import { formatExternalInstallCount, getExternalBoardLabel, getExternalStateFilterLabel } from "../model/marketUtils";
import { MarketPagination } from "./MarketPagination";
import { MarketResultSummary } from "./MarketResultSummary";
import type { ExternalMarketBoard } from "@/types/skill";

type MarketCopy = ReturnType<typeof getMarketCopy>;

interface MarketResultsProps {
  activeSource: MarketSourceKey;
  activeSourceDescriptor: MarketSourceDescriptor;
  language: UiLanguage;
  isEnglish: boolean;
  externalLoading: boolean;
  externalError: string | null;
  copy: MarketCopy;
  resultContextLabel: string;
  summaryItems: ResultSummaryItem[];
  filteredEntries: MarketDiscoveryEntry[];
  paginatedEntries: MarketDiscoveryEntry[];
  currentPage: number;
  totalPages: number;
  visiblePages: number[];
  paginationPreviousLabel: string;
  paginationNextLabel: string;
  busyImport: ImportMode;
  isSkillsshTopicMode: boolean;
  externalBoard: ExternalMarketBoard;
  boardLabel: string;
  verificationLabel: string;
  sourceLensLabels: MarketSourceLensLabels | null;
  topicLabel: string;
  viewAllSourcesLabel: string;
  plannedSourceActionLabel: string;
  onShowAllSources: () => void;
  onOpenManualIntake: () => void;
  onReload: () => void;
  onPageChange: (page: number) => void;
  onOpenDetail: (entry: MarketDiscoveryEntry) => void;
  onImport: (entry: MarketDiscoveryEntry) => void | Promise<void>;
}

function buildResultFacts({
  activeSource,
  boardLabel,
  entry,
  externalBoard,
  isEnglish,
  isSkillsshTopicMode,
  language,
  sourceLensLabels,
  topicLabel,
  verificationLabel,
}: {
  activeSource: MarketSourceKey;
  boardLabel: string;
  entry: MarketDiscoveryEntry;
  externalBoard: ExternalMarketBoard;
  isEnglish: boolean;
  isSkillsshTopicMode: boolean;
  language: UiLanguage;
  sourceLensLabels: MarketSourceLensLabels | null;
  topicLabel: string;
  verificationLabel: string;
}) {
  const resultFacts: DetailFact[] =
    activeSource === "skillssh"
      ? isSkillsshTopicMode
        ? [
            {
              label: isEnglish ? "Installs" : "安装量",
              value: formatExternalInstallCount(entry.external.installs),
            },
          ]
        : [
            { label: boardLabel, value: getExternalBoardLabel(externalBoard, language) },
            {
              label: isEnglish ? "Installs" : "安装量",
              value: formatExternalInstallCount(entry.external.installs),
            },
          ]
      : activeSource === "all"
        ? [
            {
              label: isEnglish ? "Installs" : "安装量",
              value: formatExternalInstallCount(entry.external.installs),
            },
            {
              label: verificationLabel,
              value: getMarketVerificationLabel(entry.verification, language),
            },
          ]
        : sourceLensLabels
          ? [
              {
                label: sourceLensLabels.primary,
                value: entry.lensPrimary,
              },
              {
                label: sourceLensLabels.secondary,
                value: entry.lensSecondary,
              },
              {
                label: sourceLensLabels.tertiary,
                value: entry.lensTertiary,
              },
            ]
          : [
              {
                label: verificationLabel,
                value: getMarketVerificationLabel(entry.verification, language),
              },
              {
                label: isEnglish ? "Installs" : "安装量",
                value: formatExternalInstallCount(entry.external.installs),
              },
            ];

  const topicSignal = getTopicSignal(entry, language);
  if (activeSource === "skillssh" && topicSignal && !isSkillsshTopicMode) {
    resultFacts.push({ label: topicLabel, value: topicSignal });
  }

  return resultFacts;
}

export function MarketResults({
  activeSource,
  activeSourceDescriptor,
  language,
  isEnglish,
  externalLoading,
  externalError,
  copy,
  resultContextLabel,
  summaryItems,
  filteredEntries,
  paginatedEntries,
  currentPage,
  totalPages,
  visiblePages,
  paginationPreviousLabel,
  paginationNextLabel,
  busyImport,
  isSkillsshTopicMode,
  externalBoard,
  boardLabel,
  verificationLabel,
  sourceLensLabels,
  topicLabel,
  viewAllSourcesLabel,
  plannedSourceActionLabel,
  onShowAllSources,
  onOpenManualIntake,
  onReload,
  onPageChange,
  onOpenDetail,
  onImport,
}: MarketResultsProps) {
  if (activeSourceDescriptor.availability !== "live") {
    return (
      <div className="market-page__planned-state">
        <div className="market-page__planned-state-copy">
          <span className="market-page__console-label">{getAvailabilityLabel(activeSource, language)}</span>
          <h3>{activeSourceDescriptor.emptyTitle}</h3>
          <p>{activeSourceDescriptor.emptyDescription}</p>
        </div>
        <div className="market-page__planned-state-actions">
          <Button onClick={onShowAllSources}>{viewAllSourcesLabel}</Button>
          <Button type="primary" onClick={onOpenManualIntake}>
            {plannedSourceActionLabel}
          </Button>
        </div>
      </div>
    );
  }

  if (externalLoading) {
    return (
      <div className="market-page__loading-shell">
        <Spin size="small" />
      </div>
    );
  }

  if (externalError) {
    return (
      <Card className="market-page__error-card" bordered={false}>
        <strong>{copy.externalLoadFailed}</strong>
        <p>{externalError}</p>
        <Button onClick={onReload}>{copy.reload}</Button>
      </Card>
    );
  }

  return (
    <>
      <MarketResultSummary summaryLabel={resultContextLabel} items={summaryItems} />

      {filteredEntries.length === 0 ? (
        <Empty description={activeSourceDescriptor.emptyTitle} className="market-page__empty market-page__empty--browser" />
      ) : (
        <>
          <div className="market-page__result-list">
            {paginatedEntries.map((entry) => {
              const statusLabelText = entry.installedSkill
                ? copy.externalInstalled
                : entry.conflictSkill
                  ? getExternalStateFilterLabel("conflict", language)
                  : getExternalStateFilterLabel("available", language);
              const statusToneClass = entry.installedSkill ? " is-success" : entry.conflictSkill ? " is-warning" : "";
              const actionLabel = entry.installedSkill
                ? copy.openWorkspace
                : entry.conflictSkill
                  ? copy.externalConflictAction
                  : copy.externalImportAction;
              const statusNote = entry.installedSkill
                ? copy.externalInstalledHint(entry.installedSkill.name)
                : entry.conflictSkill
                  ? copy.externalConflictHint(entry.conflictSkill.name, entry.conflictSkill.slug)
                  : null;
              const resultFacts = buildResultFacts({
                activeSource,
                boardLabel,
                entry,
                externalBoard,
                isEnglish,
                isSkillsshTopicMode,
                language,
                sourceLensLabels,
                topicLabel,
                verificationLabel,
              });

              return (
                <article
                  key={entry.external.id}
                  className={`market-page__result-row market-page__result-row--${entry.sourceKey}`}
                >
                  <div className="market-page__result-main">
                    <div className="market-page__result-topline">
                      <div className="market-page__result-title-block">
                        <div className="market-page__result-title-line">
                          <strong>{entry.external.name}</strong>
                          <span className="market-page__result-code">{entry.external.skillId}</span>
                        </div>
                        <div className="market-page__result-channel">
                          {activeSource === "all" ? <span className="market-page__result-source-pill">{entry.sourceLabel}</span> : null}
                          <span>{entry.publisherLabel}</span>
                          {activeSource === "all" ? <span>{getSourceCoverageLabel(entry.sourceCount, language)}</span> : null}
                        </div>
                      </div>

                      <div className="market-page__result-signal-list">
                        {entry.external.featured ? (
                          <span className="market-page__result-chip is-accent">{isEnglish ? "Featured" : "推荐"}</span>
                        ) : null}
                        <span className={`market-page__result-status${statusToneClass}`}>{statusLabelText}</span>
                      </div>
                    </div>

                    <p className="market-page__result-summary-text">{entry.external.summary}</p>

                    <div className="market-page__result-meta">
                      {resultFacts.map((fact) => (
                        <span key={`${entry.external.id}-${fact.label}`} className="market-page__result-fact">
                          <em>{fact.label}</em>
                          <strong>{fact.value}</strong>
                        </span>
                      ))}
                    </div>

                    {statusNote ? <p className="market-page__result-note">{statusNote}</p> : null}
                  </div>

                  <div className="market-page__result-side">
                    <div className="market-page__result-actions">
                      <Button size="small" className="market-page__result-action-secondary" onClick={() => onOpenDetail(entry)}>
                        {copy.externalDetailAction}
                      </Button>
                      <Button
                        size="small"
                        className="market-page__result-action-primary"
                        type={entry.installedSkill || entry.conflictSkill ? "default" : "primary"}
                        ghost={!entry.installedSkill && !entry.conflictSkill}
                        loading={!entry.installedSkill && !entry.conflictSkill && busyImport === `external:${entry.external.id}`}
                        onClick={() => void onImport(entry)}
                      >
                        {actionLabel}
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <MarketPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pages={visiblePages}
            totalCount={filteredEntries.length}
            previousLabel={paginationPreviousLabel}
            nextLabel={paginationNextLabel}
            language={language}
            onChange={onPageChange}
          />
        </>
      )}
    </>
  );
}
