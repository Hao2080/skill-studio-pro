use crate::domain::{ExternalMarketFacet, ExternalMarketSkill};
use crate::market::skillssh_api::SkillsShSkill;

struct CategoryProfile {
    category: &'static str,
    accent_color: &'static str,
    tags: &'static [&'static str],
    summary_prefix: &'static str,
}

const FRONTEND_PROFILE: CategoryProfile = CategoryProfile {
    category: "前端开发",
    accent_color: "#58a6ff",
    tags: &["界面", "浏览器", "前端"],
    summary_prefix: "聚焦界面、浏览器自动化与前端工作流",
};

const BACKEND_PROFILE: CategoryProfile = CategoryProfile {
    category: "后端开发",
    accent_color: "#3fb950",
    tags: &["服务", "接口", "后端"],
    summary_prefix: "聚焦服务端接口、框架与后端工程任务",
};

const TEST_PROFILE: CategoryProfile = CategoryProfile {
    category: "测试调试",
    accent_color: "#d29922",
    tags: &["测试", "调试", "验证"],
    summary_prefix: "聚焦测试自动化、排障与稳定性验证",
};

const DEVOPS_PROFILE: CategoryProfile = CategoryProfile {
    category: "发布运维",
    accent_color: "#f78166",
    tags: &["部署", "运维", "发布"],
    summary_prefix: "聚焦发布流程、运行环境与运维操作",
};

const COLLAB_PROFILE: CategoryProfile = CategoryProfile {
    category: "团队协作",
    accent_color: "#a371f7",
    tags: &["评审", "协作", "流程"],
    summary_prefix: "聚焦团队协作、评审流与任务协同",
};

const DOC_PROFILE: CategoryProfile = CategoryProfile {
    category: "文档内容",
    accent_color: "#7ee787",
    tags: &["文档", "内容", "说明"],
    summary_prefix: "聚焦文档撰写、内容整理与结构化说明",
};

const DATA_PROFILE: CategoryProfile = CategoryProfile {
    category: "数据处理",
    accent_color: "#79c0ff",
    tags: &["数据", "表格", "分析"],
    summary_prefix: "聚焦数据整理、分析、表格与信息抽取",
};

const EFFICIENCY_PROFILE: CategoryProfile = CategoryProfile {
    category: "研发效率",
    accent_color: "#56d364",
    tags: &["效率", "自动化", "工程"],
    summary_prefix: "聚焦研发提效、自动化与工程流编排",
};

const GENERAL_PROFILE: CategoryProfile = CategoryProfile {
    category: "通用工具",
    accent_color: "#8b949e",
    tags: &["工具", "通用"],
    summary_prefix: "适合作为通用辅助能力接入当前技能工作流",
};

const MANUAL_RULES: &[(&str, &CategoryProfile)] = &[
    ("playwright", &TEST_PROFILE),
    ("browser", &FRONTEND_PROFILE),
    ("react", &FRONTEND_PROFILE),
    ("vue", &FRONTEND_PROFILE),
    ("next", &FRONTEND_PROFILE),
    ("node", &BACKEND_PROFILE),
    ("server", &BACKEND_PROFILE),
    ("api", &BACKEND_PROFILE),
    ("database", &DATA_PROFILE),
    ("sql", &DATA_PROFILE),
    ("excel", &DATA_PROFILE),
    ("csv", &DATA_PROFILE),
    ("debug", &TEST_PROFILE),
    ("test", &TEST_PROFILE),
    ("deploy", &DEVOPS_PROFILE),
    ("docker", &DEVOPS_PROFILE),
    ("kubernetes", &DEVOPS_PROFILE),
    ("review", &COLLAB_PROFILE),
    ("pr", &COLLAB_PROFILE),
    ("issue", &COLLAB_PROFILE),
    ("doc", &DOC_PROFILE),
    ("readme", &DOC_PROFILE),
    ("markdown", &DOC_PROFILE),
];

pub fn build_external_market_items(items: &[SkillsShSkill]) -> Vec<ExternalMarketSkill> {
    items.iter().map(build_external_market_item).collect()
}

pub fn build_external_market_item(item: &SkillsShSkill) -> ExternalMarketSkill {
    let profile = resolve_profile(item);
    let installs_text = format_installs(item.installs);
    let summary = format!(
        "{}，来自 {}，当前安装量 {}。",
        profile.summary_prefix, item.source, installs_text
    );

    ExternalMarketSkill {
        id: format!("skillssh:{}", item.id),
        market_source: "skillssh".to_string(),
        source_keys: vec!["skillssh".to_string()],
        name: item.name.clone(),
        summary,
        source: item.source.clone(),
        source_label: item.source.clone(),
        skill_id: item.skill_id.clone(),
        publisher: item
            .source
            .split('/')
            .next()
            .unwrap_or(item.source.as_str())
            .to_string(),
        repo_url: Some(format!("https://github.com/{}.git", item.source)),
        source_subpath: None,
        category: Some(profile.category.to_string()),
        accent_color: profile.accent_color.to_string(),
        tags: profile.tags.iter().map(|value| value.to_string()).collect(),
        installs: item.installs,
        featured: item.installs >= 200 || is_official_source(item.source.as_str()),
        verification: "verified".to_string(),
        risk: "low".to_string(),
        facets: vec![
            ExternalMarketFacet {
                label: "Repository".to_string(),
                value: item.source.clone(),
            },
            ExternalMarketFacet {
                label: "Category".to_string(),
                value: profile.category.to_string(),
            },
            ExternalMarketFacet {
                label: "Usage".to_string(),
                value: format_installs(item.installs),
            },
        ],
        metrics: vec![
            ExternalMarketFacet {
                label: "Installs".to_string(),
                value: format_installs(item.installs),
            },
            ExternalMarketFacet {
                label: "Tags".to_string(),
                value: profile.tags.join(" / "),
            },
        ],
        detail_url: None,
        package_name: None,
        package_version: None,
        owner_handle: item.source.split('/').next().map(str::to_string),
        updated_at: None,
    }
}

fn resolve_profile(item: &SkillsShSkill) -> &'static CategoryProfile {
    let haystack = format!(
        "{} {} {}",
        item.skill_id.to_lowercase(),
        item.name.to_lowercase(),
        item.source.to_lowercase()
    );

    for (pattern, profile) in MANUAL_RULES {
        if haystack.contains(pattern) {
            return profile;
        }
    }

    if contains_any(&haystack, &["frontend", "ui", "css", "html", "web"]) {
        return &FRONTEND_PROFILE;
    }

    if contains_any(
        &haystack,
        &["backend", "server", "service", "api", "auth", "http"],
    ) {
        return &BACKEND_PROFILE;
    }

    if contains_any(&haystack, &["test", "debug", "qa", "bug", "trace"]) {
        return &TEST_PROFILE;
    }

    if contains_any(
        &haystack,
        &["deploy", "ops", "infra", "docker", "k8s", "release"],
    ) {
        return &DEVOPS_PROFILE;
    }

    if contains_any(
        &haystack,
        &["review", "team", "workflow", "issue", "project"],
    ) {
        return &COLLAB_PROFILE;
    }

    if contains_any(
        &haystack,
        &["doc", "readme", "markdown", "write", "content"],
    ) {
        return &DOC_PROFILE;
    }

    if contains_any(
        &haystack,
        &["data", "sql", "csv", "excel", "json", "report"],
    ) {
        return &DATA_PROFILE;
    }

    if contains_any(&haystack, &["agent", "cli", "tool", "automation", "dev"]) {
        return &EFFICIENCY_PROFILE;
    }

    &GENERAL_PROFILE
}

fn contains_any(value: &str, patterns: &[&str]) -> bool {
    patterns.iter().any(|pattern| value.contains(pattern))
}

fn is_official_source(source: &str) -> bool {
    let lowered = source.to_lowercase();
    ["openai", "anthropic", "anthropics", "vercel", "microsoft"]
        .iter()
        .any(|pattern| lowered.contains(pattern))
}

fn format_installs(value: u64) -> String {
    if value >= 1_000_000 {
        format!("{:.1}M", value as f64 / 1_000_000_f64)
    } else if value >= 1_000 {
        format!("{:.1}K", value as f64 / 1_000_f64)
    } else {
        value.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::build_external_market_item;
    use crate::market::skillssh_api::SkillsShSkill;

    #[test]
    fn 可根据关键词归类前端技能() {
        let item = SkillsShSkill {
            id: "openai/skills/browser".to_string(),
            skill_id: "browser".to_string(),
            name: "browser".to_string(),
            source: "openai/skills".to_string(),
            installs: 120,
        };

        let result = build_external_market_item(&item);
        assert_eq!(result.category.as_deref(), Some("前端开发"));
        assert!(result.featured);
    }

    #[test]
    fn 未命中规则时回落到通用工具() {
        let item = SkillsShSkill {
            id: "someone/skills/helper".to_string(),
            skill_id: "helper".to_string(),
            name: "helper".to_string(),
            source: "someone/skills".to_string(),
            installs: 3,
        };

        let result = build_external_market_item(&item);
        assert_eq!(result.category.as_deref(), Some("通用工具"));
    }
}
