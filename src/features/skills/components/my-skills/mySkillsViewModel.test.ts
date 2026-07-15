import { describe, expect, it } from "vitest";
import { buildMySkillsViewModel, filterMySkillsItems } from "@/features/skills/components/my-skills/mySkillsViewModel";
import type { Skill } from "@/types/skill";
import type { MySkillItem } from "./types";

describe("buildMySkillsViewModel", () => {
  it("keeps missing descriptions as empty strings instead of localized placeholder text", () => {
    const skills: Skill[] = [
      {
        id: "skill-1",
        name: "Research Agent",
        slug: "research-agent",
        description: "   ",
        sourceType: "manual",
        createdAt: 1,
        updatedAt: 2,
        isArchived: false,
      },
    ];

    const model = buildMySkillsViewModel(skills, {});

    expect(model.items[0]).toMatchObject({
      description: "",
      needsDescription: true,
    });
  });
});

describe("filterMySkillsItems", () => {
  const items: MySkillItem[] = [
    {
      id: "skill-1",
      name: "Writing Assistant",
      slug: "writing-assistant",
      description: "Help draft product copy",
      sourceType: "manual",
      updatedAt: 2,
      createdAt: 1,
      isArchived: false,
      hasChanges: false,
      category: "Research",
      tags: ["Automation", "Writing"],
      needsDescription: false,
    },
    {
      id: "skill-2",
      name: "Research Agent",
      slug: "research-agent",
      description: "Summarize market notes",
      sourceType: "manual",
      updatedAt: 4,
      createdAt: 3,
      isArchived: false,
      hasChanges: true,
      category: null,
      tags: ["Analysis"],
      needsDescription: false,
    },
  ];

  it("matches tags during keyword search", () => {
    const filtered = filterMySkillsItems(items, "All", "Automation", "updated");
    expect(filtered.map((item) => item.id)).toEqual(["skill-1"]);
  });

  it("filters results by selected tags", () => {
    const filtered = filterMySkillsItems(items, "All", "", "updated", "all", ["Analysis"]);
    expect(filtered.map((item) => item.id)).toEqual(["skill-2"]);
  });
});
