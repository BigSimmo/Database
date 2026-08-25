// tests/caring-contacts-schedule-page.dom.test.tsx
//
// `/caring-contacts/schedule` (`src/app/caring-contacts/schedule/page.tsx`) -- the team's schedule.
//
// THE THREE CONTRACTS THIS FILE EXISTS FOR, none of them visible from reading the page:
//
//   1. AN EMPTY DAY IS NOT A MISSING RESOURCE. `auditedRead` maps a `null`/`undefined` release to
//      `denied`, and `readHandler` turns `denied` into `not-found`. An empty ARRAY is neither, so a
//      team with no plans renders the empty STATE on the success path and `notFound()` is never
//      reached. `listPlans` returning `[]` and `getPlan` returning `null` look alike at a glance.
//
//   2. THE TRAIL RECORDS THE QUESTION, NOT THE MECHANISM. The store read is `listPlans`, but the
//      access event is `{ search, contactSchedule, "<from>:<to>" }` -- the identity
//      `src/app/api/caring-contacts/schedule/route.ts` records for the same question. Recording it
//      as `plan` would be defensible by provenance and wrong by meaning: the trail has no
//      `objectId` filter, so a caseload read and a schedule read sharing a member would become one
//      undifferentiated stream and "which days did this clinician look at" would stop being
//      answerable.
//
//   3. IT READS NO PATIENT NAME. The caseload reads `listPatientNames`; this screen deliberately
//      does not, so that the one trail row that means "somebody read patients' names" is not
//      written every time a coordinator glances at a day. That is a claim about a read the page
//      does NOT make, which nothing else in the suite would notice being added.
//
// Built on the same helper shape as `tests/caring-contacts-patients-page.dom.test.tsx`.
import { render, screen } from "@testing-library/react";
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

import { scheduleDayLabel } from "@/components/caring-contacts/workspace/schedule-screen";
import { CARING_CONTACTS_ROLE_COOKIE, demoActorForRole } from "@/lib/caring-contacts-server/session";
import type { AccessRecord } from "@/lib/caring-contacts/access-audit";
import { fixedClock } from "@/lib/caring-contacts/clock";
import { idempotencyKey, pathwayVersionId, patientId, planId, referralId } from "@/lib/caring-contacts/ids";
import { createInMemoryRepository } from "@/lib/caring-contacts/in-memory-repository";
import type { CaringContactRepository } from "@/lib/caring-contacts/repository";

let mockCookies: Record<string, { value: string } | undefined> = {};

/**
 * 2026-08-30 11:00 AWST. The clock matters here in a way it does not in the component suite: this
 * page resolves "today" from it, and every day the strip asks for is measured from that answer.
 */
const NOW = "2026-08-30T03:00:00.000Z";
const TODAY = "2026-08-30";
const MONTH_END = "2026-08-31";

function inMemoryStoreWithSpy(role = "coordinator"): {
  store: CaringContactRepository;
  recorded: () => AccessRecord[];
} {
  mockCookies = { [CARING_CONTACTS_ROLE_COOKIE]: { value: role } };

  const repository = createInMemoryRepository(fixedClock(NOW));
  const records: AccessRecord[] = [];
  const store: CaringContactRepository = {
    ...repository,
    async recordAccess(record: AccessRecord) {
      await repository.recordAccess(record);
      records.push(record);
    },
  };

  mocks.store.current = store;
  return { store, recorded: () => records };
}

/** One active plan, created through the real write path so its schedule is a real one. */
async function seedActivePlan(store: CaringContactRepository): Promise<void> {
  const id = planId("SYN-PLAN-PAGE-001");
  const created = await store.createPlan(
    {
      planId: id,
      referralId: referralId("SYN-REFERRAL-PAGE-001"),
      patientId: patientId("SYN-PATIENT-PAGE-001"),
      pathwayVersionId: pathwayVersionId("SYN-PATHWAY-001"),
      dischargeAt: new Date("2026-08-30T02:00:00.000Z"),
      sendingPreference: "morning",
      patientDetail: {
        patientName: "Synthetic Patient Page",
        patientMobileNumber: "+61 491 570 156",
        patientIdentifiers: ["UR-PAGE-001"],
        culturalIdentity: null,
      },
    },
    { actor: demoActorForRole("coordinator"), idempotencyKey: idempotencyKey("page-create") },
  );
  if (!created.ok) throw new Error(`seed createPlan refused: ${created.reason}`);
  const activated = await store.activatePlan(
    { planId: id, expectedVersion: created.value.plan.version },
    { actor: demoActorForRole("coordinator"), idempotencyKey: idempotencyKey("page-activate") },
  );
  if (!activated.ok) throw new Error(`seed activatePlan refused: ${activated.reason}`);
}

async function renderPage(searchParams: Record<string, string | string[] | undefined> = {}) {
  const { default: SchedulePage } = await import("@/app/caring-contacts/schedule/page");
  const element = await SchedulePage({ searchParams: Promise.resolve(searchParams) });
  // The shell is the page's root; the screen it wraps is what this file inspects. Rendering the
  // shell itself would drag `next/dynamic` and the whole workspace chrome into a test about one
  // screen's body.
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

describe("the /caring-contacts/schedule page — an empty schedule is not a missing resource", () => {
  it("renders the empty STATE on the success path when the team has no plans, and never calls notFound()", async () => {
    inMemoryStoreWithSpy();

    const element = await renderPage();

    expect(element).toBeTruthy();
    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: "No contacts in these days" })).toBeInTheDocument();
  });

  it("records the empty schedule read as ALLOWED, the outcome an empty array actually earns", async () => {
    const { recorded } = inMemoryStoreWithSpy();

    await renderPage();

    const scheduleReads = recorded().filter((record) => record.objectType === "contactSchedule");
    expect(scheduleReads.map((record) => record.outcome)).toEqual(["allowed"]);
  });
});

describe("the /caring-contacts/schedule page — what the access trail records", () => {
  it("records the schedule question and the days it covered, not the caseload read underneath it", async () => {
    const { recorded } = inMemoryStoreWithSpy();

    await renderPage();

    // Three days before today, seven days long: this is the range the page asks for, written out
    // rather than derived here, so a change to the strip cannot quietly change what the trail says.
    expect(recorded().map((record) => [record.kind, record.objectType, record.objectId])).toEqual([
      ["administrative", "serviceState", "service"],
      ["search", "contactSchedule", "2026-08-27:2026-09-02"],
    ]);
    // The caseload's own member is NOT written by this page. Sharing it would make the two reads
    // one undifferentiated stream on a trail with no `objectId` filter.
    expect(recorded().some((record) => record.objectType === "plan")).toBe(false);
  });

  it("records no patient-name read, because it makes none", async () => {
    const { recorded } = inMemoryStoreWithSpy();
    await seedActivePlan(mocks.store.current as CaringContactRepository);

    await renderPage();

    // The premise: this render really did have patients to name. Without it the assertion below
    // would pass on a page that rendered nothing at all.
    expect(screen.getAllByRole("heading", { level: 5 }).length).toBeGreaterThan(0);
    expect(recorded().some((record) => record.objectType === "patientName")).toBe(false);
    // And the rows are headed by the synthetic identifier, which is what this read releases.
    expect(screen.getAllByRole("heading", { level: 5 }).map((heading) => heading.textContent)).toContain(
      "SYN-PATIENT-PAGE-001",
    );
  });

  it("records the days the URL asked for, not the days today happens to be in", async () => {
    const { recorded } = inMemoryStoreWithSpy();

    await renderPage({ day: "2026-09-10" });

    expect(recorded().map((record) => record.objectId)).toEqual(["service", "2026-09-07:2026-09-13"]);
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe(scheduleDayLabel("2026-09-10"));
  });
});

describe("the /caring-contacts/schedule page — which day it opens on", () => {
  it("opens on today when the URL names no day, and marks it as today", async () => {
    inMemoryStoreWithSpy();

    await renderPage();

    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe(`${scheduleDayLabel(TODAY)} (today)`);
  });

  it("opens on the day the URL names, and still marks which day is today", async () => {
    inMemoryStoreWithSpy();
    await seedActivePlan(mocks.store.current as CaringContactRepository);

    await renderPage({ day: MONTH_END });

    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe(scheduleDayLabel(MONTH_END));
    const strip = screen.getByRole("navigation", { name: "Choose a day" });
    const today = strip.querySelector(`[data-schedule-day='${TODAY}']`);
    expect(today?.getAttribute("aria-label")).toContain("(today)");
    expect(today?.getAttribute("aria-current")).toBeNull();
  });

  it("falls back to today for an impossible day rather than failing the render", async () => {
    inMemoryStoreWithSpy();

    await renderPage({ day: "2026-02-30" });

    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe(`${scheduleDayLabel(TODAY)} (today)`);
  });
});

describe("the /caring-contacts/schedule page — failing closed", () => {
  it("throws rather than rendering a schedule beside a service-state read that failed", async () => {
    const { store } = inMemoryStoreWithSpy();
    mocks.store.current = {
      ...store,
      async getServiceState() {
        throw new Error("service state unavailable");
      },
    } satisfies CaringContactRepository;

    await expect(renderPage()).rejects.toThrow("service state unavailable");
  });

  it("throws rather than rendering a day from a plans read that failed", async () => {
    const { store } = inMemoryStoreWithSpy();
    mocks.store.current = {
      ...store,
      async listPlans() {
        throw new Error("plans unavailable");
      },
    } satisfies CaringContactRepository;

    await expect(renderPage()).rejects.toThrow("plans unavailable");
  });

  it("throws rather than rendering a quiet week from a store that broke the array contract", async () => {
    const { store } = inMemoryStoreWithSpy();
    mocks.store.current = {
      ...store,
      async listPlans() {
        return null as unknown as never;
      },
    } satisfies CaringContactRepository;

    await expect(renderPage()).rejects.toThrow(/schedule read returned no list/);
  });
});
