import { useEffect, useMemo, useState } from "react";
import Form from "antd/es/form";
import Input from "antd/es/input";
import Modal from "antd/es/modal";
import Select from "antd/es/select";
import Typography from "antd/es/typography";
import { useI18n } from "@/features/settings/state/I18nContext";
import { useTeamContext } from "@/features/teams/state/TeamContext";
import type { TeamSkill } from "@/types/team";

interface SubmitToTeamModalProps {
  open: boolean;
  skillId: string;
  snapshotId: string;
  onCancel: () => void;
  onSubmitted?: () => void;
  onSubmittingChange?: (submitting: boolean) => void;
}

const { Text } = Typography;

export function SubmitToTeamModal({
  open,
  skillId,
  snapshotId,
  onCancel,
  onSubmitted,
  onSubmittingChange,
}: SubmitToTeamModalProps) {
  const { resolvedLanguage } = useI18n();
  const { teams, selectedTeamId, selectTeam, teamSkills, loadTeamSkills, submitToTeam } = useTeamContext();
  const [submitter, setSubmitter] = useState("jensen");
  const [submitMessage, setSubmitMessage] = useState("");
  const [teamSkillId, setTeamSkillId] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const copy = useMemo(() => (
    resolvedLanguage === "en-US"
      ? {
          title: "Submit to team",
          submit: "Submit",
          cancel: "Cancel",
          teamLabel: "Target team",
          teamPlaceholder: "Select a team",
          teamSkillLabel: "Target team skill",
          teamSkillPlaceholder: "Choose an existing team skill or leave empty to create one",
          newTeamSkillOption: "Submit as a new team skill",
          submitterLabel: "Submitter",
          summaryLabel: "Note",
          summaryPlaceholder: "Describe this submission (optional)",
          emptyHint: "Create a team on the Teams page first.",
          sourceSkill: "Source skill",
          sourceSnapshot: "Source snapshot",
        }
      : {
          title: "提交团队",
          submit: "提交",
          cancel: "取消",
          teamLabel: "目标团队",
          teamPlaceholder: "请选择团队",
          teamSkillLabel: "目标团队技能",
          teamSkillPlaceholder: "可选择已有团队技能，或留空新建",
          newTeamSkillOption: "作为新团队技能提交",
          submitterLabel: "提交人",
          summaryLabel: "说明",
          summaryPlaceholder: "本次提交改动说明（可选）",
          emptyHint: "请先到团队页面创建团队。",
          sourceSkill: "来源技能",
          sourceSnapshot: "来源快照",
        }
  ), [resolvedLanguage]);

  useEffect(() => {
    if (open && selectedTeamId) {
      loadTeamSkills(selectedTeamId);
    }
  }, [open, selectedTeamId, loadTeamSkills]);

  useEffect(() => {
    if (!open) {
      setSubmitMessage("");
      setTeamSkillId(undefined);
    }
  }, [open]);

  useEffect(() => {
    onSubmittingChange?.(submitting);
  }, [onSubmittingChange, submitting]);

  const teamOptions = useMemo(
    () => teams.map((team) => ({ label: team.name, value: team.id })),
    [teams],
  );

  const skillOptions = useMemo(
    () => [{ label: copy.newTeamSkillOption, value: "" }, ...teamSkills.map((skill: TeamSkill) => ({ label: skill.name, value: skill.id }))],
    [copy.newTeamSkillOption, teamSkills],
  );

  const handleOk = async () => {
    if (!selectedTeamId) return;
    setSubmitting(true);
    const result = await submitToTeam({
      teamId: selectedTeamId,
      teamSkillId: teamSkillId || undefined,
      sourceSkillId: skillId,
      sourceSnapshotId: snapshotId,
      submitter,
      submitMessage: submitMessage || undefined,
    });
    setSubmitting(false);
    if (result) {
      onSubmitted?.();
      onCancel();
    }
  };

  return (
    <Modal
      title={copy.title}
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText={copy.submit}
      cancelText={copy.cancel}
      okButtonProps={{ disabled: !selectedTeamId, loading: submitting }}
    >
      <Form layout="vertical">
        <Form.Item label={copy.teamLabel} required>
          <Select
            placeholder={copy.teamPlaceholder}
            options={teamOptions}
            value={selectedTeamId ?? undefined}
            onChange={(value) => {
              selectTeam(value);
              setTeamSkillId(undefined);
            }}
          />
        </Form.Item>
        <Form.Item label={copy.teamSkillLabel}>
          <Select
            placeholder={copy.teamSkillPlaceholder}
            options={skillOptions}
            value={teamSkillId ?? ""}
            onChange={(value) => setTeamSkillId(value || undefined)}
            disabled={!selectedTeamId}
          />
        </Form.Item>
        <Form.Item label={copy.submitterLabel}>
          <Input value={submitter} onChange={(e) => setSubmitter(e.target.value)} />
        </Form.Item>
        <Form.Item label={copy.summaryLabel}>
          <Input.TextArea
            rows={3}
            value={submitMessage}
            onChange={(e) => setSubmitMessage(e.target.value)}
            placeholder={copy.summaryPlaceholder}
          />
        </Form.Item>
      </Form>
      {!teams.length && <Text type="secondary">{copy.emptyHint}</Text>}
      <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
        {copy.sourceSkill}：{skillId} · {copy.sourceSnapshot}：{snapshotId}
      </div>
    </Modal>
  );
}
