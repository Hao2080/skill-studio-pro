import Form from "antd/es/form";
import Input from "antd/es/input";
import Modal from "antd/es/modal";
import { useI18n } from "@/features/settings/state/I18nContext";

interface CreateSkillModalProps {
  open: boolean;
  loading: boolean;
  skillName: string;
  skillDescription: string;
  onSkillNameChange: (value: string) => void;
  onSkillDescriptionChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function CreateSkillModal({
  open,
  loading,
  skillName,
  skillDescription,
  onSkillNameChange,
  onSkillDescriptionChange,
  onSubmit,
  onCancel,
}: CreateSkillModalProps) {
  const { resolvedLanguage } = useI18n();
  const copy = resolvedLanguage === "en-US"
    ? {
        title: "New Skill",
        ok: "Create",
        cancel: "Cancel",
        name: "Skill Name",
        namePlaceholder: "Enter skill name",
        description: "Description",
        descriptionPlaceholder: "Enter a skill description (optional)",
      }
    : {
        title: "新建技能",
        ok: "创建",
        cancel: "取消",
        name: "技能名称",
        namePlaceholder: "输入技能名称",
        description: "描述",
        descriptionPlaceholder: "输入技能描述（可选）",
      };
  return (
    <Modal
      title={copy.title}
      open={open}
      onOk={onSubmit}
      onCancel={onCancel}
      okText={copy.ok}
      cancelText={copy.cancel}
      okButtonProps={{ loading }}
    >
      <Form layout="vertical">
        <Form.Item label={copy.name} required>
          <Input placeholder={copy.namePlaceholder} value={skillName} onChange={(event) => onSkillNameChange(event.target.value)} />
        </Form.Item>
        <Form.Item label={copy.description}>
          <Input.TextArea
            rows={4}
            placeholder={copy.descriptionPlaceholder}
            value={skillDescription}
            onChange={(event) => onSkillDescriptionChange(event.target.value)}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
