import { describe, expect, it } from "vitest";
import {
  clientAnswerFieldsSchema,
  clientAnswerSectionSchema,
  clientDocumentLabelSchema,
} from "@/lib/answer-client-fields";

const section = { heading: "Heading", body: "Body", citation_chunk_ids: ["chunk-1"] };
const coverage = { documents_used: 0, pages: [0, 1_000_000], strongest_similarity: 0.5, has_images: false };
const visual = {
  id: "image-1",
  image_id: "image-1",
  signed_url_endpoint: "/images/image-1",
  caption: "Caption",
  document_id: "doc-1",
  title: "Title",
  file_name: "source.pdf",
  page_number: null,
  source_chunk_id: "chunk-1",
  chunk_index: 0,
  viewer_href: "/documents/doc-1",
};

describe("client answer schema boundary", () => {
  it("exposes the public field shape and strips unknown keys at every object depth", () => {
    expect(Object.keys(clientAnswerFieldsSchema.shape)).toContain("answerSections");
    expect(Object.keys(clientAnswerFieldsSchema.shape)).not.toContain("owner_id");
    expect(
      clientAnswerFieldsSchema.parse({
        owner_id: "private-root",
        answerSections: [{ ...section, owner_id: "private-section" }],
        sourceCoverage: { ...coverage, owner_id: "private-coverage" },
        comparisonMatrix: {
          owner_id: "private-matrix",
          documents: [{ documentId: "doc-1", title: "Title", fileName: "source.pdf", owner_id: "private-doc" }],
          rows: [],
        },
      }),
    ).toEqual({
      answerSections: [section],
      sourceCoverage: coverage,
      comparisonMatrix: { documents: [{ documentId: "doc-1", title: "Title", fileName: "source.pdf" }], rows: [] },
    });
  });

  it.each([NaN, Infinity, -Infinity, "0.5"])("rejects non-finite or non-numeric scores: %s", (score) => {
    expect(
      clientAnswerFieldsSchema.safeParse({ sourceCoverage: { ...coverage, strongest_similarity: score } }).success,
    ).toBe(false);
    expect(
      clientAnswerFieldsSchema.safeParse({ visualEvidence: [{ ...visual, clinical_relevance_score: score }] }).success,
    ).toBe(false);
  });

  it.each([-1, 0.5, 1_000_001, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, "1"])(
    "rejects invalid counts both directly and in page collections: %s",
    (count) => {
      expect(
        clientAnswerFieldsSchema.safeParse({ sourceCoverage: { ...coverage, documents_used: count } }).success,
      ).toBe(false);
      expect(clientAnswerFieldsSchema.safeParse({ sourceCoverage: { ...coverage, pages: [count] } }).success).toBe(
        false,
      );
    },
  );

  it("accepts exact string and collection bounds and rejects overflow or empty identifiers", () => {
    const bounded = {
      heading: "h".repeat(1_000),
      body: "b".repeat(16_000),
      citation_chunk_ids: Array(100).fill("i".repeat(500)),
    };
    expect(clientAnswerSectionSchema.safeParse(bounded).success).toBe(true);
    for (const extra of [
      { heading: "h".repeat(1_001) },
      { body: "b".repeat(16_001) },
      { citation_chunk_ids: [""] },
      { citation_chunk_ids: ["i".repeat(501)] },
      { citation_chunk_ids: Array(101).fill("chunk-1") },
      { kind: "invented" },
      { supportLevel: null },
    ]) {
      expect(clientAnswerSectionSchema.safeParse({ ...bounded, ...extra }).success).toBe(false);
    }
    expect(clientAnswerFieldsSchema.safeParse({ answerSections: Array(100).fill(section) }).success).toBe(true);
    expect(clientAnswerFieldsSchema.safeParse({ answerSections: Array(101).fill(section) }).success).toBe(false);
    expect(
      clientAnswerFieldsSchema.safeParse({ sourceCoverage: { ...coverage, pages: Array(200).fill(0) } }).success,
    ).toBe(true);
    expect(
      clientAnswerFieldsSchema.safeParse({ sourceCoverage: { ...coverage, pages: Array(201).fill(0) } }).success,
    ).toBe(false);
  });

  it("preserves optional versus nullable fields and bounds nested table rows and columns", () => {
    for (const extra of [
      {},
      { tableRows: undefined },
      { tableRows: null, tableColumns: null },
      { tableRows: Array.from({ length: 200 }, () => Array(50).fill("Cell")) },
    ]) {
      expect(clientAnswerFieldsSchema.safeParse({ visualEvidence: [{ ...visual, ...extra }] }).success).toBe(true);
    }
    for (const extra of [
      { tableRows: Array(201).fill([]) },
      { tableRows: [Array(51).fill("Cell")] },
      { tableRows: [["c".repeat(1_001)]] },
      { tableColumns: Array(51).fill("Column") },
      { signed_url_endpoint: "u".repeat(2_001) },
      { image_type: null },
      { page_number: undefined },
    ]) {
      expect(clientAnswerFieldsSchema.safeParse({ visualEvidence: [{ ...visual, ...extra }] }).success).toBe(false);
    }
    expect(clientAnswerFieldsSchema.safeParse({ routingMode: null }).success).toBe(false);
    expect(clientAnswerFieldsSchema.safeParse({}).success).toBe(true);
  });

  it("retains label confidence limits and strips private label metadata", () => {
    const label = { label: "Topic", label_type: "topic", source: "manual", confidence: 0 };
    expect(clientDocumentLabelSchema.parse({ ...label, owner_id: "private" })).toEqual(label);
    expect(clientDocumentLabelSchema.safeParse({ ...label, confidence: 1 }).success).toBe(true);
    for (const confidence of [-0.01, 1.01, NaN, Infinity, -Infinity, "1"]) {
      expect(clientDocumentLabelSchema.safeParse({ ...label, confidence }).success).toBe(false);
    }
  });
});
