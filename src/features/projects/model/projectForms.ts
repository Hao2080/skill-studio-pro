export interface ProjectFormValues {
  name: string;
  rootPath: string;
  description?: string;
}

export interface PlatformFormValues {
  platformName: string;
  pathMode: "derived" | "custom";
  relativeSkillsDir?: string;
  skillsDir?: string;
  syncMode: "copy";
  enabled: boolean;
}

export interface BindSkillFormValues {
  skillId: string;
  snapshotId?: string;
  targetDirName?: string;
  enabled: boolean;
}
