import { invokeCommand } from "@/shared/tauri/invokeCommand";
import type {
  ImportExecuteInput,
  ImportPlanInput,
  ImportResult,
  InstallPlan,
  RecoveryReport,
  SaveTextFileInput,
  SaveTextFileResult,
} from "../model";

export type LifecycleInvoker = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export interface LifecycleApi {
  createImportPlan(input: ImportPlanInput): Promise<InstallPlan>;
  executeImportPlan(input: ImportExecuteInput): Promise<ImportResult>;
  saveTextFile(input: SaveTextFileInput): Promise<SaveTextFileResult>;
  recoverStaging(): Promise<RecoveryReport>;
}

export function createLifecycleApi(invoke: LifecycleInvoker = invokeCommand): LifecycleApi {
  return {
    createImportPlan: (input) => invoke<InstallPlan>("import_plan_create", { input }),
    executeImportPlan: (input) => invoke<ImportResult>("import_plan_execute", { input }),
    saveTextFile: (input) => invoke<SaveTextFileResult>("lifecycle_text_file_save", { input }),
    recoverStaging: () => invoke<RecoveryReport>("lifecycle_staging_recover"),
  };
}

export const lifecycleApi = createLifecycleApi();
