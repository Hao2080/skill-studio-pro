use regex::Regex;
use std::collections::HashMap;

use crate::domain::{ExternalMarketFacet, ExternalMarketSkill, ExternalMarketSkillDetail};
use crate::market::{common, skillssh_repo};

const SOURCE_KEY: &str = "officialskills";
const SOURCE_LABEL: &str = "officialskills.sh";
const LIST_URL: &str = "https://officialskills.sh/";

pub fn fetch_items() -> Result<Vec<ExternalMarketSkill>, String> {
    let html = common::fetch_text(LIST_URL)?;
    let mut items = parse_items(&html)?;
    if let Ok(category_map) = build_category_map(&html) {
        apply_category_map(&mut items, &category_map);
    }
    Ok(items)
}

pub fn fetch_items_fast() -> Result<Vec<ExternalMarketSkill>, String> {
    let html = common::fetch_text(LIST_URL)?;
    parse_items(&html)
}

pub fn search_items(query: &str, limit: usize) -> Result<Vec<ExternalMarketSkill>, String> {
    let normalized = query.trim().to_lowercase();
    if normalized.is_empty() {
        return Ok(Vec::new());
    }

    let mut items = fetch_items()?;
    items.retain(|item| {
        [
            item.name.as_str(),
            item.summary.as_str(),
            item.publisher.as_str(),
            item.source_label.as_str(),
            item.source.as_str(),
            item.skill_id.as_str(),
        ]
        .join(" ")
        .to_lowercase()
        .contains(&normalized)
    });
    items.truncate(limit.clamp(1, 120));
    Ok(items)
}

pub fn load_detail(source: &str, skill_id: &str) -> Result<ExternalMarketSkillDetail, String> {
    let page_url = detail_page_url(source, skill_id);
    let html = common::fetch_text(&page_url)?;
    let publisher = parse_detail_publisher(&html);
    let category = capture_first(&html, r#"href="/\?category=[^"]+">(?P<value>[^<]+)</a>"#)
        .map(|value| common::clean_html_text(&value));
    let install_command = capture_first(
        &html,
        r#"<span class="text-\[14px\] flex-1 truncate"[^>]*>(?P<value>npx skills add [^<]+)</span>"#,
    )
    .map(|value| common::clean_html_text(&value));
    let repo_tree_url = capture_first(
        &html,
        r#"href="(?P<value>https://github\.com/[^"]+/tree/[^"]+)""#,
    );
    let highlight = capture_first(
        &html,
        r#"<p class="text-\[15px\] leading-snug"[^>]*>(?P<value>[^<]+)</p>"#,
    )
    .map(|value| common::clean_html_text(&value));
    let use_cases = capture_many(
        &html,
        r#"<li class="flex items-start gap-2\.5"[^>]*>.*?<span class="text-\[16px\]"[^>]*>(?P<value>[^<]+)</span>"#,
    )
    .into_iter()
    .map(|value| common::clean_html_text(&value))
    .filter(|value| !value.is_empty())
    .collect::<Vec<_>>();

    let mut detail = skillssh_repo::load_github_skill_detail(
        SOURCE_KEY,
        SOURCE_LABEL,
        publisher.clone(),
        Some(page_url.clone()),
        source,
        skill_id,
    )?;

    detail.publisher = publisher;
    detail.category = category;
    detail.install_command = install_command;
    detail.highlights = highlight.into_iter().collect();
    detail.use_cases = use_cases;
    detail.detail_url = Some(page_url);

    if let Some(repo_tree_url) = repo_tree_url {
        detail.repo_url = Some(repo_tree_url.clone());
        detail.source_subpath = extract_tree_subpath(&repo_tree_url);
    }

    Ok(detail)
}

fn parse_items(html: &str) -> Result<Vec<ExternalMarketSkill>, String> {
    let pattern = Regex::new(
        r#"<a href="/(?P<source>[A-Za-z0-9._-]+/skills)/(?P<skill>[^"]+)"[^>]*class="group/row[^"]*"[^>]*><span[^>]*>(?P<rank>\d+)</span><div class="flex-1 min-w-0"><div class="flex items-baseline gap-2\.5 min-w-0"><span[^>]*>(?P<name>[^<]+)</span><span[^>]*>(?P<owner>.*?)</span></div><div class="mt-1\.5 flex items-center min-w-0"><p[^>]*>(?P<summary>.*?)</p>"#,
    )
    .map_err(|error| format!("创建 officialskills 列表解析规则失败: {}", error))?;

    let mut items = Vec::new();
    for captures in pattern.captures_iter(html) {
        let Some(source) = captures
            .name("source")
            .map(|value| value.as_str().trim().to_string())
        else {
            continue;
        };
        let Some(skill_id) = captures
            .name("skill")
            .map(|value| value.as_str().trim().to_string())
        else {
            continue;
        };

        let owner_text = captures
            .name("owner")
            .map(|value| common::clean_html_text(value.as_str()))
            .unwrap_or_else(|| source.clone());
        let publisher = owner_text
            .split('/')
            .next()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(source.as_str())
            .to_string();
        let rank = captures
            .name("rank")
            .and_then(|value| value.as_str().parse::<u64>().ok())
            .unwrap_or(0);
        let name = captures
            .name("name")
            .map(|value| common::clean_html_text(value.as_str()))
            .unwrap_or_else(|| skill_id.clone());
        let summary = captures
            .name("summary")
            .map(|value| common::clean_html_text(value.as_str()))
            .unwrap_or_default();
        let canonical_ref = format!("{}/{}", source, skill_id);

        items.push(ExternalMarketSkill {
            id: format!("{}:{}", SOURCE_KEY, canonical_ref),
            market_source: SOURCE_KEY.to_string(),
            source_keys: vec![SOURCE_KEY.to_string()],
            name,
            summary,
            source: source.clone(),
            source_label: owner_text.clone(),
            skill_id: skill_id.clone(),
            publisher,
            repo_url: Some(format!("https://github.com/{}.git", source)),
            source_subpath: None,
            category: Some("Official Directory".to_string()),
            accent_color: "#18d2a6".to_string(),
            tags: vec!["official".to_string()],
            installs: rank,
            featured: rank > 0 && rank <= 48,
            verification: "official".to_string(),
            risk: "low".to_string(),
            facets: vec![
                ExternalMarketFacet {
                    label: "Category".to_string(),
                    value: "Official Directory".to_string(),
                },
                ExternalMarketFacet {
                    label: "Team".to_string(),
                    value: owner_text
                        .split('/')
                        .next()
                        .unwrap_or(owner_text.as_str())
                        .trim()
                        .to_string(),
                },
                ExternalMarketFacet {
                    label: "Rank".to_string(),
                    value: common::format_rank_band(rank),
                },
            ],
            metrics: vec![
                ExternalMarketFacet {
                    label: "Rank".to_string(),
                    value: if rank == 0 {
                        "-".to_string()
                    } else {
                        format!("#{}", rank)
                    },
                },
                ExternalMarketFacet {
                    label: "Repository".to_string(),
                    value: source.clone(),
                },
            ],
            detail_url: Some(detail_page_url(&source, &skill_id)),
            package_name: None,
            package_version: None,
            owner_handle: Some(
                owner_text
                    .split('/')
                    .next()
                    .unwrap_or(owner_text.as_str())
                    .trim()
                    .to_lowercase(),
            ),
            updated_at: None,
        });
    }

    Ok(items)
}

fn build_category_map(home_html: &str) -> Result<HashMap<String, String>, String> {
    let category_links = extract_category_links(home_html);
    if category_links.is_empty() {
        return Ok(HashMap::new());
    }

    let mut category_map = HashMap::new();
    for (slug, label) in category_links {
        let html = common::fetch_text(&category_page_url(&slug))?;
        for item in parse_items(&html)? {
            category_map
                .entry(format!("{}/{}", item.source, item.skill_id))
                .or_insert_with(|| label.clone());
        }
    }

    Ok(category_map)
}

fn extract_category_links(html: &str) -> Vec<(String, String)> {
    let pattern = Regex::new(r#"href="/\?category=(?P<slug>[^"]+)">(?P<label>[^<]+)</a>"#).ok();
    let Some(pattern) = pattern else {
        return Vec::new();
    };

    let mut items = Vec::new();
    for captures in pattern.captures_iter(html) {
        let Some(slug) = captures
            .name("slug")
            .map(|value| value.as_str().trim().to_string())
        else {
            continue;
        };
        let Some(label) = captures
            .name("label")
            .map(|value| common::clean_html_text(value.as_str()))
            .filter(|value| !value.is_empty() && !value.eq_ignore_ascii_case("all"))
        else {
            continue;
        };

        if items
            .iter()
            .any(|(existing_slug, _)| existing_slug == &slug)
        {
            continue;
        }
        items.push((slug, label));
    }

    items
}

fn apply_category_map(items: &mut [ExternalMarketSkill], category_map: &HashMap<String, String>) {
    for item in items.iter_mut() {
        let category = category_map
            .get(&format!("{}/{}", item.source, item.skill_id))
            .cloned()
            .unwrap_or_else(|| "Official Directory".to_string());

        item.category = Some(category.clone());
        if !item
            .tags
            .iter()
            .any(|tag| tag.eq_ignore_ascii_case(&category))
        {
            item.tags.push(category.clone());
        }
        item.facets = vec![
            ExternalMarketFacet {
                label: "Category".to_string(),
                value: category,
            },
            ExternalMarketFacet {
                label: "Team".to_string(),
                value: item.publisher.clone(),
            },
            ExternalMarketFacet {
                label: "Rank".to_string(),
                value: common::format_rank_band(item.installs),
            },
        ];
    }
}

fn parse_detail_publisher(html: &str) -> Option<String> {
    capture_first(
        html,
        r#"github\.com/[^"]+\.png\?size=40" alt="(?P<value>[^"]+)""#,
    )
}

fn detail_page_url(source: &str, skill_id: &str) -> String {
    format!(
        "https://officialskills.sh/{}/{}",
        source.trim(),
        skill_id.trim()
    )
}

fn category_page_url(slug: &str) -> String {
    format!("https://officialskills.sh/?category={}", slug.trim())
}

fn extract_tree_subpath(repo_tree_url: &str) -> Option<String> {
    let marker = "/tree/main/";
    repo_tree_url
        .split_once(marker)
        .map(|(_, value)| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn capture_first(html: &str, pattern: &str) -> Option<String> {
    Regex::new(pattern)
        .ok()
        .and_then(|regex| regex.captures(html))
        .and_then(|captures| {
            captures
                .name("value")
                .map(|value| value.as_str().to_string())
        })
}

fn capture_many(html: &str, pattern: &str) -> Vec<String> {
    Regex::new(pattern)
        .ok()
        .map(|regex| {
            regex
                .captures_iter(html)
                .filter_map(|captures| {
                    captures
                        .name("value")
                        .map(|value| value.as_str().to_string())
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}
