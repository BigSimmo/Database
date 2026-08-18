import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { EMPTY_SEARCH, searchTherapies } from "@/components/therapy-compass/data/select";
import { THERAPY_CATALOGUE_ASSETS } from "@/components/therapy-compass/data/generated-assets";
import type { Therapy } from "@/components/therapy-compass/data/types";
import { rankTherapyCandidates, scoreTherapyCandidate } from "@/lib/therapy-ranking";
import {
  findTherapyRecord,
  searchTherapyRecords,
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

  it("excludes unreviewed Therapy content from production discovery and routes", () => {
    expect(therapyRecords.length).toBeGreaterThan(0);
    expect(therapyRecordsForEnvironment("production")).toEqual([]);
    expect(searchTherapyRecords("CBT", "production")).toEqual([]);
    expect(therapySlugs("production")).toEqual([]);
    expect(findTherapyRecord(therapyRecords[0].slug, "production")).toBeUndefined();
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
