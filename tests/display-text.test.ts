import { describe, expect, it } from "vitest";
import { sanitizeAnswerDisplayText, truncateWords } from "../src/components/clinical-dashboard/display-text";

describe("clinical dashboard display text", () => {
  it("polishes cached generated answer prose before rendering", () => {
    const noisy =
      "Lithium Carbonate 250 mg Tablet – Lithicarb®. Imprest location: Formulary One DOSAGE & DOSAGE ADJUSTMENTS Therapy with lithium should always begin with conventional tablets (Lithium Carbonate 250 mg) to stabilise the do. Lithium MONITORING Baseline Tests1.";

    expect(sanitizeAnswerDisplayText(noisy)).toBe(
      "Therapy with lithium should always begin with conventional tablets (lithium carbonate 250 mg).",
    );
  });

  describe("truncateWords", () => {
    it("returns the value unchanged when within the word budget", () => {
      expect(truncateWords("withhold clozapine now", 5)).toBe("withhold clozapine now");
    });

    it("keeps a threshold value attached to its unit when truncating", () => {
      // Budget lands right after the number; the unit must come with it.
      const result = truncateWords("withhold clozapine when ANC falls below 1.5 ×10⁹/L immediately", 7);
      expect(result).toContain("1.5 ×10⁹/L");
      expect(result).not.toMatch(/1\.5\.\.\.$/);
    });

    it("keeps a dose value attached to its unit when truncating", () => {
      const result = truncateWords("start at 150 mg/day then review the response", 3);
      expect(result).toBe("start at 150 mg/day...");
    });

    it("drops a dangling connector left at the truncation boundary", () => {
      const result = truncateWords("monitor for 3 weeks or until symptoms resolve fully", 6);
      expect(result.endsWith("or...")).toBe(false);
      expect(result.endsWith("until...")).toBe(false);
    });
  });
});
