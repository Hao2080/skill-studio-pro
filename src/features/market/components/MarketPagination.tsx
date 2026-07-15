import { BROWSER_PAGE_SIZE, type UiLanguage } from "../model/marketTypes";
import { getPaginationSummary } from "../model/marketUtils";

interface MarketPaginationProps {
  currentPage: number;
  totalPages: number;
  pages: number[];
  totalCount: number;
  previousLabel: string;
  nextLabel: string;
  language: UiLanguage;
  onChange: (page: number) => void;
}

export function MarketPagination({
  currentPage,
  totalPages,
  pages,
  totalCount,
  previousLabel,
  nextLabel,
  language,
  onChange,
}: MarketPaginationProps) {
  if (totalCount === 0) {
    return null;
  }

  const start = (currentPage - 1) * BROWSER_PAGE_SIZE + 1;
  const end = Math.min(currentPage * BROWSER_PAGE_SIZE, totalCount);

  return (
    <div className="market-page__pager">
      <span className="market-page__pager-summary">{getPaginationSummary(start, end, totalCount, language)}</span>
      <button
        type="button"
        className="market-page__pager-button"
        disabled={currentPage === 1}
        onClick={() => onChange(Math.max(1, currentPage - 1))}
      >
        {previousLabel}
      </button>
      {pages.map((page, index) => {
        const previous = pages[index - 1];
        const showGap = previous && page - previous > 1;

        return [
          showGap ? (
            <span key={`gap-${page}`} className="market-page__pager-gap">
              ...
            </span>
          ) : null,
          <button
            key={`page-${page}`}
            type="button"
            className={`market-page__pager-number${page === currentPage ? " is-active" : ""}`}
            onClick={() => onChange(page)}
          >
            {page}
          </button>,
        ];
      })}
      <button
        type="button"
        className="market-page__pager-button"
        disabled={currentPage === totalPages}
        onClick={() => onChange(Math.min(totalPages, currentPage + 1))}
      >
        {nextLabel}
      </button>
    </div>
  );
}
