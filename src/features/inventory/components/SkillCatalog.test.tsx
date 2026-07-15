/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { mockSkills } from "@/shared/mock/proMockData";
import { SkillCatalog } from "./SkillCatalog";

describe("SkillCatalog", () => {
  afterEach(cleanup);

  it("filters by text and exposes list/card view controls", () => {
    render(<MemoryRouter><SkillCatalog skills={mockSkills}/></MemoryRouter>);
    fireEvent.change(screen.getByPlaceholderText("搜索名称、说明或标签"), { target: { value: "PDF" } });
    expect(screen.getByText("pdf")).toBeTruthy();
    expect(screen.queryByText("legacy-helper")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "列表视图" }));
    expect(screen.getByRole("button", { name: "列表视图" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("combines source and risk filters", () => {
    render(<MemoryRouter><SkillCatalog skills={mockSkills}/></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("来源筛选"), { target: { value: "unknown" } });
    fireEvent.click(screen.getByRole("button", { name: "风险与冲突" }));
    expect(screen.getByText("legacy-helper")).toBeTruthy();
    expect(screen.queryByText("pdf")).toBeNull();
  });
});
