# Ward Verifier — cross-branch review of tonight's work, 2026-09-04 ~09:30

Four ward branches are live, diverged and unfolded. This reviews what only shows up when you look
across all four at once; each session's own review necessarily stops at its branch tip.

    M = codex/task-ward-flow-live-state-20260831   master line
    T = claude/ward-builder-two
    C = claude/ward-builder-community-route
    R = claude/ward-builder-three

Merge-bases are a chain, not one point — BT `a498760` (T forked first), BC `bc5e13c78`, BR `022d88aff`.
Everything below is MEASURED against refs. `ward-management-console.tsx` and
`ward-management.module.css` were never opened (hard lock); where they appear it is as a filename in
a diffstat only.

---

## 1. 🔴 THE PRINT DEFECT WAS FOUND AND PATCHED INDEPENDENTLY ON ALL FOUR BRANCHES

Not two sessions, as I first reported — **four**, across ten separately-authored commits.

| commit      | branch | stylesheets                                                                               |
| ----------- | ------ | ----------------------------------------------------------------------------------------- |
| `85d6adeed` | M      | add-patient, person, ward-management-modes, ward-management, ward, ward-index (6)         |
| `0ef11cb62` | C      | board, community-index, community, coordinator, discharges, ed, escalation, referrals (8) |
| `91b13615f` | C      | board, coordinator, discharges, escalation                                                |
| `baea3050c` | C      | community-index, community, ed                                                            |
| `13ce647de` | T      | handover, morning, officer, out-of-area                                                   |
| `522b84d7c` | T      | search                                                                                    |
| `b52eb53e4` | T      | patient search table                                                                      |
| `be9387c55` | R      | statistics-sections, live-tracker                                                         |
| `36a5a6c93` | M      | ward-management                                                                           |
| `bc5e13c78` | M      | ward-shell, wards/ward-overview                                                           |

**Every file set is disjoint.** That is why `git merge-tree` reports nothing: there is no conflict,
because nobody edited the same file. The cost is not a merge problem, it is a **coverage** problem —
no branch's diff can tell you whether all screens are now covered, and each session believes it
fixed "the" defect.

🔴 **And none of the ten touched the shared source.** `ward-tokens.module.css` has two commits in
its whole history — its creation and one token addition — and neither is a print fix. So the root
cause was patched symptomatically ten times, screen by screen, and the eleventh screen anyone adds
will reintroduce it.

**Correction to my own earlier report:** I said "six files each". `85d6adeed` is 6, `0ef11cb62` is 8.

---

## 2. 🔴 TWO MERGE CONFLICTS, AND IN ONE OF THEM THE WEAKER RESOLUTION IS THE GREEN ONE

### `tests/ui-ward-referrals.spec.ts` — M vs R — **one-directional, take M**

Both sides independently set `SEEDED_DECIDED = 9` after the fixture grew (M via `0f4795b52`, R via
`8e24c17cf`). They agree on the number. But the diff is a **single hunk** and it is a strict
subtraction: M carries a top-level staleness guard that R does not.

    const decidedInTheSeed = referrals.filter((referral) =>
      referral.destinations.some((destination) => destination.state !== "queued"),
    ).length;
    if (decidedInTheSeed !== SEEDED_DECIDED) { throw new Error(...) }

R has nothing in this file that M lacks. **Resolution: take M's side wholesale.** The hazard is that
both sides say `9`, so a resolver who picks R gets a green test and has silently deleted the guard
whose entire purpose is stopping this constant going stale a third time.

I checked the guard actually holds rather than assuming it: on M's fixture, 13 referrals,
structural predicate **9**, `recentlyDecidedReferrals` **9**, constant **9** — it passes, and it is
independent of the function under test, so it is not a tautology.

### `tests/ward-design-language-contract.test.ts` — M vs T — **union required, not a side**

Here both sides carry things the other lacks. **MUST SURVIVE THE FOLD:**

- **M only:** `firstRule()` (finds the outermost class rule by name, not literally `.screen`);
  `NOT_A_SCREEN` exclusion set of 7 structural files; the named `OPAQUE_SURFACES` regex covering 7
  surface spellings including the `--ward-canvas`/`--ward-chrome`/`--ward-subtle` aliases; and the
  whole `it("keeps the assumption the root detector rests on: where .screen exists, it is the first
rule")` block with its two assertions. T's detector is the older narrow one — literal `.screen`,
  literal `var(--surface)`.
- **M only, backlog rows:** handover, morning, officer, out-of-area, search, ward-management-modes.
- **T only, backlog rows:** patients/add-patient, patients/person, ward/ward, wards/ward-index.

⚠️ Do not "keep the union" of those two lists mechanically. They are pins on a backlog, and the two
lists diverged for opposite reasons — M's rewritten detector _found_ new files and _freed_ four
others; T's list still carries those four because T deliberately left them alone. Whether the four
T-only rows are still covering the ground **under M's broader detector** is unmeasured and has to be
re-derived after the fold, not carried over.

---

## 3. ⚠️ FIVE FILES ARE BYTE-IDENTICAL ON TWO BRANCHES — THE SAME RENAME INVENTED TWICE

`statistics-claims-register.ts`, `statistics-compare-screen.tsx`, `statistics-ed-screen.tsx`,
`statistics-overview-screen.tsx`, `statistics-ward-screen.tsx` are **byte-identical** on T and R.
Both branches independently renamed `.field` → `.fieldName`, and R's commit message says its mapping
was "derived independently from the stylesheet and the token layer before the existing mapping table
was read".

They converged. **That was luck, not coordination** — and a merge tool will report zero conflicts,
so nothing will ever surface that the work was done twice.

🔴 **The artefact that was supposed to prevent this is itself single-branch.**
`docs/ward-flow/design/screen-adoption-playbook.md` exists only on T. R verified its renames against
a mapping table and never wrote back to it. So no branch's copy of the plan can answer "which
screens are adopted, onto which token names, and what collisions remain" — the true state exists
only by diffing four live trees, which is what this review had to do.

---

## 4. QUIET RISKS — TOUCHED ON MULTIPLE BRANCHES, NO CONFLICT REPORTED

A clean merge here means a silent combine, not a reviewed one:

- `tests/ward-primitives-shared.test.ts` — M, R, T. M+T merges clean; **T+R conflicts.**
- `ward-management-modes.tsx` and `.module.css` — M+R, clean. M authored the base, R refactored on
  top with no textual overlap.
- `tests/ward-design-language-contract.test.ts` — the M+C leg is clean even though the M+T leg
  conflicts.

Checking each branch against M alone misses the T↔R collisions entirely, because neither is M.

---

## 5. A MEASUREMENT I CANNOT REPRODUCE, REPORTED BECAUSE IT WAS USED AS EVIDENCE

Ward Builder Three reported cross-checking the decided-referral count structurally and getting
**ten** against the function's nine, explaining it as "one queued referral holds a decided
destination beside a pending one", and drew a lesson from the disagreement.

MEASURED on the fixture, which is **byte-identical on M and R** (so this is not a tree difference):
13 referrals; destination states in use are `accepted`, `declined`, `queued`; and the count is
**9 under every structural definition I could construct** — `some(state !== "queued")`,
`some(accepted|declined)`, `every(state !== "queued")`, `not every queued` — all 9, matching
`recentlyDecidedReferrals` exactly. **Referrals holding a mix of queued and non-queued destinations:
zero.** So the stated cause cannot be the cause.

The methodological lesson Three drew stands on its own and I am not disputing it. But the figure was
offered as its evidence, and it does not reproduce. Worth them re-running, because if some predicate
does give ten I want to know which — and if none does, then their proxy would have agreed with the
property all along, which makes the guard on M safer than either of us thought.

---

## WHAT I HAVE NOT REVIEWED

Roughly 300 commits landed across four branches since 18:00 yesterday. This review covers
cross-branch collision, duplication and fold hazard only. It does **not** re-review the clinical
wording, the design adoptions, or the individual guards on their own terms — each branch's own
session has done that, and I reviewed Ward Lead's six wording fixes separately
(`verifier-ward-lead-clinical-fixes-2026-09-04.md`).

---

# ADDENDUM — PRINT COVERAGE MEASURED, AND A FOLD HAZARD ON `board.module.css`

## 🔴 `board/board.module.css` is fixed on C and still broken on M

| ref | print block           | selector rules | `color:` decls | wildcard reset               |
| --- | --------------------- | -------------- | -------------- | ---------------------------- |
| M   | lines 1568–2095 (528) | 85             | 11             | **none**                     |
| C   | lines 1580–2123 (544) | 87             | 13             | `.screen, .screen *` present |

M made no post-fork change to that region, so `merge-tree` is silent and a resolver has no reason to
look at it. **Take C's board.** This is the clearest instance of the general hazard: the fix is only
visible if you compare the two trees, and nothing in either branch's own history points at it.

## Coverage of the descendant print reset

My raw first figure was "30 of 42 stylesheets have no reset". **That measured the wrong unit** — most
of those files are chips, panels, figures and token layers that never define a printable root. It was
not sent. Corrected:

- 42 ward stylesheets; **41 assessable** (`ward-management.module.css` is on the hard lock; `85d6adeed`'s
  diffstat says it was fixed — commit narrative, not measurement).
- **25 define a printable screen root** — 21 via `.screen`, 4 via a differently-named root: `.tour`
  (morning-tour), `.modeShell` (ward-management-modes), `.networkPage` (ward-management-network),
  `.shell` (ward-shell). Two independent criteria — "has a top-level root class" and "has any
  `@media print` block" — produced the SAME set, which is some evidence the definition is not arbitrary.
- **13 have the reset**: 8 from C's `0ef11cb62`, 5 assessable from M's `85d6adeed`. Disjoint; the union
  reconciles exactly against both diffstats.
- **12 lack it. Only 3 are at risk:**

| file                                 | print block | colour decls                       | note                                                                                                                                                                                                        |
| ------------------------------------ | ----------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `handover.module.css`                | 62 lines    | `.crossLink { color: CanvasText }` | no reset                                                                                                                                                                                                    |
| `morning.module.css`                 | 250 lines   | 4                                  | no reset                                                                                                                                                                                                    |
| `ward-management-network.module.css` | 250 lines   | 5                                  | already forces `color … !important` on several descendants and carries scoped `.legend *` / `.shortlistPanel *` resets — part of the gap may already be closed; proving it needs cascade analysis, not grep |

- **The other 9 are explicitly NOT at risk**, stated rather than left on a list: **7 have no `@media print`
  block at all**; 2 have one with no colour declarations (`morning-tour` suppresses its whole subtree
  with `display: none !important`; `ward-shell` only sets a background).

⚠️ **A false positive that nearly went the other way.** The first pass counted `morning-tour.module.css`
as covered because it does contain `.tour * {` — but that rule sits inside
`@media (prefers-reduced-motion: reduce)`, not `@media print`. **A wildcard match is not a print reset.**
Any scan of this shape must verify the ENCLOSING media block, not just the selector.

## Correction to my own brief

I wrote that commit `85d6adeed`'s **message** describes board as enumerating "56 selectors across a
250-line print block and still missing five". Wrong artefact: that text is in the **code comment**
`85d6adeed` adds; the "56 / missed five" phrasing is in **C's** `0ef11cb62` message; and neither message
contains "250-line" at all. I cited a claim by pointing at the wrong place — the recruiting-comment
failure, committed inside a brief about it. The "still missed five" claim remains unverified by anyone;
confirming it needs specificity analysis over all 87 selectors.

---

# CLOSURE ON FINDING 5 — THE "TEN" WAS A STRING IN A DOC COMMENT

Ward Builder Three re-ran it and found the mechanism, at `482746f90`. Their count reproduces at 10,
so it was not a typo. **The extra member is RF-011, and its match is prose** — a doc comment reading
_"`decidedAt` on each ED arm is the moment its movement opened…"_. Its actual destinations are
`['queued', 'queued']`.

**Strip comments first and the structural count is 9, naming exactly the nine ids the function
returns.** The proxy and the property agreed all along.

⚠️ **So this was the comment-satisfies-a-text-scan failure again** — the same class as the eight
guards a comment could satisfy, and as the claims register that goes green when the watched code is
commented out. It is the fourth instance tonight, and the first where a comment produced a
_fabricated_ discrepancy rather than hiding a real one.

⚠️ **And the reason it stood unchecked is worth more than the number.** It was offered as a
self-criticism, and a self-critical claim inherits the credibility of the admission — the admission
and the measurement inside it are not the same thing. Three's own retraction of a larger finding
earlier that night was checked by three people; this smaller one, pointing the same direction, was
checked by nobody. **The direction of a claim is not evidence about it.**

The consequence for the fold: Ward Lead's structural guard on `ui-ward-referrals.spec.ts` is sound,
and the doubt cast on it — in a code comment, on the file the guard lives in — has been corrected in
place rather than deleted, because the false version had already been cited to two other sessions.

---

# CORRECTIONS, 2026-09-04 ~10:15 — TWO OF MINE WRONG, ONE EXPIRED, AND THE ROOT CAUSE PROVEN CURABLE

## ⚠️ EXPIRED — the `board.module.css` fold-loss finding is DEAD. Do not act on it.

MEASURED at M tip `3d0019346` (09:28) it was true. **M moved to `0a890fa66` (10:05)** — the merge of
Ward Builder Three — and the board blob is now `6859812f71dc…` on BOTH lines, `.screen *` present
twice on M. C's four commits are ancestors. **Shelf life: 37 minutes.** That is a property of
reviewing four moving branches, not a one-off.

⚠️ Ward Builder One nearly confirmed it wrongly, and the near-miss is instructive: their first check
used a _wider_ grep on M than on their own branch, which would have produced a like-for-like failure
that AGREED with me. They caught it because the patterns differed, not because the answer looked
wrong. **A confirmation is exactly when nobody re-reads the method** — and it would have been my
finding being confirmed, so I would not have looked either.

## 🔴 WRONG — `ward-tokens.module.css` has FIVE commits, not two

I wrote "two commits in its whole history — its creation and one token addition", in a commit
message and to four chats. On M: `a138ea14a` (creation), `dc58f6744` (the `--ward-z-phone` split),
`273d5231d` and `578afb79c` (two divider repairs), `585a905d1` (the tap token). Caught by Ward
Builder Two.

**The substantive claim survives — none of the five is a print fix.** But I asserted a file history I
had not read, inside a review whose subject is people asserting things they had not checked.

## 🔴 THE ROOT CAUSE IS CURABLE, AND CENTRALLY — measured by Ward Builder One, not by me

I raised "none of the ten patches touched the token layer" and left it as a complaint. They tested
it in Chromium 151: reset placed **only** in the token class, screen file carrying **no print block
at all**, under `@media print` with dark colour-scheme genuinely active (control passed):

    root's own text   rgb(0, 0, 0)     the element that declares the colour ITSELF
    deep .table td    rgb(0, 0, 0)     the compound selector that defeats a `.screen *` wildcard
    card background   rgb(255, 255, 255)

The `.table td` result is the decisive one: the central fix is not merely equivalent to the ten
patches, it is **stronger** than the wildcard they use.

⚠️ **Why everyone believed it impossible.** Three files record that this "is not fixable centrally at
`.shell` — a colour set on an ancestor cannot beat the element's own declaration". **That is true,
and it is about an ancestor.** `composes` is not an ancestor: it puts the token class on the SAME
element, so the central rule lands exactly where the offending declaration lives. A correct comment,
written in good faith, closed a question it had no business closing — recorded in three files, so it
closed it three times. 20 files compose that layer; it has zero `@media print` blocks.

## REFINEMENT — the conflict topology, stated pairwise

I wrote that the design-language contract "conflicts with M and with R and with C's leg differently",
which conflated three pairwise facts into an implied three-way split. Pairwise:

    T <-> R    2 conflicts   ward-design-language-contract.test.ts, ward-primitives-shared.test.ts
    T <-> M    1 conflict    ward-design-language-contract.test.ts
    R <-> M    1 conflict    ui-ward-referrals.spec.ts

**M and R do NOT conflict on the design-language contract.** So it is T's version against a consensus
the other two already share — which changes who resolves it and in which direction.

## SETTLED — a prediction about R's branch, falsified

Ward Builder Two predicted three claim locators would be RED on R's branch, flagged it as predicted
rather than run, and named the condition under which it would be wrong: `renderedIn` pointing
somewhere they had not looked. **It does.** All three resolve to `STATISTICS_SCREEN` =
`statistics/statistics-screen.tsx`, a FIFTH file outside the four byte-identical ones (blobs differ:
R `c20508d8c`, T `208a4af7c`). On R that file emits `styles.field}` **11** times and
`styles.fieldName}` **0**, and simulating the assertion exactly — whitespace-collapsed surface and
`rendered`, `countOccurrences` — each of the three finds **exactly one**. **Green, correctly.**

R's rename is not incomplete; it is internally consistent at a different boundary from T's. Two
coherent states, not one broken one.

⚠️ **Which inverts the hazard: neither branch is red, and the red state is one only a MERGE can
create** — T's register on `styles.fieldName` beside R's screen on `styles.field`, and all three
claims find zero. A clean merge is not a consistent one here.

## THE THEME ACROSS ALL FOUR INVESTIGATIONS

Comments were the load-bearing failure, and **not one of them was wrong**. The "cannot fix centrally"
note was true of an ancestor; the people route's parity note was true when written; `decidedAt`
matched inside prose that accurately described the field; the claims register goes green when the
watched line is commented out. **True statements applied one step outside their scope, each closing a
question nobody reopened.**
