/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TeamDeliveryPanel } from "@/features/snapshots/components/TeamDeliveryPanel";
import type { SkillSnapshot } from "@/types/skill";
import type { SkillTeamDeliveryOverview } from "@/types/team";

const i18nState = {
  resolvedLanguage: "zh-CN" as "zh-CN" | "en-US",
};

vi.mock("@/features/settings/state/I18nContext", () => ({
  useI18n: () => i18nState,
}));

const selectedSnapshot: SkillSnapshot = {
  id: "snap-2",
  skillId: "skill-1",
  snapshotNumber: 2,
  snapshotPath: "snap-2",
  revisionHash: "rev-2",
  changeSummary: "Latest Snapshot",
  source: "manual",
  createdAt: Date.now(),
  isCurrent: false,
  isActive: true,
};

const deliveryOverview: SkillTeamDeliveryOverview = {
  deliveries: [
    {
      teamId: "team-1",
      teamName: "Core Team",
      teamDescription: "Core delivery team",
      currentTarget: {
        teamId: "team-1",
        teamName: "Core Team",
        sourceSkillId: "skill-1",
        sourceSnapshotId: "snap-2",
        sourceSnapshotNumber: 2,
        changeSummary: "Latest Snapshot",
        teamSkillId: "team-skill-1",
        teamSkillName: "Core Skill",
        teamVersionId: "team-version-2",
        teamVersionNumber: 2,
        deliveredAt: Date.now() - 2000,
      },
      lastRecord: {
        id: "team-record-1",
        teamId: "team-1",
        teamName: "Core Team",
        sourceSkillId: "skill-1",
        sourceSnapshotId: "snap-2",
        sourceSnapshotNumber: 2,
        changeSummary: "Latest Snapshot",
        teamSkillId: "team-skill-1",
        teamSkillName: "Core Skill",
        teamVersionId: "team-version-2",
        teamVersionNumber: 2,
        action: "merge",
        status: "success",
        actor: "jensen",
        createdAt: Date.now() - 2000,
      },
    },
    {
      teamId: "team-2",
      teamName: "Ops Team",
      teamDescription: "Ops delivery team",
      currentTarget: {
        teamId: "team-2",
        teamName: "Ops Team",
        sourceSkillId: "skill-1",
        sourceSnapshotId: "snap-1",
        sourceSnapshotNumber: 1,
        changeSummary: "Older Snapshot",
        teamSkillId: "team-skill-2",
        teamSkillName: "Ops Skill",
        teamVersionId: "team-version-1",
        teamVersionNumber: 1,
        deliveredAt: Date.now() - 4000,
      },
      lastRecord: {
        id: "team-record-2",
        teamId: "team-2",
        teamName: "Ops Team",
        sourceSkillId: "skill-1",
        sourceSnapshotId: "snap-1",
        sourceSnapshotNumber: 1,
        changeSummary: "Older Snapshot",
        teamSkillId: "team-skill-2",
        teamSkillName: "Ops Skill",
        teamVersionId: "team-version-1",
        teamVersionNumber: 1,
        action: "switch",
        status: "success",
        actor: "amy",
        createdAt: Date.now() - 4000,
      },
    },
  ],
  recentRecords: [
    {
      id: "team-record-1",
      teamId: "team-1",
      teamName: "Core Team",
      sourceSkillId: "skill-1",
      sourceSnapshotId: "snap-2",
      sourceSnapshotNumber: 2,
      changeSummary: "Latest Snapshot",
      teamSkillId: "team-skill-1",
      teamSkillName: "Core Skill",
      teamVersionId: "team-version-2",
      teamVersionNumber: 2,
      action: "merge",
      status: "success",
      actor: "jensen",
      createdAt: Date.now() - 2000,
    },
    {
      id: "team-record-2",
      teamId: "team-2",
      teamName: "Ops Team",
      sourceSkillId: "skill-1",
      sourceSnapshotId: "snap-1",
      sourceSnapshotNumber: 1,
      changeSummary: "Older Snapshot",
      teamSkillId: "team-skill-2",
      teamSkillName: "Ops Skill",
      teamVersionId: "team-version-1",
      teamVersionNumber: 1,
      action: "switch",
      status: "success",
      actor: "amy",
      createdAt: Date.now() - 4000,
    },
  ],
};

describe("TeamDeliveryPanel", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    i18nState.resolvedLanguage = "zh-CN";
  });

  afterEach(() => {
    cleanup();
  });

  it("renders english team delivery copy for serving states and records", () => {
    i18nState.resolvedLanguage = "en-US";

    render(
      <TeamDeliveryPanel
        selectedSnapshot={selectedSnapshot}
        deliveryOverview={deliveryOverview}
        loading={false}
        submitting={false}
        actingTeamIds={[]}
        onSubmit={() => {}}
        onSubmitTeam={() => {}}
        onWithdrawTeam={() => {}}
        onRemoveTeam={() => {}}
        onOpenTeams={() => {}}
      />,
    );

    expect(screen.getByRole("heading", { name: "Team Delivery" })).toBeTruthy();
    expect(screen.getByLabelText("Team delivery summary")).toBeTruthy();
    expect(screen.getByLabelText("Team delivery workbench")).toBeTruthy();
    expect(screen.getByLabelText("Team delivery records")).toBeTruthy();
    expect(screen.getByText("Current version is served by 1 team")).toBeTruthy();
    expect(screen.getAllByText("1 team").length).toBeGreaterThan(0);
    expect(screen.getByText("Serving Current Version")).toBeTruthy();
    expect(screen.getByText("Serving v1")).toBeTruthy();
    expect(screen.getAllByText("Merge · Done · v2").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Deliver to Teams" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open Teams" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "View Records" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Remove Serving" }).length).toBeGreaterThan(0);
  });
});
