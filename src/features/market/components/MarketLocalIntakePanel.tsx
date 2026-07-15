import Button from "antd/es/button";
import { FolderUp } from "lucide-react";
import type { MarketCopy } from "../model/marketCopy";

interface MarketLocalIntakePanelProps {
  copy: MarketCopy;
  busy: boolean;
  onImport: () => void | Promise<void>;
}

export function MarketLocalIntakePanel({
  copy,
  busy,
  onImport,
}: MarketLocalIntakePanelProps) {
  return (
    <section className="market-page__intake-panel market-page__intake-panel--local">
      <div className="market-page__source-button market-page__source-button--compact">
        <span className="market-page__source-icon">
          <FolderUp size={16} />
        </span>
        <span className="market-page__source-copy">
          <span className="market-page__console-label">{copy.quickImportLabel}</span>
          <strong>{copy.localSourceTitle}</strong>
          <span>{copy.localSourceDescription}</span>
        </span>
        <Button type="primary" loading={busy} onClick={() => void onImport()}>
          {copy.pickFolder}
        </Button>
      </div>
    </section>
  );
}
