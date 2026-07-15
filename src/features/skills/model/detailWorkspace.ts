import type { SkillSource } from "@/types/skill";
import { formatUpdatedAtTimestamp } from "./updatedAtFormat";

type UiLanguage = "zh-CN" | "en-US";

const SOURCE_TYPE_LABELS: Record<UiLanguage, Record<string, string>> = {
  "zh-CN": {
    local: "本地目录",
    manual: "手动",
    imported: "导入",
    platform_scan: "平台扫描",
    team_library: "团队技能库",
    git_repository: "仓库快照",
    skillssh: "外部市场",
    market_catalog: "市场精选",
  },
  "en-US": {
    local: "Local Folder",
    manual: "Manual",
    imported: "Imported",
    platform_scan: "Platform Scan",
    team_library: "Team Library",
    git_repository: "Repository Snapshot",
    skillssh: "External Market",
    market_catalog: "Featured Market",
  },
};

export function getWorkspaceStatusLabel(
  hasSelectedSkill: boolean,
  hasChanges: boolean | undefined,
  locale: UiLanguage = "zh-CN",
): string {
  if (!hasSelectedSkill) {
    return locale === "en-US" ? "Not Loaded" : "未加载";
  }

  return hasChanges
    ? (locale === "en-US" ? "Changed" : "有改动")
    : (locale === "en-US" ? "Synced" : "已同步");
}

export function getSkillSourceTypeLabel(
  sourceType: string | null | undefined,
  locale: UiLanguage = "zh-CN",
): string {
  if (!sourceType) {
    return locale === "en-US" ? "Unknown Source" : "未知来源";
  }

  return SOURCE_TYPE_LABELS[locale][sourceType] ?? sourceType;
}

function parseSourceMetadata(metadataJson: string | null | undefined): Record<string, unknown> | null {
  if (!metadataJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(metadataJson);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function readMetadataText(metadata: Record<string, unknown> | null, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getPrimarySkillSourceLabel(
  sourceType: string | null | undefined,
  primarySource?: SkillSource | null,
  locale: UiLanguage = "zh-CN",
): string {
  const normalizedSourceType = primarySource?.sourceType ?? sourceType;
  const translatedTypeLabel = normalizedSourceType
    ? getSkillSourceTypeLabel(normalizedSourceType, locale)
    : null;

  if (primarySource?.sourceLabel?.trim()) {
    if (locale === "en-US" && translatedTypeLabel && translatedTypeLabel !== normalizedSourceType) {
      return translatedTypeLabel;
    }

    return primarySource.sourceLabel.trim();
  }

  return getSkillSourceTypeLabel(sourceType, locale);
}

export function getPrimarySkillSourceDetail(
  primarySource?: SkillSource | null,
  locale: UiLanguage = "zh-CN",
): string | null {
  if (!primarySource) {
    return null;
  }

  const metadata = parseSourceMetadata(primarySource.metadataJson);
  const repoSubdir = readMetadataText(metadata, "repoSubdir");
  const platformName = readMetadataText(metadata, "platformName");
  const skillFolderName = readMetadataText(metadata, "skillFolderName");
  const category = readMetadataText(metadata, "category");
  const author = readMetadataText(metadata, "author");
  const difficulty = readMetadataText(metadata, "difficulty");
  const externalSource = readMetadataText(metadata, "source");
  const skillId = readMetadataText(metadata, "skillId");
  const repoUrl = readMetadataText(metadata, "repoUrl");
  const sourceSubpath = readMetadataText(metadata, "sourceSubpath");

  switch (primarySource.sourceType) {
    case "manual":
      return locale === "en-US"
        ? "Created in the workspace and already included in formal version governance."
        : "在技能详情内创建，已纳入正式版本治理。";
    case "git_repository":
      return [
        primarySource.sourceRef,
        repoSubdir
          ? (locale === "en-US" ? `Subdirectory ${repoSubdir}` : `子目录 ${repoSubdir}`)
          : null,
      ]
        .filter(Boolean)
        .join(" · ");
    case "market_catalog":
      return [
        primarySource.sourceRef
          ? (locale === "en-US" ? `Featured item ${primarySource.sourceRef}` : `精选条目 ${primarySource.sourceRef}`)
          : null,
        category,
        author,
        difficulty,
      ]
        .filter(Boolean)
        .join(" · ");
    case "skillssh":
      return [
        externalSource
          ? (locale === "en-US" ? `Repository ${externalSource}` : `仓库 ${externalSource}`)
          : null,
        skillId
          ? (locale === "en-US" ? `Skill ${skillId}` : `技能 ${skillId}`)
          : null,
        sourceSubpath
          ? (locale === "en-US" ? `Path ${sourceSubpath}` : `路径 ${sourceSubpath}`)
          : null,
        repoUrl ?? primarySource.sourceRef,
      ]
        .filter(Boolean)
        .join(" · ");
    case "platform_scan":
      return [
        platformName
          ? (locale === "en-US" ? `Platform ${platformName}` : `平台 ${platformName}`)
          : null,
        skillFolderName
          ? (locale === "en-US" ? `Folder ${skillFolderName}` : `目录 ${skillFolderName}`)
          : null,
        primarySource.sourcePath,
      ]
        .filter(Boolean)
        .join(" · ");
    case "team_library":
      return primarySource.sourceRef
        ?? (locale === "en-US"
          ? "Imported from the team version flow and converted into the current skill workspace copy."
          : "来自团队版本拉取链路，已转为当前技能工作副本。");
    default:
      return primarySource.sourcePath ?? primarySource.sourceRef ?? null;
  }
}

export function formatSkillUpdatedAt(
  updatedAt: number | null | undefined,
  locale: UiLanguage = "zh-CN",
): string {
  if (!updatedAt) {
    return locale === "en-US" ? "Unknown" : "未知";
  }

  return formatUpdatedAtTimestamp(updatedAt, locale);
}
