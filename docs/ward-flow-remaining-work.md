# Ward Flow — everything remaining, and the order to build it

> ⚠️ **ITS LIST IS SUPERSEDED. ITS REASONING IS NOT.**
>
> **The single list of outstanding work is `docs/ward-flow-task-ledger.md`** — on
> `claude/Wardquestions`, so from another branch:
> `git show claude/Wardquestions:docs/ward-flow-task-ledger.md`
>
> **Read THIS file for WHY a thing is the way it is.** ⚠️ **Do not take a task, a state or a count
> from it** — three documents carrying task state means fixing one leaves two wrong, **and that is
> exactly what happened: a heading here said three owner rulings were approved and unbuilt for hours
> after all three had landed, because the same claim was corrected in the ledger and not here.**
>
> **The changeable-data rule is one place per fact. This banner is the correction, and it sits at the
> top because the reader who would be misled ARRIVES here rather than going looking for a list of
> superseded documents.**

---

**RE-MEASURED 2026-08-30, on `claude/ward-flow-phases-6-7-design` at `900538328`.**

**Three entries below changed on re-measurement, and one of my own checks nearly failed the same way twice in one hour** — see the near-miss under the intake-role entry.

**This is a record of what was true then, not a fact about now.** Every state line was measured, not
recalled. Re-measure before acting on any of it — and the commands are given so you can.

---

## 1. Where the lines are

```
working line   claude/ward-flow-phases-6-7-design   20a3e29e3
board line     claude/ward-flow-print-fixes         aa1be64ba   ahead 4 / behind 0
```

---

## 2. Landed tonight

| What                                                                                                                                                                                                                                    | Where                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| The demo clock starts at the real time, and a reset re-anchors to it                                                                                                                                                                    | `bdade7a21`              |
| The clock carries a date; the midnight workaround is gone                                                                                                                                                                               | `b1198cf6e`              |
| Two patients now genuinely wait longer than a day                                                                                                                                                                                       | `68e5e18ee`              |
| History says which day; the places still allowed to assume today are named                                                                                                                                                              | `20a3e29e3`              |
| The third bed stage is **discharged**, not released — 23 files                                                                                                                                                                          | `b2aefd1a0`              |
| The referral form no longer answers for the clinician                                                                                                                                                                                   | `78133a738`, `13d2842e4` |
| The tentative diagnosis, with the guard widened rather than walked around                                                                                                                                                               | `de023179b`              |
| The diagnosis vocabulary moved where a referral can reach it                                                                                                                                                                            | `f20b8087b`              |
| The ward's daily sheet, with its stamp carrying which day                                                                                                                                                                               | `f20b8087b`, `78b15162f` |
| Nine governance documents on the line everyone reads                                                                                                                                                                                    | `4ef1f7098`              |
| The two lines converged                                                                                                                                                                                                                 | `e0bce1beb`              |
| **TASK 17 — a patient who reaches a ward now EXISTS there.** `WardFlowState` carries `admissions`; `PATIENT_ARRIVED` appends a person. **11,426 tests passed, 0 failed**                                                                | `235ce466f`              |
| **A PATIENT EXISTS BEFORE ANYTHING HAPPENS TO THEM.** `ward-patients.ts`, `ADD_PATIENT`, eight fictional patients, the three-legged guard in the same commit. **Age DERIVED from DOB, never stored.** **11,428 tests passed, 0 failed** | `7246806bb`              |
| The frozen morning view is gone; one live view; the sheet stamps when it was printed (DB-11)                                                                                                                                            | `990b570ff`              |
| Discharge banding stops assuming day zero — **the fourth instance of that category error, closed**                                                                                                                                      | `89eefb1c7`              |
| **The discharge horizon rolls a full day and says "tomorrow" rather than lying** (DB-7, DB-10)                                                                                                                                          | `900538328`              |
| Three owner decisions on the board: it says it is frozen, two labels pinned, a patient at an ED visible                                                                                                                                 | `c66d3fdb1`              |

---

## 3. PARTIALLY done — the dangerous category

**These look finished from one angle and are not. Each is written with the specific way it misleads.**

### The diagnosis on the referral — half built

**`ward-diagnosis.ts` exists so a referral can import the vocabulary without reading backwards.** The
**admission** carries `tentativeDiagnosis`; the **referral does not.**

> **A grep for the decision's vocabulary returns five confident hits and certifies it implemented.**
> Half-built work has the exact shape of a finished build pointing the wrong way, **and re-running the
> search only confirms it.** Read the log, not the tree.

**Remaining:** the referral carries the block at intake; the admission inherits rather than authoring.

### Two referral forms, never a decision

**The ED's form (`ward-ed-referral-form`) creates a `Movement`. The shared `ReferralIntakeForm`
creates a `Referral`.** Built four days apart under different specs. **No conversation anywhere
decided to keep both** — the owner's own _"same stages, different front door"_ was an intention that
never reached the code.

### The intake form's hard-coded role — DEFENDED, and `FD-16` may have just made it wrong

**Still `role: "community"` at line 319** — but the file **moved to `referrals/referral-intake.tsx`**,
and a comment now defends it: the referral's own field records **WHERE** the request came from, while
`role` records **WHO** is acting, and _"the two are independent."_

**SHARPENED by the referrals session, and its reading is better than mine.** The comment defends the
**distinction** — that `role` and the referral's own source field are different things — and **that
part is correct and should be kept.** It does not defend the **constant.**

> **Two separate claims, one argument, attached to the wrong one.** _"`role` and `source` are
> different fields"_ does not imply _"`role` is always `community`"_. The second is a hard-coded value
> that happened to be true for the only screen that existed when it was written.

**So `FD-16` does not put pressure on the defence — it exposes that the defence was answering a
different question.** And the falsifier is general, not specific: **any hub raising a referral
falsifies a hard-coded `community`.** A ward referring to an ED does it as surely as ED psychiatry
referring to themselves.

**The entry's correct form: not _"the form lies about its source"_ but _"the form hard-codes who is
acting, and its comment defends why that field exists rather than why it is constant."_

> **The near-miss, and it is the same failure twice in one hour.** My first check for this string
> returned **zero matches** — not because it was fixed, but because **I searched the old path.** A
> moved file and a deleted line are indistinguishable to a path-bound grep, and the zero reads as
> good news. **The reliable form asks the tree where the file is now**
> (`git ls-tree -r --name-only <ref> -- <dir>`) **before searching inside it.**

### The referral's own guard will FIGHT the changes already decided

**`ward-model.ts` still declares a referral carries _"EXACTLY five facts"_, with no free text of any
kind** — and a guard pinned to it, so _"a future field named `patientId`, `notes`, `diagnosis` or
`dob` is caught."_

**Three decided changes add exactly those shapes:** the free-text story field, the diagnosis block,
and the destination. **The guard is not stale — it is doing its job against decisions taken after it
was written.**

> **The failure mode is predictable and it is not the guard breaking: it is somebody deleting the
> guard to make a decided change compile.** The replacement rule already exists — **types, not
> counts** — and this is the moment it gets used. **Widen it deliberately, in the same commit, with
> the decision named.**

### Two reducer cases with no user interface

**`REFERRAL_ARRIVED` and `RECORD_LOCAL_BED_SOUGHT`** — seed and tests only. **Their existence is not
evidence a feature shipped.**

### The override reason — CORRECTED TWICE, and the real defect is sharper than either version

**Measured at `123b0c139`. My row was wrong in one half; the correction to it was wrong in the other.**

**WRONG IN MY ROW: "discarded".** It is not. `shortlist-panel.tsx:379` does
`setOverrideRecord({ unitIds, at: now, reason })` and `:1032` renders it back. **It is kept in
component state and dies when the coordinator navigates away** — which is different from discarded,
and worse in a way the next paragraph explains.

**WRONG IN THE CORRECTION: "no screen claims otherwise".** The claim exists, at the line I cited.
**`ward-management-modes.tsx:861`, verbatim:**

> _"Users can select an alternative, **record an override reason** and see which gate changed the
> ordering."_

**Ward Verifier searched for a recording claim, found the honest `NotAMedicalDeviceStatement` at
`:760`, and reported the claim absent.** It is thirty lines from what it read. **Both of us produced
a confident half-right account of the same file** — and neither error was carelessness.

### ⚠⚠ THE GOVERNANCE SCREEN STATES IT AS PRESENT FACT — and the card beside it proves that was a choice

**Verified at `123b0c139`. Two ADJACENT cards in `GovernanceView()`, same component, same visual row:**

```
"Contestable outcome"   Users can select an alternative, RECORD AN OVERRIDE REASON and see
                        which gate changed the ordering.            <- PRESENT FACT. FALSE.

"Immutable ownership"   The PRODUCTION CONCEPT REQUIRES role-based access and an immutable
                        audit of source updates, recommendations and decisions.   <- future. TRUE.
```

> **The file demonstrably knows how to phrase an aspiration, and did not do it once.** Thirty lines
> apart, the same author distinguished _"requires"_ from _"does"_. **That removes the charitable
> reading that the Contestable card was loose drafting about intended design.**

**This is the highest-risk untruth in the prototype, and the reason is where it sits.** It is **on the
governance screen**, on the card headed **CONTESTABLE OUTCOME**, and **contestability is precisely
what a reviewer from a health service would test.**

> **_"Show me an override from last Tuesday"_ has no answer.**

**Recommended wording, matching the honest card beside it:**

> _"Users can select an alternative and see which gate changed the ordering. **The production concept
> requires the override reason to be recorded and shown to the service overridden.**"_

**True today, and it states the gap instead of hiding it.**

### The actual defect, which is worse than "unshared"

**`:1032` renders, to the coordinator who just typed it:**

> _"Overridden by a human coordinator — referred to ‹units› at ‹time› — reason: '‹text›'. No bed was
> allocated automatically."_

**Actor, targets, timestamp, reason, and a governance assurance. That is the exact form of an audit
entry.**

> **It is `useState`. It is shown only to its own author, it holds the ONLY copy of the reason, and it
> dies on navigation.** **A sentence shaped like a permanent record, addressed to the one person who
> already knows what it says.**

**Nobody reading that line would guess it is not kept.** My row said _"an override only the overrider
sees is an audit trail, not accountability."_ **That understates it: it is not merely unshared, it is
unsaved, and it LOOKS saved.**

**No ward-flow event carries an override reason at all.** `ward-flow-events.ts` has `DeclineReason`,
`UrgencyChangeReason`, `LegalStatusChangeReason`, `ReleaseHoldReason`, `CancelTransportReason`,
`ReferralDeclineReason` — **and nothing for an override.**

> ⚠️ **WHOEVER BUILDS `DB-15` MUST BE TOLD THE STORAGE IS MISSING TOO.** `DB-15` replaces the free-text
> box with four fixed reasons. **Done alone, it swaps a free-text box that goes nowhere for four fixed
> reasons that go nowhere** — and the row will read as done.

**And it is still free text, which is a live breach of the no-free-text refusal.**

### Button labels — two pinned, eighteen DECLINED

**20 of 30 plain-literal ward button labels have no test pinning their words.** The owner read the
list and chose **two**: `"Send referral"` and `"Decline referral"`.

> **The other eighteen are DECLINED, not deferred.** A decision he has already taken. **Do not
> "finish" the job.**

---

## 3b. Found during the wind-down, 2026-08-30 — both verified here

### The handover page still FREEZES, and the owner has already ruled on its sibling

**Verified at `2b9190447`, `handover/handover-page.tsx`:**

```ts
const [frozen] = useState<FrozenHandover>(() => ({
  snapshot: handoverSnapshot(movements, units, now),
  units,
}));
```

**Its figures are captured when the page opens and never move again.** A shift handover discussed for
twenty minutes is discussing numbers from the start of it.

> **This is the exact pattern the owner removed from the morning page four commits ago**, in his own
> words: _"there is no point of a stale handover."_ **The morning page's freeze is gone. The handover
> page's is not, and nobody has said so.**

**`OD-4` in the decisions document lists "shift handover goes live" as `WB-DB-11`'s sibling with no
owner. That is this.** **Not an unknown — a decision that exists and was never given to anybody.**

**It is not being fixed quietly.** The freeze may be deliberate there for the reason it was originally
deliberate on the morning page, and **that is the owner's call in exactly the way the other was.**

**Two smaller ones of the same family, recorded and NOT acted on**, both plausibly deliberate:
`ward-screen.tsx:131` snapshots `unit.allocatable.value` at mount, so a ward typing while another
surface changes the count sees a stale starting value; and `coordinator-screen.tsx:64` initialises
`selectedMovementId` once, so a selection can outlive the movement closing.

### The morning page's COMMENTS still describe the freeze it no longer does

**Found while verifying the above, and it is a second defect on the same commit.**

`morning-page.tsx` no longer calls `useState` — **but two doc comments still say it does**, including
_"`MorningPage`'s `useState` initialiser below calls this once"_ and a paragraph explaining why the
page is not just another live view. **There is no such initialiser.**

**And `FrozenMorning` and `buildFrozenMorning` are still DEFINED in that file**, unreachable.

> **So a reader opening the morning page finds a type called `FrozenMorning`, a builder for it, and
> prose explaining why the page freezes — and the page does not freeze.** Every one of those was
> accurate when written. **The behaviour moved and the explanation did not.**

**This is the strongest instance yet of the fourth decision state**: `WB-DB-11` is decided,
implemented, and **the file still argues for the opposite.** A grep for the decision's vocabulary
returns confident hits pointing the wrong way.

---

## ✅ 3c. THREE OWNER RULINGS, 2026-08-30 — ALL THREE NOW BUILT

> ⚠️ **This heading said *"approved, none built"* for hours after the last of them landed.** The
> handover page is live, `Decline.note` is removed at `0e3c7691a`, and the away group is a line under
> the grid at `14ede0c2b` — **the reading the owner then confirmed as `WB-DB-23`.** **Corrected by a
> sweep of this file, not by anybody reading it.** **The detail below is kept for its reasoning.**

**All three approved as recommended. Written as enumerations with the exclusions named**, because a
ruling that widens a boundary gets read afterwards as widening the principle.

### Ruling 1 — the handover page goes LIVE

**Approved.** `handover/handover-page.tsx` freezes its snapshot at mount; **it stops.** The owner had
already decided this for the sibling morning page in his own words — _"there is no point of a stale
handover"_ — and `OD-4` listed the handover as `WB-DB-11`'s sibling with no owner. **It has one now.**

**The argument the other way was weighed and lost:** a frozen page means everyone in the room reads
the same numbers while they talk. **That only holds if the page SAYS it is frozen, and it does not.**
A handover running twenty minutes shows bed counts from the start of it with nothing indicating so.

**This ruling does NOT authorise:** removing freezing anywhere else; changing what the handover
displays; touching `ward-screen.tsx:131` or `coordinator-screen.tsx:64`, the two smaller snapshots
found beside it. **Those remain recorded and unruled.**

### Ruling 2 — the free-text `note` on a decline is REMOVED

**Approved.** `Decline.note?: string` (`ward-model.ts:246`) goes, and the reducer stops storing it.

**The reason, which must travel with the rule:** every `DeclineReason` is a fixed value chosen so a
refusal describes **the service's situation and never the patient.** The open field beside it let a
service write anything it liked **about a specific named individual it had just refused** — the exact
thing the controlled vocabulary refuses, with an escape hatch next to it.

> **Free-text fields always get used.** And a real database is coming, so this closes before it holds
> real records rather than after.

**This ruling does NOT authorise:** removing free text elsewhere — **the referral's one story field is
a separate owner decision and stays**; nor adding a replacement field without its own decision. **If a
service genuinely needs "no beds until Thursday", that is a fact about the SERVICE and deserves its
own named field with that meaning** — never a general note attached to the refusal of a person.

### Ruling 3 — the away group prints ONE LINE when empty, a column when occupied

**Approved as a SHAPE. The measurement is still owed.**

**The tension both sides of which are right:** the sheet's rule that an empty group says so in words
is correct — _"an empty list under a heading reads as a panel that failed to load"_, and on a sheet
read aloud, _"nothing failed to print"_ has to be explicit. **But `SheetGroup` renders a heading and a
line unconditionally, and the sheet lays groups side by side — so it is a SIXTH COLUMN on every ward,
including the majority with nobody away.**

**The resolution: when nobody is off the ward, print a single line — _"Nobody is off the ward"_ —
rather than a column.** The assurance survives at a fraction of the space; the column appears only
when it has something in it.

> ⚠️ **NOBODY HAS MEASURED THE ACTUAL OVERFLOW.** The board session tried, the dev server died twice,
> and it declined to report a number it had not taken. **`AWAY_GROUP_PLACEMENT_UNRESOLVED` already
> names the placement question in the file; the sixth-column cost belongs on it.** **Measure before
> building.**

**This ruling does NOT authorise** relaxing the empty-group convention anywhere else on the sheet.
**It is one exception, for one group, with a stated reason.**

---

## 3d. THE BED MODEL IS REBUILT — owner, 2026-08-30

**He found the defect nobody had named, in one sentence:**

> **"One says if the physical bed is available or not… the other says when a patient may be going
> home which subsequently guides bed availability."**

**Two jobs in one model, and the second FEEDS the first rather than sitting inside it.** Every bug
found at that seam is explained by it: a stuck confirmed discharge falling out of a count; a
tomorrow discharge rendering as tonight; a horizon change moving a number that looked like occupancy.

```
Bed state   Available | Occupied | Held | Pending (with a reason)
Discharge   Expected  | Confirmed | Discharged  (with a blocked flag and reason)
```

**`Pending` = empty but not usable.** Cleaning, maintenance, staffing, infection control, hazards live
as its **reasons** — the same shape as a blocked discharge, deliberately, rather than a second
mechanism for one idea.

**`Expected` replaces `predicted`.** _"Expected date of discharge"_ is language clinicians already use,
and it frees `Pending` for the bed side. **Both sides must never use `Pending`** or the collision
returns under a new word.

**`blocked` leaves the bed side entirely.** `Unit.blocked` becomes `Pending` + reason; **the blocked
FLAG stays on the discharge side.** The name collision disappears by construction rather than by
anyone remembering it.

**`beingPrepared` folds into `Pending`'s reasons** — it was always a bed-availability fact wearing
forecast clothes, which is why it needed the rule _"informational only, must never gate allocation"_.

> **What this replaces: everything I proposed about walls, sub-objects and two types is now
> unnecessary.** The two halves do not need separating — **they need an arrow.** Predictions are an
> input to availability, and the naming does the rest.

**Sequencing, and the first is not negotiable: the board line MERGES FIRST.** It carries
`released` → `discharged`. Renaming to `Discharged` before that lands is **two renames colliding on
one identifier**, where a take-both resolution compiles, passes, and leaves two spellings.

---

## 3e. The clinician check — FOUR of seven answered, three outstanding

**He answered the hardest ones by rebuilding the model, which is what the check existed to provoke.**

| #   | Question                                                                 | State                                       |
| --- | ------------------------------------------------------------------------ | ------------------------------------------- |
| 1   | Do the stages plus a blocked flag describe something you recognise?      | **ANSWERED — no.** It was two models in one |
| 2   | **Are those the right words?**                                           | **ANSWERED.** He supplied them              |
| 3   | Which questions still have the wrong answer?                             | **partly** — answered for the bed model     |
| 4   | Is there a stage missed entirely?                                        | **ANSWERED — yes**, the bed-state axis      |
| 5   | Is a bed really gone at the moment of pulling?                           | **OUTSTANDING**                             |
| 6   | Would a ward keep one discharge date per patient up to date daily?       | **OUTSTANDING**                             |
| 7   | Is asking a ward for its two sex-acceptance numbers each day reasonable? | **OUTSTANDING**                             |

> **Marking it "done" wholesale would be false, and it is the exact failure this project keeps
> finding: a check reported complete when part of it never ran.** The three outstanding questions are
> operational-reality questions he has not touched, and each is one line to answer.

**Question 2 was the one the document called _"the one we cannot answer ourselves"_. It is answered.**
That was the highest-value part and the reason the check existed.

---

## 3f. THE CLINICIAN CHECK IS COMPLETE — and answer 1 contradicts the model

**All seven answered, 2026-08-30. The document's own hardest question — _"are those the right
words?"_, the one it called the one we cannot answer ourselves — was answered by him rebuilding the
model.**

### Q5 — A bed is taken **once the patient is ACCEPTED by the ward or coordinator**

**Not at allocation, not at arrival. Acceptance is the event.**

> ⚠️ **And the sentence beside it inverts a role the whole model is built around: _"the ward can
> accept patients also, not only the coordinator. The coordinator's role is a backup to oversee
> everything."_**

**The model contradicts this, and only on one side. Verified:**

```
ACCEPT_IN_PRINCIPLE   ["ward"]          a ward CAN accept a movement
HOLD_BED              ["ward"]          a ward CAN hold a bed
DECLINE               ["ward"]          a ward CAN decline
ACCEPT_REFERRAL       ["coordinator"]   ← ONLY the coordinator
DECLINE_REFERRAL      ["coordinator"]   ← ONLY the coordinator
```

**So a ward may accept a movement and may not accept a referral.** Nobody decided that — the two
sides were built at different times, and the referral side arrived with the coordinator as its gate.

> **This is bigger than a permission entry. The coordinator is currently a GATE — nothing reaches a
> ward without passing through them. He has just said the coordinator is a BACKUP, overseeing a flow
> that works without them.** Those are different systems, and every screen built on the first reads
> the wrong way under the second.

**`ACCEPT_REFERRAL` and `DECLINE_REFERRAL` must accept `["ward", "coordinator"]`** — and the referral
inbox becomes a ward's own queue rather than a coordinator's worklist.

### Q6 — A ward revisits a discharge date **periodically, not daily** — unless it is within days

> **"The ward will revisit it periodically, but unlikely daily unless discharge is within the coming
> days."**

**Confidence in a discharge date DECAYS WITH DISTANCE, and the model treats all dates alike.** A date
ten days out is probably stale; one two days out is probably fresh.

**Two consequences:**

**The 24-hour rolling horizon is VINDICATED rather than arbitrary** — inside it sit exactly the dates
a ward keeps fresh. **That is a better justification than the one it was given.**

**And Task 10, the staleness headline, is now load-bearing rather than a nicety.** A far-out date shown
with the same confidence as a near one is a screen overstating what it knows. **It should show when
the date was last revisited**, which `confirmedBy`/`confirmedAt` already carries.

### Q7 — Asking is reasonable **now**; it should be DERIVED later

> **"Yes it is reasonable to ask… although it should be worked out automatically once in the future I
> give you exact bed allocation, although sometimes it changes and the ward will need to notify."**

**Same shape as region-derived-from-suburb: asked today, derived tomorrow, with the ward able to
correct it.** Sex acceptance falls out of bed allocation plus current occupants — **but not always**,
so the override is part of the design rather than an escape hatch.

> **Build it so the number has ONE home.** When the allocation data arrives, the asked figure becomes
> the derived figure and the ward's notification becomes a correction to it — **never a second
> authority for the same fact.**

---

## 3g. OWNER RULING — the coordinator is NOT a gate (2026-08-30)

> **"A referral can be accepted by wards directly… the coordinator has full control but is overseeing
> everything. The system should run autonomously as much as possible. NO REFERRALS ARE BLOCKED OR
> GATED BY THE COORDINATOR."**

### There are TWO gates, and the one I first named is the lesser

**Verified in `ward-flow-events.ts`:**

```
REFER_TO_UNITS     ["coordinator"]   <- THE ROUTING GATE. Nothing reaches a ward until
                                        the coordinator sends it. This is the real one.
ACCEPT_REFERRAL    ["coordinator"]   <- the answering gate
DECLINE_REFERRAL   ["coordinator"]
```

**`REFER_TO_UNITS` is the gate that matters.** A ward cannot accept a referral it has never seen, and
**it sees nothing until a coordinator routes it.** Opening `ACCEPT_REFERRAL` alone would change
nothing.

### What the ruling requires, and the question it forces

**Both gates open:** `ACCEPT_REFERRAL` and `DECLINE_REFERRAL` become `["ward", "coordinator"]`.

**But removing the routing gate leaves a hole: if the coordinator does not route, how does a referral
reach a ward at all?**

> **RECOMMENDATION: route AUTOMATICALLY by eligibility.** A referral goes to every ward that could
> take the patient — catchment, bed type, sex designation, security, age band, authorisation — capped
> by `PARALLEL_REFERRAL_CAP`. **The ward sees it in its own inbox without anybody sending it.**

**That fits everything already built:** `ward-eligibility.ts` exists and already computes it; the
catchment work supplies the approved hospitals; and the cap of three exists precisely to stop a
referral broadcasting to twenty wards.

**And it changes what the shortlist IS.** Today it is **how a referral gets anywhere.** Under this
ruling it becomes **the coordinator's override tool** — widen, narrow, or send somewhere the ranking
did not choose. **The machinery survives; its position in the flow inverts.**

> **Which makes the override-reason defect worse than recorded.** A reason typed and discarded is bad
> when overriding is routine; it is **worse when overriding is the coordinator's ONLY intervention in
> a flow that otherwise runs itself.** That fix is now the coordinator's whole audit trail.

### Consequences that reach other work

**The ED hub design changes.** Its inbox was a coordinator's worklist; it becomes **a ward's own
queue**. The design session's spec is affected and it is not yet handed over.

**The destination union changes shape** — in flight. A destination is now **derived from eligibility
by default and set explicitly only on an override**, rather than always chosen by a person.

**Two more coordinator-only events worth a second look**, neither ruled on:
`RECORD_LOCAL_BED_SOUGHT` (arguably an ED or ward fact) and `REQUEST_CAPACITY_REFRESH`.
**`RECORD_ESCALATION` staying coordinator-only looks right** — escalation is statewide.

---

## 3h. OWNER: THE REFERRER ADDRESSES THE REFERRAL — and this overturns a survey

> **"Referrals are sent by the referring clinicians… either in ED or community."**

**My automatic-eligibility-routing recommendation is WITHDRAWN. It answered a hole that does not
exist** — the referrer routes, so nothing needs to route on their behalf.

### It overturns the referral survey, which the destination spec was built on

**The survey ran three independent legs and concluded:** _"A referral has never been addressed by the
person raising it. Destination is chosen downstream, by the coordinator, and only ever to wards."_

> **That is now wrong, and it was the most carefully-established finding of the week** — three legs,
> two opposite honest answers reconciled into one conclusion. **A survey can be rigorous and still be
> asking a question the owner would answer differently.**

**The destination tagged union is being built on it.** Both sessions need this before the union lands.

### The code contradicts the ruling in THREE places, all verified

```
RAISE_REFERRAL: ["ed"]                    community CANNOT raise a referral at all
ReferralDraft                             has NO destination field
RAISE_REFERRAL carries `edId`             the event shape assumes an ED origin
```

**`WardFlowRole` already includes `"community"`. The role exists; it is simply not permitted to
refer.**

> **And this explains the two-forms problem as the same defect rather than a separate one.** The ED's
> form creates a `Movement`; the shared intake form creates a `Referral`; `referral-intake.tsx`
> hard-codes `role: "community"` while `RAISE_REFERRAL` accepts only `"ed"`. **The referral path was
> built as an ED path with community bolted alongside** — which is why nobody could find the decision
> to keep both forms. There was never a decision, only a shape that grew.

### What follows

**`RAISE_REFERRAL` accepts `["ed", "community"]`**, its `edId` becomes an origin that can be either,
and **`ReferralDraft` gains the destination** — which is the union already specced, now set by the
referrer at intake rather than by a coordinator downstream.

**The catchment table changes audience.** It was going to help the coordinator choose; **it now helps
the REFERRER choose**, which is a better fit — a community clinician in Armadale needs to know which
ward is theirs, and that is exactly what postcode-to-hospital answers.

**And the coordinator's screens become oversight throughout.** They see every referral, may act on
any, and **nothing waits for them.**

---

## 3i. THE REFERRAL MODEL IS SETTLED — one verb, four destinations (2026-08-30)

> **"Community to ED is also the same… it can be declined, but rarely."**

**So EVERY referral is a request that can be accepted or declined. There is no notification-only
kind.** The "expect" is a referral like any other; it is simply one that is almost always accepted.

**That makes the model SIMPLER than the one I was drafting**, and it removes the shape I was about to
recommend building.

### The settled model

```
Every referral:  raised by a referrer  ->  ADDRESSED to a destination  ->  accepted or DECLINED
```

| Destination          | What the receiver is answering                                       |
| -------------------- | -------------------------------------------------------------------- |
| **Psychiatric ward** | a bed request — capacity, sex mix, security, authorisation all apply |
| **ED**               | a medical request — none of the psychiatric bed criteria apply       |
| **Medical ward**     | a medical request — same                                             |
| **Community team**   | a follow-up request — accepted by a **team**, not a bed              |

**Every arrow the owner named fits it**: community→ED, community→ward, ED→ward, ED→community,
ward→community, ward→ED/medical ward. **Every kind of place refers to every other kind, and the
referrer addresses it.**

### What differs is the CRITERIA, not the lifecycle

> **This is the correction that matters, and I had it wrong twice in an hour.** I first said a
> ward→ED referral was a notification; then that an expect might be one. **Neither is.** One verb,
> one lifecycle, four sets of criteria.

**So the union's arms carry the criteria that apply, and nothing else varies.** A community team is
never asked about bed security **because its arm has no such field** — not because a screen remembers
not to ask.

**And "rarely declined" is a real property worth respecting in the design without over-building for
it.** The decline path must exist on every destination; **it should not dominate a screen where it is
the rare answer.**

### What this closes

**No automatic eligibility routing** — withdrawn; the referrer addresses it.
**No notification type** — withdrawn; everything is declinable.
**No coordinator gate** — `REFER_TO_UNITS` stops being how a referral reaches anybody.
**`RAISE_REFERRAL` accepts `["ed", "community", "ward"]`**, and its `edId` becomes an origin of any
kind.

---

## 3j. THE REFERRAL LIFECYCLE IS SETTLED — all six answered (2026-08-30)

### 1. The referrer selects MULTIPLE destinations in one act

**Not repeat referrals — one referral, several destinations, chosen at once.** And the referral tool
does work for the clinician while they choose:

- **flags which wards are in catchment**
- **shows estimated wait time and other useful statistics per option**

> **This makes the catchment table a REFERRING tool rather than a coordinator's.** It is consulted at
> the moment of choosing, by the person choosing.

### 2. First acceptance cancels every other referral, automatically

**No coordination. No decision. The moment one ward accepts, the rest are cancelled by the system.**

### ⚠️ 3. WARDS CANNOT SEE WHERE ELSE A PATIENT HAS BEEN REFERRED — and the reason is the design

> **His words: so they "don't know which prevents them taking their time on patients referred to
> multiple locations."**

**This is a deliberate blindness with a behavioural purpose, and it is the single rule here most
likely to be broken by accident.** Every instinct in building a patient screen says _show everything
about this patient in one place._ **That instinct is wrong here and nothing in the code currently
says so.**

**It needs a GUARD, not a note.** No ward-facing surface may show another destination's referral for
the same patient. **The coordinator may see all of it** — they are oversight — **so the rule is
ward-facing only, which is exactly the kind of exception a guard must encode rather than a reader
remember.**

### 4. Nothing is locked out; out-of-catchment is greyed

**No beds makes no difference — a ward with no beds can still be referred to.** A decline does not
lock a ward out, and **an option to clarify remains** after one.

> **This retires the earlier "a ward that declines drops out of suggestions" decision.** A ward with
> no bed at 09:00 may have one at 17:00.

### 5. A referral CAN exist for a patient who already has a bed

**Two cases, both real:** an outpatient community referral **while the patient is a current
inpatient**, and an **ED or medical ward referral from a psych ward** — which is different in kind,
because it is a psychiatric patient needing **medical** treatment.

**So the model's assumption that a referral is always about finding a bed for somebody who has none
is wrong**, and that is a change to the union's subject rather than its arms.

### 6. A referral ends, for bed placement, AT ACCEPTANCE

**Then the ward notifies the referring clinician when to book transport.**

> **Transport arrangement is an OPEN design question he has delegated** — _"or come up with the best
> system for transport arrangements."_ **Not decided; ours to propose.**

---

## 3k. Two more owner instructions

**Outpatient referral infrastructure: BUILD IT.** The community hub is to be completed with **a full
circle follow-up flow** — so a patient discharged from a ward is referred to a community team, seen,
and the loop closes. **This is the community hub unparked.**

**The coordinator override register: APPROVED, with the recommendations.** Every coordinator
intervention recorded — what was overridden, whose decision it was, when, and why — **and visible to
the party overridden.**

> ⚠️ **"Visible to the party overridden" is the load-bearing clause and the easiest to lose.** An
> override log nobody overridden can see is an **audit trail**, not accountability — and **the two
> store identical data**, so the difference disappears during a build unless somebody is holding it.

---

## 3m. ⚠️ QUEUE ORDERING — owner ruling that REVERSES my recommendation (2026-08-30)

> **"A long wait always is prioritised… however… in certain cases patients can be marked as urgent
> for many reasons which outranks everything. Otherwise go by time for the main level of urgency."**

**I recommended the opposite: _"no, a long wait triggers escalation rather than reordering."_ He has
ruled the reverse for the ordinary case. My version must not be recorded anywhere.**

### What the code does today, read at `fdace4dd1`

```ts
// ward-priority.ts:160
.sort((a, b) => a.urgency - b.urgency || operationalScore(b, now).score - operationalScore(a, now).score)

// ward-priority.ts:85
const waitPoints = Math.min(40, Math.floor(waitedMinutes / 15));   // CAPPED at 40 = 10 hours
```

**Three tiers exist** — `1: most urgent`, `2: urgent`, `3: least urgent` — and within a tier the order
is a **composite score** in which wait is one capped factor among several.

### Three specific differences, and the cap is the sharpest

**1. THE CAP DIRECTLY CONTRADICTS THE RULING.** `Math.min(40, …)` means **after ten hours, waiting
longer adds nothing at all.** Two patients at 10 hours and 30 hours score identically on time. _"Go by
time"_ cannot survive a ceiling. **And `D9-1` already decided the ceiling comes off** — recorded,
never built. **This ruling and that decision are the same change.**

**2. Time is one factor among several, not THE ordering.** He said _"go by time for the main level of
urgency."_ Today it is a contributor to a score.

**3. ⚠️ AMBIGUITY I WILL NOT RESOLVE: one urgent MARK, or three tiers?** His words are _"marked as
urgent"_ — which reads as **a flag that outranks everything**, not a three-rung ladder. The model has
`UrgencyLevel` 1/2/3. **If he means a mark, tier 2 disappears into "order by time" and that is a
larger change than removing a cap. This is for him, not for us.**

> **This is not a documentation edit. It changes who gets the next bed**, which is the one thing in
> this prototype that a wrong answer harms a person over. **`ward-priority.ts` is Ward Core's file.**

---

## 3n. THE CLINICIAN CHECK IS CLOSED — by decision, not by evidence

> **Owner: "close this please" — and, of the two-clinician review, "close this two clinician review
> for now and mark as closed."**

**Recorded exactly as what it is: a decision to STOP SEEKING the evidence, not the arrival of it.**

**`R3` already says the owner's own acceptance is real clinical evidence but _"not the evidence the
method was designed to obtain"_, and that _"a later reader must not credit the model with a
confirmation it never received."_ **That sentence survives the closure.**

> ⚠️ **If any document ends up saying the bed model is "validated", the closure has been recorded as
> its opposite.** It was reviewed by the owner — a consultant psychiatrist, and his call to make — and
> **it was never put to a second clinician.** Both facts, together, or neither.

**His words "for now" stay in the row.** It is a fourth and final deferral **closed by owner decision,
carrying its risk**, not a question answered.

---

## 4. NOT started, and the state that proves it

| Task                                                                                   | Measured evidence                                                                |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **2 — the ED panels read live state**                                                  | `edPressure(now, movements = wardMovements)` default still present               |
| **3 — the two freezes**                                                                | `MorningView` appears 8× in `morning-page.tsx`; the handover freeze is untouched |
| **4 — every control works and says it is demo**                                        | no `DemoActionNote` exists                                                       |
| **5 — the override reason stops being free text**                                      | the `<textarea>` is still in `shortlist-panel.tsx`                               |
| **6 — remaining demo defects**                                                         | 6.3 done; 6.1, 6.2, 6.4 untouched                                                |
| **7 — the timeline carries the whole journey**                                         | `movementTimeline` still emits only the old event set                            |
| **8–13 — scenarios, refusal register, staleness, print the day, handover, why-no-bed** | none exist                                                                       |
| **14–15 — tours per role, roles made real**                                            | "tour" does not occur in the ward or ED screens; no control is gated on role     |
| **16 — every network screen says synthetic**                                           | full notice on 3 surfaces; the rest carry only a badge                           |
| **17 — the journey gets an ending**                                                    | **`admission` appears 0 times in `ward-flow-reducer.ts`**                        |

**Task 17 remains the single most consequential item.** `isOpen` excludes arrived movements and gates
ten surfaces, so **a patient who reaches a ward vanishes from every live screen** and the
demonstration cannot show the flow twice.

---

## 5. Blocked, and on what

> **NOTHING IS BLOCKED. The project's only live blocker closed at `900538328`.**

| Was blocked                                 | Now                                                                   |
| ------------------------------------------- | --------------------------------------------------------------------- |
| **DB-7, the discharge horizon**             | **BUILT.** The horizon rolls a full day and says _"tomorrow"_         |
| **DB-10**                                   | **BUILT in the same commit**                                          |
| The referral's destination field            | decided, unblocked, **and now the critical dependency for every hub** |
| **DB-11, dropping the frozen morning view** | independent, under way                                                |

**The bands fix landed the way the diagnosis said it should** — classify by day first, then by time of
day — rather than by bolting a `"tomorrow"` band onto a comparison that was making a category error.

**The morning page has a holder: the untangle session, told directly by the owner.** My "holder
unknown" is resolved. **DB-11 is not blocked and is under way**, which is also the cheaper order.

### The bands question, which is the live blocker

Widening the horizon past today looks like one line. **The bands underneath are clock times** —
`["now", "by-midday", "by-1600", "tonight"]` — so **a discharge expected at 09:00 tomorrow renders as
"tonight".** A ward is told _by 16:00_ about something happening tomorrow morning.

> **It compiles, it passes, and it is wrong on screen.**

**CORRECTED — and the correction changes the fix, not the framing.** The untangle session built the
rolling window, **passed all 11,400 tests**, then confirmed by arithmetic that a 09:00-tomorrow
discharge renders as _"tonight"_, and reverted it. **It had noticed the tension while implementing and
talked itself past it** — on the grounds that the decision said "one comparison", when **the decision
was describing the horizon, not licensing the consequence.**

**The real fault is a category error, and it is the same bug a fourth time:**

```
release.expectedAt <= MIDDAY_MINUTES      // an ABSOLUTE INSTANT compared against 720, a TIME OF DAY
```

**Bolting on a `"tomorrow"` band would fix the symptom and leave the category error in place.**

> **The fix has the same shape as the clock fix: classify by `dayOf(expectedAt) - dayOf(now)` FIRST,
> then by `minuteOfDay(expectedAt)` against the midday and late-afternoon constants.** A band is a
> time of day, so it must be compared against a time of day. **"Tomorrow" then falls out of the model
> rather than being added to it.**

**What remains with the owner is narrower than it was: whether a ward should SEE a "tomorrow" band at
handover at all.** That is a product decision about what a ward reads, not an engineering one.

**The general form, which is the reusable part:** _any window widened past today, over bands that
assume today, fails silently and in the direction of false urgency._ **And it is the same defect as
`Instant` meaning two things** — a value crossing a day boundary into a representation with no room
for days. **The two want one concept, not two fixes** — the referrals session's reading, and the
untangle session confirms it changed the fix rather than the framing.

### The points-in-time hold is SCOPED AND ENFORCED — not lifted, and not blanket

**The instant sweep LANDED at `20a3e29e3`; five history surfaces moved to `formatInstantWithDay`.**

**`formatInstant` still wraps and always will** — it is the right function for a time that genuinely
cannot be another day. **What changed is that assuming today is now a declared decision rather than a
default.** `tests/ward-instant-display.test.ts` **names every remaining bare call site with its
reason, and a new one fails until somebody chooses.**

**Seven are marked STILL TO SWEEP**, each with what blocks it: a capacity confirmed yesterday, an
expected release tomorrow, a return from leave days away, a legal form's due time, a refresh request,
a transport acceptance, and the exception drawer — which has no `now` in scope and needs a prop.

> **Nobody needs a blanket hold any more. The test is the hold, and it can fail.**

---

## 6. Decided tonight and not yet built

| Decision                                                           | What it means                                                                                              |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| **A referral names its destination**                               | the model's missing piece; makes inboxes possible                                                          |
| **ED medical staff refer to ED psychiatry**                        | a new inbound source; ED psychiatry place them on the board's **referral inbox for ED patients** to review |
| **The ED screen is the ED Psychiatry Hub**                         | an inbox and an outbox                                                                                     |
| **ED psychiatry see declines and their reasons**                   | the reason is already recorded; showing it closes the silence                                              |
| **One story field, free text**                                     | the owner overruling his own rule, recorded as an overrule                                                 |
| **A ward may add its own diagnosis block**                         | never overwrites the referrer's; a correction, not a task                                                  |
| **A referrer may withdraw**                                        | no event exists for it                                                                                     |
| ~~A ward that declines drops out of suggestions for that patient~~ | **SUPERSEDED by `FD-24`, 2026-08-30 — nothing is locked out**                                              |
| **No service-level "who refuses most" reporting**                  | standing refusal; rejected as politically charged                                                          |

---

## 6b. Who holds what — live allocation, 2026-08-30

**Confirmed by asking each session, not inferred from names.** One owner per contended file.

| Session                       | Worktree / branch                                                 | Building                                                                                           | Collides with                                              |
| ----------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **untangle**                  | `pr-2390-fix` / `phases-6-7-design` **(the main line, by baton)** | **Task 17**, and DB-11 meanwhile                                                                   | **Sole owner of `ward-model.ts` + `ward-flow-reducer.ts`** |
| **referrals**                 | writing specs, holds no tree                                      | the **destination tagged union** and the **guard-widening plan**, then the **override-reason fix** | nothing — specs, not edits                                 |
| **board**                     | `nostalgic-vaughan` / `print-fixes`                               | **patient search over referrals** (the half that does not need Task 17)                            | read-side only                                             |
| **`lucid-dewdney-ee093b-d8`** | `lucid-dewdney-ee093b` / **`Ward-design`, divergent**             | **UNKNOWN — asked, awaiting answer**                                                               | **unknown, and that is the open risk**                     |
| **orchestrator**              | `Wardquestions`                                                   | this ledger, the plans, the owner's questions                                                      | documents only                                             |

**Two orchestration failures found in one hour, both mine, both worth keeping:**

> **I allocated the same small fix to two sessions.** Neither erred — the referrals session had claimed
> it directly to the untangle session, **session-to-session, which is invisible to an orchestrator
> unless somebody relays it.** My picture was complete and stale at the same time. **The untangle
> session declined rather than complying, which is the behaviour that caught it.**

> **And a fifth live session was committing to a ward branch with no row in any registry.** A
> worktree name and a session name sharing a stem is **not** evidence of a relationship — the harness
> names sessions after worktrees, and a rename breaks exactly that mapping.

---

## 7. The build order

**Serial where it must be, parallel where it can be.**

1. **The bands decision** — unblocks the morning page and the horizon. **Owner.**
2. **Task 17: admit and discharge.** The journey gets an ending. **Everything about the demonstration
   being _about_ something depends on this.**
3. **The referral's destination**, then the ED Psychiatry Hub's inbox and outbox. **Now unblocked.**
4. **The morning page's three decisions** — DB-11 first, because DB-10 becomes nearly free once there
   is one view. **Holder unknown; must be named.**
5. **Tasks 2, 3, 4, 5, 16 as one batch** — all the same defect, a screen saying something untrue.
   **Task 5 before Task 4.**
6. **Tasks 7 and 11** — the timeline carries the journey, then the day prints. **After 17.**
7. **Tasks 8, 9, 10, 13** — fully parallel, four new surfaces, cheapest effect per unit of work.
8. **Tasks 14, 15, then 12** — reach, then the assembled handover, then one verification pass.

**The definition of done is met at the end of step 5.** Steps 6 to 8 make the demonstration argue for
itself. **If time runs short, cut 7 and 8.**

---

## 8. Still with the owner

1. **The bands** — the only item blocking work.
2. **Who is building the morning page.** He says it is being built; no chat I track holds it.
3. **When an ED's completed section clears** — a shift boundary. **Nobody will invent a time.**
4. **Community teams** — the names, and the shape: one team per region is right for the country and
   wrong for Perth, which has several.
5. **Presentations or coding categories** — _"first-episode psychosis"_ versus `F30–F39`.
6. **Should the handover page still freeze.**
7. **Should anything survive a reload.**
8. **The clinician check** — deferred three times; his own trigger is _before anyone in the health
   service sees this._
