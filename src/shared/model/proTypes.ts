export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export type SourceResolutionStatus = "confirmed" | "inferred" | "unknown";

export interface SourceConfidenceData {
  label: string;
  type:
    | "system"
    | "plugin"
    | "git_repository"
    | "marketplace"
    | "local_import"
    | "manual"
    | "platform_scan"
    | "central_library"
    | "unknown";
  score: number;
  status: SourceResolutionStatus;
  rationale: string;
  evidence: string[];
}

export interface ModelAttributionData {
  provider: string;
  modelId: string;
  responsibility: string;
  generatedAt: string;
  state: "fresh" | "stale" | "failed" | "disabled";
}

export interface CatalogSkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  platforms: string[];
  path: string;
  source: SourceConfidenceData;
  libraryState: "managed" | "external" | "drifted";
  updatedAt: string;
  hasScripts?: boolean;
  duplicateState: "clean" | "duplicate" | "conflict";
  fileCount?: number;
  model?: ModelAttributionData;
}
