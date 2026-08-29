# Ward board plan — corrections, 2026-08-29

**What this is.** A set of edits to apply to
`docs/superpowers/plans/2026-08-28-ward-flow-ward-board.md` and its spec before any further ward
board work. Written from three independent reviews plus verification against `git` and the built
source.

**Why it is a separate file rather than edits to the plan.** The plan lives on
`claude/ward-flow-ward-board`, which another chat owns and is actively committing to. Editing
another chat's live files is the collision this programme has already paid for twice. Whoever owns
that branch applies these.

**Confidence.** Everything under "Verified" was checked against source, `git merge-tree`,
`git rev-parse` or the built modules. Everything under "Read from prose" was checked against the
documents only. No test, lint, typecheck, build or Playwright run was performed — the heavy gates
serialise across every worktree on this machine.

---

## The foundation, which governs every correction below

**Owner, 2026-08-29:** *the core principle is patient flow from the emergency department to the wards.
That is the foundation. Everything is built on it.*

**The test for any task in the ward board plan, including any added later:** does it help a person get
from an emergency department to a ward, or help someone see why that is not happening? If the honest
answer is no, it is decoration, and decoration goes last or not at all.

The ward board is squarely in scope by that test — it is where beds come back, and a forward flow
whose beds never return can move one patient once. But the test is worth applying to each of its
eighteen tasks individually rather than to the phase as a whole, because a phase can pass it while
several of its tasks do not.

---

## A. Do these before anyone writes another line

### A1 — Every command block names the wrong worktree (VERIFIED)

The plan's eighteen task blocks all begin `cd /d/Worktrees/Database/pr-2390-fix &&`, and line 24
says "Every commit stays local on `claude/ward-flow-phases-6-7-design`". That is **Phase 8's
worktree and Phase 8's branch.** The 2026-08-29 addendum moved this work to
`D:/Repos/Database/.claude/worktrees/nostalgic-vaughan-7ee231` on `claude/ward-flow-ward-board` and
never edited the task bodies.

An implementer following a task verbatim commits ward board work onto Phase 8's branch, mid-phase.
The handover already records an hour lost to this same directory behaviour.

**Edit:** replace the prefix in every block with
`cd /d/Repos/Database/.claude/worktrees/nostalgic-vaughan-7ee231 &&`, and correct line 24 to name
`claude/ward-flow-ward-board`.

### A2 — The mandated test command cannot succeed (VERIFIED)

The Speed model tells every implementer to run
`npm run test:focused -- --files tests/<file>`. `scripts/test-focused.mjs` fails closed on any path
under `tests/` and instructs the caller to run the **full 961-file suite** instead — on the
exclusive lock that stalls every other worktree on the machine.

**Edit:** replace with `node scripts/run-vitest.mjs run tests/<file>`, which takes the *shared*
lease. Add: a refusal citing capacity means blocked, retry — never a failure, and never something to
"fix". Quote the `N passed` line, never the exit code.

### A3 — The fold conflicts on three files, and the wrong resolution passes (VERIFIED, both chats)

`git merge-tree --write-tree claude/ward-flow-phases-6-7-design claude/ward-flow-ward-board` reports
add/add conflicts in:

- `src/components/ward-management/ward-admissions.ts`
- `src/components/ward-management/ward-admissions-seed.ts`
- `tests/ward-admission-model.test.ts`

Phase 8 cherry-picked the first two; the board's copies then gained `dischargeConfirmedAt` /
`dischargeConfirmedBy` (2 occurrences on the board branch, 0 on Phase 8's). Those two fields are the
**only** route to the `confirmed` discharge stage.

The third file is the structural test asserting the record's field set — **the guard for that
deletion is itself one of the files being resolved.** Resolve all three in Phase 8's favour and the
fields and the assertion that they must exist are removed together: a green suite that agrees with
itself and is wrong.

**Edit — add to the plan as a binding pre-fold step:** take the **board's** copy of all three paths
wholesale, then repair whatever breaks in Phase 8's test literals. Never resolve file by file. Never
keep Phase 8's model test "because it is that branch's test" — it is the guard.

**Post-fold check — FOUR greps, not one.** My first version was a single grep on
`ward-admissions.ts`; two other sessions caught that a *mixed* resolution (the board's module with
Phase 8's seed) passes it while silently losing eight seed references. Thresholds verified on the
board branch:

```
grep -c dischargeConfirmed   src/components/ward-management/ward-admissions.ts       # >= 4
grep -c dischargeConfirmed   src/components/ward-management/ward-admissions-seed.ts  # >= 8
grep -c confirmedHoursAgo    src/components/ward-management/ward-admissions-seed.ts  # >= 8
grep -c dischargeConfirmedAt tests/ward-admission-model.test.ts                      # >= 4
```

`confirmedHoursAgo` is a SEED figure and correctly reads 0 in `ward-admissions.ts` — pointed at that
file it fails on a *correct* resolution. Use greps, not a test run: the fully-wrong resolution is the
green one.

**And re-run `merge-tree` at the moment of folding, never from this note.** Both branches have moved
repeatedly and this list has been re-agreed twice at different tips. "Take the board's copy wholesale"
silently deletes work if Phase 8 has since touched those three files.

### A4 — Nothing can reach `confirmed` at runtime (VERIFIED)

`ward-admissions.ts` states the two WB-DB-2 fields are the only route to `confirmed`. No event in the
plan's eight-event list sets them, and Task 10's three actions are "going today · date changed ·
stuck". Only the seed carries confirmations — so the board **demonstrates correctly and is inert in
use**, which is an absent signal reading exactly like a passing one.

**Edit:** add a ninth event to Task 2 — confirm-discharge, carrying role and instant — and bind it
to Task 10's "going today" control.

---

## B. Decisions with no task that delivers them

The plan maps WB-D1–WB-D20 and stops. It never mentions WB-DB-1 to WB-DB-10, and these have no owner:

| Decision | What is owed | Where it lands |
| --- | --- | --- |
| **WB-DB-1** waiting clock | `wardStatistics` must widen to take referrals; today it returns `null` for the waitlist-wait figure permanently | `ward-statistics.ts`, Task 7 |
| **WB-DB-3** ward-stated sex counts | A new daily-return record (unit, two overlapping counts, confirmed-at, confirmed-by role), validated against the free-bed total; `acceptingBedCounts` reworked to read it and to **say so** when falling back | new task before the screens |
| **WB-DB-5** what moved since I last looked | Cross-ward derived view, scoped to the session or a chosen point — never a stored per-user timestamp | new task |
| **WB-DB-6** transport officer screen | Pickup and drop-off windows; drop-off blocked on WB-D15 | new task, post-fold |
| **WB-DB-7** rolling 24-hour clock | One comparison in the shared `ward-bed-availability.ts`; **raises the printed morning page's figures** | post-fold, deliberate |
| **WB-DB-8** leave-bed multi-role override | Recorded as an override, by role and time | new task |
| **WB-DB-10** print stamp | Must land with WB-DB-7's change notice | with WB-DB-7 |

**Edit:** extend the self-review table to WB-DB-1..WB-DB-10 and add a post-fold wave carrying these.

**WB-DB-7 needs its change notice built.** The plan assumed a timestamp on the sheet was sufficient. It
is not: a timestamp says *when*, never *by what rule*, so a definitional change reads as ordinary
variation between two correctly-stamped sheets. One dated sentence on the page, kept for a defined
period after the fold, is the only artefact that says why the number moved.

---

## C. Ordering, per WB-DB-4 — the plan's waves never moved

WB-DB-4 put the daily sheet **first among the screens**, the print layout **alongside each screen**,
and something ugly on screen in the first hour. The wave table still has the daily sheet at position
12 and print at 16.

**Edit:** make the daily sheet the first screen task; fold the print work into each screen task
rather than a later one; and add the step WB-DB-4 actually asks for — **time the daily sheet with a
stopwatch against the seeded twenty-bed ward, early.** Success criterion 1 is currently asserted
nowhere.

---

## D. Review and dispatch shape

The plan runs two reviewers per task and has **no whole-branch review at all**. The project's own
record argues against that split: the whole-branch review in an earlier phase found 1 critical and
10 important defects that the per-task reviews *structurally could not see*, because each looked at
one task's diff.

**Edit:** one independent reviewer per **wave**, holding the brief and the spec sections that wave
names, plus **one whole-branch review before the final gate**. Dispatch by wave rather than by task
— roughly 54 agent contexts down to 13.

**State the change honestly in the report:** this becomes "every wave was independently reviewed,
and the whole branch once", never "every task was independently reviewed".

**Also:**

- Batch mutations — apply several in **disjoint** functions, run the wave suite once, and require
  exactly the named tests red and nothing else. Any mutation that fails to bite gets its own run,
  because a mutation that does not bite is a question, not an answer.
- Run one Vitest invocation per wave over every `tests/ward-*` file discovered **from disk**, not a
  hand-picked list. A hand-picked subset shipped a red test on this project once already.
- Keep mutation testing on every rule-bearing test. Seventeen tests passed here while the behaviour
  they named was broken; that is a measured base rate, not a hypothetical.

---

## E. Smaller corrections (VERIFIED against source)

1. **Tasks 1 and 3 edit Phase-8-owned files** (`ward-model.ts`, `ward-flow-reducer.ts`) yet the
   addendum lists both as parallel-safe. Task 1's implementer ignored it; Task 3's silently dropped
   the reducer step, so the 267-occupancy seed is currently referenced by no source file and is a
   dead-code-sweep candidate. **Move the seed-loading step explicitly into Task 2.**
2. **Task 1 adds `SEXES` and `URGENCY_LEVELS` that already exist.** Strike them.
3. **Tasks 1–2 contain literal values that no longer exist** — `"transport_unavailable"`, and
   `LEAVING_DESTINATIONS` ids that shipped as rendered labels. Mark those code blocks superseded by
   the source; an implementer will otherwise fail a membership check that reads like a reducer bug.
4. **Task 3 promises a `wardWaitlists` export that was never produced**, leaving Task 9's
   cross-waitlist test with no fixture data.
5. **Task 3's test imports a constant from a module that does not export it**, which forced the seed
   to hand-copy an anchor value — a second copy with nothing tying it to the first. Fix at the fold.
6. **Register the Playwright spec before writing it.** `playwright.config.ts` carries two
   hand-maintained regexes; neither matches a ward-board spec name, so Task 17's journey would
   silently never run.
7. **WB-DB-2's closing paragraph is stale** against the code WB-DB-2 caused — the shipped default is blank,
   not "Nothing outstanding". Strike it, and amend WB-D4's table.
8. **WB-DB-3's cross-reference credits the wrong decision**, and **the stay-band labels are not
   verbatim** (`1 to 4 weeks` shipped where the owner wrote `1–4 weeks`). Restore the dash or record
   the substitution beside the array — "verbatim" is the only thing protecting those four numbers.
9. **Phase 8 ships a guard forbidding an `admissions` key in reducer state**, which structurally
   blocks Tasks 2 and 3. Widen it at the fold, replacing the no-admissions-key assertion with the
   property actually being protected, and record the reasoning.
10. **Two bed dimensions are literal equalities** (`unit.cohort === movement.cohort`, and the
    referral's age band), against the standing rule that every bed dimension is "does this bed accept
    this person". Add an accepts-shaped helper even if its body is `===` today.
11. **A hardcoded `22:00` sits in on-screen copy** that WB-DB-7 makes false, in a file that does not
    import the constant. Derive the substring from the constant, and share one label helper across
    the three screens that render it.
12. **The `availableNow` formula is written out three times** in three modules, with a comment where
    a shared function should be, and no test asserting the three agree.

---

## F. What was NOT checked

No test, lint, typecheck, build or Playwright run — so the 116 passing tests are the handover's
claim, not something observed here. The test files themselves were not read, so whether the
invariance restatements the addendum demands were actually written is unknown, and any of them could
still be a search dressed as an invariant. Phase 8's spec and ledger were not read.
