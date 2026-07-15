use std::collections::{BTreeMap, HashSet};
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};
use skill_studio_pro_lib::inventory::model::{
    InstanceListInput, ScanMode, ScanRootUpsertInput, ScanStartInput,
};
use skill_studio_pro_lib::platform::{PlatformContext, PlatformRegistry, SymlinkCapability};
use skill_studio_pro_lib::services::library_service::{
    ExecutePlanInput, LibraryService, RegisterInstancePlanInput,
};
use skill_studio_pro_lib::services::mapping_service::{
    MappingService, PublishFailurePoint, PublishPlanInput, PublishTargetInput, RemoveMappingInput,
};
use skill_studio_pro_lib::{db, inventory};

fn temp_dir(name: &str) -> PathBuf {
    let path = std::env::temp_dir()
        .join("skill-studio-pro-tests")
        .join(format!("{name}-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&path).unwrap();
    path
}

fn write(path: &Path, content: &str) {
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(path, content).unwrap();
}

fn tree_hashes(root: &Path) -> BTreeMap<String, String> {
    fn visit(root: &Path, current: &Path, output: &mut BTreeMap<String, String>) {
        for entry in std::fs::read_dir(current).unwrap() {
            let entry = entry.unwrap();
            let metadata = std::fs::symlink_metadata(entry.path()).unwrap();
            if metadata.is_dir() {
                visit(root, &entry.path(), output);
            } else if metadata.is_file() {
                let relative = entry
                    .path()
                    .strip_prefix(root)
                    .unwrap()
                    .to_string_lossy()
                    .replace('\\', "/");
                output.insert(
                    relative,
                    format!("{:x}", Sha256::digest(std::fs::read(entry.path()).unwrap())),
                );
            }
        }
    }
    let mut output = BTreeMap::new();
    visit(root, root, &mut output);
    output
}

fn registered_fixture() -> (PathBuf, PathBuf, PathBuf, String, String) {
    let workspace = temp_dir("library-workspace");
    let home = temp_dir("library-home");
    let external = temp_dir("library-external");
    write(
        &external.join("demo/SKILL.md"),
        "---\nname: Demo Skill\ndescription: central fixture\n---\n# Demo\n",
    );
    write(&external.join("demo/references/guide.md"), "guide\n");
    let conn = db::init_db_at_path(&workspace).unwrap();
    let root = inventory::service::root_upsert(
        &conn,
        &ScanRootUpsertInput {
            id: None,
            root_type: "custom".to_string(),
            platform_name: Some("claude".to_string()),
            path: external.to_string_lossy().to_string(),
            enabled: Some(true),
            recursive: Some(true),
            watch_enabled: Some(false),
            ignore_rules: Vec::new(),
        },
    )
    .unwrap();
    drop(conn);
    inventory::service::run_scan_at_path(
        &workspace,
        &home,
        &ScanStartInput {
            mode: ScanMode::Full,
            root_ids: vec![root.id],
        },
    )
    .unwrap();
    let conn = rusqlite::Connection::open(workspace.join("metadata.db")).unwrap();
    let instance = inventory::service::instance_list(
        &conn,
        &InstanceListInput {
            limit: Some(10),
            ..Default::default()
        },
    )
    .unwrap()
    .items
    .into_iter()
    .next()
    .unwrap();
    drop(conn);
    let before = tree_hashes(&external.join("demo"));
    let library = LibraryService::new(workspace.clone()).unwrap();
    let plan = library
        .create_register_plan(&RegisterInstancePlanInput {
            instance_id: instance.id.clone(),
            slug: Some("demo-stable".to_string()),
        })
        .unwrap();
    let central = library
        .execute_register_plan(&ExecutePlanInput {
            plan_id: plan.id,
            plan_hash: plan.plan_hash,
        })
        .unwrap();
    assert_eq!(before, tree_hashes(&external.join("demo")));
    let conn = rusqlite::Connection::open(workspace.join("metadata.db")).unwrap();
    let snapshot_id: String = conn
        .query_row(
            "SELECT id FROM skill_snapshots WHERE skill_id = ?1 AND snapshot_number = 1",
            [&central.id],
            |row| row.get(0),
        )
        .unwrap();
    (workspace, home, external, central.id, snapshot_id)
}

fn configure_platform(workspace: &Path, platform: &str, root: &Path) {
    let conn = rusqlite::Connection::open(workspace.join("metadata.db")).unwrap();
    conn.execute(
        "INSERT INTO platform_connections (
            id, platform_name, display_name, platform_type, detected, enabled,
            skills_dir, detect_dir, sync_mode, supports_project_scope,
            supports_symlink, supports_copy
         ) VALUES (?1, ?1, ?1, 'built_in', 1, 1, ?2, ?2, 'copy', 1, 1, 1)
         ON CONFLICT(platform_name) DO UPDATE SET detected = 1, enabled = 1,
            skills_dir = excluded.skills_dir, detect_dir = excluded.detect_dir",
        rusqlite::params![platform, root.to_string_lossy()],
    )
    .unwrap();
}

#[test]
fn migration_v2_extends_central_mapping_tables() {
    let workspace = temp_dir("library-migration");
    let conn = db::init_db_at_path(&workspace).unwrap();
    assert_eq!(
        db::get_schema_version(&conn).unwrap(),
        db::CURRENT_SCHEMA_VERSION
    );
    let migration: String = conn
        .query_row(
            "SELECT name FROM schema_migrations WHERE version = 2",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(migration, "library_mapping_v2");
    for table in [
        "library_operation_plans",
        "operation_locks",
        "operation_logs",
    ] {
        let exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?1)",
                [table],
                |row| row.get(0),
            )
            .unwrap();
        assert!(exists, "missing {table}");
    }
    let release_columns = conn
        .prepare("PRAGMA table_info(platform_release_targets)")
        .unwrap()
        .query_map([], |row| row.get::<_, String>(1))
        .unwrap()
        .collect::<Result<HashSet<_>, _>>()
        .unwrap();
    for column in [
        "target_path",
        "sync_mode",
        "published_content_hash",
        "observed_target_hash",
        "drift_status",
        "ownership_token",
    ] {
        assert!(release_columns.contains(column), "missing {column}");
    }
}

#[test]
fn registration_copies_source_and_slug_change_does_not_change_storage_identity() {
    let (workspace, _, _, skill_id, _) = registered_fixture();
    let library = LibraryService::new(workspace.clone()).unwrap();
    let before = library.get(&skill_id).unwrap();
    assert!(before.storage_rel_path.starts_with(&format!("{skill_id}/")));
    let conn = rusqlite::Connection::open(workspace.join("metadata.db")).unwrap();
    conn.execute(
        "UPDATE skills SET slug = 'renamed-display-slug' WHERE id = ?1",
        [&skill_id],
    )
    .unwrap();
    let after = library.get(&skill_id).unwrap();
    assert_eq!(before.id, after.id);
    assert_eq!(before.storage_path, after.storage_path);
    assert!(Path::new(&after.storage_path).join("SKILL.md").is_file());
}

#[test]
fn five_primary_adapters_share_cross_platform_directory_contract() {
    let home = temp_dir("adapter-home");
    let registry = PlatformRegistry::from_upstream(&home);
    let expected = [
        ("codex", ".codex/skills"),
        ("claude", ".claude/skills"),
        ("cursor", ".cursor/skills"),
        ("windsurf", ".codeium/windsurf/skills"),
        ("gemini", ".gemini/skills"),
    ];
    for (id, relative) in expected {
        let adapter = registry.get(id).unwrap();
        assert!(adapter.is_dedicated());
        let root = home.join(relative);
        assert_eq!(adapter.default_global_skills_dir(&home).unwrap(), root);
        assert!(
            !adapter
                .detect(&PlatformContext { home: home.clone() })
                .detected
        );
        std::fs::create_dir_all(&root).unwrap();
        assert!(
            adapter
                .detect(&PlatformContext { home: home.clone() })
                .detected
        );
        let target = root.join("demo");
        adapter.validate_target(&root, &target).unwrap();
        assert!(adapter.normalize_target_name("../escape").is_err());
        assert!(matches!(
            adapter.symlink_capability(),
            SymlinkCapability::Supported | SymlinkCapability::RequiresPrivilegeProbe
        ));
    }
    assert!(registry.all().len() >= 40);
}

#[test]
fn five_primary_adapters_publish_drift_overwrite_and_remove_contract() {
    let (workspace, home, _, skill_id, snapshot_id) = registered_fixture();
    let platforms = [
        ("codex", ".codex/skills"),
        ("claude", ".claude/skills"),
        ("cursor", ".cursor/skills"),
        ("windsurf", ".codeium/windsurf/skills"),
        ("gemini", ".gemini/skills"),
    ];
    for (platform, relative) in platforms {
        let root = home.join(relative);
        std::fs::create_dir_all(&root).unwrap();
        configure_platform(&workspace, platform, &root);
    }
    let mapping = MappingService::new(workspace.clone(), home.clone()).unwrap();
    let targets = platforms
        .iter()
        .map(|(platform, _)| PublishTargetInput {
            platform_name: (*platform).to_string(),
            sync_mode: Some("copy".to_string()),
            drift_policy: "abort".to_string(),
        })
        .collect();
    let plan = mapping
        .create_publish_plan(&PublishPlanInput {
            skill_id: skill_id.clone(),
            snapshot_id: snapshot_id.clone(),
            targets,
        })
        .unwrap();
    let published = mapping
        .execute_publish_plan(&ExecutePlanInput {
            plan_id: plan.id,
            plan_hash: plan.plan_hash,
        })
        .unwrap();
    assert_eq!(published.targets.len(), 5);
    assert!(published
        .targets
        .iter()
        .all(|target| target.status == "success"));
    for (_, relative) in platforms {
        write(
            &home.join(relative).join("demo-stable/drift.txt"),
            "external\n",
        );
    }
    let drift = mapping.detect_drift(&skill_id).unwrap();
    assert_eq!(drift.len(), 5);
    assert!(drift.iter().all(|state| state.drift_status == "drifted"));
    let overwrite = mapping
        .create_publish_plan(&PublishPlanInput {
            skill_id: skill_id.clone(),
            snapshot_id,
            targets: platforms
                .iter()
                .map(|(platform, _)| PublishTargetInput {
                    platform_name: (*platform).to_string(),
                    sync_mode: Some("copy".to_string()),
                    drift_policy: "overwrite".to_string(),
                })
                .collect(),
        })
        .unwrap();
    assert!(overwrite
        .targets
        .iter()
        .all(|target| target.status == "ready"));
    let overwritten = mapping
        .execute_publish_plan(&ExecutePlanInput {
            plan_id: overwrite.id,
            plan_hash: overwrite.plan_hash,
        })
        .unwrap();
    assert_eq!(overwritten.status, "success");
    for (platform, relative) in platforms {
        let target = home.join(relative).join("demo-stable");
        assert!(!target.join("drift.txt").exists());
        mapping
            .remove_mapping(&RemoveMappingInput {
                skill_id: skill_id.clone(),
                platform_name: platform.to_string(),
            })
            .unwrap();
        assert!(!target.exists());
    }
    assert!(LibraryService::new(workspace)
        .unwrap()
        .get(&skill_id)
        .is_ok());
}

#[test]
fn publish_detects_drift_and_remove_keeps_central_master() {
    let (workspace, home, _, skill_id, snapshot_id) = registered_fixture();
    let codex = home.join(".codex/skills");
    std::fs::create_dir_all(&codex).unwrap();
    configure_platform(&workspace, "codex", &codex);
    let mapping = MappingService::new(workspace.clone(), home.clone()).unwrap();
    let plan = mapping
        .create_publish_plan(&PublishPlanInput {
            skill_id: skill_id.clone(),
            snapshot_id: snapshot_id.clone(),
            targets: vec![PublishTargetInput {
                platform_name: "codex".to_string(),
                sync_mode: None,
                drift_policy: "abort".to_string(),
            }],
        })
        .unwrap();
    let result = mapping
        .execute_publish_plan(&ExecutePlanInput {
            plan_id: plan.id,
            plan_hash: plan.plan_hash,
        })
        .unwrap();
    assert_eq!(result.status, "success");
    let target = codex.join("demo-stable");
    let conn = rusqlite::Connection::open(workspace.join("metadata.db")).unwrap();
    conn.execute(
        "UPDATE skills SET slug = 'renamed-after-publish' WHERE id = ?1",
        [&skill_id],
    )
    .unwrap();
    let identity_plan = mapping
        .create_publish_plan(&PublishPlanInput {
            skill_id: skill_id.clone(),
            snapshot_id: snapshot_id.clone(),
            targets: vec![PublishTargetInput {
                platform_name: "codex".to_string(),
                sync_mode: Some("copy".to_string()),
                drift_policy: "abort".to_string(),
            }],
        })
        .unwrap();
    assert_eq!(Path::new(&identity_plan.targets[0].target_path), target);
    write(&target.join("SKILL.md"), "# externally changed\n");
    let drift = mapping.detect_drift(&skill_id).unwrap();
    assert_eq!(drift[0].drift_status, "drifted");
    let blocked = mapping
        .create_publish_plan(&PublishPlanInput {
            skill_id: skill_id.clone(),
            snapshot_id,
            targets: vec![PublishTargetInput {
                platform_name: "codex".to_string(),
                sync_mode: Some("copy".to_string()),
                drift_policy: "abort".to_string(),
            }],
        })
        .unwrap();
    assert_eq!(blocked.targets[0].status, "blocked");
    mapping
        .remove_mapping(&RemoveMappingInput {
            skill_id: skill_id.clone(),
            platform_name: "codex".to_string(),
        })
        .unwrap();
    assert!(!target.exists());
    assert!(LibraryService::new(workspace)
        .unwrap()
        .get(&skill_id)
        .is_ok());
}

#[test]
fn multi_target_publish_reports_partial_success() {
    let (workspace, home, _, skill_id, snapshot_id) = registered_fixture();
    let codex = home.join(".codex/skills");
    let cursor = home.join(".cursor/skills");
    std::fs::create_dir_all(&codex).unwrap();
    std::fs::create_dir_all(cursor.join("demo-stable")).unwrap();
    write(&cursor.join("demo-stable/SKILL.md"), "# unmanaged\n");
    configure_platform(&workspace, "codex", &codex);
    configure_platform(&workspace, "cursor", &cursor);
    let mapping = MappingService::new(workspace, home).unwrap();
    let plan = mapping
        .create_publish_plan(&PublishPlanInput {
            skill_id,
            snapshot_id,
            targets: vec![
                PublishTargetInput {
                    platform_name: "codex".to_string(),
                    sync_mode: None,
                    drift_policy: "abort".to_string(),
                },
                PublishTargetInput {
                    platform_name: "cursor".to_string(),
                    sync_mode: None,
                    drift_policy: "abort".to_string(),
                },
            ],
        })
        .unwrap();
    let result = mapping
        .execute_publish_plan(&ExecutePlanInput {
            plan_id: plan.id,
            plan_hash: plan.plan_hash,
        })
        .unwrap();
    assert_eq!(result.status, "partial_success");
    assert_eq!(
        result
            .targets
            .iter()
            .filter(|target| target.status == "success")
            .count(),
        1
    );
    assert_eq!(
        std::fs::read_to_string(cursor.join("demo-stable/SKILL.md")).unwrap(),
        "# unmanaged\n"
    );
}

#[test]
fn failure_after_backup_restores_original_target() {
    let (workspace, home, _, skill_id, snapshot_id) = registered_fixture();
    let root = home.join(".codex/skills");
    std::fs::create_dir_all(&root).unwrap();
    configure_platform(&workspace, "codex", &root);
    let mapping = MappingService::new(workspace.clone(), home.clone()).unwrap();
    let first = mapping
        .create_publish_plan(&PublishPlanInput {
            skill_id: skill_id.clone(),
            snapshot_id: snapshot_id.clone(),
            targets: vec![PublishTargetInput {
                platform_name: "codex".to_string(),
                sync_mode: None,
                drift_policy: "abort".to_string(),
            }],
        })
        .unwrap();
    mapping
        .execute_publish_plan(&ExecutePlanInput {
            plan_id: first.id,
            plan_hash: first.plan_hash,
        })
        .unwrap();
    let target = root.join("demo-stable");
    let original = tree_hashes(&target);
    let retry = mapping
        .create_publish_plan(&PublishPlanInput {
            skill_id,
            snapshot_id,
            targets: vec![PublishTargetInput {
                platform_name: "codex".to_string(),
                sync_mode: None,
                drift_policy: "abort".to_string(),
            }],
        })
        .unwrap();
    let failing =
        MappingService::with_failure(workspace, home, PublishFailurePoint::AfterBackup).unwrap();
    let result = failing
        .execute_publish_plan(&ExecutePlanInput {
            plan_id: retry.id,
            plan_hash: retry.plan_hash,
        })
        .unwrap();
    assert_eq!(result.status, "failed");
    assert_eq!(tree_hashes(&target), original);
}

#[test]
fn operation_lock_and_expired_plan_are_enforced() {
    let (workspace, home, _, skill_id, snapshot_id) = registered_fixture();
    let root = home.join(".codex/skills");
    std::fs::create_dir_all(&root).unwrap();
    configure_platform(&workspace, "codex", &root);
    let mapping = MappingService::new(workspace.clone(), home).unwrap();
    let make_plan = || {
        mapping
            .create_publish_plan(&PublishPlanInput {
                skill_id: skill_id.clone(),
                snapshot_id: snapshot_id.clone(),
                targets: vec![PublishTargetInput {
                    platform_name: "codex".to_string(),
                    sync_mode: None,
                    drift_policy: "abort".to_string(),
                }],
            })
            .unwrap()
    };
    let locked = make_plan();
    let conn = rusqlite::Connection::open(workspace.join("metadata.db")).unwrap();
    conn.execute(
        "INSERT INTO operation_locks (resource_key, operation_id, acquired_at, expires_at)
         VALUES (?1, 'other-operation', 1, ?2)",
        rusqlite::params![format!("skill:{skill_id}"), i64::MAX],
    )
    .unwrap();
    let locked_result = mapping
        .execute_publish_plan(&ExecutePlanInput {
            plan_id: locked.id,
            plan_hash: locked.plan_hash,
        })
        .unwrap();
    assert_eq!(
        locked_result.targets[0].error_code.as_deref(),
        Some("OPERATION_LOCKED")
    );
    conn.execute("DELETE FROM operation_locks", []).unwrap();

    let expired = make_plan();
    let payload: String = conn
        .query_row(
            "SELECT payload_json FROM library_operation_plans WHERE id = ?1",
            [&expired.id],
            |row| row.get(0),
        )
        .unwrap();
    let mut value: serde_json::Value = serde_json::from_str(&payload).unwrap();
    value["expiresAt"] = serde_json::json!(0);
    conn.execute(
        "UPDATE library_operation_plans SET payload_json = ?2 WHERE id = ?1",
        rusqlite::params![expired.id, value.to_string()],
    )
    .unwrap();
    let error = mapping
        .execute_publish_plan(&ExecutePlanInput {
            plan_id: expired.id,
            plan_hash: expired.plan_hash,
        })
        .unwrap_err();
    assert!(error.starts_with("PLAN_STALE:"));
}

#[test]
fn symlink_mode_is_explicitly_probed_and_never_silently_downgrades() {
    let (workspace, home, _, skill_id, snapshot_id) = registered_fixture();
    let root = home.join(".codex/skills");
    std::fs::create_dir_all(&root).unwrap();
    configure_platform(&workspace, "codex", &root);
    let mapping = MappingService::new(workspace, home).unwrap();
    let plan = mapping
        .create_publish_plan(&PublishPlanInput {
            skill_id,
            snapshot_id,
            targets: vec![PublishTargetInput {
                platform_name: "codex".to_string(),
                sync_mode: Some("symlink".to_string()),
                drift_policy: "abort".to_string(),
            }],
        })
        .unwrap();
    assert_eq!(plan.targets[0].sync_mode, "symlink");
    let result = mapping
        .execute_publish_plan(&ExecutePlanInput {
            plan_id: plan.id,
            plan_hash: plan.plan_hash,
        })
        .unwrap();
    if result.status == "success" {
        assert!(std::fs::symlink_metadata(&result.targets[0].target_path)
            .unwrap()
            .file_type()
            .is_symlink());
    } else {
        assert_eq!(
            result.targets[0].error_code.as_deref(),
            Some("SYMLINK_UNAVAILABLE")
        );
        assert!(!Path::new(&result.targets[0].target_path).exists());
    }
}

#[test]
fn removal_refuses_a_target_that_lost_its_ownership_marker() {
    let (workspace, home, _, skill_id, snapshot_id) = registered_fixture();
    let root = home.join(".codex/skills");
    std::fs::create_dir_all(&root).unwrap();
    configure_platform(&workspace, "codex", &root);
    let mapping = MappingService::new(workspace.clone(), home).unwrap();
    let plan = mapping
        .create_publish_plan(&PublishPlanInput {
            skill_id: skill_id.clone(),
            snapshot_id,
            targets: vec![PublishTargetInput {
                platform_name: "codex".to_string(),
                sync_mode: Some("copy".to_string()),
                drift_policy: "abort".to_string(),
            }],
        })
        .unwrap();
    mapping
        .execute_publish_plan(&ExecutePlanInput {
            plan_id: plan.id,
            plan_hash: plan.plan_hash,
        })
        .unwrap();
    let target = root.join("demo-stable");
    std::fs::remove_file(target.join(".skill-studio-pro-managed.json")).unwrap();
    let error = mapping
        .remove_mapping(&RemoveMappingInput {
            skill_id: skill_id.clone(),
            platform_name: "codex".to_string(),
        })
        .unwrap_err();
    assert!(error.starts_with("OWNERSHIP_MISMATCH:"));
    assert!(target.is_dir());
    assert!(LibraryService::new(workspace)
        .unwrap()
        .get(&skill_id)
        .is_ok());
}

#[test]
fn every_publish_failure_point_preserves_the_previous_target() {
    let (workspace, home, _, skill_id, snapshot_id) = registered_fixture();
    let root = home.join(".codex/skills");
    std::fs::create_dir_all(&root).unwrap();
    configure_platform(&workspace, "codex", &root);
    let mapping = MappingService::new(workspace.clone(), home.clone()).unwrap();
    let input = || PublishPlanInput {
        skill_id: skill_id.clone(),
        snapshot_id: snapshot_id.clone(),
        targets: vec![PublishTargetInput {
            platform_name: "codex".to_string(),
            sync_mode: Some("copy".to_string()),
            drift_policy: "abort".to_string(),
        }],
    };
    let initial = mapping.create_publish_plan(&input()).unwrap();
    mapping
        .execute_publish_plan(&ExecutePlanInput {
            plan_id: initial.id,
            plan_hash: initial.plan_hash,
        })
        .unwrap();
    let target = root.join("demo-stable");
    let original = tree_hashes(&target);
    for point in [
        PublishFailurePoint::AfterStaging,
        PublishFailurePoint::AfterBackup,
        PublishFailurePoint::AfterReplace,
        PublishFailurePoint::BeforeDatabaseCommit,
    ] {
        let plan = mapping.create_publish_plan(&input()).unwrap();
        let failing = MappingService::with_failure(workspace.clone(), home.clone(), point).unwrap();
        let result = failing
            .execute_publish_plan(&ExecutePlanInput {
                plan_id: plan.id,
                plan_hash: plan.plan_hash,
            })
            .unwrap();
        assert_eq!(result.status, "failed");
        assert_eq!(tree_hashes(&target), original);
    }
}
