import { describe, expect, it } from "vitest";
import type { SkillSnapshot } from "@/types/skill";
import {
  formatFileCount,
  getSnapshotStateLabel,
  getVersionDetailCopy,
  getWorkspaceRelationLabel,
} from "./versionDetailPresentation";

function createSnapshot(overrides: Partial<SkillSnapshot>): SkillSnapshot {
  return {
    id: "snap-1",
    skillId: "skill-1",
    snapshotNumber: 1,
    snapshotPath: "snap-1",
    revisionHash: "rev-1",
    source: "manual",
    createdAt: 1,
    isCurrent: false,
    isActive: false,
    ...overrides,
  };
}

describe("versionDetailPresentation", () => {
  it("formats changed file counts", () => {
    expect(formatFileCount(1, "en-US")).toBe("1 file");
    expect(formatFileCount(2, "en-US")).toBe("2 files");
    expect(formatFileCount(2, "zh-CN")).toBe("2 个");
  });

  it("keeps version detail copy in the presentation model", () => {
    const zhCopy = getVersionDetailCopy("zh-CN");
    const enCopy = getVersionDetailCopy("en-US");

    expect(zhCopy.workspace).toBe("工作区");
    expect(enCopy.workspace).toBe("Workspace");
    expect(zhCopy.baselineLatest(2)).toBe("最新快照 v2");
    expect(enCopy.workspaceDescriptionWithChanges(1)).toBe(
      "1 files are still in draft state and have not entered the latest snapshot.",
    );
  });

  it("labels snapshot state from source, active, and latest relations", () => {
    const latestSnapshot = createSnapshot({ id: "snap-2", snapshotNumber: 2 });

    expect(getSnapshotStateLabel(createSnapshot({ source: "system" }), latestSnapshot, "zh-CN")).toBe("系统恢复点");
    expect(getSnapshotStateLabel({ ...latestSnapshot, isActive: true }, latestSnapshot, "en-US")).toBe("Active · Captured");
    expect(getSnapshotStateLabel(createSnapshot({ isActive: true }), latestSnapshot, "zh-CN")).toBe("生效中");
    expect(getSnapshotStateLabel(latestSnapshot, latestSnapshot, "zh-CN")).toBe("已入快照");
    expect(getSnapshotStateLabel(createSnapshot({ id: "snap-3" }), latestSnapshot, "en-US")).toBe("Stable Version");
  });

  it("describes workspace relation against system, latest, active, and history snapshots", () => {
    const latestSnapshot = createSnapshot({ id: "snap-2", snapshotNumber: 2 });
    const activeSnapshot = createSnapshot({ id: "snap-1", isActive: true });

    expect(getWorkspaceRelationLabel(createSnapshot({ source: "system" }), latestSnapshot, activeSnapshot, false, "zh-CN"))
      .toBe("仅用于恢复当前工作副本，不参与正式版本链路");
    expect(getWorkspaceRelationLabel(latestSnapshot, latestSnapshot, activeSnapshot, true, "en-US"))
      .toBe("The workspace has diverged from this version.");
    expect(getWorkspaceRelationLabel(activeSnapshot, latestSnapshot, activeSnapshot, false, "zh-CN"))
      .toBe("工作区当前与此发布基线一致");
    expect(getWorkspaceRelationLabel(createSnapshot({ id: "snap-3" }), latestSnapshot, activeSnapshot, false, "en-US"))
      .toBe("The workspace is no longer staying on this historical version.");
  });
});
