import type { SkillFileNode, TextDiffEntry } from "@/types/skill";

export function cloneValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

export function buildFileTree(files: Record<string, string>): SkillFileNode {
  const root: SkillFileNode = {
    name: "root",
    path: "",
    isDir: true,
    children: [],
  };

  const sortedPaths = Object.keys(files).sort((left, right) => left.localeCompare(right, "zh-CN"));

  for (const filePath of sortedPaths) {
    const segments = filePath.split("/");
    let current = root;
    let currentPath = "";

    segments.forEach((segment, index) => {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const isLeaf = index === segments.length - 1;
      const existing = current.children.find((child) => child.path === currentPath);

      if (existing) {
        current = existing;
        return;
      }

      const nextNode: SkillFileNode = {
        name: segment,
        path: currentPath,
        isDir: !isLeaf,
        children: [],
      };

      current.children.push(nextNode);
      current.children.sort((left, right) => {
        if (left.isDir !== right.isDir) {
          return left.isDir ? -1 : 1;
        }

        return left.name.localeCompare(right.name, "zh-CN");
      });
      current = nextNode;
    });
  }

  return root;
}

export function createTextDiff(filePath: string, before: string, after: string): TextDiffEntry {
  const beforeLine = before.split("\n")[0] ?? "";
  const afterLine = after.split("\n")[0] ?? "";

  return {
    filePath,
    unifiedDiff: `--- ${filePath}\n+++ ${filePath}\n@@ -1 +1 @@\n-${beforeLine}\n+${afterLine}`,
    oldLines: before ? before.split("\n").length : 0,
    newLines: after ? after.split("\n").length : 0,
  };
}
