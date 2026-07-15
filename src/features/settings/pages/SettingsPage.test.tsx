/** @vitest-environment jsdom */
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "@/features/settings/pages/SettingsPage";

const invokeMock = vi.fn();
const checkAndInstallUpdateMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@/features/settings/api/updateApi", () => ({
  checkAndInstallUpdate: (...args: unknown[]) => checkAndInstallUpdateMock(...args),
}));

const messageApi = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
};

vi.mock("antd", async () => {
  const actual = await vi.importActual<typeof import("antd")>("antd");
  return {
    ...actual,
    App: {
      ...actual.App,
      useApp: () => ({ message: messageApi }),
    },
  };
});

vi.mock("@/features/settings/state/ThemeContext", () => ({
  useTheme: () => ({
    theme: "dark",
    resolvedTheme: "dark",
    setTheme: vi.fn(),
  }),
}));

vi.mock("@/features/settings/state/AppSettingsContext", () => ({
  useAppSettings: () => ({
    settings: {
      theme: "dark",
      uiLanguage: "zh-CN",
      snapshotBeforePublish: true,
      snapshotMaxCount: 20,
    },
  }),
}));

vi.mock("@/features/settings/state/I18nContext", () => ({
  useI18n: () => ({
    language: "zh-CN",
    resolvedLanguage: "zh-CN",
    setLanguage: vi.fn(),
    t: (key: string) =>
      ({
        "settings.title": "设置",
        "settings.nav.aria": "设置分类",
        "settings.section.general": "界面与语言",
        "settings.section.recovery": "版本保护",
        "settings.section.storage": "数据与存储",
        "settings.section.about": "关于",
        "settings.summary.theme": "主题",
        "settings.summary.language": "语言",
        "settings.summary.guard": "同步保护",
        "settings.summary.retention": "保留上限",
        "settings.field.theme": "主题模式",
        "settings.field.language": "界面语言",
        "settings.field.languageHint": "控制导航、设置页与组件语言。",
        "settings.field.dataDir": "数据目录",
        "settings.field.workspaceDir": "工作区目录",
        "settings.field.skillsDir": "技能目录",
        "settings.field.projectsDir": "项目目录",
        "settings.field.snapshotsDir": "快照目录",
        "settings.field.dbFile": "数据库文件",
        "settings.field.settingsFile": "设置文件",
        "settings.field.none": "无",
        "settings.field.version": "版本",
        "settings.field.runtime": "运行栈",
        "settings.field.copy": "复制",
        "settings.field.copied": "已复制",
        "settings.field.copyFailed": "复制失败",
        "settings.update.title": "应用更新",
        "settings.update.hint": "检查 GitHub Releases 中的新版安装包，下载并验证签名后安装。",
        "settings.update.action": "查看更新状态",
        "settings.update.checking": "检查中...",
        "settings.update.installing": "安装中...",
        "settings.update.progress": "已下载 {progress}",
        "settings.update.none": "当前已是最新版本。",
        "settings.update.installed": "已安装 {version}，正在重启应用。",
        "settings.update.failed": "更新检查失败，请稍后重试或从 Releases 页面手动下载。",
        "settings.update.disabled": "Skill Studio Pro 自动更新尚未配置。",
        "settings.theme.light": "浅色",
        "settings.theme.dark": "深色",
        "settings.theme.system": "跟随系统",
        "settings.language.system": "跟随系统",
        "settings.language.zh-CN": "简体中文",
        "settings.language.en-US": "English",
        "settings.switch.on": "开启",
        "settings.switch.off": "关闭",
        "settings.snapshot.limit20": "20 版",
        "settings.snapshot.limit50": "50 版",
        "settings.snapshot.limit0": "不限",
        "settings.loading": "加载中...",
        "settings.runtime.tauri": "Tauri 2.0",
        "settings.runtime.react": "React 18",
        "settings.runtime.ts": "TypeScript",
        "settings.runtime.desktop": "桌面应用",
      }[key] ?? key),
  }),
}));

vi.mock("@/features/settings/components/AutoSnapshotSettings", () => ({
  AutoSnapshotSettings: () => <div>自动快照设置占位</div>,
}));

describe("SettingsPage platform settings", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    checkAndInstallUpdateMock.mockReset();
    messageApi.success.mockClear();
    messageApi.error.mockClear();
    messageApi.warning.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the streamlined settings workspace without top summary cards", async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === "db_health_check") {
        return Promise.resolve({
          workspacePath: "D:/SkillStudio",
          dbPath: "D:/SkillStudio/metadata.db",
          settingsPath: "D:/SkillStudio/settings.json",
          skillsPath: "D:/SkillStudio/skills",
          projectsPath: "D:/SkillStudio/projects",
          snapshotsPath: "D:/SkillStudio/snapshots",
          tables: [],
        });
      }

      return Promise.resolve(undefined);
    });

    render(<SettingsPage />);

    expect(screen.getByRole("heading", { name: "设置" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "界面与语言" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "版本保护" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "数据与存储" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "关于" })).toBeTruthy();
    expect(screen.getByText("界面语言")).toBeTruthy();
    expect(screen.queryByText("同步保护")).toBeNull();
    expect(screen.queryByText("保留上限")).toBeNull();
    expect(await screen.findByText("D:/SkillStudio")).toBeTruthy();
    expect(screen.getByText("D:/SkillStudio/skills")).toBeTruthy();
    expect(screen.getByText("D:/SkillStudio/projects")).toBeTruthy();
    expect(screen.getByText("D:/SkillStudio/snapshots")).toBeTruthy();
    expect(screen.getByText("D:/SkillStudio/metadata.db")).toBeTruthy();
    expect(screen.getByRole("button", { name: "查看更新状态" })).toBeTruthy();
    expect(screen.queryByText("平台中心")).toBeNull();
  });

  it("reports that Pro automatic updates are disabled", async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === "db_health_check") {
        return Promise.resolve({
          workspacePath: "D:/SkillStudio",
          dbPath: "D:/SkillStudio/metadata.db",
          settingsPath: "D:/SkillStudio/settings.json",
          skillsPath: "D:/SkillStudio/skills",
          projectsPath: "D:/SkillStudio/projects",
          snapshotsPath: "D:/SkillStudio/snapshots",
          tables: [],
        });
      }

      return Promise.resolve(undefined);
    });
    checkAndInstallUpdateMock.mockResolvedValue({ status: "disabled" });

    render(<SettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: "查看更新状态" }));

    await waitFor(() => {
      expect(checkAndInstallUpdateMock).toHaveBeenCalledTimes(1);
    });
    expect(messageApi.warning).toHaveBeenCalledWith("Skill Studio Pro 自动更新尚未配置。");
  });

  it("不在设置页隐式扫描或修改平台目录", async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === "db_health_check") {
        return Promise.resolve({
          workspacePath: "D:/SkillStudio",
          dbPath: "D:/SkillStudio/metadata.db",
          settingsPath: "D:/SkillStudio/settings.json",
          skillsPath: "D:/SkillStudio/skills",
          projectsPath: "D:/SkillStudio/projects",
          snapshotsPath: "D:/SkillStudio/snapshots",
          tables: [],
        });
      }
      return Promise.resolve(undefined);
    });

    render(<SettingsPage />);

    expect(await screen.findByText("D:/SkillStudio/skills")).toBeTruthy();
    expect(invokeMock).toHaveBeenCalledWith("db_health_check", undefined);
    expect(invokeMock.mock.calls.some(([command]) => String(command).startsWith("platform_"))).toBe(false);
  });

  it("通过受控剪贴板操作复制应用拥有的存储路径", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    invokeMock.mockImplementation((command: string) => {
      if (command === "db_health_check") {
        return Promise.resolve({
          workspacePath: "D:/SkillStudio",
          dbPath: "D:/SkillStudio/metadata.db",
          settingsPath: "D:/SkillStudio/settings.json",
          skillsPath: "D:/SkillStudio/skills",
          projectsPath: "D:/SkillStudio/projects",
          snapshotsPath: "D:/SkillStudio/snapshots",
          tables: [],
        });
      }
      return Promise.resolve(undefined);
    });

    render(<SettingsPage />);

    await screen.findByText("D:/SkillStudio");
    const copyButtons = screen.getAllByRole("button", { name: "复制" });
    fireEvent.click(copyButtons[0]);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("D:/SkillStudio");
    });
    expect(messageApi.success).toHaveBeenCalledWith("已复制");
  });
});
