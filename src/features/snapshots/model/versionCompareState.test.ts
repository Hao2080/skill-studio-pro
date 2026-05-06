import { describe, it, expect } from "vitest";
import {
  WORKING_DIR_VALUE,
  EMPTY_COMPARE_STATE,
  applyTimelineClick,
  compareWithWorkspace,
  clearCompare,
  buildCompareLabels,
  type CompareState,
} from "@/features/snapshots/model/versionCompareState";
import type { SkillSnapshot } from "@/types/skill";

function makeSnap(id: string, num: number): SkillSnapshot {
  return {
    id,
    skillId: "skill-1",
    snapshotNumber: num,
    snapshotPath: `/tmp/${id}`,
    revisionHash: `${id}-hash`,
    source: "manual",
    createdAt: 0,
    isCurrent: false,
    isActive: false,
  };
}

const snapshots = [makeSnap("snap-3", 3), makeSnap("snap-2", 2), makeSnap("snap-1", 1)];

describe("applyTimelineClick", () => {
  it("首次点击时设为旧版本", () => {
    const result = applyTimelineClick(EMPTY_COMPARE_STATE, "snap-1");
    expect(result).toEqual({ baseSnapshotId: "snap-1", targetId: null });
  });

  it("已选旧版本时第二次点击设为新版本", () => {
    const state: CompareState = { baseSnapshotId: "snap-1", targetId: null };
    const result = applyTimelineClick(state, "snap-2");
    expect(result).toEqual({ baseSnapshotId: "snap-1", targetId: "snap-2" });
  });

  it("已选满两个后再次点击替换新版本", () => {
    const state: CompareState = { baseSnapshotId: "snap-1", targetId: "snap-2" };
    const result = applyTimelineClick(state, "snap-3");
    expect(result).toEqual({ baseSnapshotId: "snap-1", targetId: "snap-3" });
  });

  it("点击已选中的旧版本时取消，并保留已选新版本", () => {
    const state: CompareState = { baseSnapshotId: "snap-1", targetId: "snap-2" };
    const result = applyTimelineClick(state, "snap-1");
    expect(result).toEqual({ baseSnapshotId: null, targetId: "snap-2" });
  });

  it("点击已选中的新版本时取消", () => {
    const state: CompareState = { baseSnapshotId: "snap-1", targetId: "snap-2" };
    const result = applyTimelineClick(state, "snap-2");
    expect(result).toEqual({ baseSnapshotId: "snap-1", targetId: null });
  });

  it("新版本为工作区时点击快照替换工作区", () => {
    const state: CompareState = { baseSnapshotId: "snap-1", targetId: WORKING_DIR_VALUE };
    const result = applyTimelineClick(state, "snap-3");
    expect(result).toEqual({ baseSnapshotId: "snap-1", targetId: "snap-3" });
  });
});

describe("compareWithWorkspace", () => {
  it("已有旧版本时将新版本切换为工作区", () => {
    const state: CompareState = { baseSnapshotId: "snap-1", targetId: "snap-2" };
    expect(compareWithWorkspace(state)).toEqual({
      baseSnapshotId: "snap-1",
      targetId: WORKING_DIR_VALUE,
    });
  });

  it("未选旧版本时保持空状态", () => {
    expect(compareWithWorkspace(EMPTY_COMPARE_STATE)).toEqual(EMPTY_COMPARE_STATE);
  });
});

describe("clearCompare", () => {
  it("返回空状态", () => {
    expect(clearCompare()).toEqual(EMPTY_COMPARE_STATE);
  });
});

describe("buildCompareLabels", () => {
  it("两者都是快照时返回版本号标签", () => {
    const state: CompareState = { baseSnapshotId: "snap-1", targetId: "snap-2" };
    const { labelA, labelB } = buildCompareLabels(state, snapshots);
    expect(labelA).toBe("v1");
    expect(labelB).toBe("v2");
  });

  it("新版本为工作区时返回工作区标签", () => {
    const state: CompareState = { baseSnapshotId: "snap-1", targetId: WORKING_DIR_VALUE };
    const { labelA, labelB } = buildCompareLabels(state, snapshots);
    expect(labelA).toBe("v1");
    expect(labelB).toBe("工作区");
  });

  it("未选择时返回默认标签", () => {
    const { labelA, labelB } = buildCompareLabels(EMPTY_COMPARE_STATE, snapshots);
    expect(labelA).toBe("未选择");
    expect(labelB).toBe("未选择");
  });
});
