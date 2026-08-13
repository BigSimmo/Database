---
name: ledger
description: Sweep the current session, repo/task context, local task files, and approved remote task stores for outstanding actionable work, then record high-confidence items in docs/outstanding-issues.md. Use when the user types /ledger or asks to extract, capture, or reconcile outstanding tasks from this session into the ledger.
---

# Ledger

1. Target the outstanding-issues workflow only — never the review ledger or `ledger:*` npm scripts.
2. Sweep chat, git state, changed files, and local notes for deferred work, unresolved TODOs, blockers, and unmet criteria. Remote task stores stay approval-gated.
3. Report confirmed tasks, risky/blocked areas, then up to three `/ledger` suggestions before writing.
4. Keep high-confidence items only; dedupe against open rows by intent and reference duplicates as `#NNN`.
5. Queue with `npm run issues:add -- --pri P2 --type issue --summary "<title>" --detail "<detail>" --source "session YYYY-MM-DD /ledger sweep"` — never hand-edit. It creates one merge-safe inbox record; a dedicated branch later runs `npm run issues:reconcile`. If nothing is new, create no request.
6. Run `npm run check:outstanding-issues`. Do not refresh the visual register: canonical Markdown changes only at reconciliation.
7. Commit the request only when asked; never push without an explicit ask.
8. Full procedure and fields: `.claude/skills/ledger/SKILL.md`.
