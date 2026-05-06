import { describe, expect, it } from "vitest";
import type { SkillPlatformReleaseStatus, SkillSnapshot } from "@/types/skill";
import {
  formatPlatformCount,
  getPlatformLabel,
  getPlatformState,
  getPrimaryActionLabel,
  getRecordDetail,
  getRecordHeadline,
  getReleaseActionLabel,
  getReleaseStatusCopy,
} from "./releaseStatusPresentation";

const selectedSnapshot: SkillSnapshot = {
  id: "snap-2",
  skillId: "skill-1",
  snapshotNumber: 2,
  snapshotPath: "snap-2",
  revisionHash: "rev-2",
  changeSummary: "Latest Snapshot",
  source: "manual",
  createdAt: 1,
  isCurrent: false,
  isActive: true,
};

const readyRelease: SkillPlatformReleaseStatus = {
  platformName: "OpenAI",
  detected: true,
  enabled: true,
  skillsDir: "/skills/openai",
};

describe("releaseStatusPresentation", () => {
  it("formats platform count and platform names", () => {
    expect(formatPlatformCount(1, "en-US")).toBe("1 platform");
    expect(formatPlatformCount(2, "en-US")).toBe("2 platforms");
    expect(formatPlatformCount(2, "zh-CN")).toBe("2 个平台");
    expect(getPlatformLabel("openai", " OpenAI ")).toBe("OpenAI");
    expect(getPlatformLabel("openai", " ")).toBe("openai");
  });

  it("keeps release panel copy in the presentation model", () => {
    const zhCopy = getReleaseStatusCopy("zh-CN");
    const enCopy = getReleaseStatusCopy("en-US");

    expect(zhCopy.title).toBe("平台同步");
    expect(enCopy.title).toBe("Platform Sync");
    expect(zhCopy.currentVersionServedBy(2)).toBe("当前版本已承接到 2 个平台");
    expect(enCopy.otherVersionsServedBy(1)).toBe("1 platform still serves other versions and can be switched below.");
  });

  it("returns localized release action labels", () => {
    expect(getReleaseActionLabel("publish", "zh-CN")).toBe("发布");
    expect(getReleaseActionLabel("switch", "en-US")).toBe("Switch");
    expect(getReleaseActionLabel("unknown", "zh-CN")).toBe("同步");
  });

  it("builds primary action labels from publishability and current target", () => {
    expect(getPrimaryActionLabel(readyRelease, null, "zh-CN")).toBeNull();
    expect(getPrimaryActionLabel(readyRelease, { ...selectedSnapshot, source: "system" }, "zh-CN")).toBeNull();
    expect(getPrimaryActionLabel({ ...readyRelease, enabled: false }, selectedSnapshot, "zh-CN")).toBeNull();
    expect(getPrimaryActionLabel(readyRelease, selectedSnapshot, "en-US")).toBe("Sync This Version");
    expect(getPrimaryActionLabel({
      ...readyRelease,
      currentTarget: {
        platformName: "OpenAI",
        snapshotId: "snap-1",
        snapshotNumber: 1,
        releasedAt: 1,
      },
    }, selectedSnapshot, "zh-CN")).toBe("改发为此版本");
    expect(getPrimaryActionLabel({
      ...readyRelease,
      currentTarget: {
        platformName: "OpenAI",
        snapshotId: "snap-2",
        snapshotNumber: 2,
        releasedAt: 1,
      },
    }, selectedSnapshot, "en-US")).toBe("Republish");
  });

  it("describes platform state without requiring component render", () => {
    expect(getPlatformState({ ...readyRelease, detected: false }, selectedSnapshot, "zh-CN")).toMatchObject({
      tone: "warning",
      label: "未检测到",
    });
    expect(getPlatformState({ ...readyRelease, enabled: false }, selectedSnapshot, "en-US")).toMatchObject({
      tone: "neutral",
      label: "Connected but Disabled",
    });
    expect(getPlatformState(readyRelease, selectedSnapshot, "zh-CN")).toMatchObject({
      tone: "neutral",
      label: "待发布",
    });
    expect(getPlatformState({
      ...readyRelease,
      currentTarget: {
        platformName: "OpenAI",
        snapshotId: "snap-2",
        snapshotNumber: 2,
        releasedAt: 1,
      },
    }, selectedSnapshot, "en-US")).toMatchObject({
      tone: "ready",
      label: "Serving Current Version",
    });
  });

  it("builds release record headlines and details", () => {
    expect(getRecordHeadline({
      id: "record-1",
      platformName: "OpenAI",
      snapshotId: "snap-2",
      snapshotNumber: 2,
      action: "publish",
      status: "success",
      createdAt: 1,
    }, "en-US")).toBe("Publish · Success · v2");
    expect(getRecordDetail({
      id: "record-2",
      platformName: "OpenAI",
      action: "switch",
      status: "failed",
      errorMessage: "Path missing",
      createdAt: 1,
    }, "zh-CN")).toBe("Path missing");
    expect(getRecordDetail({
      id: "record-3",
      platformName: "OpenAI",
      action: "sync",
      status: "success",
      createdAt: 1,
    }, "zh-CN")).toBe("已写入平台同步记录。");
  });
});
