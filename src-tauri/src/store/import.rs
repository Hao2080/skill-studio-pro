use serde_json::json;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use uuid::Uuid;

use crate::domain::{ImportSkillInput, MarketCatalogItem, Skill, SkillImportRecord};
use crate::market::{clawhub_api, skillssh_repo};
use crate::workspace;

use super::{copy_dir_recursive, get_conn, now_ms, skill_dir, slugify};

pub(crate) struct SkillSourceSeed {
    pub(crate) source_type: String,
    pub(crate) source_label: String,
    pub(crate) source_ref: Option<String>,
    pub(crate) source_path: Option<String>,
    pub(crate) metadata_json: Option<String>,
}

struct PreparedImport {
    display_name: String,
    description: Option<String>,
    source_root: PathBuf,
    source_seed: SkillSourceSeed,
    cleanup_root: Option<PathBuf>,
}

struct ImportLogSeed {
    source_type: String,
    source_label: String,
    source_ref: Option<String>,
    source_path: Option<String>,
    request_payload_json: Option<String>,
}

fn normalize_optional_text(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn build_source_label(source_type: &str) -> String {
    match source_type {
        "manual" => "手动创建".to_string(),
        "platform_scan" => "平台扫描导入".to_string(),
        "team_library" => "团队库导入".to_string(),
        "git_repository" => "仓库快照导入".to_string(),
        "skillssh" => "外部市场导入".to_string(),
        "market_catalog" => "市场精选导入".to_string(),
        _ => "本地目录导入".to_string(),
    }
}

fn normalize_source_type(value: &str) -> String {
    let normalized = value.trim();
    if normalized.is_empty() {
        "local".to_string()
    } else {
        normalized.to_string()
    }
}

fn normalize_import_input(input: &ImportSkillInput) -> ImportSkillInput {
    ImportSkillInput {
        folder_path: normalize_optional_text(input.folder_path.as_deref()),
        source_type: normalize_source_type(&input.source_type),
        git_url: normalize_optional_text(input.git_url.as_deref()),
        repo_subdir: normalize_optional_text(input.repo_subdir.as_deref()),
        market_item_id: normalize_optional_text(input.market_item_id.as_deref()),
        external_source: normalize_optional_text(input.external_source.as_deref()),
        external_skill_id: normalize_optional_text(input.external_skill_id.as_deref()),
        external_installs: input.external_installs,
        external_market_source: normalize_optional_text(input.external_market_source.as_deref()),
        external_package_name: normalize_optional_text(input.external_package_name.as_deref()),
        external_package_version: normalize_optional_text(
            input.external_package_version.as_deref(),
        ),
        external_owner_handle: normalize_optional_text(input.external_owner_handle.as_deref()),
        platform_name: normalize_optional_text(input.platform_name.as_deref()),
        skill_folder_name: normalize_optional_text(input.skill_folder_name.as_deref()),
        display_name: normalize_optional_text(input.display_name.as_deref()),
    }
}

fn build_import_request_payload_json(input: &ImportSkillInput) -> Option<String> {
    serde_json::to_string(&normalize_import_input(input)).ok()
}

fn build_import_log_seed(input: &ImportSkillInput) -> ImportLogSeed {
    let normalized = normalize_import_input(input);
    let request_payload_json = build_import_request_payload_json(&normalized);
    let source_type = normalized.source_type.clone();
    let source_label = build_source_label(&source_type);
    let source_ref = match source_type.as_str() {
        "git_repository" => normalized.git_url.clone(),
        "market_catalog" => normalized.market_item_id.clone(),
        "skillssh" => match (
            normalized.external_source.as_deref(),
            normalized.external_skill_id.as_deref(),
        ) {
            (Some(source), Some(skill_id)) => Some(format!("{}/{}", source, skill_id)),
            _ => normalized.external_source.clone(),
        },
        "platform_scan" => match (
            normalized.platform_name.as_deref(),
            normalized.skill_folder_name.as_deref(),
        ) {
            (Some(platform_name), Some(skill_folder_name)) => {
                Some(format!("{}:{}", platform_name, skill_folder_name))
            }
            _ => normalized.folder_path.clone(),
        },
        _ => normalized.folder_path.clone(),
    };

    ImportLogSeed {
        source_type,
        source_label,
        source_ref,
        source_path: normalized.folder_path,
        request_payload_json,
    }
}

fn build_import_success_detail(source_type: &str, skill_name: &str) -> String {
    match source_type {
        "git_repository" => format!("仓库快照已导入为「{}」，并纳入统一版本治理。", skill_name),
        "skillssh" => format!("外部市场技能已导入为「{}」，并纳入统一治理。", skill_name),
        "market_catalog" => format!(
            "市场精选模板已导入为「{}」，可继续在工作区治理。",
            skill_name
        ),
        "platform_scan" => format!(
            "平台扫描技能已导入为「{}」，并建立正式来源记录。",
            skill_name
        ),
        "team_library" => format!("团队版本已拉取为「{}」的工作副本。", skill_name),
        _ => format!("本地目录已导入为「{}」，并建立正式来源记录。", skill_name),
    }
}

fn derive_name_from_path(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().to_string())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "unnamed-skill".to_string())
}

fn derive_name_from_git_url(url: &str) -> String {
    let normalized = url.trim().trim_end_matches('/');
    let last_segment = normalized
        .rsplit('/')
        .next()
        .unwrap_or("repository")
        .trim_end_matches(".git");

    if last_segment.is_empty() {
        "repository".to_string()
    } else {
        last_segment.to_string()
    }
}

fn derive_name_from_skillssh(source: &str, skill_id: &str) -> String {
    let normalized = skill_id.trim();
    if !normalized.is_empty() {
        return normalized.to_string();
    }

    source
        .rsplit('/')
        .next()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("market-skill")
        .to_string()
}

fn create_temp_import_root(prefix: &str) -> Result<PathBuf, String> {
    let root = workspace::temp_imports_root()?.join(format!("{}-{}", prefix, Uuid::new_v4()));

    if let Some(parent) = root.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建临时导入目录失败: {}", e))?;
    }

    Ok(root)
}

fn write_market_file(root: &Path, relative_path: &str, content: &str) -> Result<(), String> {
    let target = root.join(relative_path);
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建模板目录失败: {}", e))?;
    }

    fs::write(target, content).map_err(|e| format!("写入模板文件失败: {}", e))
}

fn read_skill_description_from_dir(dir: &Path) -> Option<String> {
    super::description::read_skill_description_from_dir(dir)
}

fn materialize_directory_import(input: &ImportSkillInput) -> Result<PreparedImport, String> {
    let source_type = input.source_type.trim();
    let folder_path = normalize_optional_text(input.folder_path.as_deref())
        .ok_or_else(|| "目录导入缺少 folderPath".to_string())?;
    let source_root = PathBuf::from(&folder_path);
    if !source_root.is_dir() {
        return Err(format!("文件夹不存在: {}", folder_path));
    }

    let display_name = normalize_optional_text(input.display_name.as_deref())
        .unwrap_or_else(|| derive_name_from_path(&source_root));
    let description = read_skill_description_from_dir(&source_root);
    let source_ref = match source_type {
        "platform_scan" => match (
            normalize_optional_text(input.platform_name.as_deref()),
            normalize_optional_text(input.skill_folder_name.as_deref()),
        ) {
            (Some(platform_name), Some(skill_folder_name)) => {
                Some(format!("{}:{}", platform_name, skill_folder_name))
            }
            _ => Some(folder_path.clone()),
        },
        _ => Some(folder_path.clone()),
    };
    let metadata_json = match source_type {
        "platform_scan" => Some(
            json!({
                "platformName": normalize_optional_text(input.platform_name.as_deref()),
                "skillFolderName": normalize_optional_text(input.skill_folder_name.as_deref()),
            })
            .to_string(),
        ),
        "team_library" => Some(json!({ "mode": "new_skill" }).to_string()),
        _ => None,
    };

    Ok(PreparedImport {
        display_name,
        description,
        source_root,
        source_seed: SkillSourceSeed {
            source_type: source_type.to_string(),
            source_label: build_source_label(source_type),
            source_ref,
            source_path: Some(folder_path),
            metadata_json,
        },
        cleanup_root: None,
    })
}

fn materialize_git_repository_import(input: &ImportSkillInput) -> Result<PreparedImport, String> {
    let git_url = normalize_optional_text(input.git_url.as_deref())
        .ok_or_else(|| "仓库导入缺少 gitUrl".to_string())?;
    let temp_root = create_temp_import_root("git-repository")?;

    let output = Command::new("git")
        .args([
            "clone",
            "--depth",
            "1",
            git_url.as_str(),
            temp_root.to_string_lossy().as_ref(),
        ])
        .env("GIT_TERMINAL_PROMPT", "0")
        .output()
        .map_err(|e| format!("执行 git clone 失败: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if !stderr.is_empty() { stderr } else { stdout };
        let _ = fs::remove_dir_all(&temp_root);
        return Err(format!("克隆仓库失败: {}", detail));
    }

    let source_root = match normalize_optional_text(input.repo_subdir.as_deref()) {
        Some(repo_subdir) => temp_root.join(repo_subdir),
        None => temp_root.clone(),
    };

    if !source_root.is_dir() {
        let _ = fs::remove_dir_all(&temp_root);
        return Err("仓库子目录不存在".to_string());
    }

    if !source_root.join("skill.md").is_file() && !source_root.join("SKILL.md").is_file() {
        let _ = fs::remove_dir_all(&temp_root);
        return Err(
            "仓库目录缺少 skill.md，请确认仓库根目录或子目录是一个有效技能目录".to_string(),
        );
    }

    let display_name = normalize_optional_text(input.display_name.as_deref())
        .or_else(|| normalize_optional_text(input.repo_subdir.as_deref()))
        .unwrap_or_else(|| derive_name_from_git_url(&git_url));
    let description = read_skill_description_from_dir(&source_root);
    let metadata_json = Some(
        json!({
            "gitUrl": git_url,
            "repoSubdir": normalize_optional_text(input.repo_subdir.as_deref()),
        })
        .to_string(),
    );

    Ok(PreparedImport {
        display_name,
        description,
        source_root,
        source_seed: SkillSourceSeed {
            source_type: "git_repository".to_string(),
            source_label: build_source_label("git_repository"),
            source_ref: Some(git_url),
            source_path: None,
            metadata_json,
        },
        cleanup_root: Some(temp_root),
    })
}

fn materialize_skillssh_import(input: &ImportSkillInput) -> Result<PreparedImport, String> {
    let market_source = normalize_optional_text(input.external_market_source.as_deref())
        .unwrap_or_else(|| "skillssh".to_string());
    if market_source == "clawhub" || market_source == "clawskills" {
        return materialize_clawhub_package_import(input, &market_source);
    }

    let external_source = normalize_optional_text(input.external_source.as_deref())
        .ok_or_else(|| "外部市场导入缺少 externalSource".to_string())?;
    let external_skill_id = normalize_optional_text(input.external_skill_id.as_deref())
        .ok_or_else(|| "外部市场导入缺少 externalSkillId".to_string())?;
    let resolved = skillssh_repo::resolve_skillssh_source(&external_source, &external_skill_id)?;

    let display_name = normalize_optional_text(input.display_name.as_deref())
        .or_else(|| skillssh_repo::read_skill_name_from_dir(&resolved.skill_dir))
        .unwrap_or_else(|| derive_name_from_skillssh(&external_source, &external_skill_id));
    let description = read_skill_description_from_dir(&resolved.skill_dir);
    let metadata_json = Some(
        json!({
            "marketSource": market_source,
            "source": external_source,
            "skillId": external_skill_id,
            "repoUrl": resolved.repo_url,
            "sourceSubpath": resolved.source_subpath,
            "installs": input.external_installs,
        })
        .to_string(),
    );

    Ok(PreparedImport {
        display_name,
        description,
        source_root: resolved.skill_dir,
        source_seed: SkillSourceSeed {
            source_type: "skillssh".to_string(),
            source_label: build_source_label("skillssh"),
            source_ref: Some(format!("{}/{}", external_source, external_skill_id)),
            source_path: None,
            metadata_json,
        },
        cleanup_root: Some(resolved.temp_root),
    })
}

fn materialize_clawhub_package_import(
    input: &ImportSkillInput,
    market_source: &str,
) -> Result<PreparedImport, String> {
    let package_name = normalize_optional_text(input.external_package_name.as_deref())
        .or_else(|| {
            normalize_optional_text(input.external_skill_id.as_deref()).map(|skill_id| {
                skill_id
                    .split('/')
                    .next_back()
                    .map(str::to_string)
                    .unwrap_or(skill_id)
            })
        })
        .ok_or_else(|| "ClawHub 包导入缺少 packageName".to_string())?;
    let package_version = normalize_optional_text(input.external_package_version.as_deref());
    let owner_handle =
        normalize_optional_text(input.external_owner_handle.as_deref()).or_else(|| {
            normalize_optional_text(input.external_skill_id.as_deref())
                .and_then(|skill_id| skill_id.split('/').next().map(str::to_string))
        });
    let materialized = clawhub_api::materialize_package(&package_name, package_version.as_deref())?;

    let display_name = normalize_optional_text(input.display_name.as_deref())
        .or_else(|| skillssh_repo::read_skill_name_from_dir(&materialized.skill_dir))
        .unwrap_or_else(|| package_name.clone());
    let description = read_skill_description_from_dir(&materialized.skill_dir);
    let metadata_json = Some(
        json!({
            "marketSource": market_source,
            "packageName": package_name,
            "packageVersion": package_version,
            "ownerHandle": owner_handle,
            "source": normalize_optional_text(input.external_source.as_deref()),
            "skillId": normalize_optional_text(input.external_skill_id.as_deref()),
            "installs": input.external_installs,
        })
        .to_string(),
    );

    Ok(PreparedImport {
        display_name,
        description,
        source_root: materialized.skill_dir,
        source_seed: SkillSourceSeed {
            source_type: "skillssh".to_string(),
            source_label: build_source_label("skillssh"),
            source_ref: normalize_optional_text(input.external_source.as_deref()).and_then(
                |source| {
                    normalize_optional_text(input.external_skill_id.as_deref())
                        .map(|skill_id| format!("{}/{}", source, skill_id))
                },
            ),
            source_path: None,
            metadata_json,
        },
        cleanup_root: Some(materialized.temp_root),
    })
}

fn market_catalog_items() -> Vec<MarketCatalogItem> {
    vec![
        MarketCatalogItem {
            id: "release-readiness-gate".to_string(),
            name: "Release Readiness Gate".to_string(),
            summary: "围绕快照、生效版本、平台覆盖与发布说明建立发版前检查门。".to_string(),
            description: "适合需要在发布前做版本确认、平台承接检查和变更说明收口的团队。"
                .to_string(),
            category: "发布治理".to_string(),
            author: "Skill Studio Pro".to_string(),
            difficulty: "基础".to_string(),
            featured: true,
            accent_color: "#58a6ff".to_string(),
            tags: vec![
                "快照".to_string(),
                "发布".to_string(),
                "检查清单".to_string(),
                "平台治理".to_string(),
            ],
        },
        MarketCatalogItem {
            id: "team-handoff-kit".to_string(),
            name: "Team Handoff Kit".to_string(),
            summary: "把提交人、交付说明、合并决策和回流动作沉淀成统一交接模板。".to_string(),
            description: "适合把个人技能提交给组织库、需要规范交付说明和评审动作的场景。"
                .to_string(),
            category: "团队协作".to_string(),
            author: "Skill Studio Pro".to_string(),
            difficulty: "基础".to_string(),
            featured: true,
            accent_color: "#3fb950".to_string(),
            tags: vec![
                "团队".to_string(),
                "提交".to_string(),
                "交付".to_string(),
                "评审".to_string(),
            ],
        },
        MarketCatalogItem {
            id: "platform-rollout-captain".to_string(),
            name: "Platform Rollout Captain".to_string(),
            summary: "围绕多平台启用状态、目录检查和上线节奏建立发布编排模板。".to_string(),
            description: "适合要把技能同步到多个智能体平台，并明确每个平台启用与切换策略的团队。"
                .to_string(),
            category: "平台运维".to_string(),
            author: "Skill Studio Pro".to_string(),
            difficulty: "中级".to_string(),
            featured: false,
            accent_color: "#d29922".to_string(),
            tags: vec![
                "平台".to_string(),
                "多端发布".to_string(),
                "目录检测".to_string(),
                "同步策略".to_string(),
            ],
        },
        MarketCatalogItem {
            id: "market-brief-builder".to_string(),
            name: "Market Brief Builder".to_string(),
            summary: "用统一结构整理来源、受众、预期输出和上线标准，便于市场化沉淀。".to_string(),
            description: "适合要把一个技能整理成可复用资产并推向市场页、团队库或外部目录的场景。"
                .to_string(),
            category: "资产包装".to_string(),
            author: "Skill Studio Pro".to_string(),
            difficulty: "基础".to_string(),
            featured: false,
            accent_color: "#a371f7".to_string(),
            tags: vec![
                "市场".to_string(),
                "资产".to_string(),
                "说明书".to_string(),
                "包装".to_string(),
            ],
        },
    ]
}

fn market_catalog_files(item_id: &str) -> Option<Vec<(&'static str, &'static str)>> {
    match item_id {
        "release-readiness-gate" => Some(vec![
            (
                "skill.md",
                r#"# Release Readiness Gate

description: 在发布前确认快照、生效版本、平台覆盖和变更说明是否达到上线标准。

## 目标

帮助团队在发布技能之前，用一致的检查结构确认版本是否可以上线。

## 执行步骤

1. 确认当前生效版本是否正确。
2. 对比工作区与最新快照，判断是否仍有未沉淀改动。
3. 检查平台承接情况，确认哪些平台仍停留在旧版本。
4. 输出发布说明、风险项和回滚建议。
"#,
            ),
            (
                "README.md",
                r#"# Release Readiness Gate

围绕版本治理场景的基础技能模板，适合直接接入快照工作台与平台发布检查流。
"#,
            ),
            (
                "checklists/release-checklist.md",
                r#"# 发布检查清单

- 当前生效版本是否正确
- 最新快照说明是否完整
- 目标平台是否已启用
- 历史平台是否存在旧版本承接
- 本次上线风险和回滚方式是否明确
"#,
            ),
        ]),
        "team-handoff-kit" => Some(vec![
            (
                "skill.md",
                r#"# Team Handoff Kit

description: 统一提交说明、交付背景和评审关注点，帮助团队技能合并更可控。

## 使用方式

收到一个待交付快照后：

1. 先概括本次交付目标和影响范围。
2. 再说明需要团队重点评审的差异点。
3. 最后给出合并建议、回退条件和后续动作。
"#,
            ),
            (
                "handoff/template.md",
                r#"# 交付说明模板

## 本次目标

## 变更范围

## 团队重点关注

## 合并建议

## 风险与回退
"#,
            ),
            (
                "README.md",
                r#"# Team Handoff Kit

用于个人技能向团队库交付时的说明模板和评审骨架。
"#,
            ),
        ]),
        "platform-rollout-captain" => Some(vec![
            (
                "skill.md",
                r#"# Platform Rollout Captain

description: 针对多个智能体平台的启用状态、目录路径和发布顺序进行统一编排。

## 核心问题

当一个技能需要发布到多个平台时，最容易失控的是：

- 平台启用状态不一致
- 路径配置与真实目录偏离
- 新版本发布后忘记回看旧平台

## 输出要求

请输出：

1. 平台清单与启用状态
2. 目录检测结果
3. 建议发布顺序
4. 失败后的回滚动作
"#,
            ),
            (
                "playbooks/rollout.md",
                r#"# 发布编排剧本

1. 先检查平台中心配置是否完整。
2. 再确认目标快照是否已设为生效版本。
3. 分批发布到目标平台。
4. 记录失败平台和待补动作。
"#,
            ),
        ]),
        "market-brief-builder" => Some(vec![
            (
                "skill.md",
                r#"# Market Brief Builder

description: 把技能整理成可被市场、团队或外部目录理解的结构化资产说明。

## 输出结构

- 一句话价值说明
- 适用人群
- 典型场景
- 关键文件结构
- 使用限制
- 推荐发布渠道
"#,
            ),
            (
                "assets/brief-template.md",
                r#"# 资产说明模板

## 一句话价值

## 适用人群

## 典型场景

## 关键文件结构

## 使用限制

## 推荐发布渠道
"#,
            ),
        ]),
        _ => None,
    }
}

fn materialize_market_catalog_import(input: &ImportSkillInput) -> Result<PreparedImport, String> {
    let market_item_id = normalize_optional_text(input.market_item_id.as_deref())
        .ok_or_else(|| "市场导入缺少 marketItemId".to_string())?;
    let catalog_item = market_catalog_items()
        .into_iter()
        .find(|item| item.id == market_item_id)
        .ok_or_else(|| format!("市场条目不存在: {}", market_item_id))?;
    let files = market_catalog_files(&market_item_id)
        .ok_or_else(|| format!("市场模板不存在: {}", market_item_id))?;
    let temp_root = create_temp_import_root("market-catalog")?;

    fs::create_dir_all(&temp_root).map_err(|e| format!("创建市场模板目录失败: {}", e))?;
    for (relative_path, content) in files {
        write_market_file(&temp_root, relative_path, content)?;
    }

    let description = read_skill_description_from_dir(&temp_root);
    let metadata_json = Some(
        json!({
            "marketItemId": catalog_item.id,
            "category": catalog_item.category,
            "author": catalog_item.author,
            "difficulty": catalog_item.difficulty,
        })
        .to_string(),
    );

    Ok(PreparedImport {
        display_name: catalog_item.name.clone(),
        description,
        source_root: temp_root.clone(),
        source_seed: SkillSourceSeed {
            source_type: "market_catalog".to_string(),
            source_label: build_source_label("market_catalog"),
            source_ref: Some(catalog_item.id),
            source_path: None,
            metadata_json,
        },
        cleanup_root: Some(temp_root),
    })
}

fn prepare_import(input: &ImportSkillInput) -> Result<PreparedImport, String> {
    match input.source_type.trim() {
        "git_repository" => materialize_git_repository_import(input),
        "skillssh" => materialize_skillssh_import(input),
        "market_catalog" => materialize_market_catalog_import(input),
        _ => materialize_directory_import(input),
    }
}

pub(crate) fn replace_primary_skill_source(
    conn: &rusqlite::Connection,
    skill_id: &str,
    source_seed: &SkillSourceSeed,
) -> Result<(), String> {
    let now = now_ms();
    conn.execute(
        "UPDATE skill_sources
         SET is_primary = 0, updated_at = ?2
         WHERE skill_id = ?1 AND is_primary = 1",
        rusqlite::params![skill_id, now],
    )
    .map_err(|e| format!("更新主来源状态失败: {}", e))?;

    conn.execute(
        "INSERT INTO skill_sources (
            id,
            skill_id,
            source_type,
            source_label,
            source_ref,
            source_path,
            metadata_json,
            is_primary,
            created_at,
            updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, ?8, ?9)",
        rusqlite::params![
            Uuid::new_v4().to_string(),
            skill_id,
            source_seed.source_type.as_str(),
            source_seed.source_label.as_str(),
            source_seed.source_ref.as_deref(),
            source_seed.source_path.as_deref(),
            source_seed.metadata_json.as_deref(),
            now,
            now,
        ],
    )
    .map_err(|e| format!("写入 skill_sources 失败: {}", e))?;

    conn.execute(
        "UPDATE skills
         SET source_type = ?1, source_path = ?2
         WHERE id = ?3",
        rusqlite::params![
            source_seed.source_type.as_str(),
            source_seed.source_path.as_deref(),
            skill_id,
        ],
    )
    .map_err(|e| format!("同步 skills 来源投影失败: {}", e))?;

    Ok(())
}

fn insert_skill_import_log(
    conn: &rusqlite::Connection,
    log_seed: &ImportLogSeed,
    status: &str,
    target_skill: Option<&Skill>,
    detail_message: Option<&str>,
    error_message: Option<&str>,
    timestamp: i64,
) -> Result<SkillImportRecord, String> {
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO skill_import_logs (
            id,
            source_type,
            source_label,
            source_ref,
            source_path,
            request_payload_json,
            status,
            target_skill_id,
            target_skill_name,
            detail_message,
            error_message,
            created_at,
            updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        rusqlite::params![
            id,
            log_seed.source_type.as_str(),
            log_seed.source_label.as_str(),
            log_seed.source_ref.as_deref(),
            log_seed.source_path.as_deref(),
            log_seed.request_payload_json.as_deref(),
            status,
            target_skill.map(|skill| skill.id.as_str()),
            target_skill.map(|skill| skill.name.as_str()),
            detail_message,
            error_message,
            timestamp,
            timestamp,
        ],
    )
    .map_err(|e| format!("写入导入历史失败: {}", e))?;

    Ok(SkillImportRecord {
        id,
        source_type: log_seed.source_type.clone(),
        source_label: log_seed.source_label.clone(),
        source_ref: log_seed.source_ref.clone(),
        source_path: log_seed.source_path.clone(),
        request_payload_json: log_seed.request_payload_json.clone(),
        status: status.to_string(),
        target_skill_id: target_skill.map(|skill| skill.id.clone()),
        target_skill_name: target_skill.map(|skill| skill.name.clone()),
        detail_message: detail_message.map(str::to_string),
        error_message: error_message.map(str::to_string),
        created_at: timestamp,
        updated_at: timestamp,
    })
}

fn persist_import_log<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    log_seed: &ImportLogSeed,
    status: &str,
    target_skill: Option<&Skill>,
    detail_message: Option<&str>,
    error_message: Option<&str>,
) {
    let timestamp = now_ms();
    match get_conn(app).and_then(|conn| {
        insert_skill_import_log(
            &conn,
            log_seed,
            status,
            target_skill,
            detail_message,
            error_message,
            timestamp,
        )
        .map(|_| ())
    }) {
        Ok(()) => {}
        Err(error) => eprintln!("[import-log] {}", error),
    }
}

pub fn list_skill_import_records<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    limit: Option<i64>,
) -> Result<Vec<SkillImportRecord>, String> {
    let limit = limit.unwrap_or(24).clamp(1, 100);
    let conn = get_conn(app)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, source_type, source_label, source_ref, source_path, request_payload_json,
                    status, target_skill_id, target_skill_name, detail_message, error_message,
                    created_at, updated_at
             FROM skill_import_logs
             ORDER BY created_at DESC, id DESC
             LIMIT ?1",
        )
        .map_err(|e| format!("准备导入历史查询失败: {}", e))?;

    let records = stmt
        .query_map(rusqlite::params![limit], |row| {
            Ok(SkillImportRecord {
                id: row.get(0)?,
                source_type: row.get(1)?,
                source_label: row.get(2)?,
                source_ref: row.get(3)?,
                source_path: row.get(4)?,
                request_payload_json: row.get(5)?,
                status: row.get(6)?,
                target_skill_id: row.get(7)?,
                target_skill_name: row.get(8)?,
                detail_message: row.get(9)?,
                error_message: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })
        .map_err(|e| format!("查询导入历史失败: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("读取导入历史失败: {}", e))?;

    Ok(records)
}

pub fn list_market_catalog() -> Vec<MarketCatalogItem> {
    let mut items = market_catalog_items();
    items.sort_by(|left, right| {
        right
            .featured
            .cmp(&left.featured)
            .then_with(|| left.category.cmp(&right.category))
            .then_with(|| left.name.cmp(&right.name))
    });
    items
}

pub fn import_skill<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    input: &ImportSkillInput,
) -> Result<Skill, String> {
    let log_seed = build_import_log_seed(input);
    let prepared = match prepare_import(input) {
        Ok(prepared) => prepared,
        Err(error) => {
            persist_import_log(app, &log_seed, "failed", None, None, Some(&error));
            return Err(error);
        }
    };

    let result = (|| -> Result<Skill, String> {
        let name = prepared.display_name.trim();
        if name.is_empty() {
            return Err("skill 名称不能为空".to_string());
        }

        let slug = slugify(name);
        let now = now_ms();
        let id = Uuid::new_v4().to_string();
        let description = prepared.description.clone();
        let conn = get_conn(app)?;

        let exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM skills WHERE slug = ?1",
                rusqlite::params![slug],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|e| e.to_string())?
            > 0;

        if exists {
            return Err(format!("slug '{}' 已存在", slug));
        }

        conn.execute(
            "INSERT INTO skills (id, name, slug, description, source_type, source_path, created_at, updated_at, is_archived)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0)",
            rusqlite::params![
                id,
                name,
                slug,
                description.as_deref(),
                prepared.source_seed.source_type.as_str(),
                prepared.source_seed.source_path.as_deref(),
                now,
                now,
            ],
        )
        .map_err(|e| format!("插入 skill 失败: {}", e))?;

        replace_primary_skill_source(&conn, &id, &prepared.source_seed).map_err(|e| {
            let _ = conn.execute("DELETE FROM skills WHERE id = ?1", rusqlite::params![id]);
            e
        })?;

        let target = skill_dir(app, &slug);
        if target.exists() {
            fs::remove_dir_all(&target).map_err(|e| {
                let _ = conn.execute(
                    "DELETE FROM skill_sources WHERE skill_id = ?1",
                    rusqlite::params![id],
                );
                let _ = conn.execute("DELETE FROM skills WHERE id = ?1", rusqlite::params![id]);
                format!("清理目标目录失败: {}", e)
            })?;
        }

        copy_dir_recursive(&prepared.source_root, &target).map_err(|e| {
            let _ = conn.execute(
                "DELETE FROM skill_sources WHERE skill_id = ?1",
                rusqlite::params![id],
            );
            let _ = conn.execute("DELETE FROM skills WHERE id = ?1", rusqlite::params![id]);
            let _ = fs::remove_dir_all(&target);
            format!("复制文件夹失败: {}", e)
        })?;

        let skill = Skill {
            id: id.clone(),
            name: name.to_string(),
            slug: slug.clone(),
            description,
            source_type: prepared.source_seed.source_type.clone(),
            source_path: prepared.source_seed.source_path.clone(),
            created_at: now,
            updated_at: now,
            is_archived: false,
        };

        let baseline_input = crate::domain::CreateSnapshotInput {
            skill_id: id.clone(),
            change_summary: Some("初始导入".to_string()),
            source: "manual".to_string(),
        };
        if let Ok(baseline) = crate::snapshot::create_snapshot(app, &baseline_input) {
            let _ = crate::snapshot::set_active_snapshot(app, &baseline.id);
        }

        Ok(skill)
    })();

    match &result {
        Ok(skill) => {
            let detail_message =
                build_import_success_detail(prepared.source_seed.source_type.as_str(), &skill.name);
            persist_import_log(
                app,
                &ImportLogSeed {
                    source_type: prepared.source_seed.source_type.clone(),
                    source_label: prepared.source_seed.source_label.clone(),
                    source_ref: prepared.source_seed.source_ref.clone(),
                    source_path: prepared.source_seed.source_path.clone(),
                    request_payload_json: log_seed.request_payload_json.clone(),
                },
                "success",
                Some(skill),
                Some(detail_message.as_str()),
                None,
            );
        }
        Err(error) => {
            persist_import_log(
                app,
                &ImportLogSeed {
                    source_type: prepared.source_seed.source_type.clone(),
                    source_label: prepared.source_seed.source_label.clone(),
                    source_ref: prepared.source_seed.source_ref.clone(),
                    source_path: prepared.source_seed.source_path.clone(),
                    request_payload_json: log_seed.request_payload_json.clone(),
                },
                "failed",
                None,
                None,
                Some(error.as_str()),
            );
        }
    }

    if let Some(cleanup_root) = prepared.cleanup_root.as_ref() {
        let _ = fs::remove_dir_all(cleanup_root);
    }

    result
}
