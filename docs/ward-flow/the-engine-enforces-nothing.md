# The bed rules live on the screens, not in the engine

**Established 2026-09-02 by driving the real reducer over real seeded data. It worked on the first
attempt. This corrects a reassurance Ward Lead gave the owner twice, and the correction is the point
of the document.**

## The claim that was wrong

Ward Lead told the owner that no patient could be placed in a bed the eligibility rules would refuse,
because "the controls that act are wired to the correct check". **That was true of one route and
never checked against the others.**

## What is actually true

**The reducer contains exactly ONE eligibility call**, `referralEligibility(...)` inside
`ACCEPT_REFERRAL`. Verified at `3b864698d`: one occurrence in the whole file.

**None of the events that move a patient into a bed call anything.** Measured by line range, each
with a working control:

| Event                                             | Lines   | Eligibility calls |
| ------------------------------------------------- | ------- | ----------------- |
| `REFER_TO_UNITS` — addresses a referral to a ward | 712–765 | **0**             |
| `ACCEPT_IN_PRINCIPLE` — the ward says yes         | 766–840 | **0**             |
| `PULL_PATIENT` — the patient takes the bed        | 885–    | **0**             |

`REFER_TO_UNITS` rejects on six things: movement exists, not closed, not referred too widely, a
referable stage, the unit id resolves, and the override reason is from the permitted list.
**Nothing about cohort, security, sex, or forensic status.**

⚠️ **And the one check that exists is on a different model entirely.** `ACCEPT_REFERRAL` belongs to
the front-door Referral flow, whose own comment says acceptance "creates NO Movement". So it never
stands between a patient and a bed. **The gate is real, correct, well-tested — and not on this road.**

## The demonstration

Seeded movement `WF-009` — Adult, Male, Secure, involuntary, detained under a 3B form, needing
one-to-one care, whose own seeded blocker text reads _"No secure adult bed available across the
network"_ — driven through the real reducer into `brm-adult-secure`, the network's forensic bed:

```
STEP 1 REFER_TO_UNITS      -> rejections: []   stage: destination_review
STEP 2 ACCEPT_IN_PRINCIPLE -> rejections: []   stage: accepted_awaiting_bed
STEP 3 PULL_PATIENT        -> rejections: []   stage: pulled, admissionId: AD-ARR-01
Final admission: { unitId: "brm-adult-secure", sex: "Male", state: "pulled" }
```

**Zero rejections at every step.** Known-positive control in the same run: `referralEligibility()`
refuses that same unit outright — _"Broome Adult Secure is a forensic bed and is never offered as a
destination"_ — so the gate works perfectly when something actually asks it.

## ⚠️ What changed under this finding while it was being measured, and why it matters

The probe ran at `f2abfba77`. **Since then the forensic gate was added to `eligibility()`**, the
function the coordinator's shortlist uses. So one half of the finding has already closed: the plain
**Refer** button no longer offers a forensic bed as a first-class eligible candidate, which at the
probed commit it did — no override required.

**The other half is untouched.** The **Override** control performs no eligibility check by design,
and the reducer still enforces nothing behind it. **So the safety of ward placement rests entirely on
the user interface.** Fix a screen and the hole closes; add a screen and it reopens.

⚠️ **This is exactly why the finding must not be filed as "the forensic bug, now fixed".** A screen
fix closed the demonstration. It did not close the mechanism, and the demonstration is not the
finding.

## Not a bug report — a decision the owner has to make

**Override is deliberate.** It carries a required reason from a fixed list, and the code documents it
as an escape hatch "for an ineligible candidate (its original purpose)". A clinician overruling a
rule with a recorded reason is a legitimate design, and possibly the right one for a real service.

So the question is not "is there a bug" but: **should the engine refuse what no human has explicitly
overridden?** Today it refuses nothing, so the difference between a considered override and an
ordinary click is invisible after the fact — both produce the same clean record.

**One recommendation:** make the reducer refuse a placement that fails the gates **unless an override
reason is recorded on that event**. That keeps the human escape hatch exactly as designed, makes
every bypass carry its reason into the record, and means a future screen cannot reopen the hole by
omission. It is a clinical policy change and belongs to the owner, not to this chat.

⚠️ **One sub-finding is not a policy question and should be fixed either way: the receiving ward is
never told.** Its accept and pull buttons deliberately mirror the reducer's own checks — which are
eligibility-free — so they can "never advertise different verdicts". The consistency is admirable and
the verdict they agree on is silence. The only warning banner on that screen covers two narrow cases,
neither of them cohort, sex, or forensic. **A ward can accept a patient it cannot lawfully hold and
see nothing at all.**

## The method note, because it nearly went wrong twice

Ward Lead's first two attempts to verify this at HEAD both produced worthless results, and **both
were caught only by the control, not by the answer looking wrong**:

- An `awk` range `/case "X"/,/^    case "/` matched a **single line**, because the case labels are
  indented five spaces and the end pattern matched the start line. It reported "no eligibility call"
  from a one-line range.
- A control anchored on line 2170 returned zero — **because the merges earlier that night had pushed
  the call to 2207.** A line number is a fact with an expiry date.

**Both failures produced the reassuring answer.** That is not chance: a broken search returns nothing,
and "nothing" is what "no problem here" looks like.

---

## ✅ RE-RUN AT THE CURRENT TIP — the finding stands in full, 2026-09-02

**MEASURED AT** `342a81bc0` · **MASTER THEN** `342a81bc0`, behind 0 · **STANDING** stands as
measured. Re-run by Ward Builder Three because the demonstration above ran at `f2abfba77` and both
load-bearing files have moved since — `ward-flow-reducer.ts` **+38/-1** and `ward-eligibility.ts`
**+64/-1**, with `master vs itself` as the control. **A demonstration whose files have changed is
unverified, not wrong; this converts it back.**

### ⚠️ The first probe produced a rejection, and it was the wrong rejection

**Repeating the original `WF-009` → `brm-adult-secure` walk now gives:**

```
CONTROL eligibility(WF-009, brm-adult-secure) -> eligible=false
        failing gates: forensic … | specialling: 0 specialling slots available
STEP 1 REFER_TO_UNITS      -> 0 rejections · destination_review
STEP 2 ACCEPT_IN_PRINCIPLE -> 0 rejections · accepted_awaiting_bed
STEP 3 PULL_PATIENT        -> 1 REJECTION  · stage unchanged
   reason: "…has no one-to-one specialling capacity left (0 staffable, all in use)…"
```

**A reader stopping here would report that the engine now enforces eligibility. It does not.** The
refusal is a **specialling-capacity** check, and the eligibility verdict failed on **two** gates —
forensic AND specialling. ⚠️ **The reducer independently enforces the second and still ignores the
first.** **This is trap 21 in its own subject matter: a red is not attribution, and the red here
belongs to a different rule than the one under test.**

### The second probe isolates the question, and the answer is unchanged

**Searched the whole seed for pairs `eligibility()` refuses where the specialling gate is not
involved at all — 709 of them — and drove the first through the real reducer:**

```
pair: movement WF-001 -> unit rph-older-adult · failing gate: cohort
STEP 1 REFER_TO_UNITS      -> 0 rejections · destination_review
STEP 2 ACCEPT_IN_PRINCIPLE -> 0 rejections · accepted_awaiting_bed
STEP 3 PULL_PATIENT        -> 0 rejections · pulled
FINAL stage: pulled · admissionId: AD-ARR-01 · TOTAL new rejections: 0
```

⚠️ **An adult is referred to, accepted by, and placed into an older-adult ward — a bed the
eligibility rules refuse on cohort — with ZERO objection from the engine, and an admission is
created.** **The mechanism is exactly as documented above and nothing about it has closed.**

### What HAS changed, stated so nobody re-files it as fixed

**One incidental gate arrived**: the reducer now refuses `PULL_PATIENT` when the ward has no
one-to-one specialling capacity. **That is a capacity rule, not an eligibility rule.** It happens to
block the original forensic demonstration, which is why the demonstration no longer reproduces —
**and why the demonstration was never the finding.** ⚠️ **The document said so before this re-run,
and the re-run is what proves the warning was right rather than cautious.**

**Standing unchanged: the safety of ward placement rests on the user interface. Fix a screen and the
hole closes; add a screen and it reopens. It remains the owner's decision, not a bug report.**

### ✅ And a static reachability trace, taken a DIFFERENT WAY, agrees

**The runtime probe above answers "what does it do". A subagent (Sonnet, read-only, extraction with
a named control) answered "can it reach the gate at all" — the relation Ward Verifier flagged that
its own presence-count could not settle.** Both at `342a81bc0`.

```
REFER_TO_UNITS      712–764   -> findMovement · findUnit · reject · replaceMovement          NO PATH
ACCEPT_IN_PRINCIPLE 766–820   -> findMovement · findUnit · reject · replaceMovement          NO PATH
PULL_PATIENT        885–1070  -> + bedsPendingPreparation · openBedsNow ·
                                 remainingSpeciallingCapacity -> bedIsOccupied               NO PATH
ACCEPT_REFERRAL     2110–2342 -> referralEligibility  (one step, line 2207)                  REACHES
depth 3, every function opened and resolved, no dynamic dispatch
CONTROL: `zqxEligibility` -> 0 matches, so a zero is a real zero
```

**Inverse check as well**, which is the one a forward walk misses: every export of
`ward-eligibility.ts` was listed with all its call sites under `src/`. **`eligibility()` is called in
six places and every one is a SCREEN** — `shortlist-panel.tsx`, `ward-management-console.tsx`,
`ward-management-modes.tsx`, `ward-management-network.tsx`, and twice in `ward-derivations.ts`.
**Not once in the reducer.**

⚠️ **AND IT CORRECTED THE PRESENCE COUNT IT WAS SENT TO VERIFY — WHICH WAS MY WORDING, NOT WARD
VERIFIER'S. Corrected here rather than left standing.** `PULL_PATIENT` contains **one** textual
`eligibility` mention, at line 947, inside a comment describing the specialling gate. **Prose, not a
call, and it changes nothing about reachability.**

**Ward Verifier's own table was headed _direct eligibility calls_, where 0 is correct — and it had
already flagged the line-947 comment itself, as its own near-miss, at the time it measured.** ⚠️ **The
loose restatement was MINE: my brief to the agent said the three events "contain none", dropping the
word that made it true.** **A false attribution of error is the same family as a false attribution of
credit** — it manufactures a mistake somebody did not make, and it is harder to retract because
nobody defends a correction.

**What is worth keeping is the agent's behaviour, not the size of the discrepancy: it refused to
confirm the premise it was handed and reported the difference.** **An agent that corrects its own
brief is worth more than the answer it was sent for**, and my brief was wrong in exactly the way a
brief written from memory of somebody else's finding usually is.

**Why this counts as corroboration and the earlier agreements did not:** ⚠️ **it is the same question
asked through a different apparatus** — a static call-graph walk against a live reducer run. **Two
chats driving the same page through the same tool are one instrument used twice. A trace and a probe
are two.**

⚠️ **The one thing the agent flagged that neither instrument settles:** `ACCEPT_IN_PRINCIPLE` is the
closest thing to a bed acceptance on the movement path — it takes `event.unitId` and writes
`acceptedUnitId` — and it runs **no** eligibility gate of any kind, only
`movement.referredUnitIds.includes(event.unitId)`. **Whether that omission is intended is a design
question and neither a trace nor a probe can answer it.**

---

# ✅ OWNER'S RULING, 2026-09-02: THE ENGINE SHOULD REFUSE

**His words, direct, in Ward Builder Three's session:** _"the engine should refuse, screen checks are
not enough"_.

**This closes the question this document was written to put to him.** It was framed as a decision
rather than a bug report, and it has been decided. **Screen-level checking is NOT the intended
design.**

## What the ruling settles, and what it does not

**Settles:** the reducer must not place a patient into a bed the eligibility rules refuse. **A screen
may still advise, prompt and pre-check — but it is no longer the only thing standing between a
patient and a wrong bed.**

⚠️ **Does NOT settle, and must not be assumed:** whether an ineligible placement becomes
**impossible**, or **possible only with a recorded override**. **These are different systems and the
difference is clinical.** A bed coordinator at 3am facing a patient who must go somewhere is a real
situation, and a system that cannot be overridden at all will be worked around outside the system,
where nothing is recorded.

## ⚠️ The recommendation, and the reason it is not "add a hard refusal"

**Refuse by default, permit with a recorded reason — because the override path already exists and is
deliberate.** `REFER_TO_UNITS` already accepts an `overrideReason` and already validates it against
`OVERRIDE_REASONS` by membership rather than truthiness. **The machinery for an accountable exception
is built; what is missing is the refusal it is an exception TO.**

**So the shape is:** the three movement events consult the eligibility verdict; an ineligible unit is
refused **unless** the event carries a permitted override reason; and the override is written into
the record as it already is for referral. ⚠️ **A hard, unconditional refusal would be a bigger
clinical change than the ruling asks for, and would remove a documented deliberate control.**

## What must be true before this is called done

1. **All three events**, not one. `REFER_TO_UNITS`, `ACCEPT_IN_PRINCIPLE` and `PULL_PATIENT` — and
   ⚠️ **`ACCEPT_IN_PRINCIPLE` is the one to get right**, because it is the closest thing on the
   movement path to a bed being accepted and it currently runs no gate of any kind.
2. **The probe above must be re-run and must flip.** WF-001 into `rph-older-adult` currently walks
   all three steps with zero rejections and creates `AD-ARR-01`. **After the change it must be
   refused, naming the failing gate** — and the same walk WITH a valid override reason must still
   succeed and be recorded as an override.
3. ⚠️ **A red is not attribution.** The refusal must be shown to come from the eligibility gate and
   not from the specialling-capacity check that already exists — **that confusion nearly closed this
   finding falsely an hour ago.** Prove it on a pair whose only failing gate is cohort.
4. **`ward-eligibility.ts` is a protected surface.** The gate's own pass/fail logic is not to be
   edited; this is about CALLING it, not changing it.

## ✅ AND THE SECOND RULING, same session: REFUSE UNLESS A REASON IS RECORDED

**His words, direct:** _"refuse unless a reason is recorded"_.

**So the open half above is closed too. The engine refuses an ineligible placement by default, and
permits it only when the event carries a recorded override reason.** ⚠️ **An ineligible placement is
NOT made impossible** — it is made **accountable**.

**The clinical reasoning behind that, stated so nobody later "hardens" it into an outright block:** a
bed coordinator at three in the morning with a patient who must go somewhere is a real situation.
**A system that cannot be overridden does not prevent the placement; it moves the placement outside
the system, where nothing is recorded at all.** ⚠️ **An override that is refused becomes a phone
call.** The ruling keeps the decision inside the record.

### What this makes the change, precisely

|                                        | Before              | After                                                   |
| -------------------------------------- | ------------------- | ------------------------------------------------------- |
| Ineligible unit, no reason given       | **placed silently** | **REFUSED, naming the failing gate**                    |
| Ineligible unit, valid override reason | placed silently     | **placed, and the reason recorded**                     |
| Eligible unit                          | placed              | placed, unchanged                                       |
| Invalid override reason                | —                   | refused, as `REFER_TO_UNITS` already does by membership |

⚠️ **The middle row is the one that must not be lost.** It is the whole difference between the
ruling and a hard block, and it is the row a later reader is most likely to "simplify away" as an
exception that looks like a loophole. **It is not a loophole. It is the reason the ruling was given
in that form.**

## ✅ RULING 3, same session: OPTION 2 on a multi-ward referral — AND THE COORDINATOR CAN OVERRIDE EVERY RULE

**His words, direct:** _"option 2. Remember. The coordinator can over ride all rules"_.

### The multi-ward answer

**Offering one patient to several wards where one is unsuitable: THE SUITABLE WARDS PROCEED; THE
UNSUITABLE ONE IS HELD BACK UNLESS A REASON IS GIVEN FOR IT.**

**Rejected, and why, so nobody re-opens it:** refusing the WHOLE referral punishes a four-ward search
for one bad entry, which is how a system teaches people to stop using it. Letting ONE reason wave
through the whole list is too loose — a single justification would cover wards nobody looked at.
**Per-ward refusal keeps the ruling at the level where it means something.**

### ⚠️ THE PRINCIPLE, WHICH IS BIGGER THAN THIS FEATURE

> **The coordinator can override all rules.**

**No eligibility rule is absolute.** The gate exists to CAPTURE THE DECISION, NOT TO PREVENT IT.
⚠️ **Anyone later tempted to make one gate un-overridable — the forensic one is the obvious
candidate — is reversing an explicit owner ruling, not tightening a loose end.**

**The reasoning, recorded so the ruling survives its author:** an override that is refused becomes a
phone call, and the placement then happens outside the system, where nothing is recorded at all.
**A rule that cannot be overridden does not stop the placement. It stops the RECORD of the
placement.**

### ⚠️ The boundary he has NOT ruled on, and it must not be assumed either way

**A judgement rule is not a physical fact.** _"This ward is the wrong cohort"_ is a judgement and is
overridable. _"There is no bed"_ and _"there is no staff for one-to-one care"_ are facts about the
world — and `PULL_PATIENT` **already** hard-refuses on `allocatable` beds and on specialling capacity
with **no override path at all**, today, before any of this work.

**Treat "all rules" as covering the ELIGIBILITY GATES.** ⚠️ **Do not make an existing capacity
refusal overridable as a side effect of implementing this — that is a separate change, it was not
asked for, and it would be discovered later as something nobody decided.** Ask him first.

### ⚠️ Why the literal reading of "all rules" would INVERT the ruling — Ward Lead, and it is the argument to keep

**I flagged the judgement/fact boundary as a limit I would not assume past. Ward Lead ruled it
explicitly and gave the reason, which is stronger than my caution:**

> **If "all rules" were read literally, a coordinator could override _"there is no bed"_ — and the
> system would record a placement into a bed that does not exist. That is not a permissive system,
> it is a FALSE RECORD.**

⚠️ **A false record is the exact harm this whole ruling exists to prevent.** The refusal was made
overridable so the decision would be CAPTURED rather than driven outside the system. **Extending the
override to physical facts would manufacture, inside the system, precisely the untrue record that
keeping decisions inside the system was meant to avoid. The widening would invert the ruling's own
purpose.**

**So: "no reason typed into a form creates a bed."** A judgement rule is overridable; a fact about
the world is not. **Put that sentence in the code comment beside the gate**, not only here — the
person tempted to widen it will be standing there, not reading this file.
