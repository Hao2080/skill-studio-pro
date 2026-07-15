import { describe, expect, it } from "vitest";
import type { SkillOrganizationSnapshot } from "@/types/skill";
import {
  DEFAULT_CATEGORIES,
  diffTagNames,
  findCaseInsensitiveMatch,
  hasLocalOrganizationData,
  isCustomCategory,
  isOrganizationSnapshotEmpty,
  normalizeNames,
  normalizeTagNames,
  removeTagsFromAssignments,
} from "./workspaceCategories";

const emptySnapshot: SkillOrganizationSnapshot = {
  collections: [],
  tags: [],
  records: [],
};

describe("workspace category presentation helpers", () => {
  it("normalizes names by trimming empty and duplicate values", () => {
    expect(normalizeTagNames([" Automation ", "", "Writing", "Automation"])).toEqual([
      "Automation",
      "Writing",
    ]);
    expect(normalizeNames([" Alpha ", null, undefined, "", "Alpha", "Beta"])).toEqual([
      "Alpha",
      "Beta",
    ]);
  });

  it("diffs tag names without changing the current order", () => {
    expect(diffTagNames(["Automation", "Writing"], ["Writing", "Analysis"])).toEqual({
      add: ["Analysis"],
      remove: ["Automation"],
    });
  });

  it("matches names case-insensitively while allowing the current value to be excluded", () => {
    expect(findCaseInsensitiveMatch(["Automation", "Writing"], "automation")).toBe("Automation");
    expect(findCaseInsensitiveMatch(["Automation", "Writing"], "automation", "Automation")).toBeUndefined();
  });

  it("detects custom categories and local organization data", () => {
    expect(DEFAULT_CATEGORIES.every((category) => !isCustomCategory(category))).toBe(true);
    expect(isCustomCategory("Workflow")).toBe(true);

    expect(hasLocalOrganizationData([...DEFAULT_CATEGORIES], {}, [], {})).toBe(false);
    expect(hasLocalOrganizationData([...DEFAULT_CATEGORIES, "Workflow"], {}, [], {})).toBe(true);
    expect(hasLocalOrganizationData([...DEFAULT_CATEGORIES], { "skill-1": "Workflow" }, [], {})).toBe(true);
    expect(hasLocalOrganizationData([...DEFAULT_CATEGORIES], {}, ["Automation"], {})).toBe(true);
    expect(hasLocalOrganizationData([...DEFAULT_CATEGORIES], {}, [], { "skill-1": ["Automation"] })).toBe(true);
  });

  it("detects whether a remote organization snapshot has assignments", () => {
    expect(isOrganizationSnapshotEmpty(emptySnapshot)).toBe(true);
    expect(
      isOrganizationSnapshotEmpty({
        ...emptySnapshot,
        records: [
          {
            skillId: "skill-1",
            collectionIds: [],
            collectionNames: [],
            tagIds: [],
            tagNames: [],
          },
        ],
      }),
    ).toBe(true);
    expect(
      isOrganizationSnapshotEmpty({
        ...emptySnapshot,
        records: [
          {
            skillId: "skill-1",
            primaryCollectionId: "collection-1",
            collectionIds: [],
            collectionNames: [],
            tagIds: [],
            tagNames: [],
          },
        ],
      }),
    ).toBe(false);
  });
});

describe("removeTagsFromAssignments", () => {
  it("removes target tags from selected skills only", () => {
    const next = removeTagsFromAssignments(
      {
        "skill-1": ["Automation", "Writing"],
        "skill-2": ["Automation", "Analysis"],
        "skill-3": ["Research"],
      },
      ["skill-1", "skill-2"],
      ["Automation"],
    );

    expect(next).toEqual({
      "skill-1": ["Writing"],
      "skill-2": ["Analysis"],
      "skill-3": ["Research"],
    });
  });
});
