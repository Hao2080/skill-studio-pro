import Form from "antd/es/form";
import Modal from "antd/es/modal";
import Select from "antd/es/select";
import { useI18n } from "@/features/settings/state/I18nContext";

interface EditSkillTagsModalProps {
  open: boolean;
  loading?: boolean;
  skillName: string;
  tagOptions: string[];
  selectedTags: string[];
  onSelectedTagsChange: (values: string[]) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function EditSkillTagsModal({
  open,
  loading = false,
  skillName,
  tagOptions,
  selectedTags,
  onSelectedTagsChange,
  onSubmit,
  onCancel,
}: EditSkillTagsModalProps) {
  const { resolvedLanguage } = useI18n();
  const copy = resolvedLanguage === "en-US"
    ? {
        title: "Edit Tags",
        ok: "Save",
        cancel: "Cancel",
        description: `Set tags for ${skillName}. You can reuse existing tags or type a new one and press Enter.`,
        field: "Tags",
        placeholder: "Type a tag and press Enter",
      }
    : {
        title: "编辑标签",
        ok: "保存",
        cancel: "取消",
        description: `为 ${skillName} 设置标签。可以复用已有标签，也可以输入新标签后回车创建。`,
        field: "标签",
        placeholder: "输入标签后回车，可直接创建新标签",
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
        <p>{copy.description}</p>
        <Form.Item label={copy.field}>
          <Select
            mode="tags"
            value={selectedTags}
            placeholder={copy.placeholder}
            tokenSeparators={[",", "，"]}
            options={tagOptions.map((tag) => ({ label: tag, value: tag }))}
            onChange={(values) => onSelectedTagsChange(values)}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
