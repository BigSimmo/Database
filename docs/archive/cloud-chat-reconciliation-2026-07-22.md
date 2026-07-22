# Cloud-chat reconciliation record — 2026-07-22

This record closes the Database cloud-chat reconciliation against protected `origin/main`. It distinguishes landed work from duplicates, rejected patches, provider-gated follow-up, and retained post-freeze work. An archive or branch being preserved does not mean its content is approved.

## Canonical integration result

- Implementation endpoint before this record: `origin/main` at `05dc52fd8408a65117e22a6236e43252203bea92` (PR #1087).
- Delivery model: sequential protected-main squash PRs, with a fresh fetch between PRs and exact intended-blob comparison after each merge.
- Retrieval/ranking changes adopted: none.
- Live RAG/OpenAI spend: `$0` of the authorised `$15` multi-run budget. Offline evidence was sufficient because no surviving reconciliation change altered retrieval, ranking, or answer generation.
- Production provider mutations: none. The live title-word drift comparison was read-only and found the merged schema already represented; no Supabase migration apply or Railway deployment was needed.

## Preserved recovery evidence

| Backup                                                          | SHA-256                                                            |                    Size | Verification                                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------: | ---------------------------------------------------------------------------- |
| `Database-pre-reconciliation-20260722-120500.bundle`            | `E26E837736E6AFE5887FBBC19367FD48F300A4CC51D2BD32E180DC65CBDC2EE1` |        78,363,970 bytes | `git bundle verify` passed; 263 refs; 12 reconciliation archive refs present |
| `Database-pre-primary-cleanup-20260722-200000.bundle`           | `D9200D52D26F5D2CB0E1F5E4AA6218F7086C525A02270D6F6468D64729BAC5AF` |        78,690,015 bytes | `git bundle verify` passed; complete history; 332 refs                       |
| `Database-local-refs-before-final-cleanup-20260719-0525.bundle` | retained independently                                             | existing July 19 backup | not replaced by either July 22 bundle                                        |

The late primary-checkout checkpoint is `refs/archive/pre-reconcile/20260722/primary-dirty-late` at `f10c89bb26054565d800726c086101e1440b7f31` (tree `ce66783afee7caf9d28fbd4342a5172fc42a5af1`). It was created with a separate index, excluded `.env*`, logs and `tmp-*`, and did not mutate the checkout.

The original external manifests remain next to the bundles. Secret-bearing worktrees are deliberately retained because ignored `.env.local` content is excluded from Git bundles.

## Landed protected-main PRs

| PR    | Merge commit                               | Disposition                                                                                  |
| ----- | ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| #1061 | `3e70a22c671da0199d507b00b0a77e9a99db2621` | SettingsDialog destructive/account action tests; no production behavior change               |
| #1062 | `ae950de196b2a8e39e88226f41ef941be14e415d` | Backend-only title-word RLS/ACL policy; read-only live drift clean                           |
| #1075 | `46f143d135afcd2f449ae6bedd05332a7af35f4d` | Binding-aware route-reachability AST with false-positive fixes                               |
| #1076 | `142646355a045314da85fa2b1582fdc45b2ac02e` | User-facing Therapy mode naming; `/therapy-compass` retained                                 |
| #1077 | `bf9a50836a445441f4d224686c54f1c4af257b6a` | Migration-role guardrails and dynamic Docker storage-owner discovery                         |
| #1078 | `001ce3543cb7e8020b0f6a5c3171f14601c73e6b` | Optional auth tri-state; invalid credentials fail 401; stale anonymous-upload patch rejected |
| #1079 | `a8814b671b43938428fe2dbba355bf5ddf79f5c9` | Current-project auth-cookie precedence; retired-project cookie ignored                       |
| #1080 | `6976aaeeece84680ed6ffc9e77f839f3a314ec4e` | Readiness fails closed for returned and thrown Supabase probe failures                       |
| #1081 | `a00638af2e1116896bedf493af0dbb591a707567` | Publication approval bound to locked canonical reviewed state with a new forward migration   |
| #1082 | `d302be1cfd033eacd64a42d7ef6fe1af3c3b03ac` | Current-main-only non-RAG salvage: malformed fallback-PDF images and live-test env loading   |
| #1083 | `0afa0a55501afd784bec9237dca9e1b5d98d849a` | Reproduced Firefox document-viewer test stabilization; stale browser hunks rejected          |
| #1084 | `589fb9b99e18061782b0c7b3fa6b14fa0e8388d5` | Bulk reindex partial success returns a completed result and refreshes successful work        |
| #1085 | `008a92b0fbad652484b6cdde6295bc456f4b7bf9` | DOCX count, per-artifact, aggregate-media, Word-XML and extracted-text budgets               |
| #1086 | `2963fba46eacd644618a588fa283f7597faa2644` | XLSX worksheet, row, rendered-cell and UTF-8 output budgets                                  |
| #1087 | `05dc52fd8408a65117e22a6236e43252203bea92` | Truthful account persistence/provider copy and unavailable-SSO presentation                  |

Related work that advanced main during the freeze was also retained rather than replayed: #1053 (operator-script archival), #1054/#1057 (content-first regression coverage), #1055 (obsolete RAG rescue issue closure), #1063 (document-viewer coverage), #1064 (browser upload precheck), and #1065 (webhook runbook).

## Original worktree/chat dispositions

| Original worktree or theme                               | Final disposition                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary `C:\Dev\Apps\Database`                           | Six unique commits were already represented or superseded. Dirty source was classified file-by-file; the only unique approved artifact is the staging-tenancy evidence added with this record. All other source is duplicate, rejected, or unproven and remains recoverable in the late checkpoint/bundles until final checkout cleanup. |
| `database-audit-drift-verify-07fcbb`                     | Operator-script archival landed through #1053; remaining audit notes are duplicate/advisory.                                                                                                                                                                                                                                             |
| `frontend-review-improve-123366` / upload precheck       | Landed independently through #1064; not replayed.                                                                                                                                                                                                                                                                                        |
| `mcp-phone-cloud-local-20375c` / governance audit        | Safe governance subset landed earlier through #1051; deferrals are captured in issues #032–#037. The worktree later evolved after the reconciliation freeze and is retained as post-freeze work.                                                                                                                                         |
| `prompt-skill-improvements-7d5f80` / content-first tests | Content-first coverage landed through #1057. The worktree later evolved into protected RAG diagnosis work represented by issues #018/#019 and is retained as post-freeze work.                                                                                                                                                           |
| `rag-ranking-safety-issues-09867c`                       | Obsolete rescue item closed through #1055. No protected RAG behavior was adopted.                                                                                                                                                                                                                                                        |
| `railway-token-secrets-setup-638ad6` / ACL alignment     | ACL content already represented. Secret-bearing worktree retained; no credential content entered Git or a bundle.                                                                                                                                                                                                                        |
| detached terminal checkpoint                             | Preserved by archive ref; no distinct approved content remained to land.                                                                                                                                                                                                                                                                 |
| `0a71` secret-location chat                              | Machine-specific secret path rejected; generic guidance was already represented. Worktree retained until its ignored secret has an authorised destination.                                                                                                                                                                               |
| `1b10` database drift chat                               | Read-only title-word drift verification completed with #1062; other live database operations remain provider/operations work, not source integration.                                                                                                                                                                                    |
| `2c2a` ingestion review                                  | Genuine bulk-reindex/DOCX/XLSX findings landed through #1084–#1086. Active-indexing safety was already on main; stale tenancy/audit claims were not reimplemented.                                                                                                                                                                       |
| `5708` P1 release patch                                  | Split and reimplemented through #1078–#1081. The stale timestamped migration and mixed patch were rejected.                                                                                                                                                                                                                              |
| `59db` document mockups                                  | Explicitly outside production reconciliation scope; retained as design work.                                                                                                                                                                                                                                                             |
| `5edf` sync-local-content                                | Exact-content duplicate/already represented; no replay.                                                                                                                                                                                                                                                                                  |
| `665f` route/Therapy patch                               | Repaired and split through #1075/#1076; raw identifier and arbitrary-href evidence rules rejected.                                                                                                                                                                                                                                       |
| `6fa3` repo-wide review                                  | Current non-RAG reproductions landed through #1082; remaining findings were stale, duplicate or captured as issues.                                                                                                                                                                                                                      |
| `762c` design audit                                      | Product-truth defects landed through #1087. Shared comparison behavior, catalogue-toolbar consolidation and visual baselines remain recommendations; no second Factsheets mode will be added.                                                                                                                                            |
| `94ca` outstanding-issues/RAG review                     | Genuine items deduplicated into the issue ledger. Semantic reranking, score spreading and unsafe alias/comparator changes remain rejected/provider-gated.                                                                                                                                                                                |
| `bounded-release-rerank-20260719`                        | Historical review/RAG follow-up; no blind replay. Surviving concerns remain issue-ledger/provider-gated work.                                                                                                                                                                                                                            |
| `fix-p2-audit-20260719`                                  | The 31-file patch was never replayed. Only reproduced current non-RAG/browser defects landed in #1082/#1083.                                                                                                                                                                                                                             |
| `migration-role-guardrails-20260719`                     | Reimplemented cleanly through #1077; stale workflow hunks/manifest rejected.                                                                                                                                                                                                                                                             |
| `mobile-safari-hidden-composer-edge`                     | Earlier focused UI work compared against evolved main; no additional reconciliation patch was justified. Preserved pending its separate branch lifecycle.                                                                                                                                                                                |
| `p2-remediation-clean/final-20260719`                    | Selective current-main salvage only; residual mixed content rejected or duplicate.                                                                                                                                                                                                                                                       |
| `p3-debt-fixes-20260719`                                 | No patch-unique integration candidate at capture; duplicate/advisory.                                                                                                                                                                                                                                                                    |
| `postgres-default-acl-pr-20260719`                       | Database ACL intent already represented by current schema/guardrails; no stale migration replay.                                                                                                                                                                                                                                         |
| `public-content-account-access`                          | Current auth defect reimplemented in #1078/#1079. Historical mixed branch preserved; no blind replay.                                                                                                                                                                                                                                    |
| `publish-local-content/finalize-20260719`                | Existing operational safeguards were already on main or captured as operator debt. Historical branches preserved; no blind replay.                                                                                                                                                                                                       |
| `railway-ops-staging-20260719`                           | Provider/operations state remained separate. Successful staging tenancy evidence is now checked in; no production deployment was triggered.                                                                                                                                                                                              |
| `release-browser-matrix-20260719`                        | Current Firefox failure reproduced and fixed in #1083; stale expectations, unrelated styles and existing service-worker isolation were rejected.                                                                                                                                                                                         |
| `retrieval-order-release-20260719`                       | Explicitly rejected. No comparator reordering, bulk alias widening, score spreading or semantic-rerank enablement.                                                                                                                                                                                                                       |
| reconciliation controller `e8ed`                         | Read-only controller retained until final local-main synchronization and worktree cleanup complete.                                                                                                                                                                                                                                      |

## Post-freeze work retained

Newer Cursor/Claude/Run-PR worktrees appeared after the original bundle snapshot, including the sidebar and document-accordion tasks, prompt-skill isolation, document-tab design, cloud-auth repair, webhook work, and PR-sweep branches. They are not reconciliation inputs and are retained until their owning tasks are handed off. They must not be inferred stale merely because this reconciliation finished.

## Explicitly rejected or not recommended

- The protected RAG score-spreading/comparator changes, wide alias-tier merge, semantic reranking enablement, and retrieval-order restoration. No current reproducer justified them and no live canary was needed.
- The original 31-file P2 patch and stale browser expectations.
- A broader process-kill implementation that removed Node filtering and descendant-tree targeting safeguards.
- The stale `deno.lock` snapshot, unresolved-conflict version of `docs/outstanding-issues.md`, and a Next config change that would re-enable `X-Powered-By`.
- Signed-image expectations that contradicted current component behavior.
- Broad speculative mobile dialog CSS using global role selectors and `!important` without a current reproducer.
- Twenty-seven untracked long-name skills that conflict with the canonical single-word skill catalog.
- Simplistic form-validation/keyboard polish and PWA/image micro-polish without a current defect proof.
- A second patient-facing Factsheets mode; future work should extend the existing Easy Read/Standard model.

## Primary-checkout unique-content decision

- Process ownership, script archival, formatting, staging-user administration, issue documentation and typing commits were already represented or superseded on main.
- `scripts/run-eval-safe.mjs`, `tests/eval-process-safety.test.ts` and `scripts/test-cross-tenant-staging.ts` matched or were safer on main.
- Safety Plan and eval-cost work were merged duplicates; the invalid file-input opacity variant was already corrected on main.
- The staging tenancy JSON was the sole unique approved artifact. GitHub run `29795051547` passed all listed cross-tenant checkpoints and cleanup at commit `578e94aed26c86832f1d6f15cbf67730ba690670`.

## Remaining intentional debt

- Provider/operations items remain in `docs/outstanding-issues.md`, including semantic-rerank gating, source-governance refresh, webhook activation and document-change trigger rollout.
- Protected answer-composition/RAG defects remain approval- and canary-gated. They were not made worse or silently closed by this reconciliation.
- The WebKit `_rsc` test-harness issue remains separate from #1083's reproduced Firefox stabilization.
- Secret-bearing and post-freeze active worktrees remain until their owners provide a safe handoff.

## Verification status

Every implementation PR used a red reproducer or exact content proof, focused checks, `verify:cheap`, PR-local handoff evidence where selected, hosted required checks, and zero actionable review threads. Database PRs additionally used disposable replay/drift/ACL/owner-scope guards. UI PRs used identity-verified local servers and Chromium UI gates.

The final forced-offline aggregate proved Node/npm runtime compatibility, lint, type-check, the production build/client-bundle secret scan, 364 passing Vitest files (3,222 passed and one skipped), 29 guarded SECURITY DEFINER functions, 40 owner-scoped API files, 36 RAG fixtures, and 307 offline RAG contract tests. The local full Playwright matrix exceeded its 30-minute wrapper limit while still progressing through WebKit. One retained Firefox failure artifact from that interrupted run was rechecked in isolation and passed (1/1); every implementation PR's hosted required/browser checks was green on its final head. The interrupted local matrix is recorded as incomplete rather than passed and was not repeatedly rerun. No live provider evaluation or production mutation was needed; RAG spend remained $0 of the authorised $15 total budget.
