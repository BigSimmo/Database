import { describe, expect, it } from "vitest";

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
});
