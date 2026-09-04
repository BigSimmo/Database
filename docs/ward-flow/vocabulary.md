# Ward Flow vocabulary — every fixed list in the model

**Measured at `8caab9d3d`.** Every list below is read from the code, not recalled. Written for the
owner on 2026-09-01, before changing the bed-readiness rule, because he asked to see the vocabulary
before any of it moved.

**How to read the marks.** ⚙️ **BEHAVIOURAL** — the app makes decisions on this value, so changing it
changes what happens. 🏷️ **LABEL** — wording only; the owner replaces these freely and nothing breaks.

---

## 1. A person's journey — `MOVEMENT_STAGES` ⚙️

`placement_requested` → `destination_review` → `accepted_awaiting_bed` → `bed_held` →
`handover_ready` → `moving` → `arrived`

⚠️ **`bed_held` is the stage the owner's ruling calls into question.** He said _"a bed is never
promised"_. Whether this stage becomes "pulled" or disappears is his decision, not an implementer's.

## 2. A person in a bed — `ADMISSION_STATES` ⚙️

`waitlisted` → `pulled` → `occupied` → `left`

**This is already exactly the owner's own vocabulary**, and predates his ruling. The work is making the
guards match the words, not inventing the words.

## 3. Referrals

- **State** ⚙️ — `queued`, `accepted`, `declined`. Derived from the destinations, never stored twice.
- **Per-destination state** ⚙️ — `queued`, `accepted`, `declined`, `cancelled`.
- **Where it can be addressed** ⚙️ — `psychiatric_ward`, `emergency_department`, `community_team`.
- **Why it was raised** ⚙️ — `bed`, `psychiatric_review`, `medical_assessment`.
- **Who raised it** ⚙️ — `community`, `crisis_service`, `police`, `ambulance`, `inter_hospital`.
- **Urgency** ⚙️ — `1`, `2`, `3`. Tier leads the queue; longest wait breaks the tie.
- **Cap** ⚙️ — at most **3** units referred to at once, so referring does not spam every ward.

**Two different decline lists exist, and they are not interchangeable.**

_A unit declining a movement_ — `no_bed`, `sex_mix`, `specialling_unavailable`, `acuity_mix`,
`capability_mismatch`, `bed_held_for_earlier_referral`, `out_of_catchment`.

_A destination declining a referral_ — `no_suitable_bed`, `age_band_not_provided_here`,
`sex_designation_unavailable`, `secure_bed_unavailable`, `belongs_to_another_service`,
`referred_elsewhere`.

## 4. A bed — three different numbers, and the difference matters ⚙️

- **`beds`** — how many the ward physically has.
- **`empty`** — how many are physically unoccupied.
- **`allocatable`** — how many the ward SAYS it can fill. The ward's own claim, which may be fewer
  than `empty` for staffing, acuity or sex-mix reasons.
- **`availableNow`** = the **smaller** of `allocatable` and `empty`.
- **`held`** = `empty` − `availableNow`. Physically free but not offered.

⚠️ **`availableNow` reads NO readiness information at all.** That is the defect: see §8.

- **Sex mix** ⚙️ — a count of `Female` / `Male` currently in the ward.
- **Sex designation** ⚙️ — `Undesignated`, `Female only`, `Male only`. **This is why the counts
  matter**, as the owner said: some beds are restricted.

## 5. A bed becoming free — `BED_RELEASE_STATES` ⚙️

`expected` → `confirmed` → `discharged`

**Bands for when** ⚙️ — `now`, `by-midday`, `by-1600`, `tonight`, `tomorrow`.

**What it is waiting on** 🏷️ — Awaiting ward round · Awaiting family or carer agreement · Awaiting
accommodation · Awaiting community team acceptance · Nothing outstanding.

**What blocks a ready bed** 🏷️ — Awaiting clean · Awaiting pharmacy · Awaiting placement confirmation ·
Awaiting service coordination.

**Preparation notes** 🏷️ — Being cleaned · Awaiting maintenance or repair.

⚠️ **A bed release carries NOTHING about the departing patient** — no id, no timing that could identify
them, not even sex. That is a privacy decision with tests pinning it. Do not add a field to it.

## 6. Leaving a ward — `LeavingDestination` ⚙️

`discharged-to-the-community` · `transferred-to-another-psychiatric-ward` ·
`transferred-to-a-general-hospital` · `moved-to-residential-care` · `left-against-advice`

⚠️ **Each carries `countsAsStatewideRelease`, and it is `false` for exactly one:** a transfer to
another psychiatric ward frees the sending ward's bed and gives the state nothing, because the person
still occupies a psychiatric bed. **That flag is the reason this is a list and not a string.**

## 7. A pull that was cancelled — `PULL_RELEASE_REASONS` 🏷️

Clinical condition changed · Transport unavailable · Placed elsewhere · Admission declined ·
Pulled in error

**This already exists**, and it is exactly the rare case the owner named in ruling 5.

## 8. ⚠️ The defect this vocabulary was gathered to fix

`HOLD_BED` refuses **only** when `allocatable.value <= 0`. It never looks at a preparation note.
`availableNow = min(allocatable, empty)` and reads no readiness field either — and
`ward-bed-availability.ts` says so deliberately, reasoning that a bed being cleaned is still worth
counting because pulling the next patient takes hours anyway.

**The owner has overruled that reasoning.** A bed is available only once it is ready; otherwise it is
pending.

**So the fix must live where the pull is permitted, not on a screen.** A test asserting a screen says
"pending" passes against a build where the refusal was never written.

## 9. Roles ⚙️

`coordinator`, `ed`, `ward`, `officer`, `community`, `demo`.

**No `cns` role.** The owner ruled that whoever holds the ward panel may declare a bed free, usually
the CNS — that is an operational control, not a modelled one.

## 10. Other fixed lists

- **Health services** 🏷️ — North Metro, South Metro, East Metro, WACHS, Private.
- **Cohorts** ⚙️ — Adult, Older adult, Youth.
- **Security** ⚙️ — Open, Secure.
- **Transport providers** 🏷️ — Ambulance service, Patient transport service, Ward escort.
- **Follow-up** ⚙️ — `arranged`, `not_arranged`. **There is deliberately no "not recorded"** — that is
  `null` on the field, because "nobody asserted anything" is not a fact anyone establishes.
