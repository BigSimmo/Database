# Observability & SLOs

Service-level objectives for the Clinical KB answer pipeline, the alert
thresholds attached to them, and the weekly production eval canary that turns
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
`npm run check:indexing` (fails closed on RPC regression) and the weekly eval
canary below (fails closed on quality regression).

### Reliability — degraded/source-only answer rate

`RAG_PROVIDER_MODE=auto` silently degrades to deterministic "Source-only"
answers when generation fails quality gates. Expected occasionally; a spike
means the OpenAI path is broken while users still get 200s.

- **SLO:** ≤ 10 % of grounded answers over 24 h.
- **Warn:** > 20 % over 1 h. **Page:** > 50 % over 1 h (generation is
  effectively down).

Measure provider-generation degradation via the explicit
`metadata->>'provider_generation_degraded' = 'true'` flag. During rollout, the
probe also counts legacy `fallback_reason ILIKE '%generation_fallback:%'` rows so
recent pre-flag provider failures remain visible until they age out. Keep `degraded` for
the broader source-only UI state and `fallback_reason` as diagnostic detail;
neither is narrow enough for provider health on its own.

## 3. Weekly production eval canary

`.github/workflows/eval-canary.yml` — scheduled weekly on Sunday at 18:00 UTC
(Monday 02:00 Australia/Perth) plus `workflow_dispatch` for on-demand runs.

What it does, in order:

1. `npm run check:supabase-project` — hard guard that the configured env
   points at `sjrfecxgysukkwxsowpy` and nothing else.
2. `npm run eval:retrieval:quality -- --fail-on-threshold` — the golden
   retrieval eval (36 committed cases plus any captured cases, including
   forced-vector probes) against the live
   corpus. This is the eval CI never runs on PRs (it needs live Supabase +
   OpenAI keys); the canary makes it a standing weekly guard instead of a
   manual pre-merge step that can be skipped.
3. The answer-quality step runs `eval:quality` with `--rag-only --limit 44`,
   supplies `.local/eval-canary/golden-retrieval.json` through
   `--source-governance-results`, and enables `--fail-on-threshold`. The
   separate retrieval artifact populates the Source Governance table without
   rerunning retrieval or changing answer-gate thresholds. The workflow writes
   the structured JSON and Markdown reports into the `eval-canary-output`
   artifact with the tested Git SHA and run identity.

Failing loudly:

- Any threshold failure fails the workflow run (red scheduled-run badge, email per
  GitHub notification settings).
- On scheduled failures the workflow **opens a GitHub issue** labeled
  `eval-canary` (or comments on the existing open one), so a regression
  creates a durable, assignable artifact rather than a missed notification.
- The failure comment records every step outcome plus a deterministic failure
  class derived from the captured eval logs. A completed non-zero
  `failed_cases` summary is classified as a probable regression; raw provider
  failures and the all-cases/no-retrieval-layers signature are classified as
  provider or live-configuration failures.

Required repo secrets: `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY`.
The workflow preflights these and fails with an explicit message when absent.

Operational notes:

- The canary reads live shared corpus state; a pass is a snapshot, and a
  failure can be corpus-state-dependent (see the clozapine-wcc history).
  Triage order: inspect the recorded failure class and failed step → resolve
  provider/configuration failures or inspect `hybrid_rpc_errors` and
  `check:indexing` → only then bisect code. A `workflow_dispatch` rerun and all
  live checks require explicit provider approval.
- Forced-vector golden cases (`forceEmbedding`) run after many text-fast-path
  cases; the workflow sets `RAG_EVAL_CASE_DELAY_MS` and
  `RAG_EVAL_FORCE_EMBEDDING_DELAY_MS` so embedding calls do not exhaust the
  scheduled run's OpenAI rate limit mid-run.
- Evals write telemetry rows (`rag_queries`) but mutate no content.
- Cost bound: 36 committed retrieval cases plus any captured cases (embedding
  calls only on forced-vector probes) + 44 generated answers per week.
- To compare two or more downloaded structured answer reports without treating
  raw millisecond jitter as a content regression, run
  `npm run eval:trend -- --answer-quality <oldest-report.json> <newest-report.json>`.
  Add `--case <case-id>` for the per-run route, latency, and diagnostic
  signature of one case. A `same_tree_content_variability` result means the
  reports share a Git SHA but differ in content/citation outcomes; provider and
  latency-threshold variability are reported separately.
- **The schedule only runs from `main`.** After merging, trigger one
  `workflow_dispatch` run and confirm it goes green before trusting the
  weekly cadence (repo gate for this workflow).

### 3.1 Boundary-case and metric-interpretation policy (2026-07-20)

Standing rules distilled from the ADDENDUM-4 eval/tuning cycle so the next
regression triage does not relearn them:

- **Top-5 boundary cases are a human decision, never a silent retry.** When a
  golden case's expected document sits at the top-5 boundary among multiple
  legitimate sources (the alcohol-ciwa history), the fix is alias coverage or
  a deliberately widened gate — chosen by a human with the run artifact open,
  not by rerunning until green or by ranking nudges aimed at one fixture.
- **Fixture and snapshot move together.** The ranking snapshot's case count is
  pinned to the golden fixture (tests/ranking-tuning.test.ts) and the snapshot
  carries `generatedAt` provenance with a 30-day freshness gate. Regenerate
  from the latest `eval-canary-output` artifact via
  `npm run build:ranking-snapshot` — never hand-edit either file.
- **mrr@10 has a baseline step at 2026-07-20.** The lithium case was the only
  ungated case (its rr was a hardcoded 0); gating it lifted measured mrr@10 by
  ~+0.028 with zero retrieval change. Trend readers must treat that date as a
  baseline reset, not an improvement.
- **`irrelevant_source_rate@10` is a labeling question before it is a ranking
  question.** The rate is dominated by broad/vector cases whose extra top-10
  documents are topically adjacent (e.g. sibling guidelines). Before treating
  the metric as ranking debt, audit whether those documents are under-labeled
  relevant (the alias-tier lesson) — widening sanctioned labels may be the
  correct fix and ranking changes aimed at the raw number may be optimizing
  against mislabeled ground truth.
- **Ordering-headroom changes need a live pair, and two shapes are refuted.**
  The residual rank-depth headroom on passing fast-path cases resisted both
  per-class feature-weight tuning (live no-op, 2026-07-20 pair #53/#54) and a
  saturation-tail spread of the primary/near-primary sort keys (live
  regression, pair #54/#55 — spreading any comparator key ABOVE the
  relevance score lets raw ts_rank override boost/title/subject-aware
  ordering; see the branch-review ledger for the full post-mortems). Any third
  attempt must (a) insert strictly BELOW the relevance key in the release
  comparators, (b) carry a discriminating offline test that fails on the old
  code with differently-relevant candidates (identical-content fixtures hide
  this failure mode), and (c) run a dedicated before/after canary pair with
  doc/content recall pinned at 1.0.
- **Artifact-based trends.** Every canary run uploads `eval-canary-output`
  (30-day retention). `npm run eval:trend -- <artifact.json...>` renders the
  run-over-run metric table (and `--case <id>` a per-case rr trend) from
  downloaded artifacts — the durable trend record without any new
  infrastructure.

## 4. Degradation counters on `/api/health` (shipped)

The §2 reliability SQL is now also a scrape. An **authorized deep probe** —
`GET /api/health?deep=1` with the `x-health-deep-token: $HEALTH_DEEP_PROBE_SECRET`
header (same operator gate as the Supabase probe) — returns three counter blocks:

- **`slo`** — `answerSloSnapshot` (`src/lib/observability/answer-slo.ts`) counts
  `rag_queries` over the trailing `windowMinutes` (60) and reports
  `hybridRpcErrorQueries` / `hybridRpcErrorRate` (the §2 silent-RPC-death guard)
  and `degradedQueries` / `degradedRate` (the explicit provider-generation
  fallback guard, excluding intentional extractive and unsupported/source-gap outcomes). These
  are windowed rates straight from the persisted telemetry.

- **`cache`** — `cacheMetricsSnapshot` (`src/lib/observability/cache-metrics.ts`)
  reports `{ lookups, hits, misses, hitRate }` for the retrieval search cache,
  incremented in-process at the two-layer cache orchestration in
  `searchChunksWithTelemetry` (`src/lib/rag/rag.ts`). A request served by **either**
  the process-local or the shared (`rag_response_cache`) layer counts as a hit,
  so a cold process falling through to a warm shared cache is not miscounted as a
  miss; disabled/skipped lookups are recorded as neither. These are **cumulative
  since process start** (Prometheus-style): a scraper derives a windowed hit-rate
  from the delta between two polls. Measuring at the lookup site — not from
  `rag_queries` — also captures coalesced and fully cache-served requests that
  never write a telemetry row. `hitRate` is a convenience for eyeballing a single
  probe.

- **`coalescing`** — `answerCoalescingMetricsSnapshot`
  (`src/lib/observability/answer-coalescing-metrics.ts`) reports cumulative
  coalescible answer **originations**, duplicate **coalescedWaiters**, and the
  current **activeOriginations** gauge for this one app process. It has no query,
  owner, document, cache key, or clinical content. A scraper must derive a
  windowed `coalescingRate` from counter deltas; the supplied rate is a
  process-lifetime convenience. This is an operational capacity/cost signal,
  not a liveness gate: a sustained near-zero rate during a known duplicate-heavy
  ward round means cache keys, cache settings, or replica dilution should be
  investigated before adding app replicas.

```jsonc
// GET /api/health?deep=1  (authorized, live)
"slo":   { "windowMinutes": 60, "totalQueries": 412,
           "hybridRpcErrorQueries": 0, "hybridRpcErrorRate": 0.0,
           "degradedQueries": 26,      "degradedRate": 0.063 },
"cache": { "lookups": 1873, "hits": 1402, "misses": 471, "hitRate": 0.748 },
"coalescing": { "originations": 312, "coalescedWaiters": 100,
                 "activeOriginations": 4, "coalescingRate": 0.243 }
```

**The counter _values_ never flip liveness.** A bad SLO rate or a cold cache
stays visible without changing readiness — degradation is made _visible_, not
_fatal_, which is the failure mode this doc guards against. Liveness is driven
only by the reachability `checks`: a failing `probeSupabaseHealth()` still sets
`checks.supabase = "error"` and returns `503`, whereas an `answerSloSnapshot()`
query failure merely omits the `slo` block (never a false-healthy zero). The
cache counter is always present for a token-authorized probe (in-process, works
in demo mode). The cache and coalescing blocks are process-local and reset on
deploy/restart, so operators must use per-process deltas rather than combine raw
counter values across replicas. All three blocks are wired through
`src/lib/health-response.ts` and are
**withheld from the unauthenticated `/api/health/ready` endpoint** (Railway's
readiness target, which exposes no diagnostic details). The §2 warn/page
thresholds map directly onto these fields.

## 5. Gaps / next steps

- **Wire the warn/page thresholds into an actual alerting channel.** The §4
  counters are now scrapeable; the remaining work is routing them past their §2
  thresholds (and the 3 h-sustained hybrid escalation) into a real channel — a
  host-native alerter polling `/api/health?deep=1`, or a scheduled workflow
  evaluating the §2 SQL.
- **Host-level metrics** (CPU, memory, restart count) and log drains once the
  container host exists (`docs/deployment-architecture.md` §2).
