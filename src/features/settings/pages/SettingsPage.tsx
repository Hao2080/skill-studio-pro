import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { App as AntApp } from "antd";
import Button from "antd/es/button";
import Segmented from "antd/es/segmented";
import {
  Check,
  Copy,
  Database,
  Globe2,
  History,
  Info,
  Languages,
  Monitor,
  Moon,
  Palette,
  RefreshCw,
  Sun,
} from "lucide-react";
import { checkAndInstallUpdate, relaunchApp, type UpdateProgress } from "@/features/settings/api/updateApi";
import { AutoSnapshotSettings } from "@/features/settings/components/AutoSnapshotSettings";
import { useI18n } from "@/features/settings/state/I18nContext";
import { useTheme } from "@/features/settings/state/ThemeContext";
import { type DbHealthResponse, getDbHealth } from "../api/settingsApi";
import "../styles.css";

const SETTINGS_SECTIONS = [
  { key: "general", labelKey: "settings.section.general", icon: Palette },
  { key: "recovery", labelKey: "settings.section.recovery", icon: History },
  { key: "storage", labelKey: "settings.section.storage", icon: Database },
  { key: "about", labelKey: "settings.section.about", icon: Info },
] as const;

type SettingsSectionKey = (typeof SETTINGS_SECTIONS)[number]["key"];
type ThemeValue = "dark" | "light" | "system";

function buildSegmentedOption(icon: ReactNode, label: string) {
  return (
    <span className="settings-page__segmented-option">
      <span className="settings-page__segmented-option-icon">{icon}</span>
      <span>{label}</span>
    </span>
  );
}

export function SettingsPage() {
  const { message } = AntApp.useApp();
  const [health, setHealth] = useState<DbHealthResponse | null>(null);
  const [activeSection, setActiveSection] = useState<SettingsSectionKey>("general");
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useI18n();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Record<SettingsSectionKey, HTMLElement | null>>({
    general: null,
    recovery: null,
    storage: null,
    about: null,
  });

  const storageItems = useMemo(
    () => [
      { label: t("settings.field.workspaceDir"), value: health?.workspacePath ?? "" },
      { label: t("settings.field.skillsDir"), value: health?.skillsPath ?? "" },
      { label: t("settings.field.projectsDir"), value: health?.projectsPath ?? "" },
      { label: t("settings.field.snapshotsDir"), value: health?.snapshotsPath ?? "" },
      { label: t("settings.field.dbFile"), value: health?.dbPath ?? "" },
      { label: t("settings.field.settingsFile"), value: health?.settingsPath ?? "" },
    ],
    [health, t],
  );

  const themeOptions = useMemo(
    () => [
      { value: "light", label: buildSegmentedOption(<Sun size={14} />, t("settings.theme.light")) },
      { value: "dark", label: buildSegmentedOption(<Moon size={14} />, t("settings.theme.dark")) },
      { value: "system", label: buildSegmentedOption(<Monitor size={14} />, t("settings.theme.system")) },
    ],
    [t],
  );

  const languageOptions = useMemo(
    () => [
      { value: "system", label: buildSegmentedOption(<Globe2 size={14} />, t("settings.language.system")) },
      { value: "zh-CN", label: buildSegmentedOption(<Languages size={14} />, t("settings.language.zh-CN")) },
      { value: "en-US", label: buildSegmentedOption(<Languages size={14} />, t("settings.language.en-US")) },
    ],
    [t],
  );

  useEffect(() => {
    getDbHealth()
      .then((response) => setHealth(response))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) {
      return;
    }

    const handleScroll = () => {
      const containerTop = container.getBoundingClientRect().top;
      let nextSection: SettingsSectionKey = SETTINGS_SECTIONS[0].key;

      for (const section of SETTINGS_SECTIONS) {
        const node = sectionRefs.current[section.key];
        if (!node) {
          continue;
        }

        if (node.getBoundingClientRect().top - containerTop <= 72) {
          nextSection = section.key;
        }
      }

      setActiveSection((current) => (current === nextSection ? current : nextSection));
    };

    handleScroll();
    container.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      container.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  const jumpToSection = (sectionKey: SettingsSectionKey) => {
    setActiveSection(sectionKey);
    sectionRefs.current[sectionKey]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const assignSectionRef = (sectionKey: SettingsSectionKey) => (node: HTMLElement | null) => {
    sectionRefs.current[sectionKey] = node;
  };

  const copyPath = async (value: string) => {
    if (!value || !navigator.clipboard?.writeText) {
      message.error?.(t("settings.field.copyFailed"));
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      message.success?.(t("settings.field.copied"));
    } catch {
      message.error?.(t("settings.field.copyFailed"));
    }
  };

  const formatUpdateProgress = (progress: UpdateProgress) => {
    if (!progress.total || progress.total <= 0) {
      return `${Math.round(progress.downloaded / 1024 / 1024)} MB`;
    }

    const percent = Math.min(100, Math.round((progress.downloaded / progress.total) * 100));
    return `${percent}%`;
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateProgress(null);

    try {
      const result = await checkAndInstallUpdate((progress) => {
        setUpdateProgress(formatUpdateProgress(progress));
      });

      if (result.status === "current") {
        message.success?.(t("settings.update.none"));
        return;
      }

      message.success?.(t("settings.update.installed").replace("{version}", result.version ?? ""));
      await relaunchApp();
    } catch {
      message.error?.(t("settings.update.failed"));
    } finally {
      setCheckingUpdate(false);
      setUpdateProgress(null);
    }
  };

  return (
    <div className="settings-page">
      <header className="settings-page__header">
        <h1 className="settings-page__title">{t("settings.title")}</h1>
      </header>

      <div className="settings-page__workspace">
        <aside className="settings-page__nav" aria-label={t("settings.nav.aria")}>
          {SETTINGS_SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.key}
                type="button"
                className={`settings-page__nav-button${activeSection === section.key ? " is-active" : ""}`}
                onClick={() => jumpToSection(section.key)}
              >
                <span className="settings-page__nav-icon">
                  <Icon size={15} />
                </span>
                <span>{t(section.labelKey)}</span>
              </button>
            );
          })}
        </aside>

        <div ref={contentRef} className="settings-page__content">
          <div className="settings-page__panel">
            <section ref={assignSectionRef("general")} className="settings-page__section" id="settings-section-general">
              <div className="settings-page__section-head">
                <h2 className="settings-page__section-title">{t("settings.section.general")}</h2>
              </div>
              <div className="settings-page__section-body">
                <div className="settings-page__field">
                  <div className="settings-page__field-meta">
                    <span className="settings-page__field-label">{t("settings.field.theme")}</span>
                  </div>
                  <div className="settings-page__field-control">
                    <Segmented
                      className="settings-page__segmented"
                      value={theme}
                      onChange={(value) => void setTheme(value as ThemeValue)}
                      options={themeOptions}
                    />
                  </div>
                </div>

                <div className="settings-page__field">
                  <div className="settings-page__field-meta">
                    <span className="settings-page__field-label">{t("settings.field.language")}</span>
                    <span className="settings-page__field-hint">{t("settings.field.languageHint")}</span>
                  </div>
                  <div className="settings-page__field-control">
                    <Segmented
                      className="settings-page__segmented settings-page__segmented--wide"
                      value={language}
                      onChange={(value) => void setLanguage(value as typeof language)}
                      options={languageOptions}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section ref={assignSectionRef("recovery")} className="settings-page__section" id="settings-section-recovery">
              <div className="settings-page__section-head">
                <h2 className="settings-page__section-title">{t("settings.section.recovery")}</h2>
              </div>
              <div className="settings-page__section-body">
                <AutoSnapshotSettings />
              </div>
            </section>

            <section ref={assignSectionRef("storage")} className="settings-page__section" id="settings-section-storage">
              <div className="settings-page__section-head">
                <h2 className="settings-page__section-title">{t("settings.section.storage")}</h2>
              </div>
              <div className="settings-page__section-body">
                {storageItems.map((item) => (
                  <div key={item.label} className="settings-page__field settings-page__field--stacked">
                    <div className="settings-page__field-meta">
                      <span className="settings-page__field-label">{item.label}</span>
                    </div>
                    <div className="settings-page__path-row">
                      <div className="settings-page__value-box">{item.value || t("settings.loading")}</div>
                      <Button
                        className="settings-page__path-action"
                        icon={<Copy size={14} />}
                        onClick={() => void copyPath(item.value)}
                      >
                        {t("settings.field.copy")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section ref={assignSectionRef("about")} className="settings-page__section" id="settings-section-about">
              <div className="settings-page__section-head">
                <h2 className="settings-page__section-title">{t("settings.section.about")}</h2>
              </div>
              <div className="settings-page__section-body">
                <div className="settings-page__field">
                  <div className="settings-page__field-meta">
                    <span className="settings-page__field-label">{t("settings.field.version")}</span>
                  </div>
                  <div className="settings-page__badge-row">
                    <span className="settings-page__badge">0.1.0</span>
                  </div>
                </div>
                <div className="settings-page__field">
                  <div className="settings-page__field-meta">
                    <span className="settings-page__field-label">{t("settings.update.title")}</span>
                    <span className="settings-page__field-hint">
                      {updateProgress
                        ? t("settings.update.progress").replace("{progress}", updateProgress)
                        : t("settings.update.hint")}
                    </span>
                  </div>
                  <div className="settings-page__field-control">
                    <Button icon={<RefreshCw size={14} />} loading={checkingUpdate} onClick={() => void handleCheckUpdate()}>
                      {checkingUpdate
                        ? updateProgress
                          ? t("settings.update.installing")
                          : t("settings.update.checking")
                        : t("settings.update.action")}
                    </Button>
                  </div>
                </div>
                <div className="settings-page__field">
                  <div className="settings-page__field-meta">
                    <span className="settings-page__field-label">{t("settings.field.runtime")}</span>
                  </div>
                  <div className="settings-page__badge-row">
                    <span className="settings-page__badge">{t("settings.runtime.tauri")}</span>
                    <span className="settings-page__badge">{t("settings.runtime.react")}</span>
                    <span className="settings-page__badge">{t("settings.runtime.ts")}</span>
                    <span className="settings-page__badge settings-page__badge--success">
                      <Check size={12} />
                      {t("settings.runtime.desktop")}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
