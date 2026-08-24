# SDD ledger — plan: docs/superpowers/plans/2026-08-24-caring-contact-phase-2b-screens.md

**This is the Phase 2B build record and the SDD ledger, in one tracked file.** Per Phase 2A's
Ruling 67, this programme does not keep a ledger in git-ignored `.superpowers/sdd/` scratch — a
git-ignored session ledger was destroyed once already and took the only copy of its session's record
with it. The build record IS the ledger.

**Where Phase 2A's record ends and this one begins:** `phase-2a-build-record.md` holds Rulings 1–67
and every Phase 2A task. Ruling numbering CONTINUES here from 68 so a ruling number is unique across
the whole programme.

Base commit for this plan: `875c8b604`.

---

## Pre-flight scan of the plan

Run before dispatching Task 1, per the method. The output is a table, not a verdict.

### Task pairs sharing a file or an interface

| Tasks                        | Shared surface                      | What one produces / the other consumes                                | Finding                                                        |
| ---------------------------- | ----------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| 4 → 5, 13, 15, 18            | `shell.tsx` destination lists       | Task 4 adds the first `href`; each screen task adds its own            | **Sequential edits to one file.** No contradiction. Implementers are never dispatched in parallel, so this is a merge risk only if that rule is broken. |
| 1 → 5, 13, 15, 18            | the empty-state component           | Task 1 produces it; four list screens consume it                       | Clean. Task 1 must land before any consumer.                   |
| 2 → 5, 12, 17                | the list-read API pattern           | Task 2 produces the helper + contract test; three routes consume it    | Clean, and this is the whole reason Group 0 exists.            |
| 3 → 11, 14, 16, 18, 20       | the overlay trigger                 | Task 3 produces it; five tasks wire overlays with it                   | Clean. Ruling 69 keeps wiring with the owning screen.          |
| C → 16                       | `message-copy.ts`                   | Task C rewrites the reply wording (items A2/A3); Task 16 renders it     | **Ordering constraint.** C must land first, or Task 16 renders wording that is about to change. Recorded, not a conflict. |
| 7–9 ↔ 13                     | the nine-contacts / closing-message | Corrections #3 and #4 touch the activation review AND every schedule    | **Genuine cross-task requirement.** Whichever lands first sets the shape; the second must not re-derive it. Both must read the same source of truth in `schedule.ts`. |
| 5 ↔ 6                        | `getEpisode` vs `listPlans`         | Task 5 must NOT call `getEpisode`; Task 6 is the one screen that may    | Clean, and stated in the plan. Worth re-stating in both briefs. |

### Per-task self-consistency

| Task(s) | Its own text agrees with itself?                                                             |
| ------- | -------------------------------------------------------------------------------------------- |
| C       | Yes — six named edits in two named modules.                                                  |
| 1–4     | Yes.                                                                                         |
| 5–11    | Yes, with the `getEpisode` restriction stated.                                                |
| 12–14   | Yes.                                                                                         |
| 15–16   | **NO — defect found, see Ruling 73.** The design-corrections table routes correction #2 to "Group 3, Task 11", but Task 11 is Group 1's overlay wiring; Group 3 is Tasks 15–16. |
| 17–18   | Yes, with Ruling 72's scope limit stated.                                                     |
| 19–21   | Yes.                                                                                         |

### Anything the plan mandates that the review rubric treats as a defect

None found. The plan mandates no test that asserts nothing and no verbatim duplication of a logic
block.

---

## Rulings

**Ruling [73] — the design-corrections table's "Group 3, Task 11" is a typo for Task 16; corrected in
the plan.** — Why: Task 11 is Group 1's overlay wiring and cannot carry a Group 3 copy correction. The
correction is the reply-handling wording, which belongs to the message-preview surface built in Task
16. — Cost if wrong: had it stood, Task 11's implementer would have received a requirement it had no
surface for, and either implemented it in the wrong place or reported BLOCKED — a wasted dispatch
either way. This is exactly what the pre-flight scan is for and it is the first thing the scan found.

**Ruling [74] — Group 4 is built at the approved roster-table depth, and the owner is told plainly
rather than asked again.** — Why: this is Ruling 72 carried into execution. The owner was asked
directly whether "workload and coverage" means a staff list or something richer, and answered "go
ahead" to the plan without narrowing it. The method's standing instruction is to rule rather than
stall, and only the roster table has an approved design — inventing a capacity view would be design
work done by an implementer, which is worse than delivering the designed thing. — Cost if wrong: if
he meant rosters, leave and caseload, Phase 2B delivers a thinner group 4 than he expected. It costs a
design pass and one more group later, not rework: nothing built at roster depth becomes wrong.
**Flagged to him in the closing report, not buried here.**

**Ruling [75] — Guidance and Reports (Task 19) are deferred to the END of Phase 2B, and may be cut to
Phase 3 without blocking anything.** — Why: both sit outside the owner's stated four groups, both
already have approved designs, and neither is a dependency of any other task. Deferring them costs
nothing and protects the four groups he actually asked for. — Cost if wrong: if he wanted Reports
early — the equity reach section is the one part with external interest — it arrives later than he
hoped. Reversible at any point by moving one task.

**Ruling [76] — the approved copy changes are executed as ONE batched task (Task C) ahead of Group
0.** — Why: the method says to batch small same-shape work into one dispatch rather than one subagent
per item. All six approved edits are small, independent, and land in two adjacent modules
(`message-copy.ts`, `message-policy.ts`). They also unblock nothing else, so they are cheap to do
first and get the owner's approved wording into the tree before any screen renders it. — Cost if
wrong: one review surface covers six changes, so a weak review could let one through. Mitigated by
requiring a separate covering test per item, named by item number.

**Ruling [77] — A9 (add Lifeline) is NOT dispatched, in spite of being approved.** — Why: the approved
recommendation is conditional on a real crisis number existing, because the message is ~9 characters
from its two-segment maximum and nothing can be added until something is removed. No real number
exists. Dispatching it would force an implementer to choose which patient-facing sentence to delete —
precisely the decision the owner was asked to make and which his "go ahead" does not answer. — Cost if
wrong: the message carries no Lifeline number for now, which is the status quo and is the safe
direction. **Re-ask when a real crisis number exists.**

**Ruling [78] — no push, no pull request, at any point in this plan without the owner saying so.**
— Why: he was asked directly and has not answered; the method's own stop conditions name a push to a
shared branch as something to ask about. Commits accumulate locally, which is what protected this work
before. — Cost if wrong: the work sits on one machine, which is the machine that has destroyed four
working directories. Mitigated because commits on a worktree branch live in the shared object store
and survive the worktree itself.

---

## Task progress
