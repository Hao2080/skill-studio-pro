use rusqlite::Connection;
use skill_studio_pro_lib::db;

fn fixture(version: i64) -> tempfile::TempDir {
    let temp = tempfile::tempdir().expect("temporary migration fixture");
    let conn = Connection::open(temp.path().join("metadata.db")).unwrap();
    conn.execute_batch(
        "CREATE TABLE schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at INTEGER NOT NULL
         );
         CREATE TABLE qa_migration_sentinel (
            id TEXT PRIMARY KEY,
            payload TEXT NOT NULL
         );
         INSERT INTO qa_migration_sentinel (id, payload)
         VALUES ('preserved', 'must survive every migration');",
    )
    .unwrap();
    let names = [
        "inventory_index_v1",
        "library_mapping_v2",
        "ai_routing_v3",
        "lifecycle_v4",
    ];
    for applied in 1..=version.min(db::CURRENT_SCHEMA_VERSION) {
        conn.execute(
            "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, 1)",
            rusqlite::params![applied, names[(applied - 1) as usize]],
        )
        .unwrap();
    }
    conn.pragma_update(None, "user_version", version).unwrap();
    drop(conn);
    temp
}

fn assert_current_and_idempotent(temp: &tempfile::TempDir, expects_sentinel: bool) {
    for pass in 0..2 {
        let conn = db::init_db_at_path(temp.path()).expect("fixture should migrate");
        assert_eq!(
            db::get_schema_version(&conn).unwrap(),
            db::CURRENT_SCHEMA_VERSION,
            "migration pass {pass}"
        );
        if expects_sentinel {
            let payload: String = conn
                .query_row(
                    "SELECT payload FROM qa_migration_sentinel WHERE id = 'preserved'",
                    [],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(payload, "must survive every migration");
        }
        let versions = conn
            .prepare("SELECT version FROM schema_migrations WHERE version <= 4 ORDER BY version")
            .and_then(|mut statement| {
                statement
                    .query_map([], |row| row.get::<_, i64>(0))?
                    .collect::<Result<Vec<_>, _>>()
            })
            .unwrap();
        assert_eq!(versions, vec![1, 2, 3, 4]);
        let provider_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM ai_provider_configs", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(provider_count, 2, "default providers must not duplicate");
    }
}

#[test]
fn empty_v1_v2_and_v3_databases_upgrade_to_current_idempotently() {
    let empty = tempfile::tempdir().unwrap();
    assert_current_and_idempotent(&empty, false);
    for version in 1..=3 {
        let temp = fixture(version);
        assert_current_and_idempotent(&temp, true);
    }
}

#[test]
fn unknown_higher_schema_version_is_never_downgraded() {
    let temp = fixture(99);
    for _ in 0..2 {
        let conn = db::init_db_at_path(temp.path()).expect("higher-version database should open");
        assert_eq!(db::get_schema_version(&conn).unwrap(), 99);
        let payload: String = conn
            .query_row(
                "SELECT payload FROM qa_migration_sentinel WHERE id = 'preserved'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(payload, "must survive every migration");
    }
}
