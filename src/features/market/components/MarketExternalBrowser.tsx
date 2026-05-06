import Button from "antd/es/button";
import Card from "antd/es/card";
import Empty from "antd/es/empty";
import Spin from "antd/es/spin";
import Tag from "antd/es/tag";
import type { ExternalMarketSkill, Skill } from "@/types/skill";
import { MarketPagination } from "./MarketPagination";
import { MarketResultSummary } from "./MarketResultSummary";
import type { MarketCopy } from "../model/marketCopy";
import type { ImportMode, ResultSummaryItem, UiLanguage } from "../model/marketTypes";
import { buildExternalSourceRef, formatExternalInstallCount, getExternalStateFilterLabel } from "../model/marketUtils";

interface MarketExternalBrowserProps {
  copy: MarketCopy;
  language: UiLanguage;
  loading: boolean;
  error: string | null;
  filteredItems: ExternalMarketSkill[];
  paginatedItems: ExternalMarketSkill[];
  summaryItems: ResultSummaryItem[];
  currentPage: number;
  totalPages: number;
  visiblePages: number[];
  previousLabel: string;
  nextLabel: string;
  busyImport: ImportMode;
  installedSkillMap: Record<string, Skill>;
  conflictSkillMap: Record<string, Skill>;
  onRetryLoad: () => void;
  onOpenDetail: (item: ExternalMarketSkill) => void;
  onImport: (item: ExternalMarketSkill) => void | Promise<void>;
  onPageChange: (page: number) => void;
}

export function MarketExternalBrowser({
  copy,
  language,
  loading,
  error,
  filteredItems,
  paginatedItems,
  summaryItems,
  currentPage,
  totalPages,
  visiblePages,
  previousLabel,
  nextLabel,
  busyImport,
  installedSkillMap,
  conflictSkillMap,
  onRetryLoad,
  onOpenDetail,
  onImport,
  onPageChange,
}: MarketExternalBrowserProps) {
  if (loading) {
    return (
      <div className="market-page__loading-shell">
        <Spin size="small" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="market-page__error-card" bordered={false}>
        <strong>{copy.externalLoadFailed}</strong>
        <p>{error}</p>
        <Button onClick={onRetryLoad}>{copy.reload}</Button>
      </Card>
    );
  }

  if (filteredItems.length === 0) {
    return <Empty description={copy.externalNoResults} className="market-page__empty market-page__empty--browser" />;
  }

  return (
    <>
      <MarketResultSummary
        summaryLabel={copy.externalResultsCount(filteredItems.length)}
        items={summaryItems}
      />
      <div className="market-page__result-list">
        {paginatedItems.map((item) => {
          const externalRef = buildExternalSourceRef(item);
          const importMode: ImportMode = `external:${item.id}`;
          const installedSkill = installedSkillMap[externalRef] ?? null;
          const conflictSkill = conflictSkillMap[externalRef] ?? null;
          const statusNote = installedSkill
            ? copy.externalInstalledHint(installedSkill.name)
            : conflictSkill
              ? copy.externalConflictHint(conflictSkill.name, conflictSkill.slug)
              : null;
          const actionLabel = installedSkill
            ? copy.openWorkspace
            : conflictSkill
              ? copy.externalConflictAction
              : copy.externalImportAction;
          const statusLabel = installedSkill
            ? copy.externalInstalled
            : conflictSkill
              ? getExternalStateFilterLabel("conflict", language)
              : getExternalStateFilterLabel("available", language);

          return (
            <article key={item.id} className="market-page__result-row">
              <div className="market-page__result-main">
                <div className="market-page__result-topline">
                  <div className="market-page__result-title-block">
                    <div className="market-page__result-title-line">
                      <strong>{item.name}</strong>
                      <span className="market-page__result-code">{item.skillId}</span>
                    </div>
                    <span>{item.source}</span>
                  </div>
                  <Tag bordered={false} className="market-page__result-tag">
                    {item.category}
                  </Tag>
                </div>
                <div className="market-page__result-meta">
                  <strong>{copy.externalInstalls(formatExternalInstallCount(item.installs))}</strong>
                  {item.tags.slice(0, 1).map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <p className="market-page__result-summary-text">{item.summary}</p>
                {statusNote ? <p className="market-page__result-note">{statusNote}</p> : null}
              </div>

              <div className="market-page__result-side">
                <span className={`market-page__result-status${installedSkill ? " is-success" : conflictSkill ? " is-warning" : ""}`}>
                  {statusLabel}
                </span>
                <div className="market-page__result-actions">
                  <Button size="small" className="market-page__result-action-secondary" onClick={() => onOpenDetail(item)}>
                    {copy.externalDetailAction}
                  </Button>
                  <Button
                    size="small"
                    className="market-page__result-action-primary"
                    type={installedSkill || conflictSkill ? "default" : "primary"}
                    ghost={!installedSkill && !conflictSkill}
                    loading={!installedSkill && !conflictSkill && busyImport === importMode}
                    onClick={() => void onImport(item)}
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
        totalCount={filteredItems.length}
        previousLabel={previousLabel}
        nextLabel={nextLabel}
        language={language}
        onChange={onPageChange}
      />
    </>
  );
}
