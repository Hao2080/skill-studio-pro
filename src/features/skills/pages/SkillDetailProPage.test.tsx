/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AntApp from "antd/es/app";
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
        createPublishPlan: vi.fn().mockResolvedValue({
          id: "publish-plan-1",
          skillId: "skill-1",
          snapshotId: "snapshot-1",
          sourcePath: "C:/isolated/workspace/snapshots/skill-1/1",
          sourceHash: "after-hash",
          targets: [{
            platformName: "codex",
            displayName: "Codex",
            targetPath: "C:/isolated/.codex/skills/demo-skill",
            syncMode: "symlink",
            driftStatus: "in_sync",
            driftPolicy: "abort",
            status: "ready",
            symlinkCapability: "supported",
          }],
          planHash: "publish-plan-hash",
          createdAt: 1,
          expiresAt: 2,
        }),
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
      trash: {
        createDeletePlan: vi.fn().mockResolvedValue({
          id: "delete-plan-1",
          skillId: "skill-1",
          displayName: "Demo Skill",
          originalPath: "C:/isolated/workspace/skills/demo-skill",
          sourceHash: "after-hash",
          fileCount: 2,
          totalBytes: 128,
          mappings: [{ platformName: "codex", targetPath: "C:/isolated/.codex/skills/demo", syncMode: "copy", snapshotId: "snapshot-1", driftStatus: "in_sync" }],
          sourcesJson: "[]",
          planHash: "delete-plan-hash",
          createdAt: 1,
          expiresAt: 2,
        }),
        executeDelete: vi.fn().mockResolvedValue({ id: "trash-1" }),
      },
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
    render(
      <AntApp>
        <MemoryRouter initialEntries={["/library/skill-1"]}>
          <Routes>
            <Route path="/library/:skillId" element={<SkillDetailProPage dependencies={dependencies} />} />
          </Routes>
        </MemoryRouter>
      </AntApp>,
    );

    expect(await screen.findByRole("heading", { name: "Demo Skill" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "SKILL.md" }));
    fireEvent.click(screen.getByRole("button", { name: "进入编辑" }));
    fireEvent.change(screen.getByLabelText("SKILL.md 编辑器"), {
      target: { value: "# Demo changed" },
    });

    fireEvent.click(screen.getByRole("tab", { name: "概览" }));
    expect(await screen.findByText("当前文件有未保存修改。离开后这些修改会丢失。")).toBeTruthy();
    expect(screen.getByLabelText("SKILL.md 编辑器")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "继续编辑" }));

    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(saveTextFile).toHaveBeenCalledTimes(1));
    expect(saveTextFile).toHaveBeenCalledWith(expect.objectContaining({
      skillId: "skill-1",
      relativePath: "SKILL.md",
      content: "# Demo changed",
      editSessionId: expect.any(String),
    }));
    expect(await screen.findByText("recovery-1")).toBeTruthy();
    expect(screen.getByText("before-hash")).toBeTruthy();
    expect(screen.getByText("after-hash")).toBeTruthy();
    expect(screen.getByText("过期映射")).toBeTruthy();
    await waitFor(() => {
      expect(detectDrift.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(listSnapshots.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(diffWorkingDirectory.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(listActivity.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    fireEvent.change(screen.getByLabelText("发布同步模式"), { target: { value: "symlink" } });
    fireEvent.click(screen.getByRole("button", { name: "创建发布计划" }));
    await waitFor(() => expect(dependencies.library.createPublishPlan).toHaveBeenCalledWith({
      skillId: "skill-1",
      snapshotId: "snapshot-1",
      targets: [{ platformName: "codex", syncMode: "symlink", driftPolicy: "abort" }],
    }));
    expect(await screen.findByText("Codex · symlink · in_sync · ready")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("漂移处理策略"), { target: { value: "overwrite" } });
    fireEvent.click(screen.getByRole("button", { name: "创建发布计划" }));
    await waitFor(() => expect(dependencies.library.createPublishPlan).toHaveBeenLastCalledWith({
      skillId: "skill-1",
      snapshotId: "snapshot-1",
      targets: [{ platformName: "codex", syncMode: "symlink", driftPolicy: "overwrite" }],
    }));

    fireEvent.click(screen.getByRole("button", { name: "移入回收站" }));
    expect(await screen.findByRole("heading", { name: "移入回收站影响确认" })).toBeTruthy();
    expect(screen.getByText("codex · copy · in_sync")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "确认移入回收站" }));
    await waitFor(() => expect(dependencies.trash.executeDelete).toHaveBeenCalledWith("delete-plan-1", "delete-plan-hash"));
  });
});
