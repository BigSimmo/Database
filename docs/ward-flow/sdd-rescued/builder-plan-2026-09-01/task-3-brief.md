## Task 3 — Mark the FD-23 projections DO NOT DELETE

**Why.** `ward-referral-visibility.ts` exports `wardScopedReferral`, `wardScopedReferrals`,
`coordinatorScopedReferral` and `coordinatorScopedReferrals`, and **every caller is a test.** No
production file imports the module — legitimately, because `Referral` carries no patient link so a
ward-facing screen could not show referrals even if it wanted to.

The boundary is enforced by a static contract test that tells the next author to route through those
functions. **Delete them and that test names a function which does not exist, and the FD-23
protection evaporates at the moment somebody finally builds a ward-facing referral surface.**

This repository has already walked back a sweep seven times for exactly this shape.

**Steps.** A comment at the top of the module: zero production importers is expected, why, what
breaks if they are removed, and `npm run check:dead-code-candidate` before removing any exported
symbol. Documentation only — change no code.

**Check.** Typecheck clean; no behaviour changed.
