import { describe, expect, it } from "vitest";
import type { PlatformConnection, PlatformGovernanceImpact } from "@/types/skill";
import {
  buildPlatformDraft,
  buildPlatformDrafts,
  buildPlatformViewDefinitions,
  comparePlatforms,
  formatAffectedProjects,
  formatLastSync,
  getPlatformBucket,
  getPlatformGovernanceNote,
  getPlatformsCopy,
  getProjectScopeLabel,
  getProjectScopeTone,
  getStateLabel,
  getStateTone,
  getSyncModeLabel,
  getSyncModeOptions,
  matchesPlatformSearch,
  matchesPlatformView,
  normalizePlatformKeyInput,
  resolveSupportedSyncMode,
  upsertPlatformConnection,
} from "./platformPresentation";

function createPlatform(options?: Partial<PlatformConnection>): PlatformConnection {
  return {
    id: "platform-1",
    platformName: "claude",
    displayName: "Claude",
    platformType: "built_in",
    detected: true,
    enabled: true,
    skillsDir: "D:\\Claude\\skills",
    syncMode: "copy",
    supportsProjectScope: true,
    supportsCopy: true,
    supportsSymlink: true,
    ...options,
  };
}

function createImpact(options?: Partial<PlatformGovernanceImpact>): PlatformGovernanceImpact {
  return {
    platformName: "claude",
    displayName: "Claude",
    globalReleaseCount: 0,
    projectConnectionCount: 0,
    enabledProjectConnectionCount: 0,
    assignmentCount: 0,
    enabledAssignmentCount: 0,
    affectedProjects: [],
    ...options,
  };
}

describe("platform presentation copy", () => {
  it("returns localized labels and stable view order", () => {
    expect(getPlatformsCopy("zh-CN").heroTitle).toBe("平台中心");
    expect(getPlatformsCopy("en-US").heroTitle).toBe("Platform Center");
    expect(buildPlatformViewDefinitions("zh-CN").map((view) => view.key)).toEqual([
      "all",
      "enabled",
      "detected",
      "catalog",
      "custom",
    ]);
  });

  it("normalizes platform keys conservatively", () => {
    expect(normalizePlatformKeyInput(" Internal-Agent.Platform 01 ")).toBe("internal_agent_platform_01");
    expect(normalizePlatformKeyInput("平台 @ Agent")).toBe("__agent");
  });
});

describe("platform sync draft presentation", () => {
  it("resolves unsupported sync modes to the nearest supported option", () => {
    expect(resolveSupportedSyncMode("symlink", true, true)).toBe("symlink");
    expect(resolveSupportedSyncMode("symlink", true, false)).toBe("copy");
    expect(resolveSupportedSyncMode("copy", false, true)).toBe("symlink");
    expect(resolveSupportedSyncMode(undefined, false, false)).toBe("copy");
  });

  it("builds drafts and sync mode options from platform capabilities", () => {
    expect(buildPlatformDraft(createPlatform({ enabled: false, skillsDir: undefined }))).toEqual({
      enabled: false,
      skillsDir: "",
      syncMode: "copy",
    });
    expect(buildPlatformDrafts([createPlatform({ platformName: "claude" })])).toHaveProperty("claude");
    expect(getSyncModeOptions({ supportsCopy: false, supportsSymlink: true }, "zh-CN")).toEqual([
      { value: "symlink", label: "软链接" },
    ]);
    expect(getSyncModeLabel("symlink", "en-US")).toBe("Symlink Sync");
    expect(formatLastSync(undefined, "zh-CN")).toBe("暂无");
  });
});

describe("platform filtering and ordering", () => {
  it("classifies platforms into view buckets", () => {
    expect(getPlatformBucket(createPlatform())).toBe("enabled");
    expect(getPlatformBucket(createPlatform({ enabled: false }))).toBe("detected");
    expect(getPlatformBucket(createPlatform({ detected: false, enabled: false }))).toBe("catalog");
    expect(getPlatformBucket(createPlatform({ platformType: "custom", detected: false }))).toBe("custom");
  });

  it("matches search and view filters without hiding blank queries", () => {
    const platform = createPlatform({ platformName: "internal_agent", displayName: "Internal Agent" });

    expect(matchesPlatformSearch(platform, "")).toBe(true);
    expect(matchesPlatformSearch(platform, "agent")).toBe(true);
    expect(matchesPlatformSearch(platform, "missing")).toBe(false);
    expect(matchesPlatformView(platform, "enabled")).toBe(true);
    expect(matchesPlatformView(platform, "custom")).toBe(false);
  });

  it("sorts by operational bucket before localized name", () => {
    const platforms = [
      createPlatform({ platformName: "z_catalog", displayName: "Zed", detected: false, enabled: false }),
      createPlatform({ platformName: "b_enabled", displayName: "Bravo" }),
      createPlatform({ platformName: "a_enabled", displayName: "Alpha" }),
    ].sort((left, right) => comparePlatforms(left, right, "en-US"));

    expect(platforms.map((platform) => platform.platformName)).toEqual(["a_enabled", "b_enabled", "z_catalog"]);
  });
});

describe("platform state and governance labels", () => {
  it("derives state labels and tones from detection and enablement", () => {
    expect(getStateTone(createPlatform({ platformType: "custom" }))).toBe("info");
    expect(getStateTone(createPlatform())).toBe("success");
    expect(getStateTone(createPlatform({ enabled: false }))).toBe("warning");
    expect(getStateTone(createPlatform({ detected: false, enabled: false }))).toBe("muted");
    expect(getStateLabel(createPlatform({ detected: false, enabled: false }), "zh-CN")).toBe("未安装");
  });

  it("derives project scope labels, tones, and governance notes", () => {
    expect(getProjectScopeLabel(createPlatform(), "zh-CN")).toBe("可接入项目空间");
    expect(getProjectScopeTone(createPlatform({ enabled: false }))).toBe("warning");
    expect(getPlatformGovernanceNote(createPlatform({ supportsProjectScope: false }), "zh-CN")).toBe(
      "当前仅参与全局承接，不进入项目空间。",
    );
    expect(getPlatformGovernanceNote(createPlatform({ detected: false, enabled: false }), "en-US")).toBe(
      "No platform directory is detected yet. Configure a valid path before enabling it.",
    );
  });
});

describe("platform collection helpers", () => {
  it("upserts by platform name", () => {
    const platforms = [
      createPlatform({ platformName: "claude", displayName: "Claude" }),
      createPlatform({ platformName: "codex", displayName: "Codex" }),
    ];
    const next = upsertPlatformConnection(
      platforms,
      createPlatform({ platformName: "claude", displayName: "Claude Updated" }),
    );

    expect(next).toHaveLength(2);
    expect(next.find((platform) => platform.platformName === "claude")?.displayName).toBe("Claude Updated");
  });

  it("formats affected project summaries with overflow count", () => {
    expect(
      formatAffectedProjects(createImpact(), "无"),
    ).toBe("无");
    expect(
      formatAffectedProjects(
        createImpact({
          affectedProjects: ["项目一", "项目二"],
          projectConnectionCount: 3,
        }),
        "无",
      ),
    ).toBe("项目一 · 项目二 等 3 个项目");
  });
});
