/** @vitest-environment jsdom */
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { filterMySkillsItems } from "@/features/skills/components/my-skills/mySkillsViewModel";
import type { MySkillItem } from "@/features/skills/components/my-skills/types";
import { WorkspacePage } from "@/features/skills/pages/WorkspacePage";

vi.setConfig({ testTimeout: 15000 });

const {
  i18nState,
  messageInfoMock,
  messageErrorMock,
  messageWarningMock,
  messageSuccessMock,
  useAppMock,
  modalConfirmMock,
  mockedNavigate,
  getSkillOrganizationSnapshotMock,
  createSkillCollectionMock,
  updateSkillCollectionMock,
  deleteSkillCollectionMock,
  ensureSkillTagsMock,
  updateSkillTagMock,
  deleteSkillTagMock,
  batchApplySkillOrganizationMock,
} = vi.hoisted(() => ({
  i18nState: {
    language: "zh-CN" as "system" | "zh-CN" | "en-US",
    resolvedLanguage: "zh-CN" as "zh-CN" | "en-US",
    antdLocale: {} as object,
    t: vi.fn((key: string) => key),
    setLanguage: vi.fn(),
  },
  messageInfoMock: vi.fn(),
  messageErrorMock: vi.fn(),
  messageWarningMock: vi.fn(),
  messageSuccessMock: vi.fn(),
  modalConfirmMock: vi.fn(),
  mockedNavigate: vi.fn(),
  getSkillOrganizationSnapshotMock: vi.fn().mockRejectedValue(new Error("organization unavailable")),
  createSkillCollectionMock: vi.fn(),
  updateSkillCollectionMock: vi.fn(),
  deleteSkillCollectionMock: vi.fn(),
  ensureSkillTagsMock: vi.fn(),
  updateSkillTagMock: vi.fn(),
  deleteSkillTagMock: vi.fn(),
  batchApplySkillOrganizationMock: vi.fn(),
  useAppMock: vi.fn(() => ({
    message: {
      info: messageInfoMock,
      error: messageErrorMock,
      warning: messageWarningMock,
      success: messageSuccessMock,
    },
    notification: {
      info: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
      open: vi.fn(),
      destroy: vi.fn(),
    },
    modal: {
      confirm: modalConfirmMock,
    },
  })),
}));

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    matches: false,
    media: "",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock("antd/es/app", async () => {
  const actual = await vi.importActual<typeof import("antd/es/app")>("antd/es/app");
  const mockedApp = actual.default;

  mockedApp.useApp = useAppMock as unknown as typeof mockedApp.useApp;

  return {
    __esModule: true,
    default: mockedApp,
  };
});

const skillContextMock: {
  selectedSkillId: string | null;
  skills: Array<Record<string, unknown>>;
  changeStatusMap: Record<string, unknown>;
  selectSkill: ReturnType<typeof vi.fn>;
  importSkill: ReturnType<typeof vi.fn>;
  createSkill: ReturnType<typeof vi.fn>;
  deleteSkill: ReturnType<typeof vi.fn>;
  loadSkills: ReturnType<typeof vi.fn>;
  loadChangeStatuses: ReturnType<typeof vi.fn>;
  loading: boolean;
  error: string | null;
} = {
  selectedSkillId: null,
  skills: [],
  changeStatusMap: {},
  selectSkill: vi.fn(),
  importSkill: vi.fn(),
  createSkill: vi.fn(),
  deleteSkill: vi.fn(),
  loadSkills: vi.fn(),
  loadChangeStatuses: vi.fn(),
  loading: false,
  error: null,
};

vi.mock("@/features/skills/state/SkillContext", () => ({
  useSkillContext: () => skillContextMock,
}));

vi.mock("@/features/settings/state/I18nContext", () => ({
  useI18n: () => i18nState,
}));

vi.mock("@/features/skills/api/organizationApi", () => ({
  getSkillOrganizationSnapshot: getSkillOrganizationSnapshotMock,
  createSkillCollection: createSkillCollectionMock,
  updateSkillCollection: updateSkillCollectionMock,
  deleteSkillCollection: deleteSkillCollectionMock,
  ensureSkillTags: ensureSkillTagsMock,
  updateSkillTag: updateSkillTagMock,
  deleteSkillTag: deleteSkillTagMock,
  batchApplySkillOrganization: batchApplySkillOrganizationMock,
}));

vi.mock("@/features/snapshots/state/SnapshotContext", () => ({
  useSnapshotContext: () => ({
    loadSnapshots: vi.fn(),
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <WorkspacePage />
    </MemoryRouter>,
  );
}

describe("WorkspacePage", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  beforeEach(() => {
    i18nState.language = "zh-CN";
    i18nState.resolvedLanguage = "zh-CN";
    messageInfoMock.mockReset();
    messageErrorMock.mockReset();
    messageWarningMock.mockReset();
    messageSuccessMock.mockReset();
    modalConfirmMock.mockReset();
    mockedNavigate.mockReset();
    getSkillOrganizationSnapshotMock.mockReset();
    createSkillCollectionMock.mockReset();
    updateSkillCollectionMock.mockReset();
    deleteSkillCollectionMock.mockReset();
    ensureSkillTagsMock.mockReset();
    updateSkillTagMock.mockReset();
    deleteSkillTagMock.mockReset();
    batchApplySkillOrganizationMock.mockReset();
    useAppMock.mockClear();
    getSkillOrganizationSnapshotMock.mockRejectedValue(new Error("organization unavailable"));
    window.localStorage.clear();
    Object.assign(skillContextMock, {
      selectedSkillId: null,
      skills: [
        {
          id: "skill-1",
          name: "Writing Assistant",
          slug: "writing-assistant",
          description: "Help draft product copy",
          sourceType: "local",
          createdAt: 10,
          updatedAt: 20,
          isArchived: false,
        },
        {
          id: "skill-2",
          name: "Research Agent",
          slug: "research-agent",
          description: "",
          sourceType: "manual",
          createdAt: 30,
          updatedAt: 40,
          isArchived: false,
        },
      ],
      changeStatusMap: {
        "skill-1": {
          hasChanges: true,
          addedFiles: [],
          deletedFiles: [],
          modifiedFiles: ["README.md"],
        },
      },
      selectSkill: vi.fn(),
      importSkill: vi.fn(),
      createSkill: vi.fn().mockResolvedValue({
        id: "skill-3",
        name: "Ops Agent",
        slug: "ops-agent",
        description: "Handle operational tasks",
        sourceType: "manual",
        createdAt: 50,
        updatedAt: 50,
        isArchived: false,
      }),
      deleteSkill: vi.fn(),
      loadSkills: vi.fn(),
      loadChangeStatuses: vi.fn(),
      loading: false,
      error: null,
    });
  });

  function setStoredAssignments(assignments: Record<string, string | null>) {
    window.localStorage.setItem("skill-studio.my-skills.category-assignments", JSON.stringify(assignments));
  }

  it("opens action menu from skill card", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Writing Assistant 操作" }));

    expect(screen.getByRole("menu")).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "打开技能" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "删除技能" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /移动到分类/ })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "编辑标签" })).toBeTruthy();
  });

  it("keeps the action menu focused on secondary actions only", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Writing Assistant 操作" }));

    expect(screen.queryByRole("menuitem", { name: "打开技能" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "删除技能" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /移动到分类/ })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "编辑标签" })).toBeTruthy();
  });

  it("opens skill from card surface and navigates to skill detail", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "打开 Writing Assistant" }));

    expect(skillContextMock.selectSkill).toHaveBeenCalledWith("skill-1");
    expect(mockedNavigate).toHaveBeenCalledWith("/workspace/skill-1");
  });

  it("opens skill from list row and navigates to skill detail", () => {
    const { container } = renderPage();

    fireEvent.click(screen.getByRole("radio", { name: "列表" }));
    const tableWrap = container.querySelector(".my-skills-table-wrap");
    expect(tableWrap).toBeTruthy();
    fireEvent.click(within(tableWrap as HTMLElement).getByText("Writing Assistant").closest("tr") as HTMLElement);

    expect(skillContextMock.selectSkill).toHaveBeenCalledWith("skill-1");
    expect(mockedNavigate).toHaveBeenCalledWith("/workspace/skill-1");
  });

  it("keeps slug hidden in both card and list mode and only shows the title in list rows", () => {
    renderPage();

    expect(screen.queryByText("writing-assistant")).toBeNull();
    expect(screen.getByText("Help draft product copy")).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: "列表" }));

    expect(screen.queryByText("writing-assistant")).toBeNull();
    expect(screen.queryByText("Help draft product copy")).toBeNull();
  });

  it("prioritizes category and status chips on cards instead of technical fields", () => {
    renderPage();

    const card = screen.getByRole("button", { name: "打开 Writing Assistant" }).closest(".my-skill-card");
    expect(card).toBeTruthy();
    expect(within(card as HTMLElement).getByText("未分类")).toBeTruthy();
    expect(within(card as HTMLElement).getByText("有改动")).toBeTruthy();
    expect(within(card as HTMLElement).getByText("本地目录")).toBeTruthy();
    expect(within(card as HTMLElement).queryByText("writing-assistant")).toBeNull();
  });

  it("keeps the tag area stable and collapses overflow tags on cards", () => {
    window.localStorage.setItem("skill-studio.my-skills.tags", JSON.stringify(["Automation", "Writing", "Ops"]));
    window.localStorage.setItem(
      "skill-studio.my-skills.tag-assignments",
      JSON.stringify({
        "skill-1": ["Automation", "Writing", "Ops"],
      }),
    );

    renderPage();

    const card = screen.getByRole("button", { name: "打开 Writing Assistant" }).closest(".my-skill-card");
    expect(card).toBeTruthy();
    expect(within(card as HTMLElement).getByText("Automation")).toBeTruthy();
    expect(within(card as HTMLElement).getByText("Writing")).toBeTruthy();
    expect(within(card as HTMLElement).getByText("+1")).toBeTruthy();
    expect(within(card as HTMLElement).queryByText("Ops")).toBeNull();
  });

  it("keeps list mode status column aligned with category labels", () => {
    const { container } = renderPage();

    fireEvent.click(screen.getByRole("radio", { name: "列表" }));

    const tableWrap = container.querySelector(".my-skills-table-wrap");
    expect(tableWrap).toBeTruthy();
    expect(within(tableWrap as HTMLElement).getAllByText("未分类").length).toBeGreaterThan(0);
    expect(within(tableWrap as HTMLElement).getByText("有改动")).toBeTruthy();
    expect(within(tableWrap as HTMLElement).getByText("Writing Assistant")).toBeTruthy();
    expect(within(tableWrap as HTMLElement).queryByText("writing-assistant")).toBeNull();
  });

  it("uses the productized missing-description language in card and list views", () => {
    const { container } = renderPage();

    const researchCard = screen.getByRole("button", { name: "打开 Research Agent" }).closest(".my-skill-card");
    expect(researchCard).toBeTruthy();
    expect(within(researchCard as HTMLElement).getByText("待补描述")).toBeTruthy();
    expect(within(researchCard as HTMLElement).getByText("补充描述后更容易检索和维护。")).toBeTruthy();
    expect(within(researchCard as HTMLElement).queryByText("暂无描述")).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "列表" }));

    const tableWrap = container.querySelector(".my-skills-table-wrap");
    expect(tableWrap).toBeTruthy();
    expect(within(tableWrap as HTMLElement).getByText("待补描述")).toBeTruthy();
  });

  it("shows delete confirmation before removing skill", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Writing Assistant 操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "删除技能" }));

    expect(modalConfirmMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "删除技能",
      }),
    );
    expect(skillContextMock.deleteSkill).not.toHaveBeenCalled();
  });

  it("shows english delete confirmation when ui language is english", () => {
    i18nState.language = "en-US";
    i18nState.resolvedLanguage = "en-US";

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Writing Assistant actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete Skill" }));

    expect(modalConfirmMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Delete Skill",
        content: "Are you sure you want to delete Writing Assistant? This action cannot be undone.",
        okText: "Delete",
        cancelText: "Cancel",
      }),
    );
  });

  it("deletes skill after confirmation", async () => {
    modalConfirmMock.mockImplementation(async ({ onOk }) => {
      await onOk?.();
    });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Writing Assistant 操作" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "删除技能" }));

    expect(skillContextMock.deleteSkill).toHaveBeenCalledWith("skill-1");
  });

  it("renders a lean header without helper copy and keeps category navigation focused on categories only", () => {
    renderPage();

    const header = document.querySelector(".my-skills-header");
    const categoryBar = document.querySelector(".my-skills-category-bar");
    expect(header).toBeTruthy();
    expect(categoryBar).toBeTruthy();
    expect(within(header as HTMLElement).getByRole("heading", { name: "技能资产" })).toBeTruthy();
    expect(within(header as HTMLElement).queryByText("管理你创建与导入的技能资产，保持结构清晰，方便后续检索和维护。")).toBeNull();
    expect(within(header as HTMLElement).getByRole("button", { name: "新建技能" })).toBeTruthy();
    expect(within(header as HTMLElement).getByRole("button", { name: "导入技能" })).toBeTruthy();
    expect(within(header as HTMLElement).getByRole("button", { name: "新建分类" })).toBeTruthy();
    expect(within(header as HTMLElement).getByRole("button", { name: "组织管理" })).toBeTruthy();
    expect(within(categoryBar as HTMLElement).queryByRole("group", { name: "状态筛选" })).toBeNull();
    expect(within(categoryBar as HTMLElement).queryByText("待补描述")).toBeNull();
    expect(within(categoryBar as HTMLElement).queryByText("有改动")).toBeNull();
    expect(within(header as HTMLElement).queryByText("当前资产总量")).toBeNull();
    expect(within(header as HTMLElement).queryByRole("group", { name: "技能快速筛选" })).toBeNull();
    expect(document.querySelector(".my-skills-header__subtitle")).toBeNull();
    expect(document.querySelector(".my-skills-header__summary")).toBeNull();
    expect(document.querySelector(".my-skills-header__filters")).toBeNull();
    expect(screen.queryByText("建议先处理")).toBeNull();
    expect(screen.getByText("筛选标签")).toBeTruthy();
  });

  it("uses App.useApp message API for header actions", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /导入技能/ }));

    expect(useAppMock).toHaveBeenCalled();
    expect(skillContextMock.importSkill).toHaveBeenCalledTimes(1);
    expect(messageInfoMock).not.toHaveBeenCalled();
  });

  it("opens create skill modal and submits real creation", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /新建技能/ }));

    expect(screen.getByRole("dialog", { name: "新建技能" })).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("输入技能名称"), { target: { value: "Ops Agent" } });
    fireEvent.change(screen.getByPlaceholderText("输入技能描述（可选）"), { target: { value: "Handle operational tasks" } });
    fireEvent.click(document.querySelector(".ant-modal .ant-btn-primary") as HTMLButtonElement);

    expect(skillContextMock.createSkill).toHaveBeenCalledWith({
      name: "Ops Agent",
      description: "Handle operational tasks",
    });
  });

  it("opens category modal and adds a new category tab", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "新建分类" }));

    expect(screen.getByRole("dialog", { name: "新建分类" })).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("输入分类名称"), { target: { value: "Research" } });
    fireEvent.click(screen.getByRole("button", { name: "创建分类" }));

    expect(screen.getByRole("tab", { name: /Research/ })).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem("skill-studio.my-skills.categories") ?? "[]")).toContain("Research");
  });

  it("opens category manager from header action", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "组织管理" }));

    const dialog = screen.getByRole("dialog", { name: "组织管理" });
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByText("还没有自定义分类。")).toBeTruthy();
    expect(within(dialog).queryByText("全部")).toBeNull();
    expect(within(dialog).queryByText("未分类")).toBeNull();
    expect(within(dialog).getByText("统一管理主分类与标签")).toBeTruthy();
  });

  it("renders manage categories modal in english when ui language is english", () => {
    i18nState.language = "en-US";
    i18nState.resolvedLanguage = "en-US";

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Organization" }));

    const dialog = screen.getByRole("dialog", { name: "Organization" });
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByText("Skill Organization")).toBeTruthy();
    expect(within(dialog).getByText("Manage primary categories and tags together")).toBeTruthy();
    expect(within(dialog).getByRole("radio", { name: /Primary Categories 0/ })).toBeTruthy();
    expect(within(dialog).getByRole("radio", { name: /Tags 0/ })).toBeTruthy();
    expect(within(dialog).getByText("No custom categories yet.")).toBeTruthy();
  });

  it("renames a custom category from category manager", () => {
    window.localStorage.setItem("skill-studio.my-skills.categories", JSON.stringify(["Research"]));

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "组织管理" }));
    fireEvent.click(screen.getByRole("button", { name: "重命名" }));
    fireEvent.change(screen.getByRole("textbox", { name: "编辑分类 Research" }), { target: { value: "Strategy" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(JSON.parse(window.localStorage.getItem("skill-studio.my-skills.categories") ?? "[]")).toContain("Strategy");
    expect(screen.getByRole("tab", { name: /Strategy/ })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /Research/ })).toBeNull();
  }, 15000);

  it("creates and renames tags from the organization manager in local mode", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "组织管理" }));
    fireEvent.click(screen.getByRole("radio", { name: /标签 0/ }));
    fireEvent.change(screen.getByPlaceholderText("输入新标签名称"), { target: { value: "Automation" } });
    fireEvent.click(screen.getByRole("button", { name: "新增标签" }));

    expect(JSON.parse(window.localStorage.getItem("skill-studio.my-skills.tags") ?? "[]")).toContain("Automation");
    expect(screen.getByText("已关联 0 个技能")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "重命名" }));
    fireEvent.change(screen.getByRole("textbox", { name: "编辑标签 Automation" }), { target: { value: "Ops" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(JSON.parse(window.localStorage.getItem("skill-studio.my-skills.tags") ?? "[]")).toContain("Ops");
    expect(JSON.parse(window.localStorage.getItem("skill-studio.my-skills.tags") ?? "[]")).not.toContain("Automation");
  }, 30_000);

  it("removes local tags and clears tag assignments from skills", async () => {
    window.localStorage.setItem("skill-studio.my-skills.tags", JSON.stringify(["Automation"]));
    window.localStorage.setItem(
      "skill-studio.my-skills.tag-assignments",
      JSON.stringify({
        "skill-1": ["Automation"],
      }),
    );
    modalConfirmMock.mockImplementation(async ({ onOk }) => {
      await onOk?.();
    });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "组织管理" }));
    fireEvent.click(screen.getByRole("radio", { name: /标签 1/ }));
    fireEvent.click(screen.getByRole("button", { name: "删除" }));

    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem("skill-studio.my-skills.tags") ?? "[]")).not.toContain("Automation");
    });

    expect(JSON.parse(window.localStorage.getItem("skill-studio.my-skills.tag-assignments") ?? "{}")).toEqual({
      "skill-1": [],
    });
  });

  it("keeps more visible as the trailing category entry even when custom categories fit", () => {
    Object.assign(skillContextMock, {
      skills: [
        {
          id: "skill-1",
          name: "Writing Assistant",
          slug: "writing-assistant",
          description: "Help draft product copy",
          sourceType: "local",
          createdAt: 10,
          updatedAt: 20,
          isArchived: false,
        },
        {
          id: "skill-2",
          name: "Research Agent",
          slug: "research-agent",
          description: "",
          sourceType: "manual",
          createdAt: 30,
          updatedAt: 40,
          isArchived: false,
        },
        {
          id: "skill-3",
          name: "Design Critic",
          slug: "design-critic",
          description: "Review visual systems",
          sourceType: "manual",
          createdAt: 50,
          updatedAt: 60,
          isArchived: false,
        },
        {
          id: "skill-4",
          name: "Ops Agent",
          slug: "ops-agent",
          description: "Keep operations stable",
          sourceType: "manual",
          createdAt: 70,
          updatedAt: 80,
          isArchived: false,
        },
      ],
    });
    window.localStorage.setItem("skill-studio.my-skills.categories", JSON.stringify(["Research", "Design", "Ops", "Prompt"]));
    setStoredAssignments({
      "skill-1": "Research",
      "skill-2": "Design",
      "skill-3": "Ops",
      "skill-4": "Prompt",
    });

    renderPage();

    expect(screen.getByRole("tab", { name: /全部/ }).textContent).toContain("4");
    expect(screen.getByRole("tab", { name: /未分类/ }).textContent).toContain("0");
    expect(screen.getByRole("tab", { name: /Research/ }).textContent).toContain("1");
    expect(screen.getByRole("tab", { name: /Prompt/ }).textContent).toContain("1");
    expect(screen.getByRole("button", { name: "更多" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    expect(screen.getByRole("menuitem", { name: /Research/ })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /Prompt/ })).toBeTruthy();
  });

  it("shows more menu for overflow categories and updates content title when selecting a hidden category", () => {
    Object.assign(skillContextMock, {
      skills: [
        {
          id: "skill-1",
          name: "Writing Assistant",
          slug: "writing-assistant",
          description: "Help draft product copy",
          sourceType: "local",
          createdAt: 10,
          updatedAt: 20,
          isArchived: false,
        },
        {
          id: "skill-2",
          name: "Research Agent",
          slug: "research-agent",
          description: "",
          sourceType: "manual",
          createdAt: 30,
          updatedAt: 40,
          isArchived: false,
        },
        {
          id: "skill-3",
          name: "Design Critic",
          slug: "design-critic",
          description: "Review visual systems",
          sourceType: "manual",
          createdAt: 50,
          updatedAt: 60,
          isArchived: false,
        },
        {
          id: "skill-4",
          name: "Ops Agent",
          slug: "ops-agent",
          description: "Keep operations stable",
          sourceType: "manual",
          createdAt: 70,
          updatedAt: 80,
          isArchived: false,
        },
        {
          id: "skill-5",
          name: "Archive Keeper",
          slug: "archive-keeper",
          description: "Handle long-tail storage",
          sourceType: "manual",
          createdAt: 90,
          updatedAt: 100,
          isArchived: false,
        },
      ],
    });
    window.localStorage.setItem("skill-studio.my-skills.categories", JSON.stringify(["Research", "Design", "Ops", "Prompt", "Archive"]));
    setStoredAssignments({
      "skill-1": "Research",
      "skill-2": "Design",
      "skill-3": "Ops",
      "skill-4": "Prompt",
      "skill-5": "Archive",
    });

    const { container } = renderPage();

    expect(screen.getByRole("tab", { name: /全部/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /未分类/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Research/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Design/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Ops/ })).toBeTruthy();
    const moreButton = screen.getByRole("button", { name: "更多" });
    expect(moreButton.textContent).toBe("更多");
    fireEvent.click(moreButton);
    expect(document.querySelector(".my-skills-category-bar__dropdown .ant-dropdown-menu")).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "组织管理" })).toBeNull();
    fireEvent.click(screen.getByRole("menuitem", { name: /Archive/ }));

    const gridHeader = container.querySelector(".my-skills-grid__header");
    expect(gridHeader).toBeTruthy();
    expect(within(gridHeader as HTMLElement).getByRole("heading", { name: "Archive" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /更多/ }).className).toContain("is-active");
  });

  it("shows result count in the results header instead of the toolbar", () => {
    const { container } = renderPage();

    const toolbar = container.querySelector(".my-skills-toolbar");
    const gridHeader = container.querySelector(".my-skills-grid__header");
    const viewport = container.querySelector(".my-skills-grid__viewport");
    expect(toolbar).toBeTruthy();
    expect(gridHeader).toBeTruthy();
    expect(viewport).toBeTruthy();
    expect(within(gridHeader as HTMLElement).getByText("2 项")).toBeTruthy();
    expect(within(toolbar as HTMLElement).queryByText("2 个结果")).toBeNull();
    expect(within(toolbar as HTMLElement).queryByText("当前范围")).toBeNull();
    expect(container.querySelector(".my-skills-grid__context")).toBeNull();
  });

  it("deletes an active hidden category and falls back to unclassified", async () => {
    modalConfirmMock.mockImplementation(async ({ onOk }) => {
      await onOk?.();
    });
    Object.assign(skillContextMock, {
      skills: [
        {
          id: "skill-1",
          name: "Writing Assistant",
          slug: "writing-assistant",
          description: "Help draft product copy",
          sourceType: "local",
          createdAt: 10,
          updatedAt: 20,
          isArchived: false,
        },
        {
          id: "skill-2",
          name: "Research Agent",
          slug: "research-agent",
          description: "",
          sourceType: "manual",
          createdAt: 30,
          updatedAt: 40,
          isArchived: false,
        },
        {
          id: "skill-3",
          name: "Design Critic",
          slug: "design-critic",
          description: "Review visual systems",
          sourceType: "manual",
          createdAt: 50,
          updatedAt: 60,
          isArchived: false,
        },
        {
          id: "skill-4",
          name: "Ops Agent",
          slug: "ops-agent",
          description: "Keep operations stable",
          sourceType: "manual",
          createdAt: 70,
          updatedAt: 80,
          isArchived: false,
        },
        {
          id: "skill-5",
          name: "Archive Keeper",
          slug: "archive-keeper",
          description: "Handle long-tail storage",
          sourceType: "manual",
          createdAt: 90,
          updatedAt: 100,
          isArchived: false,
        },
      ],
    });
    window.localStorage.setItem("skill-studio.my-skills.categories", JSON.stringify(["Research", "Design", "Ops", "Prompt", "Archive"]));
    setStoredAssignments({
      "skill-1": "Research",
      "skill-2": "Design",
      "skill-3": "Ops",
      "skill-4": "Prompt",
      "skill-5": "Archive",
    });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /更多/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Archive/ }));
    fireEvent.click(screen.getByRole("button", { name: "组织管理" }));

    const dialog = screen.getByRole("dialog", { name: "组织管理" });
    const row = within(dialog).getByText("Archive").closest(".ant-list-item");
    expect(row).toBeTruthy();
    fireEvent.click(within(row as HTMLElement).getByRole("button", { name: "删除" }));

    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem("skill-studio.my-skills.categories") ?? "[]")).not.toContain("Archive");
    });

    expect(screen.queryByRole("menuitem", { name: "Archive" })).toBeNull();
    expect(screen.getByRole("tab", { name: /未分类/ }).getAttribute("aria-selected")).toBe("true");
  });

  it("keeps toolbar focused on search, tag filter, sort, and view controls only", () => {
    const { container } = renderPage();

    const toolbar = container.querySelector(".my-skills-toolbar");
    expect(toolbar).toBeTruthy();
    expect(within(toolbar as HTMLElement).getByPlaceholderText("搜索名称、描述或标签")).toBeTruthy();
    expect(within(toolbar as HTMLElement).queryByText("当前范围")).toBeNull();
    expect(within(toolbar as HTMLElement).queryByRole("button", { name: "清除筛选" })).toBeNull();
    expect(within(toolbar as HTMLElement).getByText("筛选标签")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("搜索名称、描述或标签"), { target: { value: "Writing" } });

    const selector = container.querySelector(".my-skills-toolbar__field--sort .ant-select-selector");
    expect(selector).toBeTruthy();
    fireEvent.mouseDown(selector as HTMLElement);
    fireEvent.click(screen.getByText("名称 A-Z"));

    expect((screen.getByPlaceholderText("搜索名称、描述或标签") as HTMLInputElement).value).toBe("Writing");
    expect(container.querySelector(".my-skills-toolbar__field--sort .ant-select-selection-item")?.textContent).toBe("名称 A-Z");
  });

  it("moves the sort feedback to the skill header when sorting by name", () => {
    const { container } = renderPage();

    const selector = container.querySelector(".my-skills-toolbar__field--sort .ant-select-selector");
    expect(selector).toBeTruthy();
    fireEvent.mouseDown(selector as HTMLElement);
    fireEvent.click(screen.getByText("名称 A-Z"));
    fireEvent.click(screen.getByRole("radio", { name: "列表" }));

    const skillHeader = screen.getByRole("columnheader", { name: "技能" });
    const updatedHeader = screen.getByRole("columnheader", { name: "最近更新" });

    expect(skillHeader.getAttribute("aria-sort")).toBe("ascending");
    expect(updatedHeader.getAttribute("aria-sort")).toBeNull();
  });

  it("syncs the toolbar sort selector when clicking the skill header control", () => {
    const { container } = renderPage();

    fireEvent.click(screen.getByRole("radio", { name: "列表" }));
    fireEvent.click(screen.getByRole("button", { name: "按技能名称排序" }));

    expect(screen.getByRole("columnheader", { name: "技能" }).getAttribute("aria-sort")).toBe("ascending");
    expect(container.querySelector(".my-skills-toolbar__field--sort .ant-select-selection-item")?.textContent).toBe("名称 A-Z");

    fireEvent.click(screen.getByRole("button", { name: "按技能名称排序" }));

    expect(screen.getByRole("columnheader", { name: "技能" }).getAttribute("aria-sort")).toBe("descending");
    expect(container.querySelector(".my-skills-toolbar__field--sort .ant-select-selection-item")?.textContent).toBe("名称 Z-A");
  });

  it("syncs the toolbar sort selector when clicking the updated header control", () => {
    const { container } = renderPage();

    const selector = container.querySelector(".my-skills-toolbar__field--sort .ant-select-selector");
    expect(selector).toBeTruthy();
    fireEvent.mouseDown(selector as HTMLElement);
    fireEvent.click(screen.getByText("名称 A-Z"));
    fireEvent.click(screen.getByRole("radio", { name: "列表" }));
    fireEvent.click(screen.getByRole("button", { name: "按最近更新排序" }));

    expect(screen.getByRole("columnheader", { name: "最近更新" }).getAttribute("aria-sort")).toBe("descending");
    expect(container.querySelector(".my-skills-toolbar__field--sort .ant-select-selection-item")?.textContent).toBe("最近更新");

    fireEvent.click(screen.getByRole("button", { name: "按最近更新排序" }));

    expect(screen.getByRole("columnheader", { name: "最近更新" }).getAttribute("aria-sort")).toBe("ascending");
    expect(container.querySelector(".my-skills-toolbar__field--sort .ant-select-selection-item")?.textContent).toBe("最早更新");
  }, 15000);

  it("shows create and import actions in the no-skills empty state", () => {
    Object.assign(skillContextMock, {
      skills: [],
      changeStatusMap: {},
    });

    const { container } = renderPage();

    const emptyState = container.querySelector(".my-skills-grid__empty");
    expect(emptyState).toBeTruthy();
    expect(within(emptyState as HTMLElement).getByRole("button", { name: "新建技能" })).toBeTruthy();
    expect(within(emptyState as HTMLElement).getByRole("button", { name: "导入技能" })).toBeTruthy();
  });

  it("shows filter summary in result header without rendering a clear-filters button", () => {
    const { container } = renderPage();

    fireEvent.change(screen.getByPlaceholderText("搜索名称、描述或标签"), { target: { value: "missing" } });

    const gridHeader = container.querySelector(".my-skills-grid__header");
    const emptyState = container.querySelector(".my-skills-grid__empty");
    const toolbar = container.querySelector(".my-skills-toolbar");
    expect(gridHeader).toBeTruthy();
    expect(emptyState).toBeTruthy();
    expect(within(gridHeader as HTMLElement).getByText('筛选条件：关键词 "missing"')).toBeTruthy();
    expect(within(toolbar as HTMLElement).queryByRole("button", { name: "清除筛选" })).toBeNull();
    expect(within(emptyState as HTMLElement).queryByRole("button", { name: "清除筛选" })).toBeNull();
  });

  it("includes tags in keyword search results", () => {
    window.localStorage.setItem("skill-studio.my-skills.tags", JSON.stringify(["Automation"]));
    window.localStorage.setItem(
      "skill-studio.my-skills.tag-assignments",
      JSON.stringify({
        "skill-1": ["Automation"],
      }),
    );

    renderPage();

    fireEvent.change(screen.getByPlaceholderText("搜索名称、描述或标签"), { target: { value: "Automation" } });

    expect(screen.getByText('筛选条件：关键词 "Automation"')).toBeTruthy();
    expect(screen.getByRole("button", { name: "打开 Writing Assistant" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "打开 Research Agent" })).toBeNull();
  });

  it("shows return-all action for empty categories", () => {
    window.localStorage.setItem("skill-studio.my-skills.categories", JSON.stringify(["Research"]));

    const { container } = renderPage();

    fireEvent.click(screen.getByRole("tab", { name: /Research/ }));

    const emptyState = container.querySelector(".my-skills-grid__empty");
    expect(emptyState).toBeTruthy();
    fireEvent.click(within(emptyState as HTMLElement).getByRole("button", { name: "返回全部" }));

    expect(screen.getByRole("tab", { name: /全部/ }).getAttribute("aria-selected")).toBe("true");
  });

  it("uses a product shell with header, browse controls, and grid only", () => {
    const { container } = renderPage();

    expect(container.querySelector(".my-skills-page__workspace")).toBeTruthy();
    expect(container.querySelector(".my-skills-page__controls")).toBeTruthy();
    expect(container.querySelector(".my-skills-grid")).toBeTruthy();
    expect(container.querySelector(".my-skills-grid__content")).toBeNull();
    expect(container.querySelector(".my-skills-grid__viewport")).toBeTruthy();
    expect(container.querySelector(".my-skills-grid__context")).toBeNull();
    expect(container.querySelector(".my-skills-header__filters")).toBeNull();
    expect(container.querySelector(".my-skills-category-bar__signals")).toBeNull();
    expect(container.querySelector(".my-skills-toolbar__context")).toBeNull();
    expect(container.querySelector(".my-skills-header__status")).toBeNull();
    expect(container.querySelector(".my-skills-header__summary")).toBeNull();
    expect(container.querySelector(".my-skills-page__summary")).toBeNull();
    expect(container.querySelector(".my-skills-page__statusline")).toBeNull();
    expect(container.querySelector(".my-skills-page__body > .my-skills-highlights-section")).toBeNull();
  });

  it("keeps list mode under the same sticky results frame and retains the table header", () => {
    const { container } = renderPage();

    fireEvent.click(screen.getByRole("radio", { name: "列表" }));

    expect(container.querySelector(".my-skills-grid__content")).toBeNull();
    expect(container.querySelector(".my-skills-grid__viewport--list")).toBeTruthy();
    expect(container.querySelector(".my-skills-table-wrap")).toBeTruthy();
    expect(container.querySelector(".my-skills-table thead")).toBeTruthy();
    expect(within(container.querySelector(".my-skills-table thead") as HTMLElement).getByText("更多")).toBeTruthy();

    const updatedHeader = screen.getByRole("columnheader", { name: "最近更新" });
    expect(updatedHeader.getAttribute("aria-sort")).toBe("descending");

    const viewport = container.querySelector(".my-skills-grid__viewport--list") as HTMLElement;
    const tableWrap = container.querySelector(".my-skills-table-wrap") as HTMLElement;
    expect(tableWrap.className).not.toContain("is-sticky-active");

    Object.defineProperty(viewport, "scrollTop", { configurable: true, value: 28, writable: true });
    fireEvent.scroll(viewport);

    expect(tableWrap.className).toContain("is-sticky-active");
  });
});

describe("filterMySkillsItems", () => {
  it("sorts by recently imported using createdAt descending", () => {
    const items: MySkillItem[] = [
      {
        id: "skill-1",
        name: "Older import",
        slug: "older-import",
        description: "Older import",
        sourceType: "local",
        updatedAt: 50,
        createdAt: 10,
        isArchived: false,
        hasChanges: false,
        category: null,
        tags: [],
        needsDescription: false,
      },
      {
        id: "skill-2",
        name: "Newer import",
        slug: "newer-import",
        description: "Newer import",
        sourceType: "local",
        updatedAt: 20,
        createdAt: 100,
        isArchived: false,
        hasChanges: false,
        category: null,
        tags: [],
        needsDescription: false,
      },
    ];

    const result = filterMySkillsItems(items, "All", "", "recently-imported" as unknown as Parameters<typeof filterMySkillsItems>[3]);

    expect(result.map((item) => item.id)).toEqual(["skill-2", "skill-1"]);
  });

  it("sorts by updated ascending when requested", () => {
    const items: MySkillItem[] = [
      {
        id: "skill-1",
        name: "Later updated",
        slug: "later-updated",
        description: "Later updated",
        sourceType: "local",
        updatedAt: 80,
        createdAt: 10,
        isArchived: false,
        hasChanges: false,
        category: null,
        tags: [],
        needsDescription: false,
      },
      {
        id: "skill-2",
        name: "Earlier updated",
        slug: "earlier-updated",
        description: "Earlier updated",
        sourceType: "local",
        updatedAt: 20,
        createdAt: 100,
        isArchived: false,
        hasChanges: false,
        category: null,
        tags: [],
        needsDescription: false,
      },
    ];

    const result = filterMySkillsItems(items, "All", "", "updated-asc");

    expect(result.map((item) => item.id)).toEqual(["skill-2", "skill-1"]);
  });
});
