import { invokeCommand } from "@/shared/tauri/invokeCommand";
import type {
  DeletePlan,
  PurgeConfirmation,
  RestorePlan,
  RestorePlanInput,
  TrashEntry,
} from "../model";

export type TrashInvoker = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export interface TrashApi {
  createDeletePlan(skillId: string): Promise<DeletePlan>;
  executeDelete(planId: string, planHash: string): Promise<TrashEntry>;
  list(): Promise<TrashEntry[]>;
  createRestorePlan(input: RestorePlanInput): Promise<RestorePlan>;
  executeRestore(planId: string, planHash: string): Promise<TrashEntry>;
  createPurgeConfirmation(trashEntryId: string): Promise<PurgeConfirmation>;
  executePurge(trashEntryId: string, confirmationToken: string): Promise<void>;
}

export function createTrashApi(invoke: TrashInvoker = invokeCommand): TrashApi {
  return {
    createDeletePlan: (skillId) => invoke<DeletePlan>("trash_plan_create", { skillId }),
    executeDelete: (planId, planHash) =>
      invoke<TrashEntry>("trash_move_execute", { input: { planId, planHash } }),
    list: () => invoke<TrashEntry[]>("trash_list"),
    createRestorePlan: (input) => invoke<RestorePlan>("trash_restore_plan", { input }),
    executeRestore: (planId, planHash) =>
      invoke<TrashEntry>("trash_restore_execute", { input: { planId, planHash } }),
    createPurgeConfirmation: (trashEntryId) =>
      invoke<PurgeConfirmation>("trash_purge_confirmation_create", { trashEntryId }),
    executePurge: (trashEntryId, confirmationToken) =>
      invoke<void>("trash_purge_execute", { input: { trashEntryId, confirmationToken } }),
  };
}

export const trashApi = createTrashApi();
