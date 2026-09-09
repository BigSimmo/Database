# Two functions answer the same question, and nothing compares them

**Two live clinical defects were found on 2026-09-01, hours apart, by different agents looking for
different things. They have one cause, and it is structural rather than careless.**

`src/components/ward-management/ward-eligibility.ts` holds two verdict functions:

- `eligibility(movement, unit, now)` — can this patient go to this bed?
- `referralEligibility(referral, unit, …)` — can this referral be sent to this bed?

**They answer nearly the same clinical question about the same `Unit`, and they were written
separately.** Each accumulated gates the other lacked.

| Gate                                        | Movement path | Referral path | Found                        |
| ------------------------------------------- | ------------- | ------------- | ---------------------------- |
| `sex_designation` — a women-only ward       | **absent**    | present       | first, merged at `f2abfba77` |
| `forensic` — never offered as a destination | **absent**    | present       | second, same night           |

Measured, not inferred: before the fix, the movement path returned `eligible: true` for the
network's forensic bed for **18 of the 35 seeded Adult movements**, at the same instant the referral
path refused that same bed unconditionally.

## ⚠️ The gate needed no information the movement path lacked

This is what makes it a defect rather than a deliberate asymmetry, and it is worth checking first
whenever this shape appears. The `forensic` gate reads exactly one thing — `unit.forensic` — and
`eligibility()` receives the identical `Unit` object. **There was never a reason it could not be on
both paths.** Had the gate genuinely depended on something only a referral carries, the divergence
would have been a design decision to document rather than a defect to close.

## Why the tests could not catch it, which is the more useful half

`tests/ward-eligibility.test.ts` builds units through a factory that **hardcoded `forensic: false`**.

**So no test in that file could construct a forensic unit at all.** Every forensic assertion in the
codebase therefore lives in the referral test files, where a forensic unit CAN be built — and the
property looked thoroughly covered while the movement path was never asked about it once.

**A field pinned to a constant in a test factory is a property those tests are structurally
incapable of failing on.** Nothing is skipped. Nothing is red. Coverage looks fine. It is the same
family as the vacuous guards catalogued in `traps/silent-transforms.md`: a mechanism producing a
plausible output in place of a check that never ran.

## ⚠️ The harm was a false display, and saying so precisely matters

Neither defect could place a patient in a wrong bed. Both the Refer and Override controls gate on
shortlist rows, and the reducer's accept path uses `referralEligibility`, which was correct
throughout.

**What a coordinator saw was a forensic bed with nine green ticks reading "Met"** — reachable in one
click, because the flow diagram renders every unit in the network as selectable and the shortlist
panel deliberately honours an off-shortlist selection. The screen said yes; the referral screen said
no; both were describing the same bed at the same moment.

**Overstating this as "the app would have admitted someone to a forensic bed" would have been
wrong**, and three claims had already been overstated and corrected that night. The real finding is
serious enough without inflation: **a clinician was shown a confident all-green verdict that the
system itself disagreed with.**

There was also a latent second consequence, silent today. `escalationBoard`'s `nowhereEligible`
counts eligible units across the whole network, so a forensic bed inflated that count. No open
movement was eligible _only_ there, so the board was unaffected — **one capacity change elsewhere
would have turned that into a patient with nowhere to go being omitted from the escalation board.**

## What to do about the shape, not the two instances

Fixing both gates closes today's defects and does nothing about the next one. Two candidate
remedies, and they are not equivalent:

1. **Parameterise the test factories**, so any field can be varied. Necessary, but it only enables a
   test somebody still has to think to write.
2. **Compare the two paths' gate sets directly**, so a gate present on one and absent on the other
   fails a test by construction. This catches the next divergence without anyone anticipating it.

**The second is the one that would have caught both of tonight's.** It is blocked on a type: today
`GateResult.gate` is a bare `string`, so nothing can enumerate what the gates ARE. Narrowing it is
the enabling change, and it is also what makes the coordinator screen's `GATE_LABELS` exhaustive —
one type fixing a clinical check and a rendering defect at once.

⚠️ **Until that lands, every gate added to one path is a coin flip.** The `sex_designation` gate was
merged at `f2abfba77` and immediately rendered on the coordinator screen as the raw string
`sex_designation`, because `GATE_LABELS` still listed eight entries and falls back to the identifier
rather than failing. **The fix for a missing check introduced a visible defect within the hour**, in
a file the fixer did not open — which is the same lesson one level up.

## A possible third instance, deliberately NOT called a defect yet

A later sweep, running the real functions rather than reading them, found the same _shape_ a third
time — and it is being held open rather than fixed:

- `eligibility()`'s `sex_mix` and `allocatable_bed` gates read `unit.allocatable.value` **alone**.
- `referralEligibility()` reads `availableNow = Math.min(allocatable.value, empty.value)`, and
  carries a comment calling that a bug fix "applied here where it was left behind", because
  `allocatable` can go stale-high relative to `empty` after arrivals.
- Probed: a unit with `allocatable: 3, empty: 1` — one bed physically free — **passes
  `allocatable_bed` on the movement path and returns `eligible: true`.**
- No `Unit` factory in the suite ever sets `allocatable > empty` on the movement path, so the
  combination is never exercised. Same blindness mechanism as the forensic gap.

⚠️ **It is not being changed, and the reason is worth stating.** Unlike the forensic gate — where the
check reads one boolean and there was demonstrably no reason it could not exist on both paths — the
two functions may legitimately mean different things by "a bed is available". A movement that has
already been pulled may stand in a different relationship to a physically empty bed than a fresh
referral does. **A wrong change to a capacity check is a clinical change**, and the finding was
explicitly reported at lower confidence than the other two.

**And the word "left behind" is a comment, not evidence.** It is one author's phrasing about their
own intent. This project has twice this week been caught treating a comment as a statement of what
the code does; the same care applies to treating one as a statement of what the code was _meant_ to
do. What would settle it is whether any other call site still reads `allocatable` alone, and how many
seeded movements change verdict if the movement path adopted the minimum — both being measured.

**The general point this third instance makes better than the first two:** the shape is worth a
permanent check precisely because finding instances by hand does not converge. Three were found in
one night by three different people looking for three different things, and the only reason the
count is three rather than higher is that nobody has finished looking.

### The third instance, measured — and it needs a ruling, not a fix

Investigated read-only rather than changed. Three things came back, and together they move it out of
the defect column and into the owner's:

**1. The comment names its own history.** `ward-eligibility.ts:312–314` reads: _"`availableNow`, not
`unit.allocatable.value` alone — the same C2 correction fix round B made to `allocatable_bed`,
applied here where it was left behind (fix round C, F3 / review finding I4)."_ It names a round, a
review finding and a sibling gate — but no commit and no date.

**2. There IS a deliberate precedent for reading `allocatable` alone, and it undercuts the easy
reading.** `ward-flow-reducer.ts:903`, inside `PULL_PATIENT`, reads `allocatable` alone **on
purpose**, and its comment cites an owner ruling dated 2026-09-01: `availableNow` was considered and
deliberately rejected there, because `allocatable` is _"the ward's own claim about what it can
staff"_. Every other availability read in the codebase uses the minimum.

⚠️ **So the two functions may be asking genuinely different questions.** `eligibility()` feeds
`eligibleCandidatesAmong()`, documented as _"a shortlist of candidates, never a destination — a unit
appearing here has not been referred or accepted"_. A shortlist that reflects what a ward says it can
staff is defensible; so is one that reflects beds physically free. **That is a clinical policy
choice, not a bug.**

**3. The measured impact today is exactly zero.** Only one of the 23 seeded units ever has
`allocatable > empty` (`gry-older-adult`, scarce scenario only, 1 vs 0). Switching both gates to the
minimum and re-running all 43 open movements across both scenarios changes **no verdict at all** —
every movement already fails a different gate at that unit. **It is a dormant divergence.**

**Conclusion, and it differs from the other two on purpose.** The forensic gate was fixed within the
hour because the check read one boolean and there was demonstrably no reason it could not exist on
both paths. This one is left alone and put to the owner, because a precedent exists for exactly the
opposite reading and the cost of waiting is measurably zero. **The evidence that would settle it is
narrow and worth naming: a dated statement about the SHORTLIST gates specifically — the reducer
already has one for the pull-refusal gate, and nobody has ever written the equivalent for these.**

⚠️ **Note what nearly happened.** "Left behind" is an inviting phrase, the shape matched two defects
found the same night, and the fix is one line. All three pushed toward changing it. **The thing that
stopped it was measuring the impact and finding a contrary owner ruling forty lines away in another
file** — neither of which the phrase itself would ever have prompted.
