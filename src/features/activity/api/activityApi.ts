import { invokeCommand } from "@/shared/tauri/invokeCommand";
import type { OperationListInput, OperationLog } from "../model";

export type ActivityInvoker = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export interface ActivityApi {
  list(input?: OperationListInput): Promise<OperationLog[]>;
}

export function createActivityApi(invoke: ActivityInvoker = invokeCommand): ActivityApi {
  return {
    list: (input?: OperationListInput) =>
      invoke<OperationLog[]>("operation_list", input ? { input } : undefined),
  };
}

export const activityApi = createActivityApi();
