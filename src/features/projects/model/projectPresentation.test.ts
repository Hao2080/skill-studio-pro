import { describe, expect, it } from "vitest";
import {
  actionLabel,
  assignmentRuntimeStatus,
  buildSyncPlanMessage,
  getProjectPlatformGovernanceState,
  hasRuntimeIssue,
  isProjectSummary,
  joinDisplayPath,
  projectHasRisk,
  statusLabel,
  statusTone,
} from "./projectPresentation";
import type { PlatformConnection } from "@/types/skill";
import type {
  ProjectDetail,
  ProjectPlatformConnection,
  ProjectSkillAssignment,
  ProjectSummary,
  ProjectSyncPlanRecord,
} from "./projectTypes";

function createProjectSummary(options?: Partial<ProjectSummary>): ProjectSummary {
  return {
    id: "project-1",
    name: "项目一",
    rootPath: "D:\\Project",
    status: "ready",
    platformCount: 1,
    assignmentCount: 2,
    driftCount: 0,
    lastSyncAt: 1,
    lastSyncStatus: "success",
    description: undefined,
    createdAt: 1,
    updatedAt: 1,
    ...options,
  };
}

function createProjectPlatformConnection(
  options?: Partial<ProjectPlatformConnection>,
): ProjectPlatformConnection {
  return {
    id: "connection-1",
    projectId: "project-1",
    platformName: "claude",
    displayName: "Claude",
    pathMode: "derived",
    relativeSkillsDir: ".claude/skills",
    skillsDir: "D:\\Project\\.claude\\skills",
    syncMode: "copy",
    enabled: true,
    status: "ready",
    createdAt: 1,
    updatedAt: 1,
    ...options,
  };
}

function createPlatformConnection(options?: Partial<PlatformConnection>): PlatformConnection {
  return {
    id: "platform-1",
    platformName: "claude",
    displayName: "Claude",
    skillsDir: "D:\\Platform\\skills",
    detected: true,
    enabled: true,
    supportsProjectScope: true,
    ...options,
  };
}

describe("project presentation labels", () => {
  it("maps known statuses and actions to user-facing labels", () => {
    expect(statusTone("ready")).toBe("success");
    expect(statusTone("blocked")).toBe("error");
    expect(statusTone("pending_sync")).toBe("warning");
    expect(statusLabel("missing_path")).toBe("路径缺失");
    expect(actionLabel("copy_replace_confirmed")).toBe("确认后接管");
  });

  it("keeps unknown statuses and actions visible instead of hiding them", () => {
    expect(statusLabel("future_status")).toBe("future_status");
    expect(actionLabel("future_action")).toBe("future_action");
  });
});

describe("project presentation guards", () => {
  it("detects project risk from status, drift count, and sync failure", () => {
    expect(projectHasRisk(createProjectSummary())).toBe(false);
    expect(projectHasRisk(createProjectSummary({ status: "needs_setup" }))).toBe(true);
    expect(projectHasRisk(createProjectSummary({ driftCount: 1 }))).toBe(true);
    expect(projectHasRisk(createProjectSummary({ lastSyncStatus: "failed" }))).toBe(true);
  });

  it("treats disabled assignments as non-runtime issues", () => {
    const assignment = {
      enabled: false,
      runtimeStatus: "missing_snapshot",
    } as ProjectSkillAssignment;

    expect(assignmentRuntimeStatus(assignment)).toBe("disabled");
    expect(hasRuntimeIssue("disabled")).toBe(false);
    expect(hasRuntimeIssue("missing_snapshot")).toBe(true);
  });

  it("distinguishes summary records from detail project records", () => {
    expect(isProjectSummary(createProjectSummary())).toBe(true);
    expect(isProjectSummary({ id: "project-1", name: "项目一" } as ProjectDetail["project"])).toBe(false);
  });
});

describe("project presentation path and sync text", () => {
  it("joins display paths using the parent path separator", () => {
    expect(joinDisplayPath("D:\\Project\\", "skills/demo")).toBe("D:\\Project\\skills/demo");
    expect(joinDisplayPath("/workspace/project/", "skills/demo")).toBe("/workspace/project/skills/demo");
  });

  it("prioritizes blocking and detail messages before generic sync plan text", () => {
    expect(buildSyncPlanMessage({ blockingReason: "权限阻塞" } as ProjectSyncPlanRecord)).toBe("权限阻塞");
    expect(buildSyncPlanMessage({ detailMessage: "需要覆盖" } as ProjectSyncPlanRecord)).toBe("需要覆盖");
    expect(buildSyncPlanMessage({ requiresUserConfirmation: true } as ProjectSyncPlanRecord)).toBe(
      "需先人工确认后再继续处理",
    );
    expect(buildSyncPlanMessage({ status: "skipped" } as ProjectSyncPlanRecord)).toBe("当前状态无需写入");
    expect(buildSyncPlanMessage({ status: "success" } as ProjectSyncPlanRecord)).toBe("可直接执行");
  });
});

describe("project platform governance state", () => {
  it("blocks sync when the platform registry entry is missing", () => {
    const state = getProjectPlatformGovernanceState(createProjectPlatformConnection());

    expect(state).toMatchObject({
      mode: "registry_missing",
      readOnly: true,
      syncBlocked: true,
      tone: "error",
    });
  });

  it("blocks sync when project scope or the registry platform is disabled", () => {
    expect(
      getProjectPlatformGovernanceState(
        createProjectPlatformConnection(),
        createPlatformConnection({ supportsProjectScope: false }),
      ),
    ).toMatchObject({ mode: "registry_scope_disabled", readOnly: true, syncBlocked: true });

    expect(
      getProjectPlatformGovernanceState(
        createProjectPlatformConnection(),
        createPlatformConnection({ enabled: false }),
      ),
    ).toMatchObject({ mode: "registry_disabled", readOnly: true, syncBlocked: true });
  });

  it("allows editing but blocks sync for project-paused platforms", () => {
    expect(
      getProjectPlatformGovernanceState(
        createProjectPlatformConnection({ enabled: false }),
        createPlatformConnection(),
      ),
    ).toMatchObject({ mode: "project_paused", readOnly: false, syncBlocked: true });
  });

  it("keeps active platforms editable and syncable", () => {
    expect(
      getProjectPlatformGovernanceState(createProjectPlatformConnection(), createPlatformConnection()),
    ).toMatchObject({ mode: "active", readOnly: false, syncBlocked: false });
  });
});
