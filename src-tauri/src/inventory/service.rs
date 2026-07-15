use std::collections::HashMap;
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

use rusqlite::Connection;

use super::hashing::normalize_existing_path;
use super::model::{
    InstanceListInput, InstanceListResult, InstancesChangedEvent, ScanProgressEvent, ScanRoot,
    ScanRootUpsertInput, ScanRun, ScanStartInput, SkillInstanceDetail,
};
use super::{repository, scanner};

static ACTIVE_SCANS: OnceLock<Mutex<HashMap<String, Arc<AtomicBool>>>> = OnceLock::new();
static ACTIVE_ROOTS: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();

fn active_scans() -> &'static Mutex<HashMap<String, Arc<AtomicBool>>> {
    ACTIVE_SCANS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn active_roots() -> &'static Mutex<HashMap<String, String>> {
    ACTIVE_ROOTS.get_or_init(|| Mutex::new(HashMap::new()))
}

#[derive(Debug, Clone)]
pub struct PreparedScan {
    pub run: ScanRun,
    pub roots: Vec<ScanRoot>,
    pub db_path: PathBuf,
}

pub fn root_list(conn: &Connection, home: &Path) -> Result<Vec<ScanRoot>, String> {
    repository::discover_platform_roots(conn, home, now_ms())?;
    repository::list_roots(conn)
}

pub fn root_upsert(conn: &Connection, input: &ScanRootUpsertInput) -> Result<ScanRoot, String> {
    repository::upsert_root(conn, input, now_ms())
}

pub fn prepare_scan(
    conn: &Connection,
    db_path: PathBuf,
    home: &Path,
    input: &ScanStartInput,
) -> Result<PreparedScan, String> {
    repository::discover_platform_roots(conn, home, now_ms())?;
    let roots = repository::selected_roots(conn, &input.root_ids)?;
    if !input.root_ids.is_empty() && roots.len() != input.root_ids.len() {
        return Err("一个或多个扫描根不存在或未启用".to_string());
    }
    {
        let active = active_roots()
            .lock()
            .map_err(|_| "扫描根锁注册表已损坏".to_string())?;
        if let Some(root) = roots.iter().find(|root| active.contains_key(&root.id)) {
            return Err(format!("扫描根正在被其他任务扫描: {}", root.path));
        }
    }
    let run = repository::create_scan_run(conn, input, roots.len() as i64, now_ms())?;
    let token = Arc::new(AtomicBool::new(false));
    active_scans()
        .lock()
        .map_err(|_| "扫描取消注册表已损坏".to_string())?
        .insert(run.id.clone(), token);
    {
        let mut active = active_roots()
            .lock()
            .map_err(|_| "扫描根锁注册表已损坏".to_string())?;
        for root in &roots {
            active.insert(root.id.clone(), run.id.clone());
        }
    }
    Ok(PreparedScan {
        run,
        roots,
        db_path,
    })
}

pub fn execute_scan<P, C>(
    prepared: PreparedScan,
    input: &ScanStartInput,
    mut on_progress: P,
    mut on_changed: C,
) -> Result<ScanRun, String>
where
    P: FnMut(ScanProgressEvent),
    C: FnMut(InstancesChangedEvent),
{
    let token = active_scans()
        .lock()
        .map_err(|_| "扫描取消注册表已损坏".to_string())?
        .get(&prepared.run.id)
        .cloned()
        .unwrap_or_else(|| Arc::new(AtomicBool::new(false)));
    let mut conn = Connection::open(&prepared.db_path)
        .map_err(|e| format!("打开 inventory 数据库失败: {e}"))?;
    conn.execute_batch("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;")
        .map_err(|e| format!("配置 inventory 数据库连接失败: {e}"))?;
    let mut run = prepared.run;
    emit_progress(&run, None, &mut on_progress);
    let mut summaries = Vec::new();

    for root in prepared.roots {
        if token.load(Ordering::Relaxed) {
            break;
        }
        let root_path = PathBuf::from(&root.path);
        if !root_path.is_dir() {
            run.error_count += 1;
            summaries.push(format!("扫描根不存在: {}", root.path));
            run.roots_completed += 1;
            repository::update_scan_run(&conn, &run)?;
            emit_progress(&run, Some(root.path.clone()), &mut on_progress);
            continue;
        }

        let discovery = scanner::discover_skill_roots(&root_path, root.recursive, &token);
        run.error_count += discovery.warnings.len() as i64;
        summaries.extend(discovery.warnings.into_iter().take(10));
        let mut changed_ids = Vec::new();
        for candidate in discovery.skill_roots {
            if token.load(Ordering::Relaxed) {
                break;
            }
            run.candidates_seen += 1;
            let current_path = candidate.to_string_lossy().to_string();
            let changed_before = changed_ids.len();
            let result = process_candidate(
                &mut conn,
                &root,
                &candidate,
                input.mode == super::model::ScanMode::Full,
                &mut changed_ids,
            );
            match result {
                Ok(true) => run.instances_changed += 1,
                Ok(false) => {}
                Err(error) => {
                    if changed_ids.len() > changed_before {
                        run.instances_changed += 1;
                    }
                    run.error_count += 1;
                    if summaries.len() < 20 {
                        summaries.push(error);
                    }
                }
            }
            emit_progress(&run, Some(current_path), &mut on_progress);
        }

        if !token.load(Ordering::Relaxed) {
            let now = now_ms();
            let missing = repository::mark_missing_for_root(&conn, &root.id, run.started_at, now)?;
            run.instances_changed += missing.len() as i64;
            changed_ids.extend(missing);
            repository::mark_root_scanned(&conn, &root.id, now)?;
            run.roots_completed += 1;
            repository::update_scan_run(&conn, &run)?;
        }
        if !changed_ids.is_empty() {
            changed_ids.sort();
            changed_ids.dedup();
            on_changed(InstancesChangedEvent {
                run_id: run.id.clone(),
                instance_ids: changed_ids,
            });
        }
    }

    if token.load(Ordering::Relaxed) {
        let now = now_ms();
        run.status = "cancelled".to_string();
        run.cancelled_at = Some(now);
        run.completed_at = Some(now);
    } else {
        let duplicate_changes = repository::recalculate_duplicates(&conn)?;
        if !duplicate_changes.is_empty() {
            on_changed(InstancesChangedEvent {
                run_id: run.id.clone(),
                instance_ids: duplicate_changes,
            });
        }
        run.status = "completed".to_string();
        run.completed_at = Some(now_ms());
    }
    if !summaries.is_empty() {
        run.error_summary = Some(summaries.join(" | "));
    }
    repository::update_scan_run(&conn, &run)?;
    emit_progress(&run, None, &mut on_progress);
    active_scans()
        .lock()
        .map_err(|_| "扫描取消注册表已损坏".to_string())?
        .remove(&run.id);
    unregister_roots(&run.id)?;
    Ok(run)
}

fn process_candidate(
    conn: &mut Connection,
    root: &ScanRoot,
    candidate: &Path,
    force_full: bool,
    changed_ids: &mut Vec<String>,
) -> Result<bool, String> {
    let (_, normalized_path) = normalize_existing_path(candidate)?;
    let signature = scanner::quick_scan_signature(candidate)?;
    if !force_full
        && repository::previous_signature(conn, &normalized_path)?.as_deref() == Some(&signature)
    {
        repository::touch_unchanged(conn, &normalized_path, root, now_ms())?;
        return Ok(false);
    }
    let now = now_ms();
    let (indexed, evidence) = scanner::index_skill(
        candidate,
        Path::new(&root.path),
        root.platform_name.as_deref(),
        now,
    )?;
    let parse_failed = indexed.parsed.error.is_some();
    let id = repository::upsert_indexed_skill(conn, root, &indexed, &evidence, now)?;
    changed_ids.push(id);
    if parse_failed {
        return Err(format!(
            "{}: {}",
            candidate.display(),
            indexed.parsed.error.as_deref().unwrap_or("解析失败")
        ));
    }
    Ok(true)
}

pub fn fail_scan(prepared: &PreparedScan, error: &str) -> Result<ScanRun, String> {
    let conn = Connection::open(&prepared.db_path)
        .map_err(|e| format!("打开 inventory 数据库失败: {e}"))?;
    let mut run = prepared.run.clone();
    run.status = "failed".to_string();
    run.error_count += 1;
    run.error_summary = Some(error.to_string());
    run.completed_at = Some(now_ms());
    repository::update_scan_run(&conn, &run)?;
    active_scans()
        .lock()
        .map_err(|_| "扫描取消注册表已损坏".to_string())?
        .remove(&run.id);
    unregister_roots(&run.id)?;
    Ok(run)
}

pub fn cancel_scan(run_id: &str) -> Result<bool, String> {
    let scans = active_scans()
        .lock()
        .map_err(|_| "扫描取消注册表已损坏".to_string())?;
    if let Some(token) = scans.get(run_id) {
        token.store(true, Ordering::Relaxed);
        Ok(true)
    } else {
        Ok(false)
    }
}

pub fn instance_list(
    conn: &Connection,
    input: &InstanceListInput,
) -> Result<InstanceListResult, String> {
    repository::list_instances(conn, input)
}

pub fn instance_get(conn: &Connection, instance_id: &str) -> Result<SkillInstanceDetail, String> {
    repository::get_instance(conn, instance_id)
}

pub fn read_instance_text_file(
    conn: &Connection,
    instance_id: &str,
    relative_path: &str,
) -> Result<String, String> {
    const MAX_PREVIEW_BYTES: u64 = 2 * 1024 * 1024;

    let relative = Path::new(relative_path);
    if relative.as_os_str().is_empty()
        || relative.is_absolute()
        || relative
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err("relativePath 必须是实例根目录内的普通相对文件路径".to_string());
    }

    let detail = repository::get_instance(conn, instance_id)?;
    if detail.instance.missing_at.is_some() {
        return Err("Skill 实例已不存在，请重新扫描".to_string());
    }
    let root = PathBuf::from(&detail.instance.absolute_path)
        .canonicalize()
        .map_err(|error| format!("解析 Skill 实例目录失败: {error}"))?;
    let mut candidate = root.clone();
    for component in relative.components() {
        let Component::Normal(segment) = component else {
            return Err("relativePath 包含非法路径分量".to_string());
        };
        candidate.push(segment);
        let metadata = std::fs::symlink_metadata(&candidate)
            .map_err(|error| format!("读取实例文件元数据失败: {error}"))?;
        if metadata.file_type().is_symlink() {
            return Err("只读预览不跟随符号链接".to_string());
        }
    }

    let canonical = candidate
        .canonicalize()
        .map_err(|error| format!("解析实例文件失败: {error}"))?;
    if !canonical.starts_with(&root) {
        return Err("实例文件路径越出 Skill 根目录".to_string());
    }
    let metadata = canonical
        .metadata()
        .map_err(|error| format!("读取实例文件信息失败: {error}"))?;
    if !metadata.is_file() {
        return Err("只读预览目标不是普通文件".to_string());
    }
    if metadata.len() > MAX_PREVIEW_BYTES {
        return Err("实例文件超过 2 MiB 只读预览上限".to_string());
    }

    let bytes = std::fs::read(&canonical).map_err(|error| format!("读取实例文件失败: {error}"))?;
    String::from_utf8(bytes).map_err(|_| "实例文件不是有效 UTF-8 文本".to_string())
}

pub fn run_scan_at_path(
    data_dir: &Path,
    home: &Path,
    input: &ScanStartInput,
) -> Result<ScanRun, String> {
    let conn = crate::db::init_db_at_path(data_dir)?;
    let prepared = prepare_scan(&conn, data_dir.join("metadata.db"), home, input)?;
    match execute_scan(prepared.clone(), input, |_| {}, |_| {}) {
        Ok(run) => Ok(run),
        Err(error) => {
            let _ = fail_scan(&prepared, &error);
            Err(error)
        }
    }
}

fn emit_progress<F: FnMut(ScanProgressEvent)>(
    run: &ScanRun,
    current_path: Option<String>,
    callback: &mut F,
) {
    callback(ScanProgressEvent {
        run_id: run.id.clone(),
        status: run.status.clone(),
        roots_total: run.roots_total,
        roots_completed: run.roots_completed,
        candidates_seen: run.candidates_seen,
        instances_changed: run.instances_changed,
        error_count: run.error_count,
        current_path,
    });
}

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

fn unregister_roots(run_id: &str) -> Result<(), String> {
    active_roots()
        .lock()
        .map_err(|_| "扫描根锁注册表已损坏".to_string())?
        .retain(|_, owner| owner != run_id);
    Ok(())
}
