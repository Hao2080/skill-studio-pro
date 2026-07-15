/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SubmitToTeamModal } from "@/features/snapshots/components/SubmitToTeamModal";

const i18nState = {
  resolvedLanguage: "zh-CN" as "zh-CN" | "en-US",
};

const selectTeam = vi.fn();
const loadTeamSkills = vi.fn(async () => {});
const submitToTeam = vi.fn(async () => null);

const teamContextMock = {
  teams: [] as Array<{ id: string; name: string }>,
  selectedTeamId: null as string | null,
  selectTeam,
  teamSkills: [],
  loadTeamSkills,
  submitToTeam,
};

vi.mock("@/features/settings/state/I18nContext", () => ({
  useI18n: () => i18nState,
}));

vi.mock("@/features/teams/state/TeamContext", () => ({
  useTeamContext: () => teamContextMock,
}));

describe("SubmitToTeamModal", () => {
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
    teamContextMock.teams = [];
    teamContextMock.selectedTeamId = null;
    teamContextMock.teamSkills = [];
    selectTeam.mockClear();
    loadTeamSkills.mockClear();
    submitToTeam.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders english copy when ui language is english", () => {
    i18nState.resolvedLanguage = "en-US";

    render(
      <SubmitToTeamModal
        open
        skillId="skill-1"
        snapshotId="snap-1"
        onCancel={() => {}}
      />,
    );

    expect(screen.getByText("Submit to team")).toBeTruthy();
    expect(screen.getByText("Target team")).toBeTruthy();
    expect(screen.getByText("Target team skill")).toBeTruthy();
    expect(screen.getByText("Submitter")).toBeTruthy();
    expect(screen.getByText("Note")).toBeTruthy();
    expect(screen.getByText("Create a team on the Teams page first.")).toBeTruthy();
    expect(screen.getByText(/Source skill.*Source snapshot/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Submit" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });
});
