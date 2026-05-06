import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent } from "@tauri-apps/plugin-updater";

export type UpdateStatus = "current" | "installed";

export interface UpdateProgress {
  downloaded: number;
  total?: number;
}

export interface InstallUpdateResult {
  status: UpdateStatus;
  version?: string;
}

export async function checkAndInstallUpdate(
  onProgress?: (progress: UpdateProgress) => void,
): Promise<InstallUpdateResult> {
  const update = await check();

  if (!update) {
    return { status: "current" };
  }

  let downloaded = 0;
  let total: number | undefined;

  await update.downloadAndInstall((event: DownloadEvent) => {
    if (event.event === "Started") {
      total = event.data.contentLength;
      downloaded = 0;
      onProgress?.({ downloaded, total });
      return;
    }

    if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
      onProgress?.({ downloaded, total });
      return;
    }

    onProgress?.({ downloaded: total ?? downloaded, total });
  });

  return { status: "installed", version: update.version };
}

export async function relaunchApp(): Promise<void> {
  await relaunch();
}
