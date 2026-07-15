use tauri::Runtime;

use crate::{db, workspace};

pub fn initialize<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<(), String> {
    let _ = workspace::prepare()?;
    db::init_db(app)?;
    Ok(())
}
