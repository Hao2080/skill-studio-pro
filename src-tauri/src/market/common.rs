use chrono::DateTime;
use regex::Regex;
use serde::de::DeserializeOwned;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

const HTTP_CACHE_TTL_MS: i64 = 10 * 60 * 1000;

#[derive(Clone)]
struct HttpTextCacheEntry {
    fetched_at: i64,
    value: String,
}

fn http_text_cache() -> &'static Mutex<HashMap<String, HttpTextCacheEntry>> {
    static HTTP_TEXT_CACHE: OnceLock<Mutex<HashMap<String, HttpTextCacheEntry>>> = OnceLock::new();
    HTTP_TEXT_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

fn read_cached_text(url: &str, allow_stale: bool) -> Result<Option<String>, String> {
    let cache = http_text_cache()
        .lock()
        .map_err(|_| "远端文本缓存锁获取失败".to_string())?;
    Ok(cache.get(url).and_then(|entry| {
        if allow_stale || now_ms() - entry.fetched_at <= HTTP_CACHE_TTL_MS {
            Some(entry.value.clone())
        } else {
            None
        }
    }))
}

fn write_cached_text(url: &str, value: &str) -> Result<(), String> {
    let mut cache = http_text_cache()
        .lock()
        .map_err(|_| "远端文本缓存锁获取失败".to_string())?;
    cache.insert(
        url.to_string(),
        HttpTextCacheEntry {
            fetched_at: now_ms(),
            value: value.to_string(),
        },
    );
    Ok(())
}

pub fn build_http_client() -> Result<reqwest::blocking::Client, String> {
    static HTTP_CLIENT: OnceLock<Result<reqwest::blocking::Client, String>> = OnceLock::new();
    HTTP_CLIENT
        .get_or_init(|| {
            reqwest::blocking::Client::builder()
                .user_agent("skill-studio-pro")
                .timeout(std::time::Duration::from_secs(20))
                .build()
                .map_err(|error| format!("创建网络客户端失败: {}", error))
        })
        .clone()
}

pub fn fetch_text(url: &str) -> Result<String, String> {
    if let Some(cached) = read_cached_text(url, false)? {
        return Ok(cached);
    }

    let fetched = build_http_client()?
        .get(url)
        .send()
        .and_then(reqwest::blocking::Response::error_for_status)
        .map_err(|error| format!("获取远端页面失败: {}", error))?
        .text()
        .map_err(|error| format!("读取远端页面失败: {}", error));

    match fetched {
        Ok(text) => {
            write_cached_text(url, &text)?;
            Ok(text)
        }
        Err(error) => read_cached_text(url, true)?.ok_or(error),
    }
}

pub fn fetch_json<T: DeserializeOwned>(url: &str) -> Result<T, String> {
    let text = fetch_text(url)?;
    serde_json::from_str(&text).map_err(|error| format!("解析远端 JSON 失败: {}", error))
}

pub fn clean_html_text(value: &str) -> String {
    let without_comments = value.replace("<!-- -->", "");
    let without_tags = Regex::new(r"<[^>]+>")
        .ok()
        .map(|pattern| pattern.replace_all(&without_comments, " ").to_string())
        .unwrap_or(without_comments);

    decode_html_entities(&without_tags)
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string()
}

pub fn decode_html_entities(value: &str) -> String {
    value
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#x27;", "'")
        .replace("&#39;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&nbsp;", " ")
        .replace("&#x2F;", "/")
}

pub fn parse_abbreviated_number(value: &str) -> u64 {
    let normalized = clean_html_text(value).to_lowercase().replace(',', "");
    if normalized.is_empty() {
        return 0;
    }

    let multiplier = if normalized.ends_with('k') {
        1_000_f64
    } else if normalized.ends_with('m') {
        1_000_000_f64
    } else {
        1_f64
    };

    let numeric = normalized.trim_end_matches(['k', 'm']);
    numeric
        .parse::<f64>()
        .ok()
        .map(|parsed| (parsed * multiplier).round() as u64)
        .unwrap_or(0)
}

pub fn parse_iso_timestamp_ms(value: &str) -> Option<i64> {
    DateTime::parse_from_rfc3339(value)
        .ok()
        .map(|timestamp| timestamp.timestamp_millis())
}

pub fn truncate_text(value: &str, max_chars: usize) -> String {
    let normalized = value.trim();
    if normalized.chars().count() <= max_chars {
        return normalized.to_string();
    }

    let truncated: String = normalized.chars().take(max_chars).collect();
    format!("{}…", truncated.trim_end())
}

pub fn format_rank_band(rank: u64) -> String {
    match rank {
        0 => "Unranked".to_string(),
        1..=50 => "Top 50".to_string(),
        51..=200 => "Top 200".to_string(),
        201..=500 => "201-500".to_string(),
        _ => "500+".to_string(),
    }
}
