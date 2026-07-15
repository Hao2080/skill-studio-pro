const dirtySources = new Set<string>();

export function setNavigationDirty(sourceId: string, dirty: boolean) {
  if (dirty) {
    dirtySources.add(sourceId);
  } else {
    dirtySources.delete(sourceId);
  }
}

export function hasUnsavedNavigationChanges() {
  return dirtySources.size > 0;
}

export function confirmDiscardForNavigation(
  confirm: (message: string) => boolean = (message) => window.confirm(message),
) {
  if (!hasUnsavedNavigationChanges()) {
    return true;
  }

  return confirm("当前文件有未保存修改。离开后这些修改会丢失，确定继续吗？");
}

export function clearNavigationDirty(sourceId: string) {
  dirtySources.delete(sourceId);
}
