/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiArtifact, AiProviderConfig, AiTaskRoute } from "../model";
import { AiArtifactPanel } from "./AiArtifactPanel";

const providers: AiProviderConfig[] = [
  { providerId: "minimax", providerType: "minimax", displayName: "MiniMax", baseUrl: "http://mock.invalid", defaultModel: "MiniMax-M3", enabled: true, timeoutMs: 1000, maxConcurrency: 2, retryCount: 0, updatedAt: 1 },
  { providerId: "openai", providerType: "openai_responses", displayName: "OpenAI", baseUrl: "http://mock.invalid", defaultModel: "gpt-5.6", enabled: true, timeoutMs: 1000, maxConcurrency: 2, retryCount: 0, updatedAt: 1 },
];
const routes: AiTaskRoute[] = [
  { taskType: "extract_usage", providerId: "minimax", modelId: "MiniMax-M3", promptVersion: "usage/v1", responsibility: "用法采集", enabled: true, updatedAt: 1 },
  { taskType: "final_summary", providerId: "openai", modelId: "gpt-5.6", promptVersion: "summary/v1", responsibility: "最终提炼", enabled: true, updatedAt: 1 },
];
const artifacts: AiArtifact[] = [
  { id: "summary", skillId: "skill-1", taskType: "final_summary", providerId: "openai", modelId: "gpt-5.6-actual", responsibility: "最终提炼", promptVersion: "summary/v1", inputHash: "hash", content: { oneLineSummary: "实际简介", details: "实际详情" }, status: "completed", staleAt: 2, createdAt: 1 },
  { id: "usage", skillId: "skill-1", taskType: "extract_usage", providerId: "minimax", modelId: "MiniMax-M3-actual", responsibility: "用法采集", promptVersion: "usage/v1", inputHash: "hash", content: { usagePoints: ["第一步"] }, status: "completed", createdAt: 1 },
];

afterEach(cleanup);

describe("AiArtifactPanel", () => {
  it("shows actual provider/model, stale status, AI warning and force regeneration", () => {
    const generate = vi.fn();
    render(<AiArtifactPanel artifacts={artifacts} providers={providers} routes={routes} runState="stale" errors={[]} cacheHit={false} onGenerate={generate} onCancel={vi.fn()}/>);
    expect(screen.getByText("实际简介")).toBeTruthy();
    expect(screen.getByText("gpt-5.6-actual")).toBeTruthy();
    expect(screen.getByText("MiniMax-M3-actual")).toBeTruthy();
    expect(screen.getByText(/AI 生成内容可能有误/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "刷新（优先缓存）" }));
    expect(generate).toHaveBeenCalledWith(false);
    fireEvent.click(screen.getByRole("button", { name: "重新生成过期内容" }));
    expect(generate).toHaveBeenCalledWith(true);
  });

  it("renders running route attribution, cancellation and partial failure without hiding successful output", () => {
    const cancel = vi.fn();
    render(<AiArtifactPanel artifacts={artifacts} providers={providers} routes={routes} runState="running" errors={[{ taskType: "suggest_tags", message: "RATE_LIMITED" }]} cacheHit={false} onGenerate={vi.fn()} onCancel={cancel}/>);
    expect(screen.getByText(/extract_usage · MiniMax · MiniMax-M3/)).toBeTruthy();
    expect(screen.getByText(/final_summary · OpenAI · gpt-5.6/)).toBeTruthy();
    expect(screen.getByText(/suggest_tags: RATE_LIMITED/)).toBeTruthy();
    expect(screen.getByText("实际简介")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
