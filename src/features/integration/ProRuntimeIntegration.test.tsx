/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActivityApi } from "@/features/activity/api/activityApi";
import { ActivityPage } from "@/features/activity/pages/ActivityPage";
import type { InventoryApi } from "@/features/inventory/api/inventoryApi";
import type { SkillInstance } from "@/features/inventory/model";
import { InventoryPage } from "@/features/inventory/pages/InventoryPage";
import type { LifecycleApi } from "@/features/lifecycle/api/lifecycleApi";
import type { InstallPlan } from "@/features/lifecycle/model";
import { DiscoverPage } from "@/features/discover/pages/DiscoverPage";

const instance: SkillInstance = {
  id: "instance-1",
  scanRootId: "root-1",
  platformName: "codex",
  scopeType: "agent_global",
  absolutePath: "preview/skill",
  normalizedPath: "preview/skill",
  folderName: "demo-skill",
  parsedName: "demo-skill",
  canonicalName: "demo-skill",
  description: "Demo",
  metadata: {},
  headings: [],
  contentHash: "content-hash",
  skillMdHash: "md-hash",
  fileCount: 1,
  hasScripts: false,
  hasExecutables: false,
  riskFlags: [],
  duplicateKinds: [],
  parseStatus: "ok",
  parseWarnings: [],
  firstSeenAt: 1,
  lastSeenAt: 2,
};

function inventory(overrides: Partial<InventoryApi> = {}): InventoryApi {
  return {
    listRoots: vi.fn().mockResolvedValue([{ id: "root-1", rootType: "agent_global", path: "preview", normalizedPath: "preview", enabled: true, recursive: true, watchEnabled: true, ignoreRules: [], createdAt: 1, updatedAt: 1, available: true }]),
    upsertRoot: vi.fn(),
    startScan: vi.fn().mockResolvedValue({ id: "scan-1", mode: "incremental", status: "completed", rootsTotal: 1, rootsCompleted: 1, candidatesSeen: 1, instancesChanged: 0, errorCount: 0, startedAt: 1, completedAt: 2 }),
    cancelScan: vi.fn(),
    listInstances: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getInstance: vi.fn(),
    readInstanceFile: vi.fn(),
    getOriginResolution: vi.fn(),
    confirmOrigin: vi.fn(),
    recalculateOrigin: vi.fn(),
    ...overrides,
  };
}

describe("Pro UI runtime integration states", () => {
  afterEach(cleanup);

  it("shows loading then a real empty inventory state", async () => {
    const client = inventory();
    render(<MemoryRouter><InventoryPage api={client}/></MemoryRouter>);
    expect(screen.getByText("正在加载本机索引")).toBeTruthy();
    expect(await screen.findByText("没有匹配的 Skill")).toBeTruthy();
    expect(client.listInstances).toHaveBeenCalledWith({ includeMissing: false, limit: 200, offset: 0 });
  });

  it("keeps inventory usable when source-detail enrichment partially fails", async () => {
    const client = inventory({
      listInstances: vi.fn().mockResolvedValue({ items: [instance], total: 1 }),
      getInstance: vi.fn().mockRejectedValue(new Error("detail unavailable")),
    });
    render(<MemoryRouter><InventoryPage api={client}/></MemoryRouter>);
    expect(await screen.findByText("1 个实例的来源详情加载失败，列表仍显示本地索引字段。")).toBeTruthy();
    expect(screen.getByText("demo-skill")).toBeTruthy();
    expect(screen.getByText("未知来源")).toBeTruthy();
  });

  it("renders a recoverable error state for operation history", async () => {
    const client: ActivityApi = { list: vi.fn().mockRejectedValue(new Error("database unavailable")) };
    render(<ActivityPage api={client}/>);
    expect(await screen.findByText("操作记录加载失败")).toBeTruthy();
    expect(screen.getByText("database unavailable")).toBeTruthy();
  });

  it("requires a real import preview and reports partial execution without hiding successes", async () => {
    const plan: InstallPlan = {
      id: "plan-1",
      provenance: { sourceType: "git_repository", sourceLabel: "https://example.invalid/repo.git" },
      stagingPath: "preview/staging",
      sourceHash: "source-hash",
      candidates: [{ id: "candidate-1", name: "demo", slug: "demo", relativePath: ".", contentHash: "content", fileCount: 2, totalBytes: 10, scripts: [], riskFlags: [], conflicts: [], targetAgents: [] }],
      planHash: "plan-hash",
      createdAt: 1,
      expiresAt: 2,
    };
    const client: LifecycleApi = {
      createImportPlan: vi.fn().mockResolvedValue(plan),
      executeImportPlan: vi.fn().mockResolvedValue({ planId: plan.id, status: "partial_success", imported: [{ candidateId: "candidate-1", skillId: "skill-1", name: "demo", slug: "demo", snapshotId: "snap-1", contentHash: "content", action: "install" }], publishDeferred: true, requestedTargetAgents: [] }),
      saveTextFile: vi.fn(),
      recoverStaging: vi.fn(),
    };
    render(<DiscoverPage api={client}/>);
    expect(screen.queryByRole("button", { name: "导入中央库" })).toBeNull();
    fireEvent.change(screen.getByLabelText("仓库 URL"), { target: { value: "https://example.invalid/repo.git" } });
    fireEvent.click(screen.getByRole("button", { name: "生成安装预览" }));
    expect(await screen.findByRole("button", { name: "导入中央库" })).toBeTruthy();
    expect(client.createImportPlan).toHaveBeenCalledWith({ sourceType: "git_repository", gitUrl: "https://example.invalid/repo.git", gitRef: undefined, repoSubdir: undefined });
    fireEvent.click(screen.getByRole("button", { name: "导入中央库" }));
    await waitFor(() => expect(screen.getByText(/partial_success，成功 1 项/)).toBeTruthy());
    expect(client.executeImportPlan).toHaveBeenCalledWith(expect.objectContaining({ planId: "plan-1", planHash: "plan-hash" }));
  });
});
