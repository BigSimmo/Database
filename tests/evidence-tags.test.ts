import { describe, expect, it } from "vitest";
import { smartEvidenceTags } from "../src/lib/evidence-tags";

describe("smart evidence tags", () => {
  it("turns generic role labels into clinically useful tags", () => {
    const tags = smartEvidenceTags(
      ["roles", "responsibilities", "clozapine monitoring", "psychiatrist", "care coordinator"],
      "Roles And Responsibilities table for Clozapine monitoring, psychiatrist oversight, and care coordination.",
    );

    expect(tags).toEqual([
      "Clozapine monitoring",
      "Psychiatrist review",
      "Care team responsibilities",
      "Care coordination",
    ]);
  });

  it("deduplicates and capitalizes raw generated labels", () => {
    const tags = smartEvidenceTags(["blood_tests", "blood test", "dose", "monitoring"], "Clozapine dose table");

    expect(tags).toEqual(["Blood test monitoring", "Dose adjustment", "Clozapine monitoring"]);
  });
});
