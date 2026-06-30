import { describe, expect, it } from "vitest";
import { expectedFileCoverage } from "../scripts/eval-utils";

describe("RAG eval source identity matching", () => {
  it("matches legacy expected shorthand against current indexed document-family titles", () => {
    const coverage = expectedFileCoverage(
      ["MHSP.NOCC.pdf", "CG.MHSP.PtSafetyPlan.pdf"],
      [
        {
          title: "National Outcomes And Casemix Collection(NOCC)(AKG)",
          file_name: "National Outcomes and Casemix Collection (NOCC) (AKG).pdf",
        },
        {
          title: "Safety Planning - Mother Baby Unit(KEMH)",
          file_name: "Safety Planning - Mother Baby Unit (KEMH).pdf",
        },
      ],
      5,
    );

    expect(coverage).toMatchObject({
      matchedFiles: ["MHSP.NOCC.pdf", "CG.MHSP.PtSafetyPlan.pdf"],
      missingFiles: [],
      allHit: true,
    });
  });

  it("does not match unrelated retrieved files just because aliases exist", () => {
    const coverage = expectedFileCoverage(
      ["MHSP.Discharge.pdf"],
      [
        {
          title: "Pantoprazole Guideline(NMHS)",
          file_name: "Pantoprazole Guideline (NMHS).pdf",
        },
      ],
      5,
    );

    expect(coverage.anyHit).toBe(false);
    expect(coverage.missingFiles).toEqual(["MHSP.Discharge.pdf"]);
  });
});
