/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TeamsPage } from "@/features/teams/pages/TeamsPage";

const selectTeam = vi.fn();
const createTeam = vi.fn(async () => null);
const updateTeam = vi.fn(async () => null);
const setTeamStatus = vi.fn(async () => null);
const deleteTeam = vi.fn(async () => true);
const createTeamMember = vi.fn(async () => null);
const updateTeamMember = vi.fn(async () => null);
const removeTeamMember = vi.fn(async () => true);
const loadActivities = vi.fn(async () => {});
const loadVersions = vi.fn(async () => {});
const rejectSubmission = vi.fn(async () => true);
const setRecommendedVersion = vi.fn(async () => true);
const loadSkills = vi.fn(async () => {});
const loadSnapshots = vi.fn(async () => {});
const loadSubmissionDiff = vi.fn(async (..._args: unknown[]) => null as any);
const loadSubmissionMergePreview = vi.fn(async (..._args: unknown[]) => null as any);
const loadVersionDiff = vi.fn(async (..._args: unknown[]) => null as any);
const listTeamVersionFiles = vi.fn(async (..._args: unknown[]) => null as any);
const readTeamVersionFile = vi.fn(async (..._args: unknown[]) => null as any);
const checkPullImpact = vi.fn(async () => null);

const teamContextMock: any = {
  teams: [
    {
      id: "team-1",
      name: "Alpha Team",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: "active",
    },
  ],
  selectedTeamId: "team-1",
  selectTeam,
  createTeam,
  updateTeam,
  setTeamStatus,
  deleteTeam,
  teamSkills: [
    {
      id: "skill-1",
      teamId: "team-1",
      name: "Team Skill",
      slug: "team-skill",
      createdAt: Date.now(),
    },
  ],
  members: [
    {
      id: "member-1",
      teamId: "team-1",
      userName: "jensen",
      role: "owner" as const,
      status: "active" as const,
      joinedAt: Date.now(),
      updatedAt: Date.now(),
    },
  ],
  createTeamMember,
  updateTeamMember,
  removeTeamMember,
  loadActivities,
  activities: [
    {
      id: "activity-1",
      teamId: "team-1",
      actor: "jensen",
      action: "merge_submission",
      targetType: "team_version",
      targetId: "version-2",
      targetLabel: "Team Skill",
      detail: "v2",
      createdAt: Date.now(),
    },
  ],
  submissions: [
    {
      id: "sub-1",
      teamId: "team-1",
      sourceSkillId: "skill-a",
      sourceSnapshotId: "snap-a",
      submitter: "jensen",
      submitMessage: "待合并改动",
      submittedAt: Date.now(),
      status: "pending" as const,
    },
  ],
  versionsByTeamSkillId: {
    "skill-1": [
      {
        id: "version-2",
        teamSkillId: "skill-1",
        versionNumber: 2,
        snapshotPath: "path-2",
        revisionHash: "rev-2",
        mergedAt: Date.now(),
        isRecommended: false,
      },
    ],
  },
  loadVersions,
  loadSubmissionDiff,
  loadSubmissionMergePreview,
  loadVersionDiff,
  listTeamVersionFiles,
  readTeamVersionFile,
  checkPullImpact,
  rejectSubmission,
  setRecommendedVersion,
};

vi.mock("@/features/teams/state/TeamContext", () => ({
  useTeamContext: () => teamContextMock,
}));

vi.mock("@/features/skills/state/SkillContext", () => ({
  useSkillContext: () => ({
    loadSkills,
    skills: [],
  }),
}));

vi.mock("@/features/snapshots/state/SnapshotContext", () => ({
  useSnapshotContext: () => ({
    loadSnapshots,
  }),
}));

vi.mock("@/features/teams/components/MergeSubmissionModal", () => ({
  MergeSubmissionModal: ({ open }: { open: boolean }) => (open ? <div>MergeSubmissionModal</div> : null),
}));

vi.mock("@/features/teams/components/PullTeamVersionModal", () => ({
  PullTeamVersionModal: ({ open }: { open: boolean }) => (open ? <div>PullTeamVersionModal</div> : null),
}));

describe("TeamsPage", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    teamContextMock.members = [
      {
        id: "member-1",
        teamId: "team-1",
        userName: "jensen",
        role: "owner" as const,
        status: "active" as const,
        joinedAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
    teamContextMock.submissions = [
      {
        id: "sub-1",
        teamId: "team-1",
        sourceSkillId: "skill-a",
        sourceSnapshotId: "snap-a",
        submitter: "jensen",
        submitMessage: "待合并改动",
        submittedAt: Date.now(),
        status: "pending" as const,
      },
    ];

    selectTeam.mockClear();
    createTeam.mockClear();
    updateTeam.mockClear();
    setTeamStatus.mockClear();
    deleteTeam.mockClear();
    createTeamMember.mockClear();
    updateTeamMember.mockClear();
    removeTeamMember.mockClear();
    loadActivities.mockClear();
    loadVersions.mockClear();
    loadSubmissionDiff.mockClear();
    loadSubmissionMergePreview.mockClear();
    loadVersionDiff.mockClear();
    checkPullImpact.mockClear();
    listTeamVersionFiles.mockClear();
    readTeamVersionFile.mockClear();
    rejectSubmission.mockClear();
    setRecommendedVersion.mockClear();
    loadSkills.mockClear();
    loadSnapshots.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows 合并 and 拒绝 actions for pending submissions", () => {
    render(<TeamsPage />);

    fireEvent.click(screen.getByRole("tab", { name: "变更请求" }));

    expect(screen.getByRole("button", { name: "合并" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "拒绝" })).toBeTruthy();
  }, 10000);

  it("disables privileged team actions for readonly members", () => {
    teamContextMock.members = [
      {
        id: "member-viewer",
        teamId: "team-1",
        userName: "jensen",
        role: "viewer" as const,
        status: "active" as const,
        joinedAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    render(<TeamsPage />);
    fireEvent.click(screen.getByRole("tab", { name: "变更请求" }));

    expect((screen.getByRole("button", { name: "合并" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "拒绝" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("only renders pending submissions in 变更请求 tab", () => {
    teamContextMock.submissions = [
      {
        id: "sub-pending",
        teamId: "team-1",
        sourceSkillId: "skill-a",
        sourceSnapshotId: "snap-a",
        submitter: "jensen",
        submittedAt: Date.now(),
        status: "pending" as const,
      },
      {
        id: "sub-merged",
        teamId: "team-1",
        sourceSkillId: "skill-b",
        sourceSnapshotId: "snap-b",
        submitter: "amy",
        submittedAt: Date.now(),
        status: "merged" as const,
      },
    ];

    render(<TeamsPage />);
    fireEvent.click(screen.getByRole("tab", { name: "变更请求" }));

    expect(screen.getAllByText("jensen").length).toBeGreaterThan(0);
    expect(screen.queryByText("amy")).toBeNull();
  });

  it("opens Popconfirm after clicking 拒绝", async () => {
    render(<TeamsPage />);

    fireEvent.click(screen.getByRole("tab", { name: "变更请求" }));
    fireEvent.click(screen.getByRole("button", { name: "拒绝" }));

    expect(await screen.findByText("确认拒绝该请求？")).toBeTruthy();
  });

  it("shows 拉取到个人 and 设为推荐 actions for team versions", () => {
    render(<TeamsPage />);
    fireEvent.click(screen.getByRole("tab", { name: "技能库" }));

    expect(screen.getByRole("button", { name: "拉取到个人" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "设为推荐" })).toBeTruthy();
  });

  it("shows 查看变更 action for team versions", () => {
    render(<TeamsPage />);
    fireEvent.click(screen.getByRole("tab", { name: "技能库" }));

    expect(screen.getByRole("button", { name: "查看变更" })).toBeTruthy();
  });

  it("opens merge diff modal after clicking 查看变更 in 待合并提交 tab", async () => {
    loadSubmissionDiff.mockResolvedValueOnce({
      addedFiles: ["skill.md"],
      deletedFiles: [],
      modifiedFiles: [],
      textDiffs: {
        "skill.md": {
          filePath: "skill.md",
          unifiedDiff: "@@ -0,0 +1 @@\n+# hello",
          oldLines: 0,
          newLines: 1,
        },
      },
    });

    render(<TeamsPage />);
    fireEvent.click(screen.getByRole("tab", { name: "变更请求" }));
    fireEvent.click(screen.getByRole("button", { name: "查看变更" }));

    expect(await screen.findByText("请求变更预览")).toBeTruthy();
    expect(loadSubmissionDiff).toHaveBeenCalledWith("sub-1");
  });

  it("opens version diff modal after clicking 查看变更 in team versions", async () => {
    loadVersionDiff.mockResolvedValueOnce({
      addedFiles: ["README.md"],
      deletedFiles: [],
      modifiedFiles: [],
      textDiffs: {
        "README.md": {
          filePath: "README.md",
          unifiedDiff: "@@ -0,0 +1 @@\n+first version",
          oldLines: 0,
          newLines: 1,
        },
      },
    });

    render(<TeamsPage />);
    fireEvent.click(screen.getByRole("tab", { name: "技能库" }));
    fireEvent.click(screen.getAllByRole("button", { name: "查看变更" })[0]);

    expect(await screen.findByText("版本变更预览")).toBeTruthy();
    expect(loadVersionDiff).toHaveBeenCalledWith("version-2");
    expect(screen.getAllByText("README.md").length).toBeGreaterThan(0);
  });

  it("shows member list in 成员 tab", () => {
    teamContextMock.members = [
      {
        id: "member-1",
        teamId: "team-1",
        userName: "jensen",
        role: "owner" as const,
        status: "active" as const,
        joinedAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    render(<TeamsPage />);
    fireEvent.click(screen.getByRole("tab", { name: "成员" }));

    expect(screen.getAllByText("jensen").length).toBeGreaterThan(0);
  });

  it("shows team activity in 活动 tab", () => {
    render(<TeamsPage />);
    fireEvent.click(screen.getByRole("tab", { name: "活动" }));

    expect(screen.getByText("合并请求")).toBeTruthy();
    expect(screen.getByText("Team Skill")).toBeTruthy();
    expect(screen.getByText(/操作者: jensen/)).toBeTruthy();
  });

  it("opens add member modal from 成员 tab", () => {
    render(<TeamsPage />);
    fireEvent.click(screen.getByRole("tab", { name: "成员" }));
    fireEvent.click(screen.getByRole("button", { name: "添加成员" }));

    expect(screen.getAllByText("添加成员").length).toBeGreaterThan(0);
    expect(screen.getByText("角色")).toBeTruthy();
  });

  it("saves team settings from 设置 tab", () => {
    render(<TeamsPage />);
    fireEvent.click(screen.getByRole("tab", { name: "设置" }));
    fireEvent.change(screen.getByDisplayValue("Alpha Team"), { target: { value: "Core Team" } });
    fireEvent.click(screen.getByRole("button", { name: "保存团队" }));

    expect(updateTeam).toHaveBeenCalledWith({
      teamId: "team-1",
      name: "Core Team",
      description: undefined,
      actor: "jensen",
    });
  });
});
