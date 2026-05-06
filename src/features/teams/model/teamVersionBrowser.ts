import type { SkillFileNode } from "@/types/skill";

export function findDefaultBrowserFile(node: SkillFileNode | null): string | null {
  if (!node) {
    return null;
  }

  const normalizedPath = node.path.replace(/\\/g, "/").toLowerCase();
  if (!node.isDir && (normalizedPath === "skill.md" || normalizedPath.endsWith("/skill.md"))) {
    return node.path;
  }

  for (const child of node.children) {
    const found = findDefaultBrowserFile(child);
    if (found) {
      return found;
    }
  }

  if (!node.isDir) {
    return node.path;
  }

  return node.children.length > 0 ? findDefaultBrowserFile(node.children[0]) : null;
}
