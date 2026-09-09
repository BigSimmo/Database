# Nine false claims in the community files — repair report

**Status: DONE_WITH_CONCERNS** (the concerns are two open product questions and one scope note, not
defects in the work).

Branch `claude/ward-builder-community-route`, worktree `D:/Worktrees/Database/ward-builder-community-route`.

## Gate

Both commands were run, from the worktree root, after formatting.

```
npx tsc -p tsconfig.typecheck.json --noEmit          → exit 0, no diagnostics
```

Test discovery echoed verbatim from `ls tests/ward-community*.test.ts tests/ward-community*.test.tsx`:

```
tests/ward-community-corrected-claims.test.ts
tests/ward-community-hub.dom.test.tsx
tests/ward-community-hub.test.ts
tests/ward-community-index.dom.test.tsx
tests/ward-community-index.test.ts
tests/ward-community-referral-survives.test.ts
```

Six files discovered — not empty, so the run proceeded.

```
Test Files  6 passed (6)
      Tests  76 passed | 1 expected fail (77)
```

**RAN: 77 tests across 6 files.** (The one "expected fail" is the pre-existing `it.fails`
reachability tripwire in `ward-community-index.dom.test.tsx`; it is not mine and is unchanged.)

Also run, because the register and the lint rules could have been broken by these edits:

- `npx vitest run tests/ward-statistics-claims.test.ts` → **19 passed**. No registered claim's
  evidence pin was disturbed. **Nothing was reported to you as a broken claim id because nothing
  broke** — I checked the seven register entries whose `sourceFile` is `COMMUNITY_SCREEN` or
  `COMMUNITY_DERIVATIONS` before writing (they pin `"use client";`, the `communityTeamHref`
  signature, the `<nav className={styles.teamSwitcher}…>` JSX, the `CommunityTeam` type body,
  `id: communityTeamSlug(name),`, the `COMMUNITY_TEAM_PAGES` declaration and its `.map` tail), and
  none of them cites a byte of prose I rewrote. The register was not edited.
- `npx eslint` on the three changed source/test files → clean, no output.

## Verification of the brief's citations

Every citation was opened and checked here rather than trusted. All of the brief's evidence held.

| Cited                                                    | Verified                                                                                                    |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `INSTANT_FIELDS` names the six admission instants        | Yes — `ward-reanchor.ts`, entries between the `Admission` comment and `triagedAt`, plus nested `recordedAt` |
| `tests/ward-reanchor.test.ts` reads both files           | Yes — `MODEL_FILES` lists `ward-model.ts` and `ward-admissions.ts`                                          |
| `44ca08839` / merge `aeff0635b`                          | Yes — `git log` confirms both subjects verbatim                                                             |
| `LEAVING_DESTINATIONS` has eight members                 | Yes — five original plus `died-on-the-ward`, `transferred-to-custody`, `did-not-return`, all `2026-09-01`   |
| `Admission.followUp` / `FollowUpRecord` / vocabulary     | Yes — `ward-admissions.ts` `:452`, `:484`, `:168`, `:159`; seed writes records at `:733` and `:770`         |
| `ward-flow-reducer.ts` only ever writes `followUp: null` | Yes — `:941`, inside `case "PULL_PATIENT"` at `:811`; that is the only mention in the file                  |
| `ward-nav.test.ts` records the community route as orphan | Yes — its entry says nought reachable without state and "NOTHING links to it"                               |
| No community href in navigation                          | Yes — `grep -n community src/components/ward-management/ward-management-navigation.tsx` returns nothing     |
| `ward-teams.ts:28` is `Record<HomeRegion, string>`       | Yes — ten region keys, which is where the retired page count came from                                      |

Citations in the rewritten prose are by **symbol name** (`INSTANT_FIELDS`, `MODEL_FILES`,
`FOLLOW_UP_STATES`, `LEAVING_DESTINATIONS`, `Admission.followUp`), with line numbers only as
"around `:NNN`" hints where a reader needs a starting point in a 572-line file.

## What was changed, claim by claim

**1 — the demonstration clock (four sites).** The screen justified withholding two dates with a
re-anchor defect that `44ca08839` fixed. Corrected in the header doc block, in `expectedBackLabel`'s
own block, and in both rendered caveats (`ward-community-departure-dates-absent`,
`ward-community-expected-caveat`). **The render is unchanged** — both dates are still withheld, per
your ruling. The rendered prose now gives the reason that is still true (every date in this fixture
is invented, and the page states only that a date exists) and says the decision is the owner's. The
doc blocks carry the full record: what the old sentence claimed, the commit that falsified it, and
that the offset measurement quoted before was taken pre-fix.

**2 — "a guard that never reads `ward-admissions.ts`".** Both statements of it (header block and
`expectedBackLabel` block) now say the guard derives its expectation from both model files and name
`MODEL_FILES`. Pinned by a live check that reads `tests/ward-reanchor.test.ts` for both paths, so
this cannot outlive its subject.

**3 — the uncorrected follow-up twin.** `community-derivations.ts` now carries the same corrected
statement `community-screen.tsx` already had: the field, the record shape, the vocabulary and the
seeded values all exist; what is true is that it has **no producer and no consumer**. The conclusion
(this is not the spec's list 1, and an empty list is not an all-clear) is unchanged.

**4 — "of the five `LEAVING_DESTINATIONS`".** Rewritten as an enumeration with **no count at all**,
for the same reason as item 7: a figure typed into prose has no guard. Every non-community member is
now described, including the three added by the owner's ruling.

**5 — the clinically sharpest one.** The `otherDepartures` doc now leads with the two destinations a
coordinator can actually read on screen: **deaths on the ward and transfers into police or prison
custody**, followed by hospital transfers, residential care, against-advice endings and
`did-not-return`. It states that the screen renders those labels verbatim, so the comment cannot
promise a gentler list than the page shows. **This one is proved on the rendered page, not only in
prose**: a test renders a `died-on-the-ward` and a `transferred-to-custody` departure and asserts
"Died on the ward" and "Transferred to police or prison custody" appear in the footnote.

**6 — the rail shortfall, inverted.** The switcher comment now says what `ward-nav.test.ts` actually
records: nought of this route's instances are reachable without state, nothing links to it, and the
switcher is the way **across** rather than the way **in**. It notes that the "one seeded example,
rest built" shape belongs to `board/[unitId]`. A test reads `ward-nav.test.ts` for that record, so
the day somebody links the route this pin goes red and the comment must be revisited rather than
quietly describing a fixed orphan.

**7 — nine teams / ten pages.** **No number is written.** The comment describes the set and notes
that the size is a property of the extracted catchment table. The guard is scoped to that comment
and is two-part: no numeral survives stripping ISO dates, and no spelled-out count word appears —
checked by splitting the region into words rather than by substring, because "written" contains
"ten" and a substring scan would fail correct prose.

**8 — recursion, inverted.** Both places that carried it (the screen's header block and the
explanatory block in `tests/ward-community-index.test.ts`) now say `INSTANT_FIELDS` names
`recordedAt` explicitly and deliberately, quoting the reason that set gives for naming it. The
conclusion is untouched. The inversion mattered because "it happens to be reached" invites somebody
to stop naming nested fields, which is the failure that set exists to prevent.

**9 — "a complete picture", in bold.** The rendered sentence now says the page shows everyone this
prototype could **match** to the team — the people whose admission points at a referral it can find
that names the team — and adds what was missing: an admission whose referral cannot be found is
counted in the figure above and appears on no team's page. A **counterpart sentence** was added to
`ward-community-association` naming that missing population, which is what the brief asked for. The
same unearned claim was fixed in its two twins (the header block's point 2 and
`admissionsWithNoCommunityTeam`'s doc). Falsified by a test that renders an admission pointing at a
non-existent referral id and asserts it appears on no list and is counted.

**A tenth, found while working.** `tests/ward-community-hub.test.ts` carried "one of the five
vocabulary entries" in a comment — the same stale count as item 4, in a file in my scope. Corrected;
the assertion beneath it always read `LEAVING_DESTINATIONS` and was never wrong.

## Assertions — how they were checked

New file `tests/ward-community-corrected-claims.test.ts` (25 tests). Each claim has **both** a
presence pin on the corrected wording and an **absence** pin on the false wording, as instructed.

Three deliberate design choices, all of them about the trap you named:

1. **Non-vacuity floors before every absence.** `sourceOf` refuses a file under 2000 bytes; the page
   render is asserted to have produced over 2000 characters of visible text and to contain the three
   testids being scanned; the switcher-comment slice asserts both of its bounds. A `not.toContain`
   passes against an empty string, and every one of these absences would have been vacuous without a
   floor above it.
2. **Prose is normalised before scanning.** A doc comment wraps at the print width, so a false
   sentence lives in the file as `phrase\n * continues`. A raw `not.toContain` for that sentence
   would pass while the sentence was sitting in the file, wrapped one word differently — an
   assertion that passes whether or not the code is right. `proseOf` strips the comment scaffolding
   and collapses whitespace on both sides.
3. **The retired phrases are not quoted in the source files.** Each correction note describes what
   the old sentence claimed rather than reproducing it, so the absence pins can be plain substring
   checks. This cost some rewriting: my first drafts of five of the nine notes quoted the false
   sentence as history, which would have made every corresponding absence pin unfalsifiable.

**Mutation-tested, one claim at a time.** Both source files were copied out and their SHA-256
recorded; each false sentence was reintroduced in a realistic form, the suite run, then the files
restored and the hashes re-verified as `OK`. Every pin fired, and only the pin for the mutated claim:

| Mutation                                  | Test that went red                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| clock caveat blames the fixed re-anchor   | "the two rendered caveats no longer justify a withheld date…"          |
| "which that guard never reads" restored   | "neither doc block asserts the repaired defect any more"               |
| follow-up denial restored                 | "the false denial is gone from the derivations, in every form it took" |
| "Of the five `LEAVING_DESTINATIONS`"      | "no count of the vocabulary is written into the derivations prose"     |
| `otherDepartures` gentle promise restored | "the otherDepartures comment no longer promises only transfers…"       |
| rail-shortfall claim restored             | "no longer claims the rail already reaches this route"                 |
| "the other nine teams, of the ten pages"  | "contains no count of the teams or of the pages, in any form"          |
| recursion mechanism restored              | "the false mechanism is gone from both files that carried it"          |
| "a complete picture of who was referred"  | "the unearned completeness claim is gone…" **and** the conditional pin |

Existing assertions that could have made the rewrites unfalsifiable were checked and preserved
deliberately, not by luck: `"It is not a picture of an area"`, `"The date itself is not shown"`,
`"No row above says when somebody left"`, `` `a referral named ${TEAM_A.name} as a destination` ``
and `"— <strong>not</strong> everyone who is missing follow-up"` all still hold.

**One weakness found and fixed during mutation testing.** The switcher-comment slice was first
anchored on a phrase inside the comment. A mutation that rewrote the comment made the region
unfindable, so the whole suite failed to **collect** rather than failing on the claim — fail-closed,
but it masks the other assertions. It is now anchored on the `<nav className={styles.teamSwitcher}>`
element it documents, which the claims register pins independently.

## Files touched

Editable-scope only. Nothing under `statistics/`, and `ward-reanchor.ts`, `ward-admissions.ts` and
`ward-admissions-seed.ts` were read but never written.

- `src/components/ward-management/community/community-screen.tsx`
- `src/components/ward-management/community/community-derivations.ts`
- `tests/ward-community-corrected-claims.test.ts` (new)
- `tests/ward-community-hub.dom.test.tsx` (stale clock rationale in a block comment)
- `tests/ward-community-hub.test.ts` (the tenth stale count)
- `tests/ward-community-index.test.ts` (the item-8 twin)

The four held empty-state sentences (`ward-community-follow-up-not-recorded`,
`ward-community-discharged-empty`, `ward-community-unattributable`) were **not** touched. Note that
`ward-community-unattributable`'s _paragraph_ is the site of claim 9, so its closing bold sentence
did change; the empty-state/nought-branch sentence at the start of that paragraph — the count line
and its "on no community team's page" wording, which is what the join fix in flight will affect — is
byte-identical, and the existing assertions on it still pass.

## Concerns

1. **Product question, item 1 — raised, not decided.** The defect that justified withholding
   `expectedDischargeAt` and `leftAt` from this screen is fixed; those dates and `now` are on one
   clock. Whether the community hub should now show them is the owner's call. The remaining argument
   for withholding is that every date in this fixture is invented, which is an argument about the
   prototype rather than about the model. The render is unchanged and the DOM assertions that forbid
   an instant on this page are unchanged, so a change of mind will show up as a deliberate test edit
   rather than as a silent one.
2. **Product question, item 5 — worth the owner's eye even though the prose is now correct.** The
   footnote reads, verbatim, `… have ended, recorded as: Died on the ward; Transferred to police or
prison custody. None of those records says the person came back into the community, so none is on
the list above.` Every word of that is true, and the second sentence is a strange thing to say
   about a death. I have not changed it: the brief scoped item 5 to the false doc comment, and
   rewording a rendered clinical sentence is a copy decision. Flagging it because a coordinator reads
   it, not because it is inaccurate.
3. **Scope note.** Item 3's twin problem recurred within item 9 — the unearned completeness claim
   existed in three places, only one of which the brief cited. I fixed all three, on the same
   reasoning the brief gives for item 3. If that was outside intended scope, the two extra sites are
   the header doc block's point 2 and `admissionsWithNoCommunityTeam`'s doc comment.
4. **Not run.** No broad gate (`verify:cheap`, `verify:pr-local`), no browser check, nothing
   provider-backed. The change is prose plus one new offline test file; `tsc`, the six community
   suites, the claims-register suite and `eslint` on the changed files are the coverage. An untracked
   file belonging to another agent, `docs/ward-flow/traps/fixture-contingent-branches.md`, was left
   alone and not staged.
