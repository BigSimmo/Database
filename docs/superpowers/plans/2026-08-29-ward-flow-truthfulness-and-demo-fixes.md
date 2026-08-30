# Ward Flow — truthfulness, live data, and the day's story

## Status, audited against the code 2026-08-29

**Audited on `claude/ward-flow-print-fixes` by three independent read-only passes, one per batch.
Verdicts are from the code, never from a plan, comment, doc or commit message.** Re-audit rather than
trust this block if it is more than a few days old — it is a **record of what was true then**, not a
fact about now (see the fact-versus-record rule in `docs/ward-flow-changeable-data-rule.md`).

| Task | Verdict |
| --- | --- |
| 1 clock stuck at 10:42 | NOT STARTED — `NOW_ANCHOR = 10 * 60 + 42` unchanged; the clock still *starts* there |
| 2 ED panels read live state | NOT STARTED — `edPressure(now, movements = wardMovements)` default intact |
| 3 the freezes | **BOTH OPEN** — and this plan's own correction was wrong; see the task |
| 4 every control works, and says demo | NOT STARTED — no `DemoActionNote`; the confirm buttons still only `setConfirmed(true)` |
| 5 override reason stops being free text | NOT STARTED — the `<textarea>` is still there, and governance still claims reasons are recorded |
| 6 remaining demo defects | **PARTIAL** — 6.3 DONE and done correctly; 6.1, 6.2, 6.4 not started |
| 7 audit timeline carries the journey | NOT STARTED — `movementTimeline` still emits only the old event set |
| 8 named scenarios | NOT STARTED — still `"standard" \| "scarce"` |
| 9 refusal register | NOT STARTED — no such surface |
| 10 staleness headline | NOT STARTED — six headline cards, none of them staleness |
| 11 print the day | NOT STARTED — no route; the branch's print work is repair of existing sheets |
| 12 one assembled handover | NOT STARTED — the material is still scattered across three documents |
| 13 why-can-this-person-not-get-a-bed sheet | NOT STARTED — `window.print()` exists on two pages, neither a referral |
| 14 guided tour per role | NOT STARTED — "tour" does not occur in `ward-screen.tsx` or `ed-screen.tsx` |
| 15 roles become real | NOT STARTED — the role changes copy and sort order; **no control is gated on it** |
| 16 every network screen says synthetic | **PARTIAL** — the full notice on 3 surfaces; the rest carry only a "Synthetic prototype" badge |
| 17 the pipeline reaches its end | NOT STARTED — **and confirmed: a patient who reaches a ward still vanishes from every live surface** |

**6.3 is the one piece of finished work and it was done in the harder, correct way** —
`tests/ward-scenarios.test.ts` was **re-measured**, not renumbered: *"RE-MEASURED on 2026-08-29 …
across all 23 units … 342 eligible movement/unit pairs … the 23rd unit accounts for none of the
difference."* That is the rule from `docs/ward-flow-changeable-data-rule.md` honoured exactly, by
someone who could have typed 23 and moved on.

**Task 17 is the finding that matters.** `isOpen` is `!movement.closure && movement.stage !==
"arrived"`, and it gates the queue, the coordinator inbox, handover, placement, patient search, the
ED pressure strip, the live tracker and the ED screen. The reducer has **no knowledge of admissions
at all** — `git grep admission ward-flow-reducer.ts` returns nothing. So the demonstration can show
one person moving once, and then that person is gone. **Nothing else on this list is worth doing
first.**

## Two thirds of the buttons can change their words with every gate green

**Counted 2026-08-30 by the board session, after this was raised as an entry with no number.
Spot-checked here on the four most consequential labels — all four confirmed unpinned.**

```
ward component files scanned : 62      plain-literal button labels : 30
ward test files scanned      : 85        pinned by text somewhere  : 10
                                         NO test pins the words    : 20
```

**Including the two the entire front door turns on:**

```
referrals/referral-intake.tsx:639   "Send referral"        <- no test pins it
referrals/referral-match.tsx:329    "Decline referral"     <- no test pins it
ward/ward-screen.tsx:586            "Confirm capacity"     <- no test pins it
ward/ward-screen.tsx:1002           "Record leave bed"     <- no test pins it
```

Plus fifteen more across the ward screen, the shortlist panel, the ED screen, the tour and the demo
controls.

### 20 is a FLOOR, and both reasons push the same way

1. **Only plain literals were counted.** Any label built from a constant or interpolated was skipped
   rather than guessed at, **so the real population is larger.**
2. **A label counted as "pinned" if its exact words appear ANYWHERE in any ward test.** Deliberately
   generous — **so the ten called covered may include weak pins, while anything in the twenty is
   unpinned by a wide margin.**

### The question the survey asked, and why the obvious one fails

**It asked, once per button: "if THIS button's words changed, would anything fail?"**

**Not "is this vocabulary covered?"** — which is the question that fails, because
`"Discharged today"` **is** pinned among the discharge board's group headings. **A vocabulary check
finds a real passing assertion and stops.** The per-control question is the one that discriminates.

### Cleared rather than found

**`ward-screen.tsx:1271` "Confirm release" is NOT a rename survivor.** It submits
`RELEASE_HOLD_REASONS` — releasing a **hold**, not a discharge. **Correct as it stands**, recorded so
nobody "finishes" the rename by changing it.

### OWNER DECISION OWED: should label text be a gate?

**Nobody has fixed any of the twenty, and that is right** — twenty label pins is its own change with
its own judgement about which words are load-bearing, and most of those files belong to other
sessions.

**The recommendation is to make it a gate, SCOPED to controls that cause a state change.**

**Why scoped rather than blanket:** pinning every label makes every copy change break a test, which
is why projects do not do it and why the pins would eventually be deleted in frustration. **But a
button that causes a state change is different: a wrong or empty label there means a clinician does
the wrong thing.** For a demonstration whose whole claim is that the screens tell the truth, **the
words on an action control are the part a clinician acts on**, and they are currently the part
nothing verifies.

**The honest cost: copy changes on those controls would then require a deliberate test update.** That
is the intent, not a side effect.

---

## The foundation — read this before deciding what any task is for

**Owner, 2026-08-29, and it governs every task below:**

> **The core principle is patient flow from the emergency department to the wards. That is the
> foundation.**

Everything in this plan serves that or it does not belong. Stated plainly because this plan drifted
once already: discharge work was being elevated on the argument that beds come from discharge, and
that argument is true but it is not the foundation. It is a *consequence* of the foundation.

**How discharge serves the forward flow, correctly framed.** A demonstration where a patient reaches
a ward and the bed never comes back can only ever show one patient moving once. Discharge is what
makes the forward flow **repeatable** — someone leaves, a bed appears, the next person moves into it.
That is why it is built early, and it is the whole of why. It is not a second story running alongside
the first; it is the mechanism that lets the first story happen twice.

**The test for any task, including any added later:** does it help a person get from an emergency
department to a ward, or help someone see why that is not happening? If the honest answer is no, it
is decoration, and decoration goes last or not at all.

---

**Goal:** every control does something real against the demo data and says that it is demo; nothing on
any screen is frozen while the rest is live; and the longest journey ends with an artefact a clinician
recognises as their working day.

**Owner decisions this plan implements (2026-08-29):**

- **Every button works.** Nothing is removed for being unwired. Wire it against the demo data, and
  **state clearly on screen that it is demo.** This reverses an earlier recommendation to delete the
  two dead confirm controls.
- **Nothing frozen.** Every figure reads live from the data the site holds.
- **Replay, quickly.** Not a backwards scrubber. See Task 14.

**Project purpose this serves:** something that starts conversations, and a blueprint a real team
could build from. Not a production system.

---

## Definition of done — approved by the owner 2026-08-29

The three-month goal is **a completed, functional demonstration on demo data, with every screen and
every control wired, showing proof of concept.** That is the owner's wording. Below is the same thing
made countable, so "complete" is a state someone can check rather than a feeling.

**The demonstration is finished when all of these are true:**

1. **Every screen loads with demo data and shows real figures** — no placeholders, no empty states
   that are empty because nothing was seeded.
2. **Every control does something.** No button that highlights, announces itself, and changes
   nothing. Where an action is genuinely unavailable it says why, in words, and stays reachable.
3. **Every screen carrying a state-changing control says the data is demo**, in the fixed wording,
   readable without hovering.
4. **The four-role journey runs end to end without typing a URL:** coordinator selects a patient → ED
   records the examination → coordinator refers → ward accepts and holds a bed → ED marks handover
   ready → transport officer moves through all four stages → on arrival the receiving ward's bed
   count drops.
5. **The referral journey runs end to end:** raise a referral → matched against every unit with a
   stated reason for each → accepted at one.
6. **The day ends in an artefact** — one printable sheet of what happened, in order, with role and
   time.
7. **No screen contradicts another about the same figure.**
8. **Nothing is frozen while the rest is live.**

**Anything not on this list is a later version, not a missing piece.** The list is the finish line and
it does not grow without an owner decision — an undefined "complete" is the most likely reason a
three-month goal is missed, because the list can always be extended by one more good idea.

---

## The demo data stays swappable — a standing rule, not a task

**Owner decision, 2026-08-29:** the invented network is acceptable for now and **will be replaced with
real data later** — locations, bed numbers, ward names, travel times, and the diagram with them.

**Measured today, and it is currently true:** every invented network fact lives in five files —
`ward-sites.ts`, `ward-movements.ts`, `ward-travel-bands.ts`, `ward-teams.ts`,
`ward-admissions-seed.ts` (plus `ward-model.ts` for the vocabulary). Nothing outside Ward Flow reads
them, and the network diagram derives its own grouping from `wardServiceOrder` rather than having a
layout drawn into it — so **the diagram follows the data automatically** when the wards change.

**It will not stay true by itself.** Every remaining task in this plan is screen work, and a screen is
exactly where a hospital name gets typed directly into markup. By the time the real network arrives it
would be scattered across dozens of files.

**THE RULE, binding on every task below:** no ward name, hospital name, site code, region, bed number
or travel time may appear anywhere except those five files. Screens read them; screens never state
them. A figure that must be shown is derived, never typed.

**Anticipated problems:** test fixtures are the most likely place to break this, because a test that
hardcodes "Royal Perth Adult Secure" reads as clearer than one that looks the name up. It is not — it
is the same defect in a place nobody looks. And copy that names an example ward ("for example, Royal
Perth") is the second: use a value from the data or write the sentence without an example.

**A guard for this belongs with the seam contract** being written in `tests/ward-flow-seam.test.ts` by
the fold session — it is the same shape of contract, and two guards written independently is the
add/add hazard this programme has already paid for. Handed over rather than written here.

---

## Blocking constraint — read before starting

**Every file below exists on BOTH live branches** (`claude/ward-flow-phases-6-7-design` and
`claude/ward-flow-ward-board`), verified 2026-08-29 with `git rev-parse <branch>:<path>`. Both chats
committed within the half-hour before this plan was written.

**Do not start any task until one of these is true:**

1. Phase 8 has landed and the fold is complete, and this work runs on the folded branch; or
2. The chat that owns the file has explicitly handed it over, recorded in
   `C:/Users/joshs/.claude/worktree-ownership.md`.

Starting earlier produces a three-way conflict on the files the ward board depends on. That is the
exact failure this programme has already paid for.

---

## Global constraints — every task's requirements include these

- **Never invent a legal figure.** No figure, timeframe, threshold or duration from the Mental Health
  Act, anywhere — code, copy, comment, test or fixture. A plain Voluntary/Involuntary label is
  permitted and is not a legal figure.
- **No free text anywhere.** Every reason, destination and category comes from a fixed runtime array
  with a membership check. No `notes`, no `comment`, no `<textarea>`, no free `<input type="text">`.
- **No diagnosis. Synthetic data only. No names — roles only.**
- **Every bed dimension is "does this bed accept this person", never an equality.**
- **Nothing predicted, confirmed-but-unreleased, or on leave reaches "beds available right now."**
- **Colour never carries a fact alone.**
- **Local and offline only.** Never `verify:release`, any `eval:*`, `check:supabase-project`,
  `test:live`, or anything touching OpenAI, Supabase, hosted CI or a live database.
- **Never push, never open a pull request. Never `git stash`. Never `git add -A`.**
- **No gate skipped, no assertion deleted, no test loosened.**
- **Run `node scripts/run-vitest.mjs run tests/<file>`**, not `npm run test:focused` — the latter fails
  closed on any `tests/` path and escalates to the full suite on the exclusive lock. Quote the
  `N passed` line, never the exit code. A refusal citing capacity, or exit 75, means blocked — retry.
- **Mutation-test every rule-bearing test.** Record `git hash-object` before mutating, restore, record
  again, compare, and compare `git status --porcelain` against a pre-mutation snapshot. Do not use
  `mutate.sh` — it compares a file with itself.
- **Look at the rendered page** at 390 / 820 / 1440 plus print. Every defect that has reached a screen
  in this project was found by looking, never by a test.

---

## The demo-data disclosure rule (cross-cutting, applies to Tasks 2, 4, 10)

The owner's instruction is that every control works against demo data **and says so**. One shared
component, used everywhere a control now has a real effect on synthetic data:

- A single exported `DemoActionNote` (new file `demo-action-note.tsx`) rendering one fixed sentence.
- It is **text, never colour alone**, and it is not a tooltip — it must be readable without hovering.
- It appears in the same block as the control, not once per page in a footer.
- Wording is fixed and identical everywhere. Proposed: *"Demo data. This records a real change in this
  prototype and reaches no real service."* Owner may replace the sentence; no agent may vary it
  per screen.
- A contract test asserts every screen carrying a state-changing control also renders the note.

**Anticipated problem:** the note must not appear on the ward, ED, officer and referral screens *in
addition to* their existing not-a-medical-device banner in a way that reads as nagging. Check the
rendered page at all three widths before deciding placement; if it reads badly, put one note per
screen at the top of the action region rather than per control, and say so here.

---

## Task 1 — The clock is not stuck at 10:42

**Why first:** it is hit on every demonstration regardless of route, and it makes seeded discharges
read as overdue after ~45 minutes of a live session.

**Files:** `ward-sites.ts` (`NOW_ANCHOR`), `ward-flow-provider.tsx`, `ward-scenarios.ts`.

**Change:** the demo clock starts at the real wall-clock time of page load rather than a fixed
constant, with the seeded relative offsets preserved so the fixture's *shape* is unchanged. A reset
re-anchors to the new now, so a mid-demo reset no longer produces a board of already-lapsed
predictions.

**Anticipated problems, in order of likelihood:**

1. `NOW_ANCHOR` is imported under a restriction — `tests/ward-flow-single-source.test.ts` limits which
   files may read it to a named allowlist. Expect that test to be the first thing that goes red, and
   expect the fix to be an allowlist entry with a recorded reason, not a widening of the rule.
2. Several tests pin absolute instants derived from `NOW_ANCHOR` by value. A moving anchor makes those
   non-deterministic. **They must be rewritten to assert relative offsets, never re-baselined to
   whatever the new code produces.** Re-baselining is how this project shipped seventeen tests that
   passed while the thing they named was broken.
3. The morning page's fixed-handover view and the handover page's frozen snapshot both derive from the
   anchor — see Task 3's open question before touching them.
4. Print output embeds a time; check the printed sheet, not only the screen.
5. **WB-DB-12 — the stamp must read the same clock as the figures.** The page's `now` comes from the
   shared provider, not the wall clock. A stamp that reads the system clock while the figures read the
   provider asserts a moment it is not showing. Every timestamp rendered anywhere reads the provider's
   `now`; `Date.now()` and bare `new Date()` are forbidden in these surfaces. Re-anchoring at load
   happens INSIDE the provider so both stay in step.

**Verify:** `node scripts/run-vitest.mjs run tests/ward-clock.test.ts tests/ward-flow-contracts.test.ts tests/ward-flow-single-source.test.ts`, then load the app at a non-morning hour and confirm every screen agrees.

---

## Task 2 — Nothing frozen: the emergency-department panels read live state

**Verified defect:** `edPressure(now, movements = wardMovements)` in `ward-pressure.ts:25` defaults to
the module-level seed fixture. `flow-diagram.tsx:158` calls `edPressure(now)` with no movements at
all, so the diagram's ED nodes never move. `pressure-strip.tsx:32` passes live movements only when
they are defined. The result: raise a referral and the queue increments while the ED card does not —
two panels on the landing screen disagreeing about one department.

**Change:** remove the default parameter entirely so the argument is required, and pass live movements
from both call sites. A required argument is what makes this class of defect impossible to
reintroduce; a default is what hid it.

**Anticipated problems:**

1. Removing the default breaks every other caller, including tests that currently rely on it. That is
   the point — each one must be inspected, not silenced. Expect several reds that are correct.
2. Some tests may have been written against the frozen fixture and will now see live state. Read each
   failure before changing it; a test that was asserting the frozen value was asserting the defect.
3. `edPressure` feeds the flow diagram's node badges as well as the strip — check both render.

**Verify:** `node scripts/run-vitest.mjs run tests/ward-pressure.test.ts tests/ward-flow-clock-consistency.dom.test.tsx`, then raise a referral in the running app and watch the ED card change.

**Mutation:** make `edPressure` ignore its movements argument and return the seed. A test must go red
naming the disagreement. If none does, the guard does not exist yet — write it.

---

## Task 3 — The one freeze that is still open (CORRECTED 2026-08-29)

**This task was half wrong when written. Corrected after the ward board chat challenged it and both
claims were verified against git rather than accepted.**

**CORRECTED AGAIN 2026-08-29, and the first correction was worse than the original.** I wrote that
the morning page's frozen view was "ALREADY GONE and NOT open", citing commit `e43f3f8f8` — *"Ward
board: the frozen morning view is dropped, everything is live (WB-DB-11)"*.

**That commit changed one design document and no code.** `git show --stat e43f3f8f8` → 37 insertions
in `docs/superpowers/specs/2026-08-28-ward-flow-ward-board-design.md`, one file. **The decision was
recorded. The code was never changed.** On `claude/ward-flow-print-fixes` the morning page still
holds `const [frozen] = useState<FrozenMorning>(...)` with `useState<MorningView>("fixed")` — **the
freeze is present and is still the default view.**

**So the morning page IS open**, and the task's original claim was right. Found by auditing the plan
against the code rather than by anyone challenging it.

> **The trap, and it is the sharpest instance of this project's recurring failure.** A commit that
> *records a decision* has the same message shape as one that *implements it*. `e43f3f8f8`'s message
> is entirely truthful about its own subject — a decision was taken to drop the freeze — and I read
> it as a statement about the code. **`git log` proves a decision was made; only `git show --stat`
> or the file itself proves anything shipped.** A commit message is a claim like any other.

**Both freezes are open.** The morning page (`morning/morning-page.tsx`), where a decision to remove
the freeze exists and was never implemented — so implementing it needs no new owner decision, only
the work. And the shift handover page, below, which has never been put to the owner at all.

**STILL GENUINELY OPEN: the shift handover page** (`handover/handover-page.tsx`), which freezes its
snapshot at page open via a `useState` initialiser. That is a **separate surface and a separate
decision** and has not been put to the owner. The argument for keeping it: a handover meeting is
precisely the case where holding still earns its keep — a sheet whose numbers move while two people
discuss them is not a handover.

**Draw the line narrowly.** One answer about the morning page must not be read as covering the
handover page. A decision quietly widening past what the owner actually said is its own failure mode.

## Task 4 — Every control works, against demo data, and says so

**The two controls that currently change nothing:**

1. `ward-management-modes.tsx` — the priority queue's `DecisionPanel` "Confirm" sets a local boolean.
2. `ward-management-console.tsx` — the patient workspace's "Review & confirm" sets a local boolean and
   then reads "Destination confirmed".

**Change:** wire both to real events against the demo data, and render `DemoActionNote` beside each.

- The queue's Confirm is a coordinator confirming a destination — it should dispatch the same event
  path the coordinator's shortlist "Refer" already uses, not a new one. **One exported function, never
  two components agreeing**: reuse the existing handler rather than writing a second.
- The patient workspace's "Review & confirm" is the same act from a different screen. Same rule.

**Also in this task:** the patient workspace's stage pipeline renders **statewide** stage counts under
a per-patient heading and is clickable, so a colleague clicks "Bed held" and believes they moved that
patient. Make it show that patient's own stage, and make the control either advance the real stage or
be an explicit non-control — never a control that looks like it worked.

**Anticipated problems:**

1. The reducer will refuse these events when preconditions are unmet, and the refusal must surface as
   a stated reason on screen, not as a silent no-op. The ward screen's disabled-with-a-reason pattern
   is the template — copy it, do not invent a second one.
2. Wiring the queue's Confirm may make a previously-passing DOM test wrong in a way that looks right.
   Read the assertion before touching it.
3. `require-button-wiring` lint rule: an unavailable control needs `aria-disabled` + an inert handler +
   `title` + an `sr-only` note. Never native `disabled` together with `aria-disabled` — lint fails on
   the pair.

**Verify:** `node scripts/run-vitest.mjs run tests/ward-flow-reducer.test.ts tests/ward-patient-page.dom.test.tsx`, then click both controls in the running app and confirm a figure elsewhere changes.

---

## Task 5 — The override reason stops being free text

**Verified defect:** `shortlist-panel.tsx` collects the coordinator's override reason in a
`<textarea>`, holds it in component state, discards it when another movement is selected, and never
dispatches it — while `/governance` claims override reasons are recorded. This violates the standing
"no free text anywhere" constraint and makes a governance claim the code does not honour.

**BLOCKED ON THE OWNER:** replacing it needs a fixed list of override reasons. No agent may invent
that list. Until it exists, the honest interim is to remove the textarea and have the governance page
state that override reasons are **not** currently recorded.

**Anticipated problem:** the governance page's change-audit section may render a field that will now
always be absent. Check it renders "not recorded" rather than an empty row.

---

## Task 6 — The remaining demo defects

Each is small and independent; one commit each.

1. **The empty Ward link.** `ward-nav.ts:82` points at `/mockups/ward-flow/ward/rph-adult-secure`, which has no incoming
   referral in the seed — only five of twenty-three units do (`bty-adult-secure`, `bty-older-adult`, `fsh-older-adult`, `gry-older-adult`, `sjgm-adult-open`). Either point the rail at a unit that has
   one, or seed one for this unit. *Anticipated: changing seed data shifts figures on the capacity,
   morning, discharges and coordinator screens. Re-read all four afterwards.*
2. **"0 overdue" reads as though it counts the list beneath it. CORRECTED 2026-08-29 — my original
   instruction here was wrong and would have made the screen LESS truthful.**

   I wrote "make the count cover what the list shows". Do not. The narrowing to `legal-` is a
   **deliberate ruling from a prior review**, with its reasoning in a comment directly above the
   filter (`ward-management-modes.tsx:612`): matching on `tone === "danger"` also caught the
   parallel-referral-cap category — a capacity dead end, not a passed deadline — and so *overstated
   the breach count*. Narrowing it was the fix.

   And my premise inverted the screen. The list is **not** a list of overdue things: its own header
   reads *"Action exceptions — only items with an owner and required next action appear here."* An
   expired bed hold and repeated declines are exceptions needing action; they are not passed legal
   deadlines. The badge is not contradicting the list — it is refusing to describe the list with a
   word that would be false.

   **The real defect is placement, not arithmetic.** A "0 overdue" badge in the header of a list it
   does not count reads as though it counts it. Fix by moving it, relabelling it "0 legal deadlines
   passed", or attaching it to the legal rows. **Never widen the count** — that would put an inflated
   breach figure on a clinical screen and undo a review finding.

   Recorded at length rather than silently edited, because the failure was mine and it is the exact
   shape this project guards against: reading a narrowing as a bug because the comment explaining it
   was not read.
3. **The network is 23 units, not 22 — and this is documentation decay, not a miscount.
   REFRAMED 2026-08-29 after the Phase 8 chat retracted its own observation and I verified the
   retraction.**

   The current count is 23 (`cohort:` fields in `ward-sites.ts`). But the earlier framing in this
   plan — that the number propagated without anyone counting — was wrong, and I repeated it to the
   owner before checking. **Verified by git archaeology:** `5401a7121~1` holds 22 units;
   `5401a7121` holds 23. That commit is *this programme's own Phase 7 Task 1*, 2026-08-27.

   So every "22 units" comment **was correct when it was written.** Nobody guessed. The fixture grew
   and the prose describing it did not — including prose written by the same programme that grew it.
   Duller than the story we told ourselves, more common, and it changes what the fix is.

   **Nine occurrences, not two:** `flow-diagram.tsx:169` and `:287`; `referrals/referral-match.tsx:154`;
   and six in tests — `ward-capacity-reconciliation` (×2), `ward-capacity-sexmix-release`,
   `ward-escalation`, `ward-referral-screens`, `ward-scenarios`.

   **None is live on-screen copy.** The accepting count renders `{accepting.length} of
   {candidates.length}` — computed. The two that look like rendered copy sit inside comments
   describing a historical defect the fix already removed. **So this is documentation decay, not a
   truthfulness defect, and it drops in priority accordingly.**

   **THE ONE THAT MUST NOT BE EDITED — `tests/ward-scenarios.test.ts:26`.** It records a dated
   measurement: *"Measured directly on 2026-08-25 at NOW_ANCHOR, counting `eligibility(...).eligible`
   across all 22 units: 41 open movements, 337 eligible movement/unit pairs, distribution
   {0:2, 4:11, 5:6, 6:3, 11:1, 12:9, 14:9}"*. That measurement predates the 23rd unit by two days, so
   337 and the distribution are stale **in substance**, not merely in their stated basis. The
   assertions beneath are thresholds, so nothing is red and nothing is vacuous.

   **Re-numbering 22 to 23 there without re-measuring would convert a stale-but-honest record into a
   false one.** It is the only one of the nine that must be re-measured rather than edited, and the
   only one where the tidy-looking fix is the harmful one. Leave it alone until someone re-measures.

4. **The guided tour resets the board at start and again at finish**, so the change it just narrated
   reverts as it ends. Reset on start only.

---

## Task 7 — The audit timeline carries the whole journey

**The highest-value single change in this plan.** `movementTimeline` in `ward-derivations.ts:697`
emits only: opened, legal-status changes, declines, the four transport stamps, and closure. After the
full four-role journey it shows six rows — four of them the transport driver's taps, and the last two
are the same minute printed twice, because `PATIENT_ARRIVED` sets `transport.arrivedAt` and
`closure.at` to the same instant.

Missing, though all are already stored on the movement: the examination and its outcome; the referral
to *n* units; the acceptance and which unit; the bed hold and its expiry.

**Change:** add those four, collapse the duplicated arrival row, and link the closed movement's
workspace from the coordinator screen at the moment it leaves the queue — so the journey ends in one
click rather than a hunt through the movements board.

**Anticipated problems:**

1. **There is no timestamp for when the referral went out.** It must render "not recorded" — do NOT
   invent one, and do not substitute a nearby instant. Substituting one would be the same class of
   fabrication as an invented statutory figure: a rendered claim about when something happened,
   sourced from an assistant rather than from the record. If the owner wants the fact, that is a new
   field and a new decision.
   **Verified 2026-08-29** by two sessions independently, counting field references inside
   `movementTimeline`: `examination` 0, `referredUnitIds` 0, `acceptedUnitId` 0, `bedHeldUntil` 0. The
   only `acceptedAt` reads are `movement.transport.acceptedAt`, not the movement's own acceptance. The
   clinical spine of the journey is absent and the transport driver's four taps are most of what
   remains.
2. The two same-minute rows are not a display bug; they are two genuinely distinct facts sharing an
   instant. Collapse them in the view, do not delete either fact from the model.
3. This derivation feeds the handover and governance screens. Re-read both.

**Verify:** `node scripts/run-vitest.mjs run tests/ward-derivations.test.ts`, then walk the full
four-role journey in the running app and read the timeline at the end.

**Mutation:** drop the acceptance row from the derivation. A test must go red naming acceptance
specifically, not merely a row count.

---

## Task 8 — Named scenarios

The machinery exists: `SET_SCENARIO`, `RESET_SCENARIO` and `ADVANCE_CLOCK` are already global demo
controls on every screen, and `ward-scenarios.ts` holds two entries. Add three more, each a named
situation with a one-line description shown in the picker.

Proposed, all synthetic, none inventing a legal figure: *a quiet weekday morning* · *Friday afternoon,
two departments under pressure* · *a ward with three beds free and none that will take a man* (this one
exercises WB-DB-3's sex-acceptance line, which currently has no situation that shows it) .

**Anticipated problems:** each scenario reseeds data that many screens read; check the morning page,
capacity board and discharges board under every scenario. And a scenario must not produce a board of
lapsed predictions — it depends on Task 1 landing first.

---

## Task 9 — The refusal register

A section on the existing `/governance` page listing what this system deliberately will not do, and
**why** — predicting community demand; automatic escalation on a threshold; anything that predicts,
scores, ranks or recommends; notifications that actually send; recording a person's name; diagnosis.
Every reason already exists in `docs/ward-flow-roadmap.md`; this is transcription, not authorship.

**Anticipated problem:** the governance page already carries an effectiveness panel making claims about
what the system does. Do not let the register overclaim in the opposite direction; state each refusal
and its reason, nothing more.

---

## Task 10 — The staleness headline, and the two-sided figure

**Staleness:** one number at the top of the capacity board — how many wards last confirmed more than
24 hours ago. The per-unit freshness already exists; only the roll-up is missing. Pair it with the
existing "Ask this ward to restate its numbers" control, which honestly states it changes no figure.

**Two-sided:** one line showing beds released today against beds taken today. The discharges board
already groups "released today"; arrivals are already recorded. Neither half is new.

**Anticipated problem:** "beds taken today" must count the same event the bed grid counts, derived from
one exported function used by both surfaces — not computed twice. Two components agreeing by
coincidence is how this project ended up with three screens holding one label and two disagreeing.

---

## Task 11 — Print the day (the fast answer to replay)

Replay-by-scrubbing needs backwards state and the system is forward-only; that is weeks. This is the
cheap version and, for a conversation, a better artefact — you can hand it to someone.

**One printable sheet: every event of the session so far, in order, with its role and time.** The
change audit and the audit timeline already hold the material; the morning and handover pages already
have working print buttons to copy. It answers "what happened today" without any new state model, and
it is the thing a clinician can take away from the room.

**Anticipated problems:** the sheet must fit its page count honestly — Phase 6 shipped a sheet that
promised one page and printed five, found at the end. Check the page count with the capture tool at
every step, not once at the finish. And it must render every event, never a truncated first N with no
"and N more" — the movements board already truncates silently at four and that is a defect to avoid
repeating, not a pattern to copy.

---

## Task 12 — One assembled handover

Roughly ninety Ward Flow documents across four weeks. Under "a blueprint a real team could build
from", the scatter is the main obstacle. One document assembled from what exists: what this is, the
model, every settled decision with its reason, every refusal with its reason, what is built, what is
not, and what has never been validated.

**Anticipated problem:** it will go stale the moment it is written. It must say what it was assembled
from and when, and name `git log` as the authority over its own prose — the failure this programme met
three times in one day was trusting a document about code instead of the code.

---

## Task 13 — The "why can this person not get a bed" sheet

Feature agreed by the owner. **The content already exists on screen** — the referral board's match
view lists every unit in the network with its accept/decline verdict and the single reason for each.
What is missing is only the print layout.

**Change:** a printable sheet for one referral — the person's operational facts, then every unit and
its verdict with the reason, on one page. Both the morning and handover pages already have working
print buttons to copy.

**Why it earns its place:** it is the artefact that makes the argument without anyone present. A
colleague handed a page saying "twenty-three wards, and here is why each one said no" understands the
problem in ten seconds.

**Anticipated problems:** twenty-three units will not fit one A4 page at a readable size — decide
deliberately whether it is one page carrying the accepting units and a count of the rest, or several
pages honestly numbered. Phase 6 shipped a sheet promising one page that printed five. Check the page
count with the capture tool at every step. And no ward name may be typed into the layout; every name
comes from the data.

---

## Task 14 — A guided tour for each role

Feature agreed by the owner. **The template already exists and works** — the morning page's
sixty-second tour drives the real reducer through five beats with real events and handles
reduced-motion.

**Change:** the same mechanism for the ward screen and the ED screen, which have the most to show
(fifteen working controls, and the referral intake, respectively). One tour per role, so the owner can
hand the prototype to five different people and each sees their own job.

**Anticipated problems:** the existing tour dispatches `RESET_SCENARIO` on start AND on finish — Task
6 fixes that, so **Task 14 must land after Task 6** or it inherits the defect three more times. Each
tour must stop cleanly on unmount; the existing one already does and is the pattern to copy rather
than reinvent.

---

## Task 15 — Roles become real, or the switcher goes

The role selector on six screens changes the wording and grants no powers. A person switching it to
"Ward" expecting ward controls gets nothing. **The owner's direction is that every cog in the pathway
matters, which argues for making roles real rather than removing the control.**

**Change:** the selector gates what the screen offers, matching the role gates the reducer already
enforces. The reducer is already the authority — `EVENT_ROLE` refuses events from the wrong role — so
this surfaces an existing rule rather than inventing one.

**Why it is LAST:** it touches every screen. Doing it before the ward board's screens exist means
doing it twice.

**Anticipated problems:** a role that cannot act must say why in words and stay reachable — the ward
screen's disabled-with-a-reason pattern is the template. Never native `disabled` alongside
`aria-disabled`; lint fails on the pair.

---

## Task 16 — Every network screen says the network is synthetic

**Raised by the owner's route into the real WA health service.** People in that service know the real
wards, bed numbers and travel times. A wrong number they recognise costs the room in seconds, and no
amount of correct design recovers it afterwards.

**Change:** every screen showing network data carries, on its face, that the wards, bed numbers and
travel times are invented. Not in a document, and not only on the governance page. One fixed sentence,
one shared component, the same discipline as the demo-data note.

**Already loaded in the fixture, as the example of what this prevents:** a Perth Metropolitan person
recorded as reachable from Armadale only by air.

**Anticipated problem:** this and the demo-data note are two sentences that could become clutter.
Decide at three widths whether they combine into one line or stay separate — but neither may be
dropped, and neither may become a tooltip.

---

## Task 17 — The pipeline reaches its end: admit, and discharge to somewhere

**The gap this closes.** Today a patient who arrives at a ward vanishes from every screen. There is
no event that admits them to the bed and none that discharges them. So the discharge half — which is
the whole argument of the mission statement, and the reason the ward board exists — is modelled and
never happens to anybody in a demonstration. The definition of done requires both journeys to run end
to end; this is the only gap between the plan and that definition.

**Change:** two events. Arrival creates the occupancy (an admission), and a discharge ends it,
recording where the person went and who picks them up.

### What already exists — extend it, do not build beside it

`LEAVING_DESTINATIONS` is already in the model with five entries and a `countsAsStatewideRelease`
flag: discharged to the community · transferred to another psychiatric ward (the one `false`, because
it moves the person without freeing a statewide bed) · transferred to a general hospital · moved to
residential care · left against advice. **Do not add to this list or restate it.**

### The follow-up field — `WB-DB-17`, OWNER-APPROVED 2026-08-29

**ID assigned by the tracking ledger, which owns identity. This document holds the reasoning; the
ledger holds the number and the status.**

**One number covers both the field and its scope, deliberately.** Split into two, the field could
ship without the scope correction — and the correction is the important half, because it is what
captures *left against advice with nothing arranged*. As one decision it cannot ship half-built.

The owner asked for a discharge option connecting to community, GP and so on. That is **not** the
existing list. `LEAVING_DESTINATIONS` answers *where the person physically goes*; this answers *whose
care they pass into*, which is a second fact and the more clinically interesting one — a person
discharged to the community with a team following up and one discharged with nothing arranged are the
same row today.

**Approved, and no agent may tidy, shorten, reorder or remove an entry:**

- The community mental health team *(already modelled — `ward-teams.ts` holds one per region, so this
  option links to a record rather than naming a body)*
- General practitioner
- Private psychiatrist
- The existing treating team continues
- No follow-up arranged

**`No follow-up arranged` is approved deliberately and is the point of the field.** A count of people
leaving with nothing arranged is a fact this hub can show honestly and that nobody currently sees.
The owner was told it will read as an accusation on a ward's own board and approved it anyway. If it
is ever softened, the only permitted wording is **"follow-up not yet arranged"** — the same fact
stated as a moment rather than a verdict. It may not be removed, and it may not be merged into
another entry.

**WHEN IT IS ASKED — owner-approved, and it is broader than first drafted.** The first draft asked
only when the destination was the community. That was wrong: *left against advice with nothing
arranged* is arguably the most important case in the system and the draft would not have captured it.

**Ask for follow-up on EVERY discharge except a transfer to another psychiatric ward**, where the
receiving ward is the follow-up and asking again records the same fact twice.

### Constraints on this task, above the global ones

- **No date, duration or interval attaches to follow-up.** "Seen within N days" is a service standard,
  not a fact this prototype can source, and it sits close enough to a statutory figure that inventing
  one would breach the standing rule.
- **No diagnosis, no reason for admission, no free text.** The destination and the follow-up are both
  fixed lists with membership checks.
- **A discharge with no follow-up recorded shows as "not recorded", never as "none arranged".** They
  are different facts — the same discipline as a discharge nobody has spoken about.

### Anticipated problems

1. **Every live surface scopes to open movements**, so today the patient disappears at arrival by
   design rather than by accident. Admitting them means the admission becomes the thing that is open,
   and the movement legitimately closes. Check the queue, patient search, escalation board, handover
   and ED screen all still read correctly after the change — a patient must not appear twice.
2. **The seed already contains occupancies.** Arrival must create an admission of the same shape the
   seed produces, or the board renders two kinds of admission and only one of them works.
3. **`countsAsStatewideRelease` is load-bearing and one entry is deliberately `false`.** Its array
   carries a comment saying not to tidy it for consistency. A ward-to-ward transfer frees this ward's
   bed and no bed statewide; getting that wrong makes the network appear to gain a bed from nothing.
4. This task **must land with Task 7** — see the batching note in Phase D. A journey that now has an
   ending needs the timeline that shows it.

---

## The build order — eight phases, batched

**Batching principle: batch by FILE and by REVIEW, not by feature.** Tasks touching the same modules
go together so the code is read once, reviewed once and verified once. Tasks are split apart only
where a real dependency or a diagnostic reason demands it. One reviewer per phase holds the whole
batch, because a reviewer who sees the interactions catches what per-task reviewers structurally
cannot.

### Phase A — The fold *(not this plan; the fold session owns it)*

The fold, then the seam contract, then the data-boundary contract. **Everything below is blocked on
this**, because every file this plan touches exists on both live branches. Re-run `merge-tree` at the
moment of folding, take the board's copy of the three conflicted files wholesale, and check with the
four greps rather than a test run.

### Phase B — The clock. Alone. *(Task 1)*

**Alone deliberately, and this is the one place where batching would cost more than it saves.** Moving
the anchor changes every seeded instant and will turn several test files red. Batched with anything
else, a red becomes ambiguous — was it the clock, or the other change? Alone, every red is diagnostic.

Expect the single-source allowlist to fail first. Rewrite value-pinned tests as relative offsets;
never re-baseline them to whatever the new code prints.

### Phase C — The journey has an ending, and the flow repeats *(Tasks 17, 7, 11)*

**MOVED AHEAD OF THE TRUTHFULNESS BATCH, owner decision 2026-08-29.** This was Phase D. It is now
Phase C, and the reason is the foundation above rather than a preference about ordering.

Today a patient reaches a ward and vanishes from every screen, so a demonstration can show one person
moving once and then stops. **Nothing else on this list is worth doing before the flow can happen
twice.** Everything below this phase makes the demonstration honest; this phase makes it about
something.

**Order inside the batch: 17, then 7, then 11.** The journey needs an ending before the timeline can
show one, and the timeline must carry the journey before the sheet has anything to print. In any
other order each step is done twice.

**Why these three together:** all read the same derivation and the same change audit. One pass
through that code, and — more importantly — one answer about what happened to a patient rather than
three surfaces that could each describe it differently.

**It depends on Phase B and cannot start before it.** Discharge built against a clock frozen at 10:42
records every discharge as already in the past.

### Phase D — Stop the screens lying *(Tasks 2, 3, 4, 5, 6, 16)*

**Was Phase C.** Still the biggest and best batch: six small changes, all in the coordinator / modes /
console / handover files, all the same kind of defect — a screen saying something untrue — and none
depending on another. One reviewer holding all six sees the interactions.

Two orderings inside the batch: **Task 5 before Task 4** (remove the free-text box before adding the
demo note beside those controls), and **Task 16 alongside Task 4**, because both add a fixed sentence
to the same regions and must be laid out together rather than fighting each other.

**After this phase, nothing on any screen is false.** That milestone is unchanged; it simply now
arrives after the flow works rather than before.

### Phase E — The ward board's screens *(the other plan)*

Daily sheet **first** among the screens, print built **alongside** each screen rather than after it,
and the stopwatch against a twenty-bed ward run early while it is still cheap to change. All three are
WB-DB-4, which the ward board plan's wave table still does not reflect.

### Phase F — The persuasion batch *(Tasks 8, 9, 10, 13)*

**Fully parallel — four new surfaces, none touching anything another touches.** Named scenarios, the
refusal register, the staleness headline with the two-sided figure, and the printable why-no-bed
sheet. Cheapest phase per unit of effect, and the one that makes the demonstration argue for itself.

**Task 8 depends on Phase B:** a scenario that reseeds against a stuck clock produces a board of
already-lapsed predictions.

### Phase G — Reach *(Tasks 14, 15)*

Tours per role, then roles made real. **Task 14 after Task 6**, or it inherits the double-reset defect
three more times. **Task 15 last of all** — it touches every screen, so before Phase E it would be
done twice.

### Phase H — Close *(Task 12, then the gate)*

The assembled handover with the mission at its head, then **one** reliability pass: full offline unit
suite, lint, typecheck, a production build, and the Chromium journeys. The build specifically — a
wrong Server/Client boundary and a missing icon entry are both invisible to tests.

### What runs in parallel, and what must not

| Runs in parallel | Must be serial |
| --- | --- |
| Everything inside Phase F | A, then B, then C — C cannot start before B |
| Tasks 2, 3, 6, 16 within Phase D | 17 before 7 before 11; Task 5 before Task 4 |
| Reviewers, always, in fan-out | Phase B alone; Task 15 after Phase E |

**One controller commits**, one file set at a time with explicit paths. Three writers at most: the
pre-commit hook inspects the whole working tree, so a fourth only queues behind them.

**One verification per phase, not per task.** Focused tests during the work
(`node scripts/run-vitest.mjs run tests/<file>`), and the heavy gates once, at Phase H.

### Where the finish line sits

The definition of done at the top of this plan is met at the **end of Phase G**. Phase H is the
handover, not the demonstration. If time runs short, **Phases F and G are the ones to cut** — the
demonstration is honest and complete without them, and merely less persuasive.


## Efficiency — five things that make this faster at no cost to the result

Found by reviewing the sixteen tasks against each other rather than one at a time. Each is a saving
that changes nothing about what gets built or how well.

**1. Three printable sheets are one shape, not three.** Task 11 (the day's events), Task 13 (why no
bed for this person), and the ward board's own ward sheet are all "one page rendered from data that
already exists, page count checked with the capture tool". Ten `window.print()` surfaces already
exist in this repository to copy from. **Build the first one properly, extract what it taught, and the
other two are the same component with different content.** Built independently they are three
layouts, three page-count problems, and three chances to promise one page and print five.

**2. The two notices are one component with two strings.** The demo-data note and Task 16's
synthetic-network note are the same thing — a fixed sentence, always text and never colour alone,
never a tooltip, placed in the action region. One component taking its text as a prop. Two components
means two placements to reconcile at three widths, and eventually two answers about where a notice
sits.

**3. Sixteen tasks are five shapes. Price them accordingly.** Defect fixes · new derivations · print
sheets · fixed-sentence notices · guided tours. **The first task of each shape sets the pattern and
deserves the stronger model; every later instance of that shape follows the first as its
specification and does not.** That is most of the token cost of this plan, and it is the saving that
does not touch quality — the pattern is what carries the thinking, and it is written down after the
first one.

**4. Review by phase, not by task — `PROC-1`, OWNER-APPROVED 2026-08-29.** Filed in a separate
`PROC-` series rather than the product one: the product register answers what the system does, and how
work gets reviewed is not that. Two series is the whole set — there is never a third. One independent reviewer holding a
whole batch, plus one whole-branch review before the gate. This project's own record is unambiguous: the whole-branch review
found one critical and ten important defects that per-task reviews *structurally could not see*,
because each looked at a single diff. Sixteen tasks reviewed twice each is 32 review passes; eight
phases plus one whole-branch review is nine. **Say so honestly in every report, without being asked** — the claim is
"every phase was independently reviewed, and the whole branch once", and it is never "every task was
independently reviewed". The owner accepted that narrowing knowingly; a report that quietly widens it
back is worse than the review shape it describes.

**5. One verification per phase.** Focused tests during the work with
`node scripts/run-vitest.mjs run tests/<file>`, which takes the shared lease; the heavy gates once, at
Phase H. A focused run costs about the same whether it covers one file or five, so run the phase's
files together and discover the set from disk rather than naming it by hand — a hand-picked subset has
already shipped a red test on this project twice.

**What is NOT a saving, and was considered:** skipping mutation testing on tests that look obviously
sound. Seventeen tests here passed while the behaviour they named was broken; that is a measured base
rate, not a hypothetical. The honest economy is batching mutations — apply several in disjoint
functions, run the suite once, and require exactly the named tests red and nothing else — not doing
fewer of them.

## Verification at the close, once

One reliability pass at the end, not per task: full offline unit suite, lint, typecheck, a production
build, and the Chromium journeys. The build specifically — a wrong Server/Client boundary and a missing
icon entry are both invisible to tests.

## What this plan does NOT do

No change to the referral/movement seam (P7-D14 — Phase 7's spec, NOT the ward board's D14, which is community team names) — that refusal stands. No admit or discharge events. No
travel-band rendering: the fixture currently records Perth Metropolitan to Armadale as reachable only
by air, and the first screen that renders it hands a Perth psychiatrist an absurdity. No revisiting of
any recorded refusal.
