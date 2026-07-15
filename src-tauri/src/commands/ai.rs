use tauri::AppHandle;

use crate::ai::model::{
    AiArtifact, AiError, AiErrorCode, AiProviderConfig, AiProviderSaveInput, AiTaskRoute,
    AiTaskRouteSaveInput, ArtifactGenerateInput, ArtifactListInput, ProviderTestResult,
};
use crate::{ai, credentials, store, workspace};

#[tauri::command]
pub fn ai_provider_list(app: AppHandle) -> Result<Vec<AiProviderConfig>, AiError> {
    let conn = store::get_conn(&app).map_err(storage_error)?;
    ai::service::provider_list(&conn)
}

#[tauri::command]
pub fn ai_provider_save(
    app: AppHandle,
    input: AiProviderSaveInput,
) -> Result<AiProviderConfig, AiError> {
    let conn = store::get_conn(&app).map_err(storage_error)?;
    ai::service::provider_save(&conn, &input, credentials::default_manager())
}

#[tauri::command]
pub async fn ai_provider_test(provider_id: String) -> Result<ProviderTestResult, AiError> {
    let db_path = workspace::db_path().map_err(storage_error)?;
    ai::service::provider_test_at_path(&db_path, &provider_id, credentials::default_manager()).await
}

#[tauri::command]
pub fn ai_task_route_list(app: AppHandle) -> Result<Vec<AiTaskRoute>, AiError> {
    let conn = store::get_conn(&app).map_err(storage_error)?;
    ai::service::task_route_list(&conn)
}

#[tauri::command]
pub fn ai_task_route_save(
    app: AppHandle,
    input: AiTaskRouteSaveInput,
) -> Result<AiTaskRoute, AiError> {
    let conn = store::get_conn(&app).map_err(storage_error)?;
    ai::service::task_route_save(&conn, &input)
}

#[tauri::command]
pub async fn ai_artifact_generate(input: ArtifactGenerateInput) -> Result<AiArtifact, AiError> {
    let db_path = workspace::db_path().map_err(storage_error)?;
    ai::service::artifact_generate_at_path(&db_path, &input, credentials::default_manager()).await
}

#[tauri::command]
pub fn ai_artifact_cancel(cancellation_id: String) -> Result<bool, AiError> {
    ai::service::cancel_generation(&cancellation_id)
}

#[tauri::command]
pub fn ai_artifact_list(
    app: AppHandle,
    input: Option<ArtifactListInput>,
) -> Result<Vec<AiArtifact>, AiError> {
    let conn = store::get_conn(&app).map_err(storage_error)?;
    ai::service::artifact_list(&conn, &input.unwrap_or_default())
}

fn storage_error(message: String) -> AiError {
    AiError::new(AiErrorCode::ProviderError, message, true)
}
