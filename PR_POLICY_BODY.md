## Summary

Clean re-delivery of the intentional typography audit tip from closed PR #1185, cherry-picked onto current `main`.

Scope (production CSS + design mockups only):

- Broader `--font-sans` fallback stack in `globals.css` (Geist remains first)
- Truncation `min-w-0` on recent-search chips
- Remove redundant `leading-tight` on bedside sheet title
- `tabular-nums` on clinical console abbrev

Nested sheet/modal titles in the answer-evidence mockup stay at `h3` under section `h2` so heading hierarchy remains `h1 → h2 → h3`.

Please keep #1185 closed; this is the mergeable supersede.

RAG impact: no retrieval behaviour change — CSS font stack and mockup markup only.

## Verification

- [x] `npm run verify:cheap` on the clean cherry-pick tip (lint/typecheck/static gates; unit suite)
- Verification not run: `npm run verify:pr-local` (typography-only CSS/mockup; cheap gate covered lint/typecheck/unit)
- UI verification not run: `npm run verify:ui` (font-stack fallback + mockup class changes; residual risk visual-only)
- Verification not run: `npm run verify:release` / provider-backed evals (no clinical/retrieval/provider surface)

## Risk and rollout

- Risk: Low. Visual/CSS + design-mockup only; no API, auth, retrieval, or schema changes.
- Rollback: Revert this PR.
- Provider or production effects: None

## Notes

- #1185 was closed as contaminated (committed conflict markers from archive checkpoint).
- Temporary `PR_POLICY_BODY.md` restores the correct description after a stale sync overwrite; safe to delete after Sync PR policy body is green.
