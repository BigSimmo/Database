# Database remediation — coordination handover

Written 2026-08-17 at the end of the originating investigation session (Claude Code, Fable).
Purpose: seed a **coordination chat** that oversees the whole remediation across many worker
chats. This file is the complete record of what that session established, decided, and produced —
a future coordinator needs nothing from the original chat transcript beyond this file and the two
documents it points to.

## The document set (all committed via PR #1906)

| Document                                     | Role                                                                                                |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `docs/database-remediation-plan.md`          | **Plan of record** — Phases 0–7, ordering rationale, approval map                                   |
| `docs/database-remediation-playbook.md`      | **Worker guide** — full context briefing + a copy-paste prompt per phase, with model recommendation |
| this file                                    | **Coordinator handover** — history, decisions, status board, coordination rules                     |
| `docs/audit/live-drift-forensics-2026-08.md` | **Evidence file** (created in Phase 0) — all live findings land here                                |
| `docs/outstanding-issues.md` row `#316` (P1) | **Tracking anchor** — updated after every phase via `npm run issues:update`                         |

> **Anchor correction (2026-08-17 coordinator review).** The originating session cited the anchor
> as `#312`; after inbox reconciliation the live-drift row is **`#316`** ("Live DB has 20 currently
> missing repo-defined indexes and 10 retrieval RPC bodies diverge …"). `#312` is an unrelated
> Playwright-revision row. Resolve by exact title, never by remembered number (playbook trap list).

## Complete history of what the originating session did

1. **Investigated ledger `#248`** ("why were 20260705180000's search-health indexes missing on
   live despite applied history?"). Method: repo forensics + PR #1614's record + the
   `live-drift.yml` GitHub Actions run history and failure logs. No hosted database access was
   used or needed.
2. **Verdict (now recorded in `#248`'s archived row):** the migration's DDL **never executed on
   live**; its history row was recorded out-of-band (mark-applied / history repair, or hand-apply
   of only the function half). Proof: Supabase runs each migration in one transaction (persisted
   partial apply impossible); the later 2026-07-06 migrations are behaviorally live, so the
   history row had to pre-exist them; and two of its ten indexes are _still_ missing on live.
   Excluded: "indexes manually dropped later" and "partial transaction".
   > **Superseded by Phase 1.1 (2026-08-14, forensics file §1.1):** the live fingerprint shows
   > `20260705180000` with `stmt_count 14` — its DDL **was** recorded as executed, so it does not
   > carry the mark-applied signal. The "never executed" verdict above is history, not the current
   > finding. Current position: created-then-dropped between 2026-07-05 and 2026-08-02, cause
   > unattributed (dashboard audit-history pairing is owner action); `#248` stays open.
3. **Discovered the wider gap** from the 2026-08-09 scheduled drift run (Actions run
   `31330856982`): **21 `missing_live` indexes** across many unrelated migrations, **2
   `unexpected_live` indexes** (`document_table_facts_document_id_idx`,
   `storage_cleanup_jobs_owner_id_idx`), and **`def_hash` mismatches on 10 `match_*` retrieval
   RPCs** (protected RAG surface; divergence direction unknown until diffed). The weekly drift
   check had been red since 2026-07-26 with no notification routing; the 2026-07-19 run was green
   only because the manifest was stale until its 2026-07-31 regeneration.
4. **Closed `#248`** with the verdict and **opened the P1 residual row (renumbered to `#316` after inbox reconciliation)**, via the repo's
   `outstanding-issues.mjs` writer.
5. **Authored the plan and playbook** (documents above), designed the 8-phase remediation with
   future-proofing, and pushed everything to branch `claude/fable-tasks-issues-49hnvp` /
   **PR #1906**.

Key evidence pointers a coordinator may need to re-verify claims: Actions runs `30763871562`
(2026-08-02 failure log — the 25-missing-index list including the four later repaired) and
`31330856982` (2026-08-09 — current state); PR #1614 (the 2026-08-04 repair: operator
`CREATE INDEX CONCURRENTLY` prebuild + fail-fast marker migration `20260804110240`).

## Decisions already made (do not re-litigate in worker chats)

- **Order:** routing/enablement → read-only forensics → staging rehearsal → RPC reconciliation →
  index restoration → measurement → future-proofing → deferred debt. RPCs before indexes because
  only RPCs can change _which_ chunks are retrieved (clinical risk); indexes only change speed.
- **Repair pattern:** every live fix is prebuilt concurrently, validated
  (`indisvalid`/`indisready` + normalized `pg_get_indexdef`), then codified with a fail-fast
  guard migration per `20260804110240`. **Never** raw-SQL a drift fix, never transactional index
  builds on production, never a history repair without a guard migration.
- **`#102` stays separate:** the two trigram indexes in Phase 4 are the canonical
  `20260705180000` definitions (completing a recorded migration); `#102`'s bare-column indexes
  remain their own canary-gated work.
- **Model split:** Fable for Phases 1, 3, 6 and later `#191` (judgment on protected/privacy
  surfaces); Opus for Phases 0, 2, 4, 5, 7 (execution against written spec).
- **Estimates:** ~15–25 focused hours total for Phases 0–6, spread across approval windows;
  Phase 3 is the schedule variable (each repo-ahead RPC adds a canary at ~$1–2).

## Status board (coordinator: update this table as phases land)

_Board re-baselined 2026-08-17 by the coordination chat from `main` (`f5b093291`), the forensics
file, ledger `#316`, and the merged PR list — not from any worker chat's self-report._

| Phase                                                                                | Status                | PR / evidence                                                                                                                       | Notes                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------ | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prereq: merge PR #1906                                                               | ☑ done 2026-08-13     | #1906 merged `4bbc4c5ca`; traps + parallel-session rules added by #2027 (`a75d226b0`)                                               | Plan + playbook on `main`. This coordination file itself was still unmerged (branch tip `dc8969676`) until carried by the coordination chat's PR.                                                                                                                         |
| Prereq: `SUPABASE_ACCESS_TOKEN` secret (`#183`)                                      | ☐ pending             | repo-level secret names checked 2026-08-17: not present (env-level unverified)                                                      | Operator dashboard work; needed for migration-history CLI reads. Phase 1.1/1.3 ran anyway via the owner-authorised Supabase connector, so this gates CLI repair paths, not reads.                                                                                         |
| 0 — Enablement (routing, trigger, evidence file)                                     | ☑ COMPLETE 2026-08-14 | #1938, #1939 (built twice — `#292`), #1951 (forced-dispatch proof, run `31813064485`, auto-issue #1963), #1978 (ledger/guard fixes) | Routing live; `tests/live-drift-workflow.test.ts` covers it offline. Issue #1963 still OPEN — last "still failing" comment 2026-08-17 (run `32011535189`) — expected until Phases 3–4 land.                                                                               |
| 1 — Forensics (fingerprint, RPC dossier, EXPLAIN baselines)                          | ◐ PARTIAL             | #1960, #1970 → `docs/audit/live-drift-forensics-2026-08.md` §1.1–1.3                                                                | 1.1 done (`20260705180000` NOT mark-applied, 14 stmts; drop window 2026-07-05→08-02; cause unattributed, `#248` open). 1.3 done for whole schema (20 absent, 2 orphaned, zero invalid). **1.2 gating:** 6/16 mismatches proven noise, **10 UNCLASSIFIED**, hunks pending. |
| 1.2 — RPC dossier finish (read-only prod window)                                     | ☐ NEXT                | hypothesis in `#316` update (PR #2017): `SET work_mem` from `20260724000000` may classify 8/10 in one query                         | Fable. The only executable next step. Two `_v2` outliers need real diffs (canonical bodies named in `#316`).                                                                                                                                                              |
| 2 — Staging parity (`#056`)                                                          | ☐ not started         | `#056` corrected by #2016: gap is **26 and widening**                                                                               | Opus; staging window. Can run concurrently with 1.2 (different targets; `#056` is its ledger row).                                                                                                                                                                        |
| 3 — RPC reconciliation                                                               | ☐ BLOCKED             | —                                                                                                                                   | Fable. Zero executable entries until 1.2 classifies (playbook forbids touching UNCLASSIFIED). Do not request a production window yet.                                                                                                                                     |
| 4 — Index restoration                                                                | ◐ PARTIAL (incident)  | #1960 §Phase 4: `documents_title_trgm_idx` + `document_chunks_content_trgm_idx` restored 2026-08-14 (648 kB / 68 MB, valid+ready)   | Opus; off-peak prod window; blocked on 1–3. **20** still missing, 2 unexpected undispositioned, guard migration for the repaired pair still owed (plan 4.4), no green live-drift yet.                                                                                     |
| 5 — Measure (`#231` re-test)                                                         | ◐ PARTIAL (incident)  | #1960 §Phase 5: text fast path 31,610 → 1,535 ms; hybrid 21,757 → 8,519 ms                                                          | `#231` verdict: retrieval latency was the binding cause in that window; hybrid ~8.5 s residual owned by remaining phases. Full EXPLAIN set + `check:production-readiness` pending.                                                                                        |
| 6 — Future-proofing (history probe, contract, ratchet)                               | ☐ not started         | —                                                                                                                                   | Fable; one migration deploy. Can be designed repo-side any time; deploy after Phase 4.                                                                                                                                                                                    |
| 7 — Deferred (`#022` `#025` `#036` `#191` `#196`–`#200` `#057` `#098`/`#099` `#011`) | ☐ not started         | —                                                                                                                                   | Each its own session, per playbook.                                                                                                                                                                                                                                       |

**Ledger state note (2026-08-17):** the `#316` "Phase 3 next" correction (PR #2017) and the `#056`
correction (PR #2016) are inbox requests; the reconcile that applies them to the canonical table is
open PR #2032 (`BEHIND` at review time). Until it lands, `npm run issues:report` still shows the
pre-correction prose — read the inbox request, not the row.

## Coordination rules

- **One worker chat per phase**, launched with that phase's prompt from the playbook, in the
  recommended model. The coordinator never executes phases itself — it dispatches, reviews the
  returned PR + evidence, updates this status board and `#316`, and decides the next dispatch.
- **Review each phase's return against its definition of done** (in the playbook) before
  dispatching the next: pasted decisive gate lines, evidence appended to the forensics file,
  `#316` updated, PR opened. A phase reporting success without pasted evidence is not done.
- **Approval brokering:** Phases 1–6 need Josh to grant a window in the worker chat's own
  message (the playbook prompts state exactly which). The coordinator's job is to tell Josh which
  window the next phase needs and what it authorizes — never to claim an approval on his behalf.
- **Escalations that must come back to Josh, not be absorbed:** any UNCLASSIFIED RPC diff
  (Phase 1/3); any repo-ahead RPC (needs per-RPC canary approval); any migration that fails on
  clean staging replay (Phase 2); any index that repeatedly fails its concurrent build (Phase 4);
  any Phase 6 allowlist entry.
- **If a worker chat dies mid-phase:** the phase is resumable — everything durable is in the
  forensics file, `#316`, and its branch. Relaunch with the same playbook prompt plus one line:
  "resume from the recorded evidence; do not redo completed steps."
- **Standing safety rules bind every chat:** no hosted mutation without an explicitly granted
  window; production ref is `sjrfecxgysukkwxsowpy` only; ledger files are mutated only via the
  repo CLIs; `npm run format` + commit before every push; PR bodies carry the governance
  preflight / `RAG impact:` lines where their diffs require them.

## Prompt to start the coordination chat (paste verbatim)

> You are the coordinator for the database remediation of BigSimmo/Database. Read, in order:
> docs/database-remediation-coordination.md (handover + status board),
> docs/database-remediation-plan.md (plan of record), and
> docs/database-remediation-playbook.md (per-phase worker prompts). Also read ledger row #316 via
> npm run issues:report (#316 is the anchor; the originating session's `#312` citation was wrong). Do not execute any phase yourself and do not touch Supabase. Your job:
> (1) tell me the current state of the status board and what the next action is, including any
> prerequisite or approval window I personally need to provide; (2) when I say go, give me the
> exact worker prompt to paste (from the playbook, adjusted only if earlier phases' evidence
> requires it) and which model to run it in; (3) when I bring back a worker chat's result, verify
> it against that phase's definition of done — check the PR exists, the evidence file was
> appended, and #316 was updated — then update the status board in
> docs/database-remediation-coordination.md and commit that edit; (4) escalate to me anything the
> coordination rules say must not be absorbed. Keep every status answer short: board state, next
> action, what you need from me.
