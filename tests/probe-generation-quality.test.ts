import { describe, expect, it } from "vitest";
import { formatAnswerSection, formatCitations, selfTest } from "../scripts/probe-generation-quality";
import type { Citation } from "../src/lib/types";

describe("probe-generation-quality (#E0N0QC)", () => {
  it("runs offline selfTest without throwing", () => {
    expect(() => selfTest()).not.toThrow();
  });

  it("formats citations with page, chunk, title, and provenance", () => {
    const citations: Citation[] = [
      {
        chunk_id: "c1",
        document_id: "d1",
        title: "Lithium Toxicity & Dosing Guide",
        file_name: "lithium_guideline.pdf",
        page_number: 12,
        chunk_index: 3,
        provenance: "model_selected",
      },
      {
        chunk_id: "c2",
        document_id: "d2",
        title: "Emergency Medicine Handbook",
        file_name: "emergency_handbook.pdf",
        page_number: null,
        chunk_index: 0,
        provenance: "deterministic_support",
      },
    ];

    const formatted = formatCitations(citations);
    expect(formatted).toHaveLength(2);
    expect(formatted[0]).toBe('  [1] lithium_guideline.pdf p12 c3 "Lithium Toxicity & Dosing Guide" [model_selected]');
    expect(formatted[1]).toBe('  [2] emergency_handbook.pdf c0 "Emergency Medicine Handbook" [deterministic_support]');
  });

  it("formats empty citations cleanly", () => {
    expect(formatCitations([])).toEqual(["(no citations)"]);
  });

  it("formats answer section containing answer text and citations", () => {
    const citations: Citation[] = [
      {
        chunk_id: "c1",
        document_id: "d1",
        title: "Guideline",
        file_name: "guideline.pdf",
        page_number: 1,
        chunk_index: 0,
      },
    ];

    const output = formatAnswerSection("Standard initial dose is 400mg daily.", citations);
    expect(output).toContain("--- answer text (requested with --show-answer) ---");
    expect(output).toContain("Standard initial dose is 400mg daily.");
    expect(output).toContain("--- citations ---");
    expect(output).toContain('  [1] guideline.pdf p1 c0 "Guideline"');
  });
});
