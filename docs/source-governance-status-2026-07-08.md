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
  Live dry-run: 55 derived (23 current, 32 review_due), 76 date-less left
  unknown, 1 future/mis-extracted date guarded. Conservative, flagged
  (`review_date_inferred`), and reversible via the `unknown_status_cycle_v1`
  version stamp. **Not applied** — see decision 1.

## Open decisions (owner: maintainer — not code)

1. **Apply the unknown-status pass?** `npm run backfill:unknown-status -- --apply`
   writes 55 statuses. It encodes a policy assumption (3-year review cycle from
   publication when no explicit review date exists). Net effect is conservative
   (32 → review_due, flags for review; never asserts false currency). Improves
   provenance-line clarity for those 55 docs; does not change the warning rate.

2. **Validation-approval policy for the 130 `unverified` docs.** Options:
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
