import Button from "antd/es/button";
import { GitCompareArrows, Plus } from "lucide-react";
import type {
  SkillPlatformReleaseOverview,
  SkillSnapshot,
} from "@/types/skill";
import type { SkillTeamDeliveryOverview } from "@/types/team";
import type { CompareDraft, SelectedEntity } from "@/features/snapshots/model/versionSelection";
import type { UiLanguage } from "@/features/snapshots/model/presentationTypes";
import {
  getCompareBaseLabel,
  type VersionHistoryCopy,
} from "@/features/snapshots/model/versionHistoryPresentation";
import { VersionDetailPanel } from "@/features/snapshots/components/VersionDetailPanel";
import { ReleaseStatusPanel } from "@/features/snapshots/components/ReleaseStatusPanel";
import { TeamDeliveryPanel } from "@/features/snapshots/components/TeamDeliveryPanel";

export type VersionConsoleTab = "detail" | "release" | "team";

interface VersionConsoleShellProps {
  copy: VersionHistoryCopy;
  language: UiLanguage;
  activeConsoleTab: VersionConsoleTab;
  onConsoleTabChange: (tab: VersionConsoleTab) => void;
  releaseBusy: boolean;
  hasPendingTeamDelivery: boolean;
  teamBusy: boolean;
  snapshotsLength: number;
  onCreateSnapshot: () => void;
  onStartCompare: () => void;
  selectingCompareTarget: boolean;
  compareDraftTitle: string | null;
  compareBaseSnapshotNumber: number | null;
  onSelectWorkspace: () => void;
  onCancelCompare: () => void;
  selectedEntity: SelectedEntity | null;
  selectedSnapshot: SkillSnapshot | null;
  activeSnapshot: SkillSnapshot | null;
  latestSnapshot: SkillSnapshot | null;
  hasWorkspaceChanges: boolean;
  changedFileCount: number;
  compareDraft: CompareDraft;
  onRestoreSnapshot: (snapshotId: string) => void;
  onSetActiveSnapshot: (snapshotId: string) => void;
  onDeleteSnapshot: (snapshotId: string) => void;
  onUpdateSummary: (snapshotId: string, summary: string) => Promise<void>;
  onOpenFiles: () => void;
  releaseOverview: SkillPlatformReleaseOverview | null;
  releaseOverviewLoading: boolean;
  busyPlatforms: string[];
  onPublish: () => void;
  onPublishPlatform: (platformName: string) => void;
  onRemovePlatform: (platformName: string) => void;
  onOpenSettings: () => void;
  onFocusActiveVersion: () => void;
  teamDeliveryOverview: SkillTeamDeliveryOverview | null;
  teamDeliveryLoading: boolean;
  teamSubmitting: boolean;
  busyTeams: string[];
  onSubmitTeams: () => void;
  onSubmitTeam: (teamId: string) => void;
  onWithdrawTeam: (teamId: string) => void;
  onRemoveTeam: (teamId: string) => void;
  onOpenTeams: () => void;
}

export function VersionConsoleShell({
  copy,
  language,
  activeConsoleTab,
  onConsoleTabChange,
  releaseBusy,
  hasPendingTeamDelivery,
  teamBusy,
  snapshotsLength,
  onCreateSnapshot,
  onStartCompare,
  selectingCompareTarget,
  compareDraftTitle,
  compareBaseSnapshotNumber,
  onSelectWorkspace,
  onCancelCompare,
  selectedEntity,
  selectedSnapshot,
  activeSnapshot,
  latestSnapshot,
  hasWorkspaceChanges,
  changedFileCount,
  compareDraft,
  onRestoreSnapshot,
  onSetActiveSnapshot,
  onDeleteSnapshot,
  onUpdateSummary,
  onOpenFiles,
  releaseOverview,
  releaseOverviewLoading,
  busyPlatforms,
  onPublish,
  onPublishPlatform,
  onRemovePlatform,
  onOpenSettings,
  onFocusActiveVersion,
  teamDeliveryOverview,
  teamDeliveryLoading,
  teamSubmitting,
  busyTeams,
  onSubmitTeams,
  onSubmitTeam,
  onWithdrawTeam,
  onRemoveTeam,
  onOpenTeams,
}: VersionConsoleShellProps) {
  return (
    <section className="version-center-console">
      <div className="version-console-header">
        <div className="version-console-tabs" role="tablist" aria-label={copy.consoleTabsAria}>
          <button
            id="console-tab-detail"
            type="button"
            role="tab"
            tabIndex={activeConsoleTab === "detail" ? 0 : -1}
            aria-selected={activeConsoleTab === "detail"}
            aria-controls="version-console-tabpanel"
            className={`version-console-tab${activeConsoleTab === "detail" ? " is-active" : ""}`}
            onClick={() => onConsoleTabChange("detail")}
          >
            {copy.tabDetail}
          </button>
          <button
            id="console-tab-release"
            type="button"
            role="tab"
            tabIndex={activeConsoleTab === "release" ? 0 : -1}
            aria-selected={activeConsoleTab === "release"}
            aria-controls="version-console-tabpanel"
            className={`version-console-tab${activeConsoleTab === "release" ? " is-active" : ""}`}
            onClick={() => onConsoleTabChange("release")}
          >
            {copy.tabRelease}
            {releaseBusy ? <span className="version-console-tab__badge" aria-label={copy.syncingAria} /> : null}
          </button>
          <button
            id="console-tab-team"
            type="button"
            role="tab"
            tabIndex={activeConsoleTab === "team" ? 0 : -1}
            aria-selected={activeConsoleTab === "team"}
            aria-controls="version-console-tabpanel"
            className={`version-console-tab${activeConsoleTab === "team" ? " is-active" : ""}`}
            onClick={() => onConsoleTabChange("team")}
          >
            {copy.tabTeam}
            {hasPendingTeamDelivery || teamBusy ? (
              <span className="version-console-tab__badge version-console-tab__badge--warning" aria-label={copy.pendingAria} />
            ) : null}
          </button>
        </div>

        <div className="version-console-header__actions" role="group" aria-label={copy.primaryActions}>
          <Button className="version-history-sidebar__timeline-action" type="primary" icon={<Plus size={14} />} onClick={onCreateSnapshot}>
            {copy.createSnapshot}
          </Button>
          <Button
            className="version-history-sidebar__timeline-action"
            icon={<GitCompareArrows size={14} />}
            disabled={snapshotsLength === 0}
            onClick={onStartCompare}
          >
            {copy.compareVersions}
          </Button>
        </div>
      </div>

      {selectingCompareTarget ? (
        <div className="version-compare-draft-bar" aria-label={copy.compareDraftAria}>
          <div className="version-compare-draft-bar__copy">
            <div className="version-compare-draft-bar__identity">
              <span className="version-compare-draft-bar__eyebrow">{copy.compareDraft}</span>
              <strong>{compareDraftTitle ?? copy.compareDraft}</strong>
            </div>
            <span className="version-compare-draft-bar__hint">{copy.awaitingTarget}</span>
          </div>
          <div className="version-compare-draft-bar__meta-strip" aria-label={copy.compareDraftSummary}>
            <span className="version-compare-draft-bar__meta-item version-compare-draft-bar__meta-item--base">
              <span className="version-compare-draft-bar__meta-key">{copy.base}</span>
              <span className="version-compare-draft-bar__meta-value">
                {getCompareBaseLabel(compareBaseSnapshotNumber, language)}
              </span>
            </span>
            <span className="version-compare-draft-bar__meta-item">
              <span className="version-compare-draft-bar__meta-key">{copy.target}</span>
              <span className="version-compare-draft-bar__meta-value">{copy.pending}</span>
            </span>
          </div>
          <div className="version-compare-draft-bar__actions">
            <Button size="small" className="version-history-sidebar__timeline-action" onClick={onSelectWorkspace}>
              {copy.compareWorkspace}
            </Button>
            <Button size="small" className="version-history-sidebar__timeline-action" onClick={onCancelCompare}>
              {copy.cancelCompare}
            </Button>
          </div>
        </div>
      ) : null}

      <div
        id="version-console-tabpanel"
        className="version-console-tab-content"
        role="tabpanel"
        aria-labelledby={`console-tab-${activeConsoleTab}`}
      >
        {activeConsoleTab === "detail" ? (
          <VersionDetailPanel
            selectedEntity={selectedEntity}
            selectedSnapshot={selectedSnapshot}
            activeSnapshot={activeSnapshot}
            latestSnapshot={latestSnapshot}
            hasWorkspaceChanges={hasWorkspaceChanges}
            changedFileCount={changedFileCount}
            compareDraft={compareDraft}
            onCompareWithWorkspace={onSelectWorkspace}
            onCancelCompare={onCancelCompare}
            onRestoreSnapshot={onRestoreSnapshot}
            onSetActiveSnapshot={onSetActiveSnapshot}
            onDeleteSnapshot={onDeleteSnapshot}
            onUpdateSummary={onUpdateSummary}
            onOpenFiles={onOpenFiles}
            showCompareReadyInline={!selectingCompareTarget}
          />
        ) : null}

        {activeConsoleTab === "release" ? (
          <ReleaseStatusPanel
            activeSnapshot={activeSnapshot}
            selectedSnapshot={selectedSnapshot}
            releaseOverview={releaseOverview}
            loading={releaseOverviewLoading}
            publishing={releaseBusy}
            busyPlatforms={busyPlatforms}
            onPublish={onPublish}
            onPublishPlatform={onPublishPlatform}
            onRemovePlatform={onRemovePlatform}
            onOpenSettings={onOpenSettings}
            onFocusActiveVersion={onFocusActiveVersion}
          />
        ) : null}

        {activeConsoleTab === "team" ? (
          <TeamDeliveryPanel
            selectedSnapshot={selectedSnapshot}
            deliveryOverview={teamDeliveryOverview}
            loading={teamDeliveryLoading}
            submitting={teamSubmitting}
            actingTeamIds={busyTeams}
            onSubmit={onSubmitTeams}
            onSubmitTeam={onSubmitTeam}
            onWithdrawTeam={onWithdrawTeam}
            onRemoveTeam={onRemoveTeam}
            onOpenTeams={onOpenTeams}
          />
        ) : null}
      </div>
    </section>
  );
}

