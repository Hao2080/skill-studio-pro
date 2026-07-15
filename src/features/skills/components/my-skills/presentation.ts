import type { MySkillItem } from "./types";
import { formatUpdatedAtTimestamp } from "../../model/updatedAtFormat";

type UiLanguage = "zh-CN" | "en-US";

const SOURCE_LABELS: Record<UiLanguage, Record<string, string>> = {
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

const CATEGORY_LABELS: Record<UiLanguage, Record<string, string>> = {
  "zh-CN": {
    All: "全部",
    Unclassified: "未分类",
  },
  "en-US": {
    All: "All",
    Unclassified: "Uncategorized",
  },
};

export function formatMySkillUpdatedAt(timestamp: number, locale: UiLanguage = "zh-CN") {
  return formatUpdatedAtTimestamp(timestamp, locale);
}

export function getMySkillSourceLabel(sourceType: string, locale: UiLanguage = "zh-CN") {
  return SOURCE_LABELS[locale][sourceType] ?? sourceType;
}

export function getMySkillCategoryLabel(category: string, locale: UiLanguage = "zh-CN") {
  return CATEGORY_LABELS[locale][category] ?? category;
}

export function shouldShowMySkillSlug(item: MySkillItem) {
  return item.slug.trim().toLowerCase() !== item.name.trim().toLowerCase();
}

export function getMySkillDescriptionCopy(item: MySkillItem, locale: UiLanguage = "zh-CN") {
  return item.needsDescription
    ? locale === "en-US"
      ? "Add a description to make this skill easier to search and maintain."
      : "补充描述后更容易检索和维护。"
    : item.description;
}

export function getMySkillSignalLabels(item: MySkillItem, locale: UiLanguage = "zh-CN") {
  const labels: string[] = [];

  if (item.hasChanges) {
    labels.push(locale === "en-US" ? "Changed" : "有改动");
  }

  if (item.needsDescription) {
    labels.push(locale === "en-US" ? "Needs Description" : "待补描述");
  }

  if (item.category) {
    labels.push(getMySkillCategoryLabel(item.category, locale));
  }

  return labels;
}

export function getMySkillStatusSummary(item: MySkillItem, locale: UiLanguage = "zh-CN") {
  const labels = getMySkillSignalLabels(item, locale);
  return labels.length > 0 ? labels.join(" / ") : locale === "en-US" ? "Healthy" : "正常";
}
