import { describe, expect, it } from "vitest";

import { cardPreviewText, prioritiseTherapyTags } from "@/components/therapy-compass/data/select";

describe("cardPreviewText", () => {
  it("skips a leading sentence that restates the therapy name", () => {
    const name = "CBT-informed psychological intervention for self-harm";
    const summary = `${name}. A structured, person-centred psychological intervention for adults who self-harm.`;

    expect(cardPreviewText(summary, { exclude: name })).toBe(
      "A structured, person-centred psychological intervention for adults who self-harm.",
    );
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
