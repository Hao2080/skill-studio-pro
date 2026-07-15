use std::collections::{HashMap, HashSet};
use std::path::Path;

use rusqlite::{Connection, OptionalExtension};
use tauri::Runtime;
use uuid::Uuid;

use crate::domain::{
    is_system_snapshot_source, RemoveSkillFromTeamsInput, SkillTeamDeliveryOverview,
    SkillTeamDeliveryStatus, SubmitSnapshotToTeamsInput, TeamDeliveryRecord, TeamDeliveryTarget,
    TeamPendingDelivery, WithdrawPendingTeamDeliveriesInput,
};
use crate::store::{copy_dir_recursive, get_conn, now_ms};

#[derive(Clone)]
struct TeamIdentity {
    team_id: String,
    team_name: String,
    team_description: Option<String>,
}

#[derive(Clone)]
struct SnapshotDeliverySource {
    skill_id: String,
    skill_slug: String,
    skill_name: String,
    snapshot_id: String,
    snapshot_number: i64,
    snapshot_path: String,
    change_summary: Option<String>,
    source: String,
}

fn normalize_team_ids(team_ids: &[String]) -> Vec<String> {
    let mut normalized = Vec::new();
    let mut seen = HashSet::new();

    for team_id in team_ids {
        let value = team_id.trim();
        if value.is_empty() || !seen.insert(value.to_string()) {
            continue;
        }

        normalized.push(value.to_string());
    }

    normalized
}

fn insert_activity(
    conn: &Connection,
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

fn load_all_teams(conn: &rusqlite::Connection) -> Result<Vec<TeamIdentity>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name, description FROM teams ORDER BY created_at ASC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(TeamIdentity {
                team_id: row.get(0)?,
                team_name: row.get(1)?,
                team_description: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

fn resolve_requested_teams(
    conn: &rusqlite::Connection,
    team_ids: &[String],
) -> Result<Vec<TeamIdentity>, String> {
    let requested = normalize_team_ids(team_ids);
    if requested.is_empty() {
        return Err("至少选择一个团队".to_string());
    }

    let mut available = load_all_teams(conn)?
        .into_iter()
        .map(|team| (team.team_id.clone(), team))
        .collect::<HashMap<_, _>>();
    let mut resolved = Vec::new();
    let mut missing = Vec::new();

    for team_id in requested {
        match available.remove(&team_id) {
            Some(team) => resolved.push(team),
            None => missing.push(team_id),
        }
    }

    if !missing.is_empty() {
        return Err(format!("团队不存在: {}", missing.join("、")));
    }

    Ok(resolved)
}

fn load_snapshot_delivery_source(
    conn: &rusqlite::Connection,
    skill_id: &str,
    snapshot_id: &str,
) -> Result<SnapshotDeliverySource, String> {
    conn.query_row(
        "SELECT s.id, s.slug, s.name, ss.id, ss.snapshot_number, ss.snapshot_path, ss.change_summary, ss.source
         FROM skill_snapshots ss
         INNER JOIN skills s ON s.id = ss.skill_id
         WHERE s.id = ?1 AND ss.id = ?2",
        rusqlite::params![skill_id, snapshot_id],
        |row| {
            Ok(SnapshotDeliverySource {
                skill_id: row.get(0)?,
                skill_slug: row.get(1)?,
                skill_name: row.get(2)?,
                snapshot_id: row.get(3)?,
                snapshot_number: row.get(4)?,
                snapshot_path: row.get(5)?,
                change_summary: row.get(6)?,
                source: row.get(7)?,
            })
        },
    )
    .map_err(|_| format!("快照 '{}' 不属于当前技能", snapshot_id))
}

fn load_team_skill_binding(
    conn: &rusqlite::Connection,
    team_id: &str,
    skill_slug: &str,
) -> Result<Option<(String, String)>, String> {
    conn.query_row(
        "SELECT id, name FROM team_skills WHERE team_id = ?1 AND slug = ?2 LIMIT 1",
        rusqlite::params![team_id, skill_slug],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )
    .optional()
    .map_err(|e| format!("查询团队技能绑定失败: {}", e))
}

pub(super) fn load_team_name(conn: &Connection, team_id: &str) -> Result<String, String> {
    conn.query_row(
        "SELECT name FROM teams WHERE id = ?1",
        rusqlite::params![team_id],
        |row| row.get(0),
    )
    .map_err(|_| format!("团队不存在: {}", team_id))
}

pub(super) fn load_team_skill_name(
    conn: &Connection,
    team_skill_id: Option<&str>,
) -> Result<Option<String>, String> {
    let Some(team_skill_id) = team_skill_id else {
        return Ok(None);
    };

    conn.query_row(
        "SELECT name FROM team_skills WHERE id = ?1",
        rusqlite::params![team_skill_id],
        |row| row.get(0),
    )
    .optional()
    .map_err(|e| format!("查询团队技能名称失败: {}", e))
}

pub(super) fn load_snapshot_delivery_details(
    conn: &Connection,
    snapshot_id: &str,
) -> Result<(i64, Option<String>), String> {
    conn.query_row(
        "SELECT snapshot_number, change_summary FROM skill_snapshots WHERE id = ?1",
        rusqlite::params![snapshot_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )
    .map_err(|_| format!("快照不存在: {}", snapshot_id))
}

fn load_current_target(
    conn: &rusqlite::Connection,
    team_id: &str,
    skill_id: &str,
) -> Result<Option<TeamDeliveryTarget>, String> {
    conn.query_row(
        "SELECT tdt.team_id, t.name, tdt.source_skill_id, tdt.source_snapshot_id, ss.snapshot_number,
                ss.change_summary, tdt.team_skill_id, ts.name, tdt.team_version_id, tsv.version_number,
                tdt.delivered_at
         FROM team_delivery_targets tdt
         INNER JOIN teams t ON t.id = tdt.team_id
         INNER JOIN skill_snapshots ss ON ss.id = tdt.source_snapshot_id
         LEFT JOIN team_skills ts ON ts.id = tdt.team_skill_id
         LEFT JOIN team_skill_versions tsv ON tsv.id = tdt.team_version_id
         WHERE tdt.team_id = ?1 AND tdt.source_skill_id = ?2
         LIMIT 1",
        rusqlite::params![team_id, skill_id],
        |row| {
            Ok(TeamDeliveryTarget {
                team_id: row.get(0)?,
                team_name: row.get(1)?,
                source_skill_id: row.get(2)?,
                source_snapshot_id: row.get(3)?,
                source_snapshot_number: row.get(4)?,
                change_summary: row.get(5)?,
                team_skill_id: row.get(6)?,
                team_skill_name: row.get(7)?,
                team_version_id: row.get(8)?,
                team_version_number: row.get(9)?,
                delivered_at: row.get(10)?,
            })
        },
    )
    .optional()
    .map_err(|e| format!("查询团队当前承接失败: {}", e))
}

fn load_pending_delivery(
    conn: &rusqlite::Connection,
    team_id: &str,
    skill_id: &str,
) -> Result<Option<TeamPendingDelivery>, String> {
    conn.query_row(
        "SELECT sub.id, sub.team_id, t.name, sub.team_skill_id, sub.source_snapshot_id, ss.snapshot_number,
                ss.change_summary, sub.submitter, sub.submit_message, sub.submitted_at
         FROM team_submissions sub
         INNER JOIN teams t ON t.id = sub.team_id
         INNER JOIN skill_snapshots ss ON ss.id = sub.source_snapshot_id
         WHERE sub.team_id = ?1
           AND sub.source_skill_id = ?2
           AND sub.status = 'pending'
         ORDER BY sub.submitted_at DESC, sub.id DESC
         LIMIT 1",
        rusqlite::params![team_id, skill_id],
        |row| {
            Ok(TeamPendingDelivery {
                submission_id: row.get(0)?,
                team_id: row.get(1)?,
                team_name: row.get(2)?,
                team_skill_id: row.get(3)?,
                source_snapshot_id: row.get(4)?,
                source_snapshot_number: row.get(5)?,
                change_summary: row.get(6)?,
                submitter: row.get(7)?,
                submit_message: row.get(8)?,
                submitted_at: row.get(9)?,
            })
        },
    )
    .optional()
    .map_err(|e| format!("查询待审交付失败: {}", e))
}

fn load_recent_team_delivery_records(
    conn: &rusqlite::Connection,
    skill_id: &str,
    limit: usize,
) -> Result<Vec<TeamDeliveryRecord>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT log.id, log.team_id, t.name, log.source_skill_id, log.source_snapshot_id,
                    ss.snapshot_number, ss.change_summary, log.team_skill_id, ts.name, log.team_version_id,
                    tsv.version_number, log.submission_id, log.action, log.status, log.actor, log.note,
                    log.created_at
             FROM team_delivery_logs log
             INNER JOIN teams t ON t.id = log.team_id
             LEFT JOIN skill_snapshots ss ON ss.id = log.source_snapshot_id
             LEFT JOIN team_skills ts ON ts.id = log.team_skill_id
             LEFT JOIN team_skill_versions tsv ON tsv.id = log.team_version_id
             WHERE log.source_skill_id = ?1
             ORDER BY log.created_at DESC, log.id DESC
             LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![skill_id, limit as i64], |row| {
            Ok(TeamDeliveryRecord {
                id: row.get(0)?,
                team_id: row.get(1)?,
                team_name: row.get(2)?,
                source_skill_id: row.get(3)?,
                source_snapshot_id: row.get(4)?,
                source_snapshot_number: row.get(5)?,
                change_summary: row.get(6)?,
                team_skill_id: row.get(7)?,
                team_skill_name: row.get(8)?,
                team_version_id: row.get(9)?,
                team_version_number: row.get(10)?,
                submission_id: row.get(11)?,
                action: row.get(12)?,
                status: row.get(13)?,
                actor: row.get(14)?,
                note: row.get(15)?,
                created_at: row.get(16)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub(super) fn upsert_team_delivery_target(
    conn: &Connection,
    team_id: &str,
    source_skill_id: &str,
    source_snapshot_id: &str,
    team_skill_id: Option<&str>,
    team_version_id: Option<&str>,
    delivered_at: i64,
) -> Result<(), String> {
    let target_id = format!("{}:{}", team_id, source_skill_id);
    conn.execute(
        "INSERT INTO team_delivery_targets (
            id,
            team_id,
            source_skill_id,
            source_snapshot_id,
            team_skill_id,
            team_version_id,
            delivered_at,
            created_at,
            updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT(team_id, source_skill_id) DO UPDATE SET
            source_snapshot_id = excluded.source_snapshot_id,
            team_skill_id = excluded.team_skill_id,
            team_version_id = excluded.team_version_id,
            delivered_at = excluded.delivered_at,
            updated_at = excluded.updated_at",
        rusqlite::params![
            target_id,
            team_id,
            source_skill_id,
            source_snapshot_id,
            team_skill_id,
            team_version_id,
            delivered_at,
            delivered_at,
            delivered_at,
        ],
    )
    .map_err(|e| format!("写入团队承接状态失败: {}", e))?;

    Ok(())
}

pub(super) fn clear_team_delivery_target(
    conn: &Connection,
    team_id: &str,
    source_skill_id: &str,
) -> Result<(), String> {
    conn.execute(
        "DELETE FROM team_delivery_targets WHERE team_id = ?1 AND source_skill_id = ?2",
        rusqlite::params![team_id, source_skill_id],
    )
    .map_err(|e| format!("解除团队承接失败: {}", e))?;

    Ok(())
}

pub(super) struct TeamDeliveryLogDraft {
    pub(super) team_id: String,
    pub(super) team_name: String,
    pub(super) source_skill_id: String,
    pub(super) source_snapshot_id: Option<String>,
    pub(super) source_snapshot_number: Option<i64>,
    pub(super) change_summary: Option<String>,
    pub(super) team_skill_id: Option<String>,
    pub(super) team_skill_name: Option<String>,
    pub(super) team_version_id: Option<String>,
    pub(super) team_version_number: Option<i64>,
    pub(super) submission_id: Option<String>,
    pub(super) action: String,
    pub(super) status: String,
    pub(super) actor: Option<String>,
    pub(super) note: Option<String>,
    pub(super) created_at: i64,
}

pub(super) fn insert_team_delivery_log(
    conn: &Connection,
    draft: TeamDeliveryLogDraft,
) -> Result<TeamDeliveryRecord, String> {
    let log_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO team_delivery_logs (
            id,
            team_id,
            source_skill_id,
            source_snapshot_id,
            team_skill_id,
            team_version_id,
            submission_id,
            action,
            status,
            actor,
            note,
            created_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        rusqlite::params![
            log_id,
            draft.team_id,
            draft.source_skill_id,
            draft.source_snapshot_id,
            draft.team_skill_id,
            draft.team_version_id,
            draft.submission_id,
            draft.action,
            draft.status,
            draft.actor,
            draft.note,
            draft.created_at,
        ],
    )
    .map_err(|e| format!("写入团队交付记录失败: {}", e))?;

    Ok(TeamDeliveryRecord {
        id: log_id,
        team_id: draft.team_id,
        team_name: draft.team_name,
        source_skill_id: draft.source_skill_id,
        source_snapshot_id: draft.source_snapshot_id,
        source_snapshot_number: draft.source_snapshot_number,
        change_summary: draft.change_summary,
        team_skill_id: draft.team_skill_id,
        team_skill_name: draft.team_skill_name,
        team_version_id: draft.team_version_id,
        team_version_number: draft.team_version_number,
        submission_id: draft.submission_id,
        action: draft.action,
        status: draft.status,
        actor: draft.actor,
        note: draft.note,
        created_at: draft.created_at,
    })
}

fn derive_submit_action(
    current_target: Option<&TeamDeliveryTarget>,
    pending_delivery: Option<&TeamPendingDelivery>,
    snapshot_id: &str,
) -> &'static str {
    if let Some(pending_delivery) = pending_delivery {
        return if pending_delivery.source_snapshot_id == snapshot_id {
            "resubmit"
        } else {
            "replace_pending"
        };
    }

    if let Some(current_target) = current_target {
        return if current_target.source_snapshot_id == snapshot_id {
            "resubmit"
        } else {
            "switch"
        };
    }

    "submit"
}

pub fn get_skill_team_deliveries<R: Runtime>(
    app: &tauri::AppHandle<R>,
    skill_id: &str,
) -> Result<SkillTeamDeliveryOverview, String> {
    let conn = get_conn(app)?;
    let _: String = conn
        .query_row(
            "SELECT id FROM skills WHERE id = ?1",
            rusqlite::params![skill_id],
            |row| row.get(0),
        )
        .map_err(|_| format!("skill 不存在: {}", skill_id))?;

    let recent_records = load_recent_team_delivery_records(&conn, skill_id, 24)?;
    let mut latest_record_by_team = HashMap::new();
    for record in &recent_records {
        latest_record_by_team
            .entry(record.team_id.clone())
            .or_insert_with(|| record.clone());
    }

    let deliveries = load_all_teams(&conn)?
        .into_iter()
        .map(|team| {
            Ok(SkillTeamDeliveryStatus {
                team_id: team.team_id.clone(),
                team_name: team.team_name.clone(),
                team_description: team.team_description.clone(),
                current_target: load_current_target(&conn, &team.team_id, skill_id)?,
                pending_delivery: load_pending_delivery(&conn, &team.team_id, skill_id)?,
                last_record: latest_record_by_team.get(&team.team_id).cloned(),
            })
        })
        .collect::<Result<Vec<_>, String>>()?;

    Ok(SkillTeamDeliveryOverview {
        deliveries,
        recent_records,
    })
}

pub fn submit_snapshot_to_teams<R: Runtime>(
    app: &tauri::AppHandle<R>,
    input: &SubmitSnapshotToTeamsInput,
) -> Result<Vec<TeamDeliveryRecord>, String> {
    let conn = get_conn(app)?;
    let source = load_snapshot_delivery_source(&conn, &input.skill_id, &input.snapshot_id)?;
    if is_system_snapshot_source(&source.source) {
        return Err("系统恢复点不能直接交付团队".to_string());
    }
    let source_dir = Path::new(&source.snapshot_path);
    if !source_dir.exists() {
        return Err(format!("快照目录不存在: {}", source.snapshot_path));
    }
    let submitter = super::permissions::normalize_actor(Some(&input.submitter))?;

    let teams = resolve_requested_teams(&conn, &input.team_ids)?;
    for team in &teams {
        super::permissions::ensure_team_active(&conn, &team.team_id)?;
        super::permissions::ensure_actor_can(
            &conn,
            &team.team_id,
            &submitter,
            super::permissions::TeamPermission::Submit,
        )?;
    }
    let mut records = Vec::with_capacity(teams.len());

    for team in teams {
        let current_target = load_current_target(&conn, &team.team_id, &source.skill_id)?;
        let pending_delivery = load_pending_delivery(&conn, &team.team_id, &source.skill_id)?;
        let derived_team_skill = load_team_skill_binding(&conn, &team.team_id, &source.skill_slug)?;
        let team_skill_id = pending_delivery
            .as_ref()
            .and_then(|pending| pending.team_skill_id.clone())
            .or_else(|| {
                current_target
                    .as_ref()
                    .and_then(|target| target.team_skill_id.clone())
            })
            .or_else(|| {
                derived_team_skill
                    .as_ref()
                    .map(|(team_skill_id, _)| team_skill_id.clone())
            });
        let base_version = team_skill_id
            .as_deref()
            .map(|team_skill_id| super::sql::latest_team_version_ref(&conn, team_skill_id))
            .transpose()?
            .flatten();
        let team_skill_name = current_target
            .as_ref()
            .and_then(|target| target.team_skill_name.clone())
            .or_else(|| {
                derived_team_skill
                    .as_ref()
                    .map(|(_, team_skill_name)| team_skill_name.clone())
            });
        let action = derive_submit_action(
            current_target.as_ref(),
            pending_delivery.as_ref(),
            &source.snapshot_id,
        )
        .to_string();
        let now = now_ms();
        let submission_id = Uuid::new_v4().to_string();
        let staging = super::paths::team_staging_path(app, &submission_id);

        let copy_result = copy_dir_recursive(source_dir, &staging)
            .map_err(|e| format!("复制快照到团队暂存区失败: {}", e));

        if let Err(error) = copy_result {
            records.push(insert_team_delivery_log(
                &conn,
                TeamDeliveryLogDraft {
                    team_id: team.team_id.clone(),
                    team_name: team.team_name.clone(),
                    source_skill_id: source.skill_id.clone(),
                    source_snapshot_id: Some(source.snapshot_id.clone()),
                    source_snapshot_number: Some(source.snapshot_number),
                    change_summary: source.change_summary.clone(),
                    team_skill_id,
                    team_skill_name,
                    team_version_id: None,
                    team_version_number: None,
                    submission_id: None,
                    action,
                    status: "failed".to_string(),
                    actor: Some(submitter.clone()),
                    note: Some(error),
                    created_at: now,
                },
            )?);
            continue;
        }

        let mut conn = get_conn(app)?;
        let tx = conn
            .transaction()
            .map_err(|e| format!("开启事务失败: {}", e))?;
        let log_id = Uuid::new_v4().to_string();
        let db_result = (|| -> Result<(), String> {
            if let Some(existing_pending) = &pending_delivery {
                tx.execute(
                    "UPDATE team_submissions
                     SET status = 'withdrawn', resolved_at = ?1
                     WHERE id = ?2",
                    rusqlite::params![now, existing_pending.submission_id],
                )
                .map_err(|e| format!("替换旧待审失败: {}", e))?;
            }

            tx.execute(
                "INSERT INTO team_submissions (
                    id,
                    team_id,
                    team_skill_id,
                    base_team_version_id,
                    base_revision_hash,
                    source_skill_id,
                    source_snapshot_id,
                    submitter,
                    submit_message,
                    submitted_at,
                    status
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'pending')",
                rusqlite::params![
                    submission_id,
                    team.team_id,
                    team_skill_id,
                    base_version.as_ref().map(|version| version.0.as_str()),
                    base_version.as_ref().map(|version| version.1.as_str()),
                    source.skill_id,
                    source.snapshot_id,
                    submitter,
                    input.submit_message,
                    now,
                ],
            )
            .map_err(|e| format!("写入团队提交失败: {}", e))?;

            tx.execute(
                "INSERT INTO team_delivery_logs (
                    id,
                    team_id,
                    source_skill_id,
                    source_snapshot_id,
                    team_skill_id,
                    team_version_id,
                    submission_id,
                    action,
                    status,
                    actor,
                    note,
                    created_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6, ?7, 'pending', ?8, ?9, ?10)",
                rusqlite::params![
                    log_id,
                    team.team_id,
                    source.skill_id,
                    source.snapshot_id,
                    team_skill_id,
                    submission_id,
                    action,
                    submitter,
                    input.submit_message,
                    now,
                ],
            )
            .map_err(|e| format!("写入团队交付记录失败: {}", e))?;

            insert_activity(
                &tx,
                &team.team_id,
                &submitter,
                "submit",
                "submission",
                Some(&submission_id),
                team_skill_name
                    .as_deref()
                    .or(Some(source.skill_name.as_str())),
                input.submit_message.as_deref(),
                now,
            )?;

            Ok(())
        })();

        match db_result {
            Ok(()) => {
                tx.commit().map_err(|e| format!("提交事务失败: {}", e))?;
                if let Some(existing_pending) = pending_delivery {
                    let _ = std::fs::remove_dir_all(super::paths::team_staging_path(
                        app,
                        &existing_pending.submission_id,
                    ));
                }
                records.push(TeamDeliveryRecord {
                    id: log_id,
                    team_id: team.team_id,
                    team_name: team.team_name,
                    source_skill_id: source.skill_id.clone(),
                    source_snapshot_id: Some(source.snapshot_id.clone()),
                    source_snapshot_number: Some(source.snapshot_number),
                    change_summary: source.change_summary.clone(),
                    team_skill_id,
                    team_skill_name,
                    team_version_id: None,
                    team_version_number: None,
                    submission_id: Some(submission_id),
                    action,
                    status: "pending".to_string(),
                    actor: Some(submitter.clone()),
                    note: input.submit_message.clone(),
                    created_at: now,
                });
            }
            Err(error) => {
                drop(tx);
                let _ = std::fs::remove_dir_all(&staging);
                records.push(insert_team_delivery_log(
                    &conn,
                    TeamDeliveryLogDraft {
                        team_id: team.team_id,
                        team_name: team.team_name,
                        source_skill_id: source.skill_id.clone(),
                        source_snapshot_id: Some(source.snapshot_id.clone()),
                        source_snapshot_number: Some(source.snapshot_number),
                        change_summary: source.change_summary.clone(),
                        team_skill_id,
                        team_skill_name,
                        team_version_id: None,
                        team_version_number: None,
                        submission_id: None,
                        action,
                        status: "failed".to_string(),
                        actor: Some(submitter.clone()),
                        note: Some(error),
                        created_at: now,
                    },
                )?);
            }
        }
    }

    Ok(records)
}

pub fn withdraw_pending_team_deliveries<R: Runtime>(
    app: &tauri::AppHandle<R>,
    input: &WithdrawPendingTeamDeliveriesInput,
) -> Result<Vec<TeamDeliveryRecord>, String> {
    let conn = get_conn(app)?;
    let teams = resolve_requested_teams(&conn, &input.team_ids)?;
    let actor = super::permissions::normalize_actor(input.actor.as_deref())?;
    for team in &teams {
        super::permissions::ensure_team_active(&conn, &team.team_id)?;
        super::permissions::ensure_actor_can(
            &conn,
            &team.team_id,
            &actor,
            super::permissions::TeamPermission::Maintain,
        )?;
    }
    let mut records = Vec::with_capacity(teams.len());

    for team in teams {
        let now = now_ms();
        let pending_delivery = load_pending_delivery(&conn, &team.team_id, &input.skill_id)?;

        let Some(pending_delivery) = pending_delivery else {
            records.push(insert_team_delivery_log(
                &conn,
                TeamDeliveryLogDraft {
                    team_id: team.team_id,
                    team_name: team.team_name,
                    source_skill_id: input.skill_id.clone(),
                    source_snapshot_id: None,
                    source_snapshot_number: None,
                    change_summary: None,
                    team_skill_id: None,
                    team_skill_name: None,
                    team_version_id: None,
                    team_version_number: None,
                    submission_id: None,
                    action: "withdraw".to_string(),
                    status: "failed".to_string(),
                    actor: Some(actor.clone()),
                    note: Some("当前没有待审交付".to_string()),
                    created_at: now,
                },
            )?);
            continue;
        };

        conn.execute(
            "UPDATE team_submissions SET status = 'withdrawn', resolved_at = ?1 WHERE id = ?2",
            rusqlite::params![now, pending_delivery.submission_id],
        )
        .map_err(|e| format!("撤回待审失败: {}", e))?;
        let _ = std::fs::remove_dir_all(super::paths::team_staging_path(
            app,
            &pending_delivery.submission_id,
        ));

        let activity_target_id = pending_delivery.submission_id.clone();
        let activity_target_label = format!("Snapshot {}", pending_delivery.source_snapshot_number);
        let activity_detail = pending_delivery.submit_message.clone();

        records.push(insert_team_delivery_log(
            &conn,
            TeamDeliveryLogDraft {
                team_id: team.team_id.clone(),
                team_name: team.team_name,
                source_skill_id: input.skill_id.clone(),
                source_snapshot_id: Some(pending_delivery.source_snapshot_id),
                source_snapshot_number: Some(pending_delivery.source_snapshot_number),
                change_summary: pending_delivery.change_summary,
                team_skill_id: pending_delivery.team_skill_id,
                team_skill_name: None,
                team_version_id: None,
                team_version_number: None,
                submission_id: Some(pending_delivery.submission_id),
                action: "withdraw".to_string(),
                status: "success".to_string(),
                actor: Some(actor.clone()),
                note: pending_delivery.submit_message,
                created_at: now,
            },
        )?);
        insert_activity(
            &conn,
            &team.team_id,
            &actor,
            "withdraw_submission",
            "submission",
            Some(&activity_target_id),
            Some(&activity_target_label),
            activity_detail.as_deref(),
            now,
        )?;
    }

    Ok(records)
}

pub fn remove_skill_from_teams<R: Runtime>(
    _app: &tauri::AppHandle<R>,
    input: &RemoveSkillFromTeamsInput,
) -> Result<Vec<TeamDeliveryRecord>, String> {
    let conn = get_conn(_app)?;
    let teams = resolve_requested_teams(&conn, &input.team_ids)?;
    let actor = super::permissions::normalize_actor(input.actor.as_deref())?;
    for team in &teams {
        super::permissions::ensure_team_active(&conn, &team.team_id)?;
        super::permissions::ensure_actor_can(
            &conn,
            &team.team_id,
            &actor,
            super::permissions::TeamPermission::Maintain,
        )?;
    }
    let mut records = Vec::with_capacity(teams.len());

    for team in teams {
        let now = now_ms();
        let current_target = load_current_target(&conn, &team.team_id, &input.skill_id)?;

        let Some(current_target) = current_target else {
            records.push(insert_team_delivery_log(
                &conn,
                TeamDeliveryLogDraft {
                    team_id: team.team_id,
                    team_name: team.team_name,
                    source_skill_id: input.skill_id.clone(),
                    source_snapshot_id: None,
                    source_snapshot_number: None,
                    change_summary: None,
                    team_skill_id: None,
                    team_skill_name: None,
                    team_version_id: None,
                    team_version_number: None,
                    submission_id: None,
                    action: "remove".to_string(),
                    status: "failed".to_string(),
                    actor: Some(actor.clone()),
                    note: Some("当前团队尚未承接该技能".to_string()),
                    created_at: now,
                },
            )?);
            continue;
        };

        clear_team_delivery_target(&conn, &team.team_id, &input.skill_id)?;
        let activity_target_id = current_target
            .team_version_id
            .clone()
            .or_else(|| current_target.team_skill_id.clone())
            .unwrap_or_else(|| input.skill_id.clone());
        let activity_target_label = current_target
            .team_skill_name
            .clone()
            .unwrap_or_else(|| input.skill_id.clone());
        let activity_detail = "仅解除当前团队承接，不删除团队历史版本。".to_string();

        records.push(insert_team_delivery_log(
            &conn,
            TeamDeliveryLogDraft {
                team_id: team.team_id.clone(),
                team_name: team.team_name,
                source_skill_id: input.skill_id.clone(),
                source_snapshot_id: Some(current_target.source_snapshot_id),
                source_snapshot_number: Some(current_target.source_snapshot_number),
                change_summary: current_target.change_summary,
                team_skill_id: current_target.team_skill_id,
                team_skill_name: current_target.team_skill_name,
                team_version_id: current_target.team_version_id,
                team_version_number: current_target.team_version_number,
                submission_id: None,
                action: "remove".to_string(),
                status: "success".to_string(),
                actor: Some(actor.clone()),
                note: Some(activity_detail.clone()),
                created_at: now,
            },
        )?);
        insert_activity(
            &conn,
            &team.team_id,
            &actor,
            "remove_serving",
            "team_skill",
            Some(&activity_target_id),
            Some(&activity_target_label),
            Some(&activity_detail),
            now,
        )?;
    }

    Ok(records)
}
