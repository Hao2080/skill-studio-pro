export type ImportSourceType =
  | "local_directory"
  | "git_repository"
  | "zip_archive"
  | "marketplace";

export interface ImportPlanInput {
  sourceType: ImportSourceType;
  localPath?: string;
  gitUrl?: string;
  zipPath?: string;
  repoSubdir?: string;
  branch?: string;
  gitRef?: string;
  commit?: string;
  marketSource?: string;
  targetAgents?: string[];
}

export interface ImportProvenance {
  sourceType: ImportSourceType;
  sourceLabel: string;
  sourceRef?: string;
  sourcePath?: string;
  repoSubdir?: string;
  branch?: string;
  gitRef?: string;
  commit?: string;
  marketSource?: string;
}

export interface InstallConflict {
  conflictType: string;
  existingSkillId: string;
  existingName: string;
  existingSlug: string;
  existingContentHash?: string;
}

export interface InstallCandidate {
  id: string;
  name: string;
  slug: string;
  relativePath: string;
  contentHash: string;
  fileCount: number;
  totalBytes: number;
  scripts: string[];
  riskFlags: string[];
  conflicts: InstallConflict[];
  targetAgents: string[];
}

export interface InstallPlan {
  id: string;
  provenance: ImportProvenance;
  stagingPath: string;
  sourceHash: string;
  candidates: InstallCandidate[];
  planHash: string;
  createdAt: number;
  expiresAt: number;
}

export type ImportConflictAction = "install" | "rename" | "update" | "cancel";

export interface ImportSelection {
  candidateId: string;
  action: ImportConflictAction;
  targetName?: string;
  existingSkillId?: string;
}

export interface ImportExecuteInput {
  planId: string;
  planHash: string;
  selections?: ImportSelection[];
}

export interface ImportedSkillResult {
  candidateId: string;
  skillId: string;
  name: string;
  slug: string;
  snapshotId: string;
  contentHash: string;
  action: string;
}

export interface ImportResult {
  planId: string;
  status: "success" | "partial_success" | "failed";
  imported: ImportedSkillResult[];
  publishDeferred: boolean;
  requestedTargetAgents: string[];
}

export interface SaveTextFileInput {
  skillId: string;
  relativePath: string;
  content: string;
  editSessionId: string;
}

export interface SaveTextFileResult {
  skillId: string;
  relativePath: string;
  beforeHash?: string;
  afterHash: string;
  recoverySnapshotId: string;
  recoveryPointCreated: boolean;
  outdatedMappingCount: number;
}

export interface RecoveryReport {
  recovered: string[];
  cleaned: string[];
  errors: string[];
}
