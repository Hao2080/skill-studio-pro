use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Read;
use std::path::Path;

use sha2::{Digest, Sha256};
use similar::TextDiff;

use crate::domain::{CompareSnapshotsInput, SnapshotDiffResult, TextDiffEntry};
use crate::store::get_conn;

use rusqlite::Row;

/// 超过此大小的文件跳过内容 diff（1MB）
pub const MAX_DIFF_FILE_SIZE: usize = 1_000_000;

/// 计算文件的 SHA256 哈希（流式读取，避免 OOM）
fn compute_file_hash(path: &Path) -> Result<String, std::io::Error> {
    let file = fs::File::open(path)?;
    let mut reader = std::io::BufReader::with_capacity(8192, file);
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];

    loop {
        let n = reader.read(&mut buffer)?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }

    let digest = hasher.finalize();
    Ok(digest.iter().map(|byte| format!("{:02x}", byte)).collect())
}

/// 判断是否为文本文件（按扩展名）
pub fn is_text_file(path: &Path) -> bool {
    match path.extension().and_then(|e| e.to_str()) {
        Some(ext) => matches!(
            ext.to_lowercase().as_str(),
            "md" | "txt"
                | "json"
                | "yaml"
                | "yml"
                | "toml"
                | "rs"
                | "ts"
                | "tsx"
                | "js"
                | "jsx"
                | "py"
                | "go"
                | "sh"
                | "css"
                | "html"
        ),
        None => false,
    }
}

/// 生成 unified diff 字符串（使用 Patience 算法）
pub fn generate_unified_diff(old_content: &str, new_content: &str, file_path: &str) -> String {
    let diff = TextDiff::from_lines(old_content, new_content);
    let mut output = String::new();

    for hunk in diff
        .unified_diff()
        .context_radius(8)
        .header(&format!("a/{}", file_path), &format!("b/{}", file_path))
        .iter_hunks()
    {
        output.push_str(&hunk.to_string());
    }

    output
}

/// 从 unified diff 中统计实际的增删行数
pub fn count_diff_lines(unified_diff: &str) -> (usize, usize) {
    let mut added = 0;
    let mut removed = 0;

    for line in unified_diff.lines() {
        if line.starts_with('+') && !line.starts_with("+++") {
            added += 1;
        } else if line.starts_with('-') && !line.starts_with("---") {
            removed += 1;
        }
    }

    (added, removed)
}

/// 对比两个目录（旧 -> 新），返回 SnapshotDiffResult。
///
/// 说明：这是现有快照 diff 逻辑的抽取复用，用于团队目录级 diff。
pub fn diff_directories(dir_a: &Path, dir_b: &Path) -> Result<SnapshotDiffResult, String> {
    if !dir_a.exists() {
        return Err(format!("目录不存在: {}", dir_a.display()));
    }
    if !dir_b.exists() {
        return Err(format!("目录不存在: {}", dir_b.display()));
    }

    let files_a = collect_relative_files(dir_a);
    let files_b = collect_relative_files(dir_b);

    let set_a: HashSet<&String> = files_a.keys().collect();
    let set_b: HashSet<&String> = files_b.keys().collect();

    let mut added_files: Vec<String> = set_b.difference(&set_a).map(|s| (*s).clone()).collect();
    let mut deleted_files: Vec<String> = set_a.difference(&set_b).map(|s| (*s).clone()).collect();
    let mut modified_files: Vec<String> = Vec::new();
    let mut text_diffs: HashMap<String, TextDiffEntry> = HashMap::new();

    for rel_path in set_a.intersection(&set_b) {
        let abs_a = dir_a.join(rel_path);
        let abs_b = dir_b.join(rel_path);

        let meta_a = fs::metadata(&abs_a).ok();
        let meta_b = fs::metadata(&abs_b).ok();

        let size_a = meta_a.as_ref().map(|m| m.len()).unwrap_or(0) as usize;
        let size_b = meta_b.as_ref().map(|m| m.len()).unwrap_or(0) as usize;

        if size_a != size_b {
            modified_files.push((*rel_path).clone());
            let is_text = is_text_file(&abs_a) || is_text_file(&abs_b);
            if is_text && size_a <= MAX_DIFF_FILE_SIZE && size_b <= MAX_DIFF_FILE_SIZE {
                let old_content = fs::read_to_string(&abs_a).unwrap_or_default();
                let new_content = fs::read_to_string(&abs_b).unwrap_or_default();
                let unified_diff = generate_unified_diff(&old_content, &new_content, rel_path);
                let (added, removed) = count_diff_lines(&unified_diff);
                text_diffs.insert(
                    (*rel_path).clone(),
                    TextDiffEntry {
                        file_path: (*rel_path).clone(),
                        unified_diff,
                        old_lines: removed,
                        new_lines: added,
                    },
                );
            }
            continue;
        }

        if size_a > MAX_DIFF_FILE_SIZE {
            let hash_match = compute_file_hash(&abs_a).ok() == compute_file_hash(&abs_b).ok();
            if !hash_match {
                modified_files.push((*rel_path).clone());
            }
            continue;
        }

        let content_match = fs::read(&abs_a).ok() == fs::read(&abs_b).ok();
        if content_match {
            continue;
        }

        modified_files.push((*rel_path).clone());

        let is_text = is_text_file(&abs_a) || is_text_file(&abs_b);
        if is_text && size_a <= MAX_DIFF_FILE_SIZE && size_b <= MAX_DIFF_FILE_SIZE {
            let old_content = fs::read_to_string(&abs_a).unwrap_or_default();
            let new_content = fs::read_to_string(&abs_b).unwrap_or_default();
            let unified_diff = generate_unified_diff(&old_content, &new_content, rel_path);
            let (added, removed) = count_diff_lines(&unified_diff);
            text_diffs.insert(
                (*rel_path).clone(),
                TextDiffEntry {
                    file_path: (*rel_path).clone(),
                    unified_diff,
                    old_lines: removed,
                    new_lines: added,
                },
            );
        }
    }

    added_files.sort();
    deleted_files.sort();
    modified_files.sort();

    Ok(SnapshotDiffResult {
        added_files,
        deleted_files,
        modified_files,
        text_diffs,
    })
}

/// 对比两个快照目录
pub fn compare_snapshots(
    app: &tauri::AppHandle,
    input: &CompareSnapshotsInput,
) -> Result<SnapshotDiffResult, String> {
    let conn = get_conn(app)?;

    // 获取两个快照的路径
    let (path_a, _): (String, String) = conn
        .query_row(
            "SELECT snapshot_path, revision_hash FROM skill_snapshots WHERE id = ?1",
            rusqlite::params![input.snapshot_id_a],
            |row: &Row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| format!("快照 A 不存在: {}", input.snapshot_id_a))?;

    let (path_b, _): (String, String) = conn
        .query_row(
            "SELECT snapshot_path, revision_hash FROM skill_snapshots WHERE id = ?1",
            rusqlite::params![input.snapshot_id_b],
            |row: &Row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| format!("快照 B 不存在: {}", input.snapshot_id_b))?;

    let dir_a = Path::new(&path_a);
    let dir_b = Path::new(&path_b);

    diff_directories(dir_a, dir_b)
}

/// 递归收集目录中所有文件的相对路径
fn collect_relative_files(dir: &Path) -> HashMap<String, String> {
    let mut files = HashMap::new();
    if !dir.exists() || !dir.is_dir() {
        return files;
    }

    collect_files_recursive(dir, dir, &mut files);
    files
}

fn collect_files_recursive(base: &Path, current: &Path, files: &mut HashMap<String, String>) {
    if let Ok(entries) = fs::read_dir(current) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.is_dir() {
                collect_files_recursive(base, &path, files);
            } else if path.is_file() {
                if let Ok(relative) = path.strip_prefix(base) {
                    let rel_str = relative.to_string_lossy().replace('\\', "/");
                    files.insert(rel_str, path.to_string_lossy().to_string());
                }
            }
        }
    }
}

/// 对比 skill 工作目录与最新快照，生成完整 Diff
pub fn diff_working_directory(
    app: &tauri::AppHandle,
    skill_id: &str,
) -> Result<SnapshotDiffResult, String> {
    let conn = get_conn(app)?;

    // 获取最新快照路径
    let latest_snapshot_path: String = conn
        .query_row(
            "SELECT snapshot_path FROM skill_snapshots
             WHERE skill_id = ?1 ORDER BY snapshot_number DESC LIMIT 1",
            rusqlite::params![skill_id],
            |row: &Row| row.get(0),
        )
        .map_err(|_| format!("skill '{}' 没有快照", skill_id))?;

    let dir_a = Path::new(&latest_snapshot_path); // 最新快照（旧）
    let work_dir = crate::store::skill_storage_dir(app, skill_id)?; // 工作目录（新）
    let dir_b = work_dir.as_path();

    diff_directories(dir_a, dir_b)
}
