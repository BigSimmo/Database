# Task — the two decline figures, separately labelled

**Follow-on to the statistics screen.** The screen currently renders NOTHING for declines, because the
brief that preceded it was wrong: it claimed a referral decline is attributable to a named ward. It is
not. Ward Lead has now ruled on what to build instead.

## Why the original was refused, and why that was right

    ward-model.ts:781-789      a `psychiatric_ward` ReferralDestination carries { kind, sex,
                               secureBedNeeded, involuntaryBedNeeded } — REQUIREMENTS, and NO unit
    ward-flow-events.ts:533    DECLINE_REFERRAL carries `referralId` + `destinationKind`, not a unitId
    ward-model.ts:490          Movement.declines is `Decline[]` — `{ unitId, at, reason }`, a
                               DIFFERENT event about a patient already inside a department

Two decline concepts exist. Only one names a ward. Choosing between them decides what a published
number MEANS, which is why the previous implementer stopped rather than guessing.

## Ward Lead's ruling — (c), both, separately labelled

⚠️ **THE LABELS ARE THE DELIVERABLE HERE, NOT THE COUNTS.** Two decline numbers on one page that mean
different things, without labels that say so, is worse than one number. **If the distinction cannot be
made to land in a phrase a reader understands at a glance, hand the task back rather than shipping two
numbers a reader will average in their head.** That instruction is from Ward Lead and it is binding.

### Figure A — referral declines. Belongs in the SYSTEM section (policy-maker question).

Source: `Referral.destinations[]` → `ReferralAddressing` where `state === "declined"`.
Group by **destination kind** and by **`declineReason`**.
⚠️ **State plainly, on the page, that this CANNOT be attributed to a named ward** — the record names
the kind of bed sought, not which ward said no. An unstated limitation on this page is a false claim.

### Figure B — movement declines. Belongs in the PATIENT section (clinician question).

Source: `Movement.declines[]` → `{ unitId, at, reason }`. This one DOES name a ward.
Resolve unit names from the live `units` array, never from a literal.
⚠️ It answers "which named ward refused this specific patient, once they were already in a
department" — a different question from Figure A, about a different point in the journey.

## Rules

- **NEVER invent, estimate or interpolate a figure.** Every number must derive from provider state.
- **A count of zero is a real answer** and must render distinctly from "cannot be measured".
- **Every read of an admission state VALUE stays behind the existing single named function** in
  `statistics-derivations.ts`. `"left"` is being renamed to `"departed"` by another chat.
- **Do not read a movement STAGE.** `bed_held` is being renamed to `pulled` and `HOLD_BED` to
  `PULL_PATIENT` by another chat. `Movement.declines` is safe; `Movement.stage` is not.
- Design tokens, never hex. Tap targets `min-h-12`. Every `<button>` does something.
- Commit as you go. NEVER `git add -A`. Never a bare `git stash`.

## Files — yours, all existing

    src/components/ward-management/statistics/statistics-derivations.ts
    src/components/ward-management/statistics/statistics-screen.tsx
    src/components/ward-management/statistics/statistics.module.css   (only if genuinely needed)
    tests/ward-statistics-derivations.test.ts
    tests/ward-statistics.dom.test.tsx

**DO NOT TOUCH** `tests/ward-nav.test.ts`, `tests/ward-landmarks.test.ts`, `ward-nav.ts`, or any
top-level `src/components/ward-management/*.ts`.

## Check

    npx tsc -p tsconfig.typecheck.json --noEmit --tsBuildInfoFile /tmp/tsc-declines.tsbuildinfo
    npx vitest run tests/ward-statistics.dom.test.tsx tests/ward-statistics-derivations.test.ts

## Falsifier

The two figures rendered without labels that distinguish what they measure; Figure A implying ward
attribution; a zero count rendering as unavailable; any number not derived from provider state; a
unit name taken from a literal rather than the live `units` array; or a test whose expected value is
computed with the implementation's own expression.
