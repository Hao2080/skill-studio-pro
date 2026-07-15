use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use sha2::{Digest, Sha256};
use skill_studio_pro_lib::inventory::model::{
    InstanceListInput, ScanMode, ScanRootUpsertInput, ScanStartInput,
};
use skill_studio_pro_lib::{db, inventory, origin};

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

fn snapshot_tree(root: &Path) -> BTreeMap<String, (u64, u128, String)> {
    fn visit(root: &Path, current: &Path, output: &mut BTreeMap<String, (u64, u128, String)>) {
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
                let modified = metadata
                    .modified()
                    .unwrap()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_nanos();
                let hash = format!("{:x}", Sha256::digest(std::fs::read(entry.path()).unwrap()));
                output.insert(relative, (metadata.len(), modified, hash));
            }
        }
    }
    let mut output = BTreeMap::new();
    visit(root, root, &mut output);
    output
}

#[test]
fn migration_creates_inventory_tables_indexes_and_version() {
    let data = temp_dir("inventory-migration");
    let conn = db::init_db_at_path(&data).unwrap();
    assert_eq!(
        db::get_schema_version(&conn).unwrap(),
        db::CURRENT_SCHEMA_VERSION
    );
    for table in [
        "scan_roots",
        "scan_runs",
        "skill_instances",
        "skill_instance_files",
        "source_evidence",
        "source_resolutions",
    ] {
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
                rusqlite::params![table],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "missing table {table}");
    }
    let migration: String = conn
        .query_row(
            "SELECT name FROM schema_migrations WHERE version = 1",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(migration, "inventory_index_v1");
}

#[test]
fn upstream_platform_definitions_discover_five_required_agents() {
    let data = temp_dir("inventory-platform-data");
    let home = temp_dir("inventory-platform-home");
    for relative in [
        ".codex/skills",
        ".claude/skills",
        ".cursor/skills",
        ".codeium/windsurf/skills",
        ".gemini/skills",
    ] {
        std::fs::create_dir_all(home.join(relative)).unwrap();
    }
    let conn = db::init_db_at_path(&data).unwrap();
    let roots = inventory::service::root_list(&conn, &home).unwrap();
    let platforms = roots
        .iter()
        .filter_map(|root| root.platform_name.as_deref())
        .collect::<Vec<_>>();
    for platform in ["codex", "claude", "cursor", "windsurf", "gemini"] {
        assert!(platforms.contains(&platform), "missing {platform}");
    }
}

#[test]
fn one_run_scans_multiple_roots_with_nested_system_and_plugin_skills() {
    let data = temp_dir("inventory-multi-root-data");
    let home = temp_dir("inventory-multi-root-home");
    let system_root = temp_dir("inventory-multi-root-system");
    let plugin_root = temp_dir("inventory-multi-root-plugin");
    write(
        &system_root.join(".system/builtin/SKILL.md"),
        "---\nname: Builtin\n---\n# Builtin\n",
    );
    write(
        &plugin_root.join("cache/demo/.codex-plugin/plugin.json"),
        r#"{"name":"nested-plugin"}"#,
    );
    write(
        &plugin_root.join("cache/demo/skills/plugin-skill/SKILL.md"),
        "---\nname: Plugin Skill\n---\n# Plugin\n",
    );
    let conn = db::init_db_at_path(&data).unwrap();
    let roots = [
        (&system_root, "agent_global"),
        (&plugin_root, "plugin_cache"),
    ]
    .into_iter()
    .map(|(path, root_type)| {
        inventory::service::root_upsert(
            &conn,
            &ScanRootUpsertInput {
                id: None,
                root_type: root_type.to_string(),
                platform_name: Some("codex".to_string()),
                path: path.to_string_lossy().to_string(),
                enabled: Some(true),
                recursive: Some(true),
                watch_enabled: Some(false),
                ignore_rules: Vec::new(),
            },
        )
        .unwrap()
        .id
    })
    .collect::<Vec<_>>();
    drop(conn);
    let run = inventory::service::run_scan_at_path(
        &data,
        &home,
        &ScanStartInput {
            mode: ScanMode::Full,
            root_ids: roots,
        },
    )
    .unwrap();
    assert_eq!(run.status, "completed");
    assert_eq!(run.roots_completed, 2);
    let conn = rusqlite::Connection::open(data.join("metadata.db")).unwrap();
    let list = inventory::service::instance_list(
        &conn,
        &InstanceListInput {
            limit: Some(10),
            ..Default::default()
        },
    )
    .unwrap();
    assert_eq!(list.total, 2);
    let kinds = list
        .items
        .iter()
        .map(|item| origin::service::get(&conn, &item.id).unwrap().source_type)
        .collect::<Vec<_>>();
    assert!(kinds.contains(&"system".to_string()));
    assert!(kinds.contains(&"plugin".to_string()));
}

#[test]
fn full_and_incremental_scans_are_read_only_and_isolate_skill_errors() {
    let data = temp_dir("inventory-scan-data");
    let home = temp_dir("inventory-scan-home");
    let scan_root = temp_dir("inventory-scan-root");
    write(
        &scan_root.join("good/SKILL.md"),
        "\u{feff}---\r\nname: Good\r\ndescription: Useful\r\nmetadata:\r\n  short-description: Short\r\n---\r\n# Good\r\n",
    );
    write(
        &scan_root.join("good/scripts/check.ps1"),
        "throw 'never run'",
    );
    write(
        &scan_root.join("broken/SKILL.md"),
        "---\nname: [broken\n---\n# Broken\n",
    );
    write(
        &scan_root.join("same-a/SKILL.md"),
        "---\nname: Same\n---\n# Same\n",
    );
    write(
        &scan_root.join("same-b/SKILL.md"),
        "---\nname: Same\n---\n# Same\n",
    );
    write(
        &scan_root.join("conflict/SKILL.md"),
        "---\nname: Same\n---\n# Different\n",
    );
    write(&scan_root.join("renamed-a/SKILL.md"), "plain body only\n");
    write(&scan_root.join("renamed-b/SKILL.md"), "plain body only\n");
    write(
        &scan_root.join("plugin/.codex-plugin/plugin.json"),
        r#"{"name":"fixture-plugin","version":"1.0.0"}"#,
    );
    write(
        &scan_root.join("plugin/skills/demo/SKILL.md"),
        "---\nname: Plugin Demo\n---\n# Demo\n",
    );

    let conn = db::init_db_at_path(&data).unwrap();
    let root = inventory::service::root_upsert(
        &conn,
        &ScanRootUpsertInput {
            id: None,
            root_type: "custom".to_string(),
            platform_name: Some("codex".to_string()),
            path: scan_root.to_string_lossy().to_string(),
            enabled: Some(true),
            recursive: Some(true),
            watch_enabled: Some(true),
            ignore_rules: Vec::new(),
        },
    )
    .unwrap();
    drop(conn);

    let before = snapshot_tree(&scan_root);
    let run = inventory::service::run_scan_at_path(
        &data,
        &home,
        &ScanStartInput {
            mode: ScanMode::Full,
            root_ids: vec![root.id.clone()],
        },
    )
    .unwrap();
    assert_eq!(run.status, "completed");
    assert_eq!(before, snapshot_tree(&scan_root));

    let conn = rusqlite::Connection::open(data.join("metadata.db")).unwrap();
    let list = inventory::service::instance_list(
        &conn,
        &InstanceListInput {
            limit: Some(100),
            ..Default::default()
        },
    )
    .unwrap();
    assert_eq!(list.total, 8);
    let broken = list
        .items
        .iter()
        .find(|item| item.folder_name == "broken")
        .unwrap();
    assert_eq!(broken.parse_status, "error");
    let good = list
        .items
        .iter()
        .find(|item| item.folder_name == "good")
        .unwrap();
    assert!(good.has_scripts);
    assert_eq!(good.short_description.as_deref(), Some("Short"));
    let preview = inventory::service::read_instance_text_file(&conn, &good.id, "SKILL.md")
        .expect("indexed SKILL.md should be readable by stable instance id");
    assert!(preview.contains("name: Good"));
    let traversal = inventory::service::read_instance_text_file(&conn, &good.id, "../SKILL.md")
        .expect_err("parent traversal must be rejected");
    assert!(traversal.contains("相对文件路径"));
    let same = list
        .items
        .iter()
        .find(|item| item.folder_name == "same-a")
        .unwrap();
    assert!(same
        .duplicate_kinds
        .contains(&"same_name_same_content".to_string()));
    assert!(same
        .duplicate_kinds
        .contains(&"same_name_different_content".to_string()));
    let renamed = list
        .items
        .iter()
        .find(|item| item.folder_name == "renamed-a")
        .unwrap();
    assert!(renamed
        .duplicate_kinds
        .contains(&"same_content_different_name".to_string()));
    let plugin = list
        .items
        .iter()
        .find(|item| item.folder_name == "demo")
        .unwrap();
    let resolution = origin::service::get(&conn, &plugin.id).unwrap();
    assert_eq!(resolution.source_type, "plugin");
    assert_eq!(resolution.confidence, 50);
    drop(conn);

    write(
        &scan_root.join("good/SKILL.md"),
        "---\nname: Good\ndescription: Updated\n---\n# Good\n",
    );
    let incremental = inventory::service::run_scan_at_path(
        &data,
        &home,
        &ScanStartInput {
            mode: ScanMode::Incremental,
            root_ids: vec![root.id],
        },
    )
    .unwrap();
    assert_eq!(incremental.status, "completed");
    assert_eq!(incremental.instances_changed, 1);
}

#[test]
fn user_confirmation_overrides_recalculation_but_keeps_evidence() {
    let data = temp_dir("inventory-origin-data");
    let home = temp_dir("inventory-origin-home");
    let scan_root = temp_dir("inventory-origin-root");
    write(&scan_root.join("demo/SKILL.md"), "# Demo\n");
    let conn = db::init_db_at_path(&data).unwrap();
    let root = inventory::service::root_upsert(
        &conn,
        &ScanRootUpsertInput {
            id: None,
            root_type: "custom".to_string(),
            platform_name: Some("cursor".to_string()),
            path: scan_root.to_string_lossy().to_string(),
            enabled: None,
            recursive: None,
            watch_enabled: None,
            ignore_rules: Vec::new(),
        },
    )
    .unwrap();
    drop(conn);
    inventory::service::run_scan_at_path(
        &data,
        &home,
        &ScanStartInput {
            mode: ScanMode::Full,
            root_ids: vec![root.id],
        },
    )
    .unwrap();
    let conn = rusqlite::Connection::open(data.join("metadata.db")).unwrap();
    let instance = inventory::service::instance_list(&conn, &InstanceListInput::default())
        .unwrap()
        .items
        .remove(0);
    let confirmed = origin::service::confirm(
        &conn,
        &origin::model::OriginConfirmInput {
            instance_id: instance.id.clone(),
            source_type: "manual".to_string(),
            source_label: "My local source".to_string(),
            source_ref: Some("local://fixture".to_string()),
        },
        10,
    )
    .unwrap();
    assert_eq!(confirmed.confidence, 100);
    assert_eq!(confirmed.resolution_status, "confirmed");
    let recalculated = origin::service::recalculate(&conn, &instance.id, 20).unwrap();
    assert_eq!(recalculated.source_label, "My local source");
    assert!(
        origin::repository::list_evidence(&conn, &instance.id)
            .unwrap()
            .len()
            >= 2
    );
}

#[test]
fn cancellation_finishes_with_cancelled_status_and_releases_root_lock() {
    let data = temp_dir("inventory-cancel-data");
    let home = temp_dir("inventory-cancel-home");
    let scan_root = temp_dir("inventory-cancel-root");
    write(&scan_root.join("demo/SKILL.md"), "# Demo\n");
    let conn = db::init_db_at_path(&data).unwrap();
    let root = inventory::service::root_upsert(
        &conn,
        &ScanRootUpsertInput {
            id: None,
            root_type: "custom".to_string(),
            platform_name: None,
            path: scan_root.to_string_lossy().to_string(),
            enabled: None,
            recursive: None,
            watch_enabled: None,
            ignore_rules: Vec::new(),
        },
    )
    .unwrap();
    let input = ScanStartInput {
        mode: ScanMode::Full,
        root_ids: vec![root.id.clone()],
    };
    let prepared =
        inventory::service::prepare_scan(&conn, data.join("metadata.db"), &home, &input).unwrap();
    assert!(inventory::service::cancel_scan(&prepared.run.id).unwrap());
    let run = inventory::service::execute_scan(prepared, &input, |_| {}, |_| {}).unwrap();
    assert_eq!(run.status, "cancelled");

    let next =
        inventory::service::prepare_scan(&conn, data.join("metadata.db"), &home, &input).unwrap();
    inventory::service::cancel_scan(&next.run.id).unwrap();
    inventory::service::execute_scan(next, &input, |_| {}, |_| {}).unwrap();
}
