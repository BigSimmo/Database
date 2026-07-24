---
name: issues
description: Track and recall all outstanding tasks, recommendations, and issues for this repo as durable cross-session memory. Use when the user types "/issues" (state the open items back), or asks to add/close/update/capture an outstanding task, recommendation, or issue. The memory lives in docs/outstanding-issues.md; a plain "/issues" is read-only.
---

# issues — the universal task ledger

`docs/outstanding-issues.md` is the single durable, cross-session task ledger. Its ordered **Open
items** table is the only active queue. Legacy evidence and resolved sections are history, not work.
Chat context resets; that file does not. This skill reads it back and keeps it current.

**The ledger is the source of truth, not chat memory.** Never answer `/issues` from conversation
recall — always read the file first, so the answer is correct even in a fresh session.

## Trigger

- User types `/issues` (optionally with a subcommand or filter below).
- User asks to add / close / update / list / capture an outstanding task, recommendation, or issue.

## Default: `/issues` (read-only)

1. Read `docs/outstanding-issues.md`.
2. State the **open items** back in the table's recommended **Order**, each as
   `Order · #ID · priority/acuity · type · task — when; next action`.
3. End with a one-line count, e.g. `5 open: 0×P1, 3×P2, 2×P3 · 0 resolved this session`.
4. Do **not** mutate the file or commit on a plain read.

If a filter is given, narrow step 2: `/issues P1` (by priority), `/issues issues` / `/issues recs`
/ `/issues tasks` (by type), `/issues <keyword>` (summary/detail substring match).

## Mutating subcommands

Parse the intent from natural language too — the exact syntax is a convenience, not a requirement.

- **`/issues add <text>`** — append a row to **Open items** at the next order. Infer
  `Pri`/`Acuity`/`Type` (ask only if genuinely ambiguous; default `P2`/`A2`/`task`). Allocate the ID
  from the `<!-- issues:next-id=NNN -->` marker, then bump it. Fill every execution field; use
  `session <today>` as the source unless the user names one.
- **`/issues done <id> [outcome]`** — move that row from **Open items** to **Resolved / archive**
  with today's date and a one-line outcome. Archive, never delete.
- **`/issues update <id> <text>`** — edit an open row's summary or next action in place.
- **`/issues capture`** — scan the current session for recommendations, follow-ups, deferrals, and
  unfixed problems that surfaced but were not recorded. Propose them as a numbered list and add the
  confirmed ones. Dedupe against the whole file, including legacy evidence and resolved history.

## Capture discipline (proactive memory)

When a task in _any_ session ends with unresolved follow-ups — a deferred fix, a "revisit when X"
recommendation, a known risk, a TODO you had to leave — offer to record them here before the context
is lost. That is what makes this a memory rather than a static list. Prefer one crisp row over a
paragraph; put the smallest next action in **Detail / next action**.

## Writing rules

- Keep the Open items table format and column order exactly as in `docs/outstanding-issues.md`. One
  row per item; keep Order contiguous after any mutation.
- IDs are monotonic and never reused — always allocate from the `issues:next-id` marker and bump it.
- Escape `|` inside cell text (write `\|`) so the markdown table stays intact.
- Fill acuity, intelligence, timing, effort, dependencies/approvals, success/verification, stop rule,
  and source/update fields. Do not put a claim into Open items unless it remains recommended.
- Respect the repo's RAG/clinical/privacy flagging rules if an item _itself_ touches a protected
  surface — recording it here is fine, but acting on it later still needs the usual gate.

## Persist the memory (commit)

After any mutation, stage and commit **only** `docs/outstanding-issues.md` so the memory survives the
ephemeral container and other worktrees:

```
git add docs/outstanding-issues.md
git commit -m "issues: <what changed>"
```

Do not stage or commit anything else, and do not push unless the user asks (or you are already in a
handoff/upload flow). A plain read-only `/issues` commits nothing.
