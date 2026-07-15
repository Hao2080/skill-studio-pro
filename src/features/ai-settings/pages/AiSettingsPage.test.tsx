/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AiSettingsPage } from "./AiSettingsPage";

describe("AiSettingsPage", () => {
  afterEach(cleanup);

  it("shows actual model IDs and runs a typed Mock connection test", async () => {
    render(<AiSettingsPage/>);
    expect(screen.getAllByDisplayValue("MiniMax-Text-01").length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue("gpt-5.6").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "测试连接" })[0]);
    await waitFor(() => expect(screen.getByText("Mock 连接测试成功，没有发送真实网络请求。")).toBeTruthy());
    expect(screen.getByText("186 ms")).toBeTruthy();
  });
});
