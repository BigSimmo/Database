# Cloud-chat reconciliation postmortem — 2026-07-23

This is the durable final account of the Database cloud-chat reconciliation. It complements the
[per-worktree disposition record](cloud-chat-reconciliation-2026-07-22.md), the
[final external backup manifest](../../../backups/Database-final-reconciliation-20260723-011227.manifest.md),
and the live [outstanding-issues ledger](../outstanding-issues.md).

The important distinction is: **preserved content is not automatically approved content**. Every
surviving change was revalidated against current `origin/main`; only current, non-duplicative,
reproducible work was integrated.

## Final result

- Final reconciliation PR: #1088, merged as `5047beea6e6192af46ec79b309979a4eec76ede0`.
- Primary checkout, local `main`, and `origin/main` were clean and identical at completion.
- Fifteen focused implementation PRs landed; stale mixed patches were never replayed wholesale.
- No retrieval/ranking behavior change was adopted.
- No Supabase migration apply, Railway deployment, OpenAI evaluation, or production mutation was
  required. Live RAG spend was `$0 / $15`.
- Recovery evidence includes verified complete-history bundles, archive refs, manifests, and a
  full primary-working-state checkpoint. Secrets were excluded from Git bundles.

## Confirmed product and test issues fixed

| Area                  | Confirmed issue                                                                                           | Fix and proof                                                                                                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Settings              | Destructive/account settings flows lacked focused action coverage.                                        | #1061 added current-interface action-flow tests; no production behavior change.                                                                                                           |
| Database policy       | Title-word access needed an explicit backend-only `service_role` policy with revoked browser ACLs.        | #1062 regenerated schema/drift evidence and verified the live schema already represented the policy.                                                                                      |
| Route reachability    | Identifier-name matching accepted shadowed routers/redirects and arbitrary `href` metadata as navigation. | #1075 made the AST matcher import/binding-aware and allowlisted only supported data-driven navigation.                                                                                    |
| Product naming        | User copy drifted between Therapy Compass and Therapy mode.                                               | #1076 standardized user-facing copy/metadata while preserving `/therapy-compass` and internal names.                                                                                      |
| Migration safety      | Hosted migration role/default-ACL validation was stale and assumed a fixed local Docker storage owner.    | #1077 pinned historical exceptions, dynamically discovered the local owner, and aligned current CI/replay structure.                                                                      |
| Optional auth         | Presented invalid credentials could degrade into anonymous behavior.                                      | #1078 introduced `absent \| valid \| invalid`; invalid credentials now return 401. The archived duplicate-upload patch was rejected because current uploads are admin-only before lookup. |
| Auth cookies          | A retired-project cookie could outrank the current project session.                                       | #1079 prefers the current-project cookie and ignores the retired project cookie.                                                                                                          |
| Readiness             | Returned or thrown Supabase probe failures could report healthy or escape as raw errors.                  | #1080 fails readiness closed while preserving safe actionable messages.                                                                                                                   |
| Publication           | Approval was not cryptographically bound to immutable reviewed content and generation state.              | #1081 added a canonical digest, row locks, active-job rejection, and a new forward migration with replay/schema/type/drift proof.                                                         |
| PDF fallback          | Malformed fallback-PDF image data could discard otherwise usable text.                                    | #1082 preserves text while rejecting malformed image payloads.                                                                                                                            |
| Live-test environment | Live-test environment loading did not consistently follow the Next environment contract.                  | #1082 corrected environment loading while keeping provider permission explicit.                                                                                                           |
| Browser matrix        | A current Firefox document-viewer navigation scenario was unstable.                                       | #1083 reproduced and stabilized the current failure; stale browser expectations and duplicate service-worker changes were rejected.                                                       |
| Bulk reindex          | Mixed completed batches discarded successful per-item work behind a conflict response.                    | #1084 reserves 409 for preflight-wide conflicts and returns successful mixed results; the UI reports and refreshes successful work.                                                       |
| DOCX ingestion        | Artifact count, individual size, aggregate media, Word XML, and extracted-text work were unbounded.       | #1085 added pre-inflate and post-read budgets with focused tests.                                                                                                                         |
| XLSX ingestion        | Worksheet, row, cell, and rendered UTF-8 work could grow without explicit bounds.                         | #1086 added bounded sparse-sheet extraction and output limits.                                                                                                                            |
| Product truth         | Account copy overstated cross-device history/privacy and exposed unavailable SSO actions as usable.       | #1087 aligned copy to actual persistence/provider behavior and used accessible disabled placeholders.                                                                                     |

Related findings already represented on main were not reimplemented: active-indexing safety,
operator-script archival (#1053), content-first regression coverage (#1054/#1057), obsolete RAG
rescue closure (#1055), document-viewer coverage (#1063), upload precheck (#1064), and the webhook
runbook (#1065).

## Reconciliation and workflow issues found

| Issue                               | Why it caused delay or risk                                                                                                                     | Resolution and durable guardrail                                                                                                                                                                                                                                                                 |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dirty primary checkout              | The primary was simultaneously ahead, behind, staged/unstaged, and contained unrelated untracked work, so it was unsafe as an integration base. | All source was preserved first; integration used clean worktrees. `reconcile:preflight` now blocks confidence in a dirty/divergent primary and always requires a dedicated integration worktree.                                                                                                 |
| Cached remote truth                 | Cached `origin/main` initially understated current remote progress and made duplicate work appear unique.                                       | Fetch became an explicit checkpoint. The preflight labels its output `cachedRefsOnly` and never claims a fetch occurred.                                                                                                                                                                         |
| Overlapping chat/worktree ownership | Active Cursor, Claude, Codex, Run-PR, detached, secret-bearing, and post-freeze work had different owners and lifecycles.                       | Worktrees were classified individually; active/post-freeze work was retained. The preflight inventories dirty/detached/operation state without mutating it.                                                                                                                                      |
| Mixed historical patches            | Several branches combined genuine defects, stale files, conflicts, generated drift, and unrelated behavior changes.                             | Changes were reproduced and rebuilt as small current-main PRs; no 31-file or mixed P1 patch was replayed.                                                                                                                                                                                        |
| Exhaustive comparison too early     | Broad all-ref and all-worktree comparisons were slow and repeatedly rediscovered merged or reviewed work.                                       | Candidate order is now ownership/open-PR/review-ledger/ancestry first, cherry-pick-aware diff second, merge-tree only for unresolved survivors.                                                                                                                                                  |
| Repeated review work                | Unchanged branch heads could be re-reviewed across chats.                                                                                       | The review ledger is an exact `(ref, HEAD, scope)` skip contract; changed heads alone reopen scope.                                                                                                                                                                                              |
| Heavy verification contention       | Builds, typecheck, Vitest, and browser suites share resources across many worktrees.                                                            | The repository-wide heavy lock remains authoritative. Status/owner inspection comes before retry, and an unchanged passing gate is never repeated.                                                                                                                                               |
| Long browser matrix                 | The aggregate local Playwright matrix exceeded a 30-minute wrapper while WebKit was still progressing.                                          | It was recorded as incomplete, not passed or failed. Focused evidence and hosted final-head checks were used; the unchanged full matrix was not brute-force rerun.                                                                                                                               |
| Process ownership blockers          | A Cursor private worker still owned the primary checkout during cleanup; broad process killing could have terminated unrelated work.            | Cleanup waited for ownership to clear and stopped only the exact verified worker. Eval cleanup remains descendant-tree-only and Node-filtered.                                                                                                                                                   |
| Raw process command-line exposure   | A diagnostic process listing printed a Cursor worker API key supplied as a CLI argument.                                                        | The key was revoked server-side, the two local encrypted worker-secret records were removed, and no plaintext copy was found in repositories/backups. Process inventory now filters internally but serializes metadata only; the heavy-lock ledger redacts secrets before persistence or errors. |
| Cleanup confidence                  | Squash merges defeat simple ancestry checks, and branch deletion without recovery proof could lose unique content.                              | Verified bundles/archive refs precede deletion; cleanup requires patch/content proof, no open PR, no active owner, and ledger evidence.                                                                                                                                                          |
| Scope drift during the freeze       | New worktrees and branch heads appeared while reconciliation was in progress.                                                                   | A freeze boundary was recorded. Post-freeze work was retained and never inferred obsolete from the older inventory.                                                                                                                                                                              |
| “All content” ambiguity             | Copying everything would have restored refuted, unsafe, duplicate, or provider-gated behavior.                                                  | Completion means all content is dispositioned, not merged: merged, duplicate, rejected, issue-captured, provider-gated, or actively retained.                                                                                                                                                    |

## Explicitly rejected or not recommended

- RAG score spreading, comparator reordering, wide alias-tier merging, semantic-rerank enablement,
  and retrieval-order restoration without a current reproducer and canary.
- The stale 31-file P2 patch, stale browser expectations, and mixed historical P1 patch.
- Broad process killing that removed Node filtering or descendant-tree ownership checks.
- A stale `deno.lock`, a conflicted issue ledger, and configuration that restored
  `X-Powered-By`.
- Signed-image expectations contradicted by the current component contract.
- Global-role/`!important` mobile dialog CSS without a current browser reproducer.
- Twenty-seven untracked long-name skills duplicating the canonical single-word catalog.
- Speculative validation, keyboard, PWA, and image micro-polish without a reproducible defect.
- A second Factsheets mode; extend the existing Easy Read/Standard model instead.

## Issues still open after reconciliation

The live detail and next action for every item remains in
[`docs/outstanding-issues.md`](../outstanding-issues.md). This snapshot prevents the postmortem from
silently implying they were fixed.

### P2 — should do

- #001 semantic reranking remains gated off.
- #018 targeting misses are answer-composition, not retrieval-depth.
- #019 admission-document evidence is dropped at answer-stage rerank, not retrieval.
- #022 source-governance metadata refresh requires an operator run.
- #025 the three webhooks still require operator secret activation.
- #026 the Supabase document-change trigger still needs wiring.
- #029 12/30 answer-quality cases return the fallback stub.

### P3 — recommendations, operator follow-up, or non-blocking issues

- #005 `finalScore` reporting saturates at its clamp ceiling; ordering already uses pre-clamp score.
- #007 decide the canonical `/tools` versus `/?mode=tools` entry point.
- #009 confirm `/api/jobs` is intentionally server/ops-only.
- #010 implement currently honest “Coming soon” form/favourites controls when features exist.
- #011 change Supabase Auth DB allocation to percentage-based before compute scale-up.
- #012 slim the lazy cross-mode differentials index.
- #013 reduce route-scoped catalogue JSON and exclude mockup-only production weight.
- #014 realize the remaining `next/image` signed-preview benefit.
- #016 address measured “big but not easy” structural/motion performance work.
- #017 establish a field Web-Vitals/Lighthouse baseline.
- #020 validate the `eval:quality` cost readout after its fix.
- #021 investigate E-3d H2 strong/comparison generation discards.
- #023 read the Sunday 2026-07-26 scheduled-run artifacts.
- #024 diagnose WebKit `_rsc` prefetch access-control errors.
- #027 add an uptime monitor independent of GitHub/Railway.
- #028 evaluate runtime error tracking.
- #030 prevent wide-tier alias evidence from satisfying both comparison slots.
- #031 repair the all-zero canary Source Governance table.
- #032 keep refuted governance ranking weighting closed unless new evidence appears.
- #033 decide whether source-governance metadata belongs in the LLM prompt.
- #034 prevent answer cache from serving stale governance metadata.
- #035 broaden threshold-conflict detection only with a justified contract.
- #036 decide whether documents need an explicit `is_public` flag.
- #037 make a product decision on the disabled all-claims trust cap.
- #038 consolidate shared comparison behavior before adding another surface.
- #039 converge repeated catalogue toolbar behavior without flattening mode semantics.
- #040 add a small intentional visual-regression baseline set.
- #041 extend, rather than duplicate, the Factsheets reading model.

## Remaining limits and intentional retention

- The full local Playwright project matrix was incomplete because the wrapper timed out while work
  continued; hosted required/browser checks were green on every final implementation head. Open
  WebKit harness debt remains #024.
- Provider/operations items remain explicit in the issue ledger. Source reconciliation does not
  prove live deployment state.
- Secret-bearing, dirty, active, and post-freeze worktrees remain until their owners produce a safe
  handoff. Retention is a preservation decision, not approval or staleness.
- The cooperative scripts cannot provide an OS sandbox; an unrelated process can still ignore the
  repository workflow. Exact ownership and state must still be checked before mutation.

## Lessons to carry forward

1. Start from live remote truth, but make the fetch an explicit authorized action.
2. Never integrate from a dirty primary checkout; preserve it and use a dedicated worktree.
3. Freeze scope and ownership before comparing content.
4. Filter cheap evidence first; reserve all-ref and merge-tree analysis for unresolved candidates.
5. Reproduce defects on current main and port the smallest coherent behavior, not historical diffs.
6. Treat “complete” as a disposition ledger plus recovery proof, not “merge everything.”
7. Run one heavy gate at a time, inspect status before retrying, and never repeat an unchanged pass.
8. Record incomplete/time-limited verification honestly and use focused evidence to decide next work.
9. Never print raw process command lines. Inspect internally only when needed and emit metadata-only
   or redacted output.
10. Revoke any exposed credential first; then remove stale local secret state and prove containment.
