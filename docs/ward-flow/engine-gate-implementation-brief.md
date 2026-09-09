# Implementation brief: the engine refuses unless a reason is recorded

**For whoever builds the owner's ruling of 2026-09-02** — _"the engine should refuse, screen checks
are not enough"_, then _"refuse unless a reason is recorded"_. Committed rather than kept in a
scratch note, because the builder may not be the chat that prepared it.

⚠️ **Read the file before applying any of this.** These facts were gathered while Ward Builder Two
was actively writing in `ward-flow-reducer.ts`, `ward-flow-events.ts` and `ward-model.ts`, adding a
`RECORD_MEDICAL_CLEARANCE` event, `Movement.referredAt` and a three-state medical-clearance field.
**Every line number below will have moved.** They are here to say what to look for, not where.

## The behaviour, in four rows

| Case                                      | Required                             |
| ----------------------------------------- | ------------------------------------ |
| Ineligible unit, no override reason       | **REFUSED**, naming the failing gate |
| Ineligible unit, valid override reason    | **PLACED, and the reason recorded**  |
| Eligible unit                             | unchanged                            |
| Override reason not in `OVERRIDE_REASONS` | refused, by membership               |

⚠️ **Row two is the ruling.** It will read to a later maintainer as a loophole worth closing. **It is
not — an override that is refused becomes a phone call, and the placement then happens outside the
record entirely.** Put that sentence in the code comment, not only here.

## ⚠️ The structural surprise: the three events are NOT the same shape

**Two of them are easy and one is not.**

- **`ACCEPT_IN_PRINCIPLE`** — `movement` and a guaranteed-non-null `acceptedUnit` are both resolved
  and null-checked before the block does its work. **A gate drops in directly after that check.**
- **`PULL_PATIENT`** — same: `movement` and `unit` resolved and checked, then three further guards
  (`allocatable`, pending preparation, specialling). **A gate drops in after the null check.**
- ⚠️ **`REFER_TO_UNITS` HAS NO RESOLVED UNIT AT ALL.** It takes `unitIds: string[]`, and the
  existence check calls `findUnit(...)` inside a `.find()` callback **and discards the result**.
  **There is no single `unit` object to gate on.** A gate here must walk the ids, evaluate each, and
  decide what to do when _some_ are ineligible — which is a design question the ruling does not
  answer. **Do not paste the two-line version from the other events into this one.**

**The open question `REFER_TO_UNITS` raises, which needs the owner or Ward Lead:** referring to four
wards where one is ineligible — is that refused entirely, refused for that one unit, or permitted
with the override covering the mismatched one? ⚠️ **The existing override record already stores
`unitIds: [...event.unitIds]` — the whole list — which suggests an override covers the referral, not
a single ward.** That is evidence, not an answer.

## The pattern to copy, which already exists in this file

**`ACCEPT_REFERRAL` does exactly this for the referral flow.** Copy its shape rather than inventing
one: take the verdict, find the first failing gate, and reject naming **both** the gate identifier
and its human-readable detail. It is the only place in the reducer that names a failing gate in a
rejection, and it is the right precedent.

**Recording an override** is likewise already solved: `REFER_TO_UNITS` appends
`{ at, by: <role label>, reason, unitIds }` onto `Movement.overrides` — appended, never replaced.
**Validation is by MEMBERSHIP against `OVERRIDE_REASONS`, never truthiness, never a trimmed string.**
The comment beside it explains why, and that reasoning applies unchanged to the two new sites.

## What has to change

1. **`ward-flow-events.ts`** — `overrideReason?: OverrideReason` exists on `REFER_TO_UNITS` only.
   **`ACCEPT_IN_PRINCIPLE` and `PULL_PATIENT` cannot express an override at all**, so the ruling
   cannot be implemented for them until the field is added to both.
2. **`ward-flow-reducer.ts`** — import `eligibility` (the movement-level gate). The file currently
   imports only `referralEligibility`; `eligibility()` appears in its comments and is never called.
3. **The gate itself** in each of the three blocks, after the point where movement and unit are both
   resolved.

⚠️ **`ward-eligibility.ts` IS A PROTECTED SURFACE AND IS NOT TOUCHED.** This work is about CALLING
the gate. If you find yourself wanting to change what it decides, stop and hand it back.

## Proving it — and the trap that will otherwise fool you

**A red is not attribution.** `PULL_PATIENT` **already** refuses on specialling capacity, and the
original forensic demonstration fails on **both** the forensic gate and specialling. ⚠️ **So a
refusal there proves nothing about the new gate.** It nearly closed this finding falsely once
already.

**Prove it on a pair whose ONLY failing gate is `cohort`.** 709 such pairs exist in the seed.
**`WF-001` into `rph-older-adult` is the reference case**: today it walks all three steps with zero
rejections and creates `AD-ARR-01`. **After the change it must be refused naming the gate — and the
same walk carrying a valid override reason must still succeed and record it.**

⚠️ **Enumerate the existing tests that dispatch those three events at ineligible units BEFORE
changing anything.** They will start failing, legitimately, and without that list beforehand a wave
of new reds cannot be told apart from a mistake in the change.

---

## ⚠️ THE BLAST RADIUS, MEASURED BEFORE THE CHANGE — this is not a small edit

**Measured read-only by a subagent across all 151 ward test files (93 `.test.ts` + 58 `.dom.test.tsx`,
counted from disk, with a fabricated glob returning 0 as the control).** **18 test files dispatch one
of the three events for real.** ⚠️ **Enumerated BEFORE the change on purpose: once the gate lands,
tests will go red legitimately, and without this list a wave of new reds cannot be told apart from a
mistake in the change.**

### ⚠️ One test's entire PURPOSE is the premise this change removes

**`tests/ward-screen-eligibility-warning.dom.test.tsx`** — it imports `eligibility()`, asserts that
`WF-009` against `brm-adult-secure` fails the **forensic** and **specialling** gates, and then
dispatches `REFER_TO_UNITS` and `ACCEPT_IN_PRINCIPLE` at exactly that unit **with no override
reason**. Its own docstring states the premise:

> _"…so a ward can accept — and pull — a movement `eligibility()` would refuse outright… This warning
> is INFORMATION, never a gate… the warning changes what the ward is told, never what its buttons
> do."_

⚠️ **That test is not broken by the change; it is REFUTED by it.** It cannot be "fixed" — somebody
must decide what it should now assert. **That is a judgement call and it belongs with the owner's
ruling, not with whoever is editing the reducer at the time.**

### Three more shapes, each failing differently

- **`ward-override-register.test.ts:139-149`** dispatches `REFER_TO_UNITS` at `rph-adult-secure`
  **with no override reason** and asserts `expect(after.rejections).toEqual([])`. The movement is
  chosen **by stage alone**, never for compatibility. ⚠️ **Structurally exposed by design.**
- **`ward-legal-figure-guard.test.ts`** sweeps the **full cross product of every movement × every
  unit**, and carries a coverage assertion that each of the three events must be **accepted at least
  once per legal-form code**. It survives individual mismatches by taking the first acceptance — but
  whether an eligible pair still exists for every code after the gate lands **could not be
  determined without running it, and was reported UNKNOWN rather than guessed.**
- ⚠️ **The `toHaveLength(1)` family.** Nine tests already assert a rejection for a NON-eligibility
  reason — parallel cap, wrong role, withdrawn referral, `bed_pulled_for_earlier_referral`, bed not
  prepared, wrong stage. **If the new gate fires EARLIER on the same dispatch, these flip from "one
  expected reason" to "wrong reason" or "unexpected count" — a different failure signature from a
  plain new refusal, and one that looks like a bug in the change.** Guard ordering matters and must
  be chosen deliberately.

### ⚠️ And two committed comments become FALSE the moment this lands

**`ward-legal-figure-guard.test.ts:920-923`** states in prose that _"Neither `REFER_TO_UNITS`,
`ACCEPT_IN_PRINCIPLE` nor `PULL_PATIENT` gate on cohort, security or sex — that eligibility scoring
lives in the protected `ward-eligibility.ts`, a UI-facing concern the reducer itself never
consults"_, and uses that as its justification for picking any unit with spare capacity. **A
comment that justifies a test's construction, and which the change makes untrue.**
**`ward-specialling-capacity.test.ts:74-76` says the opposite** — that `ACCEPT_IN_PRINCIPLE` has
"own eligibility checks". ⚠️ **The two comments already contradict each other today**, which nobody
had noticed, and the subagent flagged the tension rather than resolving it.

**Both must be corrected in the same change. A comment that lies about a safety gate is worse than
no comment**, and these two will be read by whoever next wonders whether the reducer checks anything.

---

## ⚠️ THE CONSEQUENCE NOBODY HAS FLAGGED: A NEW REFUSAL NEEDS A SCREEN THAT KNOWS ABOUT IT

**This change adds a refusal reason to three events. The reducer's own comment says what happens
when a screen dispatches without knowing a refusal exists — and it says it because IT ALREADY
HAPPENED ONCE:**

> _"…exported so a UI surface can pre-check referability and gate its own control before dispatching
> — **never optimistically claim a referral happened and let this be the thing that silently refuses
> it** (Task 5 fix round 1: `ShortlistPanel` used to dispatch and unconditionally render success, so
> a movement at, say, `pulled` … showed 'Referred by a human coordinator' while nothing had
> happened)."_

**That was fixed by exporting `REFERRABLE_MOVEMENT_STAGES` so the screen and the reducer could not
drift apart.** ⚠️ **The new eligibility refusal has no such shared constant and no such pre-check on
two of the three surfaces.**

### Where it bites, and where it does not

- **The coordinator's shortlist DOES already know.** It calls `eligibility()` directly and gates its
  own Refer button, with Override as a separate deliberate act. **That surface is safe.**
- ⚠️ **THE WARD'S OWN SURFACE DOES NOT.** `ACCEPT_IN_PRINCIPLE` and `PULL_PATIENT` are the ward
  saying yes and the ward taking the bed. **Ward Verifier already established that this is "a
  different surface with no screen advising anything"** — which is why the owner got it as a separate
  question. **After this change a ward presses Accept, the reducer refuses, and unless that screen
  pre-checks, the ward is told it worked.**
- **`morning-tour.tsx` dispatches `ACCEPT_IN_PRINCIPLE` directly** with fixed ids. If that pair stops
  being eligible, **the tour silently stops working** — a demo that no longer demonstrates.

### What this means for the definition of done

⚠️ **"The engine refuses" is NOT the whole job.** A refusal a screen does not anticipate is a worse
user experience than no refusal at all: **before, the placement happened and was wrong; after, the
ward believes it happened and it did not.** **The second is harder to notice and harder to unpick,
because the ward has moved on.**

**The smallest honest completion:** the reducer refuses AND every surface that dispatches those three
events either pre-checks the same gate or renders the rejection it got back. **The shared-constant
pattern already in this file is the precedent — the screen and the reducer must not be able to drift
apart.**

**This is not a reason to delay the ruling.** It is a reason the change is bigger than the reducer,
and it should be known before anyone calls it done.

---

## ⚠️ DESIGN CONSTRAINT FOR ALLOCATION B2, found while checking for a point-5 violation

**The owner's rule: no destination may ever be completely blocked. I went looking for existing
violations on the ward screen. THERE IS A HARD BLOCK THERE — and it is NOT a violation. Checked, not
assumed, and stated as clearly as a violation would be.**

`pullBlockedReason` disables the Pull button with `aria-disabled` + `ignoreUnavailableActivation` +
a `title`, with no reasoned path through. It blocks on exactly two things:

```
movement.acceptedUnitId !== unit.id     -> accepted at a different unit
unit.allocatable.value <= 0             -> no allocatable bed remains
```

⚠️ **Both are WORLD gates, not suitability gates.** _"This bed was accepted somewhere else"_ and
_"there is no bed"_ are facts, and **no reason typed into a form creates a bed.** The owner's ruling
is that a clinical DESTINATION must not be blocked on a clinical JUDGEMENT; it is not a claim that
reality is negotiable. **So this block stands and I have not touched it.**

### ⚠️ BUT IT IS THE TRAP B2 WILL WALK INTO

**That pattern — `aria-disabled` + inert handler + `title` — is the house idiom for an unavailable
control, and it is the obvious thing to reach for when adding an eligibility check to a screen.**
⚠️ **Adding eligibility to `pullBlockedReason` WOULD violate point 5**, silently and while looking
exactly like the surrounding code. **It would make an unsuitable ward unselectable regardless of
reason — the precise thing the owner ruled against, arriving as consistency with local style.**

**So B2's shape is constrained before it starts:**

1. ⚠️ **The button STAYS PRESSABLE for an eligibility failure.** Never `aria-disabled`, never inert.
2. **The refusal is read by DIFFING `rejections` across the dispatch** — `dispatch` returns void by
   construction, so _"render what the reducer returned"_ describes a mechanism that does not exist.
   **The house idiom already exists in two files** (`morning-tour.tsx:265`, `ed-screen.tsx:729`) and
   B2 copies it rather than inventing one.
3. ⚠️ **`ward-screen.tsx` does not destructure `rejections` at all**, so it is not that it ignores
   the answer — **it is structurally unable to see it.** That is B1's job to change.
4. **The reason vocabulary is `OVERRIDE_REASONS` and nothing else.** Five owner-approved entries;
   `ward-change-reasons.ts` carries the standing rule that richer reasons come from the product
   owner and no agent adds one.

⚠️ **AND THE TRAP FOR A REVIEWER, which is worse than the trap for a builder:** the file contains a
real gate (`referralAnswerBlocked`, `pullBlockedReason`) and a display-only warning
(`eligibilityWarning`) side by side. **Somebody asking "is this dispatch gated?" finds a gate and
stops.** The gate is real and it answers a different question. **That is harder to catch than an
absent gate would have been.**
