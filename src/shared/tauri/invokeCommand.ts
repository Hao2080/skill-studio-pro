import { invoke } from "@tauri-apps/api/core";
import { invokeBrowserPreviewCommand, shouldUseBrowserPreviewMocks } from "./browserPreviewMocks";

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error == null) {
    return "未知错误";
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    if (shouldUseBrowserPreviewMocks()) {
      return await invokeBrowserPreviewCommand<T>(command, args);
    }

    return await invoke<T>(command, args);
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
}
