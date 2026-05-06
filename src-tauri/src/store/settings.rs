use crate::domain::AppSettings;
use crate::workspace;

pub fn get_app_settings<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<AppSettings, String> {
    let _ = app;
    let settings_path = workspace::settings_path()?;
    if !settings_path.exists() {
        return Ok(AppSettings::default());
    }

    let content =
        std::fs::read_to_string(&settings_path).map_err(|e| format!("读取设置失败: {}", e))?;
    serde_json::from_str(&content).map_err(|e| format!("解析设置失败: {}", e))
}

pub fn save_app_settings(app: &tauri::AppHandle, settings: &AppSettings) -> Result<(), String> {
    let _ = app;
    let settings_path = workspace::settings_path()?;
    if let Some(parent) = settings_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("创建设置目录失败: {}", e))?;
    }
    let content =
        serde_json::to_string_pretty(settings).map_err(|e| format!("序列化设置失败: {}", e))?;
    std::fs::write(&settings_path, content).map_err(|e| format!("写入设置失败: {}", e))
}
