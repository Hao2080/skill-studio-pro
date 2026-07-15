export type MySkillsViewMode = "card" | "list";
export type MySkillsSortMode = "updated" | "updated-asc" | "name-asc" | "name-desc" | "recently-imported";
export type EmptyStateMode = "no-skills" | "no-results" | "empty-category";
export type MySkillsQuickFilter = "all" | "needs-description" | "has-changes";

export interface MySkillsQuickFilterOption {
  key: Exclude<MySkillsQuickFilter, "all">;
  label: string;
  count: number;
}

export interface MySkillItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  sourceType: string;
  updatedAt: number;
  createdAt: number;
  isArchived: boolean;
  hasChanges: boolean;
  category: string | null;
  tags: string[];
  needsDescription: boolean;
}

export interface MySkillsSummary {
  allCount: number;
  unclassifiedCount: number;
  recentlyUpdatedCount: number;
  categoryCount: number;
}

export interface MySkillsViewModel {
  items: MySkillItem[];
  recentlyUpdated: MySkillItem[];
  needsOrganizing: MySkillItem[];
  summary: MySkillsSummary;
  categories: string[];
}
