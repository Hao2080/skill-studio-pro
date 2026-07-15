import { describe, expect, it, vi } from "vitest";
import { createInventoryApi, type InventoryInvoker } from "./inventoryApi";

describe("inventoryApi contract", () => {
  it("uses the inventory IPC names and normalized scan defaults", async () => {
    const invoke = vi.fn(async () => ({})) as unknown as InventoryInvoker;
    const api = createInventoryApi(invoke);

    await api.startScan();
    await api.cancelScan("run-1");
    await api.listInstances({ search: "demo" });
    await api.recalculateOrigin("instance-1");

    expect(invoke).toHaveBeenNthCalledWith(1, "inventory_scan_start", {
      input: { mode: "incremental", rootIds: [] },
    });
    expect(invoke).toHaveBeenNthCalledWith(2, "inventory_scan_cancel", {
      input: { runId: "run-1" },
    });
    expect(invoke).toHaveBeenNthCalledWith(3, "inventory_instance_list", {
      input: { search: "demo" },
    });
    expect(invoke).toHaveBeenNthCalledWith(4, "origin_resolution_recalculate", {
      input: { instanceId: "instance-1" },
    });
  });
});
