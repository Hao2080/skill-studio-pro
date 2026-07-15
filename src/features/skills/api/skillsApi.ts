import { open } from "@tauri-apps/plugin-dialog";
import type {
  BatchImportResult,
  ChangeStatus,
  ExternalMarketSkill,
  ExternalMarketSkillDetail,
  ExternalMarketBoard,
  MarketCatalogItem,
  PlatformSkillScanResult,
  Skill,
  SkillFileNode,
  SkillImportRecord,
  SkillSource,
} from "@/types/skill";
import { invokeCommand } from "@/shared/tauri/invokeCommand";

const editSessions = new Map<string, string>();

export interface CreateSkillPayload {
  name: string;
  description?: string;
}

export interface ImportSkillPayload {
  folderPath?: string;
  sourceType?: string;
  gitUrl?: string;
  repoSubdir?: string;
  marketItemId?: string;
  externalSource?: string;
  externalSkillId?: string;
  externalInstalls?: number;
  externalMarketSource?: string;
  externalPackageName?: string;
  externalPackageVersion?: string;
  externalOwnerHandle?: string;
  platformName?: string;
  skillFolderName?: string;
  displayName?: string;
}

export async function listSkills(): Promise<Skill[]> {
  return invokeCommand<Skill[]>("skill_list");
}

export async function listSkillSources(skillId: string): Promise<SkillSource[]> {
  return invokeCommand<SkillSource[]>("skill_source_list", { skillId });
}

export async function listSkillImportRecords(limit?: number): Promise<SkillImportRecord[]> {
  return invokeCommand<SkillImportRecord[]>("skill_import_record_list", { limit });
}

export async function createSkill(input: CreateSkillPayload): Promise<Skill> {
  return invokeCommand<Skill>("skill_create", { input });
}

export async function openSkillImportDialog(): Promise<string | null> {
  const folderPath = await open({ directory: true, multiple: false, title: "选择 Skill 文件夹" });

  if (!folderPath || Array.isArray(folderPath)) {
    return null;
  }

  return folderPath;
}

export async function importSkill(input: ImportSkillPayload): Promise<Skill> {
  return invokeCommand<Skill>("skill_import", { input });
}

export async function importSkillFromGit(input: {
  gitUrl: string;
  repoSubdir?: string;
  displayName?: string;
}): Promise<Skill> {
  return importSkill({
    sourceType: "git_repository",
    gitUrl: input.gitUrl,
    repoSubdir: input.repoSubdir,
    displayName: input.displayName,
  });
}

export async function importMarketSkill(marketItemId: string): Promise<Skill> {
  return importSkill({
    sourceType: "market_catalog",
    marketItemId,
  });
}

export async function importExternalMarketSkill(input: {
  marketSource: string;
  source: string;
  skillId: string;
  installs?: number;
  packageName?: string;
  packageVersion?: string;
  ownerHandle?: string;
  displayName?: string;
}): Promise<Skill> {
  return importSkill({
    sourceType: "skillssh",
    externalSource: input.source,
    externalSkillId: input.skillId,
    externalInstalls: input.installs,
    externalMarketSource: input.marketSource,
    externalPackageName: input.packageName,
    externalPackageVersion: input.packageVersion,
    externalOwnerHandle: input.ownerHandle,
    displayName: input.displayName,
  });
}

export async function listMarketCatalogItems(): Promise<MarketCatalogItem[]> {
  return invokeCommand<MarketCatalogItem[]>("market_catalog_list");
}

export async function listExternalMarketSkills(
  sourceKey: string,
  board: ExternalMarketBoard,
): Promise<ExternalMarketSkill[]> {
  return invokeCommand<ExternalMarketSkill[]>("market_external_list", { sourceKey, board });
}

export async function searchExternalMarketSkills(
  sourceKey: string,
  query: string,
  limit = 60,
): Promise<ExternalMarketSkill[]> {
  return invokeCommand<ExternalMarketSkill[]>("market_external_search", { sourceKey, query, limit });
}

export async function getExternalMarketSkillDetail(
  marketSource: string,
  source: string,
  skillId: string,
  packageName?: string,
  packageVersion?: string,
): Promise<ExternalMarketSkillDetail> {
  return invokeCommand<ExternalMarketSkillDetail>("market_external_detail", {
    marketSource,
    source,
    skillId,
    packageName,
    packageVersion,
  });
}

export async function deleteSkill(skillId: string): Promise<void> {
  return invokeCommand<void>("skill_delete", { skillId });
}

export async function detectChanges(skillId: string): Promise<ChangeStatus> {
  return invokeCommand<ChangeStatus>("detect_changes", { skillId });
}

export async function listSkillFiles(skillId: string): Promise<SkillFileNode> {
  return invokeCommand<SkillFileNode>("list_skill_files", { skillId });
}

export async function readSkillFile(skillId: string, relativePath: string): Promise<string> {
  return invokeCommand<string>("read_skill_file", { skillId, relativePath });
}

export async function writeSkillFile(skillId: string, relativePath: string, content: string): Promise<void> {
  const key = `${skillId}:${relativePath}`;
  let editSessionId = editSessions.get(key);
  if (!editSessionId) {
    editSessionId = globalThis.crypto?.randomUUID?.() ?? `edit-${Date.now()}-${Math.random()}`;
    editSessions.set(key, editSessionId);
  }
  await invokeCommand("lifecycle_text_file_save", {
    input: { skillId, relativePath, content, editSessionId },
  });
}

export async function openFileInEditor(skillId: string, relativePath: string): Promise<void> {
  return invokeCommand<void>("open_file_in_editor", { skillId, relativePath });
}

export async function openSkillFolder(skillId: string): Promise<string> {
  return invokeCommand<string>("open_skill_folder", { skillId });
}

export async function scanPlatformSkills(platformName: string): Promise<PlatformSkillScanResult> {
  return invokeCommand<PlatformSkillScanResult>("scan_platform_skills", { platformName });
}

export async function batchImportPlatformSkills(
  platformName: string,
  skillFolderNames: string[],
): Promise<BatchImportResult> {
  return invokeCommand<BatchImportResult>("batch_import_platform_skills", {
    input: {
      platformName,
      skillFolderNames,
    },
  });
}
