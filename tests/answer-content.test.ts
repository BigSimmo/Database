import { describe, expect, it } from "vitest";
import { primaryAnswerDisplayText } from "../src/components/clinical-dashboard/answer-content";

describe("primaryAnswerDisplayText", () => {
  it("keeps a safety cue in a long leading fragment beyond the compact word budget", () => {
    const lead = `${Array.from({ length: 90 }, (_, index) => `detail${index + 1}`).join(" ")} Do not administer the medicine.`;

    expect(primaryAnswerDisplayText(lead)).toContain("Do not administer the medicine.");
  });
});
