# CI Operations and Runner Usage Assessment

See also [continuous-integration.md](continuous-integration.md) for pre-push safety controls and Guard 2 in-flight CI push guard details.

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

## Branch Protection & Concurrency (#WE5G2C)

GitHub Merge Queue is the recommended architectural solution to eliminate behind-branch cancellation races during high merge frequency.

High-throughput merge bursts frequently trigger the **behind-branch race condition**:

1. When multiple pull requests (e.g., PR #1 and PR #2) are developed concurrently, both branch from an identical base commit (`main@C0`).
2. Both PRs execute their pre-merge CI suites against `C0` and pass.
3. PR #1 merges to `main`, advancing the branch head to `main@C1`.
4. PR #2 is now behind `main`. If PR #2 is merged without re-testing against `C1`, semantic or structural incompatibilities between PR #1 and PR #2 can break `main` (for instance, conflicting database schema assumptions, shared bundle budget thresholds, or incompatible API contracts).
5. Conversely, requiring branches to be strictly up-to-date before merging ("Require branches to be up to date before merging") forces PR authors and automated bots into repetitive rebase/merge loops. In a busy repository, this causes quadratic CI churn, runner queue starvation, and "behind-branch thrashing" where each completed test run is invalidated by an intervening merge before the PR can land.

### Speculative Merge Trains

GitHub Merge Queue stabilizes high-throughput merges by creating **speculative merge trains**:

- **Pipelined Verification:** When PRs are approved and enqueued, Merge Queue sequences them in a FIFO queue. Rather than waiting for PR #1 to merge before starting PR #2's CI run, it creates speculative merge refs:
  - Train Candidate 1: `main` + PR #1
  - Train Candidate 2: `main` + PR #1 + PR #2
- **Parallel Testing:** Both candidate states are validated in parallel. If Candidate 1 passes, PR #1 is merged directly. If Candidate 2 also passes, PR #2 merges immediately behind it without any additional verification delay.
- **Automatic De-queuing on Failure:** If Candidate 1 fails tests or exhibits merge conflicts, GitHub automatically drops PR #1 from the queue. Candidate 2 is immediately re-based and re-tested against `main` (i.e. `main` + PR #2) in a fresh train, preventing PR #1's failure from blocking or poisoning subsequent pull requests.

### Adoption Guidelines and Repository CI Requirements

To safely adopt GitHub Merge Queue for `main`:

1. **`merge_group` Event Trigger:** All required CI workflows must listen to the `merge_group` trigger. In `.github/workflows/ci.yml`, the event trigger is configured alongside `push` and `pull_request`:
   ```yaml
   on:
     push:
       branches: [main, "release/**"]
     pull_request:
       branches: [main, "release/**"]
     merge_group:
   ```
2. **Required Status Check Alignment:** Branch protection rules must require the consolidated gate (`PR required`) emitted during `merge_group` executions. The change scoping script (`scripts/ci-change-scope.mjs`) correctly handles `merge_group.base_sha` and `merge_group.head_sha`.
3. **Train Concurrency and Batch Size Bounds:**
   - **Maximum Concurrency:** Cap concurrent merge trains to 2–4 to stay well within runner pool limits and avoid starving ordinary pull requests.
   - **Minimum Batch Size:** Set to 1 for latency-sensitive merges during regular development.
   - **Merge Method:** Pinned to Squash and Merge to align with the repository's single-parent commit history discipline.
4. **Non-Reentrant Workflow Operations:** Workflows that perform branch-specific operations (e.g. branch cleanup or bot synchronization) must remain excluded from `merge_group` runs.

## CodeRabbit Review (#3F76JZ)

Automatic reviews require at least 10 repository stars on GitHub, not additional budget spend:

- **Eligibility Requirement:** As verified on PRs #2522 and #2542, CodeRabbit reports: _"This repository does not receive automatic reviews because it has fewer than 10 stars"_ (`Plan: Team`, repository star count: 0).
- **Not a Spending Cap Issue:** This is a categorical repository eligibility requirement, not a credit exhaustion or spending cap issue.
- **Operational Guidance:** Sessions should not treat a missing CodeRabbit review as a budget symptom. Do not undraft PRs solely in an attempt to trigger review, as draft status is skipped by CodeRabbit outright and undrafting mid-CI unnecessarily escalates workflows to the full heavy test set.

## Scheduled Workflows (#QSHHGK)

Scheduled automation runs on off-peak schedules to maintain repository baseline freshness:

- **Weekly Baseline Refresh:** `.github/workflows/bundle-budget-refresh.yml` runs weekly on Wednesdays at 04:40 UTC to prevent baseline staleness.
- **Early Visibility:** By executing cold builds (`check-bundle-budget.mjs --refresh-baseline`) and reporting metrics into a rolling GitHub issue, accumulated bundle growth from merged PRs is surfaced before crossing the 10% failure threshold.
- **Report-Only Invariant:** The workflow never auto-commits or pushes changes; baseline refreshes remain explicit, reviewed human pull requests.

## Operational Invariants (#055, #0H0S89, #6GW95D)

Repository stability depends on strict operational invariants that prevent automation drift, silent regression, and workspace destruction.

### Exact-SHA Release Protocol (#055)

Releases, production deployments (Railway, Supabase migrations), and full-confidence handoffs must target an **exact, verified commit SHA** (full 40-character hexadecimal hash), never a floating ref (such as `main`, `HEAD`, `origin/main`, or a release branch tag):

- **Floating Ref Non-Determinism:** A floating ref can advance between verification and deployment. If CI or preflight audits run against `origin/main`, but another commit lands before deployment kicks off, unverified code enters production.
- **Verification Protocol:** Record the candidate commit SHA before starting the release gate. Execute all local, provider-backed, cross-browser (Firefox/WebKit), and hosted CI checks (`PR required`) explicitly pegged to that SHA. Stop at the first actionable failure; re-runs must verify the exact repaired commit SHA.
- **Audit Verification:** Use `npm run audit:final-merge -- --dry-run --base-ref origin/main --head-ref HEAD --expected-head <exact-sha>` to verify exact-head match before landing.

### Lighthouse Baseline Freeze and Pinned-Browser CI Refresh (#0H0S89)

Performance baselines committed in `lighthouse-budget.json` are frozen:

- **No Local or Ad-Hoc Updates:** Never update `lighthouse-budget.json` from a developer laptop or arbitrary local machine. Differences in operating systems, CPU throttling, and font hinting make local Lighthouse measurements non-comparable to CI.
- **Pinned Browser Requirement:** Ambient runner-image Chrome versions float over time (e.g., HeadlessChrome/150 vs /151). All official Lighthouse measurements must resolve Playwright's pinned Chromium via `./.github/actions/setup-lighthouse-chromium` on `ubuntu-24.04`.
- **Dedicated CI Refresh Workflow:** Baselines may ONLY be refreshed via the dedicated `workflow_dispatch` trigger in `.github/workflows/ci.yml` (`refresh_lighthouse_baseline: true`).
- **No Self-Greening Gate:** The refresh workflow deliberately uploads the rewritten `lighthouse-budget.json` as an inspection artifact for human review. It NEVER auto-commits or auto-pushes, because a workflow that rewrites its own gate's baseline is a gate that can green itself and mask true regressions.

### Report-Only Worktree Fleet Inventory Policy (#6GW95D)

All tooling and scripts for inspecting worktree fleets and checkout directories (`scripts/clean-worktree.mjs`, `scripts/worktree-inventory.mjs`, `npm run worktrees:report`, `npm run worktrees:inventory`) must operate strictly in **report-only mode**:

- **Incident Precedent (#XCAX01):** On 2026-08-21, an aggressive automated cleanup sweep deleted an in-use worktree mid-session, destroying uncommitted developer work. Multi-agent workflows frequently hold open file handles across multiple roots (`.claude/worktrees`, `D:/Worktrees`, `.codex/worktrees`, `.gemini/antigravity/worktrees`).
- **Zero Mutation Invariant:** No fleet auditing script is permitted to delete, deregister, prune, or mutate developer checkouts. Any removal or mutation flag is rejected before adapters execute. Git prune operations are permitted only as read-only dry runs (`git worktree prune --dry-run -v`).
- **Deferred Cleanup:** Exact-path worktree removal remains deferred indefinitely. Any future cleanup must be executed via explicit human instruction targeting named, verified-dead directory paths with confirmed zero live process handles.
