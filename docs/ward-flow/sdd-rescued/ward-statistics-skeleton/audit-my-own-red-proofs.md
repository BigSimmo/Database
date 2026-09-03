# Audit: four mutation proofs against the tightened standard

Standard: a mutation that reds a test FILE proves only that SOME assertion fired. Every
other assertion in that same test (or, as this audit finds, that same loop) is unproven —
unproven, not vacuous, unless a separate check shows it can never fail.

All reads via `git show <sha>:<path>`. No vitest run. No file under `src/`, `tests/`,
`scripts/`, `docs/` touched.

---

## 1. `ba768efca` — the calibration case (confirmed)

`tests/ward-daily-sheet-placement.dom.test.tsx`, 2 tests, 6 `expect(` total.

- Test 1 ("finds the away line and at least one group heading..."): 2 assertions —
  `awayLine.toBeInTheDocument()`, `headings.length.toBeGreaterThan(0)`.
- Test 2 (order): 1 assertion per heading inside a `for` loop over `getAllByRole("heading",
{level:3})` — 5 headings in the fixture ("Who came in", "Who is going", "Who is stuck",
  "Who is overdue", "Nobody has said when they are going"), so up to 5 assertions, aborting
  at the first failure.

Read `src/components/ward-management/board/ward-daily-sheet.tsx` at this commit: the away
line (`data-testid="ward-daily-sheet-away"`, line 432) and all five `<h3>` group headings
(lines 331, 352, plus three `SheetGroup` headings) render **unconditionally** — none is
gated on `people`/`movement` data. Under `minimalSheetProps()` (empty people), both
elements always exist. **Confirms the calibration reading exactly**: the reported mutation
(moving the away line above the groups div) can only ever flip Test 2 (order); Test 1's two
assertions cannot fail under any data-shaped mutation, only a structural one.

**Unproven:** both assertions in Test 1 (2 assertions).

**Smallest additional mutation:** delete the `<p ... data-testid="ward-daily-sheet-away">`
block (`ward-daily-sheet.tsx` line ~432) so the element never renders. `getByTestId`
throws, reddening `toBeInTheDocument()`. (Reddening the headings-count assertion needs a
bigger mutation — removing all five `<h3>` renders — which is a much larger change than
"smallest.")

**Claim check:** the commit message only claims the _order_ assertion was proven ("proven
to fail when the away line is moved... and to pass again once restored") — accurate, not
overstated. The overstatement lives in the test file's own doc comment, which frames Test 1
as "the non-vacuity guard" without anything having exercised it that way.

---

## 2. `cfca5f432` — community elapsed dates

Scoped to `describe("community hub — the week-rounding boundary is floored, and pinned on
both sides")` in `tests/ward-community-hub.dom.test.tsx`, the block the reported mutation
(`elapsedDaysPhrase` in `community-elapsed.ts` always returns days) targeted. 2 tests, 5
`expect(` total:

- Test A (3 assertions, sequential): `AD-34` contains "4 weeks ago" → `AD-34` not-contains
  "5 weeks" → `AD-35` contains "5 weeks ago".
- Test B (2 assertions, sequential): `AD-6D` contains "6 days ago" → `AD-7D` contains "1
  week ago".

Under "always return days," Test A's **first** assertion fails immediately (mutated output
is "34 days" for "4 weeks ago") — matches the reported "34 days" evidence — and the test
aborts; assertions 2 and 3 never run. Test B's first assertion (`AD-6D`, 6 days) is
**unaffected** by this mutation — under-a-week formatting is identical before and after, so
it passes regardless and does not distinguish the defect — execution continues to
assertion 2 (`AD-7D`, 7 days → "7 days"), which fails, matching the reported "7 days"
evidence.

**Unproven:** 3 of 5 — Test A's 2nd and 3rd (never reached, would also fail if reached),
Test B's 1st (reached but doesn't distinguish this mutation).

**Additionally out of the reported scope:** the same file contains three more assertions
pinning week-phrase output — `"Left this ward 5 weeks ago"` (main elapsed-time test),
`"Expected discharge in 1 week"` and `"Expected discharge was 1 week ago"` (the two
overdue-direction tests) — that share the identical exposure to this exact mutation but
were not part of the reported two-test failure. Not a defect (more coverage than claimed is
fine), but the report's "two boundary tests failing" undercounts what the mutation actually
breaks, which cuts the other way from overstatement.

**Smallest additional mutations:**

- To prove Test A's assertion 2 without also tripping assertion 1: round to nearest instead
  of floor — `community-elapsed.ts`, `elapsedDaysPhrase`, change `Math.floor(days / 7)` to
  `Math.round(days / 7)`. 34 days → round(34/7)=5 → "5 weeks", tripping "not contains '5
  weeks'" while leaving 35 days alone.
- To prove Test A's assertion 3 in isolation: an off-by-one under the floor — change to
  `Math.floor((days - 1) / 7)`. 35 days → floor(34/7)=4 → "4 weeks" (wrong), while 34 days →
  floor(33/7)=4 → still "4 weeks" (assertion 1 still passes).
- To prove Test B's assertion 1: `elapsedDaysPhrase`, change `` `${days} days` `` to
  `` `${days + 1} days` `` — AD-6D would print "7 days" instead of "6 days ago", failing
  assertion 1 without touching the weeks branch AD-7D uses.

**Claim check:** "reported two boundary tests failing with '34 days'... and '7 days'..." is
accurate as a literal description of the vitest output. It does not claim the boundary is
"fully proven" — that stronger claim lives in the test file's own doc comment ("Both sides
of the boundary are asserted"), which the single reported mutation only partially
delivers (2 of 5 pins in that comment's own scope).

---

## 3. `246e56284` — the inverted proof

`tests/ward-statistics-sections.dom.test.tsx`, renamed test (unchanged body): 2 assertions
— `toContain(seeded.name)`, `queryByTestId(...).toBeNull()`.

Read `src/components/ward-management/statistics/statistics-ward-screen.tsx` at this commit:
`const units = unitsOverride ?? liveUnits;` — confirms there is genuinely no mechanism by
which `seeded = allUnits()[0]` (fixture) and the provider's live units could diverge in this
test (no reducer event assigns `Unit.name`/`Unit.siteCode`; `scenarioUnits()` changes
operational numbers only). The rename is honest: the old title claimed a property this test
cannot observe.

The corroborating "single-source-of-truth guard" — `it("names the ward and its hospital, and
measures nothing about it")`, unchanged, earlier in the same file — passes an explicit `units`
override (`aUnit({id:"test-ward",...})`) not present in `allUnits()`. Under the described
mutation (component reads `allUnits()` directly, discarding both `unitsOverride` and
`liveUnits`), `unitId="test-ward"` fails to resolve against the fixture, so the component
renders the not-found state. This mechanism is real and does distinguish live/override state
from the frozen fixture — the claim is sound.

**Assertion accounting:**

- Renamed test: 2 assertions, 0 exercised by the reported mutation — **correct**, not a
  defect. Its honest post-rename claim is exactly that it cannot distinguish this property,
  so both assertions staying green is expected, not decoration.
- Guard test (pre-existing, not part of this commit's diff): 3 assertions
  (`ward-statistics-ward-site` text, `ward-statistics-ward-not-built` truthy,
  `ward-statistics-ward-unresolved` null). Under the mutation, `getByTestId("...-site")`
  throws first (element doesn't render in the not-found branch) — 1 of 3 fires, the other 2
  never reached. This is a residual gap in a test this commit did not touch, not something
  `246e56284`'s own diff introduced or claimed to prove.

**Unproven (in this commit's own diff):** 0 — the renamed test's assertions are correctly
scoped to claim nothing about live-vs-seed.

**Claim check:** "pointing the screen at the frozen fixture instead of the provider left the
renamed test green, while the existing single-source-of-truth guard correctly went red" is
accurate and not overstated. Per the brief, judged on whether it identified the real guard
(it did, verified against the actual `unitsOverride ?? liveUnits` line and the guard's
distinguishing fixture), not on whether something went red.

---

## 4. `2baf11a0f` — nine community claims (worst finding)

`tests/ward-community-corrected-claims.test.ts`, 487 lines, 57 `expect(` calls across 9
claim-groups. The systemic issue: nearly every "pin" is a `for (const phrase of [...])
{ expect(...).not.toContain(phrase) }` loop. Vitest aborts a test at its first failing
`expect`, so a single revert-mutation that reinstates an entire retired paragraph (multiple
phrases at once) only ever _fires_ the first array element reached — every phrase after it
in that same test is never reached, whether or not it would also have failed.

Counting only the assertions that are plausible direct falsifiers for each claim (excluding
tests that check independent, unrelated structural facts — e.g. `INSTANT_FIELDS` membership,
the guard file's own imports — which a prose-revert mutation cannot affect either way):

| Claim group                | Direct-pin assertions | Exercised (1 per test, first-hit) | Unproven |
| -------------------------- | --------------------- | --------------------------------- | -------- |
| 1&2 (demo clock / guard)   | 12                    | 3                                 | 9        |
| 3 (follow-up twin)         | 9                     | 4                                 | 5        |
| 4&5 (departure vocabulary) | 10                    | 3                                 | 7        |
| 6&7 (switcher comment)     | 15                    | 2                                 | 13       |
| 8 (nested instant)         | 4                     | 2                                 | 2        |
| 9 (completeness claim)     | 13                    | 3                                 | 10       |
| **Total**                  | **63**                | **17**                            | **46**   |

Starkest single case: claim 6&7's "contains no count of the teams or of the pages" test has
11 assertions (1 non-vacuity digit-check + a 10-word loop: "nine", "ten", "eleven", …,
"hundred"). The commit message says the retired comment read "nine of the ten." Under a
revert, `words.has("nine")` fails first (array order), aborting the loop — `words.has("ten")`
is **never checked**, despite the same retired sentence containing it. 1 of 11 exercised; the
digit-only assertion isn't exercised at all, because "nine of the ten" contains no numeral
character, so that check would pass even under the un-reverted text.

Second starkest: claim 9's "the unearned completeness claim is gone" test nests a 3-phrase
loop inside a 3-file loop (pageText / screenProse / derivationsProse) = 9 assertions; only
the very first (pageText, phrase 1) is reachable before the first failure aborts everything.

**Smallest additional mutations (representative, not exhaustive):**

- Claim 6&7 "ten": partially revert only the word "ten" back into the switcher `<nav>` doc
  comment in `src/components/ward-management/community/community-screen.tsx` (leave "nine"
  corrected) — isolates and fires that specific loop iteration.
- Claim 1&2 "aeff0635b": in the same screen file's doc block, remove only the merge-commit
  citation "aeff0635b" while leaving "44ca08839" and "MODEL_FILES" intact — fires assertion 2
  of the 3-assertion sequential test in isolation.
- General fix (structural, not "smallest," but the actual remedy): replace each
  `for (const phrase of [...]) expect(...).not.toContain(phrase)` with either `it.each(phrases)`
  (one independently-reported test per phrase) or a single
  `expect(phrases.filter(p => text.includes(p))).toEqual([])` (one assertion whose failure
  message names every surviving phrase, not just the first).

**Claim check — the worst overstatement of the four.** "Mutation-tested one claim at a time,
files restored by hash... every pin fired" is true if "pin" means the `it()` block (each
designated test did go red under its claim's revert). It substantially overstates coverage
if "pin" means each named retired phrase — the file's own doc comment promises exactly that
finer grain ("EVERY ASSERTION HERE IS PAIRED... AND EVERY ABSENCE IS PRECEDED BY A
NON-VACUITY FLOOR"). Under that reading, only 17 of 63 (27%) of the claim-specific
assertions were actually exercised by the described one-mutation-per-claim run; the
remaining 46 are unproven by it — not vacuous, since most would also fail if reached, but
genuinely untested by what was reported.

---

## Ranking, worst first (claim vs. demonstration gap)

1. **`2baf11a0f`** — "every pin fired" against a file whose own loops mean at most ~27% of
   the 63 claim-specific assertions could have fired in a single mutation run each; 46 left
   unproven.
2. **`cfca5f432`** — accurate as narrated ("two boundary tests failing," matching the exact
   reported values) but silently incomplete: 3 of 5 assertions in that same scope unproven,
   plus 3 more week-phrase assertions elsewhere in the file sharing the identical exposure
   and never run.
3. **`246e56284`** — sound; the only gap (2 of 3 assertions unreached in the pre-existing
   guard test) predates this commit and isn't part of what it claims to have proven.
4. **`ba768efca`** — the calibration case; smallest in absolute scope (2 assertions), and the
   commit message itself doesn't overstate — the overclaim lives only in the test file's own
   internal comment.
