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

## Dev Drive Stale Worktree Pruning (Inbox ec356a7d)

When operating across concurrent agent sessions on a Dev Drive (e.g. `D:\`), duplicate `node_modules` installations across dozens of worktrees consume significant disk capacity (~0.89 GB per worktree). Stale worktrees from already-landed branches must be safely identified and pruned to reclaim storage without risking active or unmerged work.

### Safe Pruning Workflow

1. **Scan landed candidates in list-only mode:**
   Run the worktree cleanup script when no other Codex, Gemini, or Claude sessions are active:

   ```powershell
   node scripts/clean-worktree.mjs --merged --squashed
   ```

2. **Inspect candidate confidence reports:**
   Review the confidence diagnostic printed for each candidate worktree.
   - **Skip any candidate marked `NOT fully corroborated`:** This label indicates that while a patch-ID match inferred landing, some working tree files still differ from `origin/main` (frequently base churn, but potentially unmerged edits).
   - Only consider candidates confirmed fully merged or squashed into `origin/main` with zero local unpushed commits.

3. **Re-verify each candidate immediately before removal:**
   Never remove worktrees blindly. Actively inspect the candidate path:

   ```powershell
   git -C <worktree-path> status --short --branch
   git log --right-only --cherry-pick origin/main...<worktree-head>
   ```

   Confirm that the worktree has 0 uncommitted changes and 0 unmerged commits ahead of `origin/main`.

4. **Verify process and lease locks:**
   Ensure no background test runner, dev server, Playwright instance, or repository run coordinator lease holds the candidate worktree path.

5. **Prune the worktree safely:**
   Remove the verified landed worktree:

   ```powershell
   git worktree remove <worktree-path>
   ```

   Alternatively, rerun `node scripts/clean-worktree.mjs --merged --squashed --remove` only after verifying all candidate confidence reports.

### Safety Stop Rules

- **Never pass `--force` to `git worktree remove`:** If git refuses removal due to untracked or modified files, stop and inspect the worktree manually.
- **Never remove a worktree that is ahead of `origin/main`:** Even if a prior scan reported 0 commits ahead, always re-verify before deleting.
- **Ignore active session worktrees:** Ignore worktree directories on `C:` or other dedicated drives belonging to active Antigravity / Codex sessions.

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
