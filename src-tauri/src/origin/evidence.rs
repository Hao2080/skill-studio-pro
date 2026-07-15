use std::fs;
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};
use uuid::Uuid;

use super::model::{OriginFacts, SourceEvidence, RESOLVER_VERSION};

const MAX_MANIFEST_BYTES: u64 = 256 * 1024;
const MAX_GIT_METADATA_BYTES: u64 = 1024 * 1024;

pub fn collect(
    skill_root: &Path,
    scan_root: &Path,
    platform_name: Option<&str>,
    now: i64,
) -> OriginFacts {
    let mut facts = OriginFacts::default();
    if let Some(platform) = platform_name {
        facts.evidence.push(evidence(
            "known_agent_path",
            "platform",
            Some(platform.to_string()),
            Some(format!("{} Agent 目录", platform)),
            15,
            false,
            now,
        ));
    }

    if has_component(skill_root, ".system") {
        facts.evidence.push(evidence(
            "official_system_path",
            "path_component",
            Some(".system".to_string()),
            Some(format!("{} 系统 Skill", platform_name.unwrap_or("Agent"))),
            30,
            false,
            now,
        ));
    }

    if let Some((manifest_path, manifest, manifest_hash)) =
        find_plugin_manifest(skill_root, scan_root)
    {
        let label = manifest
            .get("name")
            .and_then(serde_json::Value::as_str)
            .unwrap_or("插件")
            .to_string();
        facts.evidence.push(evidence(
            "plugin_manifest",
            "manifest_path",
            Some(manifest_path.to_string_lossy().to_string()),
            Some(label),
            35,
            false,
            now,
        ));
        facts.plugin_manifest = Some(manifest);
        facts.manifest_hash = Some(manifest_hash);
    } else if has_component(skill_root, "plugins") || has_component(skill_root, "plugin-cache") {
        facts.evidence.push(evidence(
            "known_agent_path",
            "plugin_cache_path",
            Some(skill_root.to_string_lossy().to_string()),
            Some("Agent 插件缓存".to_string()),
            15,
            false,
            now,
        ));
    }

    if let Some(git_dir) = find_git_dir(skill_root, scan_root) {
        let remote = read_git_remote(&git_dir);
        let commit = read_git_commit(&git_dir);
        if remote.is_some() || commit.is_some() {
            let label = remote
                .clone()
                .unwrap_or_else(|| "本地 Git 仓库".to_string());
            facts.evidence.push(evidence(
                "git_repository",
                "remote_commit",
                commit.clone(),
                Some(label),
                35,
                false,
                now,
            ));
            facts.git_remote = remote;
            facts.git_commit = commit;
        }
    }

    facts
}

pub fn minimax_candidate(
    instance_id: &str,
    candidate: &str,
    value: Option<String>,
    now: i64,
) -> SourceEvidence {
    let mut item = evidence(
        "minimax_candidate",
        "unverified_candidate",
        value,
        Some(candidate.to_string()),
        0,
        false,
        now,
    );
    item.instance_id = Some(instance_id.to_string());
    item
}

pub fn user_confirmation(
    instance_id: &str,
    source_type: &str,
    source_label: &str,
    source_ref: Option<String>,
    now: i64,
) -> SourceEvidence {
    let mut item = evidence(
        "user_confirmed",
        &format!("source_type:{source_type}"),
        source_ref,
        Some(source_label.to_string()),
        100,
        false,
        now,
    );
    item.instance_id = Some(instance_id.to_string());
    item
}

fn evidence(
    evidence_type: &str,
    evidence_key: &str,
    evidence_value: Option<String>,
    source_candidate: Option<String>,
    weight: i32,
    is_conflict: bool,
    now: i64,
) -> SourceEvidence {
    SourceEvidence {
        id: Uuid::new_v4().to_string(),
        instance_id: None,
        skill_id: None,
        evidence_type: evidence_type.to_string(),
        evidence_key: evidence_key.to_string(),
        evidence_value,
        source_candidate,
        weight,
        is_conflict,
        resolver_version: RESOLVER_VERSION.to_string(),
        observed_at: now,
    }
}

fn has_component(path: &Path, expected: &str) -> bool {
    path.components().any(|component| {
        component
            .as_os_str()
            .to_string_lossy()
            .eq_ignore_ascii_case(expected)
    })
}

fn ancestors_within(start: &Path, boundary: &Path) -> Vec<PathBuf> {
    let mut current = Some(start);
    let mut ancestors = Vec::new();
    while let Some(path) = current {
        ancestors.push(path.to_path_buf());
        if path == boundary {
            break;
        }
        current = path.parent();
    }
    ancestors
}

fn find_plugin_manifest(
    skill_root: &Path,
    scan_root: &Path,
) -> Option<(PathBuf, serde_json::Value, String)> {
    for ancestor in ancestors_within(skill_root, scan_root) {
        for candidate in [
            ancestor.join(".codex-plugin").join("plugin.json"),
            ancestor.join("plugin.json"),
        ] {
            if let Some(bytes) = read_bounded(&candidate, MAX_MANIFEST_BYTES) {
                if let Ok(manifest) = serde_json::from_slice::<serde_json::Value>(&bytes) {
                    let hash = format!("{:x}", Sha256::digest(&bytes));
                    return Some((candidate, manifest, hash));
                }
            }
        }
    }
    None
}

fn find_git_dir(skill_root: &Path, scan_root: &Path) -> Option<PathBuf> {
    ancestors_within(skill_root, scan_root)
        .into_iter()
        .map(|ancestor| ancestor.join(".git"))
        .find(|candidate| candidate.is_dir())
}

fn read_git_remote(git_dir: &Path) -> Option<String> {
    let bytes = read_bounded(&git_dir.join("config"), MAX_GIT_METADATA_BYTES)?;
    let text = std::str::from_utf8(&bytes).ok()?;
    let mut in_origin = false;
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') {
            in_origin = trimmed.eq_ignore_ascii_case("[remote \"origin\"]");
        } else if in_origin {
            if let Some(value) = trimmed.strip_prefix("url") {
                return value
                    .split_once('=')
                    .map(|(_, url)| url.trim().to_string())
                    .filter(|url| !url.is_empty());
            }
        }
    }
    None
}

fn read_git_commit(git_dir: &Path) -> Option<String> {
    let head = fs::read_to_string(git_dir.join("HEAD")).ok()?;
    let head = head.trim();
    if let Some(reference) = head.strip_prefix("ref: ") {
        return fs::read_to_string(git_dir.join(reference))
            .ok()
            .map(|value| value.trim().to_string())
            .filter(|value| valid_commit(value));
    }
    Some(head.to_string()).filter(|value| valid_commit(value))
}

fn valid_commit(value: &str) -> bool {
    (7..=64).contains(&value.len()) && value.chars().all(|character| character.is_ascii_hexdigit())
}

fn read_bounded(path: &Path, max_bytes: u64) -> Option<Vec<u8>> {
    let metadata = fs::symlink_metadata(path).ok()?;
    if !metadata.is_file() || metadata.file_type().is_symlink() || metadata.len() > max_bytes {
        return None;
    }
    fs::read(path).ok()
}

#[cfg(test)]
mod tests {
    use super::{collect, minimax_candidate};

    #[test]
    fn detects_git_and_plugin_without_executing_commands() {
        let root = std::env::temp_dir()
            .join("skill-studio-pro-tests")
            .join(uuid::Uuid::new_v4().to_string());
        let skill = root.join("plugin").join("skills").join("demo");
        std::fs::create_dir_all(root.join(".git").join("refs").join("heads")).unwrap();
        std::fs::create_dir_all(root.join("plugin").join(".codex-plugin")).unwrap();
        std::fs::create_dir_all(&skill).unwrap();
        std::fs::write(
            root.join(".git").join("config"),
            "[remote \"origin\"]\n  url = https://example.invalid/demo.git\n",
        )
        .unwrap();
        std::fs::write(root.join(".git").join("HEAD"), "ref: refs/heads/main\n").unwrap();
        std::fs::write(
            root.join(".git").join("refs").join("heads").join("main"),
            "0123456789abcdef0123456789abcdef01234567\n",
        )
        .unwrap();
        std::fs::write(
            root.join("plugin")
                .join(".codex-plugin")
                .join("plugin.json"),
            r#"{"name":"demo-plugin","version":"1"}"#,
        )
        .unwrap();

        let facts = collect(&skill, &root, Some("codex"), 1);
        assert_eq!(
            facts.git_remote.as_deref(),
            Some("https://example.invalid/demo.git")
        );
        assert!(facts.plugin_manifest.is_some());
        assert!(facts
            .evidence
            .iter()
            .any(|item| item.evidence_type == "git_repository"));
        assert!(facts
            .evidence
            .iter()
            .any(|item| item.evidence_type == "plugin_manifest"));
        assert_eq!(minimax_candidate("i", "candidate", None, 1).weight, 0);
    }
}
