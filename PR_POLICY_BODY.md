## Summary

Hardens `RAG_RANKING_CONFIG` so a non-empty override fails closed instead of silently reverting or accepting pathological values.

- Evaluated ranking defaults are unchanged.
- Ranking formulas are unchanged.
- Valid partial overrides still deep-merge onto defaults.
- Invalid JSON, unknown keys, invalid types, and out-of-domain numbers now throw `Invalid RAG_RANKING_CONFIG`.

Validation domains:
- additive/multiplier ranking magnitudes: `0..10`
- unit-interval thresholds/pivots: `0..1`
- freshness ages/ramp: bounded positive/non-negative years
- freshness penalties: `-1..0`

The `0..10` ranking ceiling is intentionally much wider than current evaluated values (generally <1) while preventing accidental extreme values from overwhelming retrieval signals.

RAG impact: no retrieval behaviour change — fail-closed validation of RAG_RANKING_CONFIG only; evaluated defaults and scoring formulas are unchanged when the override is absent or valid.

## TDD evidence

RED was reproduced against the exact pre-fix resolver: malformed JSON failed the new contract because the resolver silently fell back rather than throwing. Branch tests cover unknown nested keys, invalid types, pathological magnitudes, threshold domains, and freshness domains.

## Verification

- [x] `npm run test` — 811 files passed, 9771 tests passed, 4 skipped (local, 2026-08-23)
- Verification not run: `npm run verify:pr-local` — Static PR checks already passed on this head; remaining hosted Unit coverage / Lighthouse budget were still in flight at review time and are not required for this validation-only change.
- UI verification not run: no UI, routing, or styling change.

## Risk and rollout

- Risk: a malformed or out-of-domain `RAG_RANKING_CONFIG` now throws at process start instead of silently using defaults. That is the intended fail-closed behaviour. Hosts with an invalid override will fail to boot rather than rank with an unnoticed fallback.
- Rollback: revert this PR; the previous resolver ignored malformed JSON and unknown keys and clamped some negatives to 0.
- Provider or production effects: None. No provider calls, schema, or deployment topology changes.
- RAG impact: no retrieval behaviour change — configuration validation only; evaluated defaults and retrieval scoring formulas are unchanged when `RAG_RANKING_CONFIG` is absent or valid.

## Clinical Governance Preflight

- [x] Source-backed claims still require linked source verification before clinical use
- [x] No patient-identifiable document workflow was introduced or expanded without explicit governance approval
- [x] Supabase target remains `Clinical KB Database` (`sjrfecxgysukkwxsowpy`)
- [x] Service-role keys and private document access remain server-only
- [x] Demo/synthetic content remains clearly separated from real clinical sources
- [x] Source metadata, review status, and outdated/unknown-source behavior remain conservative
- [x] Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed

## Notes

Review + unblock pass for PR 2315. No retrieval-formula change. Invalid overrides now fail closed.
