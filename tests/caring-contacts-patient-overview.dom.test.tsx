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
//   4. Ruling 96's display half, and the gap under it. The first contact date is shown; when it is
//      not the default of discharge + 1 the screen must say so in place. The recorded REASON is
//      validated by `buildApprovedSchedule` and then discarded by both stores -- it reaches no
//      column and no field -- so the screen states that absence rather than staying silent about a
//      moved date.
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

import { CARING_CONTACTS_ROLE_COOKIE, demoActorForRole } from "@/lib/caring-contacts-server/session";
import type { AccessRecord } from "@/lib/caring-contacts/access-audit";
import { fixedClock } from "@/lib/caring-contacts/clock";
import { idempotencyKey, pathwayVersionId, patientId, planId, referralId, type PlanId } from "@/lib/caring-contacts/ids";
import { createInMemoryRepository } from "@/lib/caring-contacts/in-memory-repository";
import type { CaringContactRepository } from "@/lib/caring-contacts/repository";

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
      "10 entries, and every one of them will be sent.",
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
      "10 entries: 9 that will be sent, and 1 that will not.",
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

  it("states IN PLACE that a moved first contact's recorded reason is not held with the plan", async () => {
    const { store } = spiedStore();
    await createPlan(store, "plan-solo", {
      firstContactDate: ABSORBING_FIRST_CONTACT_DAY,
      firstContactReason: "Patient was interstate for the first week.",
    });

    await renderPage();

    const note = screen.getByRole("note", { name: "First contact moved from the usual day" });
    expect(note).toHaveTextContent(ABSORBING_FIRST_CONTACT_DAY);
    expect(note).toHaveTextContent(/7 days after discharge/i);
    // The gap, stated rather than invented or omitted.
    expect(note).toHaveTextContent(/reason .* is not kept with the plan/i);
  });

  it("shows the discharge day the whole calendar hangs off", async () => {
    const { store } = spiedStore();
    await createPlan(store, "plan-solo");

    await renderPage();

    expect(screen.getByTestId("caring-contacts-plan-summary")).toHaveTextContent(DISCHARGE_DAY);
  });
});

describe("the patient overview - what it may show about the person", () => {
  it("never renders the patient's mobile number, though getEpisode released it", async () => {
    const { store } = spiedStore();
    await createPlan(store, "plan-solo");

    await renderPage();

    expect(document.body.textContent).not.toContain("0400000000");
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
