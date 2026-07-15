import { useEffect, useState } from "react";
import type { ExternalMarketBoard, ExternalMarketSkill } from "@/types/skill";
import { getExternalMarketSkills, searchMarketSkills } from "../api/marketApi";
import type { MarketSourceKey } from "../model/marketTypes";

interface UseExternalMarketItemsInput {
  activeSource: MarketSourceKey;
  debouncedSearchQuery: string;
  fetchBoard: ExternalMarketBoard;
}

export function useExternalMarketItems({
  activeSource,
  debouncedSearchQuery,
  fetchBoard,
}: UseExternalMarketItemsInput) {
  const [items, setItems] = useState<ExternalMarketSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadExternalMarket() {
      setLoading(true);
      setError(null);

      try {
        const nextItems = debouncedSearchQuery
          ? await searchMarketSkills(activeSource, debouncedSearchQuery)
          : await getExternalMarketSkills(activeSource, fetchBoard);

        if (!cancelled) {
          setItems(nextItems);
        }
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

    void loadExternalMarket();

    return () => {
      cancelled = true;
    };
  }, [activeSource, debouncedSearchQuery, fetchBoard, reloadKey]);

  return {
    error,
    items,
    loading,
    reload: () => setReloadKey((value) => value + 1),
  };
}
