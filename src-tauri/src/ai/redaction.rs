use std::sync::OnceLock;

use regex::Regex;
use serde_json::Value;

use super::model::{AiError, AiErrorCode};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RedactionResult {
    pub value: Value,
    pub findings: Vec<String>,
    pub blocked: bool,
}

struct SecretPattern {
    label: &'static str,
    regex: Regex,
    high_risk: bool,
}

fn patterns() -> &'static [SecretPattern] {
    static PATTERNS: OnceLock<Vec<SecretPattern>> = OnceLock::new();
    PATTERNS.get_or_init(|| {
        [
            ("pem_private_key", r"(?is)-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----.*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", true),
            ("authorization_bearer", r"(?i)\bBearer\s+[A-Za-z0-9._~+\-/=]{12,}", true),
            ("openai_or_minimax_key", r"\bsk-(?:proj-|cp-)?[A-Za-z0-9_-]{12,}\b", true),
            ("github_token", r"\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b", true),
            ("gitlab_token", r"\bglpat-[A-Za-z0-9_-]{16,}\b", true),
            ("slack_token", r"\bxox[baprs]-[A-Za-z0-9-]{16,}\b", true),
            ("google_api_key", r"\bAIza[A-Za-z0-9_-]{20,}\b", true),
            ("npm_token", r"\bnpm_[A-Za-z0-9]{20,}\b", true),
            ("aws_access_key", r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b", true),
            ("jwt", r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b", true),
            ("credential_assignment", r#"(?i)(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password)\s*[=:]\s*[\"']?[^\s\"',;]{8,}"#, true),
        ]
        .into_iter()
        .map(|(label, expression, high_risk)| SecretPattern {
            label,
            regex: Regex::new(expression).expect("静态秘密正则必须有效"),
            high_risk,
        })
        .collect()
    })
}

pub fn redact_input(value: &Value) -> RedactionResult {
    let mut findings = Vec::new();
    let mut blocked = false;
    let redacted = redact_value(value, &mut findings, &mut blocked);
    findings.sort();
    findings.dedup();
    RedactionResult {
        value: redacted,
        findings,
        blocked,
    }
}

pub fn enforce_safe_input(value: &Value) -> Result<Value, AiError> {
    let result = redact_input(value);
    if result.blocked {
        return Err(AiError::new(
            AiErrorCode::SecretBlocked,
            format!(
                "检测到高风险秘密，已阻止发送：{}",
                result.findings.join("、")
            ),
            false,
        )
        .with_action("移除凭据、私钥或敏感环境变量值后重试"));
    }
    Ok(result.value)
}

fn redact_value(value: &Value, findings: &mut Vec<String>, blocked: &mut bool) -> Value {
    match value {
        Value::String(text) => Value::String(redact_text(text, findings, blocked, true)),
        Value::Array(values) => Value::Array(
            values
                .iter()
                .map(|value| redact_value(value, findings, blocked))
                .collect(),
        ),
        Value::Object(map) => Value::Object(
            map.iter()
                .map(|(key, value)| {
                    if is_secret_key(key) && !value.is_null() {
                        findings.push("credential_field".to_string());
                        *blocked = true;
                        (key.clone(), Value::String("[REDACTED]".to_string()))
                    } else {
                        (key.clone(), redact_value(value, findings, blocked))
                    }
                })
                .collect(),
        ),
        _ => value.clone(),
    }
}

fn is_secret_key(key: &str) -> bool {
    let normalized = key.to_ascii_lowercase().replace(['-', '.'], "_");
    [
        "api_key",
        "apikey",
        "password",
        "passwd",
        "secret",
        "token",
        "authorization",
    ]
    .iter()
    .any(|candidate| normalized == *candidate || normalized.ends_with(&format!("_{candidate}")))
}

fn redact_text(
    text: &str,
    findings: &mut Vec<String>,
    blocked: &mut bool,
    include_environment: bool,
) -> String {
    let mut output = text.to_string();
    for pattern in patterns() {
        if pattern.regex.is_match(&output) {
            findings.push(pattern.label.to_string());
            *blocked |= pattern.high_risk;
            output = pattern.regex.replace_all(&output, "[REDACTED]").to_string();
        }
    }
    if include_environment {
        for (_, value) in std::env::vars_os() {
            let Some(value) = value.to_str() else {
                continue;
            };
            if value.len() >= 8 && output.contains(value) {
                findings.push("environment_value".to_string());
                *blocked = true;
                output = output.replace(value, "[REDACTED_ENV]");
            }
        }
    }
    output
}

pub fn redact_log_text(text: &str) -> String {
    let mut findings = Vec::new();
    let mut blocked = false;
    redact_text(text, &mut findings, &mut blocked, true)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    #[test]
    fn blocks_and_redacts_high_risk_secrets() {
        let input = json!({
            "content": "Authorization: Bearer example-token-value-123456",
            "apiKey": "not-a-real-key-123456"
        });
        let result = super::redact_input(&input);
        assert!(result.blocked);
        assert!(!result.value.to_string().contains("example-token-value"));
        assert!(!result.value.to_string().contains("not-a-real-key"));
    }

    #[test]
    fn ordinary_content_is_unchanged() {
        let input = json!({"content": "A normal SKILL.md description"});
        let result = super::redact_input(&input);
        assert!(!result.blocked);
        assert_eq!(result.value, input);
    }
}
