## Summary

Offline **regression guard** for the shipped #019 fix (source-bound admission/discharge comparison fallback, landed 2026-07-27). Pins the fallback's conservative contract so a future change can't silently reopen #019. No behaviour change.

RAG impact: no retrieval behaviour change — test-only regression guard + an additive export seam; zero logic/ranking/ordering change. #019 stays resolved.

## Why

`buildAdmissionDischargeComparisonAnswer` (`src/lib/rag/rag-extractive-answer.ts`) emits a two-sided comparison **only** when each side yields a source-bound requirement fact from a **distinct** document (`sourceBoundComparisonFacts` + the narrow `admission`/`dischargeRequirementBindingPatterns`); otherwise it returns `null` so the caller terminates at an evidence gap rather than fabricating a one-sided comparison. That behaviour is currently covered only by the provider-backed canary — expensive and approval-gated. This adds a fast offline lock.

## Changes

- `tests/rag-admission-discharge-comparison-fallback.test.ts` — 3 guards:
  - both sides source-bound (distinct docs) → cites **both** documents;
  - only one side source-bound → `null` (evidence gap — intended conservative behaviour, not a drop);
  - both facts from the **same** physical document → `null` (same-document trap).
- one-line **export seam** on `buildAdmissionDischargeComparisonAnswer` (additive; `buildExtractiveAnswer`/`finalQualityGapAnswer`/the query predicates are already exported for tests).
- `scripts/guard-next-build.mjs` — under `CI`/`GITHUB_ACTIONS`, warn instead of hard-failing when the host reports <10 GiB RAM (fixes flaky Build on GitHub-hosted runners that report ~7.8 GiB); local/Docker still hard-fail. Plus `tests/guard-next-build.test.ts`.

The "loosen the binders" direction is the refuted approach — it re-opens #019 by admitting non-requirement prose; these tests fail fast if a change moves that way.

## Verification

- [x] `node scripts/run-vitest.mjs run tests/guard-next-build.test.ts tests/rag-admission-discharge-comparison-fallback.test.ts tests/extractive-answer-formatting.test.ts` → 3 files / 137 tests pass
- [x] `eslint --max-warnings 0` + `prettier --check` clean on touched files
- [x] `npm run check:branch-review-ledger` pass
- Verification not run: full `npm run verify:pr-local` / hosted Build pending on this tip after the CI RAM-guard fix

## Risk and rollout

- Risk: low — offline regression tests + additive export seam; build guard only softens the RAM hard-fail under CI/GITHUB_ACTIONS while keeping the local/Docker hard-fail.
- Rollback: revert this PR.
- Provider or production effects: None

## Clinical Governance Preflight

- [x] Source-backed claims still require linked source verification before clinical use
- [x] No patient-identifiable document workflow was introduced or expanded without explicit governance approval
- [x] Supabase target remains `Clinical KB Database` (`sjrfecxgysukkwxsowpy`)
- [x] Service-role keys and private document access remain server-only
- [x] Demo/synthetic content remains clearly separated from real clinical sources
- [x] Source metadata, review status, and outdated/unknown-source behavior remain conservative
- [x] Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed

## Notes

- No answer-generation / retrieval / ranking logic change. The export is test-only.
- Bugbot: zero `cursor[bot]` findings; no unresolved review threads to resolve.
