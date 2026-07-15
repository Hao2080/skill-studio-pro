import Button from "antd/es/button";
import Card from "antd/es/card";
import Empty from "antd/es/empty";
import Spin from "antd/es/spin";
import Tag from "antd/es/tag";
import type { MarketCatalogItem } from "@/types/skill";
import { MarketPagination } from "./MarketPagination";
import { MarketResultSummary } from "./MarketResultSummary";
import type { MarketCopy } from "../model/marketCopy";
import type { ImportMode, ResultSummaryItem, UiLanguage } from "../model/marketTypes";

interface MarketCatalogBrowserProps {
  copy: MarketCopy;
  language: UiLanguage;
  loading: boolean;
  error: string | null;
  filteredItems: MarketCatalogItem[];
  paginatedItems: MarketCatalogItem[];
  summaryItems: ResultSummaryItem[];
  currentPage: number;
  totalPages: number;
  visiblePages: number[];
  previousLabel: string;
  nextLabel: string;
  resultAuthorLabel: string;
  busyImport: ImportMode;
  onRetryLoad: () => void;
  onOpenDetail: (item: MarketCatalogItem) => void;
  onImport: (item: MarketCatalogItem) => void | Promise<void>;
  onPageChange: (page: number) => void;
}

export function MarketCatalogBrowser({
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
  resultAuthorLabel,
  busyImport,
  onRetryLoad,
  onOpenDetail,
  onImport,
  onPageChange,
}: MarketCatalogBrowserProps) {
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
        <strong>{copy.marketLoadFailed}</strong>
        <p>{error}</p>
        <Button onClick={onRetryLoad}>{copy.reload}</Button>
      </Card>
    );
  }

  if (filteredItems.length === 0) {
    return <Empty description={copy.noCatalogItems} className="market-page__empty market-page__empty--browser" />;
  }

  return (
    <>
      <MarketResultSummary
        summaryLabel={copy.catalogCount(filteredItems.length)}
        items={summaryItems}
      />
      <div className="market-page__result-list">
        {paginatedItems.map((item) => (
          <article key={item.id} className="market-page__result-row">
            <div className="market-page__result-main">
              <div className="market-page__result-topline">
                <div className="market-page__result-title-block">
                  <strong>{item.name}</strong>
                  <span>
                    {resultAuthorLabel}
                    {" · "}
                    {item.author}
                  </span>
                </div>
                <Tag bordered={false} className="market-page__result-tag">
                  {item.category}
                </Tag>
              </div>
              <div className="market-page__result-meta">
                <strong>{item.difficulty}</strong>
                {item.featured ? <span>{copy.featuredLabel}</span> : null}
                {item.tags.slice(0, 1).map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <p className="market-page__result-summary-text">{item.summary}</p>
            </div>

            <div className="market-page__result-side">
              <span className={`market-page__result-status${item.featured ? " is-success" : ""}`}>
                {item.featured ? copy.featuredLabel : copy.catalogBadge}
              </span>
              <div className="market-page__result-actions">
                <Button size="small" className="market-page__result-action-secondary" onClick={() => onOpenDetail(item)}>
                  {copy.externalDetailAction}
                </Button>
                <Button
                  size="small"
                  className="market-page__result-action-primary"
                  type="primary"
                  ghost
                  loading={busyImport === `market:${item.id}`}
                  onClick={() => void onImport(item)}
                >
                  {copy.importAction}
                </Button>
              </div>
            </div>
          </article>
        ))}
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
