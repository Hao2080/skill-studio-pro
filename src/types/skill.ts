export interface Skill {
  id: string;
  name: string;
  slug: string;
  description?: string;
  sourceType: string;
  sourcePath?: string;
  createdAt: number;
  updatedAt: number;
  isArchived: boolean;
}

export interface SkillSource {
  id: string;
  skillId: string;
  sourceType: string;
  sourceLabel: string;
  sourceRef?: string;
  sourcePath?: string;
  metadataJson?: string;
  isPrimary: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SkillImportRecord {
  id: string;
  sourceType: string;
  sourceLabel: string;
  sourceRef?: string;
  sourcePath?: string;
  requestPayloadJson?: string;
  status: string;
  targetSkillId?: string;
  targetSkillName?: string;
  detailMessage?: string;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SkillTag {
  id: string;
  name: string;
  color?: string;
  usageCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface SkillCollection {
  id: string;
  name: string;
  description?: string;
  color?: string;
  itemCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface SkillOrganizationRecord {
  skillId: string;
  primaryCollectionId?: string;
  primaryCollectionName?: string;
  collectionIds: string[];
  collectionNames: string[];
  tagIds: string[];
  tagNames: string[];
}

export interface SkillOrganizationSnapshot {
  collections: SkillCollection[];
  tags: SkillTag[];
  records: SkillOrganizationRecord[];
}

export interface MarketCatalogItem {
  id: string;
  name: string;
  summary: string;
  description: string;
  category: string;
  author: string;
  difficulty: string;
  featured: boolean;
  accentColor: string;
  tags: string[];
}

export type ExternalMarketBoard = "alltime" | "trending" | "hot";

export interface ExternalMarketFacet {
  label: string;
  value: string;
}

export interface ExternalMarketSkill {
  id: string;
  marketSource: string;
  sourceKeys: string[];
  name: string;
  summary: string;
  source: string;
  sourceLabel: string;
  skillId: string;
  publisher: string;
  repoUrl: string;
  sourceSubpath?: string;
  category: string;
  accentColor: string;
  tags: string[];
  installs: number;
  featured: boolean;
  verification: string;
  risk: string;
  facets: ExternalMarketFacet[];
  metrics: ExternalMarketFacet[];
  detailUrl?: string;
  packageName?: string;
  packageVersion?: string;
  ownerHandle?: string;
  updatedAt?: number;
}

export interface ExternalMarketSkillDetail {
  id: string;
  marketSource: string;
  source: string;
  sourceLabel: string;
  skillId: string;
  name: string;
  publisher?: string;
  repoUrl: string;
  sourceSubpath?: string;
  detailUrl?: string;
  summary?: string;
  documentationTitle?: string;
  documentationPath?: string;
  documentationExcerpt?: string;
  category?: string;
  version?: string;
  installCommand?: string;
  highlights: string[];
  useCases: string[];
  requirements: string[];
  securitySignals: ExternalMarketFacet[];
  packageName?: string;
  packageVersion?: string;
  ownerHandle?: string;
}

export interface SkillSnapshot {
  id: string;
  skillId: string;
  snapshotNumber: number;
  snapshotPath: string;
  revisionHash: string;
  changeSummary?: string;
  source: 'manual' | 'system' | string;
  createdAt: number;
  isCurrent: boolean;
  isActive: boolean;
}

export interface LastSyncInfo {
  platform: string;
  status: 'success' | 'failed';
  syncedAt: number;
  error?: string;
}

export interface PlatformConnection {
  id: string;
  platformName: string;
  displayName?: string;
  platformType?: 'built_in' | 'custom' | string;
  detected: boolean;
  enabled: boolean;
  skillsDir?: string;
  detectDir?: string;
  syncMode?: 'copy' | 'symlink' | string;
  supportsProjectScope?: boolean;
  supportsSymlink?: boolean;
  supportsCopy?: boolean;
  lastSyncAt?: number;
}

export interface PlatformGovernanceImpact {
  platformName: string;
  displayName?: string;
  globalReleaseCount: number;
  projectConnectionCount: number;
  enabledProjectConnectionCount: number;
  assignmentCount: number;
  enabledAssignmentCount: number;
  affectedProjects: string[];
}

export interface SavePlatformConnectionInput {
  platformName: string;
  enabled: boolean;
  skillsDir?: string;
  syncMode?: 'copy' | 'symlink' | string;
}

export interface CreateCustomPlatformInput {
  platformName: string;
  displayName: string;
  skillsDir: string;
  syncMode?: 'copy' | 'symlink' | string;
  supportsProjectScope: boolean;
  supportsSymlink: boolean;
  supportsCopy: boolean;
}

export interface DeleteCustomPlatformInput {
  platformName: string;
}

export interface TestPlatformPathResult {
  ok: boolean;
  normalizedPath: string;
  exists: boolean;
  isDirectory: boolean;
  message: string;
}

export interface TextDiffEntry {
  filePath: string;
  unifiedDiff: string;
  oldLines: number;
  newLines: number;
}

export interface SnapshotDiffResult {
  addedFiles: string[];
  deletedFiles: string[];
  modifiedFiles: string[];
  textDiffs: Record<string, TextDiffEntry>;
}

export interface ChangeStatus {
  hasChanges: boolean;
  addedFiles: string[];
  deletedFiles: string[];
  modifiedFiles: string[];
}

export interface PlatformSkillScanResult {
  found: string[];
  alreadyManaged: string[];
  newSkills: string[];
  missingEntryFile: string[];
}

export interface BatchImportResult {
  successes: string[];
  failures: { folderName: string; error: string }[];
}

export interface SyncResult {
  platform: string;
  status: 'success' | 'failed';
  error?: string;
}

export interface SkillSyncResult {
  skillName: string;
  platformResults: SyncResult[];
}

export interface PlatformReleaseTarget {
  platformName: string;
  displayName?: string;
  snapshotId: string;
  snapshotNumber: number;
  changeSummary?: string;
  releasedAt: number;
}

export interface PlatformReleaseRecord {
  id: string;
  platformName: string;
  displayName?: string;
  snapshotId?: string;
  snapshotNumber?: number;
  changeSummary?: string;
  action: 'publish' | 'republish' | 'switch' | 'remove' | 'sync' | string;
  status: 'success' | 'failed';
  errorMessage?: string;
  createdAt: number;
}

export interface SkillPlatformReleaseStatus {
  platformName: string;
  displayName?: string;
  detected: boolean;
  enabled: boolean;
  skillsDir?: string;
  currentTarget?: PlatformReleaseTarget;
  lastRecord?: PlatformReleaseRecord;
}

export interface SkillPlatformReleaseOverview {
  releases: SkillPlatformReleaseStatus[];
  recentRecords: PlatformReleaseRecord[];
}

export interface SkillFileNode {
  name: string;
  path: string;
  isDir: boolean;
  children: SkillFileNode[];
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  uiLanguage: 'system' | 'zh-CN' | 'en-US';
  snapshotBeforePublish: boolean;
  snapshotMaxCount: number | null;
}

export type WorkspaceMode = 'browse' | 'history';

export interface FileContent {
  path: string;
  content: string;
  lines: number;
}
