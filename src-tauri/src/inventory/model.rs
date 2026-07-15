use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScanRoot {
    pub id: String,
    pub root_type: String,
    pub platform_name: Option<String>,
    pub path: String,
    pub normalized_path: String,
    pub enabled: bool,
    pub recursive: bool,
    pub watch_enabled: bool,
    pub ignore_rules: Vec<String>,
    pub last_scan_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
    pub available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanRootUpsertInput {
    pub id: Option<String>,
    pub root_type: String,
    pub platform_name: Option<String>,
    pub path: String,
    pub enabled: Option<bool>,
    pub recursive: Option<bool>,
    pub watch_enabled: Option<bool>,
    #[serde(default)]
    pub ignore_rules: Vec<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum ScanMode {
    #[default]
    Incremental,
    Full,
}

impl ScanMode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Incremental => "incremental",
            Self::Full => "full",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ScanStartInput {
    #[serde(default)]
    pub mode: ScanMode,
    #[serde(default)]
    pub root_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanRun {
    pub id: String,
    pub mode: String,
    pub status: String,
    pub roots_total: i64,
    pub roots_completed: i64,
    pub candidates_seen: i64,
    pub instances_changed: i64,
    pub error_count: i64,
    pub started_at: i64,
    pub completed_at: Option<i64>,
    pub cancelled_at: Option<i64>,
    pub error_summary: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanCancelInput {
    pub run_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgressEvent {
    pub run_id: String,
    pub status: String,
    pub roots_total: i64,
    pub roots_completed: i64,
    pub candidates_seen: i64,
    pub instances_changed: i64,
    pub error_count: i64,
    pub current_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InstancesChangedEvent {
    pub run_id: String,
    pub instance_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SkillInstanceFile {
    pub relative_path: String,
    pub file_type: String,
    pub size_bytes: i64,
    pub modified_at: Option<i64>,
    pub content_hash: Option<String>,
    pub risk_flags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SkillInstance {
    pub id: String,
    pub central_skill_id: Option<String>,
    pub scan_root_id: Option<String>,
    pub platform_name: Option<String>,
    pub scope_type: String,
    pub absolute_path: String,
    pub normalized_path: String,
    pub folder_name: String,
    pub parsed_name: Option<String>,
    pub canonical_name: String,
    pub description: Option<String>,
    pub short_description: Option<String>,
    pub metadata: serde_json::Value,
    pub headings: Vec<String>,
    pub content_hash: String,
    pub skill_md_hash: String,
    pub manifest_hash: Option<String>,
    pub file_count: i64,
    pub has_scripts: bool,
    pub has_executables: bool,
    pub risk_flags: Vec<String>,
    pub duplicate_kinds: Vec<String>,
    pub parse_status: String,
    pub parse_error: Option<String>,
    pub parse_warnings: Vec<String>,
    pub git_remote: Option<String>,
    pub git_commit: Option<String>,
    pub plugin_manifest: Option<serde_json::Value>,
    pub first_seen_at: i64,
    pub last_seen_at: i64,
    pub last_modified_at: Option<i64>,
    pub missing_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillInstanceDetail {
    pub instance: SkillInstance,
    pub files: Vec<SkillInstanceFile>,
    pub resolution: Option<crate::origin::model::SourceResolution>,
    pub evidence: Vec<crate::origin::model::SourceEvidence>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct InstanceListInput {
    pub search: Option<String>,
    pub platform_name: Option<String>,
    pub parse_status: Option<String>,
    pub duplicate_kind: Option<String>,
    pub include_missing: Option<bool>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstanceListResult {
    pub items: Vec<SkillInstance>,
    pub total: i64,
    pub resolutions: BTreeMap<String, crate::origin::model::SourceResolution>,
}

#[derive(Debug, Clone)]
pub struct ParsedSkillMetadata {
    pub name: Option<String>,
    pub description: Option<String>,
    pub short_description: Option<String>,
    pub metadata: serde_json::Value,
    pub headings: Vec<String>,
    pub encoding: String,
    pub warnings: Vec<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone)]
pub struct IndexedSkill {
    pub absolute_path: String,
    pub normalized_path: String,
    pub folder_name: String,
    pub parsed: ParsedSkillMetadata,
    pub canonical_name: String,
    pub content_hash: String,
    pub skill_md_hash: String,
    pub manifest_hash: Option<String>,
    pub scan_signature: String,
    pub files: Vec<SkillInstanceFile>,
    pub has_scripts: bool,
    pub has_executables: bool,
    pub risk_flags: Vec<String>,
    pub last_modified_at: Option<i64>,
    pub git_remote: Option<String>,
    pub git_commit: Option<String>,
    pub plugin_manifest: Option<serde_json::Value>,
}
