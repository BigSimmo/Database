# Field-producer audit for the "per-patient ward board" mockup

**Repo:** D:/Worktrees/Database/ward-builder-community-route (read-only inspection, 2026-09-05)
**Mockup identified:** `docs/ward-flow/design/prototypes/mockup-front-doors-v5.html:1004-1088` -
the `.board` table headed `UMRN | Patient | Bed | Form | Story - presenting complaint | Review |
Plan | Referrals`, rows keyed by the eight synthetic patients (UM100001-UM100008) that exactly
match `src/components/ward-management/ward-patients-seed.ts:36-165`.

**Method used for every finding:** read the actual type declaration (never trust a comment alone);
grep the field name across `ward-flow-reducer.ts` and `ward-flow-events.ts`; open the reducer
`case` that assigns it and quote the assigning line; separately check whether it is only ever
seeded (`ward-patients-seed.ts` / `ward-movements.ts` / `ward-admissions-seed.ts`, hand-authored,
never reachable by dispatching an event) versus reachable at runtime through a form/control that
dispatches an event. Then checked for a screen that reads it.

**One overarching structural fact that governs columns 3, 4 and 8:** the only field anywhere in
this model typed `PatientId` is `Referral.patientId?: PatientId` (`ward-model.ts:1463`). Neither
`Movement` (`ward-model.ts:670-895`) nor `Admission` (`ward-admissions.ts:287-508`, all 21 fields
listed exhaustively in `ADMISSION_FIELD_PRESENCE`, `ward-admissions.ts:519-541`) carries a
`patientId` field at all - confirmed by grepping `patientId` across `ward-admissions.ts` (zero
hits) and by reading every field of `Movement` and `Admission` in full. `person-screen.tsx:76`
states this in the actual source: "Movement (ward-model.ts) carries no patientId - only Referral
does." So a bed, a legal form, or a movement's referral counts cannot be looked up FOR a given
Patient id at all today, even where the underlying field exists on Movement or Admission - there
is no join.

---

## 1. UMRN

- **(i) Model field:** `Patient.umrn: string` - `src/components/ward-management/ward-patients.ts:67`.
- **(ii) Producer:**
  - Seed (once, not user-editable): `ward-patients-seed.ts:39` etc. (`umrn: "UM100001"`, 8 entries).
  - Runtime: `ward-flow-reducer.ts:737`, inside `case "ADD_PATIENT"` (line 726) -
    `umrn: event.umrn,` - assigning the field onto the new `Patient` object at lines 735-741.
    Dispatched by a real form submission: `patients/add-patient.tsx:294-300` builds the
    `ADD_PATIENT` event from validated draft state (`answered.umrn`, line 297) and the "Record
    number" input at `add-patient.tsx:469-479` is the control that sets `draft.umrn`.
- **(iii) Consumer:** `patients/person-screen.tsx:193` (`<dd>{person.umrn}</dd>`); also used for
  search/duplicate-detection in `ward-patients.ts` (`findPatients`, `duplicateCandidates`).
- **(iv) Verdict: HAS PRODUCER** - both seeded and runtime-writable via the add-patient form.

## 2. Patient name (and date of birth / age)

- **(i) Model field:** `Patient.givenName`, `Patient.familyName`, `Patient.dateOfBirth: string`
  (ISO `YYYY-MM-DD`) - `ward-patients.ts:68-76`. Age is explicitly never stored;
  `patientAgeYears(patient, today)` (`ward-patients.ts:129-135`) derives it from `dateOfBirth`.
- **(ii) Producer:**
  - Seed: `ward-patients-seed.ts:40-42` etc.
  - Runtime: `ward-flow-reducer.ts:738-740` -
    `givenName: event.givenName, familyName: event.familyName, dateOfBirth: event.dateOfBirth,`
    inside the same `ADD_PATIENT` case. Same form (`add-patient.tsx:298-300`, inputs at
    lines 490-523).
- **(iii) Consumer:** `person-screen.tsx:173` (`patientDisplayName(person)`), `:187`, `:197`
  (date of birth), `:201` (`patientAgeYears`, derived, rendered, never stored - matches the
  model's own rule).
- **(iv) Verdict: HAS PRODUCER.**

## 3. Bed location (bed + unit/ward currently occupied)

- **(i) Model field:** No field holds this for a `Patient`. The closest thing that exists at
  all is `Admission.unitId: string` (`ward-admissions.ts:292`) - the UNIT only. There is no
  per-bed identifier anywhere in the codebase: I grepped `bedNumber|bedLabel|roomNumber` across
  every `ward-*.ts` file and the only hits are comments explicitly calling every bed number in the
  prototype "invented" at the aggregate-capacity level (`ward-admissions-seed.ts:65`,
  `ward-distance.ts:76`, `ward-travel-bands.ts:51`) - none of them name an individual bed slot.
  The mockup's "Bed 4 / RPH Adult Secure" (two-line cell) has no structural counterpart.
  And critically, `Admission` - the one record type that even holds a unit - carries no
  `patientId` field (confirmed: `ADMISSION_FIELD_PRESENCE`, `ward-admissions.ts:519-541`, has no
  `patientId` key; a direct grep for `patientId` in `ward-admissions.ts` returns nothing).
  `Movement.acceptedUnitId?: string` (`ward-model.ts:775`) is the other unit-shaped field in the
  model, and `Movement` also carries no `patientId` (see the overarching note above).
- **(ii) Producer:** N/A - there is nothing to write, because there is no field a bed/unit value
  keyed by `Patient.id` could land in.
- **(iii) Consumer:** `board/ward-board.tsx:857` renders `unit.name` per admission, but the tile
  it renders has no patient identity attached to it (`Admission` has no name, UMRN or `patientId`)
  - so even this unit-level consumer cannot be reached from a `Patient` row.
- **(iv) Verdict: NOT IN MODEL AT ALL** - as a patient-keyed fact. (The unit-only field
  `Admission.unitId` exists and has a producer - `PULL_PATIENT` - but it is unreachable from
  `Patient`, and no bed-slot field exists at all, so it cannot honestly be reported as "has a
  producer" for this column.)

## 4. Form status (legal forms 1A / 3B / 3D / 4A / 4C)

- **(i) Model field:** `Movement.legalForm?: LegalForm` - `ward-model.ts:763`. `LegalForm` is
  singular (`ward-model.ts:228-246`: `{ code: string; kind?: ...; dueAt?: Instant }`) - one
  form per movement, not a list. The selectable codes are `ward-legal-forms.ts:38-44`
  (`SELECTABLE_LEGAL_FORMS`): `1A, 3B, 3D, 4A, 4C` - exactly the five the mockup's legend names
  (`mockup-front-doors-v5.html:1004`).
- **(ii) Producer:**
  - Runtime: `ward-flow-reducer.ts:855`, inside `case "RAISE_REFERRAL"` -
    `legalForm: chosenForm === undefined ? undefined : { ...chosenForm },` where `chosenForm` is
    looked up from `SELECTABLE_LEGAL_FORMS` by the clinician's choice on the intake form
    (`ward-flow-reducer.ts:768-770`). This is a real, runtime-writable field.
  - But it is written exactly once, at movement creation, and never again. Grepping
    `legalForm` across the whole reducer (`ward-flow-reducer.ts`) returns only this one assignment
    (line 855) plus two unrelated comments (lines 2961, 3010) confirming other cases deliberately
    leave it untouched. There is no `SET_LEGAL_FORM` / `ADD_LEGAL_FORM` / `CHANGE_LEGAL_FORM`
    event in `ward-flow-events.ts` (grepped `legalForm` there - only the one draft field,
    `legalFormCode: string | null` at line 82, which feeds `RAISE_REFERRAL`).
  - Consequently the mockup's requirements cannot be produced: it shows a second, concurrent
    form on one row ("3B x 4C", `mockup-front-doors-v5.html:1053`) and a clickable, editable pill
    for changing the form later (`form-pill` buttons, `:1013` etc.) - the model has no way to hold
    two forms at once and no event to change one after creation.
  - And it is unreachable from `Patient` anyway - `Movement` has no `patientId` (see the
    overarching note).
- **Expiry / due date, asked for specifically:** `LegalForm.dueAt?: Instant` exists as a field
  (`ward-model.ts:245`), but `SELECTABLE_LEGAL_FORMS` - the only source `RAISE_REFERRAL` draws
  from - sets no `dueAt` on any of the five codes (`ward-legal-forms.ts:38-44`, each entry is
  `{ code, kind? }` only). A `dueAt` appears only in the hand-authored seed fixture
  `ward-movements.ts`, and only on Form 4C/4A entries, e.g. `ward-movements.ts:164-167`
  (`legalForm: { code: "4C", kind: "transfer", dueAt: NOW_ANCHOR + 300 }`) and `:227-230`
  (`code: "4A"`, `dueAt: NOW_ANCHOR + 90`) - never on 1A or 3B, which are explicitly and
  permanently barred from ever carrying one by owner instruction (`ward-model.ts:206-227`: "please
  can you leave the legal part and just start a clock once the patient arrives to ED", dated
  2026-08-23). So: the mockup's "Form 4C expires today" cell (`mockup-front-doors-v5.html:1056`)
  reflects a seed-only fact that no runtime action can ever produce, and it is categorically
  forbidden for the two forms (1A, 3B) most likely to appear in practice.
- **(iii) Consumer:** `Movement.legalForm` is read by `ward-management-console.tsx`,
  `ward-management-modes.tsx`, `ward-management-network.tsx`, `coordinator/priority-queue.tsx`,
  `coordinator/shortlist-panel.tsx`, `ed/ed-screen.tsx` - all Movement-scoped screens, none of
  them keyed by `Patient.id`.
- **(iv) Verdict: MODEL FIELD BUT NO PRODUCER** - for what the mockup needs. A single form's
  `code` has a genuine runtime producer at movement-creation time only, but (a) it cannot be
  attributed to a `Patient` (no join), (b) it cannot hold two concurrent forms, (c) it cannot be
  edited/added-to after creation, and (d) any expiry/due date is seed-only and explicitly barred
  for most codes.

## 5. Story / HPC (free-text presenting complaint / history)

- **(i) Model field:** None exists anywhere in the model. I read the full `Patient` type
  (`ward-patients.ts:61-103`, 9 optional R-2026-09-04-A fields, none free-text-narrative), the full
  `Movement` type (`ward-model.ts:670-895`), the full `Admission` type (`ward-admissions.ts:287-508`,
  21 fields, structurally guarded - its own comment at `:275-281` says explicitly "no name, date of
  birth, record number, address, narrative history or free text, ever"), and the full `Referral`
  /`ReferralAddressing`/`ReferralDestination` types (`ward-model.ts:1176-1327`, `1426-1589`) - no
  free-text presenting-complaint/history/story field exists on any of them.
- **Documentation says otherwise, and I checked both sides.** `community-screen.tsx:96-97` and
  three design specs (`docs/superpowers/specs/2026-08-30-ward-flow-community-hub-design.md:83`,
  `...coordinator-hub-design.md:118`, `...ward-forms-design.md:19`) all assert that "FD-13 permits
  exactly one story field... on the referral." But `Referral`'s own doc comment
  (`ward-model.ts:1343-1351`) says the opposite in the same file: "Carries a deliberately tiny,
  governed set of facts... No free-text field of any kind, unlike `Decline` (which has an
  optional `note`)" - and this is enforced structurally by `ALLOWED_REFERRAL_FIELDS` in
  `tests/ward-referral-model.test.ts:750ff`, which lists no such field. I read every field `Referral`
  and `ReferralAddressing` actually declare (above) and confirmed no string free-text field exists.
  Trusting the actual guarded type over the stale/aspirational comment: there is no story field.
- **(ii) Producer:** N/A - nothing to assign to.
- **(iii) Consumer:** N/A - nothing reads it.
- **(iv) Verdict: NOT IN MODEL AT ALL.**

## 6. Review status (whether/when/by-whom a clinician reviewed the patient)

- **(i) Model field:** None. Searched `reviewedAt|reviewedBy|seenAt|seenBy|clinicalReview` across
  all of `src/` - the only hits are in unrelated features (`therapy-compass/data/types.ts`,
  `clinical-quality-dashboard.ts`, `calculator-fixtures.ts`, `formulation-content.json`), none of
  which touch `ward-management`/ward-flow at all.
- **(ii) Producer:** N/A.
- **(iii) Consumer:** N/A.
- **(iv) Verdict: NOT IN MODEL AT ALL.**

## 7. Plan (free-text clinical plan)

- **(i) Model field:** None. The only near-miss is `Admission.expectedDischargeAt: Instant | null`
  (`ward-admissions.ts:432-438`, doc-commented "A WARD'S OWN PLAN") - but that is a single
  timestamp for an expected discharge date, not a free-text clinical plan, and it is explicitly
  documented as carrying "no legal or contractual weight" - a different concept from the mockup's
  "Olanzapine review at the 4pm round. Interpreter must be present." style entries. No free-text
  plan field exists on `Patient`, `Movement`, `Referral` or `Admission` (same exhaustive read as
  finding 5).
- **(ii) Producer:** N/A.
- **(iii) Consumer:** N/A (the near-miss, `expectedDischargeAt`, is read in several places per
  `ward-admissions.ts`'s own comments, but it answers a different question).
- **(iv) Verdict: NOT IN MODEL AT ALL.**

## 8. Referrals in / referrals out (counts addressed to / raised for this patient)

- **(i) Model field:** No count field exists anywhere. The only patient-referral link at all
  is `Referral.patientId?: PatientId` (`ward-model.ts:1463`, optional, a pointer only - "no name,
  date of birth or record number travels with it").
- **(ii) Producer (of the link, not a count):** Runtime: `ward-flow-reducer.ts:2543`, inside
  `case "RECEIVE_REFERRAL"` - `patientId: event.patientId,` (guarded at `:2530-2536`: refuses an
  id that does not name a real patient). Fed by a real control:
  `referrals/referral-intake.tsx:830` - `patientId: patientIdFromUrl === "" ? undefined : ...` -
  populated only when the referral form is opened via the "Refer Patient" link on
  `patients/person-screen.tsx:257-259` (`?patientId=${person.id}`). So the link is genuinely
  runtime-writable, but:
  - No derivation sums it. I grepped `ward-referrals.ts` (60 exported functions) and
    `ward-derivations.ts` for anything shaped like "referral count for a patient" -
    `referralsForPatient|referralCountFor|patientReferral|referralsIn|referralsOut` - zero matches.
    The nearest functions, `edReferralsFor`/`edAnsweredReferralsFor` (`ward-referrals.ts:238,286`),
    count referrals per unit, not per patient.
  - It cannot capture "referrals out" (a patient already on a ward being referred onward) at
    all, because `Movement`/`Admission` - the records of a patient already inside the
    department/ward - carry no `patientId` to correlate against (overarching note).
  - The one screen that is patient-identity-scoped refuses to show any referral information at
    all, by design. `patients/person-screen.tsx:285-289` renders: "This screen does not show a
    person's referral history." Its own header comment (`:25-38`) says this is deliberate
    (`FD-23`, ward-visibility rule) and is guarded by a DOM test that "fails if it consults the
    referral list at all" - i.e., building the counts the mockup wants onto this screen is
    currently blocked by an explicit owner-ruled guard, not merely unbuilt.
- **(iii) Consumer:** N/A for a patient-scoped count - nothing renders one.
- **(iv) Verdict: NOT IN MODEL AT ALL** - as a count reachable from a `Patient`/board row. (A
  single optional patient-to-referral pointer exists and has a genuine runtime producer, but it is
  not a count, does not cover "referrals out," and the one patient-facing screen is expressly
  forbidden from reading the referral list it would need.)

---

## Summary table

| #   | Column                       | Verdict                     |
| --- | ---------------------------- | --------------------------- |
| 1   | UMRN                         | HAS PRODUCER                |
| 2   | Patient name / DOB / age     | HAS PRODUCER                |
| 3   | Bed location (bed + unit)    | NOT IN MODEL AT ALL         |
| 4   | Form status (1A/3B/3D/4A/4C) | MODEL FIELD BUT NO PRODUCER |
| 5   | Story / HPC                  | NOT IN MODEL AT ALL         |
| 6   | Review status                | NOT IN MODEL AT ALL         |
| 7   | Plan                         | NOT IN MODEL AT ALL         |
| 8   | Referrals in / out           | NOT IN MODEL AT ALL         |

## Unverified / out of scope

- I did not execute any code, run tests, or start a server - every claim above is a static read.
- Playwright/DOM tests were read only where cited above (`tests/ward-referral-model.test.ts`),
  and the existence/behaviour claims of `tests/ward-person-screen.dom.test.tsx` are taken from
  `person-screen.tsx`'s own comment describing that test, not from reading the test file itself -
  UNVERIFIED against the test file's actual contents.
- I did not audit every screen in `src/app/mockups/ward-flow/**` for local component state that
  might independently hold one of these values outside the reducer (out of scope per the brief's
  starting points; the doc `docs/ward-flow/fields-with-no-producer-2026-09-01.md` states the same
  limit for its own, earlier audit).
