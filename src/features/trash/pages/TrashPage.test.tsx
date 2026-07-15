/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TrashPage } from "./TrashPage";

describe("TrashPage permanent delete guard", () => {
  afterEach(cleanup);

  it("requires impact review and exact-name confirmation", () => {
    render(<TrashPage/>);
    fireEvent.click(screen.getAllByRole("button", { name: /永久删除/ })[0]);
    expect(screen.getByText("确认影响范围")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "继续最终确认" }));
    expect(screen.getByText("最终确认永久删除")).toBeTruthy();
    const purgeButton = within(screen.getByRole("dialog")).getByRole("button", { name: "永久删除" });
    expect((purgeButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Skill 名称"), { target: { value: "old-git-helper" } });
    expect((purgeButton as HTMLButtonElement).disabled).toBe(false);
  });
});
