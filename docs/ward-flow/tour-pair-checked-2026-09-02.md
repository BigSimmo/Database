# The paused tour is NOT broken-in-waiting — but it is protected by an omission, not by a match

**Checked at `claude/ward-builder-three` because the tour dispatches a HARDCODED pair and would break
on the day someone un-pauses it, months after the change that caused it, attributed to the un-pausing.**

## The pair

```
morning-tour.tsx:29   TOUR_UNIT_ID     = "scgh-adult-open"
morning-tour.tsx:40   TOUR_MOVEMENT_ID = "WF-901"
```

⚠️ **`WF-901` IS NOT IN THE SEED. It does not exist in `ward-movements.ts` or anywhere else** — it is
the reducer's own output of the tour's first two beats. `RESET_SCENARIO` sets `referralSequence: 0`;
`RAISE_REFERRAL` computes `sequence = 1` and `nextReferralId(1)` builds `WF-9` + `01`. **Deterministic,
real, and unpointable-at: a grep for `WF-901` in the seed returns nothing, which is why it looks absent
and is not.**

Its fields come verbatim from the tour's own draft: `cohort: "Adult"`, `security: "Open"`,
`sex: "Female"`, `specialling: false`, `legalStatus: "Voluntary"`, `legalForm: undefined`.

## ✅ The verdict: it passes

`scgh-adult-open` is `cohort "Adult"`, `security "Open"`, `authorised true`,
`sexDesignation "Undesignated"`, `forensic false`, `sexMix.Female 10`.

**Every gate the code path evaluates passes:** authorisation, cohort, forensic, security,
sex_designation, sex_mix. **The tour's scripted step is not refused under the new engine.**

**The control discriminates:** the same method on `WF-001` (Female) against `fsh-adult-secure`
(Male only) correctly reports **sex_designation FAIL** — the historical defect that gate was added for.
**So the all-pass verdict is not a non-discriminating method returning green.**

## ⚠️ But "passes all eight" would be a false statement, and the difference is load-bearing

**`SUITABILITY_GATES` names EIGHT gates. `eligibility()` emits SIX.** `age` and `legal_status` are
**never evaluated on this path at all** — they are referral-path questions answered by
`referralEligibility()`, per `ward-eligibility.ts:30-34`.

⚠️ **They are neither pass nor fail. They are absent from the question.**

**So the tour is protected by an OMISSION — two gates never asked — rather than by a genuine match on
every axis.** ⚠️ **A change that starts routing movements through `referralEligibility()` too, or that
adds `age`/`legal_status` to `eligibility()`, flips this without anyone touching `morning-tour.tsx`.**

## ⚠️ And the mismatch is itself worth someone's attention

**`SUITABILITY_GATES` is the union of what EITHER path can emit, not a guarantee that both paths ask
everything.** Two of its eight members are unreachable on the movement path.

⚠️ **That bears directly on the disjointness guard: a guard that reasons over `SUITABILITY_GATES` is
reasoning over a set two of whose members one path never produces.** It is not wrong, but it is looser
than it reads — **and "this gate is in the protected set" does not imply "this gate is ever asked".**

## ⚠️ AND WARD BUILDER THREE SHARPENED IT INTO SOMETHING WORSE THAN A BROKEN TOUR

**I framed the risk as "a future change flips the tour's safety". That understates it.**

⚠️ **`age` IS ALREADY A MEMBER of `SUITABILITY_GATES`, and `eligibilityRefusal` selects failed gates by
MEMBERSHIP in that set. So the day anyone adds `age` to `eligibility()`, it becomes OVERRIDABLE ON THE
MOVEMENT PATH — immediately, with no decision taken and nothing going red.**

**A clinical rule becomes bendable by a dropdown as a side effect of being added to that path.** The tour
is merely one of the things that moves. ⚠️ **The set has a member with no producer on this path, and the
moment it gets one, it is already permitted.**

### ⚠️ CORRECTION — `age` AND `legal_status` ARE IMPLEMENTED. They are enforced on the OTHER path.

**An earlier phrasing here said "as a side effect of implementing it", which reads as unbuilt. Measured
at `claude/ward-builder-three`, `ward-eligibility.ts`, by emitted gate name and line:**

```
eligibility()          declared :96    emits :105-201  authorisation cohort security sex_designation
                                                       forensic sex_mix specialling prior_decline
                                                       capacity_freshness allocatable_bed
referralEligibility()  declared :261   emits :289-396  ⚠️ age :289   ⚠️ legal_status :306
                                                       sex_designation forensic security sex_mix
                                                       specialling capacity_freshness allocatable_bed
```

⚠️ **SO THEY ARE ENFORCED AT THE FRONT DOOR AND NOT ON THE PLACEMENT PATH. That is a different and more
interesting fact than "not built yet": a patient's age suitability and legal status are checked when a
referral is ACCEPTED, and not checked when a patient is PULLED into a bed.**

**The tour's verdict is unchanged — it is still safe. But it is protected by a PATH ASYMMETRY, not by an
unwritten feature**, and a document saying otherwise would send the next reader looking for work that
already exists somewhere else.

### ✅ ANSWERED — THE ASYMMETRY IS NOMINAL. NOTHING IS MISSING. And the feared consequence INVERTS.

**I put it to Ward Builder Three as a question and the answer is neither of the two options I offered.
Both concepts ARE enforced on both paths, under different names, because a `Movement` and a `Referral`
store the same fact under different field names. Verified independently here:**

```
does the unit suit this person's age band?
  placement   cohort         pass: unit.cohort === movement.cohort
  front door  age            pass: unit.cohort === referral.ageBand

may this unit hold someone involuntarily?
  placement   authorisation  requiresAuthorisedDestination(movement.legalStatus) -> unit.authorised
  front door  legal_status   ward.involuntaryBedNeeded                           -> unit.authorised
```

⚠️ **SAME UNIT FIELD, SAME QUESTION, DIFFERENTLY-SHAPED SUBJECT. `SUITABILITY_GATES` CARRIES EIGHT NAMES
FOR SIX CONCEPTS** — which is exactly why **three of us independently read "the placement path is missing
two gates" off that list and all three were wrong.** **It is not that nobody wrote it down. The list
itself asserts a distinction that does not exist.**

### ⚠️ AND THE HAZARD IS THE OPPOSITE OF THE ONE I FEARED

**I worried that implementing the "missing" gates would hand a clinician a dropdown bending a
legal-status rule — close to what the owner explicitly ruled out.**

⚠️ **THE REAL RISK IS A DUPLICATE, AND IT IS MUCH QUIETER. Adding `age` to `eligibility()` asks
`cohort`'s question a SECOND TIME — and it arrives overridable, because `age` is already in the set.**
**So the hazard is not an unguarded rule; it is the same rule asked twice under two names, one of which
can be waved through.** ⚠️ **A reviewer looking for a MISSING check would not see that at all.**

**The mapping is recorded at the assertion that fires when somebody acts on it, not in a document — so
the person who trips the red reads it at the moment they need it.**

### ⚠️ ONE THING NOT CLOSED, AND IT IS ABOUT DATA RATHER THAN GATES

**The two paths derive the same requirement from DIFFERENT SOURCES.** Placement asks the person's own
`legalStatus`; the front door asks what the referral **REQUESTED** (`involuntaryBedNeeded`).

⚠️ **THOSE CAN DISAGREE. A referral that fails to request an involuntary bed for a detained patient
would let the front door accept an unauthorised unit for someone who legally needs an authorised one.**

**Not chased, deliberately, and the reason is good practice rather than caution: Ward Builder Three
wants to measure whether the seed can actually produce that disagreement before putting it to the owner
— having already sent him one question tonight built on a premise that turned out wrong.** **A candidate
for his list, not yet on it.**

**Measured at runtime rather than parsed, by Ward Builder Three, and pinned at `4d289a277`:**

```
eligibility()          asks  authorisation cohort security sex_designation forensic sex_mix
                             specialling prior_decline capacity_freshness allocatable_bed   (10)
referralEligibility()  asks  age legal_status sex_designation forensic security sex_mix …    (9)
SUITABILITY_GATES            8 — of which age and legal_status are NEVER asked on a movement
```

⚠️ **The two absences get their OWN assertions rather than sitting implicit in a list of ten, because a
reader scanning an array does not notice what is missing from it — which is how this survived.** Plus a
length floor, since `not.toContain` is satisfied by an empty array.

**Adding or removing a gate on either side now turns that test red — which is the moment to decide
whether the new gate is a judgement someone may override or a fact they may not.**

## What this changes

**Nothing today. The tour is safe and the un-pausing will not break it.** The value is that this is now
**recorded beside the pause instead of discovered in six months**, that the protection is correctly
described as an omission rather than banked as a match, **and that the larger hazard the check exposed —
a gate that is pre-authorised for override before anyone has written it — is now pinned rather than
latent.**
