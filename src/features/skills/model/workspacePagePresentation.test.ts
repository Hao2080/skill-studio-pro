import { describe, expect, it } from "vitest";
import {
  buildWorkspaceTagItems,
  buildWorkspaceTagUsageMap,
  getWorkspaceBatchCopy,
  getWorkspaceEmptyStateMode,
  getWorkspaceFilterSummary,
  getWorkspacePageCopy,
} from "./workspacePagePresentation";

describe("workspacePagePresentation", () => {
  it("builds localized batch and page copy", () => {
    const zhBatch = getWorkspaceBatchCopy("zh-CN", 3, 2);
    const enBatch = getWorkspaceBatchCopy("en-US", 3, 2);
    const zhPage = getWorkspacePageCopy("zh-CN");
    const enPage = getWorkspacePageCopy("en-US");

    expect(zhBatch.selected).toBe("已选 3 项技能");
    expect(enBatch.partialIncluded).toBe("Among them, 2 are in the current filtered results.");
    expect(zhPage.categoryCreated("工具")).toBe("已创建分类 工具");
    expect(enPage.deleteSkillContent("Parser")).toBe("Are you sure you want to delete Parser? This action cannot be undone.");
  });

  it("builds localized filter summaries", () => {
    expect(getWorkspaceFilterSummary("", [], "zh-CN")).toBeNull();
    expect(getWorkspaceFilterSummary(" api ", ["工具", "生产"], "zh-CN"))
      .toBe("筛选条件：关键词 \"api\" · 标签 工具、生产");
    expect(getWorkspaceFilterSummary("api", ["tool", "prod"], "en-US"))
      .toBe("Filters: keyword \"api\" · tags tool, prod");
  });

  it("derives empty state mode from filtered state", () => {
    expect(getWorkspaceEmptyStateMode(1, 3, "All", "", [])).toBeUndefined();
    expect(getWorkspaceEmptyStateMode(0, 0, "All", "", [])).toBe("no-skills");
    expect(getWorkspaceEmptyStateMode(0, 3, "Custom", "", [])).toBe("empty-category");
    expect(getWorkspaceEmptyStateMode(0, 3, "All", "api", [])).toBe("no-results");
  });

  it("sorts tag items by usage and localized name", () => {
    expect(buildWorkspaceTagItems(["beta", "alpha", "core"], { alpha: 1, beta: 2 }, "en-US")).toEqual([
      { name: "beta", usageCount: 2 },
      { name: "alpha", usageCount: 1 },
      { name: "core", usageCount: 0 },
    ]);
  });

  it("derives tag usage from remote snapshot or local assignments", () => {
    expect(
      buildWorkspaceTagUsageMap({
        organizationMode: "remote",
        remoteTagUsage: [{ name: "core", usageCount: 4 }],
        skillTagMap: { a: ["local"] },
      }),
    ).toEqual({ core: 4 });

    expect(
      buildWorkspaceTagUsageMap({
        organizationMode: "local",
        skillTagMap: { a: ["core", "ui"], b: ["core"] },
      }),
    ).toEqual({ core: 2, ui: 1 });
  });
});
