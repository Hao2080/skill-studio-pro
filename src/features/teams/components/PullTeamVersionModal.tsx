import { useEffect, useState } from "react";
import Alert from "antd/es/alert";
import Form from "antd/es/form";
import Modal from "antd/es/modal";
import Radio from "antd/es/radio";
import Select from "antd/es/select";
import { useI18n } from "@/features/settings/state/I18nContext";
import { useSkillContext } from "@/features/skills/state/SkillContext";
import { useTeamContext } from "@/features/teams/state/TeamContext";
import type { TeamSkillVersion } from "@/types/team";

interface PullTeamVersionModalProps {
  open: boolean;
  version: TeamSkillVersion;
  onCancel: () => void;
  onPulled: (skillId: string, mode: string) => void;
}

export function PullTeamVersionModal({ open, version, onCancel, onPulled }: PullTeamVersionModalProps) {
  const { resolvedLanguage } = useI18n();
  const { pullTeamVersion, checkPullImpact } = useTeamContext();
  const { skills } = useSkillContext();
  const [mode, setMode] = useState<"new_skill" | "append_snapshot">("new_skill");
  const [targetSkillId, setTargetSkillId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [impactChecking, setImpactChecking] = useState(false);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const copy = resolvedLanguage === "en-US"
    ? {
        title: `Pull to Personal - v${version.versionNumber}`,
        confirm: "Pull",
        cancel: "Cancel",
        warningTitle: "Local changes detected in the target skill. Pull is blocked for now.",
        warningDescription: "Please snapshot or resolve local changes before pulling this team version.",
        modeLabel: "Pull mode",
        modeNew: "Import as new skill",
        modeAppend: "Append snapshot to existing skill",
        targetLabel: "Target skill",
        targetHint: "Checking whether the target skill has local changes...",
        targetPlaceholder: "Select a target skill",
        appendHint: "The target workspace will be overwritten and a new snapshot will be appended.",
      }
    : {
        title: `拉取到个人 — v${version.versionNumber}`,
        confirm: "拉取",
        cancel: "取消",
        warningTitle: "检测到目标 Skill 有本地改动，当前已阻止拉取",
        warningDescription: "请先处理或快照你的个人改动，再执行“拉取到个人”。",
        modeLabel: "拉取方式",
        modeNew: "导入为新 Skill",
        modeAppend: "追加快照到已有 Skill",
        targetLabel: "目标 Skill",
        targetHint: "正在检测目标 Skill 是否存在本地改动...",
        targetPlaceholder: "请选择目标 Skill",
        appendHint: "将覆盖目标技能工作区，并追加一个新快照",
      };

  const skillOptions = skills.map((s) => ({ label: s.name, value: s.id }));

  useEffect(() => {
    if (!open) {
      setMode("new_skill");
      setTargetSkillId(undefined);
      setHasLocalChanges(false);
      setImpactChecking(false);
    }
  }, [open]);

  useEffect(() => {
    let cancelled = false;

    if (!open || mode !== "append_snapshot" || !targetSkillId) {
      setHasLocalChanges(false);
      setImpactChecking(false);
      return;
    }

    setImpactChecking(true);
    checkPullImpact({
      teamVersionId: version.id,
      mode,
      targetSkillId,
    })
      .then((result) => {
        if (!cancelled) {
          setHasLocalChanges(result?.hasLocalChanges ?? false);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setImpactChecking(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, mode, targetSkillId, version.id, checkPullImpact]);

  const handleOk = async () => {
    if (mode === "append_snapshot" && !targetSkillId) return;
    setLoading(true);
    const skillId = await pullTeamVersion({
      teamVersionId: version.id,
      mode,
      targetSkillId: mode === "append_snapshot" ? targetSkillId : undefined,
    });
    setLoading(false);
    if (skillId) {
      onPulled(skillId, mode);
      onCancel();
    }
  };

  const okDisabled = mode === "append_snapshot" && (!targetSkillId || hasLocalChanges || impactChecking);

  return (
    <Modal
      rootClassName="teams-modal"
      title={copy.title}
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText={copy.confirm}
      cancelText={copy.cancel}
      okButtonProps={{ loading, disabled: okDisabled }}
    >
      {mode === "append_snapshot" && hasLocalChanges && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={copy.warningTitle}
          description={copy.warningDescription}
        />
      )}
      <Form layout="vertical">
        <Form.Item label={copy.modeLabel}>
          <Radio.Group
            value={mode}
            onChange={(e) => {
              setMode(e.target.value);
              setTargetSkillId(undefined);
            }}
          >
            <Radio value="new_skill">{copy.modeNew}</Radio>
            <Radio value="append_snapshot">{copy.modeAppend}</Radio>
          </Radio.Group>
        </Form.Item>
        {mode === "append_snapshot" && (
          <Form.Item label={copy.targetLabel} required extra={impactChecking ? copy.targetHint : undefined}>
            <Select
              placeholder={copy.targetPlaceholder}
              options={skillOptions}
              value={targetSkillId}
              onChange={setTargetSkillId}
              showSearch
              filterOption={(input, option) =>
                String(option?.label ?? "").toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
        )}
      </Form>
      {mode === "append_snapshot" && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
          {copy.appendHint}
        </div>
      )}
    </Modal>
  );
}
