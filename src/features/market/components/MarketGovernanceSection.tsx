import Empty from "antd/es/empty";
import Tag from "antd/es/tag";
import Typography from "antd/es/typography";
import { ArrowRight, ShieldCheck } from "lucide-react";
import {
  formatSkillUpdatedAt,
  getSkillSourceTypeLabel,
} from "@/features/skills/model/detailWorkspace";
import type { MarketCopy } from "../model/marketCopy";
import type { GovernanceSourceItem, UiLanguage } from "../model/marketTypes";

const { Text } = Typography;

interface MarketSourceFilterOption {
  value: string;
  label: string;
  count: number;
}

interface MarketGovernanceSectionProps {
  copy: MarketCopy;
  language: UiLanguage;
  title: string;
  sourceFilters: MarketSourceFilterOption[];
  selectedSourceType: string;
  sourceItems: GovernanceSourceItem[];
  filteredSourceItems: GovernanceSourceItem[];
  onSourceTypeChange: (value: string) => void;
  onOpenSkill: (skillId: string) => void;
}

export function MarketGovernanceSection({
  copy,
  language,
  title,
  sourceFilters,
  selectedSourceType,
  sourceItems,
  filteredSourceItems,
  onSourceTypeChange,
  onOpenSkill,
}: MarketGovernanceSectionProps) {
  return (
    <section className="market-page__activity-section">
      <div className="market-page__activity-section-head">
        <div>
          <span className="market-page__console-label">{copy.governanceLabel}</span>
          <strong>{title}</strong>
        </div>
        <Text type="secondary">{copy.governanceRecent}</Text>
      </div>

      <div className="market-page__source-filter-list">
        {sourceFilters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={`market-page__source-filter${selectedSourceType === filter.value ? " is-active" : ""}`}
            onClick={() => onSourceTypeChange(filter.value)}
          >
            <span>{filter.label}</span>
            <strong>{filter.count}</strong>
          </button>
        ))}
      </div>

      <div className="market-page__activity-list">
        {filteredSourceItems.length === 0 ? (
          <Empty
            description={sourceItems.length === 0 ? copy.noGovernedAssets : copy.noGovernedAssetsForFilter}
            className="market-page__empty market-page__empty--compact"
          />
        ) : (
          filteredSourceItems.map((item) => (
            <button
              key={item.skill.id}
              type="button"
              className="market-page__source-record"
              onClick={() => onOpenSkill(item.skill.id)}
            >
              <div className="market-page__source-record-head">
                <div className="market-page__source-record-title">
                  <strong>{item.skill.name}</strong>
                  <span>{copy.updatedAt(formatSkillUpdatedAt(item.skill.updatedAt, language))}</span>
                </div>
                <Tag bordered={false} className="market-page__source-record-tag">
                  {item.sourceLabel}
                </Tag>
              </div>

              <p className="market-page__source-record-detail">
                {item.sourceDetail ?? copy.sourceDetailFallback}
              </p>

              <div className="market-page__source-record-footer">
                <span className="market-page__source-record-meta">
                  <ShieldCheck size={14} />
                  {copy.primarySource(getSkillSourceTypeLabel(item.sourceType, language))}
                </span>
                <span className="market-page__source-record-action">
                  {copy.openWorkspace}
                  <ArrowRight size={14} />
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
