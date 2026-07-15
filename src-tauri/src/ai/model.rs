use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio_util::sync::CancellationToken;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ProviderType {
    Minimax,
    OpenaiResponses,
}

impl ProviderType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Minimax => "minimax",
            Self::OpenaiResponses => "openai_responses",
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum AiTaskType {
    ExtractUsage,
    SuggestTags,
    ExtractOriginCandidate,
    Classify,
    FinalSummary,
    ExplainConflict,
    RefineUsage,
}

impl AiTaskType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::ExtractUsage => "extract_usage",
            Self::SuggestTags => "suggest_tags",
            Self::ExtractOriginCandidate => "extract_origin_candidate",
            Self::Classify => "classify",
            Self::FinalSummary => "final_summary",
            Self::ExplainConflict => "explain_conflict",
            Self::RefineUsage => "refine_usage",
        }
    }
}

impl std::str::FromStr for AiTaskType {
    type Err = AiError;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "extract_usage" => Ok(Self::ExtractUsage),
            "suggest_tags" => Ok(Self::SuggestTags),
            "extract_origin_candidate" => Ok(Self::ExtractOriginCandidate),
            "classify" => Ok(Self::Classify),
            "final_summary" => Ok(Self::FinalSummary),
            "explain_conflict" => Ok(Self::ExplainConflict),
            "refine_usage" => Ok(Self::RefineUsage),
            _ => Err(AiError::configuration(format!(
                "不支持的 AI 任务类型: {value}"
            ))),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AiErrorCode {
    CredentialMissing,
    CredentialStoreUnavailable,
    AuthenticationFailed,
    NetworkError,
    RateLimited,
    QuotaExceeded,
    ModelNotFound,
    Timeout,
    Cancelled,
    InvalidConfiguration,
    InvalidStructuredOutput,
    SecretBlocked,
    ProviderDisabled,
    ProviderError,
}

impl AiErrorCode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::CredentialMissing => "CREDENTIAL_MISSING",
            Self::CredentialStoreUnavailable => "CREDENTIAL_STORE_UNAVAILABLE",
            Self::AuthenticationFailed => "AUTHENTICATION_FAILED",
            Self::NetworkError => "NETWORK_ERROR",
            Self::RateLimited => "RATE_LIMITED",
            Self::QuotaExceeded => "QUOTA_EXCEEDED",
            Self::ModelNotFound => "MODEL_NOT_FOUND",
            Self::Timeout => "TIMEOUT",
            Self::Cancelled => "CANCELLED",
            Self::InvalidConfiguration => "INVALID_CONFIGURATION",
            Self::InvalidStructuredOutput => "INVALID_STRUCTURED_OUTPUT",
            Self::SecretBlocked => "SECRET_BLOCKED",
            Self::ProviderDisabled => "PROVIDER_DISABLED",
            Self::ProviderError => "PROVIDER_ERROR",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AiError {
    pub code: AiErrorCode,
    pub message: String,
    pub user_action: Option<String>,
    pub retryable: bool,
    pub details: Option<Value>,
}

impl AiError {
    pub fn new(code: AiErrorCode, message: impl Into<String>, retryable: bool) -> Self {
        Self {
            code,
            message: message.into(),
            user_action: None,
            retryable,
            details: None,
        }
    }

    pub fn configuration(message: impl Into<String>) -> Self {
        Self::new(AiErrorCode::InvalidConfiguration, message, false)
    }

    pub fn with_action(mut self, action: impl Into<String>) -> Self {
        self.user_action = Some(action.into());
        self
    }

    pub fn safe_summary(&self) -> String {
        crate::ai::redaction::redact_log_text(&self.message)
    }
}

impl std::fmt::Display for AiError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "{}: {}", self.code.as_str(), self.message)
    }
}

impl std::error::Error for AiError {}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderConfig {
    pub provider_id: String,
    pub provider_type: ProviderType,
    pub display_name: String,
    pub base_url: String,
    pub default_model: String,
    pub secret_ref: Option<String>,
    pub secret_tail: Option<String>,
    pub enabled: bool,
    pub timeout_ms: u64,
    pub max_concurrency: usize,
    pub retry_count: u32,
    pub last_test_status: Option<String>,
    pub last_test_at: Option<i64>,
    pub updated_at: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderSaveInput {
    pub provider_id: String,
    pub provider_type: ProviderType,
    pub display_name: String,
    pub base_url: String,
    pub default_model: String,
    pub enabled: bool,
    pub timeout_ms: u64,
    pub max_concurrency: usize,
    pub retry_count: u32,
    pub api_key: Option<String>,
    #[serde(default = "default_secret_mode")]
    pub secret_mode: SecretMode,
}

fn default_secret_mode() -> SecretMode {
    SecretMode::Persistent
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SecretMode {
    Persistent,
    Temporary,
    Unchanged,
    Remove,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AiTaskRoute {
    pub task_type: AiTaskType,
    pub provider_id: String,
    pub model_id: String,
    pub prompt_version: String,
    pub responsibility: String,
    pub enabled: bool,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiTaskRouteSaveInput {
    pub task_type: AiTaskType,
    pub provider_id: String,
    pub model_id: String,
    pub prompt_version: String,
    pub responsibility: String,
    pub enabled: bool,
}

#[derive(Debug, Clone)]
pub struct AiRequest {
    pub task_type: AiTaskType,
    pub model: String,
    pub prompt_version: String,
    pub input: Value,
    pub schema_name: String,
    pub schema: Value,
    pub timeout_ms: u64,
    pub cancellation: CancellationToken,
    pub repair_feedback: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AiResponse {
    pub content: Value,
    pub actual_model_id: String,
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub provider_request_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    pub provider_id: String,
    pub model_id: String,
    pub display_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProviderTestResult {
    pub provider_id: String,
    pub status: String,
    pub model: Option<ModelInfo>,
    pub tested_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactGenerateInput {
    pub task_type: AiTaskType,
    pub skill_id: Option<String>,
    pub instance_id: Option<String>,
    pub input: Value,
    #[serde(default)]
    pub force: bool,
    pub cancellation_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactListInput {
    pub skill_id: Option<String>,
    pub instance_id: Option<String>,
    pub task_type: Option<AiTaskType>,
    pub include_stale: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AiArtifact {
    pub id: String,
    pub skill_id: Option<String>,
    pub instance_id: Option<String>,
    pub task_type: AiTaskType,
    pub provider_id: String,
    pub model_id: String,
    pub model_display_name: Option<String>,
    pub responsibility: String,
    pub prompt_version: String,
    pub input_hash: String,
    pub content: Value,
    pub status: String,
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub stale_at: Option<i64>,
    pub created_at: i64,
}

#[derive(Debug, Clone)]
pub struct AiCallLog {
    pub id: String,
    pub artifact_id: Option<String>,
    pub provider_id: String,
    pub model_id: String,
    pub task_type: AiTaskType,
    pub status: String,
    pub latency_ms: Option<i64>,
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub error_code: Option<String>,
    pub error_summary: Option<String>,
    pub started_at: i64,
    pub completed_at: Option<i64>,
}
