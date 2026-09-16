import { describe, expect, it } from "vitest";

import { type OnCallEntry, type OnCallSection } from "@/lib/on-call/entry-model";
import { ON_CALL_SEARCH_RESULT_LIMIT, onCallSearchSummary, searchOnCallEntries } from "@/lib/on-call/entry-search";

function entry(section: OnCallSection, slug: string, title: string, overrides: Partial<OnCallEntry> = {}): OnCallEntry {
  return {
    id: slug,
    slug,
    section,
    title,
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
  } as unknown as OnCallEntry;
}

const ED = entry("contacts", "ed-registrar", "ED registrar", {
  details: { role: "Emergency registrar", phone: "(08) 9224 1000" },
  tags: ["Emergency"],
});

const WARD = entry("contacts", "ward-4b", "Ward 4B nurses' station", {
  details: { role: "Ward nurse", phone: "5210" },
  tags: ["Wards"],
});

const SEDATION = entry("playbook", "acute-sedation", "Acute sedation", {
  details: {
    trigger: "Agitated patient on the ward",
    escalationSteps: [{ order: 1, whoToCall: "Duty consultant", when: "No response in ten minutes", phone: "5199" }],
  },
});

const HEADSPACE = entry("referrals", "headspace", "Headspace Perth", {
  details: {
    accepts: ["Twelve to twenty-five"],
    exclusions: ["Acute risk"],
    catchment: "North metropolitan",
    hours: "Weekdays",
    howToRefer: "Central intake form",
    phone: "9111 2222",
    fax: "9111 2223",
  },
});

const JOURNAL_CLUB = entry("education", "journal-club", "Journal club", {
  details: { recurrence: "Fortnightly", presenter: "Dr Halsey", location: "Seminar room", topics: ["Clozapine"] },
});

const PARKING = entry("logistics", "parking", "After-hours parking", {
  details: { category: "Access", location: "Bay 12", hours: "Overnight", phone: "9224 3000" },
});

describe("searchOnCallEntries — the query itself", () => {
  it("returns nothing for an empty or whitespace-only query", () => {
    expect(searchOnCallEntries([ED, WARD], "")).toEqual([]);
    expect(searchOnCallEntries([ED, WARD], "   ")).toEqual([]);
  });

  it("matches case-insensitively on the title", () => {
    expect(searchOnCallEntries([ED, WARD], "ED REGISTRAR").map((result) => result.entry.slug)).toEqual([
      "ed-registrar",
    ]);
  });

  it("trims the query before matching", () => {
    expect(searchOnCallEntries([ED, WARD], "  ward  ").map((result) => result.entry.slug)).toEqual(["ward-4b"]);
  });

  it("requires every word, in any field and any order", () => {
    expect(searchOnCallEntries([ED, WARD], "4b ward").map((result) => result.entry.slug)).toEqual(["ward-4b"]);
    // "emergency" is a tag and "registrar" is in the title: both must count.
    expect(searchOnCallEntries([ED, WARD], "emergency registrar").map((result) => result.entry.slug)).toEqual([
      "ed-registrar",
    ]);
    expect(searchOnCallEntries([ED, WARD], "ward emergency")).toEqual([]);
  });

  it("carries the section alongside the entry so the caller can group", () => {
    const [result] = searchOnCallEntries([SEDATION], "sedation");
    expect(result.section).toBe("playbook");
    expect(result.entry.slug).toBe("acute-sedation");
  });
});

describe("searchOnCallEntries — what it reads", () => {
  it("reads the body and the subtitle", () => {
    const orientation = entry("orientation", "handover", "Handover", {
      subtitle: "Before you leave",
      body: "Return the keycard to the ward clerk.",
      details: { pinnedSummaryIsOwnerNote: true },
    });
    expect(searchOnCallEntries([orientation], "keycard")).toHaveLength(1);
    expect(searchOnCallEntries([orientation], "before you leave")).toHaveLength(1);
  });

  it("reads each section's own details through that section's schema", () => {
    const cases: Array<[OnCallEntry, string]> = [
      [ED, "emergency registrar"],
      [SEDATION, "duty consultant"],
      [SEDATION, "agitated patient"],
      [HEADSPACE, "north metropolitan"],
      [HEADSPACE, "acute risk"],
      [JOURNAL_CLUB, "dr halsey"],
      [JOURNAL_CLUB, "clozapine"],
      [PARKING, "bay 12"],
      [PARKING, "access"],
    ];
    for (const [candidate, query] of cases) {
      expect(searchOnCallEntries([candidate], query), `${candidate.slug} / ${query}`).toHaveLength(1);
    }
  });

  it("keeps an entry with unreadable details searchable on its title", () => {
    const broken = entry("contacts", "broken", "Bed management", { details: { nonsense: 7 }, body: "Ring first." });
    expect(searchOnCallEntries([broken], "bed management")).toHaveLength(1);
    expect(searchOnCallEntries([broken], "ring first")).toHaveLength(1);
  });

  it("does not drop an owner's personal entry — filtering is the API's job, not the search's", () => {
    const personal = entry("contacts", "okafor", "Dr M. Okafor — direct", {
      details: { role: "Consultant", phone: "0412 000 111" },
      isPersonal: true,
    });
    expect(searchOnCallEntries([personal], "okafor")).toHaveLength(1);
  });
});

describe("searchOnCallEntries — phone numbers", () => {
  it("finds a punctuated stored number from digits typed without punctuation", () => {
    expect(searchOnCallEntries([ED], "0892241000").map((result) => result.entry.slug)).toEqual(["ed-registrar"]);
  });

  it("finds a stored number when the typed number carries its own punctuation", () => {
    const stored = entry("contacts", "switch", "Switchboard", { details: { role: "Switch", phone: "0892241000" } });
    expect(searchOnCallEntries([stored], "(08) 9224 1000").map((result) => result.entry.slug)).toEqual(["switch"]);
  });

  it("matches a partial run of digits across the punctuation", () => {
    expect(searchOnCallEntries([ED], "92241000")).toHaveLength(1);
  });
});

describe("searchOnCallEntries — ranking", () => {
  const titleHit = entry("contacts", "a-title", "Triage desk", { sortOrder: 9 });
  const tagHit = entry("contacts", "b-tag", "Bed management", { tags: ["triage"], sortOrder: 5 });
  const bodyHit = entry("contacts", "c-body", "Consult liaison", { body: "Ring before triage closes.", sortOrder: 1 });

  it("puts a title match above a tag match above a body match", () => {
    expect(searchOnCallEntries([bodyHit, tagHit, titleHit], "triage").map((result) => result.entry.slug)).toEqual([
      "a-title",
      "b-tag",
      "c-body",
    ]);
  });

  it("orders equally ranked entries by sortOrder, then title", () => {
    const later = entry("contacts", "later", "Triage B", { sortOrder: 2 });
    const earlier = entry("contacts", "earlier", "Triage A", { sortOrder: 1 });
    const sameOrder = entry("contacts", "same", "Triage AA", { sortOrder: 1 });
    expect(searchOnCallEntries([later, sameOrder, earlier], "triage").map((result) => result.entry.slug)).toEqual([
      "earlier",
      "same",
      "later",
    ]);
  });

  it("ranks a multi-word query by its weakest field, so a part-body match cannot outrank a whole-title match", () => {
    const whole = entry("contacts", "whole", "Triage desk", { sortOrder: 9 });
    const split = entry("contacts", "split", "Triage nurse", { body: "Ask at the desk.", sortOrder: 1 });
    expect(searchOnCallEntries([split, whole], "triage desk").map((result) => result.entry.slug)).toEqual([
      "whole",
      "split",
    ]);
  });
});

describe("searchOnCallEntries — the cap", () => {
  it("never returns more than the exported cap", () => {
    const many = Array.from({ length: ON_CALL_SEARCH_RESULT_LIMIT + 15 }, (_, index) =>
      entry("contacts", `row-${index}`, `Ward ${index}`, { sortOrder: index }),
    );
    expect(searchOnCallEntries(many, "ward")).toHaveLength(ON_CALL_SEARCH_RESULT_LIMIT);
  });

  it("keeps the best-ranked matches when it caps", () => {
    const filler = Array.from({ length: ON_CALL_SEARCH_RESULT_LIMIT + 5 }, (_, index) =>
      entry("contacts", `filler-${index}`, `Filler ${index}`, { body: "ward round", sortOrder: index }),
    );
    const real = entry("contacts", "real", "Ward 4B", { sortOrder: 99 });
    expect(searchOnCallEntries([...filler, real], "ward")[0].entry.slug).toBe("real");
  });
});

describe("onCallSearchSummary", () => {
  it("names the role, the category and the trigger", () => {
    expect(onCallSearchSummary(ED)).toBe("Emergency registrar");
    expect(onCallSearchSummary(PARKING)).toBe("Access");
    expect(onCallSearchSummary(SEDATION)).toBe("Agitated patient on the ward");
  });

  it("falls back to the subtitle, then to nothing", () => {
    const withSubtitle = entry("orientation", "shelf", "Induction pack", { subtitle: "Read me first" });
    expect(onCallSearchSummary(withSubtitle)).toBe("Read me first");
    expect(onCallSearchSummary(entry("orientation", "bare", "Induction pack"))).toBeNull();
  });
});
