import type { Team, TeamMember } from "@/types/team";
import { cloneValue } from "./browserPreviewFileMocks";
import type { BrowserPreviewState } from "./browserPreviewStateMocks";
import { pushTeamActivity } from "./browserPreviewTeamActivityMocks";

export function invokeBrowserPreviewTeamManagementCommand<T>(
  state: BrowserPreviewState,
  command: string,
  args: Record<string, unknown> | undefined,
) {
  switch (command) {
case "team_list":
  return cloneValue(state.teams) as T;
case "team_create": {
  const input = args?.input as { name: string; description?: string; actor?: string };
  const now = Date.now();
  const actor = input.actor?.trim() || "jensen";
  const team: Team = {
    id: `team-${now}`,
    name: input.name,
    description: input.description,
    createdAt: now,
    updatedAt: now,
    status: "active",
  };
  const member: TeamMember = {
    id: `member-${now}`,
    teamId: team.id,
    userName: actor,
    role: "owner",
    status: "active",
    joinedAt: now,
    updatedAt: now,
  };
  state.teams.push(team);
  state.membersByTeamId[team.id] = [member];
  state.activityLogsByTeamId[team.id] = [];
  pushTeamActivity(state, {
    teamId: team.id,
    actor,
    action: "create_team",
    targetType: "team",
    targetId: team.id,
    targetLabel: team.name,
    detail: team.description,
    createdAt: now,
  });
  return cloneValue(team) as T;
}
case "team_update": {
  const input = args?.input as { teamId: string; name: string; description?: string; actor?: string };
  const team = state.teams.find((item) => item.id === input.teamId);
  if (!team) throw new Error(`团队不存在: ${input.teamId}`);
  team.name = input.name;
  team.description = input.description;
  team.updatedAt = Date.now();
  pushTeamActivity(state, {
    teamId: team.id,
    actor: input.actor?.trim() || "jensen",
    action: "update_team",
    targetType: "team",
    targetId: team.id,
    targetLabel: team.name,
    detail: team.description,
    createdAt: team.updatedAt,
  });
  return cloneValue(team) as T;
}
case "team_set_status": {
  const input = args?.input as { teamId: string; status: Team["status"]; actor?: string };
  const team = state.teams.find((item) => item.id === input.teamId);
  if (!team) throw new Error(`团队不存在: ${input.teamId}`);
  team.status = input.status;
  team.updatedAt = Date.now();
  pushTeamActivity(state, {
    teamId: team.id,
    actor: input.actor?.trim() || "jensen",
    action: input.status === "archived" ? "archive_team" : "restore_team",
    targetType: "team",
    targetId: team.id,
    targetLabel: team.name,
    detail: team.status,
    createdAt: team.updatedAt,
  });
  return cloneValue(team) as T;
}
case "team_delete": {
  const teamId = args?.teamId as string;
  const team = state.teams.find((item) => item.id === teamId);
  if (!team) throw new Error(`团队不存在: ${teamId}`);
  if (team.status !== "archived") throw new Error("请先归档团队，再执行删除");
  state.teams = state.teams.filter((item) => item.id !== teamId);
  delete state.membersByTeamId[teamId];
  delete state.teamSkillsByTeamId[teamId];
  delete state.submissionsByTeamId[teamId];
  delete state.activityLogsByTeamId[teamId];
  return undefined as T;
}
case "team_skill_list": {
  const teamId = args?.teamId as string;
  return cloneValue(state.teamSkillsByTeamId[teamId] ?? []) as T;
}
case "team_member_list": {
  const teamId = args?.teamId as string;
  return cloneValue(state.membersByTeamId[teamId] ?? []) as T;
}
case "team_member_create": {
  const input = args?.input as { teamId: string; userName: string; email?: string; role: TeamMember["role"]; actor?: string };
  const now = Date.now();
  const member: TeamMember = {
    id: `member-${now}`,
    teamId: input.teamId,
    userName: input.userName,
    email: input.email,
    role: input.role,
    status: "active",
    joinedAt: now,
    updatedAt: now,
  };
  state.membersByTeamId[input.teamId] = [...(state.membersByTeamId[input.teamId] ?? []), member];
  pushTeamActivity(state, {
    teamId: input.teamId,
    actor: input.actor?.trim() || "jensen",
    action: "create_member",
    targetType: "member",
    targetId: member.id,
    targetLabel: member.userName,
    detail: member.role,
    createdAt: now,
  });
  return cloneValue(member) as T;
}
case "team_member_update": {
  const input = args?.input as {
    memberId: string;
    userName: string;
    email?: string;
    role: TeamMember["role"];
    status: TeamMember["status"];
    actor?: string;
  };
  for (const teamId of Object.keys(state.membersByTeamId)) {
    const member = state.membersByTeamId[teamId].find((item) => item.id === input.memberId);
    if (member) {
      member.userName = input.userName;
      member.email = input.email;
      member.role = input.role;
      member.status = input.status;
      member.updatedAt = Date.now();
      pushTeamActivity(state, {
        teamId,
        actor: input.actor?.trim() || "jensen",
        action: "update_member",
        targetType: "member",
        targetId: member.id,
        targetLabel: member.userName,
        detail: `${member.role} / ${member.status}`,
        createdAt: member.updatedAt,
      });
      return cloneValue(member) as T;
    }
  }
  throw new Error(`团队成员不存在: ${input.memberId}`);
}
case "team_member_remove": {
  const memberId = args?.memberId as string;
  const actor = (args?.actor as string | undefined)?.trim() || "jensen";
  for (const teamId of Object.keys(state.membersByTeamId)) {
    const removed = state.membersByTeamId[teamId].find((item) => item.id === memberId);
    const before = state.membersByTeamId[teamId].length;
    state.membersByTeamId[teamId] = state.membersByTeamId[teamId].filter((item) => item.id !== memberId);
    if (state.membersByTeamId[teamId].length !== before) {
      if (removed) {
        pushTeamActivity(state, {
          teamId,
          actor,
          action: "remove_member",
          targetType: "member",
          targetId: removed.id,
          targetLabel: removed.userName,
          detail: `${removed.role} / ${removed.status}`,
          createdAt: Date.now(),
        });
      }
      return undefined as T;
    }
  }
  throw new Error(`团队成员不存在: ${memberId}`);
}
case "team_activity_list": {
  const teamId = args?.teamId as string;
  const limit = typeof args?.limit === "number" ? args.limit : 100;
  return cloneValue((state.activityLogsByTeamId[teamId] ?? []).slice(0, limit)) as T;
}
    default:
      return undefined;
  }
}
