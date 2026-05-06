import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatSkillUpdatedAt, getSkillSourceTypeLabel, getWorkspaceStatusLabel } from "./detailWorkspace";

describe("detailWorkspace", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T12:00:00Z"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("生成工作副本状态文案", () => {
    expect(getWorkspaceStatusLabel(false, undefined)).toBe("未加载");
    expect(getWorkspaceStatusLabel(true, true)).toBe("有改动");
    expect(getWorkspaceStatusLabel(true, false)).toBe("已同步");
    expect(getWorkspaceStatusLabel(true, false, "en-US")).toBe("Synced");
    expect(getSkillSourceTypeLabel("git_repository", "en-US")).toBe("Repository Snapshot");
  });

  it("同年更新时间不显示年份，并兼容秒级时间戳", () => {
    const formatter = vi.spyOn(Date.prototype, "toLocaleString").mockImplementation((_locale, options) =>
      options?.year ? "2026年4月17日 18:30" : "4月17日 18:30",
    );

    expect(formatSkillUpdatedAt(1_776_427_200)).toBe("4月17日 18:30");
    expect(formatSkillUpdatedAt(1_776_427_200_000)).toBe("4月17日 18:30");
    expect(formatter).toHaveBeenLastCalledWith("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  });

  it("跨年更新时间显示年份", () => {
    const formatter = vi.spyOn(Date.prototype, "toLocaleString").mockImplementation((_locale, options) =>
      options?.year ? "2025年6月1日 12:00" : "6月1日 12:00",
    );

    expect(formatSkillUpdatedAt(1_748_779_200_000)).toBe("2025年6月1日 12:00");
    expect(formatter).toHaveBeenLastCalledWith("zh-CN", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  });

  it("缺失更新时间时返回未知", () => {
    expect(formatSkillUpdatedAt(null)).toBe("未知");
    expect(formatSkillUpdatedAt(null, "en-US")).toBe("Unknown");
  });

  it("英文环境使用英文区域格式", () => {
    const formatter = vi.spyOn(Date.prototype, "toLocaleString").mockImplementation(() => "4/17, 18:30");

    expect(formatSkillUpdatedAt(1_776_427_200_000, "en-US")).toBe("4/17, 18:30");
    expect(formatter).toHaveBeenLastCalledWith("en-US", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  });
});
