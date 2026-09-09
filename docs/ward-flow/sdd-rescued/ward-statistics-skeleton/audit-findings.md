# Model-claim audit — five FALSE, four UNEARNED, five STALE-RISK

An independent read-only audit checked every factual claim the statistics screens make about the
data model against the model itself. ~40 claims are TRUE. These are not.

**Fix the REASONS. Every refusal on this page is still correct — the page is defending right
answers with wrong statements about the data, which on this surface is the worst possible defect,
because its entire safety property is that its absences explain themselves truthfully.**

## CRITICAL 1 — the page's headline absence is defended by a false statement

`statistics-screen.tsx:373-375`, the bolded lede: _"the ones which match are **not the same
person**"_.

**FALSE.** All nine matched referrals carry the **exact `homeRegion` of the admission they match**
(RF-RPHS-01/South West, RF-RPHS-02/Kimberley, RF-RPHS-04/Perth Metropolitan, RF-RPHO-04/Wheatbelt,
RF-RPHO-05/Gascoyne, RF-SCGA-13/Pilbara, RF-SCGA-14/Peel, RF-SCGO-14/Pilbara, RF-SCGO-15/Peel —
`ward-movements.ts:1100-1245` against `ward-admissions-seed.ts:382-467`). They were authored as the
same nine people.

**The refusal survives on a much better reason.** All nine are `kind: "community_team"`,
`source: "community"`, `raisedAt` 30–86 minutes ago. They are **post-admission community follow-up
referrals, not the front-door request that produced the bed.** Measuring bed-to-referral from them
measures **the wrong event**, not a wrong person. Say that instead — it is true, it is sharper, and
it explains why no amount of id-fixing would help.

## CRITICAL 2 — the collision story is backwards

`statistics-screen.tsx:378-380`, `statistics-derivations.ts:208-213`: _"the referrals at the front
door were **numbered separately**"_ and _"nine ids therefore **collide by accident**"_.

**FALSE.** `ward-movements.ts:1080-1098` — the nine referrals were added **deliberately on
2026-09-01**, "by using the ids the admissions ALREADY hold — so not one admission changed". The
match is **authored, not accidental**. Before that they used the `RF-001` series and matched nothing.

"Nine match" stays true as a live measurement. The mechanism is the opposite of what we say.

## IMPORTANT 3 — "weeks before" is wrong for three of the nine

`statistics-derivations.ts:212-214`, `statistics-screen.tsx:380-382`. Both anchors are 642
(`ward-admissions-seed.ts:59`, `ward-sites.ts:7`), so AD-RPHO-04 arrives **1.03 days** before its
referral, AD-RPHS-04 **3.03 days**, AD-RPHS-02 **5.04 days**. All nine are still arrival-before-
referral so `chronologicallyCoherentCount` is genuinely 0 — only the magnitude word is wrong.

**The ~1-day case is the dangerous one: it looks like a rounding error rather than a category
error.** Do not replace one absolute with another; say the range and say the smallest case is small
enough to be mistaken for noise.

## IMPORTANT 4 — "nothing marks the moment preparation started" is false, and the truth is stronger

`statistics-screen.tsx:167-169`, `statistics-derivations.ts:280-281`.

**FALSE.** `ward-flow-reducer.ts:1327-1331` — `SET_BED_PREPARATION` writes `confirmedAt: event.now`
on the same object it writes `preparing` to. An instant **is** stamped.

**But no duration is recoverable, for a better reason:** `confirmedAt` is a single shared
provenance field that `CONFIRM_BED_RELEASE`, the unblock case and `RELEASE_BED` all overwrite, so
the start time is **destroyed when preparation ends**. "The record keeps one shared `confirmedAt`
that each act overwrites, so a start and an end cannot both exist" beats the current absolute.

_(This also corrects a calibration verdict I gave the auditor. I said the field had no instant. I
was wrong and it checked me.)_

## IMPORTANT 5 — the admission's instants are enumerated wrongly

`statistics-ward-screen.tsx:141-143` lists five instants. `Admission` has **seven**
(`ward-admissions.ts:313, 316, 340, 348, 353, 381, 399`) plus a nested `tentativeDiagnosis.recordedAt`
at `:154`. `awayAtEmergencyDepartmentSince` and `dischargeConfirmedAt` are omitted.

The conclusion survives — neither omitted instant marks entry to `waitlisted`. **Note this is a
propagated error: the same five-item list is copied from `ward-statistics.ts:57-58`.** Either
enumerate correctly or stop enumerating; do not copy a list from a file you cannot fix.

## UNEARNED

- **`statistics-screen.tsx:153-155`** — _"These beds are already free"_, stated flat. The module's
  own doc (`statistics-derivations.ts:294-299`) says `SET_BED_PREPARATION` has **no state guard**,
  so nothing stops a future caller setting `preparing` on an `"expected"` release. Today the
  invariant holds only by fixture accident. **This is the same capacity inversion as the "expected
  bed" defect, arriving from the other direction.**
- **`statistics-screen.tsx:377-378`** — "the admissions fixture MINTS that id from its own ward tag"
  is true of occupants but there are **three** mint sites; `departed()` (`:313`) and `waiting()`
  (`:349`) derive from the admission id, not a ward tag.
- **`statistics-ed-screen.tsx:122-123`** — "the two clocks the referral record already keeps".
  Unnamed and not defensible: `triagedAt` is **optional** and only 9 of 18 seeded referrals carry it.
- **`statistics-screen.tsx:376-377`** — "the field is populated" states a fixture fact as a model
  fact; the type is `string | null`. Mitigated by the count rendered beside it.

## STALE-RISK — pin or soften, do not just accept

- **`statistics-derivations.ts:35-36`** — _"`left` is being renamed to `departed`"_. **Nothing in
  this worktree supports it.** `"departed"` appears only in that file and its own tests. If the
  rename was abandoned, the exhaustive-switch rationale cites a plan that no longer exists.
  **Ask before rewriting — this may be real work on another branch.**
- **`statistics-ward-screen.tsx:129-131`** — "no consumer in the app". True now, pinned by nothing,
  and **the first screen to render a ward figure falsifies it — which is this page's own next step.**
- **`statistics-derivations.ts:289-291`** — "the seed's only `preparing: true` record". One fixture
  line falsifies it; no test asserts uniqueness.
- **`statistics-screen.tsx:65-66, 194-195`** — `Movement.declines` seeded non-empty (2 of 21).
  **Load-bearing for the whole "withheld, not absent" argument** and pinned by nothing.
- **`statistics-derivations.ts:287`** — `FLAG_BED_RELEASE` cited at `:1135`; the `case` is at `:1075`.

## Two defects found outside the statistics files — REPORT, do not fix

- `ward-model.ts:1042` says `Decline` has "an optional `note`". It has had none since owner ruling
  PD-6 (`ward-model.ts:255-271`).
- `ward-admissions.ts:239-240` says `referralId` is "consumed nowhere" — `referralToBedJoin`
  falsified that.

Both are another chat's files. They go to Ward Lead, not into a diff here.
