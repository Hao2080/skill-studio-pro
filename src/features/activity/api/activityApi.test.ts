import { describe, expect, it, vi } from "vitest";
import { createActivityApi } from "./activityApi";

describe("activityApi", () => {
  it("passes bounded operation filters through the typed IPC wrapper", async () => {
    const invoke = vi.fn().mockResolvedValue([]);
    const api = createActivityApi(invoke);
    await api.list({ operationType: "import", status: "failed", limit: 25, offset: 0 });
    expect(invoke).toHaveBeenCalledWith("operation_list", {
      input: { operationType: "import", status: "failed", limit: 25, offset: 0 },
    });
  });
});
