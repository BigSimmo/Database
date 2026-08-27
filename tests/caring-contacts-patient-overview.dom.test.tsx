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
import { render, screen, within } from "@testing-library/react";
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

import { PatientOverview } from "@/components/caring-contacts/workspace/patient-overview";
import { CARING_CONTACTS_ROLE_COOKIE, demoActorForRole } from "@/lib/caring-contacts-server/session";
import type { AccessRecord } from "@/lib/caring-contacts/access-audit";
import { PLAN_ASSURANCE_VALUES } from "@/lib/caring-contacts/assurances";
import { fixedClock } from "@/lib/caring-contacts/clock";
import {
  contactId,
  idempotencyKey,
  pathwayVersionId,
  patientId,
  planId,
  referralId,
  type PlanId,
} from "@/lib/caring-contacts/ids";
import type { ContactState } from "@/lib/caring-contacts/model";
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
        preferredName: "Rowan",
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

    render(
      <PatientOverview patientId={PATIENT} view={{ kind: "episode", record, episode: null, otherPlanCount: 0 }} />,
    );

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

  it("shows the name the messages open with", async () => {
    const { store } = spiedStore();
    await createPlan(store, "plan-solo");

    await renderPage();

    const identity = screen.getByRole("heading", { level: 2, name: "Rowan Sample" }).closest("section");
    expect(identity).toHaveTextContent("Called this in messages: Rowan");
  });

  it("tells a CLEARED preferred name apart from one that was never held", async () => {
    // Three values, three facts, and the two absences must not read as the same one. `""` is what
    // `markRetentionCleared` writes; `null` is an episode that predates the column or whose caller
    // supplied none. A screen that rendered both as one sentence would report a name a clinician
    // recorded and retention removed as a name nobody ever gave.
    const { store } = spiedStore();
    const id = await createPlan(store, "plan-solo");
    await endPlan(store, id);
    const cleared = await store.markRetentionCleared(
      { planId: id },
      { actor: demoActorForRole("coordinator"), idempotencyKey: idempotencyKey("clear-preferred-plan-solo") },
    );
    if (!cleared.ok) throw new Error(`markRetentionCleared refused: ${cleared.reason}`);

    await renderPage();

    const identity = screen.getByRole("heading", { level: 2, name: PATIENT }).closest("section");
    expect(identity).toHaveTextContent("Called this in messages: removed when this episode was de-identified");
    // Not the name itself, and not the wording reserved for an episode that never held one.
    expect(identity).not.toHaveTextContent("Called this in messages: Rowan");
    expect(identity).not.toHaveTextContent("none is held for this episode");
  });

  it("says none is held, without naming a cause, for an episode that never had one", async () => {
    // The other side of the partition, and the reason both cases exist: a screen collapsing the two
    // would pass whichever one it was tested against alone. This fixture is one the store cannot
    // build today -- every plan it creates records a preferred name -- so the episode is handed to
    // the component directly, exactly as the suppression fixture below is.
    const { store } = spiedStore();
    const id = await createPlan(store, "plan-solo");
    const record = await store.getPlan(id, { actor: demoActorForRole("coordinator") });
    const episode = await store.getEpisode(id, { actor: demoActorForRole("coordinator") });
    if (record === null || episode === null) throw new Error("the fixture plan was not readable");

    // Positive control: the episode the store really built DOES hold one, so the sentence below is
    // the null case being rendered rather than this screen never showing a name at all.
    expect(episode.preferredName).toBe("Rowan");

    render(
      <PatientOverview
        patientId={PATIENT}
        view={{ kind: "episode", record, episode: { ...episode, preferredName: null }, otherPlanCount: 0 }}
      />,
    );

    const identity = screen.getByRole("heading", { level: 2, name: "Rowan Sample" }).closest("section");
    expect(identity).toHaveTextContent("Called this in messages: none is held for this episode");
    expect(identity).not.toHaveTextContent("removed when this episode was de-identified");
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
    render(
      <PatientOverview patientId={PATIENT} view={{ kind: "episode", record, episode: null, otherPlanCount: 0 }} />,
    );

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

    render(
      <PatientOverview patientId={PATIENT} view={{ kind: "episode", record, episode: null, otherPlanCount: 0 }} />,
    );

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

    render(
      <PatientOverview patientId={PATIENT} view={{ kind: "episode", record, episode: null, otherPlanCount: 0 }} />,
    );

    // All three buckets at once -- the only shape that proves the sentence is built from the
    // summary rather than from the absence of one state.
    expect(screen.getByTestId("caring-contacts-schedule-summary")).toHaveTextContent(
      "3 entries: 1 already sent, 1 still to send, and 1 that will not be sent.",
    );
    expect(screen.getByRole("group", { name: "Missed" })).toHaveTextContent(/window for sending this message closed/i);
  });
});
