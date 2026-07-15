import type { ResultSummaryItem } from "../model/marketTypes";

interface MarketResultSummaryProps {
  summaryLabel: string;
  items: ResultSummaryItem[];
}

export function MarketResultSummary({ summaryLabel, items }: MarketResultSummaryProps) {
  return (
    <div className="market-page__result-summary" aria-label={summaryLabel}>
      {items.length > 0 ? (
        <div className="market-page__result-summary-line">
          {items.map((item) => (
            <span
              key={item.key}
              className={`market-page__result-summary-item${item.key === "results" ? " is-emphasis" : ""}`}
            >
              <em>{item.label}</em>
              <strong>{item.value}</strong>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
