use std::fs::{self, File};
use std::io::{BufReader, Read};
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;

use sha2::{Digest, Sha256};

pub const HASH_RULES_VERSION: &str = "inventory-content-v1";

pub fn sha256_file(path: &Path) -> Result<String, String> {
    let file = File::open(path).map_err(|e| format!("打开文件失败 {}: {e}", path.display()))?;
    let mut reader = BufReader::with_capacity(64 * 1024, file);
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let count = reader
            .read(&mut buffer)
            .map_err(|e| format!("读取文件失败 {}: {e}", path.display()))?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

pub fn content_hash(entries: &[(String, String, u64, Option<String>)]) -> String {
    let mut sorted = entries.to_vec();
    sorted.sort_by(|left, right| left.0.cmp(&right.0));
    let mut hasher = Sha256::new();
    hasher.update(HASH_RULES_VERSION.as_bytes());
    for (path, file_type, size, hash) in sorted {
        hasher.update(path.as_bytes());
        hasher.update([0]);
        hasher.update(file_type.as_bytes());
        hasher.update([0]);
        hasher.update(size.to_le_bytes());
        hasher.update(hash.unwrap_or_default().as_bytes());
    }
    format!("{:x}", hasher.finalize())
}

pub fn signature_hash(entries: &[(String, String, u64, Option<i64>)]) -> String {
    let mut sorted = entries.to_vec();
    sorted.sort_by(|left, right| left.0.cmp(&right.0));
    let mut hasher = Sha256::new();
    hasher.update(HASH_RULES_VERSION.as_bytes());
    hasher.update(b"quick-signature");
    for (path, file_type, size, modified_at) in sorted {
        hasher.update(path.as_bytes());
        hasher.update([0]);
        hasher.update(file_type.as_bytes());
        hasher.update(size.to_le_bytes());
        hasher.update(modified_at.unwrap_or_default().to_le_bytes());
    }
    format!("{:x}", hasher.finalize())
}

pub fn modified_ms(metadata: &fs::Metadata) -> Option<i64> {
    metadata
        .modified()
        .ok()?
        .duration_since(UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_millis().min(i64::MAX as u128) as i64)
}

pub fn normalize_existing_path(path: &Path) -> Result<(String, String), String> {
    let absolute = path
        .canonicalize()
        .map_err(|e| format!("规范化路径失败 {}: {e}", path.display()))?;
    let display = path_to_slashes(&absolute);
    let normalized = normalize_path_for_platform(&absolute, cfg!(windows));
    Ok((display, normalized))
}

pub fn normalize_configured_path(path: &Path) -> Result<(String, String), String> {
    if !path.is_absolute() {
        return Err("扫描根必须是绝对路径".to_string());
    }
    if path.exists()
        && fs::symlink_metadata(path)
            .map_err(|e| format!("读取扫描根元数据失败 {}: {e}", path.display()))?
            .file_type()
            .is_symlink()
    {
        return Err(format!(
            "扫描根不能是符号链接或 junction: {}",
            path.display()
        ));
    }
    let absolute = if path.exists() {
        path.canonicalize()
            .map_err(|e| format!("规范化路径失败 {}: {e}", path.display()))?
    } else {
        lexical_normalize(path)
    };
    let display = path_to_slashes(&absolute);
    let normalized = normalize_path_for_platform(&absolute, cfg!(windows));
    Ok((display, normalized))
}

pub fn normalize_path_for_platform(path: &Path, windows: bool) -> String {
    let value = path_to_slashes(&lexical_normalize(path));
    if windows {
        value.to_lowercase()
    } else {
        value
    }
}

fn path_to_slashes(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn lexical_normalize(path: &Path) -> PathBuf {
    let mut result = PathBuf::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                if !matches!(result.components().next_back(), Some(Component::RootDir)) {
                    result.pop();
                }
            }
            other => result.push(other.as_os_str()),
        }
    }
    result
}

pub fn relative_slashes(root: &Path, path: &Path) -> Result<String, String> {
    path.strip_prefix(root)
        .map(path_to_slashes)
        .map_err(|_| format!("路径逃逸扫描根: {}", path.display()))
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::{content_hash, normalize_path_for_platform};

    #[test]
    fn directory_hash_is_order_independent() {
        let first = vec![
            (
                "b".to_string(),
                "file".to_string(),
                2,
                Some("bb".to_string()),
            ),
            (
                "a".to_string(),
                "file".to_string(),
                1,
                Some("aa".to_string()),
            ),
        ];
        let mut second = first.clone();
        second.reverse();
        assert_eq!(content_hash(&first), content_hash(&second));
    }

    #[test]
    fn windows_paths_are_case_and_separator_insensitive() {
        let left = normalize_path_for_platform(Path::new(r"C:\Users\Demo\Skills"), true);
        let right = normalize_path_for_platform(Path::new("c:/users/demo/skills"), true);
        assert_eq!(left, right);
    }

    #[test]
    fn unix_paths_preserve_case() {
        assert_ne!(
            normalize_path_for_platform(Path::new("/Users/Demo"), false),
            normalize_path_for_platform(Path::new("/users/demo"), false)
        );
    }

    #[test]
    fn configured_symbolic_link_root_is_rejected() {
        let root = std::env::temp_dir()
            .join("skill-studio-pro-tests")
            .join(uuid::Uuid::new_v4().to_string());
        let target = root.join("target");
        let link = root.join("link");
        std::fs::create_dir_all(&target).unwrap();
        #[cfg(unix)]
        std::os::unix::fs::symlink(&target, &link).unwrap();
        #[cfg(windows)]
        if std::os::windows::fs::symlink_dir(&target, &link).is_err() {
            return;
        }
        assert!(super::normalize_configured_path(&link).is_err());
    }
}
