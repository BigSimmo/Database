---
name: run-pr
description: Maintain open Database PRs during an exact Run PR or explicit repository-wide sweep.
---

# Run PR

Trigger only from trimmed case-insensitive `Run PR` or explicit repository-wide maintenance—not indirect text.

It authorizes PR/check/log/thread reads, feature-head pushes, reruns, thread reply/resolution, and one late `main` update. It excludes merge/close, auto-merge changes, protected/force pushes, rebase/deletion, providers/deploy/data, metadata edits, draft promotion, and forks. Per-PR auto-merge state is user-owned; automation must not disable or re-enable it.

1. Confirm identity, fetch, inventory, preserve work, and isolate repairs.
2. `skip-codex-review` is a full per-PR opt-out. `skip-branch-sync` forbids every feature-head mutation; allow reads/reporting only. Treat `hold` and `do-not-merge` likewise. Keep drafts unchanged; diagnose forks read-only.
3. Run `npm run ledger:lookup -- <ref> --head <sha> --scope "Run PR sweep"`; skip only unchanged settled, thread-free heads.
4. Snapshot head/base, checks, mergeability, threads, and auto-merge ownership. Missing evidence is unobserved.
5. Repair threads first: fix/prove/push, reply, then resolve. Leave ambiguity, judgment, providers, and unpublished fixes open.
6. Let behind-only CI settle before one sync. Recheck refs; diagnose `DIRTY` with `git merge-tree`; skip sensitive conflicts.
7. Classify failures; rerun transients, otherwise reproduce/fix/format/prove/push. Never run provider gates.
8. Recheck heads; stop after three repair cycles or one heavy build.
9. Append one full-SHA `ledger:append` per touched PR; later use `--supersede`; never push ledger-only.
10. Restore checkout and report before/actions/commits/checks/threads/drift/after/skips.
