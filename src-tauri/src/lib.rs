#![cfg_attr(test, allow(dead_code, unused_imports, unused_macros))]

pub mod ai;
mod bootstrap;
mod commands;
pub mod credentials;
pub mod db;
pub mod diff;
pub mod domain;
pub mod inventory;
pub mod market;
pub mod origin;
pub mod platform;
pub mod services;
pub mod snapshot;
pub mod store;
pub mod team;
pub mod workspace;

#[cfg(test)]
pub fn run() {}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[cfg(not(test))]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            bootstrap::initialize(app.handle()).map_err(std::io::Error::other)?;
            Ok(())
        })
        .invoke_handler(commands::command_handlers!())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
