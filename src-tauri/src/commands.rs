#[path = "commands/ai.rs"]
pub mod ai;
#[path = "commands/files.rs"]
pub mod files;
#[path = "commands/health.rs"]
pub mod health;
#[path = "commands/inventory.rs"]
pub mod inventory;
#[path = "commands/library.rs"]
pub mod library;
#[path = "commands/lifecycle.rs"]
pub mod lifecycle;
#[path = "commands/market.rs"]
pub mod market;
#[path = "commands/operations.rs"]
pub mod operations;
#[path = "commands/organization.rs"]
pub mod organization;
#[path = "commands/origin.rs"]
pub mod origin;
#[path = "commands/platforms.rs"]
pub mod platforms;
#[path = "commands/projects.rs"]
pub mod projects;
#[path = "commands/settings.rs"]
pub mod settings;
#[path = "commands/skills.rs"]
pub mod skills;
#[path = "commands/snapshots.rs"]
pub mod snapshots;
#[path = "commands/teams.rs"]
pub mod teams;
#[path = "commands/trash.rs"]
pub mod trash;

pub(crate) fn validate_required_id(field: &str, value: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        return Err(format!("{} 不能为空", field));
    }

    Ok(())
}

pub(crate) fn validate_optional_id(field: &str, value: Option<&str>) -> Result<(), String> {
    if let Some(value) = value {
        validate_required_id(field, value)?;
    }

    Ok(())
}

macro_rules! command_handlers {
    () => {
        tauri::generate_handler![
            crate::commands::ai::ai_provider_list,
            crate::commands::ai::ai_provider_save,
            crate::commands::ai::ai_provider_test,
            crate::commands::ai::ai_task_route_list,
            crate::commands::ai::ai_task_route_save,
            crate::commands::ai::ai_artifact_generate,
            crate::commands::ai::ai_artifact_cancel,
            crate::commands::ai::ai_artifact_list,
            crate::commands::health::db_health_check,
            crate::commands::inventory::inventory_root_list,
            crate::commands::inventory::inventory_root_upsert,
            crate::commands::inventory::inventory_scan_start,
            crate::commands::inventory::inventory_scan_cancel,
            crate::commands::inventory::inventory_instance_list,
            crate::commands::inventory::inventory_instance_get,
            crate::commands::origin::origin_resolution_get,
            crate::commands::origin::origin_resolution_confirm,
            crate::commands::origin::origin_resolution_recalculate,
            crate::commands::library::library_skill_list,
            crate::commands::library::library_skill_get,
            crate::commands::library::library_instance_register_plan,
            crate::commands::library::library_instance_register_execute,
            crate::commands::library::library_skill_publish_plan,
            crate::commands::library::library_skill_publish_execute,
            crate::commands::library::library_skill_remove_mapping,
            crate::commands::library::library_skill_drift_check,
            crate::commands::lifecycle::import_plan_create,
            crate::commands::lifecycle::import_plan_execute,
            crate::commands::lifecycle::lifecycle_text_file_save,
            crate::commands::lifecycle::lifecycle_staging_recover,
            crate::commands::trash::trash_plan_create,
            crate::commands::trash::trash_move_execute,
            crate::commands::trash::trash_list,
            crate::commands::trash::trash_restore_plan,
            crate::commands::trash::trash_restore_execute,
            crate::commands::trash::trash_purge_confirmation_create,
            crate::commands::trash::trash_purge_execute,
            crate::commands::operations::operation_list,
            crate::commands::skills::skill_list,
            crate::commands::skills::skill_get,
            crate::commands::skills::skill_source_list,
            crate::commands::skills::skill_import_record_list,
            crate::commands::skills::skill_create,
            crate::commands::skills::skill_import,
            crate::commands::skills::skill_delete,
            crate::commands::skills::skill_search,
            crate::commands::snapshots::snapshot_create,
            crate::commands::snapshots::snapshot_list,
            crate::commands::snapshots::snapshot_restore,
            crate::commands::snapshots::snapshot_delete,
            crate::commands::snapshots::snapshot_update_summary,
            crate::commands::platforms::diff_snapshots,
            crate::commands::platforms::platform_detect,
            crate::commands::platforms::detect_changes,
            crate::commands::platforms::diff_working_directory,
            crate::commands::platforms::scan_platform_skills,
            crate::commands::platforms::import_platform_skill,
            crate::commands::platforms::batch_import_platform_skills,
            crate::commands::platforms::sync_skill_to_platforms,
            crate::commands::platforms::publish_snapshot_to_platforms,
            crate::commands::platforms::remove_skill_from_platforms,
            crate::commands::platforms::get_skill_platform_releases,
            crate::commands::platforms::sync_all_to_platforms,
            crate::commands::platforms::save_platform_connection,
            crate::commands::platforms::platform_governance_impact,
            crate::commands::platforms::create_custom_platform,
            crate::commands::platforms::delete_custom_platform,
            crate::commands::platforms::test_platform_path,
            crate::commands::projects::project_list,
            crate::commands::projects::project_get,
            crate::commands::projects::project_rescan,
            crate::commands::projects::project_create,
            crate::commands::projects::project_update,
            crate::commands::projects::project_delete,
            crate::commands::projects::project_platform_list,
            crate::commands::projects::project_platform_save,
            crate::commands::projects::project_platform_delete,
            crate::commands::projects::project_platform_test_path,
            crate::commands::projects::project_assignment_list,
            crate::commands::projects::project_assignment_save,
            crate::commands::projects::project_assignment_delete,
            crate::commands::projects::project_sync_plan,
            crate::commands::projects::project_sync_platform,
            crate::commands::projects::project_sync_logs,
            crate::commands::market::market_catalog_list,
            crate::commands::market::market_external_list,
            crate::commands::market::market_external_search,
            crate::commands::market::market_external_detail,
            crate::commands::organization::skill_organization_snapshot,
            crate::commands::organization::skill_collection_create,
            crate::commands::organization::skill_collection_update,
            crate::commands::organization::skill_collection_delete,
            crate::commands::organization::skill_tags_ensure,
            crate::commands::organization::skill_tag_update,
            crate::commands::organization::skill_tag_delete,
            crate::commands::organization::skill_organization_batch_apply,
            crate::commands::health::open_skill_folder,
            crate::commands::health::get_skill_folder_path,
            crate::commands::files::list_skill_files,
            crate::commands::files::read_skill_file,
            crate::commands::files::open_file_in_editor,
            crate::commands::files::write_skill_file,
            crate::commands::settings::get_app_settings,
            crate::commands::settings::save_app_settings,
            crate::commands::snapshots::snapshot_set_active,
            crate::commands::teams::team_list,
            crate::commands::teams::team_create,
            crate::commands::teams::team_update,
            crate::commands::teams::team_set_status,
            crate::commands::teams::team_delete,
            crate::commands::teams::team_member_list,
            crate::commands::teams::team_member_create,
            crate::commands::teams::team_member_update,
            crate::commands::teams::team_member_remove,
            crate::commands::teams::team_activity_list,
            crate::commands::teams::team_skill_list,
            crate::commands::teams::team_skill_version_list,
            crate::commands::teams::team_submit,
            crate::commands::teams::team_submission_list,
            crate::commands::teams::team_submission_merge,
            crate::commands::teams::team_submission_reject,
            crate::commands::teams::team_submission_diff,
            crate::commands::teams::team_submission_merge_preview,
            crate::commands::teams::team_version_diff,
            crate::commands::teams::team_pull_impact_check,
            crate::commands::teams::team_version_pull,
            crate::commands::teams::team_version_list_files,
            crate::commands::teams::team_version_read_file,
            crate::commands::teams::team_version_set_recommended,
            crate::commands::teams::team_skill_delivery_get,
            crate::commands::teams::team_snapshot_submit_to_teams,
            crate::commands::teams::team_pending_delivery_withdraw,
            crate::commands::teams::team_skill_remove_from_teams,
        ]
    };
}

pub(crate) use command_handlers;

#[cfg(test)]
mod tests {
    #[test]
    fn rejects_blank_required_id() {
        let result = super::validate_required_id("skillId", "   ");
        assert_eq!(result.unwrap_err(), "skillId 不能为空");
    }

    #[test]
    fn accepts_present_optional_id() {
        super::validate_optional_id("snapshotId", Some("snap-1")).expect("非空可选 ID 应通过校验");
    }
}
