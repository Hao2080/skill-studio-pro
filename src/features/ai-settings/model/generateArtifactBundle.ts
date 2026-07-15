import type { AiApi } from "../api/aiApi";
import type { AiArtifact, AiTaskType } from "./aiTypes";

const COLLECTION_TASKS: AiTaskType[] = ["extract_usage", "suggest_tags", "classify"];

export interface ArtifactSubject {
  skillId?: string;
  instanceId?: string;
}

export interface ArtifactBundleResult {
  artifacts: AiArtifact[];
  errors: Array<{ taskType: AiTaskType; message: string }>;
}

interface GenerateArtifactBundleOptions {
  api: AiApi;
  subject: ArtifactSubject;
  skillMd: string;
  metadata: Record<string, unknown>;
  force: boolean;
  onTaskStart?(taskType: AiTaskType, cancellationId: string): void;
  onTaskSettled?(taskType: AiTaskType, cancellationId: string): void;
}

function cancellationId(taskType: AiTaskType) {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `artifact-${taskType}-${suffix}`;
}

export async function generateArtifactBundle({
  api,
  subject,
  skillMd,
  metadata,
  force,
  onTaskStart,
  onTaskSettled,
}: GenerateArtifactBundleOptions): Promise<ArtifactBundleResult> {
  const artifacts: AiArtifact[] = [];
  const errors: ArtifactBundleResult["errors"] = [];
  const baseInput = { skillMd, localMetadata: metadata };

  const collectionResults = await Promise.allSettled(
    COLLECTION_TASKS.map(async (taskType) => {
      const id = cancellationId(taskType);
      onTaskStart?.(taskType, id);
      try {
        return await api.generateArtifact({
          taskType,
          ...subject,
          input: baseInput,
          force,
          cancellationId: id,
        });
      } finally {
        onTaskSettled?.(taskType, id);
      }
    }),
  );

  collectionResults.forEach((result, index) => {
    const taskType = COLLECTION_TASKS[index];
    if (result.status === "fulfilled") {
      artifacts.push(result.value);
    } else {
      errors.push({
        taskType,
        message: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  });

  const finalCancellationId = cancellationId("final_summary");
  onTaskStart?.("final_summary", finalCancellationId);
  try {
    const summary = await api.generateArtifact({
      taskType: "final_summary",
      ...subject,
      input: {
        ...baseInput,
        collectedArtifacts: artifacts.map((artifact) => ({
          taskType: artifact.taskType,
          content: artifact.content,
        })),
      },
      force,
      cancellationId: finalCancellationId,
    });
    artifacts.push(summary);
  } catch (reason) {
    errors.push({
      taskType: "final_summary",
      message: reason instanceof Error ? reason.message : String(reason),
    });
  } finally {
    onTaskSettled?.("final_summary", finalCancellationId);
  }

  return { artifacts, errors };
}
