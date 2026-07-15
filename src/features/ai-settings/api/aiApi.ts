import { invokeCommand } from "@/shared/tauri/invokeCommand";
import type {
  AiArtifact,
  AiProviderConfig,
  AiProviderSaveInput,
  AiTaskRoute,
  AiTaskRouteSaveInput,
  ArtifactGenerateInput,
  ArtifactListInput,
  ProviderTestResult,
} from "../model";

export type AiInvoker = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export interface AiApi {
  listProviders(): Promise<AiProviderConfig[]>;
  saveProvider(input: AiProviderSaveInput): Promise<AiProviderConfig>;
  testProvider(providerId: string): Promise<ProviderTestResult>;
  listTaskRoutes(): Promise<AiTaskRoute[]>;
  saveTaskRoute(input: AiTaskRouteSaveInput): Promise<AiTaskRoute>;
  generateArtifact(input: ArtifactGenerateInput): Promise<AiArtifact>;
  cancelArtifact(cancellationId: string): Promise<boolean>;
  listArtifacts(input?: ArtifactListInput): Promise<AiArtifact[]>;
}

export function createAiApi(invoke: AiInvoker = invokeCommand): AiApi {
  return {
    listProviders: () => invoke<AiProviderConfig[]>("ai_provider_list"),
    saveProvider: (input) =>
      invoke<AiProviderConfig>("ai_provider_save", {
        input: { ...input, secretMode: input.secretMode ?? "unchanged" },
      }),
    testProvider: (providerId) =>
      invoke<ProviderTestResult>("ai_provider_test", { providerId }),
    listTaskRoutes: () => invoke<AiTaskRoute[]>("ai_task_route_list"),
    saveTaskRoute: (input) => invoke<AiTaskRoute>("ai_task_route_save", { input }),
    generateArtifact: (input) =>
      invoke<AiArtifact>("ai_artifact_generate", {
        input: { ...input, force: input.force ?? false },
      }),
    cancelArtifact: (cancellationId) =>
      invoke<boolean>("ai_artifact_cancel", { cancellationId }),
    listArtifacts: (input = {}) => invoke<AiArtifact[]>("ai_artifact_list", { input }),
  };
}

export const aiApi = createAiApi();
