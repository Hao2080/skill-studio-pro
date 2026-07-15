/** @vitest-environment jsdom */
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("@/features/dashboard/pages/DashboardPage", () => ({ DashboardPage: () => <div>DashboardPage</div> }));
vi.mock("@/features/inventory/pages/InventoryPage", () => ({ InventoryPage: () => <div>InventoryPage</div> }));
vi.mock("@/features/skills/pages/SkillDetailProPage", () => ({ SkillDetailProPage: () => <div>SkillDetailProPage</div> }));
vi.mock("@/features/library/pages/LibraryPage", () => ({ LibraryPage: () => <div>LibraryPage</div> }));
vi.mock("@/features/platforms/pages/ProPlatformsPage", () => ({ ProPlatformsPage: () => <div>ProPlatformsPage</div> }));
vi.mock("@/features/discover/pages/DiscoverPage", () => ({ DiscoverPage: () => <div>DiscoverPage</div> }));
vi.mock("@/features/trash/pages/TrashPage", () => ({ TrashPage: () => <div>TrashPage</div> }));
vi.mock("@/features/activity/pages/ActivityPage", () => ({ ActivityPage: () => <div>ActivityPage</div> }));
vi.mock("@/features/settings/pages/ProSettingsPage", () => ({ ProSettingsPage: () => <div>ProSettingsPage</div> }));
vi.mock("@/features/ai-settings/pages/AiSettingsPage", () => ({ AiSettingsPage: () => <div>AiSettingsPage</div> }));

vi.mock("@/features/teams/state/TeamContext", () => ({ TeamProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/features/skills/state/SkillContext", () => ({ SkillProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/features/snapshots/state/SnapshotContext", () => ({ SnapshotProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/app/providers/ThemeContext", () => ({ ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>, useTheme: () => ({ theme: "dark", resolvedTheme: "dark", setTheme: vi.fn() }) }));
vi.mock("@/app/providers/AppSettingsContext", () => ({ AppSettingsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/app/providers/I18nContext", () => ({
  I18nProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useI18n: () => ({ language: "zh-CN", resolvedLanguage: "zh-CN", antdLocale: {}, setLanguage: vi.fn(), t: (key: string) => ({
    "app.nav.product": "产品导航", "app.nav.system": "系统", "app.nav.dashboard": "总览", "app.nav.inventory": "本机 Skill", "app.nav.library": "中央库", "app.nav.platforms": "平台中心", "app.nav.discover": "发现与安装", "app.nav.trash": "回收站", "app.nav.activity": "操作记录", "app.nav.settings": "设置", "app.nav.ai": "模型与 API", "app.nav.expand": "展开导航", "app.nav.collapse": "折叠导航",
  }[key] ?? key) }),
}));

describe("Skill Studio Pro application shell", () => {
  afterEach(() => { cleanup(); window.history.replaceState({}, "", "/"); localStorage.clear(); Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 }); });

  it("renders the first-generation navigation and hides team spaces", () => {
    render(<App />);
    expect(screen.getByLabelText("Skill Studio Pro")).toBeTruthy();
    expect(screen.getByRole("link", { name: "总览" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "本机 Skill" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "中央库" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "发现与安装" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "模型与 API" })).toBeTruthy();
    expect(screen.queryByText("团队空间")).toBeNull();
    expect(screen.queryByText("项目空间")).toBeNull();
  });

  it("collapses the sidebar to icon-only navigation", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "折叠导航" }));
    expect(screen.queryByText("本机 Skill")).toBeNull();
    expect(screen.getByRole("button", { name: "展开导航" })).toBeTruthy();
  });

  it("shows the dashboard at the root route", async () => {
    render(<App />);
    expect(await screen.findByText("DashboardPage")).toBeTruthy();
  });

  it("renders the new detail route and preserves the legacy redirect", async () => {
    window.history.pushState({}, "", "/workspace/skill-1");
    render(<App />);
    expect(await screen.findByText("SkillDetailProPage")).toBeTruthy();
    expect(window.location.pathname).toBe("/inventory/skill-1");
  });

  it("focuses global search with Ctrl+K", () => {
    render(<App />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "全局搜索 Skill" }));
  });

  it("keeps primary keyboard targets focusable without hover-only access", () => {
    render(<App />);
    const targets = Array.from(document.querySelectorAll<HTMLElement>('a[href], button, input'));
    expect(targets.length).toBeGreaterThan(8);
    expect(targets.every((target) => target.tabIndex >= 0)).toBe(true);
    expect(screen.getByRole("textbox", { name: "全局搜索 Skill" }).tabIndex).toBe(0);
    expect(screen.getByRole("link", { name: "本机 Skill" }).tabIndex).toBe(0);
  });

  it("uses compact navigation at 900px and expanded navigation at 1280px", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 900 });
    render(<App />);
    expect(screen.getByRole("button", { name: "展开导航" })).toBeTruthy();
    cleanup();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    render(<App />);
    expect(screen.getByRole("button", { name: "折叠导航" })).toBeTruthy();
  });
});
