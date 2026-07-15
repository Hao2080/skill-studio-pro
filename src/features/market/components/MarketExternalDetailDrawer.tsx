import Button from "antd/es/button";
import Card from "antd/es/card";
import Drawer from "antd/es/drawer";
import Empty from "antd/es/empty";
import Spin from "antd/es/spin";
import Tag from "antd/es/tag";
import Typography from "antd/es/typography";
import type { ExternalMarketSkill, ExternalMarketSkillDetail } from "@/types/skill";
import {
  getSourceCoverageLabel,
  type DetailFact,
  type MarketDiscoveryEntry,
} from "../model/marketDiscovery";
import { getMarketCopy } from "../model/marketCopy";
import { getMarketRiskLabel, getMarketVerificationLabel } from "../model/marketSources";
import type { ImportMode, UiLanguage } from "../model/marketTypes";

const { Paragraph } = Typography;

type MarketCopy = ReturnType<typeof getMarketCopy>;

interface MarketExternalDetailDrawerProps {
  open: boolean;
  titleSkill: ExternalMarketSkill | null;
  entry: MarketDiscoveryEntry | null;
  detail: ExternalMarketSkillDetail | null;
  detailFacts: DetailFact[];
  documentationSourceLabel: string;
  documentationParagraphs: string[];
  statusLabel: string;
  statusToneClass: string;
  detailLoading: boolean;
  detailError: string | null;
  busyImport: ImportMode;
  copy: MarketCopy;
  language: UiLanguage;
  detailFactsLabel: string;
  detailReadmeLabel: string;
  openSourceLabel: string;
  onClose: () => void;
  onReload: () => void;
  onImport: (entry: MarketDiscoveryEntry) => void | Promise<void>;
}

export function MarketExternalDetailDrawer({
  open,
  titleSkill,
  entry,
  detail,
  detailFacts,
  documentationSourceLabel,
  documentationParagraphs,
  statusLabel,
  statusToneClass,
  detailLoading,
  detailError,
  busyImport,
  copy,
  language,
  detailFactsLabel,
  detailReadmeLabel,
  openSourceLabel,
  onClose,
  onReload,
  onImport,
}: MarketExternalDetailDrawerProps) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={titleSkill?.name ?? copy.externalResultsTitle}
      width={560}
      className="market-page__detail-drawer"
    >
      {entry ? (
        <div className="market-page__detail-shell">
          <section className="market-page__detail-section">
            <div className="market-page__detail-topline">
              <div className="market-page__detail-source-line">
                <Tag bordered={false} className="market-page__detail-tag">
                  {entry.sourceLabel}
                </Tag>
                <span className="market-page__catalog-author">{entry.publisherLabel}</span>
              </div>
              <span className={`market-page__result-status${statusToneClass}`}>{statusLabel}</span>
            </div>

            <div className="market-page__detail-badge-row">
              <span className="market-page__registry-chip">
                {getMarketVerificationLabel(entry.verification, language)}
              </span>
              <span className="market-page__registry-chip">{getMarketRiskLabel(entry.risk, language)}</span>
              <span className="market-page__registry-chip">
                {getSourceCoverageLabel(entry.sourceCount, language)}
              </span>
            </div>

            <Paragraph className="market-page__detail-summary">
              {detail?.summary ?? entry.external.summary}
            </Paragraph>

            {entry.installedSkill ? (
              <div className="market-page__external-note is-success">
                {copy.externalInstalledHint(entry.installedSkill.name)}
              </div>
            ) : entry.conflictSkill ? (
              <div className="market-page__external-note is-warning">
                {copy.externalConflictHint(entry.conflictSkill.name, entry.conflictSkill.slug)}
              </div>
            ) : null}

            <div className="market-page__detail-actions">
              <Button
                type={entry.installedSkill || entry.conflictSkill ? "default" : "primary"}
                ghost={!entry.installedSkill && !entry.conflictSkill}
                loading={!entry.installedSkill && !entry.conflictSkill && busyImport === `external:${entry.external.id}`}
                onClick={() => void onImport(entry)}
              >
                {entry.installedSkill
                  ? copy.openWorkspace
                  : entry.conflictSkill
                    ? copy.externalConflictAction
                    : copy.externalImportAction}
              </Button>
              <Button href={detail?.repoUrl ?? entry.external.repoUrl} target="_blank" rel="noreferrer">
                {openSourceLabel}
              </Button>
            </div>
          </section>

          <section className="market-page__detail-section">
            <div className="market-page__detail-section-head">
              <strong>{detailFactsLabel}</strong>
            </div>

            <div className="market-page__detail-fact-grid">
              {detailFacts.map((fact) => (
                <div key={fact.label} className="market-page__detail-fact-item">
                  <span>{fact.label}</span>
                  <strong>{fact.value}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="market-page__detail-section">
            <div className="market-page__detail-section-head">
              <strong>{detailReadmeLabel}</strong>
            </div>

            <div className="market-page__detail-doc-meta">
              <span className="market-page__detail-doc-source">{documentationSourceLabel}</span>
              {detail?.documentationPath ? (
                <span className="market-page__detail-doc-path">{detail.documentationPath}</span>
              ) : null}
            </div>

            {detailLoading ? (
              <div className="market-page__loading-shell market-page__loading-shell--compact">
                <Spin size="small" />
              </div>
            ) : detailError ? (
              <Card className="market-page__error-card" bordered={false}>
                <strong>{copy.externalDetailLoadFailed}</strong>
                <p>{detailError}</p>
                <Button onClick={onReload}>{copy.reload}</Button>
              </Card>
            ) : documentationParagraphs.length > 0 ? (
              <div className="market-page__detail-preview-body">
                {documentationParagraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            ) : (
              <Empty description={copy.externalDetailPreviewEmpty} className="market-page__empty market-page__empty--compact" />
            )}
          </section>
        </div>
      ) : null}
    </Drawer>
  );
}
