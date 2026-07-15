use std::str::FromStr;

use rusqlite::{params, Connection, OptionalExtension, Row};
use serde_json::Value;

use super::model::{
    AiArtifact, AiCallLog, AiProviderConfig, AiProviderSaveInput, AiTaskRoute,
    AiTaskRouteSaveInput, AiTaskType, ArtifactListInput, ProviderType,
};

pub fn list_provider_configs(conn: &Connection) -> Result<Vec<AiProviderConfig>, String> {
    let mut statement = conn
        .prepare(
            "SELECT provider_id, provider_type, display_name, base_url, default_model,
                    secret_ref, secret_tail, enabled, timeout_ms, max_concurrency, retry_count,
                    last_test_status, last_test_at, updated_at
             FROM ai_provider_configs ORDER BY provider_id",
        )
        .map_err(|error| format!("准备 Provider 配置查询失败: {error}"))?;
    let result = statement
        .query_map([], provider_from_row)
        .map_err(|error| format!("查询 Provider 配置失败: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("读取 Provider 配置失败: {error}"));
    result
}

pub fn get_provider_config(
    conn: &Connection,
    provider_id: &str,
) -> Result<Option<AiProviderConfig>, String> {
    conn.query_row(
        "SELECT provider_id, provider_type, display_name, base_url, default_model,
                secret_ref, secret_tail, enabled, timeout_ms, max_concurrency, retry_count,
                last_test_status, last_test_at, updated_at
         FROM ai_provider_configs WHERE provider_id = ?1",
        params![provider_id],
        provider_from_row,
    )
    .optional()
    .map_err(|error| format!("读取 Provider 配置失败: {error}"))
}

pub fn save_provider_config(
    conn: &Connection,
    input: &AiProviderSaveInput,
    secret_ref: Option<&str>,
    secret_tail: Option<&str>,
    now: i64,
) -> Result<AiProviderConfig, String> {
    conn.execute(
        "INSERT INTO ai_provider_configs (
            provider_id, provider_type, display_name, base_url, default_model,
            secret_ref, secret_tail, enabled, timeout_ms, max_concurrency, retry_count, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
         ON CONFLICT(provider_id) DO UPDATE SET
            provider_type = excluded.provider_type,
            display_name = excluded.display_name,
            base_url = excluded.base_url,
            default_model = excluded.default_model,
            secret_ref = excluded.secret_ref,
            secret_tail = excluded.secret_tail,
            enabled = excluded.enabled,
            timeout_ms = excluded.timeout_ms,
            max_concurrency = excluded.max_concurrency,
            retry_count = excluded.retry_count,
            updated_at = excluded.updated_at",
        params![
            input.provider_id,
            input.provider_type.as_str(),
            input.display_name,
            input.base_url,
            input.default_model,
            secret_ref,
            secret_tail,
            i64::from(input.enabled),
            input.timeout_ms as i64,
            input.max_concurrency as i64,
            input.retry_count as i64,
            now,
        ],
    )
    .map_err(|error| format!("保存 Provider 配置失败: {error}"))?;
    mark_stale_by_provider(conn, &input.provider_id, now)?;
    get_provider_config(conn, &input.provider_id)?
        .ok_or_else(|| "Provider 配置保存后不存在".to_string())
}

pub fn update_provider_test(
    conn: &Connection,
    provider_id: &str,
    status: &str,
    now: i64,
) -> Result<(), String> {
    conn.execute(
        "UPDATE ai_provider_configs SET last_test_status = ?2, last_test_at = ?3 WHERE provider_id = ?1",
        params![provider_id, status, now],
    )
    .map_err(|error| format!("更新 Provider 测试状态失败: {error}"))?;
    Ok(())
}

pub fn list_routes(conn: &Connection) -> Result<Vec<AiTaskRoute>, String> {
    let mut statement = conn
        .prepare(
            "SELECT task_type, provider_id, model_id, prompt_version, responsibility, enabled, updated_at
             FROM ai_task_routes ORDER BY task_type",
        )
        .map_err(|error| format!("准备任务路由查询失败: {error}"))?;
    let result = statement
        .query_map([], route_from_row)
        .map_err(|error| format!("查询任务路由失败: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("读取任务路由失败: {error}"));
    result
}

pub fn get_route(conn: &Connection, task: AiTaskType) -> Result<Option<AiTaskRoute>, String> {
    conn.query_row(
        "SELECT task_type, provider_id, model_id, prompt_version, responsibility, enabled, updated_at
         FROM ai_task_routes WHERE task_type = ?1",
        params![task.as_str()],
        route_from_row,
    )
    .optional()
    .map_err(|error| format!("读取任务路由失败: {error}"))
}

pub fn save_route(
    conn: &Connection,
    input: &AiTaskRouteSaveInput,
    now: i64,
) -> Result<AiTaskRoute, String> {
    let provider_exists: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM ai_provider_configs WHERE provider_id = ?1)",
            params![input.provider_id],
            |row| row.get(0),
        )
        .map_err(|error| format!("校验 Provider 失败: {error}"))?;
    if !provider_exists {
        return Err(format!("Provider 不存在: {}", input.provider_id));
    }
    conn.execute(
        "INSERT INTO ai_task_routes (
            task_type, provider_id, model_id, prompt_version, responsibility, enabled, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(task_type) DO UPDATE SET
            provider_id = excluded.provider_id,
            model_id = excluded.model_id,
            prompt_version = excluded.prompt_version,
            responsibility = excluded.responsibility,
            enabled = excluded.enabled,
            updated_at = excluded.updated_at",
        params![
            input.task_type.as_str(),
            input.provider_id,
            input.model_id,
            input.prompt_version,
            input.responsibility,
            i64::from(input.enabled),
            now,
        ],
    )
    .map_err(|error| format!("保存任务路由失败: {error}"))?;
    mark_stale_by_task(conn, input.task_type, now)?;
    get_route(conn, input.task_type)?.ok_or_else(|| "任务路由保存后不存在".to_string())
}

pub fn find_cached_artifact(
    conn: &Connection,
    skill_id: Option<&str>,
    instance_id: Option<&str>,
    route: &AiTaskRoute,
    input_hash: &str,
) -> Result<Option<AiArtifact>, String> {
    conn.query_row(
        "SELECT id, skill_id, instance_id, task_type, provider_id, model_id,
                model_display_name, responsibility, prompt_version, input_hash, content_json,
                status, input_tokens, output_tokens, stale_at, created_at
         FROM ai_artifacts
         WHERE skill_id IS ?1 AND instance_id IS ?2 AND task_type = ?3
           AND provider_id = ?4 AND (model_id = ?5 OR model_display_name = ?5) AND prompt_version = ?6
           AND responsibility = ?7 AND input_hash = ?8 AND status = 'completed' AND stale_at IS NULL
         ORDER BY created_at DESC LIMIT 1",
        params![
            skill_id,
            instance_id,
            route.task_type.as_str(),
            route.provider_id,
            route.model_id,
            route.prompt_version,
            route.responsibility,
            input_hash,
        ],
        artifact_from_row,
    )
    .optional()
    .map_err(|error| format!("查询 AI 缓存失败: {error}"))
}

pub fn insert_artifact(conn: &Connection, artifact: &AiArtifact) -> Result<(), String> {
    conn.execute(
        "INSERT INTO ai_artifacts (
            id, skill_id, instance_id, task_type, provider_id, model_id, model_display_name,
            responsibility, prompt_version, input_hash, content_json, status,
            input_tokens, output_tokens, stale_at, created_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
        params![
            artifact.id,
            artifact.skill_id,
            artifact.instance_id,
            artifact.task_type.as_str(),
            artifact.provider_id,
            artifact.model_id,
            artifact.model_display_name,
            artifact.responsibility,
            artifact.prompt_version,
            artifact.input_hash,
            serde_json::to_string(&artifact.content)
                .map_err(|error| format!("序列化 AI 产物失败: {error}"))?,
            artifact.status,
            artifact.input_tokens,
            artifact.output_tokens,
            artifact.stale_at,
            artifact.created_at,
        ],
    )
    .map_err(|error| format!("保存 AI 产物失败: {error}"))?;
    Ok(())
}

pub fn list_artifacts(
    conn: &Connection,
    input: &ArtifactListInput,
) -> Result<Vec<AiArtifact>, String> {
    let task = input.task_type.map(|task| task.as_str());
    let include_stale = input.include_stale.unwrap_or(true);
    let mut statement = conn
        .prepare(
            "SELECT id, skill_id, instance_id, task_type, provider_id, model_id,
                    model_display_name, responsibility, prompt_version, input_hash, content_json,
                    status, input_tokens, output_tokens, stale_at, created_at
             FROM ai_artifacts
             WHERE (?1 IS NULL OR skill_id = ?1)
               AND (?2 IS NULL OR instance_id = ?2)
               AND (?3 IS NULL OR task_type = ?3)
               AND (?4 = 1 OR stale_at IS NULL)
             ORDER BY created_at DESC",
        )
        .map_err(|error| format!("准备 AI 产物查询失败: {error}"))?;
    let result = statement
        .query_map(
            params![
                input.skill_id,
                input.instance_id,
                task,
                i64::from(include_stale)
            ],
            artifact_from_row,
        )
        .map_err(|error| format!("查询 AI 产物失败: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("读取 AI 产物失败: {error}"));
    result
}

pub fn insert_call_log(conn: &Connection, log: &AiCallLog) -> Result<(), String> {
    conn.execute(
        "INSERT INTO ai_call_logs (
            id, artifact_id, provider_id, model_id, task_type, status, latency_ms,
            input_tokens, output_tokens, error_code, error_summary, started_at, completed_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![
            log.id,
            log.artifact_id,
            log.provider_id,
            log.model_id,
            log.task_type.as_str(),
            log.status,
            log.latency_ms,
            log.input_tokens,
            log.output_tokens,
            log.error_code,
            log.error_summary,
            log.started_at,
            log.completed_at,
        ],
    )
    .map_err(|error| format!("保存 AI 调用日志失败: {error}"))?;
    Ok(())
}

pub fn mark_stale_by_provider(
    conn: &Connection,
    provider_id: &str,
    now: i64,
) -> Result<(), String> {
    conn.execute(
        "UPDATE ai_artifacts SET stale_at = ?2 WHERE provider_id = ?1 AND stale_at IS NULL",
        params![provider_id, now],
    )
    .map_err(|error| format!("失效 Provider AI 缓存失败: {error}"))?;
    Ok(())
}

pub fn mark_stale_by_task(conn: &Connection, task: AiTaskType, now: i64) -> Result<(), String> {
    conn.execute(
        "UPDATE ai_artifacts SET stale_at = ?2 WHERE task_type = ?1 AND stale_at IS NULL",
        params![task.as_str(), now],
    )
    .map_err(|error| format!("失效任务 AI 缓存失败: {error}"))?;
    Ok(())
}

fn provider_from_row(row: &Row<'_>) -> rusqlite::Result<AiProviderConfig> {
    let provider_type: String = row.get(1)?;
    let provider_type = match provider_type.as_str() {
        "minimax" => ProviderType::Minimax,
        "openai_responses" => ProviderType::OpenaiResponses,
        _ => return Err(rusqlite::Error::InvalidQuery),
    };
    Ok(AiProviderConfig {
        provider_id: row.get(0)?,
        provider_type,
        display_name: row.get(2)?,
        base_url: row.get(3)?,
        default_model: row.get(4)?,
        secret_ref: row.get(5)?,
        secret_tail: row.get(6)?,
        enabled: row.get::<_, i64>(7)? != 0,
        timeout_ms: row.get::<_, i64>(8)? as u64,
        max_concurrency: row.get::<_, i64>(9)? as usize,
        retry_count: row.get::<_, i64>(10)? as u32,
        last_test_status: row.get(11)?,
        last_test_at: row.get(12)?,
        updated_at: row.get(13)?,
    })
}

fn route_from_row(row: &Row<'_>) -> rusqlite::Result<AiTaskRoute> {
    let raw: String = row.get(0)?;
    let task_type = AiTaskType::from_str(&raw).map_err(|_| rusqlite::Error::InvalidQuery)?;
    Ok(AiTaskRoute {
        task_type,
        provider_id: row.get(1)?,
        model_id: row.get(2)?,
        prompt_version: row.get(3)?,
        responsibility: row.get(4)?,
        enabled: row.get::<_, i64>(5)? != 0,
        updated_at: row.get(6)?,
    })
}

fn artifact_from_row(row: &Row<'_>) -> rusqlite::Result<AiArtifact> {
    let raw_task: String = row.get(3)?;
    let raw_content: String = row.get(10)?;
    Ok(AiArtifact {
        id: row.get(0)?,
        skill_id: row.get(1)?,
        instance_id: row.get(2)?,
        task_type: AiTaskType::from_str(&raw_task).map_err(|_| rusqlite::Error::InvalidQuery)?,
        provider_id: row.get(4)?,
        model_id: row.get(5)?,
        model_display_name: row.get(6)?,
        responsibility: row.get(7)?,
        prompt_version: row.get(8)?,
        input_hash: row.get(9)?,
        content: serde_json::from_str(&raw_content).unwrap_or(Value::Null),
        status: row.get(11)?,
        input_tokens: row.get(12)?,
        output_tokens: row.get(13)?,
        stale_at: row.get(14)?,
        created_at: row.get(15)?,
    })
}
