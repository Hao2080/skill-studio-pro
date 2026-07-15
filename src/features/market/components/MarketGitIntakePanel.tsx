import type { ChangeEvent } from "react";
import Button from "antd/es/button";
import type { MarketCopy } from "../model/marketCopy";

interface MarketGitIntakePanelProps {
  copy: MarketCopy;
  gitUrl: string;
  gitSubdir: string;
  gitAddressLabel: string;
  gitSubdirLabel: string;
  gitSubdirStatus: string;
  busy: boolean;
  onGitUrlChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onGitSubdirChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onImport: () => void | Promise<void>;
}

export function MarketGitIntakePanel({
  copy,
  gitUrl,
  gitSubdir,
  gitAddressLabel,
  gitSubdirLabel,
  gitSubdirStatus,
  busy,
  onGitUrlChange,
  onGitSubdirChange,
  onImport,
}: MarketGitIntakePanelProps) {
  return (
    <section className="market-page__intake-panel market-page__intake-panel--repo">
      <div className="market-page__repo-toolbar">
        <div className="market-page__repo-toolbar-copy">
          <span className="market-page__console-label">{copy.repoImportLabel}</span>
          <strong>{copy.importFromRepo}</strong>
        </div>
        <span className="market-page__repo-toolbar-hint">{copy.repoImportHint}</span>
      </div>

      <div className="market-page__repo-console market-page__repo-console--open">
        <div className="market-page__repo-form">
          <label className="market-page__field-block">
            <span className="market-page__control-label">{gitAddressLabel}</span>
            <input
              className="market-page__input"
              value={gitUrl}
              aria-label={copy.gitUrlAria}
              placeholder={copy.gitUrlPlaceholder}
              onChange={onGitUrlChange}
            />
          </label>
          <label className="market-page__field-block">
            <span className="market-page__field-meta">
              <span className="market-page__control-label">{gitSubdirLabel}</span>
              <em>{gitSubdirStatus}</em>
            </span>
            <input
              className="market-page__input"
              value={gitSubdir}
              aria-label={copy.gitSubdirAria}
              placeholder={copy.gitSubdirPlaceholder}
              onChange={onGitSubdirChange}
            />
          </label>
        </div>
        <div className="market-page__repo-footer market-page__repo-footer--compact">
          <Button type="primary" loading={busy} onClick={() => void onImport()}>
            {copy.importFromRepo}
          </Button>
        </div>
      </div>
    </section>
  );
}
