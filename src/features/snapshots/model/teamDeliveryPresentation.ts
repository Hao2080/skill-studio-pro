import type { SkillSnapshot } from "@/types/skill";
import type {
  SkillTeamDeliveryStatus,
  TeamDeliveryRecord,
} from "@/types/team";
import { isSystemSnapshot } from "@/features/snapshots/model/snapshotSource";
import type { UiLanguage } from "./presentationTypes";

export function formatDeliveryTime(timestamp: number, locale: UiLanguage) {
  return new Date(timestamp).toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTeamCount(count: number, language: UiLanguage) {
  if (language === "en-US") {
    return `${count} team${count === 1 ? "" : "s"}`;
  }

  return `${count} 个团队`;
}

export function getDeliveryActionLabel(action: string, language: UiLanguage) {
  const labels = language === "en-US"
    ? {
        submit: "Submit",
        replacePending: "Replace Pending",
        resubmit: "Resubmit",
        switch: "Switch",
        merge: "Merge",
        reject: "Reject",
        withdraw: "Withdraw",
        remove: "Remove",
        record: "Record",
      }
    : {
        submit: "提交",
        replacePending: "改交",
        resubmit: "重提",
        switch: "改交",
        merge: "合并",
        reject: "拒绝",
        withdraw: "撤回",
        remove: "解除承接",
        record: "记录",
      };

  switch (action) {
    case "submit":
      return labels.submit;
    case "replace_pending":
      return labels.replacePending;
    case "resubmit":
      return labels.resubmit;
    case "switch":
      return labels.switch;
    case "merge":
      return labels.merge;
    case "reject":
      return labels.reject;
    case "withdraw":
      return labels.withdraw;
    case "remove":
      return labels.remove;
    default:
      return labels.record;
  }
}

export function getTeamState(
  delivery: SkillTeamDeliveryStatus,
  selectedSnapshot: SkillSnapshot | null,
  language: UiLanguage,
) {
  if (selectedSnapshot) {
    if (delivery.pendingDelivery?.sourceSnapshotId === selectedSnapshot.id) {
      return {
        tone: "ready" as const,
        label: language === "en-US" ? "Current Version Pending" : "待审当前版本",
        detail: language === "en-US"
          ? "The selected snapshot is already in this team's review queue."
          : "当前选中快照已经进入该团队待审队列。",
      };
    }

    if (delivery.currentTarget?.sourceSnapshotId === selectedSnapshot.id) {
      return {
        tone: "ready" as const,
        label: language === "en-US" ? "Serving Current Version" : "承接当前版本",
        detail: language === "en-US"
          ? "This team is already serving the selected snapshot version."
          : "该团队当前已经承接选中的快照版本。",
      };
    }

    if (delivery.pendingDelivery) {
      return {
        tone: "active" as const,
        label: language === "en-US"
          ? `Pending v${delivery.pendingDelivery.sourceSnapshotNumber}`
          : `待审 v${delivery.pendingDelivery.sourceSnapshotNumber}`,
        detail: language === "en-US"
          ? "This team already has another pending delivery and can switch to the current snapshot."
          : "该团队当前存在另一条待审交付，可直接改交为当前快照。",
      };
    }

    if (delivery.currentTarget) {
      return {
        tone: "active" as const,
        label: language === "en-US"
          ? `Serving v${delivery.currentTarget.sourceSnapshotNumber}`
          : `承接 v${delivery.currentTarget.sourceSnapshotNumber}`,
        detail: language === "en-US"
          ? "This team is serving another snapshot and can switch directly."
          : "该团队当前承接的是另一份快照，可直接切换交付对象。",
      };
    }
  }

  if (delivery.pendingDelivery) {
    return {
      tone: "warning" as const,
      label: language === "en-US"
        ? `Pending v${delivery.pendingDelivery.sourceSnapshotNumber}`
        : `待审 v${delivery.pendingDelivery.sourceSnapshotNumber}`,
      detail: language === "en-US"
        ? "This team has a pending delivery that still needs review or withdrawal."
        : "当前团队有待审交付，需要继续处理评审或撤回。",
    };
  }

  if (delivery.currentTarget) {
    return {
      tone: "neutral" as const,
      label: language === "en-US"
        ? `Serving v${delivery.currentTarget.sourceSnapshotNumber}`
        : `承接 v${delivery.currentTarget.sourceSnapshotNumber}`,
      detail: language === "en-US" ? "This team already has a stable served version." : "当前团队已有稳定承接版本。",
    };
  }

  return {
    tone: "neutral" as const,
    label: language === "en-US" ? "Not Serving" : "未承接",
    detail: language === "en-US" ? "This team is not serving the skill yet." : "当前团队还没有承接此技能。",
  };
}

export function getPrimaryActionLabel(
  delivery: SkillTeamDeliveryStatus,
  selectedSnapshot: SkillSnapshot | null,
  language: UiLanguage,
) {
  if (!selectedSnapshot || isSystemSnapshot(selectedSnapshot)) {
    return null;
  }

  if (delivery.pendingDelivery?.sourceSnapshotId === selectedSnapshot.id) {
    return language === "en-US" ? "Resubmit" : "重新提交";
  }

  if (delivery.pendingDelivery) {
    return language === "en-US" ? "Switch to This Version" : "改交为此版本";
  }

  if (delivery.currentTarget?.sourceSnapshotId === selectedSnapshot.id) {
    return language === "en-US" ? "Resubmit" : "重新提交";
  }

  if (delivery.currentTarget) {
    return language === "en-US" ? "Switch to This Version" : "改交为此版本";
  }

  return language === "en-US" ? "Deliver This Version" : "交付此版本";
}

export function getCurrentTargetDetail(delivery: SkillTeamDeliveryStatus, language: UiLanguage) {
  if (!delivery.currentTarget) {
    return language === "en-US" ? "This team is not serving any version yet." : "当前团队还没有承接版本。";
  }

  const versionLabel = delivery.currentTarget.teamVersionNumber
    ? (language === "en-US"
      ? `Team Version v${delivery.currentTarget.teamVersionNumber}`
      : `团队版本 v${delivery.currentTarget.teamVersionNumber}`)
    : (language === "en-US" ? "Waiting for team version generation" : "等待团队版本生成");
  const summary =
    delivery.currentTarget.changeSummary?.trim() ||
    (language === "en-US" ? "The current served version has no summary yet." : "当前承接版本还没有补充说明。");

  return `${versionLabel} · ${summary}`;
}

export function getPendingDetail(delivery: SkillTeamDeliveryStatus, language: UiLanguage) {
  if (!delivery.pendingDelivery) {
    return language === "en-US" ? "There is no pending delivery." : "当前没有待审交付。";
  }

  const submitMessage = delivery.pendingDelivery.submitMessage?.trim();
  if (submitMessage) {
    return `${delivery.pendingDelivery.submitter} · ${submitMessage}`;
  }

  return language === "en-US"
    ? `${delivery.pendingDelivery.submitter} submitted it and is waiting for the team to process it.`
    : `${delivery.pendingDelivery.submitter} 提交，等待团队处理。`;
}

export function getRecordHeadline(record: TeamDeliveryRecord, language: UiLanguage) {
  const snapshotLabel = record.sourceSnapshotNumber != null ? ` · v${record.sourceSnapshotNumber}` : "";
  const suffix =
    language === "en-US"
      ? (record.status === "pending" ? "Pending" : record.status === "failed" ? "Failed" : "Done")
      : (record.status === "pending" ? "待处理" : record.status === "failed" ? "失败" : "完成");

  return language === "en-US"
    ? `${getDeliveryActionLabel(record.action, language)} · ${suffix}${snapshotLabel}`
    : `${getDeliveryActionLabel(record.action, language)}${suffix}${snapshotLabel}`;
}

export function getRecordDetail(record: TeamDeliveryRecord, language: UiLanguage) {
  if (record.note?.trim()) {
    return record.note.trim();
  }

  if (record.action === "merge" && record.teamVersionNumber != null) {
    return language === "en-US"
      ? `It has entered team version v${record.teamVersionNumber}.`
      : `已进入团队版本 v${record.teamVersionNumber}。`;
  }

  if (record.changeSummary?.trim()) {
    return record.changeSummary.trim();
  }

  return language === "en-US" ? "The team delivery record has been written." : "已写入团队交付记录。";
}

export function getTeamDeliveryCopy(language: UiLanguage) {
  return language === "en-US"
    ? {
        title: "Team Delivery",
        blocked: "Unavailable",
        workbench: "Team Workbench",
        needSnapshot: "Select Snapshot",
        subtitle:
          "Manage served versions, pending submissions, merge outcomes, and removals by team instead of relying on session-only prompts.",
        deliver: "Deliver to Teams",
        openTeams: "Open Teams",
        currentObject: "Current Object",
        currentServing: "Current Version Served",
        currentPending: "Current Version Pending",
        latestAction: "Latest Action",
        workspaceDraft: "Working Copy Draft",
        blockedDirect: "Not deliverable",
        none: "None",
        serving: "Serving",
        notServing: "Not Serving",
        pendingQueue: "Pending Queue",
        idle: "Idle",
        noPending: "No Pending",
        targetCell: "Current Serving",
        pendingCell: "Pending Queue",
        recordCell: "Latest Record",
        teamVersionNone: "No Record",
        hasServing: "Serving",
        noServing: "Not Serving",
        hasPending: "Pending Exists",
        noPendingTag: "No Pending",
        withdraw: "Withdraw Pending",
        viewRecords: "View Records",
        remove: "Remove Serving",
        emptyTitle: "No team delivery data yet",
        emptyDescription: "After teams are created, their current targets, pending submissions, and recent records will appear here.",
        recordsTitle: "Delivery Records",
        recordsDescription: "Recent team actions remain visible after re-entering the page.",
        viewAll: "View All Teams",
        noRecordsForTeam: "This team has no records yet",
        noRecords: "No team delivery records yet",
        noRecordsDescription: "After submit, switch, withdraw, merge, reject, or remove, recent actions will remain here.",
        summaryAria: "Team delivery summary",
        workbenchAria: "Team delivery workbench",
        recordsAria: "Team delivery records",
        restorePoint: (snapshotNumber: number) => `Restore Point v${snapshotNumber}`,
        currentVersionPendingIn: (count: number) => `Current version is pending in ${formatTeamCount(count, "en-US")}`,
        teamsStayOnOtherVersions: (count: number) =>
          `${formatTeamCount(count, "en-US")} ${count === 1 ? "still stays" : "still stay"} on other versions and can switch to the current snapshot.`,
        teamsStayOnOtherFlows: (count: number) =>
          `${formatTeamCount(count, "en-US")} ${count === 1 ? "is" : "are"} still on other versions or pending queues and can keep switching.`,
        selectedEnteredFlow: "The selected snapshot has already entered the team delivery flow.",
        currentVersionServedBy: (count: number) => `Current version is served by ${formatTeamCount(count, "en-US")}`,
        selectedCoverageStable: "The selected snapshot already has stable team coverage.",
        currentVersionNotInFlow: "Current version has not entered the team flow yet",
        switchOtherVersions: "Some teams already serve other versions and can switch to the current snapshot below.",
        createFirstDelivery: "Create the first delivery per team below and keep the later history visible.",
      }
    : {
        title: "团队交付",
        blocked: "不可交付",
        workbench: "团队交付",
        needSnapshot: "需选快照",
        subtitle: "按团队持续管理当前承接、待审提交、合并结果与解除承接，不再依赖一次性会话提示。",
        deliver: "交付到团队",
        openTeams: "前往团队",
        currentObject: "当前查看对象",
        currentServing: "当前版本承接",
        currentPending: "当前版本待审",
        latestAction: "最近操作",
        workspaceDraft: "工作副本草稿",
        blockedDirect: "不可直接交付",
        none: "暂无",
        serving: "承接",
        notServing: "未承接",
        pendingQueue: "待审队列",
        idle: "空闲",
        noPending: "无待审",
        targetCell: "当前承接",
        pendingCell: "待审队列",
        recordCell: "最近记录",
        teamVersionNone: "暂无记录",
        hasServing: "已有承接",
        noServing: "尚未承接",
        hasPending: "存在待审",
        noPendingTag: "无待审",
        withdraw: "撤回待审",
        viewRecords: "查看记录",
        remove: "解除承接",
        emptyTitle: "暂无团队交付信息",
        emptyDescription: "创建团队后，这里会显示每个团队当前承接的版本、待审提交与最近记录。",
        recordsTitle: "交付记录",
        recordsDescription: "保留最近团队动作，后续再次进入页面时仍可回看。",
        viewAll: "查看全部团队",
        noRecordsForTeam: "当前团队暂无记录",
        noRecords: "暂无团队交付记录",
        noRecordsDescription: "执行提交、改交、撤回、合并、拒绝或解除承接后，这里会持续保留最近动作。",
        summaryAria: "团队交付摘要",
        workbenchAria: "团队交付管理",
        recordsAria: "团队交付记录",
        restorePoint: (snapshotNumber: number) => `恢复点 v${snapshotNumber}`,
        currentVersionPendingIn: (count: number) => `当前版本已进入 ${formatTeamCount(count, "zh-CN")}待审`,
        teamsStayOnOtherVersions: (count: number) => `${formatTeamCount(count, "zh-CN")}仍停留在其他版本，可继续改交为当前快照。`,
        teamsStayOnOtherFlows: (count: number) => `${formatTeamCount(count, "zh-CN")}仍在其他版本或待审队列，可继续切换。`,
        selectedEnteredFlow: "当前选中快照已经进入团队空间流转。",
        currentVersionServedBy: (count: number) => `当前版本已被 ${formatTeamCount(count, "zh-CN")}承接`,
        selectedCoverageStable: "当前选中快照已形成稳定的团队承接。",
        currentVersionNotInFlow: "当前版本尚未进入团队链路",
        switchOtherVersions: "已有团队承接其他版本，可在下方直接改交为当前快照。",
        createFirstDelivery: "下方可以按团队建立首条交付记录，并持续保留后续动作历史。",
      };
}
