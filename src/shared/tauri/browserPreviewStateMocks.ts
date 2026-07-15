import type {
  AppSettings,
  ChangeStatus,
  PlatformConnection,
  PlatformReleaseRecord,
  Skill,
  SkillSnapshot,
} from "@/types/skill";
import type {
  Team,
  TeamActivityLog,
  TeamDeliveryRecord,
  TeamMember,
  TeamSkill,
  TeamSubmission,
} from "@/types/team";
import { buildPreviewPlatforms, PREVIEW_BASE_TIME as BASE_TIME } from "./browserPreviewPlatformMocks";

const PREVIEW_ID = "skill-preview";

export interface BrowserPreviewState {
  settings: AppSettings;
  skills: Skill[];
  changeStatusBySkillId: Record<string, ChangeStatus>;
  currentFilesBySkillId: Record<string, Record<string, string>>;
  snapshotsBySkillId: Record<string, SkillSnapshot[]>;
  snapshotFilesBySnapshotId: Record<string, Record<string, string>>;
  platforms: PlatformConnection[];
  platformReleaseTargetsBySkillId: Record<string, Record<string, { snapshotId: string; releasedAt: number }>>;
  platformReleaseRecordsBySkillId: Record<string, PlatformReleaseRecord[]>;
  teams: Team[];
  membersByTeamId: Record<string, TeamMember[]>;
  teamSkillsByTeamId: Record<string, TeamSkill[]>;
  submissionsByTeamId: Record<string, TeamSubmission[]>;
  activityLogsByTeamId: Record<string, TeamActivityLog[]>;
  teamDeliveryTargetsBySkillId: Record<
    string,
    Record<string, { snapshotId: string; teamSkillId?: string; teamVersionId?: string; teamVersionNumber?: number; deliveredAt: number }>
  >;
  teamDeliveryRecordsBySkillId: Record<string, TeamDeliveryRecord[]>;
}

export function createBrowserPreviewState(): BrowserPreviewState {
  const skill: Skill = {
    id: PREVIEW_ID,
    name: "Structured Delivery Review",
    slug: "structured-delivery-review",
    description:
      "一套面向团队交付的技能工作流，用来统一快照沉淀、生效版本确认、平台同步与团队空间基线。它需要在复杂说明下依然保持头部稳定、版本关系清晰、文件工作区有明确草稿感知。",
    sourceType: "local",
    sourcePath: "D:/Preview/skills/structured-delivery-review",
    createdAt: BASE_TIME - 1000 * 60 * 60 * 24 * 5,
    updatedAt: BASE_TIME - 1000 * 60 * 26,
    isArchived: false,
  };

  const currentFiles = {
    "SKILL.md": [
      "# Structured Delivery Review",
      "",
      "## Objective",
      "Unify snapshot review, release orchestration, and team delivery decisions.",
      "",
      "## Focus",
      "- Keep release and team baselines explicit.",
      "- Reduce draft ambiguity before publishing.",
      "- Make file triage visible for every unsnapshotted change.",
    ].join("\n"),
    "README.md": [
      "# Structured Delivery Review",
      "",
      "This preview keeps the header description deliberately long so layout issues show up early.",
      "",
      "## Current direction",
      "The version page acts as the decision desk, while files stay focused on draft triage.",
    ].join("\n"),
    "guides/release-checklist.md": [
      "# Release Checklist",
      "",
      "1. Review the latest snapshot.",
      "2. Confirm the active version.",
      "3. Verify enabled platforms.",
      "4. Confirm the team baseline before sync.",
    ].join("\n"),
    "prompts/system.md": [
      "# System Prompt",
      "",
      "Keep the interaction direct, product-oriented, and operationally precise.",
    ].join("\n"),
    "examples/review-flow.md": [
      "# Review Flow",
      "",
      "Example flow for snapshot review and team delivery.",
    ].join("\n"),
  };

  const snapshot4Files = {
    ...currentFiles,
    "SKILL.md": [
      "# Structured Delivery Review",
      "",
      "## Objective",
      "Unify snapshot review, release orchestration, and team delivery decisions.",
      "",
      "## Focus",
      "- Keep release and team baselines explicit.",
      "- Reduce draft ambiguity before publishing.",
      "- Make draft work visible before promotion.",
    ].join("\n"),
    "README.md": [
      "# Structured Delivery Review",
      "",
      "This preview keeps the header description deliberately long so layout issues show up early.",
      "",
      "## Current direction",
      "The version page acts as the decision desk for release and collaboration.",
    ].join("\n"),
  };

  const snapshot3Files = {
    ...snapshot4Files,
    "guides/release-checklist.md": [
      "# Release Checklist",
      "",
      "1. Review the active version.",
      "2. Confirm enabled platforms.",
      "3. Notify the team baseline owner.",
    ].join("\n"),
  };

  const snapshot2Files = {
    ...snapshot3Files,
    "README.md": [
      "# Structured Delivery Review",
      "",
      "A previous baseline focused more on header polish than release orchestration.",
    ].join("\n"),
  };

  const snapshots: SkillSnapshot[] = [
    {
      id: "snap-5",
      skillId: PREVIEW_ID,
      snapshotNumber: 5,
      snapshotPath: "preview/snap-5",
      revisionHash: "rev-5",
      changeSummary: "发布前自动创建恢复点",
      source: "system",
      createdAt: BASE_TIME - 1000 * 60 * 30,
      isCurrent: false,
      isActive: false,
    },
    {
      id: "snap-4",
      skillId: PREVIEW_ID,
      snapshotNumber: 4,
      snapshotPath: "preview/snap-4",
      revisionHash: "rev-4",
      changeSummary: "拆分版本管理与团队交付链路",
      source: "manual",
      createdAt: BASE_TIME - 1000 * 60 * 90,
      isCurrent: false,
      isActive: false,
    },
    {
      id: "snap-3",
      skillId: PREVIEW_ID,
      snapshotNumber: 3,
      snapshotPath: "preview/snap-3",
      revisionHash: "rev-3",
      changeSummary: "重构概览页头与元信息层级",
      source: "manual",
      createdAt: BASE_TIME - 1000 * 60 * 210,
      isCurrent: false,
      isActive: true,
    },
    {
      id: "snap-2",
      skillId: PREVIEW_ID,
      snapshotNumber: 2,
      snapshotPath: "preview/snap-2",
      revisionHash: "rev-2",
      changeSummary: "梳理团队交付基础模型",
      source: "manual",
      createdAt: BASE_TIME - 1000 * 60 * 430,
      isCurrent: false,
      isActive: false,
    },
    {
      id: "snap-1",
      skillId: PREVIEW_ID,
      snapshotNumber: 1,
      snapshotPath: "preview/snap-1",
      revisionHash: "rev-1",
      changeSummary: "建立首个结构化快照",
      source: "manual",
      createdAt: BASE_TIME - 1000 * 60 * 860,
      isCurrent: false,
      isActive: false,
    },
  ];

  const platforms = buildPreviewPlatforms();

  const platformReleaseTargetsBySkillId = {
    [PREVIEW_ID]: {
      codex: {
        snapshotId: "snap-3",
        releasedAt: BASE_TIME - 1000 * 60 * 120,
      },
      claude: {
        snapshotId: "snap-2",
        releasedAt: BASE_TIME - 1000 * 60 * 240,
      },
      qwen_code: {
        snapshotId: "snap-4",
        releasedAt: BASE_TIME - 1000 * 60 * 95,
      },
      github_copilot: {
        snapshotId: "snap-1",
        releasedAt: BASE_TIME - 1000 * 60 * 310,
      },
    },
  };

  const platformReleaseRecordsBySkillId = {
    [PREVIEW_ID]: [
      {
        id: "release-1",
        platformName: "codex",
        displayName: "Codex",
        snapshotId: "snap-3",
        snapshotNumber: 3,
        changeSummary: "重构概览页头与元信息层级",
        action: "publish",
        status: "success" as const,
        createdAt: BASE_TIME - 1000 * 60 * 120,
      },
      {
        id: "release-2",
        platformName: "qwen_code",
        displayName: "Qwen Code",
        snapshotId: "snap-4",
        snapshotNumber: 4,
      changeSummary: "拆分版本管理与团队交付链路",
        action: "switch",
        status: "success" as const,
        createdAt: BASE_TIME - 1000 * 60 * 95,
      },
      {
        id: "release-3",
        platformName: "claude",
        displayName: "Claude Code",
        snapshotId: "snap-2",
        snapshotNumber: 2,
        changeSummary: "梳理团队交付基础模型",
        action: "switch",
        status: "success" as const,
        createdAt: BASE_TIME - 1000 * 60 * 240,
      },
      {
        id: "release-4",
        platformName: "github_copilot",
        displayName: "GitHub Copilot",
        snapshotId: "snap-3",
        snapshotNumber: 3,
        changeSummary: "重构概览页头与元信息层级",
        action: "remove",
        status: "success" as const,
        createdAt: BASE_TIME - 1000 * 60 * 310,
      },
    ],
  };

  const teams: Team[] = [
    {
      id: "team-design-ops",
      name: "体验评审组",
      description: "负责技能体验、发布基线与协作链路审查",
      createdAt: BASE_TIME - 1000 * 60 * 60 * 24 * 10,
      updatedAt: BASE_TIME - 1000 * 60 * 75,
      status: "active",
    },
  ];

  const teamSkills: TeamSkill[] = [
    {
      id: "team-skill-1",
      teamId: "team-design-ops",
      name: skill.name,
      slug: skill.slug,
      description: "团队评审中的交付技能镜像",
      createdAt: BASE_TIME - 1000 * 60 * 60 * 24 * 8,
    },
  ];

  const submissions: TeamSubmission[] = [
    {
      id: "submission-1",
      teamId: "team-design-ops",
      teamSkillId: "team-skill-1",
      baseTeamVersionId: "team-version-2",
      baseRevisionHash: "team-version-2",
      sourceSkillId: PREVIEW_ID,
      sourceSnapshotId: "snap-4",
      submitter: "Jensen",
      submitMessage: "请重点确认团队基线是否需要推进到最新快照。",
      submittedAt: BASE_TIME - 1000 * 60 * 75,
      status: "pending",
    },
  ];

  const teamDeliveryTargetsBySkillId = {
    [PREVIEW_ID]: {
      "team-design-ops": {
        snapshotId: "snap-2",
        teamSkillId: "team-skill-1",
        teamVersionId: "team-version-2",
        teamVersionNumber: 2,
        deliveredAt: BASE_TIME - 1000 * 60 * 360,
      },
    },
  };

  const teamDeliveryRecordsBySkillId: Record<string, TeamDeliveryRecord[]> = {
    [PREVIEW_ID]: [
      {
        id: "team-record-1",
        teamId: "team-design-ops",
        teamName: "体验评审组",
        sourceSkillId: PREVIEW_ID,
        sourceSnapshotId: "snap-4",
        sourceSnapshotNumber: 4,
      changeSummary: "拆分版本管理与团队交付链路",
        teamSkillId: "team-skill-1",
        teamSkillName: skill.name,
        submissionId: "submission-1",
        action: "submit",
        status: "pending",
        actor: "Jensen",
        note: "请重点确认团队基线是否需要推进到最新快照。",
        createdAt: BASE_TIME - 1000 * 60 * 75,
      },
      {
        id: "team-record-2",
        teamId: "team-design-ops",
        teamName: "体验评审组",
        sourceSkillId: PREVIEW_ID,
        sourceSnapshotId: "snap-2",
        sourceSnapshotNumber: 2,
        changeSummary: "梳理团队交付基础模型",
        teamSkillId: "team-skill-1",
        teamSkillName: skill.name,
        teamVersionId: "team-version-2",
        teamVersionNumber: 2,
        action: "merge",
        status: "success",
        actor: "Rina",
        note: "已进入团队版本 v2。",
        createdAt: BASE_TIME - 1000 * 60 * 360,
      },
    ],
  };

  const activityLogsByTeamId: Record<string, TeamActivityLog[]> = {
    "team-design-ops": [
      {
        id: "team-activity-1",
        teamId: "team-design-ops",
        actor: "Jensen",
        action: "submit",
        targetType: "submission",
        targetId: "submission-1",
        targetLabel: skill.name,
        detail: "请重点确认团队基线是否需要推进到最新快照。",
        createdAt: BASE_TIME - 1000 * 60 * 75,
      },
      {
        id: "team-activity-2",
        teamId: "team-design-ops",
        actor: "Rina",
        action: "merge_submission",
        targetType: "team_version",
        targetId: "team-version-2",
        targetLabel: skill.name,
        detail: "v2",
        createdAt: BASE_TIME - 1000 * 60 * 360,
      },
      {
        id: "team-activity-3",
        teamId: "team-design-ops",
        actor: "Jensen",
        action: "create_team",
        targetType: "team",
        targetId: "team-design-ops",
        targetLabel: "体验评审组",
        detail: "负责技能体验、发布基线与协作链路审查",
        createdAt: BASE_TIME - 1000 * 60 * 60 * 24 * 10,
      },
    ],
  };

  return {
    settings: {
      theme: "light",
      uiLanguage: "system",
      snapshotBeforePublish: true,
      snapshotMaxCount: 20,
    },
    skills: [skill],
    changeStatusBySkillId: {
      [PREVIEW_ID]: {
        hasChanges: true,
        modifiedFiles: ["SKILL.md", "README.md"],
        addedFiles: ["guides/release-checklist.md"],
        deletedFiles: [],
      },
    },
    currentFilesBySkillId: {
      [PREVIEW_ID]: currentFiles,
    },
    snapshotsBySkillId: {
      [PREVIEW_ID]: snapshots,
    },
    snapshotFilesBySnapshotId: {
      "snap-5": currentFiles,
      "snap-4": snapshot4Files,
      "snap-3": snapshot3Files,
      "snap-2": snapshot2Files,
      "snap-1": {
        "SKILL.md": "# Structured Delivery Review\n\nInitial preview baseline.",
        "README.md": "# Structured Delivery Review\n\nInitial snapshot.",
      },
    },
    platforms,
    platformReleaseTargetsBySkillId,
    platformReleaseRecordsBySkillId,
    teams,
    membersByTeamId: {
      "team-design-ops": [
        {
          id: "member-1",
          teamId: "team-design-ops",
          userName: "Jensen",
          email: "jensen@example.local",
          role: "owner",
          status: "active",
          joinedAt: BASE_TIME - 1000 * 60 * 60 * 24 * 9,
          updatedAt: BASE_TIME - 1000 * 60 * 60 * 24 * 9,
        },
        {
          id: "member-2",
          teamId: "team-design-ops",
          userName: "Rina",
          email: "rina@example.local",
          role: "maintainer",
          status: "active",
          joinedAt: BASE_TIME - 1000 * 60 * 60 * 24 * 6,
          updatedAt: BASE_TIME - 1000 * 60 * 60 * 24 * 6,
        },
      ],
    },
    teamSkillsByTeamId: {
      "team-design-ops": teamSkills,
    },
    submissionsByTeamId: {
      "team-design-ops": submissions,
    },
    activityLogsByTeamId,
    teamDeliveryTargetsBySkillId,
    teamDeliveryRecordsBySkillId,
  };
}
