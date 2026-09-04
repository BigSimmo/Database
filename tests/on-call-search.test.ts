import { describe, expect, it } from "vitest";

import type { OnCallEntry } from "@/lib/on-call/entry-model";
import { onCallEntryDetailChips, onCallSearchStatus, rankOnCallEntries } from "@/lib/on-call/search";

function entry(
  overrides: Partial<OnCallEntry> & { id: string; slug: string; section: OnCallEntry["section"] },
): OnCallEntry {
  return {
    title: overrides.title ?? "Untitled",
    subtitle: null,
    body: null,
    details: {},
    linkedDocumentIds: [],
    tags: [],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 0,
    lastVerifiedAt: null,
    ...overrides,
  };
}

// One clozapine query, matching across three different sections through three
// different fields — a contacts phone chip, a referrals title, and a
// playbook escalation step — which is the whole point of this task: one
// query filters every section at once.
const HAEMATOLOGY_CONTACT = entry({
  id: "11111111-1111-1111-1111-111111111111",
  slug: "haematology",
  section: "contacts",
  title: "Haematology on-call",
  details: { role: "Haematology registrar", phone: "9224 8888" },
  tags: ["Clozapine monitoring"],
});

const CLOZAPINE_CLINIC = entry({
  id: "22222222-2222-2222-2222-222222222222",
  slug: "clozapine-clinic",
  section: "referrals",
  title: "Clozapine clinic",
  details: { accepts: [], exclusions: [], phone: "9346 1234", hours: "Mon-Fri 9-5" },
});

const NEUTROPENIA_PLAYBOOK = entry({
  id: "33333333-3333-3333-3333-333333333333",
  slug: "neutropenia",
  section: "playbook",
  title: "Fever on clozapine",
  details: {
    trigger: "Temp > 38 in a patient on clozapine",
    escalationSteps: [{ order: 1, whoToCall: "On-call consultant", when: "Immediately" }],
  },
});

const UNRELATED_LOGISTICS = entry({
  id: "44444444-4444-4444-4444-444444444444",
  slug: "car-park",
  section: "logistics",
  title: "After-hours car park access",
  details: { category: "Parking", location: "Level B1" },
});

const PRESENTER_TEACHING = entry({
  id: "55555555-5555-5555-5555-555555555555",
  slug: "journal-club",
  section: "education",
  title: "Weekly journal club",
  details: { presenter: "Dr Amara Okafor", nextOccurrence: "Thursday 1pm" },
});

describe("rankOnCallEntries", () => {
  it("matches one query across every section at once", () => {
    const results = rankOnCallEntries(
      [HAEMATOLOGY_CONTACT, CLOZAPINE_CLINIC, NEUTROPENIA_PLAYBOOK, UNRELATED_LOGISTICS],
      "clozapine",
    );
    const matchedIds = results.map((match) => match.entry.id);

    expect(matchedIds).toContain(HAEMATOLOGY_CONTACT.id);
    expect(matchedIds).toContain(CLOZAPINE_CLINIC.id);
    expect(matchedIds).toContain(NEUTROPENIA_PLAYBOOK.id);
    expect(matchedIds).not.toContain(UNRELATED_LOGISTICS.id);

    // Each match names its own section rather than a shared one — the whole
    // reason a reader can tell a clinic phone number apart from a
    // haematology contact in the same result list.
    const sections = new Set(results.map((match) => match.entry.section));
    expect(sections).toEqual(new Set(["contacts", "referrals", "playbook"]));
  });

  it("matches a section-specific detail field: a phone number", () => {
    // "9224 8888" appears nowhere in the title, subtitle, or tags — only in
    // the contacts `details.phone` field.
    const results = rankOnCallEntries([HAEMATOLOGY_CONTACT, CLOZAPINE_CLINIC, UNRELATED_LOGISTICS], "9224 8888");
    expect(results.map((match) => match.entry.id)).toEqual([HAEMATOLOGY_CONTACT.id]);
  });

  it("matches a section-specific detail field: a presenter", () => {
    const results = rankOnCallEntries([PRESENTER_TEACHING, UNRELATED_LOGISTICS], "Okafor");
    expect(results.map((match) => match.entry.id)).toEqual([PRESENTER_TEACHING.id]);
  });

  it("matches a section-specific detail field: a category", () => {
    const results = rankOnCallEntries([UNRELATED_LOGISTICS, PRESENTER_TEACHING], "parking");
    expect(results.map((match) => match.entry.id)).toEqual([UNRELATED_LOGISTICS.id]);
  });

  it("matches a role field for contacts", () => {
    const results = rankOnCallEntries([HAEMATOLOGY_CONTACT, UNRELATED_LOGISTICS], "registrar");
    expect(results.map((match) => match.entry.id)).toEqual([HAEMATOLOGY_CONTACT.id]);
  });

  it("returns every entry, unranked, for an empty query — the browse-all state", () => {
    const entries = [HAEMATOLOGY_CONTACT, CLOZAPINE_CLINIC, UNRELATED_LOGISTICS];
    const results = rankOnCallEntries(entries, "   ");
    expect(results.map((match) => match.entry.id)).toEqual(entries.map((candidate) => candidate.id));
    expect(results.every((match) => match.score === 0)).toBe(true);
  });

  it("returns nothing for a query that matches no entry", () => {
    expect(rankOnCallEntries([HAEMATOLOGY_CONTACT, CLOZAPINE_CLINIC], "vestibular migraine")).toEqual([]);
  });
});

describe("onCallEntryDetailChips", () => {
  it("surfaces the clinic phone number for a legible result row", () => {
    const chips = onCallEntryDetailChips(CLOZAPINE_CLINIC);
    expect(chips).toContainEqual({ label: "Phone", value: "9346 1234" });
  });

  it("surfaces the contact's direct number", () => {
    expect(onCallEntryDetailChips(HAEMATOLOGY_CONTACT)).toContainEqual({ label: "Direct", value: "9224 8888" });
  });

  it("surfaces a presenter for a teaching entry", () => {
    expect(onCallEntryDetailChips(PRESENTER_TEACHING)).toContainEqual({ label: "Presenter", value: "Dr Amara Okafor" });
  });

  it("returns no chips for an orientation entry, which carries no comparable detail field", () => {
    const orientation = entry({
      id: "66666666-6666-6666-6666-666666666666",
      slug: "manual",
      section: "orientation",
      title: "Unit orientation manual",
      details: { pinnedSummaryIsOwnerNote: true },
    });
    expect(onCallEntryDetailChips(orientation)).toEqual([]);
  });
});

describe("onCallSearchStatus", () => {
  it("is loading while the initial fetch has not settled", () => {
    expect(onCallSearchStatus({ loading: true, isOffline: false, signedOut: false, entryCount: 0 })).toBe("loading");
  });

  it("is unauthorized when signed out", () => {
    expect(onCallSearchStatus({ loading: false, isOffline: false, signedOut: true, entryCount: 0 })).toBe(
      "unauthorized",
    );
  });

  // The single most important behaviour on the page: offline with nothing
  // cached to search over is a faulted search, not a truthful "0 matches".
  it("is an error when offline with nothing cached to search over", () => {
    expect(onCallSearchStatus({ loading: false, isOffline: true, signedOut: false, entryCount: 0 })).toBe("error");
  });

  it("stays ready when offline but a cached, searchable set of entries exists", () => {
    expect(onCallSearchStatus({ loading: false, isOffline: true, signedOut: false, entryCount: 3 })).toBe("ready");
  });

  it("is ready once loaded, online, and signed in", () => {
    expect(onCallSearchStatus({ loading: false, isOffline: false, signedOut: false, entryCount: 5 })).toBe("ready");
  });
});
