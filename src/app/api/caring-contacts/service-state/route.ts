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

import { auditableIdentifier, readHandler, writeContextFor, writeHandler } from "@/lib/caring-contacts-server/handler";
import { narrowServiceStateForActor, type ServiceStateView } from "@/lib/caring-contacts-server/service-state-view";
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
      idempotencyKey: auditableIdentifier,
    })
    .strict(),
  z
    .object({
      type: z.literal("approveRestart"),
      role: z.enum(["incidentLead", "privacySecurityOwner", "clinicalProgrammeLead"]),
      idempotencyKey: auditableIdentifier,
    })
    .strict(),
]);

function capabilityFor(body: z.infer<typeof serviceStateSchema>): CaringContactAction {
  return body.type === "stop" ? "triggerServiceSafetyStop" : "approveServiceRestart";
}

export const GET = readHandler({
  access: { kind: "administrative", objectType: "serviceState", objectId: () => SERVICE },
  read: async (store, actor) => narrowServiceStateForActor(await store.getServiceState({ actor }), actor),
});

/**
 * Both writes hand back the whole `ServiceState`, so both replies go through the SAME narrowing
 * the GET does -- and they must, because this is the one place where the capability that let the
 * write happen and the capability that releases the note are different questions.
 *
 * `writeHandler` checks the action against the ACTOR'S OWN team, which is right for a service-wide
 * write: a stop must be raisable by anyone, and a restart is approved by three seats that need not
 * sit in the reporting team. `narrowServiceStateForActor` checks `viewPatientRecord` against
 * `state.reportedByTeamId`, because that is whose incident the note describes. A second team's
 * `teamLead` therefore legitimately passes the first check and legitimately fails the second, and
 * an unnarrowed reply would hand them the note anyway -- the first and second restart approvals
 * both leave the service stopped, so `approveServiceRestart` returns the note-bearing record.
 *
 * The reply is narrowed rather than emptied. The approver needs to see what their approval did --
 * the stop still standing, and their own approval now among `restartApprovals` -- and a `null`
 * reply would make the caller re-read the state through GET to learn it, through the same
 * narrowing, for the same answer.
 */
export const POST = writeHandler<z.infer<typeof serviceStateSchema>, ServiceStateView>({
  schema: serviceStateSchema,
  action: capabilityFor,
  access: { objectType: "serviceState", objectId: () => SERVICE },
  write: async (store, actor, body) => {
    const result =
      body.type === "stop"
        ? await store.stopService({ reason: body.reason, note: body.note }, writeContextFor(actor, body.idempotencyKey))
        : await store.approveServiceRestart({ role: body.role }, writeContextFor(actor, body.idempotencyKey));
    if (!result.ok) return result;
    return { ok: true, value: narrowServiceStateForActor(result.value, actor) };
  },
});
