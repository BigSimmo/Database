// src/app/api/caring-contacts/service-state/route.ts
//
// The service-wide safety stop. GET reports it; POST raises one or records a restart approval.
//
// This is the designated narrowing boundary for Ruling 43. `getServiceState` returns the whole
// incident record, including the responder's free-text `note`, to any actor of any team -- because
// the store must not gate it, or a team with no part in the incident would never learn that
// sending is halted. `narrowServiceStateForActor` releases the stopped fact, the reason category
// and the timing to everyone, and the note only to an actor who may see incident detail.
import { z } from "zod";

import { readHandler, writeContextFor, writeHandler } from "@/lib/caring-contacts-server/handler";
import { narrowServiceStateForActor } from "@/lib/caring-contacts-server/service-state-view";
import type { CaringContactAction } from "@/lib/caring-contacts/permissions";

export const runtime = "nodejs";

/** One record for the whole service, never one per team -- so the object it names is the service. */
const SERVICE = "service";

const serviceStateSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("stop"),
      reason: z.enum([
        "wrong-recipient",
        "duplicate-send",
        "unauthorised-content",
        "privacy-or-security-incident",
        "audit-integrity-loss",
      ]),
      /** Free text about the incident. It is stored, and this route narrows who may read it back. */
      note: z.string().min(1),
      idempotencyKey: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("approveRestart"),
      role: z.enum(["incidentLead", "privacySecurityOwner", "clinicalProgrammeLead"]),
      idempotencyKey: z.string().min(1),
    })
    .strict(),
]);

function capabilityFor(body: z.infer<typeof serviceStateSchema>): CaringContactAction {
  return body.type === "stop" ? "triggerServiceSafetyStop" : "approveServiceRestart";
}

export const GET = readHandler({
  access: { kind: "administrative", objectType: "report", objectId: () => SERVICE },
  read: async (store, actor) => narrowServiceStateForActor(await store.getServiceState({ actor }), actor),
});

export const POST = writeHandler({
  schema: serviceStateSchema,
  action: capabilityFor,
  write: async (store, actor, body) => {
    if (body.type === "stop") {
      return store.stopService({ reason: body.reason, note: body.note }, writeContextFor(actor, body.idempotencyKey));
    }
    return store.approveServiceRestart({ role: body.role }, writeContextFor(actor, body.idempotencyKey));
  },
});
