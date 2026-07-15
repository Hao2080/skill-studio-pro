import { describe, expect, it, vi } from "vitest";
import { createAiApi, type AiInvoker } from "./aiApi";

describe("aiApi contract", () => {
  it("uses the required AI IPC command names", async () => {
    const invoke = vi.fn(async () => ({})) as unknown as AiInvoker;
    const api = createAiApi(invoke);

    await api.listProviders();
    await api.testProvider("openai");
    await api.listTaskRoutes();
    await api.generateArtifact({
      taskType: "final_summary",
      instanceId: "instance-1",
      input: { content: "demo" },
    });
    await api.cancelArtifact("call-1");
    await api.listArtifacts({ instanceId: "instance-1" });

    expect(invoke).toHaveBeenNthCalledWith(1, "ai_provider_list");
    expect(invoke).toHaveBeenNthCalledWith(2, "ai_provider_test", { providerId: "openai" });
    expect(invoke).toHaveBeenNthCalledWith(3, "ai_task_route_list");
    expect(invoke).toHaveBeenNthCalledWith(4, "ai_artifact_generate", {
      input: {
        taskType: "final_summary",
        instanceId: "instance-1",
        input: { content: "demo" },
        force: false,
      },
    });
    expect(invoke).toHaveBeenNthCalledWith(5, "ai_artifact_cancel", {
      cancellationId: "call-1",
    });
    expect(invoke).toHaveBeenNthCalledWith(6, "ai_artifact_list", {
      input: { instanceId: "instance-1" },
    });
  });

  it("never adds a plaintext key unless the caller explicitly supplies one", async () => {
    const invoke = vi.fn(async () => ({})) as unknown as AiInvoker;
    const api = createAiApi(invoke);
    await api.saveProvider({
      providerId: "openai",
      providerType: "openai_responses",
      displayName: "OpenAI",
      baseUrl: "https://api.openai.com",
      defaultModel: "gpt-5.6",
      enabled: true,
      timeoutMs: 60_000,
      maxConcurrency: 4,
      retryCount: 2,
    });
    expect(invoke).toHaveBeenCalledWith("ai_provider_save", {
      input: expect.not.objectContaining({ apiKey: expect.anything() }),
    });
  });
});
