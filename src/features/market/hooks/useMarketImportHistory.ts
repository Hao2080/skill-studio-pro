import { useCallback, useEffect, useState } from "react";
import type { SkillImportRecord } from "@/types/skill";
import { listSkillImportRecords } from "@/features/skills/api/skillsApi";

export function useMarketImportHistory() {
  const [importHistory, setImportHistory] = useState<SkillImportRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadImportHistory = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setHistoryLoading(true);
    }

    try {
      const records = await listSkillImportRecords(12);
      setImportHistory(records);
      setHistoryError(null);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : String(error));
    } finally {
      if (showLoading) {
        setHistoryLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadImportHistory(true);
  }, [loadImportHistory]);

  return {
    historyError,
    historyLoading,
    importHistory,
    loadImportHistory,
  };
}
