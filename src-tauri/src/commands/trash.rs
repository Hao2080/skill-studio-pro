use tauri::{AppHandle, Emitter};

use crate::lifecycle::model::{
    DeleteExecuteInput, DeletePlan, PurgeConfirmation, PurgeExecuteInput, RestoreExecuteInput,
    RestorePlan, RestorePlanInput, TrashEntry,
};
use crate::services::trash_service::TrashService;

fn service() -> Result<TrashService, String> {
    let home = dirs::home_dir().ok_or_else(|| "无法解析用户主目录".to_string())?;
    TrashService::new(crate::workspace::workspace_root()?, home)
}

#[tauri::command]
pub fn trash_plan_create(_app: AppHandle, skill_id: String) -> Result<DeletePlan, String> {
    super::validate_required_id("skillId", &skill_id)?;
    service()?.create_delete_plan(&skill_id)
}

#[tauri::command]
pub fn trash_move_execute(app: AppHandle, input: DeleteExecuteInput) -> Result<TrashEntry, String> {
    super::validate_required_id("planId", &input.plan_id)?;
    super::validate_required_id("planHash", &input.plan_hash)?;
    let entry = service()?.execute_delete(&input)?;
    let _ = app.emit(
        "operation://updated",
        serde_json::json!({ "entityId": entry.entity_id, "trashEntryId": entry.id, "status": "success", "operationType": "trash_move" }),
    );
    Ok(entry)
}

#[tauri::command]
pub fn trash_list(_app: AppHandle) -> Result<Vec<TrashEntry>, String> {
    service()?.list()
}

#[tauri::command]
pub fn trash_restore_plan(_app: AppHandle, input: RestorePlanInput) -> Result<RestorePlan, String> {
    super::validate_required_id("trashEntryId", &input.trash_entry_id)?;
    service()?.create_restore_plan(&input)
}

#[tauri::command]
pub fn trash_restore_execute(
    app: AppHandle,
    input: RestoreExecuteInput,
) -> Result<TrashEntry, String> {
    super::validate_required_id("planId", &input.plan_id)?;
    super::validate_required_id("planHash", &input.plan_hash)?;
    let entry = service()?.execute_restore(&input)?;
    let _ = app.emit(
        "operation://updated",
        serde_json::json!({ "entityId": entry.entity_id, "trashEntryId": entry.id, "status": "success", "operationType": "trash_restore" }),
    );
    Ok(entry)
}

#[tauri::command]
pub fn trash_purge_confirmation_create(
    _app: AppHandle,
    trash_entry_id: String,
) -> Result<PurgeConfirmation, String> {
    super::validate_required_id("trashEntryId", &trash_entry_id)?;
    service()?.create_purge_confirmation(&trash_entry_id)
}

#[tauri::command]
pub fn trash_purge_execute(app: AppHandle, input: PurgeExecuteInput) -> Result<(), String> {
    super::validate_required_id("trashEntryId", &input.trash_entry_id)?;
    super::validate_required_id("confirmationToken", &input.confirmation_token)?;
    service()?.execute_purge(&input)?;
    let _ = app.emit(
        "operation://updated",
        serde_json::json!({ "trashEntryId": input.trash_entry_id, "status": "success", "operationType": "trash_purge" }),
    );
    Ok(())
}
