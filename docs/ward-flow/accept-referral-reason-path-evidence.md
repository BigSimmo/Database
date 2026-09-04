# The front door could not say yes — evidence, 2026-09-02

**Commits `4cdb95e67` (the change) and `e77760fbf` (the harness fix).** Measured, not recalled.

## What was wrong, verified here rather than relayed

Ward Builder Two reported it (`b307d6d40`). ⚠️ **I read the code myself before building, because a
relayed finding arrives already believed** — and its line numbers (`events.ts:586-604`,
`reducer.ts:2231-2239`) do not match mine (`613`, `2384`). **Not a contradiction: its tree is
different from mine. The finding is correct; the coordinates are per-tree and must not be quoted
across chats.**

```
ACCEPT_REFERRAL event fields          : role, now, referralId, destinationKind, unitId?  — NO reason field
the refusal                           : reducer.ts:2385  if (!verdict.eligible) -> reject on FIRST failing gate
CONTROL, overrideReason where it exists: ward-flow-events.ts:146, 166, 174 (the three placement events)
gates referralEligibility runs        : age, legal_status, sex_designation, forensic, security,
                                        sex_mix, specialling, capacity_freshness, allocatable_bed
```

**Six of those nine are judgements about the patient. Three are facts about the world.** The old
code could not tell them apart, because one `if` rejected on whichever failed first.

⚠️ **THE TWO PLACEMENT PATHS HELD OPPOSITE POLICIES.** The coordinator's path checked no judgement
gate at all; the front door hard-refused on every one. **So a referral that every ward failed on a
single judgement gate could not be accepted by anybody, with any reason, ever — while the same
patient could be placed anywhere by a coordinator without being asked a thing.**

## The rule now held at both ends

**A judgement ABOUT THE PATIENT is overridable by a named human recording why. A fact ABOUT THE
WORLD is not.** The owner's words: _no reason typed into a form creates a bed._

⚠️ **Fail-closed by construction: a gate is overridable ONLY by appearing in `SUITABILITY_GATES`.**
Everything else refuses — including a gate someone adds to `referralEligibility` later without ever
reading this file. **The default for an unclassified gate is "no reason gets past this".**

## Proof — five mutations, each ATTRIBUTED to one test

⚠️ **A red is not attribution.** Every mutation below was run separately, and the failing test was
read by NAME, not counted. Control first, because a mutation run against a dirty baseline proves
nothing.

```
CONTROL (committed tree)                                    failed=0  passed=47

M1 removed "Record an override reason to accept anyway"     failed=1  -> "names the way through..."
M2 recorded reason no longer admits                         failed=1  -> "admits the SAME acceptance..."
M3 removed the OVERRIDE_REASONS membership check            failed=1  -> "refuses a reason that is not one..."
M4 moved the unbypassable check AFTER the reason            failed=1  -> "lets NO recorded reason past a physical gate..."
M5 filed an override where nothing was overridden           failed=1  -> "does not file an override..."

restored from HEAD; git diff --stat -> (clean)
```

**M4 is the one that matters.** It converts my new function into the same early-return shape as
`eligibilityRefusal`, and the physical-gate test goes red — **so the ordering is load-bearing, not
decorative.** ⚠️ **`eligibilityRefusal` still has that shape.** It is safe there ONLY because every
gate it can refuse on is a judgement; **widen `SUITABILITY_GATES` and a typed reason silently buys
past a physical fact with nothing going red.** That is pinned in a comment at the early return.

## Two things this change deliberately does NOT do

**It does not file an override that overrode nothing.** A reason offered against a ward that turns
out eligible is discarded. ⚠️ **A record saying a clinical rule was bent, on an acceptance where
none was, is a false entry in the one place anyone would later go looking for the real ones.**

**It does not touch the three production callers of `referralEligibility`**
(`referral-destination-options.ts:272`, `ward-board-derivations.ts:127`, `ward-referrals.ts:312`).
**None passes an override reason; all three read the verdict for display.** The override lives in
the reducer's decision to ACT, never in what the eligibility function returns.

## ⚠️ Still open, and it is the owner's call

**The screen cannot yet offer the reason** — Ward Builder Two holds `referral-match.tsx` and is
building it. **Until that lands, the engine accepts a reason nobody can type.** The refusal names
the way through, so the state is honest rather than silent, but it is not finished.
