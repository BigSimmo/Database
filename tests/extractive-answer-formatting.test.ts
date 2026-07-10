import { describe, expect, it } from "vitest";
import {
  buildExtractiveAnswer,
  sentenceFromFact,
  splitClinicalEvidenceSentences,
} from "../src/lib/rag-extractive-answer";
import type { RagAnswer, SearchResult } from "../src/lib/types";

// Regression for the live source-only answer that rendered as:
// "For lithium, twice daily dosing should be spaced by 12 hours. The guidance
// is that for lithium, acute Mania: o IR product: 750 to 1000mg daily in 2 or
// 3 divided doses or as a single dose at night."
// — a literal Word/PDF sub-bullet "o" glyph in the answer body, the section
// heading glued mid-sentence, and the query entity stitched in twice.
describe("extractive evidence splitting", () => {
  const lithiumPassage =
    "Twice daily dosing should be spaced by 12 hours. Acute Mania: o IR product: 750 to 1000mg daily in 2 or 3 divided doses or as a single dose at night.";

  it("treats the sub-bullet 'o' glyph as a fact boundary instead of leaving it mid-sentence", () => {
    const sentences = splitClinicalEvidenceSentences(lithiumPassage);
    expect(sentences.length).toBeGreaterThan(0);
    for (const sentence of sentences) {
      expect(sentence).not.toMatch(/\bo\s+[A-Z]/);
      expect(sentence).not.toContain("Mania: o");
    }
  });

  it("keeps the indication heading as context on the dose fact instead of dropping it", () => {
    const sentences = splitClinicalEvidenceSentences(lithiumPassage);
    const doseFact = sentences.find((sentence) => sentence.includes("750 to 1000mg"));
    expect(doseFact).toBeDefined();
    expect(doseFact).toMatch(/acute mania/i);
  });

  it("rewrites a leading heading colon into readable context", () => {
    const sentences = splitClinicalEvidenceSentences(
      "Renal Impairment: o Reduce the maintenance dose and monitor levels closely.",
    );
    expect(sentences.some((sentence) => /^For renal impairment,/i.test(sentence))).toBe(true);
  });
});

describe("extractive sentence stitching", () => {
  it("never duplicates the query entity across the prefix and the guidance wrapper", () => {
    const sentence = sentenceFromFact(
      {
        kind: "dose",
        text: "twice daily dosing should be spaced by 12 hours",
        citationChunkIds: ["chunk-1"],
        priority: 1,
      },
      "lithium dosing",
    );
    expect(sentence).toBeTruthy();
    expect(sentence).not.toMatch(/that for lithium/i);
    expect((sentence.match(/lithium/gi) ?? []).length).toBeLessThanOrEqual(1);
  });

  it("does not prefix the entity when the fact already names it", () => {
    const sentence = sentenceFromFact(
      {
        kind: "monitoring",
        text: "lithium levels should be checked 5 to 7 days after any dose change",
        citationChunkIds: ["chunk-1"],
        priority: 1,
      },
      "lithium monitoring",
    );
    expect(sentence).toBeTruthy();
    expect((sentence.match(/lithium/gi) ?? []).length).toBe(1);
  });

  it("suppresses the entity prefix when asked so lead answers do not repeat it", () => {
    const sentence = sentenceFromFact(
      {
        kind: "dose",
        text: "twice daily dosing should be spaced by 12 hours",
        citationChunkIds: ["chunk-1"],
        priority: 1,
      },
      "lithium dosing",
      { suppressEntityPrefix: true },
    );
    expect(sentence).toBeTruthy();
    expect(sentence).not.toMatch(/lithium/i);
  });
});

describe("extractive answer end to end", () => {
  it("renders the lithium source-only case cleanly through buildExtractiveAnswer", () => {
    const result = {
      id: "lithium-chunk-1",
      document_id: "lithium-doc",
      title: "Lithium Therapy Guideline",
      file_name: "Lithium Therapy Guideline.pdf",
      page_number: 3,
      chunk_index: 2,
      section_heading: "Dosing",
      content:
        "Twice daily dosing should be spaced by 12 hours. Acute Mania: o IR product: 750 to 1000mg daily in 2 or 3 divided doses or as a single dose at night.",
      image_ids: [],
      similarity: 0.88,
      hybrid_score: 0.93,
      images: [],
    } as unknown as SearchResult;

    const answer = buildExtractiveAnswer({
      query: "lithium dosing",
      queryClass: "medication_dose_risk",
      results: [result],
      quoteCards: [],
      documentBreakdown: [] as RagAnswer["documentBreakdown"],
      evidenceSummary: undefined as unknown as RagAnswer["evidenceSummary"],
      sourceCoverage: undefined as unknown as RagAnswer["sourceCoverage"],
      conflictsOrGaps: [],
      visualEvidence: [] as unknown as RagAnswer["visualEvidence"],
      bestSource: undefined as unknown as RagAnswer["bestSource"],
      smartPanel: undefined as unknown as RagAnswer["smartPanel"],
      relatedDocuments: [] as unknown as RagAnswer["relatedDocuments"],
      routeReason: "demo",
      timings: undefined as unknown as RagAnswer["latencyTimings"],
    });

    const plain = (answer.answer ?? "").replace(/\*\*/g, "");
    expect(plain).not.toMatch(/\bo\s+[A-Z]/);
    expect(plain).not.toMatch(/that for lithium/i);
    expect(plain).toMatch(/^For lithium, twice daily dosing should be spaced by 12 hours\./);
    expect(plain).toMatch(/For acute mania, IR product is 750 to 1000mg daily/);
  });
});
