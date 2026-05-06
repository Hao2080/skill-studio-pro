import { useEffect, useState } from "react";
import Button from "antd/es/button";
import Input from "antd/es/input";
import List from "antd/es/list";
import Modal from "antd/es/modal";
import Segmented from "antd/es/segmented";
import Tag from "antd/es/tag";
import { useI18n } from "@/features/settings/state/I18nContext";
import { getCategoryLabel } from "../model/workspaceCategories";

interface ManageTagItem {
  name: string;
  usageCount: number;
}

interface ManageCategoriesModalProps {
  open: boolean;
  categories: string[];
  editingCategory: string | null;
  editingCategoryName: string;
  onEditingCategoryNameChange: (value: string) => void;
  onStartEdit: (category: string) => void;
  onSave: () => void;
  onCancelEdit: () => void;
  onDelete: (category: string) => void;
  tags: ManageTagItem[];
  newTagName: string;
  editingTag: string | null;
  editingTagName: string;
  onNewTagNameChange: (value: string) => void;
  onEditingTagNameChange: (value: string) => void;
  onCreateTag: () => void;
  onStartEditTag: (tagName: string) => void;
  onSaveTag: () => void;
  onCancelEditTag: () => void;
  onDeleteTag: (tagName: string) => void;
  onCancel: () => void;
}

export function ManageCategoriesModal({
  open,
  categories,
  editingCategory,
  editingCategoryName,
  onEditingCategoryNameChange,
  onStartEdit,
  onSave,
  onCancelEdit,
  onDelete,
  tags,
  newTagName,
  editingTag,
  editingTagName,
  onNewTagNameChange,
  onEditingTagNameChange,
  onCreateTag,
  onStartEditTag,
  onSaveTag,
  onCancelEditTag,
  onDeleteTag,
  onCancel,
}: ManageCategoriesModalProps) {
  const { resolvedLanguage } = useI18n();
  const [activePanel, setActivePanel] = useState<"categories" | "tags">("categories");
  const copy = resolvedLanguage === "en-US"
    ? {
        title: "Organization",
        eyebrow: "Skill Organization",
        heroTitle: "Manage primary categories and tags together",
        heroBody: "Primary categories decide where a skill belongs, while tags describe the skill for later filtering and search.",
        categoryMetric: `Primary Categories ${categories.length}`,
        tagMetric: `Tags ${tags.length}`,
        categoriesTab: `Primary Categories ${categories.length}`,
        tagsTab: `Tags ${tags.length}`,
        categoriesTitle: "Primary Categories",
        categoriesBody: "Use primary categories for main navigation and long-term organization.",
        emptyCategories: "No custom categories yet.",
        save: "Save",
        cancel: "Cancel",
        rename: "Rename",
        delete: "Delete",
        editCategoryAria: (category: string) => `Edit category ${category}`,
        tagsTitle: "Tags",
        tagsBody: "Use tags to describe scenarios, capabilities, and traits across categories.",
        newTagPlaceholder: "Enter a new tag name",
        createTag: "Create Tag",
        emptyTags: "No formal tags yet.",
        editTagAria: (tagName: string) => `Edit tag ${tagName}`,
        tagUsage: (count: number) => `Linked to ${count} skill${count === 1 ? "" : "s"}`,
      }
    : {
        title: "组织管理",
        eyebrow: "技能组织",
        heroTitle: "统一管理主分类与标签",
        heroBody: "主分类决定技能放在哪，标签补充技能特征，方便后续筛选与检索。",
        categoryMetric: `主分类 ${categories.length}`,
        tagMetric: `标签 ${tags.length}`,
        categoriesTab: `主分类 ${categories.length}`,
        tagsTab: `标签 ${tags.length}`,
        categoriesTitle: "主分类",
        categoriesBody: "主分类用于主导航和长期归档，一个技能只归属一个主分类。",
        emptyCategories: "还没有自定义分类。",
        save: "保存",
        cancel: "取消",
        rename: "重命名",
        delete: "删除",
        editCategoryAria: (category: string) => `编辑分类 ${category}`,
        tagsTitle: "标签",
        tagsBody: "标签用于补充技能场景、能力维度与来源特征，方便跨分类筛选和检索。",
        newTagPlaceholder: "输入新标签名称",
        createTag: "新增标签",
        emptyTags: "还没有正式标签。",
        editTagAria: (tagName: string) => `编辑标签 ${tagName}`,
        tagUsage: (count: number) => `已关联 ${count} 个技能`,
      };

  useEffect(() => {
    if (!open) {
      return;
    }

    setActivePanel("categories");
  }, [open]);

  return (
    <Modal
      title={copy.title}
      open={open}
      footer={null}
      onCancel={onCancel}
      width={720}
      styles={{
        body: {
          maxHeight: "min(70vh, 680px)",
          overflowY: "auto",
          paddingRight: 4,
        },
      }}
    >
      <div className="my-skills-organization-manager">
        <section className="my-skills-organization-manager__hero">
          <div className="my-skills-organization-manager__hero-copy">
            <span className="my-skills-organization-manager__eyebrow">{copy.eyebrow}</span>
            <h3>{copy.heroTitle}</h3>
            <p>{copy.heroBody}</p>
          </div>
          <div className="my-skills-organization-manager__hero-meta">
            <span className="my-skills-organization-manager__metric">{copy.categoryMetric}</span>
            <span className="my-skills-organization-manager__metric">{copy.tagMetric}</span>
          </div>
        </section>

        <Segmented
          className="my-skills-organization-manager__switch"
          value={activePanel}
          onChange={(value) => setActivePanel(value as "categories" | "tags")}
          options={[
            {
              label: copy.categoriesTab,
              value: "categories",
            },
            {
              label: copy.tagsTab,
              value: "tags",
            },
          ]}
        />

        {activePanel === "categories" ? (
          <section className="my-skills-organization-manager__section">
            <div className="my-skills-organization-manager__section-head">
              <div>
                <h4>{copy.categoriesTitle}</h4>
                <p>{copy.categoriesBody}</p>
              </div>
            </div>

            {categories.length === 0 ? <p className="my-skills-category-manager__empty">{copy.emptyCategories}</p> : null}
            <List
              className="my-skills-category-manager__list"
              dataSource={categories}
              renderItem={(category) => (
                <List.Item
                  actions={
                    editingCategory === category
                      ? [
                          <Button key="save" type="link" onClick={onSave}>
                            {copy.save}
                          </Button>,
                          <Button key="cancel" type="link" onClick={onCancelEdit}>
                            {copy.cancel}
                          </Button>,
                        ]
                      : [
                          <Button key="rename" type="link" onClick={() => onStartEdit(category)}>
                            {copy.rename}
                          </Button>,
                          <Button key="delete" type="link" danger onClick={() => onDelete(category)}>
                            {copy.delete}
                          </Button>,
                        ]
                  }
                >
                  {editingCategory === category ? (
                    <Input
                      value={editingCategoryName}
                      aria-label={copy.editCategoryAria(category)}
                      onChange={(event) => onEditingCategoryNameChange(event.target.value)}
                      onPressEnter={onSave}
                    />
                  ) : (
                    <span>{getCategoryLabel(category, resolvedLanguage)}</span>
                  )}
                </List.Item>
              )}
            />
          </section>
        ) : (
          <section className="my-skills-organization-manager__section">
            <div className="my-skills-organization-manager__section-head">
              <div>
                <h4>{copy.tagsTitle}</h4>
                <p>{copy.tagsBody}</p>
              </div>
            </div>

            <div className="my-skills-organization-manager__tag-create">
              <Input
                placeholder={copy.newTagPlaceholder}
                value={newTagName}
                onChange={(event) => onNewTagNameChange(event.target.value)}
                onPressEnter={onCreateTag}
              />
              <Button type="primary" onClick={onCreateTag}>
                {copy.createTag}
              </Button>
            </div>

            {tags.length === 0 ? <p className="my-skills-category-manager__empty">{copy.emptyTags}</p> : null}
            <List
              className="my-skills-category-manager__list"
              dataSource={tags}
              renderItem={(tag) => (
                <List.Item
                  actions={
                    editingTag === tag.name
                      ? [
                          <Button key="save" type="link" onClick={onSaveTag}>
                            {copy.save}
                          </Button>,
                          <Button key="cancel" type="link" onClick={onCancelEditTag}>
                            {copy.cancel}
                          </Button>,
                        ]
                      : [
                          <Button key="rename" type="link" onClick={() => onStartEditTag(tag.name)}>
                            {copy.rename}
                          </Button>,
                          <Button key="delete" type="link" danger onClick={() => onDeleteTag(tag.name)}>
                            {copy.delete}
                          </Button>,
                        ]
                  }
                >
                  {editingTag === tag.name ? (
                    <Input
                      value={editingTagName}
                      aria-label={copy.editTagAria(tag.name)}
                      onChange={(event) => onEditingTagNameChange(event.target.value)}
                      onPressEnter={onSaveTag}
                    />
                  ) : (
                    <div className="my-skills-organization-manager__tag-row">
                      <Tag bordered={false} className="my-skills-organization-manager__tag-chip">
                        {tag.name}
                      </Tag>
                      <span className="my-skills-organization-manager__tag-meta">{copy.tagUsage(tag.usageCount)}</span>
                    </div>
                  )}
                </List.Item>
              )}
            />
          </section>
        )}
      </div>
    </Modal>
  );
}
