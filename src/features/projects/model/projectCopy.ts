import type { UiLanguage } from "@/features/market/model/marketTypes";

export function getProjectCopy(language: UiLanguage) {
  const en = language === "en-US";

  return {
    language,
    actionCancel: en ? "Cancel" : "取消",
    actionClose: en ? "Close" : "关闭",
    actionConfirmTakeover: en ? "Confirm takeover" : "确认接管",
    actionCreateProject: en ? "New Project" : "新增项目",
    actionDelete: en ? "Remove" : "移除",
    actionDisable: en ? "Disable" : "停用",
    actionEdit: en ? "Edit" : "编辑",
    actionEnable: en ? "Enable" : "启用",
    actionJoin: en ? "Add" : "加入",
    actionMount: en ? "Mount" : "挂载",
    actionSave: en ? "Save" : "保存",
    actionSelect: en ? "Select" : "选择",
    actionSync: en ? "Sync" : "同步",
    actionTestPath: en ? "Test Directory" : "测试目录",
    addProjectPlatform: en ? "Connect Project Platform" : "接入项目平台",
    all: en ? "All" : "全部",
    audit: en ? "Audit" : "审计",
    bindSkill: en ? "Mount Skill" : "挂载技能",
    blocked: en ? "Blocked" : "阻塞",
    blockingItems: en ? "Blocked Items" : "阻塞项",
    bindingCanOnlyRemove: en ? "This binding can only be removed" : "当前绑定仅支持移除",
    configureProjectPlatform: en ? "Configure Project Platform" : "配置项目平台",
    copySync: en ? "Copy" : "复制",
    directExecutable: en ? "Ready to Execute" : "可直接执行",
    directExecutableDescription: en
      ? "Matches current sync conditions and can write or remove managed directories as planned."
      : "符合当前同步条件，会按计划写入或撤下托管目录。",
    directory: en ? "Directory" : "目录",
    disableAssignmentImpact: en
      ? "Remove this binding managed project copy."
      : "撤下该绑定的项目空间托管副本",
    disableAssignmentNote: en
      ? "Skill versions and source data are kept. Re-enable later to restore it to the project platform directory."
      : "不会删除技能版本与源数据；重新启用后可再次恢复到项目平台目录。",
    disablePlatformImpact: en
      ? "Remove managed project copies under this platform."
      : "撤下该平台下的项目空间托管副本",
    disablePlatformNote: en
      ? "Project and platform roots are kept. Re-enable later to restore binding copies."
      : "不会删除项目根目录与平台根目录；重新启用后可恢复绑定副本。",
    editProject: en ? "Edit Project" : "编辑项目",
    editProjectBinding: en ? "Edit Project Binding" : "编辑项目绑定",
    emptyBindings: en ? "No bindings" : "暂无绑定",
    emptyPlatforms: en ? "No platforms" : "暂无平台",
    emptyProjects: en ? "No projects" : "暂无项目",
    emptyRecords: en ? "No records" : "暂无记录",
    executionResult: en ? "Result" : "执行结果",
    affectedBindings: en ? "Affected bindings" : "影响绑定",
    ownerPlatform: en ? "Platform" : "所属平台",
    filterReady: en ? "Ready" : "就绪",
    filterRisk: en ? "Needs Attention" : "待处理",
    formDescription: en ? "Notes" : "备注",
    formOptional: en ? "Optional" : "可选",
    latestUpdated: en ? "Recently Updated" : "最近更新",
    managedPath: en ? "Managed Directory" : "目标目录",
    name: en ? "Name" : "名称",
    newProject: en ? "New Project" : "新增项目",
    noAvailableProjectPlatforms: en
      ? "No enabled project-capable platform is available in Platform Center"
      : "平台中心暂无已启用且支持项目空间接入的平台",
    noMoreProjectPlatforms: en
      ? "All project-capable platforms are already connected to this project"
      : "平台中心可接入的平台已全部加入当前项目",
    noProjectPlatformsInCenter: en
      ? "No project platform is available in Platform Center"
      : "平台中心暂无可接入的项目平台",
    notScanned: en ? "Not scanned" : "未校验",
    notSynced: en ? "Not synced" : "未同步",
    overview: en ? "Overview" : "概览",
    pathCurrentMissing: en ? "Directory does not exist yet" : "目录当前不存在",
    pathExistingDirectory: en ? "Directory exists" : "目录已存在",
    pathExistingNotDirectory: en ? "Target exists but is not a directory" : "目标存在但不是目录",
    pathReady: en ? "Directory Ready" : "目录可用",
    pathReadyExisting: en ? "Ready for project connection" : "可直接用于项目接入",
    pathReadyWillCreate: en ? "Parent directory is available; it can be created after saving" : "父目录可用，保存后可创建",
    pathRequiresAction: en ? "Needs Action" : "需处理",
    pathRequiresFix: en ? "Adjust the directory or prepare the parent directory first" : "请调整目录或先准备父目录",
    pathModeCustom: en ? "Custom directory" : "自定义目录",
    pathModeDerived: en ? "Platform default directory" : "平台默认目录",
    pendingConfirmation: en ? "Needs Confirmation" : "需人工确认",
    pendingConfirmationDescription: en
      ? "Selected items will take over existing targets and back up original content during execution."
      : "勾选后本次将接管现有目标，并在执行时先备份原内容。",
    platform: en ? "Platform" : "平台",
    platformBlockedByCenter: en ? "Blocked by Platform Center" : "平台中心阻断",
    platformDirectory: en ? "Platform Directory" : "平台目录",
    platformPausedInProject: en ? "Paused in Project" : "项目内停用",
    platformReadOnly: en ? "Read only" : "只读",
    project: en ? "Project" : "项目",
    projectBinding: en ? "Project Binding" : "项目绑定",
    projectBindings: en ? "Project Bindings" : "项目绑定",
    projectDirectory: en ? "Project Platform Directory" : "项目平台目录",
    projectFormNamePlaceholder: en ? "For example, Skill Studio Pro" : "例如 Skill Studio Pro",
    projectName: en ? "Project Name" : "项目名称",
    projectNotFound: en ? "Project Not Found" : "项目不存在",
    projectRemoveImpact: en
      ? "Remove project registry, platform connections, bindings, and records from Projects."
      : "移除项目空间中的项目登记、平台连接、绑定和记录",
    projectRemoveNote: en
      ? "This does not delete the project directory on disk or unmanaged content inside it."
      : "不会删除磁盘上的项目目录，也不会清理项目目录中的非托管内容。",
    projectRoot: en ? "Project Root" : "项目根目录",
    projectStatusRescanned: en ? "Project status rescanned" : "项目状态已校验",
    projects: en ? "Projects" : "项目",
    readyFirst: en ? "Needs Attention First" : "待处理优先",
    recentRecords: en ? "Recent" : "最近",
    relativeDirectory: en ? "Relative Directory" : "相对目录",
    rescan: en ? "Rescan" : "校验",
    rescanProjectStatus: en ? "Rescan project status" : "校验项目状态",
    rootDirectory: en ? "Root Directory" : "根目录",
    searchPlaceholder: en ? "Search projects or paths" : "搜索项目或路径",
    selectPlatform: en ? "Select platform" : "选择平台",
    selectProjectDirectory: en ? "Select a project directory" : "选择项目内目录",
    selectProjectRoot: en ? "Select project root" : "选择项目根目录",
    skill: en ? "Skill" : "技能",
    skippedThisRun: en ? "Skipped This Run" : "本次跳过",
    skippedThisRunDescription: en ? "No write is needed; current state is preserved." : "当前状态无需写入，保留现状。",
    sortByName: en ? "Name" : "名称",
    status: en ? "Status" : "状态",
    syncPlan: en ? "Sync Plan" : "同步计划",
    syncBlocked: en ? "This platform cannot sync now" : "当前平台暂不可同步",
    syncFinished: (syncedCount: number, skippedCount: number) => en
      ? `Sync complete: wrote ${syncedCount}, skipped ${skippedCount}`
      : `同步完成：写入 ${syncedCount}，跳过 ${skippedCount}`,
    syncRun: en ? "Execute Sync" : "执行同步",
    targetSlugPlaceholder: en ? "Defaults to slug" : "默认使用 slug",
    updated: en ? "Updated" : "最近更新",
    version: en ? "Version" : "版本",
    assignmentDisabled: en ? "Project binding disabled" : "项目绑定已停用",
    assignmentEnabled: en ? "Project binding enabled" : "项目绑定已启用",
    assignmentMounted: en ? "Project binding mounted" : "项目绑定已挂载",
    assignmentRemoved: en ? "Project binding removed" : "项目绑定已解除",
    assignmentUpdated: en ? "Project binding updated" : "项目绑定已更新",
    projectAdded: en ? "Project added" : "项目已加入",
    projectPlatformConnected: en ? "Project platform connected" : "项目平台已接入",
    projectPlatformRemoved: en ? "Project platform removed" : "项目平台已移除",
    projectPlatformUpdated: en ? "Project platform updated" : "项目平台已更新",
    projectRemoved: en ? "Project removed" : "项目已移除",
    projectUpdated: en ? "Project updated" : "项目已更新",
    removeAssignmentImpact: en
      ? "Remove this binding and clean managed project copies."
      : "解除该绑定并清理项目空间托管副本",
    removeAssignmentNote: en
      ? "Unmanaged directories are kept and global skill versions are not affected."
      : "不会删除非托管目录，也不会影响技能中心中的全局版本。",
    removePlatformImpact: en
      ? "Remove all project bindings under this platform and clean managed copies."
      : "解除该平台下全部项目绑定并清理托管副本",
    removePlatformNote: en
      ? "The platform root and unmanaged project content are kept."
      : "不会删除平台根目录，项目目录中的非托管内容也会保留。",
  };
}

export type ProjectCopy = ReturnType<typeof getProjectCopy>;
