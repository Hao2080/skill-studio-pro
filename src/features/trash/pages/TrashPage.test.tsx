/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrashApi } from "../api/trashApi";
import type { TrashEntry } from "../model";
import { TrashPage } from "./TrashPage";

const entry: TrashEntry = {
  id: "trash-1",
  entityType: "skill",
  entityId: "skill-1",
  displayName: "old-git-helper",
  originalPath: "preview/skills/old-git-helper",
  trashPath: "preview/trash/trash-1",
  manifestPath: "preview/manifests/trash-1.json",
  relatedStateJson: JSON.stringify({ mappings: [{ platformName: "codex" }] }),
  contentHash: "hash-1",
  status: "trashed",
  deletedAt: 1,
};

function api(): TrashApi {
  return {
    list: vi.fn().mockResolvedValue([entry]),
    createDeletePlan: vi.fn(),
    executeDelete: vi.fn(),
    createRestorePlan: vi.fn().mockResolvedValue({ id: "restore-plan", trashEntryId: entry.id, skillId: entry.entityId, displayName: entry.displayName, targetName: entry.displayName, targetSlug: entry.displayName, targetPath: entry.originalPath, sourceHash: entry.contentHash, mappingsWillBeRepublished: false, planHash: "restore-hash", createdAt: 1, expiresAt: 2 }),
    executeRestore: vi.fn().mockResolvedValue(entry),
    createPurgeConfirmation: vi.fn().mockResolvedValue({ trashEntryId: entry.id, confirmationToken: "server-token", expiresAt: 2 }),
    executePurge: vi.fn().mockResolvedValue(undefined),
  };
}

describe("TrashPage permanent delete guard", () => {
  afterEach(cleanup);

  it("requires impact review and exact-name confirmation before requesting a server token", async () => {
    const client = api();
    render(<TrashPage api={client}/>);
    fireEvent.click(await screen.findByRole("button", { name: "永久删除" }));
    expect(screen.getByText("确认影响范围")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "继续最终确认" }));
    expect(screen.getByText("最终确认永久删除")).toBeTruthy();
    const purgeButton = within(screen.getByRole("dialog")).getByRole("button", { name: "永久删除" });
    expect((purgeButton as HTMLButtonElement).disabled).toBe(true);
    expect(client.createPurgeConfirmation).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Skill 名称"), { target: { value: "old-git-helper" } });
    expect((purgeButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(purgeButton);
    await waitFor(() => expect(client.executePurge).toHaveBeenCalledWith("trash-1", "server-token"));
  });
});
