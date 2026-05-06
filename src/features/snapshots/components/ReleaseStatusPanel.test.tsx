/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReleaseStatusPanel } from "@/features/snapshots/components/ReleaseStatusPanel";
import type { SkillPlatformReleaseOverview, SkillSnapshot } from "@/types/skill";

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

const releaseOverview: SkillPlatformReleaseOverview = {
  releases: [
    {
      platformName: "OpenAI",
      detected: true,
      enabled: true,
      skillsDir: "/skills/openai",
      currentTarget: {
        platformName: "OpenAI",
        snapshotId: "snap-2",
        snapshotNumber: 2,
        changeSummary: "Latest Snapshot",
        releasedAt: Date.now() - 2000,
      },
      lastRecord: {
        id: "record-1",
        platformName: "OpenAI",
        snapshotId: "snap-2",
        snapshotNumber: 2,
        changeSummary: "Latest Snapshot",
        action: "publish",
        status: "success",
        createdAt: Date.now() - 2000,
      },
    },
    {
      platformName: "Claude",
      detected: true,
      enabled: true,
      skillsDir: "/skills/claude",
      currentTarget: {
        platformName: "Claude",
        snapshotId: "snap-1",
        snapshotNumber: 1,
        changeSummary: "Older Snapshot",
        releasedAt: Date.now() - 4000,
      },
      lastRecord: {
        id: "record-2",
        platformName: "Claude",
        snapshotId: "snap-1",
        snapshotNumber: 1,
        changeSummary: "Older Snapshot",
        action: "switch",
        status: "success",
        createdAt: Date.now() - 4000,
      },
    },
  ],
  recentRecords: [
    {
      id: "record-1",
      platformName: "OpenAI",
      snapshotId: "snap-2",
      snapshotNumber: 2,
      changeSummary: "Latest Snapshot",
      action: "publish",
      status: "success",
      createdAt: Date.now() - 2000,
    },
    {
      id: "record-2",
      platformName: "Claude",
      snapshotId: "snap-1",
      snapshotNumber: 1,
      changeSummary: "Older Snapshot",
      action: "switch",
      status: "success",
      createdAt: Date.now() - 4000,
    },
  ],
};

describe("ReleaseStatusPanel", () => {
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

  it("renders english platform release copy for serving and records", () => {
    i18nState.resolvedLanguage = "en-US";

    render(
      <ReleaseStatusPanel
        activeSnapshot={selectedSnapshot}
        selectedSnapshot={selectedSnapshot}
        releaseOverview={releaseOverview}
        loading={false}
        publishing={false}
        busyPlatforms={[]}
        onPublish={() => {}}
        onPublishPlatform={() => {}}
        onRemovePlatform={() => {}}
        onOpenSettings={() => {}}
        onFocusActiveVersion={() => {}}
      />,
    );

    expect(screen.getByRole("heading", { name: "Platform Sync" })).toBeTruthy();
    expect(screen.getByLabelText("Platform release summary")).toBeTruthy();
    expect(screen.getByLabelText("Platform release workbench")).toBeTruthy();
    expect(screen.getByLabelText("Platform release records")).toBeTruthy();
    expect(screen.getByText("Current version is served by 1 platform")).toBeTruthy();
    expect(screen.getAllByText("1 platform").length).toBeGreaterThan(0);
    expect(screen.getByText("Serving Current Version")).toBeTruthy();
    expect(screen.getByText("Serving v1")).toBeTruthy();
    expect(screen.getAllByText("Publish · Success · v2").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Sync to Platforms" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open Settings" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "View Records" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Remove from Platform" }).length).toBeGreaterThan(0);
  });
});
