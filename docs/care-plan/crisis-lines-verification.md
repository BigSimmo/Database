# Care Plan — crisis line verification record

> **DRAFT — requires clinical sign-off by the owner before any real-patient use.**
>
> This is a record of what the repository already asserts about four public telephone numbers, and
> of what it does **not** assert. It is not clinical authority, it is not itself a verification, and
> nothing in it approves the Care Plan prototype for use with a patient. **No number was dialled or
> checked online while this document was written** — there was no network access in that session.

**Status:** first draft, 2026-09-04. Unreviewed.
**Subject:** every telephone number printed by the Care Plan prototype's fixtures,
`src/components/care-plan/mockups/fixtures.ts`.
**No number in this document has been changed.** This record was written alongside a
verification-record comment in the fixture; the values themselves are untouched.

## Why this record exists

The 2026-09-02 repository audit
([`docs/audit/full-repository-audit-2026-09-02.md`](../audit/full-repository-audit-2026-09-02.md))
recorded that the four real public crisis numbers carry a `verifiedOn` date of `2026-08-20` and a
comment saying to correct them if they have changed, but that **nothing ages that date** — no test,
no gate and no ledger row — while the same file models its synthetic community-team contacts as
`review_due` after a few months. These numbers render on the printed Personal Safety Plan and on the
Patient Plan, which are sheets a person is meant to take home.

The audit's own skeptic note is worth repeating, because it sets the size of the problem honestly:
the prototype is developer-gated synthetic data behind the production mockup block, so nobody takes
this sheet home today. The risk materialises if these fixtures are copied into a production screen.

## The four real public numbers

Every source URL below is already present in this repository. Nothing was looked up to write this.

| #   | Service                                                            | Number as printed | Source used to check it                                                                                                                  | Where that source is recorded in this repository                                                                                                | `verifiedOn` in the fixture | Fixture lines                                                                                        |
| --- | ------------------------------------------------------------------ | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | Emergency services                                                 | `000`             | https://www.triplezero.gov.au/ (organisation root — no deep link, and `sdd-ledger.md` records that a slug was deliberately not invented) | `src/components/care-plan/mockups/fixtures.ts:257`; the organisation-root decision at `docs/care-plan/sdd-ledger.md:609`                        | `2026-08-20`                | `fixtures.ts:251`, and in safety-plan prose at `:787`, `:818`, `:847`, `:876`                        |
| 2   | Mental Health Emergency Response Line (MHERL) — Perth metropolitan | `1300 555 788`    | https://emhs.health.wa.gov.au/Hospitals-and-Services/Mental-Health-Alcohol-and-Other-Drugs/Inpatient-and-Other-Services/MHERL            | `fixtures.ts:269`; also `docs/care-plan/claude-build-handover-2026-08-21.md:157` and `docs/superpowers/specs/2026-08-20-care-plan-design.md:31` | `2026-08-20`                | `fixtures.ts:263` (the record), `:201` (North River after-hours), `:786`, `:875` (safety-plan prose) |
| 3   | Mental Health Emergency Response Line (MHERL) — Peel               | `1800 676 822`    | the same WA Health MHERL page as #2                                                                                                      | `fixtures.ts:282`                                                                                                                               | `2026-08-20`                | `fixtures.ts:276` (the record), `:218` (Coastal Plains after-hours), `:817` (safety-plan prose)      |
| 4   | Rurallink                                                          | `1800 552 002`    | https://emhs.health.wa.gov.au/Hospitals-and-Services/Mental-Health-Alcohol-and-Other-Drugs/Inpatient-and-Other-Services/Rurallink        | `fixtures.ts:296`; also `docs/care-plan/claude-build-handover-2026-08-21.md:158`                                                                | `2026-08-20`                | `fixtures.ts:289` (the record), `:235` (Wandoo after-hours), `:846` (safety-plan prose)              |

### What is verified, and by what

- **The values are pinned.** `tests/care-plan-domain.test.ts:413` asserts the exact four names,
  numbers and emergency-service flags, and `:435-437` asserts that every entry carries
  `verifiedOn: "2026-08-20"`, an `https://` source URL, and — for both MHERL entries — a caveat
  matching "not an emergency service".
- **The after-hours pathway must stay real.** `tests/care-plan-domain.test.ts:484-485` fails if any
  of the three WA numbers disappears from the fixtures, so a later change cannot quietly swap a
  working crisis line for a dead fictional one. The reasoning is `docs/care-plan/sdd-ledger.md:634`:
  the after-hours pathway prints on the patient-facing safety plan under "who to call at 2am", so a
  reader who dials it must reach a real service.
- **There is one source of truth.** `src/components/care-plan/mockups/patient-plan-fixtures.ts:68`
  builds the patient's own resource sheet from `publicCrisisContacts` rather than retyping the
  numbers, precisely so a mistyped crisis number cannot leave the building.

### What is NOT verified

- **Nothing ages `verifiedOn`.** No test, script, gate or ledger row fails when the date goes stale.
  The date is asserted to be exactly `2026-08-20`, which means the pin will have to be updated by
  hand as part of any re-verification — the assertion is a change-detector, not a currency check.
- **The numbers were not checked against their sources while writing this document.** To verify — no
  network access in this session. Every statement above is about what the repository records, not
  about what WA Health currently publishes.
- **Availability windows were not checked either.** Rurallink's stated hours ("4:30 pm to 8:30 am on
  weeknights, and 24 hours on weekends and public holidays", `fixtures.ts:292`) and the 24-hour
  MHERL claims carry the same 2026-08-20 provenance and the same absence of any ageing check.

## Re-verification cadence

**Every six months, from the `verifiedOn` date recorded in the fixture.**

| Last verified | Next due       | Owner        |
| ------------- | -------------- | ------------ |
| 2026-08-20    | **2027-02-20** | Josh (owner) |

**Six months is proposed by whoever drafted this document. It has no precedent in the repository and
no owner decision behind it.** Two things bear on the choice and are worth stating plainly:

- The repository's only review-interval constant is `REVIEW_INTERVAL_MONTHS = 12`
  (`src/components/care-plan/mockups/types.ts:88`), and it governs **care-plan reviews, not contact
  numbers**. The prototype's `verificationState` for its synthetic community teams is a stored
  fixture value, not a value derived from any threshold, so it is not a precedent either.
- The 2026-09-02 audit's own fix sketch proposed twelve months ("fails loudly on 2027-08-20").

Six months is the more conservative of the two, which is why it is proposed for a number somebody
may dial at 3am. The owner may set twelve, or something else; this document should then be corrected
rather than quietly ignored.

### The procedure

1. Open each source URL in the table above.
2. Confirm the number, the coverage area, and the availability window still match what
   `publicCrisisContacts` holds (`src/components/care-plan/mockups/fixtures.ts:247`).
3. **If a value has changed, correct it in `fixtures.ts` and nowhere else.** The safety-plan prose
   and the after-hours entries in `syntheticCmhtContacts` repeat these numbers in text, so a change
   means correcting those lines too — they are listed per number in the table above.
4. Update `verifiedOn` for every entry checked, and update the matching assertion in
   `tests/care-plan-domain.test.ts:436`, which pins the exact date.
5. Update the "Last verified" and "Next due" rows in this document, and record who checked.
6. Run `npx vitest run tests/care-plan-domain.test.ts`.

### Verification history

| Date       | Checked by                                                         | What was checked                                         | Outcome                                                                     |
| ---------- | ------------------------------------------------------------------ | -------------------------------------------------------- | --------------------------------------------------------------------------- |
| 2026-08-20 | Recorded in the fixture; the person is not named in the repository | All four numbers, against the source URLs above          | Recorded as verified; the evidence is the `verifiedOn` field itself         |
| 2026-09-04 | This document                                                      | Nothing. The record was written from the repository only | **Not a verification.** No network access; no number was checked or changed |

## The fictional numbers printed alongside them

Recorded here because they also print on a patient-facing sheet, and a reader deserves to know which
numbers on it connect to nobody.

The synthetic duty lines `0491 570 101`, `0491 570 111` and `0491 570 121`
(`fixtures.ts:194`, `:211`, `:228`), and the personal-support numbers `0491 570 131`, `0491 570 132`
and `0491 570 141` (`:781`, `:782`, `:814`), are inside the block
`0491 570 006`–`0491 570 156` that this repository treats as reserved for fiction
(`docs/care-plan/sdd-ledger.md:613`). `tests/care-plan-domain.test.ts:444` enforces that numerically
for every number in the main fixture bundle, and `src/components/care-plan/mockups/types.ts:234-236`
carries an `isRealContact` flag so a printed sheet can say which is which.

**Unverified:** `docs/care-plan/cloud-session.md:258-259` records that the implementer did **not**
verify where the reserved block ends. The `156` upper bound is this repository's own working
assumption. To verify against the ACMA determination — no network access in this session.

## Adjacent observation — not part of this record, and nothing was changed

Recorded because it concerns numbers printed on a patient-facing sheet and would otherwise be lost.

`src/components/care-plan/mockups/patient-plan-fixtures.ts` — the resources printed on a person's
**own copy** of their plan — contains invented contact numbers at `0491 570 210`, `220`, `230`,
`240`, `250`, `260` and `270` (lines `236`, `246`, `257`, `267`, `299`, `310`, `353`). These sit
**above** the `0491 570 156` upper bound of the block this repository treats as reserved for
fiction. That is the same defect `docs/care-plan/sdd-ledger.md:623-627` records finding and fixing
in `fixtures.ts` — the ruling notes those numbers "sit above the reserved span and are ordinary
allocatable numbers" and that "these print onto a patient-facing safety plan".

The numeric range assertion that catches this (`tests/care-plan-domain.test.ts:444`) runs over
`serialisedFixtures`, which is built from `fixtures.ts` only
(`tests/care-plan-domain.test.ts:49-76`); `patient-plan-fixtures.ts` is not in that bundle, so the
guard does not see these numbers.

**Nothing here was acted on.** Changing a number is outside the scope of this record, and whether
these are in fact allocatable is exactly the question `cloud-session.md` says nobody has verified.
This paragraph is a pointer for whoever picks it up.

## Claims in this document that could not be verified from the repository

1. **That the four numbers are still correct today.** To verify — no network access in this session.
2. **That the stated availability windows are still correct.** Same reason.
3. **Who performed the 2026-08-20 verification.** The repository records the date, not the person.
4. **That six months is the right interval.** Proposed by the drafter of this document. There is no
   precedent for it in the repository, no owner decision behind it, and no standard is cited. The
   2026-09-02 audit proposed twelve months instead.
5. **Where the ACMA fiction block actually ends.** `cloud-session.md:258-259` records that this was
   never checked.
