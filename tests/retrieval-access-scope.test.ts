import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

const root = process.cwd();
const optimizedRetrievalMigration = readFileSync(
  join(root, "supabase/migrations/20260717160000_optimize_owner_public_retrieval.sql"),
  "utf8",
);
const canonicalSchema = readFileSync(join(root, "supabase/schema.sql"), "utf8");

function between(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe("owner-plus-public retrieval contract", () => {
  it("threads the canonical access scope through cache and retrieval contracts", () => {
    const contracts = readFileSync(join(root, "src/lib/rag-contracts.ts"), "utf8");
    const cache = readFileSync(join(root, "src/lib/rag-cache.ts"), "utf8");
    expect(contracts).toContain("accessScope?: RetrievalAccessScope");
    expect(cache).toContain("retrievalAccessScopeKey(retrievalAccessScopeForArgs(args))");
    expect(cache).toContain("owner_id.is.null");
  });

  it("keeps answer cache namespaces distinct across public and owner-plus-public scopes", async () => {
    const { scopedAnswerCacheKey } = await import("../src/lib/rag-cache");
    const base = { query: "monitoring" };
    const publicKey = scopedAnswerCacheKey({ ...base, accessScope: { includePublic: true } });
    const ownerAKey = scopedAnswerCacheKey({
      ...base,
      ownerId: "owner-a",
      accessScope: { ownerId: "owner-a", includePublic: true },
    });
    const ownerBKey = scopedAnswerCacheKey({
      ...base,
      ownerId: "owner-b",
      accessScope: { ownerId: "owner-b", includePublic: true },
    });
    expect(new Set([publicKey, ownerAKey, ownerBKey]).size).toBe(3);
  });

  it("defines versioned wrappers that retain non-null owner filters and pass include_public", () => {
    const migration = readFileSync(
      join(root, "supabase/migrations/20260713020000_owner_plus_public_retrieval.sql"),
      "utf8",
    );
    expect(migration).toContain("retrieval_owner_matches_v2");
    expect(migration).toMatch(/owner_filter uuid[^]*include_public boolean/);
    expect(migration).toContain("owner_filter is not null");
    expect(migration).toContain("match_document_chunks_text_v2");
    expect(migration).toContain("to_jsonb(hit)->>'lexical_score'");
    expect(migration).toContain("coalesce(to_jsonb(fact)->'metadata', '{}'::jsonb) as metadata");
    expect(migration).toContain("match_document_chunks_hybrid_v2");
    expect(migration).toContain("corpus_topic_term_stats_v2");
    expect(migration).toContain("bool_or(chunk_present)");
    expect(migration).toContain("get_related_document_metadata_v2");
    expect(migration).not.toContain("returns jsonb");
  });

  it("executes the production text and index-unit hotspots as one scoped query", () => {
    for (const source of [optimizedRetrievalMigration, canonicalSchema]) {
      const scopedText = between(
        source,
        "create or replace function public.match_document_chunks_text_scoped(\n  query_text text,\n  match_count integer,",
        "create or replace function public.match_document_index_units_hybrid_scoped(\n  query_embedding extensions.vector(1536),\n  query_text text,\n  match_count integer,",
      );
      expect(scopedText).toContain("chunk_hits as (");
      expect(scopedText).toContain("title_chunk_hits as (");
      expect(scopedText).toContain("public.retrieval_owner_matches_v2(owner_filter, d.owner_id, include_public)");
      expect(scopedText).toContain(
        "public.is_committed_document_generation(c.index_generation_id, d.index_generation_id)",
      );

      const scopedIndexUnits = between(
        source,
        "create or replace function public.match_document_index_units_hybrid_scoped(\n  query_embedding extensions.vector(1536),\n  query_text text,\n  match_count integer,",
        "create or replace function public.match_document_chunks_text_v2(",
      );
      expect(scopedIndexUnits).toContain("text_hits as (");
      expect(scopedIndexUnits).toContain("term_hits as (");
      expect(scopedIndexUnits).toContain("select text_hits.id from text_hits\n    union");
      expect(scopedIndexUnits).not.toContain("u.search_tsv @@ query.tsq or u.normalized_terms && query.terms");
      expect(scopedIndexUnits).toContain("public.retrieval_owner_matches_v2(owner_filter, d.owner_id, include_public)");

      const textWrapper = between(
        source,
        "create or replace function public.match_document_chunks_text_v2(",
        source === canonicalSchema
          ? "create or replace function public.match_document_chunks_hybrid_v2("
          : "create or replace function public.match_document_index_units_hybrid_v2(",
      );
      expect(textWrapper).toContain("from public.match_document_chunks_text_scoped($1, $2, $3, $4, $5)");
      expect(textWrapper).not.toContain("union all");

      const indexWrapper = between(
        source,
        "create or replace function public.match_document_index_units_hybrid_v2(",
        source === canonicalSchema
          ? "create or replace function public.match_document_memory_cards_hybrid_v3("
          : "revoke all on function public.match_document_chunks_text_scoped(",
      );
      expect(indexWrapper).toContain(
        "from public.match_document_index_units_hybrid_scoped($1, $2, $3, $4, $5, $6, $7)",
      );
      expect(indexWrapper).not.toContain("union all");
    }
  });

  it("merges exact-owner and public rows when a versioned RPC is not deployed yet", async () => {
    const { callVersionedRetrievalRpc } = await import("../src/lib/rag");
    const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
      if (name === "search_v2") return { data: null, error: { code: "PGRST202", message: "schema cache miss" } };
      if (args.owner_filter === "owner-a") {
        return { data: [{ id: "private", hybrid_score: 0.9 }], error: null };
      }
      return { data: [{ id: "public", hybrid_score: 0.8 }], error: null };
    });

    const result = await callVersionedRetrievalRpc({ rpc } as never, "search_v2", "search", {
      owner_filter: "owner-a",
      include_public: true,
      match_count: 8,
    });

    expect(result.data).toEqual([
      { id: "private", hybrid_score: 0.9 },
      { id: "public", hybrid_score: 0.8 },
    ]);
    expect(rpc).toHaveBeenCalledWith("search", expect.objectContaining({ owner_filter: "owner-a" }));
    expect(rpc).toHaveBeenCalledWith(
      "search",
      expect.objectContaining({ owner_filter: "00000000-0000-0000-0000-000000000000" }),
    );
  });

  it("uses the same stable id tie-break as SQL when rollout scores are equal", async () => {
    const { callVersionedRetrievalRpc } = await import("../src/lib/rag");
    const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
      if (name === "match_document_chunks_hybrid_v2") {
        return { data: null, error: { code: "PGRST202", message: "schema cache miss" } };
      }
      return args.owner_filter === "owner-a"
        ? { data: [{ id: "z-owner", hybrid_score: 0.9, rrf_score: 0.1 }], error: null }
        : { data: [{ id: "a-public", hybrid_score: 0.9, rrf_score: 0.1 }], error: null };
    });
    const result = await callVersionedRetrievalRpc<Array<{ id: string; hybrid_score: number; rrf_score: number }>>(
      { rpc } as never,
      "match_document_chunks_hybrid_v2",
      "match_document_chunks_hybrid",
      { owner_filter: "owner-a", include_public: true, match_count: 8 },
    );
    expect(result.data?.map((row) => row.id)).toEqual(["a-public", "z-owner"]);
  });
});
