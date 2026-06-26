# Adaptive RAG reindex runbook

Use this sequence when applying RAG indexing changes to the live `Clinical KB Database` Supabase project.

## Consolidated pipeline command

The quickest way to run a full reindex cycle is the consolidated pipeline command:

```sh
npm run reindex
```

This single command encapsulates the full safe sequence below: it confirms the target project, checks Supabase health, snapshots reindex health, applies ingestion queue recovery (with an interactive confirmation prompt), runs the worker, and repeats until the queue is clear or the round limit is reached.

Options:

| Flag | Default | Description |
|---|---|---|
| `--yes` | off | Skip confirmation prompts (non-interactive / CI use) |
| `--max-rounds` | 10 | Maximum worker iterations before stopping |
| `--limit` | 20 | Recovery action limit per round |

```sh
# Non-interactive, up to 5 worker rounds:
npm run reindex -- --yes --max-rounds 5
```

## Manual safe sequence

If you prefer to run each step by hand (or need to apply a migration in between):

1. Confirm the target project is `sjrfecxgysukkwxsowpy`.
2. Run `npm run supabase:recovery-status`.
3. Apply any pending local migration only after the probe succeeds.
4. Run `npm run reindex:health`.
5. If stale or failed jobs exist, run `npm run recover:ingestion` and confirm the prompt.
6. Run `npm run worker:once` with the conservative defaults from `.env.example`.
7. Repeat `npm run reindex:health` and `npm run worker:once` until the queue is clear.
8. Run indexing and RAG evals only after documents have adaptive chunks and retrieval synopses.

## In-app mutation safety

Document and bulk full reindex requests run a server-side safety preflight before resetting indexes or queueing jobs.
If the response includes `safety.safeToRun: false`, do not retry repeatedly. Use `safety.reason`:

- `supabase_unavailable`: pause reindexing and rerun `npm run supabase:recovery-status`.
- `active_jobs`: wait for pending or processing jobs to finish before retrying.
- `stale_processing_jobs`: run `npm run recover:ingestion -- --apply --limit 20`, then rerun `npm run reindex:health`.

The preflight response also includes active job counts and job metadata for operator review.

## Do not do this

- Do not run workers while Supabase SQL probes are timing out.
- Do not raise worker concurrency during recovery.
- Do not run retrieval or RAG evals against a partially reindexed corpus.
- Do not enable inline enrichment during recovery unless core indexing is stable.
- Do not run imports, reindexing, queue recovery mutations, or evals when `npm run supabase:recovery-status` reports `supabase_unavailable`.
- Do not use `--force-large-import` unless Supabase health is stable and you have intentionally chosen a larger import wave.

## Recommended recovery defaults

```env
WORKER_CONCURRENCY=1
WORKER_BATCH_SIZE=3
WORKER_POLL_MS=30000
WORKER_INLINE_ENRICHMENT=false
WORKER_HEALTH_BACKOFF_MS=120000
MAX_IMPORT_JOBS_PER_RUN=5
MAX_IMPORT_BYTES_PER_RUN=157286400
WORKER_PROGRESS_UPDATE_MIN_INTERVAL_MS=60000
WORKER_MAX_CAPTIONED_IMAGES_PER_DOCUMENT=15
WORKER_MAX_CAPTIONED_IMAGES_PER_PAGE=2
```

Set `WORKER_INLINE_ENRICHMENT=true` only after core chunk indexing is stable and the Supabase project is not returning timeout or `522/544` responses.

Open a Supabase support ticket if `npm run supabase:recovery-status` cannot complete its health probe for more than 30 minutes while local workers are stopped.
