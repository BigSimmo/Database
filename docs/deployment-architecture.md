# Deployment Architecture

Decision record for the production topology of Clinical KB. Written 2026-07-06.
Companion documents: `docs/observability-slos.md` (SLOs + eval canary) and
`docs/capacity-review.md` (load model, first bottleneck, soak test).

Status of this document: **decided and partially implemented**. The app-tier and
worker container images ship in this repo (`Dockerfile`, `Dockerfile.worker`).
Host provisioning, staging setup, and secret placement are operator actions and
are specified here but not executed by this change.

## 1. Current state (what exists today)

- **No production deployment target.** There is no hosting config; before this
  change there was no Dockerfile. `npm run check:deployment-readiness` boots
  `next start` locally and verifies project identity — it proves the build can
  serve, not that anything is deployed.
- **Database/auth/storage:** live Supabase project `Clinical KB Database`
  (`sjrfecxgysukkwxsowpy`), region **ap-southeast-2 (Sydney)**, Postgres 17,
  ~2,000 indexed documents / ~69k chunks. RLS is service-role-only; the app
  layer is the ownership boundary.
- **Ingestion:** a local worker (`npm run worker`) that needs a Python OCR
  stack (PyMuPDF, Pillow, pytesseract + the Tesseract binary), plus the
  `indexing-v3-agent` Supabase Edge Function acting as a cron-triggered
  completion/repair gate — not a full extraction pipeline.
- **Known failure mode:** silent degradation. Hybrid retrieval RPCs once died
  quietly while the app kept serving from fallbacks. Every topology decision
  below biases toward _loud_ failure and standing guards.

## 2. App tier

### Decision

Run the Next.js app as a **single long-lived container** (Node 24, image built
from `Dockerfile`) on a managed container host **in Sydney, co-located with
the Supabase project's ap-southeast-2 region**.

Recommended host: any OCI-image host. Production runs on **Railway**; Google
Cloud Run (`australia-southeast2`) is a Sydney-region alternative if lower
answer latency matters. The image is host-agnostic.

### Why a long-lived container and not serverless (Vercel et al.)

- **In-memory coalescing and caches are load-bearing.** The answer pipeline
  coalesces identical in-flight questions (`answer_inflight_coalesced` in
  `src/lib/rag.ts`) and holds LRU answer/search caches
  (`RAG_ANSWER_CACHE_TTL_MS`/`RAG_ANSWER_CACHE_SIZE`). Serverless isolates get
  one request each, so coalescing never fires and every duplicate ward-round
  question pays the full ~6-RPC fan-out plus an OpenAI generation.
- **Fire-and-forget background work.** Cache invalidation and telemetry writes
  run as `void (async () => ...)` after the response; serverless platforms may
  freeze the isolate at response end.
- **Long requests.** The strong answer route runs up to
  `OPENAI_ANSWER_TIMEOUT_MS` (30 s) plus retrieval; streaming responses run
  longer. That is hostile to per-request serverless billing/limits.
- **Connection amplification.** Many cold instances multiply concurrent
  PostgREST/auth traffic against a database whose auth server is capped at 10
  absolute connections (see `docs/capacity-review.md`).

Scale-out plan: stay at 1 instance (vertical scaling first) until sustained
load demands more; replicas are safe but dilute in-memory coalescing, so add
them only after the shared `rag_response_cache` hit rate is confirmed healthy.

### Image contract (`Dockerfile`)

- `node:24-bookworm-slim` in all stages — respects `engines`/`engine-strict`
  and the `preinstall` engine guard.
- The build stage runs the repo's own `npm run build`
  (`guard-next-build.mjs` + `next build --webpack` + the client-bundle secret
  scan) — **the image build fails exactly where a local build would**. The
  `--webpack` flag is deliberate: `next.config.ts` carries a webpack-specific
  WasmHash workaround and the CSP-nonce work was validated against webpack
  prod chunks, so switching bundlers needs its own verified change. The build
  allocates an 8 GiB heap; give the Docker builder ≥ 10 GiB memory.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are
  build args (they inline into the client bundle). The publishable key is
  public by design; the placeholder default exists so CI can build without
  secrets. **Production images must be built with the real publishable key.**
- Runtime is a non-root `node` user, prod-only `node_modules`, direct
  `next start -H 0.0.0.0 -p $PORT` (the local port-picker script is
  deliberately bypassed), and a `HEALTHCHECK` against `/api/health`.
- No secret is ever baked into a layer. `SUPABASE_SERVICE_ROLE_KEY`,
  `OPENAI_API_KEY`, etc. are injected at run time by the host's secret store.

Minimal Fly config (create at deploy time; not committed until an app is
provisioned):

```toml
# fly.toml (sketch — values fixed at provisioning time)
app = "clinical-kb"
primary_region = "syd"
[build]
[env]
  PORT = "3000"
[http_service]
  internal_port = 3000
  force_https = true
  min_machines_running = 1     # keep the warm instance: caches + coalescing
  auto_stop_machines = false   # no scale-to-zero: cold starts defeat the SLOs
[[http_service.checks]]
  path = "/api/health"
  interval = "30s"
  timeout = "5s"
```

## 3. Ingestion tier

### Decision: containerized worker (recommended) over completing the edge-agent migration

Ship the existing worker as a container (`Dockerfile.worker`: Node 24 + tsx +
Tesseract + a Python venv with `worker/python/requirements.txt`) and run **one
always-on worker instance** co-located in Sydney. The `indexing-v3-agent` Edge
Function **stays** in its current role as the cron-triggered completion/repair
gate — the two are complementary, not alternatives.

Reasoning:

1. **The OCR stack cannot run at the edge.** PyMuPDF and Tesseract are native
   binaries driven from Python. Supabase Edge Functions are Deno isolates with
   no native-binary support and hard wall-clock/memory ceilings. "Completing
   the migration" would mean reimplementing PDF parsing, OCR fallback, image
   captioning, and table extraction inside those ceilings — a rewrite with a
   strictly worse capability ceiling, not a migration.
2. **Job shape mismatch.** Large guideline PDFs take multi-minute processing
   (the queue's stale-claim window is 45 minutes); edge functions are built for
   sub-minute invocations.
3. **The worker is already multi-instance safe.** `claim_ingestion_jobs` uses
   `FOR UPDATE SKIP LOCKED` with per-document exclusivity, so containerizing it
   verbatim gives horizontal scaling for free (see queue semantics below).
4. **Smallest delta.** `worker/main.ts` runs unchanged in the container; the
   only new artifact is the image. The edge path would fork the pipeline into
   two implementations that drift — this repo's defining failure mode.

Scaling: raise `WORKER_BATCH_SIZE` / `WORKER_CONCURRENCY` on the single
instance first; add replicas only for sustained backlog (safe by construction).

### Queue durability when a worker dies mid-job

Semantics of `claim_ingestion_jobs` (migration
`20260615114506_claim_ingestion_jobs_document_lock.sql`):

- **Claim:** `status → processing`, `locked_at = now()`, `locked_by = worker`,
  and — important — **`attempt_count` is incremented at claim time**, not at
  failure time. Claims take `FOR UPDATE SKIP LOCKED` over the job _and_ its
  document row, rank one job per document, and exclude any document that
  already has a _fresh_ processing job.
- **There is no heartbeat.** The worker never refreshes `locked_at` mid-job.
  If the worker dies, the job sits in `processing` until `locked_at` is older
  than the stale window (`p_stale_after_minutes`, default 45, worker-side
  `WORKER_STALE_AFTER_MINUTES`), after which any worker reclaims it
  (`stage = 'reclaimed stale job'`).
- **Dead-lettering is implicit.** Because attempts are consumed at claim, a
  crash-looping job exhausts `max_attempts` (default 3) after ~3 stale windows
  and becomes terminally `failed` — the de-facto dead-letter state. Recovery is
  operator-driven: `npm run recover:ingestion` or the retry API, both protected
  by the ingestion rollback fence (`updated_at` fence) against retry/reindex
  overlap races.

Operational rules that follow:

- **The stale window must exceed the worst-case job runtime.** If a live
  worker runs a job longer than 45 minutes, a second worker can reclaim and
  double-process the same document (the per-document exclusion only respects
  _fresh_ locks). The rollback fence bounds the damage but does not prevent the
  wasted work. When adding worker replicas, first confirm p100 job duration
  against the window.
- **Worker death costs at most one stale window of latency** for the in-flight
  job and zero data loss: all artifact writes are idempotent per
  generation/chunk-key, and completion is gated by the strict completion RPCs
  plus the edge agent.
- **Backlog improvement (not in this change):** a heartbeat that refreshes
  `locked_at` could ride the existing throttled progress updates
  (`WORKER_PROGRESS_UPDATE_MIN_INTERVAL_MS`, 60 s), which would let the stale
  window shrink from 45 min to ~5 min without double-claim risk. Touches
  worker + RPC; needs its own migration and review.

## 4. Secrets management

| Variable                                         | Sensitivity      | Build-time or runtime | Where it lives                                                      |
| ------------------------------------------------ | ---------------- | --------------------- | ------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`                       | public           | build (inlined)       | Dockerfile ARG / repo                                               |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`           | public-by-design | build (inlined)       | Dockerfile ARG; real value passed by the release pipeline           |
| `SUPABASE_SERVICE_ROLE_KEY`                      | **critical**     | runtime               | host secret store; GitHub repo secret (CI boot smoke + eval canary) |
| `OPENAI_API_KEY`                                 | **critical**     | runtime               | host secret store; GitHub repo secret                               |
| `SUPABASE_PROJECT_REF` / `SUPABASE_PROJECT_NAME` | low              | runtime               | plain env (pins `check:supabase-project`)                           |
| `INDEXING_V3_AGENT_SECRET`                       | high             | runtime               | Supabase Edge Function secrets                                      |
| `RAG_QUERY_HASH_SECRET`                          | high             | runtime               | host secret store; GitHub repo secret (CI boot smoke)               |
| `E2E_USER_EMAIL` / `E2E_USER_PASSWORD`           | medium           | CI only               | GitHub repo secrets                                                 |

Rules:

- Secrets never enter images, the repo, or `NEXT_PUBLIC_*` names. `.env.local`
  is a local-dev convenience only.
- Each environment (production, staging, CI) gets **separate** service-role and
  OpenAI keys so rotation and blast radius stay per-environment.
- Rotation: publishable-key rotation is already an operator runbook item
  (`docs/archive/operator-decisions-2026-07-04.md`); service-role rotation is a
  Supabase dashboard action + host secret update + redeploy.
- `npm run check:supabase-project` runs after any Supabase env change (repo
  rule), and the eval canary runs it before every scheduled eval.

## 5. Staging environment

- **A second, dedicated Supabase project** (same org, ap-southeast-2) — not a
  branch of production. Rationale: staging must absorb soak tests, destructive
  ingestion experiments, and migration rehearsal without any shared compute,
  pooling, or the production auth 10-connection cap; per-environment keys fall
  out naturally.
- Seeded via the existing pipeline (`npm run import:docs`, `registry:seed`,
  `differentials:seed`, `medications:seed`) with a small (~50-document)
  synthetic/public corpus. `public/demo-documents/` plus generated samples
  (`npm run samples`) are sufficient for load-shape realism; do not copy
  clinical production documents into staging.
- One staging app container + one staging worker container from the _same_
  images, different env. `RAG_PROVIDER_MODE=auto` with staging OpenAI key.
- `src/lib/supabase/project.ts` is staging-aware only when both
  `SUPABASE_STAGING_PROJECT_REF` and `SUPABASE_STAGING_PROJECT_NAME` are set.
  The declared staging ref must differ from production and every stale project;
  otherwise `check:supabase-project` fails closed. See `docs/staging-setup.md`.
- The soak test (`scripts/soak-test.ts`) targets staging **only** — see
  `docs/capacity-review.md`.

## 6. Rollout and rollback

- `.github/workflows/docker-image.yml` validates both container builds on
  `main`, release branches, a weekly schedule, and container-affecting pull
  requests. It deliberately does not push to a registry; registry publication
  and deployment remain host-specific release steps after the standard gates
  (`verify` + `ui-smoke` + the clinical governance preflight where relevant).
- Rollback = redeploy the previous image tag. Database migrations follow the
  existing rule: committed migrations + `schema.sql` reconciliation only, never
  raw SQL against live.
- The nightly eval canary (`.github/workflows/eval-canary.yml`) is the standing
  guard that retrieval/answer quality did not silently regress after any
  deploy — see `docs/observability-slos.md`.
