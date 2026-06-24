import { describe, expect, it } from "vitest";
import {
  normalizeStructuredVisualProfile,
  rankVisualCandidates,
  selectCaptionCandidateIndexes,
} from "../src/lib/visual-intelligence";

describe("visual intelligence v1", () => {
  it("prioritizes clinical tables and flowcharts over admin/reference visuals", () => {
    const ranked = rankVisualCandidates([
      {
        pageNumber: 1,
        sourceKind: "table_crop",
        width: 900,
        height: 500,
        metadata: {
          table_title: "Document approval",
          table_text: "Authorised by document owner version effective date references",
          table_role: "admin",
        },
      },
      {
        pageNumber: 2,
        sourceKind: "table_crop",
        width: 900,
        height: 600,
        metadata: {
          table_title: "Agitation medication chart",
          table_text: "Medication route dose IM PO action monitor observations",
          table_rows: [["Lorazepam", "PO", "1 mg", "review"]],
        },
      },
      {
        pageNumber: 3,
        sourceKind: "page_region",
        width: 700,
        height: 700,
        metadata: { candidate_type: "flowchart" },
        nearbyText: "Flowchart next step: assess risk, escalate if red zone.",
      },
    ]);

    expect(ranked[0].captionBudgetClass).toMatch(/clinical_table|flowchart/);
    expect(ranked[ranked.length - 1].captionBudgetClass).toBe("admin_reference");
    expect(ranked[0].candidatePriorityScore).toBeGreaterThan(ranked[ranked.length - 1].candidatePriorityScore);
  });

  it("reserves caption slots across clinical visual classes", () => {
    const ranked = rankVisualCandidates([
      { pageNumber: 1, sourceKind: "table_crop", metadata: { table_text: "dose route action" } },
      { pageNumber: 2, sourceKind: "page_region", metadata: { candidate_type: "flowchart" } },
      { pageNumber: 3, sourceKind: "page_region", metadata: { candidate_type: "risk matrix" } },
      { pageNumber: 4, sourceKind: "page_region", metadata: { candidate_type: "graph chart" } },
    ]);

    const selected = selectCaptionCandidateIndexes(ranked, 3, 1);

    expect(selected.size).toBe(3);
    expect([...selected]).toEqual(expect.arrayContaining([0, 1, 2]));
  });

  it("normalizes structured profile arrays, roles, duplicates, and confidence scores", () => {
    const profile = normalizeStructuredVisualProfile({
      clinical_purpose: "Dose threshold table",
      key_terms: ["ANC", "ANC", "FBC"],
      thresholds: [
        { label: "Red", value: "< 1.5", action: "Withhold clozapine", confidence: 2 },
        { label: "Red", value: "< 1.5", action: "Withhold clozapine", confidence: 0.8 },
      ],
      flowchart_nodes: [
        { id: "a", label: "Assess risk" },
        { id: "a", label: "Assess risk duplicate" },
      ],
      flowchart_edges: [{ from: "a", to: "b", label: "yes" }],
      risk_matrix_cells: [{ row: "High", column: "Severe", risk: "Red", action: "Escalate", confidence: -1 }],
      chart_findings: [{ label: "ANC falls", interpretation: "repeat FBC", confidence: 0.7 }],
      table_column_roles: { Dose: "dose", "Bad role": "unsupported" },
      confidence: 1.5,
    });

    expect(profile.key_terms).toEqual(["ANC", "FBC"]);
    expect(profile.thresholds).toHaveLength(1);
    expect(profile.thresholds[0].confidence).toBe(1);
    expect(profile.flowchart_nodes).toHaveLength(1);
    expect(profile.risk_matrix_cells[0].confidence).toBe(0);
    expect(profile.table_column_roles).toEqual({ Dose: "dose" });
    expect(profile.confidence).toBe(1);
  });
});
