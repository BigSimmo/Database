# Worker deploy runbook

Operator recipe for shipping the containerized ingestion worker
(`Dockerfile.worker`). This is the "how to run it" companion to the decision
record in [`deployment-architecture.md`](deployment-architecture.md) §3
(_containerized worker over completing the edge-agent migration_) — read that
first for the **why**. The `indexing-v3-agent` Edge Function stays in place as
the cron-triggered completion/repair gate; the container is the extraction
engine, not a replacement for it.

This is the detailed expansion of the **Worker** bullet in
[`launch-operator-runbook.md`](launch-operator-runbook.md) §6 (Post-deploy) —
that runbook is the launch sequence; this one is the worker recipe. The actual
deploy is an operator action — see the gate in step 0.

Production host is **Railway** (`deployment-architecture.md` §2); the image is
host-agnostic, so the `docker run` recipe below maps 1:1 onto Railway service
env vars + a restart policy (or any OCI host).

---

## 0. Pre-deploy gate — do not deploy before this is live

**Migration `20260708130000_ingestion_concurrency_rpc_hardening.sql` must be
applied to the live project _before_ the worker is (re)deployed from current
`main`.**

`worker/main.ts` passes `p_worker_id` to the lease-fence RPCs
(`complete_ingestion_job`, `fail_or_retry_ingestion_job`,
`complete_strict_enrichment_job`). Deploying the new worker against a database
that has not yet taken this migration means the R1/R2 lease fences the worker
relies on are not present. See
[`operator-apply-july8-batch.md`](operator-apply-july8-batch.md) (step 2:
_"apply before worker redeploy"_) for the ordered apply plan.

Confirm the gate before continuing:

```bash
npm run reindex:health   # ok:true, and the RPC signatures accept p_worker_id
```

If migrations are still outstanding, stop here and apply them first.

---

## 1. Build — CI is the build contract

The worker image build is validated in CI by
[`.github/workflows/docker-image.yml`](../.github/workflows/docker-image.yml)
→ the **`worker-image`** job. It runs `docker build -f Dockerfile.worker`
(`push: false`) on:

- every push to `main` / `release/**`,
- pull requests that touch a container-affecting file (`Dockerfile.worker`,
  `worker/python/requirements.txt`, deps, engine/build guards, the workflow
  itself),
- the weekly schedule (Sun 18:00 UTC), and
- manual `workflow_dispatch`.

Nothing is pushed to a registry — the job proves the image **builds cleanly
from the tree**; registry publication and deploy are host-specific steps after
the standard gates.

Status: ✅ **CI covers the worker image build.** All build inputs referenced by
`Dockerfile.worker` are present in the tree (`package-lock.json`, `.npmrc`,
`scripts/check-node-engine.cjs`, `scripts/build-worker.mjs`,
`worker/python/requirements.txt`, `worker/index.ts`) and the `server-only`
bundle path is guarded by `tests/tsx-server-only-runner.test.ts` plus
`tests/worker-bundle.test.ts` (resolve-checks every bundle external against
plain-`node` ESM resolution and the `--omit=dev` prune).

Local build for parity (optional; needs Docker with a few GB free — unlike the
app image it does **not** need the 8 GiB build heap):

```bash
docker build -f Dockerfile.worker -t clinical-kb-worker .
```

### What ships in the image

- **Node 24** (`node:24-bookworm-slim`) + **production-only** `node_modules`
  (`npm ci --omit=dev`): the worker runs as a prebuilt esbuild bundle
  (`dist/worker/index.mjs`, built in a separate image stage by
  `scripts/build-worker.mjs`), so tsx and the rest of the dev toolchain never
  reach the image.
- **Tesseract OCR** (Debian package; bundles English language data).
- A **Python venv** at `/opt/ocr-venv` with `worker/python/requirements.txt`
  (PyMuPDF, Pillow, pytesseract). The venv is first on `PATH`, so the default
  `PYTHON_BIN=python` resolves to it — no override needed in-container.
- Runtime is the non-root `node` user. No secret is baked into any layer.
- `CMD` runs the bundle under plain `node`. The build aliases `server-only`
  to the standalone stub (what `scripts/run-tsx.mjs` did at runtime), so
  `worker/index.ts`'s `import "server-only"` resolves outside the Next
  bundler. **Do not** change this to bare `tsx`/`node` on the TypeScript
  sources — the worker would crash-loop on boot. Bundle externals must stay
  resolvable under plain-`node` ESM semantics with production-only deps;
  `tests/worker-bundle.test.ts` enforces both.
- The default command is the **always-on long-poll loop** (no `--once`): probe
  Supabase health → claim jobs → process → poll every `WORKER_POLL_MS` when
  idle. `--once` is a drain-and-exit mode for local/one-shot use, not for the
  always-on instance.

---

## 2. Run recipe — one always-on instance

Run **exactly one always-on worker** on Railway in Singapore
(`asia-southeast1-eqsg3a` in `railway.worker.json`) — the closest available
Railway region to the Supabase project in Sydney (ap-southeast-2). Scale the
single instance first (`WORKER_BATCH_SIZE` / `WORKER_CONCURRENCY`); add
replicas only for sustained backlog, and only after confirming p100 job
duration stays under `WORKER_STALE_AFTER_MINUTES` (45 min) — otherwise two
workers can reclaim and double-process the same document. See
`deployment-architecture.md` §3 for the queue-durability reasoning.

```bash
docker run \
  --name clinical-kb-worker \
  --restart unless-stopped \
  --env-file worker.env \
  clinical-kb-worker
```

Host requirements for the always-on instance:

- **Restart policy `always` / `unless-stopped`.** The worker exits non-zero on
  a fatal bootstrap error; the host must bring it back.
- **No scale-to-zero.** The worker _is_ the queue drain — if it scales to zero,
  `jobs_pending` never settles. Keep min instances = 1.
- No inbound port / health endpoint: liveness is "process is up + queue is
  draining", observed via `reindex:health` (step 3), not an HTTP probe.

### Secrets and env (`worker.env`)

Inject at run time from the host's secret store. **Never** bake these into the
image or commit them. Each environment (production / staging / CI) uses
**separate** service-role and OpenAI keys.

The worker's required set is **narrower than the app's** — it does **not** need
the client publishable key (build-time, app bundle only) or
`RAG_QUERY_HASH_SECRET` (app instrumentation only).

**Required — the worker fails closed without these:**

| Variable                    | Sensitivity  | Notes                                                  |
| --------------------------- | ------------ | ------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`  | public       | `https://sjrfecxgysukkwxsowpy.supabase.co`             |
| `SUPABASE_SERVICE_ROLE_KEY` | **critical** | admin client; RLS is service-role-only                 |
| `OPENAI_API_KEY`            | **critical** | embeddings + image captioning; probed at startup       |
| `SUPABASE_PROJECT_REF`      | low          | pins `check:supabase-project` (`sjrfecxgysukkwxsowpy`) |
| `SUPABASE_PROJECT_NAME`     | low          | `Clinical KB Database`                                 |

**Defaulted — override only to tune; safe values ship in `src/lib/env.ts`:**

- Buckets: `SUPABASE_DOCUMENT_BUCKET=clinical-documents`,
  `SUPABASE_IMAGE_BUCKET=clinical-images`.
- Models/dimensions: `OPENAI_EMBEDDING_MODEL=text-embedding-3-small`,
  `EMBEDDING_DIMENSIONS=1536` (must match `vector(N)` in
  `supabase/schema.sql` — a mismatch is caught by the startup dimension probe),
  `OPENAI_VISION_MODEL=gpt-5.6-terra` and
  `OPENAI_INDEXING_MODEL=gpt-5.6-terra`.
- `RAG_PROVIDER_MODE=auto` (OpenAI with graceful source-only fallback).
- Worker knobs (all defaulted): `WORKER_POLL_MS=30000`,
  `WORKER_BATCH_SIZE=3`, `WORKER_CONCURRENCY=1`, `WORKER_MAX_ATTEMPTS=3`,
  `WORKER_STALE_AFTER_MINUTES=45`, `WORKER_VISION_CONCURRENCY=4`, and the
  captioning budgets. See `.env.example` (lines under `WORKER_*`) for the full
  annotated list.
- `PYTHON_BIN=python` — do not set a Windows `TESSERACT_CMD` path; the container
  resolves both from the venv/PATH.

---

## 3. Verify

1. **Startup.** Logs show `Clinical KB worker started. worker=<id>`. If a
   `PDF/OCR prerequisite warning` appears, the Python/Tesseract layer did not
   build correctly — rebuild the image (do not leave it running; OCR fallback
   will be silently unavailable).
2. **Queue drains.** With documents queued, watch the counts settle:

   ```bash
   npm run reindex:health   # jobs_pending → 0, jobs_processing → 0
   ```

   `jobs_pending` moving down (and reaching 0 once the backlog clears) confirms
   the single always-on instance is draining the queue. `documents_indexed`
   should climb correspondingly.

3. **Stuck queue?** If `jobs_processing` stays non-zero with no progress past
   the stale window, or jobs land in `jobs_failed`, use the operator recovery
   path (never raw SQL against live):

   ```bash
   npm run recover:ingestion            # dry run
   npm run recover:ingestion -- --apply # after reviewing
   ```

   This is fenced against retry/reindex overlap races. See
   [`reindex-runbook.md`](reindex-runbook.md) and
   `deployment-architecture.md` §3 (queue durability).

---

## Rollback

Redeploy the previous image tag. The worker holds no durable local state; all
artifact writes are idempotent per generation/chunk-key, and completion is
gated by the strict completion RPCs plus the edge agent, so a redeploy costs at
most one stale window of latency on any in-flight job and zero data loss.
