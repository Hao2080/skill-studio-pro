use rusqlite::Connection;

pub fn ensure_tables(conn: &Connection) -> Result<(), String> {
    create_skill_tables(conn)?;
    create_team_tables(conn)?;
    create_project_tables(conn)?;
    Ok(())
}

pub fn ensure_indexes(conn: &Connection) -> Result<(), String> {
    create_indexes(conn)
}

fn create_skill_tables(conn: &Connection) -> Result<(), String> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS skills (
            id              TEXT PRIMARY KEY,
            name            TEXT NOT NULL UNIQUE,
            slug            TEXT NOT NULL UNIQUE,
            description     TEXT,
            source_type     TEXT DEFAULT 'local',
            source_path     TEXT,
            created_at      INTEGER,
            updated_at      INTEGER,
            is_archived     INTEGER DEFAULT 0
        )",
        [],
    )
    .map_err(|e| format!("创建 skills 表失败: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS skill_snapshots (
            id              TEXT PRIMARY KEY,
            skill_id        TEXT NOT NULL,
            snapshot_number INTEGER NOT NULL,
            snapshot_path   TEXT NOT NULL,
            revision_hash   TEXT NOT NULL,
            change_summary  TEXT,
            source          TEXT NOT NULL DEFAULT 'manual',
            created_at      INTEGER NOT NULL,
            is_current      INTEGER DEFAULT 0,
            is_active       INTEGER DEFAULT 0,
            FOREIGN KEY (skill_id) REFERENCES skills(id)
        )",
        [],
    )
    .map_err(|e| format!("创建 skill_snapshots 表失败: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS skill_sources (
            id              TEXT PRIMARY KEY,
            skill_id        TEXT NOT NULL,
            source_type     TEXT NOT NULL,
            source_label    TEXT NOT NULL,
            source_ref      TEXT,
            source_path     TEXT,
            metadata_json   TEXT,
            is_primary      INTEGER DEFAULT 1,
            created_at      INTEGER NOT NULL,
            updated_at      INTEGER NOT NULL,
            FOREIGN KEY (skill_id) REFERENCES skills(id)
        )",
        [],
    )
    .map_err(|e| format!("创建 skill_sources 表失败: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS skill_import_logs (
            id                  TEXT PRIMARY KEY,
            source_type         TEXT NOT NULL,
            source_label        TEXT NOT NULL,
            source_ref          TEXT,
            source_path         TEXT,
            request_payload_json TEXT,
            status              TEXT NOT NULL,
            target_skill_id     TEXT,
            target_skill_name   TEXT,
            detail_message      TEXT,
            error_message       TEXT,
            created_at          INTEGER NOT NULL,
            updated_at          INTEGER NOT NULL
        )",
        [],
    )
    .map_err(|e| format!("创建 skill_import_logs 表失败: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS skill_tags (
            id              TEXT PRIMARY KEY,
            name            TEXT NOT NULL UNIQUE,
            color           TEXT,
            created_at      INTEGER NOT NULL,
            updated_at      INTEGER NOT NULL
        )",
        [],
    )
    .map_err(|e| format!("创建 skill_tags 表失败: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS skill_tag_relations (
            skill_id        TEXT NOT NULL,
            tag_id          TEXT NOT NULL,
            created_at      INTEGER NOT NULL,
            updated_at      INTEGER NOT NULL,
            PRIMARY KEY (skill_id, tag_id),
            FOREIGN KEY (skill_id) REFERENCES skills(id),
            FOREIGN KEY (tag_id) REFERENCES skill_tags(id)
        )",
        [],
    )
    .map_err(|e| format!("创建 skill_tag_relations 表失败: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS skill_collections (
            id              TEXT PRIMARY KEY,
            name            TEXT NOT NULL UNIQUE,
            description     TEXT,
            color           TEXT,
            created_at      INTEGER NOT NULL,
            updated_at      INTEGER NOT NULL
        )",
        [],
    )
    .map_err(|e| format!("创建 skill_collections 表失败: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS collection_items (
            collection_id    TEXT NOT NULL,
            skill_id         TEXT NOT NULL,
            is_primary       INTEGER DEFAULT 0,
            sort_order       INTEGER DEFAULT 0,
            created_at       INTEGER NOT NULL,
            updated_at       INTEGER NOT NULL,
            PRIMARY KEY (collection_id, skill_id),
            FOREIGN KEY (collection_id) REFERENCES skill_collections(id),
            FOREIGN KEY (skill_id) REFERENCES skills(id)
        )",
        [],
    )
    .map_err(|e| format!("创建 collection_items 表失败: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS platform_connections (
            id              TEXT PRIMARY KEY,
            platform_name   TEXT NOT NULL UNIQUE,
            display_name    TEXT NOT NULL DEFAULT '',
            platform_type   TEXT NOT NULL DEFAULT 'built_in',
            detected        INTEGER DEFAULT 0,
            enabled         INTEGER DEFAULT 0,
            skills_dir      TEXT,
            detect_dir      TEXT,
            sync_mode       TEXT NOT NULL DEFAULT 'copy',
            supports_project_scope INTEGER DEFAULT 0,
            supports_symlink INTEGER DEFAULT 1,
            supports_copy   INTEGER DEFAULT 1,
            last_sync_at    INTEGER
        )",
        [],
    )
    .map_err(|e| format!("创建 platform_connections 表失败: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS sync_logs (
            id              TEXT PRIMARY KEY,
            skill_id        TEXT NOT NULL,
            platform_name   TEXT NOT NULL,
            snapshot_id     TEXT,
            action          TEXT NOT NULL DEFAULT 'sync',
            status          TEXT NOT NULL,
            error_message   TEXT,
            synced_at       INTEGER NOT NULL
        )",
        [],
    )
    .map_err(|e| format!("创建 sync_logs 表失败: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS platform_release_targets (
            id              TEXT PRIMARY KEY,
            skill_id        TEXT NOT NULL,
            platform_name   TEXT NOT NULL,
            snapshot_id     TEXT NOT NULL,
            released_at     INTEGER NOT NULL,
            created_at      INTEGER NOT NULL,
            updated_at      INTEGER NOT NULL,
            FOREIGN KEY (skill_id) REFERENCES skills(id),
            FOREIGN KEY (snapshot_id) REFERENCES skill_snapshots(id),
            UNIQUE (skill_id, platform_name)
        )",
        [],
    )
    .map_err(|e| format!("创建 platform_release_targets 表失败: {}", e))?;

    Ok(())
}

fn create_team_tables(conn: &Connection) -> Result<(), String> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS teams (
            id           TEXT PRIMARY KEY,
            name         TEXT NOT NULL,
            description  TEXT,
            created_at   INTEGER NOT NULL,
            updated_at   INTEGER NOT NULL,
            status       TEXT NOT NULL DEFAULT 'active'
        )",
        [],
    )
    .map_err(|e| format!("创建 teams 表失败: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS team_members (
            id          TEXT PRIMARY KEY,
            team_id     TEXT NOT NULL,
            user_name   TEXT NOT NULL,
            email       TEXT,
            role        TEXT NOT NULL DEFAULT 'contributor',
            status      TEXT NOT NULL DEFAULT 'active',
            joined_at   INTEGER NOT NULL,
            updated_at  INTEGER NOT NULL,
            FOREIGN KEY (team_id) REFERENCES teams(id)
        )",
        [],
    )
    .map_err(|e| format!("创建 team_members 表失败: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS team_skills (
            id          TEXT PRIMARY KEY,
            team_id     TEXT NOT NULL,
            name        TEXT NOT NULL,
            slug        TEXT NOT NULL,
            description TEXT,
            created_at  INTEGER NOT NULL,
            FOREIGN KEY (team_id) REFERENCES teams(id)
        )",
        [],
    )
    .map_err(|e| format!("创建 team_skills 表失败: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS team_skill_versions (
            id                          TEXT PRIMARY KEY,
            team_skill_id               TEXT NOT NULL,
            version_number              INTEGER NOT NULL,
            snapshot_path               TEXT NOT NULL,
            revision_hash               TEXT NOT NULL,
            change_summary              TEXT,
            merged_from_submission_id   TEXT,
            merged_by                   TEXT,
            merged_at                   INTEGER NOT NULL,
            is_recommended              INTEGER DEFAULT 0,
            FOREIGN KEY (team_skill_id) REFERENCES team_skills(id)
        )",
        [],
    )
    .map_err(|e| format!("创建 team_skill_versions 表失败: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS team_submissions (
            id                 TEXT PRIMARY KEY,
            team_id            TEXT NOT NULL,
            team_skill_id      TEXT,
            base_team_version_id TEXT,
            base_revision_hash TEXT,
            source_skill_id    TEXT NOT NULL,
            source_snapshot_id TEXT NOT NULL,
            submitter          TEXT NOT NULL,
            submit_message     TEXT,
            submitted_at       INTEGER NOT NULL,
            status             TEXT NOT NULL DEFAULT 'pending',
            resolved_at        INTEGER,
            FOREIGN KEY (team_id) REFERENCES teams(id),
            FOREIGN KEY (base_team_version_id) REFERENCES team_skill_versions(id)
        )",
        [],
    )
    .map_err(|e| format!("创建 team_submissions 表失败: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS team_delivery_targets (
            id                 TEXT PRIMARY KEY,
            team_id            TEXT NOT NULL,
            source_skill_id    TEXT NOT NULL,
            source_snapshot_id TEXT NOT NULL,
            team_skill_id      TEXT,
            team_version_id    TEXT,
            delivered_at       INTEGER NOT NULL,
            created_at         INTEGER NOT NULL,
            updated_at         INTEGER NOT NULL,
            FOREIGN KEY (team_id) REFERENCES teams(id),
            FOREIGN KEY (source_skill_id) REFERENCES skills(id),
            FOREIGN KEY (source_snapshot_id) REFERENCES skill_snapshots(id),
            FOREIGN KEY (team_skill_id) REFERENCES team_skills(id),
            FOREIGN KEY (team_version_id) REFERENCES team_skill_versions(id),
            UNIQUE (team_id, source_skill_id)
        )",
        [],
    )
    .map_err(|e| format!("创建 team_delivery_targets 表失败: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS team_delivery_logs (
            id                 TEXT PRIMARY KEY,
            team_id            TEXT NOT NULL,
            source_skill_id    TEXT NOT NULL,
            source_snapshot_id TEXT,
            team_skill_id      TEXT,
            team_version_id    TEXT,
            submission_id      TEXT,
            action             TEXT NOT NULL,
            status             TEXT NOT NULL,
            actor              TEXT,
            note               TEXT,
            created_at         INTEGER NOT NULL,
            FOREIGN KEY (team_id) REFERENCES teams(id),
            FOREIGN KEY (source_skill_id) REFERENCES skills(id),
            FOREIGN KEY (source_snapshot_id) REFERENCES skill_snapshots(id),
            FOREIGN KEY (team_skill_id) REFERENCES team_skills(id),
            FOREIGN KEY (team_version_id) REFERENCES team_skill_versions(id),
            FOREIGN KEY (submission_id) REFERENCES team_submissions(id)
        )",
        [],
    )
    .map_err(|e| format!("创建 team_delivery_logs 表失败: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS team_activity_logs (
            id                 TEXT PRIMARY KEY,
            team_id            TEXT NOT NULL,
            actor              TEXT NOT NULL,
            action             TEXT NOT NULL,
            target_type        TEXT NOT NULL,
            target_id          TEXT,
            target_label       TEXT,
            detail             TEXT,
            created_at         INTEGER NOT NULL,
            FOREIGN KEY (team_id) REFERENCES teams(id)
        )",
        [],
    )
    .map_err(|e| format!("创建 team_activity_logs 表失败: {}", e))?;

    Ok(())
}

fn create_project_tables(conn: &Connection) -> Result<(), String> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS projects (
            id              TEXT PRIMARY KEY,
            name            TEXT NOT NULL,
            root_path       TEXT NOT NULL UNIQUE,
            description     TEXT,
            status          TEXT NOT NULL DEFAULT 'ready',
            last_scanned_at INTEGER,
            created_at      INTEGER NOT NULL,
            updated_at      INTEGER NOT NULL
        )",
        [],
    )
    .map_err(|e| format!("创建 projects 表失败: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS project_platform_connections (
            id                  TEXT PRIMARY KEY,
            project_id          TEXT NOT NULL,
            platform_name       TEXT NOT NULL,
            path_mode           TEXT NOT NULL DEFAULT 'derived',
            relative_skills_dir TEXT,
            skills_dir          TEXT NOT NULL,
            disabled_dir        TEXT,
            sync_mode           TEXT NOT NULL DEFAULT 'copy',
            enabled             INTEGER DEFAULT 1,
            status              TEXT NOT NULL DEFAULT 'not_configured',
            last_sync_at        INTEGER,
            last_sync_status    TEXT,
            last_error_message  TEXT,
            created_at          INTEGER NOT NULL,
            updated_at          INTEGER NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id),
            UNIQUE (project_id, platform_name)
        )",
        [],
    )
    .map_err(|e| format!("创建 project_platform_connections 表失败: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS project_skill_assignments (
            id                      TEXT PRIMARY KEY,
            project_id              TEXT NOT NULL,
            platform_name           TEXT NOT NULL,
            skill_id                TEXT NOT NULL,
            snapshot_id             TEXT NOT NULL,
            target_dir_name         TEXT NOT NULL,
            enabled                 INTEGER DEFAULT 1,
            sort_order              INTEGER DEFAULT 0,
            runtime_status          TEXT NOT NULL DEFAULT 'pending_sync',
            last_synced_snapshot_id TEXT,
            last_synced_hash        TEXT,
            last_checked_at         INTEGER,
            created_at              INTEGER NOT NULL,
            updated_at              INTEGER NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id),
            FOREIGN KEY (skill_id) REFERENCES skills(id),
            FOREIGN KEY (snapshot_id) REFERENCES skill_snapshots(id),
            UNIQUE (project_id, platform_name, skill_id),
            UNIQUE (project_id, platform_name, target_dir_name)
        )",
        [],
    )
    .map_err(|e| format!("创建 project_skill_assignments 表失败: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS project_sync_logs (
            id              TEXT PRIMARY KEY,
            project_id      TEXT NOT NULL,
            platform_name   TEXT NOT NULL,
            skill_id        TEXT,
            snapshot_id     TEXT,
            action          TEXT NOT NULL,
            status          TEXT NOT NULL,
            detail_message  TEXT,
            error_message   TEXT,
            created_at      INTEGER NOT NULL
        )",
        [],
    )
    .map_err(|e| format!("创建 project_sync_logs 表失败: {}", e))?;

    Ok(())
}

fn create_indexes(conn: &Connection) -> Result<(), String> {
    let indexes = [
        (
            "idx_skill_snapshots_skill_id_snapshot_number",
            "CREATE INDEX IF NOT EXISTS idx_skill_snapshots_skill_id_snapshot_number
             ON skill_snapshots(skill_id, snapshot_number DESC)",
        ),
        (
            "idx_skill_snapshots_skill_id_active",
            "CREATE INDEX IF NOT EXISTS idx_skill_snapshots_skill_id_active
             ON skill_snapshots(skill_id, is_active)",
        ),
        (
            "idx_skill_sources_skill_id_primary",
            "CREATE INDEX IF NOT EXISTS idx_skill_sources_skill_id_primary
             ON skill_sources(skill_id, is_primary DESC, created_at DESC)",
        ),
        (
            "idx_skill_sources_source_type",
            "CREATE INDEX IF NOT EXISTS idx_skill_sources_source_type
             ON skill_sources(source_type, created_at DESC)",
        ),
        (
            "idx_skill_import_logs_created_at",
            "CREATE INDEX IF NOT EXISTS idx_skill_import_logs_created_at
             ON skill_import_logs(created_at DESC, id DESC)",
        ),
        (
            "idx_skill_import_logs_status_source_type",
            "CREATE INDEX IF NOT EXISTS idx_skill_import_logs_status_source_type
             ON skill_import_logs(status, source_type, created_at DESC)",
        ),
        (
            "idx_skill_tags_name",
            "CREATE INDEX IF NOT EXISTS idx_skill_tags_name
             ON skill_tags(name)",
        ),
        (
            "idx_skill_tag_relations_tag_id",
            "CREATE INDEX IF NOT EXISTS idx_skill_tag_relations_tag_id
             ON skill_tag_relations(tag_id, updated_at DESC)",
        ),
        (
            "idx_skill_collections_name",
            "CREATE INDEX IF NOT EXISTS idx_skill_collections_name
             ON skill_collections(name)",
        ),
        (
            "idx_collection_items_skill_id",
            "CREATE INDEX IF NOT EXISTS idx_collection_items_skill_id
             ON collection_items(skill_id, updated_at DESC)",
        ),
        (
            "idx_collection_items_collection_id_sort_order",
            "CREATE INDEX IF NOT EXISTS idx_collection_items_collection_id_sort_order
             ON collection_items(collection_id, sort_order ASC, updated_at DESC)",
        ),
        (
            "idx_collection_items_primary_skill",
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_collection_items_primary_skill
             ON collection_items(skill_id)
             WHERE is_primary = 1",
        ),
        (
            "idx_sync_logs_skill_id_synced_at",
            "CREATE INDEX IF NOT EXISTS idx_sync_logs_skill_id_synced_at
             ON sync_logs(skill_id, synced_at DESC)",
        ),
        (
            "idx_sync_logs_skill_id_platform_name_synced_at",
            "CREATE INDEX IF NOT EXISTS idx_sync_logs_skill_id_platform_name_synced_at
             ON sync_logs(skill_id, platform_name, synced_at DESC)",
        ),
        (
            "idx_platform_release_targets_skill_id_platform_name",
            "CREATE INDEX IF NOT EXISTS idx_platform_release_targets_skill_id_platform_name
             ON platform_release_targets(skill_id, platform_name)",
        ),
        (
            "idx_platform_release_targets_snapshot_id",
            "CREATE INDEX IF NOT EXISTS idx_platform_release_targets_snapshot_id
             ON platform_release_targets(snapshot_id)",
        ),
        (
            "idx_teams_status_updated_at",
            "CREATE INDEX IF NOT EXISTS idx_teams_status_updated_at
             ON teams(status, updated_at DESC)",
        ),
        (
            "idx_team_members_team_id_joined_at",
            "CREATE INDEX IF NOT EXISTS idx_team_members_team_id_joined_at
             ON team_members(team_id, joined_at ASC)",
        ),
        (
            "idx_team_members_team_id_role_status",
            "CREATE INDEX IF NOT EXISTS idx_team_members_team_id_role_status
             ON team_members(team_id, role, status, updated_at DESC)",
        ),
        (
            "idx_team_skills_team_id_created_at",
            "CREATE INDEX IF NOT EXISTS idx_team_skills_team_id_created_at
             ON team_skills(team_id, created_at ASC)",
        ),
        (
            "idx_team_skill_versions_team_skill_id_version_number",
            "CREATE INDEX IF NOT EXISTS idx_team_skill_versions_team_skill_id_version_number
             ON team_skill_versions(team_skill_id, version_number DESC)",
        ),
        (
            "idx_team_submissions_team_id_status_submitted_at",
            "CREATE INDEX IF NOT EXISTS idx_team_submissions_team_id_status_submitted_at
             ON team_submissions(team_id, status, submitted_at DESC)",
        ),
        (
            "idx_team_submissions_source_skill_team_status",
            "CREATE INDEX IF NOT EXISTS idx_team_submissions_source_skill_team_status
             ON team_submissions(source_skill_id, team_id, status, submitted_at DESC)",
        ),
        (
            "idx_team_submissions_base_team_version",
            "CREATE INDEX IF NOT EXISTS idx_team_submissions_base_team_version
             ON team_submissions(base_team_version_id)",
        ),
        (
            "idx_team_delivery_targets_skill_team",
            "CREATE INDEX IF NOT EXISTS idx_team_delivery_targets_skill_team
             ON team_delivery_targets(source_skill_id, team_id)",
        ),
        (
            "idx_team_delivery_targets_snapshot",
            "CREATE INDEX IF NOT EXISTS idx_team_delivery_targets_snapshot
             ON team_delivery_targets(source_snapshot_id)",
        ),
        (
            "idx_team_delivery_logs_skill_team_created_at",
            "CREATE INDEX IF NOT EXISTS idx_team_delivery_logs_skill_team_created_at
             ON team_delivery_logs(source_skill_id, team_id, created_at DESC)",
        ),
        (
            "idx_team_delivery_logs_submission_id",
            "CREATE INDEX IF NOT EXISTS idx_team_delivery_logs_submission_id
             ON team_delivery_logs(submission_id)",
        ),
        (
            "idx_team_activity_logs_team_created_at",
            "CREATE INDEX IF NOT EXISTS idx_team_activity_logs_team_created_at
             ON team_activity_logs(team_id, created_at DESC, id DESC)",
        ),
        (
            "idx_team_activity_logs_actor_created_at",
            "CREATE INDEX IF NOT EXISTS idx_team_activity_logs_actor_created_at
             ON team_activity_logs(actor, created_at DESC)",
        ),
        (
            "idx_project_platform_connections_project_id",
            "CREATE INDEX IF NOT EXISTS idx_project_platform_connections_project_id
             ON project_platform_connections(project_id, platform_name)",
        ),
        (
            "idx_project_skill_assignments_project_platform",
            "CREATE INDEX IF NOT EXISTS idx_project_skill_assignments_project_platform
             ON project_skill_assignments(project_id, platform_name, sort_order ASC)",
        ),
        (
            "idx_project_skill_assignments_skill_id",
            "CREATE INDEX IF NOT EXISTS idx_project_skill_assignments_skill_id
             ON project_skill_assignments(skill_id)",
        ),
        (
            "idx_project_sync_logs_project_created_at",
            "CREATE INDEX IF NOT EXISTS idx_project_sync_logs_project_created_at
             ON project_sync_logs(project_id, created_at DESC)",
        ),
        (
            "idx_project_sync_logs_assignment_status",
            "CREATE INDEX IF NOT EXISTS idx_project_sync_logs_assignment_status
             ON project_sync_logs(project_id, platform_name, skill_id, status)",
        ),
    ];

    for (name, statement) in indexes {
        conn.execute(statement, [])
            .map_err(|e| format!("创建索引 {} 失败: {}", name, e))?;
    }

    Ok(())
}
