import Segmented from "antd/es/segmented";
import Switch from "antd/es/switch";
import { useAppSettings } from "@/features/settings/state/AppSettingsContext";
import { useI18n } from "@/features/settings/state/I18nContext";
import "../styles.css";

export function AutoSnapshotSettings() {
  const { settings, updateSettings, loading } = useAppSettings();
  const { t } = useI18n();

  return (
    <div className="auto-snapshot-settings">
      <div className="settings-page__field">
        <div className="settings-page__field-meta">
          <span className="settings-page__field-label">{t("settings.snapshot.guard")}</span>
          <span className="settings-page__field-hint">{t("settings.snapshot.guardHint")}</span>
        </div>
        <div className="settings-page__field-control settings-page__field-control--inline settings-page__toggle-control">
          <span className={`settings-page__state-pill${settings.snapshotBeforePublish ? " is-active" : ""}`}>
            {settings.snapshotBeforePublish ? t("settings.switch.on") : t("settings.switch.off")}
          </span>
          <Switch
            checked={settings.snapshotBeforePublish}
            disabled={loading}
            onChange={(value) => void updateSettings({ snapshotBeforePublish: value })}
          />
        </div>
      </div>

      <div className="settings-page__field settings-page__field--wrap">
        <div className="settings-page__field-meta">
          <span className="settings-page__field-label">{t("settings.snapshot.retention")}</span>
          <span className="settings-page__field-hint">{t("settings.snapshot.retentionHint")}</span>
        </div>
        <div className="settings-page__field-control">
          <Segmented
            className="settings-page__segmented"
            disabled={loading}
            value={settings.snapshotMaxCount ?? 0}
            onChange={(value) => void updateSettings({ snapshotMaxCount: value === 0 ? null : Number(value) })}
            options={[
              { value: 20, label: t("settings.snapshot.limit20") },
              { value: 50, label: t("settings.snapshot.limit50") },
              { value: 0, label: t("settings.snapshot.limit0") },
            ]}
          />
        </div>
      </div>

      <div className="auto-snapshot-settings__footnote">
        {settings.snapshotBeforePublish
          ? t("settings.snapshot.footnote.enabled")
          : t("settings.snapshot.footnote.disabled")}
      </div>
    </div>
  );
}
