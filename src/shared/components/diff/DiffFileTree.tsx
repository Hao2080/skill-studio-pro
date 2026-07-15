import type { SnapshotDiffResult } from "@/types/skill";

type UiLanguage = "zh-CN" | "en-US";

interface DiffFileTreeProps {
  diffResult: SnapshotDiffResult;
  allFiles?: string[];
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  language: UiLanguage;
}

export function DiffFileTree({ diffResult, allFiles, selectedFile, onSelectFile, language }: DiffFileTreeProps) {
  const { modifiedFiles, addedFiles, deletedFiles } = diffResult;
  const changedSet = new Set([...modifiedFiles, ...addedFiles, ...deletedFiles]);
  const unchangedFiles = (allFiles ?? []).filter((file) => !changedSet.has(file));
  const copy = language === "en-US"
    ? {
        modified: "Modified",
        added: "Added",
        deleted: "Deleted",
        unchanged: "Unchanged",
      }
    : {
        modified: "修改",
        added: "新增",
        deleted: "删除",
        unchanged: "未变更",
      };

  return (
    <div className="diff-file-tree">
      <FileGroup
        title={copy.modified}
        color="var(--accent-yellow)"
        marker="M"
        files={modifiedFiles}
        selectedFile={selectedFile}
        onSelect={onSelectFile}
      />
      <FileGroup
        title={copy.added}
        color="var(--accent-green)"
        marker="A"
        files={addedFiles}
        selectedFile={selectedFile}
        onSelect={onSelectFile}
      />
      <FileGroup
        title={copy.deleted}
        color="var(--accent-red)"
        marker="D"
        files={deletedFiles}
        selectedFile={selectedFile}
        onSelect={onSelectFile}
      />
      {unchangedFiles.length > 0 && (
        <FileGroup
          title={copy.unchanged}
          color="var(--text-faint)"
          marker="─"
          files={unchangedFiles}
          selectedFile={selectedFile}
          onSelect={onSelectFile}
          dimmed
        />
      )}
    </div>
  );
}

function FileGroup({
  title,
  color,
  marker,
  files,
  selectedFile,
  onSelect,
  dimmed,
}: {
  title: string;
  color: string;
  marker: string;
  files: string[];
  selectedFile: string | null;
  onSelect: (path: string) => void;
  dimmed?: boolean;
}) {
  if (files.length === 0) return null;

  return (
    <section className="diff-file-tree__group">
      <div className="diff-file-tree__group-title">
        {title} <span>({files.length})</span>
      </div>

      <div className="diff-file-tree__group-list">
        {files.map((file) => {
          const isActive = selectedFile === file;
          const name = file.includes("/") ? file.split("/").pop()! : file;

          return (
            <button
              key={file}
              type="button"
              className={`diff-file-tree__item${isActive ? " is-active" : ""}${dimmed ? " is-dimmed" : ""}`}
              onClick={() => onSelect(file)}
              title={file}
            >
              <span className="diff-file-tree__marker" style={{ color }}>
                {marker}
              </span>
              <span className="diff-file-tree__label-wrap">
                <span className="diff-file-tree__label">{name}</span>
                <span className="diff-file-tree__path">{file}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
