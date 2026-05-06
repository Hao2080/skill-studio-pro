export const SET_ACTIVE_TOOLTIP_TEXT = "将此版本设为发布目标，不影响工作副本内容";
export const SYNC_RESULT_FEEDBACK_DURATION_MS = 5000;

export function getSyncPreconditionError(activeSnapshotNumber: number | null) {
  if (activeSnapshotNumber == null) {
    return "没有当前生效版本，请先设置一个快照为生效版本";
  }

  return null;
}

export function buildSyncActiveVersionMessage(activeSnapshotNumber: number) {
  return `将发布生效版本 v${activeSnapshotNumber} 到平台，不影响工作副本内容。`;
}

export function buildSyncResultSummary(result: { success: number; failed: number }) {
  return `发布结果：成功 ${result.success} 个 / 失败 ${result.failed} 个`;
}
