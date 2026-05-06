import { invokeCommand } from "@/shared/tauri/invokeCommand";
import type { AppSettings } from "@/types/skill";

export interface DbHealthResponse {
  workspacePath: string;
  dbPath: string;
  settingsPath: string;
  skillsPath: string;
  projectsPath: string;
  snapshotsPath: string;
  tables: string[];
}

export async function getAppSettings(): Promise<AppSettings> {
  return invokeCommand<AppSettings>("get_app_settings");
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  return invokeCommand<void>("save_app_settings", { settings });
}

export async function getDbHealth(): Promise<DbHealthResponse> {
  return invokeCommand<DbHealthResponse>("db_health_check");
}
