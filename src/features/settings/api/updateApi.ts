export type UpdateStatus = "disabled";

export interface InstallUpdateResult {
  status: UpdateStatus;
}

export async function checkAndInstallUpdate(): Promise<InstallUpdateResult> {
  return { status: "disabled" };
}
