use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

use crate::market::common;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillsShSkill {
    pub id: String,
    pub skill_id: String,
    pub name: String,
    pub source: String,
    pub installs: u64,
}

#[derive(Debug, Clone, Copy)]
pub enum LeaderboardType {
    AllTime,
    Trending,
    Hot,
}

impl LeaderboardType {
    pub fn from_str(value: &str) -> Self {
        match value {
            "trending" => Self::Trending,
            "hot" => Self::Hot,
            _ => Self::AllTime,
        }
    }

    fn url(&self) -> &'static str {
        match self {
            Self::AllTime => "https://skills.sh/",
            Self::Trending => "https://skills.sh/trending",
            Self::Hot => "https://skills.sh/hot",
        }
    }
}

pub fn fetch_leaderboard(board: LeaderboardType) -> Result<Vec<SkillsShSkill>, String> {
    let html = common::fetch_text(board.url())
        .map_err(|error| format!("获取 skills.sh 榜单失败: {}", error))?;
    parse_leaderboard_html(&html)
}

pub fn search_skills(query: &str, limit: usize) -> Result<Vec<SkillsShSkill>, String> {
    let mut url = reqwest::Url::parse("https://skills.sh/api/search")
        .map_err(|error| format!("构造搜索地址失败: {}", error))?;
    url.query_pairs_mut()
        .append_pair("q", query)
        .append_pair("limit", &limit.clamp(1, 100).to_string());

    let payload: serde_json::Value = common::fetch_json(url.as_str())
        .map_err(|error| format!("搜索 skills.sh 失败: {}", error))?;

    if let Some(items) = payload.as_array() {
        return Ok(parse_skills_array(items));
    }

    if let Some(items) = payload.get("skills").and_then(serde_json::Value::as_array) {
        return Ok(parse_skills_array(items));
    }

    Ok(Vec::new())
}

fn parse_leaderboard_html(html: &str) -> Result<Vec<SkillsShSkill>, String> {
    let next_data_items = parse_next_data(html)?;
    if !next_data_items.is_empty() {
        return Ok(next_data_items);
    }

    let embedded_items = parse_embedded_skill_objects(html)?;
    if !embedded_items.is_empty() {
        return Ok(embedded_items);
    }

    Err("未能从 skills.sh 页面中解析技能列表".to_string())
}

fn parse_next_data(html: &str) -> Result<Vec<SkillsShSkill>, String> {
    let marker = r#"<script id="__NEXT_DATA__" type="application/json">"#;
    let Some(start) = html.find(marker).map(|position| position + marker.len()) else {
        return Ok(Vec::new());
    };

    let Some(relative_end) = html[start..].find("</script>") else {
        return Err("skills.sh 页面结构异常：缺少脚本结束标记".to_string());
    };
    let end = start + relative_end;
    let json_str = &html[start..end];

    let payload: serde_json::Value = serde_json::from_str(json_str)
        .map_err(|error| format!("解析 skills.sh 页面 JSON 失败: {}", error))?;

    let items = payload
        .pointer("/props/pageProps/initialSkills")
        .or_else(|| payload.pointer("/props/pageProps/skills"))
        .or_else(|| payload.pointer("/props/pageProps/items"))
        .and_then(serde_json::Value::as_array)
        .map(|items| parse_skills_array(items))
        .unwrap_or_default();

    Ok(items)
}

fn parse_skills_array(items: &[serde_json::Value]) -> Vec<SkillsShSkill> {
    let mut seen = HashSet::new();
    let mut results = Vec::new();

    for item in items {
        let source = item
            .get("source")
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default()
            .trim()
            .to_string();
        let skill_id = item
            .get("skillId")
            .or_else(|| item.get("skill_id"))
            .or_else(|| item.get("id"))
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default()
            .trim()
            .to_string();

        if source.is_empty() || skill_id.is_empty() {
            continue;
        }

        let id = format!("{}/{}", source, skill_id);
        if !seen.insert(id.clone()) {
            continue;
        }

        let name = item
            .get("name")
            .and_then(serde_json::Value::as_str)
            .filter(|value| !value.trim().is_empty())
            .unwrap_or(skill_id.as_str())
            .trim()
            .to_string();
        let installs = item
            .get("installs")
            .and_then(serde_json::Value::as_u64)
            .unwrap_or(0);

        results.push(SkillsShSkill {
            id,
            skill_id,
            name,
            source,
            installs,
        });
    }

    results
}

fn parse_embedded_skill_objects(html: &str) -> Result<Vec<SkillsShSkill>, String> {
    let primary = Regex::new(
        r#"(?:\\)?\"source(?:\\)?\":(?:\\)?\"(?P<source>[^"\\]+)(?:\\)?\",(?:[^{}]|\\.)*?(?:(?:\\)?\"skillId(?:\\)?\"|(?:\\)?\"skill_id(?:\\)?\"):(?:\\)?\"(?P<skill_id>[^"\\]+)(?:\\)?\",(?:[^{}]|\\.)*?(?:\\)?\"name(?:\\)?\":(?:\\)?\"(?P<name>[^"\\]*)(?:\\)?\",(?:[^{}]|\\.)*?(?:\\)?\"installs(?:\\)?\":(?P<installs>\d+)"#,
    )
    .map_err(|error| format!("创建 skills.sh 主解析规则失败: {}", error))?;

    let fallback = Regex::new(
        r#"\{"source":"(?P<source>[^"]+)","skill_id":"(?P<skill_id>[^"]+)"(?:,"name":"(?P<name>[^"]*)")?(?:.*?"installs":(?P<installs>\d+))?\}"#,
    )
    .map_err(|error| format!("创建 skills.sh 兜底解析规则失败: {}", error))?;

    let primary_items = parse_embedded_with_regex(html, &primary);
    if !primary_items.is_empty() {
        return Ok(primary_items);
    }

    Ok(parse_embedded_with_regex(html, &fallback))
}

fn parse_embedded_with_regex(html: &str, pattern: &Regex) -> Vec<SkillsShSkill> {
    let mut seen = HashSet::new();
    let mut results = Vec::new();

    for captures in pattern.captures_iter(html) {
        let Some(source_match) = captures.name("source") else {
            continue;
        };
        let Some(skill_id_match) = captures.name("skill_id") else {
            continue;
        };

        let source = source_match.as_str().replace(r#"\""#, "\"");
        let skill_id = skill_id_match.as_str().replace(r#"\""#, "\"");
        let id = format!("{}/{}", source, skill_id);

        if !seen.insert(id.clone()) {
            continue;
        }

        let name = captures
            .name("name")
            .map(|value| value.as_str().replace(r#"\""#, "\""))
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| skill_id.clone());
        let installs = captures
            .name("installs")
            .and_then(|value| value.as_str().parse::<u64>().ok())
            .unwrap_or(0);

        results.push(SkillsShSkill {
            id,
            skill_id,
            name,
            source,
            installs,
        });
    }

    results
}

#[cfg(test)]
mod tests {
    use super::{parse_embedded_skill_objects, parse_next_data};

    #[test]
    fn 可解析旧版_next_data_载荷() {
        let html = r#"
        <html>
          <script id="__NEXT_DATA__" type="application/json">
            {"props":{"pageProps":{"initialSkills":[{"source":"antfu/skills","skillId":"vite","name":"vite","installs":152}]}}}
          </script>
        </html>
        "#;

        let skills = parse_next_data(html).expect("应能解析旧版 next data");
        assert_eq!(skills.len(), 1);
        assert_eq!(skills[0].id, "antfu/skills/vite");
    }

    #[test]
    fn 可解析当前_rsc_载荷() {
        let html = r#"
        <script>self.__next_f.push([1,"...\n[{\"source\":\"anthropics/skills\",\"skillId\":\"template-skill\",\"name\":\"template-skill\",\"installs\":238},{\"source\":\"vercel/ai\",\"skillId\":\"ai-sdk\",\"name\":\"ai-sdk\",\"installs\":265}]...\n"])</script>
        "#;

        let skills = parse_embedded_skill_objects(html).expect("应能解析当前 rsc 载荷");
        assert_eq!(skills.len(), 2);
        assert_eq!(skills[0].id, "anthropics/skills/template-skill");
        assert_eq!(skills[1].id, "vercel/ai/ai-sdk");
    }

    #[test]
    fn 可解析兜底嵌入对象() {
        let html = r#"
        {"source":"openai/skills","skill_id":"playwright","name":"playwright","installs":2}
        "#;

        let skills = parse_embedded_skill_objects(html).expect("应能解析兜底对象");
        assert_eq!(skills.len(), 1);
        assert_eq!(skills[0].id, "openai/skills/playwright");
    }
}
