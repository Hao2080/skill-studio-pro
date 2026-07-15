export interface OperationListInput {
  operationType?: string;
  entityId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface OperationLog {
  id: string;
  operationType: string;
  entityType: string;
  entityId?: string;
  targetLabel: string;
  planJson?: string;
  beforeHash?: string;
  afterHash?: string;
  snapshotId?: string;
  status: string;
  errorCode?: string;
  errorSummary?: string;
  createdAt: number;
  completedAt?: number;
}
