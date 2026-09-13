# Test vacuity audit — statistics, nav, and the rest of tests/ward-*.test.ts

## Scope discovered

`ls tests/ward-*.test.ts tests/ward-*.test.tsx` (excluding `tests/ward-community-*`, owned by
another agent) returned 138 files. Per the brief's three bullets, the target set was:

- `tests/ward-statistics.test.ts`, `tests/ward-statistics-claims.test.ts`,
  `tests/ward-statistics-derivations.test.ts`, `tests/ward-statistics-incoherent-gap.test.ts`,
  `tests/ward-statistics-sections.test.ts`, `tests/ward-statistics.dom.test.tsx`,
  `tests/ward-statistics-sections.dom.test.tsx` (7 files)
- `tests/ward-nav.test.ts` (1 file)
- Every other `tests/ward-*.test.ts` except `tests/ward-community-*` (84 files, listed by the
  discovery command; full list omitted here for length but reproducible with
  `ls tests/ward-*.test.ts | grep -v '^tests/ward-community-'`)

Total swept: **92 files** (excluding the `.dom.test.tsx` files outside the statistics set, which
the third bullet's literal wording does not cover, and excluding all `ward-community-*` files).

Method: full manual read of all 8 statistics/nav files (the ones the report is named for) plus
`ward-withdrawal-reason-privacy.test.ts`, `ward-change-reasons.test.ts`, `ward-priority.test.ts`,
`ward-statistics-sections.test.ts`. The remaining ~80 files were swept mechanically for every
pattern named in the brief (`.only`/`.skip`/`.todo`/`.fails`, `try`/`catch`, `.forEach` with
assertions inside, `toBeGreaterThan(0)`, short-string `toContain`, literal-argument `expect()`,
zero-matcher `expect()`) and every hit was read in context.

## Result: no vacuous assertion found

**0 files, 0 vacuous assertions.** No `.only`/`.skip`/`.todo`/`.fails` anywhere in the swept set.
The one `try`/`catch` (`ward-flow-chat-control.test.ts`) is inside a string template executed as a
_child process script_, not test code swallowing an assertion. No `.forEach` wraps an assertion.
Every `toBeGreaterThan(0)` / `toBeGreaterThanOrEqual` I traced is either (a) an explicit,
commented "vacuity guard" placed immediately before an exact-value assertion on the same
collection, or (b) a floor on a value the test doesn't claim to pin exactly (e.g. a sanity check
that a filesystem walk found "more than 900 files", not the metric under test). Every loop over a
collection I checked is either proven non-empty earlier in the same test/file (often by an
explicit `expect(x.length).toBe(N)` on the exact same array), or iterates a hand-built literal
array constructed in the same test.

This is not an accident of a shallow sweep: the statistics/claims-register/derivations/nav files
are saturated with doc comments that _name this exact audit's failure classes_ — assertions moved
outside a negation, `toBeGreaterThan(0)` used as a lazy floor instead of a pinned exact count,
loops over possibly-empty seeds, hand-copied vocabulary tables that drift from the real union —
each accompanied by a "vacuity guard first" comment and a companion test proving the guard/checker
itself rejects a constructed bad input before being trusted against real data (e.g.
`ward-statistics-claims.test.ts`'s `hasControlCharacter`/`isEntirelyComment`/
`falsifiabilityProblem` are each exercised on a synthetic failing case before being applied to the
register). `ward-statistics-claims.test.ts` in particular is a meta-audit for this exact defect
class, already tightened once (2026-09-01) after finding 12 citations that were "right by
accident."

No `it.fails()` tripwires were found in this file set either, so there is nothing to classify as
an intentional pin.

## Worst finding

There is no finding to rank. The closest thing to a candidate — unguarded `for` loops over the
production fixture `wardMovements` in `ward-priority.test.ts` (e.g. "scores no factor for having
been examined or reviewed") — would only pass vacuously if the seed itself collapsed to `[]`, and
that state is already loudly caught elsewhere in the same file (other tests call
`movementById("WF-...")`, which throws if the fixture is missing an id), so it isn't a live risk
worth reporting as a defect.
