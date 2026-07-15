/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformsPage } from "@/features/platforms/pages/PlatformsPage";
import type { PlatformConnection, PlatformGovernanceImpact } from "@/types/skill";

const {
  i18nState,
  messageErrorMock,
  messageSuccessMock,
  messageWarningMock,
  modalConfirmMock,
  useAppMock,
  listPlatformConnectionsMock,
  getPlatformGovernanceImpactMock,
  savePlatformConnectionMock,
  createCustomPlatformMock,
  deleteCustomPlatformMock,
  testPlatformPathMock,
  pickPlatformDirectoryMock,
} = vi.hoisted(() => ({
  i18nState: {
    language: "zh-CN" as "system" | "zh-CN" | "en-US",
    resolvedLanguage: "zh-CN" as "zh-CN" | "en-US",
    antdLocale: {} as object,
    t: vi.fn((key: string) => key),
    setLanguage: vi.fn(),
  },
  messageErrorMock: vi.fn(),
  messageSuccessMock: vi.fn(),
  messageWarningMock: vi.fn(),
  modalConfirmMock: vi.fn(),
  listPlatformConnectionsMock: vi.fn(),
  getPlatformGovernanceImpactMock: vi.fn(),
  savePlatformConnectionMock: vi.fn(),
  createCustomPlatformMock: vi.fn(),
  deleteCustomPlatformMock: vi.fn(),
  testPlatformPathMock: vi.fn(),
  pickPlatformDirectoryMock: vi.fn(),
  useAppMock: vi.fn(() => ({
    message: {
      error: messageErrorMock,
      success: messageSuccessMock,
      warning: messageWarningMock,
    },
    modal: {
      confirm: modalConfirmMock,
    },
  })),
}));

vi.mock("antd/es/app", async () => {
  const actual = await vi.importActual<typeof import("antd/es/app")>("antd/es/app");
  const mockedApp = actual.default;

  mockedApp.useApp = useAppMock as unknown as typeof mockedApp.useApp;

  return {
    __esModule: true,
    default: mockedApp,
  };
});

vi.mock("@/features/platforms/api/platformsApi", () => ({
  listPlatformConnections: listPlatformConnectionsMock,
  getPlatformGovernanceImpact: getPlatformGovernanceImpactMock,
  savePlatformConnection: savePlatformConnectionMock,
  createCustomPlatform: createCustomPlatformMock,
  deleteCustomPlatform: deleteCustomPlatformMock,
  testPlatformPath: testPlatformPathMock,
  pickPlatformDirectory: pickPlatformDirectoryMock,
}));

vi.mock("@/features/settings/state/I18nContext", () => ({
  useI18n: () => i18nState,
}));

const basePlatforms: PlatformConnection[] = [
  {
    id: "platform-claude",
    platformName: "claude",
    displayName: "Claude Code",
    platformType: "built_in",
    detected: true,
    enabled: true,
    skillsDir: "C:/Users/demo/.claude/skills",
    detectDir: "C:/Users/demo/.claude",
    syncMode: "symlink",
    supportsProjectScope: false,
    supportsSymlink: true,
    supportsCopy: true,
  },
  {
    id: "platform-qwen",
    platformName: "qwen_code",
    displayName: "Qwen Code",
    platformType: "built_in",
    detected: true,
    enabled: false,
    skillsDir: "C:/Users/demo/.qwen/skills",
    detectDir: "C:/Users/demo/.qwen",
    syncMode: "copy",
    supportsProjectScope: false,
    supportsSymlink: true,
    supportsCopy: true,
  },
  {
    id: "platform-hermes",
    platformName: "hermes",
    displayName: "Hermes Agent",
    platformType: "built_in",
    detected: false,
    enabled: false,
    skillsDir: "C:/Users/demo/.hermes/skills",
    detectDir: "C:/Users/demo/.hermes",
    syncMode: "copy",
    supportsProjectScope: false,
    supportsSymlink: true,
    supportsCopy: true,
  },
  {
    id: "platform-studio",
    platformName: "studio_internal",
    displayName: "Studio Internal Agents",
    platformType: "custom",
    detected: true,
    enabled: true,
    skillsDir: "D:/AgentStudio/internal-skills",
    detectDir: "D:/AgentStudio/internal-skills",
    syncMode: "copy",
    supportsProjectScope: true,
    supportsSymlink: true,
    supportsCopy: true,
  },
];

const baseGovernanceImpact: PlatformGovernanceImpact = {
  platformName: "claude",
  displayName: "Claude Code",
  globalReleaseCount: 1,
  projectConnectionCount: 2,
  enabledProjectConnectionCount: 1,
  assignmentCount: 3,
  enabledAssignmentCount: 2,
  affectedProjects: ["项目一", "项目二"],
};

function renderPage() {
  return render(<PlatformsPage />);
}

function hasExactTextContent(expectedText: string) {
  return (_content: string, node: Element | null) =>
    node?.textContent?.replace(/\s+/g, "") === expectedText;
}

describe("PlatformsPage", () => {
  beforeEach(() => {
    i18nState.language = "zh-CN";
    i18nState.resolvedLanguage = "zh-CN";
    messageErrorMock.mockReset();
    messageSuccessMock.mockReset();
    messageWarningMock.mockReset();
    modalConfirmMock.mockReset();
    useAppMock.mockClear();
    listPlatformConnectionsMock.mockReset();
    getPlatformGovernanceImpactMock.mockReset();
    savePlatformConnectionMock.mockReset();
    createCustomPlatformMock.mockReset();
    deleteCustomPlatformMock.mockReset();
    testPlatformPathMock.mockReset();
    pickPlatformDirectoryMock.mockReset();
    listPlatformConnectionsMock.mockResolvedValue(basePlatforms);
    getPlatformGovernanceImpactMock.mockResolvedValue(baseGovernanceImpact);
    savePlatformConnectionMock.mockImplementation(async (input) => {
      const currentPlatform = basePlatforms.find(
        (platform) => platform.platformName === input.platformName,
      );

      if (!currentPlatform) {
        throw new Error(`mock 平台不存在: ${input.platformName}`);
      }

      return {
        ...currentPlatform,
        enabled: input.enabled,
        skillsDir: input.skillsDir ?? currentPlatform.skillsDir,
        syncMode: input.syncMode ?? currentPlatform.syncMode,
      } satisfies PlatformConnection;
    });
    deleteCustomPlatformMock.mockResolvedValue(undefined);
    testPlatformPathMock.mockResolvedValue({
      ok: true,
      normalizedPath: "D:/AgentStudio/preview-skills",
      exists: true,
      isDirectory: true,
      message: "目录可用",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("按接入状态分组展示平台，并优先显示展示名", async () => {
    renderPage();

    await waitFor(() => expect(listPlatformConnectionsMock).toHaveBeenCalledTimes(1));

    expect(screen.getByText("平台中心")).toBeTruthy();
    expect(screen.getByText("Claude Code")).toBeTruthy();
    expect(screen.queryByText("Qwen Code")).toBeNull();
    expect(screen.queryByText("Hermes Agent")).toBeNull();
    expect(screen.queryByText("平台治理")).toBeNull();
    expect(screen.queryByText("当前工作流平台")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "查看配置" }));

    expect(screen.getByRole("button", { name: "保存配置" })).toBeTruthy();

    fireEvent.click(screen.getByText("待启用"));

    await waitFor(() => {
      expect(screen.getByText("Qwen Code")).toBeTruthy();
    });
  }, 10000);

  it("支持按平台标识搜索，并保留展示名输出", async () => {
    renderPage();

    await screen.findByText("Claude Code");

    fireEvent.click(screen.getByText("全部"));

    fireEvent.change(screen.getByPlaceholderText("搜索平台名称、标识或目录"), {
      target: { value: "qwen_code" },
    });

    await waitFor(() => {
      expect(screen.getByText("Qwen Code")).toBeTruthy();
    });

    expect(screen.queryByText("Claude Code")).toBeNull();
    expect(screen.queryByText("Hermes Agent")).toBeNull();
    expect(screen.queryByText("Studio Internal Agents")).toBeNull();
  });

  it("支持在卡片头部直接启用或停用平台", async () => {
    renderPage();

    await screen.findByText("Claude Code");

    fireEvent.click(screen.getByRole("switch", { name: "Claude Code 启用开关" }));

    await waitFor(() => {
      expect(getPlatformGovernanceImpactMock).toHaveBeenCalledWith("claude");
      expect(modalConfirmMock).toHaveBeenCalledTimes(1);
    });

    const confirmConfig = modalConfirmMock.mock.calls[0]?.[0];
    expect(confirmConfig).toBeTruthy();
    await confirmConfig.onOk();

    await waitFor(() => {
      expect(savePlatformConnectionMock).toHaveBeenCalledWith({
        platformName: "claude",
        enabled: false,
        skillsDir: "C:/Users/demo/.claude/skills",
        syncMode: "symlink",
      });
    });
  });

  it("在配置区展示精简后的核心配置项", async () => {
    renderPage();

    await screen.findByText("Claude Code");

    fireEvent.click(screen.getByRole("button", { name: "查看配置" }));

    expect(screen.getAllByText("同步目录").length).toBeGreaterThan(0);
    expect(screen.getAllByText("同步方式").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "选择目录" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "测试路径" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "保存配置" })).toBeTruthy();
  });

  it("修改有受管映射的平台目录前先测试路径并等待治理确认", async () => {
    renderPage();

    await screen.findByText("Claude Code");
    fireEvent.click(screen.getByRole("button", { name: "查看配置" }));
    fireEvent.change(screen.getByDisplayValue("C:/Users/demo/.claude/skills"), {
      target: { value: "D:/Managed/claude-skills" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存配置" }));

    await waitFor(() => {
      expect(getPlatformGovernanceImpactMock).toHaveBeenCalledWith("claude");
      expect(modalConfirmMock).toHaveBeenCalledTimes(1);
    });
    expect(testPlatformPathMock).not.toHaveBeenCalled();
    expect(savePlatformConnectionMock).not.toHaveBeenCalled();

    const confirmConfig = modalConfirmMock.mock.calls[0]?.[0];
    await confirmConfig.onOk();

    await waitFor(() => {
      expect(testPlatformPathMock).toHaveBeenCalledWith("D:/Managed/claude-skills");
      expect(savePlatformConnectionMock).toHaveBeenCalledWith({
        platformName: "claude",
        enabled: true,
        skillsDir: "D:/Managed/claude-skills",
        syncMode: "symlink",
      });
    });
  });

  it("新增自定义平台后实时更新统计并切换到自定义视图", async () => {
    createCustomPlatformMock.mockResolvedValue({
      id: "platform-studio_preview",
      platformName: "studio_preview",
      displayName: "Studio Preview Agents",
      platformType: "custom",
      detected: true,
      enabled: true,
      skillsDir: "D:/AgentStudio/preview-skills",
      detectDir: "D:/AgentStudio/preview-skills",
      syncMode: "copy",
      supportsProjectScope: true,
      supportsSymlink: true,
      supportsCopy: true,
    } satisfies PlatformConnection);

    renderPage();

    await screen.findByText("Claude Code");

    expect(screen.getAllByText(hasExactTextContent("自定义1")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "新增自定义平台" }));

    fireEvent.change(screen.getByPlaceholderText("例如公司内部智能体平台"), {
      target: { value: "Studio Preview Agents" },
    });
    fireEvent.change(screen.getByPlaceholderText("仅支持英文、数字、空格、短横线与点"), {
      target: { value: "studio preview" },
    });
    fireEvent.change(screen.getByPlaceholderText("输入平台同步目录"), {
      target: { value: "D:/AgentStudio/preview-skills" },
    });

    fireEvent.click(screen.getByRole("button", { name: "创建平台" }));

    await waitFor(() => {
      expect(createCustomPlatformMock).toHaveBeenCalledWith({
        platformName: "studio_preview",
        displayName: "Studio Preview Agents",
        skillsDir: "D:/AgentStudio/preview-skills",
        syncMode: "copy",
        supportsProjectScope: false,
        supportsSymlink: true,
        supportsCopy: true,
      });
    });

    await waitFor(() => {
      expect(screen.getAllByText(hasExactTextContent("自定义2")).length).toBeGreaterThan(0);
    });

    expect(screen.getByText("Studio Preview Agents")).toBeTruthy();
  });

  it("支持删除自定义平台并触发确认", async () => {
    renderPage();

    await screen.findByText("Claude Code");

    fireEvent.click(screen.getByText("自定义"));

    await screen.findByText("Studio Internal Agents");

    fireEvent.click(screen.getByRole("button", { name: "Studio Internal Agents 更多操作" }));

    const deleteAction = await screen.findByText("删除平台");
    fireEvent.click(deleteAction);

    await waitFor(() => {
      expect(getPlatformGovernanceImpactMock).toHaveBeenCalledWith("studio_internal");
      expect(modalConfirmMock).toHaveBeenCalledTimes(1);
    });

    const confirmConfig = modalConfirmMock.mock.calls[0]?.[0];
    expect(confirmConfig).toBeTruthy();

    await confirmConfig.onOk();

    await waitFor(() => {
      expect(deleteCustomPlatformMock).toHaveBeenCalledWith({
        platformName: "studio_internal",
      });
    });

    expect(messageSuccessMock).toHaveBeenCalledWith("已删除 Studio Internal Agents");
  });

  it("英文界面显示英文平台中心文案", async () => {
    i18nState.language = "en-US";
    i18nState.resolvedLanguage = "en-US";

    renderPage();

    await screen.findByText("Platform Center");

    expect(screen.getByText("Refresh Detection")).toBeTruthy();
    expect(screen.getByPlaceholderText("Search platform name, key, or directory")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "View Config" }));

    expect(screen.getByRole("button", { name: "Save Config" })).toBeTruthy();
  });
});
