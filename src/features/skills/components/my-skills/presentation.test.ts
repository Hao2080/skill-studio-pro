import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatMySkillUpdatedAt } from "./presentation";

describe("mySkills presentation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T12:00:00Z"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("同年更新时间不显示年份", () => {
    const formatter = vi.spyOn(Date.prototype, "toLocaleString").mockImplementation((_locale, options) =>
      options?.year ? "2026年4月17日 18:30" : "4月17日 18:30",
    );

    expect(formatMySkillUpdatedAt(1_776_427_200_000)).toBe("4月17日 18:30");
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

    expect(formatMySkillUpdatedAt(1_748_779_200_000)).toBe("2025年6月1日 12:00");
    expect(formatter).toHaveBeenLastCalledWith("zh-CN", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  });

  it("英文环境使用英文区域格式", () => {
    const formatter = vi.spyOn(Date.prototype, "toLocaleString").mockImplementation(() => "4/17, 18:30");

    expect(formatMySkillUpdatedAt(1_776_427_200_000, "en-US")).toBe("4/17, 18:30");
    expect(formatter).toHaveBeenLastCalledWith("en-US", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  });
});
