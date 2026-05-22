import { describe, expect, it } from "vitest";
import { extractSafetyFindings } from "../src/lib/clinical-safety";
import type { RagAnswer } from "../src/lib/types";

const answer: RagAnswer = {
  answer: "Escalate review for urgent warning features.",
  grounded: true,
  confidence: "medium",
  citations: [],
  sources: [
    {
      id: "chunk-1",
      document_id: "doc-1",
      title: "Risk source",
      file_name: "risk.pdf",
      page_number: 1,
      chunk_index: 0,
      section_heading: "Escalation",
      content: "Escalate for urgent review when red flag features are present.",
      image_ids: [],
      similarity: 0.8,
      images: [],
    },
  ],
};

describe("clinical safety findings", () => {
  it("extracts only source-backed safety findings from grounded answers", () => {
    const findings = extractSafetyFindings(answer);

    expect(findings).toHaveLength(1);
    expect(findings[0].text).toContain("Source mentions:");
    expect(findings[0].href).toBe("/documents/doc-1?page=1&chunk=chunk-1");
  });

  it("does not show safety findings for ungrounded answers", () => {
    expect(extractSafetyFindings({ ...answer, grounded: false })).toEqual([]);
  });
});
