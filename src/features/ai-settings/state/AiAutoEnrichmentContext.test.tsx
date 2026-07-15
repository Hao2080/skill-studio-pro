/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiApi } from "../api/aiApi";
import type { LibraryApi } from "@/features/library/api/libraryApi";
import { AiAutoEnrichmentProvider, useAiAutoEnrichment } from "./AiAutoEnrichmentContext";

function Harness() {
  const auto = useAiAutoEnrichment();
  return <div><span>{auto.enabled ? "enabled" : "disabled"}</span><span>{auto.paused ? "paused" : "active"}</span><span>{`queued:${auto.queued}`}</span><button onClick={()=>auto.setPaused(true)}>pause</button><button onClick={()=>auto.setPaused(false)}>resume</button><button onClick={()=>auto.setEnabled(true)}>enable</button></div>;
}

function library(count: number): LibraryApi {
  return {
    list: vi.fn().mockResolvedValue(Array.from({ length: count }, (_, index) => ({ id: `skill-${index + 1}`, name: `Skill ${index + 1}`, slug: `skill-${index + 1}`, storageRelPath: `skills/${index + 1}`, storagePath: `temp/${index + 1}`, lifecycleState: "active", createdAt: 1, updatedAt: 1 }))),
    get: vi.fn(), createRegisterPlan: vi.fn(), executeRegisterPlan: vi.fn(), createPublishPlan: vi.fn(), executePublishPlan: vi.fn(), removeMapping: vi.fn(), detectDrift: vi.fn(),
  };
}

function ai(): AiApi {
  return {
    listProviders: vi.fn(), saveProvider: vi.fn(), testProvider: vi.fn(), listTaskRoutes: vi.fn(), saveTaskRoute: vi.fn(), cancelArtifact: vi.fn(),
    listArtifacts: vi.fn().mockResolvedValue([]),
    generateArtifact: vi.fn(async (input) => ({ id: `${input.skillId}-${input.taskType}`, skillId: input.skillId, taskType: input.taskType, providerId: input.taskType === "final_summary" ? "openai" : "minimax", modelId: "mock-model", responsibility: "Mock Provider", promptVersion: "mock/v1", inputHash: "mock-hash", content: input.taskType === "final_summary" ? { oneLineSummary: "Mock", details: "Mock" } : input.taskType === "extract_usage" ? { usagePoints: [], dependencies: [], inputs: [], outputs: [] } : input.taskType === "suggest_tags" ? { tags: [] } : { category: "mock", rationale: "mock" }, status: "completed", createdAt: 1 })),
  };
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("AI auto enrichment queue", () => {
  it("is off by default and a paused queue does not enumerate or upload central skills", async () => {
    const libraryApi = library(1);
    const aiApi = ai();
    render(<AiAutoEnrichmentProvider library={libraryApi} ai={aiApi} readCentralFile={vi.fn()}><Harness/></AiAutoEnrichmentProvider>);
    expect(screen.getByText("disabled")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "pause" }));
    fireEvent.click(screen.getByRole("button", { name: "enable" }));
    expect(screen.getByText("paused")).toBeTruthy();
    await Promise.resolve();
    expect(libraryApi.list).not.toHaveBeenCalled();
    expect(aiApi.generateArtifact).not.toHaveBeenCalled();
    expect(localStorage.getItem("skill-studio-pro.ai-auto-enrichment")).not.toContain("apiKey");
  });

  it("only queues managed central skills with missing artifacts and bounds active skill reads to two workers", async () => {
    const libraryApi = library(3);
    const aiApi = ai();
    const readers: Array<(value: string) => void> = [];
    const readCentralFile = vi.fn(() => new Promise<string>((resolve) => readers.push(resolve)));
    render(<AiAutoEnrichmentProvider library={libraryApi} ai={aiApi} readCentralFile={readCentralFile}><Harness/></AiAutoEnrichmentProvider>);
    fireEvent.click(screen.getByRole("button", { name: "enable" }));
    await waitFor(() => expect(readCentralFile).toHaveBeenCalledTimes(2));
    expect(readCentralFile).toHaveBeenNthCalledWith(1, expect.stringMatching(/^skill-[12]$/), "SKILL.md");
    expect(readCentralFile).toHaveBeenNthCalledWith(2, expect.stringMatching(/^skill-[12]$/), "SKILL.md");
    expect(readCentralFile).not.toHaveBeenCalledWith("skill-3", "SKILL.md");
    expect(screen.getByText("queued:3")).toBeTruthy();
  });
});
