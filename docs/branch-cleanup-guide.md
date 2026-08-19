# Branch Cleanup Guide

Last reviewed: 2026-07-04

This guide defines the safe branch cleanup path for this repository. It is written for branch hygiene only: do not use it to discard source work, resolve merge conflicts, merge product changes, or rewrite history.

For historical cleanup snapshots (frozen branch inventories and progress logs), see `docs/archive/`.

## Goals

- Keep `main`, the current working branch, and any branch with useful content not yet represented on `main`.
- Delete local or remote branches only when their patch content is already on `main` or the branch is explicitly not useful.
- Preserve dirty worktrees, checked-out branches, detached review worktrees, and uncommitted user work.
- Avoid force pushes, rebases, resets, broad cleanup, or deleting unknown branch state.

## Safety Rules

Before deleting anything:

**Precondition — the clone must have full history. Check this before every other step on this
page, including the reconciliation preflight below:**

```bash
git rev-parse --is-shallow-repository       # must print false
git fetch --unshallow --tags origin         # if it printed true

git config --get-all remote.origin.fetch    # must map refs/heads/*
git remote set-branches origin '*'          # if it names a single branch
git fetch --prune origin                    # then repopulate
```

**Complete history is not complete branch coverage — check both.** `git clone --depth 1` implies
`--single-branch`, which pins `remote.origin.fetch` to the one cloned branch. `git fetch --unshallow`
converts the history, so `--is-shallow-repository` flips to `false` and the first check passes, but
it does **not** widen the refspec: every other branch stays invisible locally. Measured in a fixture
with `main` and `feature`, `git ls-remote --heads origin` listed both while `refs/remotes/origin` held
only `origin/main`, and the sweep exited **0** reporting an empty branch list. An empty inventory is
not a safe failure — it reads as "nothing to clean up", and where `origin/main` itself is missing every
comparison fails into `0/0`, making every branch look like a deletion candidate.

Every signal in this guide — ahead/behind, `--cherry-pick` patch-uniqueness, `git diff main...BRANCH`
— is derived from a **merge-base**. A shallow clone has a grafted root, so those results are wrong
_without erroring_: nothing fails, the numbers are simply fiction. Remote Claude Code sessions clone
shallow by default, so this is the normal state, not an edge case.

Measured 2026-07-29 (ledger `#109`): a session swept this repo with 74 of 2829 commits present. It
reported **90 of 91** branches as carrying unmerged work, and a stale local `main` as `ahead 52` with
`refusing to merge unrelated histories`. In a `--depth 1` clone the sweep exited **0** and named the
live checked-out branch as a deletion candidate with "no unique patch content" — a green run
recommending deletion of an active branch.

Both `npm run sweep:branch-ledger` and `node scripts/reconciliation-preflight.mjs` now refuse
outright unless the history is verified complete (`shallowCloneRefusal`, guarded in
`tests/repo-hygiene.test.ts`) — the preflight is included because it reports its own
merge-base-derived ahead/behind values. The sweep additionally refuses on a narrow refspec
(`branchCoverageRefusal`) and fetches an explicit `+refs/heads/*:refs/remotes/origin/*`, so an
ordinary run repairs its own coverage rather than reporting a partial inventory; with `--no-fetch`,
offline, or a failed fetch, it refuses instead. For the preflight the refusal lives in the exported
`collectReconciliationState`, not in its CLI, so `scripts/reconciliation-evidence-pack.mjs` cannot
write a `status: "complete"` pack around shallow numbers by calling the collector directly. The raw
`git` commands below have no such protection, so verify the precondition yourself before trusting
them.

**Never delete a branch, or report one as unmerged, from a shallow clone.**

For broad multi-worktree reconciliation, then run `node scripts/reconciliation-preflight.mjs` and follow
[`docs/reconciliation-playbook.md`](reconciliation-playbook.md). The preflight is report-only and
does not replace the fetch/approval and per-branch content proof below.

1. Fetch and prune:

   ```powershell
   git fetch --prune origin
   ```

2. Confirm `main` and `origin/main`:

   ```powershell
   git rev-parse main origin/main
   ```

3. Check current worktree state:

   ```powershell
   git status --short --branch
   ```

4. Inspect worktrees:

   ```powershell
   git worktree list --porcelain
   ```

5. Filter candidates through the review ledger before inspecting branch diffs:

   ```bash
   npm run ledger:lookup -- BRANCH_NAME --scope branch-cleanup
   ```

   The lookup resolves the HEAD itself and matches the abbreviated SHAs that older records used, which a literal regex on the full SHA silently missed. Skip the branch only on an `ALREADY REVIEWED` verdict — that requires the same branch/ref, reviewed HEAD, and an exact `branch-cleanup` scope together; a branch-name-only match is not enough, and a `branch-cleanup-deletion-pending` row must not match. Re-review when the HEAD changed or the user explicitly asks for a fresh pass. `npm run sweep:branch-ledger` applies this filter across every remote branch in one pass.

6. For each remaining candidate branch, check whether it has patch content not on `main`:

   ```powershell
   git log --format="%h %s" --right-only --cherry-pick main...BRANCH_NAME
   git diff --name-status main...BRANCH_NAME
   ```

Delete a branch only when the cherry-pick-aware log is empty, or when the branch is deliberately rejected as not useful after review.

Never print raw process command lines while checking whether a worktree is active. Use PID/name/start
metadata or `node scripts/reconciliation-preflight.mjs --include-processes`; command-line arguments can contain
credentials.

## Recommended Cleanup Order

1. Fetch and inspect current branch state with the commands above.
2. Resolve each candidate's HEAD and skip unchanged completed reviews recorded in `docs/branch-review-ledger.md`.
3. For each remaining candidate branch, confirm patch-unique commits and file diffs against `main`.
4. Port, commit, or explicitly reject useful patch content before deleting any branch ref.
5. Record completed cleanup reviews with `npm run ledger:append -- --ref <branch> --head <full-sha> --scope branch-cleanup --outcome <o> --checks <c>`. The scope cell must be exactly `branch-cleanup` for a later sweep to treat it as complete; `branch-cleanup-deletion-pending` deliberately does not count.
6. Remove detached worktrees only when clean, unneeded, and absent from active `git worktree list` output.

## Dev Drive Stale Worktree Pruning (Inbox `ec356a7d`)

Worktrees accumulate across active multi-agent development fleets (e.g. on Dev Drive `D:` or secondary disks, where dozens of worktrees can hold ~19+ GB of duplicated `node_modules` at ~0.89 GB and ~50,000 files each). Stale worktrees compete for disk capacity, cause dependency drift, and contend on the cross-worktree test run coordinator lock (`scripts/run-heavy.mjs` / `scripts/test-run-lock.mjs`).

### Safety Rules for Worktree Pruning

- **Never pass `--force` to `git worktree remove`.** If git refuses removal due to untracked files, submodules, or uncommitted changes, that refusal is a critical safety signal, not an obstacle to override.
- **Never remove a worktree that is ahead of `origin/main` or has uncommitted work.** `git status --porcelain` in the candidate directory must be clean (`""`).
- **Never prune blind while agent sessions (Codex/Gemini/Claude) are active.** Sessions may have created new commits, modified files, or acquired test locks since the initial scan.
- **Ignore `C:` session worktrees entirely.** These paths belong to active Codex and Antigravity chat sessions.

### Step-by-Step Worktree Pruning Workflow

1. **Confirm fleet quiescence:**
   Ensure no background test runner, dev server, or agent session is active or holding an execution lease.

2. **Scan landed candidates (list-only preflight):**
   Run `clean-worktree.mjs` with `--merged` and `--squashed` to identify worktrees whose branch has landed on `origin/main` (either by direct ancestry or squash-merge patch-id equivalence):

   ```bash
   node scripts/clean-worktree.mjs --merged --squashed
   ```

   _(Note: `--merged` and `--squashed` are strictly list-only by default; they will never delete anything without `--remove`.)_

3. **Evaluate confidence ratings on each candidate:**
   - `proven`: Every commit on the branch is reachable from `origin/main` (`git merge-base --is-ancestor`).
   - `inferred from patch-id, corroborated`: The branch's full diff matches a squashed commit on `origin/main`, and all changed files are byte-identical to `origin/main`.
   - `inferred from patch-id, NOT fully corroborated`: The branch diff matched a squashed commit, but some changed files differ from `origin/main` (frequently normal base churn on append-only docs like `docs/outstanding-issues.md`). Review differences with `git diff origin/main...<branch>` before removing. Skip any candidate where you cannot confirm all unique work is landed.

4. **Execute bounded safe removal:**
   After verifying candidate confidence and confirming that trees are clean and not ahead of `origin/main`:

   ```bash
   # Bounded batch removal
   node scripts/clean-worktree.mjs --merged --squashed --remove --batch-size 5
   ```

   Or remove an individual verified worktree directly:

   ```bash
   git worktree remove <path>
   ```

5. **Prune disconnected or orphaned metadata:**

   ```bash
   npm run clean:worktree
   ```

## Merge-Loss Audit Verification (#311, #324)

Merge loss occurs when merge commits or manual conflict resolutions silently revert changes from previously landed PRs without failing tests (for example, bad merge commit `acf78bf` reverting PRs #1800, #1803, #1804, #1796, and #1811 because the reverts took each PR's tests at the same time).

The merge-loss audit tool was promoted into `scripts/audit-merge-loss.mjs` (#311) and provides verification of post-merge integrity (#324):

```bash
# Run advisory merge-loss audit over the default 14-day window on origin/main
npm run audit:merge-loss

# Audit a custom window or target branch
npm run audit:merge-loss -- --since 30 --ref origin/main

# Output findings as structured JSON
npm run audit:merge-loss -- --json

# Run in strict mode (exits non-zero on any finding)
npm run audit:merge-loss -- --strict

# Run self-tests directly
node scripts/audit-merge-loss.mjs --self-test
```

### Interpreting Findings

- **Advisory by design:** The audit exits `0` by default because an intentional revert is byte-identical at blob level to an accidental merge resolution revert. A finding is a prompt for human review, not an automatic defect.
- **Classification hierarchy:** Findings sort merge-resolution reverts first (high likelihood of accidental loss) before single-parent commits (usually deliberate reverts with explanatory commit messages).
- **Remediation:** If an accidental revert is confirmed, restore the lost files on a new branch and submit a PR to re-land the changes.

## Final Verification

After each cleanup pass:

```powershell
git fetch --prune origin
git branch --all --verbose --no-abbrev
git worktree list --porcelain
git status --short --branch
```

Expected invariant:

- `main` remains unchanged unless you intentionally merge or push there.
- The current dirty worktree remains untouched unless you explicitly choose to clean it.
- No branch with patch-unique commits is deleted unless its content was explicitly rejected or safely ported first.
