import { useEffect, useRef, useState, type UIEvent } from "react";
import Button from "antd/es/button";
import { ArrowLeft, Import, Plus } from "lucide-react";
import { useI18n } from "@/features/settings/state/I18nContext";
import { MySkillCard } from "./MySkillCard";
import { MySkillsList } from "./MySkillsList";
import type { EmptyStateMode, MySkillItem, MySkillsSortMode, MySkillsViewMode } from "./types";

interface MySkillsGridProps {
  items: MySkillItem[];
  categories: string[];
  selectedSkillIds: string[];
  sort: MySkillsSortMode;
  onSortChange: (sort: MySkillsSortMode) => void;
  viewMode: MySkillsViewMode;
  title?: string;
  count?: number;
  filterSummary?: string | null;
  emptyStateMode?: EmptyStateMode;
  onOpenSkill: (skillId: string | null) => void;
  onToggleSkillSelection: (skillId: string, checked: boolean) => void;
  onToggleAllVisible: (checked: boolean) => void;
  onDeleteSkill?: (skillId: string) => void;
  onAssignCategory?: (skillId: string, category: string | null) => void;
  onEditTags?: (skillId: string) => void;
  onCreateSkill: () => void;
  onImportSkill: () => void;
  onResetFilters: () => void;
}

export function MySkillsGrid({
  items,
  categories,
  selectedSkillIds,
  sort,
  onSortChange,
  viewMode,
  title = "全部技能",
  count = items.length,
  filterSummary,
  emptyStateMode = "no-results",
  onOpenSkill,
  onToggleSkillSelection,
  onToggleAllVisible,
  onDeleteSkill,
  onAssignCategory,
  onEditTags,
  onCreateSkill,
  onImportSkill,
  onResetFilters,
}: MySkillsGridProps) {
  const { resolvedLanguage } = useI18n();
  const copy = resolvedLanguage === "en-US"
    ? {
        countSuffix: "items",
        emptyEyebrowStart: "Start building the library",
        emptyTitleStart: "Bring your first skill into the workspace",
        emptyDescriptionStart: "There are no managed skills yet. You can create one from scratch or import an existing one.",
        newSkill: "New Skill",
        importSkill: "Import Skill",
        emptyEyebrowCategory: "Category is empty",
        emptyTitleCategoryPrefix: "No skills in ",
        emptyDescriptionCategory: "This category already exists, but nothing has been placed into it yet. Return to the full scope and continue organizing.",
        backAll: "Back to All",
        emptyEyebrowSearch: "No results",
        emptyTitleSearch: "No skills match the current filters",
        emptyDescriptionSearch: "Adjust the search or category filters above and continue browsing the existing skill assets.",
      }
    : {
        countSuffix: "项",
        emptyEyebrowStart: "开始建立资产库",
        emptyTitleStart: "把第一个技能放进工作区",
        emptyDescriptionStart: "当前还没有可管理的技能。你可以从零创建，或者先把已有技能导入进来。",
        newSkill: "新建技能",
        importSkill: "导入技能",
        emptyEyebrowCategory: "分类暂时为空",
        emptyTitleCategoryPrefix: "",
        emptyDescriptionCategory: "这个分类已经建立，但当前没有收纳任何技能。先回到全部范围，再继续整理现有资产。",
        backAll: "返回全部",
        emptyEyebrowSearch: "没有匹配结果",
        emptyTitleSearch: "当前筛选下没有找到技能",
        emptyDescriptionSearch: "可以调整上方的搜索或分类条件，再继续查看现有技能资产。",
      };
  const isListView = viewMode === "list";
  const contentMode = items.length === 0 ? "empty" : viewMode;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [isListStickyActive, setIsListStickyActive] = useState(false);

  useEffect(() => {
    if (!isListView) {
      setIsListStickyActive(false);
      return;
    }

    setIsListStickyActive((viewportRef.current?.scrollTop ?? 0) > 4);
  }, [filterSummary, isListView, items.length, sort, title]);

  const handleViewportScroll = (event: UIEvent<HTMLDivElement>) => {
    if (!isListView) {
      return;
    }

    const nextStickyActive = event.currentTarget.scrollTop > 4;
    setIsListStickyActive((current) => (current === nextStickyActive ? current : nextStickyActive));
  };

  return (
    <section className={`my-skills-grid my-skills-grid--${viewMode}${items.length === 0 ? " my-skills-grid--empty" : ""}`}>
      <div className="my-skills-grid__header">
        <div className="my-skills-grid__heading">
          <div className="my-skills-grid__heading-main">
            <h2>{title}</h2>
            <span className="my-skills-grid__count">{count} {copy.countSuffix}</span>
          </div>
          {filterSummary ? <p className="my-skills-grid__context">{filterSummary}</p> : null}
        </div>
      </div>
      <div
        ref={viewportRef}
        className={`my-skills-grid__viewport my-skills-grid__viewport--${contentMode}`}
        onScroll={handleViewportScroll}
      >
        {items.length === 0 ? (
          <MySkillsEmptyState
            mode={emptyStateMode}
            title={title}
            copy={copy}
            onCreateSkill={onCreateSkill}
            onImportSkill={onImportSkill}
            onResetFilters={onResetFilters}
          />
        ) : isListView ? (
          <MySkillsList
            items={items}
            categories={categories}
            selectedSkillIds={selectedSkillIds}
            sort={sort}
            onSortChange={onSortChange}
            onToggleSkillSelection={onToggleSkillSelection}
            onToggleAllVisible={onToggleAllVisible}
            isStickyActive={isListStickyActive}
            onOpenSkill={onOpenSkill}
            onDeleteSkill={onDeleteSkill}
            onAssignCategory={onAssignCategory}
            onEditTags={onEditTags}
          />
        ) : (
          <div className="my-skills-grid__items">
            {items.map((item) => (
              <MySkillCard
                key={item.id}
                item={item}
                categories={categories}
                selected={selectedSkillIds.includes(item.id)}
                onToggleSelect={onToggleSkillSelection}
                onOpenSkill={onOpenSkill}
                onDeleteSkill={onDeleteSkill}
                onAssignCategory={onAssignCategory}
                onEditTags={onEditTags}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

interface MySkillsEmptyStateProps {
  mode: EmptyStateMode;
  title: string;
  copy: {
    emptyEyebrowStart: string;
    emptyTitleStart: string;
    emptyDescriptionStart: string;
    newSkill: string;
    importSkill: string;
    emptyEyebrowCategory: string;
    emptyTitleCategoryPrefix: string;
    emptyDescriptionCategory: string;
    backAll: string;
    emptyEyebrowSearch: string;
    emptyTitleSearch: string;
    emptyDescriptionSearch: string;
  };
  onCreateSkill: () => void;
  onImportSkill: () => void;
  onResetFilters: () => void;
}

function MySkillsEmptyState({ mode, title, copy, onCreateSkill, onImportSkill, onResetFilters }: MySkillsEmptyStateProps) {
  if (mode === "no-skills") {
    return (
      <div className="my-skills-grid__empty">
        <div className="my-skills-grid__empty-panel">
          <span className="my-skills-grid__empty-eyebrow">{copy.emptyEyebrowStart}</span>
          <h3 className="my-skills-grid__empty-title">{copy.emptyTitleStart}</h3>
          <p className="my-skills-grid__empty-description">{copy.emptyDescriptionStart}</p>
          <div className="my-skills-grid__empty-actions">
            <Button
              className="my-skills-grid__empty-action my-skills-grid__empty-action--primary"
              icon={<Plus size={14} />}
              onClick={onCreateSkill}
            >
              {copy.newSkill}
            </Button>
            <Button className="my-skills-grid__empty-action" icon={<Import size={14} />} onClick={onImportSkill}>
              {copy.importSkill}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "empty-category") {
    return (
      <div className="my-skills-grid__empty">
        <div className="my-skills-grid__empty-panel">
          <span className="my-skills-grid__empty-eyebrow">{copy.emptyEyebrowCategory}</span>
          <h3 className="my-skills-grid__empty-title">
            {copy.emptyTitleCategoryPrefix
              ? `${copy.emptyTitleCategoryPrefix}${title}`
              : `${title} 里还没有技能`}
          </h3>
          <p className="my-skills-grid__empty-description">{copy.emptyDescriptionCategory}</p>
          <div className="my-skills-grid__empty-actions">
            <Button className="my-skills-grid__empty-action" icon={<ArrowLeft size={14} />} onClick={onResetFilters}>
              {copy.backAll}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="my-skills-grid__empty">
      <div className="my-skills-grid__empty-panel">
        <span className="my-skills-grid__empty-eyebrow">{copy.emptyEyebrowSearch}</span>
        <h3 className="my-skills-grid__empty-title">{copy.emptyTitleSearch}</h3>
        <p className="my-skills-grid__empty-description">{copy.emptyDescriptionSearch}</p>
      </div>
    </div>
  );
}
