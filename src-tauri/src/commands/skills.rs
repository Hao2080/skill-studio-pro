use tauri::AppHandle;

use crate::{
    domain::{CreateSkillInput, ImportSkillInput, Skill, SkillImportRecord, SkillSource},
    store,
};

#[tauri::command]
pub fn skill_list(app: AppHandle) -> Result<Vec<Skill>, String> {
    store::list_skills(&app)
}

#[tauri::command]
pub fn skill_get(app: AppHandle, skill_id: String) -> Result<Skill, String> {
    super::validate_required_id("skillId", &skill_id)?;
    store::get_skill(&app, &skill_id)
}

#[tauri::command]
pub fn skill_source_list(app: AppHandle, skill_id: String) -> Result<Vec<SkillSource>, String> {
    super::validate_required_id("skillId", &skill_id)?;
    store::list_skill_sources(&app, &skill_id)
}

#[tauri::command]
pub fn skill_import_record_list(
    app: AppHandle,
    limit: Option<i64>,
) -> Result<Vec<SkillImportRecord>, String> {
    store::list_skill_import_records(&app, limit)
}

#[tauri::command]
pub fn skill_create(app: AppHandle, input: CreateSkillInput) -> Result<Skill, String> {
    store::create_skill(&app, &input)
}

#[tauri::command]
pub fn skill_import(app: AppHandle, input: ImportSkillInput) -> Result<Skill, String> {
    store::import_skill(&app, &input)
}

#[tauri::command]
pub fn skill_delete(app: AppHandle, skill_id: String) -> Result<(), String> {
    super::validate_required_id("skillId", &skill_id)?;
    store::delete_skill(&app, &skill_id)
}

#[tauri::command]
pub fn skill_search(app: AppHandle, keyword: String) -> Result<Vec<Skill>, String> {
    store::search_skills(&app, &keyword)
}
