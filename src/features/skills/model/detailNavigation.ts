export type SkillDetailTab = "Overview" | "Files" | "Versions";

export type SkillDetailVersionSection = "detail" | "release" | "team";

export type SkillDetailVersionAction = "create_snapshot" | "set_active" | "review_latest";

export type SkillDetailIntent =
  | { tab: "Overview" }
  | { tab: "Files"; notice?: "unsnapshotted" }
  | {
      tab: "Versions";
      section?: SkillDetailVersionSection;
      action?: SkillDetailVersionAction;
    };
