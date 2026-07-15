import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invokeCommand } from "@/shared/tauri/invokeCommand";
import type {
  InstanceListInput,
  InstanceListResult,
  InstancesChangedEvent,
  OriginConfirmInput,
  ScanProgressEvent,
  ScanRoot,
  ScanRootUpsertInput,
  ScanRun,
  ScanStartInput,
  SkillInstanceDetail,
  SourceResolution,
} from "../model/inventoryTypes";

export const INVENTORY_SCAN_PROGRESS_EVENT = "inventory://scan-progress";
export const INVENTORY_INSTANCES_CHANGED_EVENT = "inventory://instances-changed";
export const INVENTORY_WATCHER_STATUS_EVENT = "inventory://watcher-status";

export type InventoryInvoker = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export interface InventoryApi {
  listRoots(): Promise<ScanRoot[]>;
  upsertRoot(input: ScanRootUpsertInput): Promise<ScanRoot>;
  startScan(input?: ScanStartInput): Promise<ScanRun>;
  cancelScan(runId: string): Promise<boolean>;
  listInstances(input?: InstanceListInput): Promise<InstanceListResult>;
  getInstance(instanceId: string): Promise<SkillInstanceDetail>;
  getOriginResolution(instanceId: string): Promise<SourceResolution>;
  confirmOrigin(input: OriginConfirmInput): Promise<SourceResolution>;
  recalculateOrigin(instanceId: string): Promise<SourceResolution>;
}

export function createInventoryApi(invoke: InventoryInvoker = invokeCommand): InventoryApi {
  return {
    listRoots: () => invoke<ScanRoot[]>("inventory_root_list"),
    upsertRoot: (input) => invoke<ScanRoot>("inventory_root_upsert", { input }),
    startScan: (input = {}) =>
      invoke<ScanRun>("inventory_scan_start", {
        input: { mode: input.mode ?? "incremental", rootIds: input.rootIds ?? [] },
      }),
    cancelScan: (runId) => invoke<boolean>("inventory_scan_cancel", { input: { runId } }),
    listInstances: (input = {}) => invoke<InstanceListResult>("inventory_instance_list", { input }),
    getInstance: (instanceId) => invoke<SkillInstanceDetail>("inventory_instance_get", { instanceId }),
    getOriginResolution: (instanceId) =>
      invoke<SourceResolution>("origin_resolution_get", { instanceId }),
    confirmOrigin: (input) => invoke<SourceResolution>("origin_resolution_confirm", { input }),
    recalculateOrigin: (instanceId) =>
      invoke<SourceResolution>("origin_resolution_recalculate", { input: { instanceId } }),
  };
}

export const inventoryApi = createInventoryApi();

export function listenInventoryScanProgress(
  callback: (event: ScanProgressEvent) => void,
): Promise<UnlistenFn> {
  return listen<ScanProgressEvent>(INVENTORY_SCAN_PROGRESS_EVENT, ({ payload }) => callback(payload));
}

export function listenInventoryInstancesChanged(
  callback: (event: InstancesChangedEvent) => void,
): Promise<UnlistenFn> {
  return listen<InstancesChangedEvent>(INVENTORY_INSTANCES_CHANGED_EVENT, ({ payload }) => callback(payload));
}
