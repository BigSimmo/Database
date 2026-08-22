import { describe, expect, it, vi } from "vitest";
import {
  ApiRowShapeError,
  assertDocumentChunkSearchRpcRows,
  assertDocumentChunkSearchTableRows,
  assertDocumentLabelRows,
  assertSearchSchemaHealth,
} from "@/lib/validation/row-contracts";

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/**
 * A realistic `search_document_chunks` row. The column list mirrors that function's
 * `returns table (...)` in supabase/schema.sql — eight columns, with neither `metadata`
 * nor `index_generation_id`, because the committed-generation filter lives in the SQL body.
 */
function rpcRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "3f1a2b6c-1111-4aaa-8bbb-000000000001",
    page_number: 14,
    chunk_index: 7,
    section_heading: "Lithium monitoring",
    content: "Check serum lithium 5 days after any dose change.",
    image_ids: [],
    text_rank: 0.42,
    trigram_score: 0.31,
    ...overrides,
  };
}

/** The table-fallback shape: the RPC columns plus the two the fallback selects explicitly. */
function tableRow(overrides: Record<string, unknown> = {}) {
  return {
    ...rpcRow(),
    metadata: { index_generation_id: "9c2f0d10-3333-4aaa-8bbb-000000000003" },
    index_generation_id: "9c2f0d10-3333-4aaa-8bbb-000000000003",
    ...overrides,
  };
}

function labelRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "7d5e1a90-4444-4aaa-8bbb-000000000004",
    document_id: "3f1a2b6c-2222-4aaa-8bbb-000000000002",
    owner_id: "0b6c9e21-5555-4aaa-8bbb-000000000005",
    label: "lithium",
    label_type: "medication",
    source: "generated",
    confidence: 0.82,
    metadata: {},
    created_at: "2026-08-15T00:00:00.000Z",
    updated_at: "2026-08-15T00:00:00.000Z",
    ...overrides,
  };
}

function healthPayload(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    missing: [],
    vector_extension_schema: "extensions",
    legacy_ivfflat_indexes: [],
    deferred_hnsw_indexes: [],
    checked_at: "2026-08-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("document chunk search RPC contract", () => {
  it("accepts a realistic RPC row without mutating it", () => {
    const rows: unknown = [rpcRow()];
    const before = structuredClone(rows);
    const firstRowReference = (rows as unknown[])[0];

    expect(() => assertDocumentChunkSearchRpcRows(rows)).not.toThrow();

    // Assert, do not transform: the caller scores and orders these rows, so a valid row must
    // reach `scoreChunk` by the same reference and with its key order unchanged.
    expect(rows).toEqual(before);
    expect((rows as unknown[])[0]).toBe(firstRowReference);
    expect(Object.keys((rows as Record<string, unknown>[])[0])).toEqual(Object.keys(rpcRow()));
  });

  it("preserves unknown columns rather than stripping them", () => {
    // z.looseObject, not z.object: the live column set may run ahead of this repo, and
    // dropping a column the caller has not read yet would be silent data loss.
    const rows: unknown = [rpcRow({ retrieval_synopsis: "Lithium dosing summary." })];
    assertDocumentChunkSearchRpcRows(rows);
    expect((rows as Record<string, unknown>[])[0].retrieval_synopsis).toBe("Lithium dosing summary.");
  });

  it("accepts an empty result set", () => {
    expect(() => assertDocumentChunkSearchRpcRows([])).not.toThrow();
  });

  it("accepts null and absent scores, which the caller already coerces with ?? 0", () => {
    expect(() => assertDocumentChunkSearchRpcRows([rpcRow({ text_rank: null })])).not.toThrow();
    const withoutTrigram: Record<string, unknown> = rpcRow();
    delete withoutTrigram.trigram_score;
    expect(() => assertDocumentChunkSearchRpcRows([withoutTrigram])).not.toThrow();
  });

  it("rejects a stringified score, the silent-misordering case", () => {
    // `scoreChunk` does Number(row.text_rank ?? 0), so a string becomes a different score
    // rather than an error — this is the failure the contract exists to surface.
    expect(() => assertDocumentChunkSearchRpcRows([rpcRow({ text_rank: "0.42" })])).toThrow(ApiRowShapeError);
  });

  it("rejects a row missing a column the caller reads", () => {
    const missingContent: Record<string, unknown> = rpcRow();
    delete missingContent.content;
    expect(() => assertDocumentChunkSearchRpcRows([missingContent])).toThrow(ApiRowShapeError);
  });

  it("accepts nullable page_number and section_heading, which are nullable columns", () => {
    expect(() =>
      assertDocumentChunkSearchRpcRows([rpcRow({ page_number: null, section_heading: null })]),
    ).not.toThrow();
  });

  it("reports only Zod issue paths, never row content", () => {
    // These rows carry clinical document text; an error message that echoed one would leak
    // source content past the boundary query-privacy.ts maintains.
    const secret = "Check serum lithium 5 days after any dose change.";
    try {
      assertDocumentChunkSearchRpcRows([rpcRow({ chunk_index: "seven" })]);
      throw new Error("expected the contract to reject this row");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiRowShapeError);
      const message = (error as ApiRowShapeError).message;
      expect(message).toContain("chunk_index");
      expect(message).not.toContain(secret);
      expect(message).not.toContain("seven");
    }
  });

  it("rejects a non-array payload", () => {
    expect(() => assertDocumentChunkSearchRpcRows(rpcRow())).toThrow(ApiRowShapeError);
  });
});

describe("document chunk table fallback contract", () => {
  it("accepts the fallback row shape, which adds generation columns", () => {
    const rows: unknown = [tableRow()];
    const before = structuredClone(rows);
    expect(() => assertDocumentChunkSearchTableRows(rows)).not.toThrow();
    expect(rows).toEqual(before);
  });

  it("accepts any JSON type in metadata, which carries no jsonb_typeof check", () => {
    // documents/document_chunks metadata is bare `jsonb not null`, so pinning it to an object
    // would be a claim the schema does not back. The caller passes it to
    // committedIndexGeneration, which already accepts unknown.
    expect(() => assertDocumentChunkSearchTableRows([tableRow({ metadata: [] })])).not.toThrow();
    expect(() => assertDocumentChunkSearchTableRows([tableRow({ metadata: "generation-1" })])).not.toThrow();
  });

  it("accepts a null index_generation_id, which is a nullable column", () => {
    expect(() => assertDocumentChunkSearchTableRows([tableRow({ index_generation_id: null })])).not.toThrow();
  });

  it("rejects a non-string index_generation_id, which would break the generation filter", () => {
    expect(() => assertDocumentChunkSearchTableRows([tableRow({ index_generation_id: 7 })])).toThrow(ApiRowShapeError);
  });
});

describe("document label contract", () => {
  it("accepts a realistic label row without mutating it", () => {
    const rows: unknown = [labelRow()];
    const before = structuredClone(rows);
    const firstRowReference = (rows as unknown[])[0];

    expect(() => assertDocumentLabelRows(rows)).not.toThrow();

    expect(rows).toEqual(before);
    expect((rows as unknown[])[0]).toBe(firstRowReference);
  });

  it("accepts every label_type the database check constraint permits", () => {
    // The enum mirrors document_labels' check constraint in supabase/schema.sql exactly, so
    // it cannot reject a row the database would accept today.
    const permitted = [
      "site",
      "topic",
      "document_type",
      "medication",
      "risk",
      "setting",
      "workflow",
      "population",
      "service",
      "clinical_action",
      "care_phase",
      "document_intent",
      "content_feature",
      "custom",
    ];
    for (const label_type of permitted) {
      expect(() => assertDocumentLabelRows([labelRow({ label_type })])).not.toThrow();
    }
  });

  it("rejects a label_type outside the check constraint", () => {
    // The previous `as DocumentLabel[]` cast narrowed a plain `text` column to a TS union with
    // nothing checking it, so an out-of-union value reached the clinical badge surfaces.
    expect(() => assertDocumentLabelRows([labelRow({ label_type: "diagnosis" })])).toThrow(ApiRowShapeError);
  });

  it("rejects a source outside ('generated', 'manual')", () => {
    expect(() => assertDocumentLabelRows([labelRow({ source: "imported" })])).toThrow(ApiRowShapeError);
  });

  it("rejects a confidence outside the 0..1 check constraint", () => {
    expect(() => assertDocumentLabelRows([labelRow({ confidence: 1.4 })])).toThrow(ApiRowShapeError);
    expect(() => assertDocumentLabelRows([labelRow({ confidence: -0.1 })])).toThrow(ApiRowShapeError);
  });

  it("accepts a null owner_id, which is a nullable column", () => {
    expect(() => assertDocumentLabelRows([labelRow({ owner_id: null })])).not.toThrow();
  });

  it("leaves metadata unpinned, since the column carries no jsonb_typeof check", () => {
    expect(() => assertDocumentLabelRows([labelRow({ metadata: [] })])).not.toThrow();
  });

  it("never reports the label value in an error", () => {
    try {
      assertDocumentLabelRows([labelRow({ label: "clozapine-titration", confidence: "high" })]);
      throw new Error("expected the contract to reject this row");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiRowShapeError);
      expect((error as ApiRowShapeError).message).not.toContain("clozapine-titration");
    }
  });
});

describe("search_schema_health contract", () => {
  it("accepts the payload jsonb_build_object always emits", () => {
    const payload: unknown = healthPayload();
    const before = structuredClone(payload);
    expect(() => assertSearchSchemaHealth(payload)).not.toThrow();
    expect(payload).toEqual(before);
  });

  it("accepts a null vector_extension_schema, which is a nullable local", () => {
    expect(() => assertSearchSchemaHealth(healthPayload({ vector_extension_schema: null }))).not.toThrow();
  });

  it("accepts an unhealthy payload listing missing items", () => {
    expect(() =>
      assertSearchSchemaHealth(healthPayload({ ok: false, missing: ["documents_title_trgm_idx"] })),
    ).not.toThrow();
  });

  it("rejects an empty object, which the previous cast accepted silently", () => {
    // `(data ?? {}) as SearchSchemaHealth` made every field optional, so an empty payload
    // reported "Missing or stale search schema items: unknown." with no signal about why.
    expect(() => assertSearchSchemaHealth({})).toThrow(ApiRowShapeError);
  });

  it("rejects a non-array missing field", () => {
    expect(() => assertSearchSchemaHealth(healthPayload({ missing: "documents_title_trgm_idx" }))).toThrow(
      ApiRowShapeError,
    );
  });

  it("preserves keys the route does not read", () => {
    const payload: unknown = healthPayload();
    assertSearchSchemaHealth(payload);
    expect((payload as Record<string, unknown>).legacy_ivfflat_indexes).toEqual([]);
  });
});
