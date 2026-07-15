use rusqlite::Connection;
use std::path::{Path, PathBuf};
use tauri::Runtime;

pub const CURRENT_SCHEMA_VERSION: i64 = 1;

#[path = "db/migrations.rs"]
mod migrations;
#[path = "db/schema.rs"]
mod schema;

/// 获取应用数据目录下的 skill-studio 子目录
pub fn get_data_dir<R: Runtime>(app: &tauri::AppHandle<R>) -> PathBuf {
    let _ = app;
    crate::workspace::workspace_root().expect("无法获取中央工作区目录")
}

pub fn init_db_at_path(data_dir: &Path) -> Result<Connection, String> {
    std::fs::create_dir_all(data_dir).map_err(|e| format!("创建数据目录失败: {}", e))?;

    let db_path = data_dir.join("metadata.db");
    let conn = Connection::open(&db_path).map_err(|e| format!("打开数据库失败: {}", e))?;

    configure_connection(&conn)?;
    schema::ensure_tables(&conn)?;
    migrations::apply(&conn)?;
    schema::ensure_indexes(&conn)?;

    Ok(conn)
}

/// 初始化数据库，创建目录、配置连接并确保 schema / migration 已完成
pub fn init_db<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<(), String> {
    let data_dir = get_data_dir(app);
    let conn = init_db_at_path(&data_dir)?;
    drop(conn);
    Ok(())
}

/// 获取所有表名（用于健康检查）
pub fn get_table_names(conn: &Connection) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .map_err(|e| e.to_string())?;
    let tables = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<String>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(tables)
}

pub fn get_schema_version(conn: &Connection) -> Result<i64, String> {
    conn.pragma_query_value(None, "user_version", |row| row.get(0))
        .map_err(|e| format!("读取 schema version 失败: {}", e))
}

fn configure_connection(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA foreign_keys=ON;
         PRAGMA busy_timeout=5000;",
    )
    .map_err(|e| format!("初始化数据库连接失败: {}", e))
}
