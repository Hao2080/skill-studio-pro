/** @vitest-environment jsdom */
import { App } from "antd";
import { render, screen, cleanup, act, fireEvent, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VersionHistoryPanel } from "@/features/snapshots/components/VersionHistoryPanel";
import type { SkillPlatformReleaseOverview, SkillSnapshot } from "@/types/skill";
import type { SkillTeamDeliveryOverview } from "@/types/team";

vi.setConfig({ testTimeout: 15000 });

const invokeMock = vi.fn();
const appUseAppMock = vi.spyOn(App, "useApp");

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

const loadSkills = vi.fn(async () => {});
const loadChangeStatuses = vi.fn(async () => {});
const createSnapshot = vi.fn(async () => {});
const restoreSnapshot = vi.fn(async () => {});
const deleteSnapshot = vi.fn(async () => {});
const updateSnapshotSummary = vi.fn(async () => {});
const setActiveSnapshot = vi.fn(async () => {});
const loadSnapshots = vi.fn(async () => {});
const loadSubmissions = vi.fn(async () => {});
const clearCreateSnapshotUiFeedback = vi.fn();

const messageApi = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
};

const baseSnapshots: SkillSnapshot[] = [
  {
    id: "snap-2",
    skillId: "skill-1",
    snapshotNumber: 2,
    snapshotPath: "snap-2",
    revisionHash: "rev-2",
    changeSummary: "最新快照",
    source: "manual",
    createdAt: Date.now(),
    isCurrent: false,
    isActive: true,
  },
  {
    id: "snap-1",
    skillId: "skill-1",
    snapshotNumber: 1,
    snapshotPath: "snap-1",
    revisionHash: "rev-1",
    changeSummary: "旧快照",
    source: "manual",
    createdAt: Date.now() - 1000,
    isCurrent: false,
    isActive: false,
  },
];

const baseReleaseOverview: SkillPlatformReleaseOverview = {
  releases: [
    {
      platformName: "OpenAI",
      detected: true,
      enabled: true,
      skillsDir: "/skills/openai",
      currentTarget: {
        platformName: "OpenAI",
        snapshotId: "snap-2",
        snapshotNumber: 2,
        changeSummary: "最新快照",
        releasedAt: Date.now() - 2000,
      },
      lastRecord: {
        id: "record-1",
        platformName: "OpenAI",
        snapshotId: "snap-2",
        snapshotNumber: 2,
        changeSummary: "最新快照",
        action: "publish",
        status: "success",
        createdAt: Date.now() - 2000,
      },
    },
    {
      platformName: "Claude",
      detected: true,
      enabled: true,
      skillsDir: "/skills/claude",
      currentTarget: {
        platformName: "Claude",
        snapshotId: "snap-1",
        snapshotNumber: 1,
        changeSummary: "旧快照",
        releasedAt: Date.now() - 4000,
      },
      lastRecord: {
        id: "record-2",
        platformName: "Claude",
        snapshotId: "snap-1",
        snapshotNumber: 1,
        changeSummary: "旧快照",
        action: "switch",
        status: "success",
        createdAt: Date.now() - 4000,
      },
    },
  ],
  recentRecords: [
    {
      id: "record-1",
      platformName: "OpenAI",
      snapshotId: "snap-2",
      snapshotNumber: 2,
      changeSummary: "最新快照",
      action: "publish",
      status: "success",
      createdAt: Date.now() - 2000,
    },
    {
      id: "record-2",
      platformName: "Claude",
      snapshotId: "snap-1",
      snapshotNumber: 1,
      changeSummary: "旧快照",
      action: "switch",
      status: "success",
      createdAt: Date.now() - 4000,
    },
  ],
};

const baseTeamDeliveryOverview: SkillTeamDeliveryOverview = {
  deliveries: [
    {
      teamId: "team-1",
      teamName: "Core Team",
      teamDescription: "核心交付团队",
      currentTarget: {
        teamId: "team-1",
        teamName: "Core Team",
        sourceSkillId: "skill-1",
        sourceSnapshotId: "snap-1",
        sourceSnapshotNumber: 1,
        changeSummary: "旧快照",
        teamSkillId: "team-skill-1",
        teamSkillName: "Core Skill",
        teamVersionId: "team-version-1",
        teamVersionNumber: 1,
        deliveredAt: Date.now() - 4000,
      },
      pendingDelivery: {
        submissionId: "submission-1",
        teamId: "team-1",
        teamName: "Core Team",
        teamSkillId: "team-skill-1",
        sourceSnapshotId: "snap-2",
        sourceSnapshotNumber: 2,
        changeSummary: "最新快照",
        submitter: "jensen",
        submitMessage: "团队评审版本",
        submittedAt: Date.now() - 2000,
      },
      lastRecord: {
        id: "team-record-1",
        teamId: "team-1",
        teamName: "Core Team",
        sourceSkillId: "skill-1",
        sourceSnapshotId: "snap-2",
        sourceSnapshotNumber: 2,
        changeSummary: "最新快照",
        teamSkillId: "team-skill-1",
        teamSkillName: "Core Skill",
        submissionId: "submission-1",
        action: "submit",
        status: "pending",
        actor: "jensen",
        note: "团队评审版本",
        createdAt: Date.now() - 2000,
      },
    },
  ],
  recentRecords: [
    {
      id: "team-record-1",
      teamId: "team-1",
      teamName: "Core Team",
      sourceSkillId: "skill-1",
      sourceSnapshotId: "snap-2",
      sourceSnapshotNumber: 2,
      changeSummary: "最新快照",
      teamSkillId: "team-skill-1",
      teamSkillName: "Core Skill",
      submissionId: "submission-1",
      action: "submit",
      status: "pending",
      actor: "jensen",
      note: "团队评审版本",
      createdAt: Date.now() - 2000,
    },
  ],
};

let teamDeliveryOverviewMock: SkillTeamDeliveryOverview = baseTeamDeliveryOverview;

const skillContextMock = {
  selectedSkillId: "skill-1",
  loadSkills,
  loadChangeStatuses,
  changeStatusMap: {},
};

const teamContextMock = {
  teams: [
    {
      id: "team-1",
      name: "Core Team",
      createdAt: 0,
    },
  ],
  selectedTeamId: "team-1",
  submissions: [
    {
      id: "submission-1",
      teamId: "team-1",
      sourceSkillId: "skill-1",
      sourceSnapshotId: "snap-1",
      submitter: "jensen",
      submitMessage: "团队评审版本",
      submittedAt: Date.now() - 5000,
      status: "pending" as const,
    },
  ],
  loadSubmissions,
};

const snapshotContextMock = {
  snapshots: baseSnapshots,
  loading: false,
  createSnapshot,
  restoreSnapshot,
  deleteSnapshot,
  updateSnapshotSummary,
  setActiveSnapshot,
  loadSnapshots,
  createSnapshotUiFeedback: null,
  clearCreateSnapshotUiFeedback,
};

vi.mock("@/features/skills/state/SkillContext", () => ({
  useSkillContext: () => skillContextMock,
}));

vi.mock("@/features/snapshots/state/SnapshotContext", () => ({
  useSnapshotContext: () => snapshotContextMock,
}));

vi.mock("@/features/teams/state/TeamContext", () => ({
  useTeamContext: () => teamContextMock,
}));

function getWorkspaceCard() {
  const workspaceCard = screen
    .getAllByRole("button")
    .find((element) => element.className.includes("version-workspace-card"));

  if (!workspaceCard) {
    throw new Error("workspace card not found");
  }

  return workspaceCard;
}

describe("VersionHistoryPanel component feedback", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    invokeMock.mockReset();
    loadSkills.mockClear();
    loadChangeStatuses.mockClear();
    createSnapshot.mockClear();
    restoreSnapshot.mockClear();
    deleteSnapshot.mockClear();
    updateSnapshotSummary.mockClear();
    setActiveSnapshot.mockClear();
    loadSnapshots.mockClear();
    loadSubmissions.mockClear();
    clearCreateSnapshotUiFeedback.mockClear();
    messageApi.success.mockClear();
    messageApi.error.mockClear();
    messageApi.warning.mockClear();
    appUseAppMock.mockReturnValue({ message: messageApi } as never);
    Object.assign(snapshotContextMock, {
      snapshots: baseSnapshots,
      loading: false,
      createSnapshotUiFeedback: null,
    });
    Object.assign(skillContextMock, {
      selectedSkillId: "skill-1",
      changeStatusMap: {
        "skill-1": {
          hasChanges: true,
          addedFiles: [],
          deletedFiles: [],
          modifiedFiles: [],
        },
      },
    });
    Object.assign(teamContextMock, {
      teams: [
        {
          id: "team-1",
          name: "Core Team",
          createdAt: 0,
        },
      ],
      selectedTeamId: "team-1",
      submissions: [
        {
          id: "submission-1",
          teamId: "team-1",
          sourceSkillId: "skill-1",
          sourceSnapshotId: "snap-1",
          submitter: "jensen",
          submitMessage: "团队评审版本",
          submittedAt: Date.now() - 5000,
          status: "pending",
        },
      ],
    });
    teamDeliveryOverviewMock = baseTeamDeliveryOverview;
    invokeMock.mockImplementation((command: string) => {
      if (command === "platform_detect") {
        return Promise.resolve({
          platforms: [
            {
              id: "platform-1",
              platformName: "OpenAI",
              detected: true,
              enabled: true,
              skillsDir: "/skills/openai",
            },
            {
              id: "platform-2",
              platformName: "Claude",
              detected: true,
              enabled: true,
              skillsDir: "/skills/claude",
            },
          ],
        });
      }

      if (command === "get_skill_platform_releases") {
        return Promise.resolve(baseReleaseOverview);
      }

      if (command === "publish_snapshot_to_platforms") {
        return Promise.resolve([
          {
            id: "record-publish",
            platformName: "OpenAI",
            snapshotId: "snap-2",
            snapshotNumber: 2,
            changeSummary: "最新快照",
            action: "publish",
            status: "success",
            createdAt: Date.now(),
          },
        ]);
      }

      if (command === "remove_skill_from_platforms") {
        return Promise.resolve([
          {
            id: "record-remove",
            platformName: "Claude",
            snapshotId: "snap-1",
            snapshotNumber: 1,
            changeSummary: "旧快照",
            action: "remove",
            status: "success",
            createdAt: Date.now(),
          },
        ]);
      }

      if (command === "team_skill_delivery_get") {
        return Promise.resolve(teamDeliveryOverviewMock);
      }

      if (command === "team_snapshot_submit_to_teams") {
        return Promise.resolve([
          {
            id: "team-record-submit",
            teamId: "team-1",
            teamName: "Core Team",
            sourceSkillId: "skill-1",
            sourceSnapshotId: "snap-2",
            sourceSnapshotNumber: 2,
            changeSummary: "最新快照",
            teamSkillId: "team-skill-1",
            teamSkillName: "Core Skill",
            submissionId: "submission-2",
            action: "submit",
            status: "pending",
            actor: "jensen",
            note: "团队评审版本",
            createdAt: Date.now(),
          },
        ]);
      }

      if (command === "team_pending_delivery_withdraw") {
        return Promise.resolve([
          {
            id: "team-record-withdraw",
            teamId: "team-1",
            teamName: "Core Team",
            sourceSkillId: "skill-1",
            sourceSnapshotId: "snap-2",
            sourceSnapshotNumber: 2,
            changeSummary: "最新快照",
            teamSkillId: "team-skill-1",
            teamSkillName: "Core Skill",
            submissionId: "submission-1",
            action: "withdraw",
            status: "success",
            note: "团队评审版本",
            createdAt: Date.now(),
          },
        ]);
      }

      if (command === "team_skill_remove_from_teams") {
        return Promise.resolve([
          {
            id: "team-record-remove",
            teamId: "team-1",
            teamName: "Core Team",
            sourceSkillId: "skill-1",
            sourceSnapshotId: "snap-1",
            sourceSnapshotNumber: 1,
            changeSummary: "旧快照",
            teamSkillId: "team-skill-1",
            teamSkillName: "Core Skill",
            teamVersionId: "team-version-1",
            teamVersionNumber: 1,
            action: "remove",
            status: "success",
            note: "仅解除当前团队承接，不删除团队历史版本。",
            createdAt: Date.now(),
          },
        ]);
      }

      if (command === "diff_snapshots") {
        return Promise.resolve({
          addedFiles: [],
          deletedFiles: [],
          modifiedFiles: ["src/demo.ts"],
          textDiffs: {
            "src/demo.ts": {
              filePath: "src/demo.ts",
              unifiedDiff: "@@ -1 +1 @@\n-old\n+new",
              oldLines: 1,
              newLines: 1,
            },
          },
        });
      }

      if (command === "diff_working_directory") {
        return Promise.resolve({
          addedFiles: [],
          deletedFiles: [],
          modifiedFiles: [],
          textDiffs: {},
        });
      }

      return Promise.resolve(null);
    });
  });

  it("highlights the new snapshot card and clears the highlight afterwards", () => {
    vi.useFakeTimers();

    Object.assign(snapshotContextMock, {
      createSnapshotUiFeedback: {
        scrollToSnapshotId: "snap-2",
        highlightedSnapshotId: "snap-2",
      },
    });

    const { container } = render(<VersionHistoryPanel />);

    expect(container.querySelector('[data-snapshot-id="snap-2"]')?.className).toContain("is-highlighted");

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(clearCreateSnapshotUiFeedback).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-snapshot-id="snap-2"]')?.className).not.toContain("is-highlighted");
  });

  it("opens create snapshot modal from the version toolbar", async () => {
    render(<VersionHistoryPanel />);

    expect(screen.getByText(/本地版本/)).toBeTruthy();
    expect(screen.getByText("工作区")).toBeTruthy();
    expect(screen.getByRole("button", { name: "对比版本" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "开始对比" })).toBeNull();
    expect(screen.getByRole("heading", { name: "v2" })).toBeTruthy();
    expect(screen.getAllByText("草稿中").length).toBeGreaterThan(0);
    expect(screen.getByText("先把工作区收口成快照")).toBeTruthy();

    const toolbarActions = screen.getByRole("group", { name: "版本主操作" });
    fireEvent.click(within(toolbarActions).getByRole("button", { name: "创建快照" }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("输入版本说明（可选）")).toBeTruthy();
    });
  });

  it("defaults to the active snapshot as the displayed entity", async () => {
    const { container } = render(<VersionHistoryPanel />);

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "快照详情" })).toBeTruthy();
    });

    expect(container.querySelector('[data-snapshot-id="snap-2"]')?.className).toContain("is-selected");
    expect(screen.getByRole("heading", { name: "v2" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "恢复到工作区" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "平台同步" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "团队交付" })).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "平台同步" }));
    expect(screen.getByRole("heading", { name: "平台同步" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "同步到平台" })).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: /团队交付/ }));
    expect(screen.getByRole("heading", { name: "团队交付" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "交付到团队" })).toBeTruthy();
  });

  it("supports direct navigation to a specific console section", async () => {
    render(<VersionHistoryPanel navigationIntent={{ tab: "Versions", section: "team" }} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "团队交付" })).toBeTruthy();
    });
  });

  it("falls back to the latest snapshot when there is no active version", async () => {
    Object.assign(snapshotContextMock, {
      snapshots: [
        {
          ...baseSnapshots[0],
          id: "snap-3",
          snapshotNumber: 3,
          changeSummary: "无生效时的最新快照",
          isActive: false,
        },
        {
          ...baseSnapshots[1],
          id: "snap-2",
          snapshotNumber: 2,
          changeSummary: "旧快照",
          isActive: false,
        },
      ],
    });

    render(<VersionHistoryPanel />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "v3" })).toBeTruthy();
    });
    expect(screen.getAllByText("无生效时的最新快照").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "设为生效版本" })).toBeTruthy();
  });

  it("prefers the latest manual snapshot instead of a newer system restore point", async () => {
    Object.assign(snapshotContextMock, {
      snapshots: [
        {
          ...baseSnapshots[0],
          id: "snap-4",
          snapshotNumber: 4,
          changeSummary: "发布前自动创建恢复点",
          source: "system",
          isActive: false,
        },
        {
          ...baseSnapshots[0],
          id: "snap-3",
          snapshotNumber: 3,
          changeSummary: "正式版本",
          source: "manual",
          isActive: false,
        },
        {
          ...baseSnapshots[1],
          id: "snap-2",
          snapshotNumber: 2,
          changeSummary: "更早的正式版本",
          source: "manual",
          isActive: false,
        },
      ],
    });

    render(<VersionHistoryPanel />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "v3" })).toBeTruthy();
    });
    expect(screen.queryByRole("heading", { name: "v4" })).toBeNull();
    expect(screen.getAllByText("系统恢复点").length).toBeGreaterThan(0);
  });

  it("falls back to the workspace when there are no snapshots", async () => {
    Object.assign(snapshotContextMock, {
      snapshots: [],
    });

    render(<VersionHistoryPanel />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "工作区" })).toBeTruthy();
    });
    expect(screen.getByText("当前还没有版本基线")).toBeTruthy();
    expect(screen.getByText("待建立")).toBeTruthy();
    expect(screen.getByText("先创建首个快照")).toBeTruthy();
    expect(screen.getByRole("button", { name: "创建快照" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "对比版本" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("tab", { name: "平台同步" }));
    expect((screen.getByRole("button", { name: "同步到平台" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("tab", { name: /团队交付/ }));
    expect((screen.getByRole("button", { name: "交付到团队" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("blocks system restore points from activation, release, and team delivery flows", async () => {
    Object.assign(snapshotContextMock, {
      snapshots: [
        {
          ...baseSnapshots[0],
          id: "snap-3",
          snapshotNumber: 3,
          changeSummary: "发布前自动创建恢复点",
          source: "system",
          isActive: false,
        },
        {
          ...baseSnapshots[0],
          id: "snap-2",
          snapshotNumber: 2,
          changeSummary: "正式版本",
          source: "manual",
          isActive: true,
        },
      ],
    });

    render(<VersionHistoryPanel />);

    fireEvent.click(screen.getByText("发布前自动创建恢复点").closest("[data-snapshot-id]")!);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "v3" })).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: "设为生效版本" })).toBeNull();
    expect(screen.getAllByText("系统恢复点").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("tab", { name: "平台同步" }));
    await waitFor(() => {
      expect(screen.getByText("系统恢复点不能直接发布")).toBeTruthy();
    });
    expect((screen.getByRole("button", { name: "同步到平台" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("tab", { name: /团队交付/ }));
    await waitFor(() => {
      expect(screen.getByText("系统恢复点不能直接交付团队")).toBeTruthy();
    });
    expect((screen.getByRole("button", { name: "交付到团队" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("dismisses the review-latest decision card for the current opening only", async () => {
    Object.assign(snapshotContextMock, {
      snapshots: [
        {
          id: "snap-3",
          skillId: "skill-1",
          snapshotNumber: 3,
          snapshotPath: "snap-3",
          revisionHash: "rev-3",
          changeSummary: "最新快照",
          source: "manual",
          createdAt: Date.now(),
          isCurrent: false,
          isActive: false,
        },
        {
          id: "snap-1",
          skillId: "skill-1",
          snapshotNumber: 1,
          snapshotPath: "snap-1",
          revisionHash: "rev-1",
          changeSummary: "当前基线",
          source: "manual",
          createdAt: Date.now() - 1000,
          isCurrent: false,
          isActive: true,
        },
      ],
    });
    Object.assign(skillContextMock, {
      changeStatusMap: {
        "skill-1": {
          hasChanges: false,
          addedFiles: [],
          deletedFiles: [],
          modifiedFiles: [],
        },
      },
    });

    const { unmount } = render(<VersionHistoryPanel />);

    await waitFor(() => {
      expect(screen.getByText("审查最新快照是否进入对外基线")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "关闭版本决策提示" }));
    expect(screen.queryByLabelText("版本决策提示")).toBeNull();

    unmount();
    render(<VersionHistoryPanel />);

    await waitFor(() => {
      expect(screen.getByText("审查最新快照是否进入对外基线")).toBeTruthy();
    });
  });

  it("switches the displayed object without arming compare until start compare is pressed", async () => {
    render(<VersionHistoryPanel />);

    fireEvent.click(screen.getByText("旧快照").closest("[data-snapshot-id]")!);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "v1" })).toBeTruthy();
    });
    expect(screen.queryByLabelText("对比准备状态")).toBeNull();
    expect(screen.queryByRole("button", { name: "对比工作区" })).toBeNull();
  });

  it("starts compare from the selected snapshot and runs diff after choosing another snapshot", async () => {
    render(<VersionHistoryPanel />);

    fireEvent.click(screen.getByText("旧快照").closest("[data-snapshot-id]")!);
    fireEvent.click(screen.getByRole("button", { name: "对比版本" }));

    expect(screen.getByText("已将当前版本设为对比基准")).toBeTruthy();
    expect(screen.getByLabelText("对比草稿")).toBeTruthy();
    expect(screen.getByText("等待选择对比目标")).toBeTruthy();

    fireEvent.click(screen.getByText("最新快照").closest("[data-snapshot-id]")!);

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("diff_snapshots", {
        input: { snapshotIdA: "snap-1", snapshotIdB: "snap-2" },
      });
    });
  });

  it("resets compare draft after switching to another skill", async () => {
    const { rerender } = render(<VersionHistoryPanel />);

    fireEvent.click(screen.getByText("旧快照").closest("[data-snapshot-id]")!);
    fireEvent.click(screen.getByRole("button", { name: "对比版本" }));
    expect(screen.getByText("已将当前版本设为对比基准")).toBeTruthy();

    Object.assign(skillContextMock, {
      selectedSkillId: "skill-2",
      changeStatusMap: {
        "skill-2": {
          hasChanges: false,
          addedFiles: [],
          deletedFiles: [],
          modifiedFiles: [],
        },
      },
    });
    Object.assign(snapshotContextMock, {
      snapshots: [
        {
          ...baseSnapshots[0],
          id: "snap-20",
          skillId: "skill-2",
          snapshotNumber: 5,
          changeSummary: "skill-2 最新快照",
        },
      ],
    });

    rerender(<VersionHistoryPanel />);

    await waitFor(() => {
      expect(loadSnapshots).toHaveBeenCalledWith("skill-2");
    });
    expect(screen.queryByText("已将当前版本设为对比基准")).toBeNull();
    expect(screen.getByRole("heading", { name: "v5" })).toBeTruthy();
  });

  it("enters dedicated compare mode after choosing a target snapshot, and can exit back to versions", async () => {
    render(<VersionHistoryPanel />);

    fireEvent.click(screen.getByText("旧快照").closest("[data-snapshot-id]")!);
    fireEvent.click(screen.getByRole("button", { name: "对比版本" }));
    fireEvent.click(screen.getByText("最新快照").closest("[data-snapshot-id]")!);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "返回版本列表" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "返回版本列表" }));

    expect(screen.getByText(/本地版本/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "返回版本列表" })).toBeNull();
  });

  it("switches compare target to workspace from the draft state", async () => {
    render(<VersionHistoryPanel />);

    fireEvent.click(screen.getByText("旧快照").closest("[data-snapshot-id]")!);
    fireEvent.click(screen.getByRole("button", { name: "对比版本" }));
    expect(screen.getByLabelText("对比草稿")).toBeTruthy();

    fireEvent.click(getWorkspaceCard());

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("diff_working_directory", { skillId: "skill-1" });
    });
  });

  it("starts compare from the workspace by using the latest snapshot as the default base", async () => {
    const { container } = render(<VersionHistoryPanel />);

    fireEvent.click(getWorkspaceCard());

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "工作区" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "对比版本" }));

    expect(screen.getByText("已将最新快照 v2 设为对比基准")).toBeTruthy();
    expect(screen.getByLabelText("对比草稿")).toBeTruthy();
    expect(container.querySelector('[data-snapshot-id="snap-2"]')?.className).toContain("is-base");

    fireEvent.click(getWorkspaceCard());

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("diff_working_directory", { skillId: "skill-1" });
    });
  });

  it("shows 团队交付 actions for snapshots", () => {
    render(<VersionHistoryPanel />);
    fireEvent.click(screen.getByRole("tab", { name: /团队交付/ }));
    expect(screen.getAllByRole("button", { name: /交付到团队|改交为此版本|重新提交/ }).length).toBeGreaterThan(0);
  });

  it("supports editing and saving the snapshot summary", async () => {
    render(<VersionHistoryPanel />);

    fireEvent.click(screen.getByRole("button", { name: "编辑说明" }));
    fireEvent.change(screen.getByPlaceholderText("填写版本说明，说明这次快照承载的改动与目的"), {
      target: { value: "新的版本说明" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存说明" }));

    await waitFor(() => {
      expect(updateSnapshotSummary).toHaveBeenCalledWith("snap-2", "新的版本说明");
    });
  });

  it("shows the selected snapshot's actual platform coverage instead of all enabled platforms", async () => {
    render(<VersionHistoryPanel />);

    fireEvent.click(screen.getByText("旧快照").closest("[data-snapshot-id]")!);
    fireEvent.click(screen.getByRole("tab", { name: "平台同步" }));

    await waitFor(() => {
      expect(screen.getByText("当前版本已承接到 1 个平台")).toBeTruthy();
    });
    expect(screen.getByText("当前版本承接")).toBeTruthy();
    expect(screen.getByText("其他版本承接")).toBeTruthy();
    expect(screen.getAllByText("Claude").length).toBeGreaterThan(0);
    expect(screen.getByText("承接当前版本")).toBeTruthy();
  });

  it("publishes the selected snapshot only to the chosen platforms", async () => {
    render(<VersionHistoryPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "平台同步" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "平台同步" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "同步到平台" }));

    await waitFor(() => {
      expect(screen.getByText("当前将把快照 v2 发布到所选平台。若平台已承接其他版本，本次会直接改发为当前快照。")).toBeTruthy();
    });

    const publishDialog = screen.getByRole("dialog", { name: "发布快照 v2" });
    fireEvent.click(within(publishDialog).getByRole("checkbox", { name: /Claude/i }));
    fireEvent.click(within(publishDialog).getByRole("button", { name: /发 布/ }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("publish_snapshot_to_platforms", {
        input: {
          skillId: "skill-1",
          snapshotId: "snap-2",
          platformNames: ["OpenAI"],
        },
      });
    });

    await waitFor(() => {
      expect(
        invokeMock.mock.calls.filter(([command]) => command === "get_skill_platform_releases").length,
      ).toBeGreaterThan(1);
    });
  });

  it("supports removing the current platform release", async () => {
    render(<VersionHistoryPanel />);

    fireEvent.click(screen.getByRole("tab", { name: "平台同步" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "平台同步" })).toBeTruthy();
    });

    fireEvent.click(screen.getAllByRole("button", { name: "从平台移除" })[0]);

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("remove_skill_from_platforms", {
        input: {
          skillId: "skill-1",
          platformNames: ["OpenAI"],
        },
      });
    });

    await waitFor(() => {
      expect(
        invokeMock.mock.calls.filter(([command]) => command === "get_skill_platform_releases").length,
      ).toBeGreaterThan(1);
    });
  });

  it("shows the team baseline relative to the local latest snapshot", async () => {
    render(<VersionHistoryPanel />);

    fireEvent.click(screen.getByRole("tab", { name: /团队交付/ }));

    await waitFor(() => {
      expect(screen.getByText("待审当前版本")).toBeTruthy();
    });
    expect(screen.getByText("当前承接")).toBeTruthy();
    expect(screen.getByText("待审队列")).toBeTruthy();
    expect(screen.getByText("当前版本已进入 1 个团队待审")).toBeTruthy();
  });

  it("disables team delivery when there is no team available", async () => {
    Object.assign(teamContextMock, {
      teams: [],
      selectedTeamId: null,
      submissions: [],
    });
    teamDeliveryOverviewMock = {
      deliveries: [],
      recentRecords: [],
    };

    render(<VersionHistoryPanel />);
    fireEvent.click(screen.getByRole("tab", { name: /团队交付/ }));

    await waitFor(() => {
      expect(screen.getByText("当前还没有可交付团队")).toBeTruthy();
    });
    expect((screen.getByRole("button", { name: "交付到团队" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
