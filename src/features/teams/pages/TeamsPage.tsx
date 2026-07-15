import { useEffect, useMemo, useState } from "react";
import Button from "antd/es/button";
import Card from "antd/es/card";
import Empty from "antd/es/empty";
import Form from "antd/es/form";
import Input from "antd/es/input";
import List from "antd/es/list";
import Modal from "antd/es/modal";
import Popconfirm from "antd/es/popconfirm";
import Select from "antd/es/select";
import Space from "antd/es/space";
import Tabs from "antd/es/tabs";
import Tag from "antd/es/tag";
import Typography from "antd/es/typography";
import { Archive, History, Settings, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import "../styles.css";
import { useI18n } from "@/features/settings/state/I18nContext";
import { useSkillContext } from "@/features/skills/state/SkillContext";
import { useSnapshotContext } from "@/features/snapshots/state/SnapshotContext";
import { MergeSubmissionModal } from "@/features/teams/components/MergeSubmissionModal";
import { PullTeamVersionModal } from "@/features/teams/components/PullTeamVersionModal";
import { TeamDiffPreviewModal } from "@/features/teams/components/TeamDiffPreviewModal";
import { TeamVersionBrowserModal } from "@/features/teams/components/TeamVersionBrowserModal";
import { useTeamContext } from "@/features/teams/state/TeamContext";
import type { SkillFileNode } from "@/types/skill";
import type {
  Team,
  TeamDiffResult,
  TeamMember,
  TeamSkillVersion,
  TeamSubmission,
} from "@/types/team";
import {
  createEmptyMemberForm,
  DEFAULT_TEAM_ACTOR,
  formatTeamDate,
  getActivityActionLabel,
  getRoleLevel,
  getSubmissionStatusLabel,
  getTeamsCopy,
  MEMBER_STATUS_OPTIONS,
  ROLE_OPTIONS,
} from "../model/teamPresentation";
import type { MemberFormState } from "../model/teamPresentation";
import { findDefaultBrowserFile } from "../model/teamVersionBrowser";

const { Title, Text, Paragraph } = Typography;

export function TeamsPage() {
  const { resolvedLanguage } = useI18n();
  const {
    teams,
    selectedTeamId,
    selectTeam,
    createTeam,
    updateTeam,
    setTeamStatus,
    deleteTeam,
    teamSkills,
    members,
    activities,
    createTeamMember,
    updateTeamMember,
    removeTeamMember,
    submissions,
    versionsByTeamSkillId,
    loadVersions,
    loadSubmissionDiff,
    loadVersionDiff,
    listTeamVersionFiles,
    readTeamVersionFile,
    rejectSubmission,
    setRecommendedVersion,
  } = useTeamContext();
  const { loadSkills } = useSkillContext();
  const { loadSnapshots } = useSnapshotContext();

  const [teamName, setTeamName] = useState("");
  const [teamDescription, setTeamDescription] = useState("");
  const [teamEditName, setTeamEditName] = useState("");
  const [teamEditDescription, setTeamEditDescription] = useState("");
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [memberForm, setMemberForm] = useState<MemberFormState>(() => createEmptyMemberForm());
  const [mergeTarget, setMergeTarget] = useState<TeamSubmission | null>(null);
  const [pullTarget, setPullTarget] = useState<TeamSkillVersion | null>(null);
  const [submissionDiffOpen, setSubmissionDiffOpen] = useState(false);
  const [versionDiffOpen, setVersionDiffOpen] = useState(false);
  const [diffResult, setDiffResult] = useState<TeamDiffResult | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diffMode, setDiffMode] = useState<"unified" | "split">("unified");
  const [browserOpen, setBrowserOpen] = useState(false);
  const [browserLoading, setBrowserLoading] = useState(false);
  const [browserFileLoading, setBrowserFileLoading] = useState(false);
  const [browserVersion, setBrowserVersion] = useState<TeamSkillVersion | null>(null);
  const [browserSkillName, setBrowserSkillName] = useState("");
  const [browserTree, setBrowserTree] = useState<SkillFileNode | null>(null);
  const [browserSelectedFile, setBrowserSelectedFile] = useState<string | null>(null);
  const [browserFileContent, setBrowserFileContent] = useState<string | null>(null);

  const copy = getTeamsCopy(resolvedLanguage);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) ?? null,
    [teams, selectedTeamId],
  );
  const currentTeamActor = DEFAULT_TEAM_ACTOR;
  const currentMember = useMemo(
    () => members.find((member) => member.userName.toLowerCase() === currentTeamActor.toLowerCase()) ?? null,
    [currentTeamActor, members],
  );
  const currentRoleLevel = currentMember?.status === "active" ? getRoleLevel(currentMember.role) : 0;
  const canOwnTeam = currentRoleLevel >= getRoleLevel("owner");
  const canMaintainTeam = currentRoleLevel >= getRoleLevel("maintainer");
  const canReviewTeam = currentRoleLevel >= getRoleLevel("reviewer");
  const pendingSubmissions = useMemo(
    () => submissions.filter((submission) => submission.status === "pending"),
    [submissions],
  );
  const elevatedMemberCount = useMemo(
    () => members.filter((member) => member.role === "owner" || member.role === "maintainer").length,
    [members],
  );

  useEffect(() => {
    setTeamEditName(selectedTeam?.name ?? "");
    setTeamEditDescription(selectedTeam?.description ?? "");
  }, [selectedTeam?.description, selectedTeam?.id, selectedTeam?.name]);

  useEffect(() => {
    if (!browserOpen || !browserVersion || !browserSelectedFile) {
      setBrowserFileContent(null);
      return;
    }

    let cancelled = false;
    setBrowserFileLoading(true);
    readTeamVersionFile(browserVersion.id, browserSelectedFile)
      .then((content) => {
        if (!cancelled) {
          setBrowserFileContent(content);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBrowserFileLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [browserOpen, browserVersion, browserSelectedFile, readTeamVersionFile]);

  const handleCreateTeam = async () => {
    const name = teamName.trim();
    if (!name) return;
    const created = await createTeam({ name, description: teamDescription.trim() || undefined, actor: currentTeamActor });
    if (created) {
      setTeamName("");
      setTeamDescription("");
    }
  };

  const handleSaveTeam = async () => {
    if (!selectedTeam) return;
    await updateTeam({
      teamId: selectedTeam.id,
      name: teamEditName,
      description: teamEditDescription.trim() || undefined,
      actor: currentTeamActor,
    });
  };

  const handleSetTeamStatus = async (status: Team["status"]) => {
    if (!selectedTeam) return;
    await setTeamStatus({ teamId: selectedTeam.id, status, actor: currentTeamActor });
  };

  const handleOpenMemberModal = (member?: TeamMember) => {
    setMemberForm(
      member
        ? {
            memberId: member.id,
            userName: member.userName,
            email: member.email ?? "",
            role: member.role,
            status: member.status,
          }
        : createEmptyMemberForm(),
    );
    setMemberModalOpen(true);
  };

  const handleSaveMember = async () => {
    if (!selectedTeam) return;
    if (memberForm.memberId) {
      const result = await updateTeamMember({
        memberId: memberForm.memberId,
        userName: memberForm.userName,
        email: memberForm.email.trim() || undefined,
        role: memberForm.role,
        status: memberForm.status,
        actor: currentTeamActor,
      });
      if (result) setMemberModalOpen(false);
      return;
    }

    const result = await createTeamMember({
      teamId: selectedTeam.id,
      userName: memberForm.userName,
      email: memberForm.email.trim() || undefined,
      role: memberForm.role,
      actor: currentTeamActor,
    });
    if (result) setMemberModalOpen(false);
  };

  const handleOpenVersionBrowser = async (version: TeamSkillVersion, skillName: string) => {
    setBrowserOpen(true);
    setBrowserLoading(true);
    setBrowserVersion(version);
    setBrowserSkillName(skillName);
    setBrowserTree(null);
    setBrowserSelectedFile(null);
    setBrowserFileContent(null);

    const tree = await listTeamVersionFiles(version.id);
    setBrowserTree(tree);
    setBrowserSelectedFile(findDefaultBrowserFile(tree));
    setBrowserLoading(false);
  };

  const handleCloseVersionBrowser = () => {
    setBrowserOpen(false);
    setBrowserLoading(false);
    setBrowserFileLoading(false);
    setBrowserVersion(null);
    setBrowserSkillName("");
    setBrowserTree(null);
    setBrowserSelectedFile(null);
    setBrowserFileContent(null);
  };

  const handlePulled = async (skillId: string, mode: string) => {
    if (mode === "new_skill") {
      await loadSkills();
    } else {
      await loadSnapshots(skillId);
    }
    setPullTarget(null);
  };

  const handleOpenSubmissionDiff = async (submission: TeamSubmission) => {
    setDiffLoading(true);
    setSelectedFile(null);
    setDiffResult(null);
    setSubmissionDiffOpen(true);
    const result = await loadSubmissionDiff(submission.id);
    setDiffResult(result);
    const firstFile = result?.modifiedFiles[0] ?? result?.addedFiles[0] ?? result?.deletedFiles[0] ?? null;
    setSelectedFile(firstFile);
    setDiffLoading(false);
  };

  const handleOpenVersionDiff = async (version: TeamSkillVersion) => {
    setDiffLoading(true);
    setSelectedFile(null);
    setDiffResult(null);
    setVersionDiffOpen(true);
    const result = await loadVersionDiff(version.id);
    setDiffResult(result);
    const firstFile = result?.modifiedFiles[0] ?? result?.addedFiles[0] ?? result?.deletedFiles[0] ?? null;
    setSelectedFile(firstFile);
    setDiffLoading(false);
  };

  const handleCloseDiff = () => {
    setSubmissionDiffOpen(false);
    setVersionDiffOpen(false);
    setDiffResult(null);
    setSelectedFile(null);
    setDiffMode("unified");
  };

  const renderMetric = (label: string, value: number, icon: React.ReactNode) => (
    <div className="teams-page__metric">
      <span className="teams-page__metric-icon">{icon}</span>
      <span className="teams-page__metric-value">{value}</span>
      <span className="teams-page__metric-label">{label}</span>
    </div>
  );

  const renderLibrary = () => (
    <Space direction="vertical" className="teams-page__skill-stack" size={12}>
      {teamSkills.length === 0 ? (
        <Empty description={copy.libraryEmpty} />
      ) : (
        teamSkills.map((skill) => {
          const versions = versionsByTeamSkillId[skill.id] ?? [];
          return (
            <Card
              key={skill.id}
              title={skill.name}
              extra={<Button size="small" onClick={() => loadVersions(skill.id)}>{copy.viewVersions}</Button>}
            >
              <Text type="secondary">{copy.slug}: {skill.slug}</Text>
              <div className="teams-page__skill-meta">
                {versions.length === 0 ? (
                  <Text type="secondary">{copy.noVersions}</Text>
                ) : (
                  <List
                    size="small"
                    dataSource={versions}
                    renderItem={(version) => (
                      <List.Item
                        actions={[
                          <Button key="pull" type="link" size="small" onClick={() => setPullTarget(version)}>
                            {copy.pull}
                          </Button>,
                          <Button
                            key="browse"
                            type="link"
                            size="small"
                            onClick={() => void handleOpenVersionBrowser(version, skill.name)}
                          >
                            {copy.browse}
                          </Button>,
                          <Button key="diff" type="link" size="small" onClick={() => void handleOpenVersionDiff(version)}>
                            {copy.diff}
                          </Button>,
                          !version.isRecommended ? (
                            <Button
                              key="recommend"
                              type="link"
                              size="small"
                              disabled={!canMaintainTeam}
                              onClick={() => void setRecommendedVersion(version.id, skill.id, currentTeamActor)}
                            >
                              {copy.recommend}
                            </Button>
                          ) : null,
                        ].filter(Boolean)}
                      >
                        <Space>
                          <span>v{version.versionNumber}</span>
                          {version.isRecommended ? <Tag color="blue">{copy.recommended}</Tag> : null}
                        </Space>
                      </List.Item>
                    )}
                  />
                )}
              </div>
            </Card>
          );
        })
      )}
    </Space>
  );

  const renderSubmissions = () => (
    <List
      dataSource={pendingSubmissions}
      locale={{ emptyText: copy.submissionsEmpty }}
      renderItem={(submission: TeamSubmission) => (
        <List.Item
          actions={[
            <Button key="merge" type="link" size="small" disabled={!canReviewTeam} onClick={() => setMergeTarget(submission)}>
              {copy.merge}
            </Button>,
            <Button key="diff" type="link" size="small" onClick={() => void handleOpenSubmissionDiff(submission)}>
              {copy.diff}
            </Button>,
            <Popconfirm
              key="reject"
              title={copy.rejectConfirm}
              okText={copy.reject}
              cancelText={copy.cancel}
              onConfirm={() => rejectSubmission(submission.id, currentTeamActor)}
            >
              <Button type="link" size="small" danger disabled={!canReviewTeam}>
                {copy.reject}
              </Button>
            </Popconfirm>,
          ]}
        >
          <List.Item.Meta
            title={(
              <Space>
                <span>{submission.submitter}</span>
                      <Tag color="gold">{getSubmissionStatusLabel(submission.status, copy)}</Tag>
              </Space>
            )}
            description={submission.submitMessage || copy.noMessage}
          />
        </List.Item>
      )}
    />
  );

  const renderMembers = () => (
    <Card
      title={copy.memberTitle}
      extra={<Button icon={<UserPlus size={14} />} disabled={!canOwnTeam} onClick={() => handleOpenMemberModal()}>{copy.addMember}</Button>}
    >
      <List
        dataSource={members}
        locale={{ emptyText: copy.memberTitle }}
        renderItem={(member) => (
          <List.Item
            actions={[
              <Button key="edit" size="small" disabled={!canOwnTeam} onClick={() => handleOpenMemberModal(member)}>{copy.edit}</Button>,
              <Popconfirm
                key="remove"
                title={copy.removeMemberConfirm}
                okText={copy.remove}
                cancelText={copy.cancel}
                onConfirm={() => removeTeamMember(member.id, currentTeamActor)}
              >
                <Button size="small" danger disabled={!canOwnTeam}>{copy.remove}</Button>
              </Popconfirm>,
            ]}
          >
            <List.Item.Meta
              title={(
                <Space wrap>
                  <span>{member.userName}</span>
                  <Tag color={member.role === "owner" ? "blue" : "default"}>{copy.roleLabels[member.role]}</Tag>
                  <Tag color={member.status === "active" ? "green" : member.status === "invited" ? "gold" : "red"}>
                    {copy.memberStatusLabels[member.status]}
                  </Tag>
                </Space>
              )}
              description={(
                <Space wrap size={[12, 4]}>
                  <Text type="secondary">{member.email || "-"}</Text>
                    <Text type="secondary">{copy.joinedAt}: {formatTeamDate(member.joinedAt, resolvedLanguage)}</Text>
                </Space>
              )}
            />
          </List.Item>
        )}
      />
    </Card>
  );

  const renderActivity = () => (
    <List
      className="teams-page__activity-list"
      dataSource={activities}
      locale={{ emptyText: copy.activityEmpty }}
      renderItem={(activity) => (
        <List.Item>
          <List.Item.Meta
            avatar={<span className="teams-page__activity-icon"><History size={15} /></span>}
            title={(
              <Space wrap>
                  <Tag color="blue">{getActivityActionLabel(activity, copy)}</Tag>
                <Text strong>{activity.targetLabel ?? activity.targetId ?? activity.targetType}</Text>
              </Space>
            )}
            description={(
              <div className="teams-page__activity-meta">
                <Text type="secondary">{copy.activityActor}: {activity.actor}</Text>
                  <Text type="secondary">{copy.activityTime}: {formatTeamDate(activity.createdAt, resolvedLanguage)}</Text>
                {activity.detail ? <Text type="secondary">{activity.detail}</Text> : null}
              </div>
            )}
          />
        </List.Item>
      )}
    />
  );

  const renderSettings = () => (
    <Space direction="vertical" size={12} className="teams-page__settings">
      <Card title={copy.settingsTitle}>
        <Form layout="vertical">
          <Form.Item label={copy.teamName} required>
            <Input value={teamEditName} onChange={(event) => setTeamEditName(event.target.value)} />
          </Form.Item>
          <Form.Item label={copy.description}>
            <Input.TextArea
              rows={3}
              value={teamEditDescription}
              onChange={(event) => setTeamEditDescription(event.target.value)}
            />
          </Form.Item>
          <Button type="primary" icon={<Settings size={14} />} disabled={!canOwnTeam} onClick={() => void handleSaveTeam()}>
            {copy.saveTeam}
          </Button>
        </Form>
      </Card>

      <Card title={resolvedLanguage === "en-US" ? "Lifecycle" : "生命周期"}>
        <Space wrap>
          {selectedTeam?.status === "archived" ? (
            <Popconfirm
              title={copy.restoreConfirm}
              okText={copy.restoreTeam}
              cancelText={copy.cancel}
              onConfirm={() => void handleSetTeamStatus("active")}
            >
              <Button icon={<Archive size={14} />} disabled={!canOwnTeam}>{copy.restoreTeam}</Button>
            </Popconfirm>
          ) : (
            <Popconfirm
              title={copy.archiveConfirm}
              okText={copy.archiveTeam}
              cancelText={copy.cancel}
              onConfirm={() => void handleSetTeamStatus("archived")}
            >
              <Button icon={<Archive size={14} />} disabled={!canOwnTeam}>{copy.archiveTeam}</Button>
            </Popconfirm>
          )}
          <Popconfirm
            title={copy.deleteConfirm}
            okText={copy.deleteTeam}
            cancelText={copy.cancel}
            onConfirm={() => selectedTeam && void deleteTeam(selectedTeam.id, currentTeamActor)}
          >
            <Button danger icon={<Trash2 size={14} />} disabled={!canOwnTeam || selectedTeam?.status !== "archived"}>
              {copy.deleteTeam}
            </Button>
          </Popconfirm>
        </Space>
      </Card>
    </Space>
  );

  const renderOverview = () => (
    <Space direction="vertical" size={12} className="teams-page__overview">
      <div className="teams-page__metrics">
        {renderMetric(copy.skillsMetric, teamSkills.length, <ShieldCheck size={15} />)}
        {renderMetric(copy.pendingMetric, pendingSubmissions.length, <Settings size={15} />)}
        {renderMetric(copy.membersMetric, members.length, <Users size={15} />)}
        {renderMetric(copy.roleMetric, elevatedMemberCount, <ShieldCheck size={15} />)}
      </div>
      <Card>
        <Title level={5}>{copy.overviewTitle}</Title>
        <Paragraph type="secondary">{copy.deliveryHint}</Paragraph>
        {selectedTeam ? (
          <Space wrap>
            <Tag color={selectedTeam.status === "active" ? "green" : "default"}>
              {selectedTeam.status === "active" ? copy.active : copy.archived}
            </Tag>
              <Text type="secondary">{copy.createdAt}: {formatTeamDate(selectedTeam.createdAt, resolvedLanguage)}</Text>
              <Text type="secondary">{copy.updatedAt}: {formatTeamDate(selectedTeam.updatedAt, resolvedLanguage)}</Text>
          </Space>
        ) : null}
      </Card>
      {renderSubmissions()}
    </Space>
  );

  return (
    <div className="teams-page">
      <div className="teams-page__sidebar">
        <Title level={4} className="teams-page__sidebar-title">{copy.sidebarTitle}</Title>
        <Space direction="vertical" className="teams-page__create-team" size={8}>
          <Input
            placeholder={copy.newTeamPlaceholder}
            value={teamName}
            onChange={(event) => setTeamName(event.target.value)}
            onPressEnter={() => void handleCreateTeam()}
          />
          <Input
            placeholder={copy.newTeamDescriptionPlaceholder}
            value={teamDescription}
            onChange={(event) => setTeamDescription(event.target.value)}
            onPressEnter={() => void handleCreateTeam()}
          />
          <Button type="primary" block onClick={() => void handleCreateTeam()}>
            {copy.create}
          </Button>
        </Space>
        <List
          dataSource={teams}
          locale={{ emptyText: copy.emptyTeams }}
          renderItem={(team) => (
            <List.Item onClick={() => selectTeam(team.id)}>
              <div className={`teams-page__team-item${team.id === selectedTeamId ? " is-selected" : ""}`}>
                <div className="teams-page__team-name">
                  <span>{team.name}</span>
                  <Tag color={team.status === "active" ? "green" : "default"}>
                    {team.status === "active" ? copy.active : copy.archived}
                  </Tag>
                </div>
                {team.description ? <div className="teams-page__team-description">{team.description}</div> : null}
              </div>
            </List.Item>
          )}
        />
      </div>

      <div className="teams-page__content">
        {!selectedTeam ? (
          <Empty description={copy.emptyPage} className="teams-page__empty" />
        ) : (
          <>
            <div className="teams-page__header">
              <div>
                <Title level={4} className="teams-page__content-title">{selectedTeam.name}</Title>
                {selectedTeam.description ? <Paragraph type="secondary">{selectedTeam.description}</Paragraph> : null}
              </div>
              <Tag color={selectedTeam.status === "active" ? "green" : "default"}>
                {selectedTeam.status === "active" ? copy.active : copy.archived}
              </Tag>
            </div>
            <Tabs
              items={[
                { key: "overview", label: copy.tabs.overview, children: renderOverview() },
                { key: "library", label: copy.tabs.library, children: renderLibrary() },
                { key: "submissions", label: copy.tabs.submissions, children: renderSubmissions() },
                { key: "members", label: copy.tabs.members, children: renderMembers() },
                { key: "activity", label: copy.tabs.activity, children: renderActivity() },
                { key: "settings", label: copy.tabs.settings, children: renderSettings() },
              ]}
            />
          </>
        )}
      </div>

      {mergeTarget ? (
        <MergeSubmissionModal
          open={!!mergeTarget}
          submission={mergeTarget}
          onCancel={() => setMergeTarget(null)}
          onMerged={(teamSkillId) => {
            setMergeTarget(null);
            if (teamSkillId) {
              void loadVersions(teamSkillId);
            }
          }}
        />
      ) : null}

      {pullTarget ? (
        <PullTeamVersionModal
          open={!!pullTarget}
          version={pullTarget}
          onCancel={() => setPullTarget(null)}
          onPulled={handlePulled}
        />
      ) : null}

      <Modal
        rootClassName="teams-modal"
        title={memberForm.memberId ? copy.memberModalEdit : copy.memberModalCreate}
        open={memberModalOpen}
        onCancel={() => setMemberModalOpen(false)}
        onOk={() => void handleSaveMember()}
        okText={copy.save}
        cancelText={copy.cancel}
        okButtonProps={{ disabled: !memberForm.userName.trim() }}
      >
        <Form layout="vertical">
          <Form.Item label={copy.userName} required>
            <Input
              value={memberForm.userName}
              onChange={(event) => setMemberForm((current) => ({ ...current, userName: event.target.value }))}
            />
          </Form.Item>
          <Form.Item label={copy.email}>
            <Input
              value={memberForm.email}
              onChange={(event) => setMemberForm((current) => ({ ...current, email: event.target.value }))}
            />
          </Form.Item>
          <Form.Item label={copy.role}>
            <Select
              value={memberForm.role}
              options={ROLE_OPTIONS.map((role) => ({ label: copy.roleLabels[role], value: role }))}
              onChange={(role) => setMemberForm((current) => ({ ...current, role }))}
            />
          </Form.Item>
          {memberForm.memberId ? (
            <Form.Item label={copy.memberStatus}>
              <Select
                value={memberForm.status}
                options={MEMBER_STATUS_OPTIONS.map((status) => ({
                  label: copy.memberStatusLabels[status],
                  value: status,
                }))}
                onChange={(status) => setMemberForm((current) => ({ ...current, status }))}
              />
            </Form.Item>
          ) : null}
        </Form>
      </Modal>

      <TeamVersionBrowserModal
        open={browserOpen}
        version={browserVersion}
        skillName={browserSkillName}
        tree={browserTree}
        selectedFile={browserSelectedFile}
        fileContent={browserFileContent}
        loading={browserLoading}
        fileLoading={browserFileLoading}
        onCancel={handleCloseVersionBrowser}
        onSelectFile={setBrowserSelectedFile}
      />

      <TeamDiffPreviewModal
        open={submissionDiffOpen || versionDiffOpen}
        title={submissionDiffOpen ? copy.diffTitles.submission : copy.diffTitles.version}
        diffResult={diffResult}
        diffLoading={diffLoading}
        selectedFile={selectedFile}
        diffMode={diffMode}
        onCancel={handleCloseDiff}
        onSelectFile={setSelectedFile}
        onDiffModeChange={setDiffMode}
      />
    </div>
  );
}
