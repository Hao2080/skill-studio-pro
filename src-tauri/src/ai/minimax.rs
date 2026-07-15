use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use reqwest::Client;
use serde_json::{json, Value};
use tokio::sync::Semaphore;
use zeroize::Zeroize;

use super::http;
use super::model::{AiError, AiErrorCode, AiRequest, AiResponse, ModelInfo};
use super::prompts;
use super::provider::AiProvider;

pub struct MiniMaxProvider {
    provider_id: String,
    base_url: String,
    api_key: String,
    client: Client,
    semaphore: Arc<Semaphore>,
    retry_count: u32,
}

impl Drop for MiniMaxProvider {
    fn drop(&mut self) {
        self.api_key.zeroize();
    }
}

impl MiniMaxProvider {
    pub fn new(
        provider_id: impl Into<String>,
        base_url: impl Into<String>,
        api_key: impl Into<String>,
        max_concurrency: usize,
        retry_count: u32,
    ) -> Result<Self, AiError> {
        let base_url = base_url.into();
        http::validate_base_url(&base_url)?;
        Ok(Self {
            provider_id: provider_id.into(),
            base_url,
            api_key: api_key.into(),
            client: Client::builder()
                .user_agent("Skill Studio Pro/0.1")
                .build()
                .map_err(|_| AiError::configuration("无法初始化 MiniMax HTTP Client"))?,
            semaphore: Arc::new(Semaphore::new(max_concurrency.clamp(1, 32))),
            retry_count: retry_count.min(5),
        })
    }

    async fn acquire(
        &self,
        cancellation: &tokio_util::sync::CancellationToken,
    ) -> Result<tokio::sync::OwnedSemaphorePermit, AiError> {
        tokio::select! {
            permit = self.semaphore.clone().acquire_owned() => permit.map_err(|_| AiError::new(AiErrorCode::ProviderError, "Provider 并发控制器已关闭", true)),
            _ = cancellation.cancelled() => Err(AiError::new(AiErrorCode::Cancelled, "AI 调用已取消", false)),
        }
    }
}

#[async_trait]
impl AiProvider for MiniMaxProvider {
    fn id(&self) -> &str {
        &self.provider_id
    }

    async fn test_connection(&self, model: &str) -> Result<ModelInfo, AiError> {
        if model.trim().is_empty() {
            return Err(AiError::configuration("模型 ID 不能为空"));
        }
        let cancellation = tokio_util::sync::CancellationToken::new();
        let _permit = self.acquire(&cancellation).await?;
        let url = http::endpoint(&self.base_url, "v1/models")?;
        let request = self.client.get(url).bearer_auth(&self.api_key);
        let future = async {
            let response = request.send().await?;
            let status = response.status();
            let body = response.text().await?;
            Ok::<_, reqwest::Error>((status, body))
        };
        let (status, raw) = tokio::time::timeout(Duration::from_secs(15), future)
            .await
            .map_err(|_| AiError::new(AiErrorCode::Timeout, "MiniMax 连接测试超时", true))?
            .map_err(http::classify_reqwest)?;
        if !status.is_success() {
            return Err(http::classify_http(status, &raw));
        }
        let payload: Value = serde_json::from_str(&raw).map_err(|_| {
            AiError::new(AiErrorCode::ProviderError, "MiniMax 返回了无效 JSON", false)
        })?;
        let found = payload
            .get("data")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .find(|item| item.get("id").and_then(Value::as_str) == Some(model));
        if found.is_none() {
            return Err(AiError::new(
                AiErrorCode::ModelNotFound,
                "MiniMax 模型不存在或当前账号不可用",
                false,
            ));
        }
        Ok(ModelInfo {
            provider_id: self.provider_id.clone(),
            model_id: model.to_string(),
            display_name: found
                .and_then(|item| item.get("display_name"))
                .and_then(Value::as_str)
                .map(str::to_string),
        })
    }

    async fn generate(&self, request: AiRequest) -> Result<AiResponse, AiError> {
        let definition = prompts::definition(request.task_type, &request.prompt_version)
            .map_err(AiError::configuration)?;
        let body = json!({
            "model": request.model,
            "messages": [
                {"role": "system", "content": definition.system_prompt},
                {"role": "user", "content": prompts::user_prompt(&definition, &request.input, request.repair_feedback.as_deref())}
            ],
            "thinking": {"type": "disabled"},
            "reasoning_split": true,
            "stream": false,
            "max_completion_tokens": 4096
        });
        let url = http::endpoint(&self.base_url, "v1/chat/completions")?;
        let _permit = self.acquire(&request.cancellation).await?;
        let mut attempt = 0;
        loop {
            let http_request = self
                .client
                .post(url.clone())
                .bearer_auth(&self.api_key)
                .json(&body);
            let future = async {
                let response = http_request.send().await?;
                let status = response.status();
                let body = response.text().await?;
                Ok::<_, reqwest::Error>((status, body))
            };
            let (status, raw) = tokio::select! {
                result = tokio::time::timeout(Duration::from_millis(request.timeout_ms), future) => match result {
                    Ok(Ok(response)) => response,
                    Ok(Err(error)) => {
                        let mapped = http::classify_reqwest(error);
                        if mapped.retryable && attempt < self.retry_count {
                            http::backoff_or_cancel(attempt, &request.cancellation).await?;
                            attempt += 1;
                            continue;
                        }
                        return Err(mapped);
                    }
                    Err(_) => {
                        let mapped = AiError::new(AiErrorCode::Timeout, "MiniMax 请求超时", true);
                        if attempt < self.retry_count {
                            http::backoff_or_cancel(attempt, &request.cancellation).await?;
                            attempt += 1;
                            continue;
                        }
                        return Err(mapped);
                    }
                },
                _ = request.cancellation.cancelled() => return Err(AiError::new(AiErrorCode::Cancelled, "AI 调用已取消", false)),
            };
            if !status.is_success() {
                let error = http::classify_http(status, &raw);
                if error.retryable && attempt < self.retry_count {
                    http::backoff_or_cancel(attempt, &request.cancellation).await?;
                    attempt += 1;
                    continue;
                }
                return Err(error);
            }
            return parse_response(&raw);
        }
    }
}

fn parse_response(raw: &str) -> Result<AiResponse, AiError> {
    let payload: Value = serde_json::from_str(raw)
        .map_err(|_| AiError::new(AiErrorCode::ProviderError, "MiniMax 返回了无效 JSON", false))?;
    if let Some(code) = payload
        .pointer("/base_resp/status_code")
        .and_then(Value::as_i64)
    {
        if code != 0 {
            return Err(http::classify_http(reqwest::StatusCode::BAD_REQUEST, raw));
        }
    }
    let text = payload
        .pointer("/choices/0/message/content")
        .and_then(Value::as_str)
        .ok_or_else(|| {
            AiError::new(
                AiErrorCode::ProviderError,
                "MiniMax 响应缺少 message.content",
                false,
            )
        })?;
    let structured_text = strip_thinking(text);
    let content = crate::ai::schema::parse_json_output(structured_text)
        .unwrap_or_else(|_| Value::String(structured_text.to_string()));
    Ok(AiResponse {
        content,
        actual_model_id: payload
            .get("model")
            .and_then(Value::as_str)
            .unwrap_or("unknown")
            .to_string(),
        input_tokens: payload
            .pointer("/usage/prompt_tokens")
            .and_then(Value::as_i64),
        output_tokens: payload
            .pointer("/usage/completion_tokens")
            .and_then(Value::as_i64),
        provider_request_id: payload
            .get("id")
            .and_then(Value::as_str)
            .map(str::to_string),
    })
}

fn strip_thinking(text: &str) -> &str {
    if let Some(end) = text.find("</think>") {
        text[end + "</think>".len()..].trim()
    } else {
        text
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn parses_minimax_usage_and_strips_thinking() {
        let raw = r#"{
          "id":"mm_test","model":"MiniMax-M3",
          "choices":[{"message":{"content":"<think>hidden</think>{\"tags\":[\"docs\"]}"}}],
          "usage":{"prompt_tokens":8,"completion_tokens":4},
          "base_resp":{"status_code":0,"status_msg":""}
        }"#;
        let response = super::parse_response(raw).expect("应解析 MiniMax 响应");
        assert_eq!(response.input_tokens, Some(8));
        assert_eq!(response.content["tags"][0], "docs");
    }
}
