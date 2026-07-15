/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileExplorerPanel } from "@/features/skills/components/FileExplorerPanel";

const invokeMock = vi.fn();
const loadChangeStatuses = vi.fn(async () => {});

const skillContextMock = {
  selectedSkillId: "skill-1",
  skills: [
    {
      id: "skill-1",
      name: "roll-dice",
      slug: "roll-dice",
      description: "Dice generator",
      sourceType: "local",
      createdAt: 0,
      updatedAt: 0,
      isArchived: false,
    },
  ],
  changeStatusMap: {
    "skill-1": {
      hasChanges: true,
      addedFiles: [],
      deletedFiles: [],
      modifiedFiles: ["SKILL.md", "README.md", "docs/voice.md"],
    },
  },
  loadChangeStatuses,
};

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@/features/skills/state/SkillContext", () => ({
  useSkillContext: () => skillContextMock,
}));

vi.mock("@/features/snapshots/state/SnapshotContext", () => ({
  useSnapshotContext: () => ({
    snapshots: [
      {
        id: "snapshot-6",
        skillId: "skill-1",
        snapshotNumber: 6,
        snapshotPath: "snapshots/6",
        revisionHash: "rev-6",
        createdAt: 0,
        isCurrent: false,
        isActive: true,
      },
    ],
  }),
}));

describe("FileExplorerPanel", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    loadChangeStatuses.mockClear();
    window.sessionStorage.clear();

    Object.assign(skillContextMock, {
      selectedSkillId: "skill-1",
      changeStatusMap: {
        "skill-1": {
          hasChanges: true,
          addedFiles: [],
          deletedFiles: [],
          modifiedFiles: ["SKILL.md", "README.md", "docs/voice.md"],
        },
      },
    });

    invokeMock.mockImplementation((command: string) => {
      if (command === "list_skill_files") {
        return Promise.resolve({
          name: "root",
          path: "",
          isDir: true,
          children: [
            {
              name: "SKILL.md",
              path: "SKILL.md",
              isDir: false,
              children: [],
            },
            {
              name: "README.md",
              path: "README.md",
              isDir: false,
              children: [],
            },
            {
              name: "docs",
              path: "docs",
              isDir: true,
              children: [
                {
                  name: "voice.md",
                  path: "docs/voice.md",
                  isDir: false,
                  children: [],
                },
              ],
            },
          ],
        });
      }

      if (command === "read_skill_file") {
        return Promise.resolve("---\nname: roll-dice\nversion: 1.0");
      }

      if (command === "diff_working_directory") {
        return Promise.resolve({
          addedFiles: [],
          deletedFiles: [],
          modifiedFiles: ["SKILL.md"],
          textDiffs: {
            "SKILL.md": {
              filePath: "SKILL.md",
              unifiedDiff: "@@ -1 +1 @@",
              oldLines: 1,
              newLines: 1,
            },
          },
        });
      }

      return Promise.resolve(null);
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the direct files navigation with minimal empty state", async () => {
    const onOpenVersions = vi.fn();
    render(
      <FileExplorerPanel
        selectedFile={null}
        onFileSelect={vi.fn()}
        browseRefreshToken={0}
        onOpenVersions={onOpenVersions}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("完整文件树")).toBeTruthy();
    });

    expect(screen.getByRole("button", { name: "全部文件" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "仅未入快照文件" })).toBeTruthy();
    expect(screen.getAllByText("SKILL.md").length).toBeGreaterThan(0);
    expect(screen.getAllByText("README.md").length).toBeGreaterThan(0);
    expect(screen.getAllByText("修改").length).toBeGreaterThan(0);
    expect(screen.queryByText("草稿中 · 3 个未入快照文件 · 3 个文件")).toBeNull();
    expect(screen.getByText("从左侧选择文件查看")).toBeTruthy();
    expect(screen.getByText("当前改动尚未进入快照")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "前往版本页处理" }));
    expect(onOpenVersions).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("重点入口")).toBeNull();
    expect(screen.queryByText("最近变更")).toBeNull();
    expect(screen.queryByText("推荐起点")).toBeNull();
  });

  it("restores the last session file context when no file is selected", async () => {
    window.sessionStorage.setItem(
      "skill-studio.file-workspace.session",
      JSON.stringify({
        "skill-1": {
          selectedFile: "README.md",
          scrollPositions: {
            "README.md": 84,
          },
        },
      }),
    );

    const onFileSelect = vi.fn();
    render(<FileExplorerPanel selectedFile={null} onFileSelect={onFileSelect} browseRefreshToken={0} />);

    await waitFor(() => {
      expect(onFileSelect).toHaveBeenCalledWith("README.md");
    });
  });

  it("requests leave protection before switching files when there are unsaved changes", async () => {
    const onFileSelect = vi.fn();
    const onRequestNavigateAway = vi.fn();

    render(
      <FileExplorerPanel
        selectedFile="SKILL.md"
        onFileSelect={onFileSelect}
        browseRefreshToken={0}
        onRequestNavigateAway={onRequestNavigateAway}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "编辑" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    fireEvent.change(screen.getByRole("textbox", { name: "编辑 SKILL.md" }), {
      target: { value: "---\nname: roll-dice\nversion: 2.0" },
    });

    fireEvent.click(screen.getAllByText("README.md")[0].closest("button")!);

    expect(onRequestNavigateAway).toHaveBeenCalledTimes(1);
    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it("keeps direct file actions in the content toolbar and opens inline diff view", async () => {
    render(<FileExplorerPanel selectedFile="SKILL.md" onFileSelect={vi.fn()} browseRefreshToken={0} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "编辑" })).toBeTruthy();
    });

    expect(screen.getByText("未入快照")).toBeTruthy();
    expect(screen.getByText("3 行")).toBeTruthy();
    expect(screen.queryByText("相对最新快照 v6，当前文件仍处于草稿态，共 3 行。")).toBeNull();
    expect(screen.getByRole("button", { name: "外部编辑" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "查看变更" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "打开目录" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "查看变更" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "返回文件视图" })).toBeTruthy();
    });
  });
});
