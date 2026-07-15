use rusqlite::Connection;

use super::model::{AiError, AiErrorCode, AiProviderConfig, AiTaskRoute, AiTaskType};
use super::repository;

#[derive(Debug, Clone)]
pub struct ResolvedRoute {
    pub route: AiTaskRoute,
    pub provider: AiProviderConfig,
}

pub fn resolve(conn: &Connection, task_type: AiTaskType) -> Result<ResolvedRoute, AiError> {
    let route = repository::get_route(conn, task_type)
        .map_err(storage_error)?
        .ok_or_else(|| AiError::configuration("AI 任务路由不存在"))?;
    if !route.enabled {
        return Err(AiError::new(
            AiErrorCode::ProviderDisabled,
            "该 AI 任务已禁用",
            false,
        ));
    }
    let provider = repository::get_provider_config(conn, &route.provider_id)
        .map_err(storage_error)?
        .ok_or_else(|| AiError::configuration("任务路由引用的 Provider 不存在"))?;
    if !provider.enabled {
        return Err(AiError::new(
            AiErrorCode::ProviderDisabled,
            "任务路由对应的 Provider 已禁用",
            false,
        ));
    }
    Ok(ResolvedRoute { route, provider })
}

fn storage_error(error: String) -> AiError {
    AiError::new(AiErrorCode::ProviderError, error, true)
}
