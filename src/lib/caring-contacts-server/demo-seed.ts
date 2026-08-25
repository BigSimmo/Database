// src/lib/caring-contacts-server/demo-seed.ts
//
// The synthetic population the workspace is demonstrated with.
//
// WHY THIS EXISTS. Phase 2B built the caseload, the patient overview and a four-stage activation
// wizard, and none of it could be driven by anyone, because the running system was empty and there
// was no way to put anything into it. No route can create a pathway version -- the POST surface at
// `api/caring-contacts/pathway-versions` refuses deliberately, because accepting a whole
// `PathwayVersion` from the wire would let a caller post one that arrives already approved -- and
// the one route that creates a referral is called by no screen. So the wizard needed a referral it
// could not get and a pathway it could not get, and every list screen was correctly empty. This
// module is the population, not a change to either of those refusals: both are still correct and
// neither is weakened here.
//
// THE THREE PROPERTIES THAT MAKE IT SAFE RATHER THAN MERELY CONVENIENT
// --------------------------------------------------------------------
//   1. IT CANNOT REACH A DATABASE. Not "must not" -- cannot. `createDemoWorkspaceStore` CONSTRUCTS
//      the in-memory repository itself, so there is no parameter through which a foreign store
//      could arrive, and this module imports `createInMemoryRepository` and nothing from
//      `../caring-contacts/db/**` at all. `applyDemoSeed` additionally refuses any store this
//      module did not build, so even a direct call cannot seed a Postgres repository. Store
//      selection is unchanged: `caringContactsStore()` reaches this module only on the branch it
//      takes when `CARING_CONTACTS_DATABASE_URL` is unset, and
//      `tests/caring-contacts-demo-seed.test.ts` fails if the Postgres branch ever calls it.
//
//   2. IT IS NOT A PRIVILEGED BACK DOOR. Every record below is written through the repository's
//      own methods, with a real demo actor and a real idempotency key -- never by reaching into
//      the store's Maps. The consequence is the point: the pathway version's dual approval is a
//      governance record the DOMAIN produced, checked by `applyPathwayVersionTransition` for two
//      distinct roles held by two distinct people, neither of them its author. A refusal from any
//      write is therefore a finding about the rules and is thrown, not routed around -- see
//      `DemoSeedRefusedError`. A half-seeded store that looked populated would be the worse
//      outcome.
//
//   3. IT AUTHORS NO PATIENT-VISIBLE WORDING. See `DEMO_SEED_MESSAGE_TEXT` below, which is the
//      single most consequential decision in this file.
//
//   4. IT DOES NOT LET A SCREEN PRESENT ITS GOVERNANCE AS REAL. The version it writes carries
//      `snapshot.provenance = "syntheticDemonstration"`, so the wizard's pathway stage can say the
//      approvals are invented. The approvals are structurally genuine -- the domain refused
//      anything else -- and that is exactly why the record has to carry the qualifier: nothing
//      about the shape of a correctly-approved version distinguishes one nobody approved.
//
// PRODUCTION NEVER SEES ANY OF THIS. `isCaringContactsDemoEnabled()` is the same predicate that
// decides whether a demo actor can be resolved at all; where it is false, the store is returned
// empty. That keeps this module inside the repository's standing rule that demo content is a
// development convenience and production fails loudly rather than falling back to synthetic data.
// The isolated Playwright server is the one place that predicate is true inside a production
// build, and it is excluded by default -- see `demoSeedRequested` for why, and for the switch a
// browser journey turns it on with.
import "server-only";

import type { Clock } from "@/lib/caring-contacts/clock";
import { idempotencyKey, patientId, pathwayVersionId, planId, referralId } from "@/lib/caring-contacts/ids";
import type { PathwayVersionId, PlanId, ReferralId } from "@/lib/caring-contacts/ids";
import { createInMemoryRepository } from "@/lib/caring-contacts/in-memory-repository";
import { EXACT_PATIENT_VISIBLE_MESSAGE } from "@/lib/caring-contacts/message-copy";
import type { MessageType, SendingPreference, TransitionResult } from "@/lib/caring-contacts/model";
import type { PathwayVersion, PathwayVersionSnapshot } from "@/lib/caring-contacts/pathway-versions";
import type { Actor } from "@/lib/caring-contacts/permissions";
import type { CaringContactRepository, EpisodePatientDetail, WriteContext } from "@/lib/caring-contacts/repository";
import { buildApprovedSchedule } from "@/lib/caring-contacts/schedule";
import { FICTIONAL_CONTACTS_BY_ROLE } from "@/lib/caring-contacts/synthetic-contacts";

import { demoActorForRole, isCaringContactsDemoEnabled } from "./session";

/** Thrown when something asks this module to seed a store it did not build. */
export class DemoSeedForeignStoreError extends Error {
  constructor() {
    super(
      "The Caring Contacts demo seed refuses a store it did not construct. It populates only the " +
        "in-memory reference store it builds itself, and never a database-backed repository.",
    );
    this.name = "DemoSeedForeignStoreError";
  }
}

/**
 * Thrown when a seed write is refused.
 *
 * A refusal is a FINDING, not an obstacle to route around: it means the seed tried to make a write
 * the rules do not allow, and the honest response is to stop rather than to reach past the rule or
 * to leave a partly-populated store that looks whole. The message names the step and the domain's
 * own machine-readable reason, and nothing else -- never patient detail.
 */
export class DemoSeedRefusedError extends Error {
  constructor(step: string, reason: string) {
    super(`The Caring Contacts demo seed was refused at ${step}: ${reason}`);
    this.name = "DemoSeedRefusedError";
  }
}

export const DEMO_SEED_PATHWAY_VERSION_ID = "demo-seed-pathway-version-1";

/**
 * The accepted referral that has no plan yet -- the one a coordinator (or a browser test) starts
 * the activation wizard from, at `/caring-contacts/plans/new?referral=<this>`.
 *
 * Exported because the id is the wizard's only entry point: the route takes it from the URL and no
 * screen lists referrals yet, so without a stable, published identifier the wizard remains
 * unreachable even with a population behind it.
 */
export const DEMO_SEED_UNSTARTED_REFERRAL_ID = "demo-seed-referral-wren";

/**
 * THE MESSAGE TEXT, AND WHY TWO OF THE THREE ENTRIES ARE EMPTY.
 *
 * `standard` is `EXACT_PATIENT_VISIBLE_MESSAGE` from the sealed domain's `message-copy` -- the one
 * provisional patient-visible message that exists, and the only one that has been reviewed.
 *
 * `first` and `closing` are EMPTY, and that is the truthful representation of "not yet written".
 * Nobody has authored either. Copying the standard message into the closing slot would be worse
 * than leaving it blank and is specifically forbidden: `message-rules` requires a final message to
 * say that it is the final message in the programme, so a closing message that did not say so
 * would tell someone the contact continues when it has ended -- and the owner deferred that
 * wording to the lived-experience representative precisely because it is not an implementer's to
 * draft. A blank entry is visibly unfinished; a plausible wrong one is not.
 */
const DEMO_SEED_MESSAGE_TEXT: Readonly<Record<MessageType, string>> = Object.freeze({
  standard: EXACT_PATIENT_VISIBLE_MESSAGE,
  first: "",
  closing: "",
});

/**
 * `culturalIdentity` is recorded as not stated for every seeded patient, and that is a decision
 * rather than a placeholder: a cultural identity attributed to an invented person is an invention
 * about culture, and this programme's standing discipline is that an implementer does not author
 * content of that kind. "Not stated" is what the record honestly holds.
 */
const CULTURAL_IDENTITY_NOT_STATED = "Not stated";

type DemoPlanSeed = {
  planIdentifier: string;
  sendingPreference: SendingPreference;
  /** Where the plan is left. Every plan is created and activated first; this is the last move. */
  finalState: "active" | "paused" | "withdrawn";
  patientDetail: EpisodePatientDetail;
};

type DemoPersonSeed = {
  key: string;
  patientIdentifier: string;
  referralIdentifier: string;
  /** `awaitingHandover` is left un-accepted so both referral states are visible on a screen. */
  referralState: "accepted" | "awaitingHandover";
  plan?: DemoPlanSeed;
};

/**
 * The population.
 *
 * NO NAME HERE IS NEW, AND THAT IS THE POINT. Every seeded patient name already existed in this
 * repository's synthetic material, checked at the merge base rather than assumed:
 *
 *   * "Mira Example" appears verbatim in the mockup fixtures (`caring-contacts/mockups/fixtures.ts`
 *     and `care-plan/mockups/fixtures.ts`);
 *   * "Rowan Example" appears verbatim in this workspace's own test fixtures
 *     (`caring-contacts-plan-draft.dom.test.tsx`, `caring-contacts-plan-activation.test.ts`);
 *   * "Ari Sample" is the one new PAIRING, and both halves are borrowed: "Ari" from
 *     "Ari Placeholder" in the care-plan mockup fixtures, "Sample" from "Rowan Sample".
 *
 * The surnames are what make these unmistakably not a real person's name, and this tree uses
 * exactly two of them -- Sample and Example. Nothing was drawn from outside that vocabulary, so no
 * seeded patient can be mistaken for a findable person.
 *
 * Round 1 wrote "the given names below are new", round 2 repeated it, and it was false both times:
 * "Rowan" and "Mira" are the given names of the very fixtures cited as the precedent. A sentence
 * that is wrong about where these names came from undermines the one assurance it exists to give,
 * which is why it is spelled out per name rather than summarised.
 *
 * `wren` and `nima` below are IDENTIFIERS, never names. Those two referrals carry no plan, so no
 * patient detail and no name is stored for either.
 *
 * Every mobile number is one of the reserved fictional numbers that stand for a patient's own
 * mobile (`DESIGNATED_FICTIONAL_PATIENT_MOBILE_NUMBERS`, derived from `FICTIONAL_CONTACTS_BY_ROLE`
 * below). There are fewer of those than there are plans here, so one is used more than once.
 * Reusing a reserved non-connecting number is the safe outcome; inventing a number-shaped string
 * would not be.
 *
 * The shape is chosen so every built screen has something real on it AND a coordinator can
 * complete a sign-up:
 *   * three plans, left running, paused and stopped, so the caseload and the patient overview show
 *     three different states -- including the stopped one, without which the fix for a screen that
 *     once told a coordinator a stopped plan would still send cannot be demonstrated at all;
 *   * one accepted referral with NO plan, which is what the wizard needs: a patient who already
 *     has a non-terminal plan is refused a second one by the store, and correctly;
 *   * one referral still awaiting handover, so the two referral states are distinguishable.
 */
const DEMO_SEED_PEOPLE: readonly DemoPersonSeed[] = Object.freeze([
  {
    key: "rowan",
    patientIdentifier: "demo-seed-patient-rowan",
    referralIdentifier: "demo-seed-referral-rowan",
    referralState: "accepted",
    plan: {
      planIdentifier: "demo-seed-plan-rowan",
      sendingPreference: "morning",
      finalState: "active",
      patientDetail: {
        patientName: "Rowan Example",
        patientMobileNumber: FICTIONAL_CONTACTS_BY_ROLE.rowanPatientMobile,
        patientIdentifiers: ["SYN-UMRN-0001"],
        culturalIdentity: CULTURAL_IDENTITY_NOT_STATED,
      },
    },
  },
  {
    key: "mira",
    patientIdentifier: "demo-seed-patient-mira",
    referralIdentifier: "demo-seed-referral-mira",
    referralState: "accepted",
    plan: {
      planIdentifier: "demo-seed-plan-mira",
      sendingPreference: "afternoon",
      finalState: "paused",
      patientDetail: {
        patientName: "Mira Example",
        patientMobileNumber: FICTIONAL_CONTACTS_BY_ROLE.miraPatientMobile,
        patientIdentifiers: ["SYN-UMRN-0002"],
        culturalIdentity: CULTURAL_IDENTITY_NOT_STATED,
      },
    },
  },
  {
    key: "ari",
    patientIdentifier: "demo-seed-patient-ari",
    referralIdentifier: "demo-seed-referral-ari",
    referralState: "accepted",
    plan: {
      planIdentifier: "demo-seed-plan-ari",
      sendingPreference: "earlyEvening",
      finalState: "withdrawn",
      patientDetail: {
        patientName: "Ari Sample",
        patientMobileNumber: FICTIONAL_CONTACTS_BY_ROLE.rowanPatientMobile,
        patientIdentifiers: ["SYN-UMRN-0003"],
        culturalIdentity: CULTURAL_IDENTITY_NOT_STATED,
      },
    },
  },
  {
    key: "wren",
    patientIdentifier: "demo-seed-patient-wren",
    referralIdentifier: DEMO_SEED_UNSTARTED_REFERRAL_ID,
    referralState: "accepted",
  },
  {
    key: "nima",
    patientIdentifier: "demo-seed-patient-nima",
    referralIdentifier: "demo-seed-referral-nima",
    referralState: "awaitingHandover",
  },
]);

/**
 * The stores this module built, and therefore the only stores it will populate.
 *
 * A `WeakSet` rather than a flag on the store, so nothing about the repository's own shape changes
 * and nothing outside this module can add to it. This is what makes property 1 above structural
 * rather than a convention: `applyDemoSeed` is exported so its idempotency can be tested against a
 * real store, and this is what stops that export from being a way into a database-backed one.
 */
const storesBuiltHere = new WeakSet<CaringContactRepository>();

export type DemoSeedOutcome = {
  /** False when the store already held a population, or when the demo is unavailable. */
  populated: boolean;
};

/**
 * The environment variable a browser journey turns the population on with. Values other than `on`
 * -- including absent -- leave the isolated Playwright server empty.
 */
export const CARING_CONTACTS_DEMO_SEED_VAR = "CARING_CONTACTS_DEMO_SEED";

/**
 * Whether this process should hold the demo population.
 *
 * Two gates, and the second is the one that is easy to get wrong.
 *
 * The FIRST is `isCaringContactsDemoEnabled()` -- the same predicate that decides whether a demo
 * actor can be resolved at all. A production process cannot resolve an actor, so a population
 * there would be unreachable synthetic content sitting in a production process for no one: exactly
 * what the standing rule against production demo fallback exists to prevent.
 *
 * The SECOND excludes the isolated Playwright server, which is the ONE place the first predicate is
 * true inside a production build. That server exists to observe the app's honest state end to end,
 * and `tests/ui-caring-contacts-workspace.spec.ts` pins part of that honesty: an empty caseload is
 * served as a PAGE rather than as a missing resource, with the empty state saying in words which of
 * the three facts it is. Seeding that server by default would delete that observation -- the
 * "No patients yet" group would never render again -- and would trade a proven contract for an
 * unproven one. So it starts empty unless a journey asks, and the report for this task states
 * exactly what a wizard journey has to do.
 */
function demoSeedRequested(runtime: Record<string, string | undefined> = process.env): boolean {
  if (!isCaringContactsDemoEnabled()) return false;
  if (runtime.PLAYWRIGHT_OFFLINE_MODE === "true") return runtime[CARING_CONTACTS_DEMO_SEED_VAR] === "on";
  return true;
}

/**
 * Builds the in-memory reference store and populates it.
 *
 * The store is constructed HERE, which is the whole of why the seed cannot reach a database: there
 * is no store parameter for a Postgres repository to arrive through.
 */
export async function createDemoWorkspaceStore(clock: Clock): Promise<CaringContactRepository> {
  const store = createInMemoryRepository(clock);
  storesBuiltHere.add(store);
  if (!demoSeedRequested()) return store;
  await applyDemoSeed(store, clock);
  return store;
}

/**
 * Populates a store this module built. A no-op on a store that already holds a population, so a
 * second call cannot produce a second population.
 *
 * Idempotency has two independent guards, because they fail differently. The first is the check
 * below: a store that already holds a pathway version is left alone. The second is that every
 * write carries a FIXED idempotency key, so two callers racing the same fresh store cannot both
 * commit -- the store's own replay contract returns the first answer and performs no second change.
 */
export async function applyDemoSeed(store: CaringContactRepository, clock: Clock): Promise<DemoSeedOutcome> {
  if (!storesBuiltHere.has(store)) throw new DemoSeedForeignStoreError();

  // The production boundary is checked HERE, not only at the constructor, and the difference is not
  // stylistic. In a production process `createDemoWorkspaceStore` returns a store it built and left
  // empty -- so that store is in `storesBuiltHere`, and a caller reaching this function with it
  // would have passed the only other guard. Round 1, I1: the database boundary was structural and
  // this one was conventional, while the module header claimed the stronger property for both.
  if (!demoSeedRequested()) return { populated: false };

  const coordinator = demoActorForRole("coordinator");
  const clinicalProgrammeLead = demoActorForRole("clinicalProgrammeLead");
  const livedExperienceRepresentative = demoActorForRole("livedExperienceRepresentative");

  if ((await store.listPathwayVersions({ actor: coordinator })).length > 0) return { populated: false };

  const dischargeAt = clock.now();
  const version = pathwayVersionId(DEMO_SEED_PATHWAY_VERSION_ID);

  // ---- The governed pathway, through its real lifecycle -------------------------------------
  //
  // draft -> inReview -> approved (two roles, two people, neither the author) -> published.
  // `savePathwayVersion` constructs every governance field server-side whatever is passed, so the
  // draft below supplies only the identifier and the snapshot; the rest is the domain's.
  taken(
    "savePathwayVersion",
    await store.savePathwayVersion(
      { version: draftPathwayVersion(version, coordinator, dischargeAt) },
      writeAs(coordinator, "pathway-save"),
    ),
  );
  taken(
    "pathwayVersion:submitForReview",
    await store.transitionPathwayVersion(
      { pathwayVersionId: version, action: { type: "submitForReview" } },
      writeAs(coordinator, "pathway-submit-for-review"),
    ),
  );
  taken(
    "pathwayVersion:approve:clinicalProgrammeLead",
    await store.transitionPathwayVersion(
      {
        pathwayVersionId: version,
        action: { type: "approve", role: "clinicalProgrammeLead", actorId: clinicalProgrammeLead.id },
      },
      writeAs(clinicalProgrammeLead, "pathway-approve-clinical-programme-lead"),
    ),
  );
  taken(
    "pathwayVersion:approve:livedExperienceRepresentative",
    await store.transitionPathwayVersion(
      {
        pathwayVersionId: version,
        action: {
          type: "approve",
          role: "livedExperienceRepresentative",
          actorId: livedExperienceRepresentative.id,
        },
      },
      writeAs(livedExperienceRepresentative, "pathway-approve-lived-experience-representative"),
    ),
  );
  taken(
    "pathwayVersion:publish",
    await store.transitionPathwayVersion(
      { pathwayVersionId: version, action: { type: "publish", actorId: clinicalProgrammeLead.id } },
      writeAs(clinicalProgrammeLead, "pathway-publish"),
    ),
  );

  // ---- Referrals ------------------------------------------------------------------------------
  for (const person of DEMO_SEED_PEOPLE) {
    const referral: ReferralId = referralId(person.referralIdentifier);
    taken(
      `createReferral:${person.key}`,
      await store.createReferral(
        { referralId: referral, patientId: patientId(person.patientIdentifier) },
        writeAs(coordinator, `referral-create-${person.key}`),
      ),
    );
    if (person.referralState === "accepted") {
      taken(
        `acceptReferral:${person.key}`,
        await store.transitionReferral(
          { referralId: referral, action: { type: "accept", pathwayVersionId: version } },
          writeAs(coordinator, `referral-accept-${person.key}`),
        ),
      );
    }
  }

  // ---- Plans ----------------------------------------------------------------------------------
  for (const person of DEMO_SEED_PEOPLE) {
    if (!person.plan) continue;
    const plan: PlanId = planId(person.plan.planIdentifier);

    const created = taken(
      `createPlan:${person.key}`,
      await store.createPlan(
        {
          planId: plan,
          referralId: referralId(person.referralIdentifier),
          patientId: patientId(person.patientIdentifier),
          pathwayVersionId: version,
          dischargeAt,
          sendingPreference: person.plan.sendingPreference,
          patientDetail: person.plan.patientDetail,
        },
        writeAs(coordinator, `plan-create-${person.key}`),
      ),
    );

    const activated = taken(
      `activatePlan:${person.key}`,
      await store.activatePlan(
        { planId: plan, expectedVersion: created.plan.version },
        writeAs(coordinator, `plan-activate-${person.key}`),
      ),
    );

    if (person.plan.finalState === "paused") {
      taken(
        `pausePlan:${person.key}`,
        await store.pausePlan(
          { planId: plan, expectedVersion: activated.plan.version },
          writeAs(coordinator, `plan-pause-${person.key}`),
        ),
      );
    }

    if (person.plan.finalState === "withdrawn") {
      taken(
        `withdrawPlan:${person.key}`,
        await store.withdrawPlan(
          { planId: plan, expectedVersion: activated.plan.version, origin: "patient" },
          writeAs(coordinator, `plan-withdraw-${person.key}`),
        ),
      );
    }
  }

  return { populated: true };
}

/** The value of a write that succeeded. A refusal is raised, never absorbed -- see the class note. */
function taken<T>(step: string, result: TransitionResult<T>): T {
  if (!result.ok) throw new DemoSeedRefusedError(step, result.reason);
  return result.value;
}

/**
 * Fixed, never-derived idempotency keys. Fixed is the point: a key that varied per run would make
 * a repeated seed a NEW write rather than a replay the store already knows the answer to.
 */
function writeAs(actor: Actor, label: string): WriteContext {
  return { actor, idempotencyKey: idempotencyKey(`demo-seed-${label}`) };
}

/**
 * The draft handed to `savePathwayVersion`. Only `id` and `snapshot` survive that call -- the store
 * constructs `state`, `authorId` and `approvals` itself, whatever is passed, so a caller cannot
 * seed a version that arrives pre-approved. The governance fields below are therefore the honest
 * shape of a draft, not an attempt to set them.
 */
function draftPathwayVersion(id: PathwayVersionId, author: Actor, dischargeAt: Date): PathwayVersion {
  return {
    id,
    teamId: author.teamId,
    state: "draft",
    authorId: author.id,
    approvals: Object.freeze([]),
    publishedAt: null,
    retiredAt: null,
    retirementUrgency: null,
    snapshot: pathwaySnapshot(dischargeAt),
  };
}

/**
 * The cadence labels are DERIVED from the schedule the domain really builds, never typed out here.
 * `buildApprovedSchedule` owns the twelve-month cadence, and a list written into this file would be
 * a second copy of it -- free to go on advertising a cadence the schedule had stopped producing, on
 * the screen where a coordinator chooses which pathway a discharged patient is put onto.
 */
function pathwaySnapshot(dischargeAt: Date): PathwayVersionSnapshot {
  const schedule = buildApprovedSchedule({ dischargeAt, sendingPreference: "morning" });
  if (!schedule.ok) throw new DemoSeedRefusedError("buildApprovedSchedule", schedule.reason);
  return Object.freeze({
    cadenceLabels: Object.freeze(schedule.contacts.map((contact) => contact.cadenceLabel)),
    messageTextByType: DEMO_SEED_MESSAGE_TEXT,
    // Ruling [126]. Stage 2 of the wizard prints "Approved by the clinical programme lead and the
    // lived-experience representative" for whatever it is offered, and for this version no person
    // recorded either approval. The marker is what lets that screen say so without knowing a seed
    // exists -- see PathwayVersionSnapshot.provenance.
    provenance: "syntheticDemonstration",
  });
}
