---
name: issues
description: Maintain and recall the repository's single universal recommended task ledger. Use when the user types "/issues" (state the recommended execution queue back), or asks to add, close, update, or capture work. The memory lives in docs/outstanding-issues.md; a plain "/issues" is read-only.
---

# issues — universal task-ledger memory

`docs/outstanding-issues.md` is the durable, cross-session memory and single universal task ledger.
Its **Recommended execution queue** is the only active repository-wide work order. The Open and
Resolved tables retain source detail and audit history; an open row is not active work unless it is
also represented in the recommended queue.

**The ledger is the source of truth, not chat memory.** Never answer `/issues` from conversation
recall — always read the file first, so the answer is correct even in a fresh session.

## Trigger

- User types `/issues` (optionally with a subcommand or filter below).
- User asks to add / close / update / list / capture an outstanding task, recommendation, or issue.

## Default: `/issues` (read-only)

1. Read `docs/outstanding-issues.md`.
2. State the **Recommended execution queue** back in numeric order, each as
   `order · source · acuity · outcome — classification; when; estimate`.
3. End with a one-line count by acuity, e.g. `5 recommended: 0×P1, 3×P2, 2×P3`.
4. Do **not** mutate the file or commit on a plain read.

If a filter is given, narrow step 2 by acuity, source ID, classification, intelligence, timing, or
outcome keyword. Read the matching source row when more detail is requested.

## Mutating subcommands

Parse the intent from natural language too — the exact syntax is a convenience, not a requirement.

- **`/issues add <text>`** — verify that the work is current, deduplicated, evidence-supported, and
  still recommended. Then append a detailed source row to **Open items**, add its concise ordered row
  to the **Recommended execution queue**, and bump `<!-- issues:next-id=NNN -->`. Capture outcome,
  acuity, classification, intelligence, timing, estimate, dependencies/approvals, success criteria,
  verification, and stopping condition. Ask when a high-impact field cannot safely be inferred.
- **`/issues done <id> [outcome]`** — move that row from **Open items** to **Resolved / archive**
  with today's date and a one-line outcome, remove that ID from the recommended queue, and renumber
  queue order contiguously. For a grouped queue row, remove only that ID unless none remain.
- **`/issues update <id> <text>`** — edit the source row and synchronize every affected queue field.
- **`/issues capture`** — scan the current session for recommendations, follow-ups, deferrals, and
  unfixed problems. Verify them against current repository evidence, remove completed/stale/
  duplicate/superseded/speculative/uneconomic candidates, and propose only work still recommended.
  Add confirmed items to both active and source tables.

## Capture discipline (proactive memory)

When a task ends with a verified follow-up worth doing, offer to record it before context is lost.
Do not capture every suggestion or TODO. Prefer one crisp source row and one ordered queue row over a
paragraph, and state the smallest next action and stop condition.

## Writing rules

- Keep the table format and column order exactly as in `docs/outstanding-issues.md`. One row per item.
- IDs are monotonic and never reused — always allocate from the `issues:next-id` marker and bump it.
- Queue order is contiguous and dependency-aware. Re-evaluate affected rows after each mutation.
- Keep nonrecommended/refuted/parked claims out of the queue; retain them below only as audit history.
- Escape `|` inside cell text (write `\|`) so the markdown table stays intact.
- Respect the repo's RAG/clinical/privacy flagging rules if an item _itself_ touches a protected
  surface — recording it here is fine, but acting on it later still needs the usual gate.

## Persist the memory

When the user authorizes a commit or the mutation is already inside an authorized handoff, stage and
commit **only** `docs/outstanding-issues.md` so the memory survives other worktrees:

```
git add docs/outstanding-issues.md
git commit -m "issues: <what changed>"
```

Otherwise leave the mutation uncommitted and report that state. Do not push unless the user asks (or
you are already in an authorized handoff/upload flow). A plain read-only `/issues` commits nothing.
