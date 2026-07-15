use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::{Connection, OptionalExtension};

use super::file_transaction::{assert_owned_path, atomic_write, safe_remove_dir_all};
use super::model::{RecoveryReport, StagingJournal};

pub struct JournalStore {
    workspace_root: PathBuf,
}

impl JournalStore {
    pub fn new(workspace_root: PathBuf) -> Result<Self, String> {
        if !workspace_root.is_absolute() {
            return Err("journal 工作区必须是绝对路径".to_string());
        }
        fs::create_dir_all(workspace_root.join("staging/journals"))
            .map_err(|error| format!("创建 journal 目录失败: {error}"))?;
        Ok(Self { workspace_root })
    }

    pub fn path(&self, id: &str) -> PathBuf {
        self.workspace_root
            .join("staging/journals")
            .join(format!("{id}.json"))
    }

    pub fn write(&self, conn: &Connection, journal: &StagingJournal) -> Result<(), String> {
        let path = self.path(&journal.id);
        let bytes = serde_json::to_vec_pretty(journal)
            .map_err(|error| format!("序列化 journal 失败: {error}"))?;
        atomic_write(&path, &bytes)?;
        conn.execute(
            "INSERT INTO staging_journals (
                id, operation_type, journal_path, phase, status, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, 'pending', ?5, ?6)
             ON CONFLICT(id) DO UPDATE SET phase = excluded.phase,
                 status = 'pending', updated_at = excluded.updated_at",
            rusqlite::params![
                journal.id,
                journal.operation_type,
                path.to_string_lossy(),
                journal.phase,
                journal.updated_at,
                journal.updated_at,
            ],
        )
        .map_err(|error| format!("记录 staging journal 失败: {error}"))?;
        Ok(())
    }

    pub fn complete(&self, conn: &Connection, id: &str) -> Result<(), String> {
        let now = crate::store::now_ms();
        conn.execute(
            "UPDATE staging_journals SET status = 'completed', updated_at = ?2 WHERE id = ?1",
            rusqlite::params![id, now],
        )
        .map_err(|error| format!("完成 staging journal 失败: {error}"))?;
        let path = self.path(id);
        if path.exists() {
            fs::remove_file(path).map_err(|error| format!("清理 journal 文件失败: {error}"))?;
        }
        Ok(())
    }

    pub fn recover(&self, conn: &Connection) -> Result<RecoveryReport, String> {
        let mut report = RecoveryReport {
            recovered: Vec::new(),
            cleaned: Vec::new(),
            errors: Vec::new(),
        };
        let root = self.workspace_root.join("staging/journals");
        for entry in fs::read_dir(&root).map_err(|error| format!("扫描 journal 失败: {error}"))?
        {
            let entry = match entry {
                Ok(entry) => entry,
                Err(error) => {
                    report.errors.push(error.to_string());
                    continue;
                }
            };
            if entry.path().extension().and_then(|value| value.to_str()) != Some("json") {
                continue;
            }
            let journal = match fs::read(entry.path())
                .map_err(|error| error.to_string())
                .and_then(|bytes| {
                    serde_json::from_slice::<StagingJournal>(&bytes).map_err(|e| e.to_string())
                }) {
                Ok(journal) => journal,
                Err(error) => {
                    report.errors.push(format!(
                        "无法读取 journal {}: {error}",
                        entry.path().display()
                    ));
                    continue;
                }
            };
            match self.recover_one(conn, &journal) {
                Ok(action) => {
                    if action == "cleaned" {
                        report.cleaned.push(journal.id.clone());
                    } else {
                        report.recovered.push(journal.id.clone());
                    }
                    let now = crate::store::now_ms();
                    let _ = conn.execute(
                        "UPDATE staging_journals SET status = 'recovered', recovered_at = ?2,
                            updated_at = ?2 WHERE id = ?1",
                        rusqlite::params![journal.id, now],
                    );
                    let _ = fs::remove_file(entry.path());
                }
                Err(error) => report.errors.push(format!("{}: {error}", journal.id)),
            }
        }
        Ok(report)
    }

    fn recover_one(
        &self,
        conn: &Connection,
        journal: &StagingJournal,
    ) -> Result<&'static str, String> {
        match journal.operation_type.as_str() {
            "import" => {
                if let Some(staging) = journal.staging_path.as_deref() {
                    let staging = Path::new(staging);
                    safe_remove_dir_all(&self.workspace_root.join("staging/import"), staging)?;
                }
                let now = crate::store::now_ms();
                conn.execute(
                    "UPDATE library_operation_plans SET status = 'failed', executed_at = ?2
                     WHERE id = ?1 AND status = 'planned'",
                    rusqlite::params![journal.id, now],
                )
                .map_err(|error| format!("标记崩溃导入计划失败: {error}"))?;
                Ok("cleaned")
            }
            "trash" => {
                let skill_id = journal
                    .entity_id
                    .as_deref()
                    .ok_or_else(|| "trash journal 缺少 entityId".to_string())?;
                let lifecycle: Option<String> = conn
                    .query_row(
                        "SELECT lifecycle_state FROM skills WHERE id = ?1",
                        [skill_id],
                        |row| row.get(0),
                    )
                    .optional()
                    .map_err(|error| format!("读取生命周期状态失败: {error}"))?;
                if lifecycle.as_deref() != Some("trashed") {
                    self.move_back(journal, "trash")?;
                    Ok("recovered")
                } else {
                    Ok("cleaned")
                }
            }
            "restore" => {
                let skill_id = journal
                    .entity_id
                    .as_deref()
                    .ok_or_else(|| "restore journal 缺少 entityId".to_string())?;
                let lifecycle: Option<String> = conn
                    .query_row(
                        "SELECT lifecycle_state FROM skills WHERE id = ?1",
                        [skill_id],
                        |row| row.get(0),
                    )
                    .optional()
                    .map_err(|error| format!("读取生命周期状态失败: {error}"))?;
                if lifecycle.as_deref() != Some("active") {
                    self.move_back(journal, "restore")?;
                    Ok("recovered")
                } else {
                    Ok("cleaned")
                }
            }
            "purge" => {
                let trash_entry_id = journal
                    .entity_id
                    .as_deref()
                    .ok_or_else(|| "purge journal 缺少 entityId".to_string())?;
                let still_trashed: bool = conn
                    .query_row(
                        "SELECT EXISTS(SELECT 1 FROM trash_entries WHERE id = ?1 AND status = 'trashed')",
                        [trash_entry_id],
                        |row| row.get::<_, i64>(0),
                    )
                    .map_err(|error| format!("读取永久删除状态失败: {error}"))?
                    != 0;
                let source = journal
                    .source_path
                    .as_deref()
                    .map(Path::new)
                    .ok_or_else(|| "purge journal 缺少 sourcePath".to_string())?;
                let staging = journal
                    .target_path
                    .as_deref()
                    .map(Path::new)
                    .ok_or_else(|| "purge journal 缺少 targetPath".to_string())?;
                if still_trashed && staging.exists() && !source.exists() {
                    assert_owned_path(&self.workspace_root.join("staging"), staging)?;
                    fs::rename(staging, source)
                        .map_err(|error| format!("回滚永久删除 staging 失败: {error}"))?;
                    Ok("recovered")
                } else {
                    if staging.exists() {
                        safe_remove_dir_all(&self.workspace_root.join("staging"), staging)?;
                    }
                    if !still_trashed {
                        let manifest = self
                            .workspace_root
                            .join("trash/manifests")
                            .join(format!("{trash_entry_id}.json"));
                        if manifest.exists() {
                            assert_owned_path(
                                &self.workspace_root.join("trash/manifests"),
                                &manifest,
                            )?;
                            fs::remove_file(manifest).map_err(|error| {
                                format!("清理已永久删除 manifest 失败: {error}")
                            })?;
                        }
                    }
                    Ok("cleaned")
                }
            }
            "edit" => {
                if let Some(staging) = journal.staging_path.as_deref() {
                    let path = Path::new(staging);
                    if path.exists() {
                        assert_owned_path(&self.workspace_root.join("skills"), path)?;
                        fs::remove_file(path)
                            .map_err(|error| format!("清理编辑临时文件失败: {error}"))?;
                    }
                }
                Ok("cleaned")
            }
            other => Err(format!("未知 journal operationType: {other}")),
        }
    }

    fn move_back(&self, journal: &StagingJournal, direction: &str) -> Result<(), String> {
        let source = journal
            .source_path
            .as_deref()
            .map(Path::new)
            .ok_or_else(|| "journal 缺少 sourcePath".to_string())?;
        let target = journal
            .target_path
            .as_deref()
            .map(Path::new)
            .ok_or_else(|| "journal 缺少 targetPath".to_string())?;
        let (current, destination, current_root, destination_root) = if direction == "trash" {
            (
                target,
                source,
                self.workspace_root.join("trash/skills"),
                self.workspace_root.join("skills"),
            )
        } else {
            (
                target,
                source,
                self.workspace_root.join("skills"),
                self.workspace_root.join("trash/skills"),
            )
        };
        if current.exists() && !destination.exists() {
            assert_owned_path(&current_root, current)?;
            let parent = destination
                .parent()
                .ok_or_else(|| "恢复目标缺少父目录".to_string())?;
            fs::create_dir_all(parent).map_err(|error| format!("创建恢复父目录失败: {error}"))?;
            let lexical_parent = parent
                .canonicalize()
                .map_err(|error| format!("规范化恢复父目录失败: {error}"))?;
            let allowed = destination_root
                .canonicalize()
                .map_err(|error| format!("规范化恢复允许根失败: {error}"))?;
            if !lexical_parent.starts_with(allowed) {
                return Err("PATH_OUTSIDE_ALLOWED_ROOT: journal 恢复目标越界".to_string());
            }
            fs::rename(current, destination)
                .map_err(|error| format!("journal 回滚移动失败: {error}"))?;
            if direction == "trash" {
                if let Some(container) = current.parent() {
                    if let Some(entry_id) = container.file_name().and_then(|value| value.to_str()) {
                        let manifest = self
                            .workspace_root
                            .join("trash/manifests")
                            .join(format!("{entry_id}.json"));
                        if manifest.exists() {
                            assert_owned_path(
                                &self.workspace_root.join("trash/manifests"),
                                &manifest,
                            )?;
                            fs::remove_file(manifest).map_err(|error| {
                                format!("清理回滚回收站 manifest 失败: {error}")
                            })?;
                        }
                    }
                    if container.exists() {
                        safe_remove_dir_all(&self.workspace_root.join("trash/skills"), container)?;
                    }
                }
            }
        }
        Ok(())
    }
}
