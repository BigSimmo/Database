# DOM vacuity audit — batch 3

Read in full, no sampling. 17/17 files read.

## Verdicts

- tests/ward-override-register-render.dom.test.tsx — clean
- tests/ward-patient-page.dom.test.tsx — clean
- tests/ward-patient-search.dom.test.tsx — clean
- tests/ward-person-screen.dom.test.tsx — clean
- tests/ward-provider-initial-now.dom.test.tsx — clean
- tests/ward-pull-vocabulary.dom.test.tsx — clean (see note below; not raised as a finding)
- tests/ward-referral-control-labels.dom.test.tsx — clean
- tests/ward-referral-destinations.dom.test.tsx — clean
- tests/ward-referral-match-hooks-order.dom.test.tsx — clean
- tests/ward-referral-screens.dom.test.tsx — clean (2322 lines, read in full)
- tests/ward-screen.dom.test.tsx — clean
- tests/ward-screen-cancel-unavailable.dom.test.tsx — clean
- tests/ward-screen-fd23-leaks.dom.test.tsx — clean
- tests/ward-shortlist.dom.test.tsx — clean
- tests/ward-sidebar.dom.test.tsx — clean
- tests/ward-tracker-leg-badge.dom.test.tsx — clean
- tests/ward-urgent-flag.dom.test.tsx — clean

## Findings

None meeting the bar (a concrete code change that leaves the test green while breaking the
behaviour it claims to protect).

## Note (not a finding — checked and ruled out)

`ward-pull-vocabulary.dom.test.tsx`, "names nobody accepted, pulled or en route when the unit has
no such patient" (around line 123): the test branches on `queryByText(...)`, and the meaningful
`/held/i` absence check sits only in the `else` (placeholder-found) arm — the `if` arm's assertion
(`toContain("Accepted, pulled or en route here")`) is a heading that renders unconditionally on
every render of this screen, so that arm alone would prove nothing. Traced which arm the fixture
actually takes: `bty-youth` cannot receive a generated (`routineMovements`) accepted/pulled/moving
movement because the generator's cohort is always "Older adult"/"Adult", never "Youth"
(`ward-movements.ts` lines ~800, ~717-724), and no hand-authored seeded movement targets
`bty-youth` either (checked lines 1-693). So the unit is deterministically empty today, the `else`
arm is the one that always runs, and the `/held/i` check is genuinely exercised. Not reported as a
finding because it is not vacuous under the current fixture — flagged here only because the
branch's safety is contingent on that fixture fact rather than structural, so a future change
seeding an accepted movement at `bty-youth` would silently stop exercising the check it guards.

## General observation

This batch is markedly different from the file the brief describes finding the defect in. Every
file here already carries explicit non-vacuity canaries (positive controls, "or this test proves
nothing" guards, fixture-precondition assertions run before the real assertion, `toBeGreaterThan(0)`
floors before loops, absolute counts read from `.length` before relational claims) that appear to
be the product of a prior, deliberate hardening pass against exactly this defect class. No
assertion was found sitting outside the negation/branch it was meant to guard, no `toContain` was
found matching unconditionally-present chrome, and no loop was found iterating a collection whose
non-emptiness was unproven.
