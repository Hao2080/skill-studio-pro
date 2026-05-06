import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import message from "antd/es/message";
import type { SkillFileNode } from "@/types/skill";
import type {
  CreateTeamInput,
  CreateTeamMemberInput,
  MergeSubmissionInput,
  PullTeamVersionInput,
  SetTeamStatusInput,
  Team,
  TeamActivityLog,
  TeamDiffResult,
  TeamMember,
  TeamPullImpact,
  TeamSkill,
  TeamSkillVersion,
  TeamSubmission,
  TeamSubmissionMergePreview,
  SubmitToTeamInput,
  UpdateTeamInput,
  UpdateTeamMemberInput,
} from "@/types/team";
import {
  checkPullImpact as checkPullImpactRecord,
  createTeam as createTeamRecord,
  createTeamMember as createTeamMemberRecord,
  deleteTeam as deleteTeamRecord,
  listTeamMembers,
  listTeamActivityLogs,
  listTeams,
  listTeamSkills,
  listTeamSkillVersions,
  listTeamSubmissions,
  listTeamVersionFiles as listTeamVersionFilesRecord,
  loadSubmissionDiff as loadSubmissionDiffRecord,
  loadSubmissionMergePreview as loadSubmissionMergePreviewRecord,
  loadVersionDiff as loadVersionDiffRecord,
  mergeSubmission as mergeSubmissionRecord,
  pullTeamVersion as pullTeamVersionRecord,
  readTeamVersionFile as readTeamVersionFileRecord,
  removeTeamMember as removeTeamMemberRecord,
  rejectSubmission as rejectSubmissionRecord,
  setTeamStatus as setTeamStatusRecord,
  setRecommendedVersion as setRecommendedVersionRecord,
  submitToTeam as submitToTeamRecord,
  updateTeam as updateTeamRecord,
  updateTeamMember as updateTeamMemberRecord,
} from "../api/teamsApi";
import { useI18n } from "@/features/settings/state/I18nContext";

interface TeamContextValue {
  teams: Team[];
  selectedTeamId: string | null;
  teamSkills: TeamSkill[];
  members: TeamMember[];
  submissions: TeamSubmission[];
  activities: TeamActivityLog[];
  versionsByTeamSkillId: Record<string, TeamSkillVersion[]>;
  loading: boolean;
  loadTeams: () => Promise<void>;
  selectTeam: (teamId: string | null) => void;
  createTeam: (input: CreateTeamInput) => Promise<Team | null>;
  updateTeam: (input: UpdateTeamInput) => Promise<Team | null>;
  setTeamStatus: (input: SetTeamStatusInput) => Promise<Team | null>;
  deleteTeam: (teamId: string, actor?: string) => Promise<boolean>;
  loadTeamSkills: (teamId: string) => Promise<void>;
  loadMembers: (teamId: string) => Promise<void>;
  createTeamMember: (input: CreateTeamMemberInput) => Promise<TeamMember | null>;
  updateTeamMember: (input: UpdateTeamMemberInput) => Promise<TeamMember | null>;
  removeTeamMember: (memberId: string, actor?: string) => Promise<boolean>;
  loadActivities: (teamId: string) => Promise<void>;
  loadSubmissions: (teamId: string) => Promise<void>;
  loadVersions: (teamSkillId: string) => Promise<void>;
  loadSubmissionDiff: (submissionId: string) => Promise<TeamDiffResult | null>;
  loadSubmissionMergePreview: (submissionId: string) => Promise<TeamSubmissionMergePreview | null>;
  loadVersionDiff: (teamVersionId: string) => Promise<TeamDiffResult | null>;
  listTeamVersionFiles: (versionId: string) => Promise<SkillFileNode | null>;
  readTeamVersionFile: (versionId: string, relativePath: string) => Promise<string | null>;
  checkPullImpact: (
    input: { teamVersionId: string; mode: "new_skill" | "append_snapshot"; targetSkillId?: string },
  ) => Promise<TeamPullImpact | null>;
  submitToTeam: (input: SubmitToTeamInput) => Promise<TeamSubmission | null>;
  mergeSubmission: (input: MergeSubmissionInput) => Promise<TeamSkillVersion | null>;
  rejectSubmission: (submissionId: string, actor: string) => Promise<boolean>;
  pullTeamVersion: (input: PullTeamVersionInput) => Promise<string | null>;
  setRecommendedVersion: (versionId: string, teamSkillId: string, actor: string) => Promise<boolean>;
}

const TeamContext = createContext<TeamContextValue | null>(null);

export function TeamProvider({ children }: { children: ReactNode }) {
  const { resolvedLanguage } = useI18n();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [teamSkills, setTeamSkills] = useState<TeamSkill[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [submissions, setSubmissions] = useState<TeamSubmission[]>([]);
  const [activities, setActivities] = useState<TeamActivityLog[]>([]);
  const [versionsByTeamSkillId, setVersionsByTeamSkillId] = useState<Record<string, TeamSkillVersion[]>>({});
  const [loading, setLoading] = useState(false);
  const copy = useMemo(() => (
    resolvedLanguage === "en-US"
      ? {
          loadTeamsFailedPrefix: "Failed to load teams: ",
          loadTeamSkillsFailedPrefix: "Failed to load team skills: ",
          loadSubmissionsFailedPrefix: "Failed to load team submissions: ",
          loadActivitiesFailedPrefix: "Failed to load team activity: ",
          loadMembersFailedPrefix: "Failed to load team members: ",
          loadVersionsFailedPrefix: "Failed to load team versions: ",
          loadSubmissionDiffFailedPrefix: "Failed to load submission changes: ",
          loadSubmissionMergePreviewFailedPrefix: "Failed to load merge preview: ",
          loadVersionDiffFailedPrefix: "Failed to load team version changes: ",
          checkPullImpactFailedPrefix: "Failed to check pull impact: ",
          loadVersionFilesFailedPrefix: "Failed to load team version file tree: ",
          loadVersionFileFailedPrefix: "Failed to load team version file: ",
          createTeamSuccess: "Team created",
          createTeamFailedPrefix: "Failed to create team: ",
          updateTeamSuccess: "Team updated",
          updateTeamFailedPrefix: "Failed to update team: ",
          setTeamStatusSuccess: "Team status updated",
          setTeamStatusFailedPrefix: "Failed to update team status: ",
          deleteTeamSuccess: "Team deleted",
          deleteTeamFailedPrefix: "Failed to delete team: ",
          createMemberSuccess: "Member added",
          createMemberFailedPrefix: "Failed to add member: ",
          updateMemberSuccess: "Member updated",
          updateMemberFailedPrefix: "Failed to update member: ",
          removeMemberSuccess: "Member removed",
          removeMemberFailedPrefix: "Failed to remove member: ",
          submitSuccess: "Submitted to team",
          submitFailedPrefix: "Failed to submit to team: ",
          mergeSuccess: "Submission merged",
          mergeFailedPrefix: "Merge failed: ",
          rejectSuccess: "Submission rejected",
          rejectFailedPrefix: "Reject failed: ",
          pullSuccess: "Pulled to personal workspace",
          pullFailedPrefix: "Pull failed: ",
          setRecommendedSuccess: "Set as recommended version",
          setRecommendedFailedPrefix: "Failed to set recommended version: ",
        }
      : {
          loadTeamsFailedPrefix: "加载团队失败: ",
          loadTeamSkillsFailedPrefix: "加载团队技能资产 失败: ",
          loadSubmissionsFailedPrefix: "加载团队提交失败: ",
          loadActivitiesFailedPrefix: "加载团队活动失败: ",
          loadMembersFailedPrefix: "加载团队成员失败: ",
          loadVersionsFailedPrefix: "加载团队版本失败: ",
          loadSubmissionDiffFailedPrefix: "加载提交变更失败: ",
          loadSubmissionMergePreviewFailedPrefix: "加载合并预检失败: ",
          loadVersionDiffFailedPrefix: "加载团队版本变更失败: ",
          checkPullImpactFailedPrefix: "检测拉取影响失败: ",
          loadVersionFilesFailedPrefix: "加载团队版本文件树失败: ",
          loadVersionFileFailedPrefix: "加载团队版本文件失败: ",
          createTeamSuccess: "团队已创建",
          createTeamFailedPrefix: "创建团队失败: ",
          updateTeamSuccess: "团队已更新",
          updateTeamFailedPrefix: "更新团队失败: ",
          setTeamStatusSuccess: "团队状态已更新",
          setTeamStatusFailedPrefix: "更新团队状态失败: ",
          deleteTeamSuccess: "团队已删除",
          deleteTeamFailedPrefix: "删除团队失败: ",
          createMemberSuccess: "成员已添加",
          createMemberFailedPrefix: "添加成员失败: ",
          updateMemberSuccess: "成员已更新",
          updateMemberFailedPrefix: "更新成员失败: ",
          removeMemberSuccess: "成员已移除",
          removeMemberFailedPrefix: "移除成员失败: ",
          submitSuccess: "已提交团队",
          submitFailedPrefix: "提交团队失败: ",
          mergeSuccess: "提交已合并",
          mergeFailedPrefix: "合并失败: ",
          rejectSuccess: "已拒绝提交",
          rejectFailedPrefix: "拒绝失败: ",
          pullSuccess: "已拉取到个人空间",
          pullFailedPrefix: "拉取失败: ",
          setRecommendedSuccess: "已设为推荐版本",
          setRecommendedFailedPrefix: "设置推荐版本失败: ",
        }
  ), [resolvedLanguage]);

  const loadTeams = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listTeams();
      setTeams(result);
      setSelectedTeamId((current) => current ?? result[0]?.id ?? null);
    } catch (error) {
      message.error(`${copy.loadTeamsFailedPrefix}${error}`);
    } finally {
      setLoading(false);
    }
  }, [copy.loadTeamsFailedPrefix]);

  const loadTeamSkills = useCallback(async (teamId: string) => {
    try {
      const result = await listTeamSkills(teamId);
      setTeamSkills(result);
    } catch (error) {
      message.error(`${copy.loadTeamSkillsFailedPrefix}${error}`);
    }
  }, [copy.loadTeamSkillsFailedPrefix]);

  const loadSubmissions = useCallback(async (teamId: string) => {
    try {
      const result = await listTeamSubmissions(teamId);
      setSubmissions(result);
    } catch (error) {
      message.error(`${copy.loadSubmissionsFailedPrefix}${error}`);
    }
  }, [copy.loadSubmissionsFailedPrefix]);

  const loadMembers = useCallback(async (teamId: string) => {
    try {
      const result = await listTeamMembers(teamId);
      setMembers(result);
    } catch (error) {
      message.error(`${copy.loadMembersFailedPrefix}${error}`);
    }
  }, [copy.loadMembersFailedPrefix]);

  const loadActivities = useCallback(async (teamId: string) => {
    try {
      const result = await listTeamActivityLogs(teamId);
      setActivities(result);
    } catch (error) {
      message.error(`${copy.loadActivitiesFailedPrefix}${error}`);
    }
  }, [copy.loadActivitiesFailedPrefix]);

  const loadVersions = useCallback(async (teamSkillId: string) => {
    try {
      const result = await listTeamSkillVersions(teamSkillId);
      setVersionsByTeamSkillId((current) => ({ ...current, [teamSkillId]: result }));
    } catch (error) {
      message.error(`${copy.loadVersionsFailedPrefix}${error}`);
    }
  }, [copy.loadVersionsFailedPrefix]);

  const loadSubmissionDiff = useCallback(async (submissionId: string) => {
    try {
      return await loadSubmissionDiffRecord(submissionId);
    } catch (error) {
      message.error(`${copy.loadSubmissionDiffFailedPrefix}${error}`);
      return null;
    }
  }, [copy.loadSubmissionDiffFailedPrefix]);

  const loadSubmissionMergePreview = useCallback(async (submissionId: string) => {
    try {
      return await loadSubmissionMergePreviewRecord(submissionId);
    } catch (error) {
      message.error(`${copy.loadSubmissionMergePreviewFailedPrefix}${error}`);
      return null;
    }
  }, [copy.loadSubmissionMergePreviewFailedPrefix]);

  const loadVersionDiff = useCallback(async (teamVersionId: string) => {
    try {
      return await loadVersionDiffRecord(teamVersionId);
    } catch (error) {
      message.error(`${copy.loadVersionDiffFailedPrefix}${error}`);
      return null;
    }
  }, [copy.loadVersionDiffFailedPrefix]);

  const checkPullImpact = useCallback(async (
    input: { teamVersionId: string; mode: "new_skill" | "append_snapshot"; targetSkillId?: string },
  ) => {
    try {
      return await checkPullImpactRecord(input);
    } catch (error) {
      message.error(`${copy.checkPullImpactFailedPrefix}${error}`);
      return null;
    }
  }, [copy.checkPullImpactFailedPrefix]);

  const listTeamVersionFiles = useCallback(async (versionId: string) => {
    try {
      return await listTeamVersionFilesRecord(versionId);
    } catch (error) {
      message.error(`${copy.loadVersionFilesFailedPrefix}${error}`);
      return null;
    }
  }, [copy.loadVersionFilesFailedPrefix]);

  const readTeamVersionFile = useCallback(async (versionId: string, relativePath: string) => {
    try {
      return await readTeamVersionFileRecord(versionId, relativePath);
    } catch (error) {
      message.error(`${copy.loadVersionFileFailedPrefix}${error}`);
      return null;
    }
  }, [copy.loadVersionFileFailedPrefix]);

  const createTeam = useCallback(async (input: CreateTeamInput) => {
    try {
      const result = await createTeamRecord(input);
      setTeams((current) => [...current, result]);
      setSelectedTeamId(result.id);
      await loadActivities(result.id);
      message.success(copy.createTeamSuccess);
      return result;
    } catch (error) {
      message.error(`${copy.createTeamFailedPrefix}${error}`);
      return null;
    }
  }, [copy.createTeamFailedPrefix, copy.createTeamSuccess, loadActivities]);

  const updateTeam = useCallback(async (input: UpdateTeamInput) => {
    try {
      const result = await updateTeamRecord(input);
      setTeams((current) => current.map((team) => (team.id === result.id ? result : team)));
      await loadActivities(result.id);
      message.success(copy.updateTeamSuccess);
      return result;
    } catch (error) {
      message.error(`${copy.updateTeamFailedPrefix}${error}`);
      return null;
    }
  }, [copy.updateTeamFailedPrefix, copy.updateTeamSuccess, loadActivities]);

  const setTeamStatus = useCallback(async (input: SetTeamStatusInput) => {
    try {
      const result = await setTeamStatusRecord(input);
      setTeams((current) => current.map((team) => (team.id === result.id ? result : team)));
      await loadActivities(result.id);
      message.success(copy.setTeamStatusSuccess);
      return result;
    } catch (error) {
      message.error(`${copy.setTeamStatusFailedPrefix}${error}`);
      return null;
    }
  }, [copy.setTeamStatusFailedPrefix, copy.setTeamStatusSuccess, loadActivities]);

  const deleteTeam = useCallback(async (teamId: string, actor?: string) => {
    try {
      await deleteTeamRecord(teamId, actor);
      setTeams((current) => {
        const next = current.filter((team) => team.id !== teamId);
        setSelectedTeamId((selected) => (selected === teamId ? next[0]?.id ?? null : selected));
        return next;
      });
      setActivities((current) => (selectedTeamId === teamId ? [] : current));
      message.success(copy.deleteTeamSuccess);
      return true;
    } catch (error) {
      message.error(`${copy.deleteTeamFailedPrefix}${error}`);
      return false;
    }
  }, [copy.deleteTeamFailedPrefix, copy.deleteTeamSuccess, selectedTeamId]);

  const createTeamMember = useCallback(async (input: CreateTeamMemberInput) => {
    try {
      const result = await createTeamMemberRecord(input);
      if (selectedTeamId === input.teamId) {
        await loadMembers(input.teamId);
        await loadActivities(input.teamId);
      }
      message.success(copy.createMemberSuccess);
      return result;
    } catch (error) {
      message.error(`${copy.createMemberFailedPrefix}${error}`);
      return null;
    }
  }, [copy.createMemberFailedPrefix, copy.createMemberSuccess, loadActivities, loadMembers, selectedTeamId]);

  const updateTeamMember = useCallback(async (input: UpdateTeamMemberInput) => {
    try {
      const result = await updateTeamMemberRecord(input);
      setMembers((current) => current.map((member) => (member.id === result.id ? result : member)));
      if (selectedTeamId === result.teamId) {
        await loadActivities(result.teamId);
      }
      message.success(copy.updateMemberSuccess);
      return result;
    } catch (error) {
      message.error(`${copy.updateMemberFailedPrefix}${error}`);
      return null;
    }
  }, [copy.updateMemberFailedPrefix, copy.updateMemberSuccess, loadActivities, selectedTeamId]);

  const removeTeamMember = useCallback(async (memberId: string, actor?: string) => {
    try {
      const removedMember = members.find((member) => member.id === memberId);
      await removeTeamMemberRecord(memberId, actor);
      setMembers((current) => current.filter((member) => member.id !== memberId));
      if (removedMember && selectedTeamId === removedMember.teamId) {
        await loadActivities(removedMember.teamId);
      }
      message.success(copy.removeMemberSuccess);
      return true;
    } catch (error) {
      message.error(`${copy.removeMemberFailedPrefix}${error}`);
      return false;
    }
  }, [copy.removeMemberFailedPrefix, copy.removeMemberSuccess, loadActivities, members, selectedTeamId]);

  const submitToTeam = useCallback(async (input: SubmitToTeamInput) => {
    try {
      const result = await submitToTeamRecord(input);
      if (selectedTeamId === input.teamId) {
        setSubmissions((current) => [result, ...current]);
        await loadActivities(input.teamId);
      }
      message.success(copy.submitSuccess);
      return result;
    } catch (error) {
      message.error(`${copy.submitFailedPrefix}${error}`);
      return null;
    }
  }, [copy.submitFailedPrefix, copy.submitSuccess, loadActivities, selectedTeamId]);

  const mergeSubmission = useCallback(async (input: MergeSubmissionInput) => {
    try {
      const result = await mergeSubmissionRecord(input);
      if (selectedTeamId) {
        await loadSubmissions(selectedTeamId);
        await loadTeamSkills(selectedTeamId);
        await loadActivities(selectedTeamId);
      }
      await loadVersions(result.teamSkillId);
      message.success(copy.mergeSuccess);
      return result;
    } catch (error) {
      message.error(`${copy.mergeFailedPrefix}${error}`);
      return null;
    }
  }, [copy.mergeFailedPrefix, copy.mergeSuccess, loadActivities, loadSubmissions, loadTeamSkills, loadVersions, selectedTeamId]);

  const rejectSubmission = useCallback(async (submissionId: string, actor: string) => {
    try {
      await rejectSubmissionRecord({ submissionId, actor });
      if (selectedTeamId) {
        await loadSubmissions(selectedTeamId);
        await loadActivities(selectedTeamId);
      }
      message.success(copy.rejectSuccess);
      return true;
    } catch (error) {
      message.error(`${copy.rejectFailedPrefix}${error}`);
      return false;
    }
  }, [copy.rejectFailedPrefix, copy.rejectSuccess, loadActivities, loadSubmissions, selectedTeamId]);

  const pullTeamVersion = useCallback(async (input: PullTeamVersionInput) => {
    try {
      const skillId = await pullTeamVersionRecord(input);
      message.success(copy.pullSuccess);
      return skillId;
    } catch (error) {
      message.error(`${copy.pullFailedPrefix}${error}`);
      return null;
    }
  }, [copy.pullFailedPrefix, copy.pullSuccess]);

  const setRecommendedVersion = useCallback(async (versionId: string, teamSkillId: string, actor: string) => {
    try {
      await setRecommendedVersionRecord({ versionId, actor });
      await loadVersions(teamSkillId);
      if (selectedTeamId) {
        await loadActivities(selectedTeamId);
      }
      message.success(copy.setRecommendedSuccess);
      return true;
    } catch (error) {
      message.error(`${copy.setRecommendedFailedPrefix}${error}`);
      return false;
    }
  }, [copy.setRecommendedFailedPrefix, copy.setRecommendedSuccess, loadActivities, loadVersions, selectedTeamId]);

  const selectTeam = useCallback((teamId: string | null) => {
    setSelectedTeamId(teamId);
  }, []);

  useEffect(() => {
    void loadTeams();
  }, [loadTeams]);

  useEffect(() => {
    if (!selectedTeamId) {
      setTeamSkills([]);
      setMembers([]);
      setSubmissions([]);
      setActivities([]);
      return;
    }

    void loadTeamSkills(selectedTeamId);
    void loadMembers(selectedTeamId);
    void loadSubmissions(selectedTeamId);
    void loadActivities(selectedTeamId);
  }, [loadActivities, loadMembers, loadSubmissions, loadTeamSkills, selectedTeamId]);

  const value = useMemo<TeamContextValue>(() => ({
    teams,
    selectedTeamId,
    teamSkills,
    members,
    submissions,
    activities,
    versionsByTeamSkillId,
    loading,
    loadTeams,
    selectTeam,
    createTeam,
    updateTeam,
    setTeamStatus,
    deleteTeam,
    loadTeamSkills,
    loadMembers,
    createTeamMember,
    updateTeamMember,
    removeTeamMember,
    loadActivities,
    loadSubmissions,
    loadVersions,
    loadSubmissionDiff,
    loadSubmissionMergePreview,
    loadVersionDiff,
    listTeamVersionFiles,
    readTeamVersionFile,
    checkPullImpact,
    submitToTeam,
    mergeSubmission,
    rejectSubmission,
    pullTeamVersion,
    setRecommendedVersion,
  }), [
    teams,
    selectedTeamId,
    teamSkills,
    members,
    submissions,
    activities,
    versionsByTeamSkillId,
    loading,
    loadTeams,
    selectTeam,
    createTeam,
    updateTeam,
    setTeamStatus,
    deleteTeam,
    loadTeamSkills,
    loadMembers,
    createTeamMember,
    updateTeamMember,
    removeTeamMember,
    loadActivities,
    loadSubmissions,
    loadVersions,
    loadSubmissionDiff,
    loadSubmissionMergePreview,
    loadVersionDiff,
    listTeamVersionFiles,
    readTeamVersionFile,
    checkPullImpact,
    submitToTeam,
    mergeSubmission,
    rejectSubmission,
    pullTeamVersion,
    setRecommendedVersion,
  ]);

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

export function useTeamContext() {
  const context = useContext(TeamContext);
  if (!context) {
    throw new Error("useTeamContext must be used within TeamProvider");
  }
  return context;
}
