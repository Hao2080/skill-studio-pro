use std::fs;
use std::path::{Path, PathBuf};

fn find_skill_entry_file(dir: &Path) -> Option<PathBuf> {
    let mut entries: Vec<PathBuf> = fs::read_dir(dir)
        .ok()?
        .filter_map(|entry| entry.ok().map(|item| item.path()))
        .filter(|path| path.is_file())
        .collect();
    entries.sort();

    entries.into_iter().find(|path| {
        path.file_name()
            .map(|name| name.to_string_lossy().to_lowercase() == "skill.md")
            .unwrap_or(false)
    })
}

fn normalize_skill_description(value: &str) -> Option<String> {
    let trimmed = value.trim().trim_matches('"').trim_matches('\'').trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn extract_frontmatter_description(frontmatter: &str) -> Option<String> {
    let lines: Vec<&str> = frontmatter.lines().collect();
    let mut index = 0usize;

    while index < lines.len() {
        let line = lines[index];
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("description:") {
            let value = rest.trim();
            if let Some(description) = normalize_skill_description(value) {
                return Some(description);
            }

            let mut block_lines: Vec<String> = Vec::new();
            index += 1;
            while index < lines.len() {
                let candidate = lines[index];
                if candidate.starts_with(' ') || candidate.starts_with('\t') {
                    let normalized = candidate.trim();
                    if !normalized.is_empty() {
                        block_lines.push(normalized.to_string());
                    }
                    index += 1;
                    continue;
                }
                break;
            }

            if !block_lines.is_empty() {
                return normalize_skill_description(&block_lines.join(" "));
            }
        }

        index += 1;
    }

    None
}

fn extract_body_description(body: &str) -> Option<String> {
    let mut paragraph: Vec<String> = Vec::new();
    let mut in_code_block = false;

    for line in body.lines() {
        let trimmed = line.trim();

        if trimmed.starts_with("```") {
            in_code_block = !in_code_block;
            continue;
        }
        if in_code_block {
            continue;
        }

        if trimmed.is_empty() {
            if !paragraph.is_empty() {
                return normalize_skill_description(&paragraph.join(" "));
            }
            continue;
        }

        if trimmed.starts_with('#') {
            if !paragraph.is_empty() {
                return normalize_skill_description(&paragraph.join(" "));
            }
            continue;
        }

        paragraph.push(trimmed.to_string());
    }

    if paragraph.is_empty() {
        None
    } else {
        normalize_skill_description(&paragraph.join(" "))
    }
}

pub fn extract_skill_description(content: &str) -> Option<String> {
    let trimmed = content.trim();
    if trimmed.is_empty() {
        return None;
    }

    if let Some(frontmatter) = trimmed.strip_prefix("---") {
        let normalized = frontmatter.replace("\r\n", "\n");
        if let Some(end_index) = normalized.find("\n---") {
            let yaml = normalized[..end_index].trim();
            if let Some(description) = extract_frontmatter_description(yaml) {
                return Some(description);
            }

            let body_start = end_index + "\n---".len();
            let body = normalized[body_start..].trim_start_matches('\n');
            return extract_body_description(body);
        }
    }

    extract_body_description(trimmed)
}

pub fn read_skill_description_from_dir(dir: &Path) -> Option<String> {
    let entry_file = find_skill_entry_file(dir)?;
    let content = fs::read_to_string(entry_file).ok()?;
    extract_skill_description(&content)
}
