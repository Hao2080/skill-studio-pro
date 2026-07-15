use rusqlite::Connection;

pub fn ensure_tables(conn: &Connection) -> Result<(), String> {
    create_skill_tables(conn)?;
    create_inventory_tables(conn)?;
    create_ai_tables(conn)?;
    create_team_tables(conn)?;
    create_project_tables(conn)?;
    Ok(())
}

fn create_ai_tables(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS ai_provider_configs (
            provider_id TEXT PRIMARY KEY, provider_type TEXT NOT NULL,
            display_name TEXT NOT NULL, base_url TEXT NOT NULL, default_model TEXT NOT NULL,
            secret_ref TEXT, secret_tail TEXT, enabled INTEGER NOT NULL DEFAULT 0,
            timeout_ms INTEGER NOT NULL DEFAULT 60000,
            max_concurrency INTEGER NOT NULL DEFAULT 4, retry_count INTEGER NOT NULL DEFAULT 2,
            last_test_status TEXT, last_test_at INTEGER, updated_at INTEGER NOT NULL
         );
         CREATE TABLE IF NOT EXISTS ai_task_routes (
            task_type TEXT PRIMARY KEY, provider_id TEXT NOT NULL, model_id TEXT NOT NULL,
            prompt_version TEXT NOT NULL, responsibility TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL,
            FOREIGN KEY (provider_id) REFERENCES ai_provider_configs(provider_id)
         );
         CREATE TABLE IF NOT EXISTS ai_artifacts (
            id TEXT PRIMARY KEY, skill_id TEXT, instance_id TEXT, task_type TEXT NOT NULL,
            provider_id TEXT NOT NULL, model_id TEXT NOT NULL, model_display_name TEXT,
            responsibility TEXT NOT NULL, prompt_version TEXT NOT NULL, input_hash TEXT NOT NULL,
            content_json TEXT NOT NULL, status TEXT NOT NULL, input_tokens INTEGER,
            output_tokens INTEGER, stale_at INTEGER, created_at INTEGER NOT NULL,
            FOREIGN KEY (skill_id) REFERENCES skills(id),
            FOREIGN KEY (instance_id) REFERENCES skill_instances(id) ON DELETE CASCADE,
            FOREIGN KEY (provider_id) REFERENCES ai_provider_configs(provider_id)
         );
         CREATE TABLE IF NOT EXISTS ai_call_logs (
            id TEXT PRIMARY KEY, artifact_id TEXT, provider_id TEXT NOT NULL,
            model_id TEXT NOT NULL, task_type TEXT NOT NULL, status TEXT NOT NULL,
            latency_ms INTEGER, input_tokens INTEGER, output_tokens INTEGER,
            error_code TEXT, error_summary TEXT, started_at INTEGER NOT NULL, completed_at INTEGER,
            FOREIGN KEY (artifact_id) REFERENCES ai_artifacts(id)
         );",
    )
    .map_err(|error| format!("创建 AI 表失败: {error}"))
}

fn create_inventory_tables(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version               INTEGER PRIMARY KEY,
            name                  TEXT NOT NULL,
            applied_at            INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS scan_roots (
            id                    TEXT PRIMARY KEY,
            root_type             TEXT NOT NULL,
            platform_name         TEXT,
            path                  TEXT NOT NULL,
            normalized_path       TEXT NOT NULL UNIQUE,
            enabled               INTEGER NOT NULL DEFAULT 1,
            recursive             INTEGER NOT NULL DEFAULT 1,
            watch_enabled         INTEGER NOT NULL DEFAULT 1,
            ignore_rules_json     TEXT,
            last_scan_at          INTEGER,
            created_at            INTEGER NOT NULL,
            updated_at            INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS scan_runs (
            id                    TEXT PRIMARY KEY,
            mode                  TEXT NOT NULL,
            status                TEXT NOT NULL,
            roots_total           INTEGER NOT NULL DEFAULT 0,
            roots_completed       INTEGER NOT NULL DEFAULT 0,
            candidates_seen       INTEGER NOT NULL DEFAULT 0,
            instances_changed     INTEGER NOT NULL DEFAULT 0,
            error_count           INTEGER NOT NULL DEFAULT 0,
            started_at            INTEGER NOT NULL,
            completed_at          INTEGER,
            cancelled_at          INTEGER,
            error_summary         TEXT
        );
        CREATE TABLE IF NOT EXISTS skill_instances (
            id                    TEXT PRIMARY KEY,
            central_skill_id      TEXT,
            scan_root_id          TEXT,
            platform_name         TEXT,
            scope_type            TEXT NOT NULL,
            absolute_path         TEXT NOT NULL,
            normalized_path       TEXT NOT NULL UNIQUE,
            folder_name           TEXT NOT NULL,
            parsed_name           TEXT,
            canonical_name        TEXT NOT NULL,
            description           TEXT,
            short_description     TEXT,
            metadata_json         TEXT NOT NULL DEFAULT '{}',
            headings_json         TEXT NOT NULL DEFAULT '[]',
            content_hash          TEXT NOT NULL,
            skill_md_hash         TEXT NOT NULL,
            manifest_hash         TEXT,
            scan_signature        TEXT NOT NULL,
            file_count            INTEGER NOT NULL DEFAULT 0,
            has_scripts           INTEGER NOT NULL DEFAULT 0,
            has_executables       INTEGER NOT NULL DEFAULT 0,
            risk_flags_json       TEXT NOT NULL DEFAULT '[]',
            duplicate_kinds_json  TEXT NOT NULL DEFAULT '[]',
            parse_status          TEXT NOT NULL,
            parse_error           TEXT,
            parse_warnings_json   TEXT NOT NULL DEFAULT '[]',
            git_remote            TEXT,
            git_commit            TEXT,
            plugin_manifest_json  TEXT,
            first_seen_at         INTEGER NOT NULL,
            last_seen_at          INTEGER NOT NULL,
            last_modified_at      INTEGER,
            missing_at            INTEGER,
            FOREIGN KEY (central_skill_id) REFERENCES skills(id),
            FOREIGN KEY (scan_root_id) REFERENCES scan_roots(id)
        );
        CREATE TABLE IF NOT EXISTS skill_instance_files (
            instance_id           TEXT NOT NULL,
            relative_path         TEXT NOT NULL,
            file_type             TEXT NOT NULL,
            size_bytes            INTEGER NOT NULL,
            modified_at           INTEGER,
            content_hash          TEXT,
            risk_flags_json       TEXT NOT NULL DEFAULT '[]',
            PRIMARY KEY (instance_id, relative_path),
            FOREIGN KEY (instance_id) REFERENCES skill_instances(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS source_evidence (
            id                    TEXT PRIMARY KEY,
            instance_id           TEXT,
            skill_id              TEXT,
            evidence_type         TEXT NOT NULL,
            evidence_key          TEXT NOT NULL,
            evidence_value        TEXT,
            source_candidate      TEXT,
            weight                INTEGER NOT NULL,
            is_conflict           INTEGER NOT NULL DEFAULT 0,
            resolver_version      TEXT NOT NULL,
            observed_at           INTEGER NOT NULL,
            FOREIGN KEY (instance_id) REFERENCES skill_instances(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS source_resolutions (
            id                    TEXT PRIMARY KEY,
            instance_id           TEXT NOT NULL UNIQUE,
            source_type           TEXT NOT NULL,
            source_label          TEXT NOT NULL,
            source_ref            TEXT,
            confidence            INTEGER NOT NULL CHECK (confidence BETWEEN 0 AND 100),
            resolution_status     TEXT NOT NULL,
            rationale             TEXT NOT NULL,
            user_confirmed        INTEGER NOT NULL DEFAULT 0,
            evidence_hash         TEXT NOT NULL,
            resolved_at           INTEGER NOT NULL,
            updated_at            INTEGER NOT NULL,
            FOREIGN KEY (instance_id) REFERENCES skill_instances(id) ON DELETE CASCADE
        );",
    )
    .map_err(|e| format!("创建 inventory 表失败: {}", e))
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
            storage_rel_path TEXT,
            canonical_name  TEXT,
            active_content_hash TEXT,
            lifecycle_state TEXT NOT NULL DEFAULT 'active',
            trashed_at      INTEGER,
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
            target_path     TEXT,
            sync_mode       TEXT,
            before_hash     TEXT,
            after_hash      TEXT,
            plan_id         TEXT,
            detail_message  TEXT,
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
            target_path     TEXT,
            sync_mode       TEXT NOT NULL DEFAULT 'copy',
            published_content_hash TEXT,
            observed_target_hash TEXT,
            drift_status    TEXT NOT NULL DEFAULT 'unknown',
            last_checked_at INTEGER,
            ownership_token TEXT,
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

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS library_operation_plans (
            id              TEXT PRIMARY KEY,
            operation_type  TEXT NOT NULL,
            entity_id       TEXT,
            plan_hash       TEXT NOT NULL,
            payload_json    TEXT NOT NULL,
            source_hash     TEXT,
            status          TEXT NOT NULL DEFAULT 'planned',
            created_at      INTEGER NOT NULL,
            expires_at      INTEGER NOT NULL,
            executed_at     INTEGER
        );
        CREATE TABLE IF NOT EXISTS operation_locks (
            resource_key    TEXT PRIMARY KEY,
            operation_id    TEXT NOT NULL,
            acquired_at     INTEGER NOT NULL,
            expires_at      INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS operation_logs (
            id              TEXT PRIMARY KEY,
            operation_type  TEXT NOT NULL,
            entity_type     TEXT NOT NULL,
            entity_id       TEXT,
            target_label    TEXT NOT NULL,
            plan_json       TEXT,
            before_hash     TEXT,
            after_hash      TEXT,
            snapshot_id     TEXT,
            status          TEXT NOT NULL,
            error_code      TEXT,
            error_summary   TEXT,
            created_at      INTEGER NOT NULL,
            completed_at    INTEGER
        );",
    )
    .map_err(|e| format!("创建中央库事务表失败: {}", e))?;

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
            "idx_scan_roots_enabled_platform",
            "CREATE INDEX IF NOT EXISTS idx_scan_roots_enabled_platform
             ON scan_roots(enabled, platform_name, normalized_path)",
        ),
        (
            "idx_scan_runs_started_at",
            "CREATE INDEX IF NOT EXISTS idx_scan_runs_started_at
             ON scan_runs(started_at DESC, id DESC)",
        ),
        (
            "idx_skill_instances_root_seen",
            "CREATE INDEX IF NOT EXISTS idx_skill_instances_root_seen
             ON skill_instances(scan_root_id, missing_at, last_seen_at DESC)",
        ),
        (
            "idx_skill_instances_name_hash",
            "CREATE INDEX IF NOT EXISTS idx_skill_instances_name_hash
             ON skill_instances(canonical_name, content_hash, missing_at)",
        ),
        (
            "idx_skill_instance_files_hash",
            "CREATE INDEX IF NOT EXISTS idx_skill_instance_files_hash
             ON skill_instance_files(content_hash, instance_id)",
        ),
        (
            "idx_source_evidence_instance",
            "CREATE INDEX IF NOT EXISTS idx_source_evidence_instance
             ON source_evidence(instance_id, evidence_type, observed_at DESC)",
        ),
        (
            "idx_source_resolutions_confidence",
            "CREATE INDEX IF NOT EXISTS idx_source_resolutions_confidence
             ON source_resolutions(resolution_status, confidence DESC)",
        ),
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
            "idx_library_operation_plans_status_expiry",
            "CREATE INDEX IF NOT EXISTS idx_library_operation_plans_status_expiry
             ON library_operation_plans(status, expires_at)",
        ),
        (
            "idx_operation_locks_expiry",
            "CREATE INDEX IF NOT EXISTS idx_operation_locks_expiry
             ON operation_locks(expires_at)",
        ),
        (
            "idx_operation_logs_entity_created_at",
            "CREATE INDEX IF NOT EXISTS idx_operation_logs_entity_created_at
             ON operation_logs(entity_type, entity_id, created_at DESC)",
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
