import { useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Tooltip from "antd/es/tooltip";
import { Bell, Command, PanelLeft, PanelLeftClose, Search, ShieldCheck } from "lucide-react";
import { useI18n } from "./providers/I18nContext";
import { getPrimaryNavigationItems, getSystemNavigationItems, NavButton } from "./navigation";
import { ProLogo } from "@/shared/components/pro";
import { DashboardPage } from "@/features/dashboard/pages/DashboardPage";
import { InventoryPage } from "@/features/inventory/pages/InventoryPage";
import { SkillDetailProPage } from "@/features/skills/pages/SkillDetailProPage";
import { LibraryPage } from "@/features/library/pages/LibraryPage";
import { ProPlatformsPage } from "@/features/platforms/pages/ProPlatformsPage";
import { DiscoverPage } from "@/features/discover/pages/DiscoverPage";
import { TrashPage } from "@/features/trash/pages/TrashPage";
import { ActivityPage } from "@/features/activity/pages/ActivityPage";
import { ProSettingsPage } from "@/features/settings/pages/ProSettingsPage";
import { AiSettingsPage } from "@/features/ai-settings/pages/AiSettingsPage";

const routeNames: Record<string, string> = {
  "/": "总览",
  "/inventory": "本机 Skill",
  "/library": "中央库",
  "/platforms": "平台中心",
  "/discover": "发现与安装",
  "/trash": "回收站",
  "/activity": "操作记录",
  "/settings": "设置",
  "/settings/ai": "模型与 API",
};

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const searchRef = useRef<HTMLInputElement>(null);
  const [collapsed, setCollapsed] = useState(() => typeof window !== "undefined" && window.innerWidth <= 1000);

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(localStorage.getItem("skill-studio-pro.reduce-motion") === "true");
    document.documentElement.dataset.reduceTransparency = String(localStorage.getItem("skill-studio-pro.reduce-transparency") === "true");
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(max-width: 1000px)");
    const handleViewportChange = (event: MediaQueryListEvent) => setCollapsed(event.matches);
    setCollapsed(mediaQuery.matches);
    mediaQuery.addEventListener?.("change", handleViewportChange);
    return () => mediaQuery.removeEventListener?.("change", handleViewportChange);
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const primaryNavItems = getPrimaryNavigationItems(t);
  const systemNavItems = getSystemNavigationItems(t);
  const routeRoot = location.pathname.startsWith("/inventory/") ? "/inventory" : location.pathname.startsWith("/library/") ? "/library" : location.pathname;
  const currentTitle = routeNames[routeRoot] ?? "Skill Studio Pro";

  return (
    <div className="app-window">
      <div className="app-window__aurora" aria-hidden="true" />
      <div className="app-window__frame">
        <aside className={`app-sidebar${collapsed ? " is-collapsed" : ""}`}>
          <div className="app-window-controls" aria-hidden="true"><span/><span/><span/></div>
          <div className={`app-sidebar__brand${collapsed ? " is-collapsed" : ""}`}>
            <ProLogo compact={collapsed} />
            <Tooltip title={collapsed ? t("app.nav.expand") : t("app.nav.collapse")}>
              <button type="button" className="app-sidebar__toggle" aria-label={collapsed ? t("app.nav.expand") : t("app.nav.collapse")} onClick={() => setCollapsed((value) => !value)}>{collapsed ? <PanelLeft size={16}/> : <PanelLeftClose size={16}/>}</button>
            </Tooltip>
          </div>
          {!collapsed ? <div className="app-sidebar__section-label">{t("app.nav.product")}</div> : null}
          <nav className="app-sidebar__nav" aria-label={t("app.nav.product")}>{primaryNavItems.map((item)=><NavButton key={item.to} {...item} navigate={navigate} current={location.pathname} collapsed={collapsed}/>)}</nav>
          <div className="app-sidebar__spacer" />
          {!collapsed ? <div className="app-sidebar__section-label">{t("app.nav.system")}</div> : null}
          <nav className="app-sidebar__nav app-sidebar__nav--footer" aria-label={t("app.nav.system")}>{systemNavItems.map((item)=><NavButton key={item.to} {...item} navigate={navigate} current={location.pathname} collapsed={collapsed}/>)}</nav>
          {!collapsed ? <div className="app-sidebar__security"><ShieldCheck size={14}/><span><strong>本地优先</strong><small>外部 Skill 默认只读</small></span></div> : null}
        </aside>

        <section className="app-workspace">
          <header className="app-toolbar" data-tauri-drag-region>
            <div className="app-toolbar__title"><span>Skill Studio Pro</span><i>/</i><strong>{currentTitle}</strong></div>
            <label className="app-toolbar__search" data-tauri-drag-region="false"><Search size={14}/><input ref={searchRef} placeholder="全局搜索 Skill…" aria-label="全局搜索 Skill"/><kbd><Command size={10}/>K</kbd></label>
            <div className="app-toolbar__actions"><span className="app-toolbar__index"><i/>索引就绪</span><button type="button" aria-label="通知"><Bell size={15}/><b>2</b></button><span className="app-toolbar__avatar">HH</span></div>
          </header>
          <main className="app-shell__content">
            <Routes>
              <Route path="/" element={<DashboardPage/>}/>
              <Route path="/inventory" element={<InventoryPage/>}/>
              <Route path="/inventory/:skillId" element={<SkillDetailProPage/>}/>
              <Route path="/library" element={<LibraryPage/>}/>
              <Route path="/library/:skillId" element={<SkillDetailProPage/>}/>
              <Route path="/platforms" element={<ProPlatformsPage/>}/>
              <Route path="/discover" element={<DiscoverPage/>}/>
              <Route path="/trash" element={<TrashPage/>}/>
              <Route path="/activity" element={<ActivityPage/>}/>
              <Route path="/settings" element={<ProSettingsPage/>}/>
              <Route path="/settings/ai" element={<AiSettingsPage/>}/>
              <Route path="/dashboard" element={<Navigate to="/" replace/>}/>
              <Route path="/workspace" element={<Navigate to="/inventory" replace/>}/>
              <Route path="/workspace/:skillId" element={<LegacySkillRedirect/>}/>
              <Route path="/market" element={<Navigate to="/discover" replace/>}/>
              <Route path="/projects/*" element={<Navigate to="/" replace/>}/>
              <Route path="/teams/*" element={<Navigate to="/" replace/>}/>
              <Route path="*" element={<Navigate to="/" replace/>}/>
            </Routes>
          </main>
        </section>
      </div>
    </div>
  );
}

function LegacySkillRedirect() {
  const location = useLocation();
  return <Navigate to={location.pathname.replace("/workspace/", "/inventory/")} replace/>;
}
