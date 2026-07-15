import type { ReactNode } from "react";
import Tag from "antd/es/tag";
import Tooltip from "antd/es/tooltip";
import {
  Bot,
  Boxes,
  Cable,
  GitCompare,
  LayoutDashboard,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { TranslationKey } from "./providers/I18nContext";

type Translate = (key: TranslationKey) => string;

interface NavDefinition {
  to: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
  badge?: string;
  muted?: boolean;
}

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  badge?: string;
  muted?: boolean;
}

interface NavButtonProps extends NavItem {
  navigate: (path: string) => void;
  current: string;
  collapsed: boolean;
}

const PRIMARY_NAV_DEFINITIONS: NavDefinition[] = [
  { to: "/dashboard", labelKey: "app.nav.dashboard", icon: LayoutDashboard },
  { to: "/workspace", labelKey: "app.nav.workspace", icon: Boxes },
  { to: "/projects", labelKey: "app.nav.projects", icon: Cable },
  { to: "/teams", labelKey: "app.nav.teams", icon: Users },
  { to: "/market", labelKey: "app.nav.market", icon: GitCompare },
  { to: "/platforms", labelKey: "app.nav.platforms", icon: Bot },
];

const SYSTEM_NAV_DEFINITIONS: NavDefinition[] = [
  { to: "/settings", labelKey: "app.nav.settings", icon: Settings },
];

function buildNavItems(definitions: NavDefinition[], t: Translate): NavItem[] {
  return definitions.map(({ icon: Icon, labelKey, ...item }) => ({
    ...item,
    label: t(labelKey),
    icon: <Icon size={16} />,
  }));
}

export function getPrimaryNavigationItems(t: Translate): NavItem[] {
  return buildNavItems(PRIMARY_NAV_DEFINITIONS, t);
}

export function getSystemNavigationItems(t: Translate): NavItem[] {
  return buildNavItems(SYSTEM_NAV_DEFINITIONS, t);
}

export function NavButton({
  to,
  label,
  icon,
  badge,
  muted,
  navigate,
  current,
  collapsed,
}: NavButtonProps) {
  const isActive = current === to || current.startsWith(`${to}/`);
  const link = (
    <a
      href={to}
      title={collapsed ? label : undefined}
      onClick={(event) => {
        event.preventDefault();
        navigate(to);
      }}
      className={`app-nav-link${isActive ? " is-active" : ""}${muted ? " is-muted" : ""}${collapsed ? " is-collapsed" : ""}`}
    >
      <span className="app-nav-link__icon">{icon}</span>
      {!collapsed ? (
        <>
          <span className="app-nav-link__label">{label}</span>
          {badge ? (
            <Tag bordered={false} className="app-nav-link__badge">
              {badge}
            </Tag>
          ) : null}
        </>
      ) : null}
    </a>
  );

  return collapsed ? (
    <Tooltip title={label} placement="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}
