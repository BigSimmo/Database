// tests/caring-contacts-repository.test.ts
//
// The shared store contract, run against the in-memory implementation. Task 11 adds a second thin
// file that calls the same function with the Postgres factory, so neither store can drift from the
// other's behaviour.
import { describe, expect, it } from "vitest";

import { AuditEventContainsPatientDataError } from "@/lib/caring-contacts/audit";
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
import { createInMemoryRepository } from "@/lib/caring-contacts/in-memory-repository";
import type { PathwayVersion } from "@/lib/caring-contacts/pathway-versions";
import type { Actor, CaringContactActor, CaringContactRole, SystemActor } from "@/lib/caring-contacts/permissions";
import {
  REPOSITORY_REFUSALS,
  type CaringContactRepository,
  type CreatePlanInput,
  type EpisodePatientDetail,
  type PlanRecord,
  type WriteContext,
} from "@/lib/caring-contacts/repository";
import { FICTIONAL_CONTACTS_BY_ROLE } from "@/lib/caring-contacts/synthetic-contacts";

import { describeCaringContactRepositoryContract } from "./helpers/caring-contacts-repository-contract";

describeCaringContactRepositoryContract("in-memory", createInMemoryRepository);

// ---------------------------------------------------------------------------
// Task 10: the storage-contract extension for referrals, pathway versions, service state,
// assignment, reconciliation, access trail, preferences, training and retention.
// ---------------------------------------------------------------------------
describe("CaringContactRepository storage extension (Task 10)", () => {
  const clock: Clock = fixedClock("2026-03-02T03:00:00.000Z");

  function actorWith(id: string, team: string, roles: readonly CaringContactRole[]): Actor {
    return { id: actorId(id), teamId: teamId(team), roles };
  }

  const coordinator = actorWith("CC10-ACTOR-1", "CC10-TEAM-NORTH", ["coordinator"]);
  const teamLead = actorWith("CC10-ACTOR-2", "CC10-TEAM-NORTH", ["teamLead"]);
  const auditor = actorWith("CC10-ACTOR-3", "CC10-TEAM-NORTH", ["auditor"]);
  // A second, distinct teamLead -- approveServiceRestart is granted only to teamLead and
  // clinicalProgrammeLead, so a three-distinct-actor restart needs a third body among those two
  // roles.
  const teamLead2 = actorWith("CC10-ACTOR-8", "CC10-TEAM-NORTH", ["teamLead"]);
  const clinicalProgrammeLead = actorWith("CC10-ACTOR-4", "CC10-TEAM-NORTH", ["clinicalProgrammeLead"]);
  const livedExperienceRepresentative = actorWith("CC10-ACTOR-5", "CC10-TEAM-NORTH", ["livedExperienceRepresentative"]);
  const coordinatorB = actorWith("CC10-ACTOR-6", "CC10-TEAM-SOUTH", ["coordinator"]);
  const roleless = actorWith("CC10-ACTOR-7", "CC10-TEAM-NORTH", []);
  const dispatcher: SystemActor = {
    id: actorId("CC10-SYSTEM-DISPATCHER"),
    teamId: teamId("CC10-TEAM-NORTH"),
    systemRole: "contactDispatcher",
  };

  const PATIENT_DETAIL: EpisodePatientDetail = {
    patientName: "Rowan Sample",
    patientMobileNumber: FICTIONAL_CONTACTS_BY_ROLE.rowanPatientMobile,
    patientIdentifiers: ["UR-CC10-0001"],
    culturalIdentity: null,
  };

  function writeContext(actor: CaringContactActor, key: string): WriteContext {
    return { actor, idempotencyKey: idempotencyKey(key) };
  }

  function unwrap<T>(result: { ok: true; value: T } | { ok: false; reason: string }): T {
    if (!result.ok) throw new Error(`expected an accepted write, got refusal "${result.reason}"`);
    return result.value;
  }

  let planCounter = 0;
  /** A store holding one plan already moved to `active`, on a fresh planId/patientId each call. */
  async function createActivePlan(
    store: CaringContactRepository,
    options: { actor?: Actor } = {},
  ): Promise<PlanRecord> {
    planCounter += 1;
    const suffix = String(planCounter);
    const actor = options.actor ?? coordinator;
    const input: CreatePlanInput = {
      planId: planId(`CC10-PLAN-${suffix}`),
      referralId: referralId(`CC10-REFERRAL-${suffix}`),
      patientId: patientId(`CC10-PATIENT-${suffix}`),
      pathwayVersionId: pathwayVersionId("CC10-PATHWAY-SEED"),
      dischargeAt: new Date("2026-03-02T02:00:00.000Z"),
      sendingPreference: "morning",
      patientDetail: PATIENT_DETAIL,
    };
    const created = unwrap(await store.createPlan(input, writeContext(actor, `create-${suffix}`)));
    const activated = unwrap(
      await store.activatePlan(
        { planId: created.plan.id, expectedVersion: created.plan.version },
        writeContext(actor, `activate-${suffix}`),
      ),
    );
    return activated;
  }

  let pathwaySeq = 0;
  function draftPathwayVersion(authorId = coordinator.id): PathwayVersion {
    pathwaySeq += 1;
    return {
      id: pathwayVersionId(`CC10-PATHWAY-${pathwaySeq}`),
      teamId: coordinator.teamId,
      state: "draft",
      authorId,
      approvals: [],
      publishedAt: null,
      retiredAt: null,
      retirementUrgency: null,
      snapshot: {
        cadenceLabels: ["Day 3"],
        messageTextByType: { standard: "Checking in.", first: "Welcome.", closing: "This is our last message." },
      },
    };
  }

  // -------------------------------------------------------------------------
  // Step 1 from the brief, with Ruling 2's replacement test.
  // -------------------------------------------------------------------------
  describe("workspace storage extension", () => {
    it("refuses every ordinary mutation while the service is stopped, and still accepts a death", async () => {
      const store = createInMemoryRepository(clock, {});
      const plan = await createActivePlan(store);

      const stop = await store.stopService(
        { reason: "wrong-recipient", note: "SYN-CONTACT-004 reached the wrong number." },
        writeContext(coordinator, "stop-1"),
      );
      expect(stop.ok).toBe(true);

      const paused = await store.pausePlan(
        { planId: plan.plan.id, expectedVersion: plan.plan.version },
        writeContext(coordinator, "pause-1"),
      );
      expect(paused).toEqual({ ok: false, reason: "service-stopped" });

      const death = await store.recordHospitalStatusEvent(
        { planId: plan.plan.id, expectedVersion: plan.plan.version, event: { type: "death", recordedAt: clock.now() } },
        writeContext(coordinator, "death-1"),
      );
      expect(death.ok).toBe(true);
    });

    it("still reads while the service is stopped", async () => {
      const store = createInMemoryRepository(clock, {});
      const plan = await createActivePlan(store);
      await store.stopService(
        { reason: "duplicate-send", note: "two sends on 2026-08-19" },
        writeContext(coordinator, "stop-2"),
      );
      await expect(store.getPlan(plan.plan.id, { actor: coordinator })).resolves.not.toBeNull();
    });

    it("records a view in the access trail that listAuditEvents never produced", async () => {
      const store = createInMemoryRepository(clock, {});
      const plan = await createActivePlan(store);
      await store.recordAccess({
        actorId: coordinator.id,
        actorRoles: ["coordinator"],
        teamId: coordinator.teamId,
        kind: "view",
        objectType: "plan",
        objectId: plan.plan.id,
        outcome: "allowed",
      });
      const trail = await store.listAccessTrail({ limit: 50, offset: 0 }, { actor: auditor });
      expect(trail.map((event) => event.action)).toContain("access:view:plan");
    });

    it("resolves a dispatch discrepancy without ever resending (Ruling 2)", async () => {
      const store = createInMemoryRepository(clock, {});
      const plan = await createActivePlan(store);
      const contact = (await store.listSendableContacts(plan.plan.id, { actor: coordinator }))[0];
      const dispatched = unwrap(
        await store.startContactDispatch(
          { planId: plan.plan.id, contactId: contact.contact.id, expectedContactVersion: contact.contact.version },
          writeContext(dispatcher, "dispatch-1"),
        ),
      );

      const resolved = await store.resolveDispatchDiscrepancy(
        { contactId: contact.contact.id, attempt: 1, resolution: "unresolvedNoResend", note: "provider outage" },
        writeContext(coordinator, "resolve-1"),
      );
      if (!resolved.ok) throw new Error(resolved.reason);
      expect(resolved.value.discrepancyResolution).toBe("unresolvedNoResend");

      // The contact itself is untouched: same state, same version. There is no method anywhere in
      // this contract that re-dispatches a contact whose status is uncertain -- an
      // `unresolvedNoResend` outcome must never quietly turn into a guessed resend.
      const after = (await store.listContacts(plan.plan.id, { actor: coordinator })).find(
        (stored) => stored.contact.id === contact.contact.id,
      );
      expect(after?.contact.state).toBe(dispatched.contact.state);
      expect(after?.contact.version).toBe(dispatched.contact.version);

      // No second dispatch attempt row was ever opened for this contact.
      const dispatches = await store.listDispatches(
        { fromIso: "2026-01-01T00:00:00.000Z", toIso: "2026-12-31T23:59:59.999Z" },
        { actor: coordinator },
      );
      expect(dispatches.filter((record) => record.contactId === contact.contact.id)).toHaveLength(1);
    });

    it("keeps the reassignment history readable after a reassignment", async () => {
      const store = createInMemoryRepository(clock, {});
      const plan = await createActivePlan(store);
      await store.applyAssignment(
        { planId: plan.plan.id, action: { type: "claim", actorId: coordinator.id } },
        writeContext(coordinator, "claim-1"),
      );
      await store.applyAssignment(
        {
          planId: plan.plan.id,
          action: { type: "reassign", toActorId: actorId("CC10-ACTOR-NEW"), reason: "annual leave" },
        },
        writeContext(teamLead, "reassign-1"),
      );
      const assignment = await store.getAssignment(plan.plan.id, { actor: coordinator });
      expect(assignment?.reassignmentHistory).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Ruling 3: the safety stop is one record for the whole store, never one per team.
  // -------------------------------------------------------------------------
  describe("service safety stop is a store-wide singleton (Ruling 3)", () => {
    it("makes a stop raised by team A block dispatch for a plan owned by team B", async () => {
      const store = createInMemoryRepository(clock, {});
      const planA = await createActivePlan(store, { actor: coordinator });
      const planB = await createActivePlan(store, { actor: coordinatorB });

      await store.stopService(
        { reason: "duplicate-send", note: "Team A saw a duplicate send this morning." },
        writeContext(coordinator, "stop-cross-team"),
      );

      const pausedB = await store.pausePlan(
        { planId: planB.plan.id, expectedVersion: planB.plan.version },
        writeContext(coordinatorB, "pause-b"),
      );
      expect(pausedB).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.serviceStopped });

      const pausedA = await store.pausePlan(
        { planId: planA.plan.id, expectedVersion: planA.plan.version },
        writeContext(coordinator, "pause-a"),
      );
      expect(pausedA).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.serviceStopped });
    });

    it("returns the exact same record to every actor of every team -- one record, not one per team", async () => {
      const store = createInMemoryRepository(clock, {});
      await createActivePlan(store, { actor: coordinator });
      await createActivePlan(store, { actor: coordinatorB });
      await store.stopService(
        { reason: "audit-integrity-loss", note: "trail gap found" },
        writeContext(coordinator, "stop-3"),
      );

      const seenByTeamA = await store.getServiceState({ actor: coordinator });
      const seenByTeamB = await store.getServiceState({ actor: coordinatorB });
      expect(seenByTeamA).toEqual(seenByTeamB);
      expect(seenByTeamA.stopped).toBe(true);
    });

    it("also gates a new write method beyond pausePlan, proving the gate is not method-specific", async () => {
      const store = createInMemoryRepository(clock, {});
      const plan = await createActivePlan(store);
      await store.stopService(
        { reason: "unauthorised-content", note: "unapproved wording sent" },
        writeContext(coordinator, "stop-4"),
      );

      const claim = await store.applyAssignment(
        { planId: plan.plan.id, action: { type: "claim", actorId: coordinator.id } },
        writeContext(coordinator, "claim-blocked"),
      );
      expect(claim).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.serviceStopped });

      const prefs = await store.saveNotificationPreferences(
        { actorId: coordinator.id, optedIn: ["serviceSafetyStop"] },
        writeContext(coordinator, "prefs-blocked"),
      );
      expect(prefs).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.serviceStopped });
    });
  });

  // -------------------------------------------------------------------------
  // Service safety stop lifecycle: stopService / approveServiceRestart refusals.
  // -------------------------------------------------------------------------
  describe("stopService and approveServiceRestart", () => {
    it("refuses a second stop while one is already recorded", async () => {
      const store = createInMemoryRepository(clock, {});
      const first = await store.stopService(
        { reason: "wrong-recipient", note: "first incident" },
        writeContext(coordinator, "s1"),
      );
      expect(first.ok).toBe(true);

      const second = await store.stopService(
        { reason: "duplicate-send", note: "second incident" },
        writeContext(teamLead, "s2"),
      );
      expect(second).toEqual({ ok: false, reason: "service-already-stopped" });
    });

    it("refuses a blank note on the first stop", async () => {
      const store = createInMemoryRepository(clock, {});
      const stop = await store.stopService(
        { reason: "wrong-recipient", note: "  " },
        writeContext(coordinator, "s-blank"),
      );
      expect(stop).toEqual({ ok: false, reason: "service-stop-note-required" });
    });

    it("refuses stopService for an actor without triggerServiceSafetyStop (the dispatcher)", async () => {
      const store = createInMemoryRepository(clock, {});
      const stop = await store.stopService(
        { reason: "wrong-recipient", note: "n/a" },
        writeContext(dispatcher, "s-dispatcher"),
      );
      expect(stop).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.permissionDenied });
    });

    it("requires all three distinct roles from three distinct actors before restarting, then restarts on the third", async () => {
      const store = createInMemoryRepository(clock, {});
      await store.stopService({ reason: "wrong-recipient", note: "incident" }, writeContext(coordinator, "s-restart"));

      const first = unwrap(
        await store.approveServiceRestart({ role: "incidentLead" }, writeContext(teamLead, "approve-1")),
      );
      expect(first.stopped).toBe(true);

      // Same role again is refused, even from a different actor.
      const sameRole = await store.approveServiceRestart(
        { role: "incidentLead" },
        writeContext(clinicalProgrammeLead, "approve-same-role"),
      );
      expect(sameRole).toEqual({ ok: false, reason: "restart-approval-role-already-recorded" });

      // The same actor cannot supply a second approval under a different role.
      const sameActor = await store.approveServiceRestart(
        { role: "privacySecurityOwner" },
        writeContext(teamLead, "approve-same-actor"),
      );
      expect(sameActor).toEqual({ ok: false, reason: "restart-approval-actor-already-recorded" });

      const second = unwrap(
        await store.approveServiceRestart(
          { role: "privacySecurityOwner" },
          writeContext(clinicalProgrammeLead, "approve-2"),
        ),
      );
      expect(second.stopped).toBe(true);

      const third = unwrap(
        await store.approveServiceRestart({ role: "clinicalProgrammeLead" }, writeContext(teamLead2, "approve-3")),
      );
      expect(third.stopped).toBe(false);

      // Once running again, an ordinary write is no longer blocked.
      const plan = await createActivePlan(store);
      const paused = await store.pausePlan(
        { planId: plan.plan.id, expectedVersion: plan.plan.version },
        writeContext(coordinator, "pause-after-restart"),
      );
      expect(paused.ok).toBe(true);
    });

    it("refuses a restart approval while the service is running", async () => {
      const store = createInMemoryRepository(clock, {});
      const approval = await store.approveServiceRestart(
        { role: "incidentLead" },
        writeContext(teamLead, "approve-not-stopped"),
      );
      expect(approval).toEqual({ ok: false, reason: "service-not-stopped" });
    });

    it("refuses approveServiceRestart for an actor without the grant (coordinator)", async () => {
      const store = createInMemoryRepository(clock, {});
      await store.stopService({ reason: "wrong-recipient", note: "incident" }, writeContext(coordinator, "s-perm"));
      const approval = await store.approveServiceRestart(
        { role: "incidentLead" },
        writeContext(coordinator, "approve-perm"),
      );
      expect(approval).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.permissionDenied });
    });

    it("does not poison the idempotency key with a service-stopped refusal -- the same retry succeeds after the restart", async () => {
      const store = createInMemoryRepository(clock, {});
      const plan = await createActivePlan(store);
      await store.stopService(
        { reason: "duplicate-send", note: "a duplicate send was seen this morning" },
        writeContext(coordinator, "s-poison"),
      );

      const refused = await store.pausePlan(
        { planId: plan.plan.id, expectedVersion: plan.plan.version },
        writeContext(coordinator, "pause-retry"),
      );
      expect(refused).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.serviceStopped });

      unwrap(await store.approveServiceRestart({ role: "incidentLead" }, writeContext(teamLead, "poison-approve-1")));
      unwrap(
        await store.approveServiceRestart(
          { role: "privacySecurityOwner" },
          writeContext(clinicalProgrammeLead, "poison-approve-2"),
        ),
      );
      const restarted = unwrap(
        await store.approveServiceRestart(
          { role: "clinicalProgrammeLead" },
          writeContext(teamLead2, "poison-approve-3"),
        ),
      );
      expect(restarted.stopped).toBe(false);

      // The SAME key as the refused attempt. Idempotency keys are stable across retries, so a
      // remembered service-stop refusal would refuse this write forever with a reason that is no
      // longer true -- and the resume path is the entire point of a safety stop.
      const retried = await store.pausePlan(
        { planId: plan.plan.id, expectedVersion: plan.plan.version },
        writeContext(coordinator, "pause-retry"),
      );
      expect(retried.ok).toBe(true);
    });

    it("still replays every OTHER refusal against the same key, even once its cause is gone", async () => {
      const store = createInMemoryRepository(clock, {});
      const late = planId("CC10-PLAN-LATE");

      const refused = await store.markRetentionCleared({ planId: late }, writeContext(coordinator, "late-key"));
      expect(refused).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.notFound });

      unwrap(
        await store.createPlan(
          {
            planId: late,
            referralId: referralId("CC10-REFERRAL-LATE"),
            patientId: patientId("CC10-PATIENT-LATE"),
            pathwayVersionId: pathwayVersionId("CC10-PATHWAY-SEED"),
            dischargeAt: new Date("2026-03-02T02:00:00.000Z"),
            sendingPreference: "morning",
            patientDetail: PATIENT_DETAIL,
          },
          writeContext(coordinator, "late-create"),
        ),
      );

      // The plan exists now, but this key already has an answer: replaying it returns the ORIGINAL
      // refusal rather than recomputing one. Only `service-stopped` is exempt from that.
      const replay = await store.markRetentionCleared({ planId: late }, writeContext(coordinator, "late-key"));
      expect(replay).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.notFound });
    });
  });

  // -------------------------------------------------------------------------
  // Referrals
  // -------------------------------------------------------------------------
  describe("referrals", () => {
    it("creates a referral, refuses a duplicate id, and refuses a role without the grant", async () => {
      const store = createInMemoryRepository(clock, {});
      const created = unwrap(
        await store.createReferral(
          { referralId: referralId("CC10-REF-1"), patientId: patientId("CC10-PAT-1") },
          writeContext(coordinator, "cr-1"),
        ),
      );
      expect(created.state).toBe("awaitingHandover");

      const duplicate = await store.createReferral(
        { referralId: referralId("CC10-REF-1"), patientId: patientId("CC10-PAT-2") },
        writeContext(coordinator, "cr-2"),
      );
      expect(duplicate).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.referralAlreadyExists });

      const denied = await store.createReferral(
        { referralId: referralId("CC10-REF-2"), patientId: patientId("CC10-PAT-3") },
        writeContext(auditor, "cr-3"),
      );
      expect(denied).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.permissionDenied });
    });

    it("accepts a referral onto a pathway version, and refuses an unknown referral id", async () => {
      const store = createInMemoryRepository(clock, {});
      await store.createReferral(
        { referralId: referralId("CC10-REF-3"), patientId: patientId("CC10-PAT-4") },
        writeContext(coordinator, "cr-4"),
      );

      const accepted = unwrap(
        await store.transitionReferral(
          {
            referralId: referralId("CC10-REF-3"),
            action: { type: "accept", pathwayVersionId: pathwayVersionId("CC10-PATHWAY-SEED") },
          },
          writeContext(coordinator, "tr-1"),
        ),
      );
      expect(accepted.state).toBe("accepted");
      expect(accepted.pathwayVersionId).toBe(pathwayVersionId("CC10-PATHWAY-SEED"));

      const missing = await store.transitionReferral(
        { referralId: referralId("CC10-REF-UNKNOWN"), action: { type: "decline", reason: "not eligible" } },
        writeContext(coordinator, "tr-2"),
      );
      expect(missing).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.notFound });
    });

    it("refuses re-accepting a referral already accepted, and a blank decline reason", async () => {
      const store = createInMemoryRepository(clock, {});
      await store.createReferral(
        { referralId: referralId("CC10-REF-5"), patientId: patientId("CC10-PAT-5") },
        writeContext(coordinator, "cr-5"),
      );
      await store.transitionReferral(
        {
          referralId: referralId("CC10-REF-5"),
          action: { type: "accept", pathwayVersionId: pathwayVersionId("CC10-PATHWAY-SEED") },
        },
        writeContext(coordinator, "tr-3"),
      );

      const reaccept = await store.transitionReferral(
        {
          referralId: referralId("CC10-REF-5"),
          action: { type: "accept", pathwayVersionId: pathwayVersionId("CC10-PATHWAY-SEED") },
        },
        writeContext(coordinator, "tr-4"),
      );
      expect(reaccept).toEqual({ ok: false, reason: "referral-not-awaiting-handover" });

      await store.createReferral(
        { referralId: referralId("CC10-REF-6"), patientId: patientId("CC10-PAT-6") },
        writeContext(coordinator, "cr-6"),
      );
      const blankDecline = await store.transitionReferral(
        { referralId: referralId("CC10-REF-6"), action: { type: "decline", reason: "  " } },
        writeContext(coordinator, "tr-5"),
      );
      expect(blankDecline).toEqual({ ok: false, reason: "referral-reason-required" });
    });

    it("scopes listReferrals to the actor's own team and the viewReferral grant", async () => {
      const store = createInMemoryRepository(clock, {});
      await store.createReferral(
        { referralId: referralId("CC10-REF-7"), patientId: patientId("CC10-PAT-7") },
        writeContext(coordinator, "cr-7"),
      );

      expect(await store.listReferrals({ actor: coordinator })).toHaveLength(1);
      expect(await store.listReferrals({ actor: coordinatorB })).toEqual([]);
      expect(await store.listReferrals({ actor: auditor })).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Pathway versions
  // -------------------------------------------------------------------------
  describe("pathway versions", () => {
    it("saves a version, refuses a duplicate id, and refuses a role without authorPathwayVersion", async () => {
      const store = createInMemoryRepository(clock, {});
      const version = draftPathwayVersion();
      const saved = unwrap(await store.savePathwayVersion({ version }, writeContext(coordinator, "sv-1")));
      expect(saved.state).toBe("draft");

      const duplicate = await store.savePathwayVersion({ version }, writeContext(coordinator, "sv-2"));
      expect(duplicate).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.pathwayVersionAlreadyExists });

      const denied = await store.savePathwayVersion({ version: draftPathwayVersion() }, writeContext(auditor, "sv-3"));
      expect(denied).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.permissionDenied });
    });

    it("carries a version through submit, dual approval, publish and retirement", async () => {
      const store = createInMemoryRepository(clock, {});
      const version = draftPathwayVersion(teamLead.id);
      await store.savePathwayVersion({ version }, writeContext(teamLead, "sv-4"));

      const submitted = unwrap(
        await store.transitionPathwayVersion(
          { pathwayVersionId: version.id, action: { type: "submitForReview" } },
          writeContext(teamLead, "pv-1"),
        ),
      );
      expect(submitted.state).toBe("inReview");

      // The author holds approvePathwayVersion too, but may not approve their own version.
      const selfApproval = await store.transitionPathwayVersion(
        {
          pathwayVersionId: version.id,
          action: { type: "approve", role: "clinicalProgrammeLead", actorId: teamLead.id },
        },
        writeContext(teamLead, "pv-2"),
      );
      expect(selfApproval).toEqual({ ok: false, reason: "self-approval-denied" });

      const firstApproval = unwrap(
        await store.transitionPathwayVersion(
          {
            pathwayVersionId: version.id,
            action: { type: "approve", role: "clinicalProgrammeLead", actorId: clinicalProgrammeLead.id },
          },
          writeContext(clinicalProgrammeLead, "pv-3"),
        ),
      );
      expect(firstApproval.state).toBe("inReview");

      const secondApproval = unwrap(
        await store.transitionPathwayVersion(
          {
            pathwayVersionId: version.id,
            action: {
              type: "approve",
              role: "livedExperienceRepresentative",
              actorId: livedExperienceRepresentative.id,
            },
          },
          writeContext(livedExperienceRepresentative, "pv-4"),
        ),
      );
      expect(secondApproval.state).toBe("approved");

      // publishPathwayVersion is granted to the clinical programme lead only.
      const publishDenied = await store.transitionPathwayVersion(
        { pathwayVersionId: version.id, action: { type: "publish", actorId: teamLead.id } },
        writeContext(teamLead, "pv-5"),
      );
      expect(publishDenied).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.permissionDenied });

      const published = unwrap(
        await store.transitionPathwayVersion(
          { pathwayVersionId: version.id, action: { type: "publish", actorId: clinicalProgrammeLead.id } },
          writeContext(clinicalProgrammeLead, "pv-6"),
        ),
      );
      expect(published.publishedAt).toMatch(/\+08:00$/);

      const retired = unwrap(
        await store.transitionPathwayVersion(
          { pathwayVersionId: version.id, action: { type: "retire", urgency: "routine" } },
          writeContext(teamLead, "pv-7"),
        ),
      );
      expect(retired.state).toBe("retired");
    });

    it("refuses transitioning an unknown pathway version id and an approve made before submission", async () => {
      const store = createInMemoryRepository(clock, {});
      const missing = await store.transitionPathwayVersion(
        { pathwayVersionId: pathwayVersionId("CC10-PATHWAY-MISSING"), action: { type: "submitForReview" } },
        writeContext(coordinator, "pv-8"),
      );
      expect(missing).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.notFound });

      const version = draftPathwayVersion();
      await store.savePathwayVersion({ version }, writeContext(coordinator, "sv-5"));
      const earlyApprove = await store.transitionPathwayVersion(
        {
          pathwayVersionId: version.id,
          action: { type: "approve", role: "clinicalProgrammeLead", actorId: clinicalProgrammeLead.id },
        },
        writeContext(clinicalProgrammeLead, "pv-9"),
      );
      expect(earlyApprove).toEqual({ ok: false, reason: "pathway-not-in-review" });
    });

    it("scopes getPathwayVersion/listPathwayVersions to the team, visible to author or approver roles, not the auditor", async () => {
      const store = createInMemoryRepository(clock, {});
      const version = draftPathwayVersion();
      await store.savePathwayVersion({ version }, writeContext(coordinator, "sv-6"));

      expect(await store.getPathwayVersion(version.id, { actor: coordinator })).not.toBeNull();
      expect(await store.getPathwayVersion(version.id, { actor: clinicalProgrammeLead })).not.toBeNull();
      expect(await store.getPathwayVersion(version.id, { actor: auditor })).toBeNull();
      expect(await store.getPathwayVersion(version.id, { actor: coordinatorB })).toBeNull();
      expect(await store.getPathwayVersion(pathwayVersionId("CC10-NOPE"), { actor: coordinator })).toBeNull();

      expect(await store.listPathwayVersions({ actor: coordinator })).toHaveLength(1);
      expect(await store.listPathwayVersions({ actor: auditor })).toEqual([]);
    });

    // ---- Ruling 14: a save persists authored content, never governance. ----
    it("persists authored content only -- state, approvals, authorId and publication are constructed server-side (Ruling 14)", async () => {
      const store = createInMemoryRepository(clock, {});
      const forged: PathwayVersion = {
        ...draftPathwayVersion(),
        // Everything one actor holding authorPathwayVersion might try to seed past the governance
        // lifecycle in a single call. `approved` is the state that actually lands the exploit:
        // publication is not a state of its own, so an approved version publishes on a
        // `publishedAt` alone -- see ./pathway-versions.
        state: "approved",
        authorId: teamLead.id,
        approvals: [
          { role: "clinicalProgrammeLead", actorId: clinicalProgrammeLead.id, approvedAt: "2026-03-02T11:00:00+08:00" },
          {
            role: "livedExperienceRepresentative",
            actorId: livedExperienceRepresentative.id,
            approvedAt: "2026-03-02T11:00:00+08:00",
          },
        ],
        publishedAt: "2026-03-02T11:00:00+08:00",
        retiredAt: "2026-03-02T12:00:00+08:00",
        retirementUrgency: "urgentSafety",
      };

      const saved = unwrap(await store.savePathwayVersion({ version: forged }, writeContext(coordinator, "sv-forged")));
      expect(saved.state).toBe("draft");
      expect(saved.approvals).toEqual([]);
      expect(saved.authorId).toBe(coordinator.id);
      expect(saved.publishedAt).toBeNull();
      expect(saved.retiredAt).toBeNull();
      expect(saved.retirementUrgency).toBeNull();
      // The authored content itself is kept verbatim: this write persists content, not governance.
      expect(saved.snapshot).toEqual(forged.snapshot);

      // The stored record says the same, not merely the copy that came back.
      const stored = await store.getPathwayVersion(forged.id, { actor: coordinator });
      expect(stored?.state).toBe("draft");
      expect(stored?.approvals).toEqual([]);
      expect(stored?.authorId).toBe(coordinator.id);
      expect(stored?.publishedAt).toBeNull();
    });

    it("refuses to publish a version a caller tried to seed as already approved -- dual approval is not bypassable by a save", async () => {
      const store = createInMemoryRepository(clock, {});
      const forged: PathwayVersion = {
        ...draftPathwayVersion(),
        state: "approved",
        approvals: [
          { role: "clinicalProgrammeLead", actorId: clinicalProgrammeLead.id, approvedAt: "2026-03-02T11:00:00+08:00" },
          {
            role: "livedExperienceRepresentative",
            actorId: livedExperienceRepresentative.id,
            approvedAt: "2026-03-02T11:00:00+08:00",
          },
        ],
      };
      unwrap(await store.savePathwayVersion({ version: forged }, writeContext(coordinator, "sv-forged-2")));

      const published = await store.transitionPathwayVersion(
        { pathwayVersionId: forged.id, action: { type: "publish", actorId: clinicalProgrammeLead.id } },
        writeContext(clinicalProgrammeLead, "pv-forged-publish"),
      );
      expect(published).toEqual({ ok: false, reason: "pathway-not-approved" });
    });
  });

  // -------------------------------------------------------------------------
  // Assignment
  // -------------------------------------------------------------------------
  describe("assignment", () => {
    it("refuses claiming an already-claimed plan, reassigning an unclaimed one, and a blank reassignment reason", async () => {
      const store = createInMemoryRepository(clock, {});
      const plan = await createActivePlan(store);

      const reassignUnclaimed = await store.applyAssignment(
        { planId: plan.plan.id, action: { type: "reassign", toActorId: teamLead.id, reason: "cover" } },
        writeContext(teamLead, "aa-1"),
      );
      expect(reassignUnclaimed).toEqual({ ok: false, reason: "plan-not-claimed" });

      unwrap(
        await store.applyAssignment(
          { planId: plan.plan.id, action: { type: "claim", actorId: coordinator.id } },
          writeContext(coordinator, "aa-2"),
        ),
      );

      const reclaim = await store.applyAssignment(
        { planId: plan.plan.id, action: { type: "claim", actorId: teamLead.id } },
        writeContext(teamLead, "aa-3"),
      );
      expect(reclaim).toEqual({ ok: false, reason: "plan-already-claimed" });

      const blankReason = await store.applyAssignment(
        { planId: plan.plan.id, action: { type: "reassign", toActorId: teamLead.id, reason: "  " } },
        writeContext(teamLead, "aa-4"),
      );
      expect(blankReason).toEqual({ ok: false, reason: "reassignment-reason-required" });
    });

    it("refuses reassignPlan for a role that lacks the grant, and an inverted coverage window", async () => {
      const store = createInMemoryRepository(clock, {});
      const plan = await createActivePlan(store);
      await store.applyAssignment(
        { planId: plan.plan.id, action: { type: "claim", actorId: coordinator.id } },
        writeContext(coordinator, "aa-5"),
      );

      const deniedReassign = await store.applyAssignment(
        { planId: plan.plan.id, action: { type: "reassign", toActorId: teamLead.id, reason: "leave" } },
        writeContext(coordinator, "aa-6"),
      );
      expect(deniedReassign).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.permissionDenied });

      const invertedWindow = await store.applyAssignment(
        {
          planId: plan.plan.id,
          action: { type: "startCoverage", actorId: teamLead.id, from: "2026-03-10", until: "2026-03-05" },
        },
        writeContext(teamLead, "aa-7"),
      );
      expect(invertedWindow).toEqual({ ok: false, reason: "coverage-window-invalid" });
    });

    it("refuses an unknown plan and returns null/unassigned for reads", async () => {
      const store = createInMemoryRepository(clock, {});
      const missing = await store.applyAssignment(
        { planId: planId("CC10-PLAN-MISSING"), action: { type: "claim", actorId: coordinator.id } },
        writeContext(coordinator, "aa-8"),
      );
      expect(missing).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.notFound });

      expect(await store.getAssignment(planId("CC10-PLAN-MISSING"), { actor: coordinator })).toBeNull();

      const plan = await createActivePlan(store);
      expect(await store.getAssignment(plan.plan.id, { actor: coordinator })).toEqual({
        ownerId: null,
        claimedAt: null,
        coveredBy: null,
        reassignmentHistory: [],
      });
      expect(await store.getAssignment(plan.plan.id, { actor: coordinatorB })).toBeNull();
    });

    it("refuses a claim that names an actor other than the caller, so the ledger and the audit trail cannot disagree", async () => {
      const store = createInMemoryRepository(clock, {});
      const plan = await createActivePlan(store);

      // The audit event names the caller. If the ledger were allowed to name somebody else, the
      // two records of "who took this work" would contradict each other.
      const impersonated = await store.applyAssignment(
        { planId: plan.plan.id, action: { type: "claim", actorId: teamLead.id } },
        writeContext(coordinator, "claim-impersonate"),
      );
      expect(impersonated).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.permissionDenied });
      expect(await store.getAssignment(plan.plan.id, { actor: coordinator })).toMatchObject({ ownerId: null });

      const own = unwrap(
        await store.applyAssignment(
          { planId: plan.plan.id, action: { type: "claim", actorId: coordinator.id } },
          writeContext(coordinator, "claim-own"),
        ),
      );
      expect(own.ownerId).toBe(coordinator.id);
    });

    it("still lets coverage and reassignment name a third party, which is the whole point of both", async () => {
      const store = createInMemoryRepository(clock, {});
      const plan = await createActivePlan(store);
      unwrap(
        await store.applyAssignment(
          { planId: plan.plan.id, action: { type: "claim", actorId: coordinator.id } },
          writeContext(coordinator, "third-claim"),
        ),
      );

      const covered = unwrap(
        await store.applyAssignment(
          {
            planId: plan.plan.id,
            action: { type: "startCoverage", actorId: teamLead2.id, from: "2026-03-03", until: "2026-03-10" },
          },
          writeContext(teamLead, "third-cover"),
        ),
      );
      expect(covered.coveredBy?.actorId).toBe(teamLead2.id);

      const reassigned = unwrap(
        await store.applyAssignment(
          {
            planId: plan.plan.id,
            action: { type: "reassign", toActorId: actorId("CC10-ACTOR-COVER"), reason: "annual leave" },
          },
          writeContext(teamLead, "third-reassign"),
        ),
      );
      expect(reassigned.ownerId).toBe(actorId("CC10-ACTOR-COVER"));
    });
  });

  // -------------------------------------------------------------------------
  // Reads must not hand out a live internal reference: a caller holding one could rewrite plan
  // ownership or a live incident's account in place, with no version bump and no audit event.
  // -------------------------------------------------------------------------
  describe("reads hand back something a caller cannot rewrite in place", () => {
    it("returns a copy from getAssignment, so plan ownership cannot be rewritten without a write", async () => {
      const store = createInMemoryRepository(clock, {});
      const plan = await createActivePlan(store);
      unwrap(
        await store.applyAssignment(
          { planId: plan.plan.id, action: { type: "claim", actorId: coordinator.id } },
          writeContext(coordinator, "copy-claim"),
        ),
      );
      unwrap(
        await store.applyAssignment(
          {
            planId: plan.plan.id,
            action: { type: "startCoverage", actorId: teamLead2.id, from: "2026-03-03", until: "2026-03-10" },
          },
          writeContext(teamLead, "copy-cover"),
        ),
      );

      const first = await store.getAssignment(plan.plan.id, { actor: coordinator });
      if (first === null) throw new Error("expected an assignment");
      first.ownerId = actorId("CC10-ACTOR-IMPOSTER");
      first.claimedAt = "1970-01-01T08:00:00+08:00";
      if (first.coveredBy !== null) first.coveredBy.actorId = actorId("CC10-ACTOR-IMPOSTER");

      const second = await store.getAssignment(plan.plan.id, { actor: coordinator });
      expect(second?.ownerId).toBe(coordinator.id);
      expect(second?.claimedAt).not.toBe("1970-01-01T08:00:00+08:00");
      expect(second?.coveredBy?.actorId).toBe(teamLead2.id);
    });

    it("returns a service state a caller cannot rewrite in place", async () => {
      const store = createInMemoryRepository(clock, {});
      unwrap(
        await store.stopService(
          { reason: "wrong-recipient", note: "the original account of the incident" },
          writeContext(coordinator, "copy-stop"),
        ),
      );

      const first = await store.getServiceState({ actor: coordinator });
      expect(Object.isFrozen(first)).toBe(true);
      if (!first.stopped) throw new Error("expected a stopped service");
      expect(Object.isFrozen(first.restartApprovals)).toBe(true);

      const second = await store.getServiceState({ actor: auditor });
      if (!second.stopped) throw new Error("expected a stopped service");
      expect(second.note).toBe("the original account of the incident");
      expect(second.stoppedBy).toBe(coordinator.id);
      expect(second.reason).toBe("wrong-recipient");
    });
  });

  // -------------------------------------------------------------------------
  // Contact rescheduling — Ruling 1's addition.
  // -------------------------------------------------------------------------
  describe("rescheduleContact (Ruling 1)", () => {
    it("moves a contact within its scheduled day, bumping its version", async () => {
      const store = createInMemoryRepository(clock, {});
      const plan = await createActivePlan(store);
      const contact = (await store.listSendableContacts(plan.plan.id, { actor: coordinator }))[0];

      const moved = unwrap(
        await store.rescheduleContact(
          {
            planId: plan.plan.id,
            contactId: contact.contact.id,
            expectedContactVersion: contact.contact.version,
            change: { contact: contact.planned, toHour: 14, toMinute: 30 },
          },
          writeContext(coordinator, "rc-1"),
        ),
      );
      expect(moved.planned.calendarDay).toBe(contact.planned.calendarDay);
      expect(moved.planned.sendAt.getUTCHours()).toBe(14 - 8);
      expect(moved.contact.version).toBe(contact.contact.version + 1);
    });

    it("refuses a move that leaves the scheduled day or the approved window", async () => {
      const store = createInMemoryRepository(clock, {});
      const plan = await createActivePlan(store);
      const contact = (await store.listSendableContacts(plan.plan.id, { actor: coordinator }))[0];

      const outsideWindow = await store.rescheduleContact(
        {
          planId: plan.plan.id,
          contactId: contact.contact.id,
          expectedContactVersion: contact.contact.version,
          change: { contact: contact.planned, toHour: 20, toMinute: 0 },
        },
        writeContext(coordinator, "rc-2"),
      );
      expect(outsideWindow).toEqual({ ok: false, reason: "contact-move-outside-approved-window" });
    });

    it("changes a contact's date only with a reason and a team-lead approval, refusing a blank reason or a missing approval", async () => {
      const store = createInMemoryRepository(clock, {});
      const plan = await createActivePlan(store);
      const contact = (await store.listSendableContacts(plan.plan.id, { actor: coordinator }))[0];
      const targetDay = "2026-03-20";

      const blankReason = await store.rescheduleContact(
        {
          planId: plan.plan.id,
          contactId: contact.contact.id,
          expectedContactVersion: contact.contact.version,
          change: {
            contact: contact.planned,
            toCalendarDay: targetDay,
            reason: "  ",
            teamLeadApprovalActorId: teamLead.id,
          },
        },
        writeContext(teamLead, "rc-3"),
      );
      expect(blankReason).toEqual({ ok: false, reason: "contact-date-change-reason-required" });

      const missingApproval = await store.rescheduleContact(
        {
          planId: plan.plan.id,
          contactId: contact.contact.id,
          expectedContactVersion: contact.contact.version,
          change: {
            contact: contact.planned,
            toCalendarDay: targetDay,
            reason: "patient request",
            teamLeadApprovalActorId: null,
          },
        },
        writeContext(teamLead, "rc-4"),
      );
      expect(missingApproval).toEqual({ ok: false, reason: "contact-date-change-approval-required" });

      const changed = unwrap(
        await store.rescheduleContact(
          {
            planId: plan.plan.id,
            contactId: contact.contact.id,
            expectedContactVersion: contact.contact.version,
            change: {
              contact: contact.planned,
              toCalendarDay: targetDay,
              reason: "patient request",
              teamLeadApprovalActorId: teamLead.id,
            },
          },
          writeContext(teamLead, "rc-5"),
        ),
      );
      expect(changed.planned.calendarDay).toBe(targetDay);
    });

    it("refuses a coordinator changing a contact's date -- only changeContactDate holders may", async () => {
      const store = createInMemoryRepository(clock, {});
      const plan = await createActivePlan(store);
      const contact = (await store.listSendableContacts(plan.plan.id, { actor: coordinator }))[0];

      const denied = await store.rescheduleContact(
        {
          planId: plan.plan.id,
          contactId: contact.contact.id,
          expectedContactVersion: contact.contact.version,
          change: {
            contact: contact.planned,
            toCalendarDay: "2026-03-20",
            reason: "cover",
            teamLeadApprovalActorId: teamLead.id,
          },
        },
        writeContext(coordinator, "rc-6"),
      );
      expect(denied).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.permissionDenied });
    });

    it("refuses a stale contact version", async () => {
      const store = createInMemoryRepository(clock, {});
      const plan = await createActivePlan(store);
      const contact = (await store.listSendableContacts(plan.plan.id, { actor: coordinator }))[0];

      const stale = await store.rescheduleContact(
        {
          planId: plan.plan.id,
          contactId: contact.contact.id,
          expectedContactVersion: contact.contact.version + 5,
          change: { contact: contact.planned, toHour: 11, toMinute: 0 },
        },
        writeContext(coordinator, "rc-7"),
      );
      expect(stale).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.staleVersion });
    });
  });

  // -------------------------------------------------------------------------
  // Dispatch reconciliation beyond the Ruling-2 test above.
  // -------------------------------------------------------------------------
  describe("dispatch reconciliation", () => {
    async function dispatchedContact(store: CaringContactRepository) {
      const plan = await createActivePlan(store);
      const contact = (await store.listSendableContacts(plan.plan.id, { actor: coordinator }))[0];
      await store.startContactDispatch(
        { planId: plan.plan.id, contactId: contact.contact.id, expectedContactVersion: contact.contact.version },
        writeContext(dispatcher, `dispatch-${contact.contact.id}`),
      );
      return { plan, contact };
    }

    it("refuses resolving an unknown attempt, a role without reconcileProviderDispatch, a blank note, and a repeat resolution", async () => {
      const store = createInMemoryRepository(clock, {});
      const { contact } = await dispatchedContact(store);

      const missing = await store.resolveDispatchDiscrepancy(
        { contactId: contact.contact.id, attempt: 99, resolution: "confirmedDelivered", note: "n/a" },
        writeContext(coordinator, "rd-1"),
      );
      expect(missing).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.notFound });

      const denied = await store.resolveDispatchDiscrepancy(
        { contactId: contact.contact.id, attempt: 1, resolution: "confirmedDelivered", note: "confirmed via portal" },
        writeContext(auditor, "rd-2"),
      );
      expect(denied).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.permissionDenied });

      const blankNote = await store.resolveDispatchDiscrepancy(
        { contactId: contact.contact.id, attempt: 1, resolution: "confirmedDelivered", note: " " },
        writeContext(coordinator, "rd-3"),
      );
      expect(blankNote).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.dispatchDiscrepancyNoteRequired });

      const resolved = unwrap(
        await store.resolveDispatchDiscrepancy(
          { contactId: contact.contact.id, attempt: 1, resolution: "confirmedDelivered", note: "confirmed via portal" },
          writeContext(coordinator, "rd-4"),
        ),
      );
      expect(resolved.discrepancyResolution).toBe("confirmedDelivered");

      const repeat = await store.resolveDispatchDiscrepancy(
        { contactId: contact.contact.id, attempt: 1, resolution: "confirmedNotDelivered", note: "changed my mind" },
        writeContext(coordinator, "rd-5"),
      );
      expect(repeat).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.dispatchDiscrepancyAlreadyResolved });
    });

    it("scopes listDispatches to the actor's team and the reconcileProviderDispatch grant", async () => {
      const store = createInMemoryRepository(clock, {});
      await dispatchedContact(store);

      const wideRange = { fromIso: "2020-01-01T00:00:00.000Z", toIso: "2030-01-01T00:00:00.000Z" };
      expect(await store.listDispatches(wideRange, { actor: coordinator })).toHaveLength(1);
      expect(await store.listDispatches(wideRange, { actor: coordinatorB })).toEqual([]);
      expect(await store.listDispatches(wideRange, { actor: auditor })).toEqual([]);

      const narrowRange = { fromIso: "2020-01-01T00:00:00.000Z", toIso: "2020-01-02T00:00:00.000Z" };
      expect(await store.listDispatches(narrowRange, { actor: coordinator })).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Access trail
  // -------------------------------------------------------------------------
  describe("access trail", () => {
    it("throws rather than record a non-identifier-shaped objectId (a search term or a name)", async () => {
      const store = createInMemoryRepository(clock, {});
      await expect(
        store.recordAccess({
          actorId: coordinator.id,
          actorRoles: ["coordinator"],
          teamId: coordinator.teamId,
          kind: "search",
          objectType: "patientDirectory",
          objectId: "Rowan Sample",
          outcome: "allowed",
        }),
      ).rejects.toThrow(AuditEventContainsPatientDataError);
    });

    it("still records access while the service is stopped -- the trail must not go dark mid-incident", async () => {
      const store = createInMemoryRepository(clock, {});
      const plan = await createActivePlan(store);
      await store.stopService(
        { reason: "audit-integrity-loss", note: "trail gap" },
        writeContext(coordinator, "s-access"),
      );

      await store.recordAccess({
        actorId: auditor.id,
        actorRoles: ["auditor"],
        teamId: auditor.teamId,
        kind: "view",
        objectType: "plan",
        objectId: plan.plan.id,
        outcome: "allowed",
      });

      const trail = await store.listAccessTrail({ limit: 10, offset: 0 }, { actor: auditor });
      expect(trail.some((event) => event.action === "access:view:plan")).toBe(true);
    });

    it("scopes listAccessTrail to viewAccessTrail (the auditor), returning empty for a coordinator", async () => {
      const store = createInMemoryRepository(clock, {});
      const plan = await createActivePlan(store);
      await store.recordAccess({
        actorId: coordinator.id,
        actorRoles: ["coordinator"],
        teamId: coordinator.teamId,
        kind: "view",
        objectType: "plan",
        objectId: plan.plan.id,
        outcome: "allowed",
      });

      expect(await store.listAccessTrail({ limit: 10, offset: 0 }, { actor: coordinator })).toEqual([]);
      // Naming the recorded access, not merely counting: the plan writes above already put events
      // in this trail, so a non-empty count alone would pass without the access ever being visible.
      const auditorTrail = await store.listAccessTrail({ limit: 10, offset: 0 }, { actor: auditor });
      expect(auditorTrail.map((event) => event.action)).toContain("access:view:plan");
    });

    it("applies the objectType and limit/offset filters", async () => {
      const store = createInMemoryRepository(clock, {});
      const plan = await createActivePlan(store);
      for (let i = 0; i < 3; i += 1) {
        await store.recordAccess({
          actorId: auditor.id,
          actorRoles: ["auditor"],
          teamId: auditor.teamId,
          kind: "view",
          objectType: "plan",
          objectId: plan.plan.id,
          outcome: "allowed",
        });
      }
      await store.recordAccess({
        actorId: auditor.id,
        actorRoles: ["auditor"],
        teamId: auditor.teamId,
        kind: "search",
        objectType: "patientDirectory",
        objectId: "patientDirectory",
        outcome: "allowed",
      });

      const onlyDirectory = await store.listAccessTrail(
        { limit: 10, offset: 0, objectType: "patientDirectory" },
        { actor: auditor },
      );
      expect(onlyDirectory).toHaveLength(1);

      const firstOfTwo = await store.listAccessTrail({ limit: 2, offset: 0, objectType: "plan" }, { actor: auditor });
      expect(firstOfTwo).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // Notification preferences
  // -------------------------------------------------------------------------
  describe("notification preferences", () => {
    it("defaults a new actor to opted in to nothing, then persists a save", async () => {
      const store = createInMemoryRepository(clock, {});
      const initial = await store.getNotificationPreferences({ actor: coordinator });
      expect(initial).toEqual({ actorId: coordinator.id, optedIn: [] });

      const saved = unwrap(
        await store.saveNotificationPreferences(
          { actorId: coordinator.id, optedIn: ["serviceSafetyStop", "unclaimedWorkEscalation"] },
          writeContext(coordinator, "np-1"),
        ),
      );
      expect(saved.optedIn).toEqual(["serviceSafetyStop", "unclaimedWorkEscalation"]);
      expect(await store.getNotificationPreferences({ actor: coordinator })).toEqual(saved);
    });

    it("refuses saving another actor's preferences, and a system actor's own", async () => {
      const store = createInMemoryRepository(clock, {});
      const impersonating = await store.saveNotificationPreferences(
        { actorId: teamLead.id, optedIn: ["serviceSafetyStop"] },
        writeContext(coordinator, "np-2"),
      );
      expect(impersonating).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.permissionDenied });

      const asDispatcher = await store.saveNotificationPreferences(
        { actorId: dispatcher.id, optedIn: ["serviceSafetyStop"] },
        writeContext(dispatcher, "np-3"),
      );
      expect(asDispatcher).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.permissionDenied });
    });

    it("keeps preferences scoped per actor, not shared across the team", async () => {
      const store = createInMemoryRepository(clock, {});
      await store.saveNotificationPreferences(
        { actorId: coordinator.id, optedIn: ["pathwayRetired"] },
        writeContext(coordinator, "np-4"),
      );
      const teamLeadPrefs = await store.getNotificationPreferences({ actor: teamLead });
      expect(teamLeadPrefs).toEqual({ actorId: teamLead.id, optedIn: [] });
    });
  });

  // -------------------------------------------------------------------------
  // Training
  // -------------------------------------------------------------------------
  describe("training", () => {
    it("starts empty, records competencies idempotently, and refuses a role without enterTrainingMode", async () => {
      const store = createInMemoryRepository(clock, {});
      expect(await store.getTrainingRecord({ actor: coordinator })).toEqual({ actorId: coordinator.id, completed: [] });

      const first = unwrap(
        await store.recordTrainingCompetency({ competency: "activation" }, writeContext(coordinator, "tc-1")),
      );
      expect(first.completed).toEqual(["activation"]);

      const replayedCompetency = unwrap(
        await store.recordTrainingCompetency({ competency: "activation" }, writeContext(coordinator, "tc-2")),
      );
      expect(replayedCompetency.completed).toEqual(["activation"]);

      const denied = await store.recordTrainingCompetency(
        { competency: "withdrawal" },
        writeContext(dispatcher, "tc-3"),
      );
      expect(denied).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.permissionDenied });
    });

    it("keeps training records scoped per actor", async () => {
      const store = createInMemoryRepository(clock, {});
      await store.recordTrainingCompetency({ competency: "downtime" }, writeContext(coordinator, "tc-4"));
      expect(await store.getTrainingRecord({ actor: teamLead })).toEqual({ actorId: teamLead.id, completed: [] });
    });
  });

  // -------------------------------------------------------------------------
  // Retention
  // -------------------------------------------------------------------------
  describe("markRetentionCleared", () => {
    it("marks a plan cleared, refuses an unknown plan, and refuses a role without the grant", async () => {
      const store = createInMemoryRepository(clock, {});
      const plan = await createActivePlan(store);

      const denied = await store.markRetentionCleared({ planId: plan.plan.id }, writeContext(auditor, "mrc-1"));
      expect(denied).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.permissionDenied });

      const cleared = await store.markRetentionCleared({ planId: plan.plan.id }, writeContext(coordinator, "mrc-2"));
      expect(cleared).toEqual({ ok: true, value: undefined });

      const missing = await store.markRetentionCleared(
        { planId: planId("CC10-PLAN-MISSING") },
        writeContext(coordinator, "mrc-3"),
      );
      expect(missing).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.notFound });
    });

    it("refuses while the service is stopped, like every other ordinary mutation", async () => {
      const store = createInMemoryRepository(clock, {});
      const plan = await createActivePlan(store);
      await store.stopService({ reason: "wrong-recipient", note: "n/a" }, writeContext(coordinator, "s-retention"));

      const refused = await store.markRetentionCleared({ planId: plan.plan.id }, writeContext(coordinator, "mrc-4"));
      expect(refused).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.serviceStopped });
    });
  });

  // -------------------------------------------------------------------------
  // Every new write group routes through the audited write path.
  //
  // The shared `runWrite` helper is only proof that a write CAN audit; it says nothing about
  // whether a given method goes through it. A method that committed straight to its own map would
  // pass every other test in this file -- `recordAccess` already commits outside `runWrite` by
  // design, so this is not hypothetical. One representative write per new group, checked for the
  // exact event it must append and for the fact that it appends exactly one.
  // -------------------------------------------------------------------------
  describe("every new write group appends its own audit event", () => {
    const auditedWrites: readonly {
      group: string;
      action: string;
      /** Sets the store up, then returns the single write whose audit events are measured. */
      arrange: (store: CaringContactRepository) => Promise<() => Promise<{ ok: boolean }>>;
    }[] = [
      {
        group: "referrals",
        action: "createReferral",
        arrange: async (store) => () =>
          store.createReferral(
            { referralId: referralId("CC10-REF-AUDIT"), patientId: patientId("CC10-PAT-AUDIT") },
            writeContext(coordinator, "audit-referral"),
          ),
      },
      {
        group: "pathway versions",
        action: "savePathwayVersion",
        arrange: async (store) => {
          const version = draftPathwayVersion();
          return () => store.savePathwayVersion({ version }, writeContext(coordinator, "audit-pathway"));
        },
      },
      {
        group: "service state",
        action: "stopService",
        arrange: async (store) => () =>
          store.stopService(
            { reason: "wrong-recipient", note: "a message reached a number nobody recognised" },
            writeContext(coordinator, "audit-stop"),
          ),
      },
      {
        group: "assignment",
        action: "applyAssignment",
        arrange: async (store) => {
          const plan = await createActivePlan(store);
          return () =>
            store.applyAssignment(
              { planId: plan.plan.id, action: { type: "claim", actorId: coordinator.id } },
              writeContext(coordinator, "audit-assignment"),
            );
        },
      },
      {
        group: "dispatch reconciliation",
        action: "resolveDispatchDiscrepancy",
        arrange: async (store) => {
          const plan = await createActivePlan(store);
          const contact = (await store.listSendableContacts(plan.plan.id, { actor: coordinator }))[0];
          await store.startContactDispatch(
            { planId: plan.plan.id, contactId: contact.contact.id, expectedContactVersion: contact.contact.version },
            writeContext(dispatcher, "audit-dispatch"),
          );
          return () =>
            store.resolveDispatchDiscrepancy(
              {
                contactId: contact.contact.id,
                attempt: 1,
                resolution: "confirmedDelivered",
                note: "confirmed in the portal",
              },
              writeContext(coordinator, "audit-resolve"),
            );
        },
      },
      {
        group: "notification preferences",
        action: "saveNotificationPreferences",
        arrange: async (store) => () =>
          store.saveNotificationPreferences(
            { actorId: coordinator.id, optedIn: ["serviceSafetyStop"] },
            writeContext(coordinator, "audit-prefs"),
          ),
      },
      {
        group: "training",
        action: "recordTrainingCompetency",
        arrange: async (store) => () =>
          store.recordTrainingCompetency({ competency: "activation" }, writeContext(coordinator, "audit-training")),
      },
      {
        group: "retention",
        action: "markRetentionCleared",
        arrange: async (store) => {
          const plan = await createActivePlan(store);
          return () =>
            store.markRetentionCleared({ planId: plan.plan.id }, writeContext(coordinator, "audit-retention"));
        },
      },
      {
        group: "contact rescheduling",
        action: "rescheduleContact",
        arrange: async (store) => {
          const plan = await createActivePlan(store);
          const contact = (await store.listSendableContacts(plan.plan.id, { actor: coordinator }))[0];
          return () =>
            store.rescheduleContact(
              {
                planId: plan.plan.id,
                contactId: contact.contact.id,
                expectedContactVersion: contact.contact.version,
                change: { contact: contact.planned, toHour: 14, toMinute: 0 },
              },
              writeContext(coordinator, "audit-reschedule"),
            );
        },
      },
    ];

    for (const { group, action, arrange } of auditedWrites) {
      it(`appends exactly one "${action}" event for a ${group} write`, async () => {
        const store = createInMemoryRepository(clock, {});
        const write = await arrange(store);
        const before = await store.listAuditEvents({ actor: auditor });

        const result = await write();
        expect(result.ok).toBe(true);

        const after = await store.listAuditEvents({ actor: auditor });
        expect(after.slice(before.length).map((event) => event.action)).toEqual([action]);
      });
    }
  });

  // -------------------------------------------------------------------------
  // Cross-cutting proof that the roleless actor is refused across every new write, and every new
  // read is unusable to the dispatcher (the system actor gets no read access at all, unchanged).
  // -------------------------------------------------------------------------
  describe("cross-cutting: no-roles and system-actor boundaries hold for the new surface too", () => {
    it("refuses a roleless actor on a representative new write", async () => {
      const store = createInMemoryRepository(clock, {});
      const refused = await store.createReferral(
        { referralId: referralId("CC10-REF-ROLELESS"), patientId: patientId("CC10-PAT-ROLELESS") },
        writeContext(roleless, "cr-roleless"),
      );
      expect(refused).toEqual({ ok: false, reason: REPOSITORY_REFUSALS.permissionDenied });
    });

    it("gives the dispatcher no read access to the new surfaces either", async () => {
      const store = createInMemoryRepository(clock, {});
      const plan = await createActivePlan(store);
      await store.createReferral(
        { referralId: referralId("CC10-REF-DISPATCHER-CHECK"), patientId: patientId("CC10-PAT-DISPATCHER-CHECK") },
        writeContext(coordinator, "cr-dispatcher-check"),
      );

      // Positive control: the referral really is there for an actor whose role covers it.
      expect(await store.listReferrals({ actor: coordinator })).not.toEqual([]);

      expect(await store.getAssignment(plan.plan.id, { actor: dispatcher })).toBeNull();
      expect(await store.listReferrals({ actor: dispatcher })).toEqual([]);
      expect(await store.listAccessTrail({ limit: 10, offset: 0 }, { actor: dispatcher })).toEqual([]);
    });
  });
});
