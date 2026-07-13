import { afterEach, describe, expect, it, vi } from "vitest";
import type { SearchResult } from "../src/lib/types";

// PT-02: a question fans out to up to 3 near-duplicate lexical RPC calls per
// text surface. When the FIRST variant already returns a deep pool anchored by
// a precise hit, the sibling calls must be skipped; weak pools keep the full
// fan-out so recall is unchanged.

function retrievalRpcBaseName(name: string) {
  return name.replace(/_v[23]$/, "");
}

function chunk(id: number, textRank: number): SearchResult {
  return {
    id: `clozapine-chunk-${id}`,
    document_id: "clozapine-doc",
    title: "Clozapine Monitoring Protocol",
    file_name: "clozapine-monitoring.pdf",
    page_number: 1 + id,
    chunk_index: id,
    section_heading: "Monitoring",
    content: `Clozapine monitoring row ${id}: FBC weekly for 18 weeks, then monthly.`,
    image_ids: [],
    similarity: 0,
    hybrid_score: 0.4,
    text_rank: textRank,
    source_metadata: {
      source_title: "Clozapine source",
      publisher: "Local service",
      jurisdiction: "Australia/WA",
      version: "1",
      publication_date: null,
      review_date: null,
      uploaded_at: null,
      indexed_at: null,
      uploaded_by: null,
      document_status: "current",
      clinical_validation_status: "approved",
      extraction_quality: "good",
    },
    images: [],
  };
}

class EmptyQuery implements PromiseLike<{ data: unknown[]; error: null }> {
  select() {
    return this;
  }

  in() {
    return this;
  }

  eq() {
    return this;
  }

  neq() {
    return this;
  }

  order() {
    return this;
  }

  limit() {
    return Promise.resolve({ data: [], error: null });
  }

  then<TResult1 = { data: unknown[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: [], error: null }).then(onfulfilled, onrejected);
  }
}

// Multi-variant clinical query: alias/threshold expansion produces sibling variants.
const multiVariantQuery = "clozapine anc monitoring";

async function runLexicalSearch(chunkResults: SearchResult[]) {
  vi.stubEnv("RAG_SEARCH_CACHE_TTL_MS", "0");
  vi.stubEnv("RAG_ANSWER_CACHE_TTL_MS", "0");

  const rpc = vi.fn(async (name: string) => {
    if (retrievalRpcBaseName(name) === "match_document_chunks_text") return { data: chunkResults, error: null };
    return { data: [], error: null };
  });
  vi.doMock("@/lib/supabase/admin", () => ({
    createAdminClient: () => ({
      rpc,
      from: vi.fn(() => new EmptyQuery()),
    }),
  }));

  const { searchChunksWithTelemetry } = await import("@/lib/rag");
  const result = await searchChunksWithTelemetry({
    query: multiVariantQuery,
    ownerId: "owner-1",
    topK: 8,
    lexicalOnly: true,
  });
  const chunkTextCalls = rpc.mock.calls.filter(
    ([name]) => retrievalRpcBaseName(name as string) === "match_document_chunks_text",
  );
  return { chunkTextCalls, telemetry: result.telemetry };
}

afterEach(() => {
  vi.doUnmock("@/lib/supabase/admin");
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("lexical variant early-exit (PT-02)", () => {
  it("a deep, precisely-anchored first pool issues exactly one chunk-text RPC", async () => {
    // Deep (48-row) pool with a precise top hit: sibling variants are pure duplication.
    const strongPool = Array.from({ length: 48 }, (_, index) => chunk(index, index === 0 ? 0.9 : 0.2));
    const { chunkTextCalls, telemetry } = await runLexicalSearch(strongPool);
    // Guard: the fixture query must actually produce sibling variants for the
    // skip to be meaningful.
    expect(telemetry.retrieval_query_variant_count ?? 1).toBeGreaterThan(1);
    expect(chunkTextCalls).toHaveLength(1);
    expect(telemetry.text_variant_early_exit).toBe(true);
    expect(telemetry.text_variant_rpc_calls?.match_document_chunks_text).toBe(1);
  });

  it("a weak first pool keeps the full sibling fan-out", async () => {
    // Sparse middling pool: recall rescue must still fire every variant. The
    // weak-OR augmentation may add one more call on top of the variant set.
    const weakPool = [chunk(0, 0.12), chunk(1, 0.08)];
    const { chunkTextCalls, telemetry } = await runLexicalSearch(weakPool);
    const expectedVariantCalls = Math.min(telemetry.retrieval_query_variant_count ?? 1, 3);
    expect(expectedVariantCalls).toBeGreaterThan(1);
    expect(chunkTextCalls.length).toBeGreaterThanOrEqual(expectedVariantCalls);
    expect(telemetry.text_variant_early_exit).toBeUndefined();
    expect(telemetry.text_variant_rpc_calls?.match_document_chunks_text).toBe(expectedVariantCalls);
  });
});
