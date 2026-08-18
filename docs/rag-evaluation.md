# RAG Evaluation and Retrieval Contracts

This document specifies the RAG evaluation framework, runtime retrieval row contracts, and defensive schema invariants that protect clinical answer generation and source governance across migrations and database drift.

## Overview

The Database RAG pipeline combines vector similarity and full-text keyword retrieval over verified clinical sources. Because retrieved rows directly feed ranking, citation synthesis, and clinical safety assertions, retrieval output is treated as untrusted runtime data rather than a compile-time guarantee.

Evaluation and contract enforcement operate at three distinct layers:

1. **Offline contract tests:** Deterministic unit tests and AST/runtime shape assertions (`tests/rag-*.test.ts`, `tests/rag-retrieval-row-contract.test.ts`) that guard ranking formulas, imputation rules, and schema contracts offline.
2. **Golden-set evaluation harness:** 36-case golden retrieval evaluation suite (`scripts/eval-retrieval.ts`, `scripts/fixtures/rag-retrieval-golden.json`) that verifies hit rates, recall, and reciprocal rank against reference queries.
3. **Provider-backed live evaluation:** Live quality gates (`npm run eval:quality`, `scripts/eval-quality.ts`) and Sunday canary sweeps (`.github/workflows/eval-canary.yml`) operating under approval-gated cost and rate-limit constraints with the public-owner sentinel (`00000000-0000-0000-0000-000000000000`).

---

## Runtime Retrieval Row Contracts

Retrieval rows returned by Supabase Remote Procedure Calls (`match_document_chunks_v2`, `match_document_chunks_hybrid_v2`, `match_document_chunks`) are validated at runtime via Zod schemas in `src/lib/rag/rag-row-contracts.ts` before entering the ranking or synthesis pipelines (`rag.ts`).

### Asymmetric Schema Architecture

The retrieval row contract uses an asymmetric validation strategy:

- **Strict on ranking, identity, and evidence fields:** Required fields (`id`, `document_id`, `title`, `file_name`, `chunk_index`, `content`, `image_ids`, `images`, `source_metadata`) must strictly conform to expected types. Strings must be non-empty, and numeric scores (`similarity`, `text_rank`, `hybrid_score`, `rrf_score`) must be numbers or nullish (rejecting numeric strings).
- **Loose on additive and versioned columns (`z.looseObject`):** RPC versions differ in supported columns (for example, `retrieval_synopsis` is omitted in older base functions, while `document_labels` and `document_summary` appear in newer versions). `z.looseObject` preserves unknown keys rather than stripping them, ensuring that schema additions do not cause data loss or breaking failures.

---

## Defensive `.nullable()` Source Metadata Schema Invariants (#343)

`source_metadata` carries clinical provenance, review dates, document status, clinical validation status, and authority tiers. It is governed by strict schema invariants defined in `sourceMetadataSchema` (`src/lib/rag/rag-row-contracts.ts`).

```typescript
const sourceMetadataSchema = z
  .record(z.string(), z.unknown(), {
    message: "source_metadata must be a JSON object",
  })
  .nullable();
```

### 1. `.nullable()` vs `.nullish()` (Presence Guarantee)

- **The Invariant:** `source_metadata` is explicitly pinned as `.nullable()`, **not** `.nullish()`.
- **The Rule:** The key `source_metadata` **must be present** in the RPC result row (holding either a valid JSON object `Record<string, unknown>` or explicit `null`).
- **Why Presence is Mandatory:** If an RPC function definition drifts or drops the `source_metadata` column from its `SELECT` statement, a loose `.nullish()` schema would treat the omitted key (`undefined`) as valid. Downstream citation handlers (`src/lib/citations.ts`, `src/lib/source-metadata.ts`) would then silently fall back to default "unknown" governance states (such as unknown document status or unverified review date).
- **Fail-Loud Protection:** Omitting `source_metadata` triggers an immediate `RetrievalRowShapeError`, halting synthesis loudly instead of producing silently degraded clinical citations.

### 2. Structural Object Validation vs Database Constraints

- In `supabase/schema.sql`, `documents.metadata` is defined as `not null jsonb default '{}'::jsonb`.
- However, PostgreSQL does not enforce object structure on raw `jsonb` columns without an explicit `check (jsonb_typeof(metadata) = 'object')` constraint, permitting JSON arrays (`[1, 2, 3]`), strings, booleans, or numeric scalars.
- `sourceMetadataSchema` structurally enforces that any non-null `source_metadata` must be a JSON object (`z.record(z.string(), z.unknown())`), rejecting non-object JSON values before they reach downstream components.

### 3. Accepted vs Rejected Value Matrix

| Value in RPC Row                                               | Contract Result | Downstream Handling                                                |
| :------------------------------------------------------------- | :-------------- | :----------------------------------------------------------------- |
| `{"document_status": "current", "review_date": "2026-12-01"}`  | **Accepted**    | Parsed via `normalizeSourceMetadata()`; governance badges rendered |
| `{}`                                                           | **Accepted**    | Empty object normalized with fallback governance defaults          |
| `null`                                                         | **Accepted**    | Handled via `normalizeOptionalSourceMetadata() -> null`            |
| Key omitted (`withoutColumn("source_metadata")` / `undefined`) | **REJECTED**    | Throws `RetrievalRowShapeError` (RPC column drift detected)        |
| Non-object JSON: array (`[1, 2, 3]`)                           | **REJECTED**    | Throws `RetrievalRowShapeError` ("must be a JSON object")          |
| Non-object JSON: primitive string, number, boolean             | **REJECTED**    | Throws `RetrievalRowShapeError` ("must be a JSON object")          |

---

## Privacy-Preserving Error Handling

Retrieval rows contain confidential clinical text and document extracts. To protect patient privacy and clinical source confidentiality:

- `RetrievalRowShapeError` formats error messages containing **only** Zod issue paths, error codes, and the RPC name.
- Raw row values, titles, file names, and snippet contents are strictly excluded from error messages to prevent leakage into error logs or client error responses.
- Reported issues are capped at `MAX_REPORTED_ISSUES = 5` with an `"and X more"` summary to prevent log flooding during structural outages.

---

## Provenance and Derived Similarity Tagging

When document summaries or synthetic results are constructed outside vector retrieval (such as `buildDocumentSummaryResults` in `rag-row-contracts.ts`), similarity is tagged with explicit provenance:

- `similarity: 1` is assigned alongside `similarity_origin: "document_context"`.
- This ensures constant document-context similarity is transparently distinguished from measured vector similarity or `synthetic_text` (which carries medium confidence caps per clinical hazard analysis H5a).

---

## Verification and Testing

Schema contracts and `.nullable()` invariants are verified by:

- `tests/rag-retrieval-row-contract.test.ts`: Comprehensive unit tests covering valid rows, missing columns, dropped `source_metadata`, non-object metadata payloads, and score type invariants.
- `npm run verify:pr-local`: PR verification gate ensuring all RAG contracts and fixture checks pass before handoff.
