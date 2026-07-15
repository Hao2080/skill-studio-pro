/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AntApp from "antd/es/app";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SkillEditorWorkspace, type EditorFile } from "./SkillEditorWorkspace";

const files: EditorFile[] = [
  { path: "SKILL.md", type: "file" },
  { path: "config.yaml", type: "file" },
  { path: "data.json", type: "file" },
  { path: "settings.toml", type: "file" },
  { path: "notes.txt", type: "file" },
  { path: "assets/logo.png", type: "file" },
];

const contents: Record<string, string> = {
  "SKILL.md": "# Demo",
  "config.yaml": "name: demo",
  "data.json": "{\"enabled\":true}",
  "settings.toml": "enabled = true",
  "notes.txt": "hello",
};

function renderEditor(element: ReactElement) {
  return render(<AntApp>{element}</AntApp>);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SkillEditorWorkspace V1 editor closure", () => {
  it("selects all five text formats, guards dirty switches, validates JSON and keeps one edit session", async () => {
    const saveFile = vi.fn(async (input) => ({
      skillId: input.skillId,
      relativePath: input.relativePath,
      beforeHash: "before-hash",
      afterHash: "after-hash",
      recoverySnapshotId: "recovery-1",
      recoveryPointCreated: true,
      outdatedMappingCount: 2,
    }));
    renderEditor(<SkillEditorWorkspace skillId="skill-1" isLibrary files={files} initialContent={contents["SKILL.md"]} readFile={async (path)=>{
      const value = contents[path];
      if (value == null) throw new Error("二进制文件");
      return value;
    }} saveFile={saveFile}/>);

    expect(screen.getAllByText("Markdown").length).toBeGreaterThan(0);
    expect(screen.getByText("YAML")).toBeTruthy();
    expect(screen.getByText("JSON")).toBeTruthy();
    expect(screen.getByText("TOML")).toBeTruthy();
    expect(screen.getByText("纯文本")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "进入编辑" }));
    fireEvent.change(screen.getByLabelText("SKILL.md 编辑器"), { target: { value: "# Changed" } });
    fireEvent.click(screen.getByRole("button", { name: /config.yaml/ }));
    expect(await screen.findByText("切换文件会丢失当前草稿。")).toBeTruthy();
    expect(screen.getByLabelText("SKILL.md 编辑器")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "继续编辑" }));
    expect(screen.getByLabelText("SKILL.md 编辑器")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /data.json/ }));
    const discardButtons = await screen.findAllByRole("button", { name: "放弃并切换" });
    fireEvent.click(discardButtons[discardButtons.length - 1]);
    await screen.findByText("{\"enabled\":true}");
    fireEvent.click(screen.getByRole("button", { name: "进入编辑" }));
    fireEvent.change(screen.getByLabelText("data.json 编辑器"), { target: { value: "{" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByText(/INVALID_JSON/)).toBeTruthy();
    expect(saveFile).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("data.json 编辑器"), { target: { value: "{\"enabled\":false}" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await screen.findByText("recovery-1");
    expect(screen.getByText("before-hash")).toBeTruthy();
    expect(screen.getByText("after-hash")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("data.json 编辑器"), { target: { value: "{\"enabled\":true}" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(saveFile).toHaveBeenCalledTimes(2));
    expect(saveFile.mock.calls[0][0].editSessionId).toBe(saveFile.mock.calls[1][0].editSessionId);
  });

  it("preserves typed content after backend format/save failure and registers the close guard", async () => {
    const saveFile = vi.fn().mockRejectedValue(new Error("INVALID_YAML: line 2"));
    renderEditor(<SkillEditorWorkspace skillId="skill-2" isLibrary files={files} initialContent={contents["SKILL.md"]} readFile={async (path)=>{
      const value = contents[path];
      if (value == null) throw new Error("二进制文件");
      return value;
    }} saveFile={saveFile}/>);
    fireEvent.click(screen.getByRole("button", { name: /config.yaml/ }));
    await screen.findByText("name: demo");
    fireEvent.click(screen.getByRole("button", { name: "进入编辑" }));
    fireEvent.change(screen.getByLabelText("config.yaml 编辑器"), { target: { value: "name: [" } });

    const beforeUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByText("INVALID_YAML: line 2")).toBeTruthy();
    expect((screen.getByLabelText("config.yaml 编辑器") as HTMLTextAreaElement).value).toBe("name: [");
    expect(screen.getAllByText("未保存").length).toBeGreaterThan(0);
  });

  it("keeps external instances and binary files read-only with accessible management actions", async () => {
    const requestRegister = vi.fn();
    renderEditor(<SkillEditorWorkspace skillId="instance-1" isLibrary={false} files={files} initialContent={contents["SKILL.md"]} readFile={async (path)=>{
      const value = contents[path];
      if (value == null) throw new Error("二进制文件");
      return value;
    }} onRequestRegister={requestRegister}/>);
    expect(screen.queryByRole("button", { name: "进入编辑" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "纳入中央库后编辑" }));
    expect(requestRegister).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /assets\/logo.png/ }));
    expect(await screen.findByText("二进制或不支持的文本格式")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "保存" })).toBeNull();
  });

  it("exposes file, mode and save actions as native keyboard-focusable controls", () => {
    renderEditor(<SkillEditorWorkspace skillId="skill-keyboard" isLibrary files={files} initialContent={contents["SKILL.md"]} readFile={async () => contents["SKILL.md"]} saveFile={vi.fn()}/>);
    const fileButton = screen.getByRole("button", { name: /SKILL\.md/ });
    fileButton.focus();
    expect(document.activeElement).toBe(fileButton);
    expect(fileButton.tabIndex).toBe(0);
    const editButton = screen.getByRole("button", { name: "进入编辑" });
    editButton.focus();
    expect(document.activeElement).toBe(editButton);
    expect(editButton.tabIndex).toBe(0);
  });
});
