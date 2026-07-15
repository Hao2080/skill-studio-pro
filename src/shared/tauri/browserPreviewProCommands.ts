import type { AiProviderConfig, AiTaskRoute } from "@/features/ai-settings/model";
import type { OperationLog } from "@/features/activity/model";
import type { CentralSkill, MappingState } from "@/features/library/model";
import type { InstallPlan } from "@/features/lifecycle/model";
import type { SkillInstance, SkillInstanceDetail } from "@/features/inventory/model";
import type { TrashEntry } from "@/features/trash/model";
import { mockActivities, mockProviderConfigs, mockSkills, mockTrashEntries } from "@/shared/mock/proMockData";

const now = 1_784_150_000_000;

function instance(skill: typeof mockSkills[number]): SkillInstance {
  return {
    id: skill.id,
    centralSkillId: skill.libraryState === "managed" ? `central-${skill.id}` : undefined,
    scanRootId: "preview-root",
    platformName: skill.platforms[0]?.toLowerCase().replace(" code", ""),
    scopeType: "agent_global",
    absolutePath: skill.path,
    normalizedPath: skill.path.toLowerCase(),
    folderName: skill.name,
    parsedName: skill.name,
    canonicalName: skill.name.toLowerCase(),
    description: skill.description,
    shortDescription: skill.description,
    metadata: { tags: skill.tags },
    headings: skill.tags,
    contentHash: `preview-content-${skill.id}`,
    skillMdHash: `preview-md-${skill.id}`,
    fileCount: skill.fileCount ?? 0,
    hasScripts: skill.hasScripts ?? false,
    hasExecutables: false,
    riskFlags: skill.hasScripts ? ["script"] : [],
    duplicateKinds: skill.duplicateState === "conflict" ? ["same_name_different_content"] : skill.duplicateState === "duplicate" ? ["same_name_same_content"] : [],
    parseStatus: "ok",
    parseWarnings: [],
    firstSeenAt: now - 86_400_000,
    lastSeenAt: now,
    lastModifiedAt: now,
  };
}

function instanceDetail(skill: typeof mockSkills[number]): SkillInstanceDetail {
  return {
    instance: instance(skill),
    files: [{ relativePath: "SKILL.md", fileType: "file", sizeBytes: 512, riskFlags: [] }],
    resolution: {
      id: `resolution-${skill.id}`,
      instanceId: skill.id,
      sourceType: skill.source.type,
      sourceLabel: skill.source.label,
      confidence: skill.source.score,
      resolutionStatus: skill.source.status,
      rationale: skill.source.rationale,
      userConfirmed: skill.source.status === "confirmed",
      evidenceHash: `preview-evidence-${skill.id}`,
      resolvedAt: now,
      updatedAt: now,
    },
    evidence: skill.source.evidence.map((value, index) => ({
      id: `${skill.id}-evidence-${index}`,
      instanceId: skill.id,
      evidenceType: "preview",
      evidenceKey: `evidence-${index}`,
      evidenceValue: value,
      weight: 10,
      isConflict: false,
      resolverVersion: "preview-v1",
      observedAt: now,
    })),
  };
}

let providers: AiProviderConfig[] = mockProviderConfigs.map((provider) => ({
  providerId: provider.id,
  providerType: provider.id === "minimax" ? "minimax" : "openai_responses",
  displayName: provider.provider,
  baseUrl: provider.baseUrl,
  defaultModel: provider.modelId,
  secretRef: provider.connection === "connected" ? `preview://${provider.id}` : null,
  secretTail: provider.connection === "connected" ? "7A7A" : null,
  enabled: provider.enabled,
  timeoutMs: 60_000,
  maxConcurrency: 2,
  retryCount: 1,
  lastTestStatus: provider.connection === "connected" ? "success" : null,
  lastTestAt: provider.connection === "connected" ? now : null,
  updatedAt: now,
}));

let routes: AiTaskRoute[] = [
  { taskType: "extract_usage", providerId: "minimax", modelId: "MiniMax-M3", promptVersion: "usage/v1", responsibility: "用法要点提取", enabled: true, updatedAt: now },
  { taskType: "final_summary", providerId: "openai", modelId: "gpt-5.6", promptVersion: "summary/v1", responsibility: "最终摘要与内容提炼", enabled: true, updatedAt: now },
];

let restorePlanEntryId: string | undefined;

let trash: TrashEntry[] = mockTrashEntries.map((entry) => ({
  id: entry.id,
  entityType: "skill",
  entityId: `skill-${entry.id}`,
  displayName: entry.name,
  originalPath: entry.originalPath,
  trashPath: `preview/trash/${entry.id}`,
  manifestPath: `preview/manifests/${entry.id}.json`,
  relatedStateJson: JSON.stringify({ mappings: entry.mappings.map((platformName) => ({ platformName })) }),
  contentHash: `preview-trash-${entry.id}`,
  status: "trashed",
  deletedAt: now - 86_400_000,
}));

const operations: OperationLog[] = mockActivities.map((item, index) => ({
  id: item.id,
  operationType: item.type,
  entityType: "skill",
  entityId: `preview-${index}`,
  targetLabel: item.target,
  status: item.status === "warning" ? "partial_success" : item.status,
  errorSummary: item.status === "failed" ? item.detail : undefined,
  createdAt: now - index * 60_000,
  completedAt: now - index * 60_000 + 500,
}));

const centralSkills: CentralSkill[] = mockSkills.filter((skill) => skill.libraryState !== "external").map((skill) => ({
  id: skill.id,
  name: skill.name,
  slug: skill.name,
  storageRelPath: `skills/${skill.id}/${skill.name}`,
  storagePath: `preview/skills/${skill.id}/${skill.name}`,
  description: skill.description,
  activeContentHash: `preview-content-${skill.id}`,
  lifecycleState: "active",
  createdAt: now - 86_400_000,
  updatedAt: now,
}));

function mapping(skillId: string): MappingState[] {
  const skill = mockSkills.find((item) => item.id === skillId);
  return (skill?.platforms ?? []).map((platformName, index) => ({
    skillId,
    platformName: platformName.toLowerCase().replace(" code", ""),
    snapshotId: "preview-snapshot",
    targetPath: `preview/agents/${platformName}/${skill?.name}`,
    syncMode: "copy",
    publishedContentHash: `preview-content-${skillId}`,
    observedTargetHash: index === 0 && skill?.libraryState === "drifted" ? "drifted" : `preview-content-${skillId}`,
    driftStatus: index === 0 && skill?.libraryState === "drifted" ? "drifted" : "in_sync",
    lastCheckedAt: now,
  }));
}

function createInstallPlan(args?: Record<string, unknown>): InstallPlan {
  const input = args?.input as { sourceType: InstallPlan["provenance"]["sourceType"]; gitUrl?: string; localPath?: string; zipPath?: string };
  const label = input.gitUrl ?? input.localPath ?? input.zipPath ?? "preview source";
  return {
    id: "preview-import-plan",
    provenance: { sourceType: input.sourceType, sourceLabel: label, sourceRef: label, commit: input.gitUrl ? "0123456789abcdef" : undefined },
    stagingPath: "preview/staging/import",
    sourceHash: "preview-source-hash",
    candidates: [{ id: "preview-candidate", name: "preview-skill", slug: "preview-skill", relativePath: ".", contentHash: "preview-content", fileCount: 3, totalBytes: 1024, scripts: [], riskFlags: [], conflicts: [], targetAgents: [] }],
    planHash: "preview-plan-hash",
    createdAt: now,
    expiresAt: now + 300_000,
  };
}

export async function invokeBrowserPreviewProCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  switch (command) {
    case "inventory_root_list": return [{ id: "preview-root", rootType: "agent_global", platformName: "codex", path: "preview/skills", normalizedPath: "preview/skills", enabled: true, recursive: true, watchEnabled: true, ignoreRules: [], createdAt: now, updatedAt: now, available: true }] as T;
    case "inventory_root_upsert": {
      const input = args?.input as { id?: string; rootType: string; platformName?: string; path: string; enabled?: boolean; recursive?: boolean; watchEnabled?: boolean; ignoreRules?: string[] };
      return { id: input.id ?? "preview-root-custom", rootType: input.rootType, platformName: input.platformName, path: input.path, normalizedPath: input.path.toLowerCase(), enabled: input.enabled ?? true, recursive: input.recursive ?? true, watchEnabled: input.watchEnabled ?? true, ignoreRules: input.ignoreRules ?? [], createdAt: now, updatedAt: now, available: true } as T;
    }
    case "inventory_scan_start": return { id: "preview-scan", mode: "incremental", status: "completed", rootsTotal: 1, rootsCompleted: 1, candidatesSeen: mockSkills.length, instancesChanged: 0, errorCount: 0, startedAt: now, completedAt: now } as T;
    case "inventory_scan_cancel": return true as T;
    case "inventory_instance_list": return { items: mockSkills.map(instance), total: mockSkills.length, resolutions: Object.fromEntries(mockSkills.map((skill) => [skill.id, instanceDetail(skill).resolution])) } as T;
    case "inventory_instance_get": {
      const skill = mockSkills.find((item) => item.id === args?.instanceId) ?? mockSkills[0];
      return instanceDetail(skill) as T;
    }
    case "inventory_instance_file_read": return "---\nname: preview-skill\n---\n# Preview Skill\n" as T;
    case "origin_resolution_get": return instanceDetail(mockSkills.find((item) => item.id === args?.instanceId) ?? mockSkills[0]).resolution as T;
    case "origin_resolution_confirm": {
      const input = args?.input as { instanceId: string; sourceType: string; sourceLabel: string; sourceRef?: string };
      return { ...instanceDetail(mockSkills.find((item) => item.id === input.instanceId) ?? mockSkills[0]).resolution, instanceId: input.instanceId, sourceType: input.sourceType, sourceLabel: input.sourceLabel, sourceRef: input.sourceRef, confidence: 100, resolutionStatus: "confirmed", userConfirmed: true, updatedAt: now } as T;
    }
    case "origin_resolution_recalculate": return instanceDetail(mockSkills.find((item) => item.id === (args?.input as {instanceId:string}).instanceId) ?? mockSkills[0]).resolution as T;
    case "library_skill_list": return centralSkills as T;
    case "library_skill_get": return (centralSkills.find((item) => item.id === args?.skillId) ?? centralSkills[0]) as T;
    case "library_skill_drift_check": return mapping(args?.skillId as string) as T;
    case "library_instance_register_plan": return { id: "preview-register-plan", instanceId: (args?.input as {instanceId:string}).instanceId, centralSkillId: "preview-central", name: "preview", slug: "preview", sourcePath: "preview/source", sourceHash: "preview-hash", targetPath: "preview/central", storageRelPath: "skills/preview", planHash: "preview-register-hash", createdAt: now, expiresAt: now + 300_000 } as T;
    case "library_instance_register_execute": return centralSkills[0] as T;
    case "library_skill_publish_plan": {
      const input = args?.input as { skillId: string; snapshotId: string; targets: Array<{platformName:string}> };
      return { id: "preview-publish-plan", skillId: input.skillId, snapshotId: input.snapshotId, sourcePath: "preview/source", sourceHash: "preview-hash", targets: input.targets.map((target) => ({ platformName: target.platformName, displayName: target.platformName, targetPath: `preview/${target.platformName}`, syncMode: "copy", driftStatus: "in_sync", driftPolicy: "abort", status: "ready", symlinkCapability: "supported" })), planHash: "preview-publish-hash", createdAt: now, expiresAt: now + 300_000 } as T;
    }
    case "library_skill_publish_execute": return { planId: "preview-publish-plan", status: "success", targets: [{ platformName: "codex", targetPath: "preview/codex", status: "success", contentHash: "preview-hash" }] } as T;
    case "library_skill_remove_mapping": {
      const input = args?.input as { platformName: string };
      return { platformName: input.platformName, targetPath: `preview/${input.platformName}`, status: "success", contentHash: "preview-hash" } as T;
    }
    case "import_plan_create": return createInstallPlan(args) as T;
    case "import_plan_execute": return { planId: "preview-import-plan", status: "success", imported: [{ candidateId: "preview-candidate", skillId: "preview-skill", name: "preview-skill", slug: "preview-skill", snapshotId: "preview-snapshot", contentHash: "preview-content", action: "install" }], publishDeferred: true, requestedTargetAgents: [] } as T;
    case "lifecycle_text_file_save": {
      const input = args?.input as { skillId: string; relativePath: string };
      return { skillId: input.skillId, relativePath: input.relativePath, beforeHash: "preview-before", afterHash: "preview-after", recoverySnapshotId: "preview-recovery", recoveryPointCreated: true, outdatedMappingCount: 0 } as T;
    }
    case "lifecycle_staging_recover": return { recovered: [], cleaned: [], errors: [] } as T;
    case "trash_plan_create": {
      const skillId = args?.skillId as string;
      const skill = centralSkills.find((item) => item.id === skillId) ?? centralSkills[0];
      return { id: "preview-delete-plan", skillId, displayName: skill.name, originalPath: skill.storagePath, sourceHash: skill.activeContentHash ?? "preview-hash", fileCount: 1, totalBytes: 512, mappings: mapping(skillId), sourcesJson: "[]", planHash: "preview-delete-hash", createdAt: now, expiresAt: now + 300_000 } as T;
    }
    case "trash_move_execute": return trash[0] as T;
    case "trash_list": return trash as T;
    case "trash_restore_plan": {
      const input = args?.input as { trashEntryId: string; mode: string; newName?: string };
      restorePlanEntryId = input.trashEntryId;
      const entry = trash.find((item) => item.id === input.trashEntryId) ?? trash[0];
      const name = input.mode === "new_name" && input.newName ? input.newName : entry.displayName;
      return { id: "preview-restore-plan", trashEntryId: entry.id, skillId: entry.entityId, displayName: entry.displayName, targetName: name, targetSlug: name, targetPath: input.mode === "new_name" ? `preview/skills/${name}` : entry.originalPath, sourceHash: entry.contentHash, mappingsWillBeRepublished: false, planHash: "preview-restore-hash", createdAt: now, expiresAt: now + 300_000 } as T;
    }
    case "trash_restore_execute": { const entry = trash.find((item) => item.id === restorePlanEntryId) ?? trash[0]; trash = trash.filter((item) => item.id !== entry.id); restorePlanEntryId = undefined; return { ...entry, status: "restored", restoredAt: now } as T; }
    case "trash_purge_confirmation_create": return { trashEntryId: args?.trashEntryId, confirmationToken: "preview-confirmation", expiresAt: now + 60_000 } as T;
    case "trash_purge_execute": { const id = (args?.input as {trashEntryId:string}).trashEntryId; trash = trash.filter((item) => item.id !== id); return undefined as T; }
    case "operation_list": return operations as T;
    case "ai_provider_list": return providers as T;
    case "ai_provider_save": {
      const input = args?.input as AiProviderConfig;
      providers = providers.map((provider) => provider.providerId === input.providerId ? {
        ...provider,
        providerType: input.providerType,
        displayName: input.displayName,
        baseUrl: input.baseUrl,
        defaultModel: input.defaultModel,
        enabled: input.enabled,
        timeoutMs: input.timeoutMs,
        maxConcurrency: input.maxConcurrency,
        retryCount: input.retryCount,
        secretRef: `preview://${input.providerId}`,
        secretTail: "7A7A",
        updatedAt: now,
      } : provider);
      return providers.find((provider) => provider.providerId === input.providerId) as T;
    }
    case "ai_provider_test": return { providerId: args?.providerId, status: "success", model: { providerId: args?.providerId, modelId: providers.find((item)=>item.providerId===args?.providerId)?.defaultModel ?? "preview" }, testedAt: now } as T;
    case "ai_task_route_list": return routes as T;
    case "ai_task_route_save": { const input = args?.input as AiTaskRoute; routes = routes.map((route) => route.taskType === input.taskType ? { ...input, updatedAt: now } : route); return routes.find((route) => route.taskType === input.taskType) as T; }
    case "ai_artifact_generate": {
      const input = args?.input as { taskType: AiTaskRoute["taskType"]; skillId?: string; instanceId?: string };
      const route = routes.find((item) => item.taskType === input.taskType) ?? routes[0];
      return { id: "preview-artifact", skillId: input.skillId, instanceId: input.instanceId, taskType: route.taskType, providerId: route.providerId, modelId: route.modelId, modelDisplayName: route.modelId, responsibility: route.responsibility, promptVersion: route.promptVersion, inputHash: "preview-input-hash", content: { summary: "preview" }, status: "success", staleAt: null, createdAt: now } as T;
    }
    case "ai_artifact_cancel": return true as T;
    case "ai_artifact_list": return [] as T;
    default: throw new Error(`浏览器 Pro 预览暂未实现命令: ${command}`);
  }
}
