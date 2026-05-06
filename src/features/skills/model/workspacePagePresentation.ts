import type { EmptyStateMode } from "@/features/skills/components/my-skills/types";

export type UiLanguage = "zh-CN" | "en-US";

export function getWorkspaceBatchCopy(
  language: UiLanguage,
  selectedCount: number,
  selectedVisibleCount: number,
) {
  return language === "en-US"
    ? {
        barLabel: "Batch organize",
        eyebrow: "Batch Organize",
        selected: `Selected ${selectedCount} skills`,
        allIncluded: "All skills in the current result set are already included.",
        partialIncluded: `Among them, ${selectedVisibleCount} are in the current filtered results.`,
        clear: "Clear Selection",
        apply: "Batch Organize",
        createSkillNameError: "Please enter a skill name",
        createFailedPrefix: "Creation failed: ",
        deleteSkillTitle: "Delete Skill",
        delete: "Delete",
        cancel: "Cancel",
      }
    : {
        barLabel: "批量整理",
        eyebrow: "批量整理",
        selected: `已选 ${selectedCount} 项技能`,
        allIncluded: "当前结果中的技能均已纳入批量整理。",
        partialIncluded: `其中 ${selectedVisibleCount} 项位于当前筛选结果。`,
        clear: "清空选择",
        apply: "批量整理",
        createSkillNameError: "请输入技能名称",
        createFailedPrefix: "创建失败: ",
        deleteSkillTitle: "删除技能",
        delete: "删除",
        cancel: "取消",
      };
}

export function getWorkspacePageCopy(language: UiLanguage) {
  return language === "en-US"
    ? {
        migrationSuccess: "Local organization data migration completed",
        migrationWarningPrefix: "Local organization data migration did not finish: ",
        deleteSkillContent: (name?: string | null) =>
          `Are you sure you want to delete ${name ?? "this skill"}? This action cannot be undone.`,
        categoryNameRequired: "Please enter a category name",
        categoryExists: "This category already exists",
        categoryCreated: (name: string) => `Category ${name} created`,
        categoryCreateFailedPrefix: "Failed to create category: ",
        categoryMoveFailedPrefix: "Failed to move category: ",
        targetCategoryMissing: "Target category was not found",
        movedToCategory: (name: string) => `Moved to ${name}`,
        movedToUnclassified: "Moved to unclassified",
        categoryNameExists: "Category name already exists",
        editingCategoryMissing: "Category to edit was not found",
        categoryUpdated: (name: string) => `Category updated to ${name}`,
        categoryUpdateFailedPrefix: "Failed to update category: ",
        deleteCategoryTitle: "Delete Category",
        deleteCategoryContent: (name: string) => `After deleting ${name}, related skills will return to Unclassified.`,
        deletingCategoryMissing: "Category to delete was not found",
        categoryDeleted: (name: string) => `Category ${name} deleted`,
        tagNameRequired: "Please enter a tag name",
        tagExists: "This tag already exists",
        tagCreated: (name: string) => `Tag ${name} created`,
        tagCreateFailedPrefix: "Failed to create tag: ",
        tagNameExists: "Tag name already exists",
        editingTagMissing: "Tag to edit was not found",
        tagUpdated: (name: string) => `Tag updated to ${name}`,
        tagUpdateFailedPrefix: "Failed to update tag: ",
        deleteTagTitle: "Delete Tag",
        deleteTagContent: (name: string) => `After deleting ${name}, related skills will remove this tag.`,
        deletingTagMissing: "Tag to delete was not found",
        tagDeleted: (name: string) => `Tag ${name} deleted`,
        tagEditTitle: "Edit Tags",
        editingSkillMissing: "The selected skill was not found",
        skillTagsUpdated: "Skill tags updated",
        skillTagsUpdateFailedPrefix: "Failed to update skill tags: ",
        batchActionRequired: "Select at least one organize action",
        batchOrganized: (count: number) => `${count} skills organized`,
        batchOrganizeFailedPrefix: "Batch organize failed: ",
      }
    : {
        migrationSuccess: "已完成本地组织数据迁移",
        migrationWarningPrefix: "组织数据迁移未完成: ",
        deleteSkillContent: (name?: string | null) => `确认删除 ${name ?? "当前技能"} 吗？此操作不可撤销。`,
        categoryNameRequired: "请输入分类名称",
        categoryExists: "该分类已存在",
        categoryCreated: (name: string) => `已创建分类 ${name}`,
        categoryCreateFailedPrefix: "创建分类失败: ",
        categoryMoveFailedPrefix: "移动分类失败: ",
        targetCategoryMissing: "未找到目标分类",
        movedToCategory: (name: string) => `已移动到 ${name}`,
        movedToUnclassified: "已移到未分类",
        categoryNameExists: "分类名称已存在",
        editingCategoryMissing: "未找到待编辑分类",
        categoryUpdated: (name: string) => `已将分类更新为 ${name}`,
        categoryUpdateFailedPrefix: "更新分类失败: ",
        deleteCategoryTitle: "删除分类",
        deleteCategoryContent: (name: string) => `删除 ${name} 后，相关 skill 会回到“未分类”。`,
        deletingCategoryMissing: "未找到待删除分类",
        categoryDeleted: (name: string) => `已删除分类 ${name}`,
        tagNameRequired: "请输入标签名称",
        tagExists: "该标签已存在",
        tagCreated: (name: string) => `已新增标签 ${name}`,
        tagCreateFailedPrefix: "新增标签失败: ",
        tagNameExists: "标签名称已存在",
        editingTagMissing: "未找到待编辑标签",
        tagUpdated: (name: string) => `已将标签更新为 ${name}`,
        tagUpdateFailedPrefix: "更新标签失败: ",
        deleteTagTitle: "删除标签",
        deleteTagContent: (name: string) => `删除 ${name} 后，相关技能将移除这个标签。`,
        deletingTagMissing: "未找到待删除标签",
        tagDeleted: (name: string) => `已删除标签 ${name}`,
        tagEditTitle: "编辑标签",
        editingSkillMissing: "未找到目标技能",
        skillTagsUpdated: "已更新技能标签",
        skillTagsUpdateFailedPrefix: "更新技能标签失败: ",
        batchActionRequired: "请至少选择一个整理动作",
        batchOrganized: (count: number) => `已整理 ${count} 个技能`,
        batchOrganizeFailedPrefix: "批量整理失败: ",
      };
}

export type WorkspaceBatchCopy = ReturnType<typeof getWorkspaceBatchCopy>;
export type WorkspacePageCopy = ReturnType<typeof getWorkspacePageCopy>;

export function getWorkspaceFilterSummary(
  search: string,
  selectedTagFilters: string[],
  language: UiLanguage,
) {
  const trimmedSearch = search.trim();
  const parts: string[] = [];
  if (trimmedSearch !== "") {
    parts.push(language === "en-US" ? `keyword "${trimmedSearch}"` : `关键词 "${trimmedSearch}"`);
  }
  if (selectedTagFilters.length > 0) {
    parts.push(
      language === "en-US"
        ? `tags ${selectedTagFilters.join(", ")}`
        : `标签 ${selectedTagFilters.join("、")}`,
    );
  }

  if (parts.length === 0) {
    return null;
  }

  return language === "en-US"
    ? `Filters: ${parts.join(" · ")}`
    : `筛选条件：${parts.join(" · ")}`;
}

export function getWorkspaceEmptyStateMode(
  filteredCount: number,
  itemCount: number,
  activeCategory: string,
  search: string,
  selectedTagFilters: string[],
): EmptyStateMode | undefined {
  if (filteredCount > 0) {
    return undefined;
  }

  if (itemCount === 0 && search.trim() === "" && selectedTagFilters.length === 0) {
    return "no-skills";
  }

  if (activeCategory !== "All" && search.trim() === "" && selectedTagFilters.length === 0) {
    return "empty-category";
  }

  return "no-results";
}

export function buildWorkspaceTagItems(
  availableTags: string[],
  tagUsageMap: Record<string, number>,
  language: UiLanguage,
) {
  return availableTags
    .map((name) => ({
      name,
      usageCount: tagUsageMap[name] ?? 0,
    }))
    .sort((left, right) => {
      if (right.usageCount !== left.usageCount) {
        return right.usageCount - left.usageCount;
      }
      return left.name.localeCompare(right.name, language);
    });
}

export function buildWorkspaceTagUsageMap(input: {
  organizationMode: "local" | "remote";
  remoteTagUsage?: { name: string; usageCount: number }[] | null;
  skillTagMap: Record<string, string[]>;
}) {
  if (input.organizationMode === "remote" && input.remoteTagUsage) {
    return Object.fromEntries(input.remoteTagUsage.map((tag) => [tag.name, tag.usageCount]));
  }

  const next: Record<string, number> = {};
  for (const tags of Object.values(input.skillTagMap)) {
    for (const tag of tags) {
      next[tag] = (next[tag] ?? 0) + 1;
    }
  }

  return next;
}
