/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiApi } from "../api/aiApi";
import type { AiProviderConfig, AiTaskRoute } from "../model";
import { AiSettingsPage } from "./AiSettingsPage";

const provider: AiProviderConfig = {
  providerId: "minimax",
  providerType: "minimax",
  displayName: "MiniMax",
  baseUrl: "https://api.minimax.io/v1",
  defaultModel: "MiniMax-M3",
  secretRef: null,
  secretTail: null,
  enabled: false,
  timeoutMs: 60_000,
  maxConcurrency: 2,
  retryCount: 1,
  lastTestStatus: null,
  lastTestAt: null,
  updatedAt: 1,
};

const route: AiTaskRoute = {
  taskType: "extract_usage",
  providerId: "minimax",
  modelId: "MiniMax-M3",
  promptVersion: "usage/v1",
  responsibility: "用法要点提取",
  enabled: true,
  updatedAt: 1,
};

function api(): AiApi {
  return {
    listProviders: vi.fn().mockResolvedValue([provider]),
    saveProvider: vi.fn().mockImplementation(async (input) => ({ ...provider, ...input, apiKey: undefined, secretRef: "os://minimax", secretTail: "1234", updatedAt: 2 })),
    testProvider: vi.fn().mockResolvedValue({ providerId: "minimax", status: "success", model: { providerId: "minimax", modelId: "MiniMax-M3" }, testedAt: 2 }),
    listTaskRoutes: vi.fn().mockResolvedValue([route]),
    saveTaskRoute: vi.fn().mockImplementation(async (input) => ({ ...input, updatedAt: 2 })),
    generateArtifact: vi.fn(),
    cancelArtifact: vi.fn(),
    listArtifacts: vi.fn().mockResolvedValue([]),
  };
}

describe("AiSettingsPage", () => {
  afterEach(cleanup);

  it("loads actual model IDs and runs the injected connection contract", async () => {
    const client = api();
    render(<AiSettingsPage api={client}/>);
    expect(await screen.findAllByDisplayValue("MiniMax-M3")).not.toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "测试连接" }));
    await waitFor(() => expect(screen.getByText("success · MiniMax-M3")).toBeTruthy());
    expect(client.testProvider).toHaveBeenCalledWith("minimax");
  });

  it("clears a plaintext key from UI state after the secure save resolves", async () => {
    const client = api();
    render(<AiSettingsPage api={client}/>);
    const input = await screen.findByLabelText("MiniMax API Key") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "unit-key" } });
    fireEvent.click(screen.getByRole("button", { name: "保存配置" }));
    await waitFor(() => expect(client.saveProvider).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "unit-key", secretMode: "persistent" })));
    await waitFor(() => expect(input.value).toBe(""));
  });

  it("clears a plaintext key from ordinary UI state when secure save fails", async () => {
    const client = api();
    vi.mocked(client.saveProvider).mockRejectedValue(new Error("凭据服务不可用"));
    render(<AiSettingsPage api={client}/>);
    const input = await screen.findByLabelText("MiniMax API Key") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "failure-unit-key" } });
    fireEvent.click(screen.getByRole("button", { name: "保存配置" }));
    await waitFor(() => expect(client.saveProvider).toHaveBeenCalled());
    await waitFor(() => expect(input.value).toBe(""));
    expect(screen.queryByDisplayValue("failure-unit-key")).toBeNull();
    expect(localStorage.getItem("failure-unit-key")).toBeNull();
  });
});
