import type { MarketCopy } from "../model/marketCopy";
import type { ImportProgressState } from "../model/marketTypes";

interface MarketImportStatusPanelProps {
  copy: MarketCopy;
  importProgress: ImportProgressState | null;
  isBusy: boolean;
  currentImportStepIndex: number;
}

export function MarketImportStatusPanel({
  copy,
  importProgress,
  isBusy,
  currentImportStepIndex,
}: MarketImportStatusPanelProps) {
  const currentStepLabel =
    currentImportStepIndex >= 0 ? copy.importSteps[currentImportStepIndex]?.label ?? copy.importStateIdle : copy.importStateIdle;
  const statusText = isBusy
    ? copy.importStateRunning
    : importProgress?.status === "error"
      ? copy.importStateFailed
      : importProgress?.status === "success"
        ? copy.importStateSuccess
        : copy.importStateIdle;
  const showErrorDetail = importProgress?.status === "error" && Boolean(importProgress.detail);

  return (
    <section className={`market-page__import-status${importProgress ? ` is-${importProgress.status}` : ""}`}>
      <div className="market-page__import-status-head">
        <div className="market-page__import-status-title">
          <span className="market-page__console-label">{copy.importStatusLabel}</span>
          <strong>{importProgress?.title ?? copy.importStatusWaiting}</strong>
        </div>
        <span className={`market-page__import-status-chip${importProgress ? ` is-${importProgress.status}` : ""}`}>
          {statusText}
        </span>
      </div>

      <div className="market-page__import-status-meta">
        <span className="market-page__import-status-meta-item">
          <em>{copy.importSourceLabel}</em>
          <strong>{importProgress?.sourceLabel ?? copy.importStateIdle}</strong>
        </span>
        <span className="market-page__import-status-meta-item">
          <em>{copy.importStageLabel}</em>
          <strong>{currentStepLabel}</strong>
        </span>
        <span className="market-page__import-status-meta-item">
          <em>{copy.importTargetLabel}</em>
          <strong>{importProgress?.targetName ?? copy.importStateIdle}</strong>
        </span>
      </div>

      {showErrorDetail ? <p className="market-page__import-status-copy">{importProgress.detail}</p> : null}

      <div className="market-page__import-step-list">
        {copy.importSteps.map((step, index) => {
          const isCompleted =
            importProgress?.status === "success"
              ? true
              : currentImportStepIndex > index;
          const isActive =
            importProgress?.status !== "success" &&
            currentImportStepIndex === index;

          return (
            <div
              key={step.key}
              className={`market-page__import-step${isCompleted ? " is-completed" : ""}${isActive ? " is-active" : ""}${importProgress?.status === "error" && isActive ? " is-error" : ""}`}
            >
              <span>{index + 1}</span>
              <strong className="market-page__import-step-label">{step.label}</strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}
