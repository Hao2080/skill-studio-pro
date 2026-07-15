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

pub struct OpenAiProvider {
    provider_id: String,
    base_url: String,
    api_key: String,
    client: Client,
    semaphore: Arc<Semaphore>,
    retry_count: u32,
}

impl Drop for OpenAiProvider {
    fn drop(&mut self) {
        self.api_key.zeroize();
    }
}

impl OpenAiProvider {
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
                .map_err(|_| AiError::configuration("无法初始化 OpenAI HTTP Client"))?,
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

    async fn get_json(
        &self,
        url: reqwest::Url,
        timeout_ms: u64,
        cancellation: &tokio_util::sync::CancellationToken,
    ) -> Result<Value, AiError> {
        let _permit = self.acquire(cancellation).await?;
        let request = self.client.get(url).bearer_auth(&self.api_key);
        let future = async {
            let response = request.send().await?;
            let status = response.status();
            let body = response.text().await?;
            Ok::<_, reqwest::Error>((status, body))
        };
        let (status, body) = tokio::select! {
            result = tokio::time::timeout(Duration::from_millis(timeout_ms), future) => {
                result.map_err(|_| AiError::new(AiErrorCode::Timeout, "OpenAI 连接测试超时", true))?.map_err(http::classify_reqwest)?
            }
            _ = cancellation.cancelled() => return Err(AiError::new(AiErrorCode::Cancelled, "AI 调用已取消", false)),
        };
        if !status.is_success() {
            return Err(http::classify_http(status, &body));
        }
        serde_json::from_str(&body)
            .map_err(|_| AiError::new(AiErrorCode::ProviderError, "OpenAI 返回了无效 JSON", false))
    }
}

#[async_trait]
impl AiProvider for OpenAiProvider {
    fn id(&self) -> &str {
        &self.provider_id
    }

    async fn test_connection(&self, model: &str) -> Result<ModelInfo, AiError> {
        if model.trim().is_empty() {
            return Err(AiError::configuration("模型 ID 不能为空"));
        }
        let cancellation = tokio_util::sync::CancellationToken::new();
        let url = http::endpoint(&self.base_url, &format!("v1/models/{model}"))?;
        let payload = self.get_json(url, 15_000, &cancellation).await?;
        Ok(ModelInfo {
            provider_id: self.provider_id.clone(),
            model_id: payload
                .get("id")
                .and_then(Value::as_str)
                .unwrap_or(model)
                .to_string(),
            display_name: payload
                .get("display_name")
                .and_then(Value::as_str)
                .map(str::to_string),
        })
    }

    async fn generate(&self, request: AiRequest) -> Result<AiResponse, AiError> {
        let definition = prompts::definition(request.task_type, &request.prompt_version)
            .map_err(AiError::configuration)?;
        let body = json!({
            "model": request.model,
            "input": [
                {"role": "system", "content": definition.system_prompt},
                {"role": "user", "content": prompts::user_prompt(&definition, &request.input, request.repair_feedback.as_deref())}
            ],
            "text": {"format": {
                "type": "json_schema", "name": request.schema_name,
                "schema": request.schema, "strict": true
            }},
            "store": false
        });
        let url = http::endpoint(&self.base_url, "v1/responses")?;
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
                        let mapped = AiError::new(AiErrorCode::Timeout, "OpenAI Responses API 请求超时", true);
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
        .map_err(|_| AiError::new(AiErrorCode::ProviderError, "OpenAI 返回了无效 JSON", false))?;
    let text = payload
        .get("output")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|item| item.get("content").and_then(Value::as_array))
        .flatten()
        .find(|part| part.get("type").and_then(Value::as_str) == Some("output_text"))
        .and_then(|part| part.get("text").and_then(Value::as_str))
        .ok_or_else(|| {
            AiError::new(
                AiErrorCode::ProviderError,
                "OpenAI 响应缺少 output_text",
                false,
            )
        })?;
    let content = crate::ai::schema::parse_json_output(text)
        .unwrap_or_else(|_| Value::String(text.to_string()));
    Ok(AiResponse {
        content,
        actual_model_id: payload
            .get("model")
            .and_then(Value::as_str)
            .unwrap_or("unknown")
            .to_string(),
        input_tokens: payload
            .pointer("/usage/input_tokens")
            .and_then(Value::as_i64),
        output_tokens: payload
            .pointer("/usage/output_tokens")
            .and_then(Value::as_i64),
        provider_request_id: payload
            .get("id")
            .and_then(Value::as_str)
            .map(str::to_string),
    })
}

#[cfg(test)]
mod tests {
    #[test]
    fn parses_responses_api_structured_output() {
        let raw = r#"{
          "id":"resp_test","model":"gpt-5.6-sol",
          "output":[{"type":"message","content":[{"type":"output_text","text":"{\"oneLineSummary\":\"demo\",\"details\":\"detail\"}"}]}],
          "usage":{"input_tokens":12,"output_tokens":7}
        }"#;
        let result = super::parse_response(raw).expect("应解析 Responses API 响应");
        assert_eq!(result.actual_model_id, "gpt-5.6-sol");
        assert_eq!(result.input_tokens, Some(12));
    }
}
