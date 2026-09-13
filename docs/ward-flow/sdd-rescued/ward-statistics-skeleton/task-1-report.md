# Task 1 report — the four statistics routes and their screens

**Status: DONE_WITH_CONCERNS.** Everything the brief asked for is written, formatted, linted and
green on the declared gate. The single concern is that **the commit is blocked by the pre-commit
hook**, for exactly the reason `CLAUDE.md` predicts, and I did not work around it. Detail in
"Commit state" below.

---

## What was built

### The one place the section list lives

`src/components/ward-management/statistics/statistics-sections.ts` — id, label, one-line
description and href for each section, plus `STATISTICS_HOME_HREF`, `STATISTICS_OVERVIEW_HREF`,
`STATISTICS_COMPARE_HREF`, `STATISTICS_UNIT_CHOOSER_ID`, `statisticsSectionById(id)`, and the two
href builders `wardStatisticsHref(unitId)` / `edStatisticsHref(edId)`.

Three sections, five routes. The owner named three — across all services, comparisons, per-unit
detail — and the third is served by two dynamic routes because a `Unit` and an
`EmergencyDepartment` are different records with different fields, not one list with a flag. So the
third section has no index page of its own.

**The one judgement call in this task, flagged for review.** Constraint 3 fixes the route list, so
I could not add a third static route to index the per-unit pages. A dynamic route with no concrete
href anywhere is reachable only by typing an address (that is exactly the orphan `ward-index.tsx`
was built to close, and it is recorded as a figure in `tests/ward-nav.test.ts`). The chooser
therefore lives on the comparisons page — the one page whose whole subject is the set of units —
and the third section's `href` is `…/statistics/compare#choose-a-unit`. The reasoning is written
into `statistics-sections.ts`'s own doc comment, and a test pins the arrangement so it cannot be
"tidied" into an href for a route that does not exist. **If you would rather the hub's third entry
were not a fragment link, that is a one-line change to this module and nothing else moves.**

### The screens

All under `src/components/ward-management/statistics/`:

- `statistics-section-frame.tsx` — the chrome every section page carries: `ClinicalRail`, the
  synthetic-prototype banner, the back link, the eyebrow/title/subtitle header, and the
  no-role-gate notice.
- `statistics-overview-screen.tsx` — "Across all services".
- `statistics-compare-screen.tsx` — "Ward and ED comparisons", and the unit chooser.
- `statistics-ward-screen.tsx` — one ward.
- `statistics-ed-screen.tsx` — one emergency department.
- `statistics-sections.module.css` — one unlayered module for all four, design tokens only, no hex,
  and the `--spacing-ward-phone-bar` reserve below 40rem.

### The routes

- `src/app/mockups/ward-flow/statistics/overview/page.tsx`
- `src/app/mockups/ward-flow/statistics/compare/page.tsx`
- `src/app/mockups/ward-flow/statistics/ward/[unitId]/page.tsx`
- `src/app/mockups/ward-flow/statistics/ed/[edId]/page.tsx`

Both dynamic routes take `{ params }: { params: Promise<{ … }> }`, await it, and
`decodeURIComponent` the id — matching the existing `ward/[unitId]` and `ed/[edId]` routes in this
tree, which is where the pattern was read from rather than recalled.

### The tests

- `tests/ward-statistics-sections.test.ts` — 13 tests.
- `tests/ward-statistics-sections.dom.test.tsx` — 24 tests.

---

## How the four named risks were handled

**1. One place for the section list.** Every screen reads its own name and description from
`statistics-sections.ts`; nothing types a section name in. The DOM test asserts the rendered eyebrow
equals `statisticsSectionById("overview")?.label` and that the rendered description is the
module's, so a screen that hard-coded a copy fails the moment the list is edited. The static test
additionally resolves each href against the file system with `existsSync`, because a list that
agrees with itself still cannot prove the routes exist.

**2. No invented figures.** No screen renders a numeral, a nought, a dash, a sample value or a
placeholder block, and the CSS has no "skeleton" treatment at all — a grey block where a number
will go reads as a figure that has not loaded, which is the same lie in a different costume. Two
assertions:

- the overview page's entire `<main>` must contain no numeral (`expect(main.textContent).not
.toMatch(/[0-9]/)`), guarded against a vacuous pass by also requiring the text to exceed 600
  characters and to contain "Nothing here is built yet";
- each of the four screens' not-built statement must contain no numeral, guarded by a length floor
  of 120 characters.

**Proved able to fail.** I inserted `0 figures` into the overview copy; both assertions went red
("2 failed | 22 passed"), and the file was restored with a matching `sha256` —
`7a6a7a2328c2a9ab71665daacfe53a1727837493a5e67c5052e75f12703eca4a` before and after.

The static test carries the same rule for the shared list: no numeral in any section label or
description, because a count frozen into a constant ("nine wards compared") stops being true
silently and nothing renders differently.

**3. Next 16 route params.** Awaited Promise plus `decodeURIComponent`, as above. The builders
`encodeURIComponent` on the way out, and a test asserts the round trip with an id containing spaces,
a slash and a question mark — today's ids are plain slugs, which is precisely why an unencoded
builder would never be noticed.

**4. The honest "no such unit" state.** Both dynamic screens render a page that names the id it
could not resolve, says it never falls back to a different unit, keeps the governance banner and the
access notice, and offers the chooser. Neither renders the identity or not-built sections in that
state, so it cannot be mistaken for a real unit with nothing to show. The test asserts the id
appears, that no unit's name appears anywhere in `<main>`, and that the disclaimer is still there.

**Proved able to fail.** I changed the ward screen's lookup to
`units.find(…) ?? units[0]`; the not-found test went red ("1 failed | 23 passed"), and the file was
restored with a matching `sha256` — `e7cdb28153213f156d410069ce3a739e9c3cd5c791209e023f53a2fa17174af7`
before and after.

---

## The other constraints

- **Disclaimer and governance banner on every page** — in the shared frame, asserted on all four
  screens, including both not-found states. The two sentences are **duplicated** from
  `statistics-screen.tsx` rather than shared with it, because Task 1 may not edit that file. That
  cost is recorded in the frame's doc comment: an undisclaimed sub-page is a worse defect than a
  duplicated sentence, and Task 2 can fold the home screen onto this frame and make the two copies
  one.
- **Phone bar reserve** — `@media (max-width: 40rem) { .screen { padding-top:
var(--spacing-ward-phone-bar) } }`, value taken from the shared token, never measured afresh.
- **Design tokens only** — no hex anywhere in the module; `npx eslint` on all thirteen new files
  exits 0, so `no-hardcoded-hex` and the icon/type/z-index rules are satisfied.
- **`<Link>` only** — every internal navigation is `next/link`; there is no raw `<a href="/…">`.
- **No decorative controls** — there is **no `<button>` on any of the four screens**. The only
  interactive elements are links that navigate. Nothing needed `aria-disabled` because nothing
  unavailable was shipped at all.
- **Live state, not the fixture** — the compare and ward screens resolve wards from the provider's
  `units`, never `allUnits()`/`unitById`, which
  `tests/ward-flow-single-source.test.ts`'s `UNITS_FIXTURE_ALLOWLIST` enforces for every file under
  `src`. Emergency departments are not in provider state, so they come from
  `allEmergencyDepartments()`/`edById`, the same source `ed-screen.tsx` uses; that pair is not
  covered by the restriction.
- **Files touched** — only `src/components/ward-management/statistics/`,
  `src/app/mockups/ward-flow/statistics/`, and two new `tests/ward-statistics-sections*` files.
  Nothing else was written. `statistics-screen.tsx` and `tests/ward-statistics.dom.test.tsx` were
  **read only** and are untouched (they still show as the other implementer's own unstaged
  modifications).

---

## The gate

Derived from disk, not named by hand:

```
npx tsc -p tsconfig.typecheck.json --noEmit          → TSC_EXIT=0
npx vitest run $(ls tests/ward-statistics*.test.ts tests/ward-statistics*.test.tsx | tr '\n' ' ')
   → Test Files  5 passed (5)
     Tests  100 passed (100)
```

The five files the shell glob found were `ward-statistics.dom.test.tsx`, `ward-statistics.test.ts`,
`ward-statistics-derivations.test.ts`, and my two new `ward-statistics-sections*` files. My two
alone are 37 of those 100 tests.

Additionally, and not required by the brief: `npx prettier --write` over all thirteen new files
(committing unformatted files is this repo's most reliable CI red), and `npx eslint` over the twelve
`.ts`/`.tsx` files — exit 0, captured to a file so no pipe could mask the code.

**`tests/ward-nav.test.ts` is already red on this branch** for a known reason another chat owns, and
these four new `page.tsx` files move its `22 page.tsx files` count literal further out of date. That
is expected and declared. I did not edit it.

**Not run, and why:** `npm run lint` and `npm run test` whole-repo, `verify:cheap`, and any browser
gate. The change is four new mockup routes and their screens, all additive, with no shared UI
foundation touched; the targeted eslint and the five-file vitest run cover the plausible regression
classes. The phone reserve is the one property none of these can see — jsdom, `tsc` and eslint are
all blind to it, which is why the CSS carries the reserve and the note explaining it rather than
relying on a test.

---

## Commit state — the concern

**The work is staged but NOT committed.** The pre-commit hook refused:

```
[pre-commit] Documentation inputs have unstaged or untracked changes:
src/components/ward-management/statistics/statistics-screen.tsx
tests/ward-statistics.dom.test.tsx
[pre-commit] Stage or separate these inputs before regenerating commit documentation.
```

Those are precisely the two files Task 1 may not touch, still carrying the other implementer's
in-flight edits. This is the block `CLAUDE.md` documents ("the pre-commit hook refuses whenever
other unstaged or untracked files exist under `src/components/` or `tests/`… That is correct
behaviour and must not be worked around"), so I did not use `--no-verify` and did not stage another
agent's work to get past it.

**All thirteen of my files are staged, by name.** Nothing else was staged — the two modified files
above and the untracked `docs/superpowers/plans/ward-statistics-skeleton.md` were left alone. The
commit message is ready; the moment the other implementer commits, `git commit` will go through
unchanged.

Base at the time of writing: `HEAD` = `8b42f0c9d2a44664adaa3d78c9aa45bfcd49d1df` (not the
`e4a46590c` named in the brief — another agent committed to this branch while Task 1 ran).

---

# Fix round 1 — seven findings, all addressed

**Status: DONE.** Gate green, every fix mutation-proved, committed. Two findings' premises needed
correcting on the way through; those are written up under Finding 1 and Finding 5 rather than
quietly absorbed.

## Finding 6 (Critical) — the false claim about `ReferralAddressing`

The clause _"which records the destination's KIND and its bed criteria and carries no unit at all"_
was rendering on **three** pages, not two: `statistics-screen.tsx` (the declines block and its doc
comment), `statistics-compare-screen.tsx`, and `statistics-overview-screen.tsx` — the third because
Finding 2 had me write the same sentence onto the overview page a few minutes before this finding
arrived. All three are corrected.

I opened `ward-model.ts` rather than taking the report: `ReferralAddressing` carries
`acceptedUnitId?: string`, documented "The unit that accepted. Only ever set on a `psychiatric_ward`
addressing". The conclusion survives and the reason is now the sharper one:

> A referral decline sits on `ReferralAddressing`, whose ward destination records the bed's
> criteria — the sex it must suit, whether it must be secure, whether it must be able to hold
> somebody involuntarily — and never a unit. The one field there that CAN name a ward is
> `acceptedUnitId`, and it is set only when a ward accepts. So from a single record an acceptance is
> attributable to a named ward and a decline is not — and in a comparison table those two would sit
> in adjacent columns looking equally solid, one counting the whole population and the other only
> the part that said yes.

`statistics-screen.tsx` was touched **only** in the declines passage and the doc-comment sentence
carrying the same false clause, per the lifted restriction. The retraction is recorded in that
comment so the sentence cannot return as a "clarification".

**The assertion asked for.** `tests/ward-statistics-sections.dom.test.tsx` now renders all three
passages and asserts each one does **not** match `/carries no unit/i` or `/no unit at all/i`, **does**
contain `acceptedUnitId`, and still states the conclusion (`/when a ward accepts/i`). The home
screen is imported read-only and the guard on it is deliberately narrow — one retracted clause and
the field that replaced it — so an ordinary Task 2 edit cannot trip it.

## Finding 7 (Important) — "referrals received" is not summable

Verified first-hand: `Movement.referredUnitIds: string[]`, "Units currently holding a live
referral", capped by `PARALLEL_REFERRAL_CAP`. The comparisons page now names it as the second worked
example, and says how it fails differently from the declines one — the declines column silently
narrows its population, this one silently inflates it, "sums to more than the number of referrals
that exist… it reconciles to nothing, and the arithmetic gets blamed".

**The general rule is on the page**, above both examples, because it is what decides every future
column: _a measure can be set against a named ward only when the record it comes from carries a
required unit id._ `Admission.unitId` is required (read at `ward-admissions.ts`); `Movement`'s and
`ReferralAddressing`'s unit fields are optional and populate only on acceptance; anything keyed to
the origin department attributes to an emergency department, which is a category error rather than a
rounding one. Pinned by `ward-statistics-compare-attributability-rule` and
`ward-statistics-compare-double-count-example`.

## Finding 5 (Important) — the two dynamic routes were unreachable to the route scan

Both builders now write the whole path literally and interpolate only the encoded id. The
duplication of the home-href prefix is deliberate; the doc comment says so and says what it buys, so
it is not tidied back.

**One deviation from the instruction, and it is small.** The doc comment originally quoted
`ward-screen.tsx`'s and `patient-search.tsx`'s example hrefs verbatim, as told. I removed the two
quoted paths: a concrete route path sitting in a comment is itself a source reference to a scanner,
and this module should not vouch for routes it does not link to. The files are still named and the
pattern is still described — only the literal paths are gone.

**The assertion asked for** is a source-text check, and it has to be: `wardStatisticsHref("x")`
returns an identical string either way, so nothing behavioural can fail. The new
`the per-unit route paths are written as literals` block reads the module off disk, requires both
literals, and requires the variable-prefixed form to appear **nowhere in the file, comments
included**.

**Verified rather than assumed:** `tests/ward-nav.test.ts` no longer reports the reachability
failure. Five failures remain there — the `page.tsx` count, the prose-mention scan, the
dynamic-route instances declaration, the static-route nav registration and `RENDERABLE_ROUTES` — all
of them Ward Lead's count literals and registration maps, exactly as declared. I did not edit that
file or `ward-landmarks.test.ts`.

## Finding 2 (Important) — the honesty was load-bearing on one page of four

**Ward page.** Read `ward-statistics.ts` (never written). It computes, per unit, average length of
stay, average empty-bed minutes, discharge-date outcomes as met/missed/moved, ready-to-leave-blocked
and long stays — and has no consumer in `src`, only its own test. The page now says that: **most of
it is computed and simply not surfaced**, so the gap is "a rendering decision about what to show and
how to word it, not arithmetic nobody has done".

And it names the one genuinely blocked figure, which the old copy missed entirely:
`WardStatistics.averageWaitlistWaitMinutes` is always `null` because no instant on `Admission` marks
entry to `waitlisted` — the record keeps the pull, the arrival, the expected discharge date, when it
was set and the departure, and none of them is that moment; the nearest equivalent measures from
`Referral.raisedAt`, which this derivation cannot see because it takes admissions only, by design.
So no data entry against today's model produces it. Beds, occupancy and availability are handled
separately, as a question the capacity board already answers rather than as a gap.

**Overview page.** The precedent sentence now names the figure (declines per ward, the statistic the
owner named first) and both records, corrected per Finding 6.

## Finding 1 (Important) — the ED page promised three figures

Rewritten into three paragraphs that sort the three claims rather than lumping them:

1. **Nothing is stored on a department.** `EmergencyDepartment` is an id, a site code and a name.
2. **Two records name one, so two of the three figures are derivable and simply not derived** —
   `Movement.originEdId` (who is physically in the department, with `openedAt`, stage and declines)
   and a referral addressed to that department's psychiatry service, carrying `edId` and the two
   clocks the referral record already keeps.
3. **How busy the department is has no field at all**, because ED medical staff are not users of
   this system — the request arrives verbally and psychiatry raise the referral — so attendances
   nobody was told about are outside the model. That is a design question, not a task.

**A correction to the finding's premise, checked rather than assumed.** The finding says the only
ED-attributable record is a referral addressed to an ED's psychiatry service. `Movement.originEdId`
is the other, and it is required on every movement — which is what makes "how many people are
waiting" and "how long they have waited" reachable rather than unrecordable. Had I written the copy
the finding described, the page would have understated the model in the opposite direction: the same
defect with the sign flipped.

The page also names one near-miss that would be easy to publish and wrong: `MovementClosure.outcome`
of `did_not_proceed` looks like a count of people who left without a bed and is not one — it records
a movement ending without admission, usually because an examination found admission unnecessary.
"Publishing it under that heading would rename a clinical outcome as a failure of flow."

## Finding 3 (Important) — the chooser anchor nothing used

`STATISTICS_UNIT_CHOOSER_HREF` is now a constant beside the anchor id, and all four in-page links
use it. The assertion that had blessed the bare href is replaced by a four-case block covering both
states of both detail screens — a fix applied to three of the four would have looked identical in
review. It asserts the constant AND spells the expected href out, because a constant that lost its
fragment would satisfy an equality against itself.

The rationale is now **on the comparisons screen**, not only in the source: "the unit list is on this
page because per-unit detail has no page of its own… this is the page whose subject is the whole set
of units, so this is where that choice belongs."

## Finding 4 (Important) — the disclaimers had already diverged

Not folded — that is Task 2's. Both divergences are now written into the frame's doc comment with
the reason each is right for its own page (the home page's wording is anchored to figures it
computes; these pages compute none), plus an explicit warning that the fold is not a delete-one-copy
job and needs wording true of both kinds of page, or a prop.

The assertions are now **equality on the whole normalised sentence** for both the banner and the
access notice, on all four screens. The old `toContain("not real figures")` /
`toContain("There is no role check on this route.")` pinned the alarming half of each sentence and
left the qualifying half free to be dropped.

## Minors — all four taken

- `.subHeading` added, so "Wards" / "Emergency departments" no longer render identically to the
  section headings above them.
- The overview page no longer claims a "way in" that does not exist; it says the index that will
  link here is separate work.
- Both not-found states dropped their near-duplicate `<h2>`; the frame's `<h1>` already says it.
- The numeral test renders one screen per case instead of four into one document — four
  `id="main-content"` landmarks is a state no route can produce.

## Gate

```
npx tsc -p tsconfig.typecheck.json --noEmit          -> TSC_EXIT=0
npx vitest run $(ls tests/ward-statistics*.test.ts tests/ward-statistics*.test.tsx | tr '\n' ' ')
   -> Test Files  5 passed (5)
      Tests  115 passed (115)          (was 100; +15)
```

`npx eslint` over `src/components/ward-management/statistics/` and both test files: exit 0. Prettier
written over every touched file.

**Three mutations, three reds, three restored files with matching hashes** — run together so each
failure is attributable to its own assertion:

| Mutation                                                  | Failed                                                                                          | Restored hash           |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------- |
| One chooser link back to the bare href                    | `the ward page for an id that resolves to nothing links to the anchor…` plus the not-found test | `badf9370…d53b` matches |
| "carries no unit at all" restored to the comparisons page | `the comparisons page's declines example never says the record carries no unit`                 | `f4563dcd…89c9` matches |
| `wardStatisticsHref` rebuilt from `STATISTICS_HOME_HREF`  | both source-literal assertions                                                                  | `616c7d1b…acab` matches |

**One trap worth recording.** The first draft of the `accepts` assertion was written as
`/accepts?\b/i` through a shell heredoc, and the `\b` became a literal backspace byte (0x08) in the
file. The regex then printed as `/accepts?/i` in the failure output — the backspace is invisible —
while never matching anything. It was found only because the assertion failed against text that
plainly contained the word. Fixed to `/when a ward accepts/i`, and the file was checked for
surviving 0x08 bytes.

**Not run:** whole-repo `npm run test`, `verify:cheap`, browser gates. Six referral/event suites are
red on this branch from a seed the branch predates, and `tests/ward-nav.test.ts` is red on route
registration; both are Ward Lead's, and neither was investigated or accommodated, as instructed.
