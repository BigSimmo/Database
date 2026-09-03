# Owner rulings, 2026-09-02 — four decisions, all four approved as recommended

**The owner said: _"Yes to all recommendations."_** Each question was put to him with a single
recommendation and the reasoning for it; he approved all four. ⚠️ **Recorded here with HIS decision
separated from MY reading of what it implies, because two of these change a safety rule and one of
them will turn a guard red on purpose.**

## Ruling 1 — the fixture keeps the record of what was once possible

**A test fixture placed an older-adult patient in an adult secure ward — clinically impossible, and
reachable only because nothing checked. Ward Builder Two corrected it. Ward Verifier argued the
correction destroys the evidence that it was ever reachable.**

**APPROVED: take Ward Verifier's version.** Leave the patient where they are and assert the
placement is now REFUSED. ⚠️ **The fixture then documents both the old hole and the new guard, and
goes red again if the guard is ever weakened.** A corrected fixture proves nothing; a refused one
proves the gate works.

**Whose:** `tests/ward-specialling-capacity.test.ts` is Ward Builder Two's. Not mine to change.

## Ruling 2 — a stale bed count must be refusable

**Today `capacity_freshness` is never consulted on the placement path at all — proven with a
no-reason control dispatch, so it is not "an override bypasses it", the gate is unread.**

**APPROVED: the system should refuse on a stale bed count, and a recorded reason should get past
it.** ⚠️ _"I have just rung the ward and they have confirmed the bed"_ **is exactly a named person
taking responsibility for a fact, which is what an override reason IS.**

## Ruling 3 — what reason 3 means, and it is the narrow reading

**`OVERRIDE_REASONS` already contains _"The bed information is known to be out of date"_. It has two
readings and they build different systems.**

**APPROVED: the FIRST reading — the COUNT IS STALE, trust me over it.** It answers
`capacity_freshness`. ⚠️ **It does NOT mean "the ward looks full but is not", which would let a
recorded reason past `allocatable_bed` — the owner's own red line. No reason typed into a form
creates a bed.**

### ⚠️ MY READING, FLAGGED AS MINE, AND IT CHANGES A GUARD I BUILT

**Rulings 2 and 3 together move `capacity_freshness` from the unbypassable set into the overridable
one. That is a real change to `SUITABILITY_GATES`, and it will turn
`tests/ward-referral-reducer.test.ts`'s disjointness guard RED.**

⚠️ **THAT RED IS THE DESIGN WORKING, NOT A REGRESSION.** The guard exists to force exactly this
moment: is this gate a judgement someone may override, or a fact they may not? **The owner has now
answered it, so the guard's expectation changes and the answer is recorded beside it.** The guard
must be updated WITH the ruling cited — never silenced, and never widened to "physical gates can be
overridden", which remains false for `allocatable_bed` and `specialling`.

**Until this lands, reason 3 remains a dead option: unusable at the front door, where every
non-suitability gate is unbypassable, and unusable on the placement path, where staleness is never
checked.**

## Ruling 4 — a referral must carry the patient's legal status

**Today a referral carries only `involuntaryBedNeeded`, a tick-box filled in by whoever writes the
referral, and the model's own comment says it is "never a legal determination". So a referral for a
legally detained person whose form says "no" is accepted onto a ward not authorised to hold them,
and nothing objects — the front door never sees a legal status.**

**APPROVED: a referral should carry the person's actual legal status.**

⚠️ **NOT A MISSING CHECK — MISSING INFORMATION. The check exists and has nothing true to read.**

**Verified 2026-09-02 after the owner ruled yes on a referral remembering its patient: a `Patient`
record holds `id`, `umrn`, `givenName`, `familyName`, `dateOfBirth` and NOTHING ELSE.** ⚠️ **So the
patient link does NOT supply this by itself — following it reaches a record with no legal status on
it either.** Both are needed, and this ruling is not satisfied by that work.

## What each ruling costs, so nobody assumes one is free

| Ruling | Where the work is                                               | Whose              |
| ------ | --------------------------------------------------------------- | ------------------ |
| 1      | `tests/ward-specialling-capacity.test.ts`                       | Ward Builder Two   |
| 2 + 3  | `SUITABILITY_GATES`, the placement path, the disjointness guard | Ward Builder Three |
| 4      | the `Referral` model and the intake form                        | to be assigned     |

---

# 🔴 THE RESTRICTION ON RULING 4, WRITTEN DOWN BECAUSE IT EXISTED ONLY IN A CHAT MESSAGE

⚠️ **Ward Builder Two REFUSED TO BUILD against this until it was in a document, and it was right.** Its
words: _"the safety-bearing half of that widening currently exists only in a chat message between two
agents. If either of us is replaced, what survives is the permission without the limit."_

**It searched this document for the restriction and did not find it. Control: the same search DOES
find ruling 4's approval text at line 63 — so the search worked and the absence was real.**

## THE RESTRICTION

> ⚠️ **`legalStatus` GOES ON THE WARD ARM OF THE DESTINATION UNION ONLY. NEVER ON THE COMMON FACTS.**

**It sits beside `sex`, `secureBedNeeded` and `involuntaryBedNeeded` on the ward destination.** **It
must NOT sit beside `ageBand`, `homeRegion` and `suburb`, which every destination receives.**

⚠️ **WHY, AND IT IS THE ENTIRE REASON THE RULING IS ACCEPTABLE: a referral goes to several places at
once. A WARD is the only destination whose AUTHORITY TO HOLD SOMEBODY depends on their legal status.
A community team or an emergency department that receives the same referral — and may decline it —
has no need of that fact and must not be given it.** **Put on the common facts, a person's legal
status would travel to every service the referral touched, including the ones that said no.**

## ⚠️ THE PROVENANCE, STATED EXACTLY, BECAUSE THE DIFFERENCE MATTERS

**The owner's words were _"Yes to your recommendations."_** **The recommendation he approved was
written as _"Yes — with one restriction"_, and the restriction was the ward-arm limit, in the same
sentence.** ⚠️ **SO THE LIMIT IS PART OF WHAT HE APPROVED, NOT A GLOSS ADDED AFTERWARDS — but the
WORDS are Ward Lead's and the DECISION is his.** **Recorded this way rather than as "the owner ruled
ward-arm-only", because he approved a recommendation containing it and did not type it.**

**And the argument he was given, so a later reader can weigh it rather than inherit it:** the referral
already carries `involuntaryBedNeeded`, a tick-box filled in by whoever wrote the referral and checked
against nothing. **That is already a statement about somebody's legal situation, just an unverified
one.** **Carrying the actual status replaces a guess with a fact rather than disclosing something new.**

## 🔴 AND THE FIELD IS NOT BUILDABLE YET — measured, with a control

**`Patient` carries no `legalStatus`.** Measured by Ward Builder Three; the control confirmed
`legalStatus` exists in `ward-model.ts`, so the search discriminates.

⚠️ **SO ADDING THE FIELD TODAY WOULD PUT A FIELD WITH NO PRODUCER ONTO THE TYPE WHOSE GUARD WAS JUST
WIDENED — the worst available outcome of this ruling, and the exact defect class this project has a
name for.** **Where that fact actually lives must be established before the field is added, not after.**

## The other thing Two blocked on, and it was a measurement error rather than a missing document

### ⚠️ CORRECTION TO THE PARAGRAPH BELOW — MY OWN CITATION WAS WRONG, INSIDE A CORRECTION OF SOMEBODY ELSE

**I told Ward Builder Two the cohort gate landed at `9af85a10b`. It did not. That is Three's
STALENESS work, which moved `capacity_freshness` into the overridable list.** ⚠️ **The commit that
wired the cohort refusal into `PULL_PATIENT`, `ACCEPT_IN_PRINCIPLE` and `REFER_TO_UNITS` is
`fcb8af1daa` — established by Two, verified against its own tree with a control, and its commit
message even names the fixture in question.**

**So the paragraph below correctly refutes Two's measurement while carrying a wrong SHA of my own.**
⚠️ **A correction containing its own error is worse than the error it corrects, because it arrives
with the authority of a fix — which this project already has a note about.** **Both stand: the
refusal exists on the pull path, and I named the wrong commit for it.**

**It reported that `9af85a10b` added no cohort refusal and that `SUITABILITY_GATES` appears 0 times in
the `PULL_PATIENT` block — concluding no refusal exists on the pull path.**

⚠️ **THE REFUSAL EXISTS. `PULL_PATIENT` calls `eligibilityRefusal(...)` at `ward-flow-reducer.ts:1278`,
and that function consults `SUITABILITY_GATES` INSIDE ITSELF rather than inline in the case block.**
**All four call sites, measured: `RECORD_MEDICAL_CLEARANCE`, `REFER_TO_UNITS`, `ACCEPT_IN_PRINCIPLE`,
`PULL_PATIENT`.**

**Its control was sound and its search was honest — it measured for the constant's NAME where the
enforcement is by CALL.** ⚠️ **The unit trap again: a search for the mechanism's name cannot find a
mechanism reached through a function.** **So `WF-SP-B` CAN be written as a refusal.**

---

# 🔴 STOP. THE LEGAL-STATUS FIELD IS UNBUILDABLE AS RULED. Nothing could ever write it.

**Established by Ward Builder Two with a mandatory control — the search proved it could find the
field on `Movement` before reporting it absent anywhere else.**

## Where the fact actually lives

```
Movement.legalStatus     ward-model.ts:555      REQUIRED, not optional
  written by REAL USER ACTIONS, not seeded:
    ED intake form   -> ReferralDraft.legalStatus
    RAISE_REFERRAL   -> copies it onto the movement    ward-flow-reducer.ts:835
    CHANGE_LEGAL_STATUS -> amends it, from two live forms (ED, coordinator shortlist)
                           and it operates on a movementId
```

## Where it does not

- **`Patient` — NO.** Its whole field list is `id, umrn, givenName, familyName, dateOfBirth`,
  **pinned twice**: the type, and a runtime `PATIENT_FIELDS` guard.
- **`Referral` — NO**, and `RECEIVE_REFERRAL`, the only event that constructs one, has no
  legal-status field in its payload.

## ⚠️ SO IF THE WARD ARM GAINED THE FIELD, WHAT COULD FILL IT? NOTHING.

**Not the intake form** — its data flows to the Movement, via a different event, in a different
reducer branch. **Not `CHANGE_LEGAL_STATUS`** — hard-wired to a `movementId`, with no referral-scoped
equivalent. **Not `Referral.patientId`** — that pointer resolves to a `Patient`, and `Patient` has
nothing to read.

⚠️ **THAT IS EXACTLY THE FIELD-WITH-NO-PRODUCER OUTCOME THE BRIEF SAID IT WOULD RATHER SHIP NOTHING
THAN.** **It would pass every gate, render as a legitimate blank, and read to a clinician as _"nobody
has said"_ when the truth is _"nothing can ever say"_.**

## ⚠️ THE RULING WAS SOUND AND THE QUESTION WAS WRONG

**He was asked whether a referral should carry the patient's legal status, and he said yes for a good
reason: the involuntary-bed tick-box is an assertion by the referrer, checked against nothing, so a
legally detained person can be accepted onto a ward not authorised to hold them.** **That safety gap
is real and is not closed by this finding.**

**But the fact he wants on the ward arm ALREADY EXISTS — on the Movement, entered by a clinician,
amendable with a recorded reason.** ⚠️ **THE GAP IS NOT A MISSING FIELD. IT IS THAT A REFERRAL HAS NO
PATH TO A MOVEMENT.**

## The real choice, and it is his because it is bigger than the ruling contemplated

**(a) Add a legal-status control to the referral form.** ⚠️ **A clinician then states it TWICE and the
two can disagree** — and a record with two answers to one question is worse than one with none.

**(b) JOIN the ward arm to the movement that already carries it, and DISPLAY it rather than store a
second copy.** ⚠️ **RECOMMENDED.** **It is the only option consistent with his own one-place-per-fact
rule, and it is what `PD-1` already does for identity: one home, pointers everywhere else.**

**Recorded before anything was built, which is the whole point. Nobody has written a line of this.**
