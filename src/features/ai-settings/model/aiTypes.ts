export type AiProviderType = "minimax" | "openai_responses";

export type AiTaskType =
  | "extract_usage"
  | "suggest_tags"
  | "extract_origin_candidate"
  | "classify"
  | "final_summary"
  | "explain_conflict"
  | "refine_usage";

export type SecretMode = "persistent" | "temporary" | "unchanged" | "remove";

export interface AiProviderConfig {
  providerId: string;
  providerType: AiProviderType;
  displayName: string;
  baseUrl: string;
  defaultModel: string;
  secretRef?: string | null;
  secretTail?: string | null;
  enabled: boolean;
  timeoutMs: number;
  maxConcurrency: number;
  retryCount: number;
  lastTestStatus?: string | null;
  lastTestAt?: number | null;
  updatedAt: number;
}

export interface AiProviderSaveInput {
  providerId: string;
  providerType: AiProviderType;
  displayName: string;
  baseUrl: string;
  defaultModel: string;
  enabled: boolean;
  timeoutMs: number;
  maxConcurrency: number;
  retryCount: number;
  apiKey?: string | null;
  secretMode?: SecretMode;
}

export interface ModelInfo {
  providerId: string;
  modelId: string;
  displayName?: string | null;
}

export interface ProviderTestResult {
  providerId: string;
  status: string;
  model?: ModelInfo | null;
  testedAt: number;
}

export interface AiTaskRoute {
  taskType: AiTaskType;
  providerId: string;
  modelId: string;
  promptVersion: string;
  responsibility: string;
  enabled: boolean;
  updatedAt: number;
}

export type AiTaskRouteSaveInput = Omit<AiTaskRoute, "updatedAt">;

export interface ArtifactGenerateInput {
  taskType: AiTaskType;
  skillId?: string | null;
  instanceId?: string | null;
  input: unknown;
  force?: boolean;
  cancellationId?: string | null;
}

export interface ArtifactListInput {
  skillId?: string | null;
  instanceId?: string | null;
  taskType?: AiTaskType | null;
  includeStale?: boolean;
}

export interface AiArtifact {
  id: string;
  skillId?: string | null;
  instanceId?: string | null;
  taskType: AiTaskType;
  providerId: string;
  modelId: string;
  modelDisplayName?: string | null;
  responsibility: string;
  promptVersion: string;
  inputHash: string;
  content: unknown;
  status: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  staleAt?: number | null;
  createdAt: number;
}

export type AiErrorCode =
  | "CREDENTIAL_MISSING"
  | "CREDENTIAL_STORE_UNAVAILABLE"
  | "AUTHENTICATION_FAILED"
  | "NETWORK_ERROR"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "MODEL_NOT_FOUND"
  | "TIMEOUT"
  | "CANCELLED"
  | "INVALID_CONFIGURATION"
  | "INVALID_STRUCTURED_OUTPUT"
  | "SECRET_BLOCKED"
  | "PROVIDER_DISABLED"
  | "PROVIDER_ERROR";

export interface AiAppError {
  code: AiErrorCode;
  message: string;
  userAction?: string | null;
  retryable: boolean;
  details?: Record<string, unknown> | null;
}
