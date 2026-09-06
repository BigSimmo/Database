# Build brief: the contention model

**For:** Ward Builder One. **From:** Ward Lead. **Date:** 2026-09-04.
**Design it serves:** `docs/ward-flow/matching-engine-design-2026-09-04.md` §5, §6 item 1.
**Touches no frozen file.** No rendered copy. Pure model work.

---

## Why this and not something else

**It is the one missing primitive under half two of `R-2026-09-04-G`.** Every function in the
codebase that takes both movements and units iterates the movements **independently**. Nothing
anywhere expresses that offering a bed to one patient removes it from another's options.

**And it retires a frozen question rather than adding one.** Ward Builder One's argument, which is
the reason this is first in the queue:

> The census's §1.1 is stuck with the owner — the network cluster header sums raw `allocatable` while
> the cards beneath show `min(allocatable, empty)`. That question is **unanswerable without a
> contention model and answerable almost immediately with one.** "Nine ready across this service"
> means one thing if those nine beds can each be offered to a different person, and something else
> entirely if offering one removes it from the others'. **The header is not a wording bug. It is a
> missing model showing through.**

The same gap has a second face, already measured: a pull reserves a bed that the arrival guard may
later refuse, and **nothing expresses that the reservation removed that bed from anybody else's
shortlist**. Two coordinators reading two shortlists are each told the same bed is theirs.

---

## What exists, so you build on it rather than beside it

| Thing                                     | Where                                | Note                                                                  |
| ----------------------------------------- | ------------------------------------ | --------------------------------------------------------------------- |
| `eligibility(movement, unit, now)`        | `ward-eligibility.ts:96`             | 10 gates, one movement against one unit                               |
| `referralEligibility(...)`                | `ward-eligibility.ts:261`            | 9 gates, reads exactly one referral field (`ageBand`)                 |
| `shortlistCandidates(movement,units,now)` | `ward-derivations.ts:641`            | every unit, uncapped by design                                        |
| `eligibleCandidatesAmong(...)`            | `ward-derivations.ts:696`            | cohort filter, eligible-first, truncate-then-reorder                  |
| `PARALLEL_REFERRAL_CAP = 3`               | `ward-model.ts:201`                  | how many destinations one referral may be live at                     |
| the reservation/physical split            | `ward-flow-reducer.ts:1280`, `:1621` | `PULL_PATIENT` bounds `allocatable`; `PATIENT_ARRIVED` bounds `empty` |

**Read that last row before writing a line.** A pull is a reservation and an arrival is the physical
act, and the leniency at the reservation is deliberate. A contention model that treats a pull as
consuming a physical bed will contradict a pinned invariant.

---

## The shape

**One pure function. No React, no rendering, no reducer changes in this task.**

```ts
contention(movements: Movement[], units: Unit[], now: Instant): ContentionMap
```

**It must take live `movements` and `units` as parameters.** `tests/ward-flow-single-source.test.ts`
walks the TS parser and refuses any live-unit-taking function that reads the frozen `allUnits()`
fixture internally. Reading the fixture will go red, and that is the gate working.

**What it answers, and nothing more:** for each unit, which movements currently have a claim on its
capacity, what kind of claim, and how much of the unit's capacity is therefore already spoken for.

**Claim kinds, from the existing model rather than invented:**

- an **accepted** movement holding `acceptedUnitId` — the strongest claim
- a **referred** movement listing the unit in `referredUnitIds` — a claim on the same bed that two
  other movements may also hold, because `PARALLEL_REFERRAL_CAP` is 3
- a **pulled** movement — a reservation already consuming `allocatable` but not yet `empty`

**The interesting number is the third, and it is the point of the whole exercise:** a unit with one
allocatable bed and three movements referred to it is not "1 ready" to any of them individually. It
is one bed with three claims.

---

## What it must NOT do

🔴 **It must not rank, score, weight, or order patients.** Nothing in this project ranks a person, it
is enforced by tests, and this function has no business being the exception. It reports claims. Who
should get the bed is the matching design's question and it is not settled.

🔴 **It must not decide anything, resolve any contention, or produce an arrangement.** That is the
next task and it depends on an owner decision (design §3, shapes (a)/(b)/(c)) that has not been made.

**It must not change any existing function's behaviour.** Additive only. If `shortlistCandidates` or
`eligibleCandidatesAmong` should later consume this, that is a separate change with its own review.

---

## Tests

**Write the test first and watch it fail.** Then, for each assertion, mutate the implementation and
confirm the mutation goes red — a guard that has never been seen to fail is not known to be a guard.

Cases that must be covered, because each is a real state in the seeded fixture:

1. A unit with no claims — the empty case, and the control.
2. A unit with one accepted movement.
3. **A unit with three movements referred to it and one allocatable bed** — the case the whole model
   exists for. Assert the claim count, not a verdict.
4. A unit where `allocatable > empty` — the reservation/physical divergence. Assert the model
   distinguishes them and does not collapse to one number.
5. A movement referred to three units — one movement generating three claims. Assert it appears in
   all three and is not double-counted within any one.

⚠️ **Floor the population, not the result.** If you assert "at least N units have contention", that
number breaks when the fixture changes. Assert over the units you walked.

---

## Rules

- **Prettier, `tsc --noEmit`, and `npx eslint <changed files> --max-warnings 0` before you hand it
  over.** An unused import is a warning, and only `--max-warnings 0` catches it. Three CI rounds were
  lost to exactly that today.
- **Commit when it is coherent, not when the task ends.**
- **Tell me the SHA and the branch in the same message.**
- **If you reach a decision this brief does not cover, stop and hand it back.** In particular: if the
  right shape turns out to need a change to an existing signature, or if the fixture cannot express
  one of the five cases, that is mine to rule on and not yours to work around.

---

## Authorised alongside it

**Tighten `ward-flow-reducer.test.ts:1067`.** It asserts `rejection.reason.includes("no_bed")`, and
`"no_bed"` is also a `DECLINE_REASONS` value, so the assertion can pass on an unrelated refusal that
merely mentions it. Assert the full sentence. Prove the tightening by mutating the rejection message
and watching it go red — and check the loose form would have passed that same mutation, which is what
makes the change worth making.

**Add one comment at each `allocatable_bed` site** — `ward-eligibility.ts:202` and `:397` — naming
`ward-flow-reducer.ts:1621` as the guard that makes the leniency safe. A comment, not a test: a test
would re-pin what `ward-flow-reducer.test.ts:1030-1069` already pins. The hazard is that a future
tidy-up hoisting the empty check earlier "for symmetry" would look like a strengthening and would
break accept-in-principle.

⚠️ **Point at the guard, do not describe it.** A comment that restates what line 1621 does decays the
day 1621 changes; a comment that names it as the reason survives.
