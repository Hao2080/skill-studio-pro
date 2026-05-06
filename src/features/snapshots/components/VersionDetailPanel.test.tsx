/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VersionDetailPanel } from "@/features/snapshots/components/VersionDetailPanel";
import type { SkillSnapshot } from "@/types/skill";

const i18nState = {
  resolvedLanguage: "zh-CN" as "zh-CN" | "en-US",
};

vi.mock("@/features/settings/state/I18nContext", () => ({
  useI18n: () => i18nState,
}));

const latestSnapshot: SkillSnapshot = {
  id: "snap-2",
  skillId: "skill-1",
  snapshotNumber: 2,
  snapshotPath: "snap-2",
  revisionHash: "rev-2",
  changeSummary: "Latest Snapshot",
  source: "manual",
  createdAt: Date.now(),
  isCurrent: false,
  isActive: false,
};

describe("VersionDetailPanel", () => {
  beforeEach(() => {
    i18nState.resolvedLanguage = "zh-CN";
  });

  afterEach(() => {
    cleanup();
  });

  it("renders english workspace detail copy", () => {
    i18nState.resolvedLanguage = "en-US";

    render(
      <VersionDetailPanel
        selectedEntity={{ type: "workspace" }}
        selectedSnapshot={null}
        activeSnapshot={null}
        latestSnapshot={latestSnapshot}
        hasWorkspaceChanges={true}
        changedFileCount={1}
        compareDraft={{
          baseSnapshotId: "snap-2",
          targetId: null,
          selectingTarget: true,
        }}
        onCompareWithWorkspace={() => {}}
        onCancelCompare={() => {}}
        onRestoreSnapshot={() => {}}
        onSetActiveSnapshot={() => {}}
        onDeleteSnapshot={() => {}}
        onUpdateSummary={async () => {}}
        onOpenFiles={() => {}}
      />,
    );

    expect(screen.getByRole("heading", { name: "Workspace" })).toBeTruthy();
    expect(screen.getByLabelText("Workspace version details")).toBeTruthy();
    expect(screen.getByLabelText("Compare ready state")).toBeTruthy();
    expect(screen.getByText("Latest snapshot v2 is ready as the compare base")).toBeTruthy();
    expect(screen.getByText("1 file")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open Files" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Compare Workspace" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel Compare" })).toBeTruthy();
  });

  it("renders english snapshot detail copy", () => {
    i18nState.resolvedLanguage = "en-US";

    render(
      <VersionDetailPanel
        selectedEntity={{ type: "snapshot", snapshotId: "snap-2" }}
        selectedSnapshot={latestSnapshot}
        activeSnapshot={null}
        latestSnapshot={latestSnapshot}
        hasWorkspaceChanges={false}
        changedFileCount={0}
        compareDraft={{
          baseSnapshotId: "snap-2",
          targetId: null,
          selectingTarget: true,
        }}
        onCompareWithWorkspace={() => {}}
        onCancelCompare={() => {}}
        onRestoreSnapshot={() => {}}
        onSetActiveSnapshot={() => {}}
        onDeleteSnapshot={() => {}}
        onUpdateSummary={async () => {}}
        onOpenFiles={() => {}}
      />,
    );

    expect(screen.getByRole("heading", { name: "v2" })).toBeTruthy();
    expect(screen.getByLabelText("Snapshot version details")).toBeTruthy();
    expect(screen.getByLabelText("Version summary section")).toBeTruthy();
    expect(screen.getByLabelText("Compare ready state")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Restore to Workspace" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Set as Active Version" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open Files" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit Summary" })).toBeTruthy();
    expect(screen.getByText("Current version is set as compare base")).toBeTruthy();
    expect(screen.getByText("Latest Snapshot")).toBeTruthy();
  });
});
