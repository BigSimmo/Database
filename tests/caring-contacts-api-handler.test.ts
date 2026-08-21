// tests/caring-contacts-api-handler.test.ts
//
// The API boundary. Phase 1 left "reads are not audited" open because a read is only observable
// where it crosses a boundary, and until Task 14 there was no boundary to observe it at. These
// tests are written against that boundary rather than against the stores, because the property
// being proved -- an access event exists for EVERY read, allowed or denied -- is a property of the
// seam, not of either store.
//
// The store and the demo-role cookie are both replaced here: `caringContactsStore()` is memoised
// at module scope in production (deliberately -- see store.ts), so a test that used the real one
// would share a single in-memory workspace across every case in this file.
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mocks = vi.hoisted(() => ({ store: { current: null as unknown } }));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: (name: string) => mockCookies[name] })),
}));

vi.mock("@/lib/caring-contacts-server/store", () => ({
  caringContactsStore: async () => mocks.store.current,
}));

import { readHandler, writeHandler } from "@/lib/caring-contacts-server/handler";
import { narrowServiceStateForActor, type ServiceStateView } from "@/lib/caring-contacts-server/service-state-view";
import { CARING_CONTACTS_ROLE_COOKIE, DEMO_TEAM_ID, demoActorForRole } from "@/lib/caring-contacts-server/session";
import type { AccessRecord } from "@/lib/caring-contacts/access-audit";
import { fixedClock } from "@/lib/caring-contacts/clock";
import {
  actorId,
  idempotencyKey,
  pathwayVersionId,
  patientId,
  planId,
  referralId,
  teamId,
} from "@/lib/caring-contacts/ids";
import { createInMemoryRepository } from "@/lib/caring-contacts/in-memory-repository";
import type { Actor, CaringContactRole } from "@/lib/caring-contacts/permissions";
import type { CaringContactRepository } from "@/lib/caring-contacts/repository";
import type { ServiceState } from "@/lib/caring-contacts/service-state";

let mockCookies: Record<string, { value: string } | undefined> = {};

const PLAN_ID = planId("SYN-PLAN-001");

/**
 * Synthetic throughout. The name and mobile number are the exact strings the "no patient data in a
 * refusal body" assertion looks for, so a handler that echoed the record it refused to act on
 * would be caught rather than merely suspected.
 */
const PATIENT_DETAIL = {
  patientName: "Rowan Mira Delacroix",
  patientMobileNumber: "+61 491 570 156",
  patientIdentifiers: ["UR-00219384"],
  culturalIdentity: null,
};

/** 2026-03-02 10:00 AWST discharge, read at 11:00 AWST -- the same instants the store contract uses. */
const DISCHARGE_AT = new Date("2026-03-02T02:00:00.000Z");
const NOW = "2026-03-02T03:00:00.000Z";

type Spied = { store: CaringContactRepository; recorded: () => AccessRecord[] };

/**
 * A fresh in-memory store holding one active plan, wired in behind `caringContactsStore()`, with
 * every `recordAccess` call captured. `actorRole` sets the demo cookie, which is the only thing
 * `resolveDemoActor()` reads.
 */
async function inMemoryStoreWithSpy(options: { actorRole?: CaringContactRole } = {}): Promise<Spied> {
  const role = options.actorRole ?? "coordinator";
  mockCookies = { [CARING_CONTACTS_ROLE_COOKIE]: { value: role } };

  const repository = createInMemoryRepository(fixedClock(NOW));
  const records: AccessRecord[] = [];
  const store: CaringContactRepository = {
    ...repository,
    async recordAccess(record: AccessRecord) {
      // The real store first, then the spy: `records` must mean "entered the trail", not "was
      // offered to it". Recording the attempt would have made the spy agree with a handler that
      // built an event the trail then rejected -- the exact defect fix round 1 Important 1 fixed.
      await repository.recordAccess(record);
      records.push(record);
    },
  };

  const coordinator = demoActorForRole("coordinator");
  const created = await store.createPlan(
    {
      planId: PLAN_ID,
      referralId: referralId("SYN-REFERRAL-001"),
      patientId: patientId("SYN-PATIENT-001"),
      pathwayVersionId: pathwayVersionId("SYN-PATHWAY-001"),
      dischargeAt: DISCHARGE_AT,
      sendingPreference: "morning",
      patientDetail: PATIENT_DETAIL,
    },
    { actor: coordinator, idempotencyKey: idempotencyKey("seed-create") },
  );
  if (!created.ok) throw new Error(`seed createPlan refused: ${created.reason}`);
  const activated = await store.activatePlan(
    { planId: PLAN_ID, expectedVersion: created.value.plan.version },
    { actor: coordinator, idempotencyKey: idempotencyKey("seed-activate") },
  );
  if (!activated.ok) throw new Error(`seed activatePlan refused: ${activated.reason}`);

  mocks.store.current = store;
  return { store, recorded: () => records };
}

function get(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`);
}

function post(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, { method: "POST", body: JSON.stringify(body) });
}

/** Stops the service, then attempts a pause of the seeded plan through the real plan route. */
async function pauseThroughHandler(): Promise<Response> {
  const { store } = await inMemoryStoreWithSpy();
  const stopped = await store.stopService(
    // The note is exactly the leak this whole task narrows: free text a responder writes
    // mid-incident, naming the patient involved.
    { reason: "wrong-recipient", note: "Message for Rowan Mira Delacroix reached +61 491 570 156." },
    { actor: demoActorForRole("coordinator"), idempotencyKey: idempotencyKey("seed-stop") },
  );
  if (!stopped.ok) throw new Error(`seed stopService refused: ${stopped.reason}`);

  const { POST } = await import("@/app/api/caring-contacts/plans/[planId]/route");
  return POST(
    post("/api/caring-contacts/plans/SYN-PLAN-001", {
      action: "pause",
      expectedVersion: 2,
      idempotencyKey: "pause-1",
    }),
    {
      params: Promise.resolve({ planId: "SYN-PLAN-001" }),
    },
  );
}

beforeEach(() => {
  mockCookies = {};
  mocks.store.current = null;
});

describe("caring-contacts API boundary", () => {
  it("records an access event for a successful read", async () => {
    const { recorded } = await inMemoryStoreWithSpy();
    const handler = readHandler({
      access: { kind: "view", objectType: "plan", objectId: () => "SYN-PLAN-001" },
      read: async (repository, actor) => repository.getPlan(PLAN_ID, { actor }),
    });

    const response = await handler(get("/api/caring-contacts/plans/SYN-PLAN-001"));

    expect(response.status).toBe(200);
    expect(recorded()).toContainEqual(
      expect.objectContaining({ kind: "view", objectType: "plan", outcome: "allowed" }),
    );
  });

  it("records an access event even when the read is denied", async () => {
    // The auditor may read the access trail and nothing else: `getEpisode` needs
    // generateClinicalRecordSummary, which the auditor does not hold, so the store returns null.
    const { recorded } = await inMemoryStoreWithSpy({ actorRole: "auditor" });
    const handler = readHandler({
      access: { kind: "view", objectType: "episode", objectId: () => "SYN-PLAN-001" },
      read: async (repository, actor) => repository.getEpisode(PLAN_ID, { actor }),
    });

    const response = await handler(get("/api/caring-contacts/episodes/SYN-PLAN-001"));

    expect(response.status).toBe(404);
    expect(recorded()).toContainEqual(expect.objectContaining({ outcome: "denied" }));
  });

  it("names the acting actor and team on the access event, so the trail can be read back", async () => {
    const { recorded } = await inMemoryStoreWithSpy({ actorRole: "teamLead" });
    const handler = readHandler({
      access: { kind: "view", objectType: "plan", objectId: () => "SYN-PLAN-001" },
      read: async (repository, actor) => repository.getPlan(PLAN_ID, { actor }),
    });

    await handler(get("/api/caring-contacts/plans/SYN-PLAN-001"));

    expect(recorded()).toContainEqual(
      expect.objectContaining({ actorId: actorId("demo-teamLead"), teamId: DEMO_TEAM_ID, actorRoles: ["teamLead"] }),
    );
  });

  it("returns the named denial reason so the interface can explain itself", async () => {
    await inMemoryStoreWithSpy();
    const handler = writeHandler({
      schema: z.object({ planId: z.string() }),
      action: "publishPathwayVersion",
      access: { objectType: "pathwayVersion", objectId: () => "SYN-PATHWAY-001" },
      write: async () => ({ ok: true, value: null }),
    });

    const response = await handler(post("/api/caring-contacts/pathway-versions", { planId: "SYN-PLAN-001" }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ refusal: "action-not-granted" });
  });

  it("never reaches the write when the capability check denies it", async () => {
    await inMemoryStoreWithSpy();
    const write = vi.fn(async () => ({ ok: true as const, value: null }));
    const handler = writeHandler({
      schema: z.object({}),
      action: "publishPathwayVersion",
      access: { objectType: "pathwayVersion", objectId: () => "SYN-PATHWAY-001" },
      write,
    });

    await handler(post("/api/caring-contacts/pathway-versions", {}));

    expect(write).not.toHaveBeenCalled();
  });

  it("returns 423 and refuses a write while the service is stopped", async () => {
    expect((await pauseThroughHandler()).status).toBe(423);
  });

  it("never returns patient data in a refusal body", async () => {
    const response = await pauseThroughHandler();
    const body = await response.text();
    expect(body).toContain("service-stopped");
    expect(body).not.toMatch(/Rowan|Mira|\+61/);
  });

  it("refuses a body that does not parse, without leaking an internal error", async () => {
    await inMemoryStoreWithSpy();
    const handler = writeHandler({
      schema: z.object({ expectedVersion: z.number() }),
      action: "pausePlan",
      access: { objectType: "plan", objectId: () => "SYN-PLAN-001" },
      write: async () => ({ ok: true, value: null }),
    });

    const response = await handler(post("/api/caring-contacts/plans/SYN-PLAN-001", { expectedVersion: "two" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ refusal: "invalid-request" });
  });

  it("maps a stale version to 409 rather than to the catch-all", async () => {
    const { store } = await inMemoryStoreWithSpy();
    const { POST } = await import("@/app/api/caring-contacts/plans/[planId]/route");

    const response = await POST(
      post("/api/caring-contacts/plans/SYN-PLAN-001", {
        action: "pause",
        expectedVersion: 99,
        idempotencyKey: "pause-stale",
      }),
      { params: Promise.resolve({ planId: "SYN-PLAN-001" }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ refusal: "stale-version" });
    expect((await store.getPlan(PLAN_ID, { actor: demoActorForRole("coordinator") }))?.plan.state).toBe("active");
  });

  it("marks every response no-store, allowed and refused alike", async () => {
    await inMemoryStoreWithSpy();
    const allowed = readHandler({
      access: { kind: "view", objectType: "plan", objectId: () => "SYN-PLAN-001" },
      read: async (repository, actor) => repository.getPlan(PLAN_ID, { actor }),
    });
    const readResponse = await allowed(get("/api/caring-contacts/plans/SYN-PLAN-001"));
    const refusedResponse = await pauseThroughHandler();

    expect(readResponse.headers.get("cache-control")).toContain("no-store");
    expect(refusedResponse.headers.get("cache-control")).toContain("no-store");
  });

  // Ruling 45. Before it, a write refused by the capability check never reached the store, so
  // `runWrite` never ran and the attempt left no trace at all -- the one gap in "every mutation".
  it("produces exactly one audit event for every write attempt through the boundary, whichever way it goes", async () => {
    const { store, recorded } = await inMemoryStoreWithSpy();
    const auditor = demoActorForRole("auditor");
    const before = (await store.listAuditEvents({ actor: auditor })).length;

    // Denied at the boundary: the coordinator does not hold `publishPathwayVersion`.
    const { POST: publish } = await import("@/app/api/caring-contacts/pathway-versions/route");
    const denied = await publish(
      post("/api/caring-contacts/pathway-versions", {
        pathwayVersionId: "SYN-PATHWAY-001",
        action: { type: "publish" },
        idempotencyKey: "publish-1",
      }),
    );

    expect(denied.status).toBe(403);
    expect(recorded()).toEqual([
      expect.objectContaining({ kind: "mutation", objectType: "pathwayVersion", outcome: "denied" }),
    ]);
    expect(await store.listAuditEvents({ actor: auditor })).toHaveLength(before + 1);

    // Allowed at the boundary: the store audits it, and the boundary adds nothing of its own.
    const { POST: lifecycle } = await import("@/app/api/caring-contacts/plans/[planId]/route");
    const allowed = await lifecycle(
      post("/api/caring-contacts/plans/SYN-PLAN-001", {
        action: "pause",
        expectedVersion: 2,
        idempotencyKey: "pause-invariant",
      }),
      { params: Promise.resolve({ planId: "SYN-PLAN-001" }) },
    );

    expect(allowed.status).toBe(200);
    expect(recorded()).toHaveLength(1);
    expect(await store.listAuditEvents({ actor: auditor })).toHaveLength(before + 2);
  });

  it("still refuses the write when the denial cannot be recorded", async () => {
    const { store } = await inMemoryStoreWithSpy();
    vi.spyOn(store, "recordAccess").mockRejectedValue(new Error("audit sink unavailable"));
    const { POST: publish } = await import("@/app/api/caring-contacts/pathway-versions/route");

    const response = await publish(
      post("/api/caring-contacts/pathway-versions", {
        pathwayVersionId: "SYN-PATHWAY-001",
        action: { type: "publish" },
        idempotencyKey: "publish-2",
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ refusal: "action-not-granted" });
  });

  // Fix round 1, Important 1. The audited actor could switch off their own audit record by typing
  // a space: a malformed objectId made `buildAccessAuditEvent` throw, and `recordAccessAttempt`
  // discards that failure by design (Ruling 45's unblockable requirement). The record must be made
  // whatever the caller sent.
  it("still records exactly one audit event when the denied write carries a malformed identifier", async () => {
    const { store, recorded } = await inMemoryStoreWithSpy();
    const auditor = demoActorForRole("auditor");
    const before = (await store.listAuditEvents({ actor: auditor })).length;
    // Deliberately unconstrained, so this proves the handler's own guarantee rather than the route
    // schema in front of it.
    const handler = writeHandler({
      schema: z.object({ id: z.string() }),
      action: "publishPathwayVersion",
      access: { objectType: "pathwayVersion", objectId: (body) => body.id },
      write: async () => ({ ok: true, value: null }),
    });

    const response = await handler(post("/api/caring-contacts/pathway-versions", { id: "SYN PATHWAY 001" }));

    expect(response.status).toBe(403);
    expect(recorded()).toHaveLength(1);
    expect(await store.listAuditEvents({ actor: auditor })).toHaveLength(before + 1);
    // The rejected value is never recorded; the bare object-type name is the documented safe shape.
    expect(recorded()[0]).toMatchObject({ objectType: "pathwayVersion", objectId: "pathwayVersion" });
  });

  it("refuses a malformed identifier at the route with a clean 400, before it reaches the audit path", async () => {
    await inMemoryStoreWithSpy();
    const { POST } = await import("@/app/api/caring-contacts/pathway-versions/route");

    const response = await POST(
      post("/api/caring-contacts/pathway-versions", {
        pathwayVersionId: "SYN PATHWAY 001",
        action: { type: "publish" },
        idempotencyKey: "publish-malformed",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ refusal: "invalid-request" });
  });

  // Fix round 1, Minor 1. The same chain on the read side reported the trail as DOWN for what was
  // only ever a caller mistake, which would make a genuine outage alarm untrustworthy.
  it("does not report the audit trail as unavailable when the caller supplies a malformed identifier", async () => {
    const { recorded } = await inMemoryStoreWithSpy();
    const handler = readHandler({
      access: { kind: "view", objectType: "plan", objectId: () => "SYN PLAN 001" },
      read: async (repository, actor) => repository.getPlan(PLAN_ID, { actor }),
    });

    const response = await handler(get("/api/caring-contacts/plans/SYN-PLAN-001"));

    expect(response.status).toBe(200);
    expect(recorded()).toEqual([expect.objectContaining({ objectType: "plan", objectId: "plan" })]);
  });

  // Fix round 1, Minor 3. Pre-existing store behaviour, deliberately unchanged: `runWrite` returns
  // the cached result before building an event, so a replay is not a second attempt. Pinned here
  // because it sits on the edge of Ruling 45's invariant and nothing covered it.
  it("produces no audit event for an idempotent replay of an already-recorded attempt", async () => {
    const { store } = await inMemoryStoreWithSpy();
    const auditor = demoActorForRole("auditor");
    const { POST } = await import("@/app/api/caring-contacts/plans/[planId]/route");
    const body = { action: "pause", expectedVersion: 2, idempotencyKey: "pause-replay" };

    const first = await POST(post("/api/caring-contacts/plans/SYN-PLAN-001", body), {
      params: Promise.resolve({ planId: "SYN-PLAN-001" }),
    });
    const afterFirst = (await store.listAuditEvents({ actor: auditor })).length;
    const replay = await POST(post("/api/caring-contacts/plans/SYN-PLAN-001", body), {
      params: Promise.resolve({ planId: "SYN-PLAN-001" }),
    });

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(await store.listAuditEvents({ actor: auditor })).toHaveLength(afterFirst);
  });

  // Fix round 1, Important 2. `parseJsonBodyOrDefault` returned null for an unparseable body,
  // which the schema's own defaults then turned into the BROADEST window -- so an audit reviewer
  // was answered a different question than the one they asked, and it looked authoritative.
  it("refuses an unparseable access-trail query rather than answering a different window", async () => {
    await inMemoryStoreWithSpy({ actorRole: "auditor" });
    const { POST } = await import("@/app/api/caring-contacts/access-trail/route");

    const response = await POST(
      new NextRequest("http://localhost/api/caring-contacts/access-trail", { method: "POST", body: "{not json" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ refusal: "invalid-request" });
  });

  it("answers a well-formed access-trail query", async () => {
    await inMemoryStoreWithSpy({ actorRole: "auditor" });
    const { POST } = await import("@/app/api/caring-contacts/access-trail/route");

    const response = await POST(post("/api/caring-contacts/access-trail", { limit: 5, offset: 0 }));

    expect(response.status).toBe(200);
    expect(Array.isArray(await response.json())).toBe(true);
  });

  // Fix round 1, Minor 6. The service-stopped body is assembled from a constant, so it could not
  // catch a leak anywhere else. This refusal arises from stored record state, and the request that
  // provokes it carries a name, a mobile number and an identifier.
  it("never returns patient data in a refusal that arises from real record data", async () => {
    await inMemoryStoreWithSpy();
    const { POST } = await import("@/app/api/caring-contacts/plans/route");

    const response = await POST(
      post("/api/caring-contacts/plans", {
        planId: "SYN-PLAN-002",
        referralId: "SYN-REFERRAL-002",
        patientId: "SYN-PATIENT-001",
        pathwayVersionId: "SYN-PATHWAY-001",
        dischargeAt: "2026-03-02T02:00:00.000Z",
        sendingPreference: "morning",
        patientDetail: PATIENT_DETAIL,
        idempotencyKey: "create-duplicate",
      }),
    );
    const body = await response.text();

    expect(response.status).toBe(409);
    expect(body).toContain("duplicate-active-plan");
    expect(body).not.toMatch(/Rowan|Mira|\+61|UR-00219384/);
  });

  // Ruling 49: a duplicate identifier is a conflict, the same as the three 409s the brief named.
  it("maps a duplicate referral identifier to 409, not to the catch-all", async () => {
    await inMemoryStoreWithSpy();
    const { POST } = await import("@/app/api/caring-contacts/referrals/route");

    const first = await POST(
      post("/api/caring-contacts/referrals", {
        type: "create",
        referralId: "SYN-REFERRAL-010",
        patientId: "SYN-PATIENT-010",
        idempotencyKey: "referral-first",
      }),
    );
    const duplicate = await POST(
      post("/api/caring-contacts/referrals", {
        type: "create",
        referralId: "SYN-REFERRAL-010",
        patientId: "SYN-PATIENT-011",
        idempotencyKey: "referral-second",
      }),
    );

    expect(first.status).toBe(200);
    expect(duplicate.status).toBe(409);
    await expect(duplicate.json()).resolves.toEqual({ refusal: "referral-already-exists" });
  });

  it("falls back to 422 for a refusal the status map does not name", async () => {
    // `resume` on a plan that is already active. Not a permission problem, not a conflict of
    // versions -- a state the domain refuses by name, which is what the catch-all is for.
    await inMemoryStoreWithSpy();
    const { POST } = await import("@/app/api/caring-contacts/plans/[planId]/route");

    const response = await POST(
      post("/api/caring-contacts/plans/SYN-PLAN-001", {
        action: "resume",
        expectedVersion: 2,
        idempotencyKey: "resume-1",
      }),
      { params: Promise.resolve({ planId: "SYN-PLAN-001" }) },
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ refusal: "plan-not-paused" });
  });

  it("records a failed outcome and releases nothing when the read itself throws", async () => {
    const { recorded } = await inMemoryStoreWithSpy();
    const handler = readHandler({
      access: { kind: "view", objectType: "plan", objectId: () => "SYN-PLAN-001" },
      read: async () => {
        throw new Error("store unavailable");
      },
    });

    const response = await handler(get("/api/caring-contacts/plans/SYN-PLAN-001"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ refusal: "read-failed" });
    expect(recorded()).toContainEqual(expect.objectContaining({ outcome: "failed" }));
  });

  it("releases nothing when the access event cannot be recorded", async () => {
    const { store } = await inMemoryStoreWithSpy();
    vi.spyOn(store, "recordAccess").mockRejectedValue(new Error("audit sink unavailable"));
    const handler = readHandler({
      access: { kind: "view", objectType: "plan", objectId: () => "SYN-PLAN-001" },
      read: async (repository, actor) => repository.getPlan(PLAN_ID, { actor }),
    });

    const response = await handler(get("/api/caring-contacts/plans/SYN-PLAN-001"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ refusal: "access-audit-unavailable" });
  });
});

// ---------------------------------------------------------------------------
// Ruling 43 -- the service-state read is narrowed at this boundary.
//
// `getServiceState` is not capability-checked in either store, by design: the stopped FACT must
// reach every team, including one that had no part in the incident (Ruling 9). But the record it
// hands back carries the responder's free-text `note`, which the schema classifies as patient
// data. The narrowing happens here, at the designated boundary, and it has two halves -- the note
// is withheld, and the fact is not.
// ---------------------------------------------------------------------------

const REPORTING_TEAM = teamId("TEAM-NORTH");

function stoppedState(): ServiceState {
  return {
    stopped: true,
    reportedByTeamId: REPORTING_TEAM,
    reason: "wrong-recipient",
    stoppedBy: actorId("ACTOR-INCIDENT-LEAD"),
    stoppedAt: "2026-03-02T11:00:00.000+08:00",
    note: "Message for Rowan Mira Delacroix reached +61 491 570 156.",
    restartApprovals: [],
  };
}

function foreignActor(): Actor {
  return { id: actorId("ACTOR-SOUTH"), teamId: teamId("TEAM-SOUTH"), roles: ["coordinator"] };
}

function reportingActor(): Actor {
  return { id: actorId("ACTOR-NORTH"), teamId: REPORTING_TEAM, roles: ["coordinator"] };
}

function stoppedView(view: ServiceStateView): Extract<ServiceStateView, { stopped: true }> {
  if (!view.stopped) throw new Error("expected a stopped service-state view");
  return view;
}

describe("service-state read narrowing (Ruling 43)", () => {
  it("withholds the incident note from an actor outside the reporting team", () => {
    const view = stoppedView(narrowServiceStateForActor(stoppedState(), foreignActor()));

    expect(view.incidentDetail).toEqual({ visible: false, withheldReason: "cross-team-denied" });
    expect(JSON.stringify(view)).not.toMatch(/Rowan|Mira|\+61/);
  });

  it("still tells that actor the service is stopped, why, and when", () => {
    const view = stoppedView(narrowServiceStateForActor(stoppedState(), foreignActor()));

    expect(view.reason).toBe("wrong-recipient");
    expect(view.stoppedAt).toBe("2026-03-02T11:00:00.000+08:00");
    expect(view.banner).toContain("All caring-contact sending is stopped for the whole service");
  });

  it("releases the note to an actor of the reporting team who may see incident detail", () => {
    const view = stoppedView(narrowServiceStateForActor(stoppedState(), reportingActor()));

    expect(view.incidentDetail).toEqual({
      visible: true,
      stoppedBy: actorId("ACTOR-INCIDENT-LEAD"),
      note: "Message for Rowan Mira Delacroix reached +61 491 570 156.",
    });
  });

  it("withholds the note from an actor whose roles do not include the patient-record capability", () => {
    const roleless: Actor = { id: actorId("ACTOR-NONE"), teamId: REPORTING_TEAM, roles: [] };

    const view = stoppedView(narrowServiceStateForActor(stoppedState(), roleless));

    expect(view.incidentDetail).toEqual({ visible: false, withheldReason: "no-roles" });
    expect(view.reason).toBe("wrong-recipient");
  });

  it("carries no incident fields at all while the service is running", () => {
    const running: ServiceState = { stopped: false, reportedByTeamId: REPORTING_TEAM };

    expect(narrowServiceStateForActor(running, foreignActor())).toEqual({ stopped: false, banner: null });
  });

  it("narrows the note through the service-state route, and still reports the stop", async () => {
    const { store, recorded } = await inMemoryStoreWithSpy();
    // Raised by an actor of another team, so the demo actor reading it is outside the reporting
    // team -- the exact case Ruling 43 is about.
    const stopped = await store.stopService(
      { reason: "duplicate-send", note: "Rowan Mira Delacroix received the same message twice." },
      {
        actor: { id: actorId("ACTOR-NORTH"), teamId: REPORTING_TEAM, roles: ["teamLead"] },
        idempotencyKey: idempotencyKey("seed-stop-other-team"),
      },
    );
    if (!stopped.ok) throw new Error(`seed stopService refused: ${stopped.reason}`);

    const { GET } = await import("@/app/api/caring-contacts/service-state/route");
    const response = await GET(get("/api/caring-contacts/service-state"));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).not.toMatch(/Rowan|Mira/);
    expect(JSON.parse(body)).toMatchObject({
      stopped: true,
      reason: "duplicate-send",
      incidentDetail: { visible: false, withheldReason: "cross-team-denied" },
    });
    expect(recorded()).toContainEqual(expect.objectContaining({ objectType: "serviceState", outcome: "allowed" }));
  });
});
