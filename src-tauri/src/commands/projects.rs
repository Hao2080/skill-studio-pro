use tauri::AppHandle;

use crate::{
    domain::{
        CreateProjectInput, DeleteProjectInput, DeleteProjectPlatformConnectionInput,
        DeleteProjectSkillAssignmentInput, ExecuteProjectSyncInput, ProjectDetail,
        ProjectPlatformConnection, ProjectSkillAssignment, ProjectSummary, ProjectSyncLog,
        ProjectSyncPlan, ProjectSyncResult, SaveProjectPlatformConnectionInput,
        SaveProjectSkillAssignmentInput, TestPlatformPathResult, TestProjectPlatformPathInput,
        UpdateProjectInput,
    },
    store,
};

#[tauri::command]
pub fn project_list(app: AppHandle) -> Result<Vec<ProjectSummary>, String> {
    store::list_projects(&app)
}

#[tauri::command]
pub fn project_get(app: AppHandle, project_id: String) -> Result<ProjectDetail, String> {
    super::validate_required_id("projectId", &project_id)?;
    store::get_project_detail(&app, &project_id)
}

#[tauri::command]
pub fn project_rescan(app: AppHandle, project_id: String) -> Result<ProjectDetail, String> {
    super::validate_required_id("projectId", &project_id)?;
    store::rescan_project(&app, &project_id)
}

#[tauri::command]
pub fn project_create(
    app: AppHandle,
    input: CreateProjectInput,
) -> Result<crate::domain::Project, String> {
    store::create_project(&app, &input)
}

#[tauri::command]
pub fn project_update(
    app: AppHandle,
    input: UpdateProjectInput,
) -> Result<crate::domain::Project, String> {
    super::validate_required_id("projectId", &input.project_id)?;
    store::update_project(&app, &input)
}

#[tauri::command]
pub fn project_delete(app: AppHandle, input: DeleteProjectInput) -> Result<(), String> {
    super::validate_required_id("projectId", &input.project_id)?;
    store::delete_project(&app, &input.project_id)
}

#[tauri::command]
pub fn project_platform_list(
    app: AppHandle,
    project_id: String,
) -> Result<Vec<ProjectPlatformConnection>, String> {
    super::validate_required_id("projectId", &project_id)?;
    store::list_project_platform_connections(&app, &project_id)
}

#[tauri::command]
pub fn project_platform_save(
    app: AppHandle,
    input: SaveProjectPlatformConnectionInput,
) -> Result<ProjectPlatformConnection, String> {
    super::validate_required_id("projectId", &input.project_id)?;
    super::validate_required_id("platformName", &input.platform_name)?;
    store::save_project_platform_connection(&app, &input)
}

#[tauri::command]
pub fn project_platform_delete(
    app: AppHandle,
    input: DeleteProjectPlatformConnectionInput,
) -> Result<(), String> {
    super::validate_required_id("projectId", &input.project_id)?;
    super::validate_required_id("platformName", &input.platform_name)?;
    store::delete_project_platform_connection(&app, &input)
}

#[tauri::command]
pub fn project_platform_test_path(
    app: AppHandle,
    input: TestProjectPlatformPathInput,
) -> Result<TestPlatformPathResult, String> {
    super::validate_required_id("projectId", &input.project_id)?;
    super::validate_required_id("platformName", &input.platform_name)?;
    store::test_project_platform_path(&app, &input)
}

#[tauri::command]
pub fn project_assignment_list(
    app: AppHandle,
    project_id: String,
    platform_name: Option<String>,
) -> Result<Vec<ProjectSkillAssignment>, String> {
    super::validate_required_id("projectId", &project_id)?;
    store::list_project_skill_assignments(&app, &project_id, platform_name.as_deref())
}

#[tauri::command]
pub fn project_assignment_save(
    app: AppHandle,
    input: SaveProjectSkillAssignmentInput,
) -> Result<ProjectSkillAssignment, String> {
    super::validate_required_id("projectId", &input.project_id)?;
    super::validate_required_id("platformName", &input.platform_name)?;
    super::validate_required_id("skillId", &input.skill_id)?;
    super::validate_optional_id("snapshotId", input.snapshot_id.as_deref())?;
    store::save_project_skill_assignment(&app, &input)
}

#[tauri::command]
pub fn project_assignment_delete(
    app: AppHandle,
    input: DeleteProjectSkillAssignmentInput,
) -> Result<(), String> {
    super::validate_required_id("assignmentId", &input.assignment_id)?;
    store::delete_project_skill_assignment(&app, &input.assignment_id)
}

#[tauri::command]
pub fn project_sync_plan(
    app: AppHandle,
    project_id: String,
    platform_name: String,
) -> Result<ProjectSyncPlan, String> {
    super::validate_required_id("projectId", &project_id)?;
    super::validate_required_id("platformName", &platform_name)?;
    store::build_project_sync_plan(&app, &project_id, &platform_name)
}

#[tauri::command]
pub fn project_sync_platform(
    app: AppHandle,
    input: ExecuteProjectSyncInput,
) -> Result<ProjectSyncResult, String> {
    super::validate_required_id("projectId", &input.project_id)?;
    super::validate_required_id("platformName", &input.platform_name)?;
    store::sync_project_platform(&app, &input)
}

#[tauri::command]
pub fn project_sync_logs(
    app: AppHandle,
    project_id: String,
    limit: Option<i64>,
) -> Result<Vec<ProjectSyncLog>, String> {
    super::validate_required_id("projectId", &project_id)?;
    store::list_project_sync_logs(&app, &project_id, limit.unwrap_or(50))
}
