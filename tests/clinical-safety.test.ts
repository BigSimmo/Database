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

const directRelevance = {
  verdict: "direct" as const,
  label: "Direct match",
  matchedTerms: ["urgent"],
  missingTerms: [],
  directSourceCount: 1,
  weakSourceCount: 0,
  score: 0.9,
  supportReason: "Direct indexed support found.",
  isSourceBacked: true,
};

const nearbyRelevance = {
  verdict: "nearby" as const,
  label: "Nearby only",
  matchedTerms: ["monitoring"],
  missingTerms: ["lithium"],
  directSourceCount: 0,
  weakSourceCount: 1,
  score: 0.32,
  supportReason: "Only nearby indexed passages were found.",
  isSourceBacked: false,
};

describe("clinical safety findings", () => {
  it("extracts only source-backed safety findings from grounded answers", () => {
    const findings = extractSafetyFindings(answer);

    expect(findings).toHaveLength(1);
    expect(findings[0].label).toBe("Red flag");
    expect(findings[0].text).toContain("Escalate for urgent review");
    expect(findings[0].text).not.toContain("Source mentions:");
    expect(findings[0].href).toBe("/documents/doc-1?page=1&chunk=chunk-1");
  });

  it("does not show safety findings for ungrounded answers", () => {
    expect(extractSafetyFindings({ ...answer, grounded: false })).toEqual([]);
  });

  it("suppresses generic safety findings when evidence is nearby only", () => {
    expect(extractSafetyFindings({ ...answer, relevance: nearbyRelevance })).toEqual([]);
  });

  it("keeps safety findings when relevance is source-backed", () => {
    const findings = extractSafetyFindings({
      ...answer,
      relevance: directRelevance,
      sources: answer.sources.map((source) => ({ ...source, source_strength: "moderate" })),
    });

    expect(findings).toHaveLength(1);
    expect(findings[0].label).toBe("Red flag");
  });

  it("does not leak internal image or table metadata in safety findings", () => {
    const findings = extractSafetyFindings({
      ...answer,
      quoteCards: [
        {
          chunk_id: "chunk-1",
          document_id: "doc-1",
          title: "Risk source",
          file_name: "risk.pdf",
          page_number: 1,
          chunk_index: 0,
          section_heading: null,
          quote:
            "[[IMAGE_DATA_START]] Image ID: img-1; Source kind: table_crop; Image type: clinical_table; Table role: clinical; Table text: | Dose | Route | [[IMAGE_DATA_END]] Monitor blood tests after dose changes.",
        },
      ],
      sources: [],
    });

    expect(findings[0].text).toContain("Monitor blood tests");
    expect(findings[0].text).not.toContain("[[IMAGE_DATA_START]]");
    expect(findings[0].text).not.toContain("Image ID:");
    expect(findings[0].text).not.toContain("Table text:");
  });

  it("removes provenance boilerplate from extracted finding text", () => {
    const findings = extractSafetyFindings({
      ...answer,
      quoteCards: [
        {
          chunk_id: "chunk-1",
          document_id: "doc-1",
          title: "Risk source",
          file_name: "risk.pdf",
          page_number: 1,
          chunk_index: 0,
          section_heading: null,
          quote:
            "Source mentions: Procedure PAE-PRO-0338/16 Page 5 of 5. Chunk index: 12. Monitor FBC weekly and escalate urgent toxicity symptoms.",
        },
      ],
      sources: [],
    });

    expect(findings).toHaveLength(1);
    expect(findings[0].text).toContain("Monitor FBC weekly");
    expect(findings[0].text).not.toMatch(/Source mentions|PAE-PRO-0338|Page 5 of 5|Chunk index/i);
  });
});
