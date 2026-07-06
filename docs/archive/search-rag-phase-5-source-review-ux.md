# Phase 5: Source Review UX

## Purpose

Make evidence review fast, consistent, clickable, and accessible across desktop and mobile.

## Implemented

- Added policy-aware copy output in `src/lib/answer-render-policy.ts`.
- Changed answer copy behavior to copy a clinical answer draft with source status, source links, and warnings.
- Renamed the misleading source-preview action from `Open PDF drawer` to `Open source page`.
- Made source capsule preview rows independently clickable.
- Preserved document, page, and chunk navigation in source-preview links.
- Made evidence-map rows expose explicit `Open source` links when `AnswerEvidenceMapRow.href` is available.
- Added keyboard-visible focus styles and minimum touch-target-friendly link/button styling for new source actions.
- Allowed source-gap answers to open nearby-source review when policy-approved sources exist, even without a trusted best source.
- Kept desktop and mobile evidence navigation aligned through the same render-policy model and evidence tab ordering.

## Copy behavior

The primary answer copy action is now labeled `Copy with sources` and has the accessible name `Copy answer with source status`.

Copied text includes:

- clinical answer draft heading
- review warning
- answer text
- render trust/source status
- source labels and document links
- warnings/source-gap notes

## Validation coverage added

- Render-model copy text includes source-review metadata.
- Source capsule preview rows expose direct document links.
- Evidence-map rows expose direct open-source actions.
- Source-backed smoke test verifies:
  - preview source row href includes document/chunk
  - copy-with-sources writes source metadata to the clipboard
  - mobile source panel exposes document/chunk links
  - mobile evidence-map panel exposes `Open source`
  - touch targets remain large enough

## Checks run

- `npm run test -- tests/answer-render-policy.test.ts tests/answer-formatting.test.ts tests/clinical-dashboard-search-utils.test.ts`
  - Passed: 18 tests.
- `npm run typecheck`
  - Passed.
- `npm run check:production-readiness`
  - Passed.
- `npm run ensure`
  - Confirmed local app at `http://localhost:4298`.
- Focused Playwright smoke:
  - `npx playwright test tests/ui-smoke.spec.ts -g "demo answer flow reaches a source-backed answer" --project=chromium --workers=1 --timeout=60000`
  - Passed.
- `npm run verify:ui`
  - Passed: 39 Chromium UI tests.

## Remaining risk

- This phase improves source review UX only. It does not fix the known retrieval misses from Phase 0.
- Clicking source links depends on the document viewer route preserving page/chunk focus, which is covered by existing viewer smoke tests but should remain part of future source-navigation regressions.
