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

interface PlatformConnectionsResponse {
  platforms: PlatformConnection[];
}

export async function listPlatformConnections(): Promise<PlatformConnection[]> {
  const response = await invokeCommand<PlatformConnectionsResponse>("platform_detect");
  return response.platforms;
}

export async function savePlatformConnection(input: SavePlatformConnectionInput): Promise<PlatformConnection> {
  return invokeCommand<PlatformConnection>("save_platform_connection", { input });
}

export async function getPlatformGovernanceImpact(platformName: string): Promise<PlatformGovernanceImpact> {
  return invokeCommand<PlatformGovernanceImpact>("platform_governance_impact", { platformName });
}

export async function createCustomPlatform(input: CreateCustomPlatformInput): Promise<PlatformConnection> {
  return invokeCommand<PlatformConnection>("create_custom_platform", { input });
}

export async function deleteCustomPlatform(input: DeleteCustomPlatformInput): Promise<void> {
  return invokeCommand<void>("delete_custom_platform", { input });
}

export async function testPlatformPath(skillsDir: string): Promise<TestPlatformPathResult> {
  return invokeCommand<TestPlatformPathResult>("test_platform_path", {
    input: { skillsDir },
  });
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
