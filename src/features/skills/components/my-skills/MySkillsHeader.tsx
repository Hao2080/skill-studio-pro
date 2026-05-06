import Button from "antd/es/button";
import { FolderPlus, Import, Plus, Settings2 } from "lucide-react";
import { useI18n } from "@/features/settings/state/I18nContext";

interface MySkillsHeaderProps {
  onNewSkill: () => void;
  onImportSkill: () => void;
  onNewCategory: () => void;
  onManageCategories: () => void;
}

export function MySkillsHeader({
  onNewSkill,
  onImportSkill,
  onNewCategory,
  onManageCategories,
}: MySkillsHeaderProps) {
  const { resolvedLanguage } = useI18n();
  const copy = resolvedLanguage === "en-US"
      ? {
        title: "Skill Assets",
        actions: "Skill workspace actions",
        newSkill: "New Skill",
        importSkill: "Import Skill",
        newCategory: "New Category",
        manageCategories: "Organization",
      }
    : {
        title: "技能资产",
        actions: "技能空间操作",
        newSkill: "新建技能",
        importSkill: "导入技能",
        newCategory: "新建分类",
        manageCategories: "组织管理",
      };

  return (
    <section className="my-skills-header">
      <div className="my-skills-header__main">
        <h1 className="my-skills-header__title">{copy.title}</h1>
      </div>

      <div className="my-skills-header__actions" role="group" aria-label={copy.actions}>
        <Button
          className="my-skills-header__action my-skills-header__action--primary"
          icon={<Plus size={14} />}
          onClick={onNewSkill}
        >
          {copy.newSkill}
        </Button>
        <Button
          className="my-skills-header__action my-skills-header__action--secondary"
          icon={<Import size={14} />}
          onClick={onImportSkill}
        >
          {copy.importSkill}
        </Button>
        <Button
          className="my-skills-header__action my-skills-header__action--tertiary"
          icon={<FolderPlus size={14} />}
          onClick={onNewCategory}
        >
          {copy.newCategory}
        </Button>
        <Button
          className="my-skills-header__action my-skills-header__action--ghost"
          icon={<Settings2 size={14} />}
          onClick={onManageCategories}
        >
          {copy.manageCategories}
        </Button>
      </div>
    </section>
  );
}
