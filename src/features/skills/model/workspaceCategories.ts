import type { MySkillItem } from "@/features/skills/components/my-skills/types";
import type { ChangeStatus, Skill, SkillOrganizationSnapshot } from "@/types/skill";

type UiLanguage = "zh-CN" | "en-US";

export const DEFAULT_CATEGORIES = ["All", "Unclassified"] as const;
export const CATEGORY_STORAGE_KEY = "skill-studio.my-skills.categories";
export const CATEGORY_ASSIGNMENT_STORAGE_KEY = "skill-studio.my-skills.category-assignments";
export const TAG_STORAGE_KEY = "skill-studio.my-skills.tags";
export const TAG_ASSIGNMENT_STORAGE_KEY = "skill-studio.my-skills.tag-assignments";
export const ORGANIZATION_MIGRATION_STORAGE_KEY = "skill-studio.my-skills.organization-migrated";

export type SkillCategoryMap = Record<string, string | null>;
export type SkillTagMap = Record<string, string[]>;

export interface WorkspaceCategoryNavigationItem {
  category: string;
  label: string;
  count: number;
  isDefault: boolean;
  isEmpty: boolean;
}

interface StorageReader {
  getItem: (key: string) => string | null;
}

const categoryLabels: Record<UiLanguage, Record<string, string>> = {
  "zh-CN": {
    All: "全部",
    Unclassified: "未分类",
  },
  "en-US": {
    All: "All",
    Unclassified: "Uncategorized",
  },
};

export function loadStoredCategories(storage?: StorageReader): string[] {
  if (!storage) {
    return [...DEFAULT_CATEGORIES];
  }

  try {
    const rawValue = storage.getItem(CATEGORY_STORAGE_KEY);
    if (!rawValue) {
      return [...DEFAULT_CATEGORIES];
    }

    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [...DEFAULT_CATEGORIES];
    }

    const customCategories = parsed
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter((value) => value.length > 0 && !DEFAULT_CATEGORIES.includes(value as (typeof DEFAULT_CATEGORIES)[number]));

    return [...DEFAULT_CATEGORIES, ...Array.from(new Set(customCategories))];
  } catch {
    return [...DEFAULT_CATEGORIES];
  }
}

export function loadStoredCategoryAssignments(storage?: StorageReader): SkillCategoryMap {
  if (!storage) {
    return {};
  }

  try {
    const rawValue = storage.getItem(CATEGORY_ASSIGNMENT_STORAGE_KEY);
    if (!rawValue) {
      return {};
    }

    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([skillId, category]) => [
        skillId,
        typeof category === "string" && category.trim().length > 0 ? category : null,
      ]),
    );
  } catch {
    return {};
  }
}

export function serializeCustomCategories(categories: string[]): string {
  return JSON.stringify(categories.filter((category) => !DEFAULT_CATEGORIES.includes(category as (typeof DEFAULT_CATEGORIES)[number])));
}

export function loadStoredTags(storage?: StorageReader): string[] {
  if (!storage) {
    return [];
  }

  try {
    const rawValue = storage.getItem(TAG_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return Array.from(
      new Set(
        parsed
          .map((value) => (typeof value === "string" ? value.trim() : ""))
          .filter((value) => value.length > 0),
      ),
    );
  } catch {
    return [];
  }
}

export function serializeTags(tags: string[]): string {
  return JSON.stringify(
    Array.from(
      new Set(
        tags
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0),
      ),
    ),
  );
}

export function loadStoredTagAssignments(storage?: StorageReader): SkillTagMap {
  if (!storage) {
    return {};
  }

  try {
    const rawValue = storage.getItem(TAG_ASSIGNMENT_STORAGE_KEY);
    if (!rawValue) {
      return {};
    }

    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([skillId, tags]) => [
        skillId,
        Array.isArray(tags)
          ? Array.from(
              new Set(
                tags
                  .map((value) => (typeof value === "string" ? value.trim() : ""))
                  .filter((value) => value.length > 0),
              ),
            )
          : [],
      ]),
    );
  } catch {
    return {};
  }
}

export function getCategoryLabel(category: string, locale: UiLanguage = "zh-CN"): string {
  return categoryLabels[locale][category] ?? category;
}

export function getCategoryItemCount(items: MySkillItem[], category: string): number {
  if (category === "All") {
    return items.length;
  }

  if (category === "Unclassified") {
    return items.filter((item) => item.category == null).length;
  }

  return items.filter((item) => item.category === category).length;
}

export function buildCategoryNavigationItems(
  categories: string[],
  items: MySkillItem[],
  locale: UiLanguage = "zh-CN",
): WorkspaceCategoryNavigationItem[] {
  return categories.map((category) => {
    const count = getCategoryItemCount(items, category);

    return {
      category,
      label: getCategoryLabel(category, locale),
      count,
      isDefault: DEFAULT_CATEGORIES.includes(category as (typeof DEFAULT_CATEGORIES)[number]),
      isEmpty: count === 0,
    };
  });
}

export function getContentTitle(activeCategory: string, locale: UiLanguage = "zh-CN"): string {
  if (activeCategory === "All") {
    return locale === "en-US" ? "All Skills" : "全部技能";
  }

  return getCategoryLabel(activeCategory, locale);
}

export function buildHeaderSummary(
  allCount: number,
  changedCount: number,
  needsDescriptionCount: number,
  locale: UiLanguage = "zh-CN",
): string {
  const fragments = [locale === "en-US" ? `${allCount} skills` : `${allCount} 个技能`];

  if (changedCount > 0) {
    fragments.push(locale === "en-US" ? `${changedCount} with changes` : `${changedCount} 个有改动`);
  }

  if (needsDescriptionCount > 0) {
    fragments.push(locale === "en-US" ? `${needsDescriptionCount} need details` : `${needsDescriptionCount} 个待完善`);
  }

  return fragments.join(" · ");
}

export function buildWorkspaceItems(
  skills: Skill[],
  changeStatusMap: Record<string, ChangeStatus>,
  skillCategoryMap: SkillCategoryMap,
  skillTagMap: SkillTagMap,
): MySkillItem[] {
  return skills.map((skill) => ({
    id: skill.id,
    name: skill.name,
    slug: skill.slug,
    description: skill.description?.trim() || "暂无描述",
    sourceType: skill.sourceType,
    updatedAt: skill.updatedAt,
    createdAt: skill.createdAt,
    isArchived: skill.isArchived,
    hasChanges: changeStatusMap[skill.id]?.hasChanges ?? false,
    category: skillCategoryMap[skill.id] ?? null,
    tags: skillTagMap[skill.id] ?? [],
    needsDescription: !skill.description?.trim(),
  }));
}

export function pruneInvalidCategoryAssignments(
  current: SkillCategoryMap,
  validSkillIds: string[],
  categories: string[],
): SkillCategoryMap | null {
  const validSkillIdSet = new Set(validSkillIds);
  const validCategorySet = new Set(
    categories.filter((category) => !DEFAULT_CATEGORIES.includes(category as (typeof DEFAULT_CATEGORIES)[number])),
  );

  let changed = false;
  const next: SkillCategoryMap = {};

  for (const [skillId, category] of Object.entries(current)) {
    if (!validSkillIdSet.has(skillId)) {
      changed = true;
      continue;
    }

    const normalizedCategory = category && validCategorySet.has(category) ? category : null;
    if (normalizedCategory !== category) {
      changed = true;
    }

    next[skillId] = normalizedCategory;
  }

  return changed ? next : null;
}

export function renameCategoryAssignments(
  current: SkillCategoryMap,
  sourceCategory: string,
  targetCategory: string,
): SkillCategoryMap {
  return Object.fromEntries(
    Object.entries(current).map(([skillId, category]) => [skillId, category === sourceCategory ? targetCategory : category]),
  );
}

export function clearCategoryAssignments(current: SkillCategoryMap, categoryToRemove: string): SkillCategoryMap {
  return Object.fromEntries(
    Object.entries(current).map(([skillId, category]) => [skillId, category === categoryToRemove ? null : category]),
  );
}

export function pruneInvalidTagAssignments(
  current: SkillTagMap,
  validSkillIds: string[],
  validTags: string[],
): SkillTagMap | null {
  const validSkillIdSet = new Set(validSkillIds);
  const validTagSet = new Set(validTags);
  let changed = false;
  const next: SkillTagMap = {};

  for (const [skillId, tags] of Object.entries(current)) {
    if (!validSkillIdSet.has(skillId)) {
      changed = true;
      continue;
    }

    const normalizedTags = Array.from(new Set(tags.filter((tag) => validTagSet.has(tag))));
    if (normalizedTags.length !== tags.length) {
      changed = true;
    }

    next[skillId] = normalizedTags;
  }

  return changed ? next : null;
}

export function appendTagsToAssignments(
  current: SkillTagMap,
  skillIds: string[],
  tags: string[],
): SkillTagMap {
  const normalizedTags = Array.from(new Set(tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0)));
  const targetSkillIdSet = new Set(skillIds);
  const next: SkillTagMap = { ...current };

  for (const skillId of targetSkillIdSet) {
    const currentTags = next[skillId] ?? [];
    next[skillId] = Array.from(new Set([...currentTags, ...normalizedTags]));
  }

  return next;
}

export function isCustomCategory(category: string) {
  return !DEFAULT_CATEGORIES.includes(category as (typeof DEFAULT_CATEGORIES)[number]);
}

export function normalizeTagNames(tags: string[]) {
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
    ),
  );
}

export function diffTagNames(current: string[], next: string[]) {
  const currentSet = new Set(current);
  const nextSet = new Set(next);

  return {
    add: next.filter((tag) => !currentSet.has(tag)),
    remove: current.filter((tag) => !nextSet.has(tag)),
  };
}

export function normalizeNames(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => value.length > 0),
    ),
  );
}

export function findCaseInsensitiveMatch(values: string[], target: string, excludedValue?: string | null) {
  return values.find(
    (value) =>
      value.toLowerCase() === target.toLowerCase() &&
      (excludedValue == null || value.toLowerCase() !== excludedValue.toLowerCase()),
  );
}

export function hasLocalOrganizationData(
  categories: string[],
  skillCategoryMap: SkillCategoryMap,
  availableTags: string[],
  skillTagMap: SkillTagMap,
) {
  return (
    categories.some(isCustomCategory) ||
    Object.values(skillCategoryMap).some((category) => category != null) ||
    availableTags.length > 0 ||
    Object.values(skillTagMap).some((tags) => tags.length > 0)
  );
}

export function isOrganizationSnapshotEmpty(snapshot: SkillOrganizationSnapshot) {
  return (
    snapshot.collections.length === 0 &&
    snapshot.tags.length === 0 &&
    snapshot.records.every(
      (record) =>
        record.primaryCollectionId == null &&
        record.collectionIds.length === 0 &&
        record.tagIds.length === 0,
    )
  );
}

export function removeTagsFromAssignments(
  current: SkillTagMap,
  skillIds: string[],
  tags: string[],
): SkillTagMap {
  const targetSkillIdSet = new Set(skillIds);
  const tagsToRemove = new Set(tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0));
  const next: SkillTagMap = { ...current };

  for (const skillId of targetSkillIdSet) {
    const currentTags = next[skillId] ?? [];
    next[skillId] = currentTags.filter((tag) => !tagsToRemove.has(tag));
  }

  return next;
}

export function renameTagAssignments(
  current: SkillTagMap,
  sourceTag: string,
  targetTag: string,
): SkillTagMap {
  return Object.fromEntries(
    Object.entries(current).map(([skillId, tags]) => [
      skillId,
      Array.from(
        new Set(
          tags.map((tag) => (tag === sourceTag ? targetTag : tag)).filter((tag) => tag.trim().length > 0),
        ),
      ),
    ]),
  );
}

export function removeTagAssignments(current: SkillTagMap, tagToRemove: string): SkillTagMap {
  return Object.fromEntries(
    Object.entries(current).map(([skillId, tags]) => [skillId, tags.filter((tag) => tag !== tagToRemove)]),
  );
}
