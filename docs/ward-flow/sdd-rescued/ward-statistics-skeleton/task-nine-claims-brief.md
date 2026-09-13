# Nine false claims in the community files

From an independent audit at `b4736d3e4`. `HOLD_BED` and the three stale line citations are
already fixed; the empty-state sentences are held for a join fix in flight elsewhere. **These nine
remain.** Each is FALSE against the model — not merely imprecise.

**Every conclusion below survives on a corrected reason. This is rewriting, not deleting.** Where a
sentence's judgement is sound and only its stated mechanism is wrong, keep the judgement.

## 1. The demonstration clock — a defect that was FIXED

`community-screen.tsx` doc-block ~96-103, function block ~424-448, **and two pieces of RENDERED
prose**: `ward-community-departure-dates-absent` (~251-255) and `ward-community-expected-caveat`
(~332-338).

Claim: the demo clock does not shift `expectedDischargeAt`, `leftAt`, `pulledAt`,
`dischargeDateSetAt` or `dischargeConfirmedAt`, so a date shown here could be out — **therefore no
date is rendered on this screen.**

**FALSE.** `ward-reanchor.ts:74-79` names all five, plus `awayAtEmergencyDepartmentSince`. Added by
`44ca08839` ("the demo clock was leaving six admission timestamps behind"), which reached this
branch through the merge `aeff0635b`. The 500-minute figure quoted in the comment is that commit's
**pre-fix** measurement.

**The conclusion does NOT survive.** The screen withholds two dates and justifies it with a defect
that no longer exists. Correcting the prose is yours; **whether to now show the dates is a product
question — raise it, do not decide it.**

## 2. The guard reads both files

`community-screen.tsx:97-99`, restated ~430-433: _"its guard is pinned against `ward-model.ts`, and
`Admission` is declared in `ward-admissions.ts`, which that guard never reads"_.

**FALSE.** `tests/ward-reanchor.test.ts:19-20` reads **both**, and `ward-reanchor.ts:53` says so:
_"a guard that reads BOTH files"_.

## 3. The uncorrected twin

`community-derivations.ts:194-195`: _"There is no follow-up concept anywhere in this model — not a
field, not an event, not a vocabulary."_

**FALSE.** `ward-admissions.ts:159` `FOLLOW_UP_STATES`, `:168` `FollowUpRecord`, `:452`
`Admission.followUp`, `:484` the presence map.

**This is the identical claim that was corrected in `community-screen.tsx` on 2026-09-01 and left
standing here.** The register's blind spot in one line — `community-derivations.ts` was swept, the
screen was corrected, and the twin was not. Conclusion survives: nothing reads it, no event sets one.

## 4. Five destinations, not eight

`community-derivations.ts:147-151`: _"Of the five `LEAVING_DESTINATIONS`…"_

**FALSE.** `ward-admissions.ts:178-215` lists **eight**. Three were added 2026-09-01 by owner ruling:
`died-on-the-ward`, `transferred-to-custody`, `did-not-return`.

Conclusion survives — only `discharged-to-the-community` still records a return to the community.
**Rewrite the enumeration; do not delete the judgement.**

## 5. ⚠️ THE CLINICALLY SHARPEST ONE

`community-derivations.ts:202-203`, the `otherDepartures` doc: _"Every other recorded departure for
this team — **transfers, residential care, and admissions that ended against advice**"_.

**FALSE, same three additions.** `otherDepartures` now also carries **death on the ward** and
**transfer to custody** — and `community-screen.tsx:267` renders their labels verbatim into
`ward-community-other-departures`.

**So a coordinator can read "recorded as: Died on the ward" on screen, beside a doc comment
promising only transfers and against-advice departures.** Of the nine this is the one to get right.

## 6. The rail shortfall, inverted

`community-screen.tsx:358-360`: _"the rail can carry one concrete example of a dynamic route, and
`tests/ward-nav.test.ts` records exactly that shortfall"_.

**FALSE.** That test records the OPPOSITE: _"0 of 65 instances reachable without state … NOTHING
links to it."_ No community href exists in `ward-management-navigation.tsx`. The "1 of N" shape
belongs to `/board/[unitId]`.

## 7. Nine teams, ten pages

`community-screen.tsx:356-358`: _"the other **nine** teams"_, _"the only way to reach **nine of the
ten** pages"_.

**FALSE.** 65 clinics; the nav beneath renders 64 links. "Ten" is residue from the region era —
`ward-teams.ts:28` is `Record<HomeRegion, string>`, ten regions.

**Do not write a number.** The numeral guard in `tests/ward-community-index.test.ts` is scoped to
`community-index.tsx`'s doc comment only, so this file's counts are unguarded — which is how they
survived. Describe the set, or render the count.

## 8. Recursion, inverted

`community-screen.tsx:49`: _"`ward-reanchor.ts` touches it only because the clock shift **recurses**
through nested instants."_

**FALSE.** `ward-reanchor.ts:80-83` names `recordedAt` **explicitly and deliberately**, with its own
comment: _"a nested instant is exactly the kind this set loses track of, which is why it is named
here rather than left for the reader to notice."_ Conclusion survives; the mechanism is inverted.

## 9. "A complete picture" — UNEARNED, and it is in bold

`community-screen.tsx:189-191`, rendered: _"**This page is a complete picture of who was referred to
this team.**"_

Complete only among admissions whose `referralId` resolves — which is **none**. The bold makes it
the strongest claim on the screen and the code supports only _"of those referrals this prototype can
resolve"_.

**Related and worth fixing with it:** `:199` says _"Everyone below is here because a referral named
{team.name} as a destination"_ — true of the filter, but there is no counterpart sentence saying who
is MISSING because their referral could not be found, which is the actual population.

## Constraints

- **Files:** `community-screen.tsx`, `community-derivations.ts`, `tests/ward-community-*`. Nothing
  else. `ward-reanchor.ts`, `ward-admissions.ts`, the seed and everything in `statistics/` are READ
  ONLY.
- **Do NOT touch the four empty-state sentences** (`ward-community-follow-up-not-recorded`,
  `ward-community-discharged-empty`, `ward-community-unattributable`). They wait on a join fix in
  flight in another worktree.
- **Verify every citation yourself before writing it.** These numbers moved twice today.
- **Cite by symbol name with the line as a hint.** A bare number is a self-invalidating pin.
- **Add an assertion per rewritten claim** proving the false wording cannot return — assert the
  ABSENCE of the old phrasing, not only the presence of the new.

## Gate

```
npx tsc -p tsconfig.typecheck.json --noEmit
npx vitest run $(ls tests/ward-community*.test.ts tests/ward-community*.test.tsx | tr '\n' ' ')
```

Echo the discovered list, refuse an empty discovery, **report the RAN count not the passed count**.
