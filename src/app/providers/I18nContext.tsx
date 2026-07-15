import { createContext, useContext, useEffect, type ReactNode } from "react";
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import type { AppSettings } from "@/types/skill";
import { useAppSettings } from "./AppSettingsContext";

type UiLanguage = AppSettings["uiLanguage"];
type ResolvedLanguage = Exclude<UiLanguage, "system">;

const ZH_MESSAGES = {
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
  "settings.update.hint": "Wave 0 尚未配置独立的 Pro 更新源，自动更新已停用。",
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
  "settings.snapshot.guard": "同步前恢复点",
  "settings.snapshot.guardHint": "发布前若工作区仍有变更，自动留下一份系统恢复点。",
  "settings.snapshot.retention": "版本保留上限",
  "settings.snapshot.retentionHint": "超出上限时，优先清理最旧的系统恢复点。",
  "settings.snapshot.limit20": "20 版",
  "settings.snapshot.limit50": "50 版",
  "settings.snapshot.limit0": "不限",
  "settings.snapshot.footnote.enabled": "已启用同步保护，正式发布前会自动保留可回退恢复点。",
  "settings.snapshot.footnote.disabled": "已关闭同步保护，系统只保留手动建立的正式版本。",
  "settings.loading": "加载中...",
  "settings.runtime.tauri": "Tauri 2.0",
  "settings.runtime.react": "React 18",
  "settings.runtime.ts": "TypeScript",
  "settings.runtime.desktop": "桌面应用",
} as const;

export type TranslationKey = keyof typeof ZH_MESSAGES;

const EN_MESSAGES: Record<TranslationKey, string> = {
  "app.brand.subtitle": "Workspace Console",
  "app.nav.product": "Product",
  "app.nav.system": "System",
  "app.nav.dashboard": "Dashboard",
  "app.nav.workspace": "Skill Assets",
  "app.nav.projects": "Project Spaces",
  "app.nav.teams": "Team Spaces",
  "app.nav.market": "Market & Import",
  "app.nav.platforms": "Platform Center",
  "app.nav.settings": "System Settings",
  "app.nav.expand": "Expand navigation",
  "app.nav.collapse": "Collapse navigation",
  "settings.title": "Settings",
  "settings.nav.aria": "Settings sections",
  "settings.section.general": "Appearance & Language",
  "settings.section.recovery": "Version Protection",
  "settings.section.storage": "Data & Storage",
  "settings.section.about": "About",
  "settings.summary.theme": "Theme",
  "settings.summary.language": "Language",
  "settings.summary.guard": "Publish Guard",
  "settings.summary.retention": "Retention",
  "settings.field.theme": "Theme mode",
  "settings.field.language": "Interface language",
  "settings.field.languageHint": "Controls navigation, settings, and component locale.",
  "settings.field.dataDir": "Data directory",
  "settings.field.workspaceDir": "Workspace",
  "settings.field.skillsDir": "Skills",
  "settings.field.projectsDir": "Projects",
  "settings.field.snapshotsDir": "Snapshots",
  "settings.field.dbFile": "Database file",
  "settings.field.settingsFile": "Settings file",
  "settings.field.none": "None",
  "settings.field.version": "Version",
  "settings.field.runtime": "Runtime",
  "settings.field.copy": "Copy",
  "settings.field.copied": "Copied",
  "settings.field.copyFailed": "Copy failed",
  "settings.update.title": "App updates",
  "settings.update.hint": "Wave 0 has no independent Pro update source; automatic updates are disabled.",
  "settings.update.action": "View update status",
  "settings.update.checking": "Checking...",
  "settings.update.installing": "Installing...",
  "settings.update.progress": "Downloaded {progress}",
  "settings.update.none": "You are on the latest version.",
  "settings.update.installed": "{version} installed. Restarting the app.",
  "settings.update.failed": "Update check failed. Try again later or download manually from Releases.",
  "settings.update.disabled": "Skill Studio Pro automatic updates are not configured.",
  "settings.theme.light": "Light",
  "settings.theme.dark": "Dark",
  "settings.theme.system": "System",
  "settings.language.system": "Follow system",
  "settings.language.zh-CN": "Simplified Chinese",
  "settings.language.en-US": "English",
  "settings.switch.on": "On",
  "settings.switch.off": "Off",
  "settings.snapshot.guard": "Pre-publish restore point",
  "settings.snapshot.guardHint": "Before publishing, keep one system restore point if the workspace still has changes.",
  "settings.snapshot.retention": "Version retention limit",
  "settings.snapshot.retentionHint": "When the limit is exceeded, the oldest system restore points are cleaned up first.",
  "settings.snapshot.limit20": "20 versions",
  "settings.snapshot.limit50": "50 versions",
  "settings.snapshot.limit0": "Unlimited",
  "settings.snapshot.footnote.enabled": "Publish guard is on. The app will keep a rollback restore point before formal release.",
  "settings.snapshot.footnote.disabled": "Publish guard is off. Only manually created formal versions will be retained.",
  "settings.loading": "Loading...",
  "settings.runtime.tauri": "Tauri 2.0",
  "settings.runtime.react": "React 18",
  "settings.runtime.ts": "TypeScript",
  "settings.runtime.desktop": "Desktop App",
};

function resolveUiLanguage(language: UiLanguage): ResolvedLanguage {
  if (language !== "system") {
    return language;
  }

  if (typeof navigator === "undefined") {
    return "zh-CN";
  }

  return navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en-US";
}

function getMessages(language: ResolvedLanguage) {
  return language === "en-US" ? EN_MESSAGES : ZH_MESSAGES;
}

interface I18nContextValue {
  language: UiLanguage;
  resolvedLanguage: ResolvedLanguage;
  antdLocale: typeof zhCN;
  t: (key: TranslationKey) => string;
  setLanguage: (language: UiLanguage) => Promise<void>;
}

const DEFAULT_LANGUAGE: ResolvedLanguage = "zh-CN";

const I18nContext = createContext<I18nContextValue>({
  language: "system",
  resolvedLanguage: DEFAULT_LANGUAGE,
  antdLocale: zhCN,
  t: (key) => ZH_MESSAGES[key],
  setLanguage: async () => {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const { settings, updateSettings } = useAppSettings();
  const language = settings.uiLanguage ?? "system";
  const resolvedLanguage = resolveUiLanguage(language);
  const messages = getMessages(resolvedLanguage);

  useEffect(() => {
    document.documentElement.lang = resolvedLanguage;
  }, [resolvedLanguage]);

  return (
    <I18nContext.Provider
      value={{
        language,
        resolvedLanguage,
        antdLocale: resolvedLanguage === "en-US" ? enUS : zhCN,
        t: (key) => messages[key] ?? ZH_MESSAGES[key],
        setLanguage: async (nextLanguage) => {
          await updateSettings({ uiLanguage: nextLanguage });
        },
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
