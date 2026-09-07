import { describe, expect, it } from "vitest";

import { crossModeDifferentialCatalog } from "@/lib/cross-mode-differentials";
import {
  buildCrossModeLinks,
  buildCrossModeLinksForThread,
  buildCrossModeLinksFromUniversalSearch,
  crossModeUniversalDomains,
  crossModeUniversalExcludedDomains,
  type CrossModeLink,
} from "@/lib/cross-mode-links";
import { universalSearchDomains, type UniversalSearchDomain } from "@/lib/universal-search-domains";
import type { UniversalSearchGroup, UniversalSearchItem } from "@/lib/universal-search";
import { extractKeywordTerms, keywordQueryFromNaturalLanguage } from "@/lib/keyword-query";
import { defaultMedicationRecords } from "@/lib/medication-fixtures";
import type { ServiceRecord } from "@/lib/services";

const medications = defaultMedicationRecords();
const differentials = crossModeDifferentialCatalog();

const homeTreatmentTeam: ServiceRecord = {
  slug: "adult-home-treatment-team",
  title: "Adult Home Treatment Team",
  subtitle: "Intensive home-based acute care",
  statusChips: [{ label: "Acute", tone: "info" }],
  tags: ["home treatment"],
};

// Matches "adult" and "treatment" via tags only — must stay below the
// title-reason gate no matter how many tag/content points it accumulates.
const tagOnlyService: ServiceRecord = {
  slug: "crisis-line",
  title: "Crisis Line",
  tags: ["adult", "treatment"],
};

describe("extractKeywordTerms", () => {
  it("normalizes, strips stop words, and dedupes", () => {
    expect(extractKeywordTerms("What is the max dose of clozapine?")).toEqual(["what", "max", "dose", "clozapine"]);
    expect(extractKeywordTerms("dose dose DOSE")).toEqual(["dose"]);
    expect(extractKeywordTerms("the of and to a is")).toEqual([]);
  });

  it("caps terms and keeps the legacy 7-term keyword query behavior", () => {
    const long = Array.from({ length: 15 }, (_, index) => `token${index}`).join(" ");
    expect(extractKeywordTerms(long)).toHaveLength(12);
    expect(keywordQueryFromNaturalLanguage(long).split(" ")).toHaveLength(7);
  });
});

describe("buildCrossModeLinks", () => {
  it("links a full question to the named medication", () => {
    const links = buildCrossModeLinks("what is the max dose of clozapine", { medications });
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      modeId: "prescribing",
      slug: "clozapine",
      detailHref: "/medications/clozapine",
      modeSearchQuery: "Clozapine",
    });
    expect(links[0]!.modeLabel).toBe("Medication");
    expect(links[0]!.matchReason).toContain("name");
  });

  it("returns nothing for question filler that only content-matches records", () => {
    expect(buildCrossModeLinks("what is the maximum dose", { medications, differentials })).toEqual([]);
  });

  it("links services on title matches and rejects tag-only matches", () => {
    const links = buildCrossModeLinks("how do I refer to the adult home treatment team", {
      services: [homeTreatmentTeam, tagOnlyService],
    });
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      modeId: "services",
      slug: "adult-home-treatment-team",
      detailHref: "/services/adult-home-treatment-team",
      subtitle: "Intensive home-based acute care",
    });
    expect(links[0]!.badges).toEqual([{ label: "Acute", tone: "info" }]);
    expect(links[0]!.modeSearchHref).toContain("/services/search?");
    expect(links[0]!.modeSearchHref).toContain("run=1");
  });

  it("links differentials via alias expansion", () => {
    const links = buildCrossModeLinks("how do I manage an acutely psychotic patient", { differentials });
    expect(links).toHaveLength(1);
    expect(links[0]!.modeId).toBe("differentials");
    expect(links[0]!.title.toLowerCase()).toMatch(/psychosis|psychotic/);
    expect(links[0]!.detailHref).toMatch(/^\/differentials\/(diagnoses|presentations)\//);
  });

  it("keeps retitled presentations findable by their imported title", () => {
    const links = buildCrossModeLinks("poor rapport", { differentials });

    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      modeId: "differentials",
      slug: "poor-functioning-neglect-negative-symptoms-poor-judgement-poor-rapport",
      detailHref: "/differentials/presentations/poor-functioning-neglect-negative-symptoms-poor-judgement-poor-rapport",
    });
  });

  it("does not surface differentials for queries that only name a medication", () => {
    const links = buildCrossModeLinks("acamprosate renal dosing", { medications, differentials });
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((link) => link.modeId === "prescribing")).toBe(true);
  });

  it("caps per-mode and total results", () => {
    const sleepClinic = (slug: string, title: string): ServiceRecord => ({ slug, title });
    const services = [
      sleepClinic("sleep-clinic-north", "Sleep Clinic North"),
      sleepClinic("sleep-clinic-south", "Sleep Clinic South"),
      sleepClinic("sleep-clinic-east", "Sleep Clinic East"),
    ];
    const forms = [
      sleepClinic("sleep-referral-form", "Sleep Clinic Referral"),
      sleepClinic("sleep-review-form", "Sleep Clinic Review"),
      sleepClinic("sleep-audit-form", "Sleep Clinic Audit"),
    ];

    const links = buildCrossModeLinks("sleep clinic", { services, forms });
    expect(links).toHaveLength(4);
    expect(links.filter((link) => link.modeId === "services")).toHaveLength(2);
    expect(links.filter((link) => link.modeId === "forms")).toHaveLength(2);

    const capped = buildCrossModeLinks("sleep clinic", { services, forms }, { maxTotal: 3 });
    expect(capped).toHaveLength(3);
  });

  it("dedupes a slug shared between the services and forms registries", () => {
    const shared: ServiceRecord = { slug: "shared-pathway", title: "Shared Pathway" };
    const links = buildCrossModeLinks("shared pathway", { services: [shared], forms: [shared] });
    expect(links).toHaveLength(1);
    expect(links[0]!.modeId).toBe("services");
  });

  it("keeps entity links alive across multiple entity-free follow-up turns", () => {
    const thread = ["what is the max dose of clozapine", "what about renal impairment", "and in elderly patients"];
    const links = buildCrossModeLinksForThread(thread, { medications });
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ modeId: "prescribing", slug: "clozapine" });
  });

  it("prefers the newest turn that names an entity", () => {
    const thread = ["what is the max dose of clozapine", "tell me about acamprosate"];
    const links = buildCrossModeLinksForThread(thread, { medications });
    expect(links).toHaveLength(1);
    expect(links[0]!.slug).toBe("acamprosate");

    expect(buildCrossModeLinksForThread([], { medications })).toEqual([]);
    expect(buildCrossModeLinksForThread(["what about renal impairment", null], { medications })).toEqual([]);
  });

  it("returns nothing for empty or stop-word-only queries and empty catalogs", () => {
    expect(buildCrossModeLinks("", { medications })).toEqual([]);
    expect(buildCrossModeLinks("the of and", { medications })).toEqual([]);
    expect(buildCrossModeLinks("clozapine dose", {})).toEqual([]);
  });
});

function universalItem(overrides: Partial<UniversalSearchItem> & { kind: UniversalSearchDomain }): UniversalSearchItem {
  return {
    id: overrides.id ?? "record",
    title: overrides.title ?? "Record",
    href: overrides.href ?? "/record",
    score: overrides.score ?? 1,
    ...overrides,
  };
}

function universalGroup(
  kind: UniversalSearchDomain,
  items: Array<Partial<UniversalSearchItem>>,
  overrides: Partial<UniversalSearchGroup> = {},
): UniversalSearchGroup {
  const built = items.map((item) => universalItem({ ...item, kind }));
  return { kind, total: built.length, items: built, latencyMs: 1, ...overrides };
}

describe("crossModeUniversalExcludedDomains", () => {
  it("is exactly the complement of the domains the line consumes", () => {
    // The two lists are derived from one array on purpose. If they ever drift, a
    // domain is read by both the catalogue half and the universal half, and the
    // same record is printed twice on one line.
    expect([...crossModeUniversalExcludedDomains].sort()).toEqual(
      universalSearchDomains
        .filter((domain) => !(crossModeUniversalDomains as readonly UniversalSearchDomain[]).includes(domain))
        .sort(),
    );
    for (const domain of ["documents", "medications", "services", "forms", "differentials", "presentations"] as const) {
      expect(crossModeUniversalExcludedDomains, `${domain} is already resolved elsewhere`).toContain(domain);
    }
  });
});

describe("buildCrossModeLinksFromUniversalSearch", () => {
  it("reaches a mode no local catalogue can resolve", () => {
    const links = buildCrossModeLinksFromUniversalSearch("criteria for bipolar disorder", [
      universalGroup("dsm", [
        { id: "bipolar-i-disorder", title: "Bipolar I Disorder", href: "/dsm/bipolar-i-disorder", subtitle: "296.4x" },
      ]),
    ]);

    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      modeId: "dsm",
      modeLabel: "DSM-5 Diagnosis",
      slug: "bipolar-i-disorder",
      detailHref: "/dsm/bipolar-i-disorder",
      subtitle: "296.4x",
      modeSearchQuery: "Bipolar I Disorder",
      matchReason: "title",
    });
  });

  it("rejects an item the query does not name at a word boundary", () => {
    // "renal" hides inside "adrenaline"; a content-ranked hit is not a named one.
    expect(
      buildCrossModeLinksFromUniversalSearch("renal impairment", [
        universalGroup("dictionary", [{ id: "adrenaline", title: "Adrenaline", href: "/dictionary/adrenaline" }]),
      ]),
    ).toEqual([]);
  });

  it("drops query filler shorter than the minimum term length", () => {
    expect(
      buildCrossModeLinksFromUniversalSearch("who is at risk", [
        universalGroup("tools", [{ id: "who-5", title: "WHO Wellbeing Index", href: "/tools/who-5" }]),
      ]),
    ).toEqual([]);
  });

  it("contributes nothing from an errored or empty group", () => {
    // A failed adapter must leave the line exactly as the catalogue half left it.
    expect(
      buildCrossModeLinksFromUniversalSearch("bipolar disorder", [
        universalGroup("dsm", [{ id: "bipolar-i", title: "Bipolar I Disorder", href: "/dsm/bipolar-i" }], {
          error: true,
        }),
        universalGroup("dictionary", []),
      ]),
    ).toEqual([]);
  });

  it("ignores domains the catalogue half already resolves", () => {
    expect(
      buildCrossModeLinksFromUniversalSearch("clozapine dosing", [
        universalGroup("medications", [{ id: "clozapine", title: "Clozapine", href: "/medications/clozapine" }]),
        universalGroup("documents", [{ id: "doc-1", title: "Clozapine Protocol", href: "/documents/doc-1" }]),
      ]),
    ).toEqual([]);
  });

  it("never repeats a record the catalogue half already listed", () => {
    const existing: CrossModeLink[] = [
      {
        modeId: "differentials",
        modeLabel: "Differentials",
        slug: "psychosis",
        title: "Psychosis",
        subtitle: "",
        badges: [],
        detailHref: "/dsm/psychosis",
        modeSearchHref: "/differentials",
        modeSearchQuery: "Psychosis",
        score: 8,
        matchReason: "title",
      },
    ];

    expect(
      buildCrossModeLinksFromUniversalSearch(
        "psychosis assessment",
        [universalGroup("dsm", [{ id: "psychosis", title: "Psychosis", href: "/dsm/psychosis" }])],
        { existing },
      ),
    ).toEqual([]);
  });

  it("caps the added links at one per mode and two in total", () => {
    const links = buildCrossModeLinksFromUniversalSearch("bipolar disorder assessment", [
      universalGroup("dsm", [
        { id: "bipolar-i", title: "Bipolar I Disorder", href: "/dsm/bipolar-i" },
        { id: "bipolar-ii", title: "Bipolar II Disorder", href: "/dsm/bipolar-ii" },
      ]),
      universalGroup("dictionary", [{ id: "bipolar", title: "Bipolar", href: "/dictionary/bipolar" }]),
      universalGroup("tools", [{ id: "bipolar-scale", title: "Bipolar Assessment Scale", href: "/tools/bipolar" }]),
    ]);

    expect(links).toHaveLength(2);
    expect(new Set(links.map((link) => link.modeId)).size).toBe(2);
    // Two matched terms beats one, whatever the domain's own (incomparable) score:
    // the single-term Dictionary hit loses its place to the two-term Tools hit.
    // DSM and Tools both match two terms, and that tie falls to mode priority.
    expect(links.map((link) => [link.modeId, link.title])).toEqual([
      ["dsm", "Bipolar I Disorder"],
      ["tools", "Bipolar Assessment Scale"],
    ]);
  });

  it("adds nothing once the caller has no room left on the line", () => {
    // The section passes `crossModeLineMaxLinks - links.length`, so a thread whose
    // catalogue half already filled the line asks for zero. It must not round up
    // to the builder's own default of two.
    expect(
      buildCrossModeLinksFromUniversalSearch(
        "bipolar disorder",
        [universalGroup("dsm", [{ id: "bipolar-i", title: "Bipolar I Disorder", href: "/dsm/bipolar-i" }])],
        { maxTotal: 0 },
      ),
    ).toEqual([]);
  });

  it("keeps a distinct key when a domain omits the record id", () => {
    const links = buildCrossModeLinksFromUniversalSearch("bipolar disorder", [
      universalGroup("dsm", [{ id: "", title: "Bipolar I Disorder", href: "/dsm/bipolar-i" }]),
    ]);

    expect(links[0]!.slug).toBe("/dsm/bipolar-i");
  });
});
