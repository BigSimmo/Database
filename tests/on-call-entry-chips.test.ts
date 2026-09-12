/**
 * Detail chips, split out of the deleted `on-call-search.test.ts`.
 *
 * On Call declares no search surface any more — the composer, the ranking and
 * the results page all went with it — but the chips did not: they are how a
 * Recent row and a section tile name one fact about an entry. The ranking and
 * band-status cases were deleted with the code they covered, and that reduction
 * is recorded rather than silent.
 */
import { describe, expect, it } from "vitest";

import type { OnCallEntry } from "@/lib/on-call/entry-model";
import { onCallEntryDetailChips } from "@/lib/on-call/entry-chips";

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

// Deliberately content-free. This mode carries no app-authored clinical
// content, and a fixture is where such content usually enters a repository —
// it gets copied into a seed, then a demo, then a screenshot. The test needs a
// playbook entry whose text contains the query term; it does not need a
// threshold or an escalation rule, so it states neither.
const PLAYBOOK_ENTRY = entry({
  id: "33333333-3333-3333-3333-333333333333",
  slug: "clozapine-cover",
  section: "playbook",
  title: "Clozapine cover — who to call",
  details: {
    trigger: "Owner-written trigger text mentioning clozapine",
    escalationSteps: [{ order: 1, whoToCall: "On-call registrar", when: "As the owner recorded it" }],
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
