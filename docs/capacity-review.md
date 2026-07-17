# Capacity Review — Concurrent Clinician Load

Models the reference load ("30 clinicians on a ward round") against the known
constraints of the current stack, names the first bottleneck, and defines the
soak test that validates the model against staging. Written 2026-07-06.
Topology assumptions come from `docs/deployment-architecture.md` (single warm
app container, Sydney, co-located with Supabase `sjrfecxgysukkwxsowpy`).

## 1. Load model

Ward-round profile, 30 concurrent users over ~60 minutes:

| Behavior       | Assumption                                       | Steady-state rate                    |
| -------------- | ------------------------------------------------ | ------------------------------------ |
| Sign-in burst  | all 30 authenticate within ~2 min at round start | 15 auth ops/min, once                |
| Answer queries | 1 question / user / 2 min                        | ~15 answers/min (~0.25/s)            |
| Searches       | 2 searches per answer (typeahead + refine)       | ~30 searches/min                     |
| Document opens | 1 per answer (citation click)                    | ~15 reads/min                        |
| Overlap        | ward rounds ask repeated questions               | ~30 % of answers are near-duplicates |

## 2. Constraint-by-constraint analysis

### Auth: 10 absolute DB connections (the hard cap)

The Supabase auth server (GoTrue) is capped at **10 absolute database
connections** (advisor finding, recorded in `docs/process-hardening.md`). Auth
work is bursty and short, but a synchronized sign-in burst (round start, token
refresh storms after an app deploy) queues behind 10 connections and shows up
as login latency or timeouts — a hard, user-visible failure while the rest of
the app looks healthy.

Mitigations, in order:

1. **Switch auth to percentage-based connection allocation** in the Supabase
   dashboard so the auth pool scales with compute instead of staying pinned at
   ~10 — the exact operator path and verification are documented in
   `docs/auth-connection-cap-runbook.md` (not settable via SQL/MCP — operator
   action, ask before touching live settings; do this before the first
   vertical scale-up).
2. Persistent cookie sessions (`@supabase/ssr`, already shipped) mean sign-in
   is amortized: a returning clinician refreshes a token rather than
   re-authenticating, so the burst is mostly first-day-of-rotation shaped.
3. Keep the app tier at one warm instance: every additional cold instance
   multiplies token-refresh traffic at deploy time.

### Data path: per-answer RPC fan-out vs pooling

Answer retrieval fans out to **~6 hybrid RPCs** (chunks, embedding fields,
index units, memory cards, table facts, documents-for-query) plus cache reads
and telemetry writes. Critically, the app reaches Postgres through
**PostgREST/Supavisor (HTTP)**, not direct Postgres connections — so 30 users
do not consume 30+ DB connections; they consume PostgREST pool slots for the
duration of each RPC.

Volume math at steady state: 15 answers/min × ~6 RPCs ≈ 1.5 RPC/s plus ~0.5
search RPC/s — trivial as _throughput_. The pressure point is **per-RPC cost**:
each hybrid RPC does vector (HNSW) + trigram/tsvector work over ~69k chunks on
a small shared compute tier. Under concurrency the failure shape is CPU
saturation → every RPC slows together → answer p95 inflates → users retry →
amplification. This degrades before anything errors, which is why the p95
latency SLOs by route mode exist (`docs/observability-slos.md`).

Existing dampers: the 5-minute answer/search caches, the shared
`rag_response_cache`, and in-flight answer coalescing
(`answer_inflight_coalesced`) — with ~30 % duplicate questions on a ward
round, coalescing + cache absorb roughly a third of the fan-out at exactly the
moment load is highest. This only works while the app is a **single process**
(see deployment doc §2).

The authorized deep health probe now exposes privacy-safe process-local
`coalescing` counters (`originations`, `coalescedWaiters`, and
`activeOriginations`). Before changing replica count, compare their deltas with
the retrieval cache counters over a duplicate-heavy period. A sustained low
coalescing rate may be expected for unique queries, but is a capacity/cost
regression signal when the ward-round duplicate hypothesis holds; it is not a
reason to make readiness fail.

### OpenAI: rate limits and generation concurrency

Per answer: 1 embedding call (unless the lexical fast path skips it) + 1–2
generations (fast route, escalation to strong). 15 answers/min with grounded
prompts (~5–15k tokens each) lands in the low hundreds of thousands of
tokens/min at worst. Re-baseline the production project's current Terra/Sol
token and request limits before rollout; _bursts_ of simultaneous strong-route
generations can still trip request-per-minute limits.
Existing dampers: coalescing (duplicate questions never reach OpenAI), the
answer cache, `OPENAI_MAX_RETRIES`, and graceful degradation to source-only
answers (which must stay _visible_ — see the degraded-rate SLO).

### App-layer rate limits (protective, not a bottleneck)

Per-owner buckets (`src/lib/api-rate-limit.ts`): answer 30/min, search
240/min, document_read 180/min. A single clinician cannot realistically hit
these; they exist to stop runaway clients. Anonymous buckets are far tighter
(answer 6/min) — load testing unauthenticated will measure the limiter, not
the system (the soak script reports 429s separately for this reason).

### App tier: Node process

One Node process handles ~0.75 req/s of API traffic with almost all wall time
spent waiting on Supabase/OpenAI. Not a factor at 30 users; becomes one only
if replicas are added carelessly (cache/coalescing dilution) or the box is
undersized for the 8 GiB build-time heap (build happens in CI, not on the
serving instance).

## 3. Verdict: first bottleneck and what to change

1. **First hard failure: the auth 10-connection cap** during synchronized
   sign-in/token-refresh bursts. Fix: percentage-based allocation in the
   dashboard so the auth pool tracks compute rather than staying pinned at ~10
   — exact operator path + verification in `docs/auth-connection-cap-runbook.md`
   (operator action; requires explicit approval before touching live settings),
   and keep single-instance deploys so refresh storms stay small.
2. **First soft failure: Postgres CPU under hybrid-RPC concurrency** — answer
   p95 inflates well before errors appear. Watch the latency SLOs; the
   remedies in order are: confirm cache/coalescing hit rates, then compute
   upgrade, then (measured, eval-gated) retrieval fan-out reduction. Do not
   touch retrieval code for capacity reasons without the golden eval.
3. **Bounded third: OpenAI RPM/TPM bursts** — mitigated by coalescing and by
   spreading strong-route escalation; if the degraded-answer SLO trips in
   correlation with 429s, raise the OpenAI tier before changing code.

Explicit non-actions: no read replicas (retrieval is CPU-bound, not
read-connection-bound); no horizontal app scaling at this load; no retrieval
concurrency semaphore until soak data shows queueing.

## 4. Soak test

`scripts/soak-test.ts` — a dependency-free load driver for the ward-round
profile. **Staging only. Never point it at production.**

```bash
# 30 virtual clinicians, 10 min, ward-round mix (75% search / 25% answer)
npx tsx scripts/soak-test.ts \
  --target https://<staging-app-host> \
  --confirm-staging \
  --users 30 --duration-s 600 --ramp-s 120

# Authenticated run (bypasses anonymous rate limits):
npx tsx scripts/soak-test.ts --target https://<staging-host> --confirm-staging \
  --bearer "$STAGING_ACCESS_TOKEN"
```

What it does:

- Ramps up `--users` virtual users over `--ramp-s`, each looping: pick a query
  (from `scripts/fixtures/rag-retrieval-golden.json` when present, otherwise a
  built-in clinical list), issue a search request (75 %) or an answer request
  (25 %), then think-time pause (`--think-ms`, default 15 s mean, jittered).
- Records per-endpoint latency percentiles (p50/p90/p95/max), HTTP error
  counts, and 429s (reported separately — a 429 is the limiter working, not a
  system failure).
- Exits non-zero if the non-429 error rate exceeds 5 % — so it can gate a
  staging deploy.

Safety rails (enforced in the script):

- Requires an explicit `--target` **and** `--confirm-staging`; refuses to run
  otherwise.
- Refuses any target whose host matches production markers (the production
  Supabase ref, or hosts passed via `--forbid-host`, repeatable).
- Read-only traffic: only search and answer endpoints — no uploads, no
  mutations, no admin routes.

Success criteria for a 30-user staging soak (maps to the SLO table):

| Metric                    | Target                |
| ------------------------- | --------------------- |
| `/api/search` p95         | ≤ 3 s                 |
| `/api/answer` p95         | ≤ 25 s (mixed routes) |
| Non-429 error rate        | < 1 %                 |
| Auth failures during ramp | 0                     |

Follow-ups after the first staging soak: record results here, compare against
the model in §2, and revisit the verdict in §3 if the ordering was wrong.
