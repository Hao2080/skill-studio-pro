use tauri::AppHandle;

use crate::lifecycle::model::{OperationListInput, OperationLog};
use crate::services::lifecycle_service::LifecycleService;

#[tauri::command]
pub fn operation_list(
    _app: AppHandle,
    input: Option<OperationListInput>,
) -> Result<Vec<OperationLog>, String> {
    LifecycleService::new(crate::workspace::workspace_root()?)?
        .list_operations(&input.unwrap_or_default())
}
