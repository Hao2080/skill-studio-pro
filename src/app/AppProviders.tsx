import type { ReactNode } from "react";
import { AppSettingsProvider } from "./providers/AppSettingsContext";
import { I18nProvider } from "./providers/I18nContext";
import { ThemeProvider } from "./providers/ThemeContext";
import { SkillProvider } from "@/features/skills/state/SkillContext";
import { SnapshotProvider } from "@/features/snapshots/state/SnapshotContext";
import { TeamProvider } from "@/features/teams/state/TeamContext";
import { AiAutoEnrichmentProvider } from "@/features/ai-settings/state/AiAutoEnrichmentContext";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <AppSettingsProvider>
      <ThemeProvider>
        <I18nProvider>
          <SkillProvider>
            <SnapshotProvider>
              <TeamProvider><AiAutoEnrichmentProvider>{children}</AiAutoEnrichmentProvider></TeamProvider>
            </SnapshotProvider>
          </SkillProvider>
        </I18nProvider>
      </ThemeProvider>
    </AppSettingsProvider>
  );
}
