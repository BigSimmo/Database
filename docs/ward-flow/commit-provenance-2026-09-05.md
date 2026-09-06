# Two commits on this line describe a fraction of what they contain

**Written by Ward Lead, 2026-09-05, correcting its own record.** Nothing here is broken and nothing
is missing. The **contents at HEAD are correct** and were independently verified. What is wrong is
the account `git log` gives of who wrote what, and that is worth fixing in writing rather than
leaving for whoever next runs `git log --stat` and finds a commit message that does not match its
own diff.

## What happened

A `WardTable` implementer ran as a subagent **inside this worktree**, sharing the working tree and
the git index with me. It staged its finished files with `git add`. In the same window I staged one
file of my own and committed with `git commit -F <message-file>` — **no pathspec**.

`git commit` with no pathspec commits **the entire index**. So my commit took its staged work too.

| commit      | its message describes                                | it actually contains                                                                                                                                                                                                                                                                                            |
| ----------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `f4b77ebff` | one new test, `tests/ward-table-min-width.test.ts`   | **14 files** — the `WardTable` primitive (`ward-table.tsx`, `ward-table.module.css`), five module migrations (`discharges`, `escalation`, `handover`, `out-of-area`, `search` — both the `.tsx` and the `.module.css` of each), the implementer's own `tests/ward-table-single-source.test.ts`, and my one test |
| `e7c2ea906` | one script fix, `scripts/ward-flow/mutation-run.mjs` | **4 files** — that script, plus `handover-page.tsx`, `ward-table.module.css` and `ward-tokens.module.css`                                                                                                                                                                                                       |

**So the `WardTable` primitive and its five migrations are the implementer's work, committed under my
message and my authorship.** `--ward-table-min-width` landing in `ward-tokens.module.css` and the
handover revert, both in `e7c2ea906`, are likewise its work carrying out two rulings of mine.

Mine alone, and correctly described: `f4b77ebff`'s `tests/ward-table-min-width.test.ts`,
`e7c2ea906`'s `scripts/ward-flow/mutation-run.mjs`, and `fdb99c834` and `fd734125f` entire.

## Why I did it, which is the part worth reading

⚠️ **This repository's own notes warn about exactly this, and I had read them at the start of the
session.** The recorded rule is _never `git add -A` while an implementer shares the worktree — the
wildcard commits its in-flight edits under your message._

**I never used `git add -A`.** I staged single files by name, every time, and believed that was the
protection. **It is not.** The wildcard is one route to the outcome; committing a shared index
without a pathspec is another, and the rule as written names only the first. Avoiding the named
mechanism is not the same as avoiding the failure — a lesson recorded against one mechanism does not
transfer to a second.

**The correct habit is `git commit -- <paths>`**, which limits the commit to what you name regardless
of what else is staged. Everything committed after this note uses it.

## Why this is a note and not a history rewrite

At the time of writing no builder branch contains either commit, so a rewrite would have been
technically safe. It was not done, deliberately:

- Three sessions are live and merge this line repeatedly. A rewritten shared base is the failure
  this project keeps paying for, and it would have been incurred for a **cosmetic** gain — the code
  is right either way.
- A rewrite also destroys the evidence of the mistake, which is the only part with any remaining
  value.

## The implementer's own account

It reported the collision itself, unprompted, in its final summary — _"commit provenance isn't
clean"_ — and verified the content correct at HEAD regardless. Its full report, including the
per-module `min-width` values and two deliberate behaviour-change notes (out-of-area's widened
`last-child` rule, search's token-role change), is at
`.superpowers/sdd/2026-09-05-ward-screens-second-edition/task-wardtable-report.md`.

It also declined three modules the brief named — `ed`, `ward-management-modes`,
`ward-management-network` — on the grounds that their table CSS is not a redeclaration of the
canonical block (different token layers, border-collapse modes, sticky headers, full grid borders),
citing the brief's own sentence that those class names are _"migrations, not requirements"_. That
refusal is accepted: it read the brief's ruling more carefully than the brief's file list.

---

## `daa8d551b` — a commit message that describes none of its contents

**The message says "seven verified defects in the patient typeahead, guarded and mutation-proved".
The commit contains sixteen lines: one tap-target fix on `.input`, and nothing else.**

    daa8d551b   patient-typeahead.module.css   16 insertions, 0 deletions
                the entire diff is `align-self: stretch; min-height: var(--ward-tap);`
                plus the comment explaining it

The seven typeahead defects it names are real and are landed — in `f9ff8cb16`, one commit earlier,
along with their 243-line guard file.

### How it happened, which is duller and more useful than it looked

The implementing agent finished, staged its files, and was refused by the pre-commit hook — which
correctly forbids a partial commit while other work is unstaged in the same tree. **I then committed
everything staged, including its work, under my own combined message.** When the agent retried, its
own files were already committed, so `git commit` found nothing of its own left — and swept up the
one unstaged change that had appeared in the meantime, my `.input` fix, under its summary.

**Both halves of the content are correct and nothing was lost.** What is wrong is only that one
commit's message and its diff describe different work.

### ⚠️ The agent diagnosed this as a rival session, and that was false

Its report said _"another AI session was independently doing the exact same repair job in this same
shared folder… Their version landed first and is functionally identical to mine (I checked — same
code, same wording, right down to the comments)."_

**There was no other session. It was reading its own work, committed by me.** The evidence it cited —
identical code, identical wording, identical comments — is exactly what its own output looks like,
and it is also exactly what genuinely duplicated work looks like. **The two are indistinguishable
from inside, which is why the inference felt safe.**

The conclusion it drew from the false premise was nonetheless right: nothing lost, nothing to undo,
do not rewrite history without asking. **A correct conclusion from a wrong premise is still a wrong
premise**, and it would have propagated as a report of a coordination failure that never happened.

### What is fixed here

Nothing in the code. This file is the correction, because the alternative is rewriting a published
commit message, and history is not edited to tidy a record — it is annotated. Anyone reading
`daa8d551b` should read this entry beside it.
