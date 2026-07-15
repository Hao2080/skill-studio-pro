use std::time::Duration;

use reqwest::{StatusCode, Url};
use tokio_util::sync::CancellationToken;

use super::model::{AiError, AiErrorCode};

pub fn endpoint(base_url: &str, suffix: &str) -> Result<Url, AiError> {
    validate_base_url(base_url)?;
    let normalized = format!("{}/", base_url.trim_end_matches('/'));
    Url::parse(&normalized)
        .and_then(|url| url.join(suffix.trim_start_matches('/')))
        .map_err(|_| AiError::configuration("API 地址无效"))
}

pub fn validate_base_url(base_url: &str) -> Result<(), AiError> {
    let url = Url::parse(base_url).map_err(|_| AiError::configuration("API 地址无效"))?;
    if url.scheme() == "https" {
        return Ok(());
    }
    let loopback = matches!(url.host_str(), Some("127.0.0.1" | "localhost" | "[::1]"));
    if url.scheme() == "http" && loopback {
        return Ok(());
    }
    Err(AiError::configuration(
        "Provider API 地址必须使用 HTTPS；仅本地 Mock 可使用 HTTP",
    ))
}

pub fn classify_http(status: StatusCode, body: &str) -> AiError {
    let safe = crate::ai::redaction::redact_log_text(body);
    let lower = safe.to_ascii_lowercase();
    if status == StatusCode::UNAUTHORIZED
        || status == StatusCode::FORBIDDEN
        || lower.contains("\"status_code\":1004")
    {
        return AiError::new(
            AiErrorCode::AuthenticationFailed,
            "Provider 鉴权失败",
            false,
        )
        .with_action("检查 API Key 是否正确且仍有效");
    }
    if status == StatusCode::NOT_FOUND
        || lower.contains("model_not_found")
        || lower.contains("model not found")
    {
        return AiError::new(
            AiErrorCode::ModelNotFound,
            "配置的模型不存在或不可用",
            false,
        )
        .with_action("检查实际模型 ID 和账号模型权限");
    }
    if status == StatusCode::PAYMENT_REQUIRED
        || lower.contains("insufficient_quota")
        || lower.contains("insufficient balance")
        || lower.contains("quota")
        || lower.contains("1008")
    {
        return AiError::new(AiErrorCode::QuotaExceeded, "Provider 配额或余额不足", false)
            .with_action("检查账号额度、余额或项目配额");
    }
    if status == StatusCode::TOO_MANY_REQUESTS
        || lower.contains("rate limit")
        || lower.contains("\"status_code\":1002")
    {
        return AiError::new(AiErrorCode::RateLimited, "Provider 请求被限流", true)
            .with_action("稍后重试或降低并发");
    }
    if status == StatusCode::REQUEST_TIMEOUT || lower.contains("\"status_code\":1001") {
        return AiError::new(AiErrorCode::Timeout, "Provider 请求超时", true)
            .with_action("稍后重试或调整超时设置");
    }
    let message = if safe.trim().is_empty() {
        format!("Provider 返回 HTTP {}", status.as_u16())
    } else {
        format!(
            "Provider 返回 HTTP {}: {}",
            status.as_u16(),
            truncate(&safe, 240)
        )
    };
    AiError::new(
        AiErrorCode::ProviderError,
        message,
        status.is_server_error(),
    )
}

pub fn classify_reqwest(error: reqwest::Error) -> AiError {
    if error.is_timeout() {
        AiError::new(AiErrorCode::Timeout, "Provider 请求超时", true)
            .with_action("稍后重试或调整超时设置")
    } else {
        AiError::new(AiErrorCode::NetworkError, "无法连接 Provider", true)
            .with_action("检查网络、代理和 API 地址")
    }
}

pub async fn backoff_or_cancel(
    attempt: u32,
    cancellation: &CancellationToken,
) -> Result<(), AiError> {
    let delay = Duration::from_millis(100_u64.saturating_mul(1_u64 << attempt.min(5)));
    tokio::select! {
        _ = tokio::time::sleep(delay) => Ok(()),
        _ = cancellation.cancelled() => Err(AiError::new(AiErrorCode::Cancelled, "AI 调用已取消", false)),
    }
}

pub fn truncate(value: &str, max_chars: usize) -> String {
    value.chars().take(max_chars).collect()
}

#[cfg(test)]
mod tests {
    use super::classify_http;
    use crate::ai::model::AiErrorCode;
    use reqwest::StatusCode;

    #[test]
    fn classifies_connection_error_categories() {
        assert_eq!(
            classify_http(StatusCode::UNAUTHORIZED, "bad key").code,
            AiErrorCode::AuthenticationFailed
        );
        assert_eq!(
            classify_http(StatusCode::TOO_MANY_REQUESTS, "rate limit").code,
            AiErrorCode::RateLimited
        );
        assert_eq!(
            classify_http(StatusCode::TOO_MANY_REQUESTS, "insufficient_quota").code,
            AiErrorCode::QuotaExceeded
        );
        assert_eq!(
            classify_http(StatusCode::NOT_FOUND, "model_not_found").code,
            AiErrorCode::ModelNotFound
        );
    }

    #[test]
    fn redacts_provider_error_bodies() {
        let error = classify_http(
            StatusCode::BAD_REQUEST,
            "Authorization: Bearer fictional-token-123456789",
        );
        assert!(!error.message.contains("fictional-token"));
    }
}
