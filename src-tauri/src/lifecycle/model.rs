use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LifecycleFaultPoint {
    AfterSourceStaged,
    AfterCentralReplace,
    BeforeDatabaseCommit,
    BeforeAtomicEditReplace,
    AfterTrashMove,
    AfterRestoreMove,
    AfterPurgeMove,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ImportSourceType {
    LocalDirectory,
    GitRepository,
    ZipArchive,
    Marketplace,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPlanInput {
    pub source_type: ImportSourceType,
    pub local_path: Option<String>,
    pub git_url: Option<String>,
    pub zip_path: Option<String>,
    pub repo_subdir: Option<String>,
    pub branch: Option<String>,
    pub git_ref: Option<String>,
    pub commit: Option<String>,
    pub market_source: Option<String>,
    #[serde(default)]
    pub target_agents: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ImportProvenance {
    pub source_type: ImportSourceType,
    pub source_label: String,
    pub source_ref: Option<String>,
    pub source_path: Option<String>,
    pub repo_subdir: Option<String>,
    pub branch: Option<String>,
    pub git_ref: Option<String>,
    pub commit: Option<String>,
    pub market_source: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InstallConflict {
    pub conflict_type: String,
    pub existing_skill_id: String,
    pub existing_name: String,
    pub existing_slug: String,
    pub existing_content_hash: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InstallCandidate {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub relative_path: String,
    pub content_hash: String,
    pub file_count: u64,
    pub total_bytes: u64,
    pub scripts: Vec<String>,
    pub risk_flags: Vec<String>,
    pub conflicts: Vec<InstallConflict>,
    pub target_agents: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InstallPlan {
    pub id: String,
    pub provenance: ImportProvenance,
    pub staging_path: String,
    pub source_hash: String,
    pub candidates: Vec<InstallCandidate>,
    pub plan_hash: String,
    pub created_at: i64,
    pub expires_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ImportConflictAction {
    Install,
    Rename,
    Update,
    Cancel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSelection {
    pub candidate_id: String,
    pub action: ImportConflictAction,
    pub target_name: Option<String>,
    pub existing_skill_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportExecuteInput {
    pub plan_id: String,
    pub plan_hash: String,
    #[serde(default)]
    pub selections: Vec<ImportSelection>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ImportedSkillResult {
    pub candidate_id: String,
    pub skill_id: String,
    pub name: String,
    pub slug: String,
    pub snapshot_id: String,
    pub content_hash: String,
    pub action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub plan_id: String,
    pub status: String,
    pub imported: Vec<ImportedSkillResult>,
    pub publish_deferred: bool,
    pub requested_target_agents: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveTextFileInput {
    pub skill_id: String,
    pub relative_path: String,
    pub content: String,
    pub edit_session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SaveTextFileResult {
    pub skill_id: String,
    pub relative_path: String,
    pub before_hash: Option<String>,
    pub after_hash: String,
    pub recovery_snapshot_id: String,
    pub recovery_point_created: bool,
    pub outdated_mapping_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct OperationListInput {
    pub operation_type: Option<String>,
    pub entity_id: Option<String>,
    pub status: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OperationLog {
    pub id: String,
    pub operation_type: String,
    pub entity_type: String,
    pub entity_id: Option<String>,
    pub target_label: String,
    pub plan_json: Option<String>,
    pub before_hash: Option<String>,
    pub after_hash: Option<String>,
    pub snapshot_id: Option<String>,
    pub status: String,
    pub error_code: Option<String>,
    pub error_summary: Option<String>,
    pub created_at: i64,
    pub completed_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MappingImpact {
    pub platform_name: String,
    pub target_path: String,
    pub sync_mode: String,
    pub snapshot_id: String,
    pub drift_status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeletePlan {
    pub id: String,
    pub skill_id: String,
    pub display_name: String,
    pub original_path: String,
    pub source_hash: String,
    pub file_count: u64,
    pub total_bytes: u64,
    pub mappings: Vec<MappingImpact>,
    pub sources_json: String,
    pub plan_hash: String,
    pub created_at: i64,
    pub expires_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteExecuteInput {
    pub plan_id: String,
    pub plan_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TrashEntry {
    pub id: String,
    pub entity_type: String,
    pub entity_id: String,
    pub display_name: String,
    pub original_path: String,
    pub trash_path: String,
    pub manifest_path: String,
    pub related_state_json: String,
    pub content_hash: String,
    pub status: String,
    pub deleted_at: i64,
    pub restored_at: Option<i64>,
    pub permanently_deleted_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RestoreMode {
    Original,
    NewName,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestorePlanInput {
    pub trash_entry_id: String,
    pub mode: RestoreMode,
    pub new_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RestorePlan {
    pub id: String,
    pub trash_entry_id: String,
    pub skill_id: String,
    pub display_name: String,
    pub target_name: String,
    pub target_slug: String,
    pub target_path: String,
    pub source_hash: String,
    pub conflict: Option<String>,
    pub mappings_will_be_republished: bool,
    pub plan_hash: String,
    pub created_at: i64,
    pub expires_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreExecuteInput {
    pub plan_id: String,
    pub plan_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PurgeConfirmation {
    pub trash_entry_id: String,
    pub confirmation_token: String,
    pub expires_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PurgeExecuteInput {
    pub trash_entry_id: String,
    pub confirmation_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StagingJournal {
    pub id: String,
    pub operation_type: String,
    pub phase: String,
    pub source_path: Option<String>,
    pub target_path: Option<String>,
    pub backup_path: Option<String>,
    pub staging_path: Option<String>,
    pub entity_id: Option<String>,
    pub expected_hash: Option<String>,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryReport {
    pub recovered: Vec<String>,
    pub cleaned: Vec<String>,
    pub errors: Vec<String>,
}
