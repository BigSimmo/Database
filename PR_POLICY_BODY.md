## Summary

Six immutable inbox requests from the issue #2270 Part A session — five new findings and one update to `#6GW95D`. No canonical ledger edit: `docs/outstanding-issues.md` is untouched and these reconcile later. Replaces #2284, which was closed rather than untangled (reasons in its closing comment).

- **`verify:phone-chrome` reporting guidance** (P3, reframed from a P2 verifier defect after review). Selecting no browser stage for a docs-only diff is the intended, tested contract (`tests/verify-phone-chrome.test.ts` pins documentation-only work out of browser suites). A bare run on a clean tree still exits 0 identically to a full pass, so quoting it as proof for already-merged work is a false green. Action: document that proving phone chrome for work already on `main` requires `-- --files <scope>`; do not change the selector or the exit code.
- **`tests/gate-receipts.test.ts` is permanently two-red on the Windows workstation** (P3). Two cases `chmodSync(path, 0o755)` and assert the working-tree mode changes the signature. On this ReFS Dev Drive `core.fileMode` is `false` and `chmod` is a no-op, so they cannot pass. Reproduced on unmodified `main` at `73b1e71a0`. It also stops `verify:pr-local` before `build`, `check:bundle-budget` and the RAG fixture checks.
- **The Claude `push-format-guard` hook blocks every push from a linked worktree** (P3). It compares `core.hooksPath` against the worktree root instead of the common git dir, concludes the repository pre-push hook is unwired when it is in fact wired and running, then fails a whole-tree Prettier check on a git-ignored file that could never be part of the push.
- **Seven `.claude/worktrees` directories are empty and _not_ registered worktrees**, while remaining the cwd of seven live sessions (P3). Pre-existing. The repair command is recorded **as verified by execution**: the plain unforced `git worktree add <existing-empty-path> <branch>` succeeds, exit 0, 3812 files checked out. A review comment on #2284 and an automated fix both asserted a forced add was required — it is not, and `-f` would disable the branch-already-checked-out guard. When the named branch is already checked out in another worktree, repair uses a different branch; `-f` is permitted only with explicit owner approval after proving the existing worktree is stale and inactive.
- **`data/outstanding-issues-snapshot.json` conflicts between any two concurrent ledger PRs** (P2). It is generated, every inbox PR must regenerate it, and its content depends on all other pending requests — so whichever PR lands second must re-resolve. That is what killed #2284 twice in an hour, and it recurred on this branch when #2294 merged. Resolved here the only correct way: take `main`'s copy, re-run the generator, never hand-merge. The same file also forces Clinical Governance Preflight on every ledger PR because `data/**` is classified clinical-risk even though the snapshot holds no clinical content. The record proposes moving regeneration into the already-serialised `issues:reconcile` step so ordinary branches never touch the file.

**`#6GW95D` — the fleet inventory is complete and the cleanup is deliberately deferred.** Eight roots scanned: 208 checkouts of this repository, of which 92 are registered worktrees and **116 are separate full clones** with their own object databases. None of those 116 is visible to `scripts/clean-worktree.mjs` at all, and they are the real disk mass — that is the finding that matters for any future sweep. Zero unregistered worktrees, zero stale gitdir pointers. `clean:worktree --merged --squashed --dry-run` found 23 landed candidates totalling 9.30 GB. Capacity is no longer the driver: `D:` is 80 GB with 53 GB free.

The leftover-directory arithmetic is now stated explicitly, because the earlier wording did not add up: 18 non-checkout leftovers under `.claude/worktrees` = 11 removed + 7 blocked, with a twelfth removal under `.gemini` outside that root.

The owner halted the removal pass mid-run and all 12 removed worktrees were restored — the 11 `.claude/worktrees` leftovers plus the one `.gemini` leftover; no thirteenth path is identified — branch, head and clean tree verified individually, dependencies restored by byte-identical copy. Five live chats had had their working directory deleted underneath them. Two process lessons are recorded on the row: a `git refused` / `EPERM` removal means a live process holds that directory and is a **stop**, never something to retry on a later pass; and the candidate list must be shown and approved before any deletion.

## Verification

- [x] `npm run verify:pr-local`

Documentation-only scope. The relevant selected checks were run directly against this exact commit and pass:

- `npm run check:outstanding-issues` → `[snapshot] in step with data/outstanding-issues-snapshot.json (66 open, 9 pending)`, exit 0. This is the check that failed on #2284, and the reason it failed: adding inbox requests without regenerating the snapshot. The count is 9 because three additional pending inbox requests already sit on `main` alongside this PR's six.
- `npm run check:ledger-write-discipline` → `Ledger write discipline passed`, exit 0.
- `npm run issues:reconcile -- --dry-run` → `Would reconcile 6 request(s) into docs/outstanding-issues.md.`, exit 0. This proves all six requests still apply after #2294's reconcile landed, including the `#6GW95D` update's row fingerprint.
- `npx prettier --check` on the changed inbox JSON files and `PR_POLICY_BODY.md` → `All matched files use Prettier code style!`

Verification not run: `lint`, `typecheck`, `test` and `build` were not run for this change. It adds no executable code, no test and no configuration — there is no plausible failure path for them to detect. The full local suite was run earlier in the same session and is two-red for the pre-existing Windows `chmod` reason described above, which is itself one of the findings filed here.

- UI verification not run: no UI, routing, styling or browser behaviour is touched.

## Risk and rollout

- Risk: None. Six new files and one regenerated snapshot; no modifications to existing records and no deletions. Ordinary branches never edit the canonical ledger, so this cannot corrupt a concurrent reconcile.
- Rollback: `git revert` this single commit.
- Provider or production effects: None.
- RAG impact: none.

## Clinical Governance Preflight

This preflight is completed because `data/**` is classified clinical-risk even though this PR only records inbox requests plus a generated snapshot and does not change clinical output, retrieval, ingestion, or document access. Confirmed by calling `classifyPullRequestFiles`: `data/outstanding-issues-snapshot.json` alone returns `clinicalRisk: true`, while the inbox JSONs alone return `false`.

- [x] Source-backed claims still require linked source verification before clinical use
- [x] No patient-identifiable document workflow was introduced or expanded without explicit governance approval
- [x] Supabase target remains `Clinical KB Database` (`sjrfecxgysukkwxsowpy`)
- [x] Service-role keys and private document access remain server-only
- [x] Demo/synthetic content remains clearly separated from real clinical sources
- [x] Source metadata, review status, and outdated/unknown-source behavior remain conservative
- [x] Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed

## Notes

Rebased onto `main` rather than merged, deliberately: a merge commit carries `main`'s own canonical-ledger change into the branch's diff, which trips the ledger write-discipline push guard. Rebase keeps the branch to one commit touching only inbox requests and the generated snapshot.

Run `npm run issues:reconcile` from a dedicated fresh-base branch once this lands.
