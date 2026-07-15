import type { TeamActivityLog, TeamMember, TeamMemberRole, TeamSubmission } from "@/types/team";

export type UiLanguage = "zh-CN" | "en-US";

export interface MemberFormState {
  memberId?: string;
  userName: string;
  email: string;
  role: TeamMemberRole;
  status: TeamMember["status"];
}

export const ROLE_OPTIONS: TeamMemberRole[] = ["owner", "maintainer", "reviewer", "contributor", "viewer"];
export const MEMBER_STATUS_OPTIONS: TeamMember["status"][] = ["active", "invited", "disabled"];
export const DEFAULT_TEAM_ACTOR = "jensen";

export function getRoleLevel(role?: TeamMemberRole) {
  switch (role) {
    case "owner":
      return 4;
    case "maintainer":
      return 3;
    case "reviewer":
      return 2;
    case "contributor":
      return 1;
    default:
      return 0;
  }
}

export function createEmptyMemberForm(): MemberFormState {
  return {
    userName: "",
    email: "",
    role: "contributor",
    status: "active",
  };
}

export function getTeamsCopy(language: UiLanguage) {
  if (language === "en-US") {
    return {
      sidebarTitle: "Teams",
      create: "Create",
      newTeamPlaceholder: "Team name",
      newTeamDescriptionPlaceholder: "Description",
      emptyTeams: "No teams yet",
      emptyPage: "Select or create a team",
      tabs: {
        overview: "Overview",
        library: "Skill Library",
        submissions: "Change Requests",
        members: "Members",
        activity: "Activity",
        settings: "Settings",
      },
      active: "Active",
      archived: "Archived",
      overviewTitle: "Team operating status",
      skillsMetric: "Team skills",
      pendingMetric: "Pending requests",
      membersMetric: "Members",
      roleMetric: "Maintainers and owners",
      deliveryHint: "This workspace now manages team assets, review queues, member ownership, and team lifecycle rules.",
      libraryEmpty: "This team library is empty",
      viewVersions: "View Versions",
      slug: "slug",
      noVersions: "Versions not loaded yet",
      pull: "Pull to Personal",
      browse: "Browse Files",
      diff: "View Diff",
      recommend: "Mark Recommended",
      recommended: "Recommended",
      submissionsEmpty: "No change requests",
      merge: "Merge",
      reject: "Reject",
      rejectConfirm: "Reject this request?",
      noMessage: "No description",
      activityEmpty: "No team activity yet",
      activityActor: "Actor",
      activityTime: "Time",
      activityActionLabels: {
        create_team: "Created team",
        update_team: "Updated team",
        archive_team: "Archived team",
        restore_team: "Restored team",
        create_member: "Added member",
        update_member: "Updated member",
        remove_member: "Removed member",
        submit: "Submitted change",
        merge_submission: "Merged request",
        reject_submission: "Rejected request",
        set_recommended_version: "Set recommended",
        withdraw_submission: "Withdrew request",
        remove_serving: "Removed serving",
      } satisfies Record<string, string>,
      memberTitle: "Members and roles",
      addMember: "Add member",
      edit: "Edit",
      remove: "Remove",
      removeMemberConfirm: "Remove this member?",
      userName: "Name",
      email: "Email",
      role: "Role",
      memberStatus: "Status",
      joinedAt: "Joined",
      save: "Save",
      cancel: "Cancel",
      memberModalCreate: "Add member",
      memberModalEdit: "Edit member",
      settingsTitle: "Team settings",
      teamName: "Team name",
      description: "Description",
      saveTeam: "Save team",
      archiveTeam: "Archive team",
      restoreTeam: "Restore team",
      deleteTeam: "Delete team",
      archiveConfirm: "Archive this team? New submissions should be paused.",
      restoreConfirm: "Restore this team?",
      deleteConfirm: "Delete this archived team and its local team history?",
      createdAt: "Created",
      updatedAt: "Updated",
      diffTitles: {
        submission: "Request Diff Preview",
        version: "Version Diff Preview",
      },
      status: {
        pending: "Pending",
        merged: "Merged",
        rejected: "Rejected",
        withdrawn: "Withdrawn",
      },
      roleLabels: {
        owner: "Owner",
        maintainer: "Maintainer",
        reviewer: "Reviewer",
        contributor: "Contributor",
        viewer: "Viewer",
      } satisfies Record<TeamMemberRole, string>,
      memberStatusLabels: {
        active: "Active",
        invited: "Invited",
        disabled: "Disabled",
      } satisfies Record<TeamMember["status"], string>,
    };
  }

  return {
    sidebarTitle: "Teams / Orgs",
    create: "创建",
    newTeamPlaceholder: "团队名称",
    newTeamDescriptionPlaceholder: "团队描述",
    emptyTeams: "暂无团队",
    emptyPage: "请选择或创建团队",
    tabs: {
      overview: "总览",
      library: "技能库",
      submissions: "变更请求",
      members: "成员",
      activity: "活动",
      settings: "设置",
    },
    active: "启用",
    archived: "已归档",
    overviewTitle: "团队运行状态",
    skillsMetric: "团队技能资产",
    pendingMetric: "待处理请求",
    membersMetric: "成员",
    roleMetric: "维护者与负责人",
    deliveryHint: "团队空间现在负责资产治理、评审队列、成员职责与团队生命周期规则。",
    libraryEmpty: "团队技能资产 库为空",
    viewVersions: "查看版本",
    slug: "slug",
    noVersions: "尚未加载版本",
    pull: "拉取到个人",
    browse: "浏览内容",
    diff: "查看变更",
    recommend: "设为推荐",
    recommended: "推荐",
    submissionsEmpty: "暂无变更请求",
    merge: "合并",
    reject: "拒绝",
    rejectConfirm: "确认拒绝该请求？",
    noMessage: "无说明",
    activityEmpty: "暂无团队活动",
    activityActor: "操作者",
    activityTime: "时间",
    activityActionLabels: {
      create_team: "创建团队",
      update_team: "更新团队",
      archive_team: "归档团队",
      restore_team: "恢复团队",
      create_member: "添加成员",
      update_member: "更新成员",
      remove_member: "移除成员",
      submit: "提交变更",
      merge_submission: "合并请求",
      reject_submission: "拒绝请求",
      set_recommended_version: "设置推荐版本",
      withdraw_submission: "撤回请求",
      remove_serving: "解除承接",
    } satisfies Record<string, string>,
    memberTitle: "成员与角色",
    addMember: "添加成员",
    edit: "编辑",
    remove: "移除",
    removeMemberConfirm: "确认移除该成员？",
    userName: "名称",
    email: "邮箱",
    role: "角色",
    memberStatus: "状态",
    joinedAt: "加入时间",
    save: "保存",
    cancel: "取消",
    memberModalCreate: "添加成员",
    memberModalEdit: "编辑成员",
    settingsTitle: "团队设置",
    teamName: "团队名称",
    description: "团队描述",
    saveTeam: "保存团队",
    archiveTeam: "归档团队",
    restoreTeam: "恢复团队",
    deleteTeam: "删除团队",
    archiveConfirm: "确认归档该团队？归档后应暂停新的团队提交。",
    restoreConfirm: "确认恢复该团队？",
    deleteConfirm: "确认删除该已归档团队及本地团队历史？",
    createdAt: "创建时间",
    updatedAt: "更新时间",
    diffTitles: {
      submission: "请求变更预览",
      version: "版本变更预览",
    },
    status: {
      pending: "待处理",
      merged: "已合并",
      rejected: "已拒绝",
      withdrawn: "已撤回",
    },
    roleLabels: {
      owner: "负责人",
      maintainer: "维护者",
      reviewer: "评审者",
      contributor: "贡献者",
      viewer: "只读成员",
    } satisfies Record<TeamMemberRole, string>,
    memberStatusLabels: {
      active: "启用",
      invited: "邀请中",
      disabled: "停用",
    } satisfies Record<TeamMember["status"], string>,
  };
}

export type TeamsCopy = ReturnType<typeof getTeamsCopy>;

export function formatTeamDate(timestamp: number, language: UiLanguage) {
  return new Date(timestamp).toLocaleString(language === "en-US" ? "en-US" : "zh-CN");
}

export function getSubmissionStatusLabel(status: TeamSubmission["status"], copy: TeamsCopy) {
  if (status === "pending") return copy.status.pending;
  if (status === "merged") return copy.status.merged;
  if (status === "withdrawn") return copy.status.withdrawn;
  return copy.status.rejected;
}

export function getActivityActionLabel(activity: TeamActivityLog, copy: TeamsCopy) {
  return (copy.activityActionLabels as Record<string, string>)[activity.action] ?? activity.action;
}
