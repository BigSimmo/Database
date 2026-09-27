import "server-only";
import { z } from "zod";
import type { RosterAdminClient } from "@/lib/roster/team/api";
import { rosterApiError, rosterUnavailable } from "@/lib/roster/team/errors";
import { rosterDraftReceiptSchema } from "./model";
import {
  rosterMakerStateSchema,
  rosterMakerProposalSchema,
  rosterMakerPublicationReceiptSchema,
  rosterMyAgreementsSchema,
  type RosterMakerAction,
} from "./workflow-model";

export async function readRosterMaker(
  client: RosterAdminClient,
  actorId: string,
  serviceId: string,
  draftId: string | null,
  mine = false,
) {
  const { data, error } = await client.rpc("roster_maker_read", {
    p_actor_id: actorId,
    p_service_id: serviceId,
    p_draft_id: draftId,
    p_mine: mine,
  });
  if (error) throw rosterApiError(error);
  const parsed = (mine ? rosterMyAgreementsSchema : rosterMakerStateSchema).safeParse(data);
  if (!parsed.success) throw rosterUnavailable();
  return parsed.data;
}

export async function commandRosterMaker(
  client: RosterAdminClient,
  actorId: string,
  serviceId: string,
  action: RosterMakerAction,
) {
  const { action: command, ...payload } = action;
  const { data, error } = await client.rpc("roster_maker_command", {
    p_actor_id: actorId,
    p_service_id: serviceId,
    p_action: command,
    p_payload: payload,
  });
  if (error) throw rosterApiError(error);
  if (action.action === "proposal.create") {
    const parsed = z.object({ proposal: rosterMakerProposalSchema }).safeParse(data);
    if (
      !parsed.success ||
      parsed.data.proposal.draftId !== action.draftId ||
      parsed.data.proposal.draftVersion !== action.expectedVersion ||
      parsed.data.proposal.scope !== action.scope ||
      parsed.data.proposal.changeId !== (action.changeId ?? null)
    )
      throw rosterUnavailable();
    return parsed.data;
  }
  if (action.action === "proposal.publish") {
    const parsed = rosterMakerPublicationReceiptSchema.safeParse(data);
    if (!parsed.success) throw rosterUnavailable();
    return parsed.data;
  }
  if (action.action === "draft.reconcile") {
    const parsed = rosterDraftReceiptSchema.safeParse(data);
    if (!parsed.success || parsed.data.draftId !== action.draftId || parsed.data.version !== action.expectedVersion + 1)
      throw rosterUnavailable();
    return parsed.data;
  }
  const parsed = rosterMakerStateSchema.safeParse(data);
  if (!parsed.success) throw rosterUnavailable();
  return parsed.data;
}

export async function agreeRosterProposal(
  client: RosterAdminClient,
  actorId: string,
  serviceId: string,
  proposalId: string,
) {
  const { data, error } = await client.rpc("roster_maker_command", {
    p_actor_id: actorId,
    p_service_id: serviceId,
    p_action: "agreement.record",
    p_payload: { proposalId },
  });
  if (error) throw rosterApiError(error);
  const parsed = rosterMyAgreementsSchema.safeParse(data);
  if (
    !parsed.success ||
    !parsed.data.proposals.some((proposal) => proposal.id === proposalId && proposal.agreedAt !== null)
  )
    throw rosterUnavailable();
  return parsed.data;
}
