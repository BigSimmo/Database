# Statistics prose repair — report

**Commit:** `60c17c95322ff1443f676483dc96e19b3aaf1363` on `claude/ward-builder-community-route`.
**Gate:** `npx tsc -p tsconfig.typecheck.json --noEmit` exit 0. Vitest **ran 13 files / 263 tests**,
all passed. Discovered list echoed below; 13 is above the refusal floor of 5.

```
tests/ward-community-corrected-claims.test.ts   tests/ward-statistics.dom.test.tsx
tests/ward-community-hub.dom.test.tsx           tests/ward-statistics.test.ts
tests/ward-community-hub.test.ts                tests/ward-statistics-claims.test.ts
tests/ward-community-index.dom.test.tsx         tests/ward-statistics-derivations.test.ts
tests/ward-community-index.test.ts              tests/ward-statistics-incoherent-gap.test.ts
tests/ward-community-referral-survives.test.ts  tests/ward-statistics-sections.dom.test.tsx
                                                tests/ward-statistics-sections.test.ts
```

Every citation below was re-verified against the CURRENT file after the 71-commit merge, not taken
from the brief.

---

## The seven findings

### R1 — RENDERED. Deleted, not rewritten. `StatisticsOverviewScreen`

The `ward-statistics-overview-not-built-body` paragraph told the reader there was no way in from the
statistics home page. Re-verified: `STATISTICS_SECTIONS` (`statistics-sections.ts`) makes
`STATISTICS_OVERVIEW_HREF` its **first** entry, and `StatisticsScreen` maps every entry into a
`<Link>` inside the `ward-statistics-index` `<nav>`. Sentence deleted; the conclusion fell with the
reason.

Guarded twice, in both directions:

- `tests/ward-statistics-sections.dom.test.tsx` — the rendered paragraph may not contain the
  sentence, **and** a companion test renders `StatisticsScreen` and asserts an anchor to
  `STATISTICS_OVERVIEW_HREF` is really in the index. Without that second half, removing the hub link
  tomorrow would leave the negative happily forbidding the only sentence that would have said so.
- `tests/ward-statistics-sections.test.ts` — the wording is forbidden in the screen's **source** too,
  because the file also carries the record of why the sentence went. The record therefore
  **describes** the retired sentence instead of quoting it back, so the wording exists nowhere in
  the tree.

### R2 — RENDERED. `StatisticsWardScreen`, `ward-statistics-ward-blocked-figure`

Was: "The record carries several instants and **every one of them** is about the bed or about the
discharge plan". `ward-admissions.ts` says on `awayAtEmergencyDepartmentSince`, in bold, that it
"is a fact about the PERSON, which is why it is a field and not a state", and that `AdmissionState`
is where the bed facts live.

Now states a **floor**, not an absolute: the instants "are not all of one kind — some are about the
bed, some are about the discharge plan, and **at least one is a fact about the person** rather than
about the bed". A further person-fact instant cannot falsify it, and it still does not enumerate.

### R3 — RENDERED. `statistics-screen.tsx`, `ward-statistics-refused-so-far-why-so-far`

Was: "**most** of what is counted here has been put to that many out of the whole network". Nothing
measures that — `handoverSnapshot` selects on an empty `referredUnitIds` beside a non-empty
`declines`, which a movement carrying a **single** decline satisfies identically. The cap bounds the
figure from above and says nothing about the mode.

Now: "a movement counted here has been put to **at most** that many wards … Nothing on the record
measures how many it was actually put to, so that is a ceiling and never a typical figure." No count
is typed; the cap is still rendered from `PARALLEL_REFERRAL_CAP`. The same soft claim in
`statistics-derivations.ts` ("has **usually** been put to **three** wards") was corrected with it —
that one also re-typed the constant's value beside it.

### C4 — comment. `statistics-disclaimers.tsx` + `statistics-section-frame.tsx`

Measured from disk today (28 CSS modules under `src/components/ward-management/`):
`.governanceBanner` in 19, `.prototypeBadge` in 21, `.notice` in 7, **all three in 6**. The two files
also disagreed with each other about the population size.

Repaired by **describing the set and dropping `.notice` and both numerals**. The test does not
re-type any of those numbers either: it walks the CSS modules from disk and asserts that strictly
fewer of the banner-pair modules declare `.notice` than declare the pair — the property that makes
the retired sentence false, stated as an inequality so no figure can go stale.

### C5 — **NOT REPAIRED — outside the files this task may edit.**

`src/app/mockups/ward-flow/statistics/page.tsx` still says "It must never pass `admissions`,
`referrals` or `bedReleases` … `StatisticsScreen` accepts **all three**". Re-verified: the screen
takes **four** optional props — `movements` is the fourth, and `sourceMovements = movements ?? liveMovements`
feeds `refusedAndNothingPending(...)` and `declinesByReason(...)`. A prohibition that omits one of the
things it forbids is wrong, not merely incomplete. **Correction needed: add `movements` and change
"all three" to "all four".** No test was added, because any honest guard for it would be red now.

### C6 — comment. `statistics-claims-register.ts` opener

Was: "**every statement** … paired with the line of real source that makes it true", directly above
`UNEVIDENCED_CLAIMS`, which is a list of statements deliberately paired with no line. Now qualified,
and it names the second hole too: a statement inside a registered surface can be carried by neither
list — R1 was exactly that, on a file listed in `REGISTERED_SURFACES`.

### C7 — comment. `StatisticsSectionFrame`

Was: "**NO CONTROLS.** The only interactive element **here**…" with `<ClinicalRail />` as the frame's
own first child (menu button, icon-rail expand, sidebar collapse, sheet; one mutates persisted UI
state). Now scoped: "**THIS FRAME ADDS NO CONTROLS.** The only interactive element the frame itself
adds…", with the rail named as the exception and the substantive point kept.

---

## The two weak register pins — repaired and proved

`statistics-derivations/beds-being-prepared/set-bed-preparation-has-a-unit-guard` and its
`-note-guard` sibling cited the reducer's **rejection message**, not the `if` that does the refusing.
Both now cite the condition together with its message (which is what keeps the citation unique), and
`falsifiedBy` neuters the condition to `if (false)` while leaving every message byte in place.

Proved in memory against the real `ward-flow-reducer.ts` (read-only, nothing written):

```
after neutering BOTH guards but keeping every message:
  OLD unit-guard citation still present?  true      <- the dead guard, green
  OLD note-guard citation still present?  true      <- the dead guard, green
  NEW unit-guard citation still present?  false     <- red
  NEW note-guard citation still present?  false     <- red
```

`tests/ward-statistics-claims.test.ts` applies the same edits itself and passes, so both citations
are unique and both are falsifiable.

---

## The R1 sweep — every "not built yet" note, with a verdict

Grepped the statistics tree for `yet`, `not built`, `separate work`, `will link`, `to come`,
`for now`, `outstanding`, `once … lands`, and checked each against what now exists.

**NEWLY FALSE (4 — one fixed, three outside the files this task may edit):**

1. `statistics-overview-screen.tsx` — the R1 sentence. **FIXED.**
2. `src/components/ward-management/community/community-index.tsx` — "**nothing links to it from
   anywhere a person can get to**", and the passage beneath it explaining that the `ward-nav.ts`
   registration "is not in this change". `ward-nav.ts` now carries
   `{ id: "community", href: "/mockups/ward-flow/community" }`. **READ ONLY — needs Ward Lead.**
3. `src/app/mockups/ward-flow/community/page.tsx` — "**This route is not yet registered in
   `ward-nav.ts`, so nothing links to it yet.**" Same falsifier. **Outside scope.**
4. `statistics-claims-register.ts` → `UNEVIDENCED_CLAIMS` →
   `community-index/reachability/nothing-links-to-this-index-yet` — claims "Nothing in the navigation
   links to this index", and its stated guard is the `it.fails` tripwire in
   `tests/ward-community-index.dom.test.tsx` — which **has already been flipped to an ordinary
   guard** (its own comment says "AND IT WAS AN `it.fails` TRIPWIRE UNTIL 2026-09-01"). So the
   tripwire fired, somebody cleared it, and the three notes above were left describing the world it
   fired about. **Not edited: the brief forbids editing register entries, and fixing the entry alone
   while the prose it summarises stays false would make them disagree.**

That cluster is R1's exact shape, four files deep. It is the single most valuable thing in this
report.

**STILL TRUE (7):**

5. `statistics-compare-screen.tsx` — "The comparison itself is the hard part and it is not built" /
   "No comparison is built yet". The page renders a unit list and no column of any kind.
6. `statistics-ed-screen.tsx` — "Nothing about this department is measured here yet"; "derivable
   from the movement side, and simply not yet derived". No ED derivation exists.
7. `statistics-ward-screen.tsx` — "Nothing about this ward is measured here yet".
8. `statistics-ward-screen.tsx` — "`wardStatistics()` … has **no consumer in the app** — only its own
   test." Re-verified: no file under `src` imports `ward-management/ward-statistics`; the only
   mention is a path string constant in the register. **Already guarded** by
   `tests/ward-statistics-sections.test.ts`, which walks `src` and goes red the day one appears —
   this is the one note in the tree that is built the right way round.
9. `statistics-ward-screen.tsx` — "this page has no derivation of its own yet".
10. `statistics-screen.tsx` — "Nothing in this prototype records an offer, so this figure cannot be
    produced at all." `Unit.empty` / `Unit.allocatable` are ward-level aggregates; no per-bed or
    per-offer record exists.
11. `statistics-screen.tsx` doc comment — "**Before** that index existed the section pages were
    reachable only by knowing their addresses." Past tense, and correct. This is the sentence R1's
    fix was recorded on the other side of.

**STILL TRUE BUT UNGUARDED, AND OF THE SAME SHAPE (1):**

12. `statistics-sections.ts` — "**Ward Lead is building** an invariant test that walks every route
    directory under `src/app/mockups/ward-flow` and asserts its literal prefix appears in `src`."
    Verified: no such test exists in `tests/`, so the note is true today. But it is a claim about
    another person's future work with nothing to make it red when that work lands — precisely R1's
    mechanism. The same sentence is repeated in `tests/ward-statistics-sections.test.ts`, so it is
    also two copies of one fact. Recommend it be re-pointed at a test that fails when the invariant
    arrives, or reduced to a statement about this module only.

---

## Concerns

- **A whole-file absence scan cannot tell a quotation from a relapse.** Two of my correction notes
  quoted the false sentence verbatim and tripped their own new guards. I fixed the notes rather than
  the guards, and wrote the reasoning into the test — an exemption carved around whatever a comment
  calls its "history section" is a hole any future false sentence can sit in.
- **`statistics-claims-register.ts` failed `prettier --check` at HEAD**, before any edit of mine
  (verified against `git show HEAD:…`). About 110 lines of quote-style churn on that file are that
  pre-existing debt, not this change. It also sits on disk with CRLF endings while every sibling is
  LF; `.gitattributes` normalises on commit, so the diff is clean, but it is worth someone knowing.
- **C5 is unfixed and has no guard.** It is a prohibition missing one of the four things it forbids.
- **The community reachability cluster (sweep items 2–4) is unfixed** and spans a read-only
  component, a route page and a register entry. All three must move together.
- **An untracked file appeared in the worktree during this session** —
  `docs/ward-flow/traps/comments-that-reverse-a-ruling.md`. Not mine, not staged, not touched.
- **Not run:** lint, build, `verify:cheap`, and any browser check. The gate was the two commands the
  brief specified.
