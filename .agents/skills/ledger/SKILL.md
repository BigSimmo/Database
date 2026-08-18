---
name: ledger
description: Sweep the current session, repo/task context, local task files, and approved remote task stores for outstanding actionable work, then record high-confidence items in docs/outstanding-issues.md. Use when the user types /ledger or asks to extract, capture, or reconcile outstanding tasks from this session into the ledger.
---

# Ledger

1. Target outstanding-issues intake only — never the review ledger or `ledger:*` npm scripts.
2. Sweep chat, git state, changed files, and local notes for deferred work, unresolved TODOs, blockers, and unmet criteria. Remote task stores stay approval-gated.
3. Report tasks, risks/blockers, and up to three `/ledger` suggestions before writing.
4. Keep high-confidence items only; dedupe against open rows by intent and reference duplicates as `#NNN`.
5. Queue with `npm run issues:add -- --pri P2 --type issue --summary "<title>" --detail "<detail>" --source "session YYYY-MM-DD /ledger sweep"` — never hand-edit. It creates one inbox record; a dedicated branch runs `npm run issues:reconcile`. If nothing is new, create no request.
6. Run `npm run check:outstanding-issues` as a read-only validation when useful. Canonical Markdown changes only at reconciliation.
7. Commit the immutable inbox request file when asked; run `npm run issues:reconcile` only from a serialized current-main worktree after the request branch lands. Never push without an explicit ask.
8. Full procedure and fields: `.claude/skills/ledger/SKILL.md`.
