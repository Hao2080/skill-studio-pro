import type { SkillSnapshot } from "@/types/skill";
import { isSystemSnapshot } from "@/features/snapshots/model/snapshotSource";
import type { UiLanguage } from "./presentationTypes";

export function formatSnapshotTime(createdAt: number, locale: UiLanguage) {
  return new Date(createdAt).toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatFileCount(count: number, language: UiLanguage) {
  if (language === "en-US") {
    return `${count} file${count === 1 ? "" : "s"}`;
  }

  return `${count} 个`;
}

export function getSnapshotStateLabel(
  snapshot: SkillSnapshot,
  latestSnapshot: SkillSnapshot | null,
  language: UiLanguage,
) {
  const labels = language === "en-US"
    ? {
        system: "System Restore Point",
        activeCaptured: "Active · Captured",
        active: "Active",
        captured: "Captured",
        stable: "Stable Version",
      }
    : {
        system: "系统恢复点",
        activeCaptured: "生效中 · 已入快照",
        active: "生效中",
        captured: "已入快照",
        stable: "稳定版本",
      };
  if (isSystemSnapshot(snapshot)) {
    return labels.system;
  }

  if (snapshot.isActive && latestSnapshot?.id === snapshot.id) {
    return labels.activeCaptured;
  }

  if (snapshot.isActive) {
    return labels.active;
  }

  if (latestSnapshot?.id === snapshot.id) {
    return labels.captured;
  }

  return labels.stable;
}

export function getWorkspaceRelationLabel(
  snapshot: SkillSnapshot,
  latestSnapshot: SkillSnapshot | null,
  activeSnapshot: SkillSnapshot | null,
  hasWorkspaceChanges: boolean,
  language: UiLanguage,
) {
  const labels = language === "en-US"
    ? {
        system: "Used only to restore the current workspace and excluded from the formal version flow.",
        latestChanged: "The workspace has diverged from this version.",
        latestAligned: "The workspace is aligned with this version.",
        activeChanged: "The workspace continued editing from this version.",
        activeAligned: "The workspace is aligned with this release baseline.",
        history: "The workspace is no longer staying on this historical version.",
      }
    : {
        system: "仅用于恢复当前工作副本，不参与正式版本链路",
        latestChanged: "工作区已偏离此版本",
        latestAligned: "工作区当前与此版本一致",
        activeChanged: "工作区已基于此版本继续编辑",
        activeAligned: "工作区当前与此发布基线一致",
        history: "工作区当前已不再停留在这个历史版本",
      };
  if (isSystemSnapshot(snapshot)) {
    return labels.system;
  }

  if (latestSnapshot?.id === snapshot.id) {
    return hasWorkspaceChanges ? labels.latestChanged : labels.latestAligned;
  }

  if (activeSnapshot?.id === snapshot.id) {
    return hasWorkspaceChanges ? labels.activeChanged : labels.activeAligned;
  }

  return labels.history;
}

export function getVersionDetailCopy(language: UiLanguage) {
  return language === "en-US"
    ? {
        workspace: "Workspace",
        workspacePending: "No Baseline",
        workspaceDraft: "Draft",
        workspaceStable: "Stable",
        workspaceDescriptionWithChanges: (count: number) =>
          `${count} files are still in draft state and have not entered the latest snapshot.`,
        workspaceDescriptionAligned: (snapshotNumber: number) =>
          `The workspace is aligned with the latest snapshot v${snapshotNumber} and can continue to be edited.`,
        workspaceDescriptionEmpty:
          "Create the first snapshot before establishing a version baseline, release flow, and team delivery flow.",
        currentStatus: "Current Status",
        changedFiles: "Changed Files",
        baseline: "Version Baseline",
        baselineLatest: (snapshotNumber: number) => `Latest Snapshot v${snapshotNumber}`,
        baselineMissing: "Not Established",
        noBaselineTitle: "There is no version baseline yet",
        compareReadyTitle: (snapshotNumber: number) => `Latest snapshot v${snapshotNumber} is ready as the compare base`,
        workspaceHintTitle: "Workspace Overview",
        noBaselineBody: "Create the first snapshot before continuing with version management actions.",
        compareReadyBody: "You can compare with the workspace directly, or cancel the current compare draft.",
        workspaceHintBody: "Review the relationship between the workspace and its baseline before the next action.",
        compareWorkspace: "Compare Workspace",
        cancelCompare: "Cancel Compare",
        goFiles: "Open Files",
        chooseVersion: "Select a Version",
        pendingSelection: "Pending Selection",
        chooseVersionDescription: "Select the workspace or a snapshot from the left side.",
        restore: "Restore to Workspace",
        setActive: "Set as Active Version",
        type: "Type",
        typeSystem: "System Restore Point",
        typeFormal: "Formal Version",
        status: "Status",
        createdAt: "Created At",
        relation: "Workspace Relation",
        compareReady: "Current version is set as compare base",
        compareReadyDescription: "Choose a target next to enter compare mode.",
        summaryTitle: "Version Summary",
        systemSummaryHint: "Keep the system-generated reason to avoid mixing it with formal version notes.",
        manualSummaryHint: "The full note, delivery purpose, and remarks for this snapshot.",
        saveSummary: "Save Summary",
        cancelEdit: "Cancel Edit",
        editSummary: "Edit Summary",
        summaryPlaceholder: "Describe the scope and purpose carried by this snapshot",
        systemSummaryFallback: "System restore points keep their generated reason to stay distinct from formal notes.",
        manualSummaryFallback:
          "There is no summary yet. Add the scope, risk note, or delivery purpose of this snapshot.",
        deleteTitle: "Delete Snapshot",
        deleteDescription: "Only this snapshot will be removed. The workspace and other versions stay intact.",
        deleteConfirmTitle: "Delete this snapshot?",
        deleteConfirmDescription: "The active version cannot be deleted.",
        delete: "Delete Snapshot",
        workspaceHeadline: "Review workspace drafts, baseline, and the current state before snapshotting.",
        workspaceMetaAria: "Workspace version details",
        compareReadyAria: "Compare ready state",
        workspaceHintAria: "Workspace hint toolbar",
        snapshotHeadlineSystem: "System-generated restore point used only for recovering the workspace.",
        snapshotHeadlineFormal: "Review summary, baseline relation, and the follow-up actions after restoring.",
        snapshotMetaAria: "Snapshot version details",
        summaryAria: "Version summary section",
        deleteConfirm: "Delete",
        cancel: "Cancel",
      }
    : {
        workspace: "工作区",
        workspacePending: "未建基线",
        workspaceDraft: "草稿中",
        workspaceStable: "稳定",
        workspaceDescriptionWithChanges: (count: number) =>
          `当前工作副本有 ${count} 个文件处于草稿态，还没有进入最新快照。`,
        workspaceDescriptionAligned: (snapshotNumber: number) =>
          `当前工作副本已经和最新快照 v${snapshotNumber} 对齐，可直接查看或继续编辑。`,
        workspaceDescriptionEmpty: "先创建首个快照，后续才能建立版本基线、对外发布与团队交付。",
        currentStatus: "当前状态",
        changedFiles: "变更文件",
        baseline: "版本基线",
        baselineLatest: (snapshotNumber: number) => `最新快照 v${snapshotNumber}`,
        baselineMissing: "尚未建立",
        noBaselineTitle: "当前还没有版本基线",
        compareReadyTitle: (snapshotNumber: number) => `已将最新快照 v${snapshotNumber} 设为对比基准`,
        workspaceHintTitle: "工作区说明",
        noBaselineBody: "先创建首个快照，再继续后续的版本管理动作。",
        compareReadyBody: "可以直接对比工作区，也可以取消当前对比草稿。",
        workspaceHintBody: "当前工作副本与版本基线的关系、草稿状态与后续操作。",
        compareWorkspace: "对比工作区",
        cancelCompare: "取消对比",
        goFiles: "前往文件",
        chooseVersion: "选择一个版本",
        pendingSelection: "待选择",
        chooseVersionDescription: "从左侧选择工作区或快照。",
        restore: "恢复到工作区",
        setActive: "设为生效版本",
        type: "类型",
        typeSystem: "系统恢复点",
        typeFormal: "正式版本",
        status: "状态",
        createdAt: "创建时间",
        relation: "与工作区关系",
        compareReady: "已将当前版本设为对比基准",
        compareReadyDescription: "下一步选择目标对象，即可进入对比模式。",
        summaryTitle: "版本说明",
        systemSummaryHint: "保留系统生成原因，避免和正式版本说明混淆。",
        manualSummaryHint: "当前快照的完整说明、交付目的与备注信息。",
        saveSummary: "保存说明",
        cancelEdit: "取消编辑",
        editSummary: "编辑说明",
        summaryPlaceholder: "填写版本说明，说明这次快照承载的改动与目的",
        systemSummaryFallback: "系统恢复点会保留自动生成原因，避免与正式版本说明混用。",
        manualSummaryFallback: "当前还没有版本说明，可补充这次快照的改动范围、风险提示或交付目的。",
        deleteTitle: "删除快照",
        deleteDescription: "仅删除当前快照，不会影响工作区或其他版本记录。",
        deleteConfirmTitle: "确定删除该快照？",
        deleteConfirmDescription: "当前生效版本不能删除。",
        delete: "删除快照",
        workspaceHeadline: "查看工作副本草稿、版本基线与进入快照前的当前状态。",
        workspaceMetaAria: "工作区版本详情",
        compareReadyAria: "对比准备状态",
        workspaceHintAria: "工作区说明工具条",
        snapshotHeadlineSystem: "系统自动生成的恢复点，仅用于回到工作区。",
        snapshotHeadlineFormal: "查看版本说明、基线关系与回到工作区后的后续操作。",
        snapshotMetaAria: "快照版本详情",
        summaryAria: "版本说明区域",
        deleteConfirm: "删除",
        cancel: "取消",
      };
}
