import type { SkillSnapshot } from "@/types/skill";

export interface ProjectSummary {
  id: string;
  name: string;
  rootPath: string;
  description?: string;
  status: string;
  lastScannedAt?: number;
  createdAt: number;
  updatedAt: number;
  platformCount: number;
  assignmentCount: number;
  driftCount: number;
  lastSyncAt?: number;
  lastSyncStatus?: string;
}

export interface Project {
  id: string;
  name: string;
  rootPath: string;
  description?: string;
  status: string;
  lastScannedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectPlatformConnection {
  id: string;
  projectId: string;
  platformName: string;
  displayName?: string;
  pathMode: "derived" | "custom" | string;
  relativeSkillsDir?: string;
  skillsDir: string;
  disabledDir?: string;
  syncMode: "copy" | "symlink" | string;
  enabled: boolean;
  status: string;
  lastSyncAt?: number;
  lastSyncStatus?: string;
  lastErrorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectSkillAssignment {
  id: string;
  projectId: string;
  platformName: string;
  platformDisplayName?: string;
  skillId: string;
  skillName: string;
  skillSlug: string;
  snapshotId: string;
  snapshotNumber: number;
  snapshotRevisionHash: string;
  snapshotChangeSummary?: string;
  targetDirName: string;
  enabled: boolean;
  sortOrder: number;
  runtimeStatus: string;
  lastSyncedSnapshotId?: string;
  lastSyncedHash?: string;
  lastCheckedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectSyncLog {
  id: string;
  projectId: string;
  platformName: string;
  skillId?: string;
  snapshotId?: string;
  action: string;
  status: string;
  detailMessage?: string;
  errorMessage?: string;
  createdAt: number;
}

export interface ProjectDetail {
  project: Project;
  platforms: ProjectPlatformConnection[];
  assignments: ProjectSkillAssignment[];
  recentLogs: ProjectSyncLog[];
}

export interface CreateProjectInput {
  name: string;
  rootPath: string;
  description?: string;
}

export interface UpdateProjectInput extends CreateProjectInput {
  projectId: string;
}

export interface SaveProjectPlatformConnectionInput {
  projectId: string;
  platformName: string;
  pathMode?: "derived" | "custom";
  relativeSkillsDir?: string;
  skillsDir?: string;
  syncMode?: "copy" | "symlink" | string;
  enabled?: boolean;
}

export interface TestProjectPlatformPathInput {
  projectId: string;
  platformName: string;
  pathMode?: "derived" | "custom";
  relativeSkillsDir?: string;
  skillsDir?: string;
}

export interface ExecuteProjectSyncInput {
  projectId: string;
  platformName: string;
  confirmedAssignmentIds?: string[];
}

export interface SaveProjectSkillAssignmentInput {
  projectId: string;
  platformName: string;
  skillId: string;
  snapshotId?: string;
  targetDirName?: string;
  enabled?: boolean;
}

export interface ProjectSyncPlanRecord {
  assignmentId: string;
  skillId: string;
  skillName: string;
  snapshotId: string;
  targetPath: string;
  plannedAction: string;
  status: string;
  requiresUserConfirmation: boolean;
  blockingReason?: string;
  detailMessage?: string;
}

export interface ProjectSyncPlan {
  projectId: string;
  platformName: string;
  status: string;
  records: ProjectSyncPlanRecord[];
}

export interface ProjectSyncResult {
  projectId: string;
  platformName: string;
  status: string;
  syncedCount: number;
  skippedCount: number;
  failedCount: number;
  records: ProjectSyncPlanRecord[];
}

export interface BindSkillDraft {
  platformName: string;
  assignmentId?: string;
  skillId: string;
  snapshotId?: string;
  targetDirName?: string;
  snapshots: SkillSnapshot[];
}
