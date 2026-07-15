use tauri::{AppHandle, Emitter};

use crate::inventory::model::{
    InstanceListInput, InstanceListResult, ScanCancelInput, ScanRoot, ScanRootUpsertInput, ScanRun,
    ScanStartInput, SkillInstanceDetail,
};
use crate::inventory::service;
use crate::{store, workspace};

pub const SCAN_PROGRESS_EVENT: &str = "inventory://scan-progress";
pub const INSTANCES_CHANGED_EVENT: &str = "inventory://instances-changed";

#[tauri::command]
pub fn inventory_root_list(app: AppHandle) -> Result<Vec<ScanRoot>, String> {
    let conn = store::get_conn(&app)?;
    let home = dirs::home_dir().ok_or_else(|| "无法解析用户主目录".to_string())?;
    service::root_list(&conn, &home)
}

#[tauri::command]
pub fn inventory_root_upsert(
    app: AppHandle,
    input: ScanRootUpsertInput,
) -> Result<ScanRoot, String> {
    let conn = store::get_conn(&app)?;
    service::root_upsert(&conn, &input)
}

#[tauri::command]
pub fn inventory_scan_start(app: AppHandle, input: ScanStartInput) -> Result<ScanRun, String> {
    let conn = store::get_conn(&app)?;
    let home = dirs::home_dir().ok_or_else(|| "无法解析用户主目录".to_string())?;
    let prepared = service::prepare_scan(&conn, workspace::db_path()?, &home, &input)?;
    let initial_run = prepared.run.clone();
    let failed_prepared = prepared.clone();
    let event_app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let progress_app = event_app.clone();
        let changed_app = event_app.clone();
        if let Err(error) = service::execute_scan(
            prepared,
            &input,
            move |progress| {
                let _ = progress_app.emit(SCAN_PROGRESS_EVENT, progress);
            },
            move |changed| {
                let _ = changed_app.emit(INSTANCES_CHANGED_EVENT, changed);
            },
        ) {
            if let Ok(run) = service::fail_scan(&failed_prepared, &error) {
                let _ = event_app.emit(
                    SCAN_PROGRESS_EVENT,
                    crate::inventory::model::ScanProgressEvent {
                        run_id: run.id,
                        status: run.status,
                        roots_total: run.roots_total,
                        roots_completed: run.roots_completed,
                        candidates_seen: run.candidates_seen,
                        instances_changed: run.instances_changed,
                        error_count: run.error_count,
                        current_path: None,
                    },
                );
            }
        }
    });
    Ok(initial_run)
}

#[tauri::command]
pub fn inventory_scan_cancel(input: ScanCancelInput) -> Result<bool, String> {
    super::validate_required_id("runId", &input.run_id)?;
    service::cancel_scan(&input.run_id)
}

#[tauri::command]
pub fn inventory_instance_list(
    app: AppHandle,
    input: Option<InstanceListInput>,
) -> Result<InstanceListResult, String> {
    let conn = store::get_conn(&app)?;
    service::instance_list(&conn, &input.unwrap_or_default())
}

#[tauri::command]
pub fn inventory_instance_get(
    app: AppHandle,
    instance_id: String,
) -> Result<SkillInstanceDetail, String> {
    super::validate_required_id("instanceId", &instance_id)?;
    let conn = store::get_conn(&app)?;
    service::instance_get(&conn, &instance_id)
}

#[tauri::command]
pub fn inventory_instance_file_read(
    app: AppHandle,
    instance_id: String,
    relative_path: String,
) -> Result<String, String> {
    super::validate_required_id("instanceId", &instance_id)?;
    super::validate_required_id("relativePath", &relative_path)?;
    let conn = store::get_conn(&app)?;
    service::read_instance_text_file(&conn, &instance_id, &relative_path)
}
