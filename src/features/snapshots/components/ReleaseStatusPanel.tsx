import { useEffect, useMemo, useRef, useState } from "react";
import Button from "antd/es/button";
import Spin from "antd/es/spin";
import { ExternalLink, History, Send, Trash2 } from "lucide-react";
import { useI18n } from "@/features/settings/state/I18nContext";
import type {
  SkillPlatformReleaseOverview,
  SkillSnapshot,
} from "@/types/skill";
import { isSystemSnapshot } from "@/features/snapshots/model/snapshotSource";
import {
  formatPlatformCount,
  formatReleaseTime,
  getPlatformLabel,
  getPlatformState,
  getPrimaryActionLabel,
  getRecordDetail,
  getRecordHeadline,
  getReleaseStatusCopy,
} from "@/features/snapshots/model/releaseStatusPresentation";

interface ReleaseStatusPanelProps {
  activeSnapshot: SkillSnapshot | null;
  selectedSnapshot: SkillSnapshot | null;
  releaseOverview: SkillPlatformReleaseOverview | null;
  loading: boolean;
  publishing: boolean;
  busyPlatforms: string[];
  onPublish: () => void;
  onPublishPlatform: (platformName: string) => void;
  onRemovePlatform: (platformName: string) => void;
  onOpenSettings: () => void;
  onFocusActiveVersion: () => void;
}

export function ReleaseStatusPanel({
  activeSnapshot,
  selectedSnapshot,
  releaseOverview,
  loading,
  publishing,
  busyPlatforms,
  onPublish,
  onPublishPlatform,
  onRemovePlatform,
  onOpenSettings,
  onFocusActiveVersion,
}: ReleaseStatusPanelProps) {
  const { resolvedLanguage } = useI18n();
  const [recordFilter, setRecordFilter] = useState<string | null>(null);
  const recordsRef = useRef<HTMLDivElement | null>(null);
  const copy = getReleaseStatusCopy(resolvedLanguage);

  const releases = releaseOverview?.releases ?? [];
  const recentRecords = releaseOverview?.recentRecords ?? [];
  const selectedSystemSnapshot = isSystemSnapshot(selectedSnapshot);
  const enabledPlatformCount = useMemo(
    () => releases.filter((release) => release.detected && release.enabled && release.skillsDir).length,
    [releases],
  );
  const carryingPlatforms = useMemo(
    () => releases.filter((release) => release.currentTarget),
    [releases],
  );
  const selectedSnapshotPlatforms = useMemo(
    () =>
      selectedSnapshot
        ? carryingPlatforms.filter((release) => release.currentTarget?.snapshotId === selectedSnapshot.id)
        : [],
    [carryingPlatforms, selectedSnapshot],
  );
  const otherSnapshotPlatformCount = useMemo(
    () =>
      selectedSnapshot
        ? carryingPlatforms.filter((release) => release.currentTarget?.snapshotId !== selectedSnapshot.id).length
        : carryingPlatforms.length,
    [carryingPlatforms, selectedSnapshot],
  );
  const latestRecord = recentRecords[0] ?? null;
  const visibleRecords = useMemo(
    () => recentRecords.filter((record) => !recordFilter || record.platformName === recordFilter),
    [recentRecords, recordFilter],
  );
  const recordFilterLabel = useMemo(() => {
    if (!recordFilter) {
      return null;
    }

    const release = releases.find((item) => item.platformName === recordFilter);
    if (release) {
      return getPlatformLabel(release.platformName, release.displayName);
    }

    const record = recentRecords.find((item) => item.platformName === recordFilter);
    if (record) {
      return getPlatformLabel(record.platformName, record.displayName);
    }

    return recordFilter;
  }, [recentRecords, recordFilter, releases]);

  useEffect(() => {
    setRecordFilter(null);
  }, [selectedSnapshot?.id]);

  const publishState = !selectedSnapshot
    ? {
        tone: "warning" as const,
        label: resolvedLanguage === "en-US"
          ? "Workspace drafts cannot be published directly"
          : "工作副本草稿不能直接发布",
        detail: resolvedLanguage === "en-US"
          ? "Select a snapshot from the left before publishing or switching. The current platform targets remain visible below."
          : "先从左侧选择一个快照，再执行发布或改发；下方仍可查看当前平台承接与移除操作。",
      }
    : selectedSystemSnapshot
      ? {
          tone: "warning" as const,
          label: resolvedLanguage === "en-US"
            ? "System restore points cannot be published directly"
            : "系统恢复点不能直接发布",
          detail: resolvedLanguage === "en-US"
            ? "System restore points are only for recovering the workspace and cannot be used as external platform targets."
            : "系统恢复点只用于把工作区恢复到某个时刻，不能作为平台对外承接版本。",
        }
    : enabledPlatformCount === 0
      ? {
          tone: "warning" as const,
          label: resolvedLanguage === "en-US"
            ? "No publishable platforms available"
            : "当前没有可发布的平台",
          detail: resolvedLanguage === "en-US"
            ? "Connect and enable platforms in Settings before publishing this snapshot."
            : "请先在设置中接入并启用平台，再将当前快照发布出去。",
        }
      : selectedSnapshotPlatforms.length > 0
      ? {
          tone: "ready" as const,
            label: copy.currentVersionServedBy(selectedSnapshotPlatforms.length),
            detail:
              otherSnapshotPlatformCount > 0
                ? copy.otherVersionsServedBy(otherSnapshotPlatformCount)
                : copy.selectedCoverageStable,
          }
        : {
            tone: "neutral" as const,
            label: copy.currentVersionNotReleased,
            detail:
              otherSnapshotPlatformCount > 0
                ? copy.switchOtherVersions
                : copy.publishPerPlatform,
          };

  return (
    <section className="version-console-card version-console-card--release">
      <div className="version-console-card__toolbar">
        <div className="version-console-card__heading">
          <div className="version-console-card__headline">
            <div className="version-console-card__headline-main">
              <h3>{copy.title}</h3>
            </div>
            <div className="version-console-card__headline-side">
              <div className="version-console-card__badges">
                <span className={`version-console-card__status-badge version-console-card__status-badge--${publishState.tone}`}>
                  {selectedSystemSnapshot
                    ? copy.blocked
                    : publishState.tone === "ready"
                      ? copy.released
                      : selectedSnapshot
                        ? copy.pending
                        : copy.requireSnapshot}
                </span>
              </div>
              <p>{copy.subtitle}</p>
            </div>
          </div>
        </div>

        <div className="version-console-card__header-actions">
          <Button
            type="primary"
            icon={<Send size={14} />}
            loading={publishing}
            disabled={!selectedSnapshot || selectedSystemSnapshot || enabledPlatformCount === 0}
            onClick={onPublish}
          >
            {copy.publish}
          </Button>
          <Button icon={<ExternalLink size={14} />} onClick={onOpenSettings}>
            {copy.openSettings}
          </Button>
        </div>
      </div>

      <div className="version-console-card__meta-strip" aria-label={copy.summaryAria}>
        <span className="version-console-card__meta-item">
          <span className="version-console-card__meta-key">{copy.currentObject}</span>
          <span className="version-console-card__meta-value">
            {selectedSnapshot
              ? selectedSystemSnapshot
                ? copy.restorePoint(selectedSnapshot.snapshotNumber)
                : `v${selectedSnapshot.snapshotNumber}`
              : copy.workspaceDraft}
          </span>
        </span>
        <span className="version-console-card__meta-item">
          <span className="version-console-card__meta-key">{copy.currentTarget}</span>
          <span className="version-console-card__meta-value">
            {selectedSnapshot && !selectedSystemSnapshot
              ? formatPlatformCount(selectedSnapshotPlatforms.length, resolvedLanguage)
              : copy.directBlocked}
          </span>
        </span>
        <span className="version-console-card__meta-item">
          <span className="version-console-card__meta-key">{copy.otherTarget}</span>
          <span className="version-console-card__meta-value">
            {formatPlatformCount(otherSnapshotPlatformCount, resolvedLanguage)}
          </span>
        </span>
        <span className="version-console-card__meta-item">
          <span className="version-console-card__meta-key">{copy.latestAction}</span>
          <span className="version-console-card__meta-value">
            {latestRecord ? formatReleaseTime(latestRecord.createdAt, resolvedLanguage) : copy.noRecord}
          </span>
        </span>
      </div>

      <div className={`version-console-card__hint version-console-card__hint--${publishState.tone}`}>
        <div className="version-console-card__hint-copy">
          <strong>{publishState.label}</strong>
          <span>{publishState.detail}</span>
        </div>
        {!selectedSnapshot && activeSnapshot ? (
          <div className="version-console-card__hint-actions">
            <Button size="small" onClick={onFocusActiveVersion}>
              {copy.focusActive}
            </Button>
          </div>
        ) : null}
      </div>

      <Spin spinning={loading}>
        <div className="version-release-workbench" aria-label={copy.workbenchAria}>
          {releases.length > 0 ? (
            releases.map((release) => {
              const platformState = getPlatformState(release, selectedSnapshot, resolvedLanguage);
              const primaryActionLabel = getPrimaryActionLabel(release, selectedSnapshot, resolvedLanguage);
              const currentTargetLabel = release.currentTarget ? `v${release.currentTarget.snapshotNumber}` : copy.noTarget;
              const currentTargetDetail = release.currentTarget?.changeSummary?.trim()
                ? release.currentTarget.changeSummary.trim()
                : release.currentTarget
                  ? copy.noSummary
                  : release.enabled
                    ? copy.noRelease
                    : copy.disabledOnly;
              const platformBusy = busyPlatforms.includes(release.platformName);

              return (
                <div key={release.platformName} className="version-release-workbench__row">
                  <div className="version-release-workbench__row-main">
                    <div className="version-release-workbench__platform">
                      <div className="version-release-workbench__platform-head">
                        <strong>{getPlatformLabel(release.platformName, release.displayName)}</strong>
                        <span className={`version-console-card__status-badge version-console-card__status-badge--${platformState.tone}`}>
                          {platformState.label}
                        </span>
                      </div>
                      <div className="version-release-workbench__platform-meta">
                        <span className="version-release-workbench__meta-item">
                          {release.skillsDir ? copy.dirReady : copy.dirMissing}
                        </span>
                        <span className="version-release-workbench__meta-item">
                          {release.enabled ? copy.enabled : copy.disabled}
                        </span>
                        {release.currentTarget ? (
                          <span className="version-release-workbench__meta-item">
                            {copy.servedAt(formatReleaseTime(release.currentTarget.releasedAt, resolvedLanguage))}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="version-release-workbench__cell">
                      <span className="version-release-workbench__label">{copy.currentServing}</span>
                      <strong>{currentTargetLabel}</strong>
                      <p>{currentTargetDetail}</p>
                    </div>

                    <div className="version-release-workbench__cell">
                      <span className="version-release-workbench__label">{copy.latestRecord}</span>
                        <strong>
                          {release.lastRecord
                            ? getRecordHeadline(release.lastRecord, resolvedLanguage)
                            : copy.noRecordItem}
                        </strong>
                      <p>{release.lastRecord ? getRecordDetail(release.lastRecord, resolvedLanguage) : platformState.detail}</p>
                    </div>
                  </div>

                  <div className="version-release-workbench__actions">
                    {primaryActionLabel ? (
                      <Button
                        type={release.currentTarget?.snapshotId === selectedSnapshot?.id ? "default" : "primary"}
                        size="small"
                        loading={platformBusy}
                        onClick={() => onPublishPlatform(release.platformName)}
                      >
                        {primaryActionLabel}
                      </Button>
                    ) : null}
                    <Button
                      size="small"
                      icon={<History size={14} />}
                      onClick={() => {
                        setRecordFilter(release.platformName);
                        recordsRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                      }}
                    >
                      {copy.viewRecords}
                    </Button>
                    {release.currentTarget ? (
                      <Button
                        danger
                        size="small"
                        icon={<Trash2 size={14} />}
                        loading={platformBusy}
                        onClick={() => onRemovePlatform(release.platformName)}
                      >
                        {copy.remove}
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="version-release-workbench__empty">
              <strong>{copy.emptyTitle}</strong>
              <p>{copy.emptyDescription}</p>
            </div>
          )}
        </div>

        <div ref={recordsRef} className="version-release-records" aria-label={copy.recordsAria}>
          <div className="version-release-records__toolbar">
            <div className="version-release-records__heading">
              <strong>{copy.recordsTitle}</strong>
              <span>{copy.recordsDescription}</span>
            </div>
            {recordFilter ? (
              <Button size="small" onClick={() => setRecordFilter(null)}>
                {copy.viewAll}
              </Button>
            ) : null}
          </div>

          {visibleRecords.length > 0 ? (
            visibleRecords.map((record) => (
              <div key={record.id} className="version-release-records__row">
                <div className="version-release-records__main">
                  <div className="version-release-records__primary">
                    <strong>{getPlatformLabel(record.platformName, record.displayName)}</strong>
                    <span>{getRecordHeadline(record, resolvedLanguage)}</span>
                  </div>
                  <p>{getRecordDetail(record, resolvedLanguage)}</p>
                </div>
                <span className="version-release-records__time">{formatReleaseTime(record.createdAt, resolvedLanguage)}</span>
              </div>
            ))
          ) : (
            <div className="version-release-records__empty">
              <strong>{recordFilterLabel ? copy.noRecordWithFilter(recordFilterLabel) : copy.noRecords}</strong>
              <p>{copy.noRecordsDescription}</p>
            </div>
          )}
        </div>
      </Spin>
    </section>
  );
}
