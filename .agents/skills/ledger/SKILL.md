---
name: ledger
description: Sweep the current session, repo/task context, local task files, and approved remote task stores for outstanding actionable work, then record high-confidence items in docs/outstanding-issues.md. Use when the user types /ledger or asks to extract, capture, or reconcile outstanding tasks from this session into the ledger.
---

# Ledger

1. Target `docs/outstanding-issues.md` only — never `docs/branch-review-ledger.md` or the `ledger:*` npm scripts, which belong to the review ledger.
2. Sweep the full chat context, git state, files touched this session, and local task notes for deferred work, unresolved TODO/"should"/"follow up" statements, blockers, and unmet acceptance criteria. Remote task stores (GitHub, MCP) stay approval-gated.
3. Report before writing, in order: confirmed outstanding tasks, risky/blocked areas, then up to three `/ledger` improvement suggestions.
4. Keep only useful high-confidence items; dedupe against existing open rows by intent and reference duplicates as `#NNN`.
5. Append via `npm run issues:add -- --pri … --type … --summary … --detail … --source "session <date> /ledger sweep"` — never hand-edit the table. If nothing new, add one dated no-op note line.
6. Run `npm run check:outstanding-issues`, then commit only `docs/outstanding-issues.md`; no push without an explicit ask.
7. Full procedure and field mapping: `.claude/skills/ledger/SKILL.md`.
