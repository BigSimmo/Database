# Scale-readiness review — retrieval RPCs and ingestion queries at 10× corpus

Phase-2 deliverable of the ingestion-concurrency/scale review (2026-07-07, branch
`claude/ingestion-concurrency-scale`). Question: what breaks, and in what order,
when the corpus grows from ~2k documents to ~20k?

Method: read-only against the live `Clinical KB Database` project
(`sjrfecxgysukkwxsowpy`) via `explain_retrieval_rpc(p_analyze=true)` and direct
`EXPLAIN (ANALYZE)` of the hybrid RPCs using a stored chunk embedding as the
query vector (local `npm run profile:retrieval` was not runnable on this machine
— no Supabase credentials present — so its underlying RPC was invoked directly;
same measurements). One `SET LOCAL hnsw.ef_search` experiment ran inside a
rolled-back transaction; nothing on the live project was modified.

## 1. Live baseline (2026-07-07)

### Corpus

| Table                     | Rows                  | Total size (heap) | 10× projection |
| ------------------------- | --------------------- | ----------------- | -------------- |
| documents                 | 2,065 (all `indexed`) | 27 MB             | ~20k           |
| document_chunks           | 69,334                | 1.62 GB (124 MB)  | ~700k / ~16 GB |
| document_index_units      | 111,991               | 1.16 GB (159 MB)  | ~1.1M / ~12 GB |
| document_embedding_fields | 215,072               | 3.92 GB (558 MB)  | ~2.2M / ~39 GB |
| document_memory_cards     | 53,041                | 1.02 GB (84 MB)   | ~530k / ~10 GB |
| document_table_facts      | 34,795                | 76 MB             | ~350k          |
| document_pages / images   | 27,416 / 12,202       | 51 / 38 MB        | ~270k / ~120k  |

~7.8 GB of RAG tables today (indexes dominate — embedding_fields carries
~3.4 GB of index for 558 MB of heap). 10× ≈ **75–80 GB**.

### Instance

`shared_buffers` 256 MB, `effective_cache_size` 768 MB, `work_mem` 3.5 MB,
`max_connections` 60, `random_page_cost` 1.1, `jit` off. pgvector **0.8.0**;
HNSW indexes `m=24, ef_construction=128` on chunks / embedding_fields /
memory_cards; `hnsw.ef_search` at the **default 40** (no RPC or role sets it);
`hnsw.iterative_scan` at the default **off**.

### Measured RPC latencies (warm-ish, single caller, live corpus)

| RPC                                    | Time         | Notes                                        |
| -------------------------------------- | ------------ | -------------------------------------------- |
| match_document_lookup_chunks_text      | 9 ms         | fine                                         |
| match_documents_for_query              | 52 ms        | label/summary joins + per-row `similarity()` |
| match_document_chunks_hybrid           | 141 ms       | two arms + fusion                            |
| match_document_chunks_text             | 301 ms       | tsv + trgm fallbacks                         |
| match_document_index_units_hybrid      | 444 ms       | **text-gated only — see F2**                 |
| match_document_embedding_fields_hybrid | 520 ms       | heaviest vector table, disk-bound            |
| match_document_memory_cards_hybrid_v2  | 687 ms       |                                              |
| match_document_table_facts_text        | **6,750 ms** | **unindexable trigram OR — see F1**          |

### Per-request fan-out (src/lib/rag.ts, cold cache worst case)

Up to 3 query variants (`maxTextRpcQueryVariants=3`) each for
`match_document_chunks_text`, `match_documents_for_query`, and
`match_document_table_facts_text` (all three variant sets run under
`Promise.all`), plus the parallel hybrid trio (embedding fields, index units,
chunks hybrid), plus lookup-chunks and memory-cards calls and OR-relaxation /
trigram-correction retries when strict matching comes back weak or empty.
**A single cold request can issue 10–14 RPCs, of which the table-facts trio
alone is ~3 × 6.75 s of parallel DB CPU.**

## 2. Findings (ranked)

### F1 — `match_document_table_facts_text` is slow, but the cause is a generic query plan, not the predicate — CORRECTED 2026-07-08 (CRITICAL, live today)

**The original diagnosis in this section was wrong**, and the fix it proposed
(rewrite the fuzzy disjunct to the `%` operator) **has already been applied to
live** and did not help. Re-profiling on live (read-only) established the real
cause:

- Live `match_document_table_facts_text` already uses three bounded CTEs
  (`fts_matches` / `term_matches` / `trgm_matches`), and the trigram arm already
  uses `lower(3-col) % q.normalized` against
  `document_table_facts_title_row_param_trgm_idx`. Each arm in isolation is fast:
  measured **0.36 ms** (tsv `@@`), **5.5 ms** (`normalized_terms &&`), **158 ms**
  (trigram `%`), and the full body with a **literal** query value runs in
  **70 ms**.
- Yet the RPC call itself measures **5.3 s**. The gap is a classic
  **generic-plan** problem: the function is `LANGUAGE sql STABLE` **with
  `SET search_path`**, which makes it non-inlinable, so its body is planned once
  with an unknown parameter `$1`. The planner cannot estimate trigram/tsv
  selectivity for an unknown text value, so it picks conservative
  (near-seq-scan) join/scan strategies. Every call pays that bad plan.
- Verification (live, read-only): `SET plan_cache_mode = force_custom_plan`
  before the call drops it from **5.3 s → ~1.1 s** (≈4.8×). The residual gap to
  the 70 ms literal-plan time is because `plan_cache_mode` only partially
  reaches a non-inlined SQL function's cached body plan.

**Mitigation (smallest safe, pure performance — results are byte-identical, so
no eval:retrieval:quality gate is required):**

```sql
alter function public.match_document_table_facts_text(text, integer, uuid[], uuid)
  set plan_cache_mode = 'force_custom_plan';
```

Body-agnostic (targets the function by argument signature), so it applies
cleanly to the live CTE-form function without touching or colliding with the
separate schema.sql↔live body drift on this RPC (schema.sql still carries the
old pre-CTE body **and a 13-column return signature** vs live's 12-column CTE
form — that reconciliation belongs to the drift backlog, not here). Delivers
≈4.8× (5.3 s → ~1.1 s). Apply the same `plan_cache_mode` setting to the other
non-inlined hybrid RPCs that showed the same signature (memory-cards 687 ms,
index-units 444 ms, embedding-fields 520 ms) — same generic-plan cause, same
one-line fix.

**Full fix (recovers 5.3 s → ~70 ms, ≈75×, still results-identical):** convert
the function to `LANGUAGE plpgsql` and run the body via
`RETURN QUERY EXECUTE … USING …`. Shipped in migration
`20260724120000_table_facts_plpgsql_execute.sql` (mirrored in `schema.sql`).
Dynamic `EXECUTE` re-plans per call with the actual bound values. Re-profile
live after hosted apply (`#069`); ranking/result predicates are unchanged.

Not runnable from the review environment: applying either fix needs the linked
`supabase` CLI (operator credentials) — `db push`/`link` are not authenticated
here, and the project's migration policy forbids `db push` on its divergent
history. The `alter function` above is safe to run directly (dashboard SQL
editor or a committed migration) since it changes only the plan mode.

### F2 — Index-unit "hybrid" retrieval has no vector arm at all; the missing HNSW index is being masked (HIGH, correctness-at-scale)

`document_index_units` (112k rows, the visual/enrichment evidence table) has
**no vector index** — 14 btree/GIN indexes, zero HNSW. The RPC compensates by
gating candidates on text only: `where (search_tsv @@ tsq or normalized_terms
&& terms) order by text_rank desc limit 72` (schema.sql:4074-4076), computing
embedding similarity only as a **re-score** of those 72 text hits. Consequences:
(a) a query phrased differently from the unit's stored vocabulary can never
reach index units via semantics — vector recall is structurally zero for this
artifact class; (b) the `normalized_terms && terms` arm splits the raw query on
non-alphanumerics with no stopword filtering, so at 10× a query containing one
common clinical token ANDs `ts_rank_cd` + array-overlap over tens of thousands
of rows before the sort (444 ms today, roughly linear growth). Mitigation:
add an HNSW index on `document_index_units.embedding` (concurrently; ~1.1M
rows at 10× is fine for HNSW) and give the RPC a real vector arm mirroring
`match_document_chunks_hybrid`; keep the text arm as-is.

### F3 — `ef_search` 40 silently caps every vector arm below its own LIMIT (HIGH, recall)

The chunks-hybrid vector arm asks for `limit greatest(match_count*6, 48)` = 72
candidates and embedding-fields asks for 48, but pgvector returns at most
`hnsw.ef_search` = 40 tuples per scan with `iterative_scan` off. Measured live:
the raw chunks vector arm returned **exactly 40 rows** against LIMIT 72; with
`SET LOCAL hnsw.ef_search = 200` (rolled back) the same query returned 72.
Today's effect is a mildly starved fusion pool. At 10× it compounds: the 40
nearest neighbors are drawn from a 700k-chunk graph and then post-filtered by
`d.status='indexed'`, owner scope, and committed-generation checks — every
filtered-out neighbor is a permanently lost candidate, and multi-tenant owner
filtering makes the loss systematic for small tenants (their rows are a thin
slice of the graph). Mitigation (choose one, eval-gated):
`set local hnsw.ef_search` inside the hybrid RPCs to ≥ the arm LIMIT (cheap,
surgical), or enable `hnsw.iterative_scan = relaxed_order` (pgvector 0.8
feature, purpose-built for filtered HNSW).

### F4 — The whole vector working set already exceeds RAM by ~10×; at 10× corpus it exceeds it by ~100× (HIGH, latency/cost)

256 MB `shared_buffers` / 768 MB `effective_cache_size` against ~5 GB of HNSW
indexes today explains the measured 440-690 ms hybrid RPCs (disk-bound graph
traversal). At 10× (~50 GB of vector indexes) every HNSW hop is a random read;
p95s move to seconds and the three-variant fan-out multiplies it. Mitigations
in order of leverage: (1) prune `document_embedding_fields` — at 215k rows it
is 3× larger than the chunk table it decorates and 3.9 GB of the 7.8 GB total;
half-precision (`halfvec`) or dropping low-value field types would halve the
hot set; (2) instance upgrade so the chunk + embedding-field HNSW indexes fit
in cache; (3) collapse the five per-artifact vector searches per query into
fewer arms (see F6).

### F5 — `match_documents_for_query` recomputes unindexed tsvectors and trigram similarity per label/summary row (MEDIUM)

The document-gate RPC computes `to_tsvector('english', l.label)` and
`similarity(lower(...), query)` inline for every candidate label and summary
(schema.sql:2637-2672) — no expression index exists for either. 52 ms today at
2k docs × labels; linear in both document count and label count, so ~0.5-1 s at
10× sitting on the answer path's critical prefix (it gates lookup-first
retrieval). Mitigation: precomputed `search_tsv` on document_labels (indexed)
and `%` instead of `similarity() >=`.

### F6 — Connection/latency budget: 10-14 RPCs per cold request against `max_connections` 60 (MEDIUM, throughput ceiling)

Each RPC is a separate PostgREST round-trip holding a pooled connection for its
full runtime. Today a cold clinical query consumes roughly 9-10 s of aggregate
DB time (dominated by F1); a dozen concurrent cold users would saturate the
60-connection budget even before 10×. The worker and edge agent (pool max 4)
share the same instance. Mitigations: fix F1/F2/F5 first (they are the
long-pole holders); then merge the three text-variant calls per RPC into one
RPC taking `text[]` of variants (one round-trip, one scan with
`websearch_to_tsquery` per variant unioned server-side); consider a single
`retrieve_all(query, embedding)` orchestrator RPC to collapse the hybrid trio.

### F7 — Statistics churn from `analyze_rag_tables` after every job (LOW)

The worker runs `ANALYZE` over six RAG tables after each completed job,
throttled to 45 s (worker/main.ts:334-343). At 10× ingestion volume this is a
steady background full-table sampling load on multi-GB tables and will start
appearing in p95s. Autovacuum's `autovacuum_analyze_scale_factor` handles this
fine at scale; the manual sweep should become conditional (row-delta threshold)
or scoped to the tables the job actually grew.

### F8 — `cleanup_abandoned_document_index_generations` scans every artifact table by generation-mismatch with no supporting index (LOW, ops)

Candidate selection unions seven `table × documents` joins filtering on
`index_generation_id::text is distinct from metadata->>'index_generation_id'`
— none of the partial indexes cover that predicate shape, so each run is seven
full scans (fine at 76 MB-1.6 GB, minutes at 10×, all inside one transaction
with a 180 s statement timeout that it will start hitting). Mitigation: chunked
per-document invocation (the `p_document_id` parameter already exists) driven
from the ops script, or a partial index on `(document_id) where
index_generation_id is not null`.

## 3. What holds up fine

- `match_document_chunks_text` (301 ms) and `match_document_lookup_chunks_text`
  (9 ms): GIN `search_tsv` arms with bounded candidate LIMITs; growth is in
  ts_rank sort width, roughly logarithmic-ish in practice. Acceptable at 10×.
- HNSW build parameters (`m=24, ef_construction=128`) are sensible for 1M-row
  tables; no rebuild needed for 10× — the problem is search-time `ef_search`
  (F3) and cache (F4), not graph quality.
- `claim_ingestion_jobs` / `claim_indexing_v3_agent_jobs`: SKIP LOCKED on small
  hot tables with partial indexes — queue mechanics scale fine; the concurrency
  bugs are in the lease semantics (phase 1 doc), not the query plans.
- Commit RPC's per-document deletes are all `document_id`-indexed; 180 s
  statement timeout has ample headroom at 10× per-document sizes.

## 4. Ranked mitigation list

1. **F1** (corrected — the trigram `%` rewrite is already live and did not
   help): `alter function public.match_document_table_facts_text(text, integer,
uuid[], uuid) set plan_cache_mode = 'force_custom_plan';` — the RPC is slow
   because the non-inlined SQL function runs a generic plan for an unknown
   query value (5.3 s), not because of the predicate. Pure-performance, no eval
   gate; ≈4.8× (→ ~1.1 s). Same one-liner for the memory-cards / index-units /
   embedding-fields hybrids. Full ≈75× fix = plpgsql + `EXECUTE`. See §2 F1.
2. **F3**: `set local hnsw.ef_search = greatest(match_count*6, 64)` (or enable
   iterative scan) inside the three vector-arm RPCs. One-line recall fix,
   eval-gate with `npm run eval:retrieval` content_mrr@10.
3. **F2**: HNSW index on `document_index_units.embedding` + real vector arm in
   its RPC. Restores semantic recall for the visual/enrichment evidence class.
4. **F5**: indexed `search_tsv` for document_labels; `%` for fuzzy matching in
   `match_documents_for_query`.
5. **F6**: variant-array RPCs (3 round-trips → 1) and, later, a consolidated
   retrieval orchestrator RPC.
6. **F4**: shrink `document_embedding_fields` (field-type audit / halfvec) and
   size the instance so chunk+field HNSW fit `effective_cache_size` before 10×.
7. **F7/F8**: conditional `analyze_rag_tables`; chunked abandoned-generation
   cleanup.

All changes above are eval-gated config/SQL work; none change ranking semantics
except F2/F3, which must show a content_mrr@10 non-regression on the golden set
before defaults change (per the repo's reindex-eval-gate convention).
