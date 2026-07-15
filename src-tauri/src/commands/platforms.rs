use tauri::AppHandle;

use crate::{
    diff,
    domain::{
        BatchImportInput, BatchImportResult, ChangeStatus, CompareSnapshotsInput,
        CreateCustomPlatformInput, DeleteCustomPlatformInput, ImportPlatformSkillInput,
        PlatformConnection, PlatformGovernanceImpact, PlatformReleaseRecord, PlatformScanResult,
        PlatformSkillScanResult, PublishSnapshotToPlatformsInput, RemoveSkillFromPlatformsInput,
        SavePlatformConnectionInput, Skill, SkillPlatformReleaseOverview, SkillSyncResult,
        SnapshotDiffResult, SyncResult, TestPlatformPathInput, TestPlatformPathResult,
    },
    store,
};

#[tauri::command]
pub fn diff_snapshots(
    app: AppHandle,
    input: CompareSnapshotsInput,
) -> Result<SnapshotDiffResult, String> {
    super::validate_required_id("snapshotIdA", &input.snapshot_id_a)?;
    super::validate_required_id("snapshotIdB", &input.snapshot_id_b)?;
    diff::compare_snapshots(&app, &input)
}

#[tauri::command]
pub fn platform_detect(app: AppHandle) -> Result<PlatformScanResult, String> {
    store::detect_platforms(&app)
}

#[tauri::command]
pub fn detect_changes(app: AppHandle, skill_id: String) -> Result<ChangeStatus, String> {
    super::validate_required_id("skillId", &skill_id)?;
    store::detect_changes(&app, &skill_id)
}

#[tauri::command]
pub fn diff_working_directory(
    app: AppHandle,
    skill_id: String,
) -> Result<SnapshotDiffResult, String> {
    super::validate_required_id("skillId", &skill_id)?;
    diff::diff_working_directory(&app, &skill_id)
}

#[tauri::command]
pub fn scan_platform_skills(
    app: AppHandle,
    platform_name: String,
) -> Result<PlatformSkillScanResult, String> {
    store::scan_platform_skills(&app, &platform_name)
}

#[tauri::command]
pub fn import_platform_skill(
    app: AppHandle,
    input: ImportPlatformSkillInput,
) -> Result<Skill, String> {
    store::import_platform_skill(&app, &input)
}

#[tauri::command]
pub fn batch_import_platform_skills(
    app: AppHandle,
    input: BatchImportInput,
) -> Result<BatchImportResult, String> {
    store::batch_import_platform_skills(&app, &input)
}

#[tauri::command]
pub fn sync_skill_to_platforms(
    _app: AppHandle,
    skill_id: String,
) -> Result<Vec<SyncResult>, String> {
    super::validate_required_id("skillId", &skill_id)?;
    Err(
        "SAFE_PUBLISH_PLAN_REQUIRED: 请先调用 library_skill_publish_plan，再携带 planHash 执行"
            .to_string(),
    )
}

#[tauri::command]
pub fn publish_snapshot_to_platforms(
    _app: AppHandle,
    input: PublishSnapshotToPlatformsInput,
) -> Result<Vec<PlatformReleaseRecord>, String> {
    super::validate_required_id("skillId", &input.skill_id)?;
    super::validate_required_id("snapshotId", &input.snapshot_id)?;
    Err("SAFE_PUBLISH_PLAN_REQUIRED: 旧发布接口不再允许绕过漂移预览".to_string())
}

#[tauri::command]
pub fn remove_skill_from_platforms(
    _app: AppHandle,
    input: RemoveSkillFromPlatformsInput,
) -> Result<Vec<PlatformReleaseRecord>, String> {
    super::validate_required_id("skillId", &input.skill_id)?;
    Err("SAFE_REMOVE_MAPPING_REQUIRED: 请逐目标调用 library_skill_remove_mapping".to_string())
}

#[tauri::command]
pub fn get_skill_platform_releases(
    app: AppHandle,
    skill_id: String,
) -> Result<SkillPlatformReleaseOverview, String> {
    super::validate_required_id("skillId", &skill_id)?;
    store::get_skill_platform_releases(&app, &skill_id)
}

#[tauri::command]
pub fn sync_all_to_platforms(_app: AppHandle) -> Result<Vec<SkillSyncResult>, String> {
    Err("SAFE_PUBLISH_PLAN_REQUIRED: 批量同步必须逐 Skill 创建可验证发布计划".to_string())
}

#[tauri::command]
pub fn save_platform_connection(
    app: AppHandle,
    input: SavePlatformConnectionInput,
) -> Result<PlatformConnection, String> {
    super::validate_required_id("platformName", &input.platform_name)?;
    store::save_platform_connection(&app, &input)
}

#[tauri::command]
pub fn platform_governance_impact(
    app: AppHandle,
    platform_name: String,
) -> Result<PlatformGovernanceImpact, String> {
    super::validate_required_id("platformName", &platform_name)?;
    store::get_platform_governance_impact(&app, &platform_name)
}

#[tauri::command]
pub fn create_custom_platform(
    app: AppHandle,
    input: CreateCustomPlatformInput,
) -> Result<PlatformConnection, String> {
    super::validate_required_id("platformName", &input.platform_name)?;
    store::create_custom_platform(&app, &input)
}

#[tauri::command]
pub fn delete_custom_platform(
    app: AppHandle,
    input: DeleteCustomPlatformInput,
) -> Result<(), String> {
    super::validate_required_id("platformName", &input.platform_name)?;
    store::delete_custom_platform(&app, &input.platform_name)
}

#[tauri::command]
pub fn test_platform_path(
    app: AppHandle,
    input: TestPlatformPathInput,
) -> Result<TestPlatformPathResult, String> {
    store::test_platform_path(&app, &input)
}
