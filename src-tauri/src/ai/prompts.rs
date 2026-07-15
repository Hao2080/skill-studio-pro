use serde_json::{json, Value};

use super::model::AiTaskType;

#[derive(Debug, Clone)]
pub struct PromptDefinition {
    pub system_prompt: &'static str,
    pub schema_name: &'static str,
    pub schema: Value,
}

fn string_array() -> Value {
    json!({"type": "array", "items": {"type": "string"}})
}

pub fn definition(task: AiTaskType, prompt_version: &str) -> Result<PromptDefinition, String> {
    let expected_prefix = match task {
        AiTaskType::ExtractUsage => "usage/",
        AiTaskType::SuggestTags => "tags/",
        AiTaskType::ExtractOriginCandidate => "origin-candidate/",
        AiTaskType::Classify => "classification/",
        AiTaskType::FinalSummary => "summary/",
        AiTaskType::ExplainConflict => "conflict/",
        AiTaskType::RefineUsage => "refine-usage/",
    };
    if !prompt_version.starts_with(expected_prefix) {
        return Err(format!(
            "任务 {} 不支持提示词版本 {prompt_version}",
            task.as_str()
        ));
    }
    Ok(match task {
        AiTaskType::ExtractUsage => PromptDefinition {
            system_prompt: "从给定 Skill 内容提取可验证的用法要点。不要猜测，不要输出秘密。",
            schema_name: "extract_usage",
            schema: json!({
                "type": "object",
                "properties": {
                    "usagePoints": string_array(), "dependencies": string_array(),
                    "inputs": string_array(), "outputs": string_array()
                },
                "required": ["usagePoints", "dependencies", "inputs", "outputs"],
                "additionalProperties": false
            }),
        },
        AiTaskType::SuggestTags => PromptDefinition {
            system_prompt: "根据给定 Skill 内容提出简洁标签候选，不要把候选当作事实。",
            schema_name: "suggest_tags",
            schema: json!({
                "type": "object", "properties": {"tags": string_array()},
                "required": ["tags"], "additionalProperties": false
            }),
        },
        AiTaskType::ExtractOriginCandidate => PromptDefinition {
            system_prompt: "只提取内容中明确出现的来源候选和依据。候选必须交给本地确定性规则验证，不能决定可信度。",
            schema_name: "origin_candidate",
            schema: json!({
                "type": "object",
                "properties": {"candidates": {"type": "array", "items": {
                    "type": "object", "properties": {
                        "source": {"type": "string"}, "evidence": {"type": "string"}
                    }, "required": ["source", "evidence"], "additionalProperties": false
                }}},
                "required": ["candidates"], "additionalProperties": false
            }),
        },
        AiTaskType::Classify => PromptDefinition {
            system_prompt: "对给定 Skill 内容进行类别候选整理，输出一个主类别和候选理由。",
            schema_name: "classification",
            schema: json!({
                "type": "object", "properties": {
                    "category": {"type": "string"}, "rationale": {"type": "string"}
                }, "required": ["category", "rationale"], "additionalProperties": false
            }),
        },
        AiTaskType::FinalSummary => PromptDefinition {
            system_prompt: "基于本地确定性信息和可用候选，生成准确、克制的一句话简介与内容提炼。",
            schema_name: "final_summary",
            schema: json!({
                "type": "object", "properties": {
                    "oneLineSummary": {"type": "string"}, "details": {"type": "string"}
                }, "required": ["oneLineSummary", "details"], "additionalProperties": false
            }),
        },
        AiTaskType::ExplainConflict => PromptDefinition {
            system_prompt: "解释给定版本或同名内容冲突，只描述输入证据，不修改本地可信度评分。",
            schema_name: "conflict_explanation",
            schema: json!({
                "type": "object", "properties": {
                    "explanation": {"type": "string"}, "differences": string_array()
                }, "required": ["explanation", "differences"], "additionalProperties": false
            }),
        },
        AiTaskType::RefineUsage => PromptDefinition {
            system_prompt: "将给定用法候选提炼为清晰、可执行且不夸大的最终使用建议。",
            schema_name: "refined_usage",
            schema: json!({
                "type": "object", "properties": {
                    "recommendation": {"type": "string"}, "steps": string_array()
                }, "required": ["recommendation", "steps"], "additionalProperties": false
            }),
        },
    })
}

pub fn user_prompt(definition: &PromptDefinition, input: &Value, repair: Option<&str>) -> String {
    let mut prompt = format!(
        "请处理以下 JSON 输入，并且只输出匹配所给 JSON Schema 的 JSON。\n输入：{}\nJSON Schema：{}",
        input, definition.schema
    );
    if let Some(feedback) = repair {
        prompt.push_str("\n上一次输出未通过本地校验。只修复结构，不新增事实。校验错误：");
        prompt.push_str(feedback);
    }
    prompt
}
