use tauri::Runtime;

use crate::domain::{PullTeamVersionInput, SkillFileNode, TeamSkillVersion};
use crate::store::{copy_dir_recursive, get_conn};

pub fn pull_team_version<R: Runtime>(
    app: &tauri::AppHandle<R>,
    input: &PullTeamVersionInput,
) -> Result<String, String> {
    let conn = get_conn(app)?;

    let version: TeamSkillVersion = conn
        .query_row(
            "SELECT id, team_skill_id, version_number, snapshot_path, revision_hash, change_summary, merged_from_submission_id, merged_by, merged_at, is_recommended
             FROM team_skill_versions
             WHERE id = ?1",
            rusqlite::params![input.team_version_id],
            super::map_team_skill_version_row,
        )
        .map_err(|_| format!("团队版本不存在: {}", input.team_version_id))?;

    let team_skill_name: String = conn
        .query_row(
            "SELECT name FROM team_skills WHERE id = ?1",
            rusqlite::params![version.team_skill_id],
            |row| row.get(0),
        )
        .map_err(|_| "团队 Skill 不存在".to_string())?;

    let change_summary = format!(
        "从团队 v{} 拉取（{}）",
        version.version_number, team_skill_name
    );

    super::diff_support::validate_pull_mode(&input.mode, input.target_skill_id.as_deref())?;

    match input.mode.as_str() {
        "new_skill" => {
            let import_input = crate::domain::ImportSkillInput {
                folder_path: Some(version.snapshot_path.clone()),
                source_type: "team_library".to_string(),
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
                platform_name: None,
                skill_folder_name: None,
                display_name: Some(team_skill_name.clone()),
            };
            let skill = crate::store::import_skill(app, &import_input)?;
            Ok(skill.id)
        }
        "append_snapshot" => {
            let target_skill_id = input
                .target_skill_id
                .as_ref()
                .expect("validate_pull_mode 已校验 target_skill_id");

            let change_status = crate::store::detect_changes(app, target_skill_id)?;
            if change_status.has_changes {
                return Err("目标 Skill 当前有未快照改动，请先创建快照".to_string());
            }

            let work_dir = crate::store::skill_storage_dir(app, target_skill_id)?;

            if work_dir.exists() {
                std::fs::remove_dir_all(&work_dir).map_err(|e| format!("清理工作区失败: {}", e))?;
            }
            copy_dir_recursive(std::path::Path::new(&version.snapshot_path), &work_dir)?;

            let snapshot_input = crate::domain::CreateSnapshotInput {
                skill_id: target_skill_id.clone(),
                change_summary: Some(change_summary),
                source: "manual".to_string(),
            };
            let snapshot = crate::snapshot::create_snapshot(app, &snapshot_input)?;
            Ok(snapshot.skill_id)
        }
        _ => Err(format!("未知 mode: {}", input.mode)),
    }
}

pub fn list_team_version_files<R: Runtime>(
    app: &tauri::AppHandle<R>,
    version_id: &str,
) -> Result<SkillFileNode, String> {
    let conn = get_conn(app)?;
    let snapshot_path = super::sql::team_version_snapshot_path(&conn, version_id)?;
    let root = std::path::PathBuf::from(snapshot_path);

    if !root.exists() || !root.is_dir() {
        return Err("团队版本目录不存在".to_string());
    }

    super::file_browser::build_file_tree_from_dir(&root, &root)
}

pub fn read_team_version_file<R: Runtime>(
    app: &tauri::AppHandle<R>,
    version_id: &str,
    relative_path: &str,
) -> Result<String, String> {
    let conn = get_conn(app)?;
    let snapshot_path = super::sql::team_version_snapshot_path(&conn, version_id)?;
    let root = std::path::PathBuf::from(snapshot_path);
    let target = root.join(relative_path);

    if !target.exists() || !target.is_file() {
        return Err(format!("团队版本文件不存在: {}", relative_path));
    }

    std::fs::read_to_string(&target).map_err(|e| format!("读取团队版本文件失败: {}", e))
}

pub fn set_recommended_version<R: Runtime>(
    app: &tauri::AppHandle<R>,
    version_id: &str,
    actor: &str,
) -> Result<(), String> {
    let mut conn = get_conn(app)?;
    let (team_skill_id, team_id, team_skill_name, version_number): (String, String, String, i64) =
        conn.query_row(
            "SELECT tsv.team_skill_id, ts.team_id, ts.name, tsv.version_number
             FROM team_skill_versions tsv
             JOIN team_skills ts ON ts.id = tsv.team_skill_id
             WHERE tsv.id = ?1",
            rusqlite::params![version_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|_| "版本不存在".to_string())?;
    let actor = super::permissions::normalize_actor(Some(actor))?;
    super::permissions::ensure_team_active(&conn, &team_id)?;
    super::permissions::ensure_actor_can(
        &conn,
        &team_id,
        &actor,
        super::permissions::TeamPermission::Maintain,
    )?;
    let tx = conn
        .transaction()
        .map_err(|e| format!("开启事务失败: {}", e))?;
    tx.execute(
        "UPDATE team_skill_versions SET is_recommended = 0 WHERE team_skill_id = ?1",
        rusqlite::params![team_skill_id],
    )
    .map_err(|e| e.to_string())?;
    tx.execute(
        "UPDATE team_skill_versions SET is_recommended = 1 WHERE id = ?1",
        rusqlite::params![version_id],
    )
    .map_err(|e| e.to_string())?;
    super::activity::insert_team_activity_log(
        &tx,
        super::activity::TeamActivityDraft {
            team_id,
            actor,
            action: "set_recommended_version".to_string(),
            target_type: "team_version".to_string(),
            target_id: Some(version_id.to_string()),
            target_label: Some(team_skill_name),
            detail: Some(format!("v{}", version_number)),
            created_at: crate::store::now_ms(),
        },
    )?;
    tx.commit().map_err(|e| format!("提交事务失败: {}", e))?;
    Ok(())
}
