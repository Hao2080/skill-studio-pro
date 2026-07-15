import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { AppSettings } from "@/types/skill";
import { getAppSettings, saveAppSettings } from "@/features/settings/api/settingsApi";

const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  uiLanguage: "system",
  snapshotBeforePublish: true,
  snapshotMaxCount: 20,
};

interface AppSettingsContextValue {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  loading: boolean;
}

const AppSettingsContext = createContext<AppSettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  updateSettings: async () => {},
  loading: true,
});

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const settingsRef = useRef<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    getAppSettings()
      .then((result) => {
        settingsRef.current = result;
        setSettings(result);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    const next = { ...settingsRef.current, ...partial };
    settingsRef.current = next;
    setSettings(next);
    await saveAppSettings(next);
  }, []);

  return (
    <AppSettingsContext.Provider value={{ settings, updateSettings, loading }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  return useContext(AppSettingsContext);
}
