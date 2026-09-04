import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchTelemetry } from "@/lib/rag/rag-contracts";
import type { SearchResult } from "@/lib/types";

/**
 * Audit L64: the RAG_TEXT_WEAK_OR_RELAXATION experiment flag is covered only at
 * the pure predicate (`shouldRelaxWeakTextMatches`). Neither state of the flag
 * was exercised at the integration point in `searchTextChunkCandidates`, so the
 * enabled merge/append path could rot silently while the flag is documented as
 * re-enableable.
 *
 * These cases pin the CURRENT behaviour in both states and change nothing: the
 * disabled state must fire one lexical RPC and report `text_or_relaxation_used:
 * "none"`, and the enabled state must append the OR-relaxed rows BEHIND the
 * strict matches (append-only — a precise match is never displaced) and report
 * "weak_augment". Retrieval ordering is asserted, not altered
 * (docs/rag-behaviour/safeguards.md).
 */
const flagState = vi.hoisted(() => ({ enabled: false }));

vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return {
    ...actual,
    env: new Proxy(actual.env as Record<string, unknown>, {
      get(target, key) {
        if (key === "RAG_TEXT_WEAK_OR_RELAXATION") return flagState.enabled;
        return Reflect.get(target, key);
      },
    }),
  };
});

const { searchTextChunkCandidates } = await import("@/lib/rag/rag-candidate-sources");

function row(id: string, overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id,
    document_id: "doc-1",
    title: "Clozapine monitoring",
    file_name: "clozapine.pdf",
    page_number: 2,
    chunk_index: 0,
    section_heading: null,
    content: "Withhold clozapine when the ANC falls below the stated threshold.",
    image_ids: [],
    images: [],
    source_metadata: null,
    similarity: 0.2,
    text_rank: 0.01,
    ...overrides,
  } as SearchResult;
}

type RpcCall = { name: string; args: Record<string, unknown> };

function emptyTelemetry(): SearchTelemetry {
  return {
    search_cache_hit: false,
    text_fast_path_latency_ms: 0,
    embedding_skipped: true,
    embedding_latency_ms: 0,
    embedding_cache_hit: false,
    supabase_rpc_latency_ms: 0,
    rerank_latency_ms: 0,
  } as SearchTelemetry;
}

// Two weak strict-AND matches: below the strong-hit bar and below the minimum
// result count, so shouldRelaxWeakTextMatches() is true and only the flag
// decides whether the OR-relaxed hop runs.
const strictRows = [row("chunk-strict-1"), row("chunk-strict-2")];
const relaxedRows = [row("chunk-relaxed-1", { text_rank: 0.004 })];

function stubSupabase(calls: RpcCall[]) {
  return {
    rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      const queryText = String(args.query_text ?? "");
      if (queryText.includes(" OR ")) return Promise.resolve({ data: relaxedRows, error: null });
      return Promise.resolve({ data: strictRows, error: null });
    },
  } as unknown as Parameters<typeof searchTextChunkCandidates>[0]["supabase"];
}

describe("RAG_TEXT_WEAK_OR_RELAXATION at the retrieval integration point", () => {
  beforeEach(() => {
    flagState.enabled = false;
  });

  afterEach(() => {
    flagState.enabled = false;
  });

  it("does not run the OR-relaxed hop when the flag is off (the shipped default)", async () => {
    const calls: RpcCall[] = [];
    const telemetry = emptyTelemetry();

    const results = await searchTextChunkCandidates({
      supabase: stubSupabase(calls),
      queryVariants: ["clozapine anc monitoring"],
      matchCount: 8,
      telemetry,
    });

    expect(calls).toHaveLength(1);
    expect(String(calls[0].args.query_text)).not.toContain(" OR ");
    expect(results.map((result) => result.id)).toEqual(["chunk-strict-1", "chunk-strict-2"]);
    expect(telemetry.text_or_relaxation_used).toBe("none");
  });

  it("appends OR-relaxed recall behind the strict matches when the flag is on", async () => {
    flagState.enabled = true;
    const calls: RpcCall[] = [];
    const telemetry = emptyTelemetry();

    const results = await searchTextChunkCandidates({
      supabase: stubSupabase(calls),
      queryVariants: ["clozapine anc monitoring"],
      matchCount: 8,
      telemetry,
    });

    expect(calls).toHaveLength(2);
    expect(String(calls[1].args.query_text)).toBe("clozapine OR anc OR monitoring");
    // Append-only: every strict match keeps its position, the relaxed row lands
    // behind them.
    expect(results.map((result) => result.id)).toEqual(["chunk-strict-1", "chunk-strict-2", "chunk-relaxed-1"]);
    expect(telemetry.text_or_relaxation_used).toBe("weak_augment");
  });
});
