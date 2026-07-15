import type { Ref } from "react";
import Spin from "antd/es/spin";
import Tag from "antd/es/tag";
import type { SkillSnapshot } from "@/types/skill";
import type { CompareDraft, SelectedEntity } from "@/features/snapshots/model/versionSelection";
import type { UiLanguage } from "@/features/snapshots/model/presentationTypes";
import {
  formatSnapshotTime,
  type VersionHistoryCopy,
} from "@/features/snapshots/model/versionHistoryPresentation";

export interface VersionTimelineGroup {
  key: string;
  title: string;
  description: string;
  snapshots: SkillSnapshot[];
  systemGroup: boolean;
}

interface VersionTimelineSidebarProps {
  copy: VersionHistoryCopy;
  language: UiLanguage;
  timelineRef: Ref<HTMLDivElement>;
  snapshotsLoading: boolean;
  selectedEntity: SelectedEntity | null;
  compareDraft: CompareDraft;
  selectingCompareTarget: boolean;
  compareTargetHint: string;
  manualSnapshotCount: number;
  systemSnapshotCount: number;
  timelineGroups: VersionTimelineGroup[];
  hasChanges: boolean;
  changedFileCount: number;
  workspaceBaseSummary: string;
  highlightedSnapshotId: string | null;
  onSelectWorkspace: () => void;
  onSelectSnapshot: (snapshotId: string) => void;
}

export function VersionTimelineSidebar({
  copy,
  language,
  timelineRef,
  snapshotsLoading,
  selectedEntity,
  compareDraft,
  selectingCompareTarget,
  compareTargetHint,
  manualSnapshotCount,
  systemSnapshotCount,
  timelineGroups,
  hasChanges,
  changedFileCount,
  workspaceBaseSummary,
  highlightedSnapshotId,
  onSelectWorkspace,
  onSelectSnapshot,
}: VersionTimelineSidebarProps) {
  return (
    <aside className="version-history-sidebar">
      <div className="version-history-sidebar__timeline-header">
        <div className="version-history-sidebar__title-row">
          <div className="version-history-sidebar__title-meta">
            <strong className="version-history-sidebar__section-title">{copy.timelineTitle}</strong>
            {selectingCompareTarget ? (
              <span className="version-history-sidebar__mode-chip">{copy.compareDraft}</span>
            ) : null}
          </div>
          <div
            className="version-history-sidebar__title-meta"
            aria-label={copy.versionCountsAria(manualSnapshotCount, systemSnapshotCount)}
          >
            <span className="version-history-sidebar__timeline-count">
              {copy.localVersions} {copy.countLabel(manualSnapshotCount)}
            </span>
            <span className="version-history-sidebar__timeline-count">
              {copy.restorePoints} {copy.countLabel(systemSnapshotCount)}
            </span>
          </div>
        </div>
      </div>

      <div ref={timelineRef} className="version-history-timeline">
        <Spin spinning={snapshotsLoading}>
          <button
            type="button"
            className={`version-workspace-card${selectedEntity?.type === "workspace" ? " is-selected" : ""}${
              selectingCompareTarget ? " is-compare-target" : ""
            }`}
            onClick={onSelectWorkspace}
          >
            <div className="version-workspace-card__top">
              <div className="version-workspace-card__identity">
                <span className="version-workspace-card__eyebrow">{copy.currentObject}</span>
                <strong>{copy.workspace}</strong>
              </div>
              <span
                className={`workspace-status-badge ${
                  hasChanges ? "workspace-status-badge--warning" : "workspace-status-badge--ready"
                }`}
              >
                {hasChanges ? copy.draft : copy.stable}
              </span>
            </div>
            <div className="version-workspace-card__summary">
              <p>{hasChanges ? copy.workspaceDraftSummary(changedFileCount) : copy.workspaceAligned}</p>
              <span className="version-workspace-card__meta">{workspaceBaseSummary}</span>
            </div>
            {selectingCompareTarget ? (
              <span className="version-workspace-card__target-hint">{compareTargetHint}</span>
            ) : null}
          </button>

          {timelineGroups.length > 0 ? (
            timelineGroups.map((group) => (
              <section
                key={group.key}
                className={`version-history-timeline__group${
                  group.systemGroup ? " version-history-timeline__group--system" : ""
                }`}
                aria-label={group.title}
              >
                <div className="version-history-timeline__group-head">
                  <div className="version-history-timeline__group-copy">
                    <strong>{group.title}</strong>
                    <span>{group.description}</span>
                  </div>
                  <span className="version-history-timeline__group-count">{copy.countLabel(group.snapshots.length)}</span>
                </div>

                <div className="version-history-timeline__group-list">
                  {group.snapshots.map((snapshot, index) => {
                    const isSelected = selectedEntity?.type === "snapshot" && selectedEntity.snapshotId === snapshot.id;
                    const isCompareBase = compareDraft.baseSnapshotId === snapshot.id;
                    const isLatest = index === 0;
                    const isHighlighted = highlightedSnapshotId === snapshot.id;
                    const systemGroup = group.systemGroup;

                    return (
                      <button
                        type="button"
                        key={snapshot.id}
                        data-snapshot-id={snapshot.id}
                        onClick={() => onSelectSnapshot(snapshot.id)}
                        className={`version-snapshot-card${isSelected ? " is-selected" : ""}${
                          isCompareBase ? " is-base" : ""
                        }${isHighlighted ? " is-highlighted" : ""}${
                          selectingCompareTarget && !isCompareBase ? " is-compare-target" : ""
                        }${systemGroup ? " is-system" : ""}`}
                      >
                        <div className="version-snapshot-card__top">
                          <div className="version-snapshot-card__version">
                            <span className={`version-snapshot-card__version-dot${isLatest ? " is-latest" : ""}`}>
                              v{snapshot.snapshotNumber}
                            </span>
                            <div className="version-snapshot-card__version-meta">
                              <div className="version-snapshot-card__title-row">
                                <span className="version-snapshot-card__title">
                                  {snapshot.changeSummary || (systemGroup ? copy.restoreBadge : copy.summaryFallback)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="version-snapshot-card__badges">
                            {isCompareBase ? (
                              <Tag
                                bordered={false}
                                className="workspace-status-badge workspace-status-badge--active version-snapshot-card__tag"
                              >
                                {copy.baseBadge}
                              </Tag>
                            ) : null}
                            {systemGroup ? (
                              <Tag
                                bordered={false}
                                className="workspace-status-badge workspace-status-badge--warning version-snapshot-card__tag"
                              >
                                {copy.restoreBadge}
                              </Tag>
                            ) : null}
                            {snapshot.isActive ? (
                              <Tag
                                bordered={false}
                                className="workspace-status-badge workspace-status-badge--active version-snapshot-card__tag"
                              >
                                {copy.activeBadge}
                              </Tag>
                            ) : null}
                            {isLatest ? (
                              <Tag
                                bordered={false}
                                className={`workspace-status-badge ${
                                  systemGroup
                                    ? "workspace-status-badge--warning"
                                    : snapshot.isActive
                                      ? "workspace-status-badge--neutral"
                                      : "workspace-status-badge--warning"
                                } version-snapshot-card__tag`}
                              >
                                {systemGroup ? copy.latestRestoreBadge : copy.latestBadge}
                              </Tag>
                            ) : null}
                          </div>
                        </div>
                        <div className="version-snapshot-card__meta-row">
                          {selectingCompareTarget && !isCompareBase ? (
                            <span className="version-snapshot-card__target-hint">{compareTargetHint}</span>
                          ) : null}
                          <span className="version-snapshot-card__time">
                            {formatSnapshotTime(snapshot.createdAt, language)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))
          ) : (
            <div className="version-history-timeline__empty">
              <span>{copy.releaseStatus}</span>
              <strong>{copy.noSnapshots}</strong>
              <p>{copy.noSnapshotsDescription}</p>
            </div>
          )}
        </Spin>
      </div>
    </aside>
  );
}
