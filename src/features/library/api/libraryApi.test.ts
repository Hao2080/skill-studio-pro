import { describe, expect, it, vi } from "vitest";

import { createLibraryApi } from "./libraryApi";

describe("libraryApi IPC contract", () => {
  it("creates and executes hash-bound registration plans", async () => {
    const invoke = vi.fn().mockResolvedValue({ id: "plan-1" });
    const api = createLibraryApi(invoke);

    await api.createRegisterPlan({ instanceId: "instance-1", slug: "demo" });
    await api.executeRegisterPlan({ planId: "plan-1", planHash: "hash-1" });

    expect(invoke).toHaveBeenNthCalledWith(1, "library_instance_register_plan", {
      input: { instanceId: "instance-1", slug: "demo" },
    });
    expect(invoke).toHaveBeenNthCalledWith(2, "library_instance_register_execute", {
      input: { planId: "plan-1", planHash: "hash-1" },
    });
  });

  it("never accepts target paths from publish callers", async () => {
    const invoke = vi.fn().mockResolvedValue({ id: "publish-plan" });
    const api = createLibraryApi(invoke);
    await api.createPublishPlan({
      skillId: "skill-1",
      snapshotId: "snapshot-1",
      targets: [{ platformName: "codex", syncMode: "copy", driftPolicy: "abort" }],
    });

    expect(invoke).toHaveBeenCalledWith("library_skill_publish_plan", {
      input: {
        skillId: "skill-1",
        snapshotId: "snapshot-1",
        targets: [{ platformName: "codex", syncMode: "copy", driftPolicy: "abort" }],
      },
    });
  });

  it("removes one mapping by stable IDs and keeps arbitrary paths out of IPC", async () => {
    const invoke = vi.fn().mockResolvedValue({ status: "success" });
    const api = createLibraryApi(invoke);
    await api.removeMapping({ skillId: "skill-1", platformName: "cursor" });
    expect(invoke).toHaveBeenCalledWith("library_skill_remove_mapping", {
      input: { skillId: "skill-1", platformName: "cursor" },
    });
  });
});
