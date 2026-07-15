use rusqlite::Connection;

pub fn apply(conn: &Connection) -> Result<(), String> {
    ensure_skill_snapshot_is_active_column(conn)?;
    ensure_skill_snapshots_source_column(conn)?;
    ensure_skill_sources_table(conn)?;
    ensure_skill_import_logs_table(conn)?;
    backfill_skill_sources(conn)?;
    ensure_skill_organization_tables(conn)?;
    normalize_platform_connection_ids(conn)?;
    ensure_platform_connection_display_name_column(conn)?;
    ensure_platform_connection_platform_type_column(conn)?;
    ensure_platform_connection_sync_mode_column(conn)?;
    ensure_platform_connection_detect_dir_column(conn)?;
    ensure_platform_connection_supports_project_scope_column(conn)?;
    ensure_platform_connection_supports_symlink_column(conn)?;
    ensure_platform_connection_supports_copy_column(conn)?;
    backfill_active_snapshots(conn)?;
    ensure_sync_logs_snapshot_id_column(conn)?;
    ensure_sync_logs_action_column(conn)?;
    ensure_platform_release_targets_table(conn)?;
    ensure_team_delivery_targets_table(conn)?;
    ensure_team_delivery_logs_table(conn)?;
    ensure_team_activity_logs_table(conn)?;
    ensure_team_status_column(conn)?;
    ensure_team_updated_at_column(conn)?;
    ensure_team_member_email_column(conn)?;
    ensure_team_member_role_column(conn)?;
    ensure_team_member_status_column(conn)?;
    ensure_team_member_updated_at_column(conn)?;
    ensure_team_submission_base_columns(conn)?;
    ensure_project_tables(conn)?;
    record_inventory_index_migration(conn)?;
    Ok(())
}

fn record_inventory_index_migration(conn: &Connection) -> Result<(), String> {
    conn.execute(
        "INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
         VALUES (1, 'inventory_index_v1', strftime('%s','now') * 1000)",
        [],
    )
    .map_err(|e| format!("记录 inventory migration 失败: {}", e))?;
    let current: i64 = conn
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .map_err(|e| format!("读取 schema version 失败: {}", e))?;
    if current < super::CURRENT_SCHEMA_VERSION {
        conn.pragma_update(None, "user_version", super::CURRENT_SCHEMA_VERSION)
            .map_err(|e| format!("更新 schema version 失败: {}", e))?;
    }
    Ok(())
}

fn ensure_skill_organization_tables(conn: &Connection) -> Result<(), String> {
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
        "CREATE INDEX IF NOT EXISTS idx_skill_tags_name
         ON skill_tags(name)",
        [],
    )
    .map_err(|e| format!("创建 skill_tags 索引失败: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_skill_tag_relations_tag_id
         ON skill_tag_relations(tag_id, updated_at DESC)",
        [],
    )
    .map_err(|e| format!("创建 skill_tag_relations 索引失败: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_skill_collections_name
         ON skill_collections(name)",
        [],
    )
    .map_err(|e| format!("创建 skill_collections 索引失败: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_collection_items_skill_id
         ON collection_items(skill_id, updated_at DESC)",
        [],
    )
    .map_err(|e| format!("创建 collection_items.skill_id 索引失败: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_collection_items_collection_id_sort_order
         ON collection_items(collection_id, sort_order ASC, updated_at DESC)",
        [],
    )
    .map_err(|e| format!("创建 collection_items.collection_id 索引失败: {}", e))?;

    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_collection_items_primary_skill
         ON collection_items(skill_id)
         WHERE is_primary = 1",
        [],
    )
    .map_err(|e| format!("创建 collection_items 主集合索引失败: {}", e))?;

    Ok(())
}

fn ensure_skill_sources_table(conn: &Connection) -> Result<(), String> {
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
        "CREATE INDEX IF NOT EXISTS idx_skill_sources_skill_id_primary
         ON skill_sources(skill_id, is_primary DESC, created_at DESC)",
        [],
    )
    .map_err(|e| format!("创建 skill_sources 主索引失败: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_skill_sources_source_type
         ON skill_sources(source_type, created_at DESC)",
        [],
    )
    .map_err(|e| format!("创建 skill_sources 类型索引失败: {}", e))?;

    Ok(())
}

fn ensure_skill_import_logs_table(conn: &Connection) -> Result<(), String> {
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
        "CREATE INDEX IF NOT EXISTS idx_skill_import_logs_created_at
         ON skill_import_logs(created_at DESC, id DESC)",
        [],
    )
    .map_err(|e| format!("创建 skill_import_logs 时间索引失败: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_skill_import_logs_status_source_type
         ON skill_import_logs(status, source_type, created_at DESC)",
        [],
    )
    .map_err(|e| format!("创建 skill_import_logs 状态索引失败: {}", e))?;

    Ok(())
}

fn backfill_skill_sources(conn: &Connection) -> Result<(), String> {
    conn.execute(
        "INSERT INTO skill_sources (
            id,
            skill_id,
            source_type,
            source_label,
            source_ref,
            source_path,
            metadata_json,
            is_primary,
            created_at,
            updated_at
         )
         SELECT
            'legacy:' || s.id,
            s.id,
            CASE
                WHEN s.source_type IS NULL OR trim(s.source_type) = '' THEN 'local'
                ELSE s.source_type
            END,
            CASE
                WHEN s.source_type = 'manual' THEN '手动创建'
                WHEN s.source_type = 'platform_scan' THEN '平台扫描导入'
                WHEN s.source_type = 'team_library' THEN '团队库导入'
                WHEN s.source_type = 'git_repository' THEN '仓库快照导入'
                WHEN s.source_type = 'market_catalog' THEN '市场精选导入'
                ELSE '本地目录导入'
            END,
            s.source_path,
            s.source_path,
            NULL,
            1,
            COALESCE(s.created_at, strftime('%s','now') * 1000),
            COALESCE(s.updated_at, COALESCE(s.created_at, strftime('%s','now') * 1000))
         FROM skills s
         WHERE NOT EXISTS (
            SELECT 1
            FROM skill_sources ss
            WHERE ss.skill_id = s.id
              AND ss.is_primary = 1
         )",
        [],
    )
    .map_err(|e| format!("回填 skill_sources 失败: {}", e))?;

    Ok(())
}

fn ensure_skill_snapshot_is_active_column(conn: &Connection) -> Result<(), String> {
    if has_column(conn, "skill_snapshots", "is_active")? {
        return Ok(());
    }

    conn.execute(
        "ALTER TABLE skill_snapshots ADD COLUMN is_active INTEGER DEFAULT 0",
        [],
    )
    .map_err(|e| format!("新增 skill_snapshots.is_active 失败: {}", e))?;

    Ok(())
}

fn ensure_skill_snapshots_source_column(conn: &Connection) -> Result<(), String> {
    if !has_column(conn, "skill_snapshots", "source")? {
        conn.execute(
            "ALTER TABLE skill_snapshots ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'",
            [],
        )
        .map_err(|e| format!("新增 skill_snapshots.source 失败: {}", e))?;
    }

    conn.execute(
        "UPDATE skill_snapshots
         SET source = 'manual'
         WHERE source IS NULL OR trim(source) = ''",
        [],
    )
    .map_err(|e| format!("回填 skill_snapshots.source 失败: {}", e))?;

    Ok(())
}

fn normalize_platform_connection_ids(conn: &Connection) -> Result<(), String> {
    conn.execute(
        "UPDATE platform_connections
         SET id = platform_name
         WHERE id IS NULL OR id <> platform_name",
        [],
    )
    .map_err(|e| format!("规范 platform_connections.id 失败: {}", e))?;

    Ok(())
}

fn backfill_active_snapshots(conn: &Connection) -> Result<(), String> {
    conn.execute(
        "UPDATE skill_snapshots
         SET is_active = 1
         WHERE is_current = 1
           AND is_active = 0
           AND skill_id IN (
             SELECT skill_id
             FROM skill_snapshots
             GROUP BY skill_id
             HAVING SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) = 0
           )",
        [],
    )
    .map_err(|e| format!("初始化 is_active 失败: {}", e))?;

    Ok(())
}

fn ensure_platform_connection_display_name_column(conn: &Connection) -> Result<(), String> {
    if has_column(conn, "platform_connections", "display_name")? {
        conn.execute(
            "UPDATE platform_connections
             SET display_name = platform_name
             WHERE display_name IS NULL OR trim(display_name) = ''",
            [],
        )
        .map_err(|e| format!("回填 platform_connections.display_name 失败: {}", e))?;
        return Ok(());
    }

    conn.execute(
        "ALTER TABLE platform_connections ADD COLUMN display_name TEXT NOT NULL DEFAULT ''",
        [],
    )
    .map_err(|e| format!("新增 platform_connections.display_name 失败: {}", e))?;
    conn.execute(
        "UPDATE platform_connections
         SET display_name = platform_name
         WHERE display_name IS NULL OR trim(display_name) = ''",
        [],
    )
    .map_err(|e| format!("回填 platform_connections.display_name 失败: {}", e))?;
    Ok(())
}

fn ensure_platform_connection_platform_type_column(conn: &Connection) -> Result<(), String> {
    if has_column(conn, "platform_connections", "platform_type")? {
        return Ok(());
    }

    conn.execute(
        "ALTER TABLE platform_connections ADD COLUMN platform_type TEXT NOT NULL DEFAULT 'built_in'",
        [],
    )
    .map_err(|e| format!("新增 platform_connections.platform_type 失败: {}", e))?;
    Ok(())
}

fn ensure_platform_connection_sync_mode_column(conn: &Connection) -> Result<(), String> {
    if has_column(conn, "platform_connections", "sync_mode")? {
        return Ok(());
    }

    conn.execute(
        "ALTER TABLE platform_connections ADD COLUMN sync_mode TEXT NOT NULL DEFAULT 'copy'",
        [],
    )
    .map_err(|e| format!("新增 platform_connections.sync_mode 失败: {}", e))?;
    Ok(())
}

fn ensure_platform_connection_detect_dir_column(conn: &Connection) -> Result<(), String> {
    if has_column(conn, "platform_connections", "detect_dir")? {
        conn.execute(
            "UPDATE platform_connections
             SET detect_dir = skills_dir
             WHERE (detect_dir IS NULL OR trim(detect_dir) = '')
               AND skills_dir IS NOT NULL
               AND trim(skills_dir) <> ''",
            [],
        )
        .map_err(|e| format!("回填 platform_connections.detect_dir 失败: {}", e))?;
        return Ok(());
    }

    conn.execute(
        "ALTER TABLE platform_connections ADD COLUMN detect_dir TEXT",
        [],
    )
    .map_err(|e| format!("新增 platform_connections.detect_dir 失败: {}", e))?;

    conn.execute(
        "UPDATE platform_connections
         SET detect_dir = skills_dir
         WHERE skills_dir IS NOT NULL
           AND trim(skills_dir) <> ''",
        [],
    )
    .map_err(|e| format!("回填 platform_connections.detect_dir 失败: {}", e))?;

    Ok(())
}

fn ensure_platform_connection_supports_project_scope_column(
    conn: &Connection,
) -> Result<(), String> {
    if has_column(conn, "platform_connections", "supports_project_scope")? {
        return Ok(());
    }

    conn.execute(
        "ALTER TABLE platform_connections ADD COLUMN supports_project_scope INTEGER DEFAULT 0",
        [],
    )
    .map_err(|e| {
        format!(
            "新增 platform_connections.supports_project_scope 失败: {}",
            e
        )
    })?;
    Ok(())
}

fn ensure_platform_connection_supports_symlink_column(conn: &Connection) -> Result<(), String> {
    if has_column(conn, "platform_connections", "supports_symlink")? {
        return Ok(());
    }

    conn.execute(
        "ALTER TABLE platform_connections ADD COLUMN supports_symlink INTEGER DEFAULT 1",
        [],
    )
    .map_err(|e| format!("新增 platform_connections.supports_symlink 失败: {}", e))?;
    Ok(())
}

fn ensure_platform_connection_supports_copy_column(conn: &Connection) -> Result<(), String> {
    if has_column(conn, "platform_connections", "supports_copy")? {
        return Ok(());
    }

    conn.execute(
        "ALTER TABLE platform_connections ADD COLUMN supports_copy INTEGER DEFAULT 1",
        [],
    )
    .map_err(|e| format!("新增 platform_connections.supports_copy 失败: {}", e))?;
    Ok(())
}

fn ensure_sync_logs_snapshot_id_column(conn: &Connection) -> Result<(), String> {
    if has_column(conn, "sync_logs", "snapshot_id")? {
        return Ok(());
    }

    conn.execute("ALTER TABLE sync_logs ADD COLUMN snapshot_id TEXT", [])
        .map_err(|e| format!("新增 sync_logs.snapshot_id 失败: {}", e))?;

    Ok(())
}

fn ensure_sync_logs_action_column(conn: &Connection) -> Result<(), String> {
    if has_column(conn, "sync_logs", "action")? {
        return Ok(());
    }

    conn.execute(
        "ALTER TABLE sync_logs ADD COLUMN action TEXT NOT NULL DEFAULT 'sync'",
        [],
    )
    .map_err(|e| format!("新增 sync_logs.action 失败: {}", e))?;

    Ok(())
}

fn ensure_platform_release_targets_table(conn: &Connection) -> Result<(), String> {
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

fn ensure_team_delivery_targets_table(conn: &Connection) -> Result<(), String> {
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

    Ok(())
}

fn ensure_team_delivery_logs_table(conn: &Connection) -> Result<(), String> {
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

    Ok(())
}

fn ensure_team_activity_logs_table(conn: &Connection) -> Result<(), String> {
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

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_team_activity_logs_team_created_at
         ON team_activity_logs(team_id, created_at DESC, id DESC)",
        [],
    )
    .map_err(|e| format!("创建团队活动时间索引失败: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_team_activity_logs_actor_created_at
         ON team_activity_logs(actor, created_at DESC)",
        [],
    )
    .map_err(|e| format!("创建团队活动操作者索引失败: {}", e))?;

    Ok(())
}

fn ensure_team_status_column(conn: &Connection) -> Result<(), String> {
    if has_column(conn, "teams", "status")? {
        conn.execute(
            "UPDATE teams
             SET status = 'active'
             WHERE status IS NULL OR trim(status) = ''",
            [],
        )
        .map_err(|e| format!("回填 teams.status 失败: {}", e))?;
        return Ok(());
    }

    conn.execute(
        "ALTER TABLE teams ADD COLUMN status TEXT NOT NULL DEFAULT 'active'",
        [],
    )
    .map_err(|e| format!("新增 teams.status 失败: {}", e))?;
    Ok(())
}

fn ensure_team_updated_at_column(conn: &Connection) -> Result<(), String> {
    if has_column(conn, "teams", "updated_at")? {
        conn.execute(
            "UPDATE teams
             SET updated_at = created_at
             WHERE updated_at IS NULL OR updated_at = 0",
            [],
        )
        .map_err(|e| format!("回填 teams.updated_at 失败: {}", e))?;
        return Ok(());
    }

    conn.execute(
        "ALTER TABLE teams ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0",
        [],
    )
    .map_err(|e| format!("新增 teams.updated_at 失败: {}", e))?;
    conn.execute(
        "UPDATE teams
         SET updated_at = created_at
         WHERE updated_at = 0",
        [],
    )
    .map_err(|e| format!("初始化 teams.updated_at 失败: {}", e))?;
    Ok(())
}

fn ensure_team_member_email_column(conn: &Connection) -> Result<(), String> {
    if has_column(conn, "team_members", "email")? {
        return Ok(());
    }

    conn.execute("ALTER TABLE team_members ADD COLUMN email TEXT", [])
        .map_err(|e| format!("新增 team_members.email 失败: {}", e))?;
    Ok(())
}

fn ensure_team_member_role_column(conn: &Connection) -> Result<(), String> {
    if has_column(conn, "team_members", "role")? {
        conn.execute(
            "UPDATE team_members
             SET role = 'owner'
             WHERE role IS NULL OR trim(role) = ''",
            [],
        )
        .map_err(|e| format!("回填 team_members.role 失败: {}", e))?;
        return Ok(());
    }

    conn.execute(
        "ALTER TABLE team_members ADD COLUMN role TEXT NOT NULL DEFAULT 'owner'",
        [],
    )
    .map_err(|e| format!("新增 team_members.role 失败: {}", e))?;
    Ok(())
}

fn ensure_team_member_status_column(conn: &Connection) -> Result<(), String> {
    if has_column(conn, "team_members", "status")? {
        conn.execute(
            "UPDATE team_members
             SET status = 'active'
             WHERE status IS NULL OR trim(status) = ''",
            [],
        )
        .map_err(|e| format!("回填 team_members.status 失败: {}", e))?;
        return Ok(());
    }

    conn.execute(
        "ALTER TABLE team_members ADD COLUMN status TEXT NOT NULL DEFAULT 'active'",
        [],
    )
    .map_err(|e| format!("新增 team_members.status 失败: {}", e))?;
    Ok(())
}

fn ensure_team_member_updated_at_column(conn: &Connection) -> Result<(), String> {
    if has_column(conn, "team_members", "updated_at")? {
        conn.execute(
            "UPDATE team_members
             SET updated_at = joined_at
             WHERE updated_at IS NULL OR updated_at = 0",
            [],
        )
        .map_err(|e| format!("回填 team_members.updated_at 失败: {}", e))?;
        return Ok(());
    }

    conn.execute(
        "ALTER TABLE team_members ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0",
        [],
    )
    .map_err(|e| format!("新增 team_members.updated_at 失败: {}", e))?;
    conn.execute(
        "UPDATE team_members
         SET updated_at = joined_at
         WHERE updated_at = 0",
        [],
    )
    .map_err(|e| format!("初始化 team_members.updated_at 失败: {}", e))?;
    Ok(())
}

fn ensure_team_submission_base_columns(conn: &Connection) -> Result<(), String> {
    if !has_column(conn, "team_submissions", "base_team_version_id")? {
        conn.execute(
            "ALTER TABLE team_submissions ADD COLUMN base_team_version_id TEXT",
            [],
        )
        .map_err(|e| format!("新增 team_submissions.base_team_version_id 失败: {}", e))?;
    }

    if !has_column(conn, "team_submissions", "base_revision_hash")? {
        conn.execute(
            "ALTER TABLE team_submissions ADD COLUMN base_revision_hash TEXT",
            [],
        )
        .map_err(|e| format!("新增 team_submissions.base_revision_hash 失败: {}", e))?;
    }

    conn.execute(
        "UPDATE team_submissions
         SET base_team_version_id = (
                 SELECT latest.id
                 FROM team_skill_versions latest
                 WHERE latest.team_skill_id = team_submissions.team_skill_id
                 ORDER BY latest.version_number DESC
                 LIMIT 1
             ),
             base_revision_hash = (
                 SELECT latest.revision_hash
                 FROM team_skill_versions latest
                 WHERE latest.team_skill_id = team_submissions.team_skill_id
                 ORDER BY latest.version_number DESC
                 LIMIT 1
             )
         WHERE team_skill_id IS NOT NULL
           AND base_team_version_id IS NULL",
        [],
    )
    .map_err(|e| format!("回填 team_submissions 基准版本失败: {}", e))?;

    Ok(())
}

fn ensure_project_tables(conn: &Connection) -> Result<(), String> {
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

    let indexes = [
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

fn has_column(conn: &Connection, table: &str, column: &str) -> Result<bool, String> {
    let mut stmt = conn
        .prepare(&format!("PRAGMA table_info({})", table))
        .map_err(|e| format!("读取 {} 列信息失败: {}", table, e))?;
    let columns = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|e| format!("查询 {} 列信息失败: {}", table, e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("解析 {} 列信息失败: {}", table, e))?;

    Ok(columns.iter().any(|existing| existing == column))
}
