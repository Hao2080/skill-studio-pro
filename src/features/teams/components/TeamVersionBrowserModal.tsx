import Modal from "antd/es/modal";
import Spin from "antd/es/spin";
import { useI18n } from "@/features/settings/state/I18nContext";
import { SkillFileTree } from "@/shared/ui/SkillFileTree";
import type { SkillFileNode } from "@/types/skill";
import type { TeamSkillVersion } from "@/types/team";
import "../styles.css";

interface TeamVersionBrowserModalProps {
  open: boolean;
  version: TeamSkillVersion | null;
  skillName: string;
  tree: SkillFileNode | null;
  selectedFile: string | null;
  fileContent: string | null;
  loading: boolean;
  fileLoading: boolean;
  onCancel: () => void;
  onSelectFile: (path: string) => void;
}

export function TeamVersionBrowserModal({
  open,
  version,
  skillName,
  tree,
  selectedFile,
  fileContent,
  loading,
  fileLoading,
  onCancel,
  onSelectFile,
}: TeamVersionBrowserModalProps) {
  const { resolvedLanguage } = useI18n();
  const copy = resolvedLanguage === "en-US"
    ? {
        title: version ? `Browse Content: ${skillName} / v${version.versionNumber}` : "Browse Content",
        files: "Files",
        loading: "Loading...",
        empty: "No files",
        selectFile: "Select a file",
        selectHint: "Select a file to preview its content",
      }
    : {
        title: version ? `浏览内容：${skillName} / v${version.versionNumber}` : "浏览内容",
        files: "文件",
        loading: "加载中...",
        empty: "暂无文件",
        selectFile: "请选择文件",
        selectHint: "请选择文件查看内容",
      };
  return (
    <Modal
      title={copy.title}
      open={open}
      onCancel={onCancel}
      footer={null}
      width={1100}
    >
      <div className="teams-page__browser-shell">
        <div className="teams-page__browser-sidebar">
          <div className="teams-page__browser-header">{copy.files}</div>
          <Spin spinning={loading}>
            {tree ? (
              <SkillFileTree
                nodes={tree.children}
                selectedFile={selectedFile}
                onSelectFile={onSelectFile}
                language={resolvedLanguage}
              />
            ) : (
              <div className="teams-page__browser-sidebar-empty">{loading ? copy.loading : copy.empty}</div>
            )}
          </Spin>
        </div>

        <div className="teams-page__browser-main">
          <div className="teams-page__browser-file-name">{selectedFile ?? copy.selectFile}</div>

          <div className="teams-page__browser-content">
            {fileLoading ? (
              <div className="teams-page__browser-overlay">
                <Spin />
              </div>
            ) : null}

            {fileContent != null ? (
              <div className="teams-page__browser-lines">
                {fileContent.split("\n").map((line, index) => (
                  <div key={index} className="teams-page__browser-line">
                    <span className="teams-page__browser-line-number">{index + 1}</span>
                    <span className="teams-page__browser-line-text">{line || " "}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span>{copy.selectHint}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
