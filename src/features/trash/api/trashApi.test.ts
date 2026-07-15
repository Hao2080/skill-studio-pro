import { describe, expect, it, vi } from "vitest";
import { createTrashApi } from "./trashApi";

describe("trashApi", () => {
  it("permanent delete accepts only trash entry id and confirmation token", async () => {
    const invoke = vi.fn().mockResolvedValue(undefined);
    const api = createTrashApi(invoke);
    await api.executePurge("trash-1", "confirmation-1");
    expect(invoke).toHaveBeenCalledWith("trash_purge_execute", {
      input: { trashEntryId: "trash-1", confirmationToken: "confirmation-1" },
    });
    expect(JSON.stringify(invoke.mock.calls)).not.toContain("path");
  });

  it("restore execution requires its preview hash", async () => {
    const invoke = vi.fn().mockResolvedValue({ id: "trash-1" });
    const api = createTrashApi(invoke);
    await api.executeRestore("restore-plan", "restore-hash");
    expect(invoke).toHaveBeenCalledWith("trash_restore_execute", {
      input: { planId: "restore-plan", planHash: "restore-hash" },
    });
  });
});
