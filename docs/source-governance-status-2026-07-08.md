# Source-governance status & closeout — 2026-07-08

Read-only assessment of the Clinical KB source-governance metadata, closing out
the re-index / enrichment review. Live project `Clinical KB Database`
(`sjrfecxgysukkwxsowpy`), 2065 indexed documents.

## Live state (measured)

| Field                        | Distribution                                                            |
| ---------------------------- | ----------------------------------------------------------------------- |
| `document_status`            | current 1452 (70.3%) · review_due 481 (23.3%) · unknown 132 (6.4%)      |
| `clinical_validation_status` | locally_reviewed 1935 (93.7%) · unverified 130 (6.3%; 72 WA, 58 non-WA) |
| `extraction_quality`         | good 2065 (100%) · poor 0 · partial 0                                   |

The corpus is healthy: full extraction coverage, 93.7% locally reviewed, and
the residual `review_due`/`unverified`/`unknown` buckets are small and largely
**accurate** (review-due sources genuinely are due; unverified sources genuinely
lack detectable local document-control endorsement).

## Three corrections to earlier framing

1. **`document_status = "unknown"` triggers no governance warning.**
   `sourceGovernanceWarnings` ([src/lib/source-governance.ts](../src/lib/source-governance.ts))
   only warns on `outdated` (danger) and `review_due` (warning). "Unknown" is
   silent as a warning, though it renders as "Review status unknown" in the
   provenance line. So resolving unknown statuses improves the **displayed
   provenance**, not the warning rate.

2. **The ~92% `source_governance_warning_rate` is a per-answer compounded
   metric, not a per-document debt.** Each answer cites several sources and warns
   if _any_ is `review_due`/`unverified`/etc.; a ~23% per-document `review_due`
   rate compounds to a high per-answer rate. This is conservative-by-design
   clinical behaviour, not a data-quality bug.

3. **The `verification` metadata field is vestigial.** The consumed governance
   fields are `document_status`, `clinical_validation_status`,
   `clinical_validation_evidence`, and `extraction_quality` (the required set in
   [scripts/audit-source-governance.ts](../scripts/audit-source-governance.ts)).
   `verification` is not read by the warning logic; a null `verification` is not
   a governance gap.

## Shipped

- **Unknown-status derivation pass** (PR #387, branch `claude/derive-unknown-status`).
  Derives `document_status` for the date-inferable subset of the 132 unknowns:
  `publication_date + 3y` (WA standard, env-overridable) → current/review_due.
  **Applied 2026-07-08.** 55 statuses written (23 current, 32 review_due);
  verified live: current 1452→1475, review_due 481→513, unknown 132→77 (the 77 =
  76 date-less + 1 future/mis-extracted date guarded). Every write is flagged
  (`review_date_inferred`) and reversible via the `unknown_status_cycle_v1`
  version stamp.

## Decisions

1. **Apply the unknown-status pass — DONE (applied 2026-07-08).** Encoded the
   policy assumption (3-year review cycle from publication when no explicit
   review date exists). Conservative (32 → review_due; never asserts false
   currency). Reverse with:
   `update documents set metadata = metadata - 'review_date' - 'review_date_inferred' - 'unknown_status_derivation_version' - 'unknown_status_derivation_basis' - 'unknown_status_derived_at', ... set document_status back to 'unknown' where metadata->>'unknown_status_derivation_version' = 'unknown_status_cycle_v1'`
   (or re-derive from source).

   **Now automatic:** the cycle inference is folded into the canonical governance
   backfill's `deriveMetadata` ([scripts/backfill-source-metadata.ts](../scripts/backfill-source-metadata.ts),
   `npm run backfill:source-metadata`), so any governance refresh derives
   cycle-based statuses for new docs without a separate pass. Date-less docs
   still resolve to `unknown` and **remain visible to users** — governance never
   hides or refuses an undated source (only `outdated` is penalised, which this
   inference never produces). The standalone `backfill:unknown-status` pass
   remains available for targeted re-runs.

2. **Validation-approval policy for the 130 `unverified` docs — accept as-is
   (chosen default).** The "not locally validated" caveat is clinically honest
   for these sources; no reclassification. Options considered:
   - _Accept as-is_ (recommended default): the "not locally validated" caveat is
     clinically honest for these sources; no change.
   - _Manual approval workflow_: a reviewer marks specific sources `approved`
     (evidence-backed). Highest trust, highest effort; a governance decision.
   - _Auto-detection widening_ (not recommended): loosening the
     `clinical_validation_evidence` patterns to reclassify more docs as
     `locally_reviewed` risks **wrongly clearing a clinical caveat** — a safety
     concern. Avoid without a labelled sample and eval.

## Not worth doing (evidence-based)

- **Full corpus re-index** — retrieval is lexical-fast-path dominant
  (`embedding_skipped_rate = 1.0`), recall metrics are at ceiling, and extraction
  is 100% good, so a re-index can only hold the line, not measurably improve.
  See the shadow-harness design ([docs/reindex-shadow-harness-design.md](reindex-shadow-harness-design.md))
  — keep it as a dormant tripwire for future chunking changes, do not run now.

## How to re-measure

- `npm run audit:source-governance` — full read-only breakdown (statuses,
  validation, extraction, label coverage, required-metadata gate).
