# PARKED: the referral-join figures are true and unreadable, and deciding needs the seed's author

**Parked 2026-09-06 by Ward Builder One, on Ward Lead's ruling.** Not a defect anybody has
established, not a thing to chase, and deliberately not fixed. **Do not "tidy" this without reading
the second half — the obvious fix is a one-sentence change and the question underneath it is not.**

Measured on `claude/ward-builder-community-route` at `9e0184006`, rendering
`/mockups/ward-flow/statistics` against the seeded fixture.

## What the page shows

Under **"From a referral being raised to a bed being taken"**, three numbers, each correct and each
carrying its own population:

    1 of 1 matched pair could carry a duration at all
    Matched from 267 admissions carrying a referral id, against 13 referrals on record

**Nothing there is false.** Every figure is computed on the render, each is labelled with what it
was measured over, and the paragraph above them is careful to explain that a matching id does not
establish that two records are the two ends of one wait.

## Why it is still worth somebody's attention

**A reader cannot get from those three numbers to what happened.** The page states the two
denominators — 267 admissions carrying a referral id, 13 referrals on record — and then reports on
"1 matched pair", without ever saying that exactly one of the 267 matched. So the reader is left to
infer that 266 admissions carry a referral id pointing at no referral this prototype holds.

That inference may be completely wrong, which is the whole reason this is parked rather than filed.

## The two readings, and neither has been established

1. **A seed artefact.** Referrals may be consumed, closed or aged out once an admission exists, so
   admissions would legitimately retain historical referral ids that no longer resolve against the
   13 currently on record. On that reading nothing is wrong anywhere and the page is merely terse.
2. **A finding.** If referral ids on admissions are meant to resolve, then 266 of 267 dangling is a
   fixture defect, and the referral-to-bed derivation is being exercised against essentially no
   data — which would make every conclusion drawn from it so far thin.

**I do not know which, and I did not investigate**, because telling them apart means knowing what the
seed's author intended the referral lifecycle to be. That is not readable from the derivation.

## What the honest fix probably is — and what it does NOT settle

The page should state **how many of the 267 matched**, not only the two denominators it was drawn
from. That is one sentence, and it makes the page readable whichever reading is true.

⚠️ **But shipping that sentence would publish the number 1 against 267 on a clinical prototype**, and
if reading 2 is the right one, that is a fixture defect being rendered as a finding. So the sentence
and the investigation are not separable, and the sentence is the smaller half.

## Standing instruction

**Park it. Do not chase it, and do not fix it silently.** When somebody who knows the seed's
referral lifecycle is available, ask them which reading holds; then the wording follows in a minute.

Related: `docs/ward-flow/` statistics notes, and
`src/components/ward-management/statistics/statistics-screen.tsx` — the paragraph is the one whose
`data-testid` is `ward-statistics-referral-join-absent`, with the counts immediately below it.
