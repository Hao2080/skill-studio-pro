/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InventoryApi } from "../api/inventoryApi";
import type { ScanRoot } from "../model";
import { ScanRootsPanel } from "./ScanRootsPanel";

const root: ScanRoot = {
  id: "root-1",
  rootType: "agent_global",
  platformName: "codex",
  path: "C:/isolated/.codex/skills",
  normalizedPath: "C:/isolated/.codex/skills",
  enabled: true,
  recursive: true,
  watchEnabled: true,
  ignoreRules: [],
  lastScanAt: 10,
  createdAt: 1,
  updatedAt: 2,
  available: true,
};

function client(overrides: Partial<InventoryApi> = {}): InventoryApi {
  return {
    listRoots: vi.fn().mockResolvedValue([root]),
    upsertRoot: vi.fn().mockImplementation(async (input) => ({
      ...root,
      ...input,
      id: input.id ?? "root-new",
      normalizedPath: input.path,
      ignoreRules: input.ignoreRules ?? [],
      available: true,
    })),
    startScan: vi.fn().mockResolvedValue({ id: "scan-1", mode: "full", status: "completed", rootsTotal: 1, rootsCompleted: 1, candidatesSeen: 2, instancesChanged: 1, errorCount: 0, startedAt: 1, completedAt: 2 }),
    cancelScan: vi.fn(),
    listInstances: vi.fn(),
    getInstance: vi.fn(),
    readInstanceFile: vi.fn(),
    getOriginResolution: vi.fn(),
    confirmOrigin: vi.fn(),
    recalculateOrigin: vi.fn(),
    ...overrides,
  };
}

afterEach(cleanup);

describe("ScanRootsPanel V1 closure", () => {
  it("lists real root state, disables by upsert only and scans the selected root in full mode", async () => {
    const api = client();
    render(<ScanRootsPanel api={api}/>);
    expect(screen.getByText("正在读取扫描根")).toBeTruthy();
    expect(await screen.findByText("C:/isolated/.codex/skills")).toBeTruthy();
    expect(screen.getByText("监听已配置")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("选择扫描根 C:/isolated/.codex/skills"));
    fireEvent.click(screen.getByRole("button", { name: "强制全量扫描" }));
    await waitFor(() => expect(api.startScan).toHaveBeenCalledWith({ mode: "full", rootIds: ["root-1"] }));

    fireEvent.click(screen.getByRole("button", { name: "停用" }));
    await waitFor(() => expect(api.upsertRoot).toHaveBeenCalledWith(expect.objectContaining({ id: "root-1", enabled: false, path: root.path })));
    expect(screen.getByText(/磁盘目录未被移动或删除/)).toBeTruthy();
  });

  it("adds an isolated custom root and exposes per-root save failures without losing the list", async () => {
    const upsertRoot = vi.fn()
      .mockResolvedValueOnce({ ...root, id: "root-new", rootType: "custom", path: "D:/fixtures/skills", normalizedPath: "D:/fixtures/skills" })
      .mockRejectedValueOnce(new Error("ROOT_UNAVAILABLE: permission denied"));
    const api = client({ upsertRoot });
    render(<ScanRootsPanel api={api} pickDirectory={vi.fn().mockResolvedValue("D:/fixtures/skills")}/>);
    await screen.findByText("C:/isolated/.codex/skills");
    fireEvent.click(screen.getByRole("button", { name: "添加扫描根" }));
    fireEvent.click(screen.getByRole("button", { name: "选择目录" }));
    await waitFor(() => expect((screen.getByDisplayValue("D:/fixtures/skills") as HTMLInputElement).value).toBe("D:/fixtures/skills"));
    fireEvent.click(screen.getByRole("button", { name: "保存扫描根" }));
    await screen.findByText(/扫描根已添加/);

    const directoryInputs = screen.getAllByDisplayValue(/skills/);
    fireEvent.change(directoryInputs[0], { target: { value: "Z:/missing" } });
    fireEvent.click(screen.getAllByRole("button", { name: "保存" })[0]);
    expect(await screen.findByText("ROOT_UNAVAILABLE: permission denied")).toBeTruthy();
    expect(screen.getByText("C:/isolated/.codex/skills")).toBeTruthy();
  });

  it("renders a recoverable top-level load error", async () => {
    const api = client({ listRoots: vi.fn().mockRejectedValue(new Error("database unavailable")) });
    render(<ScanRootsPanel api={api}/>);
    expect(await screen.findByText("database unavailable")).toBeTruthy();
    expect(screen.getByRole("button", { name: "重试" })).toBeTruthy();
  });
});
