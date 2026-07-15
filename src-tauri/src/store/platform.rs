use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::OptionalExtension;
use tauri::Manager;
use uuid::Uuid;

use crate::domain::{
    is_system_snapshot_source, BatchImportFailure, BatchImportInput, BatchImportResult,
    ChangeStatus, CreateCustomPlatformInput, CreateSnapshotInput, ImportPlatformSkillInput,
    ImportSkillInput, PlatformConnection, PlatformGovernanceImpact, PlatformReleaseRecord,
    PlatformReleaseTarget, PlatformScanResult, PlatformSkillScanResult,
    PublishSnapshotToPlatformsInput, RemoveSkillFromPlatformsInput, SavePlatformConnectionInput,
    Skill, SkillPlatformReleaseOverview, SkillPlatformReleaseStatus, SkillSyncResult, SyncResult,
    TestPlatformPathInput, TestPlatformPathResult,
};
use crate::workspace;

use super::{copy_dir_recursive, get_conn, now_ms, slugify};

/// 各平台 skills 目录的相对路径定义
struct PlatformDef {
    name: &'static str,
    display_name: &'static str,
    skill_dir_rel: &'static str,
    detect_dir_rel: &'static str,
    supports_project_scope: bool,
    supports_symlink: bool,
    supports_copy: bool,
}

fn builtin_platform(
    name: &'static str,
    display_name: &'static str,
    skill_dir_rel: &'static str,
    detect_dir_rel: &'static str,
) -> PlatformDef {
    PlatformDef {
        name,
        display_name,
        skill_dir_rel,
        detect_dir_rel,
        supports_project_scope: true,
        supports_symlink: true,
        supports_copy: true,
    }
}

pub(super) fn project_relative_skill_dir(platform_name: &str) -> Option<&'static str> {
    platform_definitions()
        .into_iter()
        .find(|def| def.name == platform_name)
        .map(|def| def.skill_dir_rel)
}

fn platform_definitions() -> Vec<PlatformDef> {
    vec![
        builtin_platform("cursor", "Cursor", ".cursor/skills", ".cursor"),
        builtin_platform("claude", "Claude Code", ".claude/skills", ".claude"),
        builtin_platform("codex", "Codex", ".codex/skills", ".codex"),
        builtin_platform(
            "opencode",
            "OpenCode",
            ".config/opencode/skills",
            ".config/opencode",
        ),
        builtin_platform(
            "antigravity",
            "Antigravity",
            ".gemini/antigravity/skills",
            ".gemini/antigravity",
        ),
        builtin_platform("amp", "Amp", ".config/agents/skills", ".config/agents"),
        builtin_platform("kilo_code", "Kilo Code", ".kilocode/skills", ".kilocode"),
        builtin_platform("roo_code", "Roo Code", ".roo/skills", ".roo"),
        builtin_platform("goose", "Goose", ".config/goose/skills", ".config/goose"),
        builtin_platform("gemini", "Gemini CLI", ".gemini/skills", ".gemini"),
        builtin_platform(
            "github_copilot",
            "GitHub Copilot",
            ".copilot/skills",
            ".copilot",
        ),
        builtin_platform("openclaw", "OpenClaw", ".openclaw/skills", ".openclaw"),
        builtin_platform("droid", "Droid", ".factory/skills", ".factory"),
        builtin_platform(
            "windsurf",
            "Windsurf",
            ".codeium/windsurf/skills",
            ".codeium/windsurf",
        ),
        builtin_platform("trae", "TRAE IDE", ".trae/skills", ".trae"),
        builtin_platform("cline", "Cline", ".agents/skills", ".cline"),
        builtin_platform(
            "deepagents",
            "Deep Agents",
            ".deepagents/agent/skills",
            ".deepagents",
        ),
        builtin_platform(
            "firebender",
            "Firebender",
            ".firebender/skills",
            ".firebender",
        ),
        builtin_platform("kimi", "Kimi Code CLI", ".config/agents/skills", ".kimi"),
        builtin_platform("replit", "Replit", ".config/agents/skills", ".replit"),
        builtin_platform("warp", "Warp", ".agents/skills", ".warp"),
        builtin_platform("augment", "Augment", ".augment/skills", ".augment"),
        builtin_platform("bob", "IBM Bob", ".bob/skills", ".bob"),
        builtin_platform("codebuddy", "CodeBuddy", ".codebuddy/skills", ".codebuddy"),
        builtin_platform(
            "command_code",
            "Command Code",
            ".commandcode/skills",
            ".commandcode",
        ),
        builtin_platform("continue", "Continue", ".continue/skills", ".continue"),
        builtin_platform(
            "cortex",
            "Cortex Code",
            ".snowflake/cortex/skills",
            ".snowflake/cortex",
        ),
        builtin_platform("crush", "Crush", ".config/crush/skills", ".config/crush"),
        builtin_platform("iflow", "iFlow CLI", ".iflow/skills", ".iflow"),
        builtin_platform("junie", "Junie", ".junie/skills", ".junie"),
        builtin_platform("kiro", "Kiro CLI", ".kiro/skills", ".kiro"),
        builtin_platform("kode", "Kode", ".kode/skills", ".kode"),
        builtin_platform("mcpjam", "MCPJam", ".mcpjam/skills", ".mcpjam"),
        builtin_platform("mistral_vibe", "Mistral Vibe", ".vibe/skills", ".vibe"),
        builtin_platform("mux", "Mux", ".mux/skills", ".mux"),
        builtin_platform("neovate", "Neovate", ".neovate/skills", ".neovate"),
        builtin_platform("openhands", "OpenHands", ".openhands/skills", ".openhands"),
        builtin_platform("pi", "Pi", ".pi/agent/skills", ".pi/agent"),
        builtin_platform("pochi", "Pochi", ".pochi/skills", ".pochi"),
        builtin_platform("qoder", "Qoder", ".qoder/skills", ".qoder"),
        builtin_platform("qwen_code", "Qwen Code", ".qwen/skills", ".qwen"),
        builtin_platform("trae_cn", "TRAE CN", ".trae-cn/skills", ".trae-cn"),
        builtin_platform("zencoder", "Zencoder", ".zencoder/skills", ".zencoder"),
        builtin_platform("adal", "AdaL", ".adal/skills", ".adal"),
        builtin_platform("hermes", "Hermes Agent", ".hermes/skills", ".hermes"),
    ]
}

#[derive(Clone)]
struct PlatformConnectionRow {
    id: String,
    platform_name: String,
    display_name: String,
    platform_type: String,
    detected: bool,
    enabled: bool,
    skills_dir: Option<String>,
    detect_dir: Option<String>,
    sync_mode: String,
    supports_project_scope: bool,
    supports_symlink: bool,
    supports_copy: bool,
    last_sync_at: Option<i64>,
}

fn normalize_sync_mode(value: Option<&str>) -> String {
    match value.unwrap_or("copy").trim().to_lowercase().as_str() {
        "symlink" => "symlink".to_string(),
        _ => "copy".to_string(),
    }
}

fn normalize_optional_path(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|path| !path.is_empty())
        .map(|path| path.replace('\\', "/"))
}

fn normalize_platform_key(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() {
                ch
            } else if matches!(ch, '-' | ' ' | '.') {
                '_'
            } else {
                '\0'
            }
        })
        .filter(|ch| *ch != '\0')
        .collect::<String>()
}

fn default_platform_dir(home: &Path, def: &PlatformDef) -> String {
    home.join(def.skill_dir_rel)
        .to_string_lossy()
        .replace('\\', "/")
}

fn default_platform_detect_dir(home: &Path, def: &PlatformDef) -> String {
    home.join(def.detect_dir_rel)
        .to_string_lossy()
        .replace('\\', "/")
}

fn resolve_builtin_detect_path(
    existing_skills_dir: Option<&str>,
    default_skills_dir: &str,
    default_detect_dir: &str,
) -> String {
    let normalized_existing = normalize_optional_path(existing_skills_dir);

    match normalized_existing {
        Some(path) if path != default_skills_dir => path,
        _ => default_detect_dir.to_string(),
    }
}

fn load_platform_connection_row(
    conn: &rusqlite::Connection,
    platform_name: &str,
) -> Result<Option<PlatformConnectionRow>, String> {
    conn.query_row(
        "SELECT id, platform_name, display_name, platform_type, detected, enabled, skills_dir,
                detect_dir, sync_mode, supports_project_scope, supports_symlink, supports_copy,
                last_sync_at
         FROM platform_connections
         WHERE platform_name = ?1",
        rusqlite::params![platform_name],
        |row| {
            Ok(PlatformConnectionRow {
                id: row.get(0)?,
                platform_name: row.get(1)?,
                display_name: row.get(2)?,
                platform_type: row.get(3)?,
                detected: row.get::<_, i64>(4)? != 0,
                enabled: row.get::<_, i64>(5)? != 0,
                skills_dir: row.get(6)?,
                detect_dir: row.get(7)?,
                sync_mode: row.get(8)?,
                supports_project_scope: row.get::<_, i64>(9)? != 0,
                supports_symlink: row.get::<_, i64>(10)? != 0,
                supports_copy: row.get::<_, i64>(11)? != 0,
                last_sync_at: row.get(12)?,
            })
        },
    )
    .optional()
    .map_err(|e| format!("读取平台连接失败: {}", e))
}

fn load_custom_platform_rows(
    conn: &rusqlite::Connection,
) -> Result<Vec<PlatformConnectionRow>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, platform_name, display_name, platform_type, detected, enabled, skills_dir,
                    detect_dir, sync_mode, supports_project_scope, supports_symlink, supports_copy,
                    last_sync_at
             FROM platform_connections
             WHERE platform_type = 'custom'
             ORDER BY display_name COLLATE NOCASE ASC, platform_name COLLATE NOCASE ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(PlatformConnectionRow {
                id: row.get(0)?,
                platform_name: row.get(1)?,
                display_name: row.get(2)?,
                platform_type: row.get(3)?,
                detected: row.get::<_, i64>(4)? != 0,
                enabled: row.get::<_, i64>(5)? != 0,
                skills_dir: row.get(6)?,
                detect_dir: row.get(7)?,
                sync_mode: row.get(8)?,
                supports_project_scope: row.get::<_, i64>(9)? != 0,
                supports_symlink: row.get::<_, i64>(10)? != 0,
                supports_copy: row.get::<_, i64>(11)? != 0,
                last_sync_at: row.get(12)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

fn upsert_platform_connection(
    conn: &rusqlite::Connection,
    row: &PlatformConnectionRow,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO platform_connections (
            id,
            platform_name,
            display_name,
            platform_type,
            detected,
            enabled,
            skills_dir,
            detect_dir,
            sync_mode,
            supports_project_scope,
            supports_symlink,
            supports_copy,
            last_sync_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
         ON CONFLICT(platform_name) DO UPDATE SET
            id = excluded.id,
            display_name = excluded.display_name,
            platform_type = excluded.platform_type,
            detected = excluded.detected,
            enabled = excluded.enabled,
            skills_dir = excluded.skills_dir,
            detect_dir = excluded.detect_dir,
            sync_mode = excluded.sync_mode,
            supports_project_scope = excluded.supports_project_scope,
            supports_symlink = excluded.supports_symlink,
            supports_copy = excluded.supports_copy,
            last_sync_at = COALESCE(excluded.last_sync_at, platform_connections.last_sync_at)",
        rusqlite::params![
            &row.id,
            &row.platform_name,
            &row.display_name,
            &row.platform_type,
            row.detected as i64,
            row.enabled as i64,
            row.skills_dir.as_deref(),
            row.detect_dir.as_deref(),
            &row.sync_mode,
            row.supports_project_scope as i64,
            row.supports_symlink as i64,
            row.supports_copy as i64,
            row.last_sync_at,
        ],
    )
    .map_err(|e| format!("写入平台连接失败: {}", e))?;

    Ok(())
}

fn to_platform_connection(row: PlatformConnectionRow) -> PlatformConnection {
    PlatformConnection {
        id: row.id,
        platform_name: row.platform_name,
        display_name: row.display_name,
        platform_type: row.platform_type,
        detected: row.detected,
        enabled: row.enabled,
        skills_dir: row.skills_dir,
        detect_dir: row.detect_dir,
        sync_mode: row.sync_mode,
        supports_project_scope: row.supports_project_scope,
        supports_symlink: row.supports_symlink,
        supports_copy: row.supports_copy,
        last_sync_at: row.last_sync_at,
    }
}

fn detect_path(skills_dir: Option<&str>) -> bool {
    skills_dir
        .map(Path::new)
        .map(|path| path.is_dir())
        .unwrap_or(false)
}

pub fn detect_platforms<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<PlatformScanResult, String> {
    let home = app
        .path()
        .home_dir()
        .map_err(|e| format!("获取主目录失败: {}", e))?;

    let conn = get_conn(app)?;
    let defs = platform_definitions();
    let mut platforms = Vec::new();

    for def in defs {
        let existing = load_platform_connection_row(&conn, def.name)?;
        let default_skills_dir = default_platform_dir(&home, &def);
        let default_detect_dir = default_platform_detect_dir(&home, &def);
        let skills_dir = existing
            .as_ref()
            .and_then(|row| row.skills_dir.clone())
            .or_else(|| Some(default_skills_dir.clone()));
        let detect_path_target = resolve_builtin_detect_path(
            existing.as_ref().and_then(|row| row.skills_dir.as_deref()),
            &default_skills_dir,
            &default_detect_dir,
        );
        let detected = detect_path(Some(detect_path_target.as_str()));
        let row = PlatformConnectionRow {
            id: def.name.to_string(),
            platform_name: def.name.to_string(),
            display_name: def.display_name.to_string(),
            platform_type: "built_in".to_string(),
            detected,
            enabled: existing.as_ref().map(|row| row.enabled).unwrap_or(detected),
            skills_dir,
            detect_dir: Some(detect_path_target),
            sync_mode: normalize_sync_mode(existing.as_ref().map(|row| row.sync_mode.as_str())),
            supports_project_scope: def.supports_project_scope,
            supports_symlink: def.supports_symlink,
            supports_copy: def.supports_copy,
            last_sync_at: existing.and_then(|row| row.last_sync_at),
        };
        upsert_platform_connection(&conn, &row)?;
        platforms.push(to_platform_connection(row));
    }

    for custom_row in load_custom_platform_rows(&conn)? {
        let detected = detect_path(custom_row.skills_dir.as_deref());
        let updated = PlatformConnectionRow {
            detected,
            detect_dir: custom_row.skills_dir.clone(),
            ..custom_row
        };
        upsert_platform_connection(&conn, &updated)?;
        platforms.push(to_platform_connection(updated));
    }

    platforms.sort_by(|left, right| {
        left.display_name
            .to_lowercase()
            .cmp(&right.display_name.to_lowercase())
            .then_with(|| {
                left.platform_name
                    .to_lowercase()
                    .cmp(&right.platform_name.to_lowercase())
            })
    });

    Ok(PlatformScanResult { platforms })
}

pub fn save_platform_connection<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    input: &SavePlatformConnectionInput,
) -> Result<PlatformConnection, String> {
    let mut conn = get_conn(app)?;
    let home = app
        .path()
        .home_dir()
        .map_err(|e| format!("获取主目录失败: {}", e))?;
    let existing = load_platform_connection_row(&conn, &input.platform_name)?
        .ok_or_else(|| format!("平台不存在: {}", input.platform_name))?;

    let fallback_dir = if existing.platform_type == "built_in" {
        platform_definitions()
            .into_iter()
            .find(|def| def.name == input.platform_name)
            .map(|def| default_platform_dir(&home, &def))
    } else {
        None
    };
    let skills_dir =
        normalize_optional_path(input.skills_dir.as_deref()).or_else(|| fallback_dir.clone());
    let detected = if existing.platform_type == "built_in" {
        match platform_definitions()
            .into_iter()
            .find(|def| def.name == existing.platform_name.as_str())
        {
            Some(def) => {
                let default_skills_dir = default_platform_dir(&home, &def);
                let default_detect_dir = default_platform_detect_dir(&home, &def);
                let detect_path_target = resolve_builtin_detect_path(
                    skills_dir.as_deref(),
                    &default_skills_dir,
                    &default_detect_dir,
                );
                detect_path(Some(detect_path_target.as_str()))
            }
            None => detect_path(skills_dir.as_deref()),
        }
    } else {
        detect_path(skills_dir.as_deref())
    };
    let detect_dir = if existing.platform_type == "built_in" {
        match platform_definitions()
            .into_iter()
            .find(|def| def.name == existing.platform_name.as_str())
        {
            Some(def) => {
                let default_skills_dir = default_platform_dir(&home, &def);
                let default_detect_dir = default_platform_detect_dir(&home, &def);
                Some(resolve_builtin_detect_path(
                    skills_dir.as_deref(),
                    &default_skills_dir,
                    &default_detect_dir,
                ))
            }
            None => skills_dir.clone(),
        }
    } else {
        skills_dir.clone()
    };
    let existing_enabled = existing.enabled;
    let previous_row = existing.clone();
    let row = PlatformConnectionRow {
        id: existing.id,
        platform_name: existing.platform_name,
        display_name: existing.display_name,
        platform_type: existing.platform_type,
        detected,
        enabled: input.enabled,
        skills_dir,
        detect_dir,
        sync_mode: normalize_sync_mode(
            input
                .sync_mode
                .as_deref()
                .or(Some(existing.sync_mode.as_str())),
        ),
        supports_project_scope: existing.supports_project_scope,
        supports_symlink: existing.supports_symlink,
        supports_copy: existing.supports_copy,
        last_sync_at: existing.last_sync_at,
    };

    let tx = conn
        .transaction()
        .map_err(|e| format!("开启平台保存事务失败: {}", e))?;
    let now = now_ms();

    if existing_enabled && !row.enabled {
        let releases = load_managed_releases_for_platform(&tx, &row.platform_name)?;
        for release in &releases {
            let parked = park_platform_release(&previous_row, release)?;
            if parked {
                insert_release_log(
                    &tx,
                    &release.skill_id,
                    &row.platform_name,
                    Some(row.display_name.as_str()),
                    Some(&release.snapshot_id),
                    Some(release.snapshot_number),
                    release.change_summary.as_deref(),
                    "park",
                    "success",
                    None,
                    now,
                )?;
            }
        }
        super::project::apply_registry_platform_state(&tx, &row.platform_name, false)?;
    } else if !existing_enabled && row.enabled {
        let releases = load_managed_releases_for_platform(&tx, &row.platform_name)?;
        for release in &releases {
            let restored = restore_platform_release(&tx, &row, release)?;
            if restored {
                insert_release_log(
                    &tx,
                    &release.skill_id,
                    &row.platform_name,
                    Some(row.display_name.as_str()),
                    Some(&release.snapshot_id),
                    Some(release.snapshot_number),
                    release.change_summary.as_deref(),
                    "restore",
                    "success",
                    None,
                    now,
                )?;
            }
        }
        super::project::apply_registry_platform_state(&tx, &row.platform_name, true)?;
    }

    upsert_platform_connection(&tx, &row)?;
    tx.commit()
        .map_err(|e| format!("提交平台保存事务失败: {}", e))?;
    Ok(to_platform_connection(row))
}

pub fn get_platform_governance_impact<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    platform_name: &str,
) -> Result<PlatformGovernanceImpact, String> {
    let conn = get_conn(app)?;
    let platform = load_platform_connection_row(&conn, platform_name)?
        .ok_or_else(|| format!("平台不存在: {}", platform_name))?;

    let global_release_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM platform_release_targets WHERE platform_name = ?1",
            rusqlite::params![platform_name],
            |row| row.get(0),
        )
        .map_err(|e| format!("统计平台全局发布失败: {}", e))?;
    let project_connection_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM project_platform_connections WHERE platform_name = ?1",
            rusqlite::params![platform_name],
            |row| row.get(0),
        )
        .map_err(|e| format!("统计项目平台接入失败: {}", e))?;
    let enabled_project_connection_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM project_platform_connections WHERE platform_name = ?1 AND enabled = 1",
            rusqlite::params![platform_name],
            |row| row.get(0),
        )
        .map_err(|e| format!("统计启用中的项目平台接入失败: {}", e))?;
    let assignment_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM project_skill_assignments WHERE platform_name = ?1",
            rusqlite::params![platform_name],
            |row| row.get(0),
        )
        .map_err(|e| format!("统计项目绑定失败: {}", e))?;
    let enabled_assignment_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM project_skill_assignments WHERE platform_name = ?1 AND enabled = 1",
            rusqlite::params![platform_name],
            |row| row.get(0),
        )
        .map_err(|e| format!("统计启用中的项目绑定失败: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT p.name
             FROM project_platform_connections pc
             INNER JOIN projects p ON p.id = pc.project_id
             WHERE pc.platform_name = ?1
             ORDER BY p.updated_at DESC, p.name COLLATE NOCASE ASC
             LIMIT 5",
        )
        .map_err(|e| format!("准备受影响项目查询失败: {}", e))?;
    let affected_projects = stmt
        .query_map(rusqlite::params![platform_name], |row| {
            row.get::<_, String>(0)
        })
        .map_err(|e| format!("查询受影响项目失败: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("读取受影响项目失败: {}", e))?;

    Ok(PlatformGovernanceImpact {
        platform_name: platform.platform_name,
        display_name: Some(platform.display_name),
        global_release_count,
        project_connection_count,
        enabled_project_connection_count,
        assignment_count,
        enabled_assignment_count,
        affected_projects,
    })
}

pub fn create_custom_platform<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    input: &CreateCustomPlatformInput,
) -> Result<PlatformConnection, String> {
    let conn = get_conn(app)?;
    let platform_name = normalize_platform_key(&input.platform_name);
    if platform_name.is_empty() {
        return Err("平台标识不能为空".to_string());
    }

    let display_name = input.display_name.trim();
    if display_name.is_empty() {
        return Err("平台名称不能为空".to_string());
    }

    let skills_dir = normalize_optional_path(Some(&input.skills_dir))
        .ok_or_else(|| "平台目录不能为空".to_string())?;
    if load_platform_connection_row(&conn, &platform_name)?.is_some() {
        return Err(format!("平台 '{}' 已存在", platform_name));
    }

    let row = PlatformConnectionRow {
        id: platform_name.clone(),
        platform_name,
        display_name: display_name.to_string(),
        platform_type: "custom".to_string(),
        detected: detect_path(Some(&skills_dir)),
        enabled: true,
        skills_dir: Some(skills_dir.clone()),
        detect_dir: Some(skills_dir),
        sync_mode: normalize_sync_mode(input.sync_mode.as_deref()),
        supports_project_scope: input.supports_project_scope,
        supports_symlink: input.supports_symlink,
        supports_copy: input.supports_copy,
        last_sync_at: None,
    };

    upsert_platform_connection(&conn, &row)?;
    Ok(to_platform_connection(row))
}

pub fn delete_custom_platform<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    platform_name: &str,
) -> Result<(), String> {
    let mut conn = get_conn(app)?;
    let existing = load_platform_connection_row(&conn, platform_name)?
        .ok_or_else(|| format!("平台不存在: {}", platform_name))?;

    if existing.platform_type != "custom" {
        return Err("仅支持删除自定义平台".to_string());
    }

    let tx = conn
        .transaction()
        .map_err(|e| format!("开启平台删除事务失败: {}", e))?;

    tx.execute(
        "DELETE FROM platform_release_targets WHERE platform_name = ?1",
        rusqlite::params![platform_name],
    )
    .map_err(|e| format!("清理平台承接状态失败: {}", e))?;

    let affected = tx
        .execute(
            "DELETE FROM platform_connections WHERE platform_name = ?1 AND platform_type = 'custom'",
            rusqlite::params![platform_name],
        )
        .map_err(|e| format!("删除平台失败: {}", e))?;

    if affected == 0 {
        return Err("平台不存在或不是自定义平台".to_string());
    }

    tx.commit()
        .map_err(|e| format!("提交平台删除失败: {}", e))?;
    Ok(())
}

pub fn test_platform_path<R: tauri::Runtime>(
    _app: &tauri::AppHandle<R>,
    input: &TestPlatformPathInput,
) -> Result<TestPlatformPathResult, String> {
    let normalized_path = normalize_optional_path(Some(&input.skills_dir))
        .ok_or_else(|| "平台目录不能为空".to_string())?;
    let path = Path::new(&normalized_path);
    let exists = path.exists();
    let is_directory = path.is_dir();
    let message = if exists && is_directory {
        "目录可用，可作为技能目录接入".to_string()
    } else if exists {
        "路径存在，但不是目录".to_string()
    } else {
        "目录不存在，可先创建后再接入".to_string()
    };

    Ok(TestPlatformPathResult {
        ok: exists && is_directory,
        normalized_path,
        exists,
        is_directory,
        message,
    })
}

pub fn detect_changes<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    skill_id: &str,
) -> Result<ChangeStatus, String> {
    let conn = get_conn(app)?;

    let slug: String = conn
        .query_row(
            "SELECT slug FROM skills WHERE id = ?1",
            rusqlite::params![skill_id],
            |row| row.get(0),
        )
        .map_err(|_| format!("skill 不存在: {}", skill_id))?;

    let latest_snapshot_path: Option<String> = conn
        .query_row(
            "SELECT snapshot_path FROM skill_snapshots
             WHERE skill_id = ?1 ORDER BY snapshot_number DESC LIMIT 1",
            rusqlite::params![skill_id],
            |row| row.get(0),
        )
        .ok();

    let work_dir = super::skill_dir(app, &slug);
    if !work_dir.exists() {
        return Ok(ChangeStatus {
            has_changes: false,
            added_files: vec![],
            deleted_files: vec![],
            modified_files: vec![],
        });
    }

    let snapshot_path = match latest_snapshot_path {
        Some(path) => path,
        None => {
            let files = collect_all_relative_files(&work_dir);
            return Ok(ChangeStatus {
                has_changes: !files.is_empty(),
                added_files: files,
                deleted_files: vec![],
                modified_files: vec![],
            });
        }
    };

    let snap_dir = Path::new(&snapshot_path);
    if !snap_dir.exists() {
        let files = collect_all_relative_files(&work_dir);
        return Ok(ChangeStatus {
            has_changes: !files.is_empty(),
            added_files: files,
            deleted_files: vec![],
            modified_files: vec![],
        });
    }

    let work_files = collect_files_with_meta(&work_dir);
    let snap_files = collect_files_with_meta(snap_dir);

    let work_set: HashSet<&String> = work_files.keys().collect();
    let snap_set: HashSet<&String> = snap_files.keys().collect();

    let mut added_files: Vec<String> = work_set
        .difference(&snap_set)
        .map(|path| (*path).clone())
        .collect();
    let mut deleted_files: Vec<String> = snap_set
        .difference(&work_set)
        .map(|path| (*path).clone())
        .collect();
    let mut modified_files = Vec::new();

    for rel_path in work_set.intersection(&snap_set) {
        let (work_size, _) = work_files[*rel_path];
        let (snap_size, _) = snap_files[*rel_path];

        if work_size != snap_size {
            modified_files.push((*rel_path).clone());
            continue;
        }

        let work_abs = work_dir.join(rel_path);
        let snap_abs = snap_dir.join(rel_path);
        if fs::read(&work_abs).ok() != fs::read(&snap_abs).ok() {
            modified_files.push((*rel_path).clone());
        }
    }

    added_files.sort();
    deleted_files.sort();
    modified_files.sort();

    let has_changes =
        !added_files.is_empty() || !deleted_files.is_empty() || !modified_files.is_empty();

    Ok(ChangeStatus {
        has_changes,
        added_files,
        deleted_files,
        modified_files,
    })
}

fn collect_all_relative_files(dir: &Path) -> Vec<String> {
    let mut result = Vec::new();
    collect_relative_file_list(dir, dir, &mut result);
    result.sort();
    result
}

fn collect_files_with_meta(dir: &Path) -> HashMap<String, (u64, u64)> {
    let mut files = HashMap::new();
    collect_files_meta_recursive(dir, dir, &mut files);
    files
}

fn collect_relative_file_list(base: &Path, current: &Path, result: &mut Vec<String>) {
    if let Ok(entries) = fs::read_dir(current) {
        for entry in entries.filter_map(|entry| entry.ok()) {
            let path = entry.path();
            if path.is_dir() {
                collect_relative_file_list(base, &path, result);
            } else if path.is_file() {
                if let Ok(rel) = path.strip_prefix(base) {
                    result.push(rel.to_string_lossy().replace('\\', "/"));
                }
            }
        }
    }
}

fn collect_files_meta_recursive(
    base: &Path,
    current: &Path,
    files: &mut HashMap<String, (u64, u64)>,
) {
    if let Ok(entries) = fs::read_dir(current) {
        for entry in entries.filter_map(|entry| entry.ok()) {
            let path = entry.path();
            if path.is_dir() {
                collect_files_meta_recursive(base, &path, files);
            } else if path.is_file() {
                if let Ok(rel) = path.strip_prefix(base) {
                    let rel_str = rel.to_string_lossy().replace('\\', "/");
                    let meta = fs::metadata(&path).ok();
                    let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
                    let mtime = meta
                        .and_then(|m| m.modified().ok())
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs())
                        .unwrap_or(0);
                    files.insert(rel_str, (size, mtime));
                }
            }
        }
    }
}

fn has_skill_entry_file(dir: &Path) -> bool {
    fs::read_dir(dir)
        .map(|entries| {
            entries.filter_map(|entry| entry.ok()).any(|entry| {
                entry.path().is_file()
                    && entry
                        .file_name()
                        .to_string_lossy()
                        .eq_ignore_ascii_case("skill.md")
            })
        })
        .unwrap_or(false)
}

fn should_skip_platform_dir(path: &Path) -> bool {
    matches!(
        path.file_name().and_then(|name| name.to_str()),
        Some(".git" | "node_modules" | "target" | "__pycache__")
    )
}

fn collect_nested_skill_dirs(base: &Path, current: &Path, found: &mut Vec<String>) {
    if should_skip_platform_dir(current) || !current.is_dir() {
        return;
    }

    if has_skill_entry_file(current) {
        if let Ok(rel) = current.strip_prefix(base) {
            let rel_str = rel.to_string_lossy().replace('\\', "/");
            if !rel_str.is_empty() {
                found.push(rel_str);
            }
        }
        return;
    }

    let Ok(entries) = fs::read_dir(current) else {
        return;
    };

    let mut child_dirs: Vec<PathBuf> = entries
        .filter_map(|entry| entry.ok().map(|entry| entry.path()))
        .filter(|path| path.is_dir())
        .collect();
    child_dirs.sort();

    for child in child_dirs {
        collect_nested_skill_dirs(base, &child, found);
    }
}

fn collect_platform_skill_dirs(platform_dir: &Path) -> Result<Vec<String>, String> {
    let entries = fs::read_dir(platform_dir).map_err(|e| format!("读取平台目录失败: {}", e))?;
    let mut top_level_dirs: Vec<PathBuf> = entries
        .filter_map(|entry| entry.ok().map(|entry| entry.path()))
        .filter(|path| path.is_dir())
        .collect();
    top_level_dirs.sort();

    let mut found = Vec::new();
    for dir in top_level_dirs {
        collect_nested_skill_dirs(platform_dir, &dir, &mut found);
    }

    found.sort();
    found.dedup();
    Ok(found)
}

pub fn scan_platform_skills<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    platform_name: &str,
) -> Result<PlatformSkillScanResult, String> {
    let conn = get_conn(app)?;

    let skills_dir: String = conn
        .query_row(
            "SELECT skills_dir FROM platform_connections
             WHERE platform_name = ?1 AND detected = 1 AND enabled = 1",
            rusqlite::params![platform_name],
            |row| row.get(0),
        )
        .map_err(|_| format!("平台 '{}' 未检测到或未启用", platform_name))?;

    let platform_dir = Path::new(&skills_dir);
    if !platform_dir.is_dir() {
        return Err(format!("平台目录不存在: {}", skills_dir));
    }

    let found = collect_platform_skill_dirs(platform_dir)?;

    let mut stmt = conn
        .prepare("SELECT source_path FROM skills WHERE source_path IS NOT NULL")
        .map_err(|e| e.to_string())?;
    let managed_paths: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .filter_map(|result| result.ok())
        .collect();

    let mut already_managed = Vec::new();
    let mut new_skills = Vec::new();

    for folder_name in &found {
        let folder_path = platform_dir.join(folder_name);
        let full_path = folder_path.to_string_lossy().to_string();
        let is_managed = managed_paths.iter().any(|path| {
            let managed = path.replace('\\', "/");
            let current = full_path.replace('\\', "/");
            managed == current
        });

        if is_managed {
            already_managed.push(folder_name.clone());
        } else {
            new_skills.push(folder_name.clone());
        }
    }

    Ok(PlatformSkillScanResult {
        found,
        already_managed,
        new_skills,
        missing_entry_file: Vec::new(),
    })
}

pub fn import_platform_skill<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    input: &ImportPlatformSkillInput,
) -> Result<Skill, String> {
    let conn = get_conn(app)?;

    let skills_dir: String = conn
        .query_row(
            "SELECT skills_dir FROM platform_connections
             WHERE platform_name = ?1 AND detected = 1 AND enabled = 1",
            rusqlite::params![input.platform_name],
            |row| row.get(0),
        )
        .map_err(|_| format!("平台 '{}' 未检测到或未启用", input.platform_name))?;

    let source_path = Path::new(&skills_dir).join(&input.skill_folder_name);
    if !source_path.is_dir() {
        return Err(format!("skill 目录不存在: {}", source_path.display()));
    }

    let import_input = ImportSkillInput {
        folder_path: Some(source_path.to_string_lossy().to_string()),
        source_type: "platform_scan".to_string(),
        git_url: None,
        repo_subdir: None,
        market_item_id: None,
        external_source: None,
        external_skill_id: None,
        external_installs: None,
        external_market_source: None,
        external_package_name: None,
        external_package_version: None,
        external_owner_handle: None,
        platform_name: Some(input.platform_name.clone()),
        skill_folder_name: Some(input.skill_folder_name.clone()),
        display_name: None,
    };
    super::import_skill(app, &import_input)
}

pub fn batch_import_platform_skills<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    input: &BatchImportInput,
) -> Result<BatchImportResult, String> {
    let mut successes = Vec::new();
    let mut failures = Vec::new();

    for folder_name in &input.skill_folder_names {
        let single_input = ImportPlatformSkillInput {
            platform_name: input.platform_name.clone(),
            skill_folder_name: folder_name.clone(),
        };

        match import_platform_skill(app, &single_input) {
            Ok(_) => successes.push(folder_name.clone()),
            Err(error) => failures.push(BatchImportFailure {
                folder_name: folder_name.clone(),
                error,
            }),
        }
    }

    Ok(BatchImportResult {
        successes,
        failures,
    })
}

fn sync_to_target(source: &Path, target: &Path) -> Result<(), String> {
    if target.exists() {
        fs::remove_dir_all(target).map_err(|e| format!("清空目标目录失败: {}", e))?;
    }

    copy_dir_recursive(source, target)
}

#[derive(Clone)]
struct ManagedPlatformRelease {
    skill_id: String,
    slug: String,
    snapshot_id: String,
    snapshot_number: i64,
    change_summary: Option<String>,
}

#[derive(Clone)]
struct PlatformConnectionState {
    platform_name: String,
    display_name: String,
    detected: bool,
    enabled: bool,
    skills_dir: Option<String>,
}

#[derive(Clone)]
struct SnapshotReleaseSource {
    skill_id: String,
    slug: String,
    snapshot_id: String,
    snapshot_number: i64,
    snapshot_path: String,
    change_summary: Option<String>,
    source: String,
}

fn platform_scope_name(platform_name: &str) -> String {
    let slug = slugify(platform_name);
    if slug.is_empty() {
        "platform".to_string()
    } else {
        slug
    }
}

fn platform_artifacts_root(platform_name: &str) -> Result<PathBuf, String> {
    Ok(workspace::workspace_root()?
        .join("platforms")
        .join(platform_scope_name(platform_name))
        .join("artifacts"))
}

fn parked_release_dir(platform_name: &str, skill_id: &str) -> Result<PathBuf, String> {
    Ok(platform_artifacts_root(platform_name)?
        .join("parked")
        .join(skill_id)
        .join("current"))
}

fn remove_dir_if_exists(path: &Path) -> Result<(), String> {
    if path.exists() {
        fs::remove_dir_all(path).map_err(|e| format!("删除目录失败 {}: {}", path.display(), e))?;
    }
    Ok(())
}

fn move_dir_copy_then_remove(source: &Path, target: &Path) -> Result<(), String> {
    remove_dir_if_exists(target)?;
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("创建目录失败 {}: {}", parent.display(), e))?;
    }
    if let Err(error) = copy_dir_recursive(source, target) {
        let _ = remove_dir_if_exists(target);
        return Err(error);
    }
    fs::remove_dir_all(source).map_err(|e| format!("删除目录失败 {}: {}", source.display(), e))
}

fn park_platform_release(
    platform: &PlatformConnectionRow,
    release: &ManagedPlatformRelease,
) -> Result<bool, String> {
    let Some(skills_dir) = platform.skills_dir.as_deref() else {
        return Ok(false);
    };
    let active = Path::new(skills_dir).join(&release.slug);
    let parked = parked_release_dir(&platform.platform_name, &release.skill_id)?;

    if !active.exists() {
        return Ok(false);
    }
    if !active.is_dir() {
        return Err(format!("平台目录不是目录，无法停放: {}", active.display()));
    }

    move_dir_copy_then_remove(&active, &parked)?;
    Ok(true)
}

fn restore_platform_release(
    conn: &rusqlite::Connection,
    platform: &PlatformConnectionRow,
    release: &ManagedPlatformRelease,
) -> Result<bool, String> {
    let Some(skills_dir) = platform.skills_dir.as_deref() else {
        return Ok(false);
    };
    let active = Path::new(skills_dir).join(&release.slug);
    let parked = parked_release_dir(&platform.platform_name, &release.skill_id)?;

    if active.exists() {
        if parked.exists() {
            return Err(format!(
                "活跃目录已被占用，无法恢复停放副本: {}",
                active.display()
            ));
        }
        return Ok(false);
    }

    if parked.is_dir() {
        move_dir_copy_then_remove(&parked, &active)?;
        return Ok(true);
    }

    let source = load_snapshot_release_source(conn, &release.skill_id, &release.snapshot_id)?;
    let source_dir = Path::new(&source.snapshot_path);
    if !source_dir.is_dir() {
        return Err(format!("快照目录不存在: {}", source.snapshot_path));
    }
    sync_to_target(source_dir, &active)?;
    Ok(true)
}

fn normalize_platform_names(platform_names: &[String]) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut normalized = Vec::new();

    for platform_name in platform_names {
        let value = platform_name.trim();
        if value.is_empty() || !seen.insert(value.to_string()) {
            continue;
        }

        normalized.push(value.to_string());
    }

    normalized
}

fn load_platform_connection_states(
    conn: &rusqlite::Connection,
) -> Result<Vec<PlatformConnectionState>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT platform_name, display_name, detected, enabled, skills_dir
             FROM platform_connections
             ORDER BY display_name COLLATE NOCASE ASC, platform_name COLLATE NOCASE ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(PlatformConnectionState {
                platform_name: row.get(0)?,
                display_name: row.get(1)?,
                detected: row.get::<_, i64>(2)? != 0,
                enabled: row.get::<_, i64>(3)? != 0,
                skills_dir: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

fn resolve_requested_platforms(
    conn: &rusqlite::Connection,
    platform_names: &[String],
) -> Result<Vec<PlatformConnectionState>, String> {
    let requested = normalize_platform_names(platform_names);
    if requested.is_empty() {
        return Err("至少选择一个平台".to_string());
    }

    let mut available = load_platform_connection_states(conn)?
        .into_iter()
        .map(|platform| (platform.platform_name.clone(), platform))
        .collect::<HashMap<_, _>>();

    let mut missing = Vec::new();
    let mut resolved = Vec::new();

    for platform_name in requested {
        match available.remove(&platform_name) {
            Some(platform) => resolved.push(platform),
            None => missing.push(platform_name),
        }
    }

    if !missing.is_empty() {
        return Err(format!("平台不存在: {}", missing.join("、")));
    }

    Ok(resolved)
}

fn load_snapshot_release_source(
    conn: &rusqlite::Connection,
    skill_id: &str,
    snapshot_id: &str,
) -> Result<SnapshotReleaseSource, String> {
    conn.query_row(
        "SELECT s.id, s.slug, ss.id, ss.snapshot_number, ss.snapshot_path, ss.change_summary, ss.source
         FROM skill_snapshots ss
         INNER JOIN skills s ON s.id = ss.skill_id
         WHERE s.id = ?1 AND ss.id = ?2",
        rusqlite::params![skill_id, snapshot_id],
        |row| {
            Ok(SnapshotReleaseSource {
                skill_id: row.get(0)?,
                slug: row.get(1)?,
                snapshot_id: row.get(2)?,
                snapshot_number: row.get(3)?,
                snapshot_path: row.get(4)?,
                change_summary: row.get(5)?,
                source: row.get(6)?,
            })
        },
    )
    .map_err(|_| format!("快照 '{}' 不属于当前技能", snapshot_id))
}

fn load_active_snapshot_id(
    conn: &rusqlite::Connection,
    skill_id: &str,
) -> Result<Option<String>, String> {
    conn.query_row(
        "SELECT id FROM skill_snapshots WHERE skill_id = ?1 AND is_active = 1 LIMIT 1",
        rusqlite::params![skill_id],
        |row| row.get(0),
    )
    .optional()
    .map_err(|e| e.to_string())
}

fn load_skill_identity(
    conn: &rusqlite::Connection,
    skill_id: &str,
) -> Result<(String, String), String> {
    conn.query_row(
        "SELECT name, slug FROM skills WHERE id = ?1",
        rusqlite::params![skill_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )
    .map_err(|_| format!("skill 不存在: {}", skill_id))
}

fn infer_publish_action(
    current_target: Option<&PlatformReleaseTarget>,
    snapshot_id: &str,
) -> &'static str {
    match current_target {
        Some(target) if target.snapshot_id == snapshot_id => "republish",
        Some(_) => "switch",
        None => "publish",
    }
}

fn update_platform_last_sync_at(
    conn: &rusqlite::Connection,
    platform_name: &str,
    synced_at: i64,
) -> Result<(), String> {
    conn.execute(
        "UPDATE platform_connections SET last_sync_at = ?1 WHERE platform_name = ?2",
        rusqlite::params![synced_at, platform_name],
    )
    .map_err(|e| format!("更新平台最近发布时间失败: {}", e))?;

    Ok(())
}

fn upsert_release_target(
    conn: &rusqlite::Connection,
    skill_id: &str,
    platform_name: &str,
    snapshot_id: &str,
    released_at: i64,
) -> Result<(), String> {
    let target_id = format!("{}:{}", skill_id, platform_name);
    conn.execute(
        "INSERT INTO platform_release_targets (
            id,
            skill_id,
            platform_name,
            snapshot_id,
            released_at,
            created_at,
            updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(skill_id, platform_name) DO UPDATE SET
            snapshot_id = excluded.snapshot_id,
            released_at = excluded.released_at,
            updated_at = excluded.updated_at",
        rusqlite::params![
            target_id,
            skill_id,
            platform_name,
            snapshot_id,
            released_at,
            released_at,
            released_at,
        ],
    )
    .map_err(|e| format!("写入平台承接状态失败: {}", e))?;

    Ok(())
}

fn clear_release_target(
    conn: &rusqlite::Connection,
    skill_id: &str,
    platform_name: &str,
) -> Result<(), String> {
    conn.execute(
        "DELETE FROM platform_release_targets
         WHERE skill_id = ?1 AND platform_name = ?2",
        rusqlite::params![skill_id, platform_name],
    )
    .map_err(|e| format!("清理平台承接状态失败: {}", e))?;

    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn insert_release_log(
    conn: &rusqlite::Connection,
    skill_id: &str,
    platform_name: &str,
    display_name: Option<&str>,
    snapshot_id: Option<&str>,
    snapshot_number: Option<i64>,
    change_summary: Option<&str>,
    action: &str,
    status: &str,
    error_message: Option<String>,
    created_at: i64,
) -> Result<PlatformReleaseRecord, String> {
    let log_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO sync_logs (
            id,
            skill_id,
            platform_name,
            snapshot_id,
            action,
            status,
            error_message,
            synced_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            log_id,
            skill_id,
            platform_name,
            snapshot_id,
            action,
            status,
            error_message,
            created_at,
        ],
    )
    .map_err(|e| format!("写入发布记录失败: {}", e))?;

    Ok(PlatformReleaseRecord {
        id: log_id,
        platform_name: platform_name.to_string(),
        display_name: display_name.map(str::to_string),
        snapshot_id: snapshot_id.map(str::to_string),
        snapshot_number,
        change_summary: change_summary.map(str::to_string),
        action: action.to_string(),
        status: status.to_string(),
        error_message,
        created_at,
    })
}

fn load_release_targets(
    conn: &rusqlite::Connection,
    skill_id: &str,
) -> Result<HashMap<String, PlatformReleaseTarget>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT prt.platform_name, pc.display_name, prt.snapshot_id, ss.snapshot_number,
                    ss.change_summary, prt.released_at
             FROM platform_release_targets prt
             INNER JOIN skill_snapshots ss ON ss.id = prt.snapshot_id
             LEFT JOIN platform_connections pc ON pc.platform_name = prt.platform_name
             WHERE prt.skill_id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let targets = stmt
        .query_map(rusqlite::params![skill_id], |row| {
            Ok(PlatformReleaseTarget {
                platform_name: row.get(0)?,
                display_name: row.get(1)?,
                snapshot_id: row.get(2)?,
                snapshot_number: row.get(3)?,
                change_summary: row.get(4)?,
                released_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(targets
        .into_iter()
        .map(|target| (target.platform_name.clone(), target))
        .collect())
}

fn load_managed_releases_for_platform(
    conn: &rusqlite::Connection,
    platform_name: &str,
) -> Result<Vec<ManagedPlatformRelease>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT prt.skill_id, s.slug, prt.snapshot_id, ss.snapshot_number, ss.change_summary
             FROM platform_release_targets prt
             INNER JOIN skills s ON s.id = prt.skill_id
             INNER JOIN skill_snapshots ss ON ss.id = prt.snapshot_id
             WHERE prt.platform_name = ?1
             ORDER BY s.slug COLLATE NOCASE ASC",
        )
        .map_err(|e| format!("准备平台托管副本查询失败: {}", e))?;

    let rows = stmt
        .query_map(rusqlite::params![platform_name], |row| {
            Ok(ManagedPlatformRelease {
                skill_id: row.get(0)?,
                slug: row.get(1)?,
                snapshot_id: row.get(2)?,
                snapshot_number: row.get(3)?,
                change_summary: row.get(4)?,
            })
        })
        .map_err(|e| format!("查询平台托管副本失败: {}", e))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("读取平台托管副本失败: {}", e))
}

fn load_recent_release_records(
    conn: &rusqlite::Connection,
    skill_id: &str,
    limit: usize,
) -> Result<Vec<PlatformReleaseRecord>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT sl.id, sl.platform_name, pc.display_name, sl.snapshot_id, ss.snapshot_number,
                    ss.change_summary, sl.action, sl.status, sl.error_message, sl.synced_at
             FROM sync_logs sl
             LEFT JOIN skill_snapshots ss ON ss.id = sl.snapshot_id
             LEFT JOIN platform_connections pc ON pc.platform_name = sl.platform_name
             WHERE sl.skill_id = ?1
             ORDER BY sl.synced_at DESC, sl.id DESC
             LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![skill_id, limit as i64], |row| {
            Ok(PlatformReleaseRecord {
                id: row.get(0)?,
                platform_name: row.get(1)?,
                display_name: row.get(2)?,
                snapshot_id: row.get(3)?,
                snapshot_number: row.get(4)?,
                change_summary: row.get(5)?,
                action: row.get(6)?,
                status: row.get(7)?,
                error_message: row.get(8)?,
                created_at: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn publish_snapshot_to_platforms<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    input: &PublishSnapshotToPlatformsInput,
) -> Result<Vec<PlatformReleaseRecord>, String> {
    let conn = get_conn(app)?;
    let source = load_snapshot_release_source(&conn, &input.skill_id, &input.snapshot_id)?;
    if is_system_snapshot_source(&source.source) {
        return Err("系统恢复点不能直接发布到平台".to_string());
    }
    drop(conn);

    maybe_capture_publish_restore_point(app, &input.skill_id, &input.snapshot_id)?;

    let conn = get_conn(app)?;
    let source_dir = Path::new(&source.snapshot_path);

    if !source_dir.exists() {
        return Err(format!("快照目录不存在: {}", source.snapshot_path));
    }

    let platforms = resolve_requested_platforms(&conn, &input.platform_names)?;
    let current_targets = load_release_targets(&conn, &input.skill_id)?;
    let now = now_ms();
    let mut records = Vec::with_capacity(platforms.len());

    for platform in platforms {
        let action = infer_publish_action(
            current_targets.get(&platform.platform_name),
            &source.snapshot_id,
        );
        let (status, error_message) = if !platform.detected {
            (
                "failed".to_string(),
                Some("平台目录未检测到，无法发布".to_string()),
            )
        } else if !platform.enabled {
            (
                "failed".to_string(),
                Some("平台尚未启用，无法发布".to_string()),
            )
        } else if let Some(skills_dir) = platform.skills_dir.as_deref() {
            let target = Path::new(skills_dir).join(&source.slug);
            match sync_to_target(source_dir, &target) {
                Ok(()) => {
                    upsert_release_target(
                        &conn,
                        &source.skill_id,
                        &platform.platform_name,
                        &source.snapshot_id,
                        now,
                    )?;
                    update_platform_last_sync_at(&conn, &platform.platform_name, now)?;
                    ("success".to_string(), None)
                }
                Err(error) => ("failed".to_string(), Some(error)),
            }
        } else {
            (
                "failed".to_string(),
                Some("平台目录缺失，无法发布".to_string()),
            )
        };

        let record = insert_release_log(
            &conn,
            &source.skill_id,
            &platform.platform_name,
            Some(platform.display_name.as_str()),
            Some(&source.snapshot_id),
            Some(source.snapshot_number),
            source.change_summary.as_deref(),
            action,
            &status,
            error_message,
            now,
        )?;
        records.push(record);
    }

    Ok(records)
}

fn maybe_capture_publish_restore_point<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    skill_id: &str,
    snapshot_id: &str,
) -> Result<(), String> {
    let settings = super::get_app_settings(app)?;
    if !settings.snapshot_before_publish {
        return Ok(());
    }

    let conn = get_conn(app)?;
    let active_snapshot_id = load_active_snapshot_id(&conn, skill_id)?;
    drop(conn);

    if active_snapshot_id.as_deref() != Some(snapshot_id) {
        return Ok(());
    }

    let change_status = detect_changes(app, skill_id)?;
    if !change_status.has_changes {
        return Ok(());
    }

    crate::snapshot::create_snapshot(
        app,
        &CreateSnapshotInput {
            skill_id: skill_id.to_string(),
            change_summary: Some("发布前自动创建恢复点".to_string()),
            source: "system".to_string(),
        },
    )?;

    Ok(())
}

pub fn remove_skill_from_platforms<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    input: &RemoveSkillFromPlatformsInput,
) -> Result<Vec<PlatformReleaseRecord>, String> {
    let conn = get_conn(app)?;
    let (_, slug) = load_skill_identity(&conn, &input.skill_id)?;
    let platforms = resolve_requested_platforms(&conn, &input.platform_names)?;
    let current_targets = load_release_targets(&conn, &input.skill_id)?;
    let now = now_ms();
    let mut records = Vec::with_capacity(platforms.len());

    for platform in platforms {
        let current_target = current_targets.get(&platform.platform_name);
        let (status, error_message) = match platform.skills_dir.as_deref() {
            Some(skills_dir) => {
                let target = Path::new(skills_dir).join(&slug);
                let parked = parked_release_dir(&platform.platform_name, &input.skill_id)?;
                let remove_result = if target.exists() {
                    fs::remove_dir_all(&target).map_err(|e| format!("移除平台目录失败: {}", e))
                } else {
                    Ok(())
                }
                .and_then(|_| remove_dir_if_exists(&parked));
                match remove_result {
                    Ok(()) => {
                        clear_release_target(&conn, &input.skill_id, &platform.platform_name)?;
                        update_platform_last_sync_at(&conn, &platform.platform_name, now)?;
                        ("success".to_string(), None)
                    }
                    Err(error) => ("failed".to_string(), Some(error)),
                }
            }
            None => {
                let parked = parked_release_dir(&platform.platform_name, &input.skill_id)?;
                remove_dir_if_exists(&parked)?;
                clear_release_target(&conn, &input.skill_id, &platform.platform_name)?;
                ("success".to_string(), None)
            }
        };

        let record = insert_release_log(
            &conn,
            &input.skill_id,
            &platform.platform_name,
            Some(platform.display_name.as_str()),
            current_target.map(|target| target.snapshot_id.as_str()),
            current_target.map(|target| target.snapshot_number),
            current_target.and_then(|target| target.change_summary.as_deref()),
            "remove",
            &status,
            error_message,
            now,
        )?;
        records.push(record);
    }

    Ok(records)
}

pub fn get_skill_platform_releases<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    skill_id: &str,
) -> Result<SkillPlatformReleaseOverview, String> {
    let conn = get_conn(app)?;
    let _ = load_skill_identity(&conn, skill_id)?;
    let targets = load_release_targets(&conn, skill_id)?;
    let recent_records = load_recent_release_records(&conn, skill_id, 16)?;
    let mut latest_record_by_platform = HashMap::new();

    for record in &recent_records {
        latest_record_by_platform
            .entry(record.platform_name.clone())
            .or_insert_with(|| record.clone());
    }

    let mut releases_by_platform = load_platform_connection_states(&conn)?
        .into_iter()
        .map(|platform| {
            let platform_name = platform.platform_name.clone();
            (
                platform_name.clone(),
                SkillPlatformReleaseStatus {
                    platform_name,
                    display_name: Some(platform.display_name.clone()),
                    detected: platform.detected,
                    enabled: platform.enabled,
                    skills_dir: platform.skills_dir,
                    current_target: targets.get(&platform.platform_name).cloned(),
                    last_record: latest_record_by_platform
                        .get(&platform.platform_name)
                        .cloned(),
                },
            )
        })
        .collect::<HashMap<_, _>>();

    for (platform_name, target) in &targets {
        releases_by_platform
            .entry(platform_name.clone())
            .or_insert_with(|| SkillPlatformReleaseStatus {
                platform_name: platform_name.clone(),
                display_name: target.display_name.clone(),
                detected: false,
                enabled: false,
                skills_dir: None,
                current_target: Some(target.clone()),
                last_record: latest_record_by_platform.get(platform_name).cloned(),
            });
    }

    for (platform_name, record) in &latest_record_by_platform {
        releases_by_platform
            .entry(platform_name.clone())
            .or_insert_with(|| SkillPlatformReleaseStatus {
                platform_name: platform_name.clone(),
                display_name: record.display_name.clone(),
                detected: false,
                enabled: false,
                skills_dir: None,
                current_target: None,
                last_record: Some(record.clone()),
            });
    }

    let mut releases = releases_by_platform.into_values().collect::<Vec<_>>();
    releases.sort_by(|left, right| {
        left.display_name
            .clone()
            .unwrap_or_else(|| left.platform_name.clone())
            .to_lowercase()
            .cmp(
                &right
                    .display_name
                    .clone()
                    .unwrap_or_else(|| right.platform_name.clone())
                    .to_lowercase(),
            )
            .then_with(|| {
                left.platform_name
                    .to_lowercase()
                    .cmp(&right.platform_name.to_lowercase())
            })
    });

    Ok(SkillPlatformReleaseOverview {
        releases,
        recent_records,
    })
}

pub fn sync_skill_to_platforms<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    skill_id: &str,
) -> Result<Vec<SyncResult>, String> {
    let conn = get_conn(app)?;
    let (skill_name, _) = load_skill_identity(&conn, skill_id)?;
    let Some(snapshot_id) = load_active_snapshot_id(&conn, skill_id)? else {
        return Err(format!(
            "skill '{}' 没有当前生效版本，请先设置一个快照为当前生效版本",
            skill_name
        ));
    };

    let platform_names = load_platform_connection_states(&conn)?
        .into_iter()
        .filter(|platform| platform.enabled && platform.detected && platform.skills_dir.is_some())
        .map(|platform| platform.platform_name)
        .collect::<Vec<_>>();

    if platform_names.is_empty() {
        return Err("没有已启用的平台，请先在设置中启用".to_string());
    }

    drop(conn);

    publish_snapshot_to_platforms(
        app,
        &PublishSnapshotToPlatformsInput {
            skill_id: skill_id.to_string(),
            snapshot_id,
            platform_names,
        },
    )
    .map(|records| {
        records
            .into_iter()
            .map(|record| SyncResult {
                platform: record.platform_name,
                status: record.status,
                error: record.error_message,
            })
            .collect()
    })
}

pub fn sync_all_to_platforms<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<Vec<SkillSyncResult>, String> {
    let conn = get_conn(app)?;

    let mut stmt = conn
        .prepare(
            "SELECT DISTINCT s.id, s.name FROM skills s
             INNER JOIN skill_snapshots ss ON s.id = ss.skill_id AND ss.is_active = 1
             WHERE s.is_archived = 0",
        )
        .map_err(|e| e.to_string())?;

    let skills: Vec<(String, String)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|result| result.ok())
        .collect();

    let mut results = Vec::new();
    for (skill_id, skill_name) in skills {
        match sync_skill_to_platforms(app, &skill_id) {
            Ok(platform_results) => results.push(SkillSyncResult {
                skill_name,
                platform_results,
            }),
            Err(error) => results.push(SkillSyncResult {
                skill_name,
                platform_results: vec![SyncResult {
                    platform: "all".to_string(),
                    status: "failed".to_string(),
                    error: Some(error),
                }],
            }),
        }
    }

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::{collect_platform_skill_dirs, platform_definitions, resolve_builtin_detect_path};

    fn temp_dir(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir()
            .join("skill-studio-pro-tests")
            .join(format!("{}-{}", name, uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).expect("创建测试目录失败");
        dir
    }

    fn write_file(path: &std::path::Path, content: &str) {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).expect("创建父目录失败");
        }
        std::fs::write(path, content).expect("写入测试文件失败");
    }

    #[test]
    fn collects_nested_platform_skill_roots() {
        let root = temp_dir("nested-platform-scan");
        write_file(&root.join("ui-ux-pro-max").join("SKILL.md"), "# UI/UX");
        write_file(
            &root.join(".system").join("openai-docs").join("SKILL.md"),
            "# OpenAI Docs",
        );
        write_file(
            &root.join(".system").join("imagegen").join("SKILL.md"),
            "# Imagegen",
        );
        write_file(&root.join("misc").join("README.md"), "not a skill");

        let found = collect_platform_skill_dirs(&root).expect("扫描目录失败");

        assert_eq!(
            found,
            vec![
                ".system/imagegen".to_string(),
                ".system/openai-docs".to_string(),
                "ui-ux-pro-max".to_string(),
            ]
        );
    }

    #[test]
    fn builtin_detect_path_prefers_detect_root_for_default_path() {
        let resolved = resolve_builtin_detect_path(
            Some("C:/Users/demo/.cursor/skills"),
            "C:/Users/demo/.cursor/skills",
            "C:/Users/demo/.cursor",
        );

        assert_eq!(resolved, "C:/Users/demo/.cursor");
    }

    #[test]
    fn builtin_detect_path_prefers_custom_skills_dir_when_overridden() {
        let resolved = resolve_builtin_detect_path(
            Some("D:/workspace/custom-skills"),
            "C:/Users/demo/.cursor/skills",
            "C:/Users/demo/.cursor",
        );

        assert_eq!(resolved, "D:/workspace/custom-skills");
    }

    #[test]
    fn builtin_platform_definitions_cover_reference_platforms() {
        let names = platform_definitions()
            .into_iter()
            .map(|platform| platform.name)
            .collect::<Vec<_>>();

        assert!(names.len() >= 40);
        assert!(names.contains(&"cursor"));
        assert!(names.contains(&"github_copilot"));
        assert!(names.contains(&"qwen_code"));
        assert!(names.contains(&"hermes"));
    }
}
