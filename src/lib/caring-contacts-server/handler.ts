// src/lib/caring-contacts-server/handler.ts
//
// The API boundary every caring-contact route goes through, and the reason Phase 1's first open
// item -- "reads are not audited" -- closes here rather than in a store.
//
// A read is only observable where it crosses a boundary. Inside a store, `getPlan` is a map lookup
// that nobody asked for on anybody's behalf; at this seam it is a named actor viewing a named
// object at a known instant, which is exactly what spec 4.2 requires the trail to hold. So
// `recordAccess` lives in `readHandler` and NOWHERE ELSE. A route that could forget the call is
// the failure mode this module exists to remove: routes describe what to read, they never decide
// whether the read is recorded.
//
// Two rules the handlers implement that are easy to lose in a later edit:
//   * an access event is recorded on EVERY read, including a denied one (`outcome: "denied"`), and
//     a read whose event could not be recorded releases nothing at all -- the same bargain the
//     store already makes for writes, where a change whose audit record cannot be produced does
//     not happen either;
//   * a refusal body is always `{ refusal: string }` and never carries patient data. The refusal
//     name is a machine-readable reason from the domain, never a message assembled from a record.
//
// Neither handler re-derives a rule the sealed domain owns. `writeHandler` asks
// `canPerformCaringContactAction` for the capability decision and the store for everything else;
// it never decides for itself what a role may do.
import "server-only";

import type { NextRequest } from "next/server";
import { z, type ZodType } from "zod";

import { PublicApiError } from "@/lib/http";
import {
  isAccessObjectIdShape,
  type AccessedObjectType,
  type AccessKind,
  type AccessRecord,
} from "@/lib/caring-contacts/access-audit";
import type { AuditOutcome } from "@/lib/caring-contacts/audit";
import { idempotencyKey } from "@/lib/caring-contacts/ids";
import type { TransitionResult } from "@/lib/caring-contacts/model";
import {
  actorRoleNames,
  canPerformCaringContactAction,
  type Actor,
  type CaringContactAction,
} from "@/lib/caring-contacts/permissions";
import type { CaringContactRepository, WriteContext } from "@/lib/caring-contacts/repository";
import { parseJsonBody } from "@/lib/validation/body";

import { resolveDemoActor } from "./session";
import { caringContactsStore } from "./store";

/**
 * Named refusal to HTTP status. Every refusal not named here is 422: an unprocessable request the
 * domain refused for a stated reason. Deliberately a lookup rather than a chain of conditionals so
 * a new refusal name is a one-line addition and an unmapped one degrades to the safe default.
 *
 * `cross-team-denied`, `action-not-granted`, and `no-roles` are the three reasons
 * `canPerformCaringContactAction` gives; they join the store's own `permission-denied` on 403.
 */
// Null-prototype: a plain object literal would answer `REFUSAL_STATUS["constructor"]` with an
// inherited function instead of falling through to the 422 default. Unreachable from any refusal
// name the domain mints, and removed as a class rather than reasoned about again.
const REFUSAL_STATUS: Readonly<Record<string, number>> = Object.freeze(
  Object.assign(Object.create(null) as Record<string, number>, {
    "not-found": 404,
    "permission-denied": 403,
    "cross-team-denied": 403,
    "action-not-granted": 403,
    "no-roles": 403,
    "stale-version": 409,
    "duplicate-active-plan": 409,
    "plan-already-exists": 409,
    "idempotency-key-reused-for-a-different-write": 409,
    // Ruling 49: a duplicate identifier is a conflict of exactly the kind the three refusals above
    // describe. The brief's list named the refusals that existed when it was written; treating a
    // fourth and fifth of the same kind differently would make these status codes describe the
    // plan's drafting history rather than the actual condition.
    "referral-already-exists": 409,
    "pathway-version-already-exists": 409,
    // 423 Locked: the service-wide safety stop is a deliberate hold on this resource, not a fault
    // and not a permission problem. It clears when three distinct roles approve the restart.
    "service-stopped": 423,
  }),
);

const UNPROCESSABLE = 422;

function refusalStatus(refusal: string): number {
  return REFUSAL_STATUS[refusal] ?? UNPROCESSABLE;
}

/** Every response this boundary produces is `no-store`. Nothing here is ever cacheable. */
function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function refusalResponse(refusal: string): Response {
  return jsonResponse({ refusal }, refusalStatus(refusal));
}

/**
 * A body that does not parse. 400 rather than a mapped refusal: the domain refused nothing, the
 * request never became one. Nothing of the submitted body is echoed back.
 */
export function invalidRequestResponse(): Response {
  return jsonResponse({ refusal: "invalid-request" }, 400);
}

/**
 * Every write carries an idempotency key -- the store contract's first rule, so that a retried
 * request can never send a second caring contact. Every write route therefore REQUIRES one in the
 * body rather than deriving a default: a key derived from the request's identifiers cannot capture
 * a body that also carries free text (an incident note, a decline reason), so two genuinely
 * different writes would collide on one key and be refused as a replay of each other. Only the
 * caller knows whether this request is a retry of the last one.
 */
/**
 * Any request field that becomes an audit `objectId` -- or an identifier of any kind. Constrained
 * to the audit trail's own id grammar so free text is refused with a clean 400 at the edge rather
 * than travelling into the audit path, where it would be rejected too late to matter. Never use it
 * for a field that legitimately holds free text (an incident note, a decline reason): those are
 * body-only and never reach an audit event.
 */
export const auditableIdentifier = z
  .string()
  .refine(isAccessObjectIdShape, { message: "must be an identifier, not free text" });

export function writeContextFor(actor: Actor, key: string): WriteContext {
  return { actor, idempotencyKey: idempotencyKey(key) };
}

export type ReadHandlerConfig<T> = {
  access: {
    kind: AccessKind;
    objectType: AccessedObjectType;
    /** Identifier-shaped, never a name or a search term -- `buildAccessAuditEvent` enforces that. */
    objectId: (request: NextRequest) => string;
  };
  read: (store: CaringContactRepository, actor: Actor, request: NextRequest) => Promise<T>;
};

/**
 * A read that is audited whether or not it succeeds.
 *
 * What counts as denied: the stores answer a read the actor may not make with `null`, exactly as
 * they answer a read of something that does not exist -- deliberately, so a cross-team actor
 * cannot tell those apart. This boundary can therefore observe only whether anything was
 * released, and records `denied` when nothing was. A list read that comes back empty is recorded
 * as `allowed`, because an empty list IS what was released; that is the one case where the trail
 * cannot distinguish "you may not see these" from "there are none", and it is a consequence of the
 * store contract's own indistinguishability rule rather than something this seam could recover.
 */
export function readHandler<T>(config: ReadHandlerConfig<T>): (request: NextRequest) => Promise<Response> {
  return async (request: NextRequest): Promise<Response> => {
    const actor = await resolveDemoActor();
    const store = await caringContactsStore();
    const objectId = config.access.objectId(request);

    let released: T | null = null;
    let outcome: AuditOutcome;
    try {
      released = await config.read(store, actor, request);
      outcome = released === null || released === undefined ? "denied" : "allowed";
    } catch {
      outcome = "failed";
    }

    const recorded = await recordAccessAttempt(store, actor, config.access, objectId, outcome);
    // A read nobody can prove happened is worse than a read refused. If the trail could not take
    // the event, the boundary releases nothing -- the same bargain the store makes for writes.
    if (!recorded) return jsonResponse({ refusal: "access-audit-unavailable" }, 503);

    if (outcome === "failed") return jsonResponse({ refusal: "read-failed" }, 500);
    if (outcome === "denied") return refusalResponse("not-found");
    return jsonResponse(released, 200);
  };
}

async function recordAccessAttempt(
  store: CaringContactRepository,
  actor: Actor,
  access: { kind: AccessKind; objectType: AccessedObjectType },
  objectId: string,
  outcome: AuditOutcome,
): Promise<boolean> {
  // Belt to the route schemas' braces. `buildAccessAuditEvent` rejects an objectId outside its id
  // grammar, and both callers here treat a failed record as non-fatal -- so an identifier nobody
  // anticipated could otherwise cost the trail the whole event. Substituting the bare object-type
  // name (a shape that module's own allowlist documents as legitimate) keeps the event: who,
  // what kind of object, which outcome, and when. The rejected value is never recorded anywhere,
  // because free text is exactly what it might be.
  const safeObjectId = isAccessObjectIdShape(objectId) ? objectId : access.objectType;

  const record: AccessRecord = {
    actorId: actor.id,
    actorRoles: actorRoleNames(actor),
    teamId: actor.teamId,
    kind: access.kind,
    objectType: access.objectType,
    objectId: safeObjectId,
    outcome,
  };
  try {
    await store.recordAccess(record);
    return true;
  } catch {
    return false;
  }
}

export type WriteHandlerConfig<TBody, TResult> = {
  schema: ZodType<TBody>;
  /**
   * The capability this write needs.
   *
   * A function where the action depends on the request -- a referral transition needs
   * `acceptReferral`, `returnReferralForClarification`, or `declineReferral` depending on which
   * transition was asked for, and the store checks exactly that action. A fixed action for every
   * other route. Resolving it from the parsed body keeps the boundary's check identical to the
   * store's rather than approximating it with whichever action happens to be the broadest.
   */
  action: CaringContactAction | ((body: TBody) => CaringContactAction);
  /**
   * What this write acts on. Used ONLY to record a denial the boundary itself made -- a write that
   * reaches the store is audited there, from the store's own knowledge of the object.
   */
  access: { objectType: AccessedObjectType; objectId: (body: TBody) => string };
  write: (store: CaringContactRepository, actor: Actor, body: TBody) => Promise<TransitionResult<TResult>>;
};

/**
 * A write that parses, checks the capability, and names the reason when it refuses.
 *
 * The capability check is here rather than left to the store because the store answers every
 * permission failure with the single reason `permission-denied`, and the elevation brief requires
 * a denial to say WHY -- `action-not-granted` and `no-roles` are different facts to the person
 * reading the screen. The check is the sealed `canPerformCaringContactAction`; this module holds
 * no grant table of its own.
 *
 * The resource is always the ACTOR'S OWN team, so `cross-team-denied` is not reachable from here
 * and this boundary never distinguishes a cross-team write. That is deliberate, not an omission:
 * the stores answer a write against another team's record with `not-found`, so that a cross-team
 * actor cannot learn the record exists, and a boundary that answered "wrong team" would give away
 * the very thing the store withholds.
 */
export function writeHandler<TBody, TResult>(
  config: WriteHandlerConfig<TBody, TResult>,
): (request: NextRequest) => Promise<Response> {
  return async (request: NextRequest): Promise<Response> => {
    let body: TBody;
    try {
      body = await parseJsonBody(request, config.schema);
    } catch (error) {
      // Only ever a client mistake: a body that does not parse, or one over the shared size limit.
      // The reason is named, and nothing of the submitted body is echoed back.
      if (error instanceof PublicApiError && error.status === 413) {
        return jsonResponse({ refusal: "request-body-too-large" }, 413);
      }
      return invalidRequestResponse();
    }

    const actor = await resolveDemoActor();
    const action = typeof config.action === "function" ? config.action(body) : config.action;
    const decision = canPerformCaringContactAction(actor, action, { teamId: actor.teamId });
    const store = await caringContactsStore();

    if (!decision.allowed) {
      // Recorded HERE and only here. A write refused at this boundary never reaches the store, so
      // `runWrite` never runs and the attempt would otherwise leave no trace at all. A write that
      // IS allowed through is deliberately not recorded here: the store audits it, and recording
      // both would count one attempt twice. The asymmetry is the point, not an oversight.
      //
      // The invariant in full: EVERY WRITE ATTEMPT PRODUCES EXACTLY ONE AUDIT EVENT, AND A REPLAY
      // OF AN ALREADY-RECORDED ATTEMPT PRODUCES NONE. The replay half belongs to the store --
      // `runWrite` returns the cached result before building an event -- and is right: a retry of
      // a request already in the trail is not a second attempt at anything.
      //
      // The result is ignored on purpose. `recordAccess` must not be blockable (see its contract),
      // and a trail that cannot take the event must not turn a denial into something else: the
      // caller is refused either way.
      await recordAccessAttempt(
        store,
        actor,
        { kind: "mutation", objectType: config.access.objectType },
        config.access.objectId(body),
        "denied",
      );
      return refusalResponse(decision.reason);
    }

    const result = await config.write(store, actor, body);
    if (!result.ok) return refusalResponse(result.reason);
    return jsonResponse({ value: result.value ?? null }, 200);
  };
}
