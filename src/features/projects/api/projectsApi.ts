import { open } from "@tauri-apps/plugin-dialog";
import { invokeCommand } from "@/shared/tauri/invokeCommand";
import type { TestPlatformPathResult } from "@/types/skill";
import type {
  CreateProjectInput,
  ExecuteProjectSyncInput,
  Project,
  ProjectDetail,
  ProjectPlatformConnection,
  ProjectSkillAssignment,
  ProjectSummary,
  ProjectSyncLog,
  ProjectSyncPlan,
  ProjectSyncResult,
  SaveProjectPlatformConnectionInput,
  SaveProjectSkillAssignmentInput,
  TestProjectPlatformPathInput,
  UpdateProjectInput,
} from "../model/projectTypes";

export async function listProjects(): Promise<ProjectSummary[]> {
  return invokeCommand<ProjectSummary[]>("project_list");
}

export async function getProject(projectId: string): Promise<ProjectDetail> {
  return invokeCommand<ProjectDetail>("project_get", { projectId });
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  return invokeCommand<Project>("project_create", { input });
}

export async function updateProject(input: UpdateProjectInput): Promise<Project> {
  return invokeCommand<Project>("project_update", { input });
}

export async function deleteProject(projectId: string): Promise<void> {
  return invokeCommand<void>("project_delete", {
    input: { projectId },
  });
}

export async function rescanProject(projectId: string): Promise<ProjectDetail> {
  return invokeCommand<ProjectDetail>("project_rescan", { projectId });
}

export async function saveProjectPlatformConnection(
  input: SaveProjectPlatformConnectionInput,
): Promise<ProjectPlatformConnection> {
  return invokeCommand<ProjectPlatformConnection>("project_platform_save", { input });
}

export async function deleteProjectPlatformConnection(
  projectId: string,
  platformName: string,
): Promise<void> {
  return invokeCommand<void>("project_platform_delete", {
    input: { projectId, platformName },
  });
}

export async function testProjectPlatformPath(
  input: TestProjectPlatformPathInput,
): Promise<TestPlatformPathResult> {
  return invokeCommand<TestPlatformPathResult>("project_platform_test_path", {
    input,
  });
}

export async function saveProjectSkillAssignment(
  input: SaveProjectSkillAssignmentInput,
): Promise<ProjectSkillAssignment> {
  return invokeCommand<ProjectSkillAssignment>("project_assignment_save", { input });
}

export async function deleteProjectSkillAssignment(assignmentId: string): Promise<void> {
  return invokeCommand<void>("project_assignment_delete", {
    input: { assignmentId },
  });
}

export async function buildProjectSyncPlan(
  projectId: string,
  platformName: string,
): Promise<ProjectSyncPlan> {
  return invokeCommand<ProjectSyncPlan>("project_sync_plan", { projectId, platformName });
}

export async function syncProjectPlatform(
  input: ExecuteProjectSyncInput,
): Promise<ProjectSyncResult> {
  return invokeCommand<ProjectSyncResult>("project_sync_platform", { input });
}

export async function listProjectSyncLogs(projectId: string, limit = 30): Promise<ProjectSyncLog[]> {
  return invokeCommand<ProjectSyncLog[]>("project_sync_logs", { projectId, limit });
}

export async function pickProjectRootDirectory(title = "选择项目根目录"): Promise<string | null> {
  const folderPath = await open({
    directory: true,
    multiple: false,
    title,
  });

  if (!folderPath || Array.isArray(folderPath)) {
    return null;
  }

  return folderPath;
}

export async function pickProjectPlatformDirectory(title = "选择项目平台技能目录"): Promise<string | null> {
  const folderPath = await open({
    directory: true,
    multiple: false,
    title,
  });

  if (!folderPath || Array.isArray(folderPath)) {
    return null;
  }

  return folderPath;
}
