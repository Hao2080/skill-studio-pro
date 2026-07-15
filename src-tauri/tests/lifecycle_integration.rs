use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;

use skill_studio_pro_lib::lifecycle::{
    DeleteExecuteInput, ImportConflictAction, ImportExecuteInput, ImportPlanInput, ImportSelection,
    ImportSourceType, LifecycleFaultPoint, PurgeExecuteInput, RestoreExecuteInput, RestoreMode,
    RestorePlanInput, SaveTextFileInput,
};
use skill_studio_pro_lib::services::lifecycle_service::LifecycleService;
use skill_studio_pro_lib::services::trash_service::TrashService;
use tempfile::TempDir;
use zip::write::SimpleFileOptions;

fn workspace() -> (TempDir, LifecycleService) {
    let temp = tempfile::tempdir().expect("temp workspace");
    let root = temp.path().join("workspace");
    fs::create_dir_all(&root).unwrap();
    skill_studio_pro_lib::db::init_db_at_path(&root).unwrap();
    let service = LifecycleService::new(root).unwrap();
    (temp, service)
}

fn write_skill(root: &Path, name: &str) {
    fs::create_dir_all(root).unwrap();
    fs::write(
        root.join("SKILL.md"),
        format!("---\nname: {name}\ndescription: test skill\n---\n\n# {name}\n"),
    )
    .unwrap();
}

fn local_input(path: &Path) -> ImportPlanInput {
    ImportPlanInput {
        source_type: ImportSourceType::LocalDirectory,
        local_path: Some(path.to_string_lossy().to_string()),
        git_url: None,
        zip_path: None,
        repo_subdir: None,
        branch: None,
        git_ref: None,
        commit: None,
        market_source: None,
        target_agents: vec!["codex".to_string(), "cursor".to_string()],
    }
}

fn install_local(
    service: &LifecycleService,
    source: &Path,
) -> skill_studio_pro_lib::lifecycle::ImportResult {
    let plan = service.create_import_plan(&local_input(source)).unwrap();
    service
        .execute_import_plan(&ImportExecuteInput {
            plan_id: plan.id,
            plan_hash: plan.plan_hash,
            selections: Vec::new(),
        })
        .unwrap()
}

#[test]
fn local_import_stages_previews_and_installs_to_central_library() {
    let (temp, service) = workspace();
    let source = temp.path().join("source/local-skill");
    let sentinel = temp.path().join("script-was-executed");
    write_skill(&source, "Local Skill");
    fs::create_dir_all(source.join("scripts")).unwrap();
    fs::write(
        source.join("scripts/run.sh"),
        format!("touch '{}'", sentinel.display()),
    )
    .unwrap();

    let plan = service.create_import_plan(&local_input(&source)).unwrap();
    assert_eq!(plan.candidates.len(), 1);
    assert_eq!(plan.candidates[0].file_count, 2);
    assert_eq!(plan.candidates[0].scripts, vec!["scripts/run.sh"]);
    assert_eq!(plan.candidates[0].target_agents, vec!["codex", "cursor"]);
    assert!(Path::new(&plan.staging_path).exists());
    assert!(!sentinel.exists());

    let result = service
        .execute_import_plan(&ImportExecuteInput {
            plan_id: plan.id.clone(),
            plan_hash: plan.plan_hash,
            selections: Vec::new(),
        })
        .unwrap();
    assert_eq!(result.status, "success");
    assert!(result.publish_deferred);
    assert!(!sentinel.exists());
    assert!(!Path::new(&plan.staging_path).exists());
    let imported = &result.imported[0];
    let conn = service.open_connection().unwrap();
    let storage: String = conn
        .query_row(
            "SELECT storage_rel_path FROM skills WHERE id = ?1",
            [&imported.skill_id],
            |row| row.get(0),
        )
        .unwrap();
    assert!(temp
        .path()
        .join("workspace/skills")
        .join(storage)
        .join("SKILL.md")
        .exists());
    let log_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM skill_import_logs WHERE plan_id = ?1 AND status = 'success'",
            [&plan.id],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(log_count, 1);
    let operation_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM operation_logs
             WHERE entity_id = ?1 AND operation_type = 'install' AND status = 'success'",
            [&imported.skill_id],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(operation_count, 1);
}

#[test]
fn lifecycle_migration_v4_creates_trash_journal_and_edit_state() {
    let (_temp, service) = workspace();
    let conn = service.open_connection().unwrap();
    assert_eq!(
        skill_studio_pro_lib::db::get_schema_version(&conn).unwrap(),
        skill_studio_pro_lib::db::CURRENT_SCHEMA_VERSION
    );
    for table in ["trash_entries", "edit_recovery_points", "staging_journals"] {
        let exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
                [table],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(exists, 1, "missing lifecycle table {table}");
    }
    let migration: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM schema_migrations WHERE version = 4 AND name = 'lifecycle_v4'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(migration, 1);
}

#[test]
fn stale_plan_rejects_modified_staging_and_cleans_it() {
    let (temp, service) = workspace();
    let source = temp.path().join("source/stale");
    write_skill(&source, "Stale Skill");
    let plan = service.create_import_plan(&local_input(&source)).unwrap();
    fs::write(
        Path::new(&plan.staging_path).join("source/SKILL.md"),
        "changed",
    )
    .unwrap();
    let error = service
        .execute_import_plan(&ImportExecuteInput {
            plan_id: plan.id,
            plan_hash: plan.plan_hash,
            selections: Vec::new(),
        })
        .unwrap_err();
    assert!(error.contains("PLAN_STALE"));
    assert!(!Path::new(&plan.staging_path).exists());
}

#[test]
fn conflicts_require_a_decision_and_support_rename_or_recovery_point_update() {
    let (temp, service) = workspace();
    let first_source = temp.path().join("source/conflict-first");
    write_skill(&first_source, "Conflict Skill");
    let first = install_local(&service, &first_source).imported.remove(0);

    let changed_source = temp.path().join("source/conflict-changed");
    write_skill(&changed_source, "Conflict Skill");
    fs::write(changed_source.join("notes.txt"), "changed content").unwrap();
    let rename_plan = service
        .create_import_plan(&local_input(&changed_source))
        .unwrap();
    assert!(!rename_plan.candidates[0].conflicts.is_empty());
    let missing_decision = service.execute_import_plan(&ImportExecuteInput {
        plan_id: rename_plan.id.clone(),
        plan_hash: rename_plan.plan_hash.clone(),
        selections: Vec::new(),
    });
    assert!(missing_decision
        .unwrap_err()
        .contains("CONFLICT_DECISION_REQUIRED"));
    let renamed = service
        .execute_import_plan(&ImportExecuteInput {
            plan_id: rename_plan.id,
            plan_hash: rename_plan.plan_hash,
            selections: vec![ImportSelection {
                candidate_id: rename_plan.candidates[0].id.clone(),
                action: ImportConflictAction::Rename,
                target_name: Some("Conflict Skill Copy".to_string()),
                existing_skill_id: None,
            }],
        })
        .unwrap();
    assert_eq!(renamed.imported[0].name, "Conflict Skill Copy");

    let update_plan = service
        .create_import_plan(&local_input(&changed_source))
        .unwrap();
    let updated = service
        .execute_import_plan(&ImportExecuteInput {
            plan_id: update_plan.id,
            plan_hash: update_plan.plan_hash,
            selections: vec![ImportSelection {
                candidate_id: update_plan.candidates[0].id.clone(),
                action: ImportConflictAction::Update,
                target_name: None,
                existing_skill_id: Some(first.skill_id.clone()),
            }],
        })
        .unwrap();
    assert_eq!(updated.imported[0].action, "update");
    let conn = service.open_connection().unwrap();
    let recovery_points: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM skill_snapshots
             WHERE skill_id = ?1 AND source = 'system'",
            [&first.skill_id],
            |row| row.get(0),
        )
        .unwrap();
    assert!(recovery_points >= 1);
}

#[test]
fn git_import_records_ref_commit_and_subdirectory() {
    let (temp, service) = workspace();
    let repository = temp.path().join("repository");
    fs::create_dir_all(repository.join("skills/git-skill")).unwrap();
    write_skill(&repository.join("skills/git-skill"), "Git Skill");
    run_git(&repository, &["init"]);
    run_git(
        &repository,
        &["config", "user.email", "tests@example.invalid"],
    );
    run_git(&repository, &["config", "user.name", "Lifecycle Tests"]);
    run_git(&repository, &["add", "."]);
    run_git(&repository, &["commit", "-m", "fixture"]);
    run_git(&repository, &["tag", "fixture-v1"]);
    let commit = git_output(&repository, &["rev-parse", "HEAD"]);

    let plan = service
        .create_import_plan(&ImportPlanInput {
            source_type: ImportSourceType::GitRepository,
            local_path: None,
            git_url: Some(repository.to_string_lossy().to_string()),
            zip_path: None,
            repo_subdir: Some("skills/git-skill".to_string()),
            branch: None,
            git_ref: None,
            commit: Some(commit.clone()),
            market_source: None,
            target_agents: Vec::new(),
        })
        .unwrap();
    assert_eq!(plan.provenance.commit.as_deref(), Some(commit.as_str()));
    assert_eq!(
        plan.provenance.repo_subdir.as_deref(),
        Some("skills/git-skill")
    );
    assert_eq!(plan.candidates.len(), 1);

    let branch_plan = service
        .create_import_plan(&ImportPlanInput {
            source_type: ImportSourceType::GitRepository,
            local_path: None,
            git_url: Some(repository.to_string_lossy().to_string()),
            zip_path: None,
            repo_subdir: Some("skills/git-skill".to_string()),
            branch: Some("master".to_string()),
            git_ref: None,
            commit: None,
            market_source: None,
            target_agents: Vec::new(),
        })
        .unwrap();
    assert_eq!(branch_plan.provenance.branch.as_deref(), Some("master"));
    assert_eq!(
        branch_plan.provenance.commit.as_deref(),
        Some(commit.as_str())
    );

    let ref_plan = service
        .create_import_plan(&ImportPlanInput {
            source_type: ImportSourceType::GitRepository,
            local_path: None,
            git_url: Some(repository.to_string_lossy().to_string()),
            zip_path: None,
            repo_subdir: Some("skills/git-skill".to_string()),
            branch: None,
            git_ref: Some("refs/tags/fixture-v1".to_string()),
            commit: None,
            market_source: None,
            target_agents: Vec::new(),
        })
        .unwrap();
    assert_eq!(
        ref_plan.provenance.git_ref.as_deref(),
        Some("refs/tags/fixture-v1")
    );
    assert_eq!(ref_plan.provenance.commit.as_deref(), Some(commit.as_str()));
}

#[test]
fn git_import_rejects_option_and_protocol_injection_before_execution() {
    let (_temp, service) = workspace();
    for (git_url, git_ref, repo_subdir, expected) in [
        (
            Some("--upload-pack=calc"),
            None,
            None,
            "INVALID_GIT_ARGUMENT",
        ),
        (Some("ext::sh -c calc"), None, None, "UNSAFE_GIT_PROTOCOL"),
    ] {
        let error = service
            .create_import_plan(&ImportPlanInput {
                source_type: ImportSourceType::GitRepository,
                local_path: None,
                git_url: git_url.map(str::to_string),
                zip_path: None,
                repo_subdir: repo_subdir.map(str::to_string),
                branch: None,
                git_ref: git_ref.map(str::to_string),
                commit: None,
                market_source: None,
                target_agents: Vec::new(),
            })
            .unwrap_err();
        assert!(error.contains(expected), "unexpected error: {error}");
    }
}

#[test]
fn zip_import_accepts_valid_archive_and_rejects_zip_slip() {
    let (temp, service) = workspace();
    let valid = temp.path().join("valid.zip");
    write_zip(
        &valid,
        &[("zip-skill/SKILL.md", "---\nname: Zip Skill\n---\n")],
    );
    let plan = service
        .create_import_plan(&ImportPlanInput {
            source_type: ImportSourceType::ZipArchive,
            local_path: None,
            git_url: None,
            zip_path: Some(valid.to_string_lossy().to_string()),
            repo_subdir: None,
            branch: None,
            git_ref: None,
            commit: None,
            market_source: None,
            target_agents: Vec::new(),
        })
        .unwrap();
    assert_eq!(plan.candidates[0].name, "Zip Skill");

    let malicious = temp.path().join("slip.zip");
    write_zip(&malicious, &[("../outside/SKILL.md", "# bad")]);
    let error = service
        .create_import_plan(&ImportPlanInput {
            zip_path: Some(malicious.to_string_lossy().to_string()),
            ..ImportPlanInput {
                source_type: ImportSourceType::ZipArchive,
                local_path: None,
                git_url: None,
                zip_path: None,
                repo_subdir: None,
                branch: None,
                git_ref: None,
                commit: None,
                market_source: None,
                target_agents: Vec::new(),
            }
        })
        .unwrap_err();
    assert!(error.contains("ZIP_SLIP"));
    assert!(!temp.path().join("outside").exists());

    let absolute = temp.path().join("absolute.zip");
    write_zip(&absolute, &[("/absolute/SKILL.md", "# bad")]);
    let absolute_error = service
        .create_import_plan(&zip_input(&absolute))
        .unwrap_err();
    assert!(absolute_error.contains("ZIP_SLIP"));

    let bomb = temp.path().join("bomb.zip");
    let file = fs::File::create(&bomb).unwrap();
    let mut archive = zip::ZipWriter::new(file);
    archive
        .start_file(
            "bomb/SKILL.md",
            SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated),
        )
        .unwrap();
    archive.write_all(&vec![0_u8; 8 * 1024 * 1024]).unwrap();
    archive.finish().unwrap();
    let bomb_error = service.create_import_plan(&zip_input(&bomb)).unwrap_err();
    assert!(bomb_error.contains("ZIP_BOMB"));
}

#[test]
fn marketplace_sources_use_the_same_staging_and_preview_pipeline() {
    let (temp, service) = workspace();
    let source = temp.path().join("market/resolved-skill");
    write_skill(&source, "Market Skill");
    let plan = service
        .create_import_plan(&ImportPlanInput {
            source_type: ImportSourceType::Marketplace,
            local_path: Some(source.to_string_lossy().to_string()),
            git_url: None,
            zip_path: None,
            repo_subdir: None,
            branch: None,
            git_ref: None,
            commit: None,
            market_source: Some("upstream-official".to_string()),
            target_agents: Vec::new(),
        })
        .unwrap();
    assert_eq!(plan.provenance.source_type, ImportSourceType::Marketplace);
    assert_eq!(
        plan.provenance.market_source.as_deref(),
        Some("upstream-official")
    );
    assert!(Path::new(&plan.staging_path)
        .join("source/SKILL.md")
        .exists());
}

#[test]
fn edit_creates_one_recovery_point_validates_path_and_marks_mappings_outdated() {
    let (temp, service) = workspace();
    let source = temp.path().join("source/edit");
    write_skill(&source, "Edit Skill");
    let imported = install_local(&service, &source).imported.remove(0);
    let conn = service.open_connection().unwrap();
    conn.execute(
        "INSERT INTO platform_release_targets (
            id, skill_id, platform_name, snapshot_id, target_path, sync_mode,
            drift_status, released_at, created_at, updated_at
         ) VALUES ('mapping-1', ?1, 'codex', ?2, 'unused', 'copy', 'in_sync', 1, 1, 1)",
        rusqlite::params![imported.skill_id, imported.snapshot_id],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO ai_artifacts (
            id, skill_id, task_type, provider_id, model_id, responsibility,
            prompt_version, input_hash, content_json, status, created_at
         ) VALUES ('artifact-edit', ?1, 'final_summary', 'openai', 'gpt-test',
            'summary', 'v1', 'before-edit', '{}', 'completed', 1)",
        [&imported.skill_id],
    )
    .unwrap();
    drop(conn);

    let first = service
        .save_text_file(&SaveTextFileInput {
            skill_id: imported.skill_id.clone(),
            relative_path: "SKILL.md".to_string(),
            content: "---\nname: Edit Skill\n---\n\n# edited\n".to_string(),
            edit_session_id: "session-1".to_string(),
        })
        .unwrap();
    assert!(first.recovery_point_created);
    assert_eq!(first.outdated_mapping_count, 1);
    let conn = service.open_connection().unwrap();
    let stale_at: Option<i64> = conn
        .query_row(
            "SELECT stale_at FROM ai_artifacts WHERE id = 'artifact-edit'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert!(stale_at.is_some(), "中央内容保存后 AI 产物必须标记 stale");
    drop(conn);
    let second = service
        .save_text_file(&SaveTextFileInput {
            skill_id: imported.skill_id.clone(),
            relative_path: "notes.json".to_string(),
            content: "{\"ok\":true}".to_string(),
            edit_session_id: "session-1".to_string(),
        })
        .unwrap();
    assert!(!second.recovery_point_created);
    assert_eq!(first.recovery_snapshot_id, second.recovery_snapshot_id);
    let traversal = service
        .save_text_file(&SaveTextFileInput {
            skill_id: imported.skill_id,
            relative_path: "../outside.txt".to_string(),
            content: "bad".to_string(),
            edit_session_id: "session-2".to_string(),
        })
        .unwrap_err();
    assert!(traversal.contains("PATH_TRAVERSAL"));
}

#[test]
fn trash_restore_and_purge_are_id_scoped_and_preserve_manifest() {
    let (temp, service) = workspace();
    let source = temp.path().join("source/trash");
    write_skill(&source, "Trash Skill");
    let imported = install_local(&service, &source).imported.remove(0);
    let trash = TrashService::new(temp.path().join("workspace"), temp.path().join("home")).unwrap();
    let plan = trash.create_delete_plan(&imported.skill_id).unwrap();
    let original = PathBuf::from(&plan.original_path);
    let entry = trash
        .execute_delete(&DeleteExecuteInput {
            plan_id: plan.id,
            plan_hash: plan.plan_hash,
        })
        .unwrap();
    assert!(!original.exists());
    assert!(Path::new(&entry.trash_path).exists());
    assert!(Path::new(&entry.manifest_path).exists());
    let restore = trash
        .create_restore_plan(&RestorePlanInput {
            trash_entry_id: entry.id.clone(),
            mode: RestoreMode::Original,
            new_name: None,
        })
        .unwrap();
    assert!(!restore.mappings_will_be_republished);
    trash
        .execute_restore(&RestoreExecuteInput {
            plan_id: restore.id,
            plan_hash: restore.plan_hash,
        })
        .unwrap();
    assert!(original.exists());

    let rename_delete = trash.create_delete_plan(&imported.skill_id).unwrap();
    let rename_entry = trash
        .execute_delete(&DeleteExecuteInput {
            plan_id: rename_delete.id,
            plan_hash: rename_delete.plan_hash,
        })
        .unwrap();
    let rename_restore = trash
        .create_restore_plan(&RestorePlanInput {
            trash_entry_id: rename_entry.id,
            mode: RestoreMode::NewName,
            new_name: Some("Trash Skill Restored".to_string()),
        })
        .unwrap();
    trash
        .execute_restore(&RestoreExecuteInput {
            plan_id: rename_restore.id,
            plan_hash: rename_restore.plan_hash,
        })
        .unwrap();
    let conn = service.open_connection().unwrap();
    let restored_name: String = conn
        .query_row(
            "SELECT name FROM skills WHERE id = ?1",
            [&imported.skill_id],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(restored_name, "Trash Skill Restored");
    drop(conn);

    let second_source = temp.path().join("source/purge");
    write_skill(&second_source, "Purge Skill");
    let second = install_local(&service, &second_source).imported.remove(0);
    let delete = trash.create_delete_plan(&second.skill_id).unwrap();
    let entry = trash
        .execute_delete(&DeleteExecuteInput {
            plan_id: delete.id,
            plan_hash: delete.plan_hash,
        })
        .unwrap();
    let invalid = trash.execute_purge(&PurgeExecuteInput {
        trash_entry_id: entry.id.clone(),
        confirmation_token: temp.path().to_string_lossy().to_string(),
    });
    assert!(invalid.unwrap_err().contains("PURGE_CONFIRMATION"));
    assert!(temp.path().exists());
    let original_trash_path = entry.trash_path.clone();
    let protected = temp.path().join("protected");
    write_skill(&protected, "Protected");
    let conn = service.open_connection().unwrap();
    conn.execute(
        "UPDATE trash_entries SET trash_path = ?2 WHERE id = ?1",
        rusqlite::params![entry.id, protected.to_string_lossy()],
    )
    .unwrap();
    drop(conn);
    let confirmation = trash.create_purge_confirmation(&entry.id).unwrap();
    let escaped = trash.execute_purge(&PurgeExecuteInput {
        trash_entry_id: entry.id.clone(),
        confirmation_token: confirmation.confirmation_token,
    });
    assert!(escaped.unwrap_err().contains("PATH_OUTSIDE_ALLOWED_ROOT"));
    assert!(protected.join("SKILL.md").exists());
    let conn = service.open_connection().unwrap();
    conn.execute(
        "UPDATE trash_entries SET trash_path = ?2 WHERE id = ?1",
        rusqlite::params![entry.id, original_trash_path],
    )
    .unwrap();
    drop(conn);
    let confirmation = trash.create_purge_confirmation(&entry.id).unwrap();
    trash
        .execute_purge(&PurgeExecuteInput {
            trash_entry_id: entry.id.clone(),
            confirmation_token: confirmation.confirmation_token,
        })
        .unwrap();
    assert!(trash.list().unwrap().iter().all(|item| item.id != entry.id));
}

#[test]
fn restore_conflict_never_overwrites_and_expired_purge_token_is_rejected() {
    let (temp, service) = workspace();
    let source = temp.path().join("source/restore-conflict");
    write_skill(&source, "Restore Conflict");
    let imported = install_local(&service, &source).imported.remove(0);
    let trash = TrashService::new(temp.path().join("workspace"), temp.path().join("home")).unwrap();
    let delete = trash.create_delete_plan(&imported.skill_id).unwrap();
    let original = PathBuf::from(&delete.original_path);
    let entry = trash
        .execute_delete(&DeleteExecuteInput {
            plan_id: delete.id,
            plan_hash: delete.plan_hash,
        })
        .unwrap();
    write_skill(&original, "Unmanaged Occupant");
    let conflict = trash
        .create_restore_plan(&RestorePlanInput {
            trash_entry_id: entry.id.clone(),
            mode: RestoreMode::Original,
            new_name: None,
        })
        .unwrap();
    assert_eq!(conflict.conflict.as_deref(), Some("target_exists"));
    let error = trash
        .execute_restore(&RestoreExecuteInput {
            plan_id: conflict.id,
            plan_hash: conflict.plan_hash,
        })
        .unwrap_err();
    assert!(error.contains("RESTORE_CONFLICT"));
    assert!(Path::new(&entry.trash_path).exists());
    assert!(fs::read_to_string(original.join("SKILL.md"))
        .unwrap()
        .contains("Unmanaged Occupant"));

    let confirmation = trash.create_purge_confirmation(&entry.id).unwrap();
    let conn = service.open_connection().unwrap();
    conn.execute(
        "UPDATE trash_entries SET confirmation_expires_at = 0 WHERE id = ?1",
        [&entry.id],
    )
    .unwrap();
    drop(conn);
    let expired = trash
        .execute_purge(&PurgeExecuteInput {
            trash_entry_id: entry.id.clone(),
            confirmation_token: confirmation.confirmation_token,
        })
        .unwrap_err();
    assert!(expired.contains("PURGE_CONFIRMATION_INVALID_OR_EXPIRED"));
    assert!(Path::new(&entry.trash_path).exists());

    let renamed = trash
        .create_restore_plan(&RestorePlanInput {
            trash_entry_id: entry.id,
            mode: RestoreMode::NewName,
            new_name: Some("Restore Conflict Recovered".to_string()),
        })
        .unwrap();
    let restored = trash
        .execute_restore(&RestoreExecuteInput {
            plan_id: renamed.id,
            plan_hash: renamed.plan_hash,
        })
        .unwrap();
    assert_eq!(restored.status, "restored");
}

#[test]
fn injected_file_transaction_failures_leave_old_or_recoverable_state() {
    let (temp, service) = workspace();
    let workspace_root = temp.path().join("workspace");
    let source = temp.path().join("source/fault");
    write_skill(&source, "Fault Skill");

    let staged_fault = LifecycleService::with_fault(
        workspace_root.clone(),
        LifecycleFaultPoint::AfterSourceStaged,
    )
    .unwrap();
    assert!(staged_fault
        .create_import_plan(&local_input(&source))
        .is_err());
    assert_eq!(
        fs::read_dir(workspace_root.join("staging/import"))
            .unwrap()
            .count(),
        0
    );

    let plan = service.create_import_plan(&local_input(&source)).unwrap();
    let database_fault = LifecycleService::with_fault(
        workspace_root.clone(),
        LifecycleFaultPoint::BeforeDatabaseCommit,
    )
    .unwrap();
    assert!(database_fault
        .execute_import_plan(&ImportExecuteInput {
            plan_id: plan.id,
            plan_hash: plan.plan_hash,
            selections: Vec::new(),
        })
        .is_err());
    let conn = service.open_connection().unwrap();
    let skill_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM skills", [], |row| row.get(0))
        .unwrap();
    assert_eq!(skill_count, 0);

    let imported = install_local(&service, &source).imported.remove(0);
    let conn = service.open_connection().unwrap();
    let storage: String = conn
        .query_row(
            "SELECT storage_rel_path FROM skills WHERE id = ?1",
            [&imported.skill_id],
            |row| row.get(0),
        )
        .unwrap();
    drop(conn);
    let skill_md = workspace_root.join("skills").join(storage).join("SKILL.md");
    let before = fs::read_to_string(&skill_md).unwrap();
    let edit_fault = LifecycleService::with_fault(
        workspace_root.clone(),
        LifecycleFaultPoint::BeforeAtomicEditReplace,
    )
    .unwrap();
    assert!(edit_fault
        .save_text_file(&SaveTextFileInput {
            skill_id: imported.skill_id.clone(),
            relative_path: "SKILL.md".to_string(),
            content: "replacement".to_string(),
            edit_session_id: "fault-edit".to_string(),
        })
        .is_err());
    assert_eq!(fs::read_to_string(&skill_md).unwrap(), before);

    let trash_fault = TrashService::with_fault(
        workspace_root.clone(),
        temp.path().join("home"),
        LifecycleFaultPoint::AfterTrashMove,
    )
    .unwrap();
    let delete = trash_fault.create_delete_plan(&imported.skill_id).unwrap();
    assert!(trash_fault
        .execute_delete(&DeleteExecuteInput {
            plan_id: delete.id,
            plan_hash: delete.plan_hash,
        })
        .is_err());
    assert!(!skill_md.exists());
    let report = service.recover_staging().unwrap();
    assert_eq!(report.errors, Vec::<String>::new());
    assert!(skill_md.exists());

    let trash = TrashService::new(workspace_root.clone(), temp.path().join("home")).unwrap();
    let delete = trash.create_delete_plan(&imported.skill_id).unwrap();
    let entry = trash
        .execute_delete(&DeleteExecuteInput {
            plan_id: delete.id,
            plan_hash: delete.plan_hash,
        })
        .unwrap();
    let restore = trash
        .create_restore_plan(&RestorePlanInput {
            trash_entry_id: entry.id,
            mode: RestoreMode::Original,
            new_name: None,
        })
        .unwrap();
    let restore_fault = TrashService::with_fault(
        workspace_root,
        temp.path().join("home"),
        LifecycleFaultPoint::AfterRestoreMove,
    )
    .unwrap();
    assert!(restore_fault
        .execute_restore(&RestoreExecuteInput {
            plan_id: restore.id,
            plan_hash: restore.plan_hash,
        })
        .is_err());
    assert!(skill_md.exists());
    let report = service.recover_staging().unwrap();
    assert_eq!(report.errors, Vec::<String>::new());
    assert!(!skill_md.exists());
    let pending = trash.list().unwrap().remove(0);
    let confirmation = trash.create_purge_confirmation(&pending.id).unwrap();
    let purge_fault = TrashService::with_fault(
        temp.path().join("workspace"),
        temp.path().join("home"),
        LifecycleFaultPoint::AfterPurgeMove,
    )
    .unwrap();
    assert!(purge_fault
        .execute_purge(&PurgeExecuteInput {
            trash_entry_id: pending.id.clone(),
            confirmation_token: confirmation.confirmation_token,
        })
        .is_err());
    assert!(!Path::new(&pending.trash_path).exists());
    let report = service.recover_staging().unwrap();
    assert_eq!(report.errors, Vec::<String>::new());
    assert!(Path::new(&pending.trash_path).exists());
}

fn run_git(repository: &Path, args: &[&str]) {
    let status = Command::new("git")
        .arg("-C")
        .arg(repository)
        .args(args)
        .status()
        .unwrap();
    assert!(status.success());
}

fn git_output(repository: &Path, args: &[&str]) -> String {
    let output = Command::new("git")
        .arg("-C")
        .arg(repository)
        .args(args)
        .output()
        .unwrap();
    assert!(output.status.success());
    String::from_utf8(output.stdout).unwrap().trim().to_string()
}

fn write_zip(path: &Path, entries: &[(&str, &str)]) {
    let file = fs::File::create(path).unwrap();
    let mut archive = zip::ZipWriter::new(file);
    for (name, content) in entries {
        archive
            .start_file(*name, SimpleFileOptions::default())
            .unwrap();
        archive.write_all(content.as_bytes()).unwrap();
    }
    archive.finish().unwrap();
}

fn zip_input(path: &Path) -> ImportPlanInput {
    ImportPlanInput {
        source_type: ImportSourceType::ZipArchive,
        local_path: None,
        git_url: None,
        zip_path: Some(path.to_string_lossy().to_string()),
        repo_subdir: None,
        branch: None,
        git_ref: None,
        commit: None,
        market_source: None,
        target_agents: Vec::new(),
    }
}
