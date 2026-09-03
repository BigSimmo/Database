# Owner rulings — the bed model, 2026-09-01

**These are the answers to the six clinician-check questions.** The owner answered them himself rather
than routing them to two independent clinicians, so they are **his clinical judgement, not two
independent checks** — the independent check remains outstanding and this document does not close it.

Recorded verbatim, because paraphrasing a clinical rule is how it drifts.

---

## 1. There is no such thing as offering a bed. There is waitlisting, and there is pulling.

> **"A ward will waitlist a patient, which means it has accepted their referral. It can reject a
> patient. Or it can pull a patient which means the patient is ready to come to the ward. So the bed is
> available. No patient can be pulled without a bed being confirmed Available/unoccupied. So nothing
> can be offered... referrals can only be added to waitlisting for the ward"**

**Three ward actions on a referral, and only three: WAITLIST (= accept), REJECT, PULL.**

⚠️ **A PULL REQUIRES A CONFIRMED AVAILABLE, UNOCCUPIED BED. It is not a promise; it is a bed that
physically exists right now.**

## 2. The three ways of leaving stand

Discharged, transferred to another psychiatric ward, moved to another hospital — accepted as written.

## 3. A bed is AVAILABLE only when it is ready. Otherwise it is PENDING.

> **"A bed is only marked available once it is ready. Otherwise it is marked pending."**

⚠️ **This contradicts what is built.** `RECORD_LEAVING` currently increments the ward's empty count the
moment the person leaves. Under this ruling a departure makes the bed **pending**, and something else
makes it **available**. See the contradiction list below.

## 4. Whoever holds the ward panel may declare a bed free

> **"To keep things simple... whoever has access to the ward panel for now can declare a bed free. This
> will usually be controlled by the CNS (Clinical nurse specialist running the ward on that day)"**

So the `ward` role is correct as it stands and needs no narrowing. "Usually the CNS" is an operational
fact about who holds the panel, **not a fourth role to model**.

## 5. A promised bed cannot fail to materialise, because no bed is ever promised

> **"This should easily be resolved by the waitlisted feature. A bed cannot be offered unless it is
> actually physically available. A bed is never promised, a patient is only waitlisted for the next bed
> and pulled when a bed is physically available. This is only a rare situation when a patient has been
> pulled but then cancelled"**

**The failure case is not "the promise broke". It is "a pull was cancelled", and it is rare.**

## 6. The sex counts are real, because some beds are sex-restricted

> **"The male and female count is useful because some wards have only male or female only beds."**

The count stands. It is a constraint on which beds a person can occupy, not bookkeeping.

---

## ⚠️ What these rulings contradict in what is already built

**Measured at `f8d896739`, not recalled.** Every item below is a real event or behaviour in the code
today.

1. **`HOLD_BED` and `RELEASE_HOLD` exist as events.** The owner has now said **a bed is never
   promised**. A hold is a promise. **These two events model a thing he says does not happen**, and
   whether they are renamed to a pull, repurposed, or removed is a decision that needs him — removal
   is not mine to assume.
2. **`RECORD_LEAVING` frees the bed immediately.** It increments `empty` the moment a person leaves.
   Ruling 3 says a departed bed is **pending** until it is ready. **The bed becomes available too
   early, so a ward looks like it can take somebody before it can.** That is a wrong number on a
   screen, which is the class the owner has said he cares about.
3. **`SET_BED_PREPARATION` already exists** and carries a `preparationNote`. It is the nearest thing to
   the pending/available distinction and may already be the right mechanism — **but nothing today
   connects a departure to it.**
4. ❌ **I WROTE "THERE IS NO WAITLIST AND NO PULL ANYWHERE IN THE MODEL". THAT IS FALSE.**
   `ward-admissions.ts:61` reads `ADMISSION_STATES = ["waitlisted", "pulled", "occupied", "left"]`.
   **His vocabulary is already the model's vocabulary.** Found by Ward Verifier.

   How I got it wrong: I grepped the EVENT list and concluded from its absence there. The states live
   on the admission, not on an event. **Sixth time in one day I have measured the thing beside the
   thing** — and the shape is identical every time: I search one surface, find nothing, and report
   absence from the whole system.

   So the question is not "does this exist" but **"do the guards match the words"**, which is a much
   narrower and more answerable question.

## What is NOT closed by this

**The two independent clinician checks.** These are the owner's own answers. He is a psychiatrist and
this is his system, but "two people answer independently, without seeing each other's answers" was the
point of that exercise, and one person answering is not that.

---

## ⚠️ Ruling 3 is NOT a display change, and this is the part that matters

Found by Ward Verifier and confirmed independently here at `96019fece`.

`ward-bed-availability.ts` states as a binding rule, with its own rationale, that **nothing is ever
subtracted from `availableNow` for a preparation note** — _"A released bed being made ready (cleaning
…) is still offered and still counted, because pulling the next patient takes hours anyway."_

**Ruling 3 overrules exactly that reasoning, and the person it was standing in for is the one who
overruled it.**

And it is structural, not cosmetic. Confirmed by reading both:

- `availableNow = Math.min(unit.allocatable.value, unit.empty.value)` — reads no preparation field.
- `HOLD_BED` refuses **only** on `unit.allocatable.value <= 0`. No preparation check anywhere in it.

⚠️ **SO TODAY A PATIENT CAN BE PULLED TO A BED THAT IS STILL BEING CLEANED, and ruling 3 forbids
precisely that.** The change is to what `allocatable` may count and therefore to what `HOLD_BED`
permits. **The guard has to live where `HOLD_BED` can see it.**

**The test that would pass on a wrong value here:** "the screen says pending" is satisfied by a label.
The property that matters is that a patient **cannot be pulled to an unready bed**, which is a reducer
refusal. A test asserting the label passes against a build where the refusal was never written.

## Relayed, not direct — confirm before building

Ward Verifier reports the owner also approved adding **three more ways of leaving**: death on the ward,
absconding (distinct from the existing leaving-against-advice), and transfer to police or prison
custody. **I did not receive that from him myself** — his answer to me on question 2 was "Go ahead with
your recommendations", which was answering a question in which I had made none.

**Each of the three is a different clinical and legal event, and whether each counts as a statewide bed
release is his call, not a default.** Do not build them on this relay.

---

## Ruling 5's residue, traced — a cancelled pull is fully recorded and nobody is told

Traced by Ward Verifier at `8caab9d3d`. This closes a gap I had declared open.

**What is recorded, and it is complete.** `RELEASE_HOLD` appends `{ at, kind: "hold_released", by,
reason }` to `movement.unwinds`, returns the bed, and sets the stage back to `accepted_awaiting_bed`.
It deliberately does **not** close the movement or clear the acceptance — **the patient keeps their
place.** Who, when and why are all captured, the reason from a fixed list of four.

**Where it goes, and it is one place.** `movement.unwinds` has exactly one consumer: `changeAudit`
(`ward-derivations.ts:962`), rendered in exactly one place — a governance view at
`ward-management-modes.tsx:867`.

**What the referring emergency department sees: nothing addressed to it.** No alert, no inbox entry,
no flag. The patient's stage silently reverts from bed-held to awaiting-bed.

⚠️ **THE PRECISE DISTINCTION, because "nobody knows" would overstate it.** The stage change is visible
to anyone who re-reads that patient's row. What does not exist is anything that **announces** it — and
the reason the bed went away is not on that screen at all, only in a governance audit the referrer has
no reason to open. **The failure is not concealment. It is that the person waiting has to notice.**

**Why this is the sharp end of ruling 5.** The owner said a bed is never promised, so the broken-promise
case mostly cannot arise — and then named this residue as the one that can. **It is the only path in
the model where something a ward committed to is taken back while a patient is waiting on it, and it is
the one with no notification.**

So the question for him is not "can we record it" — that is answered and answered well. It is
**"should the referring ED be told, and how"**.

---

## ✅ Ruling 1 re-confirmed, against a relay that contradicted it

**A patient cannot be pulled to a bed that is still being cleaned.** Built at `37bc8aca3`,
mutation-proven, and challenged within the hour by a relayed message saying the opposite. Put back to
the owner directly; his answer was **"yes... stay true to this"**.

⚠️ **THE PROCESS POINT IS WORTH MORE THAN THE RULING.** Three of four owner decisions relayed through a
third party today have arrived altered. Every one was passed on in good faith and every one would have
cost real work: an option-3 scope that was actually the full change, a claim that this refusal had teeth
it did not, and this one — a claim it should not exist at all.

**So: a relayed owner decision is a prompt to CONFIRM, never a decision to act on.** Confirming cost one
question. Acting on this one would have cost a revert of a built and proven safeguard, plus whatever had
been layered on top by the time it was noticed.

**Still outstanding from the same relay, and not yet confirmed directly:** that when a pending bed
becomes ready, the receiving ward must tell the sending team it is OK to send. That is a notification
requirement rather than a permission change, so it sits with the other five in the notification work and
contradicts nothing above.

### Closed: he changed his mind, and that outranks a clever reconciliation

The contradiction is settled. The owner: **"to be honest i did change my mind regarding the bed
readiness and the ward lead was right."** The refusal stands.

⚠️ **THE LESSON IS ABOUT HOW THE CONTRADICTION WAS EXPLAINED, NOT ABOUT THE ANSWER.** Two of his
statements conflicted. Ward Verifier built an elaborate reading in which both were true — that "pull"
must mean two moments, allocating a bed and sending a patient, with the notification sitting in the gap.
It was careful, it was marked as a reading rather than a measurement, and it was wrong.

**When a person says two contradictory things, "they changed their mind" outranks "there is a subtle
sense in which both hold".** The interesting explanation was reached for over the ordinary one. It cost
a round trip, and it very nearly cost a revert of a built and proven safeguard.

**What that leaves standing, and it is not nothing:** keeping the guard while the question was open was
right on its own terms — a refusal fails loudly and a permission fails silently — and the notification
requirement that came out of the same exchange survives either way, because it was separated from the
permission question before any of this.

### Closed: he changed his mind, and "pulled" means the bed is allocated

The contradiction is settled. The owner: **"to be honest i did change my mind regarding the bed
readiness and the ward lead was right."** The refusal stands.

**And the word is settled with it. Asked whether "pulled" means the bed is allocated to the patient or
that the patient is on their way, he answered: THE BED IS ALLOCATED TO THEM.**

So there was no vocabulary collision. Pulling _is_ allocation, and allocation is exactly what the guard
refuses against a bed that is not ready. The two answers are consistent.

⚠️ **THE LESSON IS ABOUT HOW THE CONTRADICTION WAS EXPLAINED, NOT THE ANSWER.** An elaborate reading was
built in which both his statements were true — that "pull" must mean two moments, allocating and
sending, with the notification in the gap. Careful, honestly marked as a reading, and wrong.

**When a person says two contradictory things, "they changed their mind" outranks "there is a subtle
sense in which both hold".** The interesting explanation was reached for over the ordinary one, and it
nearly cost a revert of a built and mutation-proven safeguard.

**Two things survive.** Holding the guard while the question was open was right on its own terms — a
refusal fails loudly, a permission fails silently. And the notification requirement from the same
exchange stands either way, because it was separated from the permission question before any of this.

### The two confirm buttons: leave them

Owner, 2026-09-01: **"just leave this for now."** They stay as `aria-disabled` placeholders with a
stated reason. **Do not wire them to an event to "finish" them.**
