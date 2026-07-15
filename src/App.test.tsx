/** @vitest-environment jsdom */
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("@/features/skills/pages/WorkspacePage", () => ({ WorkspacePage: () => <div>WorkspacePage</div> }));
vi.mock("@/features/skills/pages/SkillDetailWorkspacePage", () => ({ SkillDetailWorkspacePage: () => <div>SkillDetailWorkspacePage</div> }));
vi.mock("@/features/dashboard/pages/DashboardPage", () => ({ DashboardPage: () => <div>DashboardPage</div> }));
vi.mock("@/features/market/pages/MarketPage", () => ({ MarketPage: () => <div>MarketPage</div> }));
vi.mock("@/features/projects/pages/ProjectsPage", () => ({ ProjectsPage: () => <div>ProjectsPage</div> }));
vi.mock("@/features/teams/pages/TeamsPage", () => ({ TeamsPage: () => <div>TeamsPage</div> }));
vi.mock("@/features/settings/pages/SettingsPage", () => ({ SettingsPage: () => <div>SettingsPage</div> }));

vi.mock("@/features/teams/state/TeamContext", () => ({
  TeamProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/features/skills/state/SkillContext", () => ({
  SkillProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/features/snapshots/state/SnapshotContext", () => ({
  SnapshotProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/app/providers/ThemeContext", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useTheme: () => ({ theme: "dark", resolvedTheme: "dark", setTheme: vi.fn() }),
}));
vi.mock("@/app/providers/AppSettingsContext", () => ({
  AppSettingsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/app/providers/I18nContext", () => ({
  I18nProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useI18n: () => ({
    language: "zh-CN",
    resolvedLanguage: "zh-CN",
    antdLocale: {},
    setLanguage: vi.fn(),
    t: (key: string) =>
      ({
        "app.brand.subtitle": "技能资产管理平台",
        "app.nav.product": "产品导航",
        "app.nav.system": "系统",
        "app.nav.dashboard": "总览",
        "app.nav.workspace": "技能资产",
        "app.nav.projects": "项目空间",
        "app.nav.teams": "团队空间",
        "app.nav.market": "市场与导入",
        "app.nav.platforms": "平台中心",
        "app.nav.settings": "系统设置",
        "app.nav.expand": "展开导航",
        "app.nav.collapse": "折叠导航",
      }[key] ?? key),
  }),
}));

describe("App navigation structure", () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
  });

  it("renders localized sidebar navigation structure", () => {
    render(<App />);
    expect(screen.getByLabelText("Skill Studio Pro")).toBeTruthy();
    expect(screen.queryByText("技能资产管理平台")).toBeNull();
    expect(screen.getByText("总览")).toBeTruthy();
    expect(screen.getByText("技能资产")).toBeTruthy();
    expect(screen.getByText("项目空间")).toBeTruthy();
    expect(screen.getByText("团队空间")).toBeTruthy();
    expect(screen.getByText("市场与导入")).toBeTruthy();
    expect(screen.getByText("平台中心")).toBeTruthy();
    expect(screen.getByText("系统设置")).toBeTruthy();
  });

  it("collapses sidebar to icon-only navigation", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "折叠导航" }));

    expect(screen.queryByText("技能资产")).toBeNull();
    expect(screen.queryByText("项目空间")).toBeNull();
    expect(screen.queryByText("团队空间")).toBeNull();
    expect(screen.getByRole("button", { name: "展开导航" })).toBeTruthy();
  });

  it("defaults to showing DashboardPage on first render", async () => {
    render(<App />);
    expect(await screen.findByText("DashboardPage")).toBeTruthy();
  });

  it("renders skill detail workspace route", async () => {
    window.history.pushState({}, "", "/workspace/skill-1");

    render(<App />);

    expect(await screen.findByText("SkillDetailWorkspacePage")).toBeTruthy();
  });
});
