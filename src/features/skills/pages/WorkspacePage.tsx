import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import App from "antd/es/app";
import { useI18n } from "@/features/settings/state/I18nContext";
import "@/styles/my-skills.css";
import { BatchOrganizeSkillsModal } from "@/features/skills/components/BatchOrganizeSkillsModal";
import { MySkillsBatchBar } from "@/features/skills/components/my-skills/MySkillsBatchBar";
import { MySkillsCategoryBar } from "@/features/skills/components/my-skills/MySkillsCategoryBar";
import { MySkillsGrid } from "@/features/skills/components/my-skills/MySkillsGrid";
import { MySkillsHeader } from "@/features/skills/components/my-skills/MySkillsHeader";
import { MySkillsToolbar } from "@/features/skills/components/my-skills/MySkillsToolbar";
import { filterMySkillsItems } from "@/features/skills/components/my-skills/mySkillsViewModel";
import { useSkillContext } from "@/features/skills/state/SkillContext";
import type {
  MySkillsSortMode,
  MySkillsViewMode,
} from "@/features/skills/components/my-skills/types";
import { useWorkspaceOrganizationState } from "@/features/skills/hooks/useWorkspaceOrganizationState";
import {
  buildWorkspaceTagItems,
  buildWorkspaceTagUsageMap,
  getWorkspaceBatchCopy,
  getWorkspaceEmptyStateMode,
  getWorkspaceFilterSummary,
  getWorkspacePageCopy,
} from "@/features/skills/model/workspacePagePresentation";
import { CreateCategoryModal } from "../components/CreateCategoryModal";
import { EditSkillTagsModal } from "../components/EditSkillTagsModal";
import { CreateSkillModal } from "../components/CreateSkillModal";
import { ManageCategoriesModal } from "../components/ManageCategoriesModal";
import {
  batchApplySkillOrganization,
  createSkillCollection,
  deleteSkillCollection,
  deleteSkillTag,
  ensureSkillTags,
  updateSkillCollection,
  updateSkillTag,
} from "../api/organizationApi";
import {
  appendTagsToAssignments,
  buildCategoryNavigationItems,
  buildWorkspaceItems,
  clearCategoryAssignments,
  diffTagNames,
  findCaseInsensitiveMatch,
  getContentTitle,
  isCustomCategory,
  normalizeTagNames,
  renameCategoryAssignments,
  renameTagAssignments,
  removeTagsFromAssignments,
  removeTagAssignments,
  type SkillCategoryMap,
} from "../model/workspaceCategories";

export function WorkspacePage() {
  const navigate = useNavigate();
  const { message: appMessage, modal } = App.useApp();
  const { resolvedLanguage } = useI18n();
  const { skills, changeStatusMap, selectSkill, importSkill, createSkill, deleteSkill } = useSkillContext();
  const pageCopy = useMemo(() => getWorkspacePageCopy(resolvedLanguage), [resolvedLanguage]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([]);
  const [sort, setSort] = useState<MySkillsSortMode>("updated");
  const [viewMode, setViewMode] = useState<MySkillsViewMode>("card");
  const {
    categories,
    setCategories,
    skillCategoryMap,
    setSkillCategoryMap,
    availableTags,
    setAvailableTags,
    skillTagMap,
    setSkillTagMap,
    collectionIdByName,
    tagIdByName,
    organizationMode,
    organizationSnapshot,
    refreshOrganizationSnapshot,
  } = useWorkspaceOrganizationState({
    skills,
    pageCopy,
    onMigrationSuccess: appMessage.success,
    onMigrationWarning: appMessage.warning,
  });
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [batchOrganizeOpen, setBatchOrganizeOpen] = useState(false);
  const [batchOrganizeLoading, setBatchOrganizeLoading] = useState(false);
  const [createSkillOpen, setCreateSkillOpen] = useState(false);
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const [creatingSkill, setCreatingSkill] = useState(false);
  const [skillName, setSkillName] = useState("");
  const [skillDescription, setSkillDescription] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState("");
  const [editingSkillTagsId, setEditingSkillTagsId] = useState<string | null>(null);
  const [editingSkillTags, setEditingSkillTags] = useState<string[]>([]);
  const [savingSkillTags, setSavingSkillTags] = useState(false);

  const items = useMemo(
    () => buildWorkspaceItems(skills, changeStatusMap, skillCategoryMap, skillTagMap),
    [changeStatusMap, skillCategoryMap, skillTagMap, skills],
  );
  const filteredItems = useMemo(
    () => filterMySkillsItems(items, activeCategory, search, sort, "all", selectedTagFilters),
    [activeCategory, items, search, selectedTagFilters, sort],
  );
  const categoryItems = useMemo(
    () => buildCategoryNavigationItems(categories, items, resolvedLanguage),
    [categories, items, resolvedLanguage],
  );
  const contentTitle = getContentTitle(activeCategory, resolvedLanguage);
  const customCategories = categories.filter(isCustomCategory);
  const filterSummary = useMemo(
    () => getWorkspaceFilterSummary(search, selectedTagFilters, resolvedLanguage),
    [resolvedLanguage, search, selectedTagFilters],
  );
  const selectedSkillIdSet = useMemo(() => new Set(selectedSkillIds), [selectedSkillIds]);
  const selectedVisibleCount = useMemo(
    () => filteredItems.filter((item) => selectedSkillIdSet.has(item.id)).length,
    [filteredItems, selectedSkillIdSet],
  );
  const batchCopy = useMemo(
    () => getWorkspaceBatchCopy(resolvedLanguage, selectedSkillIds.length, selectedVisibleCount),
    [resolvedLanguage, selectedSkillIds.length, selectedVisibleCount],
  );
  const tagUsageMap = useMemo(() => {
    return buildWorkspaceTagUsageMap({
      organizationMode,
      remoteTagUsage: organizationSnapshot?.tags,
      skillTagMap,
    });
  }, [organizationMode, organizationSnapshot, skillTagMap]);
  const tagItems = useMemo(
    () => buildWorkspaceTagItems(availableTags, tagUsageMap, resolvedLanguage),
    [availableTags, resolvedLanguage, tagUsageMap],
  );
  const editingSkillForTags = useMemo(
    () => items.find((item) => item.id === editingSkillTagsId) ?? null,
    [editingSkillTagsId, items],
  );
  const emptyStateMode = useMemo(
    () => getWorkspaceEmptyStateMode(filteredItems.length, items.length, activeCategory, search, selectedTagFilters),
    [activeCategory, filteredItems.length, items.length, search, selectedTagFilters],
  );

  useEffect(() => {
    setSelectedTagFilters((current) => current.filter((tag) => availableTags.includes(tag)));
  }, [availableTags]);

  useEffect(() => {
    if (activeCategory !== "All" && !categories.includes(activeCategory)) {
      setActiveCategory("All");
    }
  }, [activeCategory, categories]);

  useEffect(() => {
    const validSkillIdSet = new Set(skills.map((skill) => skill.id));

    setSelectedSkillIds((current) => {
      const next = current.filter((skillId) => validSkillIdSet.has(skillId));
      return next.length === current.length ? current : next;
    });
  }, [skills]);

  const handleOpenSkill = (skillId: string | null) => {
    if (!skillId) {
      return;
    }

    selectSkill(skillId);
    navigate(`/workspace/${skillId}`);
  };

  const handleCreateSkill = async () => {
    const name = skillName.trim();
    if (!name) {
      appMessage.error(batchCopy.createSkillNameError);
      return;
    }

    setCreatingSkill(true);
    try {
      await createSkill({
        name,
        description: skillDescription.trim() || undefined,
      });
      setCreateSkillOpen(false);
      setSkillName("");
      setSkillDescription("");
    } catch (error) {
      appMessage.error(`${batchCopy.createFailedPrefix}${error}`);
    } finally {
      setCreatingSkill(false);
    }
  };

  const handleDeleteSkill = (skillId: string) => {
    const targetSkill = skills.find((skill) => skill.id === skillId);
    modal.confirm({
      title: batchCopy.deleteSkillTitle,
      content: pageCopy.deleteSkillContent(targetSkill?.name),
      okText: batchCopy.delete,
      cancelText: batchCopy.cancel,
      okButtonProps: { danger: true },
      onOk: async () => {
        await deleteSkill(skillId);
      },
    });
  };

  const handleAddCategory = async () => {
    const name = categoryName.trim();
    if (!name) {
      appMessage.error(pageCopy.categoryNameRequired);
      return;
    }

    const existingCategory = categories.find((category) => category.toLowerCase() === name.toLowerCase());
    if (existingCategory) {
      setActiveCategory(existingCategory);
      setCategoryName("");
      setCreateCategoryOpen(false);
      appMessage.warning(pageCopy.categoryExists);
      return;
    }

    if (organizationMode === "remote") {
      try {
        const collection = await createSkillCollection({ name });
        await refreshOrganizationSnapshot();
        setActiveCategory(collection.name);
        setCategoryName("");
        setCreateCategoryOpen(false);
        appMessage.success(pageCopy.categoryCreated(collection.name));
      } catch (error) {
        appMessage.error(`${pageCopy.categoryCreateFailedPrefix}${error}`);
      }
      return;
    }

    setCategories((current) => [...current, name]);
    setActiveCategory(name);
    setCategoryName("");
    setCreateCategoryOpen(false);
    appMessage.success(pageCopy.categoryCreated(name));
  };

  const handleAssignCategory = async (skillId: string, category: string | null) => {
    if (organizationMode === "remote") {
      try {
        const collectionId = category ? collectionIdByName[category] : undefined;
        if (category && !collectionId) {
          appMessage.error(pageCopy.targetCategoryMissing);
          return;
        }

        await batchApplySkillOrganization({
          skillIds: [skillId],
          primaryCollectionId: collectionId,
          clearPrimaryCollection: category == null,
        });
        await refreshOrganizationSnapshot();
        appMessage.success(category ? pageCopy.movedToCategory(category) : pageCopy.movedToUnclassified);
      } catch (error) {
        appMessage.error(`${pageCopy.categoryMoveFailedPrefix}${error}`);
      }
      return;
    }

    setSkillCategoryMap((current) => ({
      ...current,
      [skillId]: category,
    }));
    appMessage.success(category ? pageCopy.movedToCategory(category) : pageCopy.movedToUnclassified);
  };

  const handleStartEditCategory = (category: string) => {
    setEditingCategory(category);
    setEditingCategoryName(category);
  };

  const handleCancelEditCategory = () => {
    setEditingCategory(null);
    setEditingCategoryName("");
  };

  const handleStartEditTag = (tagName: string) => {
    setEditingTag(tagName);
    setEditingTagName(tagName);
  };

  const handleCancelEditTag = () => {
    setEditingTag(null);
    setEditingTagName("");
  };

  const handleOpenSkillTagsEditor = (skillId: string) => {
    setEditingSkillTagsId(skillId);
    setEditingSkillTags(skillTagMap[skillId] ?? []);
  };

  const handleCancelSkillTagsEditor = () => {
    if (savingSkillTags) {
      return;
    }

    setEditingSkillTagsId(null);
    setEditingSkillTags([]);
  };

  const handleSaveCategory = async () => {
    if (!editingCategory) {
      return;
    }

    const name = editingCategoryName.trim();
    if (!name) {
      appMessage.error(pageCopy.categoryNameRequired);
      return;
    }

    const existingCategory = categories.find(
      (category) => category !== editingCategory && category.toLowerCase() === name.toLowerCase(),
    );
    if (existingCategory) {
      appMessage.error(pageCopy.categoryNameExists);
      return;
    }

    if (organizationMode === "remote") {
      const collectionId = collectionIdByName[editingCategory];
      if (!collectionId) {
        appMessage.error(pageCopy.editingCategoryMissing);
        return;
      }

      try {
        const collection = await updateSkillCollection({
          collectionId,
          name,
        });
        await refreshOrganizationSnapshot();
        if (activeCategory === editingCategory) {
          setActiveCategory(collection.name);
        }
        handleCancelEditCategory();
        appMessage.success(pageCopy.categoryUpdated(collection.name));
      } catch (error) {
        appMessage.error(`${pageCopy.categoryUpdateFailedPrefix}${error}`);
      }
      return;
    }

    setCategories((current) => current.map((category) => (category === editingCategory ? name : category)));
    setSkillCategoryMap((current) => renameCategoryAssignments(current, editingCategory, name));

    if (activeCategory === editingCategory) {
      setActiveCategory(name);
    }

    handleCancelEditCategory();
    appMessage.success(pageCopy.categoryUpdated(name));
  };

  const handleDeleteCategory = (category: string) => {
    modal.confirm({
      title: pageCopy.deleteCategoryTitle,
      content: pageCopy.deleteCategoryContent(category),
      okText: batchCopy.delete,
      cancelText: batchCopy.cancel,
      okButtonProps: { danger: true },
      onOk: async () => {
        if (organizationMode === "remote") {
          const collectionId = collectionIdByName[category];
          if (!collectionId) {
            appMessage.error(pageCopy.deletingCategoryMissing);
            return;
          }

          await deleteSkillCollection(collectionId);
          await refreshOrganizationSnapshot();
        } else {
          setCategories((current) => current.filter((item) => item !== category));
          setSkillCategoryMap((current) => clearCategoryAssignments(current, category));
        }

        if (activeCategory === category) {
          setActiveCategory("Unclassified");
        }
        if (editingCategory === category) {
          handleCancelEditCategory();
        }
        appMessage.success(pageCopy.categoryDeleted(category));
      },
    });
  };

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name) {
      appMessage.error(pageCopy.tagNameRequired);
      return;
    }

    const existingTag = findCaseInsensitiveMatch(availableTags, name);
    if (existingTag) {
      setNewTagName("");
      appMessage.warning(pageCopy.tagExists);
      return;
    }

    try {
      if (organizationMode === "remote") {
        await ensureSkillTags({ names: [name] });
        await refreshOrganizationSnapshot();
      } else {
        setAvailableTags((current) => normalizeTagNames([...current, name]));
      }

      setNewTagName("");
      appMessage.success(pageCopy.tagCreated(name));
    } catch (error) {
      appMessage.error(`${pageCopy.tagCreateFailedPrefix}${error}`);
    }
  };

  const handleSaveTag = async () => {
    if (!editingTag) {
      return;
    }

    const name = editingTagName.trim();
    if (!name) {
      appMessage.error(pageCopy.tagNameRequired);
      return;
    }

    const existingTag = findCaseInsensitiveMatch(availableTags, name, editingTag);
    if (existingTag) {
      appMessage.error(pageCopy.tagNameExists);
      return;
    }

    try {
      if (organizationMode === "remote") {
        const tagId = tagIdByName[editingTag];
        if (!tagId) {
          appMessage.error(pageCopy.editingTagMissing);
          return;
        }

        await updateSkillTag({
          tagId,
          name,
        });
        await refreshOrganizationSnapshot();
      } else {
        setAvailableTags((current) => current.map((tag) => (tag === editingTag ? name : tag)));
        setSkillTagMap((current) => renameTagAssignments(current, editingTag, name));
      }

      handleCancelEditTag();
      appMessage.success(pageCopy.tagUpdated(name));
    } catch (error) {
      appMessage.error(`${pageCopy.tagUpdateFailedPrefix}${error}`);
    }
  };

  const handleDeleteTag = (tagName: string) => {
    modal.confirm({
      title: pageCopy.deleteTagTitle,
      content: pageCopy.deleteTagContent(tagName),
      okText: batchCopy.delete,
      cancelText: batchCopy.cancel,
      okButtonProps: { danger: true },
      onOk: async () => {
        if (organizationMode === "remote") {
          const tagId = tagIdByName[tagName];
          if (!tagId) {
            appMessage.error(pageCopy.deletingTagMissing);
            return;
          }

          await deleteSkillTag(tagId);
          await refreshOrganizationSnapshot();
        } else {
          setAvailableTags((current) => current.filter((tag) => tag !== tagName));
          setSkillTagMap((current) => removeTagAssignments(current, tagName));
        }

        if (editingTag === tagName) {
          handleCancelEditTag();
        }

        appMessage.success(pageCopy.tagDeleted(tagName));
      },
    });
  };

  const handleSaveSkillTags = async () => {
    if (!editingSkillTagsId) {
      return;
    }

    const nextTags = normalizeTagNames(editingSkillTags);
    const currentTags = skillTagMap[editingSkillTagsId] ?? [];

    setSavingSkillTags(true);
    try {
      if (organizationMode === "remote") {
        const ensuredTags = nextTags.length > 0 ? await ensureSkillTags({ names: nextTags }) : [];
        const ensuredTagIdByName = Object.fromEntries(ensuredTags.map((tag) => [tag.name, tag.id]));
        const { add, remove } = diffTagNames(currentTags, nextTags);
        const addTagIds = add
          .map((tagName) => ensuredTagIdByName[tagName] ?? tagIdByName[tagName])
          .filter((tagId): tagId is string => Boolean(tagId));
        const removeTagIds = remove
          .map((tagName) => tagIdByName[tagName])
          .filter((tagId): tagId is string => Boolean(tagId));

        if (addTagIds.length > 0 || removeTagIds.length > 0) {
          await batchApplySkillOrganization({
            skillIds: [editingSkillTagsId],
            addTagIds,
            removeTagIds,
          });
          await refreshOrganizationSnapshot();
        }
      } else {
        setAvailableTags((current) => normalizeTagNames([...current, ...nextTags]));
        setSkillTagMap((current) => ({
          ...current,
          [editingSkillTagsId]: nextTags,
        }));
      }

      handleCancelSkillTagsEditor();
      appMessage.success(pageCopy.skillTagsUpdated);
    } catch (error) {
      appMessage.error(`${pageCopy.skillTagsUpdateFailedPrefix}${error}`);
    } finally {
      setSavingSkillTags(false);
    }
  };

  const handleToggleSkillSelection = (skillId: string, checked: boolean) => {
    setSelectedSkillIds((current) => {
      if (checked) {
        return current.includes(skillId) ? current : [...current, skillId];
      }

      return current.filter((id) => id !== skillId);
    });
  };

  const handleToggleAllVisible = (checked: boolean) => {
    const visibleSkillIds = filteredItems.map((item) => item.id);
    const visibleSkillIdSet = new Set(visibleSkillIds);

    setSelectedSkillIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, ...visibleSkillIds]));
      }

      return current.filter((skillId) => !visibleSkillIdSet.has(skillId));
    });
  };

  const handleBatchOrganize = async (input: {
    categoryName?: string | null;
    clearCategory: boolean;
    addTagNames: string[];
    removeTagNames: string[];
  }) => {
    const addTagNames = normalizeTagNames(input.addTagNames);
    const removeTagNames = normalizeTagNames(input.removeTagNames).filter((tag) => !addTagNames.includes(tag));
    const shouldApplyCategory = Boolean(input.categoryName) || input.clearCategory;

    if (!shouldApplyCategory && addTagNames.length === 0 && removeTagNames.length === 0) {
      appMessage.warning(pageCopy.batchActionRequired);
      return;
    }

    setBatchOrganizeLoading(true);
    try {
      if (organizationMode === "remote") {
        const primaryCollectionId = input.categoryName ? collectionIdByName[input.categoryName] : undefined;
        if (input.categoryName && !primaryCollectionId) {
          appMessage.error(pageCopy.targetCategoryMissing);
          return;
        }

        const ensuredTags = addTagNames.length > 0 ? await ensureSkillTags({ names: addTagNames }) : [];
        const removeTagIds = removeTagNames
          .map((tagName) => tagIdByName[tagName])
          .filter((tagId): tagId is string => Boolean(tagId));
        await batchApplySkillOrganization({
          skillIds: selectedSkillIds,
          primaryCollectionId,
          clearPrimaryCollection: input.clearCategory,
          addTagIds: ensuredTags.map((tag) => tag.id),
          removeTagIds,
        });
        await refreshOrganizationSnapshot();
      } else {
        if (shouldApplyCategory) {
          setSkillCategoryMap((current) => {
            const next: SkillCategoryMap = { ...current };
            for (const skillId of selectedSkillIds) {
              next[skillId] = input.clearCategory ? null : input.categoryName ?? next[skillId] ?? null;
            }
            return next;
          });
        }

        if (addTagNames.length > 0) {
          setAvailableTags((current) => normalizeTagNames([...current, ...addTagNames]));
          setSkillTagMap((current) => appendTagsToAssignments(current, selectedSkillIds, addTagNames));
        }

        if (removeTagNames.length > 0) {
          setSkillTagMap((current) => removeTagsFromAssignments(current, selectedSkillIds, removeTagNames));
        }
      }

      setBatchOrganizeOpen(false);
      setSelectedSkillIds([]);
      appMessage.success(pageCopy.batchOrganized(selectedSkillIds.length));
    } catch (error) {
      appMessage.error(`${pageCopy.batchOrganizeFailedPrefix}${error}`);
    } finally {
      setBatchOrganizeLoading(false);
    }
  };

  const handleImportSkill = () => void importSkill();

  const handleCategoryChange = (category: string) => {
    setActiveCategory(category);
  };

  return (
    <div className="my-skills-page">
      <section className="my-skills-page__workspace">
        <MySkillsHeader
          onNewSkill={() => setCreateSkillOpen(true)}
          onImportSkill={handleImportSkill}
          onNewCategory={() => setCreateCategoryOpen(true)}
          onManageCategories={() => setManageCategoriesOpen(true)}
        />

        <section className="my-skills-page__controls">
          <MySkillsCategoryBar
            categoryItems={categoryItems}
            activeCategory={activeCategory}
            onChange={handleCategoryChange}
          />
          <MySkillsToolbar
            search={search}
            onSearchChange={setSearch}
            selectedTags={selectedTagFilters}
            tagOptions={availableTags}
            onSelectedTagsChange={setSelectedTagFilters}
            sort={sort}
            onSortChange={setSort}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        </section>
      </section>

      <div className="my-skills-page__body">
        <MySkillsBatchBar
          copy={batchCopy}
          selectedCount={selectedSkillIds.length}
          selectedVisibleCount={selectedVisibleCount}
          onClear={() => setSelectedSkillIds([])}
          onApply={() => setBatchOrganizeOpen(true)}
        />

        <MySkillsGrid
          items={filteredItems}
          categories={categories}
          selectedSkillIds={selectedSkillIds}
          sort={sort}
          onSortChange={setSort}
          viewMode={viewMode}
          title={contentTitle}
          count={filteredItems.length}
          filterSummary={filterSummary}
          emptyStateMode={emptyStateMode}
          onOpenSkill={handleOpenSkill}
          onToggleSkillSelection={handleToggleSkillSelection}
          onToggleAllVisible={handleToggleAllVisible}
          onDeleteSkill={handleDeleteSkill}
          onAssignCategory={handleAssignCategory}
          onEditTags={handleOpenSkillTagsEditor}
          onCreateSkill={() => setCreateSkillOpen(true)}
          onImportSkill={handleImportSkill}
          onResetFilters={() => {
            setActiveCategory("All");
            setSearch("");
            setSelectedTagFilters([]);
          }}
        />
      </div>

      <CreateSkillModal
        open={createSkillOpen}
        loading={creatingSkill}
        skillName={skillName}
        skillDescription={skillDescription}
        onSkillNameChange={setSkillName}
        onSkillDescriptionChange={setSkillDescription}
        onSubmit={() => void handleCreateSkill()}
        onCancel={() => {
          setCreateSkillOpen(false);
          setSkillName("");
          setSkillDescription("");
        }}
      />

      <CreateCategoryModal
        open={createCategoryOpen}
        categoryName={categoryName}
        onCategoryNameChange={setCategoryName}
        onSubmit={() => void handleAddCategory()}
        onCancel={() => {
          setCreateCategoryOpen(false);
          setCategoryName("");
        }}
      />

      <ManageCategoriesModal
        open={manageCategoriesOpen}
        categories={customCategories}
        editingCategory={editingCategory}
        editingCategoryName={editingCategoryName}
        onEditingCategoryNameChange={setEditingCategoryName}
        onStartEdit={handleStartEditCategory}
        onSave={() => void handleSaveCategory()}
        onCancelEdit={handleCancelEditCategory}
        onDelete={handleDeleteCategory}
        tags={tagItems}
        newTagName={newTagName}
        editingTag={editingTag}
        editingTagName={editingTagName}
        onNewTagNameChange={setNewTagName}
        onEditingTagNameChange={setEditingTagName}
        onCreateTag={() => void handleCreateTag()}
        onStartEditTag={handleStartEditTag}
        onSaveTag={() => void handleSaveTag()}
        onCancelEditTag={handleCancelEditTag}
        onDeleteTag={handleDeleteTag}
        onCancel={() => {
          setManageCategoriesOpen(false);
          handleCancelEditCategory();
          handleCancelEditTag();
          setNewTagName("");
        }}
      />

      {editingSkillForTags ? (
        <EditSkillTagsModal
          open={editingSkillTagsId != null}
          loading={savingSkillTags}
          skillName={editingSkillForTags.name}
          tagOptions={availableTags}
          selectedTags={editingSkillTags}
          onSelectedTagsChange={setEditingSkillTags}
          onSubmit={() => void handleSaveSkillTags()}
          onCancel={handleCancelSkillTagsEditor}
        />
      ) : null}

      <BatchOrganizeSkillsModal
        open={batchOrganizeOpen}
        loading={batchOrganizeLoading}
        selectedCount={selectedSkillIds.length}
        categories={customCategories}
        tagOptions={availableTags}
        onSubmit={(input) => void handleBatchOrganize(input)}
        onCancel={() => {
          if (batchOrganizeLoading) {
            return;
          }
          setBatchOrganizeOpen(false);
        }}
      />
    </div>
  );
}
