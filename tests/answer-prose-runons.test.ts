import { describe, expect, it } from "vitest";

import { polishClinicalAnswerProse } from "@/lib/rag/rag-answer-text";

describe("flattened-table run-on separation", () => {
  it("splits an inpatient/community run-on into two sentences without a double comma", () => {
    const out = polishClinicalAnswerProse(
      "TPR and postural BP are monitored daily for inpatients for community patients, they are weekly until week 18.",
    );

    expect(out).toContain("for inpatients. For community patients,");
    expect(out).not.toContain("patients,,");
    expect(out).not.toMatch(/for inpatients\s+for community/i);
  });

  it("handles the pattern with no comma present", () => {
    const out = polishClinicalAnswerProse(
      "U&Es are repeated every 6 months for inpatients for community patients they are checked annually.",
    );
    expect(out).toContain("for inpatients. For community patients,");
  });

  it("leaves normal prose untouched", () => {
    const out = polishClinicalAnswerProse("Withhold clozapine when the neutrophil count falls below the red range.");
    expect(out).toBe("Withhold clozapine when the neutrophil count falls below the red range.");
  });
});
