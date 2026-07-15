use std::fs;
use std::path::{Path, PathBuf};

use serde_json::Value;
use uuid::Uuid;

use crate::domain::{ExternalMarketFacet, ExternalMarketSkill, ExternalMarketSkillDetail};
use crate::market::common;
use crate::workspace;

const SOURCE_KEY: &str = "clawhub";
const SOURCE_LABEL: &str = "ClawHub";

pub(crate) struct MaterializedClawhubPackage {
    pub(crate) temp_root: PathBuf,
    pub(crate) skill_dir: PathBuf,
}

pub fn fetch_items(limit: usize) -> Result<Vec<ExternalMarketSkill>, String> {
    let url = format!(
        "https://clawhub.ai/api/v1/packages?family=skill&limit={}",
        limit.clamp(1, 120)
    );
    let payload: Value = common::fetch_json(&url)?;
    Ok(read_items_array(&payload)
        .into_iter()
        .map(build_list_item)
        .collect())
}

pub fn search_items(query: &str, limit: usize) -> Result<Vec<ExternalMarketSkill>, String> {
    let normalized = query.trim();
    if normalized.is_empty() {
        return Ok(Vec::new());
    }

    let mut url = reqwest::Url::parse("https://clawhub.ai/api/v1/packages/search")
        .map_err(|error| format!("构造 ClawHub 搜索地址失败: {}", error))?;
    url.query_pairs_mut()
        .append_pair("q", normalized)
        .append_pair("family", "skill")
        .append_pair("limit", &limit.clamp(1, 120).to_string());
    let payload: Value = common::fetch_json(url.as_str())?;
    let items = payload
        .get("results")
        .and_then(Value::as_array)
        .map(|results| {
            results
                .iter()
                .filter_map(|item| item.get("package"))
                .map(build_list_item)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    Ok(items)
}

pub fn load_detail(
    package_name: &str,
    version: Option<&str>,
) -> Result<ExternalMarketSkillDetail, String> {
    let detail_url = format!("https://clawhub.ai/api/v1/packages/{}", package_name.trim());
    let payload: Value = common::fetch_json(&detail_url)?;
    let package = payload
        .get("package")
        .ok_or_else(|| "ClawHub 包详情缺少 package 字段".to_string())?;
    let owner = payload.get("owner").unwrap_or(&Value::Null);

    let resolved_version = version
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .or_else(|| {
            package
                .get("latestVersion")
                .and_then(Value::as_str)
                .map(str::to_string)
        });

    let version_payload = if let Some(version) = resolved_version.as_deref() {
        Some(common::fetch_json(&format!(
            "https://clawhub.ai/api/v1/packages/{}/versions/{}",
            package_name.trim(),
            version
        ))?)
    } else {
        None
    };

    let readme = resolved_version
        .as_deref()
        .and_then(|resolved_version| {
            load_package_file(package_name, Some(resolved_version), "README.md").ok()
        })
        .or_else(|| {
            resolved_version.as_deref().and_then(|resolved_version| {
                load_package_file(package_name, Some(resolved_version), "SKILL.md").ok()
            })
        });

    let owner_handle = package
        .get("ownerHandle")
        .and_then(Value::as_str)
        .map(str::to_string);
    let canonical_skill_id = owner_handle
        .as_deref()
        .map(|owner_handle| format!("{}/{}", owner_handle, package_name.trim()))
        .unwrap_or_else(|| package_name.trim().to_string());
    let owner_display = owner
        .get("displayName")
        .and_then(Value::as_str)
        .or_else(|| owner.get("handle").and_then(Value::as_str))
        .map(str::to_string)
        .or_else(|| owner_handle.clone());
    let package_summary = package
        .get("summary")
        .and_then(Value::as_str)
        .map(str::to_string);
    let package_version = resolved_version.clone();
    let documentation_excerpt = readme
        .as_deref()
        .map(|content| common::truncate_text(content, 900));
    let category = read_capability_tag(package).or_else(|| {
        version_payload
            .as_ref()
            .and_then(|payload: &Value| payload.pointer("/version/capabilities"))
            .map(|_| "General".to_string())
    });
    let verification = package
        .get("verification")
        .and_then(Value::as_object)
        .and_then(|verification| {
            verification
                .get("status")
                .and_then(Value::as_str)
                .map(str::to_string)
        });

    Ok(ExternalMarketSkillDetail {
        id: format!("{}:{}", SOURCE_KEY, package_name.trim()),
        market_source: SOURCE_KEY.to_string(),
        source: "openclaw/skills".to_string(),
        source_label: SOURCE_LABEL.to_string(),
        skill_id: canonical_skill_id,
        name: package
            .get("displayName")
            .and_then(Value::as_str)
            .unwrap_or(package_name)
            .to_string(),
        publisher: owner_display,
        repo_url: owner_handle
            .as_deref()
            .map(|owner_handle| format!("https://clawhub.ai/{}/{}", owner_handle, package_name))
            .or_else(|| Some("https://clawhub.ai/skills".to_string())),
        source_subpath: None,
        detail_url: owner_handle.as_deref().map(|owner_handle| {
            format!(
                "https://clawhub.ai/{}/{}",
                owner_handle,
                package_name.trim()
            )
        }),
        summary: package_summary,
        documentation_title: Some("README.md".to_string()),
        documentation_path: readme.as_ref().map(|_| "README.md".to_string()),
        documentation_excerpt,
        category: category.or_else(|| Some("General".to_string())),
        version: package_version.clone(),
        install_command: owner_handle.as_deref().map(|owner_handle| {
            format!("clawhub install {}/{}", owner_handle, package_name.trim())
        }),
        highlights: package
            .get("capabilityTags")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(Value::as_str)
                    .map(humanize_capability_tag)
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default(),
        use_cases: Vec::new(),
        requirements: package
            .get("capabilityTags")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(Value::as_str)
                    .filter(|value| value.starts_with("requires-") || value.starts_with("can-"))
                    .map(humanize_capability_tag)
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default(),
        security_signals: verification
            .into_iter()
            .map(|value| ExternalMarketFacet {
                label: "Verification".to_string(),
                value,
            })
            .collect(),
        package_name: Some(package_name.trim().to_string()),
        package_version,
        owner_handle,
    })
}

pub(crate) fn materialize_package(
    package_name: &str,
    version: Option<&str>,
) -> Result<MaterializedClawhubPackage, String> {
    let resolved_version = version
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .or_else(|| {
            common::fetch_json::<Value>(&format!(
                "https://clawhub.ai/api/v1/packages/{}",
                package_name.trim()
            ))
            .ok()
            .and_then(|payload| {
                payload
                    .pointer("/package/latestVersion")
                    .and_then(Value::as_str)
                    .map(str::to_string)
            })
        })
        .ok_or_else(|| "ClawHub 包缺少可用版本".to_string())?;
    let version_payload: Value = common::fetch_json(&format!(
        "https://clawhub.ai/api/v1/packages/{}/versions/{}",
        package_name.trim(),
        resolved_version
    ))?;
    let files = version_payload
        .pointer("/version/files")
        .and_then(Value::as_array)
        .ok_or_else(|| "ClawHub 包版本缺少文件列表".to_string())?;

    let temp_root = create_temp_root("clawhub")?;
    for file in files {
        let Some(path) = file.get("path").and_then(Value::as_str) else {
            continue;
        };

        let bytes = load_package_file_bytes(package_name, Some(&resolved_version), path)?;
        let target = temp_root.join(path);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("创建 ClawHub 包目录失败: {}", error))?;
        }
        fs::write(&target, bytes).map_err(|error| format!("写入 ClawHub 包文件失败: {}", error))?;
    }

    Ok(MaterializedClawhubPackage {
        temp_root: temp_root.clone(),
        skill_dir: temp_root,
    })
}

pub fn cleanup_temp_root(path: &Path) {
    let _ = fs::remove_dir_all(path);
}

fn build_list_item(item: &Value) -> ExternalMarketSkill {
    let name = item
        .get("displayName")
        .and_then(Value::as_str)
        .or_else(|| item.get("name").and_then(Value::as_str))
        .unwrap_or("Unnamed Skill")
        .to_string();
    let package_name = item
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let owner_handle = item
        .get("ownerHandle")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let canonical_skill_id = if owner_handle.is_empty() {
        package_name.clone()
    } else {
        format!("{}/{}", owner_handle, package_name)
    };
    let capability_tags = item
        .get("capabilityTags")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let primary_tag = capability_tags
        .first()
        .map(|value| humanize_capability_tag(value))
        .unwrap_or_else(|| "General".to_string());
    let channel = if item
        .get("isOfficial")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        "official".to_string()
    } else {
        item.get("channel")
            .and_then(Value::as_str)
            .unwrap_or("community")
            .to_string()
    };
    let executes_code = item
        .get("executesCode")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let latest_version = item
        .get("latestVersion")
        .and_then(Value::as_str)
        .map(str::to_string);
    let verification = item
        .get("verificationTier")
        .and_then(Value::as_str)
        .map(str::to_lowercase)
        .unwrap_or_else(|| {
            if channel == "official" {
                "official".to_string()
            } else {
                "reviewing".to_string()
            }
        });

    ExternalMarketSkill {
        id: format!("{}:openclaw/skills/{}", SOURCE_KEY, canonical_skill_id),
        market_source: SOURCE_KEY.to_string(),
        source_keys: vec![SOURCE_KEY.to_string()],
        name,
        summary: item
            .get("summary")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        source: "openclaw/skills".to_string(),
        source_label: SOURCE_LABEL.to_string(),
        skill_id: canonical_skill_id,
        publisher: owner_handle.clone(),
        repo_url: Some(format!(
            "https://clawhub.ai/{}/{}",
            owner_handle, package_name
        )),
        source_subpath: None,
        category: Some(primary_tag.clone()),
        accent_color: "#ff990a".to_string(),
        tags: capability_tags.clone(),
        installs: 0,
        featured: channel == "official",
        verification,
        risk: if executes_code { "medium" } else { "low" }.to_string(),
        facets: vec![
            ExternalMarketFacet {
                label: "Publisher".to_string(),
                value: if owner_handle.is_empty() {
                    "Unknown".to_string()
                } else {
                    owner_handle.clone()
                },
            },
            ExternalMarketFacet {
                label: "Channel".to_string(),
                value: humanize_capability_tag(&channel),
            },
            ExternalMarketFacet {
                label: "Capability".to_string(),
                value: primary_tag,
            },
        ],
        metrics: vec![
            ExternalMarketFacet {
                label: "Execution".to_string(),
                value: if executes_code {
                    "Executes Code".to_string()
                } else {
                    "No Code Execution".to_string()
                },
            },
            ExternalMarketFacet {
                label: "Version".to_string(),
                value: latest_version.clone().unwrap_or_else(|| "-".to_string()),
            },
            ExternalMarketFacet {
                label: "Updated".to_string(),
                value: item
                    .get("updatedAt")
                    .and_then(Value::as_i64)
                    .map(|timestamp| timestamp.to_string())
                    .unwrap_or_else(|| "-".to_string()),
            },
        ],
        detail_url: Some(format!(
            "https://clawhub.ai/{}/{}",
            owner_handle, package_name
        )),
        package_name: Some(package_name.clone()),
        package_version: latest_version,
        owner_handle: Some(owner_handle),
        updated_at: item.get("updatedAt").and_then(Value::as_i64),
    }
}

fn read_items_array(payload: &Value) -> Vec<&Value> {
    payload
        .get("items")
        .and_then(Value::as_array)
        .map(|items| items.iter().collect::<Vec<_>>())
        .unwrap_or_default()
}

fn read_capability_tag(package: &Value) -> Option<String> {
    package
        .get("capabilityTags")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .and_then(Value::as_str)
        .map(humanize_capability_tag)
}

fn humanize_capability_tag(value: &str) -> String {
    value
        .split('-')
        .filter(|part| !part.is_empty())
        .map(|part| {
            let mut chars = part.chars();
            match chars.next() {
                Some(first) => format!("{}{}", first.to_uppercase(), chars.as_str()),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn load_package_file(
    package_name: &str,
    version: Option<&str>,
    path: &str,
) -> Result<String, String> {
    let mut url = reqwest::Url::parse(&format!(
        "https://clawhub.ai/api/v1/packages/{}/file",
        package_name.trim()
    ))
    .map_err(|error| format!("构造 ClawHub 文件地址失败: {}", error))?;
    url.query_pairs_mut().append_pair("path", path);
    if let Some(version) = version.map(str::trim).filter(|value| !value.is_empty()) {
        url.query_pairs_mut().append_pair("version", version);
    }

    common::fetch_text(url.as_str()).map_err(|error| format!("读取 ClawHub 文档失败: {}", error))
}

fn load_package_file_bytes(
    package_name: &str,
    version: Option<&str>,
    path: &str,
) -> Result<Vec<u8>, String> {
    let mut url = reqwest::Url::parse(&format!(
        "https://clawhub.ai/api/v1/packages/{}/file",
        package_name.trim()
    ))
    .map_err(|error| format!("构造 ClawHub 文件地址失败: {}", error))?;
    url.query_pairs_mut().append_pair("path", path);
    if let Some(version) = version.map(str::trim).filter(|value| !value.is_empty()) {
        url.query_pairs_mut().append_pair("version", version);
    }

    common::build_http_client()?
        .get(url)
        .send()
        .and_then(reqwest::blocking::Response::error_for_status)
        .map_err(|error| format!("下载 ClawHub 包文件失败: {}", error))?
        .bytes()
        .map(|bytes| bytes.to_vec())
        .map_err(|error| format!("读取 ClawHub 包文件失败: {}", error))
}

fn create_temp_root(prefix: &str) -> Result<PathBuf, String> {
    let root = workspace::temp_imports_root()?.join(format!("{}-{}", prefix, Uuid::new_v4()));

    if let Some(parent) = root.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建临时导入目录失败: {}", error))?;
    }

    Ok(root)
}
