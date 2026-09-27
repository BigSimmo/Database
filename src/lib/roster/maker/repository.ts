import "server-only";
import type { RosterAdminClient } from "@/lib/roster/team/api";
import { rosterApiError, rosterUnavailable } from "@/lib/roster/team/errors";
import { rosterDraftReceiptSchema, rosterDraftSchema, type RosterDraftAction } from "./model";

export async function readRosterDraft(client: RosterAdminClient, actorId: string, serviceId: string, draftId: string) {
  const { data, error } = await client.rpc("roster_read", {
    p_actor_id: actorId,
    p_service_id: serviceId,
    p_what: "draft",
    p_payload: { draftId },
  });
  if (error) throw rosterApiError(error);
  const parsed = rosterDraftSchema.safeParse(data);
  if (!parsed.success || parsed.data.draft.id !== draftId) throw rosterUnavailable();
  return parsed.data;
}

export async function changeRosterDraft(
  client: RosterAdminClient,
  actorId: string,
  serviceId: string,
  action: RosterDraftAction,
) {
  const { action: command, ...payload } = action;
  const { data, error } = await client.rpc("roster_command", {
    p_actor_id: actorId,
    p_service_id: serviceId,
    p_action: command,
    p_payload: payload,
  });
  if (error) throw rosterApiError(error);
  const receipt = rosterDraftReceiptSchema.safeParse(data);
  if (!receipt.success) throw rosterUnavailable();
  if (
    action.action !== "draft.open" &&
    (receipt.data.draftId !== action.draftId || receipt.data.version !== action.expectedVersion + 1)
  )
    throw rosterUnavailable();
  // Recheck current access; another manager's later edit may already be present.
  // Never repeat a mutation automatically if its follow-up read fails.
  const draft = await readRosterDraft(client, actorId, serviceId, receipt.data.draftId);
  if (draft.draft.version < receipt.data.version) throw rosterUnavailable();
  return draft;
}
