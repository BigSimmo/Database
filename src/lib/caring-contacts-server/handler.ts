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
import type { ZodType } from "zod";

import { PublicApiError } from "@/lib/http";
import type { AccessedObjectType, AccessKind, AccessRecord } from "@/lib/caring-contacts/access-audit";
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
const REFUSAL_STATUS: Readonly<Record<string, number>> = Object.freeze({
  "not-found": 404,
  "permission-denied": 403,
  "cross-team-denied": 403,
  "action-not-granted": 403,
  "no-roles": 403,
  "stale-version": 409,
  "duplicate-active-plan": 409,
  "plan-already-exists": 409,
  "idempotency-key-reused-for-a-different-write": 409,
  // 423 Locked: the service-wide safety stop is a deliberate hold on this resource, not a fault
  // and not a permission problem. It clears when three distinct roles approve the restart.
  "service-stopped": 423,
});

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
  access: ReadHandlerConfig<unknown>["access"],
  objectId: string,
  outcome: AuditOutcome,
): Promise<boolean> {
  const record: AccessRecord = {
    actorId: actor.id,
    actorRoles: actorRoleNames(actor),
    teamId: actor.teamId,
    kind: access.kind,
    objectType: access.objectType,
    objectId,
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
  write: (store: CaringContactRepository, actor: Actor, body: TBody) => Promise<TransitionResult<TResult>>;
};

/**
 * A write that parses, checks the capability, and names the reason when it refuses.
 *
 * The capability check is here rather than left to the store because the store answers every
 * permission failure with the single reason `permission-denied`, and the elevation brief requires
 * a denial to say WHY -- `cross-team-denied` and `action-not-granted` are different facts to the
 * person reading the screen. The check is the sealed `canPerformCaringContactAction`; this module
 * holds no grant table of its own.
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
    if (!decision.allowed) return refusalResponse(decision.reason);

    const store = await caringContactsStore();
    const result = await config.write(store, actor, body);
    if (!result.ok) return refusalResponse(result.reason);
    return jsonResponse({ value: result.value ?? null }, 200);
  };
}
