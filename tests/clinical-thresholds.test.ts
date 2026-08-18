import { describe, expect, it } from "vitest";
import { detectConflictsOrGaps } from "@/lib/evidence";
import type { SearchResult } from "@/lib/types";

function makeSearchResult(overrides: Partial<SearchResult> & { id: string; document_id: string }): SearchResult {
  return {
    title: "Guideline Document",
    file_name: "guideline.pdf",
    page_number: 1,
    chunk_index: 0,
    section_heading: "Monitoring",
    content: "",
    image_ids: [],
    similarity: 0.85,
    images: [],
    ...overrides,
  };
}

describe("Clinical Numerical Threshold Validation", () => {
  describe("Haematological Parameters", () => {
    it("detects cross-source ANC withholding disagreements", () => {
      const results: SearchResult[] = [
        makeSearchResult({
          id: "chunk-anc-1",
          document_id: "doc-guideline-a",
          content: "Immediately cease clozapine if ANC falls below 1.0 x10^9/L.",
        }),
        makeSearchResult({
          id: "chunk-anc-2",
          document_id: "doc-guideline-b",
          content: "Withhold clozapine therapy if neutrophils < 1.5 x10^9/L.",
        }),
      ];

      const conflicts = detectConflictsOrGaps(results).filter((item) => item.type === "conflict");
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].message).toMatch(/ANC \(absolute neutrophil count\)/i);
      expect(conflicts[0].message).toMatch(/< 1 vs < 1.5/);
    });

    it("detects cross-source Platelet count withholding disagreements", () => {
      const results: SearchResult[] = [
        makeSearchResult({
          id: "chunk-plt-1",
          document_id: "doc-guideline-a",
          content: "Withhold treatment if platelets < 50 x10^9/L.",
        }),
        makeSearchResult({
          id: "chunk-plt-2",
          document_id: "doc-guideline-b",
          content: "Cease medication if platelets fall below 100 x10^9/L.",
        }),
      ];

      const conflicts = detectConflictsOrGaps(results).filter((item) => item.type === "conflict");
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].message).toMatch(/platelet count/i);
      expect(conflicts[0].message).toMatch(/< 50 vs < 100/);
    });
  });

  describe("Therapeutic Drug Monitoring & Toxicity Limits", () => {
    it("detects cross-source Lithium serum level withholding conflicts", () => {
      const results: SearchResult[] = [
        makeSearchResult({
          id: "chunk-li-1",
          document_id: "doc-guideline-a",
          content: "Withhold lithium dose if lithium serum level > 1.2 mmol/L.",
        }),
        makeSearchResult({
          id: "chunk-li-2",
          document_id: "doc-guideline-b",
          content: "Cease administration if serum lithium exceeds 1.5 mmol/L.",
        }),
      ];

      const conflicts = detectConflictsOrGaps(results).filter((item) => item.type === "conflict");
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].message).toMatch(/Lithium serum level/i);
      expect(conflicts[0].message).toMatch(/> 1.2 vs > 1.5/);
    });

    it("detects cross-source Valproate serum level conflicts", () => {
      const results: SearchResult[] = [
        makeSearchResult({
          id: "chunk-val-1",
          document_id: "doc-a",
          content: "Withhold valproate if valproate serum level > 100 mg/L.",
        }),
        makeSearchResult({
          id: "chunk-val-2",
          document_id: "doc-b",
          content: "Cease if valproic acid serum level exceeds 125 mg/L.",
        }),
      ];

      const conflicts = detectConflictsOrGaps(results).filter((item) => item.type === "conflict");
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].message).toMatch(/Valproate serum level/i);
      expect(conflicts[0].message).toMatch(/> 100 vs > 125/);
    });

    it("detects cross-source Carbamazepine level conflicts", () => {
      const results: SearchResult[] = [
        makeSearchResult({
          id: "chunk-cbz-1",
          document_id: "doc-a",
          content: "Withhold carbamazepine if carbamazepine serum level > 12 mg/L.",
        }),
        makeSearchResult({
          id: "chunk-cbz-2",
          document_id: "doc-b",
          content: "Stop tegretol if carbamazepine level > 15 mg/L.",
        }),
      ];

      const conflicts = detectConflictsOrGaps(results).filter((item) => item.type === "conflict");
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].message).toMatch(/Carbamazepine serum level/i);
      expect(conflicts[0].message).toMatch(/> 12 vs > 15/);
    });
  });

  describe("Cardiac & ECG Thresholds", () => {
    it("detects cross-source QTc interval threshold conflicts", () => {
      const results: SearchResult[] = [
        makeSearchResult({
          id: "chunk-qtc-1",
          document_id: "doc-cardio-1",
          content: "Withhold psychotropic if QTc exceeds 500 ms.",
        }),
        makeSearchResult({
          id: "chunk-qtc-2",
          document_id: "doc-cardio-2",
          content: "Cease antipsychotic if QTc > 480 ms.",
        }),
      ];

      const conflicts = detectConflictsOrGaps(results).filter((item) => item.type === "conflict");
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].message).toMatch(/QTc interval/i);
      expect(conflicts[0].message).toMatch(/> 480 vs > 500/);
    });

    it("flags comparator disagreements for identical QTc numbers (e.g. > vs >=)", () => {
      const results: SearchResult[] = [
        makeSearchResult({
          id: "chunk-qtc-gt",
          document_id: "doc-1",
          content: "Withhold medication when QTc > 500 ms.",
        }),
        makeSearchResult({
          id: "chunk-qtc-gte",
          document_id: "doc-2",
          content: "Withhold medication when QTc >= 500 ms.",
        }),
      ];

      const conflicts = detectConflictsOrGaps(results).filter((item) => item.type === "conflict");
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].message).toMatch(/> 500 vs ≥ 500/);
    });
  });

  describe("Renal, Electrolytes & Endocrine Thresholds", () => {
    it("detects cross-source eGFR / CrCl renal impairment conflicts", () => {
      const results: SearchResult[] = [
        makeSearchResult({
          id: "chunk-egfr-1",
          document_id: "doc-renal-1",
          content: "Do not prescribe if eGFR < 30 mL/min.",
        }),
        makeSearchResult({
          id: "chunk-egfr-2",
          document_id: "doc-renal-2",
          content: "Withhold if creatinine clearance falls below 45 mL/min.",
        }),
      ];

      const conflicts = detectConflictsOrGaps(results).filter((item) => item.type === "conflict");
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].message).toMatch(/Renal function \(eGFR\/CrCl\)/i);
      expect(conflicts[0].message).toMatch(/< 30 vs < 45/);
    });

    it("detects cross-source Serum Potassium withholding conflicts", () => {
      const results: SearchResult[] = [
        makeSearchResult({
          id: "chunk-k-1",
          document_id: "doc-k-1",
          content: "Withhold diuretic if serum potassium < 3.0 mmol/L.",
        }),
        makeSearchResult({
          id: "chunk-k-2",
          document_id: "doc-k-2",
          content: "Cease dose if potassium < 3.5 mmol/L.",
        }),
      ];

      const conflicts = detectConflictsOrGaps(results).filter((item) => item.type === "conflict");
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].message).toMatch(/Serum potassium/i);
      expect(conflicts[0].message).toMatch(/< 3 vs < 3.5/);
    });

    it("detects cross-source Serum Sodium withholding conflicts", () => {
      const results: SearchResult[] = [
        makeSearchResult({
          id: "chunk-na-1",
          document_id: "doc-na-1",
          content: "Withhold SSRI if serum sodium < 130 mmol/L.",
        }),
        makeSearchResult({
          id: "chunk-na-2",
          document_id: "doc-na-2",
          content: "Cease medication if sodium falls below 125 mmol/L.",
        }),
      ];

      const conflicts = detectConflictsOrGaps(results).filter((item) => item.type === "conflict");
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].message).toMatch(/Serum sodium/i);
      expect(conflicts[0].message).toMatch(/< 125 vs < 130/);
    });

    it("detects cross-source TSH threshold conflicts", () => {
      const results: SearchResult[] = [
        makeSearchResult({
          id: "chunk-tsh-1",
          document_id: "doc-tsh-1",
          content: "Withhold treatment if TSH > 5.5 mIU/L.",
        }),
        makeSearchResult({
          id: "chunk-tsh-2",
          document_id: "doc-tsh-2",
          content: "Cease if thyroid stimulating hormone > 10.0 mIU/L.",
        }),
      ];

      const conflicts = detectConflictsOrGaps(results).filter((item) => item.type === "conflict");
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].message).toMatch(/TSH \(thyroid stimulating hormone\)/i);
      expect(conflicts[0].message).toMatch(/> 5.5 vs > 10/);
    });
  });

  describe("Hepatic & Liver Transaminases", () => {
    it("detects cross-source ALT/AST transaminase conflicts", () => {
      const results: SearchResult[] = [
        makeSearchResult({
          id: "chunk-alt-1",
          document_id: "doc-alt-1",
          content: "Withhold medication if ALT > 100 U/L.",
        }),
        makeSearchResult({
          id: "chunk-alt-2",
          document_id: "doc-alt-2",
          content: "Cease drug if alanine aminotransferase exceeds 150 U/L.",
        }),
      ];

      const conflicts = detectConflictsOrGaps(results).filter((item) => item.type === "conflict");
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].message).toMatch(/Liver transaminases \(ALT\/AST\)/i);
      expect(conflicts[0].message).toMatch(/> 100 vs > 150/);
    });
  });

  describe("Dosing Parameters", () => {
    it("detects cross-source Clozapine dose ceiling conflicts", () => {
      const results: SearchResult[] = [
        makeSearchResult({
          id: "chunk-cloz-1",
          document_id: "doc-cloz-1",
          content: "Do not prescribe if clozapine dose > 600 mg daily.",
        }),
        makeSearchResult({
          id: "chunk-cloz-2",
          document_id: "doc-cloz-2",
          content: "Withhold titration if clozapine > 900 mg daily.",
        }),
      ];

      const conflicts = detectConflictsOrGaps(results).filter((item) => item.type === "conflict");
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].message).toMatch(/Clozapine dose/i);
      expect(conflicts[0].message).toMatch(/> 600 vs > 900/);
    });

    it("detects cross-source Lamotrigine dose ceiling conflicts", () => {
      const results: SearchResult[] = [
        makeSearchResult({
          id: "chunk-lam-1",
          document_id: "doc-lam-1",
          content: "Do not prescribe if lamotrigine dose > 200 mg daily with valproate.",
        }),
        makeSearchResult({
          id: "chunk-lam-2",
          document_id: "doc-lam-2",
          content: "Withhold dose if Lamictal > 400 mg daily.",
        }),
      ];

      const conflicts = detectConflictsOrGaps(results).filter((item) => item.type === "conflict");
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].message).toMatch(/Lamotrigine dose/i);
      expect(conflicts[0].message).toMatch(/> 200 vs > 400/);
    });
  });

  describe("Vital Signs", () => {
    it("detects cross-source Systolic Blood Pressure withholding conflicts", () => {
      const results: SearchResult[] = [
        makeSearchResult({
          id: "chunk-sbp-1",
          document_id: "doc-sbp-1",
          content: "Hold antihypertensive if systolic BP < 90 mmHg.",
        }),
        makeSearchResult({
          id: "chunk-sbp-2",
          document_id: "doc-sbp-2",
          content: "Withhold medication if SBP falls below 100 mmHg.",
        }),
      ];

      const conflicts = detectConflictsOrGaps(results).filter((item) => item.type === "conflict");
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].message).toMatch(/Systolic blood pressure \(SBP\)/i);
      expect(conflicts[0].message).toMatch(/< 90 vs < 100/);
    });

    it("detects cross-source Heart Rate withholding conflicts", () => {
      const results: SearchResult[] = [
        makeSearchResult({
          id: "chunk-hr-1",
          document_id: "doc-hr-1",
          content: "Withhold beta-blocker if heart rate < 50 bpm.",
        }),
        makeSearchResult({
          id: "chunk-hr-2",
          document_id: "doc-hr-2",
          content: "Hold medication if pulse falls below 60 bpm.",
        }),
      ];

      const conflicts = detectConflictsOrGaps(results).filter((item) => item.type === "conflict");
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].message).toMatch(/Heart rate \/ pulse/i);
      expect(conflicts[0].message).toMatch(/< 50 vs < 60/);
    });
  });

  describe("Structured Table Facts Extraction", () => {
    it("extracts and conflicts table facts with structured clinical parameters", () => {
      const results: SearchResult[] = [
        makeSearchResult({
          id: "chunk-table-1",
          document_id: "doc-table-1",
          table_facts: [
            {
              id: "tf-1",
              document_id: "doc-table-1",
              source_chunk_id: "chunk-table-1",
              source_image_id: null,
              page_number: 1,
              table_title: "Potassium Monitoring",
              row_label: "Low",
              action: "Withhold dose",
              clinical_parameter: "serum potassium",
              threshold_value: "3.2",
            },
          ],
        }),
        makeSearchResult({
          id: "chunk-table-2",
          document_id: "doc-table-2",
          table_facts: [
            {
              id: "tf-2",
              document_id: "doc-table-2",
              source_chunk_id: "chunk-table-2",
              source_image_id: null,
              page_number: 1,
              table_title: "Potassium Monitoring",
              row_label: "Critical Low",
              action: "Cease administration",
              clinical_parameter: "potassium level",
              threshold_value: "3.8",
            },
          ],
        }),
      ];

      const conflicts = detectConflictsOrGaps(results).filter((item) => item.type === "conflict");
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].message).toMatch(/Serum potassium/i);
      expect(conflicts[0].message).toMatch(/3.2 vs 3.8/);
    });
  });

  describe("False-Positive Guards & Single Document Boundaries", () => {
    it("does NOT flag conflict when multiple bands appear within the SAME document", () => {
      const results: SearchResult[] = [
        makeSearchResult({
          id: "chunk-single-doc-1",
          document_id: "doc-same-guideline",
          content: "Withhold if ANC < 1.0. For ANC < 1.5, increase monitoring frequency.",
        }),
      ];

      const conflicts = detectConflictsOrGaps(results).filter((item) => item.type === "conflict");
      expect(conflicts).toHaveLength(0);
    });

    it("does NOT flag conflict when cross-document sources agree on cutoff value", () => {
      const results: SearchResult[] = [
        makeSearchResult({
          id: "chunk-agree-1",
          document_id: "doc-agree-a",
          content: "Withhold lithium if lithium level > 1.2 mmol/L.",
        }),
        makeSearchResult({
          id: "chunk-agree-2",
          document_id: "doc-agree-b",
          content: "Cease medication if serum lithium > 1.20 mmol/L.",
        }),
      ];

      const conflicts = detectConflictsOrGaps(results).filter((item) => item.type === "conflict");
      expect(conflicts).toHaveLength(0);
    });

    it("does NOT flag sentences without clinical withholding actions", () => {
      const results: SearchResult[] = [
        makeSearchResult({
          id: "chunk-no-action-1",
          document_id: "doc-1",
          content: "Target serum potassium is greater than 4.0 mmol/L during therapy.",
        }),
        makeSearchResult({
          id: "chunk-no-action-2",
          document_id: "doc-2",
          content: "Routine reference range for potassium is greater than 3.5 mmol/L.",
        }),
      ];

      const conflicts = detectConflictsOrGaps(results).filter((item) => item.type === "conflict");
      expect(conflicts).toHaveLength(0);
    });
  });
});
