import type { PlatformConnection, PlatformGovernanceImpact } from "@/types/skill";

export type PlatformViewKey = "all" | "enabled" | "detected" | "catalog" | "custom";
export type PlatformBucketKey = Exclude<PlatformViewKey, "all">;
export type UiLanguage = "zh-CN" | "en-US";

export interface PlatformDraft {
  enabled: boolean;
  skillsDir: string;
  syncMode: string;
}

export interface PlatformViewDefinition {
  key: PlatformViewKey;
  label: string;
}

export interface CustomPlatformForm {
  platformName: string;
  displayName: string;
  skillsDir: string;
  syncMode: string;
  supportsProjectScope: boolean;
  supportsSymlink: boolean;
  supportsCopy: boolean;
}

const PLATFORM_BUCKET_ORDER: Record<PlatformBucketKey, number> = {
  enabled: 0,
  detected: 1,
  custom: 2,
  catalog: 3,
};

export const INITIAL_CUSTOM_PLATFORM_FORM: CustomPlatformForm = {
  platformName: "",
  displayName: "",
  skillsDir: "",
  syncMode: "copy",
  supportsProjectScope: false,
  supportsSymlink: true,
  supportsCopy: true,
};

export function getPlatformsCopy(language: UiLanguage) {
  if (language === "en-US") {
    return {
      views: {
        all: "All",
        enabled: "Enabled",
        detected: "Detected",
        catalog: "Not Installed",
        custom: "Custom",
      },
      syncCopy: "Copy",
      syncSymlink: "Symlink",
      noLastSync: "None",
      stateCatalog: "Not Installed",
      stateEnabled: "Enabled",
      stateDetected: "Ready to Enable",
      syncModeCopy: "Copy Sync",
      syncModeSymlink: "Symlink Sync",
      heroTitle: "Platform Center",
      refresh: "Refresh Detection",
      addCustom: "Add Custom Platform",
      loadFailed: "Failed to load Platform Center",
      loading: "Loading platform configuration...",
      empty: "No platforms are available right now. Refresh and try again later.",
      searchPlaceholder: "Search platform name, key, or directory",
      filteredEmpty: "No platforms match the current filters. Adjust the status filter or search keyword.",
      customPlatform: "Custom Platform",
      builtinPlatform: "Built-in Platform",
      viewConfig: "View Config",
      collapseConfig: "Hide Config",
      enableSwitch: (displayName: string) => `${displayName} enable switch`,
      moreActions: (displayName: string) => `${displayName} more actions`,
      deletePlatform: "Delete Platform",
      recentSync: "Last Sync",
      syncMode: "Sync Mode",
      syncDirectory: "Sync Directory",
      notSet: "Not Set",
      chooseFolder: "Choose Folder",
      testPath: "Test Path",
      saveConfig: "Save Config",
      syncModeField: "Sync Mode",
      syncDirectoryField: "Sync Directory",
      syncDirectoryPlaceholder: "Enter a platform sync directory",
      deleteCustomTitle: (name: string) => `Delete custom platform "${name}"`,
      deleteCustomDescription: "The current carrying relationship will be cleared, while sync history will be kept.",
      disableImpactTitle: (name: string) => `Disable platform "${name}"`,
      disableImpactDescription: "Disabling will suspend global release delivery and project-level runtime copies on this platform.",
      deleteImpactDescription: "Deleting will remove the platform entry from Platform Center. Existing project bindings will become read-only until they are removed.",
      delete: "Delete",
      disable: "Disable",
      cancel: "Cancel",
      deleteSuccess: (name: string) => `${name} was deleted`,
      deleteFailed: (message: string) => `Delete failed: ${message}`,
      saveFailed: (message: string) => `Save failed: ${message}`,
      savedConfig: (name: string) => `${name} configuration was saved`,
      quickToggle: (name: string, enabled: boolean) => `${name} ${enabled ? "enabled" : "disabled"}`,
      impactGlobalRelease: "Global releases",
      impactProjectConnection: "Project connections",
      impactEnabledProjectConnection: "Enabled project connections",
      impactAssignment: "Project bindings",
      impactEnabledAssignment: "Enabled bindings",
      impactAffectedProjects: "Affected projects",
      impactNone: "None",
      projectScopeReady: "Project-ready",
      projectScopePaused: "Project runtime paused",
      projectScopeGlobalOnly: "Global only",
      projectScopeUnavailable: "Awaiting detection",
      governanceReady: "Available for global releases and project connections.",
      governancePaused: "Disabled now. Global delivery and project runtime copies are paused.",
      governanceGlobalOnly: "This platform is managed globally only and does not appear in Projects.",
      governanceUnavailable: "No platform directory is detected yet. Configure a valid path before enabling it.",
      testPathRequired: "Enter a sync directory to test first",
      testPathSuccess: "Directory check passed",
      testPathFailed: (message: string) => `Check failed: ${message}`,
      createTitle: "Add Custom Platform",
      createConfirm: "Create Platform",
      platformName: "Platform Name",
      platformNamePlaceholder: "For example: Internal Agent Platform",
      platformKey: "Platform Key",
      platformKeyPlaceholder: "Letters, numbers, spaces, hyphens, and dots only",
      finalKey: "Final key:",
      notGenerated: "Not generated",
      chooseFolderShort: "Choose Folder",
      defaultSyncMode: "Default Sync Mode",
      supportsCopy: "Supports Copy",
      supportsSymlink: "Supports Symlink",
      supportsProjectScope: "Supports Project-level Directory",
      testPathShort: "Test Path",
      createNameRequired: "Enter a platform name",
      createKeyRequired: "The platform key cannot be empty and only supports letters, numbers, spaces, hyphens, and dots",
      createDirRequired: "Enter a platform directory",
      createModeRequired: "Keep at least one sync mode: copy or symlink",
      createSuccess: (name: string) => `Custom platform ${name} was created`,
      createFailed: (message: string) => `Create failed: ${message}`,
    };
  }

  return {
    views: {
      all: "全部",
      enabled: "启用中",
      detected: "待启用",
      catalog: "未安装",
      custom: "自定义",
    },
    syncCopy: "复制",
    syncSymlink: "软链接",
    noLastSync: "暂无",
    stateCatalog: "未安装",
    stateEnabled: "启用中",
    stateDetected: "待启用",
    syncModeCopy: "复制同步",
    syncModeSymlink: "软链接同步",
    heroTitle: "平台中心",
    refresh: "刷新检测",
    addCustom: "新增自定义平台",
    loadFailed: "平台中心加载失败",
    loading: "正在加载平台配置...",
    empty: "当前没有可展示的平台，请稍后刷新检测",
    searchPlaceholder: "搜索平台名称、标识或目录",
    filteredEmpty: "当前筛选条件下没有匹配的平台，请调整状态筛选或搜索关键词",
    customPlatform: "自定义平台",
    builtinPlatform: "内置平台",
    viewConfig: "查看配置",
    collapseConfig: "收起配置",
    enableSwitch: (displayName: string) => `${displayName} 启用开关`,
    moreActions: (displayName: string) => `${displayName} 更多操作`,
    deletePlatform: "删除平台",
    recentSync: "最近同步",
    syncMode: "同步方式",
    syncDirectory: "同步目录",
    notSet: "未设置",
    chooseFolder: "选择目录",
    testPath: "测试路径",
    saveConfig: "保存配置",
    syncModeField: "同步方式",
    syncDirectoryField: "同步目录",
    syncDirectoryPlaceholder: "输入平台同步目录",
    deleteCustomTitle: (name: string) => `删除自定义平台「${name}」`,
    deleteCustomDescription: "删除后会清理当前承接关系，平台历史同步记录会保留。",
    disableImpactTitle: (name: string) => `停用平台「${name}」`,
    disableImpactDescription: "停用后会暂停该平台上的全局承接与项目空间托管副本。",
    deleteImpactDescription: "删除后会从平台中心移除该平台，现有项目绑定会进入只读状态，需后续再解除。",
    delete: "删除",
    disable: "停用",
    cancel: "取消",
    deleteSuccess: (name: string) => `已删除 ${name}`,
    deleteFailed: (message: string) => `删除失败: ${message}`,
    saveFailed: (message: string) => `保存失败: ${message}`,
    savedConfig: (name: string) => `已保存 ${name} 配置`,
    quickToggle: (name: string, enabled: boolean) => `${name}${enabled ? " 已启用" : " 已停用"}`,
    impactGlobalRelease: "全局承接",
    impactProjectConnection: "项目接入",
    impactEnabledProjectConnection: "启用中的项目接入",
    impactAssignment: "项目绑定",
    impactEnabledAssignment: "启用中的绑定",
    impactAffectedProjects: "受影响项目",
    impactNone: "无",
    projectScopeReady: "可接入项目空间",
    projectScopePaused: "项目空间已暂停",
    projectScopeGlobalOnly: "仅全局",
    projectScopeUnavailable: "待检测",
    governanceReady: "当前可同时承接全局发布与项目空间接入。",
    governancePaused: "当前已停用，全局承接与项目空间副本均处于暂停状态。",
    governanceGlobalOnly: "当前仅参与全局承接，不进入项目空间。",
    governanceUnavailable: "尚未检测到平台目录，请先完成目录配置后再启用。",
    testPathRequired: "请先填写要检测的同步目录",
    testPathSuccess: "目录检测通过",
    testPathFailed: (message: string) => `检测失败: ${message}`,
    createTitle: "新增自定义平台",
    createConfirm: "创建平台",
    platformName: "平台名称",
    platformNamePlaceholder: "例如公司内部智能体平台",
    platformKey: "平台标识",
    platformKeyPlaceholder: "仅支持英文、数字、空格、短横线与点",
    finalKey: "最终标识：",
    notGenerated: "未生成",
    chooseFolderShort: "选择目录",
    defaultSyncMode: "默认同步方式",
    supportsCopy: "支持复制",
    supportsSymlink: "支持软链接",
    supportsProjectScope: "支持项目级目录",
    testPathShort: "测试路径",
    createNameRequired: "请输入平台名称",
    createKeyRequired: "平台标识不能为空，且仅支持英文、数字、空格、短横线与点",
    createDirRequired: "请输入平台目录",
    createModeRequired: "复制与软链接至少需要保留一种同步方式",
    createSuccess: (name: string) => `已新增自定义平台 ${name}`,
    createFailed: (message: string) => `创建失败: ${message}`,
  };
}

export function buildPlatformViewDefinitions(language: UiLanguage): PlatformViewDefinition[] {
  const { views } = getPlatformsCopy(language);
  return [
    { key: "all", label: views.all },
    { key: "enabled", label: views.enabled },
    { key: "detected", label: views.detected },
    { key: "catalog", label: views.catalog },
    { key: "custom", label: views.custom },
  ];
}

export function normalizePlatformKeyInput(value: string) {
  return value
    .trim()
    .toLowerCase()
    .split("")
    .map((char) => {
      if (/^[a-z0-9]$/.test(char)) {
        return char;
      }

      if (char === " " || char === "-" || char === ".") {
        return "_";
      }

      return "";
    })
    .join("");
}

export function resolveSupportedSyncMode(
  syncMode: string | undefined,
  supportsCopy: boolean | undefined,
  supportsSymlink: boolean | undefined,
) {
  if (syncMode === "symlink" && supportsSymlink) {
    return "symlink";
  }

  if (supportsCopy !== false) {
    return "copy";
  }

  if (supportsSymlink) {
    return "symlink";
  }

  return "copy";
}

export function buildPlatformDraft(connection: PlatformConnection): PlatformDraft {
  return {
    enabled: connection.enabled,
    skillsDir: connection.skillsDir ?? "",
    syncMode: resolveSupportedSyncMode(
      connection.syncMode,
      connection.supportsCopy,
      connection.supportsSymlink,
    ),
  };
}

export function buildPlatformDrafts(platforms: PlatformConnection[]) {
  return Object.fromEntries(
    platforms.map((platform) => [platform.platformName, buildPlatformDraft(platform)]),
  ) as Record<string, PlatformDraft>;
}

export function getSyncModeOptions(connection: {
  supportsCopy?: boolean;
  supportsSymlink?: boolean;
}, language: UiLanguage) {
  const copy = getPlatformsCopy(language);
  const options = [];

  if (connection.supportsCopy !== false) {
    options.push({ value: "copy", label: copy.syncCopy });
  }

  if (connection.supportsSymlink) {
    options.push({ value: "symlink", label: copy.syncSymlink });
  }

  return options;
}

export function formatLastSync(lastSyncAt: number | undefined, language: UiLanguage) {
  if (!lastSyncAt) {
    return getPlatformsCopy(language).noLastSync;
  }

  return new Intl.DateTimeFormat(language, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(lastSyncAt));
}

export function matchesPlatformSearch(platform: PlatformConnection, query: string) {
  if (!query) {
    return true;
  }

  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return [
    platform.displayName,
    platform.platformName,
    platform.skillsDir,
    platform.platformType,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .some((value) => value.toLowerCase().includes(normalizedQuery));
}

export function getPlatformBucket(platform: PlatformConnection): PlatformBucketKey {
  if (platform.platformType === "custom") {
    return "custom";
  }

  if (platform.detected && platform.enabled) {
    return "enabled";
  }

  if (platform.detected) {
    return "detected";
  }

  return "catalog";
}

export function matchesPlatformView(platform: PlatformConnection, activeView: PlatformViewKey) {
  if (activeView === "all") {
    return true;
  }

  return getPlatformBucket(platform) === activeView;
}

export function comparePlatforms(left: PlatformConnection, right: PlatformConnection, language: UiLanguage) {
  const leftBucket = getPlatformBucket(left);
  const rightBucket = getPlatformBucket(right);

  if (leftBucket !== rightBucket) {
    return PLATFORM_BUCKET_ORDER[leftBucket] - PLATFORM_BUCKET_ORDER[rightBucket];
  }

  return (left.displayName ?? left.platformName).localeCompare(
    right.displayName ?? right.platformName,
    language,
  );
}

export function upsertPlatformConnection(
  platforms: PlatformConnection[],
  nextPlatform: PlatformConnection,
) {
  return [
    ...platforms.filter((platform) => platform.platformName !== nextPlatform.platformName),
    nextPlatform,
  ];
}

export function getStateTone(platform: PlatformConnection) {
  if (platform.platformType === "custom") {
    return "info";
  }

  if (platform.enabled && platform.detected) {
    return "success";
  }

  if (platform.detected) {
    return "warning";
  }

  return "muted";
}

export function getStateLabel(platform: PlatformConnection, language: UiLanguage) {
  const copy = getPlatformsCopy(language);
  if (!platform.detected) {
    return copy.stateCatalog;
  }

  if (platform.enabled) {
    return copy.stateEnabled;
  }

  return copy.stateDetected;
}

export function getProjectScopeLabel(platform: PlatformConnection, language: UiLanguage) {
  const copy = getPlatformsCopy(language);
  if (!platform.detected) {
    return copy.projectScopeUnavailable;
  }
  if (!platform.supportsProjectScope) {
    return copy.projectScopeGlobalOnly;
  }
  if (!platform.enabled) {
    return copy.projectScopePaused;
  }
  return copy.projectScopeReady;
}

export function getProjectScopeTone(platform: PlatformConnection) {
  if (!platform.detected) {
    return "muted";
  }
  if (!platform.supportsProjectScope) {
    return "muted";
  }
  if (!platform.enabled) {
    return "warning";
  }
  return "success";
}

export function getPlatformGovernanceNote(platform: PlatformConnection, language: UiLanguage) {
  const copy = getPlatformsCopy(language);
  if (!platform.detected) {
    return copy.governanceUnavailable;
  }
  if (!platform.enabled) {
    return copy.governancePaused;
  }
  if (!platform.supportsProjectScope) {
    return copy.governanceGlobalOnly;
  }
  return copy.governanceReady;
}

export function getSyncModeLabel(syncMode: string, language: UiLanguage) {
  const copy = getPlatformsCopy(language);
  if (syncMode === "symlink") {
    return copy.syncModeSymlink;
  }

  return copy.syncModeCopy;
}

export function formatAffectedProjects(impact: PlatformGovernanceImpact, emptyLabel: string) {
  if (impact.affectedProjects.length === 0) {
    return emptyLabel;
  }

  const projectNames = impact.affectedProjects.join(" · ");
  if (impact.projectConnectionCount > impact.affectedProjects.length) {
    return `${projectNames} 等 ${impact.projectConnectionCount} 个项目`;
  }

  return projectNames;
}
