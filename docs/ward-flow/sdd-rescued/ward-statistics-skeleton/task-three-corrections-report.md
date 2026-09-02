# Three corrections — report

**Status:** Done. Commit `246e56284` on `claude/ward-builder-community-route`.
**Gate:** typecheck clean; discovered 13 test files (`tests/ward-statistics*.test.ts`,
`*.test.tsx`, `tests/ward-community*.test.ts`, `*.test.tsx`) — RAN 13 files / 276 tests,
PASSED 13 files / 276 tests.

## Task 1 — honest-rename fallback was used

The test's title claimed to prove live-vs-seed resolution, but `seeded = allUnits()[0]`
and the provider's own units both come from the same static fixture with nothing
dispatched, so they were identical by construction.

Checked for a real mechanism to make them differ: no event in
`ward-flow-events.ts`/`ward-flow-reducer.ts` ever assigns `Unit.name` or `Unit.siteCode`
(grepped the reducer for both — neither is an assignment target anywhere), and
`scenarioUnits()` in `ward-scenarios.ts` states outright that a scenario switch changes
"OPERATIONAL NUMBERS ONLY." `WardFlowProvider` takes only `initialNow`, no unit-seed
override. `StatisticsWardScreen` renders exactly two things about a resolved unit — its
name and its site placement — and neither is reachable by any dispatchable event or
provider-seeding path. **No dispatchable event can change anything this screen renders**,
so per the brief I used the honest-rename fallback rather than inventing a mechanism.

Renamed to: _"renders the resolved ward's name and site placement, rather than falling
into the not-found state."_

**Red-proof (inverted — proves the finding rather than a fix):** pointed the screen at
`allUnits()` directly instead of `useWardFlow().units` and ran the renamed test:

```
 Test Files  1 passed (1)
      Tests  1 passed | 40 skipped (41)
```

Stayed **green** — confirming the test genuinely cannot detect this defect. For
corroboration, the same mutation was run against `tests/ward-flow-single-source.test.ts`,
which does catch it:

```
 FAIL  |node| tests/ward-flow-single-source.test.ts > one source of truth > restricts every read of allUnits/unitById under src to the named allow-list
AssertionError: expected [ Array(1) ] to deeply equal []
- []
+ [
+   "src\\components\\ward-management\\statistics\\statistics-ward-screen.tsx",
+ ]
```

Reverted both changes; `git diff` on `statistics-ward-screen.tsx` is empty (byte-identical).

Model/effort: Sonnet 5, high — mechanical verification against a named catcher (the
provider/reducer source, then a live test run), not a judgement call.

## Task 2 — three files corrected, one register entry migrated

`ward-nav.ts` already carries a `community` entry (group "role", no `exampleOnly`), and
`tests/ward-community-index.dom.test.tsx`'s tripwire was already flipped to an ordinary
passing assertion. Corrected:

- `community-index.tsx` — its leading doc comment's "nothing links to it" / open-tripwire
  framing rewritten to state the registration and point at the passing assertion.
- `src/app/mockups/ward-flow/community/page.tsx` — same correction.
- `statistics-claims-register.ts` — the entry
  `community-index/reachability/nothing-links-to-this-index-yet` asserted an absence that
  is now false. Per the register's own rules (an absence can't carry real evidence, a
  presence can), it moved from `UNEVIDENCED_CLAIMS` to `MODEL_CLAIMS` under the new id
  `community-index/reachability/the-root-rail-links-this-index`, citing
  `id: "community", href: "/mockups/ward-flow/community",` in `ward-nav.ts` with a
  `falsifiedBy` edit that deletes that entry.

`MODEL_CLAIMS.length` raised 85→86, `UNEVIDENCED_CLAIMS.length` lowered 13→12 in
`tests/ward-statistics-claims.test.ts`, both deliberate and explained in that file's
comment.

Added paired presence/absence assertions in `tests/ward-community-index.test.ts` (new
`it` for the doc-comment's own file) and a new `describe` ("claim 10") in
`tests/ward-community-corrected-claims.test.ts` covering the mockups page and the
register migration.

## Task 3 — true prop count is four, not three

Read `StatisticsScreen`'s signature directly: it destructures
`admissions, referrals, bedReleases, movements`, all optional, all falling back to
`useWardFlow()`. The mockups statistics route page's prohibition named only the first
three and said "all three." Corrected to name all four and say "all four." Added a test
in `tests/ward-statistics-sections.test.ts` that reads the component's real signature
(rather than hard-coding "four" a second time) and checks the route page's wording
against it, plus paired absence/presence checks on the old/new phrasing.

## Coverage stated in the return message

RAN: 13 test files / 276 tests. PASSED: 13 test files / 276 tests. Typecheck: clean, no
output. All touched files are within the five named plus `tests/ward-statistics*` /
`tests/ward-community*`, staged and committed by name (no `git add -A`).
