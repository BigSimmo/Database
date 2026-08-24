// tests/caring-contacts-patients-page.dom.test.tsx
//
// `/caring-contacts/patients` (`src/app/caring-contacts/patients/page.tsx`) -- the team's caseload.
//
// THE CONTRACT THIS FILE EXISTS FOR, and the one thing that survived the cut of Task 2:
//
//   `auditedRead` maps a `null`/`undefined` release to `denied`, and `readHandler` turns `denied`
//   into `not-found`. AN EMPTY ARRAY IS NEITHER. A team with no plans yet has a real, readable,
//   permitted, EMPTY caseload -- and an empty caseload must never present as a missing resource.
//
// That is not obvious from reading the page: `listPlans` returning `[]` and `getPlan` returning
// `null` look alike at a glance, and `handler.ts`'s own note says the access trail cannot tell
// "you may not see these" from "there are none" for a list. So the render shape is pinned here
// deliberately rather than left to a comment: empty renders the empty STATE on the success path,
// and `notFound()` is never called.
//
// Built on the same helper shape as `caring-contacts-page-access-audit.test.ts`, which pins the
// equivalent contract for the Today page's service-state read.
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

import { CARING_CONTACTS_ROLE_COOKIE, demoActorForRole } from "@/lib/caring-contacts-server/session";
import type { AccessRecord } from "@/lib/caring-contacts/access-audit";
import { fixedClock } from "@/lib/caring-contacts/clock";
import { pathwayVersionId, patientId, planId, referralId } from "@/lib/caring-contacts/ids";
import { createInMemoryRepository } from "@/lib/caring-contacts/in-memory-repository";
import type { CaringContactRepository, PlanRecord } from "@/lib/caring-contacts/repository";

let mockCookies: Record<string, { value: string } | undefined> = {};

const NOW = "2026-03-02T03:00:00.000Z";

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

/** One synthetic plan record, carrying no patient-identifying detail -- `PlanRecord`, never `Episode`. */
function planRecord(id: string): PlanRecord {
  return {
    plan: { id: planId(id), teamId: demoActorForRole("coordinator").teamId, state: "active", version: 1 },
    patientId: patientId(`patient-${id}`),
    referralId: referralId(`referral-${id}`),
    pathwayVersionId: pathwayVersionId("pathway-1"),
    dischargeAt: new Date("2026-03-01T02:00:00.000Z"),
    completedAt: null,
    outcome: "inProgress",
    contacts: [],
  };
}

async function renderPage(searchParams: Record<string, string | string[] | undefined> = {}) {
  const { default: PatientsPage } = await import("@/app/caring-contacts/patients/page");
  const element = await PatientsPage({ searchParams: Promise.resolve(searchParams) });
  // The shell is the page's root; the directory it wraps is what this file inspects. Rendering
  // the shell itself would drag `next/dynamic` and the whole workspace chrome into a test about
  // one screen's body.
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

describe("the /caring-contacts/patients page - an empty caseload is not a missing resource", () => {
  it("renders the empty STATE on the success path when the team has no plans, and never calls notFound()", async () => {
    inMemoryStoreWithSpy();

    const element = await renderPage();

    expect(element).toBeTruthy();
    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: /no patients yet/i })).toBeInTheDocument();
  });

  it("records the empty list read as ALLOWED, the outcome an empty array actually earns", async () => {
    const { recorded } = inMemoryStoreWithSpy();

    await renderPage();

    // `auditedRead` maps null/undefined to "denied"; `[]` is neither, so this must be "allowed".
    // A "denied" here would be the same defect wearing a different hat.
    expect(recorded()).toContainEqual(
      expect.objectContaining({
        kind: "search",
        objectType: "plan",
        objectId: "all",
        outcome: "allowed",
        actorId: demoActorForRole("coordinator").id,
      }),
    );
  });
});

describe("the /caring-contacts/patients page - reads", () => {
  it("uses the same access identity the plans API route already records", async () => {
    const { store, recorded } = inMemoryStoreWithSpy();
    vi.spyOn(store, "listPlans").mockResolvedValue([planRecord("plan-1")]);

    await renderPage();

    expect(recorded()).toContainEqual(
      expect.objectContaining({ kind: "search", objectType: "plan", objectId: "all", outcome: "allowed" }),
    );
    // And the service state, so the safety banner on this screen is a state that was READ.
    expect(recorded()).toContainEqual(
      expect.objectContaining({ kind: "administrative", objectType: "serviceState", outcome: "allowed" }),
    );
  });

  it("never reads the episode - the one read that releases a name, a mobile number or an identifier", async () => {
    const { store } = inMemoryStoreWithSpy();
    const getEpisode = vi.spyOn(store, "getEpisode");
    vi.spyOn(store, "listPlans").mockResolvedValue([planRecord("plan-1")]);

    await renderPage();

    expect(getEpisode).not.toHaveBeenCalled();
  });

  it("lists a plan the team holds, keyed by its synthetic patient identifier", async () => {
    const { store } = inMemoryStoreWithSpy();
    vi.spyOn(store, "listPlans").mockResolvedValue([planRecord("plan-1"), planRecord("plan-2")]);

    await renderPage();

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "patient-plan-1" })).toBeInTheDocument();
  });

  it("applies the URL state filter server-side, and says so rather than showing an empty caseload", async () => {
    const { store } = inMemoryStoreWithSpy();
    vi.spyOn(store, "listPlans").mockResolvedValue([planRecord("plan-1")]);

    await renderPage({ state: "paused" });

    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: /no patients match/i })).toBeInTheDocument();
    expect(screen.queryByText("No patients yet")).toBeNull();
  });
});

describe("the /caring-contacts/patients page - fails closed", () => {
  it("throws rather than rendering when the access trail cannot take the event", async () => {
    const { store } = inMemoryStoreWithSpy();
    vi.spyOn(store, "recordAccess").mockRejectedValue(new Error("access trail unavailable"));

    const { default: PatientsPage } = await import("@/app/caring-contacts/patients/page");

    await expect(PatientsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(/access trail is unavailable/i);
  });

  it("throws rather than rendering when the plans read itself fails, and still records the attempt", async () => {
    const { store, recorded } = inMemoryStoreWithSpy();
    vi.spyOn(store, "listPlans").mockRejectedValue(new Error("store unreachable"));

    const { default: PatientsPage } = await import("@/app/caring-contacts/patients/page");

    await expect(PatientsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("store unreachable");
    expect(recorded()).toContainEqual(expect.objectContaining({ objectType: "plan", outcome: "failed" }));
  });

  // I-4. `listPlans` returns an array for every actor by contract, so this branch is unreachable
  // through the real stores -- which is exactly why it was wrong and why nothing caught it. The
  // page originally defaulted a null release to `[]`, and the ONE path this branch exists for
  // would then have rendered "No patients yet" from an answer that was never given: a false
  // statement about a caseload, from a store that had just broken its own contract. A branch that
  // cannot run is still read, and is still copied by the next screen.
  it("throws rather than inventing an empty caseload when the store breaks its list contract", async () => {
    const { store } = inMemoryStoreWithSpy();
    vi.spyOn(store, "listPlans").mockResolvedValue(null as unknown as PlanRecord[]);

    const { default: PatientsPage } = await import("@/app/caring-contacts/patients/page");

    await expect(PatientsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(/returned no list/i);
  });

  it("throws rather than rendering a caseload beside a service state it could not read", async () => {
    const { store } = inMemoryStoreWithSpy();
    vi.spyOn(store, "getServiceState").mockRejectedValue(new Error("service state unreachable"));

    const { default: PatientsPage } = await import("@/app/caring-contacts/patients/page");

    await expect(PatientsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("service state unreachable");
  });
});

describe("the /caring-contacts/patients page - roles", () => {
  it("tells an auditor its role cannot view plans, rather than that the team has none", async () => {
    inMemoryStoreWithSpy("auditor");

    await renderPage();

    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: /not visible in this role/i })).toBeInTheDocument();
    expect(screen.queryByText("No patients yet")).toBeNull();
  });
});
