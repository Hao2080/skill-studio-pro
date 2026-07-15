import { describe, expect, it } from "vitest";
import { buildSkillOverviewModel } from "@/features/skills/model/skillOverview";
import type { ChangeStatus, SkillPlatformReleaseOverview, SkillSnapshot } from "@/types/skill";
import type { SkillTeamDeliveryOverview } from "@/types/team";

function createSnapshot(snapshotNumber: number, options?: Partial<SkillSnapshot>): SkillSnapshot {
  return {
    id: `snapshot-${snapshotNumber}`,
    skillId: "skill-1",
    snapshotNumber,
    snapshotPath: `snapshots/${snapshotNumber}`,
    revisionHash: `revision-${snapshotNumber}`,
    createdAt: snapshotNumber,
    isCurrent: false,
    isActive: false,
    ...options,
    source: options?.source ?? "manual",
  };
}

function createChangeStatus(hasChanges: boolean): ChangeStatus {
  return {
    hasChanges,
    addedFiles: hasChanges ? ["README.md"] : [],
    deletedFiles: [],
    modifiedFiles: hasChanges ? ["SKILL.md"] : [],
  };
}

function buildModel(options?: {
  changeStatus?: ChangeStatus | null;
  snapshots?: SkillSnapshot[];
  platformReleaseOverview?: SkillPlatformReleaseOverview | null;
  teamDeliveryOverview?: SkillTeamDeliveryOverview | null;
  teamCount?: number;
  language?: "zh-CN" | "en-US";
}) {
  return buildSkillOverviewModel({
    description: "技能说明",
    changeStatus: options?.changeStatus ?? createChangeStatus(false),
    snapshots: options?.snapshots ?? [],
    platformReleaseOverview: options?.platformReleaseOverview ?? { releases: [], recentRecords: [] },
    teamDeliveryOverview: options?.teamDeliveryOverview ?? { deliveries: [], recentRecords: [] },
    teamCount: options?.teamCount ?? 0,
    language: options?.language,
  });
}

describe("buildSkillOverviewModel next step", () => {
  it("prioritizes creating the first snapshot when there is no version baseline", () => {
    const model = buildModel({
      changeStatus: createChangeStatus(true),
      snapshots: [],
    });

    expect(model.nextStep.title).toBe("创建首个快照");
    expect(model.nextStep.primaryAction).toMatchObject({
      type: "open_versions",
      section: "detail",
      action: "create_snapshot",
      label: "创建首个快照",
    });
  });

  it("prioritizes creating a snapshot when the workspace still has unsnapshotted changes", () => {
    const model = buildModel({
      changeStatus: createChangeStatus(true),
      snapshots: [createSnapshot(2, { isActive: true }), createSnapshot(1)],
    });

    expect(model.nextStep.title).toBe("收口当前草稿");
    expect(model.nextStep.primaryAction).toMatchObject({
      type: "open_versions",
      section: "detail",
      action: "create_snapshot",
      label: "创建新快照",
    });
  });

  it("asks to set the current version when snapshots exist but no active baseline is defined", () => {
    const model = buildModel({
      snapshots: [createSnapshot(3), createSnapshot(2)],
    });

    expect(model.nextStep.title).toBe("明确当前版本");
    expect(model.nextStep.primaryAction).toMatchObject({
      type: "open_versions",
      section: "detail",
      action: "set_active",
      label: "设置当前版本",
    });
  });

  it("asks to review versions when the active version falls behind the latest snapshot", () => {
    const model = buildModel({
      snapshots: [createSnapshot(4), createSnapshot(3, { isActive: true }), createSnapshot(2)],
    });

    expect(model.nextStep.title).toBe("审查最新快照是否升级");
    expect(model.nextStep.primaryAction).toMatchObject({
      type: "open_versions",
      section: "detail",
      action: "review_latest",
      label: "审查版本差异",
    });
  });

  it("ignores system restore points when evaluating whether the active version is behind", () => {
    const model = buildModel({
      snapshots: [
        createSnapshot(5, { source: "system" }),
        createSnapshot(4, { isActive: true }),
        createSnapshot(3),
      ],
      platformReleaseOverview: {
        releases: [
          {
            platformName: "Claude.ai",
            detected: true,
            enabled: true,
            skillsDir: "skills",
          },
        ],
        recentRecords: [],
      },
    });

    expect(model.nextStep.title).toBe("让当前版本进入平台承接");
    expect(model.nextStep.primaryAction).toMatchObject({
      type: "open_versions",
      section: "release",
      label: "发布当前版本",
    });
  });

  it("asks to publish the current version when platforms are available but not carrying the active snapshot", () => {
    const model = buildModel({
      snapshots: [createSnapshot(4, { isActive: true }), createSnapshot(3)],
      platformReleaseOverview: {
        releases: [
          {
            platformName: "Claude.ai",
            detected: true,
            enabled: true,
            skillsDir: "skills",
          },
        ],
        recentRecords: [],
      },
    });

    expect(model.nextStep.title).toBe("让当前版本进入平台承接");
    expect(model.nextStep.primaryAction).toMatchObject({
      type: "open_versions",
      section: "release",
      label: "发布当前版本",
    });
  });

  it("opens the team section when the current version has not entered any team delivery yet", () => {
    const model = buildModel({
      snapshots: [createSnapshot(4, { isActive: true }), createSnapshot(3)],
      platformReleaseOverview: {
        releases: [
          {
            platformName: "Claude.ai",
            detected: true,
            enabled: true,
            skillsDir: "skills",
            currentTarget: {
              platformName: "Claude.ai",
              snapshotId: "snapshot-4",
              snapshotNumber: 4,
              releasedAt: 10,
            },
          },
        ],
        recentRecords: [],
      },
      teamDeliveryOverview: {
        deliveries: [
          {
            teamId: "team-1",
            teamName: "团队一",
          },
        ],
        recentRecords: [],
      },
      teamCount: 1,
    });

    expect(model.nextStep.title).toBe("让当前版本进入团队交付");
    expect(model.nextStep.primaryAction).toMatchObject({
      type: "open_versions",
      section: "team",
      label: "交付当前版本",
    });
  });

  it("falls back to the version workbench when the object is stable", () => {
    const model = buildModel({
      snapshots: [createSnapshot(4, { isActive: true }), createSnapshot(3)],
      platformReleaseOverview: {
        releases: [
          {
            platformName: "Claude.ai",
            detected: true,
            enabled: true,
            skillsDir: "skills",
            currentTarget: {
              platformName: "Claude.ai",
              snapshotId: "snapshot-4",
              snapshotNumber: 4,
              releasedAt: 10,
            },
          },
        ],
        recentRecords: [],
      },
      teamDeliveryOverview: {
        deliveries: [
          {
            teamId: "team-1",
            teamName: "团队一",
            currentTarget: {
              teamId: "team-1",
              teamName: "团队一",
              sourceSkillId: "skill-1",
              sourceSnapshotId: "snapshot-4",
              sourceSnapshotNumber: 4,
              deliveredAt: 12,
            },
          },
        ],
        recentRecords: [],
      },
      teamCount: 1,
    });

    expect(model.nextStep.title).toBe("当前链路已基本稳定");
    expect(model.nextStep.primaryAction).toMatchObject({
      type: "open_versions",
      section: "detail",
      label: "查看版本管理",
    });
  });

  it("returns english overview copy when ui language is english", () => {
    const model = buildModel({
      language: "en-US",
      changeStatus: createChangeStatus(true),
      snapshots: [createSnapshot(4, { isActive: true }), createSnapshot(3)],
      platformReleaseOverview: {
        releases: [
          {
            platformName: "Claude.ai",
            detected: true,
            enabled: true,
            skillsDir: "skills",
          },
        ],
        recentRecords: [],
      },
      teamDeliveryOverview: {
        deliveries: [
          {
            teamId: "team-1",
            teamName: "Team One",
          },
        ],
        recentRecords: [],
      },
      teamCount: 1,
    });

    expect(model.dominantModeLabel).toBe("Drafting");
    expect(model.nextStep.title).toBe("Close out the current draft");
    expect(model.nextStep.primaryAction.label).toBe("Create New Snapshot");
    expect(model.summaryItems[0]).toMatchObject({
      label: "Workspace",
      value: "2 files pending snapshot",
    });
    expect(model.lifecycleNodes[0]).toMatchObject({
      label: "Workspace",
      status: "Needs Wrap-up",
    });
    expect(model.attentionItems[0]).toMatchObject({
      title: "Workspace changes are still outside snapshots",
    });
  });
});
