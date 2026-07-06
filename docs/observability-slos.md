# Observability & SLOs

Service-level objectives for the Clinical KB answer pipeline, the alert
thresholds attached to them, and the nightly production eval canary that turns
the golden eval into a standing guard. Written 2026-07-06.

Context: this repo's defining failure mode is **silent degradation** — hybrid
retrieval RPCs once died quietly while the app kept serving from fallbacks.
Every SLO below is chosen so that the degraded state is _visible_ even when the
app keeps returning 200s.

## 1. Telemetry sources (what exists today)

| Source                                                     | What it carries                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rag_queries.metadata` (jsonb, one row per answered query) | `routing_mode` (`fast` / `strong` / `extractive` / `unsupported`), `confidence` (`high` / `medium` / `low` / `unsupported`), `query_class`, `fallback_reason`, `grounded`, per-stage latencies (`total_latency_ms`, `supabase_rpc_latency_ms`, `embedding_latency_ms`, …), cache/coalescing flags, and `hybrid_rpc_errors` (map of RPC → error) when any hybrid RPC failed |
| `rag_query_misses`                                         | weak-search/miss review queue with `miss_reason`                                                                                                                                                                                                                                                                                                                           |
| Server logs                                                | `logger.error("hybrid_rpc_failed", …)` per failing RPC (also emitted by deep-memory)                                                                                                                                                                                                                                                                                       |
| `search_schema_health()`                                   | execution smoke over all hybrid RPCs; surfaced by `npm run check:indexing`                                                                                                                                                                                                                                                                                                 |
| `/api/health`                                              | app liveness + Supabase reachability (container HEALTHCHECK target)                                                                                                                                                                                                                                                                                                        |
| Answer API response                                        | `degradedMode` / `answerQualityTier: "source_only"` signal per response                                                                                                                                                                                                                                                                                                    |

Query-text privacy: `rag_queries.query` is centrally redacted
(`queryTextForStorage`); SLO queries below only aggregate metadata, never raw
text.

## 2. SLOs and alert thresholds

Measurement window is trailing 24 h unless stated; "page" means the loudest
channel available (today: GitHub issue from the canary + host alert; later:
host-native alerting per `docs/deployment-architecture.md`).

### Latency — answer p95 by route mode

| Route mode (`metadata->>'routing_mode'`) | SLO (p95) | Warn               | Page               |
| ---------------------------------------- | --------- | ------------------ | ------------------ |
| `fast`                                   | ≤ 10 s    | p95 > 10 s for 1 h | p95 > 20 s for 1 h |
| `strong`                                 | ≤ 25 s    | p95 > 25 s for 1 h | p95 > 35 s for 1 h |
| `extractive` / source-only               | ≤ 6 s     | p95 > 6 s for 1 h  | p95 > 12 s for 1 h |
| `/api/search` (route timing)             | ≤ 3 s     | p95 > 3 s for 1 h  | p95 > 8 s for 1 h  |

Anchors: `OPENAI_ANSWER_TIMEOUT_MS` is 30 s; the retrieval latency eval budget
is p90 ≤ 20 s with a 25 s case timeout. A `strong` p95 near 35 s means answers
are riding the timeout and silently falling back.

```sql
select
  metadata->>'routing_mode' as route_mode,
  percentile_cont(0.95) within group (order by (metadata->>'total_latency_ms')::numeric) as p95_ms,
  count(*) as n
from rag_queries
where created_at > now() - interval '24 hours'
group by 1;
```

### Quality — source-gap rate

Share of answered queries whose confidence collapsed to a gap
(`fallback_reason` or support modules report `source_gap`).

- **SLO:** ≤ 15 % of answers over 7 days.
- **Warn:** > 20 % over 24 h. **Page:** > 30 % over 6 h (step change —
  suggests retrieval, enrichment, or corpus regression, not user behavior).

### Quality — unsupported rate

Share of queries with `routing_mode = 'unsupported'` or
`confidence = 'unsupported'`. A base rate is legitimate (out-of-corpus
questions), so alert on deviation, not existence.

- **SLO:** ≤ 10 % of queries over 7 days.
- **Warn:** > 15 % over 24 h. **Page:** > 25 % over 6 h, or a doubling versus
  the trailing-7-day rate. Known confounder: the nondeterministic
  unsupported short-circuit (finding #11) — check its memoization before
  declaring a regression.

```sql
select
  count(*) filter (where metadata->>'routing_mode' = 'unsupported'
                     or metadata->>'confidence' = 'unsupported')::float
    / greatest(count(*), 1) as unsupported_rate
from rag_queries
where created_at > now() - interval '24 hours';
```

### Reliability — hybrid_rpc_errors rate

Share of queries whose metadata contains a non-empty `hybrid_rpc_errors` map.
This is the direct guard against the historical silent-RPC-death incident, so
tolerance is near zero.

- **SLO:** 0 sustained errors. Isolated blips (< 0.1 % over 24 h) tolerated.
- **Warn:** > 0.5 % of queries in any 1 h window.
- **Page:** any _sustained_ nonzero rate across 3 consecutive hours, or the
  same RPC name failing repeatedly — the app will look healthy while serving
  fallback-quality answers, which is exactly the failure mode to catch.

```sql
select
  metadata->'hybrid_rpc_errors' as errors, count(*)
from rag_queries
where created_at > now() - interval '6 hours'
  and metadata ? 'hybrid_rpc_errors'
group by 1 order by 2 desc;
```

Complementary standing checks: `search_schema_health()` via
`npm run check:indexing` (fails closed on RPC regression) and the nightly eval
canary below (fails closed on quality regression).

### Reliability — degraded/source-only answer rate

`RAG_PROVIDER_MODE=auto` silently degrades to deterministic "Source-only"
answers when generation fails quality gates. Expected occasionally; a spike
means the OpenAI path is broken while users still get 200s.

- **SLO:** ≤ 10 % of grounded answers over 24 h.
- **Warn:** > 20 % over 1 h. **Page:** > 50 % over 1 h (generation is
  effectively down).

Measure via `metadata->>'fallback_reason'` / `answer_model_demoted`.

## 3. Nightly production eval canary

`.github/workflows/eval-canary.yml` — scheduled nightly (18:00 UTC = 02:00
Australia/Perth) plus `workflow_dispatch` for on-demand runs.

What it does, in order:

1. `npm run check:supabase-project` — hard guard that the configured env
   points at `sjrfecxgysukkwxsowpy` and nothing else.
2. `npm run eval:retrieval:quality -- --fail-on-threshold` — the golden
   retrieval eval (34 cases incl. forced-vector probes) against the live
   corpus. This is the eval CI never runs on PRs (it needs live Supabase +
   OpenAI keys); the canary makes it a standing nightly guard instead of a
   manual pre-merge step that can be skipped.
3. `npm run eval:quality -- --rag-only --limit 8 --fail-on-threshold` — a
   small answer-quality subset (grounding, citations, unsupported-correctness)
   to bound OpenAI spend while still catching generation-side regressions.

Failing loudly:

- Any threshold failure fails the workflow run (red nightly badge, email per
  GitHub notification settings).
- On scheduled failures the workflow **opens a GitHub issue** labeled
  `eval-canary` (or comments on the existing open one), so a regression
  creates a durable, assignable artifact rather than a missed notification.

Required repo secrets (same ones CI's deployment boot smoke already uses,
plus the eval owner): `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`,
`E2E_USER_EMAIL` (resolved to the eval owner via `RAG_EVAL_OWNER_EMAIL`).
The workflow preflights these and fails with an explicit message when absent.

Operational notes:

- The canary reads live shared corpus state; a pass is a snapshot, and a
  failure can be corpus-state-dependent (see the clozapine-wcc history).
  Triage order: rerun via `workflow_dispatch` → check `hybrid_rpc_errors` and
  `check:indexing` → only then bisect code.
- Evals write telemetry rows (`rag_queries`) but mutate no content.
- Cost bound: ~34 retrieval cases (embedding calls only on forced-vector
  probes) + 8 generated answers per night.
- **The schedule only runs from `main`.** After merging, trigger one
  `workflow_dispatch` run and confirm it goes green before trusting the
  nightly cadence (repo gate for this workflow).

## 4. Gaps / next steps (not in this change)

- Host-level metrics (CPU, memory, restart count) and log drains once the
  container host exists (`docs/deployment-architecture.md` §2).
- A lightweight `/api/health` extension exposing cache hit-rate and
  `hybrid_rpc_errors`-in-last-hour counters for host-native alerting, so the
  SQL above can become a scrape instead of a manual query. (Touches app code —
  deliberately excluded from this change.)
- Wire the warn/page thresholds into an actual alerting channel (Supabase log
  drain → host alerts, or a scheduled workflow evaluating the SQL above).
