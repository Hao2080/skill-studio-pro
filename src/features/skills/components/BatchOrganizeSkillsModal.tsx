import { useEffect, useState } from "react";
import Button from "antd/es/button";
import Modal from "antd/es/modal";
import Select from "antd/es/select";
import { useI18n } from "@/features/settings/state/I18nContext";

interface BatchOrganizeSkillsModalProps {
  open: boolean;
  loading?: boolean;
  selectedCount: number;
  categories: string[];
  tagOptions: string[];
  onSubmit: (input: {
    categoryName?: string | null;
    clearCategory: boolean;
    addTagNames: string[];
    removeTagNames: string[];
  }) => void;
  onCancel: () => void;
}

const KEEP_CATEGORY_VALUE = "__keep__";
const CLEAR_CATEGORY_VALUE = "__clear__";

export function BatchOrganizeSkillsModal({
  open,
  loading = false,
  selectedCount,
  categories,
  tagOptions,
  onSubmit,
  onCancel,
}: BatchOrganizeSkillsModalProps) {
  const { resolvedLanguage } = useI18n();
  const copy = resolvedLanguage === "en-US"
    ? {
        title: "Batch Organize Skills",
        introTitle: `This run will process ${selectedCount} skills`,
        introDescription: "You can update the primary category and add or remove tags in one pass. Fields left untouched will remain unchanged.",
        collection: "Primary Category",
        keepCurrent: "Keep current category",
        moveUncategorized: "Move to uncategorized",
        addTags: "Add Tags",
        addTagsPlaceholder: "Type a tag and press Enter to create it",
        removeTags: "Remove Tags",
        removeTagsPlaceholder: "Select tags to remove",
        tagsHint: "Tags help filtering and search, but they do not replace the primary category.",
        cancel: "Cancel",
        apply: "Apply to Selected Skills",
      }
    : {
        title: "批量整理",
        introTitle: `本次将处理 ${selectedCount} 个技能`,
        introDescription: "可以统一设置主分类，并批量添加或移除标签。未调整的字段会保持原状。",
        collection: "主分类",
        keepCurrent: "保持当前主分类",
        moveUncategorized: "移到未分类",
        addTags: "添加标签",
        addTagsPlaceholder: "输入标签后回车，可直接创建新标签",
        removeTags: "移除标签",
        removeTagsPlaceholder: "选择要移除的标签",
        tagsHint: "标签只影响筛选和检索，不会替代主分类。",
        cancel: "取消",
        apply: "应用到所选技能",
      };
  const [selectedCategory, setSelectedCategory] = useState<string>(KEEP_CATEGORY_VALUE);
  const [selectedAddTags, setSelectedAddTags] = useState<string[]>([]);
  const [selectedRemoveTags, setSelectedRemoveTags] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedCategory(KEEP_CATEGORY_VALUE);
    setSelectedAddTags([]);
    setSelectedRemoveTags([]);
  }, [open]);

  return (
    <Modal
      title={copy.title}
      open={open}
      onCancel={onCancel}
      footer={null}
      width={620}
    >
      <div className="batch-organize-modal">
        <div className="batch-organize-modal__intro">
          <strong>{copy.introTitle}</strong>
          <p>{copy.introDescription}</p>
        </div>

        <div className="batch-organize-modal__field">
          <span className="batch-organize-modal__label">{copy.collection}</span>
          <Select
            value={selectedCategory}
            className="batch-organize-modal__select"
            options={[
              { label: copy.keepCurrent, value: KEEP_CATEGORY_VALUE },
              { label: copy.moveUncategorized, value: CLEAR_CATEGORY_VALUE },
              ...categories.map((category) => ({
                label: category,
                value: category,
              })),
            ]}
            onChange={setSelectedCategory}
          />
        </div>

        <div className="batch-organize-modal__field">
          <span className="batch-organize-modal__label">{copy.addTags}</span>
          <Select
            mode="tags"
            value={selectedAddTags}
            className="batch-organize-modal__select"
            placeholder={copy.addTagsPlaceholder}
            tokenSeparators={[",", "，"]}
            options={tagOptions.map((tag) => ({ label: tag, value: tag }))}
            onChange={(values) => setSelectedAddTags(values)}
          />
        </div>

        <div className="batch-organize-modal__field">
          <span className="batch-organize-modal__label">{copy.removeTags}</span>
          <Select
            mode="multiple"
            allowClear
            value={selectedRemoveTags}
            className="batch-organize-modal__select"
            placeholder={copy.removeTagsPlaceholder}
            maxTagCount="responsive"
            options={tagOptions.map((tag) => ({ label: tag, value: tag }))}
            onChange={(values) => setSelectedRemoveTags(values)}
          />
          <p className="batch-organize-modal__hint">{copy.tagsHint}</p>
        </div>

        <div className="batch-organize-modal__actions">
          <Button className="batch-organize-modal__action" onClick={onCancel}>{copy.cancel}</Button>
          <Button
            type="primary"
            loading={loading}
            className="batch-organize-modal__action batch-organize-modal__action--primary"
            onClick={() =>
              onSubmit({
                categoryName:
                  selectedCategory === KEEP_CATEGORY_VALUE || selectedCategory === CLEAR_CATEGORY_VALUE
                    ? null
                    : selectedCategory,
                clearCategory: selectedCategory === CLEAR_CATEGORY_VALUE,
                addTagNames: selectedAddTags,
                removeTagNames: selectedRemoveTags,
              })
            }
          >
            {copy.apply}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
