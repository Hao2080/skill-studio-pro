import type { ExternalMarketBoard, ExternalMarketSkill, MarketCatalogItem, SkillImportRecord } from "@/types/skill";
import type { ImportSkillPayload } from "@/features/skills/api/skillsApi";
import { getMarketCopy } from "./marketCopy";
import type {
  CatalogScope,
  ExternalStateFilter,
  ImportMode,
  ImportProgressStage,
  ImportProgressState,
  MarketMode,
  UiLanguage,
} from "./marketTypes";

export function getModeLabel(mode: MarketMode, language: UiLanguage) {
  if (language === "en-US") {
    switch (mode) {
      case "external":
        return "External Market";
      case "catalog":
        return "Official Templates";
      case "local":
        return "Local Import";
      case "git":
        return "Git Import";
    }
  }

  switch (mode) {
    case "external":
      return "外部市场";
    case "catalog":
      return "官方模板";
    case "local":
      return "本地导入";
    case "git":
      return "Git 导入";
  }
}

export function getModeSummary(mode: MarketMode, language: UiLanguage) {
  if (language === "en-US") {
    switch (mode) {
      case "external":
        return "Browse mature skills and decide whether to intake them.";
      case "catalog":
        return "Start from official templates and import them into the skill library.";
      case "local":
        return "Bring an existing local skill directory into governed management.";
      case "git":
        return "Import a remote repository into the skill library.";
    }
  }

  switch (mode) {
    case "external":
      return "浏览外部成熟技能资产，并判断是否导入。";
    case "catalog":
      return "从官方模板开始，快速导入到个人技能库。";
    case "local":
      return "把已有本地技能目录纳入正式治理。";
    case "git":
      return "把远端仓库导入个人技能库。";
  }
}

export function getExternalStateFilterLabel(value: ExternalStateFilter, language: UiLanguage) {
  if (language === "en-US") {
    switch (value) {
      case "all":
        return "All";
      case "available":
        return "Ready";
      case "installed":
        return "In Library";
      case "conflict":
        return "Slug Conflict";
    }
  }

  switch (value) {
    case "all":
      return "全部";
    case "available":
      return "可导入";
    case "installed":
      return "已在个人技能库";
    case "conflict":
      return "标识冲突";
  }
}

export function getCatalogScopeLabel(value: CatalogScope, language: UiLanguage) {
  if (language === "en-US") {
    return value === "featured" ? "Recommended" : "All Templates";
  }

  return value === "featured" ? "优先推荐" : "全部模板";
}

export function buildVisiblePages(totalPages: number, currentPage: number) {
  return Array.from({ length: totalPages }, (_, index) => index + 1).filter((page) => {
    if (totalPages <= 7) {
      return true;
    }

    if (page === 1 || page === totalPages) {
      return true;
    }

    return Math.abs(page - currentPage) <= 1;
  });
}

export function getPaginationSummary(start: number, end: number, total: number, language: UiLanguage) {
  if (language === "en-US") {
    return `Showing ${start} - ${end} of ${total}`;
  }

  return `显示第 ${start} - ${end} 项，共 ${total} 项`;
}

export function matchesSearch(item: MarketCatalogItem, keyword: string) {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return [
    item.name,
    item.summary,
    item.description,
    item.category,
    item.author,
    ...item.tags,
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function formatExternalInstallCount(installs: number) {
  if (installs >= 1_000_000) {
    return `${(installs / 1_000_000).toFixed(1)}M`;
  }

  if (installs >= 1_000) {
    return `${(installs / 1_000).toFixed(1)}K`;
  }

  return String(installs);
}

export function buildExternalSourceRef(item: Pick<ExternalMarketSkill, "source" | "skillId">) {
  return `${item.source}/${item.skillId}`;
}

export function slugifySkillName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  let slug = "";
  let prevDash = false;

  for (const char of trimmed) {
    const mapped =
      /[a-z0-9]/.test(char)
        ? char
        : /[A-Z]/.test(char)
          ? char.toLowerCase()
          : "-";

    if (mapped === "-") {
      if (slug && !prevDash) {
        slug += mapped;
        prevDash = true;
      }
      continue;
    }

    slug += mapped;
    prevDash = false;
  }

  return slug.replace(/^-+|-+$/g, "") || null;
}

export function extractExistingSlug(detail: string) {
  const matched = detail.match(/slug ['"]([^'"]+)['"] 已存在/);
  return matched?.[1]?.trim() || null;
}

export function getExternalBoardLabel(board: ExternalMarketBoard, language: UiLanguage) {
  const copy = getMarketCopy(language);
  switch (board) {
    case "trending":
      return copy.externalTrending;
    case "hot":
      return copy.externalHot;
    default:
      return copy.externalAllTime;
  }
}

export function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function buildSourceLabel(mode: ImportMode, language: UiLanguage) {
  if (mode === "local") {
    return language === "en-US" ? "Local Folder" : "本地目录";
  }

  if (mode === "git") {
    return language === "en-US" ? "Repository Snapshot" : "仓库快照";
  }

  if (mode === "platform_scan") {
    return language === "en-US" ? "Platform Scan" : "平台扫描";
  }

  if (mode === "team_library") {
    return language === "en-US" ? "Team Library" : "团队技能库";
  }

  if (mode?.startsWith("market:")) {
    return language === "en-US" ? "Featured Market" : "市场精选";
  }

  if (mode?.startsWith("external:")) {
    return language === "en-US" ? "External Market" : "外部市场";
  }

  return language === "en-US" ? "Unified Import" : "统一导入";
}

export function buildRunningImportStatus(
  mode: ImportMode,
  stage: ImportProgressStage,
  language: UiLanguage,
): ImportProgressState {
  const sourceLabel = buildSourceLabel(mode, language);
  const copy = getMarketCopy(language);

  switch (stage) {
    case "prepare":
      return {
        mode,
        sourceLabel,
        stage,
        status: "running",
        title: copy.importReadyTitle(sourceLabel),
        detail: copy.importReadyDetail,
      };
    case "dispatch":
      return {
        mode,
        sourceLabel,
        stage,
        status: "running",
        title: copy.importDispatchTitle(sourceLabel),
        detail: copy.importDispatchDetail,
      };
    case "processing":
      return {
        mode,
        sourceLabel,
        stage,
        status: "running",
        title: copy.importProcessingTitle(sourceLabel),
        detail: copy.importProcessingDetail,
      };
    case "done":
      return {
        mode,
        sourceLabel,
        stage,
        status: "success",
        title: copy.importDoneTitle(sourceLabel),
        detail: copy.importDoneDetail,
      };
  }
}

export function parseImportPayload(record: SkillImportRecord): ImportSkillPayload | null {
  if (!record.requestPayloadJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(record.requestPayloadJson) as ImportSkillPayload;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function resolveImportModeFromPayload(payload: ImportSkillPayload): ImportMode {
  if (payload.sourceType === "git_repository") {
    return "git";
  }

  if (payload.sourceType === "market_catalog" && payload.marketItemId) {
    return `market:${payload.marketItemId}`;
  }

  if (payload.sourceType === "skillssh" && payload.externalSource && payload.externalSkillId) {
    return `external:${payload.externalSource}/${payload.externalSkillId}`;
  }

  if (payload.sourceType === "platform_scan") {
    return "platform_scan";
  }

  if (payload.sourceType === "team_library") {
    return "team_library";
  }

  return "local";
}

export function buildImportHistoryTitle(record: SkillImportRecord, language: UiLanguage) {
  if (record.targetSkillName?.trim()) {
    return record.targetSkillName.trim();
  }

  const payload = parseImportPayload(record);
  if (payload?.displayName?.trim()) {
    return payload.displayName.trim();
  }

  if (payload?.marketItemId?.trim()) {
    return payload.marketItemId.trim();
  }

  if (record.sourceRef?.trim()) {
    return record.sourceRef.trim();
  }

  if (record.sourcePath?.trim()) {
    return record.sourcePath.trim();
  }

  return getMarketCopy(language).unnamedRecord;
}

export function buildImportHistoryDetail(record: SkillImportRecord, language: UiLanguage) {
  if (record.errorMessage?.trim()) {
    return record.errorMessage.trim();
  }

  if (record.detailMessage?.trim()) {
    return record.detailMessage.trim();
  }

  if (record.sourcePath?.trim()) {
    return record.sourcePath.trim();
  }

  if (record.sourceRef?.trim()) {
    return record.sourceRef.trim();
  }

  return getMarketCopy(language).historyDetailFallback;
}
