import { describe, expect, it } from "vitest";
import { primaryAnswerDisplayText } from "../src/components/clinical-dashboard/answer-content";

describe("primaryAnswerDisplayText", () => {
  it("keeps a safety cue in a long leading fragment beyond the compact word budget", () => {
    const lead = `${Array.from({ length: 90 }, (_, index) => `detail${index + 1}`).join(" ")} Do not administer the medicine.`;

    expect(primaryAnswerDisplayText(lead)).toContain("Do not administer the medicine.");
  });

  it("keeps a full-word escalation caveat that appears beyond the compact head", () => {
    // A bare `escalat\b` stem never matched "Escalate", so this caveat (the
    // fourth fragment) was silently dropped before the fix.
    const answer =
      "Give paracetamol for ongoing pain. Review the observations hourly overnight. Document the management plan clearly in the notes. Escalate to the senior doctor if the patient deteriorates.";
    expect(primaryAnswerDisplayText(answer)).toContain("Escalate to the senior doctor");
  });

  it("keeps a short contraindication caveat under the 8-word usefulness floor", () => {
    // "Contraindicated in pregnancy and severe renal impairment" is 7 words, so
    // the usefulness/length filter dropped it before the safety-aware exception.
    const answer =
      "Offer oral rehydration first. Reassess fluid balance after two hours. Record the intake and output totals. Contraindicated in pregnancy and severe renal impairment.";
    expect(primaryAnswerDisplayText(answer)).toContain("Contraindicated in pregnancy");
  });

  it("keeps a short stop instruction after normal leading prose", () => {
    const answer =
      "Give paracetamol for ongoing pain. Review the observations hourly overnight. Document the management plan clearly in the notes. Stop lithium.";
    expect(primaryAnswerDisplayText(answer)).toContain("Stop lithium.");
  });

  it("keeps a passive held caveat beyond the compact head", () => {
    const answer =
      "Give paracetamol for ongoing pain. Review the observations hourly overnight. Document the management plan clearly in the notes. Clozapine should be held.";
    expect(primaryAnswerDisplayText(answer)).toContain("should be held");
  });

  it("is unchanged for a short answer with no safety signal", () => {
    const answer = "Offer simple analgesia and reassess in one hour.";
    expect(primaryAnswerDisplayText(answer)).toBe(answer);
  });
});
