# A comment that instructs a reader to undo a decision the owner has made

Two instances found on 2026-09-01, independently, by two chats, hours apart. Both are worse than a
stale comment. **A stale comment misinforms. These instruct.**

## The shape

A comment is written while a question is genuinely open. It says, in good faith, _"this is
unresolved — a reader should settle it"_, and often it helpfully names where the edit should go.

**Then the owner settles the question.** The code changes. The comment does not.

What is left is not merely out of date. It is a standing instruction, phrased with the authority of
an open question, **to reverse a decision that has already been made** — and it is aimed at exactly
the reader most likely to act on it, the one who arrives next and wants to be helpful.

## The two instances

**1. `AWAY_GROUP_PLACEMENT_UNRESOLVED`, `ward-daily-sheet.tsx` (found by Ward Builder One).**
Sixteen lines instructing a reader to settle where the "away" group belongs, framed as an
unresolved question about a _fifth column_. **The owner resolved it on 2026-08-30 in the opposite
shape: remove the away column, make it a line under the grid.** The heading test was updated to
match. The constant was not. It also claimed a named test asserted the placement so that "a ruling
lands in one edit" — nothing reads the constant, and the test it names asserts the group headings
with away deliberately excluded. So a reader following it would edit a value nobody consults,
believe they had implemented a ruling, and be working to reinstate a column the owner removed.

**2. The rulings document on whether an emergency department may decline a referral (found by Ward
Lead).** Cited as current, it was an instruction to un-wire a control the owner had asked for.

## Why it survives every check we have

Nothing connects a ruling to the comments that **presuppose its absence**. A comment saying
"X is unresolved" is a claim about the state of the world outside the code, and:

- No test asserts it. There is nothing to go red.
- No type mentions it.
- A reachability or dead-code scan sees a constant, not an instruction.
- **The clean-up is invisible work.** Deleting it changes no behaviour, so it is never anybody's
  task, and it is the first thing dropped from a scope.

It is the same family as [`fixture-contingent-branches.md`](fixture-contingent-branches.md) — the
absence of a failure signal mistaken for safety — and the same family as a "not built yet" note
that stays after the thing is built. **A sentence describing an absence has a short shelf life,
because the absence is usually somebody's next task.**

## What to do

**When a ruling lands, grep for the question it answers, not just the code it changes.** The edit
that implements a ruling and the comment that presupposes the ruling was never made live in
different files, and only the first is in the diff.

Search terms that find this class: `unresolved`, `open question`, `to be decided`, `pending`,
`settle this`, `somebody should`, `not yet decided`, `TBD`, and any constant whose name ends in
`_UNRESOLVED`, `_UNDECIDED` or `_TBD`.

**And prefer a failing test to a comment.** A question genuinely open is better held by an
`it.fails()` tripwire — which goes RED when somebody resolves it — than by prose, which goes quiet
forever. A comment cannot notice that it has been answered.

## What NOT to do

**Do not delete the constant and stop.** In the `AWAY_GROUP_PLACEMENT_UNRESOLVED` case the ruling
turned out to be _already satisfied by the JSX_, with **nothing keeping it satisfied** — the away
line renders after the groups div closes, `dailySheetGroups()`'s field order is inert because its
fields are read by name and never iterated, and no test anywhere asserts the line's position.
Deleting the misleading instruction without adding the assertion leaves the ruling exactly as
unprotected as it was, and removes the only thing that made anybody look.
