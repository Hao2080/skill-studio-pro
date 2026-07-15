/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SkillDetailHeader } from "@/features/skills/components/SkillDetailHeader";

vi.mock("@tauri-apps/plugin-opener", () => ({
  openPath: vi.fn(),
}));

vi.mock("@/features/skills/api/skillsApi", () => ({
  openSkillFolder: vi.fn(),
}));

describe("SkillDetailHeader", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a compact source metadata strip instead of a standalone source card", () => {
    const description =
      "生成真随机的骰子点数，并在需要掷骰、摇骰子或生成不同面数随机结果时提供统一能力入口。";
    const onOpenFiles = vi.fn();
    const onOpenVersions = vi.fn();

    render(
      <SkillDetailHeader
        skill={{
          id: "skill-1",
          name: "roll-dice",
          slug: "roll-dice",
          description,
          sourceType: "local",
          createdAt: 0,
          updatedAt: 1713427200000,
          isArchived: false,
        }}
        primarySource={{
          id: "source-1",
          skillId: "skill-1",
          sourceType: "git_repository",
          sourceLabel: "仓库快照导入",
          sourceRef: "https://github.com/example/roll-dice.git",
          metadataJson: JSON.stringify({ repoSubdir: "skills/roll-dice" }),
          isPrimary: true,
          createdAt: 1713427200000,
          updatedAt: 1713427200000,
        }}
        onBack={vi.fn()}
        onOpenFiles={onOpenFiles}
        onOpenVersions={onOpenVersions}
        onOpenSettings={vi.fn()}
      />,
    );

    const backButton = screen.getByRole("button", { name: "返回技能资产" });
    const title = screen.getByRole("heading", { name: "roll-dice" });
    const summary = screen.getByText(description);
    const metaLine = screen.getByLabelText("技能基础信息");

    expect(backButton.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(title.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(summary.compareDocumentPosition(metaLine) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(summary.getAttribute("title")).toBe(description);
    expect(within(metaLine).getByText("来源方式")).toBeTruthy();
    expect(within(metaLine).getByText("仓库快照导入")).toBeTruthy();
    expect(within(metaLine).getByText("来源仓库")).toBeTruthy();
    expect(within(metaLine).getByText("example/roll-dice")).toBeTruthy();
    expect(within(metaLine).getByText("技能路径")).toBeTruthy();
    expect(within(metaLine).getByText("skills/roll-dice")).toBeTruthy();
    expect(within(metaLine).getByText("更新")).toBeTruthy();
    expect(screen.getByText("查看仓库")).toBeTruthy();
    expect(screen.getByRole("button", { name: /复\s*制/ })).toBeTruthy();
    expect(screen.queryByText("正式来源")).toBeNull();
    expect(screen.queryByLabelText("技能来源记录")).toBeNull();
    expect(screen.queryByRole("button", { name: "创建快照" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "更多" }));

    fireEvent.click(screen.getByText("查看文件"));
    expect(onOpenFiles).toHaveBeenCalledTimes(1);
    expect(screen.getByText("查看版本")).toBeTruthy();
    expect(onOpenVersions).not.toHaveBeenCalled();
  });

  it("prioritizes the local skill identifier and compresses long source paths", () => {
    render(
      <SkillDetailHeader
        skill={{
          id: "skill-2",
          name: "frontend-design",
          slug: "frontend-design",
          description: "Create distinctive frontend interfaces.",
          sourceType: "local",
          createdAt: 0,
          updatedAt: 1713427200000,
          isArchived: false,
        }}
        primarySource={{
          id: "source-2",
          skillId: "skill-2",
          sourceType: "local",
          sourceLabel: "本地目录导入",
          sourcePath: "C:\\Users\\jense\\.codex\\skills\\frontend-design",
          metadataJson: undefined,
          isPrimary: true,
          createdAt: 1713427200000,
          updatedAt: 1713427200000,
        }}
        onBack={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    );

    const metaLine = screen.getByLabelText("技能基础信息");

    expect(within(metaLine).getByText("来源方式")).toBeTruthy();
    expect(within(metaLine).getByText("本地目录导入")).toBeTruthy();
    expect(within(metaLine).getByText("技能标识")).toBeTruthy();
    expect(within(metaLine).getByText("frontend-design")).toBeTruthy();
    expect(within(metaLine).getByText("来源目录")).toBeTruthy();
    expect(within(metaLine).getByText("C:\\...\\skills\\frontend-design")).toBeTruthy();
    expect(screen.getByRole("button", { name: "打开目录" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /复\s*制/ })).toBeTruthy();
  });
});
