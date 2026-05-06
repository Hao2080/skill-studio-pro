import { describe, expect, it } from "vitest";
import { DEFAULT_VISIBLE_TAG_COUNT, resolveVisibleTagCount } from "./tagVisibility";

describe("resolveVisibleTagCount", () => {
  it("在宽度足够时展示全部标签", () => {
    const visibleCount = resolveVisibleTagCount({
      containerWidth: 180,
      tagWidths: [48, 52, 44],
      summaryWidths: new Map([[1, 32], [2, 32]]),
      gap: 6,
    });

    expect(visibleCount).toBe(3);
  });

  it("在单行宽度不足时保留汇总标签并尽量多展示", () => {
    const visibleCount = resolveVisibleTagCount({
      containerWidth: 150,
      tagWidths: [48, 52, 44],
      summaryWidths: new Map([[1, 32], [2, 32]]),
      gap: 6,
    });

    expect(visibleCount).toBe(2);
  });

  it("比默认折叠策略更宽时会继续展开更多标签", () => {
    const visibleCount = resolveVisibleTagCount({
      containerWidth: 198,
      tagWidths: [48, 52, 44, 40],
      summaryWidths: new Map([[1, 32], [2, 32], [3, 32]]),
      gap: 6,
    });

    expect(visibleCount).toBe(3);
    expect(visibleCount).toBeGreaterThan(DEFAULT_VISIBLE_TAG_COUNT);
  });

  it("测量失败时回退到默认数量", () => {
    const visibleCount = resolveVisibleTagCount({
      containerWidth: 0,
      tagWidths: [48, 52, 44],
      summaryWidths: new Map([[1, 32], [2, 32]]),
      gap: 6,
    });

    expect(visibleCount).toBe(DEFAULT_VISIBLE_TAG_COUNT);
  });
});
