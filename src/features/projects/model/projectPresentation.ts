import type { PlatformConnection, Skill } from "@/types/skill";
import type { UiLanguage } from "@/features/market/model/marketTypes";
import type {
  ProjectDetail,
  ProjectPlatformConnection,
  ProjectSkillAssignment,
  ProjectSummary,
  ProjectSyncPlanRecord,
} from "./projectTypes";

export type ProjectFilter = "all" | "risk" | "ready";
export type ProjectSort = "updated" | "risk" | "name";

export interface ProjectPlatformGovernanceState {
  mode:
    | "active"
    | "project_paused"
    | "registry_missing"
    | "registry_scope_disabled"
    | "registry_disabled";
  readOnly: boolean;
  syncBlocked: boolean;
  label?: string;
  tone?: "warning" | "error" | "neutral";
  reason?: string;
  syncReason?: string;
}

export function formatDate(value?: number, language: UiLanguage = "zh-CN") {
  if (!value) {
    return language === "en-US" ? "Not synced" : "未同步";
  }
  return new Intl.DateTimeFormat(language, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function statusTone(status: string): "success" | "error" | "warning" | "processing" {
  if (["ready", "in_sync", "in_sync_unverified", "success"].includes(status)) {
    return "success";
  }
  if (
    [
      "blocked",
      "failed",
      "project_changed",
      "target_missing",
      "missing_snapshot",
      "skill_archived",
      "permission_blocked",
      "missing_path",
    ].includes(status)
  ) {
    return "error";
  }
  if (["pending_sync", "partial_success"].includes(status)) {
    return "warning";
  }
  return "processing";
}

export function statusLabel(status: string, language: UiLanguage = "zh-CN") {
  if (language === "en-US") {
    const labels: Record<string, string> = {
      ready: "Ready",
      needs_setup: "Needs setup",
      missing_path: "Missing path",
      permission_blocked: "Permission blocked",
      pending_sync: "Pending sync",
      in_sync: "In sync",
      in_sync_unverified: "Content aligned",
      project_changed: "Project changed",
      target_missing: "Pending write",
      missing_snapshot: "Missing version",
      skill_archived: "Archived",
      disabled: "Disabled",
      skipped: "Skipped",
      success: "Success",
      partial_success: "Partial success",
      failed: "Failed",
      blocked: "Blocked",
    };
    return labels[status] ?? status;
  }

  const labels: Record<string, string> = {
    ready: "就绪",
    needs_setup: "待配置",
    missing_path: "路径缺失",
    permission_blocked: "权限阻塞",
    pending_sync: "待同步",
    in_sync: "已对齐",
    in_sync_unverified: "内容一致",
    project_changed: "项目改动",
    target_missing: "待写入",
    missing_snapshot: "版本缺失",
    skill_archived: "已归档",
    disabled: "已停用",
    skipped: "已跳过",
    success: "成功",
    partial_success: "部分成功",
    failed: "失败",
    blocked: "阻塞",
  };
  return labels[status] ?? status;
}

export function actionLabel(action: string, language: UiLanguage = "zh-CN") {
  if (language === "en-US") {
    const labels: Record<string, string> = {
      noop: "No write",
      park_managed: "Park managed directory",
      park: "Park copy",
      restore: "Restore copy",
      copy_create: "Create directory",
      copy_replace_owned: "Replace managed directory",
      copy_replace_confirmed: "Take over after confirmation",
      blocked_conflict: "Conflict blocked",
      blocked_permission: "Permission blocked",
      blocked_path_out_of_scope: "Out-of-scope path",
    };
    return labels[action] ?? action;
  }

  const labels: Record<string, string> = {
    noop: "无需写入",
    park_managed: "撤下托管目录",
    park: "停放副本",
    restore: "恢复副本",
    copy_create: "新建目录",
    copy_replace_owned: "覆盖托管目录",
    copy_replace_confirmed: "确认后接管",
    blocked_conflict: "冲突阻塞",
    blocked_permission: "权限阻塞",
    blocked_path_out_of_scope: "越界阻塞",
  };
  return labels[action] ?? action;
}

export function assignmentRuntimeStatus(assignment: ProjectSkillAssignment) {
  return assignment.enabled ? assignment.runtimeStatus : "disabled";
}

export function hasRuntimeIssue(status: string) {
  return !["in_sync", "in_sync_unverified", "disabled"].includes(status);
}

export function defaultTargetDirName(skill?: Skill) {
  return skill?.slug ?? "";
}

export function projectHasRisk(project: ProjectSummary) {
  return project.status !== "ready" || project.driftCount > 0 || project.lastSyncStatus === "failed";
}

export function pathModeLabel(pathMode: string, language: UiLanguage = "zh-CN") {
  return pathMode === "custom"
    ? (language === "en-US" ? "Custom directory" : "自定义目录")
    : (language === "en-US" ? "Platform default directory" : "平台默认目录");
}

export function syncModeLabel(syncMode: string, language: UiLanguage = "zh-CN") {
  return syncMode === "copy" ? (language === "en-US" ? "Copy sync" : "复制同步") : syncMode;
}

export function isProjectSummary(project: ProjectSummary | ProjectDetail["project"]): project is ProjectSummary {
  return "platformCount" in project;
}

export function joinDisplayPath(basePath: string, childPath: string) {
  const trimmedBasePath = basePath.replace(/[\\/]+$/, "");
  const separator = trimmedBasePath.includes("\\") ? "\\" : "/";
  return `${trimmedBasePath}${separator}${childPath}`;
}

export function buildSyncPlanMessage(record: ProjectSyncPlanRecord, language: UiLanguage = "zh-CN") {
  if (record.blockingReason) {
    return record.blockingReason;
  }
  if (record.detailMessage) {
    return record.detailMessage;
  }
  if (record.requiresUserConfirmation) {
    return language === "en-US" ? "Requires manual confirmation before continuing" : "需先人工确认后再继续处理";
  }
  if (record.status === "skipped") {
    return language === "en-US" ? "No write needed for current state" : "当前状态无需写入";
  }
  return language === "en-US" ? "Ready to execute" : "可直接执行";
}

export function getProjectPlatformGovernanceState(
  connection: ProjectPlatformConnection,
  source?: PlatformConnection,
  language: UiLanguage = "zh-CN",
): ProjectPlatformGovernanceState {
  const en = language === "en-US";

  if (!source) {
    return {
      mode: "registry_missing",
      readOnly: true,
      syncBlocked: true,
      label: en ? "Missing in Platform Center" : "平台中心缺失",
      tone: "error",
      reason: en
        ? "The platform is no longer in Platform Center. This connection can only be removed."
        : "平台已不在平台中心，当前连接仅支持移除",
      syncReason: en
        ? "The platform is no longer in Platform Center, so sync cannot continue."
        : "平台已不在平台中心，无法继续同步",
    };
  }
  if (!source.supportsProjectScope) {
    return {
      mode: "registry_scope_disabled",
      readOnly: true,
      syncBlocked: true,
      label: en ? "Project Scope Disabled" : "未启用项目空间",
      tone: "warning",
      reason: en
        ? "Project support is disabled in Platform Center. This connection can only be removed."
        : "平台中心未开启项目空间支持，当前连接仅支持移除",
      syncReason: en
        ? "Project support is disabled in Platform Center, so sync cannot continue."
        : "平台中心未开启项目空间支持，无法继续同步",
    };
  }
  if (!source.enabled) {
    return {
      mode: "registry_disabled",
      readOnly: true,
      syncBlocked: true,
      label: en ? "Disabled in Platform Center" : "平台中心已停用",
      tone: "warning",
      reason: en
        ? "Re-enable this platform in Platform Center first. This connection can only be removed."
        : "请先在平台中心重新启用该平台，当前连接仅支持移除",
      syncReason: en
        ? "Re-enable this platform in Platform Center before syncing."
        : "请先在平台中心重新启用该平台，再执行同步",
    };
  }
  if (!connection.enabled) {
    return {
      mode: "project_paused",
      readOnly: false,
      syncBlocked: true,
      label: en ? "Paused in Project" : "项目内停用",
      tone: "neutral",
      reason: en
        ? "This platform is paused in the project. Bindings can still be changed, but nothing will sync to disk."
        : "当前平台在项目内已停用，可继续调整绑定，但不会同步到目录",
      syncReason: en
        ? "Enable this project platform before syncing."
        : "请先启用当前项目平台，再执行同步",
    };
  }
  return { mode: "active", readOnly: false, syncBlocked: false };
}
