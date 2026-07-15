import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import Button from "antd/es/button";
import Input from "antd/es/input";
import message from "antd/es/message";
import Spin from "antd/es/spin";
import { Edit3, ExternalLink, FolderOpen, FolderTree, GitCompare, Save, X } from "lucide-react";
import { useI18n } from "@/features/settings/state/I18nContext";
import { useSkillContext } from "@/features/skills/state/SkillContext";
import { useSnapshotContext } from "@/features/snapshots/state/SnapshotContext";
import { diffWorkingDirectory } from "@/features/snapshots/api/snapshotsApi";
import { VersionCompareResults } from "@/shared/components/VersionCompareResults";
import { SkillFileTree } from "@/shared/ui/SkillFileTree";
import type { SkillFileNode, SnapshotDiffResult } from "@/types/skill";
import {
  listSkillFiles,
  openFileInEditor,
  openSkillFolder,
  readSkillFile,
  writeSkillFile,
} from "../api/skillsApi";
import {
  collectTreeStats,
  filterTree,
  filterTreeByPaths,
  hasFilePath,
} from "../model/fileExplorer";
import {
  getFileWorkspaceScrollPosition,
  loadFileWorkspaceSession,
  persistFileWorkspaceScrollPosition,
  persistFileWorkspaceSelection,
} from "../model/fileWorkspaceSession";

type FileWorkspaceFilterMode = "all" | "changed";

interface FileExplorerPanelProps {
  selectedFile: string | null;
  onFileSelect: (path: string) => void;
  browseRefreshToken: number;
  onRequestNavigateAway?: (proceed: () => void) => void;
  onOpenVersions?: () => void;
}

export interface FileExplorerPanelHandle {
  hasUnsavedChanges: () => boolean;
  saveChanges: () => Promise<boolean>;
  discardChanges: () => void;
}

function getFileTypeLabel(path: string | null, language: "zh-CN" | "en-US") {
  const labels = language === "en-US"
    ? {
        file: "File",
        markdown: "Markdown Document",
        json: "JSON File",
        yaml: "YAML File",
        text: "Text File",
      }
    : {
        file: "文件",
        markdown: "Markdown 文档",
        json: "JSON 文件",
        yaml: "YAML 文件",
        text: "文本",
      };
  if (!path) {
    return labels.file;
  }

  const extension = path.split(".").pop()?.toLowerCase();
  if (!extension || extension === path.toLowerCase()) {
    return labels.file;
  }

  if (extension === "md") {
    return labels.markdown;
  }

  if (extension === "json") {
    return labels.json;
  }

  if (extension === "yaml" || extension === "yml") {
    return labels.yaml;
  }

  if (extension === "txt") {
    return labels.text;
  }

  return extension.toUpperCase();
}

function getFileMetaItemClassName(tone: "neutral" | "editing" | "active" | "warning" | "ready" | "metric") {
  return `file-content-panel__meta-item file-content-panel__meta-item--${tone}`;
}

export const FileExplorerPanel = forwardRef<FileExplorerPanelHandle, FileExplorerPanelProps>(function FileExplorerPanel(
  { selectedFile, onFileSelect, browseRefreshToken, onRequestNavigateAway, onOpenVersions },
  ref,
) {
  const { resolvedLanguage } = useI18n();
  const { selectedSkillId, skills, changeStatusMap, loadChangeStatuses } = useSkillContext();
  const { snapshots } = useSnapshotContext();
  const [tree, setTree] = useState<SkillFileNode | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isTreeOpen, setIsTreeOpen] = useState(false);
  const [treeQuery, setTreeQuery] = useState("");
  const [filterMode, setFilterMode] = useState<FileWorkspaceFilterMode>("all");
  const [diffResult, setDiffResult] = useState<SnapshotDiffResult | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffSelectedFile, setDiffSelectedFile] = useState<string | null>(null);
  const [diffMode, setDiffMode] = useState<"unified" | "split">("unified");
  const [showDiff, setShowDiff] = useState(false);
  const [restoredContextFile, setRestoredContextFile] = useState<string | null>(null);
  const restoredSkillIdRef = useRef<string | null>(null);
  const gutterTrackRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const copy = resolvedLanguage === "en-US"
    ? {
        saveSuccess: "Saved to workspace",
        saveFailed: "Save failed",
        diffFailed: "Failed to load changes",
        emptyTitle: "Select a skill first",
        emptyDescription: "Open any skill from Skill Assets and then return to the file workspace.",
        closeTree: "Close file tree",
        searchPlaceholder: "Search files or paths",
        filterAria: "File filters",
        filterAll: "All Files",
        filterChanged: "Uncaptured Files",
        treeTitle: "Full File Tree",
        matchCount: (count: number) => `${count} matches`,
        changedCount: (count: number) => `${count} uncaptured files`,
        fileCount: (count: number) => `${count} files`,
        treeEmptyChanged: "No uncaptured files under the current filter.",
        treeEmptySearch: "No matching files.",
        treeLoading: "Loading files...",
        fileNav: "File Nav",
        noFileSelected: "No File Selected",
        save: "Save",
        cancel: "Cancel",
        edit: "Edit",
        externalEdit: "Open Externally",
        viewChanges: "View Changes",
        openFolder: "Open Folder",
        metaAria: "File context",
        type: "Type",
        mode: "Mode",
        lines: "Lines",
        snapshot: "Snapshot",
        context: "Context",
        noBaseline: "No snapshot baseline",
        notCaptured: "Not in snapshot",
        captured: (snapshotNumber: number) => `Captured in v${snapshotNumber}`,
        modeDiff: "Diff View",
        modePending: "Awaiting Selection",
        modeLoading: "Loading",
        modeEditingDirty: "Editing · Unsaved",
        modeEditing: "Editing",
        modeReadonly: "Read Only",
        lineCount: (count: number) => `${count} lines`,
        contextRestored: "Restored last context",
        noticeAria: "Uncaptured changes notice",
        noticeKicker: "Workspace Notice",
        noticeTitle: "Current changes are not captured in a snapshot",
        noticeCount: (count: number) => `${count} files`,
        noticeWithBaseline: (snapshotNumber: number, count: number) =>
          `${count} files are still in workspace draft state compared with the latest snapshot v${snapshotNumber}.`,
        noticeWithoutBaseline: (count: number) =>
          `${count} files have not entered the first snapshot yet.`,
        noticeAction: "Go to Versions",
        backToFile: "Back to File View",
        editorAria: (name: string) => `Edit ${name}`,
        unsupportedTitle: "This file type is not supported for built-in preview yet",
        unsupportedDescription:
          "This is not a loading failure. You can still continue with Open Externally or Open Folder.",
        selectHint: "Select a file from the left to view it",
      }
    : {
        saveSuccess: "已保存到工作区",
        saveFailed: "保存失败",
        diffFailed: "读取变更失败",
        emptyTitle: "先选择一个技能",
        emptyDescription: "返回技能资产打开任意技能后，再进入文件工作区。",
        closeTree: "关闭文件目录",
        searchPlaceholder: "搜索文件或路径",
        filterAria: "文件过滤",
        filterAll: "全部文件",
        filterChanged: "仅未入快照文件",
        treeTitle: "完整文件树",
        matchCount: (count: number) => `${count} 个匹配`,
        changedCount: (count: number) => `${count} 个未入快照文件`,
        fileCount: (count: number) => `${count} 个文件`,
        treeEmptyChanged: "当前过滤结果下没有未入快照文件。",
        treeEmptySearch: "没有匹配的文件。",
        treeLoading: "加载文件中...",
        fileNav: "文件导航",
        noFileSelected: "未选择文件",
        save: "保存",
        cancel: "取消",
        edit: "编辑",
        externalEdit: "外部编辑",
        viewChanges: "查看变更",
        openFolder: "打开目录",
        metaAria: "文件上下文状态",
        type: "类型",
        mode: "模式",
        lines: "行数",
        snapshot: "快照",
        context: "上下文",
        noBaseline: "未建立快照基线",
        notCaptured: "未入快照",
        captured: (snapshotNumber: number) => `已入快照 v${snapshotNumber}`,
        modeDiff: "差异视图",
        modePending: "待选择",
        modeLoading: "读取中",
        modeEditingDirty: "编辑中 · 未保存",
        modeEditing: "编辑中",
        modeReadonly: "只读",
        lineCount: (count: number) => `${count} 行`,
        contextRestored: "已恢复上次上下文",
        noticeAria: "未入快照提示",
        noticeKicker: "工作区提醒",
        noticeTitle: "当前改动尚未进入快照",
        noticeCount: (count: number) => `${count} 个文件`,
        noticeWithBaseline: (snapshotNumber: number, count: number) =>
          `相对最新快照 v${snapshotNumber}，当前还有 ${count} 个文件停留在工作副本草稿态。`,
        noticeWithoutBaseline: (count: number) =>
          `当前还有 ${count} 个文件尚未进入首个快照。`,
        noticeAction: "前往版本页处理",
        backToFile: "返回文件视图",
        editorAria: (name: string) => `编辑 ${name}`,
        unsupportedTitle: "当前文件类型暂不支持内置查看",
        unsupportedDescription: "这不是加载失败。你仍然可以使用右上角的“外部编辑”或“打开目录”继续处理这个文件。",
        selectHint: "从左侧选择文件查看",
      };

  const selectedSkill = useMemo(
    () => skills.find((skill) => skill.id === selectedSkillId) ?? null,
    [skills, selectedSkillId],
  );

  useEffect(() => {
    setDiffResult(null);
    setDiffSelectedFile(null);
    setDiffMode("unified");
    setShowDiff(false);
  }, [selectedSkillId]);

  useEffect(() => {
    if (!selectedSkillId) {
      setTree(null);
      return;
    }

    setTree(null);
    listSkillFiles(selectedSkillId).then(setTree).catch(() => {});
  }, [selectedSkillId, browseRefreshToken]);

  useEffect(() => {
    if (!selectedSkillId || !selectedFile) {
      setFileContent(null);
      setDraftContent("");
      setIsEditing(false);
      return;
    }

    setLoadingContent(true);
    readSkillFile(selectedSkillId, selectedFile)
      .then((content) => {
        setFileContent(content);
        setDraftContent(content);
      })
      .catch(() => {
        setFileContent(null);
        setDraftContent("");
      })
      .finally(() => setLoadingContent(false));
  }, [selectedSkillId, selectedFile, browseRefreshToken]);

  const hasUnsavedChanges = useMemo(
    () => isEditing && fileContent !== null && draftContent !== fileContent,
    [draftContent, fileContent, isEditing],
  );

  const discardChanges = useCallback(() => {
    setDraftContent(fileContent ?? "");
    setIsEditing(false);
  }, [fileContent]);

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!selectedSkillId || !selectedFile || !hasUnsavedChanges) {
      return !hasUnsavedChanges;
    }

    setSaving(true);
    try {
      await writeSkillFile(selectedSkillId, selectedFile, draftContent);
      setFileContent(draftContent);
      setIsEditing(false);
      await Promise.all([listSkillFiles(selectedSkillId).then(setTree), loadChangeStatuses()]);
      message.success(copy.saveSuccess);
      return true;
    } catch (error) {
      message.error(`${copy.saveFailed}: ${error}`);
      return false;
    } finally {
      setSaving(false);
    }
  }, [copy.saveFailed, copy.saveSuccess, draftContent, hasUnsavedChanges, loadChangeStatuses, selectedFile, selectedSkillId]);

  const handleViewChanges = useCallback(async () => {
    if (!selectedSkillId) {
      return;
    }

    setShowDiff(true);
    setDiffLoading(true);
    setDiffResult(null);
    setDiffSelectedFile(null);

    try {
      const result = await diffWorkingDirectory(selectedSkillId);
      setDiffResult(result);

      if (
        selectedFile &&
        (result.modifiedFiles.includes(selectedFile) || result.addedFiles.includes(selectedFile))
      ) {
        setDiffSelectedFile(selectedFile);
      }
    } catch {
      setShowDiff(false);
      message.error(copy.diffFailed);
    } finally {
      setDiffLoading(false);
    }
  }, [copy.diffFailed, selectedFile, selectedSkillId]);

  useImperativeHandle(
    ref,
    () => ({
      hasUnsavedChanges: () => hasUnsavedChanges,
      saveChanges: handleSave,
      discardChanges,
    }),
    [discardChanges, handleSave, hasUnsavedChanges],
  );

  const changeStatus = selectedSkillId ? changeStatusMap[selectedSkillId] : undefined;
  const changedFiles = useMemo(() => {
    if (!changeStatus) {
      return [];
    }

    return Array.from(
      new Set([...changeStatus.modifiedFiles, ...changeStatus.addedFiles, ...changeStatus.deletedFiles]),
    );
  }, [changeStatus]);
  const changedPathSet = useMemo(() => new Set(changedFiles), [changedFiles]);
  const changedFileCount = changedFiles.length;
  const treeChildren = tree?.children ?? [];
  const treeStats = useMemo(() => collectTreeStats(treeChildren), [treeChildren]);
  const filteredTreeRoots = useMemo(() => {
    const baseNodes = filterMode === "changed" ? filterTreeByPaths(treeChildren, changedPathSet) : treeChildren;
    return filterTree(baseNodes, treeQuery);
  }, [changedPathSet, filterMode, treeChildren, treeQuery]);
  const filteredTreeStats = useMemo(() => collectTreeStats(filteredTreeRoots), [filteredTreeRoots]);
  const activeContent = isEditing ? draftContent : fileContent ?? "";
  const lineCount = activeContent ? activeContent.split("\n").length : 0;
  const viewerLines = useMemo(() => (fileContent != null ? fileContent.split("\n") : []), [fileContent]);
  const currentFileName = selectedFile ? selectedFile.split("/").pop() ?? selectedFile : null;
  const currentFileType = getFileTypeLabel(selectedFile, resolvedLanguage);
  const latestSnapshot = snapshots[0] ?? null;
  const isCurrentFileChanged =
    selectedFile != null &&
    (changeStatus?.modifiedFiles.includes(selectedFile) || changeStatus?.addedFiles.includes(selectedFile) || false);
  const currentFileSnapshotStatus = !selectedFile
    ? null
    : !latestSnapshot
      ? { label: copy.noBaseline, tone: "neutral" as const }
      : isCurrentFileChanged
        ? { label: copy.notCaptured, tone: "warning" as const }
        : { label: copy.captured(latestSnapshot.snapshotNumber), tone: "ready" as const };
  const currentMode = showDiff
    ? copy.modeDiff
    : !selectedFile
      ? copy.modePending
      : loadingContent
        ? copy.modeLoading
        : isEditing
          ? hasUnsavedChanges
            ? copy.modeEditingDirty
            : copy.modeEditing
          : copy.modeReadonly;
  const contextRestored = Boolean(selectedFile && restoredContextFile === selectedFile);

  useEffect(() => {
    if (!selectedSkillId) {
      restoredSkillIdRef.current = null;
      setRestoredContextFile(null);
      return;
    }

    if (restoredSkillIdRef.current === selectedSkillId) {
      return;
    }

    restoredSkillIdRef.current = selectedSkillId;
    setRestoredContextFile(null);
  }, [selectedSkillId]);

  useEffect(() => {
    if (!selectedSkillId || !tree || selectedFile) {
      return;
    }

    const session = loadFileWorkspaceSession(selectedSkillId);
    if (!session.selectedFile || !hasFilePath(treeChildren, session.selectedFile)) {
      return;
    }

    setRestoredContextFile(session.selectedFile);
    onFileSelect(session.selectedFile);
  }, [onFileSelect, selectedFile, selectedSkillId, tree, treeChildren]);

  useEffect(() => {
    if (!selectedSkillId || !selectedFile) {
      return;
    }

    persistFileWorkspaceSelection(selectedSkillId, selectedFile);
  }, [selectedFile, selectedSkillId]);

  useEffect(() => {
    if (!selectedSkillId || !selectedFile || loadingContent) {
      return;
    }

    const target = isEditing ? editorRef.current : viewerRef.current;
    if (!target) {
      return;
    }

    const savedScrollTop = getFileWorkspaceScrollPosition(selectedSkillId, selectedFile);
    target.scrollTop = savedScrollTop;
    if (!isEditing && gutterTrackRef.current) {
      gutterTrackRef.current.style.transform = `translateY(-${Math.max(0, savedScrollTop)}px)`;
    }
  }, [fileContent, isEditing, loadingContent, selectedFile, selectedSkillId]);

  const handleContentScroll = useCallback(() => {
    if (!selectedSkillId || !selectedFile) {
      return;
    }

    const target = isEditing ? editorRef.current : viewerRef.current;
    if (!target) {
      return;
    }

    if (!isEditing && gutterTrackRef.current) {
      gutterTrackRef.current.style.transform = `translateY(-${Math.max(0, target.scrollTop)}px)`;
    }
    persistFileWorkspaceScrollPosition(selectedSkillId, selectedFile, target.scrollTop);
  }, [isEditing, selectedFile, selectedSkillId]);

  const requestFileSelection = useCallback(
    (path: string) => {
      if (path === selectedFile) {
        setShowDiff(false);
        setIsTreeOpen(false);
        return;
      }

      const proceed = () => {
        setRestoredContextFile(null);
        setShowDiff(false);
        setDiffSelectedFile(null);
        setDiffMode("unified");
        onFileSelect(path);
        setIsTreeOpen(false);
      };

      if (hasUnsavedChanges && onRequestNavigateAway) {
        onRequestNavigateAway(proceed);
        return;
      }

      proceed();
    },
    [hasUnsavedChanges, onFileSelect, onRequestNavigateAway, selectedFile],
  );

  if (!selectedSkillId || !selectedSkill) {
    return (
      <div className="workspace-panel-empty">
        <strong>{copy.emptyTitle}</strong>
        <span>{copy.emptyDescription}</span>
      </div>
    );
  }

  return (
    <div className="file-explorer-panel file-workspace file-workspace--dense">
      <div className="file-workspace__layout">
        <button
          type="button"
          aria-label={copy.closeTree}
          className={`file-workspace__backdrop${isTreeOpen ? " is-open" : ""}`}
          onClick={() => setIsTreeOpen(false)}
        />

        <aside className={`file-workspace__sidebar${isTreeOpen ? " is-open" : ""}`}>
          <div className="file-workspace__sidebar-top">
            <div className="file-workspace__sidebar-toolbar">
              <Input
                allowClear
                value={treeQuery}
                onChange={(event) => setTreeQuery(event.target.value)}
                placeholder={copy.searchPlaceholder}
              />
            </div>

            <div className="file-workspace__filter-switch" role="group" aria-label={copy.filterAria}>
              <button
                type="button"
                className={`file-workspace__filter-button${filterMode === "all" ? " is-active" : ""}`}
                onClick={() => setFilterMode("all")}
              >
                {copy.filterAll}
              </button>
              <button
                type="button"
                className={`file-workspace__filter-button${filterMode === "changed" ? " is-active" : ""}`}
                onClick={() => setFilterMode("changed")}
              >
                {copy.filterChanged}
              </button>
            </div>
          </div>

          <div className="file-workspace__sidebar-sections">
            <div className="file-workspace__tree-panel">
              <div className="file-workspace__section-header">
                <span>{copy.treeTitle}</span>
                <small>
                  {treeQuery.trim()
                    ? copy.matchCount(filteredTreeStats.fileCount)
                    : filterMode === "changed"
                      ? copy.changedCount(filteredTreeStats.fileCount)
                      : copy.fileCount(treeStats.fileCount)}
                </small>
              </div>

              <div className="file-workspace__tree-scroll">
                {tree ? (
                  filteredTreeStats.fileCount > 0 ? (
                    <SkillFileTree
                      nodes={filteredTreeRoots}
                      changeStatus={changeStatus}
                      selectedFile={selectedFile}
                      onSelectFile={requestFileSelection}
                      language={resolvedLanguage}
                    />
                  ) : (
                    <div className="file-workspace__tree-empty">
                      {filterMode === "changed" ? copy.treeEmptyChanged : copy.treeEmptySearch}
                    </div>
                  )
                ) : (
                  <div className="file-workspace__tree-loading">
                    <Spin size="small" />
                    <span>{copy.treeLoading}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        <section className="file-content-panel file-content-panel--workspace">
          <div className="file-content-panel__toolbar file-content-panel__toolbar--workspace">
            <div className="file-content-panel__toolbar-main">
              <div className="file-content-panel__toolbar-top">
                <div className="file-content-panel__meta file-content-panel__meta--primary">
                  <Button
                    size="small"
                    icon={<FolderTree size={13} />}
                    className="file-content-panel__tree-toggle"
                    onClick={() => setIsTreeOpen((current) => !current)}
                  >
                    {copy.fileNav}
                  </Button>

                  <div className="file-content-panel__identity">
                    <div className="file-content-panel__identity-row">
                      <strong>{currentFileName ?? copy.noFileSelected}</strong>
                    </div>
                  </div>
                </div>

                <div className="file-content-panel__actions">
                  {isEditing ? (
                    <>
                      <Button
                        size="small"
                        type="primary"
                        icon={<Save size={13} />}
                        onClick={() => void handleSave()}
                        loading={saving}
                        disabled={!hasUnsavedChanges}
                      >
                        {copy.save}
                      </Button>
                      <Button size="small" icon={<X size={13} />} onClick={discardChanges} disabled={saving}>
                        {copy.cancel}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="small"
                        icon={<Edit3 size={13} />}
                        onClick={() => {
                          if (fileContent == null) {
                            return;
                          }
                          setDraftContent(fileContent);
                          setIsEditing(true);
                        }}
                        disabled={fileContent == null}
                      >
                        {copy.edit}
                      </Button>
                      <Button
                        size="small"
                        icon={<ExternalLink size={13} />}
                        onClick={() => {
                          if (selectedSkillId && selectedFile) {
                            void openFileInEditor(selectedSkillId, selectedFile);
                          }
                        }}
                        disabled={!selectedFile}
                      >
                        {copy.externalEdit}
                      </Button>
                      {isCurrentFileChanged ? (
                        <Button
                          size="small"
                          icon={<GitCompare size={13} />}
                          onClick={() => void handleViewChanges()}
                          loading={diffLoading}
                        >
                          {copy.viewChanges}
                        </Button>
                      ) : null}
                      <span className="file-content-panel__toolbar-sep" aria-hidden="true" />
                      <Button size="small" icon={<FolderOpen size={13} />} onClick={() => void openSkillFolder(selectedSkillId)}>
                        {copy.openFolder}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="file-content-panel__meta-strip" aria-label={copy.metaAria}>
                <span className={getFileMetaItemClassName("neutral")}>
                  <span className="file-content-panel__meta-key">{copy.type}</span>
                  <span className="file-content-panel__meta-value">{currentFileType}</span>
                </span>
                <span className={getFileMetaItemClassName(isEditing ? "editing" : "neutral")}>
                  <span className="file-content-panel__meta-key">{copy.mode}</span>
                  <span className="file-content-panel__meta-value">{currentMode}</span>
                </span>
                {selectedFile && fileContent != null ? (
                  <span className={getFileMetaItemClassName("metric")}>
                    <span className="file-content-panel__meta-key">{copy.lines}</span>
                    <span className="file-content-panel__meta-value">{copy.lineCount(lineCount)}</span>
                  </span>
                ) : null}
                {currentFileSnapshotStatus ? (
                  <span className={getFileMetaItemClassName(currentFileSnapshotStatus.tone)}>
                    <span className="file-content-panel__meta-key">{copy.snapshot}</span>
                    <span className="file-content-panel__meta-value">{currentFileSnapshotStatus.label}</span>
                  </span>
                ) : null}
                {contextRestored ? (
                  <span className={getFileMetaItemClassName("active")}>
                    <span className="file-content-panel__meta-key">{copy.context}</span>
                    <span className="file-content-panel__meta-value">{copy.contextRestored}</span>
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {changedFileCount > 0 ? (
            <div className="file-content-panel__notice" aria-label={copy.noticeAria}>
              <span className="file-content-panel__notice-marker" aria-hidden="true" />
              <div className="file-content-panel__notice-copy">
                <div className="file-content-panel__notice-title-row">
                  <span className="file-content-panel__notice-kicker">{copy.noticeKicker}</span>
                  <strong>{copy.noticeTitle}</strong>
                  <span className="file-content-panel__notice-count">{copy.noticeCount(changedFileCount)}</span>
                </div>
                <span>
                  {latestSnapshot
                    ? copy.noticeWithBaseline(latestSnapshot.snapshotNumber, changedFileCount)
                    : copy.noticeWithoutBaseline(changedFileCount)}
                </span>
              </div>
              <Button type="link" size="small" className="file-content-panel__notice-action" onClick={onOpenVersions}>
                {copy.noticeAction}
              </Button>
            </div>
          ) : null}

          <div className="file-content-panel__body">
            {loadingContent ? (
              <div className="file-content-panel__loading">
                <Spin />
              </div>
            ) : null}

            {showDiff ? (
              <div className="file-content-panel__diff-view">
                <div className="file-content-panel__diff-toolbar">
                  <Button type="link" size="small" className="file-content-panel__diff-back" onClick={() => setShowDiff(false)}>
                    {copy.backToFile}
                  </Button>
                </div>

                <VersionCompareResults
                  diffResult={diffResult}
                  diffLoading={diffLoading}
                  selectedFile={diffSelectedFile}
                  diffMode={diffMode}
                  onSelectFile={(file) => setDiffSelectedFile(file)}
                  onDiffModeChange={(mode) => setDiffMode(mode)}
                  language={resolvedLanguage}
                />
              </div>
            ) : selectedFile ? (
              isEditing ? (
                <div className="file-content-panel__editor-shell">
                  <textarea
                    ref={editorRef}
                    value={draftContent}
                    onChange={(event) => setDraftContent(event.target.value)}
                    onScroll={handleContentScroll}
                    onKeyDown={(event) => {
                      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
                        event.preventDefault();
                        void handleSave();
                      }
                    }}
                    spellCheck={false}
                    wrap="off"
                    aria-label={copy.editorAria(currentFileName ?? selectedFile)}
                    className="file-content-panel__editor"
                  />
                </div>
              ) : fileContent != null ? (
                <div className="file-content-panel__viewer-shell">
                  <div className="file-content-panel__viewer-gutter" aria-hidden="true">
                    <div ref={gutterTrackRef} className="file-content-panel__viewer-gutter-track">
                      {viewerLines.map((_, index) => (
                        <div key={index} className="file-content-panel__viewer-gutter-line">
                          <span className="file-content-panel__line-number">{index + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div ref={viewerRef} className="file-content-panel__viewer" onScroll={handleContentScroll}>
                    <div className="file-content-panel__viewer-content">
                      {viewerLines.map((line, index) => (
                        <div key={index} className="file-content-panel__line">
                          <span className="file-content-panel__line-text">{line || " "}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="file-content-panel__empty-state">
                  <h3>{copy.unsupportedTitle}</h3>
                  <p>{copy.unsupportedDescription}</p>
                </div>
              )
            ) : (
              <div className="file-content-panel__empty-hint">{copy.selectHint}</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
});
