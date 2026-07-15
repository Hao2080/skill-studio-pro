use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Instant;

use rusqlite::{Connection, OptionalExtension};
use serde_json::Value;
use sha2::{Digest, Sha256};
use tokio::sync::{OwnedSemaphorePermit, Semaphore};
use tokio_util::sync::CancellationToken;

use crate::credentials::CredentialManager;

use super::minimax::MiniMaxProvider;
use super::model::{
    AiArtifact, AiCallLog, AiError, AiErrorCode, AiProviderConfig, AiProviderSaveInput, AiRequest,
    AiTaskRoute, AiTaskRouteSaveInput, ArtifactGenerateInput, ArtifactListInput,
    ProviderTestResult, ProviderType, SecretMode,
};
use super::openai::OpenAiProvider;
use super::provider::AiProvider;
use super::{http, prompts, redaction, repository, router, schema};

static ACTIVE_CALLS: OnceLock<Mutex<HashMap<String, CancellationToken>>> = OnceLock::new();
type ProviderLimitRegistry = HashMap<String, (usize, Arc<Semaphore>)>;
static PROVIDER_LIMITS: OnceLock<Mutex<ProviderLimitRegistry>> = OnceLock::new();

fn active_calls() -> &'static Mutex<HashMap<String, CancellationToken>> {
    ACTIVE_CALLS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn provider_limits() -> &'static Mutex<HashMap<String, (usize, Arc<Semaphore>)>> {
    PROVIDER_LIMITS.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn provider_list(conn: &Connection) -> Result<Vec<AiProviderConfig>, AiError> {
    repository::list_provider_configs(conn).map_err(storage_error)
}

pub fn provider_save(
    conn: &Connection,
    input: &AiProviderSaveInput,
    credentials: &CredentialManager,
) -> Result<AiProviderConfig, AiError> {
    validate_provider_input(input)?;
    let previous =
        repository::get_provider_config(conn, &input.provider_id).map_err(storage_error)?;
    let previous_ref = previous
        .as_ref()
        .and_then(|config| config.secret_ref.as_deref());
    let previous_tail = previous
        .as_ref()
        .and_then(|config| config.secret_tail.as_deref());
    let (secret_ref, secret_tail) = match input.secret_mode {
        SecretMode::Unchanged => (
            previous_ref.map(str::to_string),
            previous_tail.map(str::to_string),
        ),
        SecretMode::Remove => (None, None),
        SecretMode::Persistent | SecretMode::Temporary => {
            let key = input.api_key.as_deref().ok_or_else(|| {
                AiError::new(
                    AiErrorCode::CredentialMissing,
                    "保存凭据时必须提供 API Key",
                    false,
                )
            })?;
            let saved = credentials.save(&input.provider_id, key, input.secret_mode)?;
            (Some(saved.0), Some(saved.1))
        }
    };
    let saved_config = repository::save_provider_config(
        conn,
        input,
        secret_ref.as_deref(),
        secret_tail.as_deref(),
        now_ms(),
    )
    .map_err(|error| {
        if secret_ref.as_deref() != previous_ref
            && matches!(
                input.secret_mode,
                SecretMode::Persistent | SecretMode::Temporary
            )
        {
            let _ = credentials.delete(secret_ref.as_deref());
        }
        storage_error(error)
    })?;
    if secret_ref.as_deref() != previous_ref {
        credentials.delete(previous_ref)?;
    }
    Ok(saved_config)
}

pub fn task_route_list(conn: &Connection) -> Result<Vec<AiTaskRoute>, AiError> {
    repository::list_routes(conn).map_err(storage_error)
}

pub fn task_route_save(
    conn: &Connection,
    input: &AiTaskRouteSaveInput,
) -> Result<AiTaskRoute, AiError> {
    require_non_empty("providerId", &input.provider_id)?;
    require_non_empty("modelId", &input.model_id)?;
    require_non_empty("promptVersion", &input.prompt_version)?;
    require_non_empty("responsibility", &input.responsibility)?;
    prompts::definition(input.task_type, &input.prompt_version).map_err(AiError::configuration)?;
    repository::save_route(conn, input, now_ms()).map_err(storage_error)
}

pub async fn provider_test_at_path(
    db_path: &Path,
    provider_id: &str,
    credentials: &CredentialManager,
) -> Result<ProviderTestResult, AiError> {
    require_non_empty("providerId", provider_id)?;
    let config = {
        let conn = open_connection(db_path)?;
        repository::get_provider_config(&conn, provider_id)
            .map_err(storage_error)?
            .ok_or_else(|| AiError::configuration("Provider 配置不存在"))?
    };
    if !config.enabled {
        return Err(AiError::new(
            AiErrorCode::ProviderDisabled,
            "Provider 已禁用",
            false,
        ));
    }
    let provider = build_provider(&config, credentials)?;
    let cancellation = CancellationToken::new();
    let _permit =
        acquire_provider_slot(&config.provider_id, config.max_concurrency, &cancellation).await?;
    let tested_at = now_ms();
    let result = provider.test_connection(&config.default_model).await;
    let conn = open_connection(db_path)?;
    match result {
        Ok(model) => {
            repository::update_provider_test(&conn, provider_id, "connected", tested_at)
                .map_err(storage_error)?;
            Ok(ProviderTestResult {
                provider_id: provider_id.to_string(),
                status: "connected".to_string(),
                model: Some(model),
                tested_at,
            })
        }
        Err(error) => {
            repository::update_provider_test(&conn, provider_id, error.code.as_str(), tested_at)
                .map_err(storage_error)?;
            Err(error)
        }
    }
}

pub async fn artifact_generate_at_path(
    db_path: &Path,
    input: &ArtifactGenerateInput,
    credentials: &CredentialManager,
) -> Result<AiArtifact, AiError> {
    if input.skill_id.is_none() && input.instance_id.is_none() {
        return Err(AiError::configuration(
            "生成 AI 产物必须提供 skillId 或 instanceId",
        ));
    }
    let safe_input = redaction::enforce_safe_input(&input.input)?;
    let (resolved, input_hash, cached) = {
        let conn = open_connection(db_path)?;
        validate_subjects(
            &conn,
            input.skill_id.as_deref(),
            input.instance_id.as_deref(),
        )?;
        let resolved = router::resolve(&conn, input.task_type)?;
        let input_hash = compute_input_hash(&conn, &safe_input, input.instance_id.as_deref())?;
        let cached = if input.force {
            None
        } else {
            repository::find_cached_artifact(
                &conn,
                input.skill_id.as_deref(),
                input.instance_id.as_deref(),
                &resolved.route,
                &input_hash,
            )
            .map_err(storage_error)?
        };
        (resolved, input_hash, cached)
    };
    if let Some(artifact) = cached {
        return Ok(artifact);
    }

    let provider = build_provider(&resolved.provider, credentials)?;
    let definition = prompts::definition(input.task_type, &resolved.route.prompt_version)
        .map_err(AiError::configuration)?;
    let cancellation_id = input
        .cancellation_id
        .clone()
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let cancellation = CancellationToken::new();
    active_calls()
        .lock()
        .map_err(|_| AiError::new(AiErrorCode::ProviderError, "AI 取消注册表已损坏", true))?
        .insert(cancellation_id.clone(), cancellation.clone());

    let global_permit = acquire_provider_slot(
        &resolved.provider.provider_id,
        resolved.provider.max_concurrency,
        &cancellation,
    )
    .await;
    let _global_permit = match global_permit {
        Ok(permit) => permit,
        Err(error) => {
            active_calls()
                .lock()
                .map_err(|_| AiError::new(AiErrorCode::ProviderError, "AI 取消注册表已损坏", true))?
                .remove(&cancellation_id);
            return Err(error);
        }
    };

    let started_at = now_ms();
    let started = Instant::now();
    let base_request = AiRequest {
        task_type: input.task_type,
        model: resolved.route.model_id.clone(),
        prompt_version: resolved.route.prompt_version.clone(),
        input: safe_input,
        schema_name: definition.schema_name.to_string(),
        schema: definition.schema.clone(),
        timeout_ms: resolved.provider.timeout_ms,
        cancellation,
        repair_feedback: None,
    };
    let result =
        generate_with_single_repair(provider.as_ref(), base_request, &definition.schema).await;
    active_calls()
        .lock()
        .map_err(|_| AiError::new(AiErrorCode::ProviderError, "AI 取消注册表已损坏", true))?
        .remove(&cancellation_id);

    let completed_at = now_ms();
    let latency_ms = started.elapsed().as_millis().min(i64::MAX as u128) as i64;
    let conn = open_connection(db_path)?;
    match result {
        Ok(response) => {
            let artifact = AiArtifact {
                id: uuid::Uuid::new_v4().to_string(),
                skill_id: input.skill_id.clone(),
                instance_id: input.instance_id.clone(),
                task_type: input.task_type,
                provider_id: resolved.provider.provider_id.clone(),
                model_id: response.actual_model_id,
                model_display_name: Some(resolved.route.model_id.clone()),
                responsibility: resolved.route.responsibility.clone(),
                prompt_version: resolved.route.prompt_version.clone(),
                input_hash,
                content: response.content,
                status: "completed".to_string(),
                input_tokens: response.input_tokens,
                output_tokens: response.output_tokens,
                stale_at: None,
                created_at: completed_at,
            };
            repository::insert_artifact(&conn, &artifact).map_err(storage_error)?;
            repository::insert_call_log(
                &conn,
                &AiCallLog {
                    id: uuid::Uuid::new_v4().to_string(),
                    artifact_id: Some(artifact.id.clone()),
                    provider_id: artifact.provider_id.clone(),
                    model_id: artifact.model_id.clone(),
                    task_type: input.task_type,
                    status: "completed".to_string(),
                    latency_ms: Some(latency_ms),
                    input_tokens: artifact.input_tokens,
                    output_tokens: artifact.output_tokens,
                    error_code: None,
                    error_summary: None,
                    started_at,
                    completed_at: Some(completed_at),
                },
            )
            .map_err(storage_error)?;
            Ok(artifact)
        }
        Err(error) => {
            let failed_artifact = AiArtifact {
                id: uuid::Uuid::new_v4().to_string(),
                skill_id: input.skill_id.clone(),
                instance_id: input.instance_id.clone(),
                task_type: input.task_type,
                provider_id: resolved.provider.provider_id.clone(),
                model_id: resolved.route.model_id.clone(),
                model_display_name: Some(resolved.route.model_id.clone()),
                responsibility: resolved.route.responsibility,
                prompt_version: resolved.route.prompt_version,
                input_hash,
                content: serde_json::json!({
                    "errorCode": error.code.as_str(),
                    "message": error.safe_summary()
                }),
                status: "failed".to_string(),
                input_tokens: None,
                output_tokens: None,
                stale_at: None,
                created_at: completed_at,
            };
            repository::insert_artifact(&conn, &failed_artifact).map_err(storage_error)?;
            repository::insert_call_log(
                &conn,
                &AiCallLog {
                    id: uuid::Uuid::new_v4().to_string(),
                    artifact_id: Some(failed_artifact.id),
                    provider_id: failed_artifact.provider_id,
                    model_id: failed_artifact.model_id,
                    task_type: input.task_type,
                    status: "failed".to_string(),
                    latency_ms: Some(latency_ms),
                    input_tokens: None,
                    output_tokens: None,
                    error_code: Some(error.code.as_str().to_string()),
                    error_summary: Some(error.safe_summary()),
                    started_at,
                    completed_at: Some(completed_at),
                },
            )
            .map_err(storage_error)?;
            Err(error)
        }
    }
}

pub fn artifact_list(
    conn: &Connection,
    input: &ArtifactListInput,
) -> Result<Vec<AiArtifact>, AiError> {
    repository::list_artifacts(conn, input).map_err(storage_error)
}

pub fn cancel_generation(cancellation_id: &str) -> Result<bool, AiError> {
    let calls = active_calls()
        .lock()
        .map_err(|_| AiError::new(AiErrorCode::ProviderError, "AI 取消注册表已损坏", true))?;
    if let Some(token) = calls.get(cancellation_id) {
        token.cancel();
        Ok(true)
    } else {
        Ok(false)
    }
}

async fn acquire_provider_slot(
    provider_id: &str,
    max_concurrency: usize,
    cancellation: &CancellationToken,
) -> Result<OwnedSemaphorePermit, AiError> {
    let semaphore = {
        let mut limits = provider_limits().lock().map_err(|_| {
            AiError::new(
                AiErrorCode::ProviderError,
                "Provider 并发注册表已损坏",
                true,
            )
        })?;
        let limit = max_concurrency.clamp(1, 32);
        match limits.get(provider_id) {
            Some((current, semaphore)) if *current == limit => semaphore.clone(),
            _ => {
                let semaphore = Arc::new(Semaphore::new(limit));
                limits.insert(provider_id.to_string(), (limit, semaphore.clone()));
                semaphore
            }
        }
    };
    tokio::select! {
        permit = semaphore.acquire_owned() => permit.map_err(|_| AiError::new(AiErrorCode::ProviderError, "Provider 并发控制器已关闭", true)),
        _ = cancellation.cancelled() => Err(AiError::new(AiErrorCode::Cancelled, "AI 调用已取消", false)),
    }
}

async fn generate_with_single_repair(
    provider: &dyn AiProvider,
    request: AiRequest,
    output_schema: &Value,
) -> Result<super::model::AiResponse, AiError> {
    let mut response = provider.generate(request.clone()).await?;
    match normalize_and_validate(output_schema, response.content) {
        Ok(content) => {
            response.content = content;
            Ok(response)
        }
        Err(first_error) => {
            let mut repair = request;
            repair.repair_feedback = Some(first_error);
            let mut repaired = provider.generate(repair).await?;
            repaired.content =
                normalize_and_validate(output_schema, repaired.content).map_err(|error| {
                    AiError::new(
                        AiErrorCode::InvalidStructuredOutput,
                        format!("结构化输出修复一次后仍无效: {error}"),
                        false,
                    )
                })?;
            Ok(repaired)
        }
    }
}

fn normalize_and_validate(output_schema: &Value, content: Value) -> Result<Value, String> {
    let parsed = match content {
        Value::String(raw) => schema::parse_json_output(&raw)?,
        value => value,
    };
    schema::validate(output_schema, &parsed)?;
    Ok(parsed)
}

fn build_provider(
    config: &AiProviderConfig,
    credentials: &CredentialManager,
) -> Result<Box<dyn AiProvider>, AiError> {
    let api_key = credentials.get(config.secret_ref.as_deref())?;
    match config.provider_type {
        ProviderType::Minimax => Ok(Box::new(MiniMaxProvider::new(
            &config.provider_id,
            &config.base_url,
            api_key,
            config.max_concurrency,
            config.retry_count,
        )?)),
        ProviderType::OpenaiResponses => Ok(Box::new(OpenAiProvider::new(
            &config.provider_id,
            &config.base_url,
            api_key,
            config.max_concurrency,
            config.retry_count,
        )?)),
    }
}

fn validate_provider_input(input: &AiProviderSaveInput) -> Result<(), AiError> {
    require_non_empty("providerId", &input.provider_id)?;
    require_non_empty("displayName", &input.display_name)?;
    require_non_empty("defaultModel", &input.default_model)?;
    http::validate_base_url(&input.base_url)?;
    if !(1_000..=600_000).contains(&input.timeout_ms) {
        return Err(AiError::configuration(
            "timeoutMs 必须在 1000 到 600000 之间",
        ));
    }
    if !(1..=32).contains(&input.max_concurrency) {
        return Err(AiError::configuration("maxConcurrency 必须在 1 到 32 之间"));
    }
    if input.retry_count > 5 {
        return Err(AiError::configuration("retryCount 不能大于 5"));
    }
    Ok(())
}

fn compute_input_hash(
    conn: &Connection,
    input: &Value,
    instance_id: Option<&str>,
) -> Result<String, AiError> {
    let instance_hash = if let Some(instance_id) = instance_id {
        conn.query_row(
            "SELECT content_hash FROM skill_instances WHERE id = ?1",
            rusqlite::params![instance_id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| storage_error(format!("读取实例内容哈希失败: {error}")))?
    } else {
        None
    };
    let canonical = canonical_json(input);
    let mut hasher = Sha256::new();
    hasher.update(b"skill-studio-pro-ai-input-v1\0");
    hasher.update(canonical.as_bytes());
    if let Some(hash) = instance_hash {
        hasher.update(b"\0instance-content-hash\0");
        hasher.update(hash.as_bytes());
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn validate_subjects(
    conn: &Connection,
    skill_id: Option<&str>,
    instance_id: Option<&str>,
) -> Result<(), AiError> {
    for (table, field, value) in [
        ("skills", "skillId", skill_id),
        ("skill_instances", "instanceId", instance_id),
    ] {
        let Some(value) = value else {
            continue;
        };
        let sql = format!("SELECT EXISTS(SELECT 1 FROM {table} WHERE id = ?1)");
        let exists: bool = conn
            .query_row(&sql, rusqlite::params![value], |row| row.get(0))
            .map_err(|error| storage_error(format!("校验 {field} 失败: {error}")))?;
        if !exists {
            return Err(AiError::configuration(format!("{field} 不存在")));
        }
    }
    Ok(())
}

fn canonical_json(value: &Value) -> String {
    match value {
        Value::Object(map) => {
            let mut keys = map.keys().collect::<Vec<_>>();
            keys.sort();
            let parts = keys
                .into_iter()
                .map(|key| {
                    format!(
                        "{}:{}",
                        serde_json::to_string(key).unwrap_or_default(),
                        canonical_json(&map[key])
                    )
                })
                .collect::<Vec<_>>();
            format!("{{{}}}", parts.join(","))
        }
        Value::Array(values) => format!(
            "[{}]",
            values
                .iter()
                .map(canonical_json)
                .collect::<Vec<_>>()
                .join(",")
        ),
        _ => serde_json::to_string(value).unwrap_or_default(),
    }
}

fn require_non_empty(field: &str, value: &str) -> Result<(), AiError> {
    if value.trim().is_empty() {
        Err(AiError::configuration(format!("{field} 不能为空")))
    } else {
        Ok(())
    }
}

fn open_connection(path: &Path) -> Result<Connection, AiError> {
    let conn = Connection::open(path)
        .map_err(|error| storage_error(format!("打开 AI 数据库失败: {error}")))?;
    conn.execute_batch("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;")
        .map_err(|error| storage_error(format!("配置 AI 数据库失败: {error}")))?;
    Ok(conn)
}

fn storage_error(error: String) -> AiError {
    AiError::new(AiErrorCode::ProviderError, error, true)
}

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

#[cfg(test)]
mod tests {
    use super::canonical_json;
    use serde_json::json;

    #[test]
    fn canonical_json_sorts_object_keys() {
        assert_eq!(
            canonical_json(&json!({"b": 2, "a": 1})),
            "{\"a\":1,\"b\":2}"
        );
    }
}
