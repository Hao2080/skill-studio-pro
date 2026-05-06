import { describe, expect, it } from "vitest";
import {
  LATEST_SNAPSHOT_LABEL,
  SYNC_TO_PLATFORM_LABEL,
  VERSION_HISTORY_EMPTY_DIFF_HINT,
} from "@/features/snapshots/model/workspaceTerminology";

describe("workspaceTerminology", () => {
  it("uses 最新快照 as the latest snapshot term", () => {
    expect(LATEST_SNAPSHOT_LABEL).toBe("最新快照");
  });

  it("uses 同步到平台 as the sync action term", () => {
    expect(SYNC_TO_PLATFORM_LABEL).toBe("同步到平台");
  });

  it("exports the simplified history empty hint", () => {
    expect(VERSION_HISTORY_EMPTY_DIFF_HINT).toBe("点击左侧时间轴选择两个版本，或先选旧版本后对比工作区。");
  });
});
