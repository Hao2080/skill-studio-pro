const dirtySources = new Set<string>();

export const NAVIGATION_DIRTY_MESSAGE = "当前文件有未保存修改。离开后这些修改会丢失。";

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

export function clearNavigationDirty(sourceId: string) {
  dirtySources.delete(sourceId);
}
