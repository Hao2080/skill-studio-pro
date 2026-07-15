import { describe, expect, it, vi } from "vitest";
import { createLifecycleApi } from "./lifecycleApi";

describe("lifecycleApi", () => {
  it("executes imports with plan id and plan hash", async () => {
    const invoke = vi.fn().mockResolvedValue({ status: "success" });
    const api = createLifecycleApi(invoke);
    await api.executeImportPlan({ planId: "plan-1", planHash: "hash-1", selections: [] });
    expect(invoke).toHaveBeenCalledWith("import_plan_execute", {
      input: { planId: "plan-1", planHash: "hash-1", selections: [] },
    });
  });

  it("saves through a stable edit session and relative path", async () => {
    const invoke = vi.fn().mockResolvedValue({ afterHash: "hash" });
    const api = createLifecycleApi(invoke);
    await api.saveTextFile({
      skillId: "skill-1",
      relativePath: "SKILL.md",
      content: "# safe",
      editSessionId: "session-1",
    });
    expect(invoke).toHaveBeenCalledWith("lifecycle_text_file_save", {
      input: {
        skillId: "skill-1",
        relativePath: "SKILL.md",
        content: "# safe",
        editSessionId: "session-1",
      },
    });
  });
});
