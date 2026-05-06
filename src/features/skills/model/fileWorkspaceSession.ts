interface StoredFileWorkspaceContext {
  selectedFile: string | null;
  scrollPositions: Record<string, number>;
}

type StoredFileWorkspaceMap = Record<string, StoredFileWorkspaceContext>;

const FILE_WORKSPACE_SESSION_KEY = "skill-studio.file-workspace.session";

function getBrowserSessionStorage() {
  return typeof window === "undefined" ? null : window.sessionStorage;
}

function readSessionMap(): StoredFileWorkspaceMap {
  const storage = getBrowserSessionStorage();
  if (!storage) {
    return {};
  }

  const raw = storage.getItem(FILE_WORKSPACE_SESSION_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as StoredFileWorkspaceMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeSessionMap(nextMap: StoredFileWorkspaceMap) {
  const storage = getBrowserSessionStorage();
  if (!storage) {
    return;
  }

  storage.setItem(FILE_WORKSPACE_SESSION_KEY, JSON.stringify(nextMap));
}

function getDefaultContext(): StoredFileWorkspaceContext {
  return {
    selectedFile: null,
    scrollPositions: {},
  };
}

export function loadFileWorkspaceSession(skillId: string): StoredFileWorkspaceContext {
  return readSessionMap()[skillId] ?? getDefaultContext();
}

export function persistFileWorkspaceSelection(skillId: string, selectedFile: string) {
  const sessionMap = readSessionMap();
  const current = sessionMap[skillId] ?? getDefaultContext();

  writeSessionMap({
    ...sessionMap,
    [skillId]: {
      ...current,
      selectedFile,
    },
  });
}

export function persistFileWorkspaceScrollPosition(skillId: string, filePath: string, scrollTop: number) {
  const sessionMap = readSessionMap();
  const current = sessionMap[skillId] ?? getDefaultContext();

  writeSessionMap({
    ...sessionMap,
    [skillId]: {
      ...current,
      scrollPositions: {
        ...current.scrollPositions,
        [filePath]: Math.max(0, Math.floor(scrollTop)),
      },
    },
  });
}

export function getFileWorkspaceScrollPosition(skillId: string, filePath: string): number {
  const context = loadFileWorkspaceSession(skillId);
  const value = context.scrollPositions[filePath];
  return typeof value === "number" ? value : 0;
}
