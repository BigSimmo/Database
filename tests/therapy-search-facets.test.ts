import { describe, expect, it } from "vitest";

import therapiesFixture from "@/data/therapies-index.json";
import {
  EMPTY_SEARCH,
  matchesAvailability,
  matchesTopics,
  searchTherapies,
} from "@/components/therapy-compass/data/select";
import type { Therapy } from "@/components/therapy-compass/data/types";

const therapies = therapiesFixture as unknown as Therapy[];

describe("therapy-compass Topics facet — OR within group (docs/filter-contract.md section 1)", () => {
  it("has a non-empty catalogue to test against (premise)", () => {
    expect(therapies.length).toBeGreaterThan(0);
  });

  it("widens rather than narrows when a second topic is selected", () => {
    const cbtOnly = searchTherapies(therapies, { ...EMPTY_SEARCH, tags: ["CBT"] }).length;
    const cbtOrAnxiety = searchTherapies(therapies, { ...EMPTY_SEARCH, tags: ["CBT", "Anxiety"] }).length;
    expect(cbtOrAnxiety).toBeGreaterThanOrEqual(cbtOnly);
  });

  it("matches the exact union of both tags, not some other combination", () => {
    const cbt = new Set(therapies.filter((t) => t.tags.includes("CBT")).map((t) => t.slug));
    const anxiety = new Set(therapies.filter((t) => t.tags.includes("Anxiety")).map((t) => t.slug));
    const union = new Set([...cbt, ...anxiety]);
    // Sanity: the two tags are not identical sets, or a union test could pass
    // by coincidence even with buggy AND logic.
    expect(cbt).not.toEqual(anxiety);

    const result = searchTherapies(therapies, { ...EMPTY_SEARCH, tags: ["CBT", "Anxiety"] });
    expect(new Set(result.map((t) => t.slug))).toEqual(union);
  });

  it("an empty selection is no constraint", () => {
    expect(therapies.every((t) => matchesTopics(t, new Set()))).toBe(true);
  });

  it("is case-insensitive, matching the original tag comparison", () => {
    const upper = searchTherapies(therapies, { ...EMPTY_SEARCH, tags: ["cbt"] }).length;
    const asStored = searchTherapies(therapies, { ...EMPTY_SEARCH, tags: ["CBT"] }).length;
    expect(upper).toBe(asStored);
    expect(upper).toBeGreaterThan(0);
  });
});

describe("therapy-compass availability facets — independent AND constraints, never OR", () => {
  // `matchesAvailability` is tested against synthetic fixtures rather than the
  // real catalogue: every therapy in the current corpus has `reviewStatus`
  // "needs_review" (none has cleared clinical review yet), so a real-data test
  // of "reviewed AND brief-available" would vacuously pass with zero matches
  // either way and prove nothing about the predicate itself.
  const reviewedNoBrief = { reviewStatus: "reviewed", briefInterventionAvailable: false } as Therapy;
  const reviewedWithBrief = { reviewStatus: "reviewed", briefInterventionAvailable: true } as Therapy;
  const unreviewedWithBrief = { reviewStatus: "needs_review", briefInterventionAvailable: true } as Therapy;

  it("requires both flags independently — reviewed alone does not satisfy briefOnly", () => {
    expect(matchesAvailability(reviewedNoBrief, true, false)).toBe(true);
    expect(matchesAvailability(reviewedNoBrief, true, true)).toBe(false);
  });

  it("requires both flags independently — brief alone does not satisfy reviewedOnly", () => {
    expect(matchesAvailability(unreviewedWithBrief, false, true)).toBe(true);
    expect(matchesAvailability(unreviewedWithBrief, true, true)).toBe(false);
  });

  it("passes when both flags are set and both conditions hold", () => {
    expect(matchesAvailability(reviewedWithBrief, true, true)).toBe(true);
  });

  it("imposes no constraint when neither flag is set", () => {
    expect(matchesAvailability(reviewedNoBrief, false, false)).toBe(true);
  });

  it("narrows (or holds even) when a second availability flag is added on real data, never widens", () => {
    const briefOnly = searchTherapies(therapies, { ...EMPTY_SEARCH, briefOnly: true }).length;
    const both = searchTherapies(therapies, { ...EMPTY_SEARCH, briefOnly: true, reviewedOnly: true }).length;
    expect(both).toBeLessThanOrEqual(briefOnly);
  });

  it("does not combine with Topics by OR either — both must hold", () => {
    const cbtCount = searchTherapies(therapies, { ...EMPTY_SEARCH, tags: ["CBT"] }).length;
    const cbtAndBrief = searchTherapies(therapies, { ...EMPTY_SEARCH, tags: ["CBT"], briefOnly: true }).length;
    expect(cbtAndBrief).toBeLessThanOrEqual(cbtCount);
  });
});

describe("the six curated Topics chips (docs/filter-contract.md 'derive vs curate')", () => {
  // These are a deliberate editorial subset of a larger tag vocabulary, not a
  // declared list standing in for the data — so none may be permanently zero
  // across the whole catalogue, which is what the "derive, don't declare" rule
  // actually guards against (a control that can never return anything).
  const QUICK_TAGS = ["CBT", "Anxiety", "Mood", "Trauma", "DBT", "Crisis/risk"];

  it.each(QUICK_TAGS)("%s matches at least one therapy in the whole catalogue", (tag) => {
    expect(therapies.some((t) => matchesTopics(t, new Set([tag])))).toBe(true);
  });
});
