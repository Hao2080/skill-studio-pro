use tauri::AppHandle;

use crate::{domain::AppSettings, store};

#[tauri::command]
pub fn get_app_settings(app: AppHandle) -> Result<AppSettings, String> {
    store::get_app_settings(&app)
}

#[tauri::command]
pub fn save_app_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    store::save_app_settings(&app, &settings)
}
