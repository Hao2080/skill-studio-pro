import { invokeCommand } from "@/shared/tauri/invokeCommand";
import type {
  CentralSkill,
  ExecutePlanInput,
  MappingState,
  PublishPlan,
  PublishPlanInput,
  PublishResult,
  PublishTargetResult,
  RegisterInstancePlan,
  RegisterInstancePlanInput,
  RemoveMappingInput,
} from "../model";

export type LibraryInvoker = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export interface LibraryApi {
  list(): Promise<CentralSkill[]>;
  get(skillId: string): Promise<CentralSkill>;
  createRegisterPlan(input: RegisterInstancePlanInput): Promise<RegisterInstancePlan>;
  executeRegisterPlan(input: ExecutePlanInput): Promise<CentralSkill>;
  createPublishPlan(input: PublishPlanInput): Promise<PublishPlan>;
  executePublishPlan(input: ExecutePlanInput): Promise<PublishResult>;
  removeMapping(input: RemoveMappingInput): Promise<PublishTargetResult>;
  detectDrift(skillId: string): Promise<MappingState[]>;
}

export function createLibraryApi(invoke: LibraryInvoker = invokeCommand): LibraryApi {
  return {
    list: () => invoke<CentralSkill[]>("library_skill_list"),
    get: (skillId) => invoke<CentralSkill>("library_skill_get", { skillId }),
    createRegisterPlan: (input) =>
      invoke<RegisterInstancePlan>("library_instance_register_plan", { input }),
    executeRegisterPlan: (input) =>
      invoke<CentralSkill>("library_instance_register_execute", { input }),
    createPublishPlan: (input) => invoke<PublishPlan>("library_skill_publish_plan", { input }),
    executePublishPlan: (input) =>
      invoke<PublishResult>("library_skill_publish_execute", { input }),
    removeMapping: (input) =>
      invoke<PublishTargetResult>("library_skill_remove_mapping", { input }),
    detectDrift: (skillId) =>
      invoke<MappingState[]>("library_skill_drift_check", { skillId }),
  };
}

export const libraryApi = createLibraryApi();
