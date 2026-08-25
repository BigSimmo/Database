# Continuous Integration and Workflow Concurrency

## Overview and Concurrency Architecture

The repository enforces robust concurrency controls across GitHub Actions workflows to guarantee complete verification of merged commits and prevent cancellation storms on active pull requests.

### 1. Base-Branch Push Concurrency (`ci.yml`)

In `.github/workflows/ci.yml`, workflow concurrency is configured with a per-run group for pushes, schedules, and dispatches, while pull requests use ref-based deduplication:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ (github.event_name == 'workflow_dispatch' || github.event_name == 'schedule' || github.event_name == 'push') && github.run_id || github.ref }}
  cancel-in-progress: ${{ github.event_name != 'push' }}
```

- **Per-Run Concurrency Key for Base Branches:** Keying base-branch pushes on `github.run_id` ensures that every merged commit landing on `main` or `release/**` receives independent, isolated CI verification.
- **Queue Eviction Prevention:** GitHub Actions natively limits concurrency groups to at most one pending run. Without the per-run key, rapid merges evict waiting runs from the queue, destroying verification on intermediate commits.
- **Push Exemption from `cancel-in-progress`:** `cancel-in-progress: ${{ github.event_name != 'push' }}` explicitly guarantees that in-flight base-branch validation runs are never terminated by subsequent commits.

### 2. Eval Canary Concurrency (`eval-canary.yml`)

The weekly and on-demand evaluation canary runs with a dedicated single-flight group:

```yaml
concurrency:
  group: eval-canary
  cancel-in-progress: false
```

This prevents multiple live evaluation workflows from overlapping or colliding against the shared live Supabase/OpenAI evaluation test harnesses.

---

## Pre-Push Safety: Guard 2 (In-Flight CI Push Guard)

To eliminate the anti-pattern where frequent branch syncs (e.g. repeated `git merge origin/main` loops) restart CI and cancel in-flight runs via `cancel-in-progress` (#TF6TPJ, #HSSHRG), `scripts/guard-push.mjs` enforces **Guard 2: in-flight CI push guard**.

### Mechanism

1. **Active Run Detection:** When pushing to an open PR branch, `findInFlightCiRuns()` inspects the branch's workflow runs for required CI (`ci.yml`) in active states:
   - `pending`, `queued`, `in_progress`, `requested`, `waiting`.
2. **Push Interception:** If a required CI run is already in progress, `inFlightCiVerdict()` blocks the push before local refs are transmitted, logging the active run ID and PR number.
3. **Prevention of False-Red CI:** By preventing superfluous pushes while CI evaluates, Guard 2 ensures test suites complete and prevents `pr-required` from reporting false-red aggregate status caused by self-inflicted cancellations.
4. **Override:** In exceptional circumstances where an immediate force-update is required, set:
   ```bash
   SKIP_IN_FLIGHT_CI_GUARD=1 git push
   ```
