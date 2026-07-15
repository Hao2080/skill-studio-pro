export type ScanRootType = "agent_global" | "plugin_cache" | "project" | "custom" | "central_library";
export type ScanMode = "incremental" | "full";
export type ScanRunStatus = "running" | "completed" | "cancelled" | "failed";
export type ParseStatus = "ok" | "error";
export type DuplicateKind =
  | "same_name_same_content"
  | "same_name_different_content"
  | "same_content_different_name";

export interface ScanRoot {
  id: string;
  rootType: ScanRootType;
  platformName?: string;
  path: string;
  normalizedPath: string;
  enabled: boolean;
  recursive: boolean;
  watchEnabled: boolean;
  ignoreRules: string[];
  lastScanAt?: number;
  createdAt: number;
  updatedAt: number;
  available: boolean;
}

export interface ScanRootUpsertInput {
  id?: string;
  rootType: ScanRootType;
  platformName?: string;
  path: string;
  enabled?: boolean;
  recursive?: boolean;
  watchEnabled?: boolean;
  ignoreRules?: string[];
}

export interface ScanStartInput {
  mode?: ScanMode;
  rootIds?: string[];
}

export interface ScanRun {
  id: string;
  mode: ScanMode;
  status: ScanRunStatus;
  rootsTotal: number;
  rootsCompleted: number;
  candidatesSeen: number;
  instancesChanged: number;
  errorCount: number;
  startedAt: number;
  completedAt?: number;
  cancelledAt?: number;
  errorSummary?: string;
}

export interface ScanProgressEvent {
  runId: string;
  status: ScanRunStatus;
  rootsTotal: number;
  rootsCompleted: number;
  candidatesSeen: number;
  instancesChanged: number;
  errorCount: number;
  currentPath?: string;
}

export interface InstancesChangedEvent {
  runId: string;
  instanceIds: string[];
}

export interface SkillInstanceFile {
  relativePath: string;
  fileType: "file" | "symlink" | "special";
  sizeBytes: number;
  modifiedAt?: number;
  contentHash?: string;
  riskFlags: string[];
}

export interface SkillInstance {
  id: string;
  centralSkillId?: string;
  scanRootId?: string;
  platformName?: string;
  scopeType: ScanRootType;
  absolutePath: string;
  normalizedPath: string;
  folderName: string;
  parsedName?: string;
  canonicalName: string;
  description?: string;
  shortDescription?: string;
  metadata: Record<string, unknown>;
  headings: string[];
  contentHash: string;
  skillMdHash: string;
  manifestHash?: string;
  fileCount: number;
  hasScripts: boolean;
  hasExecutables: boolean;
  riskFlags: string[];
  duplicateKinds: DuplicateKind[];
  parseStatus: ParseStatus;
  parseError?: string;
  parseWarnings: string[];
  gitRemote?: string;
  gitCommit?: string;
  pluginManifest?: Record<string, unknown>;
  firstSeenAt: number;
  lastSeenAt: number;
  lastModifiedAt?: number;
  missingAt?: number;
}

export type SourceType =
  | "system"
  | "plugin"
  | "git_repository"
  | "marketplace"
  | "local_import"
  | "manual"
  | "platform_scan"
  | "central_library"
  | "unknown";

export interface SourceEvidence {
  id: string;
  instanceId?: string;
  skillId?: string;
  evidenceType: string;
  evidenceKey: string;
  evidenceValue?: string;
  sourceCandidate?: string;
  weight: number;
  isConflict: boolean;
  resolverVersion: string;
  observedAt: number;
}

export interface SourceResolution {
  id: string;
  instanceId: string;
  sourceType: SourceType;
  sourceLabel: string;
  sourceRef?: string;
  confidence: number;
  resolutionStatus: "confirmed" | "inferred" | "unknown";
  rationale: string;
  userConfirmed: boolean;
  evidenceHash: string;
  resolvedAt: number;
  updatedAt: number;
}

export interface SkillInstanceDetail {
  instance: SkillInstance;
  files: SkillInstanceFile[];
  resolution?: SourceResolution;
  evidence: SourceEvidence[];
}

export interface InstanceListInput {
  search?: string;
  platformName?: string;
  parseStatus?: ParseStatus;
  duplicateKind?: DuplicateKind;
  includeMissing?: boolean;
  limit?: number;
  offset?: number;
}

export interface InstanceListResult {
  items: SkillInstance[];
  total: number;
}

export interface OriginConfirmInput {
  instanceId: string;
  sourceType: SourceType;
  sourceLabel: string;
  sourceRef?: string;
}
