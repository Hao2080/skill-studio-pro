import { useEffect, useState } from "react";
import type { ExternalMarketSkill, ExternalMarketSkillDetail } from "@/types/skill";
import { getMarketExternalSkillDetail } from "../api/marketApi";

export function useMarketExternalDetail() {
  const [open, setOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<ExternalMarketSkill | null>(null);
  const [detail, setDetail] = useState<ExternalMarketSkillDetail | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, ExternalMarketSkillDetail>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !selectedSkill) {
      return;
    }

    const cached = detailCache[selectedSkill.id];
    if (cached) {
      setDetail(cached);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const targetSkill = selectedSkill;
    setDetail(null);
    setError(null);
    setLoading(true);

    async function loadExternalDetail() {
      try {
        const nextDetail = await getMarketExternalSkillDetail(
          targetSkill.marketSource,
          targetSkill.source,
          targetSkill.skillId,
          targetSkill.packageName,
          targetSkill.packageVersion,
        );

        if (cancelled) {
          return;
        }

        setDetailCache((current) => ({
          ...current,
          [targetSkill.id]: nextDetail,
        }));
        setDetail(nextDetail);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadExternalDetail();

    return () => {
      cancelled = true;
    };
  }, [detailCache, open, selectedSkill]);

  const openDetail = (skill: ExternalMarketSkill) => {
    setSelectedSkill(skill);
    setOpen(true);
  };

  const reloadDetail = () => {
    if (!selectedSkill) {
      return;
    }

    setDetailCache((current) => {
      const next = { ...current };
      delete next[selectedSkill.id];
      return next;
    });
    setDetail(null);
    setError(null);
    setSelectedSkill({ ...selectedSkill });
  };

  const closeDetail = () => {
    setOpen(false);
    setSelectedSkill(null);
    setDetail(null);
    setError(null);
    setLoading(false);
  };

  return {
    closeDetail,
    detail,
    error,
    loading,
    open,
    openDetail,
    reloadDetail,
    selectedSkill,
  };
}
