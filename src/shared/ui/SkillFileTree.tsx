import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, File, Folder, FolderOpen } from "lucide-react";
import "../styles.css";
import type { ChangeStatus, SkillFileNode } from "@/types/skill";

type UiLanguage = "zh-CN" | "en-US";

interface SkillFileTreeProps {
  nodes: SkillFileNode[];
  changeStatus?: ChangeStatus;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  language: UiLanguage;
  depth?: number;
}

export function SkillFileTree({
  nodes,
  changeStatus,
  selectedFile,
  onSelectFile,
  language,
  depth = 0,
}: SkillFileTreeProps) {
  return (
    <div className="skill-file-tree">
      {nodes.map((node) => (
        <FileNode
          key={node.path}
          node={node}
          changeStatus={changeStatus}
          selectedFile={selectedFile}
          onSelectFile={onSelectFile}
          language={language}
          depth={depth}
        />
      ))}
    </div>
  );
}

function getFileState(path: string, changeStatus?: ChangeStatus): "added" | "modified" | "deleted" | null {
  if (!changeStatus) return null;
  if (changeStatus.addedFiles.includes(path)) return "added";
  if (changeStatus.modifiedFiles.includes(path)) return "modified";
  if (changeStatus.deletedFiles.includes(path)) return "deleted";
  return null;
}

function getNodeChangedFileCount(node: SkillFileNode, changeStatus?: ChangeStatus): number {
  if (!changeStatus) {
    return 0;
  }

  if (!node.isDir) {
    return getFileState(node.path, changeStatus) ? 1 : 0;
  }

  return node.children.reduce((count, child) => count + getNodeChangedFileCount(child, changeStatus), 0);
}

function getFileStateLabel(state: "added" | "modified" | "deleted" | null, language: "zh-CN" | "en-US") {
  switch (state) {
    case "added":
      return language === "en-US" ? "Added" : "新增";
    case "modified":
      return language === "en-US" ? "Modified" : "修改";
    case "deleted":
      return language === "en-US" ? "Deleted" : "删除";
    default:
      return null;
  }
}

function FileNode({
  node,
  changeStatus,
  selectedFile,
  onSelectFile,
  language,
  depth,
}: {
  node: SkillFileNode;
  changeStatus?: ChangeStatus;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  language: UiLanguage;
  depth: number;
}) {
  const [open, setOpen] = useState(depth === 0);
  const isSelected = selectedFile === node.path;
  const fileState = node.isDir ? null : getFileState(node.path, changeStatus);
  const fileStateLabel = getFileStateLabel(fileState, language);
  const changedDescendantCount = node.isDir ? getNodeChangedFileCount(node, changeStatus) : 0;
  const selectedWithinFolder = !!selectedFile && node.isDir && selectedFile.startsWith(`${node.path}/`);

  useEffect(() => {
    if (selectedWithinFolder) {
      setOpen(true);
    }
  }, [selectedWithinFolder]);

  if (node.isDir) {
    return (
      <div className="skill-file-tree__branch">
        <button
          type="button"
          className={`skill-file-tree__item skill-file-tree__item--folder${open ? " is-open" : ""}`}
          onClick={() => setOpen((value) => !value)}
          style={{ paddingInlineStart: `${depth * 14 + 10}px` }}
          title={node.path || node.name}
        >
          <span className="skill-file-tree__item-icon" aria-hidden="true">
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>
          <span className="skill-file-tree__item-icon" aria-hidden="true">
            {open ? <FolderOpen size={14} /> : <Folder size={14} />}
          </span>
          <span className="skill-file-tree__item-label">{node.name}</span>
          <span className="skill-file-tree__item-meta">
            {changedDescendantCount > 0
              ? (language === "en-US"
                ? `${changedDescendantCount} changed`
                : `${changedDescendantCount} 项变更`)
              : (language === "en-US"
                ? `${node.children.length} items`
                : `${node.children.length} 项`)}
          </span>
        </button>

        {open && (
          <SkillFileTree
            nodes={node.children}
            changeStatus={changeStatus}
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
            language={language}
            depth={depth + 1}
          />
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`skill-file-tree__item skill-file-tree__item--file${isSelected ? " is-selected" : ""}`}
      onClick={() => onSelectFile(node.path)}
      style={{ paddingInlineStart: `${depth * 14 + 28}px` }}
      title={node.path}
    >
      <span className="skill-file-tree__item-icon" aria-hidden="true">
        <File size={13} />
      </span>
      <span className="skill-file-tree__item-label">{node.name}</span>
      {fileState && fileStateLabel ? (
        <span className={`skill-file-tree__state-chip is-${fileState}`}>{fileStateLabel}</span>
      ) : null}
    </button>
  );
}
