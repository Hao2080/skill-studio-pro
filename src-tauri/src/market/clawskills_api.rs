use regex::Regex;
use std::collections::HashMap;

use crate::domain::{ExternalMarketFacet, ExternalMarketSkill, ExternalMarketSkillDetail};
use crate::market::{clawhub_api, common};

const SOURCE_KEY: &str = "clawskills";
const SOURCE_LABEL: &str = "clawskills.sh";
const LIST_URL: &str = "https://clawskills.sh/";
const CATEGORY_INDEX_URL: &str =
    "https://raw.githubusercontent.com/VoltAgent/awesome-openclaw-skills/main/README.md";

pub fn fetch_items() -> Result<Vec<ExternalMarketSkill>, String> {
    let html = common::fetch_text(LIST_URL)?;
    let mut items = parse_items(&html)?;
    if let Ok(category_map) = fetch_category_map() {
        apply_category_map(&mut items, &category_map);
    }
    Ok(items)
}

pub fn search_items(query: &str, limit: usize) -> Result<Vec<ExternalMarketSkill>, String> {
    let normalized = query.trim().to_lowercase();
    if normalized.is_empty() {
        return Ok(Vec::new());
    }

    let mut items = fetch_items()?;
    items.retain(|item| {
        let haystack = format!(
            "{} {} {} {} {}",
            item.name,
            item.summary,
            item.publisher,
            item.skill_id,
            item.tags.join(" ")
        );
        haystack.to_lowercase().contains(&normalized)
    });
    items.truncate(limit.clamp(1, 120));
    Ok(items)
}

pub fn load_detail(skill_id: &str) -> Result<ExternalMarketSkillDetail, String> {
    let (owner_handle, package_name) = split_owner_and_package(skill_id)?;
    let page_url = detail_url(&owner_handle, &package_name);
    let html = common::fetch_text(&page_url)?;

    let version = capture_first(
        &html,
        r#"<span class="text-\[11px\] sm:text-label-12 px-2 sm:px-2\.5 py-0\.5 sm:py-1 rounded-full"[^>]*>v<!-- -->(?P<value>[^<]+)</span>"#,
    );
    let category = capture_first(
        &html,
        r#"href="/skills\?category=[^"]+">(?P<value>[^<]+)</a>"#,
    )
    .map(|value| common::clean_html_text(&value));
    let downloads_value = capture_first(
        &html,
        r#"<span class="text-\[11px\] sm:text-label-12" style="font-family:var\(--font-mono\)">(?P<value>[^<]+)<!-- --> downloads</span>"#,
    );
    let installs_value = capture_first(
        &html,
        r#"<span class="text-\[11px\] sm:text-label-12" style="font-family:var\(--font-mono\)">(?P<value>[^<]+)<!-- --> installs</span>"#,
    );
    let github_url = capture_first(
        &html,
        r#"href="(?P<value>https://github\.com/openclaw/skills/tree/main/skills/[^"]+)""#,
    );
    let clawhub_url = capture_first(&html, r#"href="(?P<value>https://clawhub\.ai/[^"]+)""#);
    let install_command = capture_first(
        &html,
        r#"<span class="text-\[14px\] flex-1 truncate"[^>]*>(?P<value>clawhub install [^<]+)</span>"#,
    )
    .map(|value| common::clean_html_text(&value));
    let summary = capture_first(
        &html,
        r#"<p class="text-\[14px\] sm:text-\[16px\] mb-4 sm:mb-5"[^>]*>(?P<value>[^<]+)</p>"#,
    )
    .map(|value| common::clean_html_text(&value));
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
    let requirements = capture_many(
        &html,
        r#"<span class="inline-flex items-center gap-2 text-label-12 px-3 py-1\.5 rounded-lg transition-colors duration-150"[^>]*>(?P<value>.*?)</span>"#,
    )
    .into_iter()
    .map(|value| common::clean_html_text(&value))
    .filter(|value| !value.is_empty())
    .collect::<Vec<_>>();
    let virus_total = capture_first(
        &html,
        r#"<span class="text-label-12" style="color:#a0a0a0">VirusTotal</span><span class="text-label-12 px-1\.5 py-0\.5 rounded"[^>]*>(?P<value>[^<]+)</span>"#,
    );
    let openclaw_status = capture_first(
        &html,
        r#"<span class="text-label-12" style="color:var\(--color-gray-700\)">OpenClaw</span><span class="text-label-12 px-1\.5 py-0\.5 rounded"[^>]*>(?P<value>[^<]+)</span>"#,
    );

    let mut clawhub_detail = clawhub_api::load_detail(&package_name, version.as_deref())?;
    clawhub_detail.market_source = SOURCE_KEY.to_string();
    clawhub_detail.source = "openclaw/skills".to_string();
    clawhub_detail.source_label = SOURCE_LABEL.to_string();
    clawhub_detail.skill_id = skill_id.to_string();
    clawhub_detail.publisher = Some(owner_handle.clone());
    clawhub_detail.detail_url = Some(page_url.clone());
    clawhub_detail.category = category.or(clawhub_detail.category);
    clawhub_detail.version = version.or(clawhub_detail.version);
    clawhub_detail.install_command = install_command.or(clawhub_detail.install_command);
    clawhub_detail.summary = summary.or(clawhub_detail.summary);
    clawhub_detail.highlights = highlight
        .into_iter()
        .chain(clawhub_detail.highlights)
        .collect();
    clawhub_detail.use_cases = if use_cases.is_empty() {
        clawhub_detail.use_cases
    } else {
        use_cases
    };
    clawhub_detail.requirements = if requirements.is_empty() {
        clawhub_detail.requirements
    } else {
        requirements
    };
    clawhub_detail.security_signals = [
        virus_total.map(|value| ExternalMarketFacet {
            label: "VirusTotal".to_string(),
            value: common::clean_html_text(&value),
        }),
        openclaw_status.map(|value| ExternalMarketFacet {
            label: "OpenClaw".to_string(),
            value: common::clean_html_text(&value),
        }),
    ]
    .into_iter()
    .flatten()
    .collect();
    clawhub_detail.repo_url = github_url.or(clawhub_detail.repo_url);
    clawhub_detail.package_name = Some(package_name.clone());
    clawhub_detail.owner_handle = Some(owner_handle.clone());
    clawhub_detail.package_version = clawhub_detail.version.clone();

    if clawhub_detail.documentation_path.is_none() {
        clawhub_detail.documentation_path = Some("README.md".to_string());
    }

    if let Some(downloads_value) = downloads_value {
        clawhub_detail.highlights.push(format!(
            "Downloads {}",
            common::clean_html_text(&downloads_value)
        ));
    }
    if let Some(installs_value) = installs_value {
        clawhub_detail.highlights.push(format!(
            "Installs {}",
            common::clean_html_text(&installs_value)
        ));
    }
    if let Some(clawhub_url) = clawhub_url {
        clawhub_detail.highlights.push(clawhub_url);
    }

    Ok(clawhub_detail)
}

fn parse_items(html: &str) -> Result<Vec<ExternalMarketSkill>, String> {
    let pattern = Regex::new(
        r#"<a href="/skills/(?P<slug>[^"]+)"[^>]*class="group/row[^"]*"[^>]*><span[^>]*>(?P<rank>\d+)</span><div class="flex-1 min-w-0"><div class="flex items-baseline gap-2\.5 min-w-0"><span[^>]*>(?P<name>[^<]+)</span><span[^>]*>(?P<owner>.*?)</span></div><div class="mt-1\.5 flex items-center min-w-0"><p[^>]*>(?P<summary>.*?)</p></div></div><span[^>]*>(?P<downloads>[^<]+)</span><span[^>]*>(?P<stars>[^<]+)</span>"#,
    )
    .map_err(|error| format!("创建 clawskills 列表解析规则失败: {}", error))?;

    let mut items = Vec::new();
    for captures in pattern.captures_iter(html) {
        let name = captures
            .name("name")
            .map(|value| common::clean_html_text(value.as_str()))
            .unwrap_or_default();
        let owner_text = captures
            .name("owner")
            .map(|value| common::clean_html_text(value.as_str()))
            .unwrap_or_default();
        let publisher = owner_text
            .split('/')
            .next()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or("unknown")
            .to_string();
        let rank = captures
            .name("rank")
            .and_then(|value| value.as_str().parse::<u64>().ok())
            .unwrap_or(0);
        let downloads_raw = captures
            .name("downloads")
            .map(|value| common::clean_html_text(value.as_str()))
            .unwrap_or_default();
        let downloads = common::parse_abbreviated_number(&downloads_raw);
        let stars_raw = captures
            .name("stars")
            .map(|value| common::clean_html_text(value.as_str()))
            .unwrap_or_default();
        let stars = common::parse_abbreviated_number(&stars_raw);
        let skill_id = format!("{}/{}", publisher, name);

        items.push(ExternalMarketSkill {
            id: format!("{}:openclaw/skills/{}", SOURCE_KEY, skill_id),
            market_source: SOURCE_KEY.to_string(),
            source_keys: vec![SOURCE_KEY.to_string()],
            name: name.clone(),
            summary: captures
                .name("summary")
                .map(|value| common::clean_html_text(value.as_str()))
                .unwrap_or_default(),
            source: "openclaw/skills".to_string(),
            source_label: owner_text,
            skill_id,
            publisher: publisher.clone(),
            repo_url: Some(detail_url(&publisher, &name)),
            source_subpath: None,
            category: Some("Curated Community".to_string()),
            accent_color: "#33d17a".to_string(),
            tags: vec![publisher.clone()],
            installs: downloads,
            featured: rank > 0 && rank <= 64,
            verification: if stars >= 5 {
                "verified".to_string()
            } else {
                "reviewing".to_string()
            },
            risk: if stars >= 5 {
                "low".to_string()
            } else {
                "medium".to_string()
            },
            facets: vec![
                ExternalMarketFacet {
                    label: "Category".to_string(),
                    value: "Curated Community".to_string(),
                },
                ExternalMarketFacet {
                    label: "Publisher".to_string(),
                    value: publisher.clone(),
                },
                ExternalMarketFacet {
                    label: "Downloads".to_string(),
                    value: downloads_band(downloads),
                },
            ],
            metrics: vec![
                ExternalMarketFacet {
                    label: "Downloads".to_string(),
                    value: downloads_raw,
                },
                ExternalMarketFacet {
                    label: "Stars".to_string(),
                    value: stars_raw,
                },
                ExternalMarketFacet {
                    label: "Rank".to_string(),
                    value: if rank == 0 {
                        "-".to_string()
                    } else {
                        format!("#{}", rank)
                    },
                },
            ],
            detail_url: Some(detail_url(&publisher, &name)),
            package_name: Some(name),
            package_version: None,
            owner_handle: Some(publisher),
            updated_at: None,
        });
    }

    Ok(items)
}

fn fetch_category_map() -> Result<HashMap<String, String>, String> {
    let markdown = common::fetch_text(CATEGORY_INDEX_URL)?;
    Ok(parse_category_map(&markdown))
}

fn parse_category_map(markdown: &str) -> HashMap<String, String> {
    let item_pattern = Regex::new(r"\((?:https://clawskills\.sh)?(?P<path>/skills/[^)]+)\)").ok();
    let mut category_map = HashMap::new();
    let mut current_category: Option<String> = None;

    for line in markdown.lines() {
        let trimmed = line.trim();

        if let Some(heading) = trimmed.strip_prefix("### ") {
            let category = heading
                .split(" (")
                .next()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .unwrap_or(heading)
                .to_string();
            current_category = Some(category);
            continue;
        }

        let Some(category) = current_category.as_ref() else {
            continue;
        };

        let Some(pattern) = item_pattern.as_ref() else {
            continue;
        };

        if !trimmed.starts_with('*') {
            continue;
        }

        let Some(captures) = pattern.captures(trimmed) else {
            continue;
        };

        let Some(path) = captures.name("path").map(|value| value.as_str().trim()) else {
            continue;
        };
        let detail_url = format!("https://clawskills.sh{}", path);
        category_map
            .entry(detail_url)
            .or_insert_with(|| category.clone());
    }

    category_map
}

fn apply_category_map(items: &mut [ExternalMarketSkill], category_map: &HashMap<String, String>) {
    for item in items.iter_mut() {
        let category = item
            .detail_url
            .as_ref()
            .and_then(|url| category_map.get(url))
            .cloned()
            .unwrap_or_else(|| "Curated Community".to_string());

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
                label: "Publisher".to_string(),
                value: item.publisher.clone(),
            },
            ExternalMarketFacet {
                label: "Downloads".to_string(),
                value: downloads_band(item.installs),
            },
        ];
    }
}

fn split_owner_and_package(skill_id: &str) -> Result<(String, String), String> {
    let (owner, package_name) = skill_id
        .split_once('/')
        .ok_or_else(|| format!("clawskills skillId 结构异常: {}", skill_id))?;
    Ok((owner.trim().to_string(), package_name.trim().to_string()))
}

fn detail_url(owner: &str, package_name: &str) -> String {
    format!(
        "https://clawskills.sh/skills/{}-{}",
        owner.trim(),
        package_name.trim()
    )
}

fn downloads_band(value: u64) -> String {
    match value {
        0..=999 => "0-999".to_string(),
        1_000..=4_999 => "1k-4.9k".to_string(),
        5_000..=19_999 => "5k-19.9k".to_string(),
        _ => "20k+".to_string(),
    }
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
