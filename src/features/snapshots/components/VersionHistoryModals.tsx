import Checkbox from "antd/es/checkbox";
import Input from "antd/es/input";
import Modal from "antd/es/modal";
import type { PlatformConnection, SkillSnapshot } from "@/types/skill";
import type { SkillTeamDeliveryStatus } from "@/types/team";
import {
  getPlatformLabel,
  type VersionHistoryCopy,
} from "@/features/snapshots/model/versionHistoryPresentation";

interface CreateSnapshotModalProps {
  copy: VersionHistoryCopy;
  open: boolean;
  summary: string;
  onSummaryChange: (summary: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CreateSnapshotModal({
  copy,
  open,
  summary,
  onSummaryChange,
  onConfirm,
  onCancel,
}: CreateSnapshotModalProps) {
  return (
    <Modal
      title={copy.createSnapshotTitle}
      open={open}
      onOk={onConfirm}
      onCancel={onCancel}
      okText={copy.createSnapshotConfirm}
      cancelText={copy.cancel}
    >
      <Input.TextArea
        rows={3}
        placeholder={copy.summaryPlaceholder}
        value={summary}
        onChange={(event) => onSummaryChange(event.target.value)}
        className="create-snapshot-modal__summary"
      />
    </Modal>
  );
}

interface ReleaseSnapshotModalProps {
  copy: VersionHistoryCopy;
  open: boolean;
  selectedSnapshot: SkillSnapshot | null;
  selectedSystemSnapshot: boolean;
  enabledPlatforms: PlatformConnection[];
  selectedPlatforms: string[];
  releaseBusy: boolean;
  onSelectedPlatformsChange: (platforms: string[]) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ReleaseSnapshotModal({
  copy,
  open,
  selectedSnapshot,
  selectedSystemSnapshot,
  enabledPlatforms,
  selectedPlatforms,
  releaseBusy,
  onSelectedPlatformsChange,
  onConfirm,
  onCancel,
}: ReleaseSnapshotModalProps) {
  return (
    <Modal
      title={selectedSnapshot ? copy.releaseModalTitle(selectedSystemSnapshot, selectedSnapshot.snapshotNumber) : copy.releaseModalFallback}
      open={open}
      onOk={onConfirm}
      onCancel={onCancel}
      okText={copy.publish}
      cancelText={copy.cancel}
      okButtonProps={{ disabled: !selectedSnapshot || selectedSystemSnapshot || selectedPlatforms.length === 0 || releaseBusy }}
    >
      <div className="version-history-panel__sync-hint">
        {selectedSnapshot
          ? selectedSystemSnapshot
            ? copy.releaseHintRestore(selectedSnapshot.snapshotNumber)
            : copy.releaseHintSnapshot(selectedSnapshot.snapshotNumber)
          : copy.releaseHintEmpty}
      </div>

      <div className="version-history-panel__platform-list">
        {enabledPlatforms.map((platform) => (
          <Checkbox
            key={platform.platformName}
            checked={selectedPlatforms.includes(platform.platformName)}
            onChange={(event) => {
              onSelectedPlatformsChange(
                event.target.checked
                  ? [...selectedPlatforms, platform.platformName]
                  : selectedPlatforms.filter((name) => name !== platform.platformName),
              );
            }}
          >
            <span className="version-history-panel__platform-label">
              {getPlatformLabel(platform.platformName, platform.displayName)}
            </span>
            {platform.skillsDir ? (
              <span className="version-history-panel__platform-path">{platform.skillsDir}</span>
            ) : null}
          </Checkbox>
        ))}
      </div>
    </Modal>
  );
}

interface TeamSubmitModalProps {
  copy: VersionHistoryCopy;
  open: boolean;
  selectedSnapshot: SkillSnapshot | null;
  selectedSystemSnapshot: boolean;
  selectedTeams: string[];
  teamDeliveries: SkillTeamDeliveryStatus[];
  teamSubmitter: string;
  teamSubmitMessage: string;
  teamBusy: boolean;
  onSelectedTeamsChange: (teamIds: string[]) => void;
  onTeamSubmitterChange: (submitter: string) => void;
  onTeamSubmitMessageChange: (message: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TeamSubmitModal({
  copy,
  open,
  selectedSnapshot,
  selectedSystemSnapshot,
  selectedTeams,
  teamDeliveries,
  teamSubmitter,
  teamSubmitMessage,
  teamBusy,
  onSelectedTeamsChange,
  onTeamSubmitterChange,
  onTeamSubmitMessageChange,
  onConfirm,
  onCancel,
}: TeamSubmitModalProps) {
  return (
    <Modal
      title={selectedSnapshot ? copy.teamModalTitle(selectedSystemSnapshot, selectedSnapshot.snapshotNumber) : copy.teamModalFallback}
      open={open}
      onOk={onConfirm}
      onCancel={onCancel}
      okText={copy.submit}
      cancelText={copy.cancel}
      okButtonProps={{ disabled: !selectedSnapshot || selectedSystemSnapshot || selectedTeams.length === 0 || teamBusy }}
    >
      <div className="version-history-panel__sync-hint">
        {selectedSnapshot
          ? selectedSystemSnapshot
            ? copy.teamHintRestore(selectedSnapshot.snapshotNumber)
            : copy.teamHintSnapshot(selectedSnapshot.snapshotNumber)
          : copy.teamHintEmpty}
      </div>

      <Input
        value={teamSubmitter}
        onChange={(event) => onTeamSubmitterChange(event.target.value)}
        placeholder={copy.submitterPlaceholder}
        className="version-history-panel__team-field"
      />
      <Input.TextArea
        rows={3}
        value={teamSubmitMessage}
        onChange={(event) => onTeamSubmitMessageChange(event.target.value)}
        placeholder={copy.submitMessagePlaceholder}
        className="version-history-panel__team-field"
      />

      <div className="version-history-panel__platform-list version-history-panel__team-list">
        {teamDeliveries.map((delivery) => (
          <Checkbox
            key={delivery.teamId}
            checked={selectedTeams.includes(delivery.teamId)}
            onChange={(event) => {
              onSelectedTeamsChange(
                event.target.checked
                  ? [...selectedTeams, delivery.teamId]
                  : selectedTeams.filter((teamId) => teamId !== delivery.teamId),
              );
            }}
          >
            <span className="version-history-panel__platform-label">{delivery.teamName}</span>
            <span className="version-history-panel__platform-path">
              {delivery.pendingDelivery
                ? copy.teamPending(delivery.pendingDelivery.sourceSnapshotNumber)
                : delivery.currentTarget
                  ? copy.teamCurrent(delivery.currentTarget.sourceSnapshotNumber)
                  : copy.teamNone}
            </span>
          </Checkbox>
        ))}
      </div>
    </Modal>
  );
}

