# Community hub elapsed time — report

**Status:** Done. Commit `cfca5f432` on `claude/ward-builder-community-route`.

## Gate

- `npx tsc -p tsconfig.typecheck.json --noEmit` — clean, no output.
- Discovered test list (6 files, refusal threshold was 5): `ward-community-corrected-claims.test.ts`,
  `ward-community-hub.dom.test.tsx`, `ward-community-hub.test.ts`, `ward-community-index.dom.test.tsx`,
  `ward-community-index.test.ts`, `ward-community-referral-survives.test.ts`.
- `npx vitest run <those 6 files>` — **RAN 84, PASSED 84** (6/6 files passed), before and after the
  red-proof revert.

## The two wordings chosen

- `leftAt` (always past): `"Left this ward {N days|N weeks} ago"`, e.g. "Left this ward 5 weeks ago".
  One direction only, matching the field's shape.
- `expectedDischargeAt` (past or future): `"Expected discharge in {N days|N weeks}"` for a plan still
  ahead, `"Expected discharge was {N days|N weeks} ago"` for one that has passed. The overdue
  direction reads as past tense ("was … ago"), never a negative number, and never spends the literal
  word "overdue" — that word names a follow-up-contact threshold this screen still doesn't have, and
  an existing test (`"shows no threshold, no overdue and no invented interval"`) still forbids it
  page-wide. Both directions round through one new helper, `community-elapsed.ts`'s
  `elapsedDaysPhrase`, floor-based (same discipline as `daysInBed`): under 7 days shows days, 7+ shows
  whole weeks. Pinned on both sides of the boundary (6 vs 7 days, 34 vs 35 days).

## Tripwires

9 assertions across the two test files pinned the retired wording (matches the recon's count: 4 in
the DOM describe block that rendered the two rows, 5 in the corrected-claims describe block). All 9
fired red when the wording changed and were rewritten — none deleted without a replacement guarantee:

- DOM block "no date is rendered" → renamed to "elapsed time is rendered, never a calendar date or
  clock face"; still forbids `HH:MM` and "yesterday"/"tomorrow", now asserts the elapsed wording is
  present and the retired wording is absent.
- corrected-claims block "still withhold the dates" → renamed to "no longer withhold the dates —
  they state elapsed time instead"; asserts the retired phrases (`"No row above says when somebody
left"`, `"The date itself is not shown"`, `"open question for the product owner"`) are now absent,
  and the new footnote sentences are present.
- Two `data-testid`s renamed (`ward-community-expected-caveat` → `-expected-elapsed`,
  `ward-community-departure-dates-absent` → `-departure-elapsed`) since "dates absent" was no longer
  true; both referencing spots (2 test files) updated.

## Red-proof

Mutated `elapsedDaysPhrase` in `community-elapsed.ts` to always return whole days (never convert to
weeks), ran the new week-rounding boundary tests. Both failed as expected:

```
FAIL  tests/ward-community-hub.dom.test.tsx > … > does not cross into a further week until that whole day has completed
AssertionError: expected 'unit-under-testLeft this ward 34 days…' to contain 'Left this ward 4 weeks ago'
Expected: "Left this ward 4 weeks ago"
Received: "unit-under-testLeft this ward 34 days ago"

FAIL  tests/ward-community-hub.dom.test.tsx > … > stays in whole days below one week, on both sides of that boundary
AssertionError: expected 'unit-under-testLeft this ward 7 days …' to contain 'Left this ward 1 week ago'
Expected: "Left this ward 1 week ago"
Received: "unit-under-testLeft this ward 7 days ago"
```

Reverted; full suite re-run green (84/84) after revert.

## Coverage added

- Week-rounding boundary, both sides (6 vs 7 days; 34 vs 35 days).
- Overdue direction: future ("Expected discharge in 1 week") and past ("Expected discharge was 1
  week ago", asserted to contain no negative number and no literal "overdue").
- Null-is-not-zero: `leftAt: null` still renders the unchanged original absence sentence, asserted to
  contain neither "0 days" nor "today".

## Files touched

- `src/components/ward-management/community/community-screen.tsx` — both label functions now take
  `now`, branch on sign for `expectedDischargeAt`, degrade non-finite instants to the pre-existing
  absence wording; footnotes and doc comments rewritten to state the owner's ruling.
- `src/components/ward-management/community/community-elapsed.ts` — new, one exported pure function
  (`elapsedDaysPhrase`), the only rounding rule either field uses.
- `tests/ward-community-hub.dom.test.tsx`, `tests/ward-community-corrected-claims.test.ts` — tripwires
  rewritten, new coverage added.
- `community-derivations.ts` was not touched — it never built the withheld labels.
