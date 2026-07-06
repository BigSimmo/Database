# Phase 6 Re-Audit - June 29, 2026

## Scope

This pass re-checked the remediation work after the M2 merge and live Supabase migration. It covered:

- clinical answer and source-governance refusal paths,
- private source access and signed URL ownership checks,
- reindex mutation safety and M2 abandoned-generation recovery,
- current indexing health,
- lower-confidence remediation candidates,
- broad DocumentViewer papercuts.

The pass intentionally avoided dependency changes and unrelated local work.

## Current Evidence

Commands run during the pass:

- `npm run check:supabase-project` - passed against project ref `sjrfecxgysukkwxsowpy`.
- `npm run check:production-readiness` - passed. Warnings were limited to the expected local `.env.local` service-role marker and missing top-level `.env`.
- `npm run reindex:health` - passed with 2065 indexed documents, 0 queued/processing/failed documents, 0 pending/processing/failed jobs, and 69334 chunks with retrieval synopsis.
- `npm run reindex:cleanup-staged` - dry run passed with 0 eligible abandoned staged-generation documents and 0 artifact rows.
- `npm run check:indexing` - passed with 2065/2065 documents indexed, 0 chunk-count mismatches, 0 mixed-generation documents, 0 duplicate content-hash groups, 0 chunks missing embeddings, and 0 actionable failed or stuck jobs.

Recent release context before this branch:

- PR #91 merged M2 atomic reindex recovery to `main`.
- The live migration `20260629000000_abandoned_reindex_generation_recovery.sql` was applied.
- `cleanup_abandoned_document_index_generations(uuid, integer, boolean)` exists in the live project; anon cannot execute it and service-role execution is available through the staged cleanup script.
- The post-M2 dry run found no abandoned staged generations to clean.

## Re-Audit Results

### Clinical and Security-Sensitive Paths

- `/api/answer` and `/api/answer/stream` still require authenticated users outside demo mode, apply rate limits, resolve scope before generation, and return an explicit safe refusal when source-governance warnings contain danger severity.
- The refusal contract does not spread the original generated answer, sources, smart panel, or API plan into the response.
- Document and image signed URL routes still require ownership-scoped document checks before returning private storage URLs.
- Image and document retrieval paths continue filtering uncommitted index-generation metadata so staged reindex artifacts do not leak into normal viewer/search paths.
- Single-document and bulk reindex routes still check ingestion mutation safety before mutating index artifacts.

No confirmed clinical/security regression was found in this pass.

### Lower-Confidence Batch

No lower-confidence audit item was promoted to implementation without a reproducible failing behavior or a failing test. The remaining candidates should stay backlog-scoped until each has:

- a concrete observed defect,
- an owner,
- acceptance criteria,
- a focused regression test.

### DocumentViewer Papercuts

One low-risk papercut was implemented:

- The indexed-source search hit controls now use compact icon controls with retained accessible names and `title` text. This reduces visual crowding in the tight source-passage toolbar without changing keyboard or screen-reader operation.

Existing coverage confirmed these broader DocumentViewer behaviors are already represented in smoke tests:

- mobile pinned evidence appears before the PDF preview,
- viewer section anchors expose Evidence and PDF,
- failed PDF preview exposes retry recovery,
- private missing source states do not get stuck on loading copy,
- full-document source search opens and advances between hits.

Broad DocumentViewer restyling remains deferred. It should be a separate UX PR if new defects are reproduced through screenshots or user sessions.

## Remaining Caveats

- The local working tree includes an unrelated edit in `scripts/classify-documents.ts`; this pass does not include or modify it.
- Production readiness still warns when local secret-bearing env files are present; this is expected for local verification and should not be committed.
- RAG enrichment and deep-memory coverage are not at 100 percent, but the current indexing health checks do not classify that as a release blocker.

## Follow-Up Acceptance Criteria

Before closing future deferred items:

- Add a failing test or screenshot evidence for each lower-confidence or broad viewer issue.
- Keep clinical/source-governance changes paired with `npm run check:production-readiness`.
- Keep DocumentViewer UI changes paired with the focused smoke path and `npm run verify:ui`.
- Keep Supabase/indexing changes paired with `npm run check:supabase-project`, `npm run check:indexing`, and `npm run reindex:health`.
