import { useLayoutEffect, useMemo, useRef, useState } from "react";
import Dropdown from "antd/es/dropdown";
import type { MenuProps } from "antd";
import { ChevronDown } from "lucide-react";
import { useI18n } from "@/features/settings/state/I18nContext";
import type { WorkspaceCategoryNavigationItem } from "@/features/skills/model/workspaceCategories";

interface MySkillsCategoryBarProps {
  categoryItems: WorkspaceCategoryNavigationItem[];
  activeCategory: string;
  onChange: (category: string) => void;
}

const CATEGORY_GAP = 16;
const FALLBACK_TABS_WIDTH = 760;
const FALLBACK_MORE_WIDTH = 72;

function estimateCategoryWidth(item: WorkspaceCategoryNavigationItem) {
  const labelLength = Array.from(item.label).length;
  const countLength = String(item.count).length;

  return 44 + labelLength * 9 + countLength * 8;
}

function hasSameCategoryOrder(
  current: WorkspaceCategoryNavigationItem[],
  next: WorkspaceCategoryNavigationItem[],
) {
  if (current.length !== next.length) {
    return false;
  }

  return current.every((item, index) => item.category === next[index]?.category);
}

export function MySkillsCategoryBar({ categoryItems, activeCategory, onChange }: MySkillsCategoryBarProps) {
  const { resolvedLanguage } = useI18n();
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const measureRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const moreMeasureRef = useRef<HTMLSpanElement | null>(null);
  const defaultCategories = useMemo(() => categoryItems.filter((item) => item.isDefault), [categoryItems]);
  const prioritizedCustomCategories = useMemo(() => {
    const customCategories = categoryItems.filter((item) => !item.isDefault);

    return [...customCategories.filter((item) => !item.isEmpty), ...customCategories.filter((item) => item.isEmpty)];
  }, [categoryItems]);
  const shouldShowMore = prioritizedCustomCategories.length > 0;
  const [visibleCustomCategories, setVisibleCustomCategories] = useState(prioritizedCustomCategories);

  useLayoutEffect(() => {
    const syncVisibleCategories = () => {
      const availableWidth = tabsRef.current?.clientWidth || FALLBACK_TABS_WIDTH;
      const moreWidth = moreMeasureRef.current?.offsetWidth || FALLBACK_MORE_WIDTH;
      const nextVisibleCustomCategories: WorkspaceCategoryNavigationItem[] = [];

      let usedWidth = 0;
      defaultCategories.forEach((item, index) => {
        const itemWidth = measureRefs.current[item.category]?.offsetWidth || estimateCategoryWidth(item);
        usedWidth += itemWidth + (index > 0 ? CATEGORY_GAP : 0);
      });

      prioritizedCustomCategories.forEach((item) => {
        const itemWidth = measureRefs.current[item.category]?.offsetWidth || estimateCategoryWidth(item);
        const gapBefore = usedWidth > 0 ? CATEGORY_GAP : 0;
        const reservedMoreWidth = shouldShowMore ? CATEGORY_GAP + moreWidth : 0;

        if (usedWidth + gapBefore + itemWidth + reservedMoreWidth <= availableWidth) {
          nextVisibleCustomCategories.push(item);
          usedWidth += gapBefore + itemWidth;
        }
      });

      setVisibleCustomCategories((current) =>
        hasSameCategoryOrder(current, nextVisibleCustomCategories) ? current : nextVisibleCustomCategories,
      );
    };

    syncVisibleCategories();

    if (typeof ResizeObserver !== "undefined" && tabsRef.current) {
      const observer = new ResizeObserver(syncVisibleCategories);
      observer.observe(tabsRef.current);

      return () => observer.disconnect();
    }

    window.addEventListener("resize", syncVisibleCategories);

    return () => window.removeEventListener("resize", syncVisibleCategories);
  }, [defaultCategories, prioritizedCustomCategories, shouldShowMore]);

  const visibleCategoryKeys = new Set([...defaultCategories, ...visibleCustomCategories].map((item) => item.category));
  const hiddenCategories = prioritizedCustomCategories.filter((item) => !visibleCategoryKeys.has(item.category));
  const menuCategories = hiddenCategories.length > 0 ? hiddenCategories : prioritizedCustomCategories;
  const isMoreActive = hiddenCategories.some((item) => item.category === activeCategory);
  const moreLabel = resolvedLanguage === "en-US" ? "More" : "更多";
  const ariaLabel = resolvedLanguage === "en-US" ? "Skill categories" : "技能分类";
  const moreMenuItems: MenuProps["items"] = menuCategories.map((item) => ({
    key: item.category,
    label: (
      <span className="my-skills-category-bar__menu-item">
        <span>{item.label}</span>
        <span className="my-skills-category-bar__menu-count">{item.count}</span>
      </span>
    ),
    onClick: () => onChange(item.category),
  }));

  return (
    <section className="my-skills-category-bar">
      <div ref={tabsRef} className="my-skills-category-bar__tabs" role="tablist" aria-label={ariaLabel}>
        {[...defaultCategories, ...visibleCustomCategories].map((item) => (
          <button
            key={item.category}
            type="button"
            role="tab"
            aria-selected={activeCategory === item.category}
            className={`my-skills-category-bar__tab${activeCategory === item.category ? " is-active" : ""}`}
            onClick={() => onChange(item.category)}
          >
            <span>{item.label}</span>
            <span className="my-skills-category-bar__count">{item.count}</span>
          </button>
        ))}
        {shouldShowMore ? (
          <Dropdown
            menu={{ items: moreMenuItems }}
            trigger={["click"]}
            placement="bottomLeft"
            overlayClassName="my-skills-category-bar__dropdown"
          >
            <button
              type="button"
              className={`my-skills-category-bar__more${isMoreActive ? " is-active" : ""}`}
              aria-haspopup="menu"
            >
              <span>{moreLabel}</span>
              <ChevronDown size={14} />
            </button>
          </Dropdown>
        ) : null}
      </div>

      <div className="my-skills-category-bar__measure" aria-hidden="true">
        {categoryItems.map((item) => (
          <span
            key={item.category}
            ref={(node) => {
              measureRefs.current[item.category] = node;
            }}
            className="my-skills-category-bar__tab"
          >
            <span>{item.label}</span>
            <span className="my-skills-category-bar__count">{item.count}</span>
          </span>
        ))}
        <span
          ref={moreMeasureRef}
          className="my-skills-category-bar__more"
        >
          <span>{moreLabel}</span>
          <ChevronDown size={14} />
        </span>
      </div>
    </section>
  );
}
