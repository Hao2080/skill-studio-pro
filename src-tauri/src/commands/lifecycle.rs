use tauri::{AppHandle, Emitter};

use crate::lifecycle::model::{
    ImportExecuteInput, ImportPlanInput, ImportResult, InstallPlan, RecoveryReport,
    SaveTextFileInput, SaveTextFileResult,
};
use crate::services::lifecycle_service::LifecycleService;

fn service() -> Result<LifecycleService, String> {
    LifecycleService::new(crate::workspace::workspace_root()?)
}

#[tauri::command]
pub fn import_plan_create(app: AppHandle, input: ImportPlanInput) -> Result<InstallPlan, String> {
    let plan = service()?.create_import_plan(&input)?;
    let _ = app.emit(
        "operation://updated",
        serde_json::json!({ "operationId": plan.id, "status": "planned", "operationType": "import" }),
    );
    Ok(plan)
}

#[tauri::command]
pub fn import_plan_execute(
    app: AppHandle,
    input: ImportExecuteInput,
) -> Result<ImportResult, String> {
    super::validate_required_id("planId", &input.plan_id)?;
    super::validate_required_id("planHash", &input.plan_hash)?;
    let result = service()?.execute_import_plan(&input)?;
    let _ = app.emit(
        "operation://updated",
        serde_json::json!({ "operationId": result.plan_id, "status": result.status, "operationType": "import" }),
    );
    Ok(result)
}

#[tauri::command]
pub fn lifecycle_text_file_save(
    app: AppHandle,
    input: SaveTextFileInput,
) -> Result<SaveTextFileResult, String> {
    super::validate_required_id("skillId", &input.skill_id)?;
    super::validate_required_id("editSessionId", &input.edit_session_id)?;
    let result = service()?.save_text_file(&input)?;
    let _ = app.emit(
        "operation://updated",
        serde_json::json!({ "entityId": result.skill_id, "status": "success", "operationType": "edit_save" }),
    );
    Ok(result)
}

#[tauri::command]
pub fn lifecycle_staging_recover(_app: AppHandle) -> Result<RecoveryReport, String> {
    service()?.recover_staging()
}
