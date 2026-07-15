/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProSettingsPage } from "./ProSettingsPage";

describe("ProSettingsPage accessibility preferences", () => {
  afterEach(() => { cleanup(); localStorage.clear(); delete document.documentElement.dataset.reduceMotion; delete document.documentElement.dataset.reduceTransparency; });

  it("applies reduced motion and reduced transparency without reload", () => {
    render(<ProSettingsPage/>);
    fireEvent.click(screen.getByRole("checkbox", { name: "减少动态效果" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "降低透明度" }));
    expect(document.documentElement.dataset.reduceMotion).toBe("true");
    expect(document.documentElement.dataset.reduceTransparency).toBe("true");
    expect(localStorage.getItem("skill-studio-pro.reduce-motion")).toBe("true");
  });
});
