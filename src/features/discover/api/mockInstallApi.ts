export interface MockInstallPlan {
  id: string;
  source: string;
  skillName: string;
  commit: string;
  fileCount: number;
  scriptCount: number;
  conflict: "none" | "name";
  target: string;
}

export async function createMockInstallPlan(source: string): Promise<MockInstallPlan> {
  return {
    id: "mock-plan-7a2d",
    source,
    skillName: "design-system-auditor",
    commit: "8dc7a91",
    fileCount: 14,
    scriptCount: 1,
    conflict: "none",
    target: "~/.skill-studio-pro/skills/design-system-auditor",
  };
}
