/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MergeSubmissionModal } from "./MergeSubmissionModal";
import type { TeamSubmission } from "@/types/team";

const loadSubmissionMergePreview = vi.fn();
const mergeSubmission = vi.fn();

vi.mock("@/features/settings/state/I18nContext", () => ({
  useI18n: () => ({ resolvedLanguage: "zh-CN" }),
}));

vi.mock("@/features/teams/state/TeamContext", () => ({
  useTeamContext: () => ({
    loadSubmissionMergePreview,
    mergeSubmission,
  }),
}));

const submission: TeamSubmission = {
  id: "submission-1",
  teamId: "team-1",
  teamSkillId: "team-skill-1",
  baseTeamVersionId: "version-1",
  baseRevisionHash: "rev-1",
  sourceSkillId: "skill-1",
  sourceSnapshotId: "snapshot-2",
  submitter: "jensen",
  submitMessage: "更新团队基线",
  submittedAt: Date.now(),
  status: "pending",
};

describe("MergeSubmissionModal", () => {
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

    loadSubmissionMergePreview.mockResolvedValue({
      submissionId: "submission-1",
      baseVersion: { id: "version-1", versionNumber: 1, revisionHash: "rev-1" },
      currentVersion: { id: "version-2", versionNumber: 2, revisionHash: "rev-2" },
      staleBase: true,
      canAutoMerge: false,
      requiresManualMerge: true,
      changedFiles: ["SKILL.md"],
      concurrentlyChangedFiles: ["SKILL.md"],
      conflictingFiles: ["SKILL.md"],
      addedFiles: [],
      modifiedFiles: ["SKILL.md"],
      deletedFiles: [],
      summary: "conflict",
    });
    mergeSubmission.mockResolvedValue({
      id: "version-3",
      teamSkillId: "team-skill-1",
      versionNumber: 3,
      snapshotPath: "path",
      revisionHash: "rev-3",
      mergedAt: Date.now(),
      isRecommended: false,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("requires file decisions before merging a conflicting submission", async () => {
    render(
      <MergeSubmissionModal
        open
        submission={submission}
        onCancel={vi.fn()}
        onMerged={vi.fn()}
      />,
    );

    expect((await screen.findAllByText("发现并发冲突")).length).toBeGreaterThan(0);
    expect((screen.getByRole("button", { name: /合\s*并/ }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByLabelText("采用提交"));
    await waitFor(() => {
      expect((screen.getByRole("button", { name: /按决策合并/ }) as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(screen.getByRole("button", { name: /按决策合并/ }));

    await waitFor(() => {
      expect(mergeSubmission).toHaveBeenCalledWith({
      submissionId: "submission-1",
      mergedBy: "jensen",
      changeSummary: undefined,
      resolutionMode: "manual_files",
      fileResolutions: [{ filePath: "SKILL.md", resolution: "incoming" }],
      });
    });
  }, 10000);
});
