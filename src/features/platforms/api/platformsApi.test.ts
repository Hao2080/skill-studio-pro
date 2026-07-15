import { describe, expect, it, vi } from "vitest";
import { createPlatformsApi, type PlatformsInvoker } from "./platformsApi";

describe("platformsApi Tauri contract", () => {
  it("uses real command names, camelCase request fields and response envelopes", async () => {
    const invokeMock = vi.fn(async (command: string, _args?: Record<string, unknown>) => command === "platform_detect" ? { platforms: [{ id: "codex", platformName: "codex", detected: true, enabled: true, managedSkillCount: 2, lastSyncStatus: "success" }] } : command === "platform_governance_impact" ? { platformName: "codex", globalReleaseCount: 2, projectConnectionCount: 0, enabledProjectConnectionCount: 0, assignmentCount: 0, enabledAssignmentCount: 0, affectedProjects: [] } : command === "test_platform_path" ? { ok: true, normalizedPath: "C:/isolated", exists: true, isDirectory: true, message: "ok" } : command === "delete_custom_platform" ? undefined : { id: "custom", platformName: "custom", detected: true, enabled: true });
    const invoke: PlatformsInvoker = (command, args) => invokeMock(command, args) as Promise<never>;
    const api = createPlatformsApi(invoke);
    expect((await api.listConnections())[0]).toEqual(expect.objectContaining({ platformName: "codex", managedSkillCount: 2, lastSyncStatus: "success" }));
    await api.saveConnection({ platformName: "codex", enabled: true, skillsDir: "C:/isolated", syncMode: "copy" });
    await api.getGovernanceImpact("codex");
    await api.createCustom({ platformName: "custom", displayName: "Custom", skillsDir: "C:/isolated/custom", supportsProjectScope: false, supportsSymlink: false, supportsCopy: true });
    await api.deleteCustom({ platformName: "custom" });
    await api.testPath("C:/isolated");
    expect(invokeMock.mock.calls).toEqual([
      ["platform_detect", undefined],
      ["save_platform_connection", { input: { platformName: "codex", enabled: true, skillsDir: "C:/isolated", syncMode: "copy" } }],
      ["platform_governance_impact", { platformName: "codex" }],
      ["create_custom_platform", { input: { platformName: "custom", displayName: "Custom", skillsDir: "C:/isolated/custom", supportsProjectScope: false, supportsSymlink: false, supportsCopy: true } }],
      ["delete_custom_platform", { input: { platformName: "custom" } }],
      ["test_platform_path", { input: { skillsDir: "C:/isolated" } }],
    ]);
  });
});
