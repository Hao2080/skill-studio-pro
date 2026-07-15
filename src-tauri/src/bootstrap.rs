use tauri::Runtime;

use crate::{db, workspace};

pub fn initialize<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<(), String> {
    let snapshot = workspace::prepare()?;
    db::init_db(app)?;
    let report = crate::services::lifecycle_service::LifecycleService::new(
        std::path::PathBuf::from(snapshot.workspace_path),
    )?
    .recover_staging()?;
    if !report.errors.is_empty() {
        return Err(format!(
            "启动时 staging 恢复未全部完成: {}",
            report.errors.join(" | ")
        ));
    }
    Ok(())
}
