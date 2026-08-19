// tests/helpers/caring-contacts-repository-contract.ts
//
// The behaviour every caring-contact store must show, written once and run against each
// implementation. Task 9 runs it against the in-memory store; Task 11 runs this same function
// against the Postgres store rather than writing a second suite, which is why it takes a factory
// instead of calling a constructor.
//
// Not named *.test.ts on purpose: the vitest node project collects `tests/**/*.test.ts`, so a
// suite living here is registered only by the thin file that calls this function.
import { describe, expect, it } from "vitest";

import type { AuditEvent } from "@/lib/caring-contacts/audit";
import { fixedClock, type Clock } from "@/lib/caring-contacts/clock";
import {
  actorId,
  idempotencyKey,
  pathwayVersionId,
  patientId,
  planId,
  referralId,
  teamId,
} from "@/lib/caring-contacts/ids";
import type { Actor, CaringContactActor, CaringContactRole, SystemActor } from "@/lib/caring-contacts/permissions";
import {
  REPOSITORY_REFUSALS,
  type AuditSink,
  type CaringContactRepository,
  type CaringContactRepositoryFactory,
  type CreatePlanInput,
  type EpisodePatientDetail,
  type WriteContext,
} from "@/lib/caring-contacts/repository";
import { DEFAULT_RETENTION_POLICY, deidentifyEpisode, isDueForDeidentification } from "@/lib/caring-contacts/retention";

const TEAM_A = teamId("TEAM-NORTH");

const PLAN_ID = planId("PLAN-1");
const PATIENT_ID = patientId("PATIENT-1");
const REFERRAL_ID = referralId("REFERRAL-1");
const PATHWAY_VERSION_ID = pathwayVersionId("PATHWAY-1");

/** 2026-03-02 10:00 AWST. */
const DISCHARGE_AT = new Date("2026-03-02T02:00:00.000Z");
const NOW = "2026-03-02T03:00:00.000Z";

function actorWith(id: string, team: string, roles: readonly CaringContactRole[]): Actor {
  return { id: actorId(id), teamId: teamId(team), roles };
}

const COORDINATOR_A = actorWith("ACTOR-1", "TEAM-NORTH", ["coordinator"]);
const TEAM_LEAD_A = actorWith("ACTOR-2", "TEAM-NORTH", ["teamLead"]);
const AUDITOR_A = actorWith("ACTOR-3", "TEAM-NORTH", ["auditor"]);
const COORDINATOR_B = actorWith("ACTOR-4", "TEAM-SOUTH", ["coordinator"]);
const ROLELESS_A = actorWith("ACTOR-5", "TEAM-NORTH", []);

/** The non-human actor that writes contact status. It holds no human capability at all. */
const DISPATCHER_A: SystemActor = {
  id: actorId("SYSTEM-DISPATCHER"),
  teamId: teamId("TEAM-NORTH"),
  systemRole: "contactDispatcher",
};

const PATIENT_DETAIL: EpisodePatientDetail = {
  patientName: "Jordan Nguyen",
  patientMobileNumber: "+61 491 570 156",
  patientIdentifiers: ["UR-00219384"],
  culturalIdentity: null,
};

function writeContext(actor: CaringContactActor, key: string): WriteContext {
  return { actor, idempotencyKey: idempotencyKey(key) };
}

function createInput(overrides: Partial<CreatePlanInput> = {}): CreatePlanInput {
  return {
    planId: PLAN_ID,
    referralId: REFERRAL_ID,
    patientId: PATIENT_ID,
    pathwayVersionId: PATHWAY_VERSION_ID,
    dischargeAt: DISCHARGE_AT,
    sendingPreference: "morning",
    patientDetail: PATIENT_DETAIL,
    ...overrides,
  };
}

/** A sink that can be switched to failing mid-suite, so a write can be broken part-way through. */
function togglableAuditSink(): AuditSink & { failNext: boolean; recorded: AuditEvent[] } {
  const sink = {
    failNext: false,
    recorded: [] as AuditEvent[],
    record(event: AuditEvent) {
      if (sink.failNext) throw new Error("audit-sink-unavailable");
      sink.recorded.push(event);
    },
  };
  return sink;
}

function unwrap<T>(result: { ok: true; value: T } | { ok: false; reason: string }): T {
  if (!result.ok) throw new Error(`expected an accepted write, got refusal "${result.reason}"`);
  return result.value;
}

export function describeCaringContactRepositoryContract(label: string, factory: CaringContactRepositoryFactory): void {
  describe(`CaringContactRepository contract (${label})`, () => {
    const clock: Clock = fixedClock(NOW);

    async function newStore(auditSink?: AuditSink): Promise<CaringContactRepository> {
      return await factory(clock, auditSink ? { auditSink } : undefined);
    }

    /** A store holding one plan already moved to `active`, i.e. version 2. */
    async function storeWithActivePlan(auditSink?: AuditSink) {
      const store = await newStore(auditSink);
      const created = unwrap(await store.createPlan(createInput(), writeContext(COORDINATOR_A, "key-create")));
      const activated = unwrap(
        await store.activatePlan(
          { planId: PLAN_ID, expectedVersion: created.plan.version },
          writeContext(COORDINATOR_A, "key-activate"),
        ),
      );
      return { store, activated };
    }

    async function auditTrail(store: CaringContactRepository): Promise<AuditEvent[]> {
      return await store.listAuditEvents({ actor: AUDITOR_A });
    }

    describe("rule 1 — every write is idempotent on its key", () => {
      it("replays the original created plan and stores no second plan", async () => {
        const store = await newStore();
        const first = await store.createPlan(createInput(), writeContext(COORDINATOR_A, "key-create"));
        const replay = await store.createPlan(createInput(), writeContext(COORDINATOR_A, "key-create"));

        expect(first.ok).toBe(true);
        expect(replay).toEqual(first);
        expect(await store.listPlans({ actor: COORDINATOR_A })).toHaveLength(1);
      });

      it("replays a pause without applying it a second time", async () => {
        const { store, activated } = await storeWithActivePlan();
        const context = writeContext(COORDINATOR_A, "key-pause");

        const first = unwrap(await store.pausePlan({ planId: PLAN_ID, expectedVersion: 2 }, context));
        const replay = await store.pausePlan({ planId: PLAN_ID, expectedVersion: 2 }, context);

        expect(activated.plan.version).toBe(2);
        expect(first.plan.version).toBe(3);
        expect(replay).toEqual({ ok: true, value: first });
        expect((await store.getPlan(PLAN_ID, { actor: COORDINATOR_A }))?.plan.version).toBe(3);
      });

      it("appends no second audit event for a replay", async () => {
        const { store } = await storeWithActivePlan();
        const context = writeContext(COORDINATOR_A, "key-pause");

        await store.pausePlan({ planId: PLAN_ID, expectedVersion: 2 }, context);
        const afterFirst = (await auditTrail(store)).length;
        await store.pausePlan({ planId: PLAN_ID, expectedVersion: 2 }, context);

        expect((await auditTrail(store)).length).toBe(afterFirst);
      });

      it("refuses a key reused for a different write", async () => {
        const { store } = await storeWithActivePlan();
        await store.pausePlan({ planId: PLAN_ID, expectedVersion: 2 }, writeContext(COORDINATOR_A, "key-shared"));

        const reused = await store.resumePlan(
          { planId: PLAN_ID, expectedVersion: 3 },
          writeContext(COORDINATOR_A, "key-shared"),
        );

        expect(reused).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.idempotencyKeyReused });
        expect((await store.getPlan(PLAN_ID, { actor: COORDINATOR_A }))?.plan.state).toBe("paused");
      });

      it("scopes keys per team, so one team cannot replay another team's result", async () => {
        const store = await newStore();
        const mine = await store.createPlan(createInput(), writeContext(COORDINATOR_A, "key-create"));
        const theirs = await store.createPlan(
          // The other team's plan names the other team's OWN referral and pathway version. A
          // referral belongs to exactly one team, so two teams sharing one referral id was
          // fixture convenience rather than anything the domain allows; migration 0003 makes
          // both links same-team foreign keys and refuses it outright. The assertions below are
          // unchanged -- this test is about idempotency keys being scoped per team.
          createInput({
            planId: planId("PLAN-2"),
            patientId: patientId("PATIENT-2"),
            referralId: referralId("REFERRAL-3"),
            pathwayVersionId: pathwayVersionId("PATHWAY-2"),
          }),
          writeContext(COORDINATOR_B, "key-create"),
        );

        expect(mine.ok).toBe(true);
        expect(theirs.ok).toBe(true);
        expect(await store.listPlans({ actor: COORDINATOR_A })).toHaveLength(1);
        expect(await store.listPlans({ actor: COORDINATOR_B })).toHaveLength(1);
      });
    });

    describe("rule 2 — exactly one audit event, atomically with the change", () => {
      it("appends exactly one allowed event per accepted write", async () => {
        const store = await newStore();
        await store.createPlan(createInput(), writeContext(COORDINATOR_A, "key-create"));

        const trail = await auditTrail(store);
        expect(trail).toHaveLength(1);
        expect(trail[0]).toMatchObject({
          actorId: COORDINATOR_A.id,
          teamId: TEAM_A,
          outcome: "allowed",
          objectType: "plan",
          objectId: PLAN_ID,
          idempotencyKey: idempotencyKey("key-create"),
        });

        await store.activatePlan({ planId: PLAN_ID, expectedVersion: 1 }, writeContext(COORDINATOR_A, "key-activate"));
        expect(await auditTrail(store)).toHaveLength(2);
      });

      it("appends exactly one denied event for a refused write, and changes nothing", async () => {
        const { store } = await storeWithActivePlan();
        const before = (await auditTrail(store)).length;

        const refused = await store.activatePlan(
          { planId: PLAN_ID, expectedVersion: 2 },
          writeContext(COORDINATOR_A, "key-reactivate"),
        );

        expect(refused).toEqual({ ok: false, reason: "plan-not-draft" });
        const trail = await auditTrail(store);
        expect(trail).toHaveLength(before + 1);
        expect(trail[trail.length - 1]).toMatchObject({ outcome: "denied" });
        expect((await store.getPlan(PLAN_ID, { actor: COORDINATOR_A }))?.plan.version).toBe(2);
      });

      it("leaves neither the change nor the audit event when the audit sink fails part-way", async () => {
        const sink = togglableAuditSink();
        const { store } = await storeWithActivePlan(sink);
        const trailBefore = await auditTrail(store);
        const recordedBefore = sink.recorded.length;

        sink.failNext = true;
        await expect(
          store.pausePlan({ planId: PLAN_ID, expectedVersion: 2 }, writeContext(COORDINATOR_A, "key-pause")),
        ).rejects.toThrow("audit-sink-unavailable");
        sink.failNext = false;

        const after = await store.getPlan(PLAN_ID, { actor: COORDINATOR_A });
        expect(after?.plan.state).toBe("active");
        expect(after?.plan.version).toBe(2);
        expect(await auditTrail(store)).toHaveLength(trailBefore.length);
        expect(sink.recorded).toHaveLength(recordedBefore);
      });

      it("leaves neither the change nor the audit event when the audit guard rejects the event", async () => {
        const store = await newStore();
        // An upstream identifier carrying something that reads as a mobile number. The change is
        // fully computed before the audit event is built, so this breaks the write part-way.
        const hostileId = planId("PLAN-0491 570 156");

        await expect(
          store.createPlan(createInput({ planId: hostileId }), writeContext(COORDINATOR_A, "key-create")),
        ).rejects.toThrow(/audit-event-contains-patient-data/);

        expect(await store.getPlan(hostileId, { actor: COORDINATOR_A })).toBeNull();
        expect(await store.listPlans({ actor: COORDINATOR_A })).toEqual([]);
        expect(await auditTrail(store)).toEqual([]);
      });

      it("does not consume the idempotency key when a write throws, so a retry still works", async () => {
        const sink = togglableAuditSink();
        const { store } = await storeWithActivePlan(sink);
        const context = writeContext(COORDINATOR_A, "key-pause");

        sink.failNext = true;
        await expect(store.pausePlan({ planId: PLAN_ID, expectedVersion: 2 }, context)).rejects.toThrow();
        sink.failNext = false;

        const retried = await store.pausePlan({ planId: PLAN_ID, expectedVersion: 2 }, context);
        expect(retried.ok).toBe(true);
        expect((await store.getPlan(PLAN_ID, { actor: COORDINATOR_A }))?.plan.state).toBe("paused");
      });
    });

    describe("rule 3 — optimistic concurrency", () => {
      it("refuses a write against a stale version and applies nothing", async () => {
        const { store } = await storeWithActivePlan();

        const stale = await store.pausePlan(
          { planId: PLAN_ID, expectedVersion: 1 },
          writeContext(COORDINATOR_A, "key-stale"),
        );

        expect(stale).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.staleVersion });
        const after = await store.getPlan(PLAN_ID, { actor: COORDINATOR_A });
        expect(after?.plan.state).toBe("active");
        expect(after?.plan.version).toBe(2);
      });

      it("lets exactly one of two simultaneous pauses win, refusing the other with stale-version", async () => {
        const { store } = await storeWithActivePlan();

        const [first, second] = await Promise.all([
          store.pausePlan({ planId: PLAN_ID, expectedVersion: 2 }, writeContext(COORDINATOR_A, "key-pause-a")),
          store.pausePlan({ planId: PLAN_ID, expectedVersion: 2 }, writeContext(TEAM_LEAD_A, "key-pause-b")),
        ]);

        const accepted = [first, second].filter((result) => result.ok);
        const refused = [first, second].filter((result) => !result.ok);

        expect(accepted).toHaveLength(1);
        expect(refused).toEqual([{ ok: false, reason: REPOSITORY_REFUSALS.staleVersion }]);

        const after = await store.getPlan(PLAN_ID, { actor: COORDINATOR_A });
        expect(after?.plan.state).toBe("paused");
        expect(after?.plan.version).toBe(3);
      });
    });

    describe("rule 4 — one non-terminal plan per patient", () => {
      it("refuses a second plan for the same patient", async () => {
        const store = await newStore();
        await store.createPlan(createInput(), writeContext(COORDINATOR_A, "key-create"));

        const second = await store.createPlan(
          createInput({ planId: planId("PLAN-2"), referralId: referralId("REFERRAL-2") }),
          writeContext(COORDINATOR_A, "key-create-2"),
        );

        expect(second).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.duplicateActivePlan });
        expect(await store.listPlans({ actor: COORDINATOR_A })).toHaveLength(1);
      });

      it("refuses a duplicate raised by another team too", async () => {
        const store = await newStore();
        await store.createPlan(createInput(), writeContext(COORDINATOR_A, "key-create"));

        const second = await store.createPlan(
          createInput({ planId: planId("PLAN-2"), referralId: referralId("REFERRAL-2") }),
          writeContext(COORDINATOR_B, "key-create-2"),
        );

        expect(second).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.duplicateActivePlan });
      });

      it("allows a new plan once the previous one has ended", async () => {
        const { store } = await storeWithActivePlan();
        await store.withdrawPlan(
          { planId: PLAN_ID, expectedVersion: 2, origin: "patient" },
          writeContext(COORDINATOR_A, "key-withdraw"),
        );

        const second = await store.createPlan(
          createInput({ planId: planId("PLAN-2"), referralId: referralId("REFERRAL-2") }),
          writeContext(COORDINATOR_A, "key-create-2"),
        );

        expect(second.ok).toBe(true);
      });

      it("refuses a repeat of an identifier already used", async () => {
        const store = await newStore();
        await store.createPlan(createInput(), writeContext(COORDINATOR_A, "key-create"));

        const clash = await store.createPlan(
          createInput({ patientId: patientId("PATIENT-2") }),
          writeContext(COORDINATOR_A, "key-create-2"),
        );

        expect(clash).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.planAlreadyExists });
      });
    });

    describe("rule 5 — reads are team-scoped and reveal nothing", () => {
      it("returns empty for every read made by an actor from another team", async () => {
        const store = await newStore();
        await store.createPlan(createInput(), writeContext(COORDINATOR_A, "key-create"));

        expect(await store.getPlan(PLAN_ID, { actor: COORDINATOR_B })).toBeNull();
        expect(await store.listPlans({ actor: COORDINATOR_B })).toEqual([]);
        expect(await store.listContacts(PLAN_ID, { actor: COORDINATOR_B })).toEqual([]);
        expect(await store.listSendableContacts(PLAN_ID, { actor: COORDINATOR_B })).toEqual([]);
        expect(await store.getEpisode(PLAN_ID, { actor: COORDINATOR_B })).toBeNull();
        expect(await store.listAuditEvents({ actor: actorWith("ACTOR-6", "TEAM-SOUTH", ["auditor"]) })).toEqual([]);

        expect(await store.getPlan(PLAN_ID, { actor: COORDINATOR_A })).not.toBeNull();
      });

      it("gives a cross-team write the same answer as a plan that does not exist", async () => {
        const store = await newStore();
        await store.createPlan(createInput(), writeContext(COORDINATOR_A, "key-create"));

        const crossTeam = await store.activatePlan(
          { planId: PLAN_ID, expectedVersion: 1 },
          writeContext(COORDINATOR_B, "key-activate"),
        );
        const absent = await store.activatePlan(
          { planId: planId("PLAN-ABSENT"), expectedVersion: 1 },
          writeContext(COORDINATOR_B, "key-activate-2"),
        );

        expect(crossTeam).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.notFound });
        expect(crossTeam).toEqual(absent);
        expect((await store.getPlan(PLAN_ID, { actor: COORDINATOR_A }))?.plan.state).toBe("draft");
      });

      it("returns empty rather than a refusal when the actor's role does not cover the read", async () => {
        const store = await newStore();
        unwrap(await store.createPlan(createInput(), writeContext(COORDINATOR_A, "key-create")));

        // Positive controls first: the record and the trail are both genuinely readable by an
        // actor whose role covers them, so the empty results below are scoping and not absence.
        expect(await store.getPlan(PLAN_ID, { actor: COORDINATOR_A })).not.toBeNull();
        expect(await store.getEpisode(PLAN_ID, { actor: TEAM_LEAD_A })).not.toBeNull();
        expect(await store.listAuditEvents({ actor: AUDITOR_A })).toHaveLength(1);

        expect(await store.getPlan(PLAN_ID, { actor: AUDITOR_A })).toBeNull();
        expect(await store.getEpisode(PLAN_ID, { actor: AUDITOR_A })).toBeNull();
        expect(await store.listAuditEvents({ actor: COORDINATOR_A })).toEqual([]);
      });

      it("refuses a write by an in-team actor whose role does not grant the action", async () => {
        const store = await newStore();
        await store.createPlan(createInput(), writeContext(COORDINATOR_A, "key-create"));

        const refused = await store.activatePlan(
          { planId: PLAN_ID, expectedVersion: 1 },
          writeContext(ROLELESS_A, "key-activate"),
        );

        expect(refused).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.permissionDenied });
      });

      it("keeps patient-identifying detail out of plan reads and the audit trail", async () => {
        const store = await newStore();
        await store.createPlan(createInput(), writeContext(COORDINATOR_A, "key-create"));

        const record = await store.getPlan(PLAN_ID, { actor: COORDINATOR_A });
        const trail = await auditTrail(store);

        // Positive controls: both really did come back, so the absences below mean something.
        expect(record?.patientId).toBe(PATIENT_ID);
        expect(trail).toHaveLength(1);

        expect(JSON.stringify(record)).not.toContain("491 570 156");
        expect(JSON.stringify(record)).not.toContain("Jordan");
        expect(JSON.stringify(trail)).not.toContain("491 570 156");
        expect(JSON.stringify(trail)).not.toContain("Jordan");

        // ...and the detail is still held, released only through the episode projection.
        expect((await store.getEpisode(PLAN_ID, { actor: TEAM_LEAD_A }))?.patientName).toBe("Jordan Nguyen");
      });
    });

    describe("dispatch never keys off sendAt", () => {
      it("stores an absorbed contact as terminal, so it can never reach a dispatch list", async () => {
        const store = await newStore();
        unwrap(
          await store.createPlan(
            createInput({ firstContactDate: "2026-03-09", firstContactReason: "Patient asked to start later" }),
            writeContext(COORDINATOR_A, "key-create"),
          ),
        );

        const all = await store.listContacts(PLAN_ID, { actor: COORDINATOR_A });
        const sendable = await store.listSendableContacts(PLAN_ID, { actor: COORDINATOR_A });
        const absorbed = all.filter((stored) => stored.planned.suppressed !== undefined);

        expect(all).toHaveLength(10);
        expect(absorbed).toHaveLength(1);
        expect(absorbed[0].contact.state).toBe("suppressed");
        expect(absorbed[0].planned.sendAt.getTime()).toBeGreaterThan(0);
        expect(sendable).toHaveLength(9);
        expect(sendable.map((stored) => stored.contact.id)).not.toContain(absorbed[0].contact.id);

        const days = sendable.map((stored) => stored.planned.calendarDay);
        expect(new Set(days).size).toBe(days.length);
      });
    });

    describe("a recorded death stops everything outright", () => {
      it("cancels every non-terminal contact without comparing any time to now", async () => {
        const { store } = await storeWithActivePlan();

        const outcome = unwrap(
          await store.recordHospitalStatusEvent(
            { planId: PLAN_ID, expectedVersion: 2, event: { type: "death", recordedAt: new Date(NOW) } },
            writeContext(COORDINATOR_A, "key-death"),
          ),
        );

        expect(outcome.record.plan.state).toBe("cancelled");
        expect(outcome.contactsCancelled).toBe(10);
        const contacts = await store.listContacts(PLAN_ID, { actor: COORDINATOR_A });
        expect(contacts.every((stored) => stored.contact.state === "cancelled")).toBe(true);
        expect(await store.listSendableContacts(PLAN_ID, { actor: COORDINATOR_A })).toEqual([]);
      });

      it("cancels contacts whose send instant is far in the future just the same", async () => {
        const { store } = await storeWithActivePlan();
        await store.recordHospitalStatusEvent(
          { planId: PLAN_ID, expectedVersion: 2, event: { type: "death", recordedAt: new Date(NOW) } },
          writeContext(COORDINATOR_A, "key-death"),
        );

        const contacts = await store.listContacts(PLAN_ID, { actor: COORDINATOR_A });
        const latest = contacts.reduce((a, b) => (a.planned.sendAt > b.planned.sendAt ? a : b));
        expect(latest.planned.sendAt.getTime()).toBeGreaterThan(new Date(NOW).getTime());
        expect(latest.contact.state).toBe("cancelled");
      });

      it("holds without cancelling for a readmission", async () => {
        const { store } = await storeWithActivePlan();

        const outcome = unwrap(
          await store.recordHospitalStatusEvent(
            { planId: PLAN_ID, expectedVersion: 2, event: { type: "readmission" } },
            writeContext(COORDINATOR_A, "key-readmission"),
          ),
        );

        expect(outcome.record.plan.state).toBe("paused");
        expect(outcome.contactsCancelled).toBe(0);
        expect(await store.listSendableContacts(PLAN_ID, { actor: COORDINATOR_A })).toHaveLength(10);
      });

      it("records a death as a hospital status event, not as a service safety stop", async () => {
        const { store } = await storeWithActivePlan();
        const before = (await auditTrail(store)).length;

        await store.recordHospitalStatusEvent(
          { planId: PLAN_ID, expectedVersion: 2, event: { type: "death", recordedAt: new Date(NOW) } },
          writeContext(COORDINATOR_A, "key-death"),
        );

        const event = (await auditTrail(store))[before];
        expect(event.action).toBe("recordHospitalStatusEvent:death");
        expect(event.action).not.toContain("SafetyStop");
      });

      it("never blocks a recorded death on a permission check, even for an auditor", async () => {
        const { store } = await storeWithActivePlan();

        // The auditor holds no recordHospitalStatusEvent grant...
        const readmission = await store.recordHospitalStatusEvent(
          { planId: PLAN_ID, expectedVersion: 2, event: { type: "readmission" } },
          writeContext(AUDITOR_A, "key-readmission"),
        );
        expect(readmission).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.permissionDenied });

        // ...but a death still gets through, on triggerServiceSafetyStop, because a refusal here
        // would leave the plan sending to someone who has died.
        const death = unwrap(
          await store.recordHospitalStatusEvent(
            { planId: PLAN_ID, expectedVersion: 2, event: { type: "death", recordedAt: new Date(NOW) } },
            writeContext(AUDITOR_A, "key-death"),
          ),
        );
        expect(death.record.plan.state).toBe("cancelled");
        expect(death.contactsCancelled).toBe(10);
      });

      it("refuses a third-party withdrawal by name and leaves the plan alone", async () => {
        const { store } = await storeWithActivePlan();

        const refused = await store.withdrawPlan(
          { planId: PLAN_ID, expectedVersion: 2, origin: "thirdParty" },
          writeContext(COORDINATOR_A, "key-withdraw"),
        );

        expect(refused).toEqual({ ok: false, reason: "third-party-withdrawal-refused" });
        expect((await store.getPlan(PLAN_ID, { actor: COORDINATOR_A }))?.plan.state).toBe("active");
      });
    });

    describe("contact status is written by the dispatcher, and only by the dispatcher", () => {
      /** The first sendable contact of an active plan, with the version a write must state. */
      async function firstSendable(store: CaringContactRepository) {
        const sendable = await store.listSendableContacts(PLAN_ID, { actor: COORDINATOR_A });
        return sendable[0];
      }

      it("carries a contact through dispatch, so the episode's sent and delivered counts can move off zero", async () => {
        const { store } = await storeWithActivePlan();
        const target = await firstSendable(store);

        const processing = unwrap(
          await store.startContactDispatch(
            { planId: PLAN_ID, contactId: target.contact.id, expectedContactVersion: target.contact.version },
            writeContext(DISPATCHER_A, "key-dispatch"),
          ),
        );
        expect(processing.contact.state).toBe("processing");

        const sent = unwrap(
          await store.recordContactSent(
            { planId: PLAN_ID, contactId: target.contact.id, expectedContactVersion: processing.contact.version },
            writeContext(DISPATCHER_A, "key-sent"),
          ),
        );
        expect(sent.contact.state).toBe("sent");

        const delivered = unwrap(
          await store.recordContactProviderStatus(
            {
              planId: PLAN_ID,
              contactId: target.contact.id,
              expectedContactVersion: sent.contact.version,
              status: "delivered",
            },
            writeContext(DISPATCHER_A, "key-status"),
          ),
        );
        expect(delivered.contact.state).toBe("delivered");

        const episode = await store.getEpisode(PLAN_ID, { actor: TEAM_LEAD_A });
        expect(episode?.counts.contactsSent).toBe(1);
        expect(episode?.counts.contactsDelivered).toBe(1);
        // ...and the contact is out of the sendable list, so it cannot be dispatched twice.
        expect(
          (await store.listSendableContacts(PLAN_ID, { actor: COORDINATOR_A })).map((s) => s.contact.id),
        ).not.toContain(target.contact.id);
      });

      it("refuses a human actor writing a delivery receipt by hand", async () => {
        const { store } = await storeWithActivePlan();
        const target = await firstSendable(store);

        for (const actor of [COORDINATOR_A, TEAM_LEAD_A, AUDITOR_A]) {
          const refused = await store.startContactDispatch(
            { planId: PLAN_ID, contactId: target.contact.id, expectedContactVersion: target.contact.version },
            writeContext(actor, `key-human-${actor.id}`),
          );
          expect(refused).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.permissionDenied });
        }
      });

      it("refuses to begin a dispatch unless the plan is active", async () => {
        const { store } = await storeWithActivePlan();
        const target = await firstSendable(store);
        await store.pausePlan({ planId: PLAN_ID, expectedVersion: 2 }, writeContext(COORDINATOR_A, "key-pause"));

        const refused = await store.startContactDispatch(
          { planId: PLAN_ID, contactId: target.contact.id, expectedContactVersion: target.contact.version },
          writeContext(DISPATCHER_A, "key-dispatch"),
        );
        expect(refused).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.contactDispatchRequiresActivePlan });
      });

      it("refuses a contact-status write that states a stale contact version", async () => {
        const { store } = await storeWithActivePlan();
        const target = await firstSendable(store);
        await store.startContactDispatch(
          { planId: PLAN_ID, contactId: target.contact.id, expectedContactVersion: target.contact.version },
          writeContext(DISPATCHER_A, "key-dispatch"),
        );

        const refused = await store.recordContactSent(
          { planId: PLAN_ID, contactId: target.contact.id, expectedContactVersion: target.contact.version },
          writeContext(DISPATCHER_A, "key-sent"),
        );
        expect(refused).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.staleVersion });
      });

      it("appends one audit event per contact-status write, naming the contact and the system role", async () => {
        const { store } = await storeWithActivePlan();
        const target = await firstSendable(store);
        const before = (await auditTrail(store)).length;

        await store.startContactDispatch(
          { planId: PLAN_ID, contactId: target.contact.id, expectedContactVersion: target.contact.version },
          writeContext(DISPATCHER_A, "key-dispatch"),
        );

        const trail = await auditTrail(store);
        expect(trail).toHaveLength(before + 1);
        const event = trail[trail.length - 1];
        expect(event.action).toBe("startContactDispatch");
        expect(event.objectType).toBe("contact");
        expect(event.objectId).toBe(target.contact.id);
        expect(event.actorRoles).toEqual(["contactDispatcher"]);
        expect(event.outcome).toBe("allowed");
      });

      it("gives the dispatcher no read access at all", async () => {
        const { store } = await storeWithActivePlan();
        expect(await store.getPlan(PLAN_ID, { actor: DISPATCHER_A })).toBeNull();
        expect(await store.listSendableContacts(PLAN_ID, { actor: DISPATCHER_A })).toEqual([]);
        expect(await store.listAuditEvents({ actor: DISPATCHER_A })).toEqual([]);
        expect(await store.getEpisode(PLAN_ID, { actor: DISPATCHER_A })).toBeNull();
      });
    });

    describe("the episode projection is retention's own type", () => {
      it("projects a finished plan into an Episode that retention can act on", async () => {
        const { store } = await storeWithActivePlan();
        await store.withdrawPlan(
          { planId: PLAN_ID, expectedVersion: 2, origin: "patient" },
          writeContext(COORDINATOR_A, "key-withdraw"),
        );

        const episode = await store.getEpisode(PLAN_ID, { actor: TEAM_LEAD_A });
        expect(episode).not.toBeNull();
        if (!episode) return;

        expect(episode.state).toBe("withdrawn");
        expect(episode.teamId).toBe(TEAM_A);
        expect(episode.pathwayVersionId).toBe(PATHWAY_VERSION_ID);
        expect(episode.patientMobileNumber).toBe(PATIENT_DETAIL.patientMobileNumber);
        expect(episode.planDates.completedAt).toEqual(new Date(NOW));
        expect(episode.counts.contactsScheduled).toBe(10);

        expect(deidentifyEpisode(episode)).not.toHaveProperty("patientMobileNumber");
        expect(isDueForDeidentification(episode, DEFAULT_RETENTION_POLICY, fixedClock(NOW))).toBe(false);
        expect(
          isDueForDeidentification(episode, DEFAULT_RETENTION_POLICY, fixedClock("2033-03-03T03:00:00.000Z")),
        ).toBe(true);
      });

      it("leaves completedAt null while the plan is still open", async () => {
        const { store } = await storeWithActivePlan();
        const episode = await store.getEpisode(PLAN_ID, { actor: TEAM_LEAD_A });
        expect(episode?.planDates.completedAt).toBeNull();
        expect(episode?.outcome).toBe("inProgress");
      });
    });
  });
}
