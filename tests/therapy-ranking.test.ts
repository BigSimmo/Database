import { describe, expect, it } from "vitest";

import { rankTherapyCandidates, scoreTherapyCandidate } from "@/lib/therapy-ranking";

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
  it("preserves the established catalogue exact-name weighting", () => {
    expect(scoreTherapyCandidate(records[0], "cognitive behavioural therapy", "catalogue")).toBe(160);
  });

  it("preserves stable alphabetical browse ordering and query relevance", () => {
    expect(rankTherapyCandidates(records, "", "catalogue").map((match) => match.record.name)).toEqual([
      "Acceptance and commitment therapy",
      "Cognitive behavioural therapy",
    ]);
    expect(rankTherapyCandidates(records, "CBT", "universal")[0]?.record.name).toBe("Cognitive behavioural therapy");
  });
});
