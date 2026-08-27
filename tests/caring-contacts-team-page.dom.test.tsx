// tests/caring-contacts-team-page.dom.test.tsx
//
// Phase 2B Task 18. `/caring-contacts/team` (`src/app/caring-contacts/team/page.tsx`) -- where this
// team's caring-contact work is sitting.
//
// WHAT THIS FILE PROVES THAT THE COMPONENT TEST CANNOT
// ---------------------------------------------------
//   * the roster read is recorded on the access trail with the SAME identity
//     `api/caring-contacts/team`'s `GET` records, so "who looked at how work is distributed across
//     the team, and when" stays one askable question rather than two half-answers;
//   * an EMPTY team is a permitted, readable, empty answer -- the empty STATE on the success path,
//     never a missing resource, and recorded as `allowed`, because an empty roster IS what was
//     released;
//   * the capability is decided from the ACTOR rather than inferred from an empty list, because
//     `listPlans` answers a role without `viewReferral` with `[]`, exactly as it answers a team
//     carrying nothing;
//   * the render reads no patient record and puts no patient, plan or contact identifier on the
//     screen -- proved against the REAL demo seed, which demonstrably holds all of them;
//   * every bad outcome fails closed, with nothing rendered.
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

import { createDemoWorkspaceStore } from "@/lib/caring-contacts-server/demo-seed";
import { CARING_CONTACTS_ROLE_COOKIE, demoActorForRole } from "@/lib/caring-contacts-server/session";
import type { AccessRecord } from "@/lib/caring-contacts/access-audit";
import { fixedClock } from "@/lib/caring-contacts/clock";
import { createInMemoryRepository } from "@/lib/caring-contacts/in-memory-repository";
import type { CaringContactRepository, PlanRecord } from "@/lib/caring-contacts/repository";

let mockCookies: Record<string, { value: string } | undefined> = {};

const NOW = "2026-03-02T03:00:00.000Z";

/** Wraps a store so every access event it takes is visible, without changing what it does. */
function withAccessSpy(repository: CaringContactRepository): {
  store: CaringContactRepository;
  recorded: () => AccessRecord[];
} {
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

function emptyStoreWithSpy(role = "coordinator") {
  mockCookies = { [CARING_CONTACTS_ROLE_COOKIE]: { value: role } };
  return withAccessSpy(createInMemoryRepository(fixedClock(NOW)));
}

async function renderPage() {
  const { default: TeamPage } = await import("@/app/caring-contacts/team/page");
  const element = await TeamPage();
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

describe("the /caring-contacts/team page - an empty roster is not a missing resource", () => {
  it("renders the empty STATE on the success path when nobody is carrying work, and never calls notFound()", async () => {
    emptyStoreWithSpy();

    const element = await renderPage();

    expect(element).toBeTruthy();
    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: /nobody is carrying work/i })).toBeInTheDocument();
  });

  it("records the empty roster read as ALLOWED, the outcome an empty answer actually earns", async () => {
    const { recorded } = emptyStoreWithSpy();

    await renderPage();

    expect(recorded()).toContainEqual(
      expect.objectContaining({
        kind: "search",
        objectType: "teamWorkload",
        objectId: "all",
        outcome: "allowed",
        actorId: demoActorForRole("coordinator").id,
      }),
    );
  });
});

describe("the /caring-contacts/team page - reads", () => {
  it("uses the same access identity the team API route already records", async () => {
    const { recorded } = emptyStoreWithSpy();

    await renderPage();

    // `{ search, teamWorkload, "all" }` -- byte for byte the identity `api/caring-contacts/team`'s
    // GET records. A second member here would split the trail's answer to one question across two
    // values it cannot be asked for together, because the trail filters on `objectType` and has no
    // `objectId` filter at all.
    expect(recorded()).toContainEqual(
      expect.objectContaining({ kind: "search", objectType: "teamWorkload", objectId: "all", outcome: "allowed" }),
    );
    // And the service state, so the safety banner on this screen is a state that was READ.
    expect(recorded()).toContainEqual(
      expect.objectContaining({ kind: "administrative", objectType: "serviceState", outcome: "allowed" }),
    );
  });

  it("never reads a patient record - a roster needs no patient and must not be a route to one", async () => {
    const { store } = emptyStoreWithSpy();
    const getEpisode = vi.spyOn(store, "getEpisode");
    const listPatientNames = vi.spyOn(store, "listPatientNames");
    // THE POSITIVE CONTROL, and on this assertion above all others. Everything below is an absence,
    // and an absence is satisfied just as well by a page that never reached this store -- a changed
    // mock path, a store swapped out from under the spies, a render that threw early. This proves
    // the spied store is the one the page used.
    const listPlans = vi.spyOn(store, "listPlans");

    await renderPage();

    expect(listPlans, "the page did not read the spied store — the absences below prove nothing").toHaveBeenCalled();
    expect(getEpisode).not.toHaveBeenCalled();
    expect(listPatientNames).not.toHaveBeenCalled();
  });

  it("decides the capability from the actor, so a role that may not read plans is not told the team is idle", async () => {
    // The auditor holds no `viewReferral`, so `listPlans` answers `[]` -- indistinguishable from a
    // team carrying nothing, on purpose. The page asks the same question the store asks and states
    // which fact it is.
    emptyStoreWithSpy("auditor");

    await renderPage();

    expect(screen.getByRole("group", { name: /not visible in this role/i })).toBeInTheDocument();
    expect(screen.queryByText(/nobody is carrying work/i)).toBeNull();
  });

  // `reassignPlan` is a team lead's action and not a coordinator's, so the two roles must see
  // different screens. The two cases are each other's control: either alone would pass over a
  // control that is always present or always absent.
  it("offers the Reassign work control to a role the domain lets move a plan", async () => {
    emptyStoreWithSpy("teamLead");

    await renderPage();

    expect(screen.getByTestId("caring-contacts-team-reassign")).toBeInTheDocument();
  });

  it("offers no Reassign work control to a role the domain does not let move a plan", async () => {
    emptyStoreWithSpy("coordinator");

    await renderPage();

    expect(screen.queryByTestId("caring-contacts-team-reassign")).toBeNull();
    expect(screen.getByTestId("caring-contacts-team").textContent ?? "").toContain("not available in this role");
  });
});

describe("the /caring-contacts/team page - fails closed", () => {
  async function importPage() {
    return (await import("@/app/caring-contacts/team/page")).default;
  }

  it("throws rather than rendering when the access trail cannot take the event", async () => {
    const { store } = emptyStoreWithSpy();
    vi.spyOn(store, "recordAccess").mockRejectedValue(new Error("access trail unavailable"));

    const TeamPage = await importPage();

    await expect(TeamPage()).rejects.toThrow(/access trail is unavailable/i);
  });

  it("throws rather than rendering when the plans read itself fails, and still records the attempt", async () => {
    const { store, recorded } = emptyStoreWithSpy();
    vi.spyOn(store, "listPlans").mockRejectedValue(new Error("store unreachable"));

    const TeamPage = await importPage();

    await expect(TeamPage()).rejects.toThrow("store unreachable");
    expect(recorded()).toContainEqual(expect.objectContaining({ objectType: "teamWorkload", outcome: "failed" }));
  });

  it("throws rather than inventing an idle team when the store breaks its list contract", async () => {
    // Unreachable through the real stores -- `listPlans` returns an array for every actor -- which
    // is exactly why a `?? []` here would never have been caught. It would render "Nobody is
    // carrying work" from an answer that was never given, on the screen whose whole subject is
    // whether anyone is answering for a discharged patient's plan.
    const { store } = emptyStoreWithSpy();
    vi.spyOn(store, "listPlans").mockResolvedValue(null as unknown as PlanRecord[]);

    const TeamPage = await importPage();

    await expect(TeamPage()).rejects.toThrow(/returned no roster/i);
  });
});

describe("the /caring-contacts/team page - against the real demo population", () => {
  it("counts the seeded plans as unclaimed and puts no patient, plan or contact id on the screen", async () => {
    mockCookies = { [CARING_CONTACTS_ROLE_COOKIE]: { value: "teamLead" } };
    const { store } = withAccessSpy(await createDemoWorkspaceStore(fixedClock(NOW)));

    // THE POSITIVE CONTROL FOR EVERY ABSENCE BELOW: the store this page reads demonstrably holds
    // plan ids, patient ids and contact ids, so "none of them reached the screen" is a statement
    // about the page's narrowing rather than about a fixture that had nothing to leak.
    const actor = demoActorForRole("teamLead");
    const plans = await store.listPlans({ actor });
    expect(plans.length, "the demo seed produced no plan — the absences below prove nothing").toBeGreaterThan(0);
    expect(
      plans.some((record) => record.contacts.length > 0),
      "the seeded plans hold no contact",
    ).toBe(true);

    await renderPage();

    const roster = screen.getByTestId("caring-contacts-team");
    const text = roster.textContent ?? "";
    // And the second half of the control: those plans reached the ROLL-UP, not merely the store.
    // Nothing in the seed claims a plan and the render measures against the wall clock, so every
    // plan the seed left open is unclaimed and long past the threshold; an empty store would render
    // "Every plan that is running has a coordinator" here instead.
    //
    // NOT a count. The first version of this control asserted the block contained
    // `String(plans.length)`, and it was wrong twice over: the seed leaves one plan ENDED, which
    // `buildTeamWorkload` drops before any measure, so the number never matched; and it passed
    // anyway on the first run, because the wall-clock age in the same block happened to contain the
    // digit it was looking for. A substring check for a bare digit is not a check for a count.
    expect(screen.getByRole("group", { name: /unclaimed work escalated/i })).toBeInTheDocument();

    for (const record of plans) {
      expect(text, "a plan id reached the roster").not.toContain(record.plan.id);
      expect(text, "a patient id reached the roster").not.toContain(record.patientId);
      for (const stored of record.contacts) {
        expect(text, "a contact id reached the roster").not.toContain(stored.contact.id);
      }
    }
  });
});
