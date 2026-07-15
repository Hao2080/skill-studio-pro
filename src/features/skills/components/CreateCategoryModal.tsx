import Form from "antd/es/form";
import Input from "antd/es/input";
import Modal from "antd/es/modal";
import { useI18n } from "@/features/settings/state/I18nContext";

interface CreateCategoryModalProps {
  open: boolean;
  categoryName: string;
  onCategoryNameChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function CreateCategoryModal({
  open,
  categoryName,
  onCategoryNameChange,
  onSubmit,
  onCancel,
}: CreateCategoryModalProps) {
  const { resolvedLanguage } = useI18n();
  const copy = resolvedLanguage === "en-US"
    ? {
        title: "New Category",
        ok: "Create Category",
        cancel: "Cancel",
        label: "Category Name",
        placeholder: "Enter category name",
      }
    : {
        title: "新建分类",
        ok: "创建分类",
        cancel: "取消",
        label: "分类名称",
        placeholder: "输入分类名称",
      };
  return (
    <Modal title={copy.title} open={open} onOk={onSubmit} onCancel={onCancel} okText={copy.ok} cancelText={copy.cancel}>
      <Form layout="vertical">
        <Form.Item label={copy.label} required>
          <Input placeholder={copy.placeholder} value={categoryName} onChange={(event) => onCategoryNameChange(event.target.value)} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
