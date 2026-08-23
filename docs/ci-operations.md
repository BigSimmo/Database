# CI Operations and Runner Usage Assessment

## Overview and Concurrency Architecture

In PR #2209 (merged `af2075a`), GitHub Actions workflow concurrency for base-branch (`main`, `release/**`) pushes was changed to key on `github.run_id`:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event_name == 'push' && (github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/heads/release/')) && github.run_id || github.ref }}
  cancel-in-progress: ${{ github.event_name != 'push' }}
```

### Background and Root Cause Closed

Prior to this change, base-branch pushes shared a single concurrency group (`CI-refs/heads/main`). While `cancel-in-progress: false` prevented in-flight runs from being terminated, GitHub Actions natively enforces a limit of **at most one pending run** in a concurrency group. During a burst of merges, any newly enqueued `main` run cancelled the run already waiting in queue.

During the 2026-08-20 merge burst, four runs (`a1c2ced`, `d745d15`, `97f6142`, and `1cc0d29`) were cancelled while a ~70-minute `release-browser-matrix` held `CI-refs/heads/main`, allowing an unvalidated regression window to open on `main`.

### Runner Usage and Capacity Measurement (#72G3XZ)

Keying each base-branch push on `github.run_id` eliminates the queue eviction defect entirely:

1. **Change Scoping Backstop:** The `changes` job (`scripts/ci-change-scope.mjs`) selectively schedules heavy jobs (e.g., `release-browser-matrix`, `static-heavy`, Docker builds). Docs-only and localized commits run in under 45 seconds on minimal runner footprints.
2. **Runner Minute Profile:** Concurrent runs on `main` do not create queuing bottlenecks across the repository fleet; each merge candidate receives complete, isolated validation.
3. **Safety Assertions:** Contract assertions in `tests/ci-cache-safety.test.ts` pin that base-branch pushes never cancel in-flight runs and retain the per-run concurrency group.
