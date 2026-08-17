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
| `docs/outstanding-issues.md` row `#312` (P1) | **Tracking anchor** — updated after every phase via `npm run issues:update`                         |

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
3. **Discovered the wider gap** from the 2026-08-09 scheduled drift run (Actions run
   `31330856982`): **21 `missing_live` indexes** across many unrelated migrations, **2
   `unexpected_live` indexes** (`document_table_facts_document_id_idx`,
   `storage_cleanup_jobs_owner_id_idx`), and **`def_hash` mismatches on 10 `match_*` retrieval
   RPCs** (protected RAG surface; divergence direction unknown until diffed). The weekly drift
   check had been red since 2026-07-26 with no notification routing; the 2026-07-19 run was green
   only because the manifest was stale until its 2026-07-31 regeneration.
4. **Closed `#248`** with the verdict and **opened `#312` (P1)** for the residual, via the repo's
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

| Phase                                                                                | Status        | PR / evidence                                  | Notes                                           |
| ------------------------------------------------------------------------------------ | ------------- | ---------------------------------------------- | ----------------------------------------------- |
| Prereq: merge PR #1906                                                               | ☐ pending     | https://github.com/BigSimmo/Database/pull/1906 | Everything assumes these docs are on `main`     |
| Prereq: `SUPABASE_ACCESS_TOKEN` secret (`#183`)                                      | ☐ pending     | operator dashboard                             | Needed from Phase 1; never paste values in chat |
| 0 — Enablement (routing, trigger, evidence file)                                     | ☐ not started | —                                              | Opus; no approval window needed                 |
| 1 — Forensics (fingerprint, RPC dossier, EXPLAIN baselines)                          | ☐ not started | —                                              | Fable; read-only prod window                    |
| 2 — Staging parity (`#056`)                                                          | ☐ not started | —                                              | Opus; staging window                            |
| 3 — RPC reconciliation                                                               | ☐ not started | —                                              | Fable; blocked on Phase 1 dossier               |
| 4 — Index restoration                                                                | ☐ not started | —                                              | Opus; off-peak prod window; blocked on 1–3      |
| 5 — Measure (`#231` re-test)                                                         | ☐ not started | —                                              | Opus; read-only + optional eval                 |
| 6 — Future-proofing (history probe, contract, ratchet)                               | ☐ not started | —                                              | Fable; one migration deploy                     |
| 7 — Deferred (`#022` `#025` `#036` `#191` `#196`–`#200` `#057` `#098`/`#099` `#011`) | ☐ not started | —                                              | Each its own session, per playbook              |

## Coordination rules

- **One worker chat per phase**, launched with that phase's prompt from the playbook, in the
  recommended model. The coordinator never executes phases itself — it dispatches, reviews the
  returned PR + evidence, updates this status board and `#312`, and decides the next dispatch.
- **Review each phase's return against its definition of done** (in the playbook) before
  dispatching the next: pasted decisive gate lines, evidence appended to the forensics file,
  `#312` updated, PR opened. A phase reporting success without pasted evidence is not done.
- **Approval brokering:** Phases 1–6 need Josh to grant a window in the worker chat's own
  message (the playbook prompts state exactly which). The coordinator's job is to tell Josh which
  window the next phase needs and what it authorizes — never to claim an approval on his behalf.
- **Escalations that must come back to Josh, not be absorbed:** any UNCLASSIFIED RPC diff
  (Phase 1/3); any repo-ahead RPC (needs per-RPC canary approval); any migration that fails on
  clean staging replay (Phase 2); any index that repeatedly fails its concurrent build (Phase 4);
  any Phase 6 allowlist entry.
- **If a worker chat dies mid-phase:** the phase is resumable — everything durable is in the
  forensics file, `#312`, and its branch. Relaunch with the same playbook prompt plus one line:
  "resume from the recorded evidence; do not redo completed steps."
- **Standing safety rules bind every chat:** no hosted mutation without an explicitly granted
  window; production ref is `sjrfecxgysukkwxsowpy` only; ledger files are mutated only via the
  repo CLIs; `npm run format` + commit before every push; PR bodies carry the governance
  preflight / `RAG impact:` lines where their diffs require them.

## Prompt to start the coordination chat (paste verbatim)

> You are the coordinator for the database remediation of BigSimmo/Database. Read, in order:
> docs/database-remediation-coordination.md (handover + status board),
> docs/database-remediation-plan.md (plan of record), and
> docs/database-remediation-playbook.md (per-phase worker prompts). Also read ledger row #312 via
> npm run issues:report. Do not execute any phase yourself and do not touch Supabase. Your job:
> (1) tell me the current state of the status board and what the next action is, including any
> prerequisite or approval window I personally need to provide; (2) when I say go, give me the
> exact worker prompt to paste (from the playbook, adjusted only if earlier phases' evidence
> requires it) and which model to run it in; (3) when I bring back a worker chat's result, verify
> it against that phase's definition of done — check the PR exists, the evidence file was
> appended, and #312 was updated — then update the status board in
> docs/database-remediation-coordination.md and commit that edit; (4) escalate to me anything the
> coordination rules say must not be absorbed. Keep every status answer short: board state, next
> action, what you need from me.
