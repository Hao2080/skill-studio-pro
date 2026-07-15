use tauri::AppHandle;

use crate::{
    domain::{
        BatchApplySkillOrganizationInput, CreateSkillCollectionInput, EnsureSkillTagsInput,
        SkillCollection, SkillOrganizationSnapshot, SkillTag, UpdateSkillCollectionInput,
        UpdateSkillTagInput,
    },
    store,
};

#[tauri::command]
pub fn skill_organization_snapshot(app: AppHandle) -> Result<SkillOrganizationSnapshot, String> {
    store::get_skill_organization_snapshot(&app)
}

#[tauri::command]
pub fn skill_collection_create(
    app: AppHandle,
    input: CreateSkillCollectionInput,
) -> Result<SkillCollection, String> {
    store::create_skill_collection(&app, &input)
}

#[tauri::command]
pub fn skill_collection_update(
    app: AppHandle,
    input: UpdateSkillCollectionInput,
) -> Result<SkillCollection, String> {
    super::validate_required_id("collectionId", &input.collection_id)?;
    store::update_skill_collection(&app, &input)
}

#[tauri::command]
pub fn skill_collection_delete(app: AppHandle, collection_id: String) -> Result<(), String> {
    super::validate_required_id("collectionId", &collection_id)?;
    store::delete_skill_collection(&app, &collection_id)
}

#[tauri::command]
pub fn skill_tags_ensure(
    app: AppHandle,
    input: EnsureSkillTagsInput,
) -> Result<Vec<SkillTag>, String> {
    store::ensure_skill_tags(&app, &input)
}

#[tauri::command]
pub fn skill_tag_update(app: AppHandle, input: UpdateSkillTagInput) -> Result<SkillTag, String> {
    super::validate_required_id("tagId", &input.tag_id)?;
    store::update_skill_tag(&app, &input)
}

#[tauri::command]
pub fn skill_tag_delete(app: AppHandle, tag_id: String) -> Result<(), String> {
    super::validate_required_id("tagId", &tag_id)?;
    store::delete_skill_tag(&app, &tag_id)
}

#[tauri::command]
pub fn skill_organization_batch_apply(
    app: AppHandle,
    input: BatchApplySkillOrganizationInput,
) -> Result<(), String> {
    store::batch_apply_skill_organization(&app, &input)
}
