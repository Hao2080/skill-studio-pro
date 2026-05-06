import { describe, expect, it } from "vitest";
import {
  buildSyncActiveVersionMessage,
  getSyncPreconditionError,
  SET_ACTIVE_TOOLTIP_TEXT,
} from "@/features/snapshots/model/versionHistoryMessages";
import * as VersionHistoryMessages from "@/features/snapshots/model/versionHistoryMessages";

describe("versionHistoryMessages", () => {
  it("uses the exact set-active tooltip copy from the task list", () => {
    expect(SET_ACTIVE_TOOLTIP_TEXT).toBe("将此版本设为发布目标，不影响工作副本内容");
  });

  it("includes the active snapshot number in the sync confirmation message", () => {
    expect(buildSyncActiveVersionMessage(12)).toContain("将发布生效版本 v12 到平台");
  });

  it("requires an active snapshot before opening sync confirmation", () => {
    expect(getSyncPreconditionError(null)).toBe("没有当前生效版本，请先设置一个快照为生效版本");
    expect(getSyncPreconditionError(12)).toBeNull();
  });

  it("formats sync result summary and keeps it visible for 5 seconds", () => {
    const helper = (VersionHistoryMessages as Record<string, unknown>).buildSyncResultSummary;
    const duration = (VersionHistoryMessages as Record<string, unknown>).SYNC_RESULT_FEEDBACK_DURATION_MS;

    expect(typeof helper).toBe("function");
    expect(duration).toBe(5000);

    if (typeof helper === "function") {
      expect(helper({ success: 2, failed: 1 })).toBe("发布结果：成功 2 个 / 失败 1 个");
      expect(helper({ success: 3, failed: 0 })).toBe("发布结果：成功 3 个 / 失败 0 个");
    }
  });
});
