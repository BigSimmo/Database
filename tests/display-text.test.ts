import { describe, expect, it } from "vitest";
import { sanitizeAnswerDisplayText } from "../src/components/clinical-dashboard/display-text";

describe("clinical dashboard display text", () => {
  it("polishes cached generated answer prose before rendering", () => {
    const noisy =
      "Lithium Carbonate 250 mg Tablet – Lithicarb®. Imprest location: Formulary One DOSAGE & DOSAGE ADJUSTMENTS Therapy with lithium should always begin with conventional tablets (Lithium Carbonate 250 mg) to stabilise the do. Lithium MONITORING Baseline Tests1.";

    expect(sanitizeAnswerDisplayText(noisy)).toBe(
      "Therapy with lithium should always begin with conventional tablets (lithium carbonate 250 mg).",
    );
  });
});
