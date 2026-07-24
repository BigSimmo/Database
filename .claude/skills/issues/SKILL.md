---
name: issues
description: Track and recall all outstanding tasks, recommendations, and issues for this repo as durable cross-session memory. Use when the user types "/issues" (state the open items back), or asks to add/close/update/capture an outstanding task, recommendation, or issue. The memory lives in docs/outstanding-issues.md; a plain "/issues" is read-only.
---

# issues — the universal task ledger

`docs/outstanding-issues.md` is the single durable, cross-session ledger. Its **Prioritised queue**
is the authoritative list of work still recommended; the evidence register and resolved archive in
the same file preserve supporting detail and history. Chat context resets; that file does not.

**The ledger is the source of truth, not chat memory.** Never answer `/issues` from conversation
recall — always read the file first, so the answer is correct even in a fresh session.

## Trigger

- User types `/issues` (optionally with a subcommand or filter below).
- User asks to add / close / update / list / capture an outstanding task, recommendation, or issue.

## Default: `/issues` (read-only)

1. Read `docs/outstanding-issues.md`.
2. State the **Prioritised queue** back in execution order. Include source/ID, outcome, acuity,
   timing, dependency or approval, and stop rule concisely.
3. End with counts by acuity (`A1`, `A2`, `A3`, `Optional`) and the total active rows.
4. Do **not** mutate the file or commit on a plain read.

If a filter is given, narrow step 2: `/issues A2`, `/issues Optional`, `/issues <ID/source>`, or
`/issues <keyword>` (queue outcome/evidence substring match).

## Mutating subcommands

Parse the intent from natural language too — the exact syntax is a convenience, not a requirement.

- **`/issues add <text>`** — add one row to the **Prioritised queue** with order, source/ID,
  outcome, acuity, capability, timing, effort, dependencies/approvals, and success/stop rule. Add a
  supporting evidence-register row when the task needs a durable issue ID. Allocate that ID from
  `<!-- issues:next-id=NNN -->`, bump the marker, and use `session <today>` as the source when none
  is supplied.
- **`/issues done <id-or-source> [outcome]`** — remove the active queue row and move/update its
  evidence row under **Resolved / archive** with today's date and a one-line outcome. Archive,
  never erase evidence.
- **`/issues update <id-or-source> <text>`** — update the queue row and its evidence row together.
- **`/issues capture`** — scan the current session for recommendations, follow-ups, deferrals, and
  unfixed problems that surfaced but were not recorded. Propose them as a numbered list and add the
  confirmed ones (dedupe against existing rows first — do not re-add something already tracked).

## Capture discipline (proactive memory)

When a task in _any_ session ends with unresolved follow-ups — a deferred fix, a "revisit when X"
recommendation, a known risk, a TODO you had to leave — offer to record them here before the context
is lost. That is what makes this a memory rather than a static list. Prefer one crisp row over a
paragraph; put the smallest next action in **Detail / next action**.

## Writing rules

- Keep the queue and evidence table formats exactly as in `docs/outstanding-issues.md`. One queue
  row per active work order.
- Renumber the active queue when sequencing changes; evidence IDs remain monotonic and never change.
- An evidence-register row is not active work unless it also appears in the Prioritised queue.
- IDs are monotonic and never reused — always allocate from the `issues:next-id` marker and bump it.
- Escape `|` inside cell text (write `\|`) so the markdown table stays intact.
- Respect the repo's RAG/clinical/privacy flagging rules if an item _itself_ touches a protected
  surface — recording it here is fine, but acting on it later still needs the usual gate.

## Persist the memory (commit)

After a ledger-only mutation, stage and commit **only** `docs/outstanding-issues.md` so the memory
survives the ephemeral container and other worktrees:

```
git add docs/outstanding-issues.md
git commit -m "issues: <what changed>"
```

Do not stage or commit anything else, and do not push unless the user asks (or you are already in a
handoff/upload flow). A plain read-only `/issues` commits nothing.
