import { describe, expect, it, vi } from "vitest";
import type { AiApi } from "../api/aiApi";
import type { AiArtifact, AiTaskType } from "./aiTypes";
import { generateArtifactBundle } from "./generateArtifactBundle";

function artifact(taskType: AiTaskType): AiArtifact {
  return {
    id: `artifact-${taskType}`,
    skillId: "skill-1",
    taskType,
    providerId: taskType === "final_summary" ? "openai" : "minimax",
    modelId: taskType === "final_summary" ? "gpt-5.6-actual" : "MiniMax-M3-actual",
    responsibility: taskType === "final_summary" ? "最终摘要与提炼" : "结构化采集",
    promptVersion: taskType === "final_summary" ? "summary/v1" : `${taskType}/v1`,
    inputHash: "input-hash",
    content: taskType === "final_summary" ? { oneLineSummary: "Demo", details: "Details" } : {},
    status: "completed",
    createdAt: 1,
  };
}

function api(generateArtifact: AiApi["generateArtifact"]): AiApi {
  return {
    listProviders: vi.fn(),
    saveProvider: vi.fn(),
    testProvider: vi.fn(),
    listTaskRoutes: vi.fn(),
    saveTaskRoute: vi.fn(),
    generateArtifact,
    cancelArtifact: vi.fn(),
    listArtifacts: vi.fn(),
  };
}

describe("generateArtifactBundle", () => {
  it("routes MiniMax collection tasks before the OpenAI final summary with minimal current-skill input", async () => {
    const generate = vi.fn(async (input) => artifact(input.taskType));
    const started: Array<{ taskType: AiTaskType; cancellationId: string }> = [];
    const result = await generateArtifactBundle({
      api: api(generate),
      subject: { skillId: "skill-1" },
      skillMd: "# Fixture only",
      metadata: { name: "Fixture" },
      force: false,
      onTaskStart: (taskType, cancellationId) => started.push({ taskType, cancellationId }),
    });

    expect(generate.mock.calls.slice(0, 3).map(([input]) => input.taskType).sort()).toEqual(["classify", "extract_usage", "suggest_tags"]);
    expect(generate.mock.calls[3][0]).toEqual(expect.objectContaining({ taskType: "final_summary", skillId: "skill-1", force: false }));
    expect(generate.mock.calls[0][0].input).toEqual({ skillMd: "# Fixture only", localMetadata: { name: "Fixture" } });
    expect(result.artifacts).toHaveLength(4);
    expect(result.errors).toEqual([]);
    expect(new Set(started.map((item) => item.cancellationId)).size).toBe(4);
  });

  it("keeps partial collection results and still runs final summary when one task fails", async () => {
    const generate = vi.fn(async (input) => {
      if (input.taskType === "suggest_tags") throw new Error("RATE_LIMITED");
      return artifact(input.taskType);
    });
    const result = await generateArtifactBundle({ api: api(generate), subject: { instanceId: "instance-1" }, skillMd: "# Safe", metadata: {}, force: true });
    expect(result.artifacts.map((item) => item.taskType)).toContain("final_summary");
    expect(result.errors).toEqual([{ taskType: "suggest_tags", message: "RATE_LIMITED" }]);
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ taskType: "final_summary", force: true, instanceId: "instance-1" }));
  });
});
