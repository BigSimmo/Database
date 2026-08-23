# Worktree and branch reconciliation — 2026-08-23

**Disposition:** preservation-first; no deletion was safe during this pass.  
**Repository:** full history, all-head origin refspec.  
**Observed registered worktrees:** 108.

## Why no deletion occurred

The cached `origin/main` reference changed more than once while inventory was running, and worktree/status discovery remained active for several minutes. That means the fleet was not quiescent and there was no trustworthy frozen base for destructive classification. Missing upstreams alone are not proof that work is merged or obsolete.

No worktree passed all required ownership, process, open-PR, Git-operation, ledger, patch-unique, archive, and recovery gates. The correct result was to retain recoverable work rather than convert uncertainty into data loss.

## Structural candidates requiring a later quiescent pass

| Registered worktree                                                       | Branch                                       | Observed HEAD                              | Evidence obtained                                       | Missing gates                                                                                                     |
| ------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `D:\Repos\Database\.claude\worktrees\agent-ac295f35b1b90b024`             | `claude/dictionary-merge-search-browse`      | `3c94d555357d790730dc7b5c685a05b8f1ef335d` | clean; no Git-operation marker; ancestor of cached base | frozen fetched base, session/process ownership, open PR/review, ledger lookup, patch-unique proof, archive bundle |
| `D:\Repos\Database\.claude\worktrees\caring-contacts-phase-2a-11b-a37803` | `claude/caring-contacts-phase-2a-11b-a37803` | `d7025947e2f98c8135ca1dfd984ef734edf84ed7` | clean; no Git-operation marker; ancestor of cached base | frozen fetched base, session/process ownership, open PR/review, ledger lookup, patch-unique proof, archive bundle |

These are candidates for evidence collection, not approved deletion targets.

## Explicitly retained

- All `C:\Users\joshs\.codex\worktrees\<task>\Database` checkouts because they represent Codex task ownership.
- All detached worktrees and all worktrees not individually inspected.
- `D:\Repos\Database\.claude\worktrees\agent-abcc3122b5a4407a7`, which was dirty despite its commit being an ancestor of the cached base.
- `C:\Users\joshs\AppData\Local\Temp\guard-push-format-sXM4Ak`, observed in an `initializing` lock state.
- `D:\Worktrees\Database\care-plan-impl`, whose branch history explicitly describes interrupted work in progress.
- `D:\Worktrees\Database\ledger-reconcile-0823`, observed ahead four and behind two.
- Every missing-upstream branch without independent content-equivalence evidence.

## Required quiescent execution sequence

1. Coordinate a quiet window across Codex, Claude, Gemini, dev servers, checks, leases, and Git operations.
2. Fetch/prune once and record the exact `origin/main` SHA.
3. Run `node scripts/reconciliation-preflight.mjs --include-processes --strict --json` to completion.
4. Run list-only discovery with `node scripts/clean-worktree.mjs --merged --squashed --drive D --base origin/main`.
5. For each exact registered worktree, prove clean status, no Git operation, no process/session owner, no open PR/review, ledger disposition, ancestry or empty patch-unique log, and file/blob equivalence.
6. Create and verify an archive ref, Git bundle, and manifest before removal. Ignored and secret-bearing files require separate inspection because a bundle does not preserve them.
7. Remove through `git worktree remove <exact-registered-path>` or the confirmed repository wrapper without `--force`. Never recursively delete an outer Codex task directory.
8. Delete local branch refs only as a separate evidence-backed action. Remote branch deletion is not authorised by this programme.

## Current result

- Worktrees removed: **0**
- Branches deleted: **0**
- Recoverable or ambiguous work discarded: **0**
- Follow-up: rerun only in a coordinated quiescent window; do not reuse the transient cached-ref conclusions from this audit.
