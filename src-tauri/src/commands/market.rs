use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use crate::{
    domain::{ExternalMarketSkill, ExternalMarketSkillDetail, MarketCatalogItem},
    market::{
        category, clawhub_api, clawskills_api, officialskills_api, skillssh_api, skillssh_repo,
    },
    store,
};

const MARKET_CACHE_TTL_MS: i64 = 5 * 60 * 1000;

#[derive(Clone)]
struct MarketCacheEntry {
    fetched_at: i64,
    items: Vec<ExternalMarketSkill>,
}

#[derive(Clone)]
struct MarketDetailCacheEntry {
    fetched_at: i64,
    detail: ExternalMarketSkillDetail,
}

fn market_cache() -> &'static Mutex<HashMap<String, MarketCacheEntry>> {
    static MARKET_CACHE: OnceLock<Mutex<HashMap<String, MarketCacheEntry>>> = OnceLock::new();
    MARKET_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn market_detail_cache() -> &'static Mutex<HashMap<String, MarketDetailCacheEntry>> {
    static MARKET_DETAIL_CACHE: OnceLock<Mutex<HashMap<String, MarketDetailCacheEntry>>> =
        OnceLock::new();
    MARKET_DETAIL_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

fn normalize_market_source_key(value: Option<&str>) -> String {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("all")
        .to_lowercase()
}

fn source_priority(source_key: &str) -> usize {
    match source_key {
        "officialskills" => 4,
        "clawskills" => 3,
        "clawhub" => 2,
        "skillssh" => 1,
        _ => 0,
    }
}

fn read_cached_items(cache_key: &str) -> Result<Option<Vec<ExternalMarketSkill>>, String> {
    let cache = market_cache()
        .lock()
        .map_err(|_| "市场缓存锁获取失败".to_string())?;
    Ok(cache.get(cache_key).and_then(|entry| {
        if now_ms() - entry.fetched_at <= MARKET_CACHE_TTL_MS {
            Some(entry.items.clone())
        } else {
            None
        }
    }))
}

fn read_stale_cached_items(cache_key: &str) -> Result<Option<Vec<ExternalMarketSkill>>, String> {
    let cache = market_cache()
        .lock()
        .map_err(|_| "市场缓存锁获取失败".to_string())?;
    Ok(cache.get(cache_key).map(|entry| entry.items.clone()))
}

fn write_cached_items(cache_key: String, items: Vec<ExternalMarketSkill>) -> Result<(), String> {
    let mut cache = market_cache()
        .lock()
        .map_err(|_| "市场缓存锁获取失败".to_string())?;
    cache.insert(
        cache_key,
        MarketCacheEntry {
            fetched_at: now_ms(),
            items,
        },
    );
    Ok(())
}

fn read_cached_detail(cache_key: &str) -> Result<Option<ExternalMarketSkillDetail>, String> {
    let cache = market_detail_cache()
        .lock()
        .map_err(|_| "市场详情缓存锁获取失败".to_string())?;
    Ok(cache.get(cache_key).and_then(|entry| {
        if now_ms() - entry.fetched_at <= MARKET_CACHE_TTL_MS {
            Some(entry.detail.clone())
        } else {
            None
        }
    }))
}

fn read_stale_cached_detail(cache_key: &str) -> Result<Option<ExternalMarketSkillDetail>, String> {
    let cache = market_detail_cache()
        .lock()
        .map_err(|_| "市场详情缓存锁获取失败".to_string())?;
    Ok(cache.get(cache_key).map(|entry| entry.detail.clone()))
}

fn write_cached_detail(cache_key: String, detail: ExternalMarketSkillDetail) -> Result<(), String> {
    let mut cache = market_detail_cache()
        .lock()
        .map_err(|_| "市场详情缓存锁获取失败".to_string())?;
    cache.insert(
        cache_key,
        MarketDetailCacheEntry {
            fetched_at: now_ms(),
            detail,
        },
    );
    Ok(())
}

#[tauri::command]
pub fn market_catalog_list() -> Result<Vec<MarketCatalogItem>, String> {
    Ok(store::list_market_catalog())
}

#[tauri::command]
pub async fn market_external_list(
    source_key: Option<String>,
    board: Option<String>,
) -> Result<Vec<ExternalMarketSkill>, String> {
    let source_key = normalize_market_source_key(source_key.as_deref());
    let board = board
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("alltime")
        .to_string();
    let cache_key = format!("external-list:{}:{}", source_key, board);

    if let Some(items) = read_cached_items(&cache_key)? {
        return Ok(items);
    }

    let items = match tauri::async_runtime::spawn_blocking(move || {
        load_market_source_items(&source_key, &board)
    })
    .await
    .map_err(|error| format!("市场榜单任务执行失败: {}", error))?
    {
        Ok(items) => items,
        Err(error) => {
            if let Some(stale) = read_stale_cached_items(&cache_key)? {
                return Ok(stale);
            }
            return Err(error);
        }
    };
    write_cached_items(cache_key, items.clone())?;
    Ok(items)
}

#[tauri::command]
pub async fn market_external_search(
    source_key: Option<String>,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<ExternalMarketSkill>, String> {
    let trimmed_query = query.trim();
    if trimmed_query.is_empty() {
        return Ok(Vec::new());
    }

    let limit = limit.unwrap_or(60).clamp(1, 100);
    let source_key = normalize_market_source_key(source_key.as_deref());
    let cache_key = format!(
        "external-search:{}:{}:{}",
        source_key,
        trimmed_query.to_lowercase(),
        limit
    );

    if let Some(items) = read_cached_items(&cache_key)? {
        return Ok(items);
    }

    let owned_query = trimmed_query.to_string();
    let items = match tauri::async_runtime::spawn_blocking(move || {
        search_market_source_items(&source_key, &owned_query, limit)
    })
    .await
    .map_err(|error| format!("市场搜索任务执行失败: {}", error))?
    {
        Ok(items) => items,
        Err(error) => {
            if let Some(stale) = read_stale_cached_items(&cache_key)? {
                return Ok(stale);
            }
            return Err(error);
        }
    };
    write_cached_items(cache_key, items.clone())?;
    Ok(items)
}

#[tauri::command]
pub async fn market_external_detail(
    market_source: String,
    source: String,
    skill_id: String,
    package_name: Option<String>,
    package_version: Option<String>,
) -> Result<ExternalMarketSkillDetail, String> {
    super::validate_required_id("marketSource", &market_source)?;
    super::validate_required_id("source", &source)?;
    super::validate_required_id("skillId", &skill_id)?;

    let normalized_market_source = market_source.trim().to_lowercase();
    let normalized_source = source.trim().to_string();
    let normalized_skill_id = skill_id.trim().to_string();
    let normalized_package_name = package_name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    let normalized_package_version = package_version
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    let cache_key = format!(
        "external-detail:{}/{}/{}:{}",
        normalized_market_source,
        normalized_source,
        normalized_skill_id,
        normalized_package_version.clone().unwrap_or_default()
    );

    if let Some(detail) = read_cached_detail(&cache_key)? {
        return Ok(detail);
    }

    let detail = match tauri::async_runtime::spawn_blocking(move || {
        load_market_source_detail(
            &normalized_market_source,
            &normalized_source,
            &normalized_skill_id,
            normalized_package_name.as_deref(),
            normalized_package_version.as_deref(),
        )
    })
    .await
    .map_err(|error| format!("外部市场详情任务执行失败: {}", error))?
    {
        Ok(detail) => detail,
        Err(error) => {
            if let Some(stale) = read_stale_cached_detail(&cache_key)? {
                return Ok(stale);
            }
            return Err(error);
        }
    };

    write_cached_detail(cache_key, detail.clone())?;
    Ok(detail)
}

fn load_market_source_items(
    source_key: &str,
    board: &str,
) -> Result<Vec<ExternalMarketSkill>, String> {
    match source_key {
        "skillssh" => {
            let board_type = skillssh_api::LeaderboardType::from_str(board);
            let raw_items = skillssh_api::fetch_leaderboard(board_type)?;
            Ok(category::build_external_market_items(&raw_items))
        }
        "officialskills" => officialskills_api::fetch_items(),
        "clawskills" => clawskills_api::fetch_items(),
        "clawhub" => clawhub_api::fetch_items(60),
        "all" => aggregate_market_items(vec![
            load_market_source_items("skillssh", board)?,
            officialskills_api::fetch_items_fast()?,
            load_market_source_items("clawskills", board)?,
            load_market_source_items("clawhub", board)?,
        ]),
        _ => Err(format!("不支持的市场来源: {}", source_key)),
    }
}

fn search_market_source_items(
    source_key: &str,
    query: &str,
    limit: usize,
) -> Result<Vec<ExternalMarketSkill>, String> {
    match source_key {
        "skillssh" => {
            let raw_items = skillssh_api::search_skills(query, limit)?;
            Ok(category::build_external_market_items(&raw_items))
        }
        "officialskills" => officialskills_api::search_items(query, limit),
        "clawskills" => clawskills_api::search_items(query, limit),
        "clawhub" => clawhub_api::search_items(query, limit),
        "all" => aggregate_market_items(vec![
            search_market_source_items("skillssh", query, limit)?,
            search_market_source_items("officialskills", query, limit)?,
            search_market_source_items("clawskills", query, limit)?,
            search_market_source_items("clawhub", query, limit)?,
        ]),
        _ => Err(format!("不支持的市场来源: {}", source_key)),
    }
}

fn aggregate_market_items(
    source_groups: Vec<Vec<ExternalMarketSkill>>,
) -> Result<Vec<ExternalMarketSkill>, String> {
    let mut grouped: HashMap<String, Vec<ExternalMarketSkill>> = HashMap::new();
    for item in source_groups.into_iter().flatten() {
        let canonical_ref = format!("{}/{}", item.source, item.skill_id);
        grouped.entry(canonical_ref).or_default().push(item);
    }

    let mut results = grouped
        .into_values()
        .filter(|items| !items.is_empty())
        .map(|items| {
            let mut ordered = items;
            ordered.sort_by(|left, right| {
                source_priority(right.market_source.as_str())
                    .cmp(&source_priority(left.market_source.as_str()))
                    .then_with(|| right.featured.cmp(&left.featured))
                    .then_with(|| right.installs.cmp(&left.installs))
            });

            let primary = ordered[0].clone();
            let mut merged = primary.clone();
            let mut source_keys = ordered
                .iter()
                .map(|item| item.market_source.clone())
                .collect::<Vec<_>>();
            source_keys.sort_by_key(|value| std::cmp::Reverse(source_priority(value)));
            source_keys.dedup();

            merged.id = format!("all:{}/{}", primary.source, primary.skill_id);
            merged.source_keys = source_keys;
            merged.tags = ordered
                .iter()
                .flat_map(|item| item.tags.iter().cloned())
                .collect::<Vec<_>>();
            merged.tags.sort();
            merged.tags.dedup();
            merged.featured = ordered.iter().any(|item| item.featured);
            merged.installs = ordered.iter().map(|item| item.installs).max().unwrap_or(0);
            merged
        })
        .collect::<Vec<_>>();

    results.sort_by(|left, right| {
        right
            .featured
            .cmp(&left.featured)
            .then_with(|| right.installs.cmp(&left.installs))
            .then_with(|| left.name.cmp(&right.name))
    });
    Ok(results)
}

fn load_market_source_detail(
    market_source: &str,
    source: &str,
    skill_id: &str,
    package_name: Option<&str>,
    package_version: Option<&str>,
) -> Result<ExternalMarketSkillDetail, String> {
    match market_source {
        "skillssh" => skillssh_repo::load_github_skill_detail(
            "skillssh",
            "skills.sh",
            Some(source.split('/').next().unwrap_or(source).to_string()),
            None,
            source,
            skill_id,
        ),
        "officialskills" => officialskills_api::load_detail(source, skill_id),
        "clawskills" => clawskills_api::load_detail(skill_id),
        "clawhub" => clawhub_api::load_detail(package_name.unwrap_or(skill_id), package_version),
        _ => Err(format!("不支持的市场详情来源: {}", market_source)),
    }
}
