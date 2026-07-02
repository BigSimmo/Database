import { describe, expect, it } from "vitest";
import {
  cleanDisplayTitle,
  compactSourceSnippet,
  sanitizeAnswerDisplayText,
  truncateWords,
} from "../src/components/clinical-dashboard/display-text";

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

  describe("compactSourceSnippet", () => {
    it("keeps a lone mid-clause fragment verbatim and marks the continuation honestly", () => {
      const snippet = compactSourceSnippet(
        "combination with lithium may lead to serotonin toxicity • Concurrent antipsychotic medications o Rapid dose increase of lithium and antipsychotics together may increase risk of neurotoxicity",
      );

      expect(snippet.startsWith("… combination with lithium")).toBe(true);
      expect(snippet).toContain("toxicity; Concurrent");
      expect(snippet).toContain("medications; Rapid");
    });

    it("starts at the first real sentence when a partial first fragment has substantial follow-on", () => {
      expect(
        compactSourceSnippet(
          "tion of therapy requires care. Monitor serum lithium levels weekly until stable. Check renal function and thyroid function every six months.",
        ),
      ).toBe(
        "Monitor serum lithium levels weekly until stable. Check renal function and thyroid function every six months.",
      );
    });

    it("sheds a mid-list ordinal at the snippet head but keeps a genuine list start", () => {
      expect(compactSourceSnippet("2) MO to check the serum lithium level and renal function as soon as possible")).toBe(
        "MO to check the serum lithium level and renal function as soon as possible",
      );
      expect(compactSourceSnippet("1) Confirm baseline ECG before starting lithium therapy")).toBe(
        "1) Confirm baseline ECG before starting lithium therapy",
      );
    });

    it("cleans the mid-numbered-list stored synopsis without losing content or the truncation marker", () => {
      const stored =
        'Pharmacist or Medical Officer (MO) to withhold lithium (noting "W" on WA Hospital Medication Chart [HMC]). 2. MO to check the serum lithium level (note time of last dose) and renal function as soon as possible from th...';

      const snippet = compactSourceSnippet(stored);

      expect(snippet.startsWith("Pharmacist or Medical Officer (MO) to withhold lithium")).toBe(true);
      expect(snippet).toContain("MO to check the serum lithium level");
      expect(snippet).not.toContain("from th");
      expect(snippet.endsWith("…")).toBe(true);
    });

    it("drops a glued duplicate of the card title but never a sentence that starts with it", () => {
      expect(
        compactSourceSnippet(
          "Lithium Clinical Guideline (EMHS) - NSAIDs such as ibuprofen can reduce lithium clearance and increase toxicity risk substantially",
          { dropTitle: "Lithium Clinical Guideline(EMHS)" },
        ),
      ).toBe("NSAIDs such as ibuprofen can reduce lithium clearance and increase toxicity risk substantially");

      expect(
        compactSourceSnippet("Lithium levels should be checked weekly after any dose change or interacting medicine", {
          dropTitle: "Lithium levels",
        }),
      ).toBe("Lithium levels should be checked weekly after any dose change or interacting medicine");
    });

    it("repairs a stored mid-word truncation and still ends with an ellipsis", () => {
      expect(
        compactSourceSnippet("Monitor renal function every three months and review lithium dose where poss..."),
      ).toBe("Monitor renal function every three months and review lithium dose …");
    });
  });

  describe("cleanDisplayTitle", () => {
    it("inserts the missing space before an acronym parenthetical", () => {
      expect(cleanDisplayTitle("Lithium Clinical Guideline(EMHS)")).toBe("Lithium Clinical Guideline (EMHS)");
    });

    it("leaves lowercase and unit parentheticals untouched", () => {
      expect(cleanDisplayTitle("guideline(s) update")).toBe("guideline(s) update");
      expect(cleanDisplayTitle("dose(mg) chart")).toBe("dose(mg) chart");
    });

    it("strips a protective-marking banner and the pdf extension from titles", () => {
      expect(cleanDisplayTitle("OFFICIAL: Lithium Clinical Guideline(EMHS).pdf")).toBe(
        "Lithium Clinical Guideline (EMHS)",
      );
    });
  });
});
