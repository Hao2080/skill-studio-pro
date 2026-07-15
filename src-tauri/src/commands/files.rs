use tauri::AppHandle;

use crate::{domain::SkillFileNode, store};

#[tauri::command]
pub fn list_skill_files(app: AppHandle, skill_id: String) -> Result<SkillFileNode, String> {
    super::validate_required_id("skillId", &skill_id)?;
    store::list_skill_files(&app, &skill_id)
}

#[tauri::command]
pub fn read_skill_file(
    app: AppHandle,
    skill_id: String,
    relative_path: String,
) -> Result<String, String> {
    super::validate_required_id("skillId", &skill_id)?;
    store::read_skill_file(&app, &skill_id, &relative_path)
}

#[tauri::command]
pub fn open_file_in_editor(
    app: AppHandle,
    skill_id: String,
    relative_path: String,
) -> Result<(), String> {
    super::validate_required_id("skillId", &skill_id)?;
    store::open_file_in_editor(&app, &skill_id, &relative_path)
}

#[tauri::command]
pub fn write_skill_file(
    app: AppHandle,
    skill_id: String,
    relative_path: String,
    content: String,
) -> Result<(), String> {
    super::validate_required_id("skillId", &skill_id)?;
    let _ = (app, relative_path, content);
    Err("SAFE_EDIT_SESSION_REQUIRED: 请使用 lifecycle_text_file_save".to_string())
}
