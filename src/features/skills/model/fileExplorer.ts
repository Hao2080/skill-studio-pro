import type { SkillFileNode } from "@/types/skill";

export function getDirectoryLabel(path: string | null): string | null {
  if (!path || !path.includes("/")) {
    return null;
  }

  const segments = path.split("/");
  return segments.slice(0, -1).join("/") || null;
}

export function collectTreeStats(nodes: SkillFileNode[]): { fileCount: number } {
  return nodes.reduce(
    (accumulator, node) => {
      if (node.isDir) {
        const childStats = collectTreeStats(node.children);
        accumulator.fileCount += childStats.fileCount;
      } else {
        accumulator.fileCount += 1;
      }
      return accumulator;
    },
    { fileCount: 0 },
  );
}

export function filterTree(nodes: SkillFileNode[], query: string): SkillFileNode[] {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return nodes;
  }

  return nodes.flatMap((node) => {
    const selfMatches =
      node.name.toLowerCase().includes(normalized) || node.path.toLowerCase().includes(normalized);

    if (node.isDir) {
      const filteredChildren = filterTree(node.children, normalized);
      if (selfMatches || filteredChildren.length > 0) {
        return [{ ...node, children: filteredChildren }];
      }
      return [];
    }

    return selfMatches ? [node] : [];
  });
}

export function filterTreeByPaths(nodes: SkillFileNode[], allowedPaths: Set<string>): SkillFileNode[] {
  if (allowedPaths.size === 0) {
    return [];
  }

  return nodes.flatMap((node) => {
    if (node.isDir) {
      const filteredChildren = filterTreeByPaths(node.children, allowedPaths);
      return filteredChildren.length > 0 ? [{ ...node, children: filteredChildren }] : [];
    }

    return allowedPaths.has(node.path) ? [node] : [];
  });
}

export function hasFilePath(nodes: SkillFileNode[], targetPath: string): boolean {
  return nodes.some((node) => {
    if (node.isDir) {
      return hasFilePath(node.children, targetPath);
    }

    return node.path === targetPath;
  });
}

export function getTopLevelDirectories(nodes: SkillFileNode[], limit = 3): SkillFileNode[] {
  return nodes.filter((node) => node.isDir).slice(0, limit);
}
