use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use skill_studio_pro_lib::inventory::model::{
    InstanceListInput, ScanMode, ScanRootUpsertInput, ScanStartInput,
};
use skill_studio_pro_lib::{db, inventory};

fn temp_dir(name: &str) -> PathBuf {
    if let Some(retained) = retained_root() {
        let path = retained.join(name);
        std::fs::create_dir_all(&path).unwrap();
        return path;
    }
    let path = std::env::temp_dir()
        .join("skill-studio-pro-benchmarks")
        .join(format!("{name}-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&path).unwrap();
    path
}

fn retained_root() -> Option<PathBuf> {
    let value = std::env::var_os("SKILL_STUDIO_PRO_BENCHMARK_RETAIN_ROOT")?;
    let path = PathBuf::from(value);
    let parent_is_uat = path
        .parent()
        .and_then(Path::file_name)
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.starts_with("Skill-Studio-Pro-Task2-UAT-"));
    assert!(
        path.is_absolute()
            && path.file_name().and_then(|name| name.to_str()) == Some("performance-retained")
            && parent_is_uat,
        "retained benchmark output must be a performance-retained directory inside the Task 2 UAT root"
    );
    Some(path)
}

fn percentile_95(mut values: Vec<Duration>) -> Duration {
    values.sort();
    values[((values.len() as f64 * 0.95).ceil() as usize).saturating_sub(1)]
}

#[test]
#[ignore = "release-candidate benchmark: creates 1,000 Skills and 100,000 files"]
fn benchmark_inventory_1000_skills_100000_files() {
    let data = temp_dir("data");
    let home = temp_dir("home");
    let scan_root = temp_dir("root");
    for skill_index in 0..1_000 {
        let skill = scan_root.join(format!("skill-{skill_index:04}"));
        std::fs::create_dir_all(skill.join("assets")).unwrap();
        std::fs::write(
            skill.join("SKILL.md"),
            format!("---\nname: Skill {skill_index:04}\ndescription: Fixture\n---\n# Fixture\n"),
        )
        .unwrap();
        for file_index in 0..99 {
            std::fs::write(
                skill
                    .join("assets")
                    .join(format!("file-{file_index:03}.txt")),
                format!("{skill_index}:{file_index}"),
            )
            .unwrap();
        }
    }
    let conn = db::init_db_at_path(&data).unwrap();
    let root = inventory::service::root_upsert(
        &conn,
        &ScanRootUpsertInput {
            id: None,
            root_type: "custom".to_string(),
            platform_name: Some("codex".to_string()),
            path: scan_root.to_string_lossy().to_string(),
            enabled: None,
            recursive: None,
            watch_enabled: Some(false),
            ignore_rules: Vec::new(),
        },
    )
    .unwrap();
    drop(conn);
    let full_input = ScanStartInput {
        mode: ScanMode::Full,
        root_ids: vec![root.id.clone()],
    };
    let started = Instant::now();
    let run = inventory::service::run_scan_at_path(&data, &home, &full_input).unwrap();
    let full_scan = started.elapsed();
    assert_eq!(run.candidates_seen, 1_000);

    let conn = rusqlite::Connection::open(data.join("metadata.db")).unwrap();
    let first = inventory::service::instance_list(
        &conn,
        &InstanceListInput {
            limit: Some(1),
            ..Default::default()
        },
    )
    .unwrap()
    .items
    .remove(0);
    let mut searches = Vec::new();
    let mut details = Vec::new();
    for index in 0..100 {
        let started = Instant::now();
        inventory::service::instance_list(
            &conn,
            &InstanceListInput {
                search: Some(format!("Skill {:04}", index % 1_000)),
                limit: Some(100),
                ..Default::default()
            },
        )
        .unwrap();
        searches.push(started.elapsed());
        let started = Instant::now();
        inventory::service::instance_get(&conn, &first.id).unwrap();
        details.push(started.elapsed());
    }
    drop(conn);
    std::fs::write(
        scan_root
            .join("skill-0500")
            .join("assets")
            .join("file-050.txt"),
        "changed",
    )
    .unwrap();
    let incremental_input = ScanStartInput {
        mode: ScanMode::Incremental,
        root_ids: vec![root.id],
    };
    let started = Instant::now();
    let incremental =
        inventory::service::run_scan_at_path(&data, &home, &incremental_input).unwrap();
    let incremental_scan = started.elapsed();
    assert_eq!(incremental.instances_changed, 1);

    println!(
        "inventory_benchmark full_scan_ms={} incremental_scan_ms={} search_p95_ms={} detail_p95_ms={}",
        full_scan.as_millis(),
        incremental_scan.as_millis(),
        percentile_95(searches).as_millis(),
        percentile_95(details).as_millis()
    );
    if let Some(retained) = retained_root() {
        println!("inventory_benchmark retained_root={}", retained.display());
    } else {
        cleanup_temp(&data);
        cleanup_temp(&home);
        cleanup_temp(&scan_root);
    }
}

fn cleanup_temp(path: &Path) {
    let expected_parent = std::env::temp_dir().join("skill-studio-pro-benchmarks");
    let canonical_parent = path.parent().and_then(|parent| parent.canonicalize().ok());
    if canonical_parent.as_deref() == expected_parent.canonicalize().ok().as_deref() {
        std::fs::remove_dir_all(path).unwrap();
    }
}
