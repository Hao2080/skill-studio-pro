import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  ExternalLink,
  FileCode2,
  FileWarning,
  LoaderCircle,
  RotateCcw,
  Save,
  ShieldCheck,
} from "lucide-react";
import { StatusBadge } from "@/shared/components/pro";
import type { SaveTextFileInput, SaveTextFileResult } from "@/features/lifecycle/model";
import {
  clearNavigationDirty,
  setNavigationDirty,
} from "../navigationGuard";
import "../styles.css";

export interface EditorFile {
  path: string;
  type: string;
  size?: number;
}

export interface SkillEditorWorkspaceProps {
  skillId: string;
  isLibrary: boolean;
  files: EditorFile[];
  initialContent?: string;
  readFile(relativePath: string): Promise<string>;
  saveFile?(input: SaveTextFileInput): Promise<SaveTextFileResult>;
  openExternal?(relativePath: string): Promise<void>;
  onSaved?(result: SaveTextFileResult): Promise<void> | void;
  onExternalChange?(relativePath: string, content: string): Promise<void> | void;
  onRequestRegister?(): void;
}

type EditorState = "readonly" | "loading" | "clean" | "dirty" | "saving" | "save_error";

const EDITABLE_EXTENSIONS = new Set([
  "",
  "md",
  "markdown",
  "yaml",
  "yml",
  "json",
  "toml",
  "txt",
  "text",
]);

function createSessionId() {
  return globalThis.crypto?.randomUUID?.() ?? `edit-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function editorFormat(relativePath: string) {
  const pathParts = relativePath.split("/");
  const name = pathParts[pathParts.length - 1] ?? relativePath;
  const nameParts = name.split(".");
  const extension = name.includes(".") ? nameParts[nameParts.length - 1]?.toLowerCase() ?? "" : "";
  if (extension === "md" || extension === "markdown") return { extension, label: "Markdown", editable: true };
  if (extension === "yaml" || extension === "yml") return { extension, label: "YAML", editable: true };
  if (extension === "json") return { extension, label: "JSON", editable: true };
  if (extension === "toml") return { extension, label: "TOML", editable: true };
  if (extension === "txt" || extension === "text" || extension === "") return { extension, label: "纯文本", editable: true };
  return { extension, label: "二进制或不支持的格式", editable: EDITABLE_EXTENSIONS.has(extension) };
}

function clientValidation(path: string, content: string) {
  const { extension } = editorFormat(path);
  if (extension !== "json") return "";
  try {
    JSON.parse(content);
    return "";
  } catch (error) {
    return `INVALID_JSON: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export function SkillEditorWorkspace({
  skillId,
  isLibrary,
  files,
  initialContent = "",
  readFile,
  saveFile,
  openExternal,
  onSaved,
  onExternalChange,
  onRequestRegister,
}: SkillEditorWorkspaceProps) {
  const sourceId = useMemo(() => `editor:${skillId}`, [skillId]);
  const editSessionId = useMemo(createSessionId, [skillId]);
  const initialPath = files.some((file) => file.path === "SKILL.md")
    ? "SKILL.md"
    : files[0]?.path ?? "SKILL.md";
  const [selectedPath, setSelectedPath] = useState(initialPath);
  const [original, setOriginal] = useState(initialPath === "SKILL.md" ? initialContent : "");
  const [content, setContent] = useState(initialPath === "SKILL.md" ? initialContent : "");
  const [state, setState] = useState<EditorState>(isLibrary ? "clean" : "readonly");
  const [editMode, setEditMode] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saveResult, setSaveResult] = useState<SaveTextFileResult | null>(null);
  const pendingExternalRefresh = useRef(false);
  const selectedPathRef = useRef(selectedPath);

  const selectedFile = files.find((file) => file.path === selectedPath);
  const format = editorFormat(selectedPath);
  const fileIsRegular = !selectedFile || ["file", "文件"].includes(selectedFile.type);
  const canEdit = isLibrary && format.editable && fileIsRegular;
  const dirty = content !== original;
  const validationError = clientValidation(selectedPath, content);

  useEffect(() => {
    selectedPathRef.current = selectedPath;
  }, [selectedPath]);

  useEffect(() => {
    setNavigationDirty(sourceId, dirty);
    return () => clearNavigationDirty(sourceId);
  }, [dirty, sourceId]);

  useEffect(() => {
    if (!dirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  const loadFile = useCallback(async (path: string, externalCheck = false) => {
    setState("loading");
    setError("");
    try {
      const next = await readFile(path);
      if (externalCheck && next !== original) {
        setNotice("检测到外部编辑器修改，已重新载入文件。映射状态会在详情刷新后重新校验。");
        await onExternalChange?.(path, next);
      }
      setOriginal(next);
      setContent(next);
      setSaveResult(null);
      setState(isLibrary ? "clean" : "readonly");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      setOriginal("");
      setContent("");
      setError(format.editable ? message : "该文件不能作为 UTF-8 文本读取，仅提供只读文件条目。");
      setState("readonly");
    }
  }, [format.editable, isLibrary, onExternalChange, original, readFile]);

  useEffect(() => {
    if (selectedPath === "SKILL.md" && initialContent && !content && !original) {
      setContent(initialContent);
      setOriginal(initialContent);
      setState(isLibrary ? "clean" : "readonly");
    }
  }, [content, initialContent, isLibrary, original, selectedPath]);

  useEffect(() => {
    const handleFocus = () => {
      if (!pendingExternalRefresh.current) return;
      pendingExternalRefresh.current = false;
      void loadFile(selectedPathRef.current, true);
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [loadFile]);

  async function selectFile(path: string) {
    if (path === selectedPath) return;
    if (dirty && !window.confirm("当前文件有未保存修改。切换文件会放弃修改，确定继续吗？")) return;
    setSelectedPath(path);
    setEditMode(false);
    setNotice("");
    await loadFile(path);
  }

  function discard() {
    setContent(original);
    setError("");
    setNotice("已放弃本文件的未保存修改。");
    setState(isLibrary ? "clean" : "readonly");
  }

  async function save() {
    if (!saveFile || !canEdit || !dirty) return;
    if (validationError) {
      setError(validationError);
      setState("save_error");
      return;
    }
    setState("saving");
    setError("");
    try {
      const result = await saveFile({
        skillId,
        relativePath: selectedPath,
        content,
        editSessionId,
      });
      setOriginal(content);
      setSaveResult(result);
      setState("clean");
      setNotice("保存成功；内容哈希、恢复点、差异、操作记录和映射状态已刷新。");
      await onSaved?.(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setState("save_error");
    }
  }

  async function openInExternalEditor() {
    if (!openExternal) return;
    if (dirty && !window.confirm("请先保存或放弃当前修改，再打开外部编辑器。要放弃当前修改吗？")) return;
    if (dirty) discard();
    setError("");
    try {
      await openExternal(selectedPath);
      pendingExternalRefresh.current = true;
      setNotice("已交给系统受控入口打开；返回应用窗口时会重新读取并检测变化。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  return (
    <section className="glass-panel skill-editor" aria-label="Skill 文件编辑器">
      <aside className="skill-editor__files" aria-label="Skill 文件列表">
        <header><strong>文件</strong><StatusBadge label={`${files.length}`} tone="info" /></header>
        <div>
          {files.map((file) => {
            const nextFormat = editorFormat(file.path);
            return (
              <button
                key={file.path}
                type="button"
                className={selectedPath === file.path ? "is-selected" : ""}
                aria-current={selectedPath === file.path ? "true" : undefined}
                onClick={() => void selectFile(file.path)}
              >
                {nextFormat.editable ? <FileCode2 size={14} /> : <FileWarning size={14} />}
                <span><strong>{file.path}</strong><small>{nextFormat.label}{file.size == null ? "" : ` · ${file.size} B`}</small></span>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="skill-editor__workspace">
        <header className="skill-editor__toolbar">
          <div>
            <strong>{selectedPath}</strong>
            <span>{format.label}</span>
            <StatusBadge label={dirty ? "未保存" : state === "saving" ? "保存中" : editMode ? "编辑模式" : "只读预览"} tone={dirty ? "warning" : state === "save_error" ? "danger" : editMode ? "info" : "neutral"} />
          </div>
          <div>
            {!isLibrary ? <button type="button" className="pro-button" onClick={onRequestRegister}><ShieldCheck size={14} />纳入中央库后编辑</button> : null}
            {canEdit && !editMode ? <button type="button" className="pro-button" onClick={() => setEditMode(true)}><Edit3 size={14} />进入编辑</button> : null}
            {canEdit && editMode ? <button type="button" className="pro-button" onClick={discard} disabled={!dirty || state === "saving"}><RotateCcw size={14} />放弃修改</button> : null}
            {canEdit && editMode ? <button type="button" className="pro-button pro-button--primary" onClick={() => void save()} disabled={!dirty || state === "saving"}><Save size={14} />{state === "saving" ? "保存中" : "保存"}</button> : null}
            {isLibrary && openExternal ? <button type="button" className="pro-button" onClick={() => void openInExternalEditor()}><ExternalLink size={14} />外部编辑器</button> : null}
          </div>
        </header>

        {error ? <div className="skill-editor__message is-error" role="alert"><AlertTriangle size={15} /><span><strong>未保存</strong>{error}</span></div> : null}
        {notice ? <div className="skill-editor__message is-success" role="status"><CheckCircle2 size={15} /><span>{notice}</span></div> : null}
        {state === "loading" ? <div className="skill-editor__loading" role="status"><LoaderCircle size={22} />正在读取 {selectedPath}</div> : null}
        {state !== "loading" && format.editable && fileIsRegular ? (
          editMode && isLibrary ? (
            <textarea
              className="skill-editor__textarea"
              aria-label={`${selectedPath} 编辑器`}
              value={content}
              spellCheck={format.extension === "md" || format.extension === "markdown"}
              onChange={(event) => {
                setContent(event.target.value);
                setError("");
                setState(event.target.value === original ? "clean" : "dirty");
              }}
            />
          ) : <pre className="skill-editor__preview">{content || "文件为空，或当前内容无法读取。"}</pre>
        ) : state !== "loading" ? <div className="skill-editor__binary"><FileWarning size={28} /><strong>二进制或不支持的文本格式</strong><p>应用内不写入此文件。中央 Skill 可通过受控系统入口打开，并在返回时检测变化。</p></div> : null}

        {saveResult ? (
          <dl className="skill-editor__save-result" aria-label="保存结果">
            <div><dt>恢复点</dt><dd><code>{saveResult.recoverySnapshotId}</code>{saveResult.recoveryPointCreated ? "（本会话新建）" : "（本会话复用）"}</dd></div>
            <div><dt>before hash</dt><dd><code>{saveResult.beforeHash ?? "新文件"}</code></dd></div>
            <div><dt>after hash</dt><dd><code>{saveResult.afterHash}</code></dd></div>
            <div><dt>过期映射</dt><dd>{saveResult.outdatedMappingCount}</dd></div>
          </dl>
        ) : null}
      </div>
    </section>
  );
}
