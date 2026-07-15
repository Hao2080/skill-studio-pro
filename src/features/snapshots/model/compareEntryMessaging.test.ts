import { describe, expect, it } from "vitest";
import { VERSION_HISTORY_EMPTY_DIFF_HINT } from "@/features/snapshots/model/workspaceTerminology";

describe("history compare entry messaging", () => {
  it("keeps the version history empty hint focused on timeline and workspace compare", () => {
    expect(VERSION_HISTORY_EMPTY_DIFF_HINT)
      .toBe("点击左侧时间轴选择两个版本，或先选旧版本后对比工作区。");
  });
});
