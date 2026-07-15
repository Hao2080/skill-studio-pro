use super::model::{AiTaskRoute, AiTaskType, ProviderType};

pub const MINIMAX_PROVIDER_ID: &str = "minimax";
pub const OPENAI_PROVIDER_ID: &str = "openai";
pub const MINIMAX_DEFAULT_BASE_URL: &str = "https://api.minimax.io";
pub const OPENAI_DEFAULT_BASE_URL: &str = "https://api.openai.com";
pub const MINIMAX_DEFAULT_MODEL: &str = "MiniMax-M3";
pub const OPENAI_DEFAULT_MODEL: &str = "gpt-5.6";
pub const DEFAULT_TIMEOUT_MS: u64 = 60_000;
pub const DEFAULT_MAX_CONCURRENCY: usize = 4;
pub const DEFAULT_RETRY_COUNT: u32 = 2;

#[derive(Debug, Clone, Copy)]
pub struct DefaultProvider {
    pub id: &'static str,
    pub provider_type: ProviderType,
    pub display_name: &'static str,
    pub base_url: &'static str,
    pub model: &'static str,
}

pub const PROVIDERS: [DefaultProvider; 2] = [
    DefaultProvider {
        id: MINIMAX_PROVIDER_ID,
        provider_type: ProviderType::Minimax,
        display_name: "MiniMax",
        base_url: MINIMAX_DEFAULT_BASE_URL,
        model: MINIMAX_DEFAULT_MODEL,
    },
    DefaultProvider {
        id: OPENAI_PROVIDER_ID,
        provider_type: ProviderType::OpenaiResponses,
        display_name: "OpenAI",
        base_url: OPENAI_DEFAULT_BASE_URL,
        model: OPENAI_DEFAULT_MODEL,
    },
];

pub fn routes(now: i64) -> Vec<AiTaskRoute> {
    [
        (
            AiTaskType::ExtractUsage,
            MINIMAX_PROVIDER_ID,
            MINIMAX_DEFAULT_MODEL,
            "usage/v1",
            "用法要点提取",
        ),
        (
            AiTaskType::SuggestTags,
            MINIMAX_PROVIDER_ID,
            MINIMAX_DEFAULT_MODEL,
            "tags/v1",
            "标签候选",
        ),
        (
            AiTaskType::ExtractOriginCandidate,
            MINIMAX_PROVIDER_ID,
            MINIMAX_DEFAULT_MODEL,
            "origin-candidate/v1",
            "来源候选（仅供本地规则验证）",
        ),
        (
            AiTaskType::Classify,
            MINIMAX_PROVIDER_ID,
            MINIMAX_DEFAULT_MODEL,
            "classification/v1",
            "信息分类",
        ),
        (
            AiTaskType::FinalSummary,
            OPENAI_PROVIDER_ID,
            OPENAI_DEFAULT_MODEL,
            "summary/v1",
            "最终摘要与内容提炼",
        ),
        (
            AiTaskType::ExplainConflict,
            OPENAI_PROVIDER_ID,
            OPENAI_DEFAULT_MODEL,
            "conflict/v1",
            "冲突解释",
        ),
        (
            AiTaskType::RefineUsage,
            OPENAI_PROVIDER_ID,
            OPENAI_DEFAULT_MODEL,
            "refine-usage/v1",
            "最终使用建议",
        ),
    ]
    .into_iter()
    .map(
        |(task_type, provider_id, model_id, prompt_version, responsibility)| AiTaskRoute {
            task_type,
            provider_id: provider_id.to_string(),
            model_id: model_id.to_string(),
            prompt_version: prompt_version.to_string(),
            responsibility: responsibility.to_string(),
            enabled: true,
            updated_at: now,
        },
    )
    .collect()
}
