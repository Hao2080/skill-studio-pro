import type { ReactNode } from "react";
import Tooltip from "antd/es/tooltip";
import { Bot, Compass, History, LayoutDashboard, Library, Radar, Settings2, Trash2, Workflow, type LucideIcon } from "lucide-react";
import type { TranslationKey } from "./providers/I18nContext";

type Translate = (key: TranslationKey) => string;

interface NavDefinition { to: string; labelKey: TranslationKey; icon: LucideIcon; badge?: string; muted?: boolean; }
export interface NavItem { to: string; label: string; icon: ReactNode; badge?: string; muted?: boolean; }
interface NavButtonProps extends NavItem { navigate: (path: string) => void; current: string; collapsed: boolean; }

const PRIMARY_NAV_DEFINITIONS: NavDefinition[] = [
  { to: "/", labelKey: "app.nav.dashboard", icon: LayoutDashboard },
  { to: "/inventory", labelKey: "app.nav.inventory", icon: Radar },
  { to: "/library", labelKey: "app.nav.library", icon: Library },
  { to: "/platforms", labelKey: "app.nav.platforms", icon: Workflow },
  { to: "/discover", labelKey: "app.nav.discover", icon: Compass },
];

const SYSTEM_NAV_DEFINITIONS: NavDefinition[] = [
  { to: "/trash", labelKey: "app.nav.trash", icon: Trash2, badge: "2" },
  { to: "/activity", labelKey: "app.nav.activity", icon: History },
  { to: "/settings", labelKey: "app.nav.settings", icon: Settings2 },
  { to: "/settings/ai", labelKey: "app.nav.ai", icon: Bot },
];

function buildNavItems(definitions: NavDefinition[], t: Translate): NavItem[] {
  return definitions.map(({ icon: Icon, labelKey, ...item }) => ({ ...item, label: t(labelKey), icon: <Icon size={16} strokeWidth={1.8} /> }));
}

export function getPrimaryNavigationItems(t: Translate): NavItem[] { return buildNavItems(PRIMARY_NAV_DEFINITIONS, t); }
export function getSystemNavigationItems(t: Translate): NavItem[] { return buildNavItems(SYSTEM_NAV_DEFINITIONS, t); }

export function NavButton({ to, label, icon, badge, muted, navigate, current, collapsed }: NavButtonProps) {
  const isActive = to === "/" ? current === "/" : current === to || current.startsWith(`${to}/`);
  const link = (
    <a href={to} title={collapsed ? label : undefined} aria-current={isActive ? "page" : undefined} onClick={(event) => { event.preventDefault(); navigate(to); }} className={`app-nav-link${isActive ? " is-active" : ""}${muted ? " is-muted" : ""}${collapsed ? " is-collapsed" : ""}`}>
      <span className="app-nav-link__icon">{icon}</span>
      {!collapsed ? <><span className="app-nav-link__label">{label}</span>{badge ? <span className="app-nav-link__badge">{badge}</span> : null}</> : null}
    </a>
  );
  return collapsed ? <Tooltip title={label} placement="right">{link}</Tooltip> : link;
}
