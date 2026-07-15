/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModelAttribution } from "./ModelAttribution";

describe("ModelAttribution", () => {
  afterEach(cleanup);

  it("shows provider, actual model, responsibility, time, and freshness", () => {
    render(<ModelAttribution provider="OpenAI" modelId="gpt-5.6" responsibility="内容提炼" generatedAt="2026-07-15 14:33" state="fresh" />);
    expect(screen.getByText("OpenAI")).toBeTruthy();
    expect(screen.getByText("gpt-5.6")).toBeTruthy();
    expect(screen.getByText("内容提炼")).toBeTruthy();
    expect(screen.getByText("2026-07-15 14:33")).toBeTruthy();
    expect(screen.getByText("最新")).toBeTruthy();
  });

  it("exposes stale state as text and supports regeneration", () => {
    const onRegenerate = vi.fn();
    render(<ModelAttribution provider="MiniMax" modelId="MiniMax-Text-01" responsibility="结构化采集" generatedAt="2026-07-14" state="stale" onRegenerate={onRegenerate} />);
    expect(screen.getByText("已过期")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "重新生成模型内容" }));
    expect(onRegenerate).toHaveBeenCalledOnce();
  });
});
