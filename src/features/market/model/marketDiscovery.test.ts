import { describe, expect, it } from "vitest";
import type { ExternalMarketSkill, Skill } from "@/types/skill";
import {
  buildExternalSlugConflictMap,
  buildMarketDiscoveryEntries,
  buildMarketStateCounts,
  getFacetLabel,
  matchesMarketDiscoveryFilters,
} from "./marketDiscovery";

function createExternalSkill(overrides: Partial<ExternalMarketSkill> = {}): ExternalMarketSkill {
  return {
    id: "source/skill-a",
    marketSource: "skillssh",
    sourceKeys: ["skillssh"],
    name: "Skill A",
    summary: "Useful skill",
    source: "source",
    sourceLabel: "Source",
    skillId: "skill-a",
    publisher: "Source",
    repoUrl: "https://example.local/source",
    category: "Automation",
    accentColor: "#1677ff",
    tags: ["automation"],
    installs: 10,
    featured: false,
    verification: "verified",
    risk: "low",
    facets: [],
    metrics: [],
    ...overrides,
  };
}

function createSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "local-1",
    name: "Skill A",
    slug: "skill-a",
    sourceType: "local",
    createdAt: 1,
    updatedAt: 1,
    isArchived: false,
    ...overrides,
  };
}

describe("marketDiscovery", () => {
  it("builds discovery entries with installed and conflict state", () => {
    const externalItems = [
      createExternalSkill(),
      createExternalSkill({ id: "source/skill-b", name: "Skill B", skillId: "skill-b" }),
    ];
    const installedSkill = createSkill({ id: "installed", slug: "skill-a" });
    const conflictSkill = createSkill({ id: "conflict", slug: "skill-b" });
    const conflictMap = buildExternalSlugConflictMap(
      externalItems,
      { "source/skill-a": installedSkill },
      [installedSkill, conflictSkill],
    );

    const entries = buildMarketDiscoveryEntries({
      activeSource: "skillssh",
      externalItems,
      externalSlugConflictMap: conflictMap,
      installedExternalSkillMap: { "source/skill-a": installedSkill },
      language: "en-US",
    });

    expect(entries.map((entry) => entry.status)).toEqual(["installed", "conflict"]);
  });

  it("matches filters and derives state counts", () => {
    const [entry] = buildMarketDiscoveryEntries({
      activeSource: "skillssh",
      externalItems: [createExternalSkill({ publisher: "OpenAI", category: "Security" })],
      externalSlugConflictMap: {},
      installedExternalSkillMap: {},
      language: "en-US",
    });
    const filters = {
      activeSource: "skillssh" as const,
      selectedRepository: "OpenAI",
      selectedSourcePrimary: "all",
      selectedSourceSecondary: "all",
      selectedState: "available" as const,
      selectedTopic: "security" as const,
      selectedUnifiedSource: "all" as const,
      selectedVerification: "all" as const,
    };

    expect(matchesMarketDiscoveryFilters(entry, filters)).toBe(true);
    expect(buildMarketStateCounts([entry], filters)).toEqual({
      all: 1,
      available: 1,
      installed: 0,
      conflict: 0,
    });
  });

  it("localizes source facet labels and values without changing source brand names", () => {
    const [entry] = buildMarketDiscoveryEntries({
      activeSource: "clawhub",
      externalItems: [
        createExternalSkill({
          marketSource: "clawhub",
          sourceKeys: ["clawhub"],
          facets: [
            { label: "Publisher", value: "mnetfairy" },
            { label: "Channel", value: "Community" },
            { label: "Capability", value: "General" },
          ],
        }),
      ],
      externalSlugConflictMap: {},
      installedExternalSkillMap: {},
      language: "zh-CN",
    });

    expect(entry.sourceLabel).toBe("ClawHub");
    expect(entry.lensSecondary).toBe("社区");
    expect(entry.lensTertiary).toBe("通用");
    expect(getFacetLabel(entry.external, 1, "来源频道", "zh-CN")).toBe("来源频道");
    expect(getFacetLabel(entry.external, 2, "能力类型", "zh-CN")).toBe("能力类型");
    expect(getFacetLabel(entry.external, 2, "Capability", "en-US")).toBe("Capability");
  });
});
