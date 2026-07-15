use tauri::Runtime;
use uuid::Uuid;

use crate::domain::{
    MergeSubmissionInput, RejectSubmissionInput, SubmitToTeamInput, TeamSkillVersion,
    TeamSubmission,
};
use crate::store::{compute_directory_revision, copy_dir_recursive, get_conn, now_ms, slugify};

struct SubmissionDeliveryContext {
    team_name: String,
    source_snapshot_number: i64,
    source_change_summary: Option<String>,
    team_skill_name: Option<String>,
}

fn load_submission_delivery_context(
    conn: &rusqlite::Connection,
    submission: &TeamSubmission,
    team_skill_id: Option<&str>,
) -> Result<SubmissionDeliveryContext, String> {
    let (source_snapshot_number, source_change_summary) =
        super::delivery::load_snapshot_delivery_details(conn, &submission.source_snapshot_id)?;

    Ok(SubmissionDeliveryContext {
        team_name: super::delivery::load_team_name(conn, &submission.team_id)?,
        source_snapshot_number,
        source_change_summary,
        team_skill_name: super::delivery::load_team_skill_name(conn, team_skill_id)?,
    })
}

#[allow(clippy::too_many_arguments)]
fn insert_activity(
    conn: &rusqlite::Connection,
    team_id: &str,
    actor: &str,
    action: &str,
    target_type: &str,
    target_id: Option<&str>,
    target_label: Option<&str>,
    detail: Option<&str>,
    created_at: i64,
) -> Result<(), String> {
    super::activity::insert_team_activity_log(
        conn,
        super::activity::TeamActivityDraft {
            team_id: team_id.to_string(),
            actor: actor.to_string(),
            action: action.to_string(),
            target_type: target_type.to_string(),
            target_id: target_id.map(str::to_string),
            target_label: target_label.map(str::to_string),
            detail: detail.map(str::to_string),
            created_at,
        },
    )
    .map(|_| ())
}

pub fn submit_to_team<R: Runtime>(
    app: &tauri::AppHandle<R>,
    input: &SubmitToTeamInput,
) -> Result<TeamSubmission, String> {
    let mut conn = get_conn(app)?;
    let submitter = super::permissions::normalize_actor(Some(&input.submitter))?;
    super::permissions::ensure_team_active(&conn, &input.team_id)?;
    super::permissions::ensure_actor_can(
        &conn,
        &input.team_id,
        &submitter,
        super::permissions::TeamPermission::Submit,
    )?;
    let (snapshot_path, source_skill_name): (String, String) = conn
        .query_row(
            "SELECT ss.snapshot_path, s.name
             FROM skill_snapshots ss
             JOIN skills s ON s.id = ss.skill_id
             WHERE ss.id = ?1 AND s.id = ?2",
            rusqlite::params![input.source_snapshot_id, input.source_skill_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| format!("快照不存在: {}", input.source_snapshot_id))?;
    let base_version = input
        .team_skill_id
        .as_deref()
        .map(|team_skill_id| super::sql::latest_team_version_ref(&conn, team_skill_id))
        .transpose()?
        .flatten();

    let id = Uuid::new_v4().to_string();
    let now = now_ms();

    let staging = super::paths::team_staging_path(app, &id);
    copy_dir_recursive(std::path::Path::new(&snapshot_path), &staging)
        .map_err(|e| format!("复制快照到 staging 失败: {}", e))?;

    let tx = conn
        .transaction()
        .map_err(|e| format!("开启事务失败: {}", e))?;
    let db_result = (|| -> Result<(), String> {
        tx.execute(
            "INSERT INTO team_submissions (id, team_id, team_skill_id, base_team_version_id, base_revision_hash, source_skill_id, source_snapshot_id, submitter, submit_message, submitted_at, status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'pending')",
            rusqlite::params![
                id,
                input.team_id,
                input.team_skill_id,
                base_version.as_ref().map(|version| version.0.as_str()),
                base_version.as_ref().map(|version| version.1.as_str()),
                input.source_skill_id,
                input.source_snapshot_id,
                submitter,
                input.submit_message,
                now
            ],
        )
        .map_err(|e| format!("创建提交记录失败: {}", e))?;

        insert_activity(
            &tx,
            &input.team_id,
            &submitter,
            "submit",
            "submission",
            Some(&id),
            Some(&source_skill_name),
            input.submit_message.as_deref(),
            now,
        )?;

        Ok(())
    })();

    if let Err(error) = db_result {
        drop(tx);
        let _ = std::fs::remove_dir_all(&staging);
        return Err(error);
    }
    tx.commit().map_err(|e| format!("提交事务失败: {}", e))?;

    Ok(TeamSubmission {
        id,
        team_id: input.team_id.clone(),
        team_skill_id: input.team_skill_id.clone(),
        base_team_version_id: base_version.as_ref().map(|version| version.0.clone()),
        base_revision_hash: base_version.as_ref().map(|version| version.1.clone()),
        source_skill_id: input.source_skill_id.clone(),
        source_snapshot_id: input.source_snapshot_id.clone(),
        submitter,
        submit_message: input.submit_message.clone(),
        submitted_at: now,
        status: "pending".to_string(),
        resolved_at: None,
    })
}

pub fn list_team_submissions<R: Runtime>(
    app: &tauri::AppHandle<R>,
    team_id: &str,
) -> Result<Vec<TeamSubmission>, String> {
    let conn = get_conn(app)?;
    let mut stmt = conn
        .prepare(super::sql::list_team_submissions_sql())
        .map_err(|e| e.to_string())?;
    let submissions = stmt
        .query_map(rusqlite::params![team_id], super::sql::map_team_submission)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(submissions)
}

pub fn merge_submission<R: Runtime>(
    app: &tauri::AppHandle<R>,
    input: &MergeSubmissionInput,
) -> Result<TeamSkillVersion, String> {
    let conn = get_conn(app)?;

    let submission: TeamSubmission = conn
        .query_row(
            "SELECT id, team_id, team_skill_id, base_team_version_id, base_revision_hash, source_skill_id, source_snapshot_id, submitter, submit_message, submitted_at, status, resolved_at
             FROM team_submissions
             WHERE id = ?1",
            rusqlite::params![input.submission_id],
            super::sql::map_team_submission,
        )
        .map_err(|_| format!("提交记录不存在: {}", input.submission_id))?;

    if submission.status != "pending" {
        return Err(format!("提交状态为 {}，无法合并", submission.status));
    }
    let merged_by = super::permissions::normalize_actor(Some(&input.merged_by))?;
    super::permissions::ensure_team_active(&conn, &submission.team_id)?;
    super::permissions::ensure_actor_can(
        &conn,
        &submission.team_id,
        &merged_by,
        super::permissions::TeamPermission::Review,
    )?;

    let (team_skill_id, team_skill_name) = if let Some(team_skill_id) = &submission.team_skill_id {
        (
            team_skill_id.clone(),
            super::delivery::load_team_skill_name(&conn, Some(team_skill_id))?,
        )
    } else {
        let skill_name: String = conn
            .query_row(
                "SELECT name FROM skills WHERE id = ?1",
                rusqlite::params![submission.source_skill_id],
                |row| row.get(0),
            )
            .map_err(|_| "来源 Skill 不存在".to_string())?;
        let skill_slug = slugify(&skill_name);
        let existing: Option<(String, String)> = conn
            .query_row(
                "SELECT id, name FROM team_skills WHERE team_id = ?1 AND slug = ?2",
                rusqlite::params![submission.team_id, skill_slug],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .ok();
        if let Some((team_skill_id, team_skill_name)) = existing {
            (team_skill_id, Some(team_skill_name))
        } else {
            let team_skill_id = Uuid::new_v4().to_string();
            let now = now_ms();
            conn.execute(
                "INSERT INTO team_skills (id, team_id, name, slug, description, created_at)
                 VALUES (?1, ?2, ?3, ?4, NULL, ?5)",
                rusqlite::params![
                    team_skill_id,
                    submission.team_id,
                    skill_name,
                    skill_slug,
                    now
                ],
            )
            .map_err(|e| format!("创建团队 Skill 失败: {}", e))?;
            (team_skill_id, Some(skill_name))
        }
    };
    let delivery_context =
        load_submission_delivery_context(&conn, &submission, Some(&team_skill_id))?;
    let activity_target_label = team_skill_name
        .clone()
        .or_else(|| delivery_context.team_skill_name.clone())
        .unwrap_or_else(|| team_skill_id.clone());

    let next_num: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(version_number), 0) + 1 FROM team_skill_versions WHERE team_skill_id = ?1",
            rusqlite::params![team_skill_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let version_id = Uuid::new_v4().to_string();
    let now = now_ms();
    let staging = super::paths::team_staging_path(app, &input.submission_id);
    let target = super::paths::team_version_path(app, &team_skill_id, &version_id);
    let resolution_mode = input.resolution_mode.as_deref().unwrap_or("auto");
    let merge_analysis = super::diffs::analyze_submission_merge(app, &conn, &submission)?;

    if let Err(error) = super::diffs::materialize_submission_merge(
        &merge_analysis,
        &target,
        resolution_mode,
        &input.file_resolutions,
    ) {
        let _ = std::fs::remove_dir_all(&target);
        return Err(error);
    }

    let revision_hash =
        compute_directory_revision(&target).map_err(|e| format!("计算哈希失败: {}", e))?;
    let snapshot_path = target.to_string_lossy().to_string();

    let mut conn = conn;
    let tx = conn
        .transaction()
        .map_err(|e| format!("开启事务失败: {}", e))?;
    let db_result = (|| -> Result<(), String> {
        tx.execute(
            "INSERT INTO team_skill_versions (id, team_skill_id, version_number, snapshot_path, revision_hash, change_summary, merged_from_submission_id, merged_by, merged_at, is_recommended)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0)",
            rusqlite::params![
                version_id,
                team_skill_id,
                next_num,
                snapshot_path,
                revision_hash,
                input.change_summary,
                input.submission_id,
                merged_by,
                now
            ],
        )
        .map_err(|e| format!("写入版本记录失败: {}", e))?;

        tx.execute(
            "UPDATE team_submissions
             SET status = 'merged', resolved_at = ?1, team_skill_id = ?2
             WHERE id = ?3",
            rusqlite::params![now, team_skill_id, input.submission_id],
        )
        .map_err(|e| format!("更新提交状态失败: {}", e))?;

        super::delivery::upsert_team_delivery_target(
            &tx,
            &submission.team_id,
            &submission.source_skill_id,
            &submission.source_snapshot_id,
            Some(&team_skill_id),
            Some(&version_id),
            now,
        )?;

        super::delivery::insert_team_delivery_log(
            &tx,
            super::delivery::TeamDeliveryLogDraft {
                team_id: submission.team_id.clone(),
                team_name: delivery_context.team_name.clone(),
                source_skill_id: submission.source_skill_id.clone(),
                source_snapshot_id: Some(submission.source_snapshot_id.clone()),
                source_snapshot_number: Some(delivery_context.source_snapshot_number),
                change_summary: delivery_context.source_change_summary.clone(),
                team_skill_id: Some(team_skill_id.clone()),
                team_skill_name: team_skill_name
                    .clone()
                    .or_else(|| delivery_context.team_skill_name.clone()),
                team_version_id: Some(version_id.clone()),
                team_version_number: Some(next_num),
                submission_id: Some(input.submission_id.clone()),
                action: "merge".to_string(),
                status: "success".to_string(),
                actor: Some(merged_by.clone()),
                note: input.change_summary.clone(),
                created_at: now,
            },
        )?;

        let activity_detail = input
            .change_summary
            .clone()
            .unwrap_or_else(|| format!("v{}", next_num));
        insert_activity(
            &tx,
            &submission.team_id,
            &merged_by,
            "merge_submission",
            "team_version",
            Some(&version_id),
            Some(&activity_target_label),
            Some(&activity_detail),
            now,
        )?;

        Ok(())
    })();

    match db_result {
        Ok(()) => {
            tx.commit().map_err(|e| format!("提交事务失败: {}", e))?;
            let _ = std::fs::remove_dir_all(&staging);
        }
        Err(error) => {
            drop(tx);
            let _ = std::fs::remove_dir_all(&target);
            return Err(error);
        }
    }

    Ok(TeamSkillVersion {
        id: version_id,
        team_skill_id,
        version_number: next_num,
        snapshot_path,
        revision_hash,
        change_summary: input.change_summary.clone(),
        merged_from_submission_id: Some(input.submission_id.clone()),
        merged_by: Some(merged_by),
        merged_at: now,
        is_recommended: false,
    })
}

pub fn reject_submission<R: Runtime>(
    app: &tauri::AppHandle<R>,
    input: &RejectSubmissionInput,
) -> Result<(), String> {
    let mut conn = get_conn(app)?;
    let submission: TeamSubmission = conn
        .query_row(
            "SELECT id, team_id, team_skill_id, base_team_version_id, base_revision_hash, source_skill_id, source_snapshot_id, submitter, submit_message, submitted_at, status, resolved_at
             FROM team_submissions
             WHERE id = ?1",
            rusqlite::params![input.submission_id],
            super::sql::map_team_submission,
        )
        .map_err(|_| format!("提交记录不存在: {}", input.submission_id))?;

    if submission.status != "pending" {
        return Err(format!("提交状态为 {}，无法拒绝", submission.status));
    }
    let actor = super::permissions::normalize_actor(Some(&input.actor))?;
    super::permissions::ensure_team_active(&conn, &submission.team_id)?;
    super::permissions::ensure_actor_can(
        &conn,
        &submission.team_id,
        &actor,
        super::permissions::TeamPermission::Review,
    )?;

    let now = now_ms();
    let delivery_context =
        load_submission_delivery_context(&conn, &submission, submission.team_skill_id.as_deref())?;
    let activity_target_label = delivery_context
        .team_skill_name
        .clone()
        .unwrap_or_else(|| submission.source_skill_id.clone());
    let reject_note = "团队已拒绝当前提交".to_string();

    let tx = conn
        .transaction()
        .map_err(|e| format!("开启事务失败: {}", e))?;
    tx.execute(
        "UPDATE team_submissions SET status = 'rejected', resolved_at = ?1 WHERE id = ?2",
        rusqlite::params![now, input.submission_id],
    )
    .map_err(|e| format!("拒绝提交失败: {}", e))?;

    super::delivery::insert_team_delivery_log(
        &tx,
        super::delivery::TeamDeliveryLogDraft {
            team_id: submission.team_id.clone(),
            team_name: delivery_context.team_name,
            source_skill_id: submission.source_skill_id.clone(),
            source_snapshot_id: Some(submission.source_snapshot_id.clone()),
            source_snapshot_number: Some(delivery_context.source_snapshot_number),
            change_summary: delivery_context.source_change_summary,
            team_skill_id: submission.team_skill_id.clone(),
            team_skill_name: delivery_context.team_skill_name,
            team_version_id: None,
            team_version_number: None,
            submission_id: Some(submission.id.clone()),
            action: "reject".to_string(),
            status: "success".to_string(),
            actor: Some(actor.clone()),
            note: Some(reject_note.clone()),
            created_at: now,
        },
    )?;

    insert_activity(
        &tx,
        &submission.team_id,
        &actor,
        "reject_submission",
        "submission",
        Some(&submission.id),
        Some(&activity_target_label),
        Some(&reject_note),
        now,
    )?;

    tx.commit().map_err(|e| format!("提交事务失败: {}", e))?;
    let _ = std::fs::remove_dir_all(super::paths::team_staging_path(app, &input.submission_id));
    Ok(())
}
