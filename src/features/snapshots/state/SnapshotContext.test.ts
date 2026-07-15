import { describe, expect, it, vi } from "vitest";
import {
  runPostSnapshotMutationEffects,
  shouldRefreshChangeStatusAfterSnapshotMutation,
} from "@/features/snapshots/state/SnapshotContext";
import * as SnapshotContextModule from "@/features/snapshots/state/SnapshotContext";

describe("snapshot change status refresh", () => {
  it("refreshes change status after create, restore, and delete", async () => {
    const refreshChangeStatuses = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    await runPostSnapshotMutationEffects("create", refreshChangeStatuses);
    await runPostSnapshotMutationEffects("restore", refreshChangeStatuses);
    await runPostSnapshotMutationEffects("delete", refreshChangeStatuses);

    expect(refreshChangeStatuses).toHaveBeenCalledTimes(3);
  });

  it("does not refresh change status after set_active", async () => {
    const refreshChangeStatuses = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    await runPostSnapshotMutationEffects("set_active", refreshChangeStatuses);

    expect(refreshChangeStatuses).not.toHaveBeenCalled();
  });

  it("matches the same refresh policy in the predicate helper", () => {
    expect(shouldRefreshChangeStatusAfterSnapshotMutation("create")).toBe(true);
    expect(shouldRefreshChangeStatusAfterSnapshotMutation("restore")).toBe(true);
    expect(shouldRefreshChangeStatusAfterSnapshotMutation("delete")).toBe(true);
    expect(shouldRefreshChangeStatusAfterSnapshotMutation("set_active")).toBe(false);
  });
});

describe("snapshot ui feedback gaps", () => {
  it("exposes create feedback for scrolling to and highlighting the new snapshot", () => {
    const helper = (SnapshotContextModule as Record<string, unknown>).getCreateSnapshotUiFeedback;

    expect(typeof helper).toBe("function");

    if (typeof helper === "function") {
      expect(helper("snap-3")).toEqual({
        scrollToSnapshotId: "snap-3",
        highlightedSnapshotId: "snap-3",
      });
    }
  });

  it("marks restore as requiring the browse view to refresh", () => {
    const helper = (SnapshotContextModule as Record<string, unknown>).shouldRefreshBrowseAfterSnapshotMutation;

    expect(typeof helper).toBe("function");

    if (typeof helper === "function") {
      expect(helper("restore")).toBe(true);
      expect(helper("create")).toBe(false);
      expect(helper("delete")).toBe(false);
      expect(helper("set_active")).toBe(false);
    }
  });
});
