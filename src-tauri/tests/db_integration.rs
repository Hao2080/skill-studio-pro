use rusqlite::Connection;

use skill_studio_lib::db;

fn temp_data_dir(name: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir()
        .join("skill-studio-tests")
        .join(format!("{}-{}", name, uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).expect("创建测试目录失败");
    dir
}

fn row_count_with_active(data_dir: &std::path::Path, skill_id: &str) -> i64 {
    let conn = Connection::open(data_dir.join("metadata.db")).expect("打开数据库失败");
    conn.query_row(
        "SELECT COUNT(*) FROM skill_snapshots WHERE skill_id = ?1 AND is_active = 1",
        rusqlite::params![skill_id],
        |row| row.get(0),
    )
    .expect("查询 active 数量失败")
}

#[test]
fn init_db_migrates_legacy_teams_before_creating_indexes() {
    let data_dir = temp_data_dir("db-legacy-teams");
    let conn = Connection::open(data_dir.join("metadata.db")).expect("打开数据库失败");
    conn.execute(
        "CREATE TABLE teams (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            description TEXT,
            created_at  INTEGER NOT NULL
        )",
        [],
    )
    .expect("创建旧 teams 表失败");
    conn.execute(
        "INSERT INTO teams (id, name, description, created_at)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params!["team-1", "Team 1", "legacy", 100],
    )
    .expect("插入旧 teams 数据失败");
    drop(conn);

    let conn = db::init_db_at_path(&data_dir).expect("初始化旧数据库失败");

    let (status, updated_at): (String, i64) = conn
        .query_row(
            "SELECT status, updated_at FROM teams WHERE id = ?1",
            rusqlite::params!["team-1"],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .expect("查询迁移后 teams 数据失败");
    let index_exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = ?1",
            rusqlite::params!["idx_teams_status_updated_at"],
            |row| row.get(0),
        )
        .expect("查询 teams 索引失败");

    assert_eq!(status, "active");
    assert_eq!(updated_at, 100);
    assert_eq!(index_exists, 1);
}

#[test]
fn init_db_creates_team_activity_logs_table_and_indexes() {
    let data_dir = temp_data_dir("db-team-activity");
    let conn = db::init_db_at_path(&data_dir).expect("初始化数据库失败");

    let table_exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
            rusqlite::params!["team_activity_logs"],
            |row| row.get(0),
        )
        .expect("查询 team_activity_logs 表失败");
    let index_exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = ?1",
            rusqlite::params!["idx_team_activity_logs_team_created_at"],
            |row| row.get(0),
        )
        .expect("查询团队活动索引失败");

    assert_eq!(table_exists, 1);
    assert_eq!(index_exists, 1);
}

#[test]
fn init_db_backfills_active_when_skill_has_no_active_snapshot() {
    let data_dir = temp_data_dir("db-backfill-active");
    let conn = db::init_db_at_path(&data_dir).expect("初始化数据库失败");
    conn.execute(
        "INSERT INTO skills (id, name, slug, created_at, updated_at, is_archived) VALUES (?1, ?2, ?3, 0, 0, 0)",
        rusqlite::params!["skill-1", "Skill 1", "skill-1"],
    )
    .expect("插入 skill 失败");
    conn.execute(
        "INSERT INTO skill_snapshots (id, skill_id, snapshot_number, snapshot_path, revision_hash, created_at, is_current, is_active)
         VALUES (?1, ?2, 1, ?3, ?4, 0, 1, 0)",
        rusqlite::params!["snap-1", "skill-1", "path-1", "rev-1"],
    )
    .expect("插入快照失败");
    drop(conn);

    db::init_db_at_path(&data_dir).expect("再次初始化数据库失败");

    assert_eq!(row_count_with_active(&data_dir, "skill-1"), 1);
}

#[test]
fn init_db_does_not_create_second_active_snapshot_for_same_skill() {
    let data_dir = temp_data_dir("db-single-active");
    let conn = db::init_db_at_path(&data_dir).expect("初始化数据库失败");
    conn.execute(
        "INSERT INTO skills (id, name, slug, created_at, updated_at, is_archived) VALUES (?1, ?2, ?3, 0, 0, 0)",
        rusqlite::params!["skill-1", "Skill 1", "skill-1"],
    )
    .expect("插入 skill 失败");
    conn.execute(
        "INSERT INTO skill_snapshots (id, skill_id, snapshot_number, snapshot_path, revision_hash, created_at, is_current, is_active)
         VALUES (?1, ?2, 1, ?3, ?4, 0, 0, 1)",
        rusqlite::params!["snap-1", "skill-1", "path-1", "rev-1"],
    )
    .expect("插入旧 active 快照失败");
    conn.execute(
        "INSERT INTO skill_snapshots (id, skill_id, snapshot_number, snapshot_path, revision_hash, created_at, is_current, is_active)
         VALUES (?1, ?2, 2, ?3, ?4, 0, 1, 0)",
        rusqlite::params!["snap-2", "skill-1", "path-2", "rev-2"],
    )
    .expect("插入 latest 快照失败");
    drop(conn);

    db::init_db_at_path(&data_dir).expect("再次初始化数据库失败");

    let conn = Connection::open(data_dir.join("metadata.db")).expect("打开数据库失败");
    let active_snapshot_id: String = conn
        .query_row(
            "SELECT id FROM skill_snapshots WHERE skill_id = ?1 AND is_active = 1",
            rusqlite::params!["skill-1"],
            |row| row.get(0),
        )
        .expect("查询 active 快照失败");

    assert_eq!(row_count_with_active(&data_dir, "skill-1"), 1);
    assert_eq!(active_snapshot_id, "snap-1");
}
