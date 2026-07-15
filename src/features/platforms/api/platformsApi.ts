import { open } from "@tauri-apps/plugin-dialog";
import { invokeCommand } from "@/shared/tauri/invokeCommand";
import type {
  CreateCustomPlatformInput,
  DeleteCustomPlatformInput,
  PlatformConnection,
  PlatformGovernanceImpact,
  SavePlatformConnectionInput,
  TestPlatformPathResult,
} from "@/types/skill";
import type {
  ExecutePlanInput,
  MappingState,
  PublishPlan,
  PublishPlanInput,
  PublishResult,
  PublishTargetResult,
  RemoveMappingInput,
} from "@/features/library/model";

interface PlatformConnectionsResponse {
  platforms: PlatformConnection[];
}

export type PlatformsInvoker = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export interface PlatformsApi {
  listConnections(): Promise<PlatformConnection[]>;
  saveConnection(input: SavePlatformConnectionInput): Promise<PlatformConnection>;
  getGovernanceImpact(platformName: string): Promise<PlatformGovernanceImpact>;
  createCustom(input: CreateCustomPlatformInput): Promise<PlatformConnection>;
  deleteCustom(input: DeleteCustomPlatformInput): Promise<void>;
  testPath(skillsDir: string): Promise<TestPlatformPathResult>;
}

export function createPlatformsApi(invoke: PlatformsInvoker = invokeCommand): PlatformsApi {
  return {
    listConnections: async () => (await invoke<PlatformConnectionsResponse>("platform_detect")).platforms,
    saveConnection: (input) => invoke<PlatformConnection>("save_platform_connection", { input }),
    getGovernanceImpact: (platformName) => invoke<PlatformGovernanceImpact>("platform_governance_impact", { platformName }),
    createCustom: (input) => invoke<PlatformConnection>("create_custom_platform", { input }),
    deleteCustom: (input) => invoke<void>("delete_custom_platform", { input }),
    testPath: (skillsDir) => invoke<TestPlatformPathResult>("test_platform_path", { input: { skillsDir } }),
  };
}

export const platformsApi = createPlatformsApi();

export async function listPlatformConnections(): Promise<PlatformConnection[]> {
  return platformsApi.listConnections();
}

export async function savePlatformConnection(input: SavePlatformConnectionInput): Promise<PlatformConnection> {
  return platformsApi.saveConnection(input);
}

export async function getPlatformGovernanceImpact(platformName: string): Promise<PlatformGovernanceImpact> {
  return platformsApi.getGovernanceImpact(platformName);
}

export async function createCustomPlatform(input: CreateCustomPlatformInput): Promise<PlatformConnection> {
  return platformsApi.createCustom(input);
}

export async function deleteCustomPlatform(input: DeleteCustomPlatformInput): Promise<void> {
  return platformsApi.deleteCustom(input);
}

export async function testPlatformPath(skillsDir: string): Promise<TestPlatformPathResult> {
  return platformsApi.testPath(skillsDir);
}

export async function pickPlatformDirectory(): Promise<string | null> {
  const folderPath = await open({
    directory: true,
    multiple: false,
    title: "选择平台技能目录",
  });

  if (!folderPath || Array.isArray(folderPath)) {
    return null;
  }

  return folderPath;
}

export async function previewPlatformPublish(input: PublishPlanInput): Promise<PublishPlan> {
  return invokeCommand<PublishPlan>("library_skill_publish_plan", { input });
}

export async function executePlatformPublish(input: ExecutePlanInput): Promise<PublishResult> {
  return invokeCommand<PublishResult>("library_skill_publish_execute", { input });
}

export async function removeManagedPlatformMapping(
  input: RemoveMappingInput,
): Promise<PublishTargetResult> {
  return invokeCommand<PublishTargetResult>("library_skill_remove_mapping", { input });
}

export async function checkPlatformMappingDrift(skillId: string): Promise<MappingState[]> {
  return invokeCommand<MappingState[]>("library_skill_drift_check", { skillId });
}
