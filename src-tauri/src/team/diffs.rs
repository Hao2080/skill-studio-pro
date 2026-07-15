use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::path::{Path, PathBuf};

use rusqlite::OptionalExtension;
use tauri::Runtime;

use crate::diff;
use crate::domain::{
    CheckPullImpactInput, SnapshotDiffResult, TeamPullImpact, TeamSubmission,
    TeamSubmissionFileResolutionInput, TeamSubmissionMergePreview, TeamSubmissionMergeVersionRef,
};
use crate::store::copy_dir_recursive;
use crate::store::get_conn;

#[derive(Debug, Clone)]
pub(crate) struct TeamVersionMergeMeta {
    pub id: String,
    pub version_number: i64,
    pub snapshot_path: String,
    pub revision_hash: String,
}

#[derive(Debug, Clone)]
pub(crate) struct SubmissionMergeAnalysis {
    pub preview: TeamSubmissionMergePreview,
    pub current_path: Option<PathBuf>,
    pub proposed_path: PathBuf,
    pub proposed_diff: SnapshotDiffResult,
}

fn empty_diff() -> SnapshotDiffResult {
    SnapshotDiffResult {
        added_files: Vec::new(),
        deleted_files: Vec::new(),
        modified_files: Vec::new(),
        text_diffs: HashMap::new(),
    }
}

fn collect_changed_files(diff: &SnapshotDiffResult) -> BTreeSet<String> {
    diff.added_files
        .iter()
        .chain(diff.deleted_files.iter())
        .chain(diff.modified_files.iter())
        .cloned()
        .collect()
}

fn sorted_vec(files: BTreeSet<String>) -> Vec<String> {
    files.into_iter().collect()
}

fn version_ref(meta: &TeamVersionMergeMeta) -> TeamSubmissionMergeVersionRef {
    TeamSubmissionMergeVersionRef {
        id: meta.id.clone(),
        version_number: meta.version_number,
        revision_hash: meta.revision_hash.clone(),
    }
}

fn load_version_meta(
    conn: &rusqlite::Connection,
    version_id: &str,
) -> Result<Option<TeamVersionMergeMeta>, String> {
    conn.query_row(
        "SELECT id, version_number, snapshot_path, revision_hash
         FROM team_skill_versions
         WHERE id = ?1",
        rusqlite::params![version_id],
        |row| {
            Ok(TeamVersionMergeMeta {
                id: row.get(0)?,
                version_number: row.get(1)?,
                snapshot_path: row.get(2)?,
                revision_hash: row.get(3)?,
            })
        },
    )
    .optional()
    .map_err(|e| format!("查询团队基准版本失败: {}", e))
}

fn load_latest_version_meta(
    conn: &rusqlite::Connection,
    team_skill_id: &str,
) -> Result<Option<TeamVersionMergeMeta>, String> {
    conn.query_row(
        "SELECT id, version_number, snapshot_path, revision_hash
         FROM team_skill_versions
         WHERE team_skill_id = ?1
         ORDER BY version_number DESC
         LIMIT 1",
        rusqlite::params![team_skill_id],
        |row| {
            Ok(TeamVersionMergeMeta {
                id: row.get(0)?,
                version_number: row.get(1)?,
                snapshot_path: row.get(2)?,
                revision_hash: row.get(3)?,
            })
        },
    )
    .optional()
    .map_err(|e| format!("查询团队当前版本失败: {}", e))
}

pub(crate) fn analyze_submission_merge<R: Runtime>(
    app: &tauri::AppHandle<R>,
    conn: &rusqlite::Connection,
    submission: &TeamSubmission,
) -> Result<SubmissionMergeAnalysis, String> {
    let proposed_path = super::paths::team_staging_path(app, &submission.id);
    if !proposed_path.exists() {
        return Err(format!("提交 staging 目录不存在: {}", submission.id));
    }

    let base_meta = submission
        .base_team_version_id
        .as_deref()
        .map(|version_id| load_version_meta(conn, version_id))
        .transpose()?
        .flatten();
    let current_meta = submission
        .team_skill_id
        .as_deref()
        .map(|team_skill_id| load_latest_version_meta(conn, team_skill_id))
        .transpose()?
        .flatten();

    let base_path = base_meta
        .as_ref()
        .map(|version| PathBuf::from(&version.snapshot_path));
    let current_path = current_meta
        .as_ref()
        .map(|version| PathBuf::from(&version.snapshot_path));
    let proposed_diff = super::diff_support::diff_against_optional_base(
        app,
        base_path
            .as_ref()
            .map(|path| path.to_string_lossy().to_string()),
        proposed_path.clone(),
    )?;

    let stale_base = match (&base_meta, &current_meta) {
        (Some(base), Some(current)) => base.id != current.id,
        _ => false,
    };
    let current_diff = if stale_base {
        match (&base_path, &current_path) {
            (Some(base), Some(current)) => {
                diff::diff_directories(base.as_path(), current.as_path())?
            }
            _ => empty_diff(),
        }
    } else {
        empty_diff()
    };

    let changed_files = collect_changed_files(&proposed_diff);
    let concurrently_changed_files = collect_changed_files(&current_diff);
    let conflicting_files = changed_files
        .intersection(&concurrently_changed_files)
        .cloned()
        .collect::<BTreeSet<_>>();
    let requires_manual_merge = stale_base && !conflicting_files.is_empty();
    let summary = if requires_manual_merge {
        "conflict".to_string()
    } else if stale_base {
        "stale_clean".to_string()
    } else if base_meta.is_none() {
        "new_skill".to_string()
    } else {
        "clean".to_string()
    };

    let preview = TeamSubmissionMergePreview {
        submission_id: submission.id.clone(),
        base_version: base_meta.as_ref().map(version_ref),
        current_version: current_meta.as_ref().map(version_ref),
        stale_base,
        can_auto_merge: !requires_manual_merge,
        requires_manual_merge,
        changed_files: sorted_vec(changed_files),
        concurrently_changed_files: sorted_vec(concurrently_changed_files),
        conflicting_files: sorted_vec(conflicting_files),
        added_files: proposed_diff.added_files.clone(),
        modified_files: proposed_diff.modified_files.clone(),
        deleted_files: proposed_diff.deleted_files.clone(),
        summary,
    };

    Ok(SubmissionMergeAnalysis {
        preview,
        current_path,
        proposed_path,
        proposed_diff,
    })
}

fn copy_changed_file(
    source_root: &Path,
    target_root: &Path,
    relative_path: &str,
) -> Result<(), String> {
    let source = source_root.join(relative_path);
    if !source.exists() {
        return Err(format!("提交文件不存在: {}", relative_path));
    }

    let target = target_root.join(relative_path);
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("创建目标目录失败: {}", e))?;
    }
    std::fs::copy(&source, &target).map_err(|e| format!("复制合并文件失败: {}", e))?;
    Ok(())
}

fn remove_changed_file(target_root: &Path, relative_path: &str) -> Result<(), String> {
    let target = target_root.join(relative_path);
    if target.is_dir() {
        std::fs::remove_dir_all(&target).map_err(|e| format!("删除目标目录失败: {}", e))?;
    } else if target.exists() {
        std::fs::remove_file(&target).map_err(|e| format!("删除目标文件失败: {}", e))?;
    }
    Ok(())
}

fn apply_proposed_change(
    analysis: &SubmissionMergeAnalysis,
    target: &Path,
    relative_path: &str,
) -> Result<(), String> {
    if analysis
        .proposed_diff
        .deleted_files
        .iter()
        .any(|file| file == relative_path)
    {
        remove_changed_file(target, relative_path)
    } else {
        copy_changed_file(&analysis.proposed_path, target, relative_path)
    }
}

fn apply_proposed_changes_except(
    analysis: &SubmissionMergeAnalysis,
    target: &Path,
    excluded_files: &BTreeSet<String>,
) -> Result<(), String> {
    for relative_path in &analysis.proposed_diff.deleted_files {
        if !excluded_files.contains(relative_path) {
            remove_changed_file(target, relative_path)?;
        }
    }

    for relative_path in analysis
        .proposed_diff
        .added_files
        .iter()
        .chain(analysis.proposed_diff.modified_files.iter())
    {
        if !excluded_files.contains(relative_path) {
            copy_changed_file(&analysis.proposed_path, target, relative_path)?;
        }
    }

    Ok(())
}

fn materialize_file_resolutions(
    analysis: &SubmissionMergeAnalysis,
    target: &Path,
    file_resolutions: &[TeamSubmissionFileResolutionInput],
) -> Result<(), String> {
    let current_path = analysis
        .current_path
        .as_ref()
        .ok_or_else(|| "缺少团队当前版本，无法执行文件级合并".to_string())?;
    let conflict_files = analysis
        .preview
        .conflicting_files
        .iter()
        .cloned()
        .collect::<BTreeSet<_>>();

    if conflict_files.is_empty() {
        return Err("当前提交没有需要文件级决策的冲突".to_string());
    }

    let mut resolutions_by_file = BTreeMap::new();
    for resolution in file_resolutions {
        if !conflict_files.contains(&resolution.file_path) {
            return Err(format!("文件不在冲突列表中: {}", resolution.file_path));
        }

        match resolution.resolution.as_str() {
            "incoming" | "current" => {}
            value => return Err(format!("未知文件合并决策: {}", value)),
        }

        if resolutions_by_file
            .insert(resolution.file_path.clone(), resolution.resolution.clone())
            .is_some()
        {
            return Err(format!("重复的文件合并决策: {}", resolution.file_path));
        }
    }

    let unresolved_files = conflict_files
        .iter()
        .filter(|file| !resolutions_by_file.contains_key(*file))
        .cloned()
        .collect::<Vec<_>>();
    if !unresolved_files.is_empty() {
        return Err(format!(
            "仍有冲突文件未决策: {}",
            unresolved_files.join(", ")
        ));
    }

    copy_dir_recursive(current_path, target).map_err(|e| format!("复制当前团队版本失败: {}", e))?;
    apply_proposed_changes_except(analysis, target, &conflict_files)?;

    for (relative_path, resolution) in resolutions_by_file {
        if resolution == "incoming" {
            apply_proposed_change(analysis, target, &relative_path)?;
        }
    }

    Ok(())
}

pub(crate) fn materialize_submission_merge(
    analysis: &SubmissionMergeAnalysis,
    target: &Path,
    resolution_mode: &str,
    file_resolutions: &[TeamSubmissionFileResolutionInput],
) -> Result<(), String> {
    match resolution_mode {
        "auto" => {
            if analysis.preview.requires_manual_merge {
                return Err("该提交存在并发冲突，请先人工处理后再合并".to_string());
            }

            if analysis.preview.stale_base {
                let current_path = analysis
                    .current_path
                    .as_ref()
                    .ok_or_else(|| "缺少团队当前版本，无法自动叠加合并".to_string())?;
                copy_dir_recursive(current_path, target)
                    .map_err(|e| format!("复制当前团队版本失败: {}", e))?;
                apply_proposed_changes_except(analysis, target, &BTreeSet::new())?;
                Ok(())
            } else {
                copy_dir_recursive(&analysis.proposed_path, target)
                    .map_err(|e| format!("写入团队版本目录失败: {}", e))
            }
        }
        "manual_override" => copy_dir_recursive(&analysis.proposed_path, target)
            .map_err(|e| format!("写入人工覆盖版本目录失败: {}", e)),
        "manual_files" => materialize_file_resolutions(analysis, target, file_resolutions),
        _ => Err(format!("未知合并模式: {}", resolution_mode)),
    }
}

pub fn team_submission_diff<R: Runtime>(
    app: &tauri::AppHandle<R>,
    submission_id: &str,
) -> Result<SnapshotDiffResult, String> {
    let conn = get_conn(app)?;
    let staging_dir = super::paths::team_staging_path(app, submission_id);
    if !staging_dir.exists() {
        return Err(format!("提交 staging 目录不存在: {}", submission_id));
    }

    let submission: TeamSubmission = conn
        .query_row(
            "SELECT id, team_id, team_skill_id, base_team_version_id, base_revision_hash, source_skill_id, source_snapshot_id, submitter, submit_message, submitted_at, status, resolved_at
             FROM team_submissions
             WHERE id = ?1",
            rusqlite::params![submission_id],
            super::sql::map_team_submission,
        )
        .map_err(|_| format!("提交记录不存在: {}", submission_id))?;

    let base_dir = match submission.base_team_version_id.as_deref() {
        Some(version_id) => Some(super::sql::team_version_path_by_id(&conn, version_id)?),
        None => match submission.team_skill_id.as_deref() {
            Some(team_skill_id) => super::sql::latest_team_version_path(&conn, team_skill_id)?,
            None => None,
        },
    };

    super::diff_support::diff_against_optional_base(app, base_dir, staging_dir)
}

pub fn team_submission_merge_preview<R: Runtime>(
    app: &tauri::AppHandle<R>,
    submission_id: &str,
) -> Result<TeamSubmissionMergePreview, String> {
    let conn = get_conn(app)?;
    let submission: TeamSubmission = conn
        .query_row(
            "SELECT id, team_id, team_skill_id, base_team_version_id, base_revision_hash, source_skill_id, source_snapshot_id, submitter, submit_message, submitted_at, status, resolved_at
             FROM team_submissions
             WHERE id = ?1",
            rusqlite::params![submission_id],
            super::sql::map_team_submission,
        )
        .map_err(|_| format!("提交记录不存在: {}", submission_id))?;

    if submission.status != "pending" {
        return Err(format!("提交状态为 {}，无法预检合并", submission.status));
    }

    Ok(analyze_submission_merge(app, &conn, &submission)?.preview)
}

pub fn team_version_diff<R: Runtime>(
    app: &tauri::AppHandle<R>,
    version_id: &str,
) -> Result<SnapshotDiffResult, String> {
    let conn = get_conn(app)?;
    let current_dir =
        std::path::PathBuf::from(super::sql::current_team_version_path(&conn, version_id)?);
    let previous_dir = super::sql::previous_team_version_path(&conn, version_id)?;

    super::diff_support::diff_against_optional_base(app, previous_dir, current_dir)
}

pub fn team_pull_impact_check<R: Runtime>(
    app: &tauri::AppHandle<R>,
    input: &CheckPullImpactInput,
) -> Result<TeamPullImpact, String> {
    super::diff_support::validate_pull_mode(&input.mode, input.target_skill_id.as_deref())?;

    match input.mode.as_str() {
        "new_skill" => Ok(TeamPullImpact {
            has_local_changes: false,
        }),
        "append_snapshot" => {
            let target_skill_id = input
                .target_skill_id
                .as_ref()
                .expect("validate_pull_mode 已校验 target_skill_id");

            let change_status = crate::store::detect_changes(app, target_skill_id)?;

            Ok(TeamPullImpact {
                has_local_changes: change_status.has_changes,
            })
        }
        _ => Err(format!("未知 mode: {}", input.mode)),
    }
}
