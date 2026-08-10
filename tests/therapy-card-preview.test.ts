import { describe, expect, it } from "vitest";

import { cardPreviewText, prioritiseTherapyTags, searchTherapies } from "@/components/therapy-compass/data/select";
import type { Therapy } from "@/components/therapy-compass/data/types";

const searchableTherapy = {
  slug: "behavioural-activation",
  name: "Behavioural activation",
  aliases: [],
  tags: ["depression"],
  category: "Behavioural",
  bestUsedFor: "Low mood",
  targetSymptoms: "withdrawal",
  clinicalSummary: "A structured activity-based therapy.",
  indications: "Depression",
  briefInterventionAvailable: false,
  patientSheetAvailable: false,
  reviewStatus: "reviewed",
} as unknown as Therapy;

describe("searchTherapies", () => {
  it("recovers a close therapy-name typo", () => {
    const results = searchTherapies([searchableTherapy], {
      query: "behavoural activaton",
      tags: [],
      briefOnly: false,
      sheetOnly: false,
      reviewedOnly: false,
    });
    expect(results[0]?.slug).toBe("behavioural-activation");
  });
});

describe("cardPreviewText", () => {
  it("skips a leading sentence that restates the therapy name", () => {
    const name = "CBT-informed psychological intervention for self-harm";
    const summary = `${name}. A structured, person-centred psychological intervention for adults who self-harm.`;

    expect(cardPreviewText(summary, { exclude: name })).toBe(
      "A structured, person-centred psychological intervention for adults who self-harm.",
    );
  });

  it("skips title restatements that include a parenthetical or comma alias", () => {
    expect(
      cardPreviewText("Cognitive Therapy (CT). Classic strongest uses are depression and anxiety disorders.", {
        exclude: "Cognitive Therapy",
      }),
    ).toBe("Classic strongest uses are depression and anxiety disorders.");

    expect(
      cardPreviewText("Dignity therapy, DT. Best in palliative care and advanced illness.", {
        exclude: "Dignity therapy",
      }),
    ).toBe("Best in palliative care and advanced illness.");
  });

  it("skips a title-prefixed prose sentence while keeping unrelated prefix-sharing words", () => {
    expect(
      cardPreviewText("Behavioural activation is a structured approach. Prefer when avoidance dominates.", {
        exclude: "Behavioural activation",
      }),
    ).toBe("Prefer when avoidance dominates.");

    expect(
      cardPreviewText("Behavioural activationism remains distinct from the named therapy.", {
        exclude: "Behavioural activation",
      }),
    ).toBe("Behavioural activationism remains distinct from the named therapy.");
  });

  it("returns empty when every sentence is the excluded title", () => {
    const name = "Behavioural activation";
    expect(cardPreviewText(`${name}.`, { exclude: name })).toBe("");
  });

  it("summarises to the requested sentence count", () => {
    expect(cardPreviewText("First claim. Second claim. Third claim.", { maxSentences: 2 })).toBe(
      "First claim. Second claim.",
    );
  });
});

describe("prioritiseTherapyTags", () => {
  const tags = ["Mood", "Anxiety", "Trauma", "Psychosis", "Crisis/risk", "CBT", "Single session"];

  it("surfaces active filter tags first, then query matches, then catalogue order", () => {
    expect(prioritiseTherapyTags(tags, { query: "CBT", activeTags: ["Trauma"] })).toEqual([
      "Trauma",
      "CBT",
      "Mood",
      "Anxiety",
      "Psychosis",
      "Crisis/risk",
      "Single session",
    ]);
  });

  it("keeps catalogue order when nothing is relevant", () => {
    expect(prioritiseTherapyTags(tags, { query: "", activeTags: [] })).toEqual(tags);
  });
});
