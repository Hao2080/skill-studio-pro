use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use std::process::Command;

use super::file_transaction::validate_relative_path;
use super::model::{ImportPlanInput, ImportProvenance, ImportSourceType};
use super::repository::redact_error;

const MAX_FILES: u64 = 20_000;
const MAX_SINGLE_FILE: u64 = 64 * 1024 * 1024;
const MAX_TOTAL_BYTES: u64 = 512 * 1024 * 1024;
const MAX_COMPRESSION_RATIO: u64 = 1_000;

#[derive(Debug)]
pub struct PreparedSource {
    pub root: PathBuf,
    pub provenance: ImportProvenance,
}

pub trait SourceAdapter {
    fn prepare(&self, input: &ImportPlanInput, staging: &Path) -> Result<PreparedSource, String>;
}

pub struct LocalDirectoryAdapter;
pub struct GitRepositoryAdapter;
pub struct ZipArchiveAdapter;
pub struct MarketplaceAdapter;

pub fn prepare_source(input: &ImportPlanInput, staging: &Path) -> Result<PreparedSource, String> {
    match input.source_type {
        ImportSourceType::LocalDirectory => LocalDirectoryAdapter.prepare(input, staging),
        ImportSourceType::GitRepository => GitRepositoryAdapter.prepare(input, staging),
        ImportSourceType::ZipArchive => ZipArchiveAdapter.prepare(input, staging),
        ImportSourceType::Marketplace => MarketplaceAdapter.prepare(input, staging),
    }
}

impl SourceAdapter for LocalDirectoryAdapter {
    fn prepare(&self, input: &ImportPlanInput, staging: &Path) -> Result<PreparedSource, String> {
        let source = required_path(input.local_path.as_deref(), "localPath")?;
        validate_source_directory(&source)?;
        let root = staging.join("source");
        copy_bounded_tree(&source, &root)?;
        Ok(PreparedSource {
            root,
            provenance: ImportProvenance {
                source_type: ImportSourceType::LocalDirectory,
                source_label: "本地目录".to_string(),
                source_ref: Some(source.to_string_lossy().to_string()),
                source_path: Some(source.to_string_lossy().to_string()),
                repo_subdir: None,
                branch: None,
                git_ref: None,
                commit: None,
                market_source: None,
            },
        })
    }
}

impl SourceAdapter for GitRepositoryAdapter {
    fn prepare(&self, input: &ImportPlanInput, staging: &Path) -> Result<PreparedSource, String> {
        prepare_git(input, staging, ImportSourceType::GitRepository, None)
    }
}

impl SourceAdapter for ZipArchiveAdapter {
    fn prepare(&self, input: &ImportPlanInput, staging: &Path) -> Result<PreparedSource, String> {
        let archive_path = required_path(input.zip_path.as_deref(), "zipPath")?;
        if !archive_path.is_file() {
            return Err(format!("ZIP_NOT_FOUND: {}", archive_path.display()));
        }
        let root = staging.join("source");
        extract_zip(&archive_path, &root)?;
        Ok(PreparedSource {
            root,
            provenance: ImportProvenance {
                source_type: ImportSourceType::ZipArchive,
                source_label: "ZIP 压缩包".to_string(),
                source_ref: Some(archive_path.to_string_lossy().to_string()),
                source_path: Some(archive_path.to_string_lossy().to_string()),
                repo_subdir: None,
                branch: None,
                git_ref: None,
                commit: None,
                market_source: None,
            },
        })
    }
}

impl SourceAdapter for MarketplaceAdapter {
    fn prepare(&self, input: &ImportPlanInput, staging: &Path) -> Result<PreparedSource, String> {
        let market = input
            .market_source
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| "MARKET_SOURCE_REQUIRED: marketSource 不能为空".to_string())?;
        let mut prepared = if input.git_url.is_some() {
            prepare_git(input, staging, ImportSourceType::Marketplace, Some(market))?
        } else if input.zip_path.is_some() {
            ZipArchiveAdapter.prepare(input, staging)?
        } else if input.local_path.is_some() {
            LocalDirectoryAdapter.prepare(input, staging)?
        } else {
            return Err(
                "MARKET_SOURCE_UNRESOLVED: 市场来源必须提供已解析的 gitUrl、zipPath 或 localPath"
                    .to_string(),
            );
        };
        prepared.provenance.source_type = ImportSourceType::Marketplace;
        prepared.provenance.source_label = format!("上游市场：{market}");
        prepared.provenance.market_source = Some(market.to_string());
        Ok(prepared)
    }
}

fn prepare_git(
    input: &ImportPlanInput,
    staging: &Path,
    source_type: ImportSourceType,
    market_source: Option<&str>,
) -> Result<PreparedSource, String> {
    let url = input
        .git_url
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "GIT_URL_REQUIRED: gitUrl 不能为空".to_string())?;
    validate_git_argument("gitUrl", url)?;
    validate_git_source(url)?;
    let repository = staging.join("repository");
    run_git(&[
        "clone".to_string(),
        "--depth".to_string(),
        "1".to_string(),
        "--no-tags".to_string(),
        "--no-checkout".to_string(),
        "--".to_string(),
        url.to_string(),
        repository.to_string_lossy().to_string(),
    ])?;

    let requested = input
        .commit
        .as_deref()
        .or(input.git_ref.as_deref())
        .or(input.branch.as_deref())
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let checkout_target = if let Some(revision) = requested {
        validate_git_argument("ref/commit", revision)?;
        run_git(&[
            "-C".to_string(),
            repository.to_string_lossy().to_string(),
            "fetch".to_string(),
            "--depth".to_string(),
            "1".to_string(),
            "origin".to_string(),
            revision.to_string(),
        ])?;
        "FETCH_HEAD"
    } else {
        "HEAD"
    };
    run_git(&[
        "-C".to_string(),
        repository.to_string_lossy().to_string(),
        "checkout".to_string(),
        "--detach".to_string(),
        checkout_target.to_string(),
    ])?;
    let commit = run_git_capture(&[
        "-C".to_string(),
        repository.to_string_lossy().to_string(),
        "rev-parse".to_string(),
        "HEAD".to_string(),
    ])?;
    let source_root = resolve_subdir(&repository, input.repo_subdir.as_deref())?;
    let root = staging.join("source");
    copy_bounded_tree(&source_root, &root)?;
    safe_remove_repository(&repository, staging)?;
    Ok(PreparedSource {
        root,
        provenance: ImportProvenance {
            source_type,
            source_label: market_source
                .map(|market| format!("上游市场：{market}"))
                .unwrap_or_else(|| "Git 仓库".to_string()),
            source_ref: Some(sanitize_git_url(url)),
            source_path: None,
            repo_subdir: input.repo_subdir.clone(),
            branch: input.branch.clone(),
            git_ref: input.git_ref.clone(),
            commit: Some(commit.trim().to_string()),
            market_source: market_source.map(str::to_string),
        },
    })
}

fn required_path(value: Option<&str>, field: &str) -> Result<PathBuf, String> {
    let value = value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| format!("SOURCE_PATH_REQUIRED: {field} 不能为空"))?;
    let path = PathBuf::from(value);
    if !path.is_absolute() {
        return Err(format!("SOURCE_PATH_NOT_ABSOLUTE: {field}"));
    }
    Ok(path)
}

fn validate_source_directory(path: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("SOURCE_UNAVAILABLE: {}: {error}", path.display()))?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err("SOURCE_UNSAFE: 来源必须是普通目录，不能是符号链接或 junction".to_string());
    }
    Ok(())
}

fn validate_git_argument(label: &str, value: &str) -> Result<(), String> {
    if value.starts_with('-') || value.contains(['\0', '\r', '\n']) {
        return Err(format!("INVALID_GIT_ARGUMENT: {label}"));
    }
    Ok(())
}

fn run_git(args: &[String]) -> Result<(), String> {
    let output = Command::new("git")
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("GIT_CONFIG_GLOBAL", null_device())
        .env_remove("GIT_SSH_COMMAND")
        .env_remove("GIT_PROXY_COMMAND")
        .output()
        .map_err(|error| format!("GIT_UNAVAILABLE: {error}"))?;
    if output.status.success() {
        Ok(())
    } else {
        let detail = if output.stderr.is_empty() {
            String::from_utf8_lossy(&output.stdout).to_string()
        } else {
            String::from_utf8_lossy(&output.stderr).to_string()
        };
        Err(format!("GIT_FAILED: {}", redact_error(detail.trim())))
    }
}

fn run_git_capture(args: &[String]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("GIT_CONFIG_GLOBAL", null_device())
        .env_remove("GIT_SSH_COMMAND")
        .env_remove("GIT_PROXY_COMMAND")
        .output()
        .map_err(|error| format!("GIT_UNAVAILABLE: {error}"))?;
    if output.status.success() {
        String::from_utf8(output.stdout).map_err(|error| format!("GIT_OUTPUT_INVALID: {error}"))
    } else {
        Err(format!(
            "GIT_FAILED: {}",
            redact_error(&String::from_utf8_lossy(&output.stderr))
        ))
    }
}

fn resolve_subdir(repository: &Path, subdir: Option<&str>) -> Result<PathBuf, String> {
    let Some(subdir) = subdir.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(repository.to_path_buf());
    };
    let relative = validate_relative_path(subdir)?;
    let root = repository
        .canonicalize()
        .map_err(|error| format!("规范化仓库失败: {error}"))?;
    let target = repository.join(relative);
    let target = target
        .canonicalize()
        .map_err(|error| format!("REPO_SUBDIR_NOT_FOUND: {error}"))?;
    if !target.starts_with(&root) || !target.is_dir() {
        return Err("REPO_SUBDIR_ESCAPE: 仓库子目录越界".to_string());
    }
    Ok(target)
}

fn validate_git_source(value: &str) -> Result<(), String> {
    let lower = value.to_ascii_lowercase();
    if lower.starts_with("ext::")
        || lower.starts_with("git://")
        || (lower.starts_with("http://")
            && !lower.starts_with("http://127.0.0.1/")
            && !lower.starts_with("http://localhost/"))
    {
        return Err("UNSAFE_GIT_PROTOCOL: Git 来源必须使用 HTTPS、SSH 或本地绝对路径".to_string());
    }
    if value.contains("://")
        && ![
            "https://",
            "ssh://",
            "file://",
            "http://127.0.0.1/",
            "http://localhost/",
        ]
        .iter()
        .any(|prefix| lower.starts_with(prefix))
    {
        return Err("UNSAFE_GIT_PROTOCOL: 不允许该 Git transport".to_string());
    }
    if !value.contains("://") && !Path::new(value).is_absolute() && !value.contains('@') {
        return Err("GIT_SOURCE_INVALID: 本地 Git 来源必须是绝对路径".to_string());
    }
    Ok(())
}

fn null_device() -> &'static str {
    if cfg!(windows) {
        "NUL"
    } else {
        "/dev/null"
    }
}

fn copy_bounded_tree(source: &Path, target: &Path) -> Result<(), String> {
    validate_source_directory(source)?;
    if target.exists() {
        return Err("STAGING_CONFLICT: staging source 已存在".to_string());
    }
    fs::create_dir_all(target).map_err(|error| format!("创建 staging 失败: {error}"))?;
    let mut stack = vec![(source.to_path_buf(), target.to_path_buf())];
    let mut files = 0_u64;
    let mut total = 0_u64;
    while let Some((source_dir, target_dir)) = stack.pop() {
        for entry in
            fs::read_dir(&source_dir).map_err(|error| format!("读取导入来源失败: {error}"))?
        {
            let entry = entry.map_err(|error| format!("读取导入条目失败: {error}"))?;
            let name = entry.file_name();
            if matches!(
                name.to_string_lossy().as_ref(),
                ".git" | "node_modules" | "target" | ".skill-studio-pro-managed.json"
            ) {
                continue;
            }
            let metadata = fs::symlink_metadata(entry.path())
                .map_err(|error| format!("读取导入条目元数据失败: {error}"))?;
            let destination = target_dir.join(&name);
            if metadata.file_type().is_symlink() {
                return Err(format!("SYMLINK_REJECTED: {}", entry.path().display()));
            }
            if metadata.is_dir() {
                fs::create_dir(&destination)
                    .map_err(|error| format!("创建 staging 子目录失败: {error}"))?;
                stack.push((entry.path(), destination));
            } else if metadata.is_file() {
                files += 1;
                total = total.saturating_add(metadata.len());
                enforce_limits(files, metadata.len(), total)?;
                fs::copy(entry.path(), destination)
                    .map_err(|error| format!("复制导入文件失败: {error}"))?;
            } else {
                return Err(format!("SPECIAL_FILE_REJECTED: {}", entry.path().display()));
            }
        }
    }
    Ok(())
}

fn extract_zip(archive_path: &Path, target: &Path) -> Result<(), String> {
    fs::create_dir_all(target).map_err(|error| format!("创建 ZIP staging 失败: {error}"))?;
    let file = File::open(archive_path).map_err(|error| format!("打开 ZIP 失败: {error}"))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|error| format!("ZIP_INVALID: {error}"))?;
    if archive.len() as u64 > MAX_FILES {
        return Err("ZIP_BOMB: 文件数量超过限制".to_string());
    }
    let mut total = 0_u64;
    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| format!("读取 ZIP 条目失败: {error}"))?;
        let entry_name = entry.name().to_string();
        let enclosed = entry
            .enclosed_name()
            .ok_or_else(|| format!("ZIP_SLIP: 非法路径 {}", entry.name()))?
            .to_path_buf();
        if enclosed.is_absolute()
            || enclosed.components().any(|component| {
                matches!(
                    component,
                    Component::ParentDir | Component::RootDir | Component::Prefix(_)
                )
            })
        {
            return Err(format!("ZIP_SLIP: 非法路径 {}", entry.name()));
        }
        if entry
            .unix_mode()
            .is_some_and(|mode| mode & 0o170000 == 0o120000)
        {
            return Err(format!("ZIP_SYMLINK_REJECTED: {}", entry.name()));
        }
        let size = entry.size();
        total = total.saturating_add(size);
        enforce_limits(index as u64 + 1, size, total)?;
        if size > 1024 * 1024
            && entry.compressed_size() > 0
            && size / entry.compressed_size() > MAX_COMPRESSION_RATIO
        {
            return Err(format!("ZIP_BOMB: 压缩比异常 {}", entry.name()));
        }
        let destination = target.join(&enclosed);
        if entry.is_dir() {
            fs::create_dir_all(&destination)
                .map_err(|error| format!("创建 ZIP 目录失败: {error}"))?;
            continue;
        }
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent).map_err(|error| format!("创建 ZIP 父目录失败: {error}"))?;
        }
        let mut output =
            File::create(&destination).map_err(|error| format!("创建 ZIP 文件失败: {error}"))?;
        let copied = std::io::copy(&mut entry.by_ref().take(MAX_SINGLE_FILE + 1), &mut output)
            .map_err(|error| format!("解压 ZIP 文件失败: {error}"))?;
        if copied != size || copied > MAX_SINGLE_FILE {
            return Err(format!("ZIP_SIZE_MISMATCH: {entry_name}"));
        }
        output
            .flush()
            .map_err(|error| format!("刷新 ZIP 文件失败: {error}"))?;
    }
    Ok(())
}

fn enforce_limits(files: u64, single: u64, total: u64) -> Result<(), String> {
    if files > MAX_FILES {
        return Err("IMPORT_LIMIT: 文件数量超过限制".to_string());
    }
    if single > MAX_SINGLE_FILE {
        return Err("IMPORT_LIMIT: 单文件大小超过限制".to_string());
    }
    if total > MAX_TOTAL_BYTES {
        return Err("IMPORT_LIMIT: 总解压/复制大小超过限制".to_string());
    }
    Ok(())
}

pub(crate) fn sanitize_git_url(url: &str) -> String {
    let Some((scheme, rest)) = url.split_once("://") else {
        return url.to_string();
    };
    let slash = rest.find('/').unwrap_or(rest.len());
    let (authority, tail) = rest.split_at(slash);
    let authority = authority
        .rsplit_once('@')
        .map_or(authority, |(_, host)| host);
    format!("{scheme}://{authority}{tail}")
}

fn safe_remove_repository(repository: &Path, staging: &Path) -> Result<(), String> {
    let staging = staging
        .canonicalize()
        .map_err(|error| format!("规范化 staging 失败: {error}"))?;
    let repository = repository
        .canonicalize()
        .map_err(|error| format!("规范化仓库 staging 失败: {error}"))?;
    if repository == staging || !repository.starts_with(&staging) {
        return Err("PATH_OUTSIDE_ALLOWED_ROOT: 仓库 staging 越界".to_string());
    }
    fs::remove_dir_all(repository).map_err(|error| format!("清理仓库 staging 失败: {error}"))
}

#[cfg(test)]
mod tests {
    use super::{
        enforce_limits, sanitize_git_url, validate_git_argument, validate_git_source, MAX_FILES,
        MAX_SINGLE_FILE, MAX_TOTAL_BYTES,
    };

    #[test]
    fn rejects_git_option_injection() {
        assert!(validate_git_argument("gitUrl", "--upload-pack=calc").is_err());
        assert!(validate_git_argument("ref", "main\n--exec").is_err());
        assert!(validate_git_source("ext::sh -c calc").is_err());
        assert!(validate_git_source("git://example.test/repo.git").is_err());
        assert!(validate_git_source("http://example.test/repo.git").is_err());
    }

    #[test]
    fn removes_credentials_from_persisted_url() {
        assert_eq!(
            sanitize_git_url("https://user:secret@example.test/repo.git"),
            "https://example.test/repo.git"
        );
    }

    #[test]
    fn enforces_file_count_single_file_and_total_import_limits() {
        assert!(enforce_limits(MAX_FILES + 1, 1, 1)
            .unwrap_err()
            .contains("文件数量"));
        assert!(enforce_limits(1, MAX_SINGLE_FILE + 1, MAX_SINGLE_FILE + 1)
            .unwrap_err()
            .contains("单文件"));
        assert!(enforce_limits(2, 1, MAX_TOTAL_BYTES + 1)
            .unwrap_err()
            .contains("总解压/复制"));
    }
}
