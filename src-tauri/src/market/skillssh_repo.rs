use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use uuid::Uuid;

use crate::domain::ExternalMarketSkillDetail;
use crate::workspace;

const DOCUMENT_FILENAMES: [&str; 4] = ["README.md", "readme.md", "SKILL.md", "skill.md"];
const SKILL_ENTRY_FILENAMES: [&str; 2] = ["skill.md", "SKILL.md"];
const MAX_DOCUMENT_PREVIEW_CHARS: usize = 900;
const MAX_SUMMARY_CHARS: usize = 220;

pub(crate) struct ResolvedSkillsshSource {
    pub(crate) temp_root: PathBuf,
    pub(crate) skill_dir: PathBuf,
    pub(crate) repo_url: String,
    pub(crate) source_subpath: Option<String>,
}

struct SkillDocumentPreview {
    title: Option<String>,
    path: String,
    excerpt: String,
}

pub(crate) fn build_repo_url(source: &str) -> String {
    format!("https://github.com/{}.git", source.trim())
}

pub(crate) fn resolve_skillssh_source(
    source: &str,
    skill_id: &str,
) -> Result<ResolvedSkillsshSource, String> {
    let normalized_source = source.trim();
    if normalized_source.is_empty() {
        return Err("外部市场详情缺少 source".to_string());
    }

    let normalized_skill_id = skill_id.trim();
    if normalized_skill_id.is_empty() {
        return Err("外部市场详情缺少 skillId".to_string());
    }

    let repo_url = build_repo_url(normalized_source);
    let temp_root = create_temp_root("skillssh")?;
    clone_repo(&repo_url, &temp_root)?;

    let skill_dir = match find_skillssh_skill_dir(&temp_root, normalized_skill_id) {
        Ok(path) => path,
        Err(error) => {
            cleanup_temp_root(&temp_root);
            return Err(error);
        }
    };

    let source_subpath = skill_dir.strip_prefix(&temp_root).ok().and_then(|value| {
        let text = value.to_string_lossy().replace('\\', "/");
        if text.is_empty() {
            None
        } else {
            Some(text)
        }
    });

    Ok(ResolvedSkillsshSource {
        temp_root,
        skill_dir,
        repo_url,
        source_subpath,
    })
}

pub(crate) fn cleanup_temp_root(path: &Path) {
    let _ = fs::remove_dir_all(path);
}

pub(crate) fn read_skill_name_from_dir(dir: &Path) -> Option<String> {
    SKILL_ENTRY_FILENAMES.iter().find_map(|filename| {
        let path = dir.join(filename);
        let content = fs::read_to_string(path).ok()?;
        for line in content.lines().take(12) {
            let trimmed = line.trim();
            if let Some(name) = trimmed.strip_prefix("# ") {
                let normalized = name.trim();
                if !normalized.is_empty() {
                    return Some(normalized.to_string());
                }
            }
        }
        None
    })
}

#[allow(dead_code)]
pub(crate) fn load_skillssh_detail(
    source: &str,
    skill_id: &str,
) -> Result<ExternalMarketSkillDetail, String> {
    load_github_skill_detail(
        "skillssh",
        source,
        Some(source.split('/').next().unwrap_or(source).to_string()),
        None,
        source,
        skill_id,
    )
}

pub(crate) fn load_github_skill_detail(
    market_source: &str,
    source_label: &str,
    publisher: Option<String>,
    detail_url: Option<String>,
    source: &str,
    skill_id: &str,
) -> Result<ExternalMarketSkillDetail, String> {
    let resolved = resolve_skillssh_source(source, skill_id)?;
    let detail = build_skillssh_detail(
        market_source,
        source_label,
        publisher,
        detail_url,
        source,
        skill_id,
        &resolved,
    );
    cleanup_temp_root(&resolved.temp_root);
    detail
}

fn build_skillssh_detail(
    market_source: &str,
    source_label: &str,
    publisher: Option<String>,
    detail_url: Option<String>,
    source: &str,
    skill_id: &str,
    resolved: &ResolvedSkillsshSource,
) -> Result<ExternalMarketSkillDetail, String> {
    let preview =
        read_preferred_document_preview(&resolved.skill_dir, resolved.source_subpath.as_deref());
    let name = read_skill_name_from_dir(&resolved.skill_dir)
        .unwrap_or_else(|| skill_id.trim().to_string());
    let summary = read_skill_summary_from_dir(&resolved.skill_dir).or_else(|| {
        preview
            .as_ref()
            .map(|item| truncate_text(&item.excerpt, MAX_SUMMARY_CHARS))
    });

    Ok(ExternalMarketSkillDetail {
        id: format!("{}/{}", source.trim(), skill_id.trim()),
        market_source: market_source.to_string(),
        source: source.trim().to_string(),
        source_label: source_label.to_string(),
        skill_id: skill_id.trim().to_string(),
        name,
        publisher,
        repo_url: Some(resolved.repo_url.clone()),
        source_subpath: resolved.source_subpath.clone(),
        detail_url,
        summary,
        documentation_title: preview.as_ref().and_then(|item| item.title.clone()),
        documentation_path: preview.as_ref().map(|item| item.path.clone()),
        documentation_excerpt: preview.map(|item| item.excerpt),
        category: None,
        version: None,
        install_command: None,
        highlights: Vec::new(),
        use_cases: Vec::new(),
        requirements: Vec::new(),
        security_signals: Vec::new(),
        package_name: None,
        package_version: None,
        owner_handle: None,
    })
}

fn create_temp_root(prefix: &str) -> Result<PathBuf, String> {
    let root = workspace::temp_imports_root()?.join(format!("{}-{}", prefix, Uuid::new_v4()));

    if let Some(parent) = root.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建临时目录失败: {}", error))?;
    }

    Ok(root)
}

fn clone_repo(repo_url: &str, temp_root: &Path) -> Result<(), String> {
    let output = Command::new("git")
        .args([
            "clone",
            "--depth",
            "1",
            repo_url,
            temp_root.to_string_lossy().as_ref(),
        ])
        .env("GIT_TERMINAL_PROMPT", "0")
        .output()
        .map_err(|error| format!("执行 git clone 失败: {}", error))?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let detail = if !stderr.is_empty() { stderr } else { stdout };
    cleanup_temp_root(temp_root);
    Err(format!("克隆外部市场仓库失败: {}", detail))
}

fn read_skill_summary_from_dir(dir: &Path) -> Option<String> {
    SKILL_ENTRY_FILENAMES.iter().find_map(|filename| {
        let path = dir.join(filename);
        let content = fs::read_to_string(path).ok()?;
        crate::store::extract_skill_description(&content)
    })
}

fn is_skill_dir(dir: &Path) -> bool {
    SKILL_ENTRY_FILENAMES
        .iter()
        .any(|filename| dir.join(filename).is_file())
}

fn find_skillssh_skill_dir(repo_dir: &Path, skill_id: &str) -> Result<PathBuf, String> {
    let normalized_id = skill_id.trim();
    if normalized_id.is_empty() {
        return Err("外部市场详情缺少 skillId".to_string());
    }

    let direct = repo_dir.join(normalized_id);
    if direct.is_dir() && is_skill_dir(&direct) {
        return Ok(direct);
    }

    let skills_subdir = repo_dir.join("skills").join(normalized_id);
    if skills_subdir.is_dir() && is_skill_dir(&skills_subdir) {
        return Ok(skills_subdir);
    }

    let mut stack = vec![(repo_dir.to_path_buf(), 0_usize)];
    let normalized_id_lower = normalized_id.to_lowercase();
    let mut fallback_name_match: Option<PathBuf> = None;

    while let Some((current, depth)) = stack.pop() {
        if depth > 6 {
            continue;
        }

        let entries =
            fs::read_dir(&current).map_err(|error| format!("读取仓库目录失败: {}", error))?;
        for entry in entries {
            let entry = entry.map_err(|error| format!("读取仓库目录项失败: {}", error))?;
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            if path
                .file_name()
                .map(|value| value.to_string_lossy() == ".git")
                .unwrap_or(false)
            {
                continue;
            }

            if is_skill_dir(&path) {
                let dirname = path
                    .file_name()
                    .map(|value| value.to_string_lossy().to_lowercase())
                    .unwrap_or_default();
                if dirname == normalized_id_lower {
                    return Ok(path);
                }

                if fallback_name_match.is_none() {
                    let parsed_name = read_skill_name_from_dir(&path)
                        .unwrap_or_default()
                        .to_lowercase();
                    if parsed_name == normalized_id_lower {
                        fallback_name_match = Some(path.clone());
                    }
                }
            }

            stack.push((path, depth + 1));
        }
    }

    if let Some(path) = fallback_name_match {
        return Ok(path);
    }

    if is_skill_dir(repo_dir) {
        return Ok(repo_dir.to_path_buf());
    }

    Err(format!(
        "未能在仓库中定位外部市场技能目录: {}",
        normalized_id
    ))
}

fn read_preferred_document_preview(
    dir: &Path,
    source_subpath: Option<&str>,
) -> Option<SkillDocumentPreview> {
    for filename in DOCUMENT_FILENAMES {
        let path = dir.join(filename);
        if !path.is_file() {
            continue;
        }

        let content = fs::read_to_string(&path).ok()?;
        let excerpt = extract_document_excerpt(&content, MAX_DOCUMENT_PREVIEW_CHARS)?;
        let title = extract_markdown_title(&content).or_else(|| Some(filename.to_string()));
        let display_path = match source_subpath {
            Some(subpath) if !subpath.is_empty() => format!("{}/{}", subpath, filename),
            _ => filename.to_string(),
        };

        return Some(SkillDocumentPreview {
            title,
            path: display_path,
            excerpt,
        });
    }

    None
}

fn extract_markdown_title(content: &str) -> Option<String> {
    let stripped = strip_frontmatter(content);
    stripped.lines().find_map(|line| {
        let trimmed = line.trim();
        trimmed
            .strip_prefix("# ")
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
    })
}

fn extract_document_excerpt(content: &str, max_chars: usize) -> Option<String> {
    let stripped = strip_frontmatter(content);
    let mut lines = Vec::new();
    let mut in_code_block = false;

    for line in stripped.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("```") {
            in_code_block = !in_code_block;
            continue;
        }
        if in_code_block
            || trimmed.is_empty()
            || trimmed.starts_with('#')
            || trimmed.starts_with("![")
        {
            continue;
        }

        lines.push(trimmed.to_string());
        let joined = lines.join("\n");
        if joined.chars().count() >= max_chars {
            return Some(truncate_text(&joined, max_chars));
        }
    }

    if lines.is_empty() {
        None
    } else {
        Some(lines.join("\n"))
    }
}

fn strip_frontmatter(content: &str) -> String {
    let normalized = content.replace("\r\n", "\n");
    let Some(rest) = normalized.strip_prefix("---\n") else {
        return normalized;
    };

    if let Some(end_index) = rest.find("\n---\n") {
        rest[(end_index + "\n---\n".len())..].to_string()
    } else {
        normalized
    }
}

fn truncate_text(value: &str, max_chars: usize) -> String {
    let normalized = value.trim();
    let total_chars = normalized.chars().count();
    if total_chars <= max_chars {
        return normalized.to_string();
    }

    let truncated: String = normalized.chars().take(max_chars).collect();
    format!("{}…", truncated.trim_end())
}

#[cfg(test)]
mod tests {
    use super::{extract_document_excerpt, read_preferred_document_preview};
    use std::fs;
    use std::path::{Path, PathBuf};
    use uuid::Uuid;

    fn create_temp_dir() -> PathBuf {
        let root = std::env::temp_dir().join(format!("skillssh-detail-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).expect("应能创建临时测试目录");
        root
    }

    fn cleanup_temp_dir(path: &Path) {
        let _ = fs::remove_dir_all(path);
    }

    #[test]
    fn 可提取文档摘要并跳过代码块() {
        let content = r#"
---
description: 示例描述
---

# Browser Skill

用于浏览器自动化与页面验证。

```ts
console.log("ignore");
```

- 支持页面打开
- 支持元素点击
"#;

        let excerpt = extract_document_excerpt(content, 120).expect("应能提取摘要");
        assert!(excerpt.contains("用于浏览器自动化与页面验证"));
        assert!(excerpt.contains("支持页面打开"));
        assert!(!excerpt.contains("ignore"));
    }

    #[test]
    fn 详情预览优先读取_readme() {
        let root = create_temp_dir();
        fs::write(
            root.join("README.md"),
            "# Browser\n\n这是 README 摘要。\n\n更多说明。\n",
        )
        .expect("应能写入 readme");
        fs::write(
            root.join("skill.md"),
            "# Browser\n\ndescription: skill 摘要\n",
        )
        .expect("应能写入 skill");

        let preview =
            read_preferred_document_preview(&root, Some("skills/browser")).expect("应能读取预览");
        assert_eq!(preview.path, "skills/browser/README.md");
        assert_eq!(preview.title.as_deref(), Some("Browser"));
        assert!(preview.excerpt.contains("这是 README 摘要"));

        cleanup_temp_dir(&root);
    }
}
