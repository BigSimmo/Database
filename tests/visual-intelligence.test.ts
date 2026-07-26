import { describe, expect, it } from "vitest";
import {
  rankVisualCandidates,
  selectCaptionCandidateIndexes,
  deterministicStructuredVisualProfile,
  normalizeStructuredVisualProfile,
  type RankedVisualCandidate,
} from "../src/lib/visual-intelligence";

describe("visual-intelligence", () => {
  it("scores and ranks visual candidates correctly", () => {
    const images = [
      {
        id: "admin-img",
        pageNumber: 1,
        sourceKind: "page_region",
        metadata: { candidate_type: "text" },
        nearbyText: "version control effective date 2023",
      },
      {
        id: "clinical-table",
        pageNumber: 2,
        sourceKind: "table_crop",
        metadata: { candidate_type: "table" },
        nearbyText: "monitor clozapine dose carefully",
        tableText: "dose | mg | route",
      },
    ];

    const ranked = rankVisualCandidates(images);

    // Clinical table should rank higher than admin image
    expect(ranked[0].id).toBe("clinical-table");
    expect(ranked[1].id).toBe("admin-img");
    expect(ranked[0].candidatePriorityScore).toBeGreaterThan(ranked[1].candidatePriorityScore);
    expect(ranked[0].captionBudgetClass).toBe("clinical_table");
  });

  it("selects best caption candidate indexes within budget", () => {
    const ranked = [
      {
        originalIndex: 2,
        captionBudgetClass: "clinical_table",
        duplicateGroup: "group1",
        pageNumber: 1,
      } as unknown as RankedVisualCandidate,
      {
        originalIndex: 1,
        captionBudgetClass: "flowchart",
        duplicateGroup: "group2",
        pageNumber: 2,
      } as unknown as RankedVisualCandidate,
      {
        originalIndex: 3,
        captionBudgetClass: "admin_reference",
        duplicateGroup: "group3",
        pageNumber: 3,
      } as unknown as RankedVisualCandidate,
      {
        originalIndex: 4,
        captionBudgetClass: "clinical_table",
        duplicateGroup: "group1",
        pageNumber: 4,
      } as unknown as RankedVisualCandidate, // duplicate group
    ];

    const selected = selectCaptionCandidateIndexes(ranked, 5, 2);

    expect(selected.has(2)).toBe(true);
    expect(selected.has(1)).toBe(true);
    // Should skip admin reference
    expect(selected.has(3)).toBe(false);
    // Should skip duplicate group
    expect(selected.has(4)).toBe(false);
  });

  it("normalizes structured visual profile correctly", () => {
    const normalized = normalizeStructuredVisualProfile({
      clinical_purpose: "Risk management",
      table_column_roles: [{ column: "medication", role: "medication" }],
      thresholds: [{ label: "Heart Rate", value: "> 100", action: "Review" }],
      flowchart_nodes: [{ label: "Start", id: "node1" }],
    });

    expect(normalized.clinical_purpose).toBe("Risk management");
    expect(normalized.table_column_roles).toHaveProperty("medication");
    expect(normalized.thresholds.length).toBe(1);
    expect(normalized.thresholds[0].label).toBe("Heart Rate");
  });

  it("generates deterministic structured visual profile", () => {
    const profile = deterministicStructuredVisualProfile({
      tableTitle: "Lithium monitoring",
      tableColumns: ["Parameter", "Target level"],
      tableRows: [["Lithium level", "0.6 - 0.8 mmol/L", "monitor"]],
    });

    expect(profile.medications).toContain("lithium");
    expect(profile.thresholds.length).toBe(1);
    expect(profile.thresholds[0].label).toBe("Lithium level");
    expect(profile.actions).toContain("monitor");
  });
});
