import type {
  SkillCollection,
  SkillOrganizationSnapshot,
  SkillTag,
} from "@/types/skill";
import { invokeCommand } from "@/shared/tauri/invokeCommand";

export interface CreateSkillCollectionPayload {
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateSkillCollectionPayload extends CreateSkillCollectionPayload {
  collectionId: string;
}

export interface EnsureSkillTagsPayload {
  names: string[];
}

export interface UpdateSkillTagPayload {
  tagId: string;
  name: string;
  color?: string;
}

export interface BatchApplySkillOrganizationPayload {
  skillIds: string[];
  primaryCollectionId?: string;
  clearPrimaryCollection?: boolean;
  addTagIds?: string[];
  removeTagIds?: string[];
}

export async function getSkillOrganizationSnapshot(): Promise<SkillOrganizationSnapshot> {
  return invokeCommand<SkillOrganizationSnapshot>("skill_organization_snapshot");
}

export async function createSkillCollection(input: CreateSkillCollectionPayload): Promise<SkillCollection> {
  return invokeCommand<SkillCollection>("skill_collection_create", { input });
}

export async function updateSkillCollection(input: UpdateSkillCollectionPayload): Promise<SkillCollection> {
  return invokeCommand<SkillCollection>("skill_collection_update", { input });
}

export async function deleteSkillCollection(collectionId: string): Promise<void> {
  return invokeCommand<void>("skill_collection_delete", { collectionId });
}

export async function ensureSkillTags(input: EnsureSkillTagsPayload): Promise<SkillTag[]> {
  return invokeCommand<SkillTag[]>("skill_tags_ensure", { input });
}

export async function updateSkillTag(input: UpdateSkillTagPayload): Promise<SkillTag> {
  return invokeCommand<SkillTag>("skill_tag_update", { input });
}

export async function deleteSkillTag(tagId: string): Promise<void> {
  return invokeCommand<void>("skill_tag_delete", { tagId });
}

export async function batchApplySkillOrganization(
  input: BatchApplySkillOrganizationPayload,
): Promise<void> {
  return invokeCommand<void>("skill_organization_batch_apply", { input });
}
