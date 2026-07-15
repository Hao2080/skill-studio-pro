import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Tooltip from "antd/es/tooltip";
import { PanelLeft, PanelLeftClose } from "lucide-react";
import { useI18n } from "./providers/I18nContext";
import { getPrimaryNavigationItems, getSystemNavigationItems, NavButton } from "./navigation";
import { DashboardPage } from "@/features/dashboard/pages/DashboardPage";
import { MarketPage } from "@/features/market/pages/MarketPage";
import { PlatformsPage } from "@/features/platforms/pages/PlatformsPage";
import { ProjectsPage } from "@/features/projects/pages/ProjectsPage";
import { SettingsPage } from "@/features/settings/pages/SettingsPage";
import { SkillDetailWorkspacePage } from "@/features/skills/pages/SkillDetailWorkspacePage";
import { WorkspacePage } from "@/features/skills/pages/WorkspacePage";
import { TeamsPage } from "@/features/teams/pages/TeamsPage";

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.innerWidth <= 960;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 960px)");
    const handleViewportChange = (event: MediaQueryListEvent) => {
      setCollapsed(event.matches);
    };

    setCollapsed(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleViewportChange);
      return () => mediaQuery.removeEventListener("change", handleViewportChange);
    }

    mediaQuery.addListener(handleViewportChange);
    return () => mediaQuery.removeListener(handleViewportChange);
  }, []);

  const primaryNavItems = getPrimaryNavigationItems(t);
  const systemNavItems = getSystemNavigationItems(t);
  const brandMarkSrc = "/assets/brand/skill-studio-pro-placeholder.svg";

  return (
    <div className="app-shell">
      <aside className={`app-sidebar${collapsed ? " is-collapsed" : ""}`}>
        <div className={`app-sidebar__brand${collapsed ? " is-collapsed" : ""}`}>
          <div
            className={`app-sidebar__logo${collapsed ? " app-sidebar__logo--compact" : ""}`}
            role="img"
            aria-label="Skill Studio Pro"
          >
            <span className="app-sidebar__logo-mark" aria-hidden="true">
              <img src={brandMarkSrc} alt="" className="app-sidebar__logo-mark-image" />
            </span>
            {!collapsed ? (
              <span className="app-sidebar__brand-copy">
                <span className="app-sidebar__brand-title">Skill Studio Pro</span>
              </span>
            ) : null}
          </div>
          <Tooltip title={collapsed ? t("app.nav.expand") : t("app.nav.collapse")}>
            <button
              type="button"
              className="app-sidebar__toggle"
              aria-label={collapsed ? t("app.nav.expand") : t("app.nav.collapse")}
              onClick={() => setCollapsed((prev) => !prev)}
            >
              {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
            </button>
          </Tooltip>
        </div>

        {!collapsed ? <div className="app-sidebar__section-label">{t("app.nav.product")}</div> : null}

        <nav className="app-sidebar__nav">
          {primaryNavItems.map((item) => (
            <NavButton
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              badge={item.badge}
              muted={item.muted}
              navigate={navigate}
              current={location.pathname}
              collapsed={collapsed}
            />
          ))}
        </nav>

        <div className="app-sidebar__spacer" />

        {!collapsed ? <div className="app-sidebar__section-label">{t("app.nav.system")}</div> : null}

        <nav className="app-sidebar__nav app-sidebar__nav--footer">
          {systemNavItems.map((item) => (
            <NavButton
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              badge={item.badge}
              muted={item.muted}
              navigate={navigate}
              current={location.pathname}
              collapsed={collapsed}
            />
          ))}
        </nav>
      </aside>

      <main className="app-shell__content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/workspace" element={<WorkspacePage />} />
          <Route path="/workspace/:skillId" element={<SkillDetailWorkspacePage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={<ProjectsPage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/market" element={<MarketPage />} />
          <Route path="/platforms" element={<PlatformsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
