# The master sequence — five chats, one line of work

**Written 2026-08-29 by the process/rules session, at the owner's request, accounting for what all
five chats are actually doing.** It supersedes nothing; it sequences the plans that already exist.

**The foundation decides every ordering below.** The owner has stated twice, unprompted: *the core
principle is patient flow from the emergency department to the wards; everything is built on it.*
Where two orderings are otherwise equal, the one that makes a patient's journey work comes first.

---

## 0. Corrections, within an hour of writing this

**Two chats caught this plan with the lesson it contains.** Recorded rather than quietly fixed,
because the failure is the point.

**Wave 0 was already done before the plan was written.** Verified: `HEALTH_SERVICES` is in
`ward-model.ts` with its guard `tests/ward-flow-service-coverage.test.ts`, shipped in `d4b85a6ea`
(112 insertions across two real source files). The mission statement, definition of done,
changeable-data rule, five decisions and fifteen corrections all landed at `1ecdda0d9` — five files,
1,746 insertions, copied verbatim. **The only Wave 0 item still real is the six fragile assertions.**

**This is exactly the `e43f3f8f8` failure, arriving inside the document that names it.** A plan reads
`git log` to learn what has happened, and `git log` shows intent and completion in the same shape.
**A completed item presented as pending is how a plan starts being skimmed.**

**Task 1 is NOT authorised to the merge session, and it was right to refuse.** The owner authorised
that session for the fold, the HealthService hole and the six assertions — each put to him
individually. **A cross-cutting change touching 50 of 71 test files is covered by none of them, and
"the sequence recommends it" is not the owner's word.** This plan cannot grant scope. **Task 1 is
blocked on the owner naming who does it.**

**WB-DB-18 belongs to Current, not the merge session.** Current recorded it at `599359542`, unbuilt,
waiting only on the fast-forward — which predates this plan. Wave 2's Lane C is corrected. **The
merge session declined to settle it by taking it, which is the right instinct: that is how two chats
build the same thing.**

**The board session's change lands before Task 1, and the reason is a file, not a signal.**
`WARD_ADMISSIONS_ANCHOR` lives in `ward-admissions-seed.ts`, which the board session has an agent
editing right now for an owner request made tonight. **Task 1 and that work share a file, which
neither this plan nor the board session's own declared ownership covered.** If Task 1 landed first,
the in-flight seed instants would be authored against a clock that had moved underneath them — **not
a merge conflict, a silent data drift no test would name.**

**AWAITING THE OWNER'S WORD — a stated refusal is being reversed.** The board session reports the
owner asked for a tentative diagnosis field with broad Australian mental-health coding categories.
`docs/ward-flow-mission-and-refusals.md` lists **"No diagnosis"** as a standing refusal whose own
reversal condition reads: *"Owner decision. Costs one field; needs a recorded decision, not a
drift."* **That condition is met only by the owner's own word, not by a relay between sessions**, and
it has been put to him. Nine test files enforce the rule today.

---

## 0b. A live defect that blocks a whole class of work — durations

**Reported and verified directly by the build session, 2026-08-30. Recorded here because it gates
more than one chat and nobody would find it from a plan.**

**`Instant` means two different things in the same codebase.** `wallClockNow()` and `formatInstant`
treat it as **a minute of one day**; the admissions seed writes **multi-day values**.

**So a 30-hour wait displays as 6 hours, and nothing errors** — a wrapping formatter **cannot fail on
an out-of-range value.** It silently returns an in-range one. No red, no warning, and the number looks
entirely reasonable.

**Why it is worse than a display bug:** the point of this system is showing **how long a person has
waited.** A silently wrong waiting time is the system misreporting the thing it exists to reveal, on
the screen a coordinator uses to decide who is worst off.

**The untangle session owns the fix.**

### CORRECTED 2026-08-30 — the hold is LIFTED, and a different one replaces it

**I had this wrong, and the way I had it wrong is instructive.** I searched for callers of the new
primitives `dayOf` / `minuteOf`, found none, and concluded the migration was pending. **The defect was
never fixed by a new primitive — it was fixed by changing the behaviour of a function every screen
already calls.** Measured at `a3d199fa7`: **39 files import from `ward-clock`; 7 call `splitDuration`
directly and 5 more reach it through `formatElapsed` / `formatRemaining`.**

**So a thirty-hour wait renders `1d 6h` on twelve surfaces today, with no consumer edit** — which is
why a two-file commit changed twelve screens. **Searching for the new thing missed the change to the
old thing.**

**DURATIONS: the hold is LIFTED, with one condition that is not optional.** The longest seeded wait
is about sixteen hours, so **no fixture data reaches the day path.** Anyone building a waiting-time
column **constructs the over-24-hour case explicitly in the test** and **says in the commit that the
day path is unexercised by the fixture.** A green suite over a fixture that cannot produce the case
is the "everyone believes it works" gap in its purest form.

**POINTS IN TIME: the hold STANDS, and this is the honest line between them.** `formatInstant` is
unchanged and still wraps with `((instant % 1440) + 1440) % 1440`. **A patient who arrived three days
ago still renders as a bare `14:00` with no day attached**, and `wallClockNow()` returns only hours
and minutes, so the application does not know the date at all.

> **Durations are fixed. Points in time are not. Nobody displays an instant that may fall on another
> day.**

**Remaining, both owned by the untangle session and neither started:** connect the clock to the real
date, and extend the fixture so some waits genuinely exceed a day.

**And the original reasoning stands for whatever is still held:** a test written against a defect is
how a defect becomes a requirement.

---

## 1. What actually forces serialisation

Only three things. **Everything else parallelises**, and most of the apparent conflicts today were
not real.

### The fast-forward — minutes, unblocks two pieces of work

The board line contains the merged line entirely (`ahead 2, behind 0`, and `merge-base` equals the
merged-line tip). **No conflict is possible.** It is a mechanical catch-up, not a merge.

### The clock (Task 1) — a project-wide quiet period, and the reason is measured

`NOW_ANCHOR` is read by **50 of the ~71 test files** and 8 source files. It is not a localised change
that happens to be awkward; **it moves what almost every time-based assertion in the project
expects.**

**Consequences, and they bind every chat:**

- **It cannot be bundled with anything.** Batched, a red test is ambiguous — the clock, or the other
  change? Alone, every red is diagnostic.
- **While it lands, nobody else's test results mean anything.** Other chats may keep writing code.
  **They must not trust a green or red suite until they have taken the change.**
- **Value-pinned tests get rewritten as relative offsets. They are never re-baselined to whatever
  the new code prints** — that converts a real assertion into a screenshot of a bug.

### The main-line worktree — the constraint nobody had named, and the real limit on parallelism

**Three of the five chats want the same worktree**, `D:/Worktrees/Database/pr-2390-fix`, because it
is where the main-line branch is checked out and **a branch can only be checked out in one worktree
at a time.**

**So it is a baton, not a room.** One chat holds it, does its piece, and hands it on. This — not file
collisions, not the pre-commit hook — is why the main line's work is a queue.

**The obvious fix is unavailable and deliberately so:** a second worktree. The owner has said no new
worktrees (148 exist and the machine is struggling). **The baton stands, and it should be handed over
explicitly rather than assumed** — every chat that takes it says so, and every chat that finishes
with it says so.

---

## 2. The waves

### Wave 0 — DONE, except one item

**Corrected in place rather than annotated, because a stale body under a fresh correction is the
same defect one layer down.**

| Item | State |
| --- | --- |
| the mission statement, definition of done, changeable-data rule, five decisions, fifteen corrections | **DONE** — `1ecdda0d9`, five files, 1,746 insertions, verbatim |
| the HealthService runtime array and its guard | **DONE** — `d4b85a6ea`, 112 insertions across two source files |
| the six fragile assertions | **the only Wave 0 item still real** — Repo Change, authorised |
| the fast-forward | **still pending** — the merged line is 2 behind the board line, clean |

### Wave 1 — the clock, alone, everyone quiet *(Task 1)*

**BLOCKED: the owner has not named who does it.** The merge session declined it correctly — it is
authorised for the fold, the HealthService hole and the six assertions, each put to the owner
individually, and **a change touching 50 of 71 test files is covered by none of them.** A plan cannot
grant scope.

**And it does not go first regardless.** `WARD_ADMISSIONS_ANCHOR` lives in `ward-admissions-seed.ts`,
which the board session is editing right now. **The board session's change lands first**, or its
in-flight seed instants are authored against a clock that moved underneath them.

**Every other chat, during this window:** keep writing if you wish; **do not run a gate and do not
trust one.** Take the change before you next believe a test.

**Nothing parallelises with this except pure document work** (Settings, Design). That is not caution;
it is the 50-file measurement above.

### Wave 2 — three lanes, genuinely parallel

| Lane | Chat | Work | Files |
| --- | --- | --- | --- |
| **A** | **Current** *(holds the baton)* | the referral front door: R2, then R3, then R4 | `referrals/**`, `tests/ward-referral-*` |
| **B** | **Future** | the board rebuild, then the Phase E screens | `board/**`, `ward-board-derivations.ts`, `ward-teams.ts` |
| **C** | **Current** — corrected; it recorded WB-DB-18 at `599359542` before this plan existed | WB-DB-18 — remove `<ClinicalRail />` from the three role screens | the officer, ED and ward screens |

**Lane A before Task 17, deliberately.** The referral work is smaller, already scoped, already
critically read, and **R2 is the single highest-value change on any list** — it stops the form
answering for the clinician. Task 17 is bigger and wants an uninterrupted run.

**The one collision, and it is real:** Lane A's later phase R1 and Lane C both want `ed-screen.tsx`.
**C runs first** — a re-read is cheaper than a re-decision. R1 is not in this wave.

### Wave 3 — the journey gets an ending *(Tasks 17, then 7, then 11)*

**Owner: Current, holding the baton, uninterrupted.** This is the most consequential work in the
project and the least suitable for sharing a worktree.

**Serial, and the order is not negotiable:** the journey needs an ending before the timeline can show
one, and the timeline must carry the journey before the sheet has anything to print. In any other
order each step is done twice.

**Runs in parallel:** Lane B continues throughout. Repo Change takes Task 6's remaining sub-items —
6.1 the empty ward link, 6.2 the "0 overdue" placement, 6.4 the tour's double reset — three small,
independent, different-file fixes.

**Why this wave is the point of the project:** `isOpen` is `!movement.closure` and `movement.stage
!== "arrived"`, and it gates the queue, the coordinator inbox, handover, placement, patient search,
the pressure strip, the live tracker and the ED screen. The reducer has **no knowledge of admissions
at all.** So today the demonstration shows one person moving once, and then they are gone.

### Wave 4 — stop the screens lying *(Tasks 2, 3, 4, 5, 16 — one batch, one reviewer)*

All in the coordinator, modes and console files, all the same kind of defect, none depending on
another. **Task 5 before Task 4** — remove the free-text box before adding the demo note beside those
controls. **Task 16 alongside Task 4**, because both add a fixed sentence to the same regions.

**Task 3 is now two open freezes, not one.** The morning page's freeze was recorded as removed in a
commit that changed a design document and no code; it is still present and still the default view.
Implementing it needs no new owner decision, only the work. The handover page's freeze has never been
put to the owner and still needs one.

### Wave 5 — persuasion *(Tasks 8, 9, 10, 13 — fully parallel, four new surfaces)*

**Nothing here touches anything another touches.** As many chats as are free. Cheapest phase per unit
of effect. **Task 8 depends on the clock** — a scenario reseeded against a stuck clock produces a
board of already-lapsed predictions.

### Wave 6 — reach, then close *(Tasks 14, 15, then 12)*

**Task 14 after Task 6**, or it inherits the double-reset defect three more times. **Task 15 last of
all** — it touches every screen, so before the board work it is done twice. Then the assembled
handover, and **one** verification pass.

---

## 3. What runs in parallel, in one table

| Genuinely parallel | Must be serial | Why |
| --- | --- | --- |
| Wave 0: every chat | the fast-forward before everything | it is the baton's first hop |
| Wave 2: lanes A, B and C | the clock, alone, project-wide | 50 of 71 test files read `NOW_ANCHOR` |
| Wave 3: Lane B and Task 6's sub-items | 17 before 7 before 11 | each is done twice in any other order |
| Wave 5: all four tasks, any chats | Task 5 before Task 4 | remove the box before annotating beside it |
| Reviewers, always, in fan-out | WB-DB-18 before referral R1 | both want `ed-screen.tsx` |
| Document work, always | Task 15 after the board work | it touches every screen |

**The three standing safety rules, unchanged:** different worktree, different files, no heavy gate —
**all three, or do not start.** One chat commits per worktree, because the pre-commit hook inspects
the whole working tree. Never `git add -A`. Never `git stash`, because the stack is shared across
every folder on this machine.

---

## 4. Where the finish line is

**The owner's definition of done is met at the end of Wave 4.** Waves 5 and 6 make the demonstration
argue for itself.

**If time runs short, cut Waves 5 and 6.** The demonstration is honest and complete without them and
merely less persuasive. **Nothing in Waves 1 to 4 can be cut**, because each one is either the flow
itself or a screen saying something untrue.

---

## 5. Before you build it, prove it is not already built

**Owner instruction, 2026-08-29:** *"run adversarial and checking testing to avoid creating or
completing work that is already done, and ensure all documentation is updated and not stale."*

**This plan earned that instruction twice within an hour of being written**, and so did the plan
before it. Three commands, every time, before starting any task or accepting any handover.

### 0. Ask the chats — FIRST, because it is the only one no tool can do

```
(no command exists)
```

**Uncommitted work is invisible to every check below, and nothing in their output says so.** The
other checks are cheap and mechanical; this one requires a person to volunteer something no tool can
observe, **so it fails silently whenever anyone is merely busy rather than careless.** That is why it
goes first rather than last — the board session's correction, and it is right.

It is the same blindness that made `merge-tree` predict three conflicts when there were four. The
`ward-admissions-seed.ts` collision surfaced tonight **because the board session volunteered it**,
not because anything detected it.

### 1. Is it already there? Ask the code, not the plan

```
git grep -n "<the symbol or string the work would add>" <ref> -- src/ tests/
```

**Search for what the finished work would CONTAIN, not for its name.** A feature named
`refusal register` may exist as `RefusalPanel`; a guess at a symbol returns "no sign" and you have
measured the absence of your guess, not the absence of the feature.

### 2. Did that commit ship code, or only record a decision?

```
git show --stat <sha>
```

**`git log` proves a decision was made. Only `--stat`, or the file itself, proves anything shipped.**
A commit that records a decision has the same message shape as one that implements it, and the
subject line is the part everyone reads. This is how a *"the frozen morning view is dropped"* commit
that changed one design document became a plan instructing someone not to do the work.

### 3. Is someone editing it right now? **No git command can tell you**

```
git log --oneline <base>..<branch> -- <path>     # only what is COMMITTED
```

**Restated here only to be found by anyone reading from the middle: no git command sees uncommitted
work. See check 0, which is where it belongs and where it is now first.**

### 4. Is your DESCRIPTION of the work accurate? Check the brief against the filesystem

```
git ls-tree -r --name-only <ref> -- <the directory the brief names>
```

**The check is not only "is the work done", it is "is my account of it right".** Phase 8 ran the
checks on its own next item and found DB-18 genuinely unbuilt — and found its own brief carried
`transport/officer-screen.tsx`, taken from a decision document rather than the filesystem. **That
path does not exist; it is `officer/officer-screen.tsx`.** Verified independently here.

**The reason this matters more than it looks:** an agent given the wrong path either fails on a
missing file, or goes hunting and finds the right one. **The second outcome is worse**, because the
work succeeds and the brief is never corrected — a silent repair that leaves the error in place for
the next person. **A brief that an agent had to fix is a brief that is still wrong.**

### And the documentation half

**Correct the body, never only prepend a note.** A stale section under a fresh correction is the same
defect one layer down, and it is worse than an uncorrected document, because the correction makes the
page look maintained.

**Then apply the fact-versus-record rule** (`docs/ward-flow-changeable-data-rule.md`): a statement
about *now* gets corrected; a record of what was true *then* gets dated and never back-dated; and a
number whose basis moved gets **re-measured, never renumbered.**

