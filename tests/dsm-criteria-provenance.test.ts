import { describe, expect, it } from "vitest";

import { buildDsmDiagnosisNote, dsmNoteBuilderRecord } from "@/lib/dsm-note";
import { dsmCriteriaView, dsmDiagnoses, dsmDiagnosisSummary, getDsmDiagnosis } from "@/lib/dsm";

/**
 * 145 of the 146 records in `src/data/dsm-clinical-content.json` ship an empty
 * `criteria_display`. Only Bipolar II carries structured criteria. Every surface
 * that previously read the criteria pathway fell back to `key_features` — a
 * clinician-facing summary — and then labelled the result "Core diagnostic
 * criteria", "Criteria met" and "Recorded against DSM-5-TR criteria".
 *
 * A key-feature summary is not the diagnostic standard, and the note builder's
 * output is pasted into a real medical record. These tests hold the boundary:
 * the summary stays visible and useful, but nothing may call it criteria.
 */
describe("DSM criteria provenance", () => {
  const withCriteria = getDsmDiagnosis("bipolar-ii-disorder")!;
  const withoutCriteria = getDsmDiagnosis("major-depressive-disorder")!;

  it("reports the corpus shape this boundary exists for", () => {
    const supplied = dsmDiagnoses.filter((diagnosis) => diagnosis.criteria_display.length > 0);
    expect(supplied).toHaveLength(1);
    expect(supplied[0]?.slug).toBe("bipolar-ii-disorder");
  });

  it("marks structured criteria as criteria and never invents them", () => {
    const view = dsmCriteriaView(withCriteria);
    expect(view.provenance).toBe("dsm_criteria");
    expect(view.isDsmCriteria).toBe(true);
    expect(view.rows).toEqual(withCriteria.criteria_display);
  });

  it("marks a key-feature fallback as a summary, not as criteria", () => {
    const view = dsmCriteriaView(withoutCriteria);
    expect(view.provenance).toBe("key_features_summary");
    expect(view.isDsmCriteria).toBe(false);
    // The content is still shown. Only the label changes.
    expect(view.rows).toEqual(withoutCriteria.key_features);
  });

  it("keeps the criteria count distinct from the key-feature count", () => {
    const summary = dsmDiagnosisSummary(withoutCriteria);
    expect(withoutCriteria.key_features.length).toBeGreaterThan(0);
    expect(summary.criteriaCount).toBe(0);
    expect(summary.criteriaProvenance).toBe("key_features_summary");

    const supplied = dsmDiagnosisSummary(withCriteria);
    expect(supplied.criteriaCount).toBe(withCriteria.criteria_display.length);
    expect(supplied.criteriaProvenance).toBe("dsm_criteria");
  });

  it("never states a DSM-5-TR criteria basis in a note built from key features", () => {
    const record = dsmNoteBuilderRecord(withoutCriteria);
    expect(record.isDsmCriteria).toBe(false);

    const note = buildDsmDiagnosisNote({
      title: record.title,
      icdCode: record.icdCode,
      isDsmCriteria: record.isDsmCriteria,
      criteria: record.criteria.map((criterion) => ({ ...criterion, status: "met" as const })),
      specifiers: [],
      specifierText: "",
      excludedDifferentials: [],
      includeCriterionText: true,
    });

    expect(note).not.toContain("Criteria met");
    expect(note).not.toContain("Recorded against DSM-5-TR criteria");
    expect(note).toContain("Key features present");
    expect(note).toContain("not the full DSM-5-TR criteria");
  });

  it("still states a DSM-5-TR criteria basis when the record really supplies criteria", () => {
    const record = dsmNoteBuilderRecord(withCriteria);
    expect(record.isDsmCriteria).toBe(true);

    const note = buildDsmDiagnosisNote({
      title: record.title,
      icdCode: record.icdCode,
      isDsmCriteria: record.isDsmCriteria,
      criteria: record.criteria.map((criterion) => ({ ...criterion, status: "met" as const })),
      specifiers: [],
      specifierText: "",
      excludedDifferentials: [],
      includeCriterionText: true,
    });

    expect(note).toContain("Criteria met");
    expect(note).toContain("Recorded against DSM-5-TR criteria");
  });

  it("does not let an empty criteria array read as an absence of criteria in the standard", () => {
    const view = dsmCriteriaView(withoutCriteria);
    expect(view.rows.length).toBeGreaterThan(0);
    // "none" is reserved for a record that supplies neither, which no record does.
    expect(view.provenance).not.toBe("none");
  });
});
