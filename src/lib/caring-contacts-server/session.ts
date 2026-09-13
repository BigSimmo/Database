// src/lib/caring-contacts-server/session.ts
//
// The demo role switcher. The decision lock requires WA Health enterprise sign-on and states that
// no Caring-Contacts-local credentials exist, so this is deliberately NOT a login and must never
// look like one -- it is a role switcher, labelled as one, that exists because the permission and
// auditor surfaces cannot be demonstrated without it.
//
// The cookie it reads holds only a role name, never a credential. Anything unreadable -- no
// cookie, an empty value, a name that is not one of DEMO_ROLES -- falls back to the coordinator
// rather than throwing: an unreadable cookie must never lock someone out of a demonstration.
//
// Production sovereign deployments may open the workspace when a session HMAC secret is
// configured (`CARING_CONTACTS_SESSION_HMAC_SECRET`). That secret gates the demo/live env flags;
// it does not authenticate a human. Demo staging sets `CARING_CONTACTS_DEMO_ENABLED=true` and
// still uses forgeable/default demo role actors (HMAC only stops offline role-cookie forgery).
// Live mode sets the flag to `false`, requires a signed production session cookie, and requires
// pilot governance attestation at boot (see instrumentation.register). Demo mode must not bind
// to CARING_CONTACTS_DATABASE_URL (store refuses that pairing).
import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { actorId, teamId, type TeamId } from "@/lib/caring-contacts/ids";
import type { Actor, CaringContactRole, SystemActor } from "@/lib/caring-contacts/permissions";

export const CARING_CONTACTS_ROLE_COOKIE = "caring-contacts-demo-role";
export const CARING_CONTACTS_PRODUCTION_SESSION_COOKIE = "caring-contacts-production-session";
export const CARING_CONTACTS_SESSION_HMAC_SECRET_VAR = "CARING_CONTACTS_SESSION_HMAC_SECRET";
export const CARING_CONTACTS_DEMO_ENABLED_VAR = "CARING_CONTACTS_DEMO_ENABLED";
export const CARING_CONTACTS_DATABASE_URL_VAR = "CARING_CONTACTS_DATABASE_URL";

/**
 * The role switcher is a development/test demonstration aid, not authentication.
 *
 * A caller can forge a role-only cookie outside a browser, so `httpOnly` is not
 * an authorization boundary. Until enterprise authentication supplies a real
 * actor, Caring Contacts routes must fail closed in production — with:
 *   1. the isolated Playwright exception (unchanged), and
 *   2. the sovereign demo path: `CARING_CONTACTS_DEMO_ENABLED=true` PLUS a
 *      configured session HMAC secret, with role cookies signed by that secret.
 *      Signing is integrity for the role cookie only — not proof of identity. Missing/invalid
 *      cookies still default to coordinator; POST /session issues signed roles without client proof.
 */
export function isCaringContactsDemoEnabled(
  environment = process.env.NODE_ENV,
  // Same shape `shouldBlockProductionMockups` uses for the same reason: `process.env`
  // is an index signature, so a named-optional type is rejected as a weak type.
  runtime: Record<string, string | undefined> = process.env,
): boolean {
  if (environment !== "production") return true;

  // The single Playwright exception, and it is the same one `shouldBlockProductionMockups`
  // (src/proxy.ts) already makes for /mockups: the repository-owned isolated
  // Playwright server builds a real production app so the browser gate tests what
  // ships. Both flags are required; instrumentation refuses any other production
  // process carrying NEXT_PUBLIC_DEMO_MODE.
  if (runtime.PLAYWRIGHT_OFFLINE_MODE === "true" && runtime.NEXT_PUBLIC_DEMO_MODE === "true") {
    return true;
  }

  // Sovereign staging / clinical-simulation path. The HMAC secret is required before the
  // demo flag can open the workspace, but it is not human authentication: demo actors remain
  // forgeable/defaulted. Without the secret the flag is ignored.
  return runtime[CARING_CONTACTS_DEMO_ENABLED_VAR] === "true" && hasProductionSessionSecret(runtime);
}

/**
 * Live (non-demo) sovereign mode: demo explicitly disabled, a session HMAC
 * secret configured, AND the dedicated Caring Contacts database URL present.
 * Without `CARING_CONTACTS_DATABASE_URL` the store factory would fall back to
 * an in-memory repository, so real-patient writes could appear to succeed and
 * then vanish on restart — live mode therefore fails closed without it.
 * Actor resolution uses the signed production session cookie, not the
 * forgeable demo role cookie. Pilot governance attestation is enforced at boot
 * by instrumentation.register when this mode is active.
 */
export function isCaringContactsLiveEnabled(
  environment = process.env.NODE_ENV,
  runtime: Record<string, string | undefined> = process.env,
): boolean {
  if (environment !== "production") return false;
  return (
    runtime[CARING_CONTACTS_DEMO_ENABLED_VAR] === "false" &&
    hasProductionSessionSecret(runtime) &&
    Boolean(runtime[CARING_CONTACTS_DATABASE_URL_VAR]?.trim())
  );
}

/** True when any Caring Contacts page or API may serve (demo, live, or non-production). */
export function isCaringContactsWorkspaceEnabled(
  environment = process.env.NODE_ENV,
  runtime: Record<string, string | undefined> = process.env,
): boolean {
  return isCaringContactsDemoEnabled(environment, runtime) || isCaringContactsLiveEnabled(environment, runtime);
}

export function hasProductionSessionSecret(runtime: Record<string, string | undefined> = process.env): boolean {
  return Boolean(runtime[CARING_CONTACTS_SESSION_HMAC_SECRET_VAR]?.trim());
}

export function productionSessionSecret(runtime: Record<string, string | undefined> = process.env): string | null {
  const value = runtime[CARING_CONTACTS_SESSION_HMAC_SECRET_VAR]?.trim();
  return value ? value : null;
}

/** Thrown when code tries to resolve a demo actor in a production process. */
export class CaringContactsDemoUnavailableError extends Error {
  constructor() {
    super("Caring Contacts demo actors are unavailable in production.");
    this.name = "CaringContactsDemoUnavailableError";
  }
}

/** Thrown when live mode cannot resolve a signed production session. */
export class CaringContactsProductionSessionError extends Error {
  constructor(message = "Caring Contacts production session is unavailable.") {
    super(message);
    this.name = "CaringContactsProductionSessionError";
  }
}

/** All five roles, in the order the switcher offers them. */
export const DEMO_ROLES: readonly CaringContactRole[] = Object.freeze([
  "coordinator",
  "teamLead",
  "auditor",
  "clinicalProgrammeLead",
  "livedExperienceRepresentative",
]);

const DEFAULT_DEMO_ROLE: CaringContactRole = "coordinator";

/** The one team every demo actor belongs to -- there is no multi-team demo. */
export const DEMO_TEAM_ID: TeamId = teamId("demo-team");

/** True for a value that names one of DEMO_ROLES. Exported so the route handler validates
 * against the same list this module resolves against, rather than a second copy that could drift. */
export function isDemoRole(value: unknown): value is CaringContactRole {
  return typeof value === "string" && (DEMO_ROLES as readonly string[]).includes(value);
}

/** The actor id names the acting role, e.g. `demo-auditor`, so the audit trail can show it. */
export function demoActorForRole(role: CaringContactRole): Actor {
  return { id: actorId(`demo-${role}`), teamId: DEMO_TEAM_ID, roles: [role] };
}

/**
 * The system actor demo contact-dispatch writes are attributed to.
 *
 * `SystemActor` exists in `./permissions` for one reason: a contact's provider status is written
 * by the dispatcher and by nothing else, so software needs an attributable, non-human author for
 * that write. `contactDispatcher`'s grant table and every human role's grant table never overlap
 * (pinned by a permissions test), so this actor can never acquire a human capability and no human
 * demo role can ever acquire this one -- a coordinator cannot be handed `startContactDispatch`
 * just because the population needs a few contacts to look attempted. The demo population's own
 * dispatch writes go through this actor for exactly the same reason the real dispatcher would.
 */
export function demoSystemDispatcher(): SystemActor {
  return { id: actorId("demo-system-dispatcher"), teamId: DEMO_TEAM_ID, systemRole: "contactDispatcher" };
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function signaturesMatch(expected: string, provided: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Signs a demo role for production sovereign demo mode. */
export function signDemoRoleCookie(role: CaringContactRole, secret: string): string {
  const signature = signPayload(`role:${role}`, secret);
  return `${role}.${signature}`;
}

/** Parses a demo role cookie, verifying the HMAC when a production session secret is configured. */
export function parseDemoRoleCookieValue(
  raw: string | undefined,
  runtime: Record<string, string | undefined> = process.env,
): CaringContactRole {
  if (!raw) return DEFAULT_DEMO_ROLE;
  const secret = productionSessionSecret(runtime);
  if (!secret) {
    // Non-production (or Playwright) path: unsigned role name is accepted.
    return isDemoRole(raw) ? raw : DEFAULT_DEMO_ROLE;
  }
  const separator = raw.lastIndexOf(".");
  if (separator <= 0) return DEFAULT_DEMO_ROLE;
  const role = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);
  if (!isDemoRole(role)) return DEFAULT_DEMO_ROLE;
  const expected = signPayload(`role:${role}`, secret);
  return signaturesMatch(expected, signature) ? role : DEFAULT_DEMO_ROLE;
}

export type ProductionSessionClaims = {
  actorId: string;
  teamId: string;
  roles: CaringContactRole[];
  exp: number;
};

/** Issues a signed production session cookie value for live sovereign mode. */
export function signProductionSession(claims: ProductionSessionClaims, secret: string): string {
  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  const signature = signPayload(payload, secret);
  return `v1.${payload}.${signature}`;
}

export function parseProductionSessionCookieValue(
  raw: string | undefined,
  runtime: Record<string, string | undefined> = process.env,
  nowMs = Date.now(),
): Actor | null {
  if (!raw) return null;
  const secret = productionSessionSecret(runtime);
  if (!secret) return null;
  const parts = raw.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const [, payload, signature] = parts;
  const expected = signPayload(payload, secret);
  if (!signaturesMatch(expected, signature)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<ProductionSessionClaims>;
    if (!claims.actorId || !claims.teamId || !Array.isArray(claims.roles) || typeof claims.exp !== "number") {
      return null;
    }
    if (claims.exp * 1000 < nowMs) return null;
    const roles = claims.roles.filter(isDemoRole);
    if (roles.length === 0) return null;
    return { id: actorId(claims.actorId), teamId: teamId(claims.teamId), roles };
  } catch {
    return null;
  }
}

/**
 * Reads the demo role cookie and resolves the actor it names. Falls back to the coordinator for
 * anything unreadable rather than throwing -- see the module note above. That includes the read
 * itself failing (`cookies()` rejecting, or `.get()` throwing), not only an unrecognised value:
 * a caller that let either propagate would produce exactly the locked-out-of-a-demonstration
 * outcome this fallback exists to prevent.
 */
export async function resolveDemoActor(): Promise<Actor> {
  if (!isCaringContactsDemoEnabled()) throw new CaringContactsDemoUnavailableError();
  const role = await readDemoRoleCookie();
  return demoActorForRole(role);
}

/** Resolves the live sovereign actor from the signed production session cookie. */
export async function resolveProductionActor(): Promise<Actor> {
  if (!isCaringContactsLiveEnabled()) {
    throw new CaringContactsProductionSessionError("Caring Contacts live mode is not enabled.");
  }
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(CARING_CONTACTS_PRODUCTION_SESSION_COOKIE)?.value;
    const actor = parseProductionSessionCookieValue(raw);
    if (!actor) {
      throw new CaringContactsProductionSessionError(
        "Caring Contacts live mode requires a signed production session cookie issued by enterprise SSO.",
      );
    }
    return actor;
  } catch (error) {
    if (error instanceof CaringContactsProductionSessionError) throw error;
    throw new CaringContactsProductionSessionError("Caring Contacts production session cookie could not be read.");
  }
}

/** Resolves the acting actor for whichever workspace mode is enabled. */
export async function resolveCaringContactsActor(): Promise<Actor> {
  if (isCaringContactsDemoEnabled()) return resolveDemoActor();
  if (isCaringContactsLiveEnabled()) return resolveProductionActor();
  throw new CaringContactsDemoUnavailableError();
}

async function readDemoRoleCookie(): Promise<CaringContactRole> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(CARING_CONTACTS_ROLE_COOKIE)?.value;
    return parseDemoRoleCookieValue(raw);
  } catch {
    return DEFAULT_DEMO_ROLE;
  }
}
