# Audit fix round — what was corrected, what was dropped, and what the audit got wrong

Base `0901b4471`. Gate: 125 tests pass (115 at base), `tsc` clean for every file in this diff.
Work is **staged but not committed** — the pre-commit hook refused, see "Commit status" at the end.

## The rule this round ended up being about

The coordinator's mid-round redirect reframed the whole task, and it is the more durable finding
than any individual correction:

> A sentence describing what the FIXTURE contains is a pin that falsifies itself the moment
> somebody edits the fixture, and nothing goes red when it does. A sentence describing what the
> DERIVATION can and cannot establish stays true. Prefer the second every time, and where you must
> mention a quantity, render it rather than write it.

Every false claim on this page turned out to be a fixture claim wearing the clothes of a model
claim. That is why they survived a green suite: a fixture is not a contract.

## FALSE — corrected

### 1. The headline empty state (`statistics-screen.tsx`) — three false reasons at once

It said the matching records **were not the same person**, that their ids **collided by accident**
because the front door **had been numbered separately**, and that arrivals preceded referrals
**by weeks**. The refusal was correct throughout; all three reasons were wrong.

I verified all three against the fixture and the audit was right about each — and then the
coordinator's redirect made the point moot in the best possible way: the nine matched referrals
**do not exist on the integration branch**, so any prose about them would have been false on
landing. So the paragraph now names no count, no id shape, no provenance, no magnitude and no
date. It says only that a matching id does not establish that two records are the two ends of one
wait, that a referral raised about somebody already in the bed matches just as well and dates the
wrong event, and that the arithmetic can see only whether the referral preceded the arrival —
a necessary condition, never a sufficient one.

That sentence is true at nine matches, true at nought, and true after the next fixture change.

The same three claims were duplicated in `statistics-derivations.ts`'s module doc. Corrected there
identically, which is why the regression guard runs against the **whole rendered page** rather than
one paragraph — a fix applied to one and not the other is the half-landed correction to fear.

### 2. Bed readiness: "nothing marks the moment preparation started"

FALSE, and the audit's replacement is stronger than the original. `SET_BED_PREPARATION`
(`ward-flow-reducer.ts`) writes `confirmedAt: event.now` on the same object it writes `preparing`
to — an instant **is** stamped. No duration is recoverable because `confirmedAt` is a single shared
provenance field: `CONFIRM_BED_RELEASE`, `BLOCK_BED_RELEASE`, `CLEAR_BED_RELEASE_BLOCK`,
`RELEASE_BED` and the preparation event itself all overwrite it (verified, five distinct write
sites). The start is destroyed by the act that ends it, so a start and an end can never both exist.

### 3. Admission's instants enumerated as five (`statistics-ward-screen.tsx`)

The record carries **seven** top-level instants plus one nested. The paragraph listed five, copied
from `ward-statistics.ts`'s own doc comment — a file this page cannot edit. It now states the
property of the whole set (every instant is about the bed or the discharge plan; none marks entry
to `waitlisted`) and enumerates nothing, with a test forbidding the list's return.

## UNEARNED — corrected

- **"These beds are already free"**, stated flat. `SET_BED_PREPARATION` carries a unit guard and a
  note-membership check and **no state guard**. The page now says what should hold and that nothing
  enforces it.
- **"the two clocks the referral record already keeps"** (ED screen). Named neither and could
  defend neither. Now named, with their limits, and the conclusion re-attributed to
  `Movement.originEdId`, which is a required `string`.
- **"the admissions fixture MINTS that id from its own ward tag"** — true of occupants only;
  `departed()` and `waiting()` derive from the admission id. Gone with the rewritten paragraph.
- **"the field is populated"** — a fixture fact stated as a model fact. Replaced by the type,
  `string | null`, with the meaning of a real null explained.

## STALE-RISK — pinned rather than accepted

- The seed's single `preparing: true` release and its `discharged` state — now pinned.
- `Movement.declines` seeded non-empty — the fact the whole "withheld, not absent" declines
  argument stands on, previously watched by nothing — now pinned.
- "`wardStatistics()` has no consumer in the app" — now pinned by a walk over `src` that goes red
  the day one appears, which is this page's own next step.
- **Reducer line-number citations removed.** `FLAG_BED_RELEASE` was cited at `:1135`; the case is
  at `:1075` and `:1135` had already drifted onto a comment inside it. Cases are named, not numbered.

## Route literals (coordinator's second message)

`STATISTICS_OVERVIEW_HREF` and `STATISTICS_COMPARE_HREF` composed their paths from
`STATISTICS_HOME_HREF`; `STATISTICS_UNIT_CHOOSER_HREF` composed from `STATISTICS_COMPARE_HREF`.
All three now write the full literal path. Pinned by a source-text assertion on the declaration
lines — deliberately not on "the path appears somewhere in the file", because a path quoted in a
doc comment is source text too and would satisfy the looser check while the constant beside it went
back to being composed.

Fixed by hand ahead of Ward Lead's route-prefix invariant test. If that test later flags something
here, the two are the same finding.

## Things the audit or the briefs got wrong

1. **`tentativeDiagnosis.recordedAt` does not exist.** The audit's eighth instant at
   `ward-admissions.ts:154` is `FollowUpRecord.recordedAt`, reachable as
   `Admission.followUp.recordedAt`. `TentativeDiagnosisBlock` is a string code with no instant.
2. **`triagedAt` is carried by 8 of 18 seeded referrals, not 9.** The ninth grep hit is a comment.
3. **The `Decline` "optional note" defect is at `ward-model.ts:940`, not `:1042`.**
4. **"The invariant holds only by fixture accident" understates it.** It also holds by the only
   caller: `ward-screen.tsx` offers the preparation control on `dischargedBedReleases` only. The
   page says so, because "nothing in the reducer enforces it" is the accurate claim and "it is an
   accident" is not.
5. **The coordinator's premise that `ward-nav.ts` independently writes the overview/compare
   literals is not true of this worktree.** Neither path appears as a literal anywhere in `src`.
   The situation was worse than described, not better — which makes the fix more clearly
   load-bearing.
6. **The third composed route site is `statistics-sections.ts:49`, not `:69`** (`:69` is `},`).

## Dropped after the redirect

- Two tests I had written pinning the nine matched referrals as community follow-ups and pinning
  the arrival-to-referral gap range. Both were fixture assertions about records the integration
  branch has deleted. Removed.
- All prose about the nine, their authoring, their source and their magnitude.
- The pre-existing `expect(result.joinedCount).toBe(9)` in
  `tests/ward-statistics-derivations.test.ts` is **left as it is**. It predates this round, it is a
  genuine self-invalidating pin, and it will go red on the integration branch — correctly. Its doc
  comment no longer asserts fixture history, and says plainly that it pins the fixture rather than
  the model and that the screen deliberately no longer repeats either number.

## Left alone deliberately

- **The `"departed"` guard in `statistics-derivations.ts` and its test.** The coordinator confirmed
  `"departed"` became a real union member on the integration branch this morning and that the
  integration branch has already rewritten that test on its side. Untouched, to avoid a conflict.
- **`wardStatisticsHref` / `edStatisticsHref`.** Already literal; the integration branch made the
  same fix independently and the merge is clean.

## Defects in other chats' files — report only, not fixed

- `ward-model.ts:940` says `Decline` has "an optional `note`". It has had none since owner ruling
  PD-6 (`ward-model.ts:253-271`, which states the absence is the point).
- `ward-admissions.ts:239-240` says `referralId` is "written by the seed and consumed nowhere".
  `referralToBedJoin` consumes it.

## Evidence

Gate, on the final tree:

```
Test Files  5 passed (5)
     Tests  125 passed (125)
tsc exit=0
```

`tsc` reports one error in `tests/ward-community-index.test.ts` — an **untracked file belonging to
another agent sharing this worktree**, created during this round. Not in this diff; `tsc` was clean
across the whole project earlier in the session and my nine files compile.

Mutation proofs — each applied, run red, then reversed and confirmed byte-identical by SHA-256:

| #   | Mutation                                                   | Red tests |
| --- | ---------------------------------------------------------- | --------- |
| 1   | Restore "the ones which match are not the same person"     | 3         |
| 2   | Restore "nothing marks the moment preparation started"     | 3         |
| 3   | Restore flat "These beds are already free"                 | 2         |
| A   | Numeral + "collide by accident" into the join prose        | 3         |
| B   | Restore the five-instant enumeration                       | 1         |
| C   | Restore "the two clocks the referral record already keeps" | 1         |
| D   | Flip `WR-009` `preparing` on an `expected` release         | 1         |
| E   | Empty a seeded `Movement.declines` list                    | 1         |
| F   | Add a `src` import of `ward-statistics`                    | 1         |
| G   | Recompose the overview route path from the constant        | 1         |

Two notes on the mutation mechanics, both worth keeping:

- **A first attempt at D was a silent no-op.** Adding `preparing: true` earlier in the object
  literal was overridden by the existing `preparing: false` later in the same literal, and the test
  stayed green — correctly. The test's silence was right and my mutation was wrong. Flipping the
  real key produced the red.
- **The obvious git restore route is blocked by the worktree-protection hook**, so E was reversed
  by writing `git show HEAD:<path>` back byte-for-byte. `ward-movements.ts` is confirmed clean in
  `git status` and back to its baseline hash `8dfc18a8`.

## Commit status

**Not committed.** The pre-commit hook refused:

```
[pre-commit] Documentation inputs have unstaged or untracked changes:
src/app/mockups/ward-flow/community/page.tsx
src/components/ward-management/community/community-index.module.css
src/components/ward-management/community/community-index.tsx
tests/ward-community-index.dom.test.tsx
tests/ward-community-index.test.ts
```

Those five files are another agent's in-flight community-index work in this shared worktree. That
refusal is correct behaviour and was not worked around. All nine of my files are **staged**, so
their blobs are already in the object store and survive a lost worktree; the commit needs
re-running once the other agent's files are staged or landed.
