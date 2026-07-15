export interface MappingImpact {
  platformName: string;
  targetPath: string;
  syncMode: string;
  snapshotId: string;
  driftStatus: string;
}

export interface DeletePlan {
  id: string;
  skillId: string;
  displayName: string;
  originalPath: string;
  sourceHash: string;
  fileCount: number;
  totalBytes: number;
  mappings: MappingImpact[];
  sourcesJson: string;
  planHash: string;
  createdAt: number;
  expiresAt: number;
}

export interface TrashEntry {
  id: string;
  entityType: string;
  entityId: string;
  displayName: string;
  originalPath: string;
  trashPath: string;
  manifestPath: string;
  relatedStateJson: string;
  contentHash: string;
  status: "trashed" | "restored";
  deletedAt: number;
  restoredAt?: number;
  permanentlyDeletedAt?: number;
}

export type RestoreMode = "original" | "new_name";

export interface RestorePlanInput {
  trashEntryId: string;
  mode: RestoreMode;
  newName?: string;
}

export interface RestorePlan {
  id: string;
  trashEntryId: string;
  skillId: string;
  displayName: string;
  targetName: string;
  targetSlug: string;
  targetPath: string;
  sourceHash: string;
  conflict?: string;
  mappingsWillBeRepublished: false;
  planHash: string;
  createdAt: number;
  expiresAt: number;
}

export interface PurgeConfirmation {
  trashEntryId: string;
  confirmationToken: string;
  expiresAt: number;
}
