# Cursor PR babysit prompts

Copy/paste prompts for `@Cursoragent` on an open Clinical KB PR. Start with
`@Cursoragent`. No fill-in placeholders — confirm the PR from context.

Pick one depth:

| Prompt       | Use when                                                          |
| ------------ | ----------------------------------------------------------------- |
| **Thorough** | Deep review + Bugbot + strong local gates before merge confidence |
| **Default**  | Normal babysit: review, fix, clear CI/conflicts/threads           |
| **Unblock**  | Only clear mergeability / required-CI / blocking-thread blockers  |

All three require: review **every** unresolved comment and fix suggestion,
fix or disposition each one, **reply**, then **resolve** the thread after a
fix or full disposition. CI green alone is not done if comments stay open.

Shared hard rules (already in each prompt): do not merge the PR, force-push,
rebase, or arm auto-merge unless asked; no provider-backed gates without
separate approval; pin the GitHub head (not a local-ahead tip); never push a
ledger-only tip.

---

## Thorough

```text
@Cursoragent Work the current open PR end-to-end. Confirm the PR number and GitHub head first from context. If more than one open PR could apply, stop and say which one you would use and why.

Fetch and start from the remote tip that matches that GitHub head. If the named branch ref is missing or stale, use the PR head ref. Preserve unrelated local WIP, including any local-only ledger commits; do not discard dirty work, and do not treat a local-ahead commit as the reviewed tip. Do not merge the PR, force-push, rebase, or arm auto-merge unless I explicitly ask. No provider-backed gates without separate approval. If you cannot push or resolve threads, diagnose and comment only; if inline replies fail, resolve when possible and put dispositions in the summary comment. If auto-merge is already armed, push only for a real blocker, and avoid pushes that would cancel in-flight required CI unless the push itself clears that blocker.

If the PR is already merged or closed: confirm the head and merge commit, note required-CI outcome, post one summary, and stop.

Goal: deep review plus Bugbot, fix actionable issues with the smallest correct changes, clear merge / required-CI / thread blockers, run strong local offline verification, push fixes, append the review ledger, and post one PR summary. Prefer thoroughness over speed. Regenerate large assets only when a fix requires it; then run the asset check and keep compatibility aliases byte-identical where the repo uses them.

Snapshot the GitHub head SHA: tip, base, behind/ahead, mergeable state, merge-tree versus origin/main (real conflict versus behind-but-clean), required checks on that tip including Production UI when selected, advisory separately, unresolved actionable threads. Missing checks while dirty are not green. If the tip moves mid-work, re-snapshot and continue from the new head.

Ledger-lookup against that GitHub head under the heavy review-and-fix scope for this PR. Already reviewed at this head with clean merge-tree, green required checks, and no new actionable threads → summarize, comment, stop unless I asked for a fresh superseding pass. Follow the repo review protocol.

Unblock once: real conflict → merge origin/main (prefer main’s shared queues; keep this PR’s notes); behind-but-clean → one sync, late if required CI is in flight; clean → leave. Labels like skip-branch-sync do not block a manual sync needed to clear a real blocker. No sync thrash. After any sync or push, re-snapshot tip, merge-tree, and required checks before declaring done. Dedupe the ledger if a merge touched it.

Comments, context, and resolution (required):
1. Read the full PR context before changing code: title, body, linked issues, CI summary, and every open review (summary body + inline threads). Treat that context as part of the job, not optional background.
2. Inventory every unresolved review thread and every unresolved PR comment that includes a fix suggestion, requested change, clarification, or decision. Review all of them. Do not skip a thread because it looks stale, nitpicky, outdated, or from a different bot than usual.
3. For each item: implement the suggested fix when it is correct and in scope, or disposition it with a clear no-change reason tied to evidence (pre-existing / out of scope / incorrect / already fixed on current head). Then reply on the thread with what you did (fix SHA or disposition).
4. After you fix a comment or fully disposition it, mark that thread resolved. Reply first, then resolve. Never leave a fixed or fully dispositioned thread open. If GitHub denies thread resolve/reply (403/permissions), post one PR summary that maps each remaining open item to fix SHA or disposition, and keep retrying resolve until nothing actionable remains or you hit a hard permission wall.
5. Exit criterion for comments: no unresolved review threads with fix suggestions or actionable asks remain, or each leftover item has an explicit human decision needed and is called out in the final report. “CI green” alone is not enough if comments are still open.

Review high-confidence delta risks only. Separate PR-introduced defects from pre-existing re-emitted debt. For generated assets, review contracts, aliases, cache, and manifests—not every generated line. If protected RAG or ranking surfaces are touched, say so before editing; fix PR-body policy text only when wrong or missing. Ignore bot noise. No nit spam or broad rewrites. Escalate verification by touched risk: clinical / RAG / privacy / migrations / auth → domain check plus production-readiness when warranted; UI / phone-chrome / routing / styling → ensure plus phone-chrome or UI gates when warranted; generated assets or docs inventory/links → asset or docs checks when warranted.

Fix P0/P1 always; clear scoped P2 when locally provable; else disposition and resolve. Required-check failures on this tip only; ignore advisory. Prefer reverting a bad autofix commit. After fixes: format and commit before push; smallest targeted proof; repo cheap gate; repo PR-local gate. No release, lighthouse, live eval, or live provider gates without approval.

Always clear these before declaring done: (1) required CI green on the current GitHub head, or clearly in progress after your push; (2) merge-tree clean vs origin/main or real conflicts resolved and pushed; (3) every unresolved comment/fix suggestion reviewed, fixed or dispositioned, replied to, and resolved (or summarized if resolve is denied). Do not merge the PR.

Push only this PR’s fix commits. Append ledger for the final GitHub head under the heavy scope. Never push a ledger-only tip—include ledger in a real fix push, or leave a no-change ledger append local and unpushed.

One PR comment: tip, sync/merge-tree, fixed versus dispositioned, threads resolved, required CI, decisive local gate lines, residual risks; merge left to me. Inline only for remaining human-needed P0/P1.

Stop when merge-tree is clean on the current GitHub tip, all comment fix suggestions are reviewed and threads are resolved or explicitly left for a human, required checks are green or clearly in progress, heavy gates for scope passed, summary posted, merge left to me.
```

---

## Default

```text
@Cursoragent Work the current open PR. Confirm the PR number and GitHub head first from context. If more than one open PR could apply, stop and say which one you would use and why.

Fetch and start from the remote tip that matches that GitHub head. If the named branch ref is missing or stale, use the PR head ref. Preserve unrelated local WIP; do not discard dirty work; do not treat a local-ahead commit as the reviewed tip. Do not merge the PR, force-push, rebase, or arm auto-merge unless I explicitly ask. No provider-backed gates without approval. If you cannot push or resolve threads, diagnose and comment only; if inline replies fail, resolve when possible and put dispositions in the summary comment. If auto-merge is already armed, push only for a real blocker and avoid cancelling in-flight required CI unless the push clears that blocker.

If the PR is already merged or closed: confirm outcome, post one summary, and stop.

Goal: review and Bugbot the tip, fix actionable issues with the smallest correct changes, clear merge / required-CI / thread blockers, prove fixes with focused local checks, push, append ledger, and post one PR summary. Use broader offline gates only when the delta or a failed required check warrants them. Regenerate large assets only when a fix requires it.

Snapshot the GitHub head: tip, behind/ahead, mergeable state, merge-tree versus origin/main, required checks on that tip including Production UI when selected, unresolved actionable threads. Missing checks while dirty are not green. Tip moved → re-snapshot.

Ledger-lookup against that GitHub head under the review-and-fix scope for this PR. Already reviewed at this head with clean merge-tree, green required checks, and no new actionable threads → summarize, comment, stop unless I asked for a fresh superseding pass.

Unblock once: real conflict → merge origin/main (prefer main’s shared queues; keep this PR’s notes); behind-but-clean → one sync, late if required CI is in flight; clean → leave. After any sync or push, re-snapshot before declaring done. No sync thrash.

Comments, context, and resolution (required):
1. Read the full PR context before changing code: title, body, linked issues, CI summary, and every open review (summary body + inline threads). Treat that context as part of the job, not optional background.
2. Inventory every unresolved review thread and every unresolved PR comment that includes a fix suggestion, requested change, clarification, or decision. Review all of them. Do not skip a thread because it looks stale, nitpicky, outdated, or from a different bot than usual.
3. For each item: implement the suggested fix when it is correct and in scope, or disposition it with a clear no-change reason tied to evidence (pre-existing / out of scope / incorrect / already fixed on current head). Then reply on the thread with what you did (fix SHA or disposition).
4. After you fix a comment or fully disposition it, mark that thread resolved. Reply first, then resolve. Never leave a fixed or fully dispositioned thread open. If GitHub denies thread resolve/reply (403/permissions), post one PR summary that maps each remaining open item to fix SHA or disposition, and keep retrying resolve until nothing actionable remains or you hit a hard permission wall.
5. Exit criterion for comments: no unresolved review threads with fix suggestions or actionable asks remain, or each leftover item has an explicit human decision needed and is called out in the final report. “CI green” alone is not enough if comments are still open.

Review high-confidence issues only. Separate PR-introduced defects from pre-existing re-emitted data. For generated assets, review contracts, aliases, and cache—not every generated line. Flag RAG or governance before editing; fix PR-body policy text only when wrong or missing. Ignore bot noise.

Fix P0/P1 always; clear scoped P2 when locally provable; else disposition and resolve. Required-check failures on this tip only; ignore advisory. Prove each fix with the smallest targeted check; escalate to cheap or PR-local verification only when the change set, risk surface, or CI failure needs that breadth. Format and commit before push.

Always clear these before declaring done: (1) required CI green on the current GitHub head, or clearly in progress after your push; (2) merge-tree clean vs origin/main or real conflicts resolved and pushed; (3) every unresolved comment/fix suggestion reviewed, fixed or dispositioned, replied to, and resolved (or summarized if resolve is denied). Do not merge the PR.

Push only this PR’s fix commits. Append ledger for the final GitHub head. Never push a ledger-only tip.

One PR comment: tip, sync/merge-tree, fixed versus dispositioned, threads resolved, required CI, decisive local proof, residual risks; merge left to me.

Stop when merge-tree is clean on the current GitHub tip, all comment fix suggestions are reviewed and threads are resolved or explicitly left for a human, required checks are green or clearly in progress, summary posted, merge left to me.
```

---

## Unblock

```text
@Cursoragent Unblock the current open PR. Confirm the PR number and GitHub head first from context. If more than one open PR could apply, stop and say which one you would use and why.

Fetch and start from the remote tip that matches that GitHub head. If the named branch ref is missing or stale, use the PR head ref. Preserve unrelated local WIP; do not discard dirty work; do not treat a local-ahead commit as the reviewed tip. Do not merge the PR, force-push, rebase, or arm auto-merge. No provider-backed gates without approval. If you cannot push or resolve threads, diagnose and comment only; if inline replies fail, resolve when possible and put blocker dispositions in the summary comment. If auto-merge is already armed, push only for a real blocker and avoid cancelling in-flight required CI unless the push clears that blocker.

If the PR is already merged or closed: confirm outcome, post one summary, and stop.

Primary job: clear mergeability and required-CI blockers on this tip. Do a full product review only if needed to explain or fix a blocker. Stay light otherwise—no broad verification suites or Playwright unless needed to prove one concrete unblock fix.

Snapshot the GitHub head: tip, behind/ahead, mergeable state, merge-tree versus origin/main (real conflict versus behind-but-clean), required checks on that tip including Production UI when selected, and unresolved threads that block merge or required CI. Missing checks while dirty are not green. Tip moved → re-snapshot.

Ledger-lookup against that GitHub head under an unblock/fix scope for this PR. If already handled at this head for unblock work, merge-tree clean, required checks green, and no blocking threads: summarize, comment, stop.

Unblock once: real conflict → merge origin/main with the smallest correct resolution (prefer main’s shared queues; keep this PR’s notes); behind-but-clean → one sync, late if required CI is in flight; clean → leave. skip-branch-sync and similar labels do not block a manual sync needed to clear a real blocker. No sync thrash. After any sync or push, re-snapshot tip, merge-tree, and required checks before declaring done. Dedupe the ledger if a merge touched it.

Comments, context, and resolution (required):
1. Read the full PR context before changing code: title, body, linked issues, CI summary, and every open review (summary body + inline threads). Treat that context as part of the job, not optional background.
2. Inventory every unresolved review thread and every unresolved PR comment that includes a fix suggestion, requested change, clarification, or decision — especially any that block merge or required CI. Review all of them. Do not skip a thread because it looks stale, nitpicky, outdated, or from a different bot than usual.
3. For each item: implement the suggested fix when it is correct and in scope for unblocking, or disposition it with a clear no-change reason tied to evidence (pre-existing / out of scope / incorrect / already fixed on current head). Then reply on the thread with what you did (fix SHA or disposition).
4. After you fix a comment or fully disposition it, mark that thread resolved. Reply first, then resolve. Never leave a fixed or fully dispositioned thread open. If a comment is clearly non-blocking noise and CI is green, disposition + resolve it quickly; do not expand scope beyond what the comment requires. If GitHub denies thread resolve/reply (403/permissions), post one PR summary that maps each remaining open item to fix SHA or disposition, and keep retrying resolve until nothing actionable remains or you hit a hard permission wall.
5. Exit criterion for comments: no unresolved review threads with fix suggestions or merge-blocking asks remain, or each leftover item has an explicit human decision needed and is called out in the final report. “CI green” alone is not enough if blocking or fix-suggestion comments are still open.

Fix only what blocks required checks or mergeability on this tip, plus the comment/fix-suggestion work above. Ignore advisory red unless it reveals a real required failure. Prefer the smallest safe fix; if a bot/autofix commit caused the break, prefer revert. Prove with the smallest targeted check only. Format and commit before push.

Always clear these before declaring done: (1) required CI green on the current GitHub head, or clearly in progress after your push; (2) merge-tree clean vs origin/main or real conflicts resolved and pushed; (3) every unresolved comment/fix suggestion reviewed, fixed or dispositioned, replied to, and resolved (or summarized if resolve is denied). Do not merge the PR.

Push only blocker-fix commits. Append ledger for the final GitHub head under the unblock scope. Never push a ledger-only tip.

One PR comment: tip, sync/merge-tree, what blocked and what you fixed or dispositioned, threads resolved, required CI status, residual risks; merge left to me.

Stop when merge-tree is clean on the current GitHub tip, all comment fix suggestions are reviewed and threads are resolved or explicitly left for a human, and required checks are green or clearly in progress.
```
