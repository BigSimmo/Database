import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { EMPTY_SEARCH, reviewStatusMeta, searchTherapies } from "@/components/therapy-compass/data/select";
import { THERAPY_CATALOGUE_ASSETS } from "@/components/therapy-compass/data/generated-assets";
import type { Therapy } from "@/components/therapy-compass/data/types";
import { rankTherapyCandidates, scoreTherapyCandidate } from "@/lib/therapy-ranking";
import {
  findTherapyRecord,
  searchTherapyRecords,
  therapyNeedsReview,
  therapyRecords,
  therapyRecordsForEnvironment,
  therapySlugs,
} from "@/lib/therapies";

const records = [
  {
    name: "Cognitive behavioural therapy",
    aliases: ["CBT"],
    tags: ["Anxiety", "Depression"],
    category: "Behavioural",
    bestUsedFor: "Anxiety disorders",
  },
  {
    name: "Acceptance and commitment therapy",
    aliases: ["ACT"],
    tags: ["Anxiety"],
    category: "Contextual",
    bestUsedFor: "Psychological flexibility",
  },
];

const fullTherapyRecords = JSON.parse(
  readFileSync(new URL(`../public/therapy-compass-data/${THERAPY_CATALOGUE_ASSETS.full}`, import.meta.url), "utf8"),
) as Therapy[];

describe("shared Therapy ranker", () => {
  it("uses one normalized scoring contract for catalogue and universal callers", () => {
    expect(scoreTherapyCandidate(records[0], "cognitive behavioural therapy")).toBeGreaterThan(
      scoreTherapyCandidate(records[1], "cognitive behavioural therapy"),
    );
    expect(scoreTherapyCandidate(records[0], "CBT")).toBeGreaterThan(scoreTherapyCandidate(records[1], "CBT"));
  });

  it("preserves stable alphabetical browse ordering and query relevance", () => {
    expect(rankTherapyCandidates(records, "").map((match) => match.record.name)).toEqual([
      "Acceptance and commitment therapy",
      "Cognitive behavioural therapy",
    ]);
    expect(rankTherapyCandidates(records, "CBT")[0]?.record.name).toBe("Cognitive behavioural therapy");
  });

  /**
   * Was "excludes unreviewed Therapy content from production discovery and
   * routes". That assertion is now false by decision, not by accident: the owner
   * lifted the production review gate on 2026-08-18 with all 205 records still
   * `needs_review`, so production serves them.
   *
   * Replaced rather than deleted, and with the stronger requirement. While the
   * gate stood, hiding the content WAS the protection and nothing needed to say
   * "unreviewed" out loud. Now that the content ships, the only thing between an
   * unreviewed record and a clinical decision is that every surface still says
   * so — so that is what gets pinned, on the real catalogue rather than fixtures.
   *
   * If someone re-arms `HIDE_UNREVIEWED_IN_PRODUCTION`, the first three
   * assertions fail loudly and this comment is where they should look.
   */
  it("serves the catalogue in production and never drops the unreviewed marking", () => {
    expect(therapyRecords.length).toBeGreaterThan(0);
    expect(therapyRecordsForEnvironment("production")).toHaveLength(therapyRecords.length);
    expect(therapySlugs("production")).toHaveLength(therapyRecords.length);
    expect(findTherapyRecord(therapyRecords[0].slug, "production")).toBeDefined();
    expect(searchTherapyRecords("CBT", "production").length).toBeGreaterThan(0);

    // The marking itself. `reviewStatus` must stay honest — relabelling records
    // as reviewed would be a false clinical attestation, not a product change.
    const unreviewed = therapyRecords.filter((record) => record.reviewStatus !== "reviewed");
    expect(unreviewed.length).toBeGreaterThan(0);
    expect(therapyNeedsReview(unreviewed[0])).toBe(true);

    // Every reader-facing channel that carries it, so none can be dropped
    // silently: the record badge, the universal-search badge, and the route
    // metadata description.
    expect(reviewStatusMeta(unreviewed[0].reviewStatus)).toEqual({
      label: "Needs source review",
      tone: "warning",
    });
    expect(readFileSync("src/lib/universal-search.ts", "utf8")).toContain(
      'badge: therapyNeedsReview(record) ? "Needs source review"',
    );
    expect(readFileSync("src/app/(search-app)/therapy-compass/[slug]/page.tsx", "utf8")).toContain(
      "Awaiting source review.",
    );
    // Tone alone is not a channel — `StatusBadge` pairs it with a glyph.
    expect(readFileSync("src/components/therapy-compass/ui.tsx", "utf8")).toContain(
      'const Icon = meta.tone === "success" ? ShieldCheck : TriangleAlert;',
    );
  });

  it.each([
    "CBT",
    "ACT",
    "DBT",
    "EMDR",
    "grounding",
    "trauma",
    "sleep",
    "psychosis",
    "self harm",
    "adolescent",
    "motivational interviewing",
  ])("keeps the top five ordered identically across catalogue and universal discovery for %s", (query) => {
    const catalogueOrder = searchTherapies(fullTherapyRecords, { ...EMPTY_SEARCH, query })
      .slice(0, 5)
      .map((record) => record.slug);
    const universalOrder = searchTherapyRecords(query, "development")
      .slice(0, 5)
      .map(({ record }) => record.slug);

    expect(universalOrder).toEqual(catalogueOrder);
  });

  it.each([
    ["CBT", "cognitive-behavioural-therapy-cbt"],
    ["ACT", "acceptance-and-commitment-therapy-act"],
    ["DBT", "dialectical-behaviour-therapy-dbt"],
    ["EMDR", "eye-movement-desensitisation-and-reprocessing-emdr"],
  ])("ranks the exact %s alias first", (query, expectedSlug) => {
    expect(searchTherapyRecords(query, "development")[0]?.record.slug).toBe(expectedSlug);
  });
});
