---
name: issues
description: Read and maintain the repository's single universal, recommended-only task ledger. Use when the user types "/issues" or asks to add, close, update, capture or prioritise repository work. The ledger lives in docs/outstanding-issues.md; a plain "/issues" is read-only.
---

# issues — the universal recommended-work ledger

`docs/outstanding-issues.md` is the only active repository task ledger. Its **Open items** table contains
only evidence-supported work still worth doing, with recommended order, priority, classification,
executor capability, timing, estimate, dependencies/approvals, success criteria, verification and a
stopping condition. Other backlog/runbook documents are supporting evidence, not parallel queues.

**The ledger is the source of truth, not chat memory.** Never answer `/issues` from conversation
recall — always read the file first, so the answer is correct even in a fresh session.

## Trigger

- User types `/issues` (optionally with a subcommand or filter below).
- User asks to add / close / update / list / capture an outstanding task, recommendation, or issue.

## Default: `/issues` (read-only)

1. Read `docs/outstanding-issues.md`.
2. State the **open items** back by numeric **Order**, each as
   `Order · #ID · Pri · classification · summary — next action; when; estimate`.
3. End with a one-line count by classification and priority.
4. Do **not** mutate the file or commit on a plain read.

If a filter is given, narrow step 2: `/issues P1` (by priority), `/issues issues` / `/issues recs`
/ `/issues tasks` (by type), `/issues <keyword>` (summary/detail substring match).

## Mutating subcommands

Parse the intent from natural language too — the exact syntax is a convenience, not a requirement.

- **`/issues add <text>`** — verify that the candidate is current, evidence-supported, deduplicated
  and worth its cost/risk before adding it. Append a fully populated **Open items** row, allocate the
  ID from `<!-- issues:next-id=NNN -->`, bump the marker, and place it at the smallest sensible
  **Order** while renumbering later rows. Do not add speculative, completed, stale, duplicate,
  superseded or no-longer-recommended work.
- **`/issues done <id> [outcome]`** — move that row from **Open items** to **Resolved / archive**
  with today's date and a one-line outcome. Archive, never delete.
- **`/issues update <id> <text>`** — edit an open row's summary or next action in place.
- **`/issues capture`** — scan the current session and repository evidence for genuinely retained
  work. Reclassify or omit completed, stale, duplicate, superseded, speculative and uneconomic claims;
  add only confirmed recommended items after deduplication.

## Capture discipline (proactive memory)

When a task ends with a supported follow-up, offer to reconcile it here before context is lost. Do not
capture every suggestion: verify current source evidence, impact, existing safeguards, cost, risk,
dependencies and provider requirements first. Prefer the smallest actionable outcome.

## Writing rules

- Keep the table format and column order exactly as in `docs/outstanding-issues.md`. One row per item.
- IDs are monotonic and never reused — always allocate from the `issues:next-id` marker and bump it.
- Keep **Order** contiguous and unique. Skip blocked rows during execution; do not reorder them merely
  because a dependency is temporarily unavailable.
- Use exactly one allowed **Final classification** from the ledger conventions.
- Fill every retained row's next action, executor, when, estimate, dependencies/approvals, success
  criteria, local/hosted verification and stopping condition.
- Escape `|` inside cell text (write `\|`) so the markdown table stays intact.
- Respect the repo's RAG/clinical/privacy flagging rules if an item _itself_ touches a protected
  surface — recording it here is fine, but acting on it later still needs the usual gate.

## Persist the ledger

Edit the ledger when requested. A ledger mutation does not authorize a commit, push or pull request;
follow the repository Git instructions and the user's explicit publishing scope. A plain `/issues`
mutates nothing.
