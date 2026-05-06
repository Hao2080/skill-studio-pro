import { invokeCommand } from "@/shared/tauri/invokeCommand";
import type { ExternalMarketBoard, ExternalMarketSkill, ExternalMarketSkillDetail, MarketCatalogItem } from "@/types/skill";

export async function getMarketCatalogItems(): Promise<MarketCatalogItem[]> {
  return invokeCommand<MarketCatalogItem[]>("market_catalog_list");
}

export async function getExternalMarketSkills(
  sourceKey: string,
  board: ExternalMarketBoard,
): Promise<ExternalMarketSkill[]> {
  return invokeCommand<ExternalMarketSkill[]>("market_external_list", { sourceKey, board });
}

export async function searchMarketSkills(sourceKey: string, query: string): Promise<ExternalMarketSkill[]> {
  return invokeCommand<ExternalMarketSkill[]>("market_external_search", { sourceKey, query, limit: 60 });
}

export async function getMarketExternalSkillDetail(
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
