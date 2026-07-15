import { useEffect, useState } from "react";
import Alert from "antd/es/alert";
import Form from "antd/es/form";
import Input from "antd/es/input";
import Modal from "antd/es/modal";
import Segmented from "antd/es/segmented";
import Space from "antd/es/space";
import Tag from "antd/es/tag";
import { useI18n } from "@/features/settings/state/I18nContext";
import { useTeamContext } from "@/features/teams/state/TeamContext";
import type { TeamSubmission, TeamSubmissionFileResolutionInput, TeamSubmissionMergePreview } from "@/types/team";
import "../styles.css";

const DEFAULT_TEAM_ACTOR = "jensen";

interface MergeSubmissionModalProps {
  open: boolean;
  submission: TeamSubmission;
  onCancel: () => void;
  onMerged: (teamSkillId?: string) => void;
}

export function MergeSubmissionModal({ open, submission, onCancel, onMerged }: MergeSubmissionModalProps) {
  const { resolvedLanguage } = useI18n();
  const { loadSubmissionMergePreview, mergeSubmission } = useTeamContext();
  const [mergedBy, setMergedBy] = useState(DEFAULT_TEAM_ACTOR);
  const [changeSummary, setChangeSummary] = useState("");
  const [preview, setPreview] = useState<TeamSubmissionMergePreview | null>(null);
  const [fileResolutions, setFileResolutions] = useState<Record<string, TeamSubmissionFileResolutionInput["resolution"]>>({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const copy = resolvedLanguage === "en-US"
    ? {
        title: "Merge Submission",
        confirm: "Merge",
        confirmResolved: "Merge with decisions",
        cancel: "Cancel",
        mergedBy: "Merged by",
        summary: "Change summary (optional)",
        placeholder: "Describe what was merged and why",
        submitter: "Submitter",
        mergePreview: "Merge preview",
        clean: "Clean merge",
        staleClean: "Current team version changed; can auto-apply non-overlapping files",
        conflict: "Concurrent conflict detected",
        newSkill: "New team skill",
        changedFiles: "Submitted files",
        concurrentFiles: "Concurrent files",
        conflictingFiles: "Conflicting files",
        baseVersion: "Base",
        currentVersion: "Current",
        noVersion: "None",
        fileDecisions: "File decisions",
        useIncoming: "Use submission",
        keepCurrent: "Keep current",
        pendingDecisions: "Unresolved files",
      }
    : {
        title: "合并提交",
        confirm: "合并",
        confirmResolved: "按决策合并",
        cancel: "取消",
        mergedBy: "合并人",
        summary: "变更说明（可选）",
        placeholder: "描述此次合并的内容或原因",
        submitter: "提交人",
        mergePreview: "合并预检",
        clean: "可直接合并",
        staleClean: "团队当前版本已有变化，可自动叠加非重叠文件",
        conflict: "发现并发冲突",
        newSkill: "新团队技能资产",
        changedFiles: "提交文件",
        concurrentFiles: "并发文件",
        conflictingFiles: "冲突文件",
        baseVersion: "基准",
        currentVersion: "当前",
        noVersion: "无",
        fileDecisions: "文件决策",
        useIncoming: "采用提交",
        keepCurrent: "保留当前",
        pendingDecisions: "未决策文件",
      };

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setFileResolutions({});
      setMergedBy(DEFAULT_TEAM_ACTOR);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    void loadSubmissionMergePreview(submission.id).then((result) => {
      if (!cancelled) {
        setPreview(result);
        setFileResolutions({});
        setPreviewLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadSubmissionMergePreview, open, submission.id]);

  const previewStatus = (() => {
    if (!preview) return null;
    if (preview.requiresManualMerge) return { color: "red", text: copy.conflict };
    if (preview.staleBase) return { color: "gold", text: copy.staleClean };
    if (preview.summary === "new_skill") return { color: "blue", text: copy.newSkill };
    return { color: "green", text: copy.clean };
  })();

  const unresolvedConflictCount = preview?.requiresManualMerge
    ? preview.conflictingFiles.filter((file) => !fileResolutions[file]).length
    : 0;
  const requiresFileDecisions = Boolean(preview?.requiresManualMerge);

  const handleOk = async () => {
    if (requiresFileDecisions && unresolvedConflictCount > 0) {
      return;
    }

    const conflictFileResolutions: TeamSubmissionFileResolutionInput[] | undefined = preview?.requiresManualMerge
      ? preview.conflictingFiles.map((file) => ({
          filePath: file,
          resolution: fileResolutions[file],
        }))
      : undefined;

    setLoading(true);
    const result = await mergeSubmission({
      submissionId: submission.id,
      mergedBy,
      changeSummary: changeSummary || undefined,
      resolutionMode: requiresFileDecisions ? "manual_files" : "auto",
      fileResolutions: conflictFileResolutions,
    });
    setLoading(false);
    if (result) {
      setChangeSummary("");
      onMerged(submission.teamSkillId);
    }
  };

  return (
    <Modal
      rootClassName="teams-modal"
      title={copy.title}
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText={requiresFileDecisions ? copy.confirmResolved : copy.confirm}
      cancelText={copy.cancel}
      okButtonProps={{
        loading: loading || previewLoading,
        disabled: requiresFileDecisions && unresolvedConflictCount > 0,
      }}
    >
      <div className="teams-page__merge-preview">
        <div className="teams-page__merge-preview-header">
          <span>{copy.mergePreview}</span>
          {previewStatus && <Tag color={previewStatus.color}>{previewStatus.text}</Tag>}
        </div>
        {preview?.requiresManualMerge && (
          <Alert type="error" showIcon message={copy.conflict} />
        )}
        {preview && (
          <>
            <div className="teams-page__merge-meta">
              <span>{copy.baseVersion}: {preview.baseVersion?.versionNumber ?? copy.noVersion}</span>
              <span>{copy.currentVersion}: {preview.currentVersion?.versionNumber ?? copy.noVersion}</span>
            </div>
            <Space wrap size={[8, 8]}>
              <Tag>{copy.changedFiles}: {preview.changedFiles.length}</Tag>
              <Tag>{copy.concurrentFiles}: {preview.concurrentlyChangedFiles.length}</Tag>
              <Tag color={preview.conflictingFiles.length > 0 ? "red" : "default"}>
                {copy.conflictingFiles}: {preview.conflictingFiles.length}
              </Tag>
            </Space>
            {preview.conflictingFiles.length > 0 && (
              <div className="teams-page__merge-resolution-list">
                <div className="teams-page__merge-resolution-title">{copy.fileDecisions}</div>
                {preview.conflictingFiles.map((file) => (
                  <div className="teams-page__merge-resolution-row" key={file}>
                    <code>{file}</code>
                    <Segmented
                      size="small"
                      value={fileResolutions[file] ?? "pending"}
                      options={[
                        { label: copy.useIncoming, value: "incoming" },
                        { label: copy.keepCurrent, value: "current" },
                      ]}
                      onChange={(value) => {
                        setFileResolutions((current) => ({
                          ...current,
                          [file]: value as TeamSubmissionFileResolutionInput["resolution"],
                        }));
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
            {preview.requiresManualMerge && unresolvedConflictCount > 0 && (
              <div className="teams-page__merge-resolution-hint">
                {copy.pendingDecisions}: {unresolvedConflictCount}
              </div>
            )}
          </>
        )}
      </div>
      <Form layout="vertical">
        <Form.Item label={copy.mergedBy}>
          <Input value={mergedBy} onChange={(e) => setMergedBy(e.target.value)} />
        </Form.Item>
        <Form.Item label={copy.summary}>
          <Input.TextArea
            rows={3}
            value={changeSummary}
            onChange={(e) => setChangeSummary(e.target.value)}
            placeholder={copy.placeholder}
          />
        </Form.Item>
      </Form>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
        {copy.submitter}：{submission.submitter}
        {submission.submitMessage && <span>　·　{submission.submitMessage}</span>}
      </div>
    </Modal>
  );
}
