use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ─── Skill ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Skill {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub source_type: String,
    pub source_path: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub is_archived: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillSource {
    pub id: String,
    pub skill_id: String,
    pub source_type: String,
    pub source_label: String,
    pub source_ref: Option<String>,
    pub source_path: Option<String>,
    pub metadata_json: Option<String>,
    pub is_primary: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillImportRecord {
    pub id: String,
    pub source_type: String,
    pub source_label: String,
    pub source_ref: Option<String>,
    pub source_path: Option<String>,
    pub request_payload_json: Option<String>,
    pub status: String,
    pub target_skill_id: Option<String>,
    pub target_skill_name: Option<String>,
    pub detail_message: Option<String>,
    pub error_message: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketCatalogItem {
    pub id: String,
    pub name: String,
    pub summary: String,
    pub description: String,
    pub category: String,
    pub author: String,
    pub difficulty: String,
    pub featured: bool,
    pub accent_color: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalMarketFacet {
    pub label: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalMarketSkill {
    pub id: String,
    pub market_source: String,
    #[serde(default)]
    pub source_keys: Vec<String>,
    pub name: String,
    pub summary: String,
    pub source: String,
    pub source_label: String,
    pub skill_id: String,
    pub publisher: String,
    pub repo_url: Option<String>,
    pub source_subpath: Option<String>,
    pub category: Option<String>,
    pub accent_color: String,
    pub tags: Vec<String>,
    pub installs: u64,
    pub featured: bool,
    pub verification: String,
    pub risk: String,
    #[serde(default)]
    pub facets: Vec<ExternalMarketFacet>,
    #[serde(default)]
    pub metrics: Vec<ExternalMarketFacet>,
    pub detail_url: Option<String>,
    pub package_name: Option<String>,
    pub package_version: Option<String>,
    pub owner_handle: Option<String>,
    pub updated_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalMarketSkillDetail {
    pub id: String,
    pub market_source: String,
    pub source: String,
    pub source_label: String,
    pub skill_id: String,
    pub name: String,
    pub publisher: Option<String>,
    pub repo_url: Option<String>,
    pub source_subpath: Option<String>,
    pub detail_url: Option<String>,
    pub summary: Option<String>,
    pub documentation_title: Option<String>,
    pub documentation_path: Option<String>,
    pub documentation_excerpt: Option<String>,
    pub category: Option<String>,
    pub version: Option<String>,
    pub install_command: Option<String>,
    #[serde(default)]
    pub highlights: Vec<String>,
    #[serde(default)]
    pub use_cases: Vec<String>,
    #[serde(default)]
    pub requirements: Vec<String>,
    #[serde(default)]
    pub security_signals: Vec<ExternalMarketFacet>,
    pub package_name: Option<String>,
    pub package_version: Option<String>,
    pub owner_handle: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillTag {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
    pub usage_count: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillCollection {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub item_count: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillOrganizationRecord {
    pub skill_id: String,
    pub primary_collection_id: Option<String>,
    pub primary_collection_name: Option<String>,
    pub collection_ids: Vec<String>,
    pub collection_names: Vec<String>,
    pub tag_ids: Vec<String>,
    pub tag_names: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillOrganizationSnapshot {
    pub collections: Vec<SkillCollection>,
    pub tags: Vec<SkillTag>,
    pub records: Vec<SkillOrganizationRecord>,
}

// ─── SkillSnapshot ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillSnapshot {
    pub id: String,
    pub skill_id: String,
    pub snapshot_number: i64,
    pub snapshot_path: String,
    pub revision_hash: String,
    pub change_summary: Option<String>,
    #[serde(default = "default_snapshot_source")]
    pub source: String,
    pub created_at: i64,
    pub is_current: bool,
    pub is_active: bool,
}

// ─── PlatformConnection ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformConnection {
    pub id: String,
    pub platform_name: String,
    pub display_name: String,
    pub platform_type: String,
    pub detected: bool,
    pub enabled: bool,
    pub skills_dir: Option<String>,
    pub detect_dir: Option<String>,
    pub sync_mode: String,
    pub supports_project_scope: bool,
    pub supports_symlink: bool,
    pub supports_copy: bool,
    pub last_sync_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformGovernanceImpact {
    pub platform_name: String,
    pub display_name: Option<String>,
    pub global_release_count: i64,
    pub project_connection_count: i64,
    pub enabled_project_connection_count: i64,
    pub assignment_count: i64,
    pub enabled_assignment_count: i64,
    pub affected_projects: Vec<String>,
}

// ─── Platform detection result ─────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformScanResult {
    pub platforms: Vec<PlatformConnection>,
}

// ─── Diff results ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotDiffResult {
    pub added_files: Vec<String>,
    pub deleted_files: Vec<String>,
    pub modified_files: Vec<String>,
    pub text_diffs: HashMap<String, TextDiffEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextDiffEntry {
    pub file_path: String,
    pub unified_diff: String,
    pub old_lines: usize,
    pub new_lines: usize,
}

// ─── Input types ───────────────────────────────────────────────────────────────

// ─── Source type 枚举值（字符串常量，存入 skills.source_type 列）────────────────
// "local"           - 从本地文件夹导入
// "platform_scan"   - 从平台目录扫描导入
// "github_snapshot" - 从 GitHub 公共仓库一次性快照导入（预留）
// "team_library"    - 从团队库导入（未来扩展，预留）

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSkillInput {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSkillInput {
    pub folder_path: Option<String>,
    #[serde(default = "default_source_type")]
    pub source_type: String,
    pub git_url: Option<String>,
    pub repo_subdir: Option<String>,
    pub market_item_id: Option<String>,
    pub external_source: Option<String>,
    pub external_skill_id: Option<String>,
    pub external_installs: Option<u64>,
    pub external_market_source: Option<String>,
    pub external_package_name: Option<String>,
    pub external_package_version: Option<String>,
    pub external_owner_handle: Option<String>,
    pub platform_name: Option<String>,
    pub skill_folder_name: Option<String>,
    pub display_name: Option<String>,
}

fn default_source_type() -> String {
    "local".to_string()
}

pub fn default_snapshot_source() -> String {
    "manual".to_string()
}

pub fn normalize_snapshot_source(source: Option<&str>) -> String {
    let normalized = source
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("manual")
        .to_lowercase();

    if normalized.is_empty() {
        default_snapshot_source()
    } else {
        normalized
    }
}

pub fn is_system_snapshot_source(source: &str) -> bool {
    normalize_snapshot_source(Some(source)) == "system"
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSnapshotInput {
    pub skill_id: String,
    pub change_summary: Option<String>,
    #[serde(default = "default_snapshot_source")]
    pub source: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSnapshotSummaryInput {
    pub snapshot_id: String,
    pub change_summary: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompareSnapshotsInput {
    pub snapshot_id_a: String,
    pub snapshot_id_b: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSkillCollectionInput {
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSkillCollectionInput {
    pub collection_id: String,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnsureSkillTagsInput {
    pub names: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSkillTagInput {
    pub tag_id: String,
    pub name: String,
    pub color: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchApplySkillOrganizationInput {
    pub skill_ids: Vec<String>,
    pub primary_collection_id: Option<String>,
    #[serde(default)]
    pub clear_primary_collection: bool,
    #[serde(default)]
    pub add_tag_ids: Vec<String>,
    #[serde(default)]
    pub remove_tag_ids: Vec<String>,
}

// ─── DB health check ───────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DbHealthResponse {
    pub ok: bool,
    pub workspace_path: String,
    pub db_path: String,
    pub settings_path: String,
    pub skills_path: String,
    pub projects_path: String,
    pub snapshots_path: String,
    pub tables: Vec<String>,
}

// ─── Change detection ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangeStatus {
    pub has_changes: bool,
    pub added_files: Vec<String>,
    pub deleted_files: Vec<String>,
    pub modified_files: Vec<String>,
}

// ─── Platform scan & import ───────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformSkillScanResult {
    pub found: Vec<String>,
    pub already_managed: Vec<String>,
    pub new_skills: Vec<String>,
    pub missing_entry_file: Vec<String>, // 缺少 skill.md 入口文件的目录
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPlatformSkillInput {
    pub platform_name: String,
    pub skill_folder_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchImportInput {
    pub platform_name: String,
    pub skill_folder_names: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchImportResult {
    pub successes: Vec<String>,
    pub failures: Vec<BatchImportFailure>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchImportFailure {
    pub folder_name: String,
    pub error: String,
}

// ─── Platform sync ────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub platform: String,
    pub status: String,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillSyncResult {
    pub skill_name: String,
    pub platform_results: Vec<SyncResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformReleaseTarget {
    pub platform_name: String,
    pub display_name: Option<String>,
    pub snapshot_id: String,
    pub snapshot_number: i64,
    pub change_summary: Option<String>,
    pub target_path: Option<String>,
    pub sync_mode: String,
    pub published_content_hash: Option<String>,
    pub observed_target_hash: Option<String>,
    pub drift_status: String,
    pub last_checked_at: Option<i64>,
    pub released_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformReleaseRecord {
    pub id: String,
    pub platform_name: String,
    pub display_name: Option<String>,
    pub snapshot_id: Option<String>,
    pub snapshot_number: Option<i64>,
    pub change_summary: Option<String>,
    pub action: String,
    pub status: String,
    pub target_path: Option<String>,
    pub sync_mode: Option<String>,
    pub before_hash: Option<String>,
    pub after_hash: Option<String>,
    pub plan_id: Option<String>,
    pub detail_message: Option<String>,
    pub error_message: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillPlatformReleaseStatus {
    pub platform_name: String,
    pub display_name: Option<String>,
    pub detected: bool,
    pub enabled: bool,
    pub skills_dir: Option<String>,
    pub current_target: Option<PlatformReleaseTarget>,
    pub last_record: Option<PlatformReleaseRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillPlatformReleaseOverview {
    pub releases: Vec<SkillPlatformReleaseStatus>,
    pub recent_records: Vec<PlatformReleaseRecord>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishSnapshotToPlatformsInput {
    pub skill_id: String,
    pub snapshot_id: String,
    pub platform_names: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveSkillFromPlatformsInput {
    pub skill_id: String,
    pub platform_names: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavePlatformConnectionInput {
    pub platform_name: String,
    pub enabled: bool,
    pub skills_dir: Option<String>,
    pub sync_mode: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCustomPlatformInput {
    pub platform_name: String,
    pub display_name: String,
    pub skills_dir: String,
    pub sync_mode: Option<String>,
    pub supports_project_scope: bool,
    pub supports_symlink: bool,
    pub supports_copy: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteCustomPlatformInput {
    pub platform_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestPlatformPathInput {
    pub skills_dir: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestPlatformPathResult {
    pub ok: bool,
    pub normalized_path: String,
    pub exists: bool,
    pub is_directory: bool,
    pub message: String,
}

// ─── Project zone ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    pub id: String,
    pub name: String,
    pub root_path: String,
    pub description: Option<String>,
    pub status: String,
    pub last_scanned_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
    pub platform_count: i64,
    pub assignment_count: i64,
    pub drift_count: i64,
    pub last_sync_at: Option<i64>,
    pub last_sync_status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub root_path: String,
    pub description: Option<String>,
    pub status: String,
    pub last_scanned_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectPlatformConnection {
    pub id: String,
    pub project_id: String,
    pub platform_name: String,
    pub display_name: Option<String>,
    pub path_mode: String,
    pub relative_skills_dir: Option<String>,
    pub skills_dir: String,
    pub disabled_dir: Option<String>,
    pub sync_mode: String,
    pub enabled: bool,
    pub status: String,
    pub last_sync_at: Option<i64>,
    pub last_sync_status: Option<String>,
    pub last_error_message: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSkillAssignment {
    pub id: String,
    pub project_id: String,
    pub platform_name: String,
    pub platform_display_name: Option<String>,
    pub skill_id: String,
    pub skill_name: String,
    pub skill_slug: String,
    pub snapshot_id: String,
    pub snapshot_number: i64,
    pub snapshot_revision_hash: String,
    pub snapshot_change_summary: Option<String>,
    pub target_dir_name: String,
    pub enabled: bool,
    pub sort_order: i64,
    pub runtime_status: String,
    pub last_synced_snapshot_id: Option<String>,
    pub last_synced_hash: Option<String>,
    pub last_checked_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSyncLog {
    pub id: String,
    pub project_id: String,
    pub platform_name: String,
    pub skill_id: Option<String>,
    pub snapshot_id: Option<String>,
    pub action: String,
    pub status: String,
    pub detail_message: Option<String>,
    pub error_message: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDetail {
    pub project: Project,
    pub platforms: Vec<ProjectPlatformConnection>,
    pub assignments: Vec<ProjectSkillAssignment>,
    pub recent_logs: Vec<ProjectSyncLog>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectInput {
    pub name: String,
    pub root_path: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProjectInput {
    pub project_id: String,
    pub name: String,
    pub root_path: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteProjectInput {
    pub project_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveProjectPlatformConnectionInput {
    pub project_id: String,
    pub platform_name: String,
    pub path_mode: Option<String>,
    pub relative_skills_dir: Option<String>,
    pub skills_dir: Option<String>,
    pub sync_mode: Option<String>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteProjectPlatformConnectionInput {
    pub project_id: String,
    pub platform_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestProjectPlatformPathInput {
    pub project_id: String,
    pub platform_name: String,
    pub path_mode: Option<String>,
    pub relative_skills_dir: Option<String>,
    pub skills_dir: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteProjectSyncInput {
    pub project_id: String,
    pub platform_name: String,
    #[serde(default)]
    pub confirmed_assignment_ids: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveProjectSkillAssignmentInput {
    pub project_id: String,
    pub platform_name: String,
    pub skill_id: String,
    pub snapshot_id: Option<String>,
    pub target_dir_name: Option<String>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteProjectSkillAssignmentInput {
    pub assignment_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSyncPlanRecord {
    pub assignment_id: String,
    pub skill_id: String,
    pub skill_name: String,
    pub snapshot_id: String,
    pub target_path: String,
    pub planned_action: String,
    pub status: String,
    pub requires_user_confirmation: bool,
    pub blocking_reason: Option<String>,
    pub detail_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSyncPlan {
    pub project_id: String,
    pub platform_name: String,
    pub status: String,
    pub records: Vec<ProjectSyncPlanRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSyncResult {
    pub project_id: String,
    pub platform_name: String,
    pub status: String,
    pub synced_count: i64,
    pub skipped_count: i64,
    pub failed_count: i64,
    pub records: Vec<ProjectSyncPlanRecord>,
}

// ─── Skill file tree ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillFileNode {
    pub name: String,
    pub path: String, // 相对于 skill 根目录的路径，如 "bin/gstack-config"
    pub is_dir: bool,
    pub children: Vec<SkillFileNode>,
}

// ─── App settings ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: String,       // "dark" | "light" | "system"
    pub ui_language: String, // "system" | "zh-CN" | "en-US"
    #[serde(alias = "snapshotBeforeSync")]
    pub snapshot_before_publish: bool, // 发布前为工作区保留恢复点
    pub snapshot_max_count: Option<u32>, // 快照保留上限（None = 不限制）
}

impl Default for AppSettings {
    fn default() -> Self {
        AppSettings {
            theme: "dark".to_string(),
            ui_language: "system".to_string(),
            snapshot_before_publish: true,
            snapshot_max_count: Some(20),
        }
    }
}

// ─── Team ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Team {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub status: String, // "active" | "archived"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamMember {
    pub id: String,
    pub team_id: String,
    pub user_name: String,
    pub email: Option<String>,
    pub role: String, // "owner" | "maintainer" | "reviewer" | "contributor" | "viewer"
    pub status: String, // "active" | "invited" | "disabled"
    pub joined_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamSkill {
    pub id: String,
    pub team_id: String,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamSkillVersion {
    pub id: String,
    pub team_skill_id: String,
    pub version_number: i64,
    pub snapshot_path: String,
    pub revision_hash: String,
    pub change_summary: Option<String>,
    pub merged_from_submission_id: Option<String>,
    pub merged_by: Option<String>,
    pub merged_at: i64,
    pub is_recommended: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamSubmission {
    pub id: String,
    pub team_id: String,
    pub team_skill_id: Option<String>,
    pub base_team_version_id: Option<String>,
    pub base_revision_hash: Option<String>,
    pub source_skill_id: String,
    pub source_snapshot_id: String,
    pub submitter: String,
    pub submit_message: Option<String>,
    pub submitted_at: i64,
    pub status: String, // "pending" | "merged" | "rejected" | "withdrawn"
    pub resolved_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamPendingDelivery {
    pub submission_id: String,
    pub team_id: String,
    pub team_name: String,
    pub team_skill_id: Option<String>,
    pub source_snapshot_id: String,
    pub source_snapshot_number: i64,
    pub change_summary: Option<String>,
    pub submitter: String,
    pub submit_message: Option<String>,
    pub submitted_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamDeliveryTarget {
    pub team_id: String,
    pub team_name: String,
    pub source_skill_id: String,
    pub source_snapshot_id: String,
    pub source_snapshot_number: i64,
    pub change_summary: Option<String>,
    pub team_skill_id: Option<String>,
    pub team_skill_name: Option<String>,
    pub team_version_id: Option<String>,
    pub team_version_number: Option<i64>,
    pub delivered_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamDeliveryRecord {
    pub id: String,
    pub team_id: String,
    pub team_name: String,
    pub source_skill_id: String,
    pub source_snapshot_id: Option<String>,
    pub source_snapshot_number: Option<i64>,
    pub change_summary: Option<String>,
    pub team_skill_id: Option<String>,
    pub team_skill_name: Option<String>,
    pub team_version_id: Option<String>,
    pub team_version_number: Option<i64>,
    pub submission_id: Option<String>,
    pub action: String,
    pub status: String,
    pub actor: Option<String>,
    pub note: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamActivityLog {
    pub id: String,
    pub team_id: String,
    pub actor: String,
    pub action: String,
    pub target_type: String,
    pub target_id: Option<String>,
    pub target_label: Option<String>,
    pub detail: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillTeamDeliveryStatus {
    pub team_id: String,
    pub team_name: String,
    pub team_description: Option<String>,
    pub current_target: Option<TeamDeliveryTarget>,
    pub pending_delivery: Option<TeamPendingDelivery>,
    pub last_record: Option<TeamDeliveryRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillTeamDeliveryOverview {
    pub deliveries: Vec<SkillTeamDeliveryStatus>,
    pub recent_records: Vec<TeamDeliveryRecord>,
}

// ─── Team Input types ──────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTeamInput {
    pub name: String,
    pub description: Option<String>,
    pub actor: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTeamInput {
    pub team_id: String,
    pub name: String,
    pub description: Option<String>,
    pub actor: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetTeamStatusInput {
    pub team_id: String,
    pub status: String, // "active" | "archived"
    pub actor: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTeamMemberInput {
    pub team_id: String,
    pub user_name: String,
    pub email: Option<String>,
    pub role: String,
    pub actor: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTeamMemberInput {
    pub member_id: String,
    pub user_name: String,
    pub email: Option<String>,
    pub role: String,
    pub status: String,
    pub actor: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitToTeamInput {
    pub team_id: String,
    pub team_skill_id: Option<String>,
    pub source_skill_id: String,
    pub source_snapshot_id: String,
    pub submitter: String,
    pub submit_message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitSnapshotToTeamsInput {
    pub skill_id: String,
    pub snapshot_id: String,
    pub team_ids: Vec<String>,
    pub submitter: String,
    pub submit_message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WithdrawPendingTeamDeliveriesInput {
    pub skill_id: String,
    pub team_ids: Vec<String>,
    pub actor: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveSkillFromTeamsInput {
    pub skill_id: String,
    pub team_ids: Vec<String>,
    pub actor: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamSubmissionFileResolutionInput {
    pub file_path: String,
    pub resolution: String, // "incoming" | "current"
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeSubmissionInput {
    pub submission_id: String,
    pub merged_by: String,
    pub change_summary: Option<String>,
    pub resolution_mode: Option<String>, // "auto" | "manual_override" | "manual_files"
    #[serde(default)]
    pub file_resolutions: Vec<TeamSubmissionFileResolutionInput>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RejectSubmissionInput {
    pub submission_id: String,
    pub actor: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PullTeamVersionInput {
    pub team_version_id: String,
    pub mode: String, // "new_skill" | "append_snapshot"
    pub target_skill_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetRecommendedVersionInput {
    pub version_id: String,
    pub actor: String,
}

// ─── Team diff / impact types ─────────────────────────────────────────────────-

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckPullImpactInput {
    pub team_version_id: String,
    pub mode: String, // "new_skill" | "append_snapshot"
    pub target_skill_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamPullImpact {
    pub has_local_changes: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamSubmissionMergeVersionRef {
    pub id: String,
    pub version_number: i64,
    pub revision_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamSubmissionMergePreview {
    pub submission_id: String,
    pub base_version: Option<TeamSubmissionMergeVersionRef>,
    pub current_version: Option<TeamSubmissionMergeVersionRef>,
    pub stale_base: bool,
    pub can_auto_merge: bool,
    pub requires_manual_merge: bool,
    pub changed_files: Vec<String>,
    pub concurrently_changed_files: Vec<String>,
    pub conflicting_files: Vec<String>,
    pub added_files: Vec<String>,
    pub modified_files: Vec<String>,
    pub deleted_files: Vec<String>,
    pub summary: String,
}
