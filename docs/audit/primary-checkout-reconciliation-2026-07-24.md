# Primary checkout reconciliation — 2026-07-24

## Scope and decision rule

This record covers the dirty primary checkout and the final cloud-chat salvage wave. The canonical
integration base was freshly fetched `origin/main`; the dirty primary checkout was never used as a
merge base. Content was included only when it had a current-main reproducer or exact content proof,
was isolated into a coherent PR, and passed its proportionate local and hosted gates.

No branch, commit, uncommitted source file, or secret-bearing worktree was discarded. Rejected and
deferred material remains recoverable from local archive refs and verified bundles.

## Preservation proof

| Snapshot       | Archive ref / commit                                                                                                                                                | Evidence                                                                                                                                                                  | Disposition                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Primary wave 1 | Checkpoint commit `faa50e6e3d245b3bf82aa2446f26a64a8f00f430` (the original archive branch later advanced to the wave-2 child)                                       | 102 legitimate paths checkpointed; 23 exact current-main duplicates, 48 local-only paths, 31 divergent paths, 12 paths containing conflict markers                        | Classified file-by-file; never replayed as one patch           |
| Primary wave 2 | `archive/pre-reconcile/primary-dirty-wave2-20260724-164509` and `archive/pre-reconcile/primary-dirty-20260724-153023` at `ffb66e26bde09f97b697b53a8a37ec687688b7d0` | Preserved an interrupted merge: 62 changed paths versus wave 1, of which 33 matched current main and 29 were merge-resolution-unique; 21 paths contained conflict markers | Archive-only merge artifact; not an independent implementation |

The first verified bundle is external to the repository:

- `C:\Dev\Apps\Database-pre-reconciliation-20260724-153023.bundle`
- Size: 79,853,865 bytes.
- SHA-256: `56091EDC0570FAECD38847ABC79A7A6D46E0ECBDAC3FCACB9C012BBAF35979B1`.
- `git bundle verify` passed and reported complete history with 458 refs.
- Earlier July 19 and July 23 bundles remain independent and were not replaced.

The untracked `debug-f29a16.log` was deliberately excluded from Git and bundles. It is ordinary
machine-local debug output, not source. The final external reconciliation manifest records its
preserved destination and hash after primary synchronization.

A high-signal secret scan found no newly added credential or private key in either snapshot. One
key-like match was a historical GitHub branch name in `docs/branch-review-ledger.md`; it was verified
against GitHub metadata without printing or retaining a secret value.

## Landed content

| PR                                                       | Result                                                                                                                        | Behaviour boundary                                                                              |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| #1125 / merge `1cb3ff8941f66194dccb3de341b2d0325f5e62b3` | #061 fails closed when source relevance metadata is absent                                                                    | Presentation policy only; no retrieval, ranking, generation, provider, or data change           |
| #1143 / merge `9d1d38e7e81445011fde44fe91ca50c48b3baf40` | #052 atomically prevents reindex work from overlapping active enrichment                                                      | Transactional, owner-scoped RPC with disposable PostgreSQL/Docker replay and schema/drift proof |
| #1152 / merge `1c30a9d3e923d64ddc07f1e194cb9bdd6851b982` | #062 surfaces aged queued uploads without jobs and provides guarded recovery                                                  | Scheduled monitoring alerts only; recovery remains dry-run and confirmation-first               |
| #1163 / merge `2f407e8facc800c6f00761c682b292debb8a97aa` | Invalid summary-mode requests fail closed and selected-document scope is enforced                                             | API contract only; no retrieval behaviour change                                                |
| #1161 / merge `7a81cfaa9064d7e1c4d50488e2dfa0926887a0e9` | Deterministic in-app back navigation, dirty safety-plan confirmation, mode-aware privacy return, and Sheet teardown hardening | UI/navigation/focus only; protected browser checks passed                                       |
| #1164 / merge `3f4e24948ef0a9022d2a12108af61de29d69612b` | Trusted PR policy now also runs for `release/**` targets                                                                      | Workflow trigger coverage only                                                                  |

Each merge was made through protected main only after required hosted checks passed and actionable
review threads reached zero. The reviewed head was then proved ancestral to fetched `origin/main`,
and the merge tree was compared with the intended fetched main tree before starting the next PR.

## Already represented or superseded

- Current main already contained the Next.js 16.2.11 security update from PR #1091; dependency and
  lockfile hunks from the dirty snapshot were not replayed.
- Action pinning, service-worker isolation, existing upload budgets, active indexing-agent safety,
  and several browser expectations were duplicates or weaker variants of current-main controls.
- 23 wave-1 paths and 33 wave-2 paths were exact current-main content at their comparison points.
- The old back-navigation PR #1121 was rebuilt cleanly as #1161. Draft #1151's browser-history
  design was rejected because an external or unrelated history entry can eject a deep-linked user.

## Explicitly rejected content

The following material is preserved but must not be ported wholesale:

- Removing `.npmrc` `allow-scripts=true`; npm 11 recognises the supported `allowScripts` policy and
  the archive change weakens rather than repairs the control.
- Favourites changes that replace the accessible disabled-placeholder convention with unwired
  affordances, and differential/home changes that regress current map, related-link, or placeholder
  behaviour.
- A layout font import through the internal `next/dist/next-devtools` path and a hydration test that
  references a non-existent specification.
- The unregistered prompt-perfector skill and its unsupported workspace semantics.
- Conflict-corrupted audit-plan, service catalogue, source/evidence, settings, upload, answer, and
  private-route hunks from either primary snapshot.
- Search-chrome changes that restore `router.back()`, answer-render changes that undo #061's
  fail-closed policy, and safety/privacy changes that reintroduce patient identifiers or undo #060.
- Source-authority changes that infer authority from user-controlled upload identity or remove
  current governance safeguards.
- Ingestion/reindex changes that bypass #052's atomic RPC, and stale atomic-upload/schema hunks now
  superseded by #062 and current migrations.
- Broad PDF crop retention, arbitrary padding/thresholds, storage expansion, or extraction timeout
  increases without a real current-main malformed-asset reproducer.
- The old 31-file non-RAG salvage patch, stale browser expectations, score-spreading/comparator
  changes, bulk alias widening, semantic-reranking enablement, or any protected RAG patch without a
  separate current-main reproducer and the repository's canary safeguards.
- Wave 2's 29 merge-resolution-unique paths as a group: they are products of an interrupted merge,
  not a coherent reviewed implementation, and 21 files still contain conflict markers.

## Deferred, not lost

- #075 records the valid part of mixed PR #1132: source-label enumeration can silently truncate at
  the Supabase 1,000-row response cap. It requires an isolated bounded-pagination reproducer and PR;
  the mixed dependency/PDF/Sheet/search patch must not merge.
- #076 records the only safe next step for PR #1129: reproduce malformed fallback PDF assets with a
  real fixture before changing image retention, crop geometry, storage, or time budgets.
- Active Cursor/Codex/Claude/Antigravity and secret-bearing worktrees remain registered and
  untouched. Reconciliation completion does not imply ownership or deletion authority for those
  independent tasks.
- Provider-backed rollout debt remains governed by `docs/outstanding-issues.md`. No live RAG,
  OpenAI, Supabase data mutation, Railway mutation, or production migration was required for this
  final salvage wave, and no RAG evaluation budget was spent.

## Final synchronization contract

After this record lands, the operator sequence is:

1. Create and verify a final `--all` Git bundle containing the archive refs and merged refs.
2. Preserve the excluded debug log outside the repository.
3. Fetch `origin`, switch the primary checkout to `main`, and use `git merge --ff-only` only.
4. Prove `main == origin/main`, `git diff --quiet main origin/main`, a clean primary status, and no
   active Git operation markers.
5. Retain active or secret-bearing worktrees; remove only task-owned clean worktrees whose heads are
   merged and present in the verified bundle.

The dated external manifest carries the final bundle hash, final main SHA, primary status, and
worktree cleanup evidence so this repository record never claims a synchronization step before it
has actually occurred.
