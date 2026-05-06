/** @vitest-environment jsdom */
import { forwardRef, useImperativeHandle, type ForwardedRef } from "react";
import { render, screen, cleanup, waitFor, fireEvent, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { SkillDetailWorkspacePage } from "@/features/skills/pages/SkillDetailWorkspacePage";
import type { PlatformConnection } from "@/types/skill";

const selectSkillMock = vi.fn();
const loadSnapshotsMock = vi.fn();
const loadSubmissionsMock = vi.fn();
const getPlatformConnectionsMock = vi.fn<() => Promise<PlatformConnection[]>>(async () => []);
const listSkillFilesMock = vi.fn(async (_skillId?: string) => ({
  name: "root",
  path: "",
  isDir: true,
  children: [
    { name: "SKILL.md", path: "SKILL.md", isDir: false, children: [] },
    { name: "README.md", path: "README.md", isDir: false, children: [] },
    {
      name: "docs",
      path: "docs",
      isDir: true,
      children: [{ name: "voice.md", path: "docs/voice.md", isDir: false, children: [] }],
    },
  ],
}));
const listSkillSourcesMock = vi.fn(async (_skillId?: string) => [
  {
    id: "source-1",
    skillId: "skill-1",
    sourceType: "local",
    sourceLabel: "本地目录导入",
    sourceRef: null,
    sourcePath: "D:/skills/writing-assistant",
    metadataJson: null,
    isPrimary: true,
    createdAt: 10,
    updatedAt: 20,
  },
]);
const fileExplorerHandleMock = {
  hasUnsavedChanges: vi.fn(() => false),
  saveChanges: vi.fn(async () => true),
  discardChanges: vi.fn(),
};

const skillContextMock = {
  selectedSkillId: null,
  skills: [
    {
      id: "skill-1",
      name: "Writing Assistant",
      slug: "writing-assistant",
      description: "Help draft product copy",
      sourceType: "local",
      createdAt: 10,
      updatedAt: 20,
      isArchived: false,
    },
  ],
  changeStatusMap: {
    "skill-1": {
      hasChanges: true,
      addedFiles: [],
      deletedFiles: [],
      modifiedFiles: ["README.md", "docs/voice.md"],
    },
  },
  selectSkill: selectSkillMock,
  importSkill: vi.fn(),
  createSkill: vi.fn(),
  deleteSkill: vi.fn(),
  loadSkills: vi.fn(),
  loadChangeStatuses: vi.fn(),
  loading: false,
  error: null,
};

const snapshotContextMock = {
  loadSnapshots: loadSnapshotsMock,
  snapshots: [] as Array<{
    id: string;
    skillId: string;
    snapshotNumber: number;
    snapshotPath: string;
    revisionHash: string;
    changeSummary?: string;
    createdAt: number;
    isCurrent: boolean;
    isActive: boolean;
  }>,
  loading: false,
  diffLoading: false,
  diffResult: null,
  selectedSnapshotIds: null,
  createSnapshotUiFeedback: null,
  browseRefreshToken: 0,
  createSnapshot: vi.fn(),
  restoreSnapshot: vi.fn(),
  deleteSnapshot: vi.fn(),
  selectForDiff: vi.fn(),
  clearDiff: vi.fn(),
  computeDiff: vi.fn(),
  setActiveSnapshot: vi.fn(),
  clearCreateSnapshotUiFeedback: vi.fn(),
};

const teamContextMock = {
  teams: [
    {
      id: "team-1",
      name: "Alpha Team",
      description: "Core reviewers",
      createdAt: 1,
    },
  ],
  selectedTeamId: "team-1",
  teamSkills: [],
  members: [],
  submissions: [] as Array<{
    id: string;
    teamId: string;
    teamSkillId?: string;
    sourceSkillId: string;
    sourceSnapshotId: string;
    submitter: string;
    submitMessage?: string;
    submittedAt: number;
    status: "pending" | "merged" | "rejected";
    resolvedAt?: number;
  }>,
  versionsByTeamSkillId: {},
  loading: false,
  loadTeams: vi.fn(),
  selectTeam: vi.fn(),
  createTeam: vi.fn(),
  loadTeamSkills: vi.fn(),
  loadMembers: vi.fn(),
  loadSubmissions: loadSubmissionsMock,
  loadVersions: vi.fn(),
  loadSubmissionDiff: vi.fn(),
  loadSubmissionMergePreview: vi.fn(),
  loadVersionDiff: vi.fn(),
  listTeamVersionFiles: vi.fn(),
  readTeamVersionFile: vi.fn(),
  checkPullImpact: vi.fn(),
  submitToTeam: vi.fn(),
  mergeSubmission: vi.fn(),
  rejectSubmission: vi.fn(),
  pullTeamVersion: vi.fn(),
  setRecommendedVersion: vi.fn(),
};

vi.mock("@/features/skills/state/SkillContext", () => ({
  useSkillContext: () => skillContextMock,
}));

vi.mock("@/features/skills/components/FileExplorerPanel", () => ({
  FileExplorerPanel: forwardRef(
    (
      { selectedFile }: { selectedFile: string | null },
      ref: ForwardedRef<{
        hasUnsavedChanges: () => boolean;
        saveChanges: () => Promise<boolean>;
        discardChanges: () => void;
      }>,
    ) => {
      useImperativeHandle(ref, () => fileExplorerHandleMock);

      return (
        <div>
          <span>FileExplorerPanel</span>
          <span>{selectedFile ?? "no-file-selected"}</span>
        </div>
      );
    },
  ),
}));

vi.mock("@/features/snapshots/components/VersionHistoryPanel", () => ({
  VersionHistoryPanel: () => <div>VersionHistoryPanel</div>,
}));

vi.mock("@/features/snapshots/state/SnapshotContext", () => ({
  useSnapshotContext: () => snapshotContextMock,
}));

vi.mock("@/features/teams/state/TeamContext", () => ({
  useTeamContext: () => teamContextMock,
}));

vi.mock("@/features/platforms/api/platformsApi", () => ({
  listPlatformConnections: () => getPlatformConnectionsMock(),
}));

vi.mock("@/features/skills/api/skillsApi", () => ({
  listSkillFiles: (skillId: string) => listSkillFilesMock(skillId),
  listSkillSources: (skillId: string) => listSkillSourcesMock(skillId),
  openSkillFolder: vi.fn(),
}));

describe("SkillDetailWorkspacePage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    selectSkillMock.mockReset();
    loadSnapshotsMock.mockReset();
    loadSubmissionsMock.mockReset();
    getPlatformConnectionsMock.mockClear();
    listSkillFilesMock.mockClear();
    listSkillSourcesMock.mockClear();
    fileExplorerHandleMock.hasUnsavedChanges.mockReset();
    fileExplorerHandleMock.hasUnsavedChanges.mockReturnValue(false);
    fileExplorerHandleMock.saveChanges.mockReset();
    fileExplorerHandleMock.saveChanges.mockResolvedValue(true);
    fileExplorerHandleMock.discardChanges.mockReset();

    Object.assign(skillContextMock, {
      selectedSkillId: null,
      changeStatusMap: {
        "skill-1": {
          hasChanges: true,
          addedFiles: [],
          deletedFiles: [],
          modifiedFiles: ["README.md", "docs/voice.md"],
        },
      },
    });

    Object.assign(snapshotContextMock, {
      snapshots: [],
      browseRefreshToken: 0,
      createSnapshotUiFeedback: null,
    });

    Object.assign(teamContextMock, {
      selectedTeamId: "team-1",
      submissions: [],
    });
  });

  it("renders the overview-first workspace route with fixed mode tabs", () => {
    render(
      <MemoryRouter initialEntries={["/workspace/skill-1"]}>
        <Routes>
          <Route path="/workspace/:skillId" element={<SkillDetailWorkspacePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("返回技能资产")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "概览" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "文件" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "版本" })).toBeTruthy();
  });

  it("renders the overview main stage as a condensed skill control board", async () => {
    Object.assign(snapshotContextMock, {
      snapshots: [
        {
          id: "snap-2",
          skillId: "skill-1",
          snapshotNumber: 2,
          snapshotPath: "snap-2",
          revisionHash: "rev-2",
          changeSummary: "统一概览文案",
          createdAt: Date.now(),
          isCurrent: false,
          isActive: true,
        },
      ],
    });

    getPlatformConnectionsMock.mockResolvedValue([
      {
        id: "platform-1",
        platformName: "Claude",
        detected: true,
        enabled: true,
        skillsDir: "/skills/claude",
      },
    ]);

    Object.assign(teamContextMock, {
      submissions: [
        {
          id: "submission-1",
          teamId: "team-1",
          sourceSkillId: "skill-1",
          sourceSnapshotId: "snap-2",
          submitter: "jensen",
          submitMessage: "请评审最新版本",
          submittedAt: Date.now() - 5000,
          status: "pending",
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/workspace/skill-1"]}>
        <Routes>
          <Route path="/workspace/:skillId" element={<SkillDetailWorkspacePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getAllByText("Writing Assistant").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("概览顶部摘要")).toBeTruthy();
    expect(screen.getByLabelText("概览状态总览")).toBeTruthy();
    expect(screen.getByLabelText("平台与动态")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "收口当前草稿" })).toBeTruthy();

    expect(await screen.findByText("2 个待入快照")).toBeTruthy();
    expect((await screen.findAllByText("已创建快照 v2")).length).toBeGreaterThan(0);
    expect(
      within(screen.getByLabelText("概览状态总览")).getByText("当前工作仍停留在本地文件区，建议从 SKILL.md 继续收口。"),
    ).toBeTruthy();

    await waitFor(() => {
      expect(selectSkillMock).toHaveBeenCalledWith("skill-1");
      expect(loadSnapshotsMock).toHaveBeenCalledWith("skill-1");
      expect(listSkillFilesMock).toHaveBeenCalledWith("skill-1");
      expect(listSkillSourcesMock).toHaveBeenCalledWith("skill-1");
    });
  });

  it("routes overview actions into files and preserves the selected recommendation", async () => {
    render(
      <MemoryRouter initialEntries={["/workspace/skill-1"]}>
        <Routes>
          <Route path="/workspace/:skillId" element={<SkillDetailWorkspacePage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(within(screen.getByLabelText("概览状态总览")).getByRole("button", { name: /工作区/ }));
    expect(screen.getByText("FileExplorerPanel")).toBeTruthy();
    expect(screen.getByText("README.md")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "概览" }));
    fireEvent.click(within(screen.getByLabelText("概览状态总览")).getByRole("button", { name: /工作区/ }));

    expect(screen.getByText("FileExplorerPanel")).toBeTruthy();
    expect(screen.getByText("README.md")).toBeTruthy();
  });

  it("routes overview risk actions into versions without touching files internals", () => {
    render(
      <MemoryRouter initialEntries={["/workspace/skill-1"]}>
        <Routes>
          <Route path="/workspace/:skillId" element={<SkillDetailWorkspacePage />} />
        </Routes>
      </MemoryRouter>,
    );

    const overviewActions = screen.getByRole("group", { name: "概览主操作" });
    fireEvent.click(within(overviewActions).getByRole("button", { name: "创建首个快照" }));

    expect(screen.getByText("VersionHistoryPanel")).toBeTruthy();
    expect(screen.queryByText("FileExplorerPanel")).toBeNull();
  });

  it("routes from overview structural modules into the corresponding task area", () => {
    render(
      <MemoryRouter initialEntries={["/workspace/skill-1"]}>
        <Routes>
          <Route path="/workspace/:skillId" element={<SkillDetailWorkspacePage />} />
        </Routes>
      </MemoryRouter>,
    );

    const lifecycle = screen.getByLabelText("概览状态总览");

    fireEvent.click(within(lifecycle).getByRole("button", { name: /工作区/ }));
    expect(screen.getByText("FileExplorerPanel")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "概览" }));
    const activeVersionRow = within(screen.getByLabelText("概览状态总览"))
      .getAllByRole("button")
      .find((button) => within(button).queryByText("当前版本"));

    expect(activeVersionRow).toBeTruthy();
    fireEvent.click(activeVersionRow as HTMLElement);
    expect(screen.getByText("VersionHistoryPanel")).toBeTruthy();
  });

  it("guards tab navigation when leaving Files with unsaved changes", async () => {
    fileExplorerHandleMock.hasUnsavedChanges.mockReturnValue(true);

    render(
      <MemoryRouter initialEntries={["/workspace/skill-1"]}>
        <Routes>
          <Route path="/workspace/:skillId" element={<SkillDetailWorkspacePage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(within(screen.getByLabelText("概览状态总览")).getByRole("button", { name: /工作区/ }));
    expect(screen.getByText("FileExplorerPanel")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "概览" }));
    expect(screen.getByText("当前文件有未保存更改")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "保存后继续" }));

    await waitFor(() => {
      expect(fileExplorerHandleMock.saveChanges).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("heading", { name: "创建首个快照" })).toBeTruthy();
    });
  });

  it("guards back navigation and supports discarding the current draft", async () => {
    fileExplorerHandleMock.hasUnsavedChanges.mockReturnValue(true);

    render(
      <MemoryRouter initialEntries={["/workspace/skill-1"]}>
        <Routes>
          <Route path="/workspace" element={<div>WorkspacePage</div>} />
          <Route path="/workspace/:skillId" element={<SkillDetailWorkspacePage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(within(screen.getByLabelText("概览状态总览")).getByRole("button", { name: /工作区/ }));
    expect(screen.getByText("FileExplorerPanel")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "返回技能资产" }));
    expect(screen.getByText("当前文件有未保存更改")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "放弃更改" }));

    await waitFor(() => {
      expect(fileExplorerHandleMock.discardChanges).toHaveBeenCalledTimes(1);
      expect(screen.getByText("WorkspacePage")).toBeTruthy();
    });
  });
});
