# Twenty of the twenty-four rows marked "not built" are built

**Ward Verifier, 2026-09-06, at `f87b0000c`.** Read-only audit of every row in
`docs/ward-flow-ledger.md` whose status column reads **`DECIDED, NOT BUILT`**.

**The status column is wrong five times out of six.** That matters in two directions at once: a
planner reading it sees twenty finished items as outstanding work, and anyone asking _"is the
no-free-text rule built?"_ — `FD-13`, the product's central safety property — is told **no**.

⚠️ **This document exists because a verifier that reports only in chat leaves no record.** The
findings below were relayed to Ward Lead the same hour; the ledger itself is serial and is Ward
Lead's to edit, so nothing here has been applied to it.

## The standard of proof used, because it is the part that could have gone wrong

**A code comment citing an id was never accepted as evidence.** Several ward files mention `FD-25`
or `TR-D5` while explaining a boundary, and a mention says nothing about whether the thing exists —
so each verdict below names a **mechanism that was opened**: a field, an event type, a rendered
control, a test file. Where no mechanism could be found, the row is reported as not built rather
than as unknown, and the one row that cannot be settled this way is reported as unclear rather than
folded into either column.

## Built (20)

| id      | the mechanism, opened                                                               |
| ------- | ----------------------------------------------------------------------------------- |
| `FD-11` | `destination: ReferralDestination` on `Referral` (`ward-model.ts:1304`)             |
| `FD-13` | `Referral.history: string`, `REFERRAL_HISTORY_LIMITS`, the reducer's length refusal |
| `FD-15` | `edId` + `purpose` on the destination; `tests/ward-referral-ed-destination.test.ts` |
| `FD-21` | `PARALLEL_REFERRAL_CAP = 3` and the `destinations` list                             |
| `FD-22` | `withdrawnReferrals` written by `ACCEPT_IN_PRINCIPLE` (`ward-flow-reducer.ts:1184`) |
| `FD-23` | `ward-referral-visibility.ts`, four callers, nineteen test files                    |
| `FD-25` | `ACCEPT_REFERRAL` / `DECLINE_REFERRAL` open to the ward role (`events:1197`)        |
| `FD-30` | `declineReason` rendered on the referral board and the match panel                  |
| `OD-4`  | `handover-page.tsx` reads `now` from the provider — no snapshot frozen at mount     |
| `P9-D2` | both clocks rendered (`ed-screen.tsx:139`)                                          |
| `P9-D5` | inbox and outbox sections (`ed-screen.tsx:835`, `:875`)                             |
| `P9-D7` | `sinceReferralRunning` and the "stopped at triage" rendering                        |
| `P9-D8` | the ED psychiatry hub, structured as inbox and outbox                               |
| `P9-D9` | `REFERRAL_DECLINE_REASONS` imported and rendered on the ED screen                   |
| `PD-1`  | `ward-patients.ts` — a `Patient` carrying a `umrn`, quoting his permission verbatim |
| `PD-6`  | `type Decline` is `{ unitId, at, reason }`. No `note`. Removed.                     |
| `PD-7`  | the add-a-patient flow, with its own lifecycle test                                 |
| `TR-D1` | the booking control on the ED screen (`ed-screen.tsx:1895`)                         |
| `TR-D5` | `REQUEST_TRANSPORT` generalised beyond bed placement (`ward-flow-events.ts:377`)    |
| `TR-D6` | `CANCEL_TRANSPORT` exists, coordinator permitted, cited by id                       |

## Genuinely not built (3) — the ledger is right about these

- **`FD-14`** — `REFERRAL_SOURCES` is `["community", "crisis_service", "police", "ambulance",
"inter_hospital"]`. ED medical staff is still not a source. The row itself predicted this exact
  gap when it was written, and the gap is still open.
- **`FD-19`** — no 48-hour rule anywhere in ward source. Every occurrence of `48` is a CSS
  breakpoint or an unrelated count.
- **`TR-D4`** — no mechanism at all. See below.

## Unclear (1)

**`P9-D4`** is an EXCLUSION — the ED screen is a psychiatry hub with no physician-in-charge view, so
it is satisfied by construction and there is nothing to point at. **An absence cannot be verified
the way a field can**, and calling it built on the strength of not finding its opposite would be the
kind of evidence this project refuses everywhere else.

## ⚠️ `TR-D4` is the one to act on, because it is the mitigation for something that shipped

`TR-D4`'s own row says it _"directly mitigates the cost accepted in `TR-D1`"_, and `TR-D1`'s
recorded cost is that **the sending team has the weakest incentive to chase a booking, because the
patient is leaving them either way.**

**`TR-D1` is built. Its mitigation is not.** The intended sequence is: ward accepts → **ward signals
readiness** → referring clinician books → the job stays on the sending board until the patient
physically leaves. The middle step does not exist, so the sending team is relying on its own memory
— which is the precise thing the owner's ruling was recorded to prevent.

**That is not a wrong figure on a screen; it is a booking that quietly does not happen.** And it is
currently filed among twenty-three rows whose status column mostly says "not built" about things
that are built, so nobody scanning that column would pick it out. **A status field that is wrong
five times out of six does not merely mislead — it hides the one row that is right and urgent.**

## Related

A separate finding from the same pass: the owner's ruling of 2026-09-05 on `FD-13` (_"one story
box, optional, and keep the two-pane layout"_) is real and quoted verbatim in commit `364168d23`,
and appears in **no document on this branch or on `claude/Wardquestions`**. Every other ruling batch
since 2026-09-01 has a file. This project's provenance method, as described in
`wards/ward-index.tsx`, is a content search over documents — so that method would return
UNTRACEABLE for a real, verbatim-quoted ruling. The blind spot is the size of "rulings recorded only
in commit messages".
