import Modal from "antd/es/modal";
import { useI18n } from "@/features/settings/state/I18nContext";
import { VersionCompareResults } from "@/shared/components/VersionCompareResults";
import type { TeamDiffResult } from "@/types/team";
import "../styles.css";

interface TeamDiffPreviewModalProps {
  open: boolean;
  title: string;
  diffResult: TeamDiffResult | null;
  diffLoading: boolean;
  selectedFile: string | null;
  diffMode: "unified" | "split";
  onCancel: () => void;
  onSelectFile: (path: string | null) => void;
  onDiffModeChange: (mode: "unified" | "split") => void;
}

export function TeamDiffPreviewModal({
  open,
  title,
  diffResult,
  diffLoading,
  selectedFile,
  diffMode,
  onCancel,
  onSelectFile,
  onDiffModeChange,
}: TeamDiffPreviewModalProps) {
  const { resolvedLanguage } = useI18n();

  return (
    <Modal title={title} open={open} onCancel={onCancel} footer={null} width={1100}>
      <div className="teams-page__diff-shell">
        <VersionCompareResults
          diffResult={diffResult}
          diffLoading={diffLoading}
          selectedFile={selectedFile}
          diffMode={diffMode}
          onSelectFile={onSelectFile}
          onDiffModeChange={onDiffModeChange}
          language={resolvedLanguage}
        />
      </div>
    </Modal>
  );
}
