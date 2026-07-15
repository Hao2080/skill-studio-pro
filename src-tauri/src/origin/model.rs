use serde::{Deserialize, Serialize};

pub const RESOLVER_VERSION: &str = "origin-v1";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SourceEvidence {
    pub id: String,
    pub instance_id: Option<String>,
    pub skill_id: Option<String>,
    pub evidence_type: String,
    pub evidence_key: String,
    pub evidence_value: Option<String>,
    pub source_candidate: Option<String>,
    pub weight: i32,
    pub is_conflict: bool,
    pub resolver_version: String,
    pub observed_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SourceResolution {
    pub id: String,
    pub instance_id: String,
    pub source_type: String,
    pub source_label: String,
    pub source_ref: Option<String>,
    pub confidence: i32,
    pub resolution_status: String,
    pub rationale: String,
    pub user_confirmed: bool,
    pub evidence_hash: String,
    pub resolved_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OriginConfirmInput {
    pub instance_id: String,
    pub source_type: String,
    pub source_label: String,
    pub source_ref: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OriginRecalculateInput {
    pub instance_id: String,
}

#[derive(Debug, Clone, Default)]
pub struct OriginFacts {
    pub git_remote: Option<String>,
    pub git_commit: Option<String>,
    pub plugin_manifest: Option<serde_json::Value>,
    pub manifest_hash: Option<String>,
    pub evidence: Vec<SourceEvidence>,
}
