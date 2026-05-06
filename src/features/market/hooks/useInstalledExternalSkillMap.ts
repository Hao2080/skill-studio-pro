import { useEffect, useState } from "react";
import type { Skill } from "@/types/skill";
import { listSkillSources } from "@/features/skills/api/skillsApi";

export function useInstalledExternalSkillMap(skills: Skill[]) {
  const [installedExternalSkillMap, setInstalledExternalSkillMap] = useState<Record<string, Skill>>({});

  useEffect(() => {
    let cancelled = false;
    const externalSkills = skills.filter((skill) => skill.sourceType === "skillssh");

    if (externalSkills.length === 0) {
      setInstalledExternalSkillMap({});
      return;
    }

    async function loadInstalledExternalSkillMap() {
      const results = await Promise.allSettled(
        externalSkills.map(async (skill) => {
          const sources = await listSkillSources(skill.id);
          return {
            skill,
            refs: sources
              .filter((source) => source.sourceType === "skillssh" && source.sourceRef?.trim())
              .map((source) => source.sourceRef!.trim()),
          };
        }),
      );

      if (cancelled) {
        return;
      }

      const nextMap: Record<string, Skill> = {};
      for (const result of results) {
        if (result.status === "fulfilled") {
          result.value.refs.forEach((value) => {
            nextMap[value] = result.value.skill;
          });
        }
      }

      setInstalledExternalSkillMap(nextMap);
    }

    void loadInstalledExternalSkillMap();

    return () => {
      cancelled = true;
    };
  }, [skills]);

  return installedExternalSkillMap;
}
