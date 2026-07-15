import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { libraryApi, type LibraryApi } from "@/features/library/api/libraryApi";
import { readSkillFile } from "@/features/skills/api/skillsApi";
import { aiApi, type AiApi } from "../api/aiApi";
import { generateArtifactBundle } from "../model";
import type { AiArtifact } from "../model";

const SETTINGS_KEY = "skill-studio-pro.ai-auto-enrichment";
const QUEUE_CONCURRENCY = 2;

interface StoredAutoSettings {
  enabled: boolean;
  paused: boolean;
}

export interface AutoEnrichmentStatus {
  running: boolean;
  queued: number;
  completed: number;
  failed: number;
  lastError: string;
}

interface AiAutoEnrichmentValue extends StoredAutoSettings, AutoEnrichmentStatus {
  setEnabled(enabled: boolean): void;
  setPaused(paused: boolean): void;
  runNow(): void;
}

interface AiAutoEnrichmentProviderProps {
  children: ReactNode;
  ai?: AiApi;
  library?: LibraryApi;
  readCentralFile?(skillId: string, relativePath: string): Promise<string>;
}

function readStoredSettings(): StoredAutoSettings {
  if (typeof window === "undefined") return { enabled: false, paused: false };
  try {
    const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<StoredAutoSettings>;
    return { enabled: value.enabled === true, paused: value.paused === true };
  } catch {
    return { enabled: false, paused: false };
  }
}

function latest(artifacts: AiArtifact[], taskType: string) {
  return artifacts
    .filter((artifact) => artifact.taskType === taskType)
    .sort((left, right) => right.createdAt - left.createdAt)[0];
}

const AiAutoEnrichmentContext = createContext<AiAutoEnrichmentValue | null>(null);

export function AiAutoEnrichmentProvider({
  children,
  ai = aiApi,
  library = libraryApi,
  readCentralFile = readSkillFile,
}: AiAutoEnrichmentProviderProps) {
  const [settings, setSettings] = useState(readStoredSettings);
  const [status, setStatus] = useState<AutoEnrichmentStatus>({ running: false, queued: 0, completed: 0, failed: 0, lastError: "" });
  const runningRef = useRef(false);
  const pausedRef = useRef(settings.paused);

  useEffect(() => {
    pausedRef.current = settings.paused;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const runQueue = useCallback(async () => {
    if (runningRef.current || !settings.enabled || pausedRef.current) return;
    runningRef.current = true;
    setStatus({ running: true, queued: 0, completed: 0, failed: 0, lastError: "" });
    try {
      const skills = await library.list();
      const artifactResults = await Promise.allSettled(
        skills.map((skill) => ai.listArtifacts({ skillId: skill.id, includeStale: true })),
      );
      const queue = skills.flatMap((skill, index) => {
        const artifactResult = artifactResults[index];
        if (artifactResult.status === "rejected") return [];
        const summary = latest(artifactResult.value, "final_summary");
        const usage = latest(artifactResult.value, "extract_usage");
        return !summary || !usage || summary.staleAt || usage.staleAt
          ? [{ skill, force: Boolean(summary?.staleAt || usage?.staleAt) }]
          : [];
      });
      let cursor = 0;
      let completed = 0;
      let failed = artifactResults.filter((result) => result.status === "rejected").length;
      setStatus((current) => ({ ...current, queued: queue.length, failed }));

      const worker = async () => {
        while (!pausedRef.current) {
          const item = queue[cursor];
          cursor += 1;
          if (!item) return;
          try {
            const skillMd = await readCentralFile(item.skill.id, "SKILL.md");
            const result = await generateArtifactBundle({
              api: ai,
              subject: { skillId: item.skill.id },
              skillMd,
              metadata: {
                name: item.skill.name,
                description: item.skill.description,
                contentHash: item.skill.activeContentHash,
              },
              force: item.force,
            });
            completed += 1;
            if (result.errors.length) failed += 1;
          } catch (reason) {
            failed += 1;
            setStatus((current) => ({ ...current, lastError: reason instanceof Error ? reason.message : String(reason) }));
          }
          setStatus((current) => ({ ...current, queued: Math.max(0, queue.length - cursor), completed, failed }));
        }
      };

      await Promise.all(Array.from({ length: Math.min(QUEUE_CONCURRENCY, queue.length) }, () => worker()));
    } catch (reason) {
      setStatus((current) => ({ ...current, failed: current.failed + 1, lastError: reason instanceof Error ? reason.message : String(reason) }));
    } finally {
      runningRef.current = false;
      setStatus((current) => ({ ...current, running: false }));
    }
  }, [ai, library, readCentralFile, settings.enabled]);

  useEffect(() => {
    if (settings.enabled && !settings.paused) void runQueue();
  }, [runQueue, settings.enabled, settings.paused]);

  const value: AiAutoEnrichmentValue = {
    ...settings,
    ...status,
    setEnabled: (enabled) => setSettings((current) => ({ ...current, enabled, paused: enabled ? current.paused : false })),
    setPaused: (paused) => setSettings((current) => ({ ...current, paused })),
    runNow: () => void runQueue(),
  };

  return <AiAutoEnrichmentContext.Provider value={value}>{children}</AiAutoEnrichmentContext.Provider>;
}

export function useAiAutoEnrichment() {
  const context = useContext(AiAutoEnrichmentContext);
  return context ?? {
    enabled: false,
    paused: false,
    running: false,
    queued: 0,
    completed: 0,
    failed: 0,
    lastError: "",
    setEnabled: () => undefined,
    setPaused: () => undefined,
    runNow: () => undefined,
  };
}
