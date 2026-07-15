/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SourceConfidence } from "./SourceConfidence";

describe("SourceConfidence", () => {
  afterEach(cleanup);

  it("shows percentage, status, rationale, and evidence without calling it a safety score", () => {
    render(<SourceConfidence source={{ label: "GitHub / demo/repo", type: "git_repository", score: 92, status: "inferred", rationale: "Git remote 与 commit 匹配", evidence: ["Git remote 精确匹配", "commit 已固定"] }} />);
    expect(screen.getByLabelText("来源可信度 92%")).toBeTruthy();
    expect(screen.getByText("推断")).toBeTruthy();
    expect(screen.getByText("Git remote 与 commit 匹配")).toBeTruthy();
    expect(screen.getByText("Git remote 精确匹配")).toBeTruthy();
    expect(screen.getByText("可信度描述来源判断强度，不代表安全评分。")).toBeTruthy();
  });
});
