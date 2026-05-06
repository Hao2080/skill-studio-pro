use skill_studio_lib::team;

fn temp_dir(name: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir()
        .join("skill-studio-tests")
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
fn list_team_submissions_sql_only_returns_pending() {
    assert!(team::list_team_submissions_sql().contains("status = 'pending'"));
}

#[test]
fn create_team_sql_inserts_default_member_jensen() {
    assert!(team::create_team_member_sql().contains("'jensen'"));
    assert!(team::create_team_member_sql().contains("'owner'"));
}

#[test]
fn validate_pull_mode_allows_new_skill_without_target_skill() {
    assert!(team::validate_pull_mode("new_skill", None).is_ok());
}

#[test]
fn validate_pull_mode_rejects_append_snapshot_without_target_skill() {
    let err = team::validate_pull_mode("append_snapshot", None)
        .expect_err("append_snapshot 缺少 target_skill_id 应报错");
    assert!(err.contains("target_skill_id"));
}

#[test]
fn diff_against_optional_base_at_uses_empty_base_for_first_version() {
    let diff_root = temp_dir("team-diff-root");
    let target_dir = diff_root.join("target");
    write_file(&target_dir.join("skill.md"), "first team version");

    let diff =
        team::diff_against_optional_base_at(diff_root.join(".empty").as_path(), None, &target_dir)
            .expect("首个版本 diff 不应报错");

    assert_eq!(diff.added_files, vec!["skill.md"]);
    assert!(diff.deleted_files.is_empty());
    assert!(diff.modified_files.is_empty());
}
