use tauri::AppHandle;

use crate::origin::model::{OriginConfirmInput, OriginRecalculateInput, SourceResolution};
use crate::{origin, store};

#[tauri::command]
pub fn origin_resolution_get(
    app: AppHandle,
    instance_id: String,
) -> Result<SourceResolution, String> {
    super::validate_required_id("instanceId", &instance_id)?;
    let conn = store::get_conn(&app)?;
    origin::service::get(&conn, &instance_id)
}

#[tauri::command]
pub fn origin_resolution_confirm(
    app: AppHandle,
    input: OriginConfirmInput,
) -> Result<SourceResolution, String> {
    let conn = store::get_conn(&app)?;
    origin::service::confirm(&conn, &input, chrono::Utc::now().timestamp_millis())
}

#[tauri::command]
pub fn origin_resolution_recalculate(
    app: AppHandle,
    input: OriginRecalculateInput,
) -> Result<SourceResolution, String> {
    super::validate_required_id("instanceId", &input.instance_id)?;
    let conn = store::get_conn(&app)?;
    origin::service::recalculate(
        &conn,
        &input.instance_id,
        chrono::Utc::now().timestamp_millis(),
    )
}
