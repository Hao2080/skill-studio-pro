import { describe, expect, it } from "vitest";
import {
  buildVersionTimelineGroups,
  getCompareBaseLabel,
  getLatestTeamSnapshotId,
  getPlatformLabel,
  getSnapshotGroupTitle,
  getVersionDecisionKey,
  getVersionHistoryCopy,
  getWorkspaceBaseSummary,
} from "./versionHistoryPresentation";

describe("versionHistoryPresentation", () => {
  it("builds compare labels for empty and versioned bases", () => {
    expect(getCompareBaseLabel(null, "zh-CN")).toBe("未设置基准");
    expect(getCompareBaseLabel(null, "en-US")).toBe("No Base Set");
    expect(getCompareBaseLabel(12, "zh-CN")).toBe("v12");
  });

  it("uses platform display name when available", () => {
    expect(getPlatformLabel("github", " GitHub ")).toBe("GitHub");
    expect(getPlatformLabel("github", " ")).toBe("github");
    expect(getPlatformLabel("github")).toBe("github");
  });

  it("returns localized snapshot group titles", () => {
    expect(getSnapshotGroupTitle(false, "zh-CN")).toBe("正式版本");
    expect(getSnapshotGroupTitle(true, "zh-CN")).toBe("系统恢复点");
    expect(getSnapshotGroupTitle(false, "en-US")).toBe("Formal Versions");
    expect(getSnapshotGroupTitle(true, "en-US")).toBe("System Restore Points");
  });

  it("keeps version history copy localized with shared function signatures", () => {
    const zhCopy = getVersionHistoryCopy("zh-CN");
    const enCopy = getVersionHistoryCopy("en-US");

    expect(zhCopy.versionsTitle).toBe("版本管理");
    expect(enCopy.versionsTitle).toBe("Version Workbench");
    expect(zhCopy.workspaceDraftSummary(3)).toBe("3 个文件仍在草稿态");
    expect(enCopy.workspaceDraftSummary(3)).toBe("3 files are still in draft state");
    expect(zhCopy.releaseModalTitle(false, 2)).toBe("发布快照 v2");
    expect(enCopy.releaseModalTitle(true, 2)).toBe("Restore Point v2");
  });

  it("builds timeline groups and workspace baseline summaries", () => {
    const copy = getVersionHistoryCopy("zh-CN");
    const snapshot = {
      id: "snap-1",
      skillId: "skill-1",
      snapshotNumber: 1,
      snapshotPath: "snap-1",
      revisionHash: "rev-1",
      source: "manual",
      createdAt: 1,
      isCurrent: false,
      isActive: true,
    };
    const groups = buildVersionTimelineGroups({
      copy,
      language: "zh-CN",
      manualSnapshots: [snapshot],
      systemSnapshots: [],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe("正式版本");
    expect(
      getWorkspaceBaseSummary({
        copy,
        hasChanges: true,
        workspaceBaseSnapshot: snapshot,
        isSystemSnapshot: () => false,
      }),
    ).toBe("基于 v1 继续编辑");
  });

  it("derives team snapshot and stable decision keys", () => {
    expect(
      getLatestTeamSnapshotId({
        deliveries: [
          {
            teamId: "team-a",
            teamName: "Team A",
            pendingDelivery: {
              submissionId: "sub-1",
              teamId: "team-a",
              teamName: "Team A",
              sourceSnapshotId: "snap-2",
              sourceSnapshotNumber: 2,
              submittedAt: 20,
              submitter: "Jensen",
            },
          },
        ],
        recentRecords: [],
      }),
    ).toBe("snap-2");

    expect(
      getVersionDecisionKey({
        selectedSkillId: "skill-1",
        versionDecision: {
          status: "Stable",
          tone: "ready",
          title: "Ready",
          description: "Ready to release",
          primaryAction: { type: "open_release", label: "Open Release" },
        },
      }),
    ).toBe("skill-1|ready|Stable|Ready|Ready to release|open_release|");
  });
});
