import { useEffect, useState } from "react";
import Button from "antd/es/button";
import Segmented from "antd/es/segmented";
import Spin from "antd/es/spin";
import { PanelLeft, PanelLeftClose } from "lucide-react";
import "../styles.css";
import { DiffFileTree } from "@/shared/components/diff/DiffFileTree";
import { SplitDiff } from "@/shared/components/diff/SplitDiff";
import { TextDiff } from "@/shared/components/diff/TextDiff";
import type { SnapshotDiffResult } from "@/types/skill";

type UiLanguage = "zh-CN" | "en-US";

interface VersionCompareResultsProps {
  diffResult: SnapshotDiffResult | null;
  diffLoading: boolean;
  selectedFile: string | null;
  diffMode: "unified" | "split";
  onSelectFile: (file: string) => void;
  onDiffModeChange: (mode: "unified" | "split") => void;
  language: UiLanguage;
}

export function VersionCompareResults({
  diffResult,
  diffLoading,
  selectedFile,
  diffMode,
  onSelectFile,
  onDiffModeChange,
  language,
}: VersionCompareResultsProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const copy = language === "en-US"
    ? {
        expand: "Show File List",
        collapse: "Hide File List",
        modified: "Mod",
        added: "Add",
        deleted: "Del",
        unified: "Unified",
        split: "Split",
        loading: "Calculating diff...",
        noDiffTitle: "No text diff available",
        noDiffDescription: "The current diff does not contain previewable text changes.",
        emptyTitle: "No compare result yet",
        emptyDescription: "Select versions to inspect the diff.",
      }
    : {
        expand: "展开文件列表",
        collapse: "收起文件列表",
        modified: "改",
        added: "增",
        deleted: "删",
        unified: "统一",
        split: "分栏",
        loading: "正在计算差异...",
        noDiffTitle: "没有可展示的文本差异",
        noDiffDescription: "当前差异不包含可直接预览的文本内容。",
        emptyTitle: "暂无对比结果",
        emptyDescription: "选择版本后查看差异。",
      };

  useEffect(() => {
    if (!diffResult) {
      setIsSidebarCollapsed(false);
    }
  }, [diffResult]);

  useEffect(() => {
    if (!diffResult) {
      return;
    }

    const files = Object.keys(diffResult.textDiffs);
    if (files.length === 0) {
      return;
    }

    if (!selectedFile || !diffResult.textDiffs[selectedFile]) {
      onSelectFile(files[0]);
    }
  }, [diffResult, onSelectFile, selectedFile]);

  const currentDiff = selectedFile && diffResult?.textDiffs[selectedFile] ? diffResult.textDiffs[selectedFile] : null;
  const changeSummary = diffResult
    ? [
        { label: copy.modified, value: diffResult.modifiedFiles.length, tone: "warning" },
        { label: copy.added, value: diffResult.addedFiles.length, tone: "success" },
        { label: copy.deleted, value: diffResult.deletedFiles.length, tone: "danger" },
      ]
    : [];

  return (
    <div className="version-compare-panel version-compare-panel--dense">
      <div className="workspace-compare__toolbar workspace-compare__toolbar--dense">
        <div className="workspace-compare__toolbar-main">
          {diffResult ? (
            <Button
              size="small"
              type="text"
              icon={isSidebarCollapsed ? <PanelLeft size={14} /> : <PanelLeftClose size={14} />}
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            >
              {isSidebarCollapsed ? copy.expand : copy.collapse}
            </Button>
          ) : null}

          {selectedFile ? <span className="workspace-compare__file-label">{selectedFile}</span> : null}
        </div>

        <div className="workspace-compare__toolbar-end">
          {changeSummary.map((item) => (
            <span key={item.label} className={`workspace-compare__summary-pill is-${item.tone}`}>
              {item.label} {item.value}
            </span>
          ))}

          <Segmented
            size="small"
            value={diffMode}
            onChange={(value) => onDiffModeChange(value as "unified" | "split")}
            options={[
              { label: copy.unified, value: "unified" },
              { label: copy.split, value: "split" },
            ]}
          />

          {currentDiff ? (
            <span className="workspace-compare__stat">
              <span style={{ color: "var(--accent-green)" }}>+{currentDiff.newLines} </span>
              <span style={{ color: "var(--accent-red)" }}>-{currentDiff.oldLines}</span>
            </span>
          ) : null}
        </div>
      </div>

      <div className={`workspace-compare__body${isSidebarCollapsed ? " is-sidebar-collapsed" : ""}`}>
        {diffResult && !isSidebarCollapsed ? (
          <div className="workspace-compare__sidebar">
            <Spin spinning={diffLoading}>
              <DiffFileTree
                diffResult={diffResult}
                selectedFile={selectedFile}
                onSelectFile={onSelectFile}
                language={language}
              />
            </Spin>
          </div>
        ) : null}

        <div className="workspace-compare__content">
          {diffLoading ? (
            <div className="workspace-panel-empty">
              <Spin />
              <span>{copy.loading}</span>
            </div>
          ) : currentDiff ? (
            diffMode === "unified" ? <TextDiff diff={currentDiff} /> : <SplitDiff diff={currentDiff} />
          ) : diffResult ? (
            <div className="workspace-compare__empty">
              <h4>{copy.noDiffTitle}</h4>
              <p>{copy.noDiffDescription}</p>
            </div>
          ) : (
            <div className="workspace-compare__empty">
              <h4>{copy.emptyTitle}</h4>
              <p>{copy.emptyDescription}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
