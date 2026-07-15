use tauri::AppHandle;

use crate::services::library_service::{
    CentralSkill, ExecutePlanInput, LibraryService, RegisterInstancePlan, RegisterInstancePlanInput,
};
use crate::services::mapping_service::{
    MappingService, MappingState, PublishPlan, PublishPlanInput, PublishResult,
    PublishTargetResult, RemoveMappingInput,
};

fn library_service() -> Result<LibraryService, String> {
    LibraryService::new(crate::workspace::workspace_root()?)
}

fn mapping_service() -> Result<MappingService, String> {
    let home = crate::workspace::home_dir()?;
    MappingService::new(crate::workspace::workspace_root()?, home)
}

#[tauri::command]
pub fn library_skill_list(_app: AppHandle) -> Result<Vec<CentralSkill>, String> {
    library_service()?.list()
}

#[tauri::command]
pub fn library_skill_get(_app: AppHandle, skill_id: String) -> Result<CentralSkill, String> {
    super::validate_required_id("skillId", &skill_id)?;
    library_service()?.get(&skill_id)
}

#[tauri::command]
pub fn library_instance_register_plan(
    _app: AppHandle,
    input: RegisterInstancePlanInput,
) -> Result<RegisterInstancePlan, String> {
    super::validate_required_id("instanceId", &input.instance_id)?;
    library_service()?.create_register_plan(&input)
}

#[tauri::command]
pub fn library_instance_register_execute(
    _app: AppHandle,
    input: ExecutePlanInput,
) -> Result<CentralSkill, String> {
    super::validate_required_id("planId", &input.plan_id)?;
    super::validate_required_id("planHash", &input.plan_hash)?;
    library_service()?.execute_register_plan(&input)
}

#[tauri::command]
pub fn library_skill_publish_plan(
    _app: AppHandle,
    input: PublishPlanInput,
) -> Result<PublishPlan, String> {
    super::validate_required_id("skillId", &input.skill_id)?;
    super::validate_required_id("snapshotId", &input.snapshot_id)?;
    mapping_service()?.create_publish_plan(&input)
}

#[tauri::command]
pub fn library_skill_publish_execute(
    _app: AppHandle,
    input: ExecutePlanInput,
) -> Result<PublishResult, String> {
    super::validate_required_id("planId", &input.plan_id)?;
    super::validate_required_id("planHash", &input.plan_hash)?;
    mapping_service()?.execute_publish_plan(&input)
}

#[tauri::command]
pub fn library_skill_remove_mapping(
    _app: AppHandle,
    input: RemoveMappingInput,
) -> Result<PublishTargetResult, String> {
    super::validate_required_id("skillId", &input.skill_id)?;
    super::validate_required_id("platformName", &input.platform_name)?;
    mapping_service()?.remove_mapping(&input)
}

#[tauri::command]
pub fn library_skill_drift_check(
    _app: AppHandle,
    skill_id: String,
) -> Result<Vec<MappingState>, String> {
    super::validate_required_id("skillId", &skill_id)?;
    mapping_service()?.detect_drift(&skill_id)
}
