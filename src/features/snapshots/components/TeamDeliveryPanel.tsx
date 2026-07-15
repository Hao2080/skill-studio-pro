import { useEffect, useMemo, useRef, useState } from "react";
import Button from "antd/es/button";
import Spin from "antd/es/spin";
import { ExternalLink, History, Send, Trash2, Undo2 } from "lucide-react";
import { useI18n } from "@/features/settings/state/I18nContext";
import type { SkillSnapshot } from "@/types/skill";
import type {
  SkillTeamDeliveryOverview,
} from "@/types/team";
import { isSystemSnapshot } from "@/features/snapshots/model/snapshotSource";
import {
  formatDeliveryTime,
  formatTeamCount,
  getCurrentTargetDetail,
  getPendingDetail,
  getPrimaryActionLabel,
  getRecordDetail,
  getRecordHeadline,
  getTeamState,
  getTeamDeliveryCopy,
} from "@/features/snapshots/model/teamDeliveryPresentation";

interface TeamDeliveryPanelProps {
  selectedSnapshot: SkillSnapshot | null;
  deliveryOverview: SkillTeamDeliveryOverview | null;
  loading: boolean;
  submitting: boolean;
  actingTeamIds: string[];
  onSubmit: () => void;
  onSubmitTeam: (teamId: string) => void;
  onWithdrawTeam: (teamId: string) => void;
  onRemoveTeam: (teamId: string) => void;
  onOpenTeams: () => void;
}

export function TeamDeliveryPanel({
  selectedSnapshot,
  deliveryOverview,
  loading,
  submitting,
  actingTeamIds,
  onSubmit,
  onSubmitTeam,
  onWithdrawTeam,
  onRemoveTeam,
  onOpenTeams,
}: TeamDeliveryPanelProps) {
  const { resolvedLanguage } = useI18n();
  const [recordFilter, setRecordFilter] = useState<string | null>(null);
  const recordsRef = useRef<HTMLDivElement | null>(null);
  const copy = getTeamDeliveryCopy(resolvedLanguage);

  const deliveries = deliveryOverview?.deliveries ?? [];
  const recentRecords = deliveryOverview?.recentRecords ?? [];
  const selectedSystemSnapshot = isSystemSnapshot(selectedSnapshot);
  const latestRecord = recentRecords[0] ?? null;
  const selectedSnapshotDeliveries = useMemo(
    () =>
      selectedSnapshot
        ? deliveries.filter(
            (delivery) =>
              delivery.currentTarget?.sourceSnapshotId === selectedSnapshot.id ||
              delivery.pendingDelivery?.sourceSnapshotId === selectedSnapshot.id,
          )
        : [],
    [deliveries, selectedSnapshot],
  );
  const selectedSnapshotPendingCount = useMemo(
    () =>
      selectedSnapshot
        ? deliveries.filter((delivery) => delivery.pendingDelivery?.sourceSnapshotId === selectedSnapshot.id)
            .length
        : deliveries.filter((delivery) => delivery.pendingDelivery).length,
    [deliveries, selectedSnapshot],
  );
  const otherSnapshotTeamCount = useMemo(
    () =>
      selectedSnapshot
        ? deliveries.filter(
            (delivery) =>
              (delivery.currentTarget &&
                delivery.currentTarget.sourceSnapshotId !== selectedSnapshot.id) ||
              (delivery.pendingDelivery &&
                delivery.pendingDelivery.sourceSnapshotId !== selectedSnapshot.id),
          ).length
        : deliveries.filter((delivery) => delivery.currentTarget || delivery.pendingDelivery).length,
    [deliveries, selectedSnapshot],
  );
  const visibleRecords = useMemo(
    () => recentRecords.filter((record) => !recordFilter || record.teamId === recordFilter),
    [recentRecords, recordFilter],
  );

  useEffect(() => {
    setRecordFilter(null);
  }, [selectedSnapshot?.id]);

  const deliveryState = !selectedSnapshot
    ? {
        tone: "warning" as const,
        label: resolvedLanguage === "en-US"
          ? "Workspace drafts cannot be delivered directly"
          : "工作副本草稿不能直接交付团队",
        detail: resolvedLanguage === "en-US"
          ? "Select a snapshot from the left before submitting, switching, or resubmitting. Current team state remains visible below."
          : "先从左侧选择一个快照，再决定提交、改交或重新提交；下方仍可查看各团队当前承接与待审状态。",
      }
    : selectedSystemSnapshot
      ? {
          tone: "warning" as const,
          label: resolvedLanguage === "en-US"
            ? "System restore points cannot be delivered directly"
            : "系统恢复点不能直接交付团队",
          detail: resolvedLanguage === "en-US"
            ? "System restore points only recover the local workspace and do not enter team review or delivery flows."
            : "系统恢复点仅用于回到本地工作区，不参与团队评审、承接和版本流转。",
        }
    : deliveries.length === 0
      ? {
          tone: "warning" as const,
          label: resolvedLanguage === "en-US"
            ? "No available teams yet"
            : "当前还没有可交付团队",
          detail: resolvedLanguage === "en-US"
            ? "Create team collaboration targets first so this panel can become a stable delivery workbench."
            : "先建立团队空间对象，后续这里才会形成稳定的交付视图。",
        }
      : selectedSnapshotPendingCount > 0
      ? {
          tone: "ready" as const,
            label: copy.currentVersionPendingIn(selectedSnapshotPendingCount),
            detail:
              otherSnapshotTeamCount > 0
                ? copy.teamsStayOnOtherVersions(otherSnapshotTeamCount)
                : copy.selectedEnteredFlow,
          }
        : selectedSnapshotDeliveries.length > 0
          ? {
              tone: "ready" as const,
              label: copy.currentVersionServedBy(selectedSnapshotDeliveries.length),
              detail:
                otherSnapshotTeamCount > 0
                  ? copy.teamsStayOnOtherFlows(otherSnapshotTeamCount)
                  : copy.selectedCoverageStable,
            }
          : {
              tone: "neutral" as const,
              label: copy.currentVersionNotInFlow,
              detail:
                otherSnapshotTeamCount > 0
                  ? copy.switchOtherVersions
                  : copy.createFirstDelivery,
            };

  return (
    <section className="version-console-card version-console-card--team">
      <div className="version-console-card__toolbar">
        <div className="version-console-card__heading">
          <div className="version-console-card__headline">
            <div className="version-console-card__headline-main">
              <h3>{copy.title}</h3>
            </div>
            <div className="version-console-card__headline-side">
              <div className="version-console-card__badges">
                <span className={`version-console-card__status-badge version-console-card__status-badge--${deliveryState.tone}`}>
                  {selectedSystemSnapshot ? copy.blocked : selectedSnapshot ? copy.workbench : copy.needSnapshot}
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
            loading={submitting}
            disabled={!selectedSnapshot || selectedSystemSnapshot || deliveries.length === 0}
            onClick={onSubmit}
          >
            {copy.deliver}
          </Button>
          <Button icon={<ExternalLink size={14} />} onClick={onOpenTeams}>
            {copy.openTeams}
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
          <span className="version-console-card__meta-key">{copy.currentServing}</span>
          <span className="version-console-card__meta-value">
            {selectedSnapshot && !selectedSystemSnapshot
              ? formatTeamCount(selectedSnapshotDeliveries.length, resolvedLanguage)
              : copy.blockedDirect}
          </span>
        </span>
        <span className="version-console-card__meta-item">
          <span className="version-console-card__meta-key">{copy.currentPending}</span>
          <span className="version-console-card__meta-value">
            {formatTeamCount(selectedSnapshotPendingCount, resolvedLanguage)}
          </span>
        </span>
        <span className="version-console-card__meta-item">
          <span className="version-console-card__meta-key">{copy.latestAction}</span>
          <span className="version-console-card__meta-value">
            {latestRecord ? formatDeliveryTime(latestRecord.createdAt, resolvedLanguage) : copy.none}
          </span>
        </span>
      </div>

      <div className={`version-console-card__hint version-console-card__hint--${deliveryState.tone}`}>
        <div className="version-console-card__hint-copy">
          <strong>{deliveryState.label}</strong>
          <span>{deliveryState.detail}</span>
        </div>
      </div>

      <Spin spinning={loading}>
        <div className="version-team-workbench" aria-label={copy.workbenchAria}>
          {deliveries.length > 0 ? (
            deliveries.map((delivery) => {
              const state = getTeamState(delivery, selectedSnapshot, resolvedLanguage);
              const primaryActionLabel = getPrimaryActionLabel(delivery, selectedSnapshot, resolvedLanguage);
              const teamBusy = actingTeamIds.includes(delivery.teamId);

              return (
                <div key={delivery.teamId} className="version-team-workbench__row">
                  <div className="version-team-workbench__row-main">
                    <div className="version-team-workbench__team">
                      <div className="version-team-workbench__team-head">
                        <strong>{delivery.teamName}</strong>
                        <span className={`version-console-card__status-badge version-console-card__status-badge--${state.tone}`}>
                          {state.label}
                        </span>
                      </div>
                      <div className="version-team-workbench__team-meta">
                        <span className="version-team-workbench__meta-item">
                          {delivery.currentTarget ? copy.hasServing : copy.noServing}
                        </span>
                        <span className="version-team-workbench__meta-item">
                          {delivery.pendingDelivery ? copy.hasPending : copy.noPendingTag}
                        </span>
                        {delivery.teamDescription ? (
                          <span className="version-team-workbench__meta-item">{delivery.teamDescription}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="version-team-workbench__cell">
                      <span className="version-team-workbench__label">{copy.targetCell}</span>
                      <strong>
                        {delivery.currentTarget
                          ? `v${delivery.currentTarget.sourceSnapshotNumber}`
                          : copy.notServing}
                      </strong>
                      <p>{getCurrentTargetDetail(delivery, resolvedLanguage)}</p>
                    </div>

                    <div className="version-team-workbench__cell">
                      <span className="version-team-workbench__label">{copy.pendingCell}</span>
                      <strong>
                        {delivery.pendingDelivery
                          ? `v${delivery.pendingDelivery.sourceSnapshotNumber}`
                          : copy.idle}
                      </strong>
                      <p>{getPendingDetail(delivery, resolvedLanguage)}</p>
                    </div>

                    <div className="version-team-workbench__cell">
                      <span className="version-team-workbench__label">{copy.recordCell}</span>
                      <strong>
                        {delivery.lastRecord
                          ? getRecordHeadline(delivery.lastRecord, resolvedLanguage)
                          : copy.teamVersionNone}
                      </strong>
                      <p>{delivery.lastRecord ? getRecordDetail(delivery.lastRecord, resolvedLanguage) : state.detail}</p>
                    </div>
                  </div>

                  <div className="version-team-workbench__actions">
                    {primaryActionLabel ? (
                      <Button
                        type={
                          delivery.currentTarget?.sourceSnapshotId === selectedSnapshot?.id ||
                          delivery.pendingDelivery?.sourceSnapshotId === selectedSnapshot?.id
                            ? "default"
                            : "primary"
                        }
                        size="small"
                        loading={teamBusy}
                        onClick={() => onSubmitTeam(delivery.teamId)}
                      >
                        {primaryActionLabel}
                      </Button>
                    ) : null}
                    {delivery.pendingDelivery ? (
                      <Button
                        size="small"
                        icon={<Undo2 size={14} />}
                        loading={teamBusy}
                        onClick={() => onWithdrawTeam(delivery.teamId)}
                      >
                        {copy.withdraw}
                      </Button>
                    ) : null}
                    <Button
                      size="small"
                      icon={<History size={14} />}
                      onClick={() => {
                        setRecordFilter(delivery.teamId);
                        recordsRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                      }}
                    >
                      {copy.viewRecords}
                    </Button>
                    {delivery.currentTarget ? (
                      <Button
                        danger
                        size="small"
                        icon={<Trash2 size={14} />}
                        loading={teamBusy}
                        onClick={() => onRemoveTeam(delivery.teamId)}
                      >
                        {copy.remove}
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="version-team-workbench__empty">
              <strong>{copy.emptyTitle}</strong>
              <p>{copy.emptyDescription}</p>
            </div>
          )}
        </div>

        <div ref={recordsRef} className="version-team-records" aria-label={copy.recordsAria}>
          <div className="version-team-records__toolbar">
            <div className="version-team-records__heading">
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
              <div key={record.id} className="version-team-records__row">
                <div className="version-team-records__main">
                  <div className="version-team-records__primary">
                    <strong>{record.teamName}</strong>
                    <span>{getRecordHeadline(record, resolvedLanguage)}</span>
                  </div>
                  <p>{getRecordDetail(record, resolvedLanguage)}</p>
                </div>
                <span className="version-team-records__time">{formatDeliveryTime(record.createdAt, resolvedLanguage)}</span>
              </div>
            ))
          ) : (
            <div className="version-team-records__empty">
              <strong>{recordFilter ? copy.noRecordsForTeam : copy.noRecords}</strong>
              <p>{copy.noRecordsDescription}</p>
            </div>
          )}
        </div>
      </Spin>
    </section>
  );
}
