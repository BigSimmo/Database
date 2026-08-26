// tests/caring-contacts-patient-overview.dom.test.tsx
//
// `/caring-contacts/patients/[patientId]` (`src/app/caring-contacts/patients/[patientId]/page.tsx`)
// -- one patient's episode, and the ONE screen in this workspace that may call `getEpisode`.
//
// THE CONTRACTS THIS FILE EXISTS FOR
//
//   1. Ruling 97. The route is keyed by PATIENT, the reads are keyed by PLAN, and one patient can
//      honestly hold two episodes -- `repository.ts` says so, and `markRetentionCleared` clears
//      detail per plan, so two plans for one patient can legitimately differ in what they hold. The
//      screen therefore never picks between them: zero plans is an honest empty state, one plan
//      renders, and more than one asks. A screen that silently picked would show one plan's
//      schedule under a heading carrying the patient's name.
//
//   2. `getEpisode` is called ONCE, for ONE plan, and only after that rule has picked the plan. It
//      is the read that releases the name, the mobile number, the identifiers and the cultural
//      identity together, so "how many times was it called, and with what" is the assertion, not a
//      detail. The chooser must not call it at all.
//
//   3. Ruling 98. The contact count is DERIVED. Week 1 is suppressed exactly when the first
//      contact is discharge + 7, which makes that plan nine sendable messages rather than ten, and
//      the last entry is a CLOSING message rather than one more caring contact. Nothing here may
//      be a literal.
//
//   4. Ruling 96's display half, and Ruling 108's three cases under it. The first contact date is
//      shown; when it is not the default of discharge + 1 the screen must say so in place, and show
//      the recorded REASON in the clinician's own words. When no reason is held the screen says
//      WHICH absence it is -- a role that may not read the episode, a retention clearance, or a plan
//      older than the field -- because those are three different facts and only one of them is
//      about the plan being old.
//
// Built on the helper shape `caring-contacts-patients-page.dom.test.tsx` established for Task 5.
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  store: { current: null as unknown },
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: (name: string) => mockCookies[name] })),
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  notFound: mocks.notFound,
}));

vi.mock("@/lib/caring-contacts-server/store", () => ({
  caringContactsStore: async () => mocks.store.current,
}));

import { exitOnlyOverlayCommit } from "@/components/caring-contacts/workspace/overlays/exit-only-overlay-trigger";
import { commitRefusalFor } from "@/components/caring-contacts/workspace/overlays/overlay-commits";
import type { PlanActionsContext } from "@/components/caring-contacts/workspace/plan-action-rules";
import { PatientOverview, type PatientOverviewView } from "@/components/caring-contacts/workspace/patient-overview";
import { CARING_CONTACTS_ROLE_COOKIE, demoActorForRole } from "@/lib/caring-contacts-server/session";
import { CARING_CONTACT_ROLE_WORDING } from "@/lib/caring-contacts/permissions";
import type { AccessRecord } from "@/lib/caring-contacts/access-audit";
import {
  PLAN_ASSURANCES,
  PLAN_ASSURANCE_VALUES,
  planAssuranceWording,
  type PlanAssurance,
  type PlanAssuranceAttestation,
} from "@/lib/caring-contacts/assurances";
import { fixedClock } from "@/lib/caring-contacts/clock";
import {
  actorId,
  contactId,
  idempotencyKey,
  pathwayVersionId,
  patientId,
  planId,
  referralId,
  type PlanId,
} from "@/lib/caring-contacts/ids";
import type { ContactState, MessageType } from "@/lib/caring-contacts/model";
import { createInMemoryRepository } from "@/lib/caring-contacts/in-memory-repository";
import type { CaringContactRepository, PlanRecord, StoredContact } from "@/lib/caring-contacts/repository";

let mockCookies: Record<string, { value: string } | undefined> = {};

const NOW = "2026-03-02T03:00:00.000Z";
/** 15 Aug 2026 in AWST -- the discharge day every plan below hangs off. */
const DISCHARGE = new Date("2026-08-15T02:00:00.000Z");
const DISCHARGE_DAY = "2026-08-15";
const DEFAULT_FIRST_CONTACT_DAY = "2026-08-16";
const ABSORBING_FIRST_CONTACT_DAY = "2026-08-22"; // discharge + 7: Week 1 is absorbed
const PATIENT = "SYN-PATIENT-001";

type Spied = {
  store: CaringContactRepository;
  recorded: () => AccessRecord[];
  episodeCalls: () => string[];
};

/**
 * The real in-memory store, with `recordAccess` and `getEpisode` observed.
 *
 * The real store rather than a hand-built stub, deliberately: this screen's whole subject is the
 * SCHEDULE the domain built -- the absorbed Week 1, the closing message, the cadence labels -- and
 * a stub would let the test assert against a schedule the domain would never produce.
 */
function spiedStore(role = "coordinator"): Spied {
  mockCookies = { [CARING_CONTACTS_ROLE_COOKIE]: { value: role } };

  const repository = createInMemoryRepository(fixedClock(NOW));
  const records: AccessRecord[] = [];
  const episodeCalls: string[] = [];
  const store: CaringContactRepository = {
    ...repository,
    async recordAccess(record: AccessRecord) {
      await repository.recordAccess(record);
      records.push(record);
    },
    async getEpisode(id, context) {
      episodeCalls.push(id);
      return repository.getEpisode(id, context);
    },
  };

  mocks.store.current = store;
  return { store, recorded: () => records, episodeCalls: () => episodeCalls };
}

/** Creates one plan through the real store, so its schedule is the domain's own. */
async function createPlan(
  store: CaringContactRepository,
  id: string,
  options: { patient?: string; firstContactDate?: string; firstContactReason?: string } = {},
): Promise<PlanId> {
  const actor = demoActorForRole("coordinator");
  const result = await store.createPlan(
    {
      planId: planId(id),
      referralId: referralId(`referral-${id}`),
      patientId: patientId(options.patient ?? PATIENT),
      pathwayVersionId: pathwayVersionId("pathway-1"),
      dischargeAt: DISCHARGE,
      sendingPreference: "morning",
      firstContactDate: options.firstContactDate,
      firstContactReason: options.firstContactReason,
      patientDetail: {
        patientName: "Rowan Sample",
        patientMobileNumber: "0400000000",
        patientIdentifiers: ["SYN-UMRN-001"],
        culturalIdentity: "Not stated",
      },
      assurances: PLAN_ASSURANCE_VALUES,
    },
    { actor, idempotencyKey: idempotencyKey(`create-${id}`) },
  );
  if (!result.ok) throw new Error(`createPlan(${id}) refused: ${result.reason}`);
  return planId(id);
}

/**
 * Ends a plan, so the patient may hold a second one.
 *
 * `createPlan` refuses a second NON-TERMINAL plan for the same patient across every team, which is
 * what makes "one patient, two episodes" an honest state rather than a duplicate-message hazard:
 * the first has to have ended. A draft is not withdrawable, so the plan is activated first, and
 * withdrawal is what sets `completedAt` -- which `admitRetentionClearance` then requires.
 */
async function endPlan(store: CaringContactRepository, id: PlanId) {
  const actor = demoActorForRole("coordinator");
  const activated = await store.activatePlan(
    { planId: id, expectedVersion: 1 },
    { actor, idempotencyKey: idempotencyKey(`activate-${id}`) },
  );
  if (!activated.ok) throw new Error(`activatePlan(${id}) refused: ${activated.reason}`);
  const result = await store.withdrawPlan(
    { planId: id, expectedVersion: activated.value.plan.version, origin: "patient" },
    { actor, idempotencyKey: idempotencyKey(`withdraw-${id}`) },
  );
  if (!result.ok) throw new Error(`withdrawPlan(${id}) refused: ${result.reason}`);
}

/**
 * Records a death against a live plan, through the real store.
 *
 * The other path to a plan of cancelled contacts: `recordHospitalStatusEvent`'s `cancelUnsent`
 * outcome runs every unsent contact through `{ type: "cancel" }`, exactly as `withdrawPlan` does.
 * It is the case the screen must never get wrong -- a plan whose patient has died, announcing that
 * its messages are still to come.
 */
async function recordDeath(store: CaringContactRepository, id: PlanId) {
  const actor = demoActorForRole("coordinator");
  const activated = await store.activatePlan(
    { planId: id, expectedVersion: 1 },
    { actor, idempotencyKey: idempotencyKey(`activate-death-${id}`) },
  );
  if (!activated.ok) throw new Error(`activatePlan(${id}) refused: ${activated.reason}`);
  const result = await store.recordHospitalStatusEvent(
    {
      planId: id,
      expectedVersion: activated.value.plan.version,
      event: { type: "death", recordedAt: new Date(NOW) },
    },
    { actor, idempotencyKey: idempotencyKey(`death-${id}`) },
  );
  if (!result.ok) throw new Error(`recordHospitalStatusEvent(${id}) refused: ${result.reason}`);
}

/**
 * Makes one plan answer like a row created before the first-contact reason was kept.
 *
 * No store can produce such a plan any more: `createPlan` always writes what the schedule accepted,
 * and no write removes a reason on its own. But old rows hold null forever -- nothing was migrated
 * into them, deliberately (Ruling 108) -- so the case is real and has to be renderable. It is
 * staged at the boundary the screen actually reads, `getEpisode`, answered with null in that one
 * field and untouched in every other, which is exactly how an old row answers.
 *
 * Deliberately NOT done by reaching into the store's state: that would depend on the in-memory
 * store's internals, and the case being staged is a property of the DATA, not of either store.
 */
function forgetFirstContactReason(store: CaringContactRepository, plan: string): void {
  const patched: CaringContactRepository = {
    ...store,
    async getEpisode(id, context) {
      const episode = await store.getEpisode(id, context);
      if (episode === null || String(id) !== plan) return episode;
      return { ...episode, firstContactReason: null };
    },
  };
  mocks.store.current = patched;
}

async function renderPage(
  patient = PATIENT,
  searchParams: Record<string, string | string[] | undefined> = {},
): Promise<ReactElement> {
  const { default: PatientOverviewPage } = await import("@/app/caring-contacts/patients/[patientId]/page");
  const element = await PatientOverviewPage({
    params: Promise.resolve({ patientId: patient }),
    searchParams: Promise.resolve(searchParams),
  });
  // The shell is the page's root; the overview it wraps is what this file inspects. Rendering the
  // shell itself would drag `next/dynamic` and the whole workspace chrome into a test about one
  // screen's body -- the same split `caring-contacts-patients-page.dom.test.tsx` makes.
  render((element as ReactElement<{ children: ReactElement }>).props.children);
  return element;
}

beforeEach(() => {
  mockCookies = {};
  mocks.store.current = null;
  mocks.notFound.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the patient overview - Ruling 97: one plan, and the screen never chooses which", () => {
  it("says this team holds no plan for the patient rather than 404ing, and never calls getEpisode", async () => {
    const { episodeCalls } = spiedStore();

    await renderPage();

    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(episodeCalls()).toEqual([]);
    expect(screen.getByRole("group", { name: "No plan for this patient" })).toBeInTheDocument();
    // The answer must not distinguish "no plan exists" from "the plan is on another team".
    expect(screen.getByText(/another team/i)).toBeInTheDocument();
  });

  it("says the ROLE cannot see plans when it holds no viewReferral, never that there is no plan", async () => {
    const { episodeCalls } = spiedStore("auditor");
    // The plan exists and is this team's; the auditor simply may not list it.
    const coordinatorStore = mocks.store.current as CaringContactRepository;
    mockCookies = { [CARING_CONTACTS_ROLE_COOKIE]: { value: "coordinator" } };
    await createPlan(coordinatorStore, "plan-solo");
    mockCookies = { [CARING_CONTACTS_ROLE_COOKIE]: { value: "auditor" } };

    await renderPage();

    expect(screen.getByRole("group", { name: "Plans are not visible in this role" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "No plan for this patient" })).not.toBeInTheDocument();
    expect(episodeCalls()).toEqual([]);
  });

  it("renders the one plan, calling getEpisode exactly once and for that plan", async () => {
    const { store, episodeCalls, recorded } = spiedStore();
    await createPlan(store, "plan-solo");

    await renderPage();

    expect(episodeCalls()).toEqual(["plan-solo"]);
    expect(screen.getByRole("heading", { level: 2, name: "Rowan Sample" })).toBeInTheDocument();
    // Its own object type and its own row on the trail, keyed by the plan it released.
    expect(recorded()).toContainEqual(
      expect.objectContaining({ kind: "view", objectType: "episode", objectId: "plan-solo", outcome: "allowed" }),
    );
  });

  it("asks which plan when the patient has two and the URL names none, and does NOT call getEpisode", async () => {
    const { store, episodeCalls } = spiedStore();
    const first = await createPlan(store, "plan-first");
    await endPlan(store, first);
    await createPlan(store, "plan-second");

    await renderPage();

    expect(episodeCalls()).toEqual([]);
    expect(screen.getByRole("heading", { level: 2, name: /more than one plan/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /plan-first/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /plan-second/ })).toBeInTheDocument();
    // A chooser takes the name from the narrow read, never from `getEpisode`.
    expect(screen.getByText("Rowan Sample")).toBeInTheDocument();
  });

  it("renders the plan the URL names, once the plan is proved to belong to this patient", async () => {
    const { store, episodeCalls } = spiedStore();
    const first = await createPlan(store, "plan-first");
    await endPlan(store, first);
    await createPlan(store, "plan-second");

    await renderPage(PATIENT, { plan: "plan-first" });

    expect(episodeCalls()).toEqual(["plan-first"]);
  });

  it("ignores a ?plan= naming another patient's plan, and falls back to asking", async () => {
    const { store, episodeCalls } = spiedStore();
    const first = await createPlan(store, "plan-first");
    await endPlan(store, first);
    await createPlan(store, "plan-second");
    await createPlan(store, "plan-elsewhere", { patient: "SYN-PATIENT-002" });

    await renderPage(PATIENT, { plan: "plan-elsewhere" });

    expect(episodeCalls()).toEqual([]);
    expect(screen.getByRole("heading", { level: 2, name: /more than one plan/i })).toBeInTheDocument();
  });

  // M7, review round 1: the documented rule is now pinned rather than only described. `?plan=` is
  // consulted only when there is something to choose between; with exactly one plan that plan
  // renders whatever the URL says, so a stale or mistyped link cannot turn a one-plan patient into
  // a one-item chooser, and cannot withhold a plan this actor may see.
  it("renders the sole plan even when ?plan= names another patient's, and reads only the sole plan", async () => {
    const { store, episodeCalls } = spiedStore();
    await createPlan(store, "plan-solo");
    await createPlan(store, "plan-elsewhere", { patient: "SYN-PATIENT-002" });

    await renderPage(PATIENT, { plan: "plan-elsewhere" });

    // The foreign plan is neither read nor named nor acknowledged.
    expect(episodeCalls()).toEqual(["plan-solo"]);
    expect(document.body.textContent).not.toContain("plan-elsewhere");
    expect(screen.queryByRole("heading", { level: 2, name: /more than one plan/i })).not.toBeInTheDocument();
    // And the reader is told which plan they are looking at.
    expect(screen.getByTestId("caring-contacts-plan-summary")).toHaveTextContent("plan-solo");
  });

  it("ignores a repeated ?plan=a&plan=b, which names no single plan", async () => {
    const { store, episodeCalls } = spiedStore();
    const first = await createPlan(store, "plan-first");
    await endPlan(store, first);
    await createPlan(store, "plan-second");

    await renderPage(PATIENT, { plan: ["plan-first", "plan-second"] });

    expect(episodeCalls()).toEqual([]);
  });
});

describe("the patient overview - Ruling 98: the contact count is derived, never a literal", () => {
  it("counts ten entries, all sendable, for a plan on the default first contact", async () => {
    const { store } = spiedStore();
    await createPlan(store, "plan-solo");

    await renderPage();

    const schedule = screen.getByRole("list", { name: "Twelve-month schedule" });
    expect(within(schedule).getAllByRole("listitem")).toHaveLength(10);
    expect(screen.getByTestId("caring-contacts-schedule-summary")).toHaveTextContent(
      "10 entries, and every one of them is still to be sent.",
    );
  });

  it("counts NINE sendable when Week 1 is absorbed by a discharge + 7 first contact", async () => {
    const { store } = spiedStore();
    await createPlan(store, "plan-solo", {
      firstContactDate: ABSORBING_FIRST_CONTACT_DAY,
      firstContactReason: "Patient was interstate for the first week.",
    });

    await renderPage();

    const schedule = screen.getByRole("list", { name: "Twelve-month schedule" });
    // The absorbed entry is still an entry -- it is kept so the interface can explain the plan.
    expect(within(schedule).getAllByRole("listitem")).toHaveLength(10);
    expect(screen.getByTestId("caring-contacts-schedule-summary")).toHaveTextContent(
      "10 entries: 9 still to send, and 1 that will not be sent.",
    );
  });

  it("says WHY the absorbed entry will not be sent, in place beside it", async () => {
    const { store } = spiedStore();
    await createPlan(store, "plan-solo", {
      firstContactDate: ABSORBING_FIRST_CONTACT_DAY,
      firstContactReason: "Patient was interstate for the first week.",
    });

    await renderPage();

    const suppressed = screen.getByRole("group", { name: "Suppressed" });
    expect(suppressed).toHaveTextContent(/same calendar day as this plan's first contact/i);
    expect(suppressed).toHaveTextContent(/two caring contacts must never land on one day/i);
    expect(suppressed).toHaveTextContent(/different first-contact date/i);
  });

  it("labels the last entry a closing message, not one more caring contact", async () => {
    const { store } = spiedStore();
    await createPlan(store, "plan-solo");

    await renderPage();

    const entries = within(screen.getByRole("list", { name: "Twelve-month schedule" })).getAllByRole("listitem");
    expect(entries.at(-1)).toHaveTextContent("Closing message");
    expect(entries.at(-1)).not.toHaveTextContent("Caring contact");
    expect(entries[0]).toHaveTextContent("First message");
  });
});

describe("the patient overview - Ruling 96: the first contact date is shown, and a move is explained", () => {
  it("shows the default first contact and names it as the usual day", async () => {
    const { store } = spiedStore();
    await createPlan(store, "plan-solo");

    await renderPage();

    expect(screen.getByTestId("caring-contacts-first-contact")).toHaveTextContent(DEFAULT_FIRST_CONTACT_DAY);
    expect(screen.getByTestId("caring-contacts-first-contact")).toHaveTextContent(/the day after discharge/i);
    expect(screen.queryByRole("note", { name: /First contact moved/i })).not.toBeInTheDocument();
  });

  it("shows a moved first contact's recorded reason IN PLACE, in the clinician's own words", async () => {
    // Ruling 108, second case, and spec 4.4's contract: a reason reachable only by hovering has
    // not been stated. It is rendered verbatim and attributed, never paraphrased into the
    // surrounding sentence.
    const { store } = spiedStore();
    await createPlan(store, "plan-solo", {
      firstContactDate: ABSORBING_FIRST_CONTACT_DAY,
      firstContactReason: "Patient was interstate for the first week.",
    });

    await renderPage();

    const note = screen.getByRole("note", { name: "First contact moved from the usual day" });
    expect(note).toHaveTextContent(ABSORBING_FIRST_CONTACT_DAY);
    expect(note).toHaveTextContent(/7 days after discharge/i);
    expect(note).toHaveTextContent("Patient was interstate for the first week.");
    expect(note).toHaveTextContent(/coordinator who created it gave this reason/i);
    // The old gap sentence is gone: the reason IS kept with the plan now.
    expect(note).not.toHaveTextContent(/not kept with the plan/i);
  });

  it("says an older plan predates the field, rather than blaming a coordinator (Ruling 108)", async () => {
    // The third case, and the one that will persist: a plan created before the column existed
    // holds null forever, because no placeholder was migrated into old rows. Reproduced here by
    // clearing the reason on a stored plan directly, which is the only way this suite can produce
    // a row the store itself can no longer create.
    const { store } = spiedStore();
    await createPlan(store, "plan-solo", {
      firstContactDate: ABSORBING_FIRST_CONTACT_DAY,
      firstContactReason: "Patient was interstate for the first week.",
    });
    forgetFirstContactReason(store, "plan-solo");

    await renderPage();

    const note = screen.getByRole("note", { name: "First contact moved from the usual day" });
    expect(note).toHaveTextContent(/created before reasons were kept with the plan/i);
    expect(note).toHaveTextContent(/Nobody failed to give one/i);
    expect(note).not.toHaveTextContent("Patient was interstate for the first week.");
  });

  it("names the retention clearance when a cleared episode holds no reason", async () => {
    // A cleared episode ALSO holds no reason, and saying "this plan predates the field" about one
    // would be a false statement on a clinical record. The screen tells them apart the same way
    // `NoNameHeldNotice` does -- a blank name on a released episode is the clearance.
    const { store } = spiedStore();
    const id = await createPlan(store, "plan-solo", {
      firstContactDate: ABSORBING_FIRST_CONTACT_DAY,
      firstContactReason: "Patient was interstate for the first week.",
    });
    await endPlan(store, id);
    const cleared = await store.markRetentionCleared(
      { planId: id },
      { actor: demoActorForRole("coordinator"), idempotencyKey: idempotencyKey("clear-reason-plan-solo") },
    );
    if (!cleared.ok) throw new Error(`markRetentionCleared refused: ${cleared.reason}`);

    await renderPage();

    const note = screen.getByRole("note", { name: "First contact moved from the usual day" });
    expect(note).toHaveTextContent(/retention clearance has since removed it/i);
    expect(note).not.toHaveTextContent(/created before reasons were kept/i);
    expect(note).not.toHaveTextContent("Patient was interstate for the first week.");
  });

  it("says the reason is part of a record this role may not read, and claims nothing about it", () => {
    // Review round 1, I-2. The fourth branch had no covering test: every `episode: null` render in
    // this file uses a discharge + 1 first contact, so all of them land in the default-day branch
    // and none reaches this prose at all. It could have been deleted or garbled with every gate
    // green -- which is what M13 below now demonstrates it cannot be.
    //
    // Built as a direct `PatientOverview` render rather than through the page, for the reason the
    // module comment gives: `episode: null` is a fact about the ACTOR that the PAGE decides, never
    // something this screen infers from an empty read. `permissions.ts` currently grants
    // `generateClinicalRecordSummary` to exactly the roles holding `viewReferral`, so no role can
    // produce this view through the store today, and a fixture that reached for one would be
    // asserting a grant rather than the branch.
    const record: PlanRecord = {
      plan: { id: planId("plan-x"), teamId: demoActorForRole("coordinator").teamId, state: "active", version: 1 },
      patientId: patientId(PATIENT),
      referralId: referralId("referral-x"),
      pathwayVersionId: pathwayVersionId("pathway-1"),
      dischargeAt: DISCHARGE,
      completedAt: null,
      outcome: "inProgress",
      assuranceAttestations: [],
      contacts: [
        {
          contact: { id: contactId("plan-x--contact-1"), planId: planId("plan-x"), state: "scheduled", version: 1 },
          planned: {
            sequence: 1,
            cadenceLabel: "Day 1",
            // Deliberately the ABSORBING day, not the default: a discharge + 1 first contact would
            // render the usual-day sentence and never reach the branch under test.
            calendarDay: ABSORBING_FIRST_CONTACT_DAY,
            sendAt: new Date("2026-08-22T02:00:00.000Z"),
            messageType: "first",
          },
        },
      ],
    };

    render(<PatientOverview patientId={PATIENT} view={episodeView({ record, episode: null, otherPlanCount: 0 })} />);

    const note = screen.getByRole("note", { name: "First contact moved from the usual day" });
    expect(note).toHaveTextContent(ABSORBING_FIRST_CONTACT_DAY);
    expect(note).toHaveTextContent(/not visible in the role you are acting in/i);
    // The load-bearing half: absence here is a fact about the actor, so the screen must not turn it
    // into a claim about the record. Each of the other three branches would be a false statement.
    expect(note).toHaveTextContent(/says nothing about whether one is held/i);
    expect(note).not.toHaveTextContent(/created before reasons were kept/i);
    expect(note).not.toHaveTextContent(/retention clearance/i);
  });

  it("shows the discharge day the whole calendar hangs off", async () => {
    const { store } = spiedStore();
    await createPlan(store, "plan-solo");

    await renderPage();

    expect(screen.getByTestId("caring-contacts-plan-summary")).toHaveTextContent(DISCHARGE_DAY);
  });
});

describe("the patient overview - what it may show about the person", () => {
  // Review round 1, owner decision. The first version withheld the mobile number and flagged it;
  // the owner reversed that. `getEpisode` already releases it on this screen, so it is taken from
  // the episode already in hand -- no read was added and none was widened.
  it("renders the patient's mobile number on the identity strip, labelled as invented", async () => {
    const { store } = spiedStore();
    await createPlan(store, "plan-solo");

    await renderPage();

    const identity = screen.getByRole("heading", { level: 2, name: "Rowan Sample" }).closest("section");
    expect(identity).not.toBeNull();
    expect(identity).toHaveTextContent("Mobile number:");
    expect(identity).toHaveTextContent("0400000000");
    // The one field on this screen a reader might act on, so the context travels with it.
    expect(identity).toHaveTextContent(/invented, and nothing in this workspace is ever sent to it/i);
  });

  // Not a control, and deliberately not dialable: nothing in this workspace calls anybody.
  it("renders the number as text, never as a tel: link", async () => {
    const { store } = spiedStore();
    await createPlan(store, "plan-solo");

    await renderPage();

    for (const link of screen.queryAllByRole("link")) {
      expect(link.getAttribute("href") ?? "").not.toMatch(/^tel:/);
    }
    expect(document.body.innerHTML).not.toContain("tel:");
  });

  it("says no number is held for a cleared episode, rather than rendering a blank", async () => {
    const { store } = spiedStore();
    const id = await createPlan(store, "plan-solo");
    await endPlan(store, id);
    const cleared = await store.markRetentionCleared(
      { planId: id },
      { actor: demoActorForRole("coordinator"), idempotencyKey: idempotencyKey("clear-number-plan-solo") },
    );
    if (!cleared.ok) throw new Error(`markRetentionCleared refused: ${cleared.reason}`);

    await renderPage();

    const identity = screen.getByRole("heading", { level: 2, name: PATIENT }).closest("section");
    expect(identity).not.toBeNull();
    expect(identity).toHaveTextContent("Mobile number: no number held for this episode");
    // A cleared field is "no number held", never a number and never an empty-looking gap.
    expect(identity).not.toHaveTextContent("0400000000");
  });

  it("falls back to the synthetic identifier, and says a name is not held, for a cleared episode", async () => {
    const { store } = spiedStore();
    const id = await createPlan(store, "plan-solo");
    await endPlan(store, id);
    const cleared = await store.markRetentionCleared(
      { planId: id },
      { actor: demoActorForRole("coordinator"), idempotencyKey: idempotencyKey("clear-plan-solo") },
    );
    if (!cleared.ok) throw new Error(`markRetentionCleared refused: ${cleared.reason}`);

    await renderPage();

    expect(screen.getByRole("heading", { level: 2, name: PATIENT })).toBeInTheDocument();
    expect(screen.getByRole("note", { name: "No name is held for this patient" })).toBeInTheDocument();
  });
});

/**
 * Sendability is keyed off `contact.state`, never off `planned.suppressed`.
 *
 * The two agree for every plan the STORE can currently produce, because the schedule absorbing
 * Week 1 into the first contact is the only suppression any repository write performs -- which is
 * exactly why the tests above cannot tell the derivations apart, and why swapping one for the
 * other left them all green. `applyContactTransition`'s `suppress` action moves any live contact
 * to `suppressed` and leaves `planned.suppressed` undefined; no store method calls it yet, and the
 * screen must already be right for the day one does. This is the same defect Task 5's finding N-2
 * named on the caseload row, one screen further along.
 *
 * The component is rendered directly here rather than through the page, because the fixture is one
 * the store cannot build. That is the whole point of it.
 */
describe("the patient overview - a contact suppressed by a later transition still counts", () => {
  const TEAM = demoActorForRole("coordinator").teamId;

  function entry(sequence: number, state: ContactState, options: { absorbed?: boolean } = {}): StoredContact {
    return {
      contact: { id: contactId(`plan-x--contact-${sequence}`), planId: planId("plan-x"), state, version: 1 },
      planned: {
        sequence,
        cadenceLabel: sequence === 1 ? "Day 1" : `Month ${sequence}`,
        calendarDay: `2026-0${sequence}-01`,
        sendAt: new Date(`2026-0${sequence}-01T02:00:00.000Z`),
        messageType: sequence === 1 ? "first" : "standard",
        ...(options.absorbed === true ? { suppressed: { reason: "absorbedByFirstContact" as const } } : {}),
      },
    };
  }

  const record: PlanRecord = {
    plan: { id: planId("plan-x"), teamId: TEAM, state: "active", version: 1 },
    patientId: patientId(PATIENT),
    referralId: referralId("referral-x"),
    pathwayVersionId: pathwayVersionId("pathway-1"),
    dischargeAt: new Date("2026-08-15T02:00:00.000Z"),
    completedAt: null,
    outcome: "inProgress",
    assuranceAttestations: [],
    // The middle entry is suppressed with NO `planned.suppressed` marker -- a later transition,
    // not the schedule's absorption.
    contacts: [entry(1, "scheduled"), entry(2, "suppressed"), entry(3, "scheduled")],
  };

  it("subtracts it from the count, and explains it as the cause this screen does not hold", () => {
    render(<PatientOverview patientId={PATIENT} view={episodeView({ record, episode: null, otherPlanCount: 0 })} />);

    expect(screen.getByTestId("caring-contacts-schedule-summary")).toHaveTextContent(
      "3 entries: 2 still to send, and 1 that will not be sent.",
    );
    const suppressed = screen.getByRole("group", { name: "Suppressed" });
    // Not the absorption wording: nothing here says this message collided with the first contact,
    // because nothing on this screen knows that it did.
    expect(suppressed).toHaveTextContent(/does not hold what caused that/i);
    expect(suppressed).not.toHaveTextContent(/same calendar day/i);
    expect(suppressed).toHaveTextContent(/never sent later/i);
  });
});

/**
 * C1, review round 1. The summary said "every one of them will be sent" for any plan holding no
 * SUPPRESSED contact -- so a withdrawn plan, or one stopped by a recorded death, announced ten
 * cancelled messages as ten messages still to come, directly above ten rows each reading
 * "Caring contact · Cancelled". On a suicide-prevention screen.
 *
 * Both plans are built through the real store, because both are reached by ordinary writes:
 * `withdrawPlan` and `recordHospitalStatusEvent`'s `cancelUnsent` outcome each run every unsent
 * contact through `{ type: "cancel" }`. Nothing here is a hand-built fixture, so nothing here can
 * be true of a plan the domain would never produce.
 */
describe("the patient overview - a plan that has ended says so, and never promises a send", () => {
  it("says none of a withdrawn plan's messages will be sent", async () => {
    const { store } = spiedStore();
    const id = await createPlan(store, "plan-solo");
    await endPlan(store, id);

    await renderPage();

    expect(screen.getByTestId("caring-contacts-schedule-summary")).toHaveTextContent(
      "10 entries, and none of them will be sent.",
    );
    // The old predicate's exact failure, pinned as the sentence it used to print: not one of
    // these contacts is suppressed, and every one of them is non-sendable.
    expect(screen.getByTestId("caring-contacts-schedule-summary")).not.toHaveTextContent(
      "every one of them will be sent",
    );
    expect(screen.getByTestId("caring-contacts-schedule-summary")).not.toHaveTextContent("still to");
  });

  it("says none of a death-stopped plan's messages will be sent", async () => {
    const { store } = spiedStore();
    const id = await createPlan(store, "plan-solo");
    await recordDeath(store, id);

    await renderPage();

    expect(screen.getByTestId("caring-contacts-schedule-summary")).toHaveTextContent(
      "10 entries, and none of them will be sent.",
    );
  });

  it("explains every cancelled message in place, rather than leaving a bare status beside it", async () => {
    const { store } = spiedStore();
    const id = await createPlan(store, "plan-solo");
    await endPlan(store, id);

    await renderPage();

    // Spec 4.4: one explanation per row, not one for the screen. Ruling 98 named only suppression;
    // a cancellation is equally the system having acted on its own.
    const cancelled = screen.getAllByRole("group", { name: "Cancelled" });
    expect(cancelled).toHaveLength(10);
    expect(cancelled[0]).toHaveTextContent(/This plan ended \(withdrawn\)/i);
    expect(cancelled[0]).toHaveTextContent(/cancelled every message that had not already gone out/i);
    expect(cancelled[0]).toHaveTextContent(/never sent later/i);
  });

  it("does not claim a plan still running ended, when one of its messages is cancelled", () => {
    const record: PlanRecord = {
      plan: { id: planId("plan-x"), teamId: demoActorForRole("coordinator").teamId, state: "active", version: 1 },
      patientId: patientId(PATIENT),
      referralId: referralId("referral-x"),
      pathwayVersionId: pathwayVersionId("pathway-1"),
      dischargeAt: new Date("2026-08-15T02:00:00.000Z"),
      completedAt: null,
      outcome: "inProgress",
      assuranceAttestations: [],
      contacts: [
        {
          contact: { id: contactId("plan-x--contact-1"), planId: planId("plan-x"), state: "cancelled", version: 1 },
          planned: {
            sequence: 1,
            cadenceLabel: "Day 1",
            calendarDay: "2026-08-16",
            sendAt: new Date("2026-08-16T02:00:00.000Z"),
            messageType: "first",
          },
        },
      ],
    };

    render(<PatientOverview patientId={PATIENT} view={episodeView({ record, episode: null, otherPlanCount: 0 })} />);

    const cancelled = screen.getByRole("group", { name: "Cancelled" });
    expect(cancelled).toHaveTextContent(/does not hold what caused that/i);
    expect(cancelled).not.toHaveTextContent(/This plan ended/i);
  });

  it("explains a missed message as a closed window, not as a send still to come", () => {
    const record: PlanRecord = {
      plan: { id: planId("plan-x"), teamId: demoActorForRole("coordinator").teamId, state: "active", version: 1 },
      patientId: patientId(PATIENT),
      referralId: referralId("referral-x"),
      pathwayVersionId: pathwayVersionId("pathway-1"),
      dischargeAt: new Date("2026-08-15T02:00:00.000Z"),
      completedAt: null,
      outcome: "inProgress",
      assuranceAttestations: [],
      contacts: [
        {
          contact: { id: contactId("plan-x--contact-1"), planId: planId("plan-x"), state: "missed", version: 1 },
          planned: {
            sequence: 1,
            cadenceLabel: "Day 1",
            calendarDay: "2026-08-16",
            sendAt: new Date("2026-08-16T02:00:00.000Z"),
            messageType: "first",
          },
        },
        {
          contact: { id: contactId("plan-x--contact-2"), planId: planId("plan-x"), state: "delivered", version: 1 },
          planned: {
            sequence: 2,
            cadenceLabel: "Month 1",
            calendarDay: "2026-09-15",
            sendAt: new Date("2026-09-15T02:00:00.000Z"),
            messageType: "standard",
          },
        },
        {
          contact: { id: contactId("plan-x--contact-3"), planId: planId("plan-x"), state: "scheduled", version: 1 },
          planned: {
            sequence: 3,
            cadenceLabel: "Month 2",
            calendarDay: "2026-10-15",
            sendAt: new Date("2026-10-15T02:00:00.000Z"),
            messageType: "standard",
          },
        },
      ],
    };

    render(<PatientOverview patientId={PATIENT} view={episodeView({ record, episode: null, otherPlanCount: 0 })} />);

    // All three buckets at once -- the only shape that proves the sentence is built from the
    // summary rather than from the absence of one state.
    expect(screen.getByTestId("caring-contacts-schedule-summary")).toHaveTextContent(
      "3 entries: 1 already sent, 1 still to send, and 1 that will not be sent.",
    );
    expect(screen.getByRole("group", { name: "Missed" })).toHaveTextContent(/window for sending this message closed/i);
  });
});

/**
 * Fixture helpers for the Task 10 blocks below.
 *
 * Hand-built rather than driven through the store, and only where the case CANNOT be reached
 * through one: a plan holding no attestation is a row created before the attestation existed, and
 * `createPlan` refuses an empty assurance list by name, so no store can produce one now. The
 * schedule shape is likewise not the subject of those blocks -- the store-driven blocks above own
 * that -- so a two-entry schedule keeps each assertion pointed at the one thing it is about.
 *
 * Every store-reachable case in this file's Task 10 blocks still goes through the real store.
 */
const FIXTURE_TEAM = demoActorForRole("coordinator").teamId;
const FIXTURE_PLAN = "plan-fixture";

function attestationFixture(assurance: PlanAssurance): PlanAssuranceAttestation {
  return { assurance, actorId: actorId("demo-coordinator"), attestedAt: new Date(NOW) };
}

function scheduleEntryFixture(
  sequence: number,
  state: ContactState,
  options: { cadenceLabel?: string; messageType?: MessageType } = {},
): StoredContact {
  return {
    contact: {
      id: contactId(`${FIXTURE_PLAN}--contact-${sequence}`),
      planId: planId(FIXTURE_PLAN),
      state,
      version: 1,
    },
    planned: {
      sequence,
      cadenceLabel: options.cadenceLabel ?? `Month ${sequence}`,
      calendarDay: `2026-0${sequence}-01`,
      sendAt: new Date(`2026-0${sequence}-01T02:00:00.000Z`),
      messageType: options.messageType ?? "standard",
    },
  };
}

/** The same plan, held in each of the two states that are not running. */
function pausedPlanFixture(): PlanRecord["plan"] {
  return { id: planId(FIXTURE_PLAN), teamId: FIXTURE_TEAM, state: "paused", version: 1 };
}

function draftPlanFixture(): PlanRecord["plan"] {
  return { id: planId(FIXTURE_PLAN), teamId: FIXTURE_TEAM, state: "draft", version: 1 };
}

/**
 * The plan-actions context a hand-built episode view is given when a case is not about the actions.
 *
 * DELIBERATELY THE PERMITTED, RUNNING, CARRIED SHAPE -- the one where every control is live. A
 * fixture that refused everything would let a case about some other part of the screen pass while
 * the actions rendered nothing at all, which is the vacuous-fixture failure this file already
 * guards against elsewhere. The cases that are about the actions build their own context or go
 * through the page.
 */
function planActionsFixture(overrides: Partial<PlanActionsContext> = {}): PlanActionsContext {
  return {
    planId: FIXTURE_PLAN,
    planState: "active",
    planVersion: 1,
    actingAccount: "coordinator",
    actingAccountWording: CARING_CONTACT_ROLE_WORDING.coordinator,
    carriedBy: { held: true, wording: CARING_CONTACT_ROLE_WORDING.coordinator },
    destinations: [{ actorId: "demo-teamLead", wording: CARING_CONTACT_ROLE_WORDING.teamLead }],
    granted: { pause: true, resume: true, withdrawal: true, reassignment: true },
    ...overrides,
  };
}

/** An episode view, with the plan-actions context defaulted for the cases that are not about it. */
function episodeView(
  view: Omit<Extract<PatientOverviewView, { kind: "episode" }>, "kind" | "actions"> & {
    actions?: PlanActionsContext;
  },
): PatientOverviewView {
  const { actions, ...rest } = view;
  return {
    kind: "episode",
    ...rest,
    actions:
      actions ?? planActionsFixture({ planState: rest.record.plan.state, planVersion: rest.record.plan.version }),
  };
}

function planRecordFixture(overrides: Partial<PlanRecord> = {}): PlanRecord {
  return {
    plan: { id: planId(FIXTURE_PLAN), teamId: FIXTURE_TEAM, state: "active", version: 1 },
    patientId: patientId(PATIENT),
    referralId: referralId("referral-fixture"),
    pathwayVersionId: pathwayVersionId("pathway-1"),
    dischargeAt: DISCHARGE,
    completedAt: null,
    outcome: "inProgress",
    assuranceAttestations: PLAN_ASSURANCE_VALUES.map(attestationFixture),
    contacts: [
      scheduleEntryFixture(1, "scheduled", { cadenceLabel: "Day 1", messageType: "first" }),
      scheduleEntryFixture(2, "scheduled"),
    ],
    ...overrides,
  };
}

/**
 * Task 10. The plan detail screen is this screen DEEPENED, not a second one (Ruling [128]):
 * `/caring-contacts/patients/[patientId]?plan=<planId>` already exists, `patientPlanRoute()` builds
 * it, and `CARING_CONTACTS_ROUTES` carries no key for a standalone plan page. So everything below
 * asserts against the same render the blocks above use.
 *
 * THE DEFECT THIS BLOCK IS WRITTEN FIRST FOR. A plan that is not RUNNING still holds contacts in
 * `scheduled`, because `pausePlan` is a plain lifecycle transition -- it moves the plan and touches
 * no contact -- so `contactSendability` classifies every one of them `stillToSend` and the summary
 * sentence above reads "every one of them is still to be sent". On a paused plan that sentence is
 * about the RECORD and reads as a promise about the future. The withdrawn and death-stopped plans
 * covered above are the case the domain already closes for itself (both cancel every unsent
 * contact); paused and draft are the two it does not, and they are where this screen could
 * reintroduce the "a stopped plan would still send" defect.
 */
describe("the patient overview - a plan that is not running must not read as forthcoming", () => {
  it("says a PAUSED plan is not running, and that a date below is not a message on its way", async () => {
    const { store } = spiedStore();
    const id = await createPlan(store, "plan-solo");
    const actor = demoActorForRole("coordinator");
    const activated = await store.activatePlan(
      { planId: id, expectedVersion: 1 },
      { actor, idempotencyKey: idempotencyKey("activate-pause") },
    );
    if (!activated.ok) throw new Error(`activatePlan refused: ${activated.reason}`);
    const paused = await store.pausePlan(
      { planId: id, expectedVersion: activated.value.plan.version },
      { actor, idempotencyKey: idempotencyKey("pause-plan-solo") },
    );
    if (!paused.ok) throw new Error(`pausePlan refused: ${paused.reason}`);

    await renderPage();

    // The domain's own classification is unchanged and is still reported honestly: pausing moved
    // the plan, not the contacts.
    expect(screen.getByTestId("caring-contacts-schedule-summary")).toHaveTextContent(
      "10 entries, and every one of them is still to be sent.",
    );
    // And the qualification that stops that sentence reading as a promise.
    const note = screen.getByRole("group", { name: "Paused" });
    expect(note).toHaveTextContent("this plan is paused");
    expect(note).toHaveTextContent("a date below is not a message on its way");
    expect(note).toHaveTextContent(/Resuming the plan/i);
  });

  it("says a DRAFT plan has not been started, in different words from the paused one", async () => {
    const { store } = spiedStore();
    await createPlan(store, "plan-solo");

    await renderPage();

    const note = screen.getByRole("group", { name: "Draft" });
    expect(note).toHaveTextContent("this plan has not been started");
    expect(note).toHaveTextContent("a date below is not a message on its way");
  });

  it("does not let draft and paused collapse into one note, and proves the locators first", () => {
    // REVIEW ROUND 2. These two negatives used to sit at the end of the case above, behind
    // `getByRole("group", { name: "Draft" })` -- and the mutation aimed at them (M6, the draft label
    // swapped for the paused one) makes THAT line fail first, so neither negative was ever reached.
    // A sibling that fails first does not prove the assertion behind it. They live in their own case
    // now, each preceded by the positive control that shows its locator can find what it is denying.
    render(
      <PatientOverview
        patientId={PATIENT}
        view={episodeView({
          record: planRecordFixture({ plan: pausedPlanFixture() }),
          episode: null,
          otherPlanCount: 0,
        })}
      />,
    );
    // Positive control: both locators DO find a paused note when the plan is paused.
    expect(screen.getByRole("group", { name: "Paused" })).toHaveTextContent(/paused/i);
    cleanup();

    render(
      <PatientOverview
        patientId={PATIENT}
        view={episodeView({
          record: planRecordFixture({ plan: draftPlanFixture() }),
          episode: null,
          otherPlanCount: 0,
        })}
      />,
    );
    // The group negative FIRST, so a mutated label reaches it rather than failing the line above it.
    expect(screen.queryByRole("group", { name: "Paused" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Draft" })).not.toHaveTextContent(/paused/i);
  });

  it("adds no such note to a running plan, so the note means something when it appears", async () => {
    const { store } = spiedStore();
    const id = await createPlan(store, "plan-solo");
    const activated = await store.activatePlan(
      { planId: id, expectedVersion: 1 },
      { actor: demoActorForRole("coordinator"), idempotencyKey: idempotencyKey("activate-running") },
    );
    if (!activated.ok) throw new Error(`activatePlan refused: ${activated.reason}`);

    // Positive control first (review round 2): the same locator DOES find a not-running note when
    // the plan is not running, so the two absences below are the plan's state rather than a query
    // that never matches anything.
    render(
      <PatientOverview
        patientId={PATIENT}
        view={episodeView({
          record: planRecordFixture({ plan: draftPlanFixture() }),
          episode: null,
          otherPlanCount: 0,
        })}
      />,
    );
    expect(screen.getByRole("group", { name: "Draft" })).toBeInTheDocument();
    cleanup();

    await renderPage();

    expect(screen.getByTestId("caring-contacts-plan-summary")).toHaveTextContent("Plan state: Active");
    expect(screen.queryByRole("group", { name: "Draft" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Paused" })).not.toBeInTheDocument();
  });

  it("adds no plan-level note to an ENDED plan, which already explains itself row by row", async () => {
    // The `stillToSend === 0` guard, which would otherwise be an unproven check. `withdrawPlan`
    // cancels every unsent contact, so a withdrawn plan has nothing that could read as forthcoming
    // and `notSentExplanation` has already given each row its own reason. A second, plan-level
    // sentence over the top of ten explained rows would be the screen saying the same thing twice
    // in different words -- and the branch it would come from says the record disagrees with
    // itself, which about a withdrawn plan would be false.
    const { store } = spiedStore();
    const id = await createPlan(store, "plan-solo");
    await endPlan(store, id);

    await renderPage();

    expect(screen.getByTestId("caring-contacts-schedule-summary")).toHaveTextContent(
      "10 entries, and none of them will be sent.",
    );
    expect(screen.queryByRole("group", { name: "Withdrawn" })).not.toBeInTheDocument();
    // The rows still carry their own reason, so nothing was lost by withholding the note -- and this
    // is the positive control for the absence above: the same `getByRole("group", { name })` locator
    // finds plenty here, so "no Withdrawn group" is the screen's answer, not a query that matches
    // nothing. Held to expected CONTENT rather than to a count greater than zero (review round 2),
    // because a count is satisfied by a group carrying any words at all.
    const cancelled = screen.getAllByRole("group", { name: "Cancelled" });
    expect(cancelled[0]).toHaveTextContent(
      "This plan ended (withdrawn), and the system cancelled every message that had not already gone out.",
    );
  });
});

/**
 * The two stored fields whose retention rules are deliberate OPPOSITES, on the first screen that
 * renders both.
 *
 * Ruling [105]: the first-contact reason is CLEARED, because it is clinician prose that will name
 * patients and places. Ruling [122]: the attestation is PRESERVED, because it is
 * `{ assurance, actorId, instant }` -- no patient content -- and is the same class as an audit
 * event, which de-identification deliberately keeps.
 *
 * The third case is the one that makes the pair visible at all: one cleared plan, rendered once,
 * where the reason is gone and the attestation is still there. A test that only proved each field
 * separately would pass against a screen that quietly rendered neither.
 */
describe("the patient overview - the attestation is recorded on the plan, and is not consent", () => {
  it("reads both attestations back in plain words, and never says the patient consented", async () => {
    const { store } = spiedStore();
    await createPlan(store, "plan-solo");

    await renderPage();

    const card = screen.getByRole("region", { name: "What was confirmed before this plan started" });
    // HELD TO EXPECTED CONTENT, not to `planAssuranceWording`'s own return value. Asserting the
    // rendered text against the same function that produced it is the shape Task 9b's mutation
    // falsified: emptying the map would move both sides together and the assertion would agree with
    // itself. The literals are here, and the map is pinned to them separately below, so a change to
    // either has to be made in two places by somebody who meant it.
    expect(card).toHaveTextContent("A coordinator confirmed that the patient had agreed to receive caring contacts");
    expect(card).toHaveTextContent("that the mobile number this plan uses is the patient's own");
    expect(planAssuranceWording(PLAN_ASSURANCES.patientAgreementConfirmed)).toBe(
      "that the patient had agreed to receive caring contacts",
    );
    expect(planAssuranceWording(PLAN_ASSURANCES.patientControlsMobileConfirmed)).toBe(
      "that the mobile number this plan uses is the patient's own",
    );

    // "Recorded on the plan" survives; "stored", "kept" and "recorded" alone do not -- this system
    // distinguishes held in a tab's storage from written onto the plan, ordinary English does not.
    // Asserted on the LIST rather than the card, so the claim is pinned where each attestation is
    // read back and not satisfied by the paragraph above it.
    const list = within(card).getByRole("list", { name: "Confirmations recorded on this plan" });
    expect(list).toHaveTextContent(/recorded on the plan on/i);
    // The instant is part of what an attestation is; a row without it is not one.
    expect(list).toHaveTextContent("2026-03-02 (AWST)");
    // The claim the design's `Agreement confirmed: Yes` makes, and the one this domain cannot back.
    expect(card).not.toHaveTextContent(/consent/i);
    expect(card).toHaveTextContent(/hospital record/i);
  });

  it("says a plan created before the attestation existed holds none, rather than rendering a blank", () => {
    // No backfill, on purpose: writing a placeholder would fabricate a clinical record. So the
    // emptiness is a fact to be stated, and a screen that showed nothing at all would leave a
    // reader to conclude nobody confirmed anything.
    // Positive control first (review round 2): on a plan that HOLDS attestations, both the list
    // locator and the wording below are found. Without it, the two absence assertions would agree
    // just as happily with a card that never renders a list under any circumstances.
    render(
      <PatientOverview
        patientId={PATIENT}
        view={episodeView({ record: planRecordFixture(), episode: null, otherPlanCount: 0 })}
      />,
    );
    const populated = screen.getByRole("region", { name: "What was confirmed before this plan started" });
    expect(within(populated).getByRole("list", { name: "Confirmations recorded on this plan" })).toBeInTheDocument();
    expect(populated).toHaveTextContent("that the patient had agreed to receive caring contacts");
    cleanup();

    const record = planRecordFixture({ assuranceAttestations: [] });

    render(<PatientOverview patientId={PATIENT} view={episodeView({ record, episode: null, otherPlanCount: 0 })} />);

    const card = screen.getByRole("region", { name: "What was confirmed before this plan started" });
    expect(card).toHaveTextContent(/holds no record of those confirmations/i);
    expect(card).toHaveTextContent(/before this plan began recording them/i);
    expect(card).not.toHaveTextContent("that the patient had agreed to receive caring contacts");
    expect(within(card).queryByRole("list", { name: "Confirmations recorded on this plan" })).not.toBeInTheDocument();
  });

  it("keeps the attestation on a cleared plan while the first-contact reason has gone", async () => {
    const { store } = spiedStore();
    const id = await createPlan(store, "plan-solo", {
      firstContactDate: ABSORBING_FIRST_CONTACT_DAY,
      firstContactReason: "Patient was interstate for the first week.",
    });
    await endPlan(store, id);
    const cleared = await store.markRetentionCleared(
      { planId: id },
      { actor: demoActorForRole("coordinator"), idempotencyKey: idempotencyKey("clear-plan-solo") },
    );
    if (!cleared.ok) throw new Error(`markRetentionCleared refused: ${cleared.reason}`);

    await renderPage();

    // Cleared: the prose a clinician wrote is gone, and the screen says WHICH absence it is.
    const reason = screen.getByRole("note", { name: "First contact moved from the usual day" });
    expect(reason).not.toHaveTextContent("Patient was interstate for the first week.");
    expect(reason).toHaveTextContent(/retention clearance has since removed it/i);

    // Preserved: same render, same plan. Held to expected content for the reason the first case
    // records -- a cleared plan whose attestation had ALSO gone would agree with a screen that
    // rendered neither.
    const card = screen.getByRole("region", { name: "What was confirmed before this plan started" });
    expect(card).toHaveTextContent("A coordinator confirmed that the patient had agreed to receive caring contacts");
    expect(card).toHaveTextContent(/no patient detail/i);
  });
});

/**
 * `delivery-detail`'s inbound path (`docs/caring-contacts/interaction-matrix.md`): full-screen stage
 * on a phone, inspection drawer on a desktop, `mutation: No`.
 *
 * The control is offered only where the domain says a message left, and it asks
 * `contactSendability` rather than listing states here -- that classification lives in ./model
 * beside the state machine that produces it, and a second copy of it on a screen is the defect
 * `summariseStoredContacts` exists to have removed once.
 */
describe("the patient overview - the delivery detail overlay is wired only where a message left", () => {
  it("offers it on a message that went out, naming the row it was opened from", () => {
    const record = planRecordFixture({
      contacts: [
        scheduleEntryFixture(1, "delivered", { cadenceLabel: "Day 1", messageType: "first" }),
        scheduleEntryFixture(2, "scheduled", { cadenceLabel: "Month 1" }),
      ],
    });

    render(<PatientOverview patientId={PATIENT} view={episodeView({ record, episode: null, otherPlanCount: 0 })} />);

    // FILTERED BY ROW, not counted across the screen. Task 11a added the `activation-success`
    // control to the confirmations card above, so a bare count is no longer a statement about this
    // row -- and a bare count that quietly absorbed a second row would be worse than no count.
    const triggers = screen
      .getAllByTestId("workspace-overlay-trigger")
      .filter((element) => element.getAttribute("data-overlay-trigger") === "delivery-detail");
    expect(triggers).toHaveLength(1);
    // The row appears as the control's ORIGIN, so ten of these are told apart by a reader who
    // cannot see which row each sits in.
    expect(triggers[0]).toHaveAccessibleName(/opened from the Day 1 row/);
    // And the promise itself is GENERIC, because the drawer is: `OverlayHost` takes no children and
    // renders only the row's frozen summary, so a label reading "what the phone network reported for
    // Day 1" would advertise a per-contact report that the surface it opens does not contain
    // (review round 2).
    expect(triggers[0]).toHaveAccessibleName(/^What a delivery receipt means/);
  });

  it("offers none on a plan where nothing has left yet", () => {
    const record = planRecordFixture({
      contacts: [
        scheduleEntryFixture(1, "scheduled", { cadenceLabel: "Day 1", messageType: "first" }),
        scheduleEntryFixture(2, "cancelled", { cadenceLabel: "Month 1" }),
      ],
    });

    render(<PatientOverview patientId={PATIENT} view={episodeView({ record, episode: null, otherPlanCount: 0 })} />);

    expect(
      screen
        .queryAllByTestId("workspace-overlay-trigger")
        .filter((element) => element.getAttribute("data-overlay-trigger") === "delivery-detail"),
    ).toHaveLength(0);
  });

  it("refuses to be the workspace's escape hatch from Ruling 87 on a row that records something", () => {
    // The guard is what separates this from the silent no-op Ruling 87 forbids: it is legitimate
    // ONLY because the row's decision is an exit and the host performs the close itself.
    expect(() => exitOnlyOverlayCommit("delivery-detail")).not.toThrow();
    // REVIEW ROUND 2, and this is the assertion the first version was missing. "Does not throw" says
    // nothing about WHICH commit comes back, and the whole decision this module exists to take is
    // `record` rather than `unavailable`. `commitRefusalFor` is exported, pure and TOTAL over the
    // three states of the slot, so the difference is decidable right here: an `unavailable` commit
    // answers with an `every-row` refusal, which the host would render as an aria-disabled EXIT --
    // the defect Ruling [90] fixed. Only a `record` commit answers null.
    //
    // I first reported this as unprovable offline and deferred it to Playwright. That was wrong, and
    // the reason is worth more than the fix: `tests/caring-contacts-overlay-trigger.dom.test.tsx`
    // already draws exactly this distinction, and it is NOT in `test:cc-guards`. Reasoning from
    // "what does my gate run?" I concluded no offline test could tell two behaviours apart that an
    // unrun suite tells apart today. A gate that omits a suite does not merely skip coverage -- it
    // hides the precedent.
    expect(commitRefusalFor(exitOnlyOverlayCommit("delivery-detail"))).toBeNull();
    expect(() => exitOnlyOverlayCommit("withdrawal")).toThrow(/records a decision/i);
    expect(() => exitOnlyOverlayCommit("not-an-overlay")).toThrow(/No overlay is defined/i);
  });
});

/**
 * `activation-success`'s inbound path (`docs/caring-contacts/interaction-matrix.md`, "Patient
 * overview outcome"): bottom sheet on a phone, dialog on a desktop, `mutation: No`.
 *
 * WHY IT IS OFFERED ON A RUNNING PLAN AND NOWHERE ELSE. The wizard clears its draft and navigates
 * the instant both writes land, so a control rendered there would exist for the width of a
 * navigation; the frozen row puts it on this screen instead. And on a plan that is NOT running, a
 * confirmation that the plan is recorded and started would contradict `planNotRunningNote` a few
 * sections below — two statements about one fact disagreeing on one screen is the defect Task 9
 * found in the wizard's own copy.
 */
describe("the patient overview - the activation outcome is offered only while the plan is running", () => {
  it("offers it beside the confirmations on a running plan, promising only what the drawer holds", () => {
    render(
      <PatientOverview
        patientId={PATIENT}
        view={episodeView({ record: planRecordFixture(), episode: null, otherPlanCount: 0 })}
      />,
    );

    const card = screen.getByRole("region", { name: "What was confirmed before this plan started" });
    const triggers = within(card)
      .getAllByTestId("workspace-overlay-trigger")
      .filter((element) => element.getAttribute("data-overlay-trigger") === "activation-success");
    expect(triggers, "the activation outcome has no inbound path on a running plan").toHaveLength(1);
    // Generic, because the drawer is: `OverlayHost` takes no children and renders only the row's
    // frozen summary, so a label naming THIS plan would advertise something the surface it opens
    // does not contain. Same limit `delivery-detail` records above.
    expect(triggers[0]).toHaveAccessibleName(/^What starting a plan puts on the record/);
    expect(triggers[0].className, "the outcome control is not a production tap target").toContain("min-h-tap");
    expect(triggers[0].className).not.toContain("min-h-11");
  });

  for (const notRunning of [pausedPlanFixture(), draftPlanFixture()] as const) {
    it(`offers none on a ${notRunning.state} plan, which this screen says is not running`, () => {
      render(
        <PatientOverview
          patientId={PATIENT}
          view={episodeView({ record: planRecordFixture({ plan: notRunning }), episode: null, otherPlanCount: 0 })}
        />,
      );

      expect(
        screen
          .queryAllByTestId("workspace-overlay-trigger")
          .filter((element) => element.getAttribute("data-overlay-trigger") === "activation-success"),
      ).toHaveLength(0);
    });
  }

  it("takes the exit commit, which refuses any row that records something", () => {
    // The same guard `delivery-detail` leans on, asked of this row: `exitOnlyOverlayCommit` is
    // legitimate ONLY because the row's decision is an exit and the host performs the close itself.
    // "Does not throw" says nothing about WHICH commit comes back, so the second line decides it:
    // an `unavailable` commit answers with an `every-row` refusal the host would render as an
    // aria-disabled EXIT, which is the defect Ruling [90] fixed. Only a `record` commit answers null.
    expect(() => exitOnlyOverlayCommit("activation-success")).not.toThrow();
    expect(commitRefusalFor(exitOnlyOverlayCommit("activation-success"))).toBeNull();
    // And the guard still bites for the plan actions on this same screen's roadmap, so this is not
    // a universal escape hatch from Ruling 87.
    expect(() => exitOnlyOverlayCommit("pause")).toThrow(/records a decision/i);
  });
});
