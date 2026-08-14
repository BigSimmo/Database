import { describe, expect, it, vi } from "vitest";
import { RetrievalRowShapeError, assertRetrievalRows, buildDocumentSummaryResults } from "@/lib/rag/rag-row-contracts";

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

  it("accepts absent or null scores, which downstream already coalesces to 0", () => {
    expect(() => assertRetrievalRows([withoutColumn("text_rank")], "match_document_chunks")).not.toThrow();
    expect(() => assertRetrievalRows([hybridRow({ rrf_score: null })], "match_document_chunks")).not.toThrow();
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
