# Task D1 — the moment the person's part was recorded

**Status: COMPLETE** (fast checks only, by user instruction — see "Gates run" and "Gates not run").

Decision implemented: `docs/care-plan/sdd-ledger.md`, "User decisions, 25 August 2026", **D1** — the
Personal Safety Plan records when the patient's part was actually recorded, as its own moment,
rather than reusing the moment the version went live.

---

## 1. What was added

**Field.** `PersonalSafetyPlanVersion.participationRecordedAt: string | null`, in
`src/components/care-plan/mockups/types.ts`. Documented there as the moment `patientConfirmation`
was written, explicitly not `confirmedAt`, and nullable because a record may simply not hold it.

**Where it is set.** `save-safety-plan-draft` in
`src/components/care-plan/mockups/prototype-state.ts` — the one action that writes
`patientConfirmation`. `create-safety-plan-draft` initialises it to `null` alongside the
`"unavailable"` default, because a new draft claims nothing about the person's part yet.

**What did not change.** `confirmedAt` keeps its meaning exactly: still set inside
`make-safety-plan-current`, still only when `patientConfirmation === "confirmed"` and it is still
null, still never touched by the save path. Task 8 reviewed its consumers, and none of them was
repointed. `participationRecordedAt` is additive.

**Where it is read.** The Personal Safety Plan participation entry in
`src/components/care-plan/mockups/history-page.tsx`.

---

## 2. Every-save versus on-change — the choice and why

**Chosen: on change, plus the first save.** Concretely, the stamp is rewritten when
`participationRecordedAt === null` or when the incoming `patientConfirmation` differs from the
stored one; otherwise the existing stamp is carried forward untouched.

The reasoning:

- **Against every save.** A clinician who reopens a draft to fix a typo in the warning signs and
  saves has not sat down with the person again. Stamping a fresh moment there would put a new date
  beside a sentence that says what the person did — a claim about a conversation that did not
  happen. That is precisely the overclaiming failure this prototype is built to avoid, and it would
  be invisible: the date would look exactly as authoritative as a real one.
- **Against strict on-change only.** A brand-new draft starts at `patientConfirmation:
  "unavailable"` as an untouched default. Under a strict change-only rule, a first save that
  submits `"unavailable"` deliberately — the person was not there, and a clinician is recording
  that — would leave the field null and be indistinguishable from a draft nobody had considered.
  The first save is genuinely the moment the record first asserts a participation state rather than
  carrying a default, so it is stamped whatever it says.
- **The residual imprecision, stated.** A clinician who changes the answer from
  `discussed_not_confirmed` to `confirmed` and *also* fixes a typo in the same save gets one
  moment covering both. That is correct: the participation answer did move in that save. The case
  the rule cannot separate is a clinician who re-affirms the same answer after a genuine second
  conversation — that re-affirmation is not recorded as a new moment. This under-claims, which is
  the conservative direction, and the History line never asserts that the recorded moment was the
  *only* time the person's part was discussed.

---

## 3. How History reads it

The entry now exists when the version holds a participation record at all, and is dated by the
moment that record was made:

- `participationRecordedAt !== null` → the entry is dated by it.
- The moment is absent but the version is or has been the person's plan → the entry is still
  shown, carries **no date at all**, and its sentence says so: *"The record does not name who
  recorded their part, or when."*
- A draft with no recorded participation → no entry, because there is nothing to describe.

Two consequences, both deliberate and both worth naming:

**The entry no longer keys off `confirmedAt`, so it is no longer confined to confirmed versions.**
Under the old condition only a *confirmed* version could produce this line, because `confirmedAt`
is the only field the old code could read and only confirmed versions have one. A declined or
discussed-not-confirmed participation was recorded and then invisible in the chronology. Both now
appear. This is an expansion of what History shows — two extra entries in the seeded data (Mira's
and Evie's) — and it follows directly from decoupling the line from the publication timestamp
rather than being a separate improvement.

**`HistoryEntry.occurredAt` became `string | null`.** An entry with no known moment cannot be given
a position among dated ones without that position itself asserting a time, so undated entries sort
to the end of the chronology and their `data-occurred-at` attribute is omitted rather than emptied.
Every other entry kind still supplies a string and is unaffected. The soft spot: an undated entry
sitting at the bottom of a newest-first list could be read as "oldest". It carries no date and its
sentence says the moment is not held, which is the mitigation; it is recorded here rather than
hidden.

---

## 4. Fixtures

| Version | Person | Participation | `participationRecordedAt` | Why |
| --- | --- | --- | --- | --- |
| `SYN-SAFETY-VERSION-001` | Rowan | `confirmed` | 03/09/2025, 3:40 pm | The second of the two sessions, the afternoon the version was written. Deliberately neither `createdAt` (that morning, 10:20 am) nor `confirmedAt` (the next morning, 9:45 am) — three distinct moments, so a test that reads the wrong one cannot pass. |
| `SYN-SAFETY-VERSION-002` | Mira | `discussed_not_confirmed` | **`null`** | Genuinely absent, and kept that way. This is the shape a record made before the moment existed has: it holds what her part was and not when it was taken. This is the fixture that makes the fallback path reachable. |
| `SYN-SAFETY-VERSION-003` | Jordan | `unavailable` (draft) | `null` | He left before anyone could ask him. Nothing about his part was recorded, so the draft claims no moment and produces no History entry. |
| `SYN-SAFETY-VERSION-004` | Evie | `declined` | 20/06/2026, 3:30 pm | Her decision was taken down in the same sitting, shortly after the version was written. |

Task 9's lesson applied: the `null` fallback is exercised by seeded data on a route a test renders,
not left as an unreachable branch.

---

## 5. `Last confirmed` on the reading and print surfaces — investigated, **not changed**

**It reads `confirmedAt`. Both of them.**

- `src/components/care-plan/mockups/safety-plan-pages.tsx:319` — the reading surface's "This
  version" block: `<DefinitionRow term="Last confirmed">{formatPerthDate(currentSafetyPlanVersion.confirmedAt)}</DefinitionRow>`.
- `src/components/care-plan/mockups/safety-plan-pages.tsx:567` — the printed sheet the person takes
  home: the same field, omitted entirely when it is null.

`confirmedAt` is set inside `make-safety-plan-current`, at the moment the version goes live. So a
row labelled **"Last confirmed"** — which a reader takes as *the day this person confirmed their
plan* — is showing the day a clinician published it. In Rowan's fixture that is one day out. In
general the error is unbounded: a draft can sit unpublished for weeks, and a clinician can publish
a version whose participation was recorded by somebody else on some other day. **Yes, this is the
same misleading moment, and it is on the sheet the patient takes home.**

Two further findings from the same read:

- **The reading surface is not gated at all.** For the three non-confirmed states `confirmedAt` is
  null, so the row renders as "Last confirmed — Not recorded". Wrong-shaped rather than wrong: it
  puts a blank where a person looks for a date instead of a false one. The printed sheet already
  omits the row in that case, and a comment there explains why.
- **The same wrong moment appears in four more places**, as `Current version N, confirmed <date>`:
  `management-plan-read.tsx:425`, `management-plan-print.tsx:137`, `management-plan-review.tsx:105`,
  `patient-workspace.tsx:107`. Six call sites in total; all display-only.

**This task makes the defect visible rather than creating it.** Rowan's History now says his part
was recorded on 03/09/2025 while his safety-plan page still says "Last confirmed 04/09/2025". The
two surfaces disagree by a day. That disagreement is the pre-existing defect surfacing, not a new
one — but it is new *on screen*, and it is a reason to decide about the fix rather than leave it.

### Smallest honest fix, and its blast radius — for the user to decide

Source the row from `participationRecordedAt`, show it only when
`patientConfirmation === "confirmed"` **and** the moment is held, and relabel it to name what it is
("Confirmed with you on"). Roughly two lines of JSX per site.

The gate on `patientConfirmation` is not optional, and this is the trap: Evie declined and now has
a non-null `participationRecordedAt`. A naive repoint that gated only on the timestamp's presence
would put "Last confirmed 20/06/2026" on the take-home sheet of somebody who declined — strictly
worse than today. The existing guard at `tests/care-plan-linked-routes.dom.test.tsx:3089`
(*"A row reading 'Last confirmed — Not recorded' is worse than no row"*) asserts Evie's sheet
contains no such row, so it would go red on that mistake. That guard is the only test touching
these rows; the blast radius is six display call sites, one test, and no change to `confirmedAt`
itself.

**Not applied. Awaiting your decision.**

---

## 6. Reading it as the recipient

*A clinician, months later, working out what happened and when.*

**Rowan's History entry (dated).** "Personal Safety Plan version 1 — Confirmed by this person /
This is this person's own document. What is recorded here is their part in this version, not a
clinical approval of it. / The record does not name who recorded their part — 03/09/2025, 3:40 pm."
Reads correctly: on that afternoon somebody wrote down that Rowan confirmed this version, and the
record does not say who. Every claim is one the data supports. The em-dash-then-date shape is the
same as every other entry on the page, so the sentence-plus-date reads a little unusually but
consistently.

**Mira's History entry (undated).** "Personal Safety Plan version 1 — Discussed, not yet confirmed
/ … / The record does not name who recorded their part, or when." A reader cannot misread a date,
because there is not one. The only thing they must not over-read is its position at the foot of the
list, noted in §3.

**The safety plan's "Last confirmed" line.** Unchanged, and it still reads as a claim about the
person on a day that is actually the day the version was published. As a recipient I would take
"Last confirmed 04/09/2025" to mean Rowan said yes on 4 September. He did not — his part was
recorded on the 3rd. A date that is precise and wrong is worse than no date, which is the whole
argument of §5.

---

## 7. Gates

### Positive controls

Every assertion whose job is to reject something was proven to redden against a named production
change. Full `FAIL` lines and assertion messages below.

<!-- EVIDENCE:CONTROLS -->

### Gates run

<!-- EVIDENCE:GATES -->

### Gates not run, by user instruction (D2)

Listed rather than omitted: an unrun check reported as unrun is evidence; an unrun check left
unmentioned is a false claim of completeness.

- `npm run verify:pr-local` — not run.
- `npm run verify:cheap` — not run.
- `npm run verify:release` — not run.
- `npm run build` — not run.
- `npm run check:production-readiness` — not run.
- `npm run docs:update` — not run.
- Whole-tree `npm run format` — not run. `npx prettier --check` was run on the changed files only.
- Playwright / `npm run verify:ui` / `verify:phone-chrome` — not run. No Chromium journey asserts
  on the safety-plan participation line, but the History surface is exercised by
  `tests/ui-care-plan-mockup.spec.ts`, so a Chromium pass remains genuinely unproven here.
- No push, no pull request, no merge.

---

## 8. Concerns

1. **The `Last confirmed` defect is live and unfixed**, on the patient's printed sheet. §5 has the
   fix and its trap. This is the item most worth your decision.
2. **Two new History entries appear** in the seeded data (Mira's and Evie's participation lines),
   as a consequence of decoupling the entry from `confirmedAt`. Deliberate and argued in §3, but it
   is a visible product change beyond the literal ask, so it should be looked at rather than
   assumed.
3. **`history-page.tsx` was not Prettier-clean at `ecb4de54c`.** Formatting the file added five
   unrelated re-wrappings to this diff (an `actorFromAudit` call, a `const source`, a `useMemo`,
   and two prose paragraphs). Formatting is not part of `verify:cheap`, which is how it drifted.
   The alternative was leaving `prettier --check` red on a file this task changed.
4. **The `who` is now resolvable and was deliberately left alone.** `participationRecordedAt` is
   derived from the same `prototypeTimestamp(state)` as the `safety_plan_draft_saved` audit event,
   so the two match exactly and `actorFromAudit` could name the clinician who recorded the person's
   part — the same lookup this file already uses for four other entries. Task 10 settled the *who*
   as "the record does not name", D1 covers only the *when*, and reopening a settled decision was
   not this task's to make. Available as a follow-up if you want it.
5. **Undated entries sort to the end.** A convention, not a truth. If the chronology later grows
   more undated entries, a distinct visual treatment would be better than a position.
