use chrono::Utc;
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

/// 获取当前时间戳（毫秒）
pub fn now_ms() -> i64 {
    Utc::now().timestamp_millis()
}

/// 转义 LIKE 模式中的特殊字符（% 和 _）
pub(crate) fn escape_like(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

/// 将任意字符串转换为 URL-safe slug
pub fn slugify(value: &str) -> String {
    let mut slug = String::new();
    let mut prev_dash = false;

    for ch in value.chars() {
        let mapped = match ch {
            'a'..='z' | '0'..='9' => Some(ch),
            'A'..='Z' => Some(ch.to_ascii_lowercase()),
            _ => Some('-'),
        };

        if let Some(mapped) = mapped {
            if mapped == '-' {
                if !slug.is_empty() && !prev_dash {
                    slug.push(mapped);
                    prev_dash = true;
                }
            } else {
                slug.push(mapped);
                prev_dash = false;
            }
        }
    }

    let trimmed = slug.trim_matches('-').to_string();
    if trimmed.is_empty() {
        format!("skill-{}", now_ms())
    } else {
        trimmed
    }
}

/// 计算内容的 SHA256 哈希
#[allow(dead_code)]
pub fn compute_revision(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    let digest = hasher.finalize();
    digest.iter().map(|byte| format!("{:02x}", byte)).collect()
}

/// 递归计算目录内所有文件的联合 SHA256 哈希
pub fn compute_directory_revision(dir: &Path) -> Result<String, String> {
    if !dir.exists() {
        return Err(format!("目录不存在: {}", dir.display()));
    }

    let mut hasher = Sha256::new();
    collect_file_hashes(dir, dir, &mut hasher)?;
    let digest = hasher.finalize();
    Ok(digest.iter().map(|byte| format!("{:02x}", byte)).collect())
}

fn collect_file_hashes(base: &Path, current: &Path, hasher: &mut Sha256) -> Result<(), String> {
    let entries = fs::read_dir(current).map_err(|e| format!("读取目录失败: {}", e))?;

    let mut paths: Vec<PathBuf> = entries
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .collect();
    paths.sort();

    for path in paths {
        let relative = path.strip_prefix(base).unwrap_or(&path).to_string_lossy();
        hasher.update(relative.as_bytes());
        hasher.update(b"\0");

        if path.is_dir() {
            collect_file_hashes(base, &path, hasher)?;
        } else if path.is_file() {
            let file = fs::File::open(&path)
                .map_err(|e| format!("打开文件失败 {}: {}", path.display(), e))?;
            let mut reader = std::io::BufReader::with_capacity(8192, file);
            let mut buffer = [0u8; 8192];

            loop {
                let read_size = reader
                    .read(&mut buffer)
                    .map_err(|e| format!("读取文件失败 {}: {}", path.display(), e))?;
                if read_size == 0 {
                    break;
                }
                hasher.update(&buffer[..read_size]);
            }
            hasher.update(b"\0");
        }
    }

    Ok(())
}

/// 递归复制目录
pub fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| format!("创建目录失败: {}", e))?;

    let entries = fs::read_dir(src).map_err(|e| format!("读取目录失败: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("读取目录条目失败: {}", e))?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)
                .map_err(|e| format!("复制文件失败 {}: {}", src_path.display(), e))?;
        }
    }

    Ok(())
}
