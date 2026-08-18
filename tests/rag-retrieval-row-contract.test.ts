import { describe, expect, it, vi } from "vitest";
import {
  RetrievalRowShapeError,
  assertEmbeddingFieldRows,
  assertIndexUnitRows,
  assertRetrievalRows,
  buildDocumentSummaryResults,
} from "@/lib/rag/rag-row-contracts";
import { searchEmbeddingFieldCandidates, searchIndexUnitCandidates } from "@/lib/rag/rag-candidate-sources";

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// A realistic `match_document_chunks_hybrid_v2` row. Column list mirrors the RPC's
// `returns table (...)` in supabase/migrations/20260713020000_owner_plus_public_retrieval.sql.
/** A row with one column dropped, standing in for an RPC whose shape has drifted. */
function withoutColumn(column: string, overrides: Record<string, unknown> = {}) {
  const row: Record<string, unknown> = hybridRow(overrides);
  delete row[column];
  return row;
}

function hybridRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "3f1a2b6c-1111-4aaa-8bbb-000000000001",
    document_id: "3f1a2b6c-2222-4aaa-8bbb-000000000002",
    title: "RANZCP Mood Disorders Guideline",
    file_name: "ranzcp-mood.pdf",
    page_number: 14,
    chunk_index: 7,
    section_heading: "Lithium monitoring",
    content: "Check serum lithium 5 days after any dose change.",
    retrieval_synopsis: null,
    image_ids: [],
    source_metadata: { document_status: "current" },
    similarity: 0.91,
    text_rank: 0.42,
    hybrid_score: 0.88,
    rrf_score: 0.031,
    images: [],
    ...overrides,
  };
}

describe("retrieval row shape contract", () => {
  it("accepts a realistic hybrid RPC row without mutating it", () => {
    const rows: unknown = [hybridRow()];
    const before = structuredClone(rows);
    const firstRowReference = (rows as unknown[])[0];

    expect(() => assertRetrievalRows(rows, "match_document_chunks_hybrid")).not.toThrow();

    // Assert, do not transform: ranking is a live-validated protected surface, so a valid
    // row must reach it byte-identical and by the same reference.
    expect(rows).toEqual(before);
    expect((rows as unknown[])[0]).toBe(firstRowReference);
  });

  it("builds valid document-summary rows outside the retrieval monolith", () => {
    const chunk = hybridRow({ title: "stale", file_name: "stale.pdf", similarity: 0.2 });

    const rows = buildDocumentSummaryResults([chunk], {
      title: "Current title",
      file_name: "current.pdf",
      metadata: { document_status: "current" },
    });

    expect(rows[0]).toMatchObject({
      id: chunk.id,
      title: "Current title",
      file_name: "current.pdf",
      similarity: 1,
      source_metadata: expect.objectContaining({ document_status: "current" }),
    });
  });

  // G1 governance pin (docs/clinical-hazard-analysis.md H5a; owner decision 2026-08-17).
  // The `similarity: 1` above is a constant, not a measured cosine — on this route the
  // document IS the query. Leaving it untagged is what let a fabricated 1.0 look identical
  // to a perfect vector match; the tag makes the provenance legible without changing the
  // confidence label (`deriveConfidence` excludes only "synthetic_text", pinned in
  // tests/rag-score.test.ts).
  it("tags the constant document-summary similarity with its own provenance value", () => {
    const rows = buildDocumentSummaryResults([hybridRow({ similarity: 0.2 }), hybridRow({ id: "second-chunk" })], {
      title: "Current title",
      file_name: "current.pdf",
      metadata: {},
    });

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.similarity).toBe(1);
      expect(row.similarity_origin).toBe("document_context");
      // Not "synthetic_text": that value caps confidence at "medium" (rejected Option A).
      expect(row.similarity_origin).not.toBe("synthetic_text");
    }
  });

  it("preserves unknown columns so an RPC version difference is not data loss", () => {
    const rows: unknown = [hybridRow({ document_labels: [{ id: "l1" }], a_future_column: 42 })];

    assertRetrievalRows(rows, "match_document_chunks_v2");

    expect(rows[0]).toMatchObject({ document_labels: [{ id: "l1" }], a_future_column: 42 });
  });

  it("rejects a numeric score returned as a string", () => {
    const rows: unknown = [hybridRow({ similarity: "0.91" })];

    expect(() => assertRetrievalRows(rows, "match_document_chunks_hybrid")).toThrow(RetrievalRowShapeError);
  });

  it("rejects a row missing its chunk identity", () => {
    const rows: unknown = [withoutColumn("id")];

    expect(() => assertRetrievalRows(rows, "match_document_chunks_hybrid")).toThrow(RetrievalRowShapeError);
    expect(() => assertRetrievalRows([hybridRow({ document_id: "" })], "x")).toThrow(RetrievalRowShapeError);
  });

  it("rejects malformed provenance and visual fields before they can miscite or crash rendering", () => {
    expect(() => assertRetrievalRows([withoutColumn("title")], "match_document_chunks_hybrid")).toThrow(
      RetrievalRowShapeError,
    );
    expect(() =>
      assertRetrievalRows([hybridRow({ image_ids: "not-an-array" })], "match_document_chunks_hybrid"),
    ).toThrow(RetrievalRowShapeError);
    expect(() => assertRetrievalRows([hybridRow({ images: [{}] })], "match_document_chunks_hybrid")).toThrow(
      RetrievalRowShapeError,
    );
  });

  it.each([
    ["array", [1, 2, 3]],
    ["string", "invalid-string-metadata"],
    ["number", 12345],
    ["boolean", true],
  ])("rejects non-object JSON structure for source_metadata (%s)", (_type, invalidMetadata) => {
    let thrown: RetrievalRowShapeError | null = null;
    try {
      assertRetrievalRows([hybridRow({ source_metadata: invalidMetadata })], "match_document_chunks_hybrid");
    } catch (error) {
      thrown = error as RetrievalRowShapeError;
    }
    expect(thrown).toBeInstanceOf(RetrievalRowShapeError);
    expect(thrown?.message).toContain("source_metadata");
  });

  it("accepts absent or null scores, which downstream already coalesces to 0", () => {
    expect(() => assertRetrievalRows([withoutColumn("text_rank")], "match_document_chunks")).not.toThrow();
    expect(() => assertRetrievalRows([hybridRow({ rrf_score: null })], "match_document_chunks")).not.toThrow();
    expect(() => assertRetrievalRows([hybridRow({ source_metadata: null })], "match_document_chunks")).not.toThrow();
    expect(() => assertRetrievalRows([], "match_document_chunks")).not.toThrow();
  });

  it("names the RPC and leaks no row content in the error", () => {
    const secret = "Check serum lithium 5 days after any dose change.";
    let thrown: RetrievalRowShapeError | null = null;
    try {
      assertRetrievalRows([hybridRow({ hybrid_score: "0.88" })], "match_document_chunks_hybrid");
    } catch (error) {
      thrown = error as RetrievalRowShapeError;
    }

    expect(thrown).toBeInstanceOf(RetrievalRowShapeError);
    expect(thrown?.rpc).toBe("match_document_chunks_hybrid");
    expect(thrown?.message).toContain("match_document_chunks_hybrid");
    expect(thrown?.message).toContain("hybrid_score");
    // Retrieval rows carry clinical document text; it must never reach a log or a response.
    expect(thrown?.message).not.toContain(secret);
    expect(thrown?.message).not.toContain("ranzcp-mood.pdf");
  });

  it("caps the reported issues so a wholesale shape change stays readable", () => {
    const rows = Array.from({ length: 20 }, () => hybridRow({ similarity: "nope" }));

    let thrown: RetrievalRowShapeError | null = null;
    try {
      assertRetrievalRows(rows, "match_document_chunks_hybrid");
    } catch (error) {
      thrown = error as RetrievalRowShapeError;
    }

    expect(thrown?.issues).toHaveLength(6);
    expect(thrown?.issues.at(-1)).toBe("and 15 more");
  });

  it("rejects a payload that is not an array of rows", () => {
    expect(() => assertRetrievalRows({ rows: [] }, "match_document_chunks_hybrid")).toThrow(RetrievalRowShapeError);
    expect(() => assertRetrievalRows(null, "match_document_chunks_hybrid")).toThrow(RetrievalRowShapeError);
  });
});

// Signal rows carry a chunk id plus scores; loadChunksForSignalMatches then loads the real
// chunk. Column lists mirror the RPCs' `returns table (...)` in
// supabase/migrations/20260713020000_owner_plus_public_retrieval.sql.
function embeddingFieldRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "9c1e0000-1111-4aaa-8bbb-000000000001",
    document_id: "9c1e0000-2222-4aaa-8bbb-000000000002",
    source_chunk_id: "9c1e0000-3333-4aaa-8bbb-000000000003",
    field_type: "section_context",
    content: "Monitoring schedule after a dose change.",
    similarity: 0.74,
    text_rank: 0.21,
    hybrid_score: 0.68,
    ...overrides,
  };
}

function indexUnitRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "4b2d0000-1111-4aaa-8bbb-000000000001",
    document_id: "4b2d0000-2222-4aaa-8bbb-000000000002",
    source_chunk_id: "4b2d0000-3333-4aaa-8bbb-000000000003",
    source_image_id: null,
    unit_type: "threshold",
    title: "Serum lithium target range",
    content: "0.6–0.8 mmol/L for maintenance.",
    page_start: 12,
    page_end: 12,
    heading_path: ["Monitoring", "Lithium"],
    normalized_terms: ["lithium", "serum level"],
    source_span: { start: 10, end: 240 },
    quality_score: 0.86,
    extraction_mode: "deterministic",
    metadata: { producer: "deterministic-v3" },
    similarity: 0.81,
    text_rank: 0.33,
    hybrid_score: 0.77,
    ...overrides,
  };
}

describe("signal row shape contracts", () => {
  it("accepts realistic embedding-field and index-unit rows without mutating them", () => {
    const fieldRows: unknown = [embeddingFieldRow()];
    const unitRows: unknown = [indexUnitRow()];
    const fieldsBefore = structuredClone(fieldRows);
    const unitsBefore = structuredClone(unitRows);

    assertEmbeddingFieldRows(fieldRows, "match_document_embedding_fields_hybrid");
    assertIndexUnitRows(unitRows, "match_document_index_units_hybrid");

    expect(fieldRows).toEqual(fieldsBefore);
    expect(unitRows).toEqual(unitsBefore);
  });

  it("rejects a stringified score, which Number() would otherwise coerce silently", () => {
    // `Number("0.74")` is 0.74 and `Number("high")` is NaN — neither fails today, and both
    // reach the ranking pool as a score nobody computed.
    expect(() =>
      assertEmbeddingFieldRows([embeddingFieldRow({ hybrid_score: "0.68" })], "match_document_embedding_fields_hybrid"),
    ).toThrow(RetrievalRowShapeError);
    expect(() =>
      assertIndexUnitRows([indexUnitRow({ similarity: "0.81" })], "match_document_index_units_hybrid"),
    ).toThrow(RetrievalRowShapeError);
  });

  it("rejects a signal row whose chunk pointer is the wrong type", () => {
    expect(() =>
      assertEmbeddingFieldRows([embeddingFieldRow({ source_chunk_id: 12 })], "match_document_embedding_fields_hybrid"),
    ).toThrow(RetrievalRowShapeError);
    expect(() => assertIndexUnitRows([indexUnitRow({ id: "" })], "match_document_index_units_hybrid")).toThrow(
      RetrievalRowShapeError,
    );
  });

  it("accepts a null chunk pointer, which the caller filters out itself", () => {
    expect(() =>
      assertEmbeddingFieldRows(
        [embeddingFieldRow({ source_chunk_id: null })],
        "match_document_embedding_fields_hybrid",
      ),
    ).not.toThrow();
    expect(() =>
      assertIndexUnitRows([indexUnitRow({ source_chunk_id: null })], "match_document_index_units_hybrid"),
    ).not.toThrow();
  });

  it("pins extraction_mode to the values its check constraint allows", () => {
    expect(() =>
      assertIndexUnitRows([indexUnitRow({ extraction_mode: "model_heavy" })], "match_document_index_units_hybrid"),
    ).not.toThrow();
    expect(() =>
      assertIndexUnitRows([indexUnitRow({ extraction_mode: "guessed" })], "match_document_index_units_hybrid"),
    ).toThrow(RetrievalRowShapeError);
  });

  it("tolerates null collection columns the caller already coalesces", () => {
    expect(() =>
      assertIndexUnitRows(
        [indexUnitRow({ heading_path: null, normalized_terms: null, source_span: null, metadata: null })],
        "match_document_index_units_hybrid",
      ),
    ).not.toThrow();
  });

  it("accepts array and scalar provenance from unconstrained jsonb columns", () => {
    expect(() =>
      assertIndexUnitRows(
        [indexUnitRow({ source_span: ["page", 12], metadata: "legacy-provenance" })],
        "match_document_index_units_hybrid",
      ),
    ).not.toThrow();
  });

  it("preserves unknown columns on signal rows too", () => {
    const rows: unknown = [indexUnitRow({ a_future_column: "kept" })];

    assertIndexUnitRows(rows, "match_document_index_units_hybrid");

    expect(rows[0]).toMatchObject({ a_future_column: "kept" });
  });

  it.each([
    ["embedding-field", "match_document_embedding_fields_hybrid_v2", searchEmbeddingFieldCandidates],
    ["index-unit", "match_document_index_units_hybrid_v2", searchIndexUnitCandidates],
  ])("degrades an invalid optional %s signal instead of rejecting the whole search", async (_layer, rpc, search) => {
    const supabase = {
      rpc: vi.fn(async () => ({ data: [embeddingFieldRow({ hybrid_score: "0.68" })], error: null })),
    };

    await expect(
      search({
        supabase: supabase as never,
        query: "lithium monitoring",
        queryEmbedding: [0.1, 0.2],
        matchCount: 8,
      }),
    ).resolves.toEqual([]);
    expect(supabase.rpc).toHaveBeenCalledWith(rpc, expect.any(Object));
  });
});
