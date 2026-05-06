import Button from "antd/es/button";
import Card from "antd/es/card";
import Empty from "antd/es/empty";
import Spin from "antd/es/spin";
import Tag from "antd/es/tag";
import Typography from "antd/es/typography";
import { ShieldCheck } from "lucide-react";
import type { SkillImportRecord } from "@/types/skill";
import {
  formatSkillUpdatedAt,
  getSkillSourceTypeLabel,
} from "@/features/skills/model/detailWorkspace";
import type { MarketCopy } from "../model/marketCopy";
import type { ImportMode, UiLanguage } from "../model/marketTypes";
import {
  buildImportHistoryDetail,
  buildImportHistoryTitle,
  parseImportPayload,
  resolveImportModeFromPayload,
} from "../model/marketUtils";

const { Text } = Typography;

interface MarketImportHistorySectionProps {
  copy: MarketCopy;
  language: UiLanguage;
  title: string;
  busyImport: ImportMode;
  historyLoading: boolean;
  historyError: string | null;
  importHistory: SkillImportRecord[];
  onReload: () => void;
  onRetryImport: (record: SkillImportRecord) => void | Promise<void>;
  onOpenSkill: (skillId: string) => void;
}

export function MarketImportHistorySection({
  copy,
  language,
  title,
  busyImport,
  historyLoading,
  historyError,
  importHistory,
  onReload,
  onRetryImport,
  onOpenSkill,
}: MarketImportHistorySectionProps) {
  return (
    <section className="market-page__activity-section">
      <div className="market-page__activity-section-head">
        <div>
          <span className="market-page__console-label">{copy.historyLabel}</span>
          <strong>{title}</strong>
        </div>
        <Text type="secondary">{copy.historyCount(importHistory.length)}</Text>
      </div>
      <div className="market-page__activity-list">
        {historyLoading ? (
          <div className="market-page__loading-shell market-page__loading-shell--compact">
            <Spin size="small" />
          </div>
        ) : historyError ? (
          <Card className="market-page__error-card" bordered={false}>
            <strong>{copy.historyLoadFailed}</strong>
            <p>{historyError}</p>
            <Button onClick={onReload}>{copy.reload}</Button>
          </Card>
        ) : importHistory.length === 0 ? (
          <Empty description={copy.noHistory} className="market-page__empty market-page__empty--compact" />
        ) : (
          importHistory.map((record) => {
            const payload = parseImportPayload(record);
            const retryMode = payload ? resolveImportModeFromPayload(payload) : null;
            const sourceTypeLabel = getSkillSourceTypeLabel(record.sourceType, language);
            const targetSkillId = record.targetSkillId;

            return (
              <article key={record.id} className={`market-page__history-record is-${record.status}`}>
                <div className="market-page__history-record-head">
                  <div className="market-page__history-record-title">
                    <strong>{buildImportHistoryTitle(record, language)}</strong>
                    <span>{copy.recordedAt(formatSkillUpdatedAt(record.createdAt, language))}</span>
                  </div>
                  <div className="market-page__history-record-tags">
                    <Tag bordered={false} className="market-page__history-record-source-tag">
                      {sourceTypeLabel !== record.sourceType ? sourceTypeLabel : record.sourceLabel || sourceTypeLabel}
                    </Tag>
                    <span className={`market-page__history-status is-${record.status}`}>
                      {record.status === "success" ? copy.statusSuccess : copy.statusFailed}
                    </span>
                  </div>
                </div>

                <p className="market-page__history-record-detail">{buildImportHistoryDetail(record, language)}</p>

                <div className="market-page__history-record-footer">
                  <span className="market-page__history-record-meta">
                    <ShieldCheck size={14} />
                    {copy.sourceType(sourceTypeLabel)}
                  </span>

                  <div className="market-page__history-record-actions">
                    {payload ? (
                      <Button
                        size="small"
                        loading={retryMode !== null && busyImport === retryMode}
                        onClick={() => void onRetryImport(record)}
                      >
                        {copy.retryImport}
                      </Button>
                    ) : null}
                    {targetSkillId ? (
                      <Button size="small" type="primary" ghost onClick={() => onOpenSkill(targetSkillId)}>
                        {copy.openWorkspace}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
