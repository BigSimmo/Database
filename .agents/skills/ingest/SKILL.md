---
name: ingest
description: Triage and verify Database document ingestion, extraction, queueing, retries, workers, batches, and failure recovery. Use for uploads, ingestion jobs, extraction defects, worker reliability, or queue behavior.
---

# Ingest

1. Map the local path from upload and validation through queue, worker, extraction, persistence, and status reporting.
2. Reproduce with fixtures, unit tests, or mocked/local queue state before considering live services.
3. Check idempotency, retry limits, partial failure, cancellation, owner scope, file safety, and observability.
4. Run the smallest ingestion or edge-function test plus production-readiness planning.
5. Treat workers, imports, live buckets, Supabase functions, and production queues as approval-required.
6. Report the failed stage, recovery safety, data-integrity risk, and exact gated next command.
