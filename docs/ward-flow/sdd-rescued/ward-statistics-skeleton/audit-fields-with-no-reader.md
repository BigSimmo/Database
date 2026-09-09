# Ward Flow — fields written but never displayed

Mirror audit of `docs/ward-flow/fields-with-no-producer-2026-09-01.md` (the no-PRODUCER side).
This is the no-READER side: a field the app writes that no screen ever renders back.

Scope covered, in priority order: `Admission` (`ward-admissions.ts`) — full pass. `Movement`
(`ward-model.ts` type + `ward-movements.ts` fixtures) — full pass. `Referral` (`ward-model.ts`)
— partial pass. `Unit`/bed types (`ward-model.ts`) — **not reached**, see Coverage below.

Method: grepped every field name across all `.tsx` components under `src/components/ward-management/`,
then opened each file to confirm the match is a real DOM render (JSX interpolation, `.map` into
list items) rather than a filter/derivation/comment. "Displayed via a derivation" is stated
explicitly where the raw field value only reaches the screen through a computed intermediate
(e.g. `BedRelease.confirmedAt`).

---

## 1. `Admission.leavingDestination` — WRITTEN, NEVER DISPLAYED (except one narrow path)

- **Type**: `LeavingDestination | null`, declared `ward-admissions.ts:432`.
- **What writes it**: `board/ward-board.tsx:1400-1424`, the `RECORD_LEAVING` dispatch —
  `leavingDestination` taken straight from component state.
- **Risky default — CONFIRMED, this is the case in the brief**:
  `board/ward-board.tsx:681`: `const [leavingDestination, setLeavingDestination] =
useState<LeavingDestination>(LEAVING_DESTINATIONS[0].id);` — pre-selected on
  `"discharged-to-the-community"`, the only option where `countsAsStatewideRelease: true` in the
  sense of leaving the whole system unambiguously as the _first_ and most consequential entry. A
  coordinator who clicks "Record that they have left" without touching the `<select>` records
  that the person left the entire state system.
- **What a wrong value means clinically**: the network-wide released-bed count
  (`statewideReleaseCount`, `ward-discharge-dates.ts:203`) and every screen built on it treats the
  person as gone from psychiatric care entirely, when they may still be in another ward's bed.
- **Display**: the ward's own board never renders a departed admission's `leavingDestination`
  back (departed admissions are filtered out of `admissionsForUnit`/`buildOccupants` entirely).
  The ONE place the value is ever shown is `community/community-screen.tsx:552-556`
  (`otherDepartureDestinations`, feeding the sentence at line 306) — and only for admissions whose
  `referralId` resolves to a referral addressed to "this" community team. By that file's own
  doc comment (lines 66-71), that is a **minority** of admissions — most carry `referralId: null`
  or a referral to no team. For everyone else, the recorded destination is genuinely
  unrecoverable on any screen.
- **Test coverage of the value after write**: none found that asserts the _rendered_ destination
  post-`RECORD_LEAVING` on the board itself; `tests/ward-leaving-destinations.test.ts` covers the
  vocabulary/count invariant, not display.

## 2. `Admission.followUp` — WRITTEN (partially), NEVER DISPLAYED — already self-documented

- **Type**: `FollowUpRecord | null` (`state`, `recordedAt`, `recordedBy`), `ward-admissions.ts:452`.
- **What writes it**: `ward-admissions-seed.ts` sets real `FollowUpRecord` values on two departed
  admissions. The only reducer mention, `ward-flow-reducer.ts` `PULL_PATIENT` (~line 941), writes
  `followUp: null` on creation — no reducer path ever writes a non-null record, so no user action
  in the running app can create or change one.
- **Risky default**: not applicable in the "pre-selected control" sense — there is no control at
  all. The hazard is structural: the field exists, holds real data in two seed cases, and nothing
  reads it.
- **Clinical meaning of the gap**: the community hub's own spec list — "discharged, no follow-up
  arranged" — cannot be built, so a discharged person with genuinely no follow-up arranged is
  invisible on the one screen designed to surface exactly that.
- **Already flagged in-repo**: `community/community-screen.tsx:21-65` documents this at length,
  in bold, and `tests/ward-community-index.test.ts` pins the corrected wording. Not a new finding
  — restated here because it fits the brief's exact shape (written, never read) and belongs beside
  the others for ranking.

## 3. `Referral.transportNeeded` — WRITTEN, NEVER DISPLAYED — new finding

- **Type**: `boolean`, `ward-model.ts:1227`.
- **What writes it**: `referrals/referral-intake.tsx` intake form → `RAISE_REFERRAL` event →
  `ward-flow-reducer.ts:2068` (`transportNeeded: event.transportNeeded`). Passed through
  `ward-referral-visibility.ts:216,254` into both visibility-filtered views of a referral.
- **Risky default**: none — the intake form uses a two-way radio with an `UNANSWERED_VALUE`
  sentinel (`referral-intake.tsx:272,514`) that blocks submission until explicitly answered. Not a
  hazard of the "pre-selected wrong option" kind.
- **Display**: grepped every `.tsx` under `ward-management/` — the only match is the intake form
  itself (the write side). No referral-board, referral-match, ED-hub, or coordinator screen
  renders it back after the referral exists.
- **What a wrong value would mean**: lower clinical stakes than #1 — an operational fact about
  whether transport needs arranging goes unconsulted after intake, so a transport-needed referral
  could be worked as if no transport were required, or vice versa. Not a "who is in care" error.
- **Test coverage**: none found asserting a rendered `transportNeeded` value.

## 4. `ward-statistics.ts` — entire computed module has no display consumer — self-documented

Not a single raw field but worth flagging given this audit's own path
(`ward-statistics-skeleton`): `ward-statistics.ts` derives, per ward, average length of stay,
average empty-bed minutes (pull→arrival), discharge-date outcomes (met/missed/moved), admissions
ready-but-blocked, and long stays — reading many of the `Admission` fields above (`arrivedAt`,
`pulledAt`, `dischargeDateMoves`, `dischargeConfirmedAt`, `blockReason`, etc.) in aggregate. Per
`statistics/statistics-ward-screen.tsx:115-154` (its own comment, corrected 2026-09-01): "has no
consumer in the app — only its own test." Pinned by
`tests/ward-statistics-sections.test.ts`, which fails the day an import of `ward-statistics`
appears anywhere in `src`, so the claim can't go stale silently. Not scored as a written-field
hazard (nothing here is a single mis-clickable control), but directly relevant to what this
skeleton is presumably being built to fix.

## Fields checked and confirmed DISPLAYED (not findings, listed for completeness)

`Admission`: `sex`, `homeRegion`, `tentativeDiagnosis`, `state` (via tile), `pulledAt`/`arrivedAt`
(via `daysInBed`), `awayAtEmergencyDepartmentSince`, `expectedDischargeAt`, `dischargeDateMoves`,
`dischargeDateSetBy`, `dischargeConfirmedAt`/`dischargeConfirmedBy` (boolean presence on
`board/ward-board.tsx`; real timestamp via `WardFreshness` on `discharges/discharge-board.tsx` for
a live "confirmed" release), `blockReason`, `leftAt` (as the formatted freshness timestamp on a
`"discharged"` `BedRelease` in `discharge-board.tsx`, and as presence/absence text in
`community-screen.tsx`). `dischargeDateSetAt` is LOGIC ONLY / indirectly displayed — it drives
`datesMoved` in `ward-board-derivations.ts` and is a silent fallback inside
`BedRelease.confirmedAt` (`ward-discharge-dates.ts:112`), so its own value is never labelled as
"the date set" on screen, only borrowed to fill another field's timestamp.

`Movement`: `flaggedUrgent`, `urgency`, `cohort`, `security`, `sex`, `specialling`, `legalStatus`,
`legalForm`, `stage`, `owner`, `referredUnitIds`, `acceptedUnitId`, `acceptedAt`, `declines`,
`transport`, `blocker`, `closure`, `formedAt`, `arrivalMode`, `pullExpiresAt`, `examination`,
`withdrawnReferrals`, `escalation`, `statusChanges`/`urgencyChanges` (rendered as one merged
timeline, `ward-management-console.tsx:203-218`), `overrides` (via `override-register.tsx` — this
was itself a fixed instance of exactly this class of bug, see OD-3 comment at
`ward-flow-reducer.ts:741`), `unwinds` (via `changeAudit`, rendered on the governance view,
`ward-management-modes.tsx:1003-1012`). `admissionId` is an internal join carrying no fact about a
person (by design) — not scored.

`Referral`: `localBedSought` (`referral-match.tsx:361-363`), `ageBand`, `originSiteCode` (partial),
`suburb` (feeds a catchment-matching sentence; did not fully trace whether that sentence reaches a
screen — see Coverage). Not fully verified: `raisedAt`, `triagedAt`, `source`, `destinations[].*`
beyond spot checks.

## Related but out of scope — not chased

Several other `useState<Vocabulary>(LIST[0])` first-option-preselected pickers exist —
`escalationContact`, `releasePullReason`, `cancelTransportReason` in
`coordinator/shortlist-panel.tsx`, and `declineReason` in `referrals/referral-match.tsx`. Unlike
`leavingDestination`, the values these write (`Decline.reason`, `UnwindRecord.reason`,
escalation contact) mostly ARE displayed afterward (confirmed for `unwinds` via `changeAudit`) —
so the hazard class is "silently wrong but visible", not "invisible", and outside this audit's
remit. Flagging for whoever owns risky-default review generally.

## Coverage — what this run did NOT reach

- **`Unit`/bed/site types in `ward-model.ts`** (`sexMix`, `allocatable`, designated-bed fields,
  `LeaveBed`, `BedRelease` beyond the paths above) — not examined field-by-field. Priority 3 per
  the brief and the lowest-ranked; time ran out before starting it properly.
- **`Referral.destinations[]` (`ReferralAddressing`)** — spot-checked only (accept/decline flow
  clearly renders state); did not verify every sub-field (`decidedAt`, `decidedBy` on every
  destination kind) individually.
- **`Referral.suburb`'s catchment-sentence path** (`referral-destination-options.ts`) — traced as
  far as a computed `sentence` string; did not confirm whether that string reaches a component.
- Did not re-derive anything already covered by
  `docs/ward-flow/fields-with-no-producer-2026-09-01.md` (e.g. `Admission.referralId`, which that
  audit already found has a null-only writer and is a dead join — cited above, not re-analyzed).

---

**Worst finding, in two sentences**: `Admission.leavingDestination` is written from a `<select>`
pre-selected to "discharged to the community" — the one destination meaning the person left
psychiatric care entirely — and a coordinator who clicks the submit button without touching the
dropdown silently records that. No screen on the admitting ward ever shows the recorded value
back, and the only screen that ever does (`community-screen.tsx`) only reaches referred admissions,
which the code's own comment says is a minority of the ward.
