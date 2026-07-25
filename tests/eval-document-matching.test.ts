import { describe, expect, it } from "vitest";
import {
  documentExpectationAlternatives,
  expectedFileCoverage,
  normalizedDocumentName,
} from "@/lib/eval-document-matching";
import { answerQualityEvalCases, ragEvalCases } from "@/lib/rag/rag-eval-cases";

const multiSlotCases = [...ragEvalCases, ...answerQualityEvalCases].filter(
  (evalCase) => evalCase.expectedFiles.length > 1,
);

// Alias values a wide-tier expectation recognizes, excluding the expectation's own name.
function aliasValuesFor(expectation: string) {
  const own = normalizedDocumentName(expectation);
  return documentExpectationAlternatives(expectation).filter((value) => value !== own);
}

describe("eval document matching wide-tier aliases", () => {
  it("does not let one dual-listed admission-to-discharge doc satisfy both comparison slots", () => {
    const dualListedDoc = {
      title: "Admission to Discharge for Mental Health Inpatients",
      file_name: "Admission to Discharge for Mental Health Inpatients (NMHS).pdf",
    };

    const coverage = expectedFileCoverage(["MHSP.AdmissionCommunityPts.pdf", "MHSP.Discharge.pdf"], [dualListedDoc], 5);

    // A single retrieved source may hit Discharge, but must not make allHit true
    // by also filling the Admission slot via overlapping wide-tier aliases.
    expect(coverage.allHit).toBe(false);
    expect(coverage.matchedFiles).toEqual(["MHSP.Discharge.pdf"]);
    expect(coverage.missingFiles).toEqual(["MHSP.AdmissionCommunityPts.pdf"]);
  });

  it("keeps AdmissionCommunityPts and Discharge wide-tier alias values disjoint", () => {
    const admission = new Set(
      documentExpectationAlternatives("MHSP.AdmissionCommunityPts.pdf").filter(
        (name) => name !== normalizedDocumentName("MHSP.AdmissionCommunityPts.pdf"),
      ),
    );
    const discharge = documentExpectationAlternatives("MHSP.Discharge.pdf").filter(
      (name) => name !== normalizedDocumentName("MHSP.Discharge.pdf"),
    );

    expect(discharge.filter((name) => admission.has(name))).toEqual([]);
  });

  it("still matches admission-only and discharge-only documents on their own slots", () => {
    expect(
      expectedFileCoverage(
        ["MHSP.AdmissionCommunityPts.pdf", "MHSP.Discharge.pdf"],
        [
          {
            title: "Admission of Community Patients",
            file_name: "Admission of Community Patients (NMHS).pdf",
          },
          {
            title: "Discharge Planning",
            file_name: "Discharge Planning for Community Patients.pdf",
          },
        ],
        5,
      ),
    ).toMatchObject({
      matchedFiles: ["MHSP.AdmissionCommunityPts.pdf", "MHSP.Discharge.pdf"],
      missingFiles: [],
      allHit: true,
    });
  });

  it("requires distinct retrieved sources for multi-slot allHit even when one title matches both aliases", () => {
    const coverage = expectedFileCoverage(
      ["MHSP.AdmissionCommunityPts.pdf", "MHSP.Discharge.pdf"],
      [
        {
          title: "Admission of Community Patients and Discharge Planning",
          file_name: "Admission of Community Patients and Discharge Planning.pdf",
        },
      ],
      5,
    );

    expect(coverage.allHit).toBe(false);
    expect(coverage.anyHit).toBe(true);
    expect(coverage.matchedFiles).toHaveLength(1);
    expect(coverage.missingFiles).toHaveLength(1);
  });

  it("does not let the same document repeated across citations fill two expected slots", () => {
    // answer.citations carries one entry per cited chunk, so a single combo-titled document
    // arrives several times; distinctness must be by document, not by position.
    const citedTwice = {
      title: "Lithium and Metformin Monitoring",
      file_name: "Lithium and Metformin Monitoring.pdf",
    };

    const coverage = expectedFileCoverage(
      ["CG.MHSP.Lithium.pdf", "CG.MHSP.Metformin.pdf"],
      [citedTwice, citedTwice],
      5,
    );

    expect(coverage.allHit).toBe(false);
    expect(coverage.matchedFiles).toHaveLength(1);
  });

  it("assigns sources optimally so coverage does not depend on expectedFiles order", () => {
    // The combo document matches both expectations; the narrower one matches only Lithium.
    // Whichever order the expectations arrive in, both slots are satisfiable by distinct docs.
    const sources = [
      { title: "Lithium and Metformin Monitoring", file_name: "Lithium and Metformin Monitoring.pdf" },
      { title: "Lithium Clinical Guideline", file_name: "Lithium Clinical Guideline.pdf" },
    ];

    expect(expectedFileCoverage(["CG.MHSP.Lithium.pdf", "CG.MHSP.Metformin.pdf"], sources, 5).allHit).toBe(true);
    expect(expectedFileCoverage(["CG.MHSP.Metformin.pdf", "CG.MHSP.Lithium.pdf"], sources, 5).allHit).toBe(true);
  });

  it("keeps the alias values of every multi-slot case's expectations pairwise disjoint", () => {
    // Generalizes the admission/discharge check above to every multi-slot case, including any
    // added later. A value listed under two slots of the same case is the #030 defect: it lets
    // one document stand in for two independent sources.
    const overlaps = multiSlotCases.flatMap((evalCase) => {
      const found: string[] = [];
      for (let i = 0; i < evalCase.expectedFiles.length; i += 1) {
        for (let j = i + 1; j < evalCase.expectedFiles.length; j += 1) {
          const left = new Set(aliasValuesFor(evalCase.expectedFiles[i]));
          const shared = aliasValuesFor(evalCase.expectedFiles[j]).filter((value) => left.has(value));
          for (const value of shared) {
            found.push(
              `${evalCase.id}: "${value}" is listed under both ${evalCase.expectedFiles[i]} and ${evalCase.expectedFiles[j]}`,
            );
          }
        }
      }
      return found;
    });

    expect(overlaps).toEqual([]);
  });

  it("never lets a single document satisfy every slot of a multi-slot case", () => {
    // Table-independent: whatever the alias tables say, one retrieved document is one source.
    // This holds even for a document whose text contains every expectation, so it stays true if
    // the alias tables are widened again.
    expect(multiSlotCases.length).toBeGreaterThan(0);

    for (const evalCase of multiSlotCases) {
      const everyExpectation = evalCase.expectedFiles
        .flatMap((expectation) => [expectation, ...aliasValuesFor(expectation)])
        .join(" ");
      const coverage = expectedFileCoverage(
        evalCase.expectedFiles,
        [{ title: everyExpectation, file_name: `${everyExpectation}.pdf` }],
        5,
      );

      expect(coverage.matchedFiles.length, `${evalCase.id} matched more than one slot from one document`).toBe(1);
      expect(coverage.allHit, `${evalCase.id} reached allHit from a single document`).toBe(false);
    }
  });
});
