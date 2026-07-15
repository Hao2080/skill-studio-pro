import { useEffect, useState } from "react";
import Button from "antd/es/button";
import Popconfirm from "antd/es/popconfirm";
import TextArea from "antd/es/input/TextArea";
import { CheckCircle2, Files, FolderOpen, PencilLine, RotateCcw, Save, Trash2, X } from "lucide-react";
import { useI18n } from "@/features/settings/state/I18nContext";
import type { SkillSnapshot } from "@/types/skill";
import type { CompareDraft, SelectedEntity } from "@/features/snapshots/model/versionSelection";
import { isSystemSnapshot } from "@/features/snapshots/model/snapshotSource";
import {
  formatFileCount,
  formatSnapshotTime,
  getSnapshotStateLabel,
  getWorkspaceRelationLabel,
  getVersionDetailCopy,
} from "@/features/snapshots/model/versionDetailPresentation";

interface VersionDetailPanelProps {
  selectedEntity: SelectedEntity | null;
  selectedSnapshot: SkillSnapshot | null;
  activeSnapshot: SkillSnapshot | null;
  latestSnapshot: SkillSnapshot | null;
  hasWorkspaceChanges: boolean;
  changedFileCount: number;
  compareDraft: CompareDraft;
  onCompareWithWorkspace: () => void;
  onCancelCompare: () => void;
  onRestoreSnapshot: (snapshotId: string) => void;
  onSetActiveSnapshot: (snapshotId: string) => void;
  onDeleteSnapshot: (snapshotId: string) => void;
  onUpdateSummary: (snapshotId: string, summary: string) => Promise<void>;
  onOpenFiles: () => void;
  showCompareReadyInline?: boolean;
}

export function VersionDetailPanel({
  selectedEntity,
  selectedSnapshot,
  activeSnapshot,
  latestSnapshot,
  hasWorkspaceChanges,
  changedFileCount,
  compareDraft,
  onCompareWithWorkspace,
  onCancelCompare,
  onRestoreSnapshot,
  onSetActiveSnapshot,
  onDeleteSnapshot,
  onUpdateSummary,
  onOpenFiles,
  showCompareReadyInline = true,
}: VersionDetailPanelProps) {
  const { resolvedLanguage } = useI18n();
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [savingSummary, setSavingSummary] = useState(false);
  const copy = getVersionDetailCopy(resolvedLanguage);

  useEffect(() => {
    setEditingSummary(false);
    setSavingSummary(false);
    setSummaryDraft(selectedSnapshot?.changeSummary ?? "");
  }, [selectedSnapshot?.id, selectedSnapshot?.changeSummary]);

  if (selectedEntity?.type === "workspace") {
    const workspaceCompareReady = Boolean(
      latestSnapshot && compareDraft.baseSnapshotId === latestSnapshot.id && compareDraft.selectingTarget,
    );
    const workspaceCompareReadyInline = workspaceCompareReady && showCompareReadyInline;
    const workspaceStateLabel = !latestSnapshot
      ? copy.workspacePending
      : hasWorkspaceChanges
        ? copy.workspaceDraft
        : copy.workspaceStable;
    const workspaceDescription = latestSnapshot
      ? hasWorkspaceChanges
        ? copy.workspaceDescriptionWithChanges(changedFileCount)
        : copy.workspaceDescriptionAligned(latestSnapshot.snapshotNumber)
      : copy.workspaceDescriptionEmpty;

    return (
      <section className="version-console-card version-console-card--detail">
        <div className="version-console-card__toolbar">
          <div className="version-console-card__heading">
            <div className="version-console-card__headline">
              <div className="version-console-card__headline-main">
                <h3>{copy.workspace}</h3>
              </div>
              <div className="version-console-card__headline-side">
                <div className="version-console-card__badges">
                  <span
                    className={`version-console-card__status-badge ${
                      latestSnapshot
                        ? hasWorkspaceChanges
                          ? "version-console-card__status-badge--warning"
                          : "version-console-card__status-badge--active"
                        : "version-console-card__status-badge--neutral"
                    }`}
                  >
                    {workspaceStateLabel}
                  </span>
                </div>
                <p>{copy.workspaceHeadline}</p>
              </div>
            </div>
          </div>

          <div className="version-console-card__header-actions">
            <Button icon={<FolderOpen size={14} />} onClick={onOpenFiles}>
              {copy.goFiles}
            </Button>
          </div>
        </div>

        <div className="version-console-card__meta-strip" aria-label={copy.workspaceMetaAria}>
          <span className="version-console-card__meta-item">
            <span className="version-console-card__meta-key">{copy.currentStatus}</span>
            <span className="version-console-card__meta-value">{workspaceStateLabel}</span>
          </span>
          <span className="version-console-card__meta-item">
            <span className="version-console-card__meta-key">{copy.changedFiles}</span>
            <span className="version-console-card__meta-value">
              {formatFileCount(changedFileCount, resolvedLanguage)}
            </span>
          </span>
          <span className="version-console-card__meta-item">
            <span className="version-console-card__meta-key">{copy.baseline}</span>
            <span className="version-console-card__meta-value">
              {latestSnapshot ? copy.baselineLatest(latestSnapshot.snapshotNumber) : copy.baselineMissing}
            </span>
          </span>
        </div>

        <div
          className={`version-console-card__hint version-console-card__hint--${
            !latestSnapshot ? "warning" : workspaceCompareReadyInline ? "active" : "neutral"
          }`}
          aria-label={workspaceCompareReadyInline ? copy.compareReadyAria : copy.workspaceHintAria}
        >
          <div className="version-console-card__hint-copy">
            <strong>
              {!latestSnapshot
                ? copy.noBaselineTitle
                : workspaceCompareReadyInline
                  ? copy.compareReadyTitle(latestSnapshot.snapshotNumber)
                  : copy.workspaceHintTitle}
            </strong>
            <span>
              {!latestSnapshot
                ? copy.noBaselineBody
                : workspaceCompareReadyInline
                  ? copy.compareReadyBody
                  : copy.workspaceHintBody}
            </span>
          </div>
          {workspaceCompareReadyInline ? (
            <div className="version-console-card__hint-actions">
              <Button size="small" onClick={onCompareWithWorkspace}>
                {copy.compareWorkspace}
              </Button>
              <Button size="small" onClick={onCancelCompare}>
                {copy.cancelCompare}
              </Button>
            </div>
          ) : null}
        </div>

        <div className="version-console-card__description version-console-card__description--body">
          <p
            className={`version-console-card__description-text${
              latestSnapshot ? "" : " version-console-card__description-text--placeholder"
            }`}
          >
            {workspaceDescription}
          </p>
        </div>
      </section>
    );
  }

  if (!selectedSnapshot) {
    return (
      <section className="version-console-card version-console-card--detail">
        <div className="version-console-card__toolbar">
          <div className="version-console-card__heading">
            <div className="version-console-card__headline">
              <div className="version-console-card__headline-main">
                <h3>{copy.chooseVersion}</h3>
              </div>
              <div className="version-console-card__headline-side">
                <div className="version-console-card__badges">
                  <span className="version-console-card__status-badge version-console-card__status-badge--neutral">
                    {copy.pendingSelection}
                  </span>
                </div>
                <p>{copy.chooseVersionDescription}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const snapshot = selectedSnapshot;
  const compareBaseSelected = compareDraft.baseSnapshotId === snapshot.id && compareDraft.selectingTarget;
  const compareBaseSelectedInline = compareBaseSelected && showCompareReadyInline;
  const stateLabel = getSnapshotStateLabel(snapshot, latestSnapshot, resolvedLanguage);
  const relationLabel = getWorkspaceRelationLabel(
    snapshot,
    latestSnapshot,
    activeSnapshot,
    hasWorkspaceChanges,
    resolvedLanguage,
  );
  const isLatestSnapshot = latestSnapshot?.id === snapshot.id;
  const systemSnapshot = isSystemSnapshot(snapshot);
  const snapshotStateTone = systemSnapshot ? "warning" : snapshot.isActive ? "active" : isLatestSnapshot ? "warning" : "neutral";
  const hasSummary = Boolean(snapshot.changeSummary?.trim());

  async function handleSaveSummary() {
    setSavingSummary(true);
    try {
      await onUpdateSummary(snapshot.id, summaryDraft);
      setEditingSummary(false);
    } finally {
      setSavingSummary(false);
    }
  }

  function handleCancelEdit() {
    setEditingSummary(false);
    setSummaryDraft(snapshot.changeSummary ?? "");
  }

  return (
    <section className="version-console-card version-console-card--detail">
      <div className="version-console-card__toolbar">
        <div className="version-console-card__heading">
          <div className="version-console-card__headline">
            <div className="version-console-card__headline-main">
              <h3>v{snapshot.snapshotNumber}</h3>
            </div>
            <div className="version-console-card__headline-side">
              <div className="version-console-card__badges">
                <span className={`version-console-card__status-badge version-console-card__status-badge--${snapshotStateTone}`}>
                  {stateLabel}
                </span>
              </div>
              <p>
                {systemSnapshot
                  ? copy.snapshotHeadlineSystem
                  : copy.snapshotHeadlineFormal}
              </p>
            </div>
          </div>
        </div>

        <div className="version-console-card__header-actions">
          <Button icon={<RotateCcw size={14} />} onClick={() => onRestoreSnapshot(snapshot.id)}>
            {copy.restore}
          </Button>
          {!systemSnapshot && !snapshot.isActive ? (
            <Button type="primary" icon={<CheckCircle2 size={14} />} onClick={() => onSetActiveSnapshot(snapshot.id)}>
              {copy.setActive}
            </Button>
          ) : null}
          <Button icon={<Files size={14} />} onClick={onOpenFiles}>
            {copy.goFiles}
          </Button>
        </div>
      </div>

      <div className="version-console-card__meta-strip" aria-label={copy.snapshotMetaAria}>
        <span className="version-console-card__meta-item">
          <span className="version-console-card__meta-key">{copy.type}</span>
          <span className="version-console-card__meta-value">{systemSnapshot ? copy.typeSystem : copy.typeFormal}</span>
        </span>
        <span className="version-console-card__meta-item">
          <span className="version-console-card__meta-key">{copy.status}</span>
          <span className="version-console-card__meta-value">{stateLabel}</span>
        </span>
        <span className="version-console-card__meta-item">
          <span className="version-console-card__meta-key">{copy.createdAt}</span>
          <span className="version-console-card__meta-value">{formatSnapshotTime(snapshot.createdAt, resolvedLanguage)}</span>
        </span>
        <span className="version-console-card__meta-item">
          <span className="version-console-card__meta-key">{copy.relation}</span>
          <span className="version-console-card__meta-value">{relationLabel}</span>
        </span>
      </div>

      {compareBaseSelectedInline ? (
        <div
          className={`version-console-card__hint version-console-card__hint--${compareBaseSelectedInline ? "active" : "neutral"}`}
          aria-label={copy.compareReadyAria}
        >
          <div className="version-console-card__hint-copy">
            <strong>{copy.compareReady}</strong>
            <span>{copy.compareReadyDescription}</span>
          </div>
          <div className="version-console-card__hint-actions">
            <Button size="small" onClick={onCompareWithWorkspace}>
              {copy.compareWorkspace}
            </Button>
            <Button size="small" onClick={onCancelCompare}>
              {copy.cancelCompare}
            </Button>
          </div>
        </div>
      ) : null}

      <div
        className={`version-console-card__description version-console-card__description--body${
          compareBaseSelectedInline ? "" : " version-console-card__description--attached"
        }`}
        aria-label={copy.summaryAria}
      >
        <div className="version-console-card__description-head version-console-card__description-head--inline">
          <div className="version-console-card__keyval">
            <strong className="version-console-card__keyval-key">{copy.summaryTitle}</strong>
            <span className="version-console-card__keyval-value">
              {systemSnapshot ? copy.systemSummaryHint : copy.manualSummaryHint}
            </span>
          </div>
          <div className="version-console-card__description-actions">
            {!systemSnapshot && editingSummary ? (
              <>
                <Button
                  type="primary"
                  size="small"
                  icon={<Save size={14} />}
                  loading={savingSummary}
                  onClick={() => void handleSaveSummary()}
                >
                  {copy.saveSummary}
                </Button>
                <Button size="small" icon={<X size={14} />} disabled={savingSummary} onClick={handleCancelEdit}>
                  {copy.cancelEdit}
                </Button>
              </>
            ) : !systemSnapshot ? (
              <Button size="small" icon={<PencilLine size={14} />} onClick={() => setEditingSummary(true)}>
                {copy.editSummary}
              </Button>
            ) : null}
          </div>
        </div>
        {!systemSnapshot && editingSummary ? (
          <TextArea
            value={summaryDraft}
            autoSize={{ minRows: 4, maxRows: 10 }}
            className="version-console-card__description-editor"
            placeholder={copy.summaryPlaceholder}
            onChange={(event) => setSummaryDraft(event.target.value)}
          />
        ) : (
          <p
            className={`version-console-card__description-text${
              hasSummary ? "" : " version-console-card__description-text--placeholder"
            }`}
          >
            {hasSummary
              ? snapshot.changeSummary
              : systemSnapshot
                ? copy.systemSummaryFallback
                : copy.manualSummaryFallback}
          </p>
        )}
      </div>

      {!snapshot.isActive ? (
        <div className="version-console-card__danger-zone">
          <div className="version-console-card__danger-copy">
            <div className="version-console-card__keyval version-console-card__keyval--danger">
              <strong className="version-console-card__keyval-key">{copy.deleteTitle}</strong>
              <span className="version-console-card__keyval-value">{copy.deleteDescription}</span>
            </div>
          </div>

          <Popconfirm
            title={copy.deleteConfirmTitle}
            description={copy.deleteConfirmDescription}
            okText={copy.deleteConfirm}
            cancelText={copy.cancel}
            onConfirm={() => onDeleteSnapshot(snapshot.id)}
          >
            <Button danger icon={<Trash2 size={14} />}>
              {copy.delete}
            </Button>
          </Popconfirm>
        </div>
      ) : null}
    </section>
  );
}
