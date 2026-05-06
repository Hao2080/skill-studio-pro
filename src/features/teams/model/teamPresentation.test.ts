import { describe, expect, it } from "vitest";
import type { TeamActivityLog } from "@/types/team";
import {
  createEmptyMemberForm,
  DEFAULT_TEAM_ACTOR,
  formatTeamDate,
  getActivityActionLabel,
  getRoleLevel,
  getSubmissionStatusLabel,
  getTeamsCopy,
  MEMBER_STATUS_OPTIONS,
  ROLE_OPTIONS,
} from "./teamPresentation";

describe("team presentation constants", () => {
  it("keeps role and member status options in product order", () => {
    expect(DEFAULT_TEAM_ACTOR).toBe("jensen");
    expect(ROLE_OPTIONS).toEqual(["owner", "maintainer", "reviewer", "contributor", "viewer"]);
    expect(MEMBER_STATUS_OPTIONS).toEqual(["active", "invited", "disabled"]);
  });

  it("creates an empty member form with contributor defaults", () => {
    expect(createEmptyMemberForm()).toEqual({
      userName: "",
      email: "",
      role: "contributor",
      status: "active",
    });
  });
});

describe("team presentation labels", () => {
  it("maps role levels for permission checks", () => {
    expect(getRoleLevel("owner")).toBeGreaterThan(getRoleLevel("maintainer"));
    expect(getRoleLevel("maintainer")).toBeGreaterThan(getRoleLevel("reviewer"));
    expect(getRoleLevel("viewer")).toBe(0);
    expect(getRoleLevel()).toBe(0);
  });

  it("returns localized team copy", () => {
    expect(getTeamsCopy("zh-CN").tabs.submissions).toBe("变更请求");
    expect(getTeamsCopy("en-US").tabs.submissions).toBe("Change Requests");
  });

  it("maps submission status labels through the active copy", () => {
    const zhCopy = getTeamsCopy("zh-CN");
    const enCopy = getTeamsCopy("en-US");

    expect(getSubmissionStatusLabel("pending", zhCopy)).toBe("待处理");
    expect(getSubmissionStatusLabel("merged", enCopy)).toBe("Merged");
    expect(getSubmissionStatusLabel("withdrawn", zhCopy)).toBe("已撤回");
    expect(getSubmissionStatusLabel("rejected", enCopy)).toBe("Rejected");
  });

  it("maps known activity actions and preserves unknown actions", () => {
    const copy = getTeamsCopy("zh-CN");

    expect(getActivityActionLabel({ action: "merge_submission" } as TeamActivityLog, copy)).toBe("合并请求");
    expect(getActivityActionLabel({ action: "future_action" } as TeamActivityLog, copy)).toBe("future_action");
  });
});

describe("team presentation formatting", () => {
  it("formats dates with the requested locale", () => {
    const timestamp = Date.UTC(2026, 3, 29, 8, 30);

    expect(formatTeamDate(timestamp, "zh-CN")).toContain("2026");
    expect(formatTeamDate(timestamp, "en-US")).toContain("2026");
  });
});
