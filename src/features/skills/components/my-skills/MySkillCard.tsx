import Button from "antd/es/button";
import Checkbox from "antd/es/checkbox";
import Dropdown from "antd/es/dropdown";
import Tag from "antd/es/tag";
import Tooltip from "antd/es/tooltip";
import type { MenuProps } from "antd";
import { MoreHorizontal } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { useI18n } from "@/features/settings/state/I18nContext";
import {
  getMySkillDescriptionCopy,
  formatMySkillUpdatedAt,
  getMySkillCategoryLabel,
  getMySkillSourceLabel,
} from "./presentation";
import { DEFAULT_VISIBLE_TAG_COUNT, resolveVisibleTagCount } from "./tagVisibility";
import type { MySkillItem } from "./types";

interface MySkillCardProps {
  item: MySkillItem;
  categories: string[];
  selected?: boolean;
  onToggleSelect?: (skillId: string, checked: boolean) => void;
  onOpenSkill: (skillId: string | null) => void;
  onDeleteSkill?: (skillId: string) => void;
  onAssignCategory?: (skillId: string, category: string | null) => void;
  onEditTags?: (skillId: string) => void;
}

export function MySkillCard({
  item,
  categories,
  selected = false,
  onToggleSelect,
  onOpenSkill,
  onDeleteSkill,
  onAssignCategory,
  onEditTags,
}: MySkillCardProps) {
  const tagListRef = useRef<HTMLSpanElement | null>(null);
  const { resolvedLanguage } = useI18n();
  const [visibleTagCount, setVisibleTagCount] = useState(() => Math.min(item.tags.length, DEFAULT_VISIBLE_TAG_COUNT));
  const copy = resolvedLanguage === "en-US"
    ? {
        deleteSkill: "Delete Skill",
        moveCategory: "Move to Category",
        editTags: "Edit Tags",
        uncategorized: "Uncategorized",
        changed: "Changed",
        needsDescription: "Needs Description",
        select: `Select ${item.name}`,
        actions: `${item.name} actions`,
        open: `Open ${item.name}`,
        updated: "Updated",
      }
    : {
        deleteSkill: "删除技能",
        moveCategory: "移动到分类",
        editTags: "编辑标签",
        uncategorized: "未分类",
        changed: "有改动",
        needsDescription: "待补描述",
        select: `选择 ${item.name}`,
        actions: `${item.name} 操作`,
        open: `打开 ${item.name}`,
        updated: "更新",
      };
  const categoryLabel = getMySkillCategoryLabel(item.category ?? "Unclassified", resolvedLanguage);
  const sourceLabel = getMySkillSourceLabel(item.sourceType, resolvedLanguage);
  const descriptionCopy = getMySkillDescriptionCopy(item, resolvedLanguage);
  const customCategories = categories.filter((category) => category !== "All" && category !== "Unclassified");
  const safeVisibleTagCount = item.tags.length === 0
    ? 0
    : Math.max(1, Math.min(item.tags.length, visibleTagCount));
  const visibleTags = item.tags.slice(0, safeVisibleTagCount);
  const hiddenTagCount = Math.max(item.tags.length - safeVisibleTagCount, 0);

  useLayoutEffect(() => {
    if (item.tags.length === 0) {
      setVisibleTagCount(0);
      return undefined;
    }

    const measureVisibleTags = () => {
      const container = tagListRef.current;

      if (!container || typeof document === "undefined") {
        return;
      }

      const measureRoot = document.createElement("div");
      measureRoot.style.position = "absolute";
      measureRoot.style.top = "-9999px";
      measureRoot.style.left = "-9999px";
      measureRoot.style.visibility = "hidden";
      measureRoot.style.pointerEvents = "none";
      measureRoot.style.display = "inline-flex";
      measureRoot.style.alignItems = "center";
      measureRoot.style.gap = "6px";
      measureRoot.style.whiteSpace = "nowrap";

      const tagWidths: number[] = [];
      const summaryWidths = new Map<number, number>();

      document.body.appendChild(measureRoot);

      try {
        for (const tag of item.tags) {
          const tagNode = document.createElement("span");
          tagNode.className = "ant-tag my-skill-card__tag";
          tagNode.textContent = tag;
          measureRoot.appendChild(tagNode);
          tagWidths.push(tagNode.getBoundingClientRect().width);
        }

        for (let hiddenCount = 1; hiddenCount < item.tags.length; hiddenCount += 1) {
          const summaryNode = document.createElement("span");
          summaryNode.className = "ant-tag my-skill-card__tag my-skill-card__tag--summary";
          summaryNode.textContent = `+${hiddenCount}`;
          measureRoot.appendChild(summaryNode);
          summaryWidths.set(hiddenCount, summaryNode.getBoundingClientRect().width);
        }
      } finally {
        measureRoot.remove();
      }

      const nextVisibleTagCount = resolveVisibleTagCount({
        containerWidth: container.getBoundingClientRect().width,
        tagWidths,
        summaryWidths,
        gap: 6,
      });

      setVisibleTagCount((current) => (current === nextVisibleTagCount ? current : nextVisibleTagCount));
    };

    measureVisibleTags();

    if (typeof ResizeObserver === "undefined" || !tagListRef.current) {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      measureVisibleTags();
    });

    observer.observe(tagListRef.current);

    return () => {
      observer.disconnect();
    };
  }, [item.tags]);

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
    <article className={`my-skill-card${selected ? " is-selected" : ""}`}>
      <div className="my-skill-card__header">
        <span className="my-skill-card__status">
          <Checkbox
            checked={selected}
            aria-label={copy.select}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => onToggleSelect?.(item.id, event.target.checked)}
          />
          <Tag
            bordered={false}
            className={`my-skill-card__badge${item.category == null ? " is-neutral" : ""}`}
          >
            {categoryLabel}
          </Tag>
          {item.hasChanges ? (
            <Tag bordered={false} className="my-skill-card__badge is-success">
              {copy.changed}
            </Tag>
          ) : null}
          {item.needsDescription ? (
            <Tag bordered={false} className="my-skill-card__badge is-warning">
              {copy.needsDescription}
            </Tag>
          ) : null}
        </span>
        <Dropdown menu={{ items: actionItems }} trigger={["click"]} overlayClassName="my-skills-action-menu">
          <Button
            type="text"
            size="small"
            className="my-skill-card__menu"
            aria-label={copy.actions}
            icon={<MoreHorizontal size={15} />}
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
          />
        </Dropdown>
      </div>

      <button type="button" className="my-skill-card__surface" aria-label={copy.open} onClick={() => onOpenSkill(item.id)}>
        <span className="my-skill-card__body">
          <Tooltip title={item.name} mouseEnterDelay={0.35}>
            <span className="my-skill-card__title">{item.name}</span>
          </Tooltip>
          <span className="my-skill-card__description-slot">
            <span className={`my-skill-card__description${item.needsDescription ? " is-placeholder" : ""}`}>
              {descriptionCopy}
            </span>
          </span>
          <span ref={tagListRef} className="my-skill-card__tag-list" aria-hidden={item.tags.length === 0}>
            {visibleTags.map((tag) => (
              <Tag key={tag} bordered={false} className="my-skill-card__tag">
                {tag}
              </Tag>
            ))}
            {hiddenTagCount > 0 ? (
              <Tag bordered={false} className="my-skill-card__tag my-skill-card__tag--summary">
                +{hiddenTagCount}
              </Tag>
            ) : null}
          </span>
        </span>
        <span className="my-skill-card__footer">
          <span className="my-skill-card__meta-list">
            <span className="my-skill-card__source">{sourceLabel}</span>
            <span className="my-skill-card__meta">{copy.updated} {formatMySkillUpdatedAt(item.updatedAt, resolvedLanguage)}</span>
          </span>
        </span>
      </button>
    </article>
  );
}
