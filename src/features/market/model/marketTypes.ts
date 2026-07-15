import type { ExternalMarketBoard, Skill, SkillSource } from "@/types/skill";

export const ALL_CATEGORY = "__all__";
export const BROWSER_PAGE_SIZE = 8;
export const EXTERNAL_MARKET_BOARDS: ExternalMarketBoard[] = ["alltime", "trending", "hot"];

export type UiLanguage = "zh-CN" | "en-US";
export type ImportMode =
  | "local"
  | "git"
  | "platform_scan"
  | "team_library"
  | `market:${string}`
  | `external:${string}`
  | null;
export type ImportProgressStage = "prepare" | "dispatch" | "processing" | "done";
export type ImportProgressStatus = "running" | "success" | "error";
export type MarketMode = "external" | "catalog" | "local" | "git";
export type ExternalStateFilter = "all" | "available" | "installed" | "conflict";
export type CatalogScope = "all" | "featured";
export type MarketSourceKey = "all" | "skillssh" | "officialskills" | "clawskills" | "clawhub" | "user";
export type MarketSourceAvailability = "live" | "planned";
export type MarketVerificationState = "verified" | "official" | "reviewing" | "unverified";
export type MarketRiskLevel = "low" | "medium" | "high";

export interface ImportProgressState {
  mode: ImportMode;
  sourceLabel: string;
  stage: ImportProgressStage;
  status: ImportProgressStatus;
  title: string;
  detail: string;
  targetName?: string;
}

export interface GovernanceSourceItem {
  skill: Skill;
  primarySource: SkillSource | null;
  sourceType: string;
  sourceLabel: string;
  sourceDetail: string | null;
}

export interface ResultSummaryItem {
  key: string;
  label: string;
  value: string;
}

export interface MarketSourceDescriptor {
  key: MarketSourceKey;
  label: string;
  summary: string;
  availability: MarketSourceAvailability;
  verification: MarketVerificationState;
  risk: MarketRiskLevel;
  filterPreview: string[];
  emptyTitle: string;
  emptyDescription: string;
}
