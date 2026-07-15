import Button from "antd/es/button";
import Checkbox from "antd/es/checkbox";
import Dropdown from "antd/es/dropdown";
import Tag from "antd/es/tag";
import Tooltip from "antd/es/tooltip";
import type { MenuProps } from "antd";
import { MoreHorizontal } from "lucide-react";
import { useI18n } from "@/features/settings/state/I18nContext";
import { formatMySkillUpdatedAt, getMySkillCategoryLabel, getMySkillSourceLabel } from "./presentation";
import type { MySkillItem, MySkillsSortMode } from "./types";

interface MySkillsListProps {
  items: MySkillItem[];
  categories: string[];
  selectedSkillIds: string[];
  sort: MySkillsSortMode;
  onSortChange: (sort: MySkillsSortMode) => void;
  onToggleSkillSelection: (skillId: string, checked: boolean) => void;
  onToggleAllVisible: (checked: boolean) => void;
  isStickyActive?: boolean;
  onOpenSkill: (skillId: string | null) => void;
  onDeleteSkill?: (skillId: string) => void;
  onAssignCategory?: (skillId: string, category: string | null) => void;
  onEditTags?: (skillId: string) => void;
}

export function MySkillsList({
  items,
  categories,
  selectedSkillIds,
  sort,
  onSortChange,
  onToggleSkillSelection,
  onToggleAllVisible,
  isStickyActive = false,
  onOpenSkill,
  onDeleteSkill,
  onAssignCategory,
  onEditTags,
}: MySkillsListProps) {
  const { resolvedLanguage } = useI18n();
  const copy = resolvedLanguage === "en-US"
    ? {
        selectCurrent: "Select current results",
        sortByName: "Sort by skill name",
        skill: "Skill",
        source: "Source",
        sortByUpdated: "Sort by last updated",
        updated: "Updated",
        status: "Status",
        more: "More",
      }
    : {
        selectCurrent: "选择当前结果",
        sortByName: "按技能名称排序",
        skill: "技能",
        source: "来源",
        sortByUpdated: "按最近更新排序",
        updated: "最近更新",
        status: "状态",
        more: "更多",
      };
  const selectedSkillIdSet = new Set(selectedSkillIds);
  const selectedVisibleCount = items.filter((item) => selectedSkillIdSet.has(item.id)).length;
  const allVisibleSelected = items.length > 0 && selectedVisibleCount === items.length;
  const partiallySelected = selectedVisibleCount > 0 && selectedVisibleCount < items.length;
  const skillSortDirection = sort === "name-asc" ? "ascending" : sort === "name-desc" ? "descending" : undefined;
  const updatedSortDirection = sort === "updated" ? "descending" : sort === "updated-asc" ? "ascending" : undefined;
  const handleSkillSortToggle = () => {
    onSortChange(sort === "name-asc" ? "name-desc" : "name-asc");
  };

  const handleUpdatedSort = () => {
    onSortChange(sort === "updated" ? "updated-asc" : "updated");
  };

  return (
    <div className={`my-skills-table-wrap${isStickyActive ? " is-sticky-active" : ""}`}>
      <table className="my-skills-table">
        <colgroup>
          <col className="my-skills-table__col my-skills-table__col--select" />
          <col className="my-skills-table__col my-skills-table__col--skill" />
          <col className="my-skills-table__col my-skills-table__col--source" />
          <col className="my-skills-table__col my-skills-table__col--updated" />
          <col className="my-skills-table__col my-skills-table__col--status" />
          <col className="my-skills-table__col my-skills-table__col--action" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="my-skills-table__select-head">
              <Checkbox
                checked={allVisibleSelected}
                indeterminate={partiallySelected}
                aria-label={copy.selectCurrent}
                onChange={(event) => onToggleAllVisible(event.target.checked)}
              />
            </th>
            <th
              scope="col"
              className={`my-skills-table__skill-head${skillSortDirection ? " is-sort-active" : ""}`}
              aria-sort={skillSortDirection}
            >
              <button type="button" className="my-skills-table__sort-button" onClick={handleSkillSortToggle} aria-label={copy.sortByName}>
                <span className="my-skills-table__head-label">
                  <span className="my-skills-table__head-text">{copy.skill}</span>
                  <span className="my-skills-table__sort-pair" aria-hidden="true">
                    <span className={`my-skills-table__sort-triangle my-skills-table__sort-triangle--up${skillSortDirection === "ascending" ? " is-active" : ""}`} />
                    <span className={`my-skills-table__sort-triangle my-skills-table__sort-triangle--down${skillSortDirection === "descending" ? " is-active" : ""}`} />
                  </span>
                </span>
              </button>
            </th>
            <th scope="col" className="my-skills-table__meta-head my-skills-table__meta-head--source">
              <span className="my-skills-table__head-label">{copy.source}</span>
            </th>
            <th
              scope="col"
              className={`my-skills-table__meta-head my-skills-table__meta-head--updated${updatedSortDirection ? " is-sort-active" : ""}`}
              aria-sort={updatedSortDirection}
            >
              <button type="button" className="my-skills-table__sort-button" onClick={handleUpdatedSort} aria-label={copy.sortByUpdated}>
                <span className="my-skills-table__head-label">
                  <span className="my-skills-table__head-text">{copy.updated}</span>
                  <span className="my-skills-table__sort-pair" aria-hidden="true">
                    <span className={`my-skills-table__sort-triangle my-skills-table__sort-triangle--up${updatedSortDirection === "ascending" ? " is-active" : ""}`} />
                    <span className={`my-skills-table__sort-triangle my-skills-table__sort-triangle--down${updatedSortDirection === "descending" ? " is-active" : ""}`} />
                  </span>
                </span>
              </button>
            </th>
            <th scope="col" className="my-skills-table__status-head">
              <span className="my-skills-table__head-label">{copy.status}</span>
            </th>
            <th scope="col" className="my-skills-table__action-head">
              <span className="my-skills-table__head-label my-skills-table__head-label--action">{copy.more}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <MySkillsListRow
              key={item.id}
              item={item}
              categories={categories}
              selected={selectedSkillIdSet.has(item.id)}
              onToggleSelect={onToggleSkillSelection}
              onOpenSkill={onOpenSkill}
              onDeleteSkill={onDeleteSkill}
              onAssignCategory={onAssignCategory}
              onEditTags={onEditTags}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface MySkillsListRowProps {
  item: MySkillItem;
  categories: string[];
  selected?: boolean;
  onToggleSelect?: (skillId: string, checked: boolean) => void;
  onOpenSkill: (skillId: string | null) => void;
  onDeleteSkill?: (skillId: string) => void;
  onAssignCategory?: (skillId: string, category: string | null) => void;
  onEditTags?: (skillId: string) => void;
}

function MySkillsListRow({
  item,
  categories,
  selected = false,
  onToggleSelect,
  onOpenSkill,
  onDeleteSkill,
  onAssignCategory,
  onEditTags,
}: MySkillsListRowProps) {
  const { resolvedLanguage } = useI18n();
  const copy = resolvedLanguage === "en-US"
    ? {
        deleteSkill: "Delete Skill",
        moveCategory: "Move to Category",
        editTags: "Edit Tags",
        uncategorized: "Uncategorized",
        open: `Open ${item.name}`,
        select: `Select ${item.name}`,
        changed: "Changed",
        needsDescription: "Needs Description",
        actions: `${item.name} actions`,
      }
    : {
        deleteSkill: "删除技能",
        moveCategory: "移动到分类",
        editTags: "编辑标签",
        uncategorized: "未分类",
        open: `打开 ${item.name}`,
        select: `选择 ${item.name}`,
        changed: "有改动",
        needsDescription: "待补描述",
        actions: `${item.name} 操作`,
      };
  const categoryLabel = getMySkillCategoryLabel(item.category ?? "Unclassified", resolvedLanguage);
  const sourceLabel = getMySkillSourceLabel(item.sourceType, resolvedLanguage);
  const customCategories = categories.filter((category) => category !== "All" && category !== "Unclassified");

  const actionItems: MenuProps["items"] = [
    {
      key: "assign-category",
      label: copy.moveCategory,
      popupClassName: "my-skills-action-menu__submenu",
      children: [
        {
          key: "assign-unclassified",
          label: copy.uncategorized,
          disabled: item.category == null,
          onClick: () => onAssignCategory?.(item.id, null),
        },
        ...customCategories.map((category) => ({
          key: `assign-${category}`,
          label: getMySkillCategoryLabel(category, resolvedLanguage),
          disabled: item.category === category,
          onClick: () => onAssignCategory?.(item.id, category),
        })),
      ],
    },
    {
      key: "edit-tags",
      label: copy.editTags,
      onClick: () => onEditTags?.(item.id),
    },
    {
      key: "delete",
      label: copy.deleteSkill,
      danger: true,
      onClick: () => onDeleteSkill?.(item.id),
    },
  ];

  return (
    <tr
      className={`my-skills-table__row${selected ? " is-selected" : ""}`}
      tabIndex={0}
      aria-label={copy.open}
      onClick={() => onOpenSkill(item.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenSkill(item.id);
        }
      }}
    >
      <td className="my-skills-table__select-cell" onClick={(event) => event.stopPropagation()}>
        <Checkbox
          checked={selected}
          aria-label={copy.select}
          onChange={(event) => onToggleSelect?.(item.id, event.target.checked)}
        />
      </td>
      <td className="my-skills-table__skill-cell">
        <div className="my-skills-table__skill-main">
          <Tooltip title={item.name} mouseEnterDelay={0.35}>
            <span className="my-skills-table__name">{item.name}</span>
          </Tooltip>
        </div>
      </td>
      <td className="my-skills-table__meta-cell my-skills-table__meta-cell--source">
        <span className="my-skills-table__source">{sourceLabel}</span>
      </td>
      <td className="my-skills-table__meta-cell my-skills-table__meta-cell--updated">
        {formatMySkillUpdatedAt(item.updatedAt, resolvedLanguage)}
      </td>
      <td className="my-skills-table__status-cell">
        <div className="my-skills-table__status-list">
          <Tag
            bordered={false}
            className={`my-skills-table__status-tag${item.category == null ? " is-neutral" : ""}`}
          >
            {categoryLabel}
          </Tag>
          {item.hasChanges ? (
            <Tag bordered={false} className="my-skills-table__status-tag is-success">
              {copy.changed}
            </Tag>
          ) : null}
          {item.needsDescription ? (
            <Tag bordered={false} className="my-skills-table__status-tag is-warning">
              {copy.needsDescription}
            </Tag>
          ) : null}
          {item.tags.slice(0, 2).map((tag) => (
            <Tag key={tag} bordered={false} className="my-skills-table__status-tag">
              {tag}
            </Tag>
          ))}
        </div>
      </td>
      <td className="my-skills-table__action-cell">
        <Dropdown menu={{ items: actionItems }} trigger={["click"]} overlayClassName="my-skills-action-menu">
          <Button
            type="text"
            size="small"
            className="my-skills-table__menu"
            aria-label={copy.actions}
            icon={<MoreHorizontal size={15} />}
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
          />
        </Dropdown>
      </td>
    </tr>
  );
}
