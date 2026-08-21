// src/app/api/caring-contacts/referrals/route.ts
//
// Referrals. GET lists the ones this team may see; POST either creates one or moves it through
// handover. A referral names a patient, so the read is recorded against the patient directory
// rather than against a plan that may not exist yet.
import { z } from "zod";

import { readHandler, writeContextFor, writeHandler } from "@/lib/caring-contacts-server/handler";
import { pathwayVersionId, patientId, referralId } from "@/lib/caring-contacts/ids";
import type { CaringContactAction } from "@/lib/caring-contacts/permissions";

export const runtime = "nodejs";

const COLLECTION = "all";

const referralSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("create"),
      referralId: z.string().min(1),
      patientId: z.string().min(1),
      idempotencyKey: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("transition"),
      referralId: z.string().min(1),
      action: z.discriminatedUnion("type", [
        z.object({ type: z.literal("accept"), pathwayVersionId: z.string().min(1) }).strict(),
        z.object({ type: z.literal("returnForClarification"), reason: z.string().min(1) }).strict(),
        z.object({ type: z.literal("decline"), reason: z.string().min(1) }).strict(),
      ]),
      idempotencyKey: z.string().min(1),
    })
    .strict(),
]);

/** The same capability the store checks for each transition, so the boundary cannot be stricter. */
function capabilityFor(body: z.infer<typeof referralSchema>): CaringContactAction {
  if (body.type === "create") return "createReferral";
  if (body.action.type === "accept") return "acceptReferral";
  if (body.action.type === "returnForClarification") return "returnReferralForClarification";
  return "declineReferral";
}

export const GET = readHandler({
  access: { kind: "search", objectType: "patientDirectory", objectId: () => COLLECTION },
  read: async (store, actor) => store.listReferrals({ actor }),
});

export const POST = writeHandler({
  schema: referralSchema,
  action: capabilityFor,
  write: async (store, actor, body) => {
    if (body.type === "create") {
      return store.createReferral(
        { referralId: referralId(body.referralId), patientId: patientId(body.patientId) },
        writeContextFor(actor, body.idempotencyKey),
      );
    }
    const write = writeContextFor(actor, body.idempotencyKey);
    const action =
      body.action.type === "accept"
        ? { type: "accept" as const, pathwayVersionId: pathwayVersionId(body.action.pathwayVersionId) }
        : body.action;
    return store.transitionReferral({ referralId: referralId(body.referralId), action }, write);
  },
});
