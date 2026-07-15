import { describe, expect, it } from "vitest";
import type { SkillSnapshot } from "@/types/skill";
import type { SkillTeamDeliveryStatus } from "@/types/team";
import {
  formatTeamCount,
  getCurrentTargetDetail,
  getDeliveryActionLabel,
  getPendingDetail,
  getPrimaryActionLabel,
  getRecordDetail,
  getRecordHeadline,
  getTeamDeliveryCopy,
  getTeamState,
} from "./teamDeliveryPresentation";

const selectedSnapshot: SkillSnapshot = {
  id: "snap-2",
  skillId: "skill-1",
  snapshotNumber: 2,
  snapshotPath: "snap-2",
  revisionHash: "rev-2",
  source: "manual",
  createdAt: 1,
  isCurrent: false,
  isActive: true,
};

const idleDelivery: SkillTeamDeliveryStatus = {
  teamId: "team-1",
  teamName: "Core Team",
};

const currentDelivery: SkillTeamDeliveryStatus = {
  ...idleDelivery,
  currentTarget: {
    teamId: "team-1",
    teamName: "Core Team",
    sourceSkillId: "skill-1",
    sourceSnapshotId: "snap-2",
    sourceSnapshotNumber: 2,
    changeSummary: "Latest Snapshot",
    teamVersionNumber: 3,
    deliveredAt: 1,
  },
};

const pendingDelivery: SkillTeamDeliveryStatus = {
  ...idleDelivery,
  pendingDelivery: {
    submissionId: "submission-1",
    teamId: "team-1",
    teamName: "Core Team",
    sourceSnapshotId: "snap-1",
    sourceSnapshotNumber: 1,
    submitter: "jensen",
    submitMessage: " Please review ",
    submittedAt: 1,
  },
};

describe("teamDeliveryPresentation", () => {
  it("formats team count and action labels", () => {
    expect(formatTeamCount(1, "en-US")).toBe("1 team");
    expect(formatTeamCount(2, "en-US")).toBe("2 teams");
    expect(formatTeamCount(2, "zh-CN")).toBe("2 个团队");
    expect(getDeliveryActionLabel("replace_pending", "zh-CN")).toBe("改交");
    expect(getDeliveryActionLabel("unknown", "en-US")).toBe("Record");
  });

  it("keeps delivery panel copy in the presentation model", () => {
    const zhCopy = getTeamDeliveryCopy("zh-CN");
    const enCopy = getTeamDeliveryCopy("en-US");

    expect(zhCopy.title).toBe("团队交付");
    expect(enCopy.title).toBe("Team Delivery");
    expect(zhCopy.currentVersionServedBy(2)).toBe("当前版本已被 2 个团队承接");
    expect(enCopy.teamsStayOnOtherFlows(1)).toBe("1 team is still on other versions or pending queues and can keep switching.");
  });

  it("builds primary action labels from current and pending deliveries", () => {
    expect(getPrimaryActionLabel(idleDelivery, null, "zh-CN")).toBeNull();
    expect(getPrimaryActionLabel(idleDelivery, { ...selectedSnapshot, source: "system" }, "zh-CN")).toBeNull();
    expect(getPrimaryActionLabel(idleDelivery, selectedSnapshot, "zh-CN")).toBe("交付此版本");
    expect(getPrimaryActionLabel(pendingDelivery, selectedSnapshot, "en-US")).toBe("Switch to This Version");
    expect(getPrimaryActionLabel({
      ...pendingDelivery,
      pendingDelivery: {
        ...pendingDelivery.pendingDelivery!,
        sourceSnapshotId: "snap-2",
        sourceSnapshotNumber: 2,
      },
    }, selectedSnapshot, "en-US")).toBe("Resubmit");
    expect(getPrimaryActionLabel(currentDelivery, selectedSnapshot, "zh-CN")).toBe("重新提交");
  });

  it("describes team delivery state across pending and serving cases", () => {
    expect(getTeamState(idleDelivery, selectedSnapshot, "en-US")).toMatchObject({
      tone: "neutral",
      label: "Not Serving",
    });
    expect(getTeamState(currentDelivery, selectedSnapshot, "zh-CN")).toMatchObject({
      tone: "ready",
      label: "承接当前版本",
    });
    expect(getTeamState(pendingDelivery, selectedSnapshot, "en-US")).toMatchObject({
      tone: "active",
      label: "Pending v1",
    });
    expect(getTeamState(pendingDelivery, null, "zh-CN")).toMatchObject({
      tone: "warning",
      label: "待审 v1",
    });
  });

  it("builds current, pending, and record details", () => {
    expect(getCurrentTargetDetail(currentDelivery, "en-US")).toBe("Team Version v3 · Latest Snapshot");
    expect(getCurrentTargetDetail(idleDelivery, "zh-CN")).toBe("当前团队还没有承接版本。");
    expect(getPendingDetail(pendingDelivery, "zh-CN")).toBe("jensen · Please review");
    expect(getPendingDetail(idleDelivery, "en-US")).toBe("There is no pending delivery.");
    expect(getRecordHeadline({
      id: "record-1",
      teamId: "team-1",
      teamName: "Core Team",
      sourceSkillId: "skill-1",
      sourceSnapshotId: "snap-2",
      sourceSnapshotNumber: 2,
      action: "merge",
      status: "success",
      createdAt: 1,
    }, "en-US")).toBe("Merge · Done · v2");
    expect(getRecordDetail({
      id: "record-2",
      teamId: "team-1",
      teamName: "Core Team",
      sourceSkillId: "skill-1",
      action: "merge",
      status: "success",
      teamVersionNumber: 3,
      createdAt: 1,
    }, "zh-CN")).toBe("已进入团队版本 v3。");
  });
});
