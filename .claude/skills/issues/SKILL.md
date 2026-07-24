---
name: issues
description: Track and recall all outstanding tasks, recommendations, and issues for this repo as durable cross-session memory. Use when the user types "/issues" (state the open items back), or asks to add/close/update/capture an outstanding task, recommendation, or issue. The memory lives in docs/outstanding-issues.md; a plain "/issues" is read-only.
---

# issues — the outstanding-work memory

`docs/outstanding-issues.md` is the single universal, durable, cross-session ledger for recommended
execution order, open **tasks**, **recommendations**, **issues**, provider/operator work, and archive
history. Chat context resets; that file does not. This skill reads it back and keeps it current.

**The ledger is the source of truth, not chat memory.** Never answer `/issues` from conversation
recall — always read the file first, so the answer is correct even in a fresh session.

## Trigger

- User types `/issues` (optionally with a subcommand or filter below).
- User asks to add / close / update / list / capture an outstanding task, recommendation, or issue.

## Default: `/issues` (read-only)

1. Read `docs/outstanding-issues.md`.
2. State the **Recommended execution queue** back in order, including acuity, timing, and gate.
3. Summarize any open items not represented in that queue, grouped by priority (P1 → P3), each as
   `#ID · type · summary — next action (source)`.
4. End with a one-line open/recommended count.
5. Do **not** mutate the file or commit on a plain read.

If a filter is given, filter the open items before rendering steps 2–3, then show only matching
queued tasks and matching non-queued items: `/issues P1` (by priority), `/issues issues` /
`/issues recs` / `/issues tasks` (by type), `/issues <keyword>` (summary/detail substring match).

## Mutating subcommands

Parse the intent from natural language too — the exact syntax is a convenience, not a requirement.

- **`/issues add <text>`** — append a row to **Open items**. Infer `Pri`/`Type` from the text
  (ask only if genuinely ambiguous; default `P2`/`task`). Allocate the ID from the
  `<!-- issues:next-id=NNN -->` marker, then bump that marker. Fill `Source` with
  `session <today>` unless the user names one; `Added` is today's date.
- **`/issues done <id> [outcome]`** — move that row from **Open items** to **Resolved / archive**
  with today's date and a one-line outcome. Archive, never delete.
- **`/issues update <id> <text>`** — edit an open row's summary or next action in place.
- **`/issues capture`** — scan the current session for recommendations, follow-ups, deferrals, and
  unfixed problems that surfaced but were not recorded. Propose them as a numbered list and add the
  confirmed ones (dedupe against existing rows first — do not re-add something already tracked).

## Capture discipline (proactive memory)

When a task in _any_ session ends with unresolved follow-ups — a deferred fix, a "revisit when X"
recommendation, a known risk, a TODO you had to leave — offer to record them here before the context
is lost. That is what makes this a memory rather than a static list. Prefer one crisp row over a
paragraph; put the smallest next action in **Detail / next action**.

## Writing rules

- Keep the table format and column order exactly as in `docs/outstanding-issues.md`. One row per item.
- Add a retained task to the recommended queue with order, acuity, capability, timing, estimate,
  gate, success criteria, verification, and stop rule. Reorder rather than duplicate related work.
- Remove a task from the recommended queue when it completes or is no longer recommended; retain
  its evidence in the open or resolved table as appropriate.
- IDs are monotonic and never reused — always allocate from the `issues:next-id` marker and bump it.
- Escape `|` inside cell text (write `\|`) so the markdown table stays intact.
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
