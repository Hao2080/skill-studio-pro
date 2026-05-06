import Input from "antd/es/input";
import Segmented from "antd/es/segmented";
import Select from "antd/es/select";
import { LayoutGrid, List, Search } from "lucide-react";
import { useI18n } from "@/features/settings/state/I18nContext";
import type { MySkillsSortMode, MySkillsViewMode } from "./types";

interface MySkillsToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedTags: string[];
  tagOptions: string[];
  onSelectedTagsChange: (values: string[]) => void;
  sort: MySkillsSortMode;
  onSortChange: (value: MySkillsSortMode) => void;
  viewMode: MySkillsViewMode;
  onViewModeChange: (mode: MySkillsViewMode) => void;
}

export function MySkillsToolbar({
  search,
  onSearchChange,
  selectedTags,
  tagOptions,
  onSelectedTagsChange,
  sort,
  onSortChange,
  viewMode,
  onViewModeChange,
}: MySkillsToolbarProps) {
  const { resolvedLanguage } = useI18n();
  const copy = resolvedLanguage === "en-US"
    ? {
        aria: "Skill browsing controls",
        placeholder: "Search by name, description, or tag",
        tagPlaceholder: "Filter tags",
        updated: "Recently Updated",
        updatedAsc: "Oldest Updated",
        nameAsc: "Name A-Z",
        nameDesc: "Name Z-A",
        imported: "Recently Imported",
        card: "Cards",
        list: "List",
      }
    : {
        aria: "技能浏览控制",
        placeholder: "搜索名称、描述或标签",
        tagPlaceholder: "筛选标签",
        updated: "最近更新",
        updatedAsc: "最早更新",
        nameAsc: "名称 A-Z",
        nameDesc: "名称 Z-A",
        imported: "最近导入",
        card: "卡片",
        list: "列表",
      };

  return (
    <section className="my-skills-toolbar" aria-label={copy.aria}>
      <div className="my-skills-toolbar__field my-skills-toolbar__field--search">
        <Input
          value={search}
          prefix={<Search size={14} />}
          className="my-skills-toolbar__search"
          placeholder={copy.placeholder}
          allowClear
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="my-skills-toolbar__actions">
        <div className="my-skills-toolbar__field my-skills-toolbar__field--tags">
          <Select
            mode="multiple"
            allowClear
            value={selectedTags}
            className="my-skills-toolbar__select"
            placeholder={copy.tagPlaceholder}
            maxTagCount="responsive"
            options={tagOptions.map((tag) => ({ label: tag, value: tag }))}
            onChange={(values) => onSelectedTagsChange(values)}
          />
        </div>

        <div className="my-skills-toolbar__field my-skills-toolbar__field--sort">
          <Select
            value={sort}
            options={[
              { label: copy.updated, value: "updated" },
              { label: copy.updatedAsc, value: "updated-asc" },
              { label: copy.nameAsc, value: "name-asc" },
              { label: copy.nameDesc, value: "name-desc" },
              { label: copy.imported, value: "recently-imported" },
            ]}
            className="my-skills-toolbar__select"
            onChange={(value) => onSortChange(value as MySkillsSortMode)}
          />
        </div>

        <div className="my-skills-toolbar__field my-skills-toolbar__field--view">
          <Segmented
            className="my-skills-toolbar__view-toggle"
            value={viewMode}
            options={[
              {
                label: (
                  <span className="my-skills-toolbar__view-option">
                    <LayoutGrid size={14} />
                    <span>{copy.card}</span>
                  </span>
                ),
                value: "card",
              },
              {
                label: (
                  <span className="my-skills-toolbar__view-option">
                    <List size={14} />
                    <span>{copy.list}</span>
                  </span>
                ),
                value: "list",
              },
            ]}
            onChange={(value) => onViewModeChange(value as MySkillsViewMode)}
          />
        </div>
      </div>
    </section>
  );
}
