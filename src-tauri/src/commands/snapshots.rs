use tauri::AppHandle;

use crate::{
    domain::{CreateSnapshotInput, SkillSnapshot, UpdateSnapshotSummaryInput},
    snapshot,
};

#[tauri::command]
pub fn snapshot_create(
    app: AppHandle,
    input: CreateSnapshotInput,
) -> Result<SkillSnapshot, String> {
    super::validate_required_id("skillId", &input.skill_id)?;
    snapshot::create_snapshot(&app, &input)
}

#[tauri::command]
pub fn snapshot_list(app: AppHandle, skill_id: String) -> Result<Vec<SkillSnapshot>, String> {
    super::validate_required_id("skillId", &skill_id)?;
    snapshot::list_snapshots(&app, &skill_id)
}

#[tauri::command]
pub fn snapshot_restore(app: AppHandle, snapshot_id: String) -> Result<String, String> {
    super::validate_required_id("snapshotId", &snapshot_id)?;
    snapshot::restore_snapshot(&app, &snapshot_id)
}

#[tauri::command]
pub fn snapshot_delete(app: AppHandle, snapshot_id: String) -> Result<(), String> {
    super::validate_required_id("snapshotId", &snapshot_id)?;
    snapshot::delete_snapshot(&app, &snapshot_id)
}

#[tauri::command]
pub fn snapshot_update_summary(
    app: AppHandle,
    input: UpdateSnapshotSummaryInput,
) -> Result<SkillSnapshot, String> {
    super::validate_required_id("snapshotId", &input.snapshot_id)?;
    snapshot::update_snapshot_summary(&app, &input)
}

#[tauri::command]
pub fn snapshot_set_active(app: AppHandle, snapshot_id: String) -> Result<SkillSnapshot, String> {
    super::validate_required_id("snapshotId", &snapshot_id)?;
    snapshot::set_active_snapshot(&app, &snapshot_id)
}
