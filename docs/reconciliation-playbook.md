# Reconciliation and multi-worktree cleanup playbook

Use this playbook only for broad chat/worktree reconciliation, archive-safe cleanup, or migration of
many independent branches. Ordinary feature work should continue using the normal task preflight and
focused verification path.

## Fast, read-only start

```powershell
npm run workflow:lifecycle -- --phase reconcile --write-evidence
node scripts/reconciliation-preflight.mjs
```

The preflight is local, read-only, and cached-ref-only. It inventories the primary checkout,
worktrees, dirty entries, detached state, ahead/behind counts, and Git operation markers. It never
fetches, scans providers, deletes anything, or treats a preserved branch as approved.

When process ownership may block cleanup, add the explicit process check:

```powershell
node scripts/reconciliation-preflight.mjs --include-processes
```

That check emits counts and process metadata only. It must never print or persist raw command lines;
arguments can contain credentials.

## Remote-truth checkpoint

After explicit GitHub authorization:

```powershell
git fetch --prune origin
node scripts/reconciliation-preflight.mjs --strict
```

Do not claim remote freshness from a cached `origin/main`. Do not fetch implicitly inside a normal
local planner.

## Candidate funnel

Use this order so the cheap, authoritative filters remove most work before expensive comparisons:

1. Identify active owners, open PRs, protected/base branches, post-freeze work, secret-bearing
   worktrees, dirty state, and Git operation markers.
2. Skip content already on the fetched base by exact PR/head/merge evidence.
3. Skip unchanged work already recorded for the same `(ref, HEAD, scope)` in the review ledger.
4. Use ancestry and `git log --right-only --cherry-pick --no-merges` for remaining candidates.
5. Inspect file/blob differences for patch-unique survivors.
6. Use `git merge-tree --write-tree` only when earlier evidence cannot resolve equivalence.

Do not start with an all-ref patch-equivalence sweep. It is slow and produces noise from squash
merges, old review refs, and intentionally retained branches.

## Preservation before cleanup

- Classify every worktree and branch as merged, duplicate, rejected, issue-captured, provider-gated,
  active/retained, or unresolved.
- Preserve legitimate tracked and untracked source before cleanup through explicit archive refs and
  a verified Git bundle.
- Exclude `.env*`, credentials, logs, caches, dependencies, builds, and machine-local state.
- Keep secret-bearing worktrees until ignored secrets have an authorized destination; Git bundles do
  not preserve ignored secret files.
- Verify bundles with `git bundle verify` and keep a manifest that maps each source to its final
  disposition.

## Integration

- Create a clean dedicated integration worktree from the freshly fetched remote base.
- Never integrate from the dirty primary checkout.
- Split changes by coherent risk class and revalidate each on current main.
- Start with a red reproducer or exact content proof.
- Refresh the base between sequential protected-main PRs.
- Reject stale, mixed, duplicated, refuted, or unmeasured behavior rather than forcing it to apply.
- Protected RAG behavior requires the repository RAG declaration, offline contracts, and approved
  baseline/post live canary. A failed canary reverts immediately.

## Efficient verification

- Start with the smallest focused test, then widen once.
- Run one heavyweight Database command at a time across all worktrees.
- If a wrapper appears stalled, inspect its lock/process/artifact status before retrying or stopping.
- Never rerun an unchanged passing gate.
- Record a timeout or interrupted suite as incomplete. Re-run only the smallest unresolved portion
  unless the environment or code changed enough to justify the full gate.
- Keep live Supabase, OpenAI, Railway, GitHub mutation, and live RAG checks separately authorized.

## Secret-safe diagnostics

- Prefer PID, parent PID, process name, start time, and workspace-match metadata.
- Never paste or print a full `Win32_Process.CommandLine`, environment dump, auth header, or URL with
  embedded credentials.
- If command text must cross a logging boundary, pass it through the shared sensitive-text redactor.
- If exposure occurs: stop the exact owned process, revoke the credential server-side, clear the
  stale local secret record, scan authorized repositories/backups for plaintext copies, and record
  the incident without retaining the secret value.

## Cleanup and completion proof

Delete only after all of these are true:

- the worktree is clean and inactive;
- its content is on main or explicitly rejected;
- recovery evidence is verified;
- no open PR or unresolved review owns it;
- the branch/worktree disposition is recorded.

Completion requires clean local `main`, identical local/remote trees, no active Git operation,
no open reconciliation PR, a complete disposition ledger, verified recovery evidence, and no lost
source content. Provider/deployment state is a separate acceptance decision.
