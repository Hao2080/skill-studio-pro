import type { ChangeStatus, Skill } from "@/types/skill";
import type { MySkillItem, MySkillsQuickFilter, MySkillsSortMode, MySkillsViewModel } from "./types";

const DEFAULT_CATEGORY = "Unclassified";
const ALL_CATEGORY = "All";
const RECENTLY_UPDATED_LIMIT = 5;
const EMPTY_DESCRIPTION = "";

export function filterMySkillsItems(
  items: MySkillItem[],
  activeCategory: string,
  search: string,
  sort: MySkillsSortMode,
  quickFilter: MySkillsQuickFilter = "all",
  selectedTags: string[] = [],
): MySkillItem[] {
  const normalized = search.trim().toLowerCase();
  const normalizedSelectedTags = selectedTags.map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length > 0);
  const filtered = items.filter((item) => {
    const matchesCategory =
      activeCategory === ALL_CATEGORY
        ? true
        : activeCategory === DEFAULT_CATEGORY
          ? !item.category
          : item.category === activeCategory;

    const matchesSearch =
      normalized.length === 0 ||
      item.name.toLowerCase().includes(normalized) ||
      item.description.toLowerCase().includes(normalized) ||
      item.tags.some((tag) => tag.toLowerCase().includes(normalized));

    const matchesTags =
      normalizedSelectedTags.length === 0 ||
      normalizedSelectedTags.some((tag) => item.tags.some((itemTag) => itemTag.toLowerCase() === tag));

    const matchesQuickFilter =
      quickFilter === "all" ? true : quickFilter === "needs-description" ? item.needsDescription : item.hasChanges;

    return matchesCategory && matchesSearch && matchesTags && matchesQuickFilter;
  });

  return filtered.sort((left, right) => {
    if (sort === "name-asc") {
      return left.name.localeCompare(right.name);
    }

    if (sort === "name-desc") {
      return right.name.localeCompare(left.name);
    }

    if (sort === "recently-imported") {
      return right.createdAt - left.createdAt;
    }

    if (sort === "updated-asc") {
      return left.updatedAt - right.updatedAt;
    }

    return right.updatedAt - left.updatedAt;
  });
}

export function buildMySkillsViewModel(
  skills: Skill[],
  changeStatusMap: Record<string, ChangeStatus>,
): MySkillsViewModel {
  const items: MySkillItem[] = skills.map((skill) => ({
    id: skill.id,
    name: skill.name,
    slug: skill.slug,
    description: skill.description?.trim() || EMPTY_DESCRIPTION,
    sourceType: skill.sourceType,
    updatedAt: skill.updatedAt,
    createdAt: skill.createdAt,
    isArchived: skill.isArchived,
    hasChanges: changeStatusMap[skill.id]?.hasChanges ?? false,
    category: null,
    tags: [],
    needsDescription: !skill.description?.trim(),
  }));

  const recentlyUpdated = items
    .slice()
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, RECENTLY_UPDATED_LIMIT);

  const needsOrganizing = items.filter((item) => !item.category || item.needsDescription).slice(0, RECENTLY_UPDATED_LIMIT);

  return {
    items,
    recentlyUpdated,
    needsOrganizing,
    summary: {
      allCount: items.length,
      unclassifiedCount: items.filter((item) => !item.category).length,
      recentlyUpdatedCount: recentlyUpdated.length,
      categoryCount: 0,
    },
    categories: [ALL_CATEGORY, DEFAULT_CATEGORY],
  };
}
