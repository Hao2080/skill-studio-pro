import { describe, expect, it } from "vitest";
import { invokeBrowserPreviewProCommand } from "./browserPreviewProCommands";

interface ContractCase {
  command: string;
  args?: Record<string, unknown>;
  requiredKeys?: string[];
  array?: boolean;
}

const cases: ContractCase[] = [
  { command: "inventory_root_list", array: true },
  { command: "inventory_root_upsert", args: { input: { rootType: "custom", path: "preview/custom", enabled: true } }, requiredKeys: ["id", "rootType", "normalizedPath"] },
  { command: "inventory_scan_start", args: { input: { mode: "incremental", rootIds: [] } }, requiredKeys: ["id", "rootsTotal", "instancesChanged"] },
  { command: "inventory_scan_cancel", args: { input: { runId: "preview-scan" } } },
  { command: "inventory_instance_list", args: { input: { limit: 10, offset: 0 } }, requiredKeys: ["items", "total", "resolutions"] },
  { command: "inventory_instance_get", args: { instanceId: "skill-doc-linter" }, requiredKeys: ["instance", "files", "evidence"] },
  { command: "inventory_instance_file_read", args: { instanceId: "skill-doc-linter", relativePath: "SKILL.md" } },
  { command: "origin_resolution_get", args: { instanceId: "skill-doc-linter" }, requiredKeys: ["sourceType", "confidence", "resolutionStatus"] },
  { command: "origin_resolution_confirm", args: { input: { instanceId: "skill-doc-linter", sourceType: "manual", sourceLabel: "Confirmed" } }, requiredKeys: ["sourceType", "confidence", "userConfirmed"] },
  { command: "origin_resolution_recalculate", args: { input: { instanceId: "skill-doc-linter" } }, requiredKeys: ["evidenceHash"] },
  { command: "library_skill_list", array: true },
  { command: "library_skill_get", args: { skillId: "skill-doc-linter" }, requiredKeys: ["id", "storageRelPath", "lifecycleState"] },
  { command: "library_skill_drift_check", args: { skillId: "skill-doc-linter" }, array: true },
  { command: "library_instance_register_plan", args: { input: { instanceId: "skill-doc-linter", slug: "demo" } }, requiredKeys: ["id", "planHash", "expiresAt"] },
  { command: "library_instance_register_execute", args: { input: { planId: "preview-register-plan", planHash: "preview-register-hash" } }, requiredKeys: ["id", "storageRelPath"] },
  { command: "library_skill_publish_plan", args: { input: { skillId: "skill-doc-linter", snapshotId: "preview-snapshot", targets: [{ platformName: "codex", syncMode: "copy", driftPolicy: "abort" }] } }, requiredKeys: ["id", "sourceHash", "targets", "planHash"] },
  { command: "library_skill_publish_execute", args: { input: { planId: "preview-publish-plan", planHash: "preview-publish-hash" } }, requiredKeys: ["planId", "status", "targets"] },
  { command: "library_skill_remove_mapping", args: { input: { skillId: "skill-doc-linter", platformName: "codex" } }, requiredKeys: ["platformName", "targetPath", "status"] },
  { command: "import_plan_create", args: { input: { sourceType: "local_directory", localPath: "preview/source" } }, requiredKeys: ["id", "provenance", "candidates", "planHash"] },
  { command: "import_plan_execute", args: { input: { planId: "preview-import-plan", planHash: "preview-plan-hash", selections: [] } }, requiredKeys: ["planId", "publishDeferred", "requestedTargetAgents"] },
  { command: "lifecycle_text_file_save", args: { input: { skillId: "skill-doc-linter", relativePath: "SKILL.md", content: "# Preview", editSessionId: "preview-edit" } }, requiredKeys: ["skillId", "relativePath", "afterHash", "recoverySnapshotId"] },
  { command: "lifecycle_staging_recover", requiredKeys: ["recovered", "cleaned", "errors"] },
  { command: "trash_plan_create", args: { skillId: "skill-doc-linter" }, requiredKeys: ["id", "skillId", "mappings", "planHash"] },
  { command: "trash_move_execute", args: { input: { planId: "preview-delete-plan", planHash: "preview-delete-hash" } }, requiredKeys: ["id", "trashPath", "manifestPath"] },
  { command: "trash_list", array: true },
  { command: "trash_restore_plan", args: { input: { trashEntryId: "trash-1", mode: "original" } }, requiredKeys: ["id", "trashEntryId", "mappingsWillBeRepublished", "planHash"] },
  { command: "trash_restore_execute", args: { input: { planId: "preview-restore-plan", planHash: "preview-restore-hash" } }, requiredKeys: ["id", "status", "restoredAt"] },
  { command: "trash_purge_confirmation_create", args: { trashEntryId: "trash-2" }, requiredKeys: ["trashEntryId", "confirmationToken", "expiresAt"] },
  { command: "operation_list", args: { input: { limit: 10, offset: 0 } }, array: true },
  { command: "ai_provider_list", array: true },
  { command: "ai_provider_save", args: { input: { providerId: "minimax", providerType: "minimax", displayName: "MiniMax", baseUrl: "https://api.minimax.io/v1", defaultModel: "MiniMax-M3", enabled: false, timeoutMs: 60000, maxConcurrency: 2, retryCount: 1, secretMode: "unchanged" } }, requiredKeys: ["providerId", "defaultModel", "secretTail"] },
  { command: "ai_provider_test", args: { providerId: "minimax" }, requiredKeys: ["providerId", "status", "testedAt"] },
  { command: "ai_task_route_list", array: true },
  { command: "ai_task_route_save", args: { input: { taskType: "extract_usage", providerId: "minimax", modelId: "MiniMax-M3", promptVersion: "usage/v1", responsibility: "用法要点提取", enabled: true } }, requiredKeys: ["taskType", "providerId", "promptVersion"] },
  { command: "ai_artifact_generate", args: { input: { taskType: "extract_usage", instanceId: "skill-doc-linter", input: { content: "safe" }, force: false, cancellationId: "preview-call" } }, requiredKeys: ["id", "taskType", "providerId", "modelId", "inputHash"] },
  { command: "ai_artifact_cancel", args: { cancellationId: "preview-call" } },
  { command: "ai_artifact_list", args: { input: { instanceId: "skill-doc-linter" } }, array: true },
  { command: "trash_purge_execute", args: { input: { trashEntryId: "trash-2", confirmationToken: "preview-confirmation" } } },
];

describe("browser preview and Tauri Pro IPC contract", () => {
  it("keeps command names, camelCase arguments, and response envelopes stable", async () => {
    for (const contract of cases) {
      expect(JSON.stringify(contract.args ?? {}), contract.command).not.toMatch(/"[a-z][a-z0-9]*_[a-z0-9_]+"\s*:/);
      const result = await invokeBrowserPreviewProCommand<unknown>(contract.command, contract.args);
      if (contract.array) expect(Array.isArray(result), contract.command).toBe(true);
      if (contract.requiredKeys) {
        expect(result, contract.command).toEqual(expect.objectContaining(Object.fromEntries(contract.requiredKeys.map((key) => [key, expect.anything()]))));
      }
      expect(JSON.stringify(result ?? null), contract.command).not.toMatch(/"[a-z][a-z0-9]*_[a-z0-9_]+"\s*:/);
    }
  });
});
