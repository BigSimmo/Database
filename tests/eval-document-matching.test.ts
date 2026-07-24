import { describe, expect, it } from "vitest";
import {
  documentExpectationAlternatives,
  expectedFileCoverage,
  normalizedDocumentName,
} from "@/lib/eval-document-matching";

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
});
