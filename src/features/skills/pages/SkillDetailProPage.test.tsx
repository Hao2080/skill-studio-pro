/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SkillDetailProPage, type SkillDetailDependencies } from "./SkillDetailProPage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SkillDetailProPage V1 cross-layer editor closure", () => {
  it("通过稳定 Skill ID 保存并刷新快照、diff、操作记录与映射", async () => {
    const detectDrift = vi.fn().mockResolvedValue([{
      skillId: "skill-1",
      platformName: "codex",
      snapshotId: "snapshot-1",
      targetPath: "C:/isolated/.codex/skills/demo",
      syncMode: "copy",
      driftStatus: "in_sync",
    }]);
    const listSnapshots = vi.fn().mockResolvedValue([{
      id: "snapshot-1",
      skillId: "skill-1",
      snapshotNumber: 1,
      snapshotPath: "snapshots/skill-1/1",
      revisionHash: "before-hash",
      source: "system",
      createdAt: 1,
      isCurrent: true,
      isActive: true,
    }]);
    const diffWorkingDirectory = vi.fn().mockResolvedValue({
      addedFiles: [],
      deletedFiles: [],
      modifiedFiles: ["SKILL.md"],
      textDiffs: {},
    });
    const listActivity = vi.fn().mockResolvedValue([]);
    const saveTextFile = vi.fn().mockResolvedValue({
      skillId: "skill-1",
      relativePath: "SKILL.md",
      beforeHash: "before-hash",
      afterHash: "after-hash",
      recoverySnapshotId: "recovery-1",
      recoveryPointCreated: true,
      outdatedMappingCount: 1,
    });
    const dependencies = {
      inventory: {
        getInstance: vi.fn(),
        readInstanceFile: vi.fn(),
        recalculateOrigin: vi.fn(),
      },
      library: {
        get: vi.fn().mockResolvedValue({
          id: "skill-1",
          name: "Demo Skill",
          slug: "demo-skill",
          storageRelPath: "skills/demo-skill",
          storagePath: "C:/isolated/workspace/skills/demo-skill",
          description: "Demo description",
          activeContentHash: "before-hash",
          lifecycleState: "active",
          createdAt: 1,
          updatedAt: 2,
        }),
        detectDrift,
        createRegisterPlan: vi.fn(),
        executeRegisterPlan: vi.fn(),
        createPublishPlan: vi.fn(),
        executePublishPlan: vi.fn(),
      },
      lifecycle: { saveTextFile },
      ai: {
        listArtifacts: vi.fn().mockResolvedValue([]),
        listProviders: vi.fn().mockResolvedValue([]),
        listTaskRoutes: vi.fn().mockResolvedValue([]),
        generateArtifact: vi.fn(),
        cancelArtifact: vi.fn(),
      },
      activity: { list: listActivity },
      readCentralFile: vi.fn().mockResolvedValue("# Demo"),
      listCentralFiles: vi.fn().mockResolvedValue({
        name: "demo-skill",
        path: "",
        isDir: true,
        children: [{ name: "SKILL.md", path: "SKILL.md", isDir: false, children: [] }],
      }),
      listSnapshots,
      diffWorkingDirectory,
      openCentralFile: vi.fn(),
    } as unknown as SkillDetailDependencies;
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <MemoryRouter initialEntries={["/library/skill-1"]}>
        <Routes>
          <Route path="/library/:skillId" element={<SkillDetailProPage dependencies={dependencies} />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Demo Skill" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "SKILL.md" }));
    fireEvent.click(screen.getByRole("button", { name: "进入编辑" }));
    fireEvent.change(screen.getByLabelText("SKILL.md 编辑器"), {
      target: { value: "# Demo changed" },
    });

    fireEvent.click(screen.getByRole("tab", { name: "概览" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("SKILL.md 编辑器")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(saveTextFile).toHaveBeenCalledTimes(1));
    expect(saveTextFile).toHaveBeenCalledWith(expect.objectContaining({
      skillId: "skill-1",
      relativePath: "SKILL.md",
      content: "# Demo changed",
      editSessionId: expect.any(String),
    }));
    await waitFor(() => {
      expect(detectDrift.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(listSnapshots.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(diffWorkingDirectory.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(listActivity.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
