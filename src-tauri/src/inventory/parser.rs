use std::fs::File;
use std::io::{Read, Take};
use std::path::Path;

use serde_yaml::Value;

use super::model::ParsedSkillMetadata;

const MAX_SKILL_MD_BYTES: u64 = 2 * 1024 * 1024;
const MAX_FRONT_MATTER_BYTES: usize = 256 * 1024;

pub fn parse_skill_md(path: &Path) -> ParsedSkillMetadata {
    match read_bounded(path) {
        Ok((bytes, truncated)) => parse_bytes(&bytes, truncated),
        Err(error) => ParsedSkillMetadata {
            name: None,
            description: None,
            short_description: None,
            metadata: serde_json::json!({}),
            headings: Vec::new(),
            encoding: "unreadable".to_string(),
            warnings: Vec::new(),
            error: Some(format!("读取 SKILL.md 失败: {error}")),
        },
    }
}

fn read_bounded(path: &Path) -> Result<(Vec<u8>, bool), std::io::Error> {
    let file = File::open(path)?;
    let length = file.metadata()?.len();
    let mut reader: Take<File> = file.take(MAX_SKILL_MD_BYTES);
    let mut bytes = Vec::with_capacity(length.min(MAX_SKILL_MD_BYTES) as usize);
    reader.read_to_end(&mut bytes)?;
    Ok((bytes, length > MAX_SKILL_MD_BYTES))
}

pub fn parse_bytes(bytes: &[u8], truncated: bool) -> ParsedSkillMetadata {
    let (bytes, had_bom) = bytes
        .strip_prefix(&[0xEF, 0xBB, 0xBF])
        .map_or((bytes, false), |stripped| (stripped, true));
    let text = match std::str::from_utf8(bytes) {
        Ok(text) => text,
        Err(error) => {
            return ParsedSkillMetadata {
                name: None,
                description: None,
                short_description: None,
                metadata: serde_json::json!({}),
                headings: Vec::new(),
                encoding: "invalid_utf8".to_string(),
                warnings: Vec::new(),
                error: Some(format!("SKILL.md 不是有效 UTF-8: {error}")),
            }
        }
    };
    let normalized = text.replace("\r\n", "\n");
    let mut warnings = Vec::new();
    if had_bom {
        warnings.push("utf8_bom".to_string());
    }
    if text.contains("\r\n") {
        warnings.push("crlf".to_string());
    }
    if truncated {
        warnings.push("skill_md_truncated_for_metadata".to_string());
    }

    let headings = normalized
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim_start();
            let hashes = trimmed
                .chars()
                .take_while(|character| *character == '#')
                .count();
            (hashes > 0 && hashes <= 6)
                .then(|| trimmed[hashes..].trim().to_string())
                .filter(|heading| !heading.is_empty())
        })
        .collect::<Vec<_>>();

    let Some(front_matter) = extract_front_matter(&normalized) else {
        warnings.push("front_matter_missing".to_string());
        return ParsedSkillMetadata {
            name: headings.first().cloned(),
            description: first_paragraph(&normalized),
            short_description: None,
            metadata: serde_json::json!({}),
            headings,
            encoding: "utf-8".to_string(),
            warnings,
            error: None,
        };
    };

    if front_matter.len() > MAX_FRONT_MATTER_BYTES {
        return ParsedSkillMetadata {
            name: headings.first().cloned(),
            description: None,
            short_description: None,
            metadata: serde_json::json!({}),
            headings,
            encoding: "utf-8".to_string(),
            warnings,
            error: Some("YAML Front Matter 超过 256 KiB 限制".to_string()),
        };
    }

    match serde_yaml::from_str::<Value>(front_matter) {
        Ok(value) => {
            let json = serde_json::to_value(&value).unwrap_or_else(|_| serde_json::json!({}));
            let name = string_at(&json, &["name"]).or_else(|| headings.first().cloned());
            let description = string_at(&json, &["description"]);
            let short_description = string_at(&json, &["short-description"])
                .or_else(|| string_at(&json, &["short_description"]))
                .or_else(|| string_at(&json, &["metadata", "short-description"]))
                .or_else(|| string_at(&json, &["metadata", "short_description"]));
            let metadata = json
                .get("metadata")
                .cloned()
                .unwrap_or_else(|| serde_json::json!({}));
            ParsedSkillMetadata {
                name,
                description,
                short_description,
                metadata,
                headings,
                encoding: "utf-8".to_string(),
                warnings,
                error: None,
            }
        }
        Err(error) => ParsedSkillMetadata {
            name: headings.first().cloned(),
            description: None,
            short_description: None,
            metadata: serde_json::json!({}),
            headings,
            encoding: "utf-8".to_string(),
            warnings,
            error: Some(format!("无效 YAML Front Matter: {error}")),
        },
    }
}

fn extract_front_matter(text: &str) -> Option<&str> {
    let mut lines = text.split_inclusive('\n');
    let first = lines.next()?;
    if first.trim_end_matches(['\r', '\n']) != "---" {
        return None;
    }
    let start = first.len();
    let mut offset = start;
    for line in lines {
        if line.trim_end_matches(['\r', '\n']) == "---" {
            return text.get(start..offset);
        }
        offset += line.len();
    }
    None
}

fn string_at(value: &serde_json::Value, path: &[&str]) -> Option<String> {
    let mut current = value;
    for segment in path {
        current = current.get(*segment)?;
    }
    current
        .as_str()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn first_paragraph(text: &str) -> Option<String> {
    text.lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('#') && *line != "---")
        .find(|line| !line.contains(':'))
        .map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::parse_bytes;

    #[test]
    fn parses_bom_crlf_and_nested_short_description() {
        let bytes = b"\xEF\xBB\xBF---\r\nname: Demo\r\ndescription: Long\r\nmetadata:\r\n  short-description: Short\r\n---\r\n# Demo\r\n";
        let parsed = parse_bytes(bytes, false);
        assert_eq!(parsed.name.as_deref(), Some("Demo"));
        assert_eq!(parsed.short_description.as_deref(), Some("Short"));
        assert!(parsed.warnings.contains(&"utf8_bom".to_string()));
        assert!(parsed.warnings.contains(&"crlf".to_string()));
        assert!(parsed.error.is_none());
    }

    #[test]
    fn invalid_yaml_isolated_as_skill_error() {
        let parsed = parse_bytes(b"---\nname: [broken\n---\n# Fallback\n", false);
        assert_eq!(parsed.name.as_deref(), Some("Fallback"));
        assert!(parsed.error.as_deref().unwrap_or_default().contains("YAML"));
    }

    #[test]
    fn missing_front_matter_uses_heading() {
        let parsed = parse_bytes(b"# Plain Skill\n\nUseful description.\n", false);
        assert_eq!(parsed.name.as_deref(), Some("Plain Skill"));
        assert_eq!(parsed.description.as_deref(), Some("Useful description."));
    }
}
