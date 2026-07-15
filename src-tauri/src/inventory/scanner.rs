use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};

use super::hashing::{
    content_hash, modified_ms, normalize_existing_path, relative_slashes, sha256_file,
    signature_hash,
};
use super::model::{IndexedSkill, SkillInstanceFile};
use super::parser::parse_skill_md;

const MAX_SCAN_DEPTH: usize = 64;
const MAX_SCAN_ENTRIES: usize = 200_000;

#[derive(Debug, Default)]
pub struct DiscoveryResult {
    pub skill_roots: Vec<PathBuf>,
    pub warnings: Vec<String>,
}

pub fn discover_skill_roots(root: &Path, recursive: bool, cancel: &AtomicBool) -> DiscoveryResult {
    let mut result = DiscoveryResult::default();
    let mut stack = vec![(root.to_path_buf(), 0_usize)];
    let mut entries_seen = 0_usize;
    while let Some((directory, depth)) = stack.pop() {
        if cancel.load(Ordering::Relaxed) {
            break;
        }
        if depth > MAX_SCAN_DEPTH {
            result
                .warnings
                .push(format!("扫描深度超过限制: {}", directory.display()));
            continue;
        }
        let metadata = match fs::symlink_metadata(&directory) {
            Ok(metadata) => metadata,
            Err(error) => {
                result
                    .warnings
                    .push(format!("无法读取目录 {}: {error}", directory.display()));
                continue;
            }
        };
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            result
                .warnings
                .push(format!("跳过符号链接或非目录根: {}", directory.display()));
            continue;
        }
        let read_dir = match fs::read_dir(&directory) {
            Ok(entries) => entries,
            Err(error) => {
                result
                    .warnings
                    .push(format!("无法遍历目录 {}: {error}", directory.display()));
                continue;
            }
        };
        let mut children = Vec::new();
        let mut has_skill_md = false;
        for entry in read_dir {
            entries_seen += 1;
            if entries_seen > MAX_SCAN_ENTRIES {
                result.warnings.push(format!(
                    "扫描条目超过限制 {MAX_SCAN_ENTRIES}: {}",
                    root.display()
                ));
                stack.clear();
                break;
            }
            let entry = match entry {
                Ok(entry) => entry,
                Err(error) => {
                    result.warnings.push(format!("读取目录项失败: {error}"));
                    continue;
                }
            };
            let file_type = match entry.file_type() {
                Ok(file_type) => file_type,
                Err(error) => {
                    result.warnings.push(format!(
                        "读取目录项类型失败 {}: {error}",
                        entry.path().display()
                    ));
                    continue;
                }
            };
            if file_type.is_symlink() {
                continue;
            }
            if file_type.is_file() && is_skill_md(&entry.file_name().to_string_lossy()) {
                has_skill_md = true;
            } else if recursive
                && file_type.is_dir()
                && !ignored_directory(&entry.file_name().to_string_lossy())
            {
                children.push((entry.path(), depth + 1));
            }
        }
        if has_skill_md {
            result.skill_roots.push(directory);
        }
        children.sort_by(|left, right| right.0.cmp(&left.0));
        stack.extend(children);
    }
    result.skill_roots.sort();
    result.skill_roots.dedup();
    result
}

pub fn quick_scan_signature(skill_root: &Path) -> Result<String, String> {
    let entries = walk_entries(skill_root)?;
    let signature_entries = entries
        .iter()
        .map(|entry| {
            Ok((
                relative_slashes(skill_root, &entry.path)?,
                entry.file_type.clone(),
                entry.size,
                entry.modified_at,
            ))
        })
        .collect::<Result<Vec<_>, String>>()?;
    Ok(signature_hash(&signature_entries))
}

pub fn index_skill(
    skill_root: &Path,
    scan_root: &Path,
    platform_name: Option<&str>,
    now: i64,
) -> Result<(IndexedSkill, Vec<crate::origin::model::SourceEvidence>), String> {
    let (absolute_path, normalized_path) = normalize_existing_path(skill_root)?;
    let skill_md_path = locate_skill_md(skill_root)
        .ok_or_else(|| format!("候选目录缺少 SKILL.md: {}", skill_root.display()))?;
    let parsed = parse_skill_md(&skill_md_path);
    let skill_md_hash = sha256_file(&skill_md_path)?;
    let entries = walk_entries(skill_root)?;
    let mut hash_entries = Vec::with_capacity(entries.len());
    let mut files = Vec::with_capacity(entries.len());
    let mut aggregate_risks = BTreeSet::new();
    let mut has_scripts = false;
    let mut has_executables = false;
    let mut last_modified_at = None;
    let mut signature_entries = Vec::with_capacity(entries.len());

    for entry in entries {
        let relative_path = relative_slashes(skill_root, &entry.path)?;
        let risk_flags = risk_flags(&relative_path, &entry.file_type);
        for risk in &risk_flags {
            aggregate_risks.insert(risk.clone());
        }
        has_scripts |= risk_flags.iter().any(|risk| risk == "script");
        has_executables |= risk_flags.iter().any(|risk| risk == "executable");
        last_modified_at = last_modified_at.max(entry.modified_at);
        let hash = if entry.file_type == "file" {
            Some(sha256_file(&entry.path)?)
        } else {
            None
        };
        hash_entries.push((
            relative_path.clone(),
            entry.file_type.clone(),
            entry.size,
            hash.clone(),
        ));
        signature_entries.push((
            relative_path.clone(),
            entry.file_type.clone(),
            entry.size,
            entry.modified_at,
        ));
        files.push(SkillInstanceFile {
            relative_path,
            file_type: entry.file_type,
            size_bytes: entry.size.min(i64::MAX as u64) as i64,
            modified_at: entry.modified_at,
            content_hash: hash,
            risk_flags,
        });
    }

    let facts = crate::origin::evidence::collect(skill_root, scan_root, platform_name, now);
    let folder_name = skill_root
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| "skill".to_string());
    let display_name = parsed
        .name
        .as_deref()
        .filter(|name| !name.trim().is_empty())
        .unwrap_or(&folder_name);
    let canonical_name = canonical_name(display_name);

    Ok((
        IndexedSkill {
            absolute_path,
            normalized_path,
            folder_name,
            parsed,
            canonical_name,
            content_hash: content_hash(&hash_entries),
            skill_md_hash,
            manifest_hash: facts.manifest_hash,
            scan_signature: signature_hash(&signature_entries),
            files,
            has_scripts,
            has_executables,
            risk_flags: aggregate_risks.into_iter().collect(),
            last_modified_at,
            git_remote: facts.git_remote,
            git_commit: facts.git_commit,
            plugin_manifest: facts.plugin_manifest,
        },
        facts.evidence,
    ))
}

pub fn canonical_name(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .chars()
        .map(|character| match character {
            '_' | '-' | '.' => ' ',
            other => other,
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

#[derive(Debug)]
struct WalkEntry {
    path: PathBuf,
    file_type: String,
    size: u64,
    modified_at: Option<i64>,
}

fn walk_entries(root: &Path) -> Result<Vec<WalkEntry>, String> {
    let mut entries = Vec::new();
    let mut stack = vec![(root.to_path_buf(), 0_usize)];
    while let Some((directory, depth)) = stack.pop() {
        if depth > MAX_SCAN_DEPTH {
            return Err(format!("Skill 目录深度超过限制: {}", root.display()));
        }
        let read_dir = fs::read_dir(&directory)
            .map_err(|e| format!("无法遍历 Skill 目录 {}: {e}", directory.display()))?;
        for item in read_dir {
            let item = item.map_err(|e| format!("读取 Skill 目录项失败: {e}"))?;
            if item.file_name() == super::super::services::library_service::MANAGED_MARKER {
                continue;
            }
            let metadata = fs::symlink_metadata(item.path())
                .map_err(|e| format!("读取文件元数据失败 {}: {e}", item.path().display()))?;
            if metadata.is_dir() && !metadata.file_type().is_symlink() {
                if !ignored_directory(&item.file_name().to_string_lossy()) {
                    stack.push((item.path(), depth + 1));
                }
                continue;
            }
            let file_type = if metadata.file_type().is_symlink() {
                "symlink"
            } else if metadata.is_file() {
                "file"
            } else {
                "special"
            };
            entries.push(WalkEntry {
                path: item.path(),
                file_type: file_type.to_string(),
                size: metadata.len(),
                modified_at: modified_ms(&metadata),
            });
            if entries.len() > MAX_SCAN_ENTRIES {
                return Err(format!("Skill 文件数超过限制 {MAX_SCAN_ENTRIES}"));
            }
        }
    }
    entries.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(entries)
}

fn locate_skill_md(root: &Path) -> Option<PathBuf> {
    fs::read_dir(root)
        .ok()?
        .filter_map(Result::ok)
        .find(|entry| {
            entry.file_type().is_ok_and(|file_type| file_type.is_file())
                && is_skill_md(&entry.file_name().to_string_lossy())
        })
        .map(|entry| entry.path())
}

fn is_skill_md(name: &str) -> bool {
    if cfg!(windows) {
        name.eq_ignore_ascii_case("SKILL.md")
    } else {
        name == "SKILL.md"
    }
}

fn ignored_directory(name: &str) -> bool {
    matches!(name, "node_modules" | "target" | ".git")
}

fn risk_flags(relative_path: &str, file_type: &str) -> Vec<String> {
    let mut flags = BTreeSet::new();
    if file_type == "symlink" {
        flags.insert("symlink_skipped".to_string());
    }
    let path = Path::new(relative_path);
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if matches!(
        extension.as_str(),
        "sh" | "bash" | "zsh" | "fish" | "ps1" | "py" | "rb" | "pl" | "js" | "mjs" | "cjs"
    ) {
        flags.insert("script".to_string());
    }
    if matches!(
        extension.as_str(),
        "exe" | "com" | "bat" | "cmd" | "dll" | "so" | "dylib" | "appimage"
    ) {
        flags.insert("executable".to_string());
    }
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if file_name == ".env" || file_name.contains("credential") || file_name.contains("secret") {
        flags.insert("sensitive_filename".to_string());
    }
    if matches!(
        file_name.as_str(),
        "package.json" | "requirements.txt" | "cargo.toml" | "pyproject.toml"
    ) {
        flags.insert("dependency_manifest".to_string());
    }
    flags.into_iter().collect()
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::AtomicBool;

    use super::{discover_skill_roots, index_skill};

    fn write(path: &std::path::Path, content: &str) {
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, content).unwrap();
    }

    #[test]
    fn discovers_nested_system_and_plugin_skills() {
        let root = std::env::temp_dir()
            .join("skill-studio-pro-tests")
            .join(uuid::Uuid::new_v4().to_string());
        write(&root.join("normal/SKILL.md"), "# Normal");
        write(&root.join(".system/system/SKILL.md"), "# System");
        write(&root.join("plugins/cache/demo/SKILL.md"), "# Plugin");
        write(&root.join("not-skill/README.md"), "no");
        let result = discover_skill_roots(&root, true, &AtomicBool::new(false));
        assert_eq!(result.skill_roots.len(), 3);
    }

    #[test]
    fn indexes_hashes_and_risk_flags_without_running_scripts() {
        let root = std::env::temp_dir()
            .join("skill-studio-pro-tests")
            .join(uuid::Uuid::new_v4().to_string());
        let marker = root.join("executed.txt");
        write(
            &root.join("demo/SKILL.md"),
            "---\nname: Demo\ndescription: Test\n---\n# Demo\n",
        );
        write(
            &root.join("demo/scripts/run.ps1"),
            &format!("Set-Content -Path '{}' -Value bad", marker.display()),
        );
        let (indexed, _) = index_skill(&root.join("demo"), &root, Some("codex"), 1).unwrap();
        assert_eq!(indexed.parsed.name.as_deref(), Some("Demo"));
        assert!(indexed.has_scripts);
        assert!(!marker.exists());
        assert_eq!(indexed.skill_md_hash.len(), 64);
        assert_eq!(indexed.content_hash.len(), 64);
    }

    #[test]
    fn symbolic_link_loop_is_never_followed() {
        let root = std::env::temp_dir()
            .join("skill-studio-pro-tests")
            .join(uuid::Uuid::new_v4().to_string());
        write(&root.join("real/SKILL.md"), "# Real");
        #[cfg(unix)]
        std::os::unix::fs::symlink(&root, root.join("real/loop")).unwrap();
        #[cfg(windows)]
        if std::os::windows::fs::symlink_dir(&root, root.join("real/loop")).is_err() {
            return;
        }
        let result = discover_skill_roots(&root, true, &AtomicBool::new(false));
        assert_eq!(result.skill_roots, vec![root.join("real")]);
    }
}
