# Statistics screen — fix round 1 findings

All four verified by the controller against COMMITTED state (`git show HEAD:<path>`), not the working
tree, because another agent was mutating these files at the time.

## CRITICAL 1 — the withheld statistic is invisible on the page

The refusal to compute declines-per-ward is CORRECT and stays. But its reasoning lives only in a
JSDoc block in `statistics-screen.tsx` that no reader of the page will ever open. On screen there is
simply nothing where the owner's first-named statistic should be.

**The harm is an asymmetry a reader cannot detect.** `Movement.declines` IS seeded non-empty
(`ward-movements.ts:294`, `:572`), so a coordinator who knows this prototype records declines, and
sees no decline figure, cannot distinguish _withheld pending a ruling_ from _not recorded_ from
_nobody declined_. The page's entire safety property is that an absence explains itself — it honours
that twice and skips it on the item the owner named first.

**Fix:** a third `.absence` block in the system section, saying the measurement is withheld because
the model holds declines in two places that mean different things, naming both, and saying an owner
ruling decides which. **No number is invented by saying so.**

## CRITICAL 2 — a live wrong statement: a free bed is labelled an expected one

`statistics-screen.tsx:130` renders, verbatim from HEAD:

    {preparingCount === 1 ? "expected bed is" : "expected beds are"} currently marked as being made ready.

`expected` is not loose prose. It is a member of `BED_RELEASE_STATES = ["expected", "confirmed",
"discharged"]` (`ward-model.ts:547`). And a preparing bed is NEVER an expected one:

- `ward-flow-reducer.ts:1135` — _"A bed nobody has yet left is not being made ready. Preparation only
  ever begins after `RELEASE_BED`."_
- the only `preparing: true` record in the seed carries `state: "discharged"` (`ward-movements.ts:956, :961`).

So the page tells a coordinator an anticipated discharge is being prepared — i.e. the bed is not yet
available — when the truth is the opposite: **it is available now.** That inverts a capacity fact,
which is the same defect class as a wrong number. The COUNT is right; the word is wrong.

**Fix:** drop the word, or match `ward-screen.tsx`'s own wording — "N beds are currently marked as
being made ready."

**Secondary, same site:** `bedsBeingPrepared` (`statistics-derivations.ts:233`) applies no state
filter, and `SET_BED_PREPARATION` has no state guard in the reducer. The count is correct by
construction today, not by contract. Add the filter or state the assumption in a comment.

## IMPORTANT 3 — the same measurement already exists, computed by a different rule

`src/components/ward-management/ward-statistics.ts` defines `averageEmptyBedMinutes`, documented as
_"`pulledAt` -> `arrivedAt`, averaged in minutes"_ — the same measurement as the new `pullToArrival`
(`statistics-derivations.ts:160-196`). The existing one clamps: `Math.max(0, arrivedAt - pulledAt)`.
The new one has **no clamp and no chronology guard**, so the two disagree on negative gaps.

⚠️ **`ward-statistics.ts` IS OFF LIMITS — it is a top-level file that exists on Ward Lead's branch.
Do not edit it.** Fix inside `statistics/` only.

Two things make this worse than ordinary duplication: the new module **cites that exact file twice**
as its precedent for the null-not-zero discipline while diverging silently on the other rule; and it
contradicts itself, because `referralToBedJoin` carries a chronology guard for precisely this reason
and `pullToArrival` does not.

**Fix:** decide the rule for a negative gap and apply it deliberately in `pullToArrival`, with a
comment naming `averageEmptyBedMinutes`, the difference, and why. A negative pull→arrival means the
record is incoherent, not that the wait was zero — clamping to 0 would publish an incoherent record
as a real measurement of no wait. Add a test that exercises a negative gap; none does today.

## IMPORTANT 4 — the disclaimer that matters most is the first thing hidden on a phone

`statistics.module.css` has **zero `@media` blocks**. Measured: `community.module.css` has 1,
`ed.module.css` has 2; 17 of 18 ward modules reserve `--spacing-ward-phone-bar`.
`ward-sidebar.module.css:261-278` documents the contract — the rail's phone bar is
`position: fixed; top: 0; height: var(--spacing-ward-phone-bar)` (3.5rem) and _"each shell reserves
the `--spacing-ward-phone-bar` in its own phone media query."_

Below 40rem the top 56px sits under the fixed bar — and the top 56px is the `.governanceBanner`,
i.e. **"These are not real figures."** jsdom, `tsc` and eslint are all blind to this.

## MINOR — deferred, not in this round

- A fractional mean renders as `4h 0.5m` (`splitDuration` does not round). Hidden today only because
  the seed's pull-to-arrival gap is a constant.
- The join label says "arrived no earlier than the referral was raised" but the computation also
  excludes `arrivedAt === null`. Nothing is misstated on today's seed.
- Two dead token fallbacks disagree with the real token values (`--text-lg`, `--text-sm`).
- No denominator beside the average, so a reader cannot tell if it covers most admissions or a few.

---

# Mutation survivors — from an independent adversarial check, added to this round

An independent agent applied 12 mutations. Nine were caught. **Three survived, and one of them
matters this hour.** All files restored byte-for-byte, SHA-256 verified.

## SURVIVOR A (highest value) — the in-flight rename can half-land and the suite says nothing

Mutation: rename `"left"` to `"departed"` in `ADMISSION_STATES` and in the seed factory, but leave
`admissionStagePosition`'s `case "left"` untouched. **All 32 tests passed.**

**Why the suite is blind:** the only member-driven check walks `ADMISSION_STATES` and compares
`admissionStagePosition(state)` against `EXPECTED[state]`. After the rename the switch falls through
and returns `undefined`, and `EXPECTED["departed"]` is ALSO `undefined` — so the assertion compares
`undefined` to `undefined` and passes. Every other admission-state test hard-codes the literal
`state: "left"` in its fixture, which still hits the stale case. The type error that should catch
this is real, but **vitest runs no `tsc`**, so the suite alone cannot see it.

**What it would cost, and this is live:** seeded departed admissions carry both `pulledAt` and
`arrivedAt`, so they would stay in the average but stop counting as ended. The page would render
_"Historical, not a picture of tonight: **0** of the measured admissions have since ended"_ —
inverting the one caveat that stops a historical figure being read as tonight's ward.
**Another session is performing this exact rename now.**

**Fix:** (1) a `default:` arm or `satisfies never` exhaustiveness throw in `admissionStagePosition`,
so a missed member fails loudly at runtime instead of returning `undefined`; (2) one live-world
assertion on `ward-statistics-arrival-ended-count` against a non-zero literal — today it is only
pinned on a hand-built two-record fixture.

## SURVIVOR B — the referral→bed figure can be moved to the wrong audience section undetected

The whole figure can be relocated under "How the system is performing" and nothing fails. Only
`pull-to-arrival` and `bed-readiness` carry placement assertions; `ward-statistics-referral-to-bed`
has none. **Two-audience separation is the brief's own falsifier and it is unasserted for this
figure.**

## SURVIVOR C — shortest and longest can be swapped in the rendered range

The test does `toContain` on both values against the whole sentence rather than checking which label
carries which. The seeded world has zero spread, so it would not show in the app either.

## FRAGILE, not a survivor — a live check that passed by luck

The live-world assertion on the join figure is `toContain("0")` against a full sentence. Mutation 12
failed only because the substituted value was `267`, which happens to contain no zero — `260`, `100`
or `30` would all have passed. `chronologicallyCoherentCount` is the only figure on the page with no
`data-testid` of its own. **Fix:** give it one and assert equality, not containment.

Three testids are never referenced by any test: `ward-statistics-governance` (the "these are not
real figures" banner), `ward-statistics-join-population`, `ward-statistics-referral-to-bed`.
