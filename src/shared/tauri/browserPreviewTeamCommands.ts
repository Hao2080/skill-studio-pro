import type { BrowserPreviewState } from "./browserPreviewStateMocks";
import { invokeBrowserPreviewTeamDeliveryCommand } from "./browserPreviewTeamDeliveryCommands";
import { invokeBrowserPreviewTeamManagementCommand } from "./browserPreviewTeamManagementCommands";
import { invokeBrowserPreviewTeamSubmissionCommand } from "./browserPreviewTeamSubmissionCommands";
import type { BrowserPreviewTeamCommandHelpers } from "./browserPreviewTeamCommandTypes";

export function invokeBrowserPreviewTeamCommand<T>(
  state: BrowserPreviewState,
  command: string,
  args: Record<string, unknown> | undefined,
  helpers: BrowserPreviewTeamCommandHelpers,
) {
  switch (command) {
    case "team_list":
    case "team_create":
    case "team_update":
    case "team_set_status":
    case "team_delete":
    case "team_skill_list":
    case "team_member_list":
    case "team_member_create":
    case "team_member_update":
    case "team_member_remove":
    case "team_activity_list":
      return invokeBrowserPreviewTeamManagementCommand<T>(state, command, args) as T;
    case "team_submission_list":
    case "team_submission_merge_preview":
    case "team_submission_merge":
    case "team_submission_reject":
    case "team_version_set_recommended":
      return invokeBrowserPreviewTeamSubmissionCommand<T>(state, command, args) as T;
    case "team_skill_delivery_get":
    case "team_submit":
    case "team_snapshot_submit_to_teams":
    case "team_pending_delivery_withdraw":
    case "team_skill_remove_from_teams":
      return invokeBrowserPreviewTeamDeliveryCommand<T>(state, command, args, helpers) as T;
    default:
      return undefined;
  }
}
