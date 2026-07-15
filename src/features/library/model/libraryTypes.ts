export interface CentralSkill {
  id: string;
  name: string;
  slug: string;
  storageRelPath: string;
  storagePath: string;
  description?: string;
  activeContentHash?: string;
  lifecycleState: string;
  createdAt: number;
  updatedAt: number;
}

export interface RegisterInstancePlanInput {
  instanceId: string;
  slug?: string;
}

export interface RegisterInstancePlan {
  id: string;
  instanceId: string;
  centralSkillId: string;
  name: string;
  slug: string;
  sourcePath: string;
  sourceHash: string;
  targetPath: string;
  storageRelPath: string;
  planHash: string;
  createdAt: number;
  expiresAt: number;
}

export interface ExecutePlanInput {
  planId: string;
  planHash: string;
}

export type SyncMode = "copy" | "symlink";
export type DriftPolicy = "abort" | "overwrite";

export interface PublishTargetInput {
  platformName: string;
  syncMode?: SyncMode;
  driftPolicy?: DriftPolicy;
}

export interface PublishPlanInput {
  skillId: string;
  snapshotId: string;
  targets: PublishTargetInput[];
}

export interface PublishTargetPlan {
  platformName: string;
  displayName: string;
  targetPath: string;
  syncMode: SyncMode;
  observedHash?: string;
  publishedHash?: string;
  driftStatus: string;
  driftPolicy: DriftPolicy;
  status: "ready" | "blocked";
  blockingReason?: string;
  symlinkCapability: "supported" | "unsupported_platform" | "requires_privilege_probe";
}

export interface PublishPlan {
  id: string;
  skillId: string;
  snapshotId: string;
  sourcePath: string;
  sourceHash: string;
  targets: PublishTargetPlan[];
  planHash: string;
  createdAt: number;
  expiresAt: number;
}

export interface PublishTargetResult {
  platformName: string;
  targetPath: string;
  status: "success" | "failed";
  contentHash?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface PublishResult {
  planId: string;
  status: "success" | "failed" | "partial_success";
  targets: PublishTargetResult[];
}

export interface MappingState {
  skillId: string;
  platformName: string;
  snapshotId: string;
  targetPath: string;
  syncMode: SyncMode;
  publishedContentHash?: string;
  observedTargetHash?: string;
  driftStatus: string;
  lastCheckedAt?: number;
}

export interface RemoveMappingInput {
  skillId: string;
  platformName: string;
}
