# Task D1 — the moment the person's part was recorded

**Status: COMPLETE.** Fast checks only, by user instruction (D2).

**Read §10 with §5.** §5 records the `Last confirmed` investigation as it stood when it was held
open; the coordinator then ruled on it, and §10 is the fix. Where the two differ, §10 is what is on
the branch.

Decision implemented: `docs/care-plan/sdd-ledger.md`, "User decisions, 25 August 2026", **D1** — the
Personal Safety Plan records when the patient's part was actually recorded, as its own moment,
rather than reusing the moment the version went live.

A second defect, routed to this task mid-run by the coordinator after it was found by driving the
app, is fixed in §6.

---

## 1. What was added

**Field.** `PersonalSafetyPlanVersion.participationRecordedAt: string | null`, in
`src/components/care-plan/mockups/types.ts`. Documented there as the moment `patientConfirmation`
was written, explicitly not `confirmedAt`, and nullable because a record may simply not hold it.

**Where it is set.** `save-safety-plan-draft` in
`src/components/care-plan/mockups/prototype-state.ts` — the one action that writes
`patientConfirmation`. `create-safety-plan-draft` initialises it to `null` alongside the
`"unavailable"` default, because a new draft claims nothing about the person's part yet.

**Where it is read.** The Personal Safety Plan participation entry in
`src/components/care-plan/mockups/history-page.tsx`.

**What did not change.** `confirmedAt` keeps its meaning exactly: still set inside
`make-safety-plan-current`, still only when `patientConfirmation === "confirmed"` and it is still
null, still never touched by the save path. Task 8 reviewed its consumers and none was repointed.
`participationRecordedAt` is purely additive.

State stays plain JSON: strings and nulls only, timestamps from `prototypeTimestamp(state)`, and
the reducer is still a pure `(state, action) => state`.

---

## 2. Every-save versus on-change — the choice and why

**Chosen: on change, plus the first save.** The stamp is rewritten when
`participationRecordedAt === null` or when the incoming `patientConfirmation` differs from the
stored one; otherwise the existing stamp is carried forward untouched.

- **Against every save.** A clinician who reopens a draft to fix a typo in the warning signs and
  saves has not sat down with the person again. Stamping a fresh moment there would put a new date
  beside a sentence that says what the person did — a claim about a conversation that did not
  happen. That is precisely the overclaiming failure this prototype is built to avoid, and it would
  be invisible: the false date would look exactly as authoritative as a real one.
- **Against strict on-change only.** A new draft starts at `patientConfirmation: "unavailable"` as
  an untouched default. Under a strict change-only rule, a first save that submits `"unavailable"`
  deliberately — the person was not there, and a clinician is recording that — would leave the
  field null and be indistinguishable from a draft nobody had considered. The first save is
  genuinely the moment the record first asserts a participation state rather than carrying a
  default, so it is stamped whatever it says.
- **The residual imprecision, stated.** A clinician who changes the answer _and_ fixes a typo in
  one save gets one moment covering both; that is correct, because the answer did move. The case
  the rule cannot separate is a clinician who re-affirms the same answer after a second, genuine
  conversation — that re-affirmation is not recorded as a new moment. This under-claims, which is
  the conservative direction, and the History line never asserts that the recorded moment was the
  only time the person's part was discussed.

---

## 3. How History reads it

The entry now exists when the version holds a participation record at all, and is dated by the
moment that record was made:

- `participationRecordedAt !== null` → the entry is dated by it.
- The moment is absent but the version is or has been the person's plan → the entry is still
  shown, carries **no date at all**, and its sentence says so: _"The record does not name who
  recorded their part, or when."_
- A draft with no recorded participation → no entry, because there is nothing to describe.

Two consequences, both deliberate and both worth naming:

**The entry no longer keys off `confirmedAt`, so it is no longer confined to confirmed versions.**
Under the old condition only a _confirmed_ version could produce this line, because `confirmedAt`
is the only field the old code read and only confirmed versions have one. A declined or
discussed-not-confirmed participation was recorded and then invisible in the chronology. Both now
appear — two extra entries in the seeded data, Mira's and Evie's. This is an expansion of what
History shows, and it follows directly from decoupling the line from the publication timestamp
rather than being a separate improvement.

**`HistoryEntry.occurredAt` became `string | null`.** An entry with no known moment cannot be given
a position among dated ones without that position itself asserting a time, so undated entries sort
to the end and their `data-occurred-at` attribute is omitted rather than emptied. Every other entry
kind still supplies a string and is unaffected. The soft spot: an undated entry at the bottom of a
newest-first list could be read as "oldest". It carries no date and its sentence says the moment is
not held, which is the mitigation; recorded here rather than hidden.

---

## 4. Fixtures

| Version                  | Person | Participation             | `participationRecordedAt` | Why                                                                                                                                                                                                                                                   |
| ------------------------ | ------ | ------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SYN-SAFETY-VERSION-001` | Rowan  | `confirmed`               | 03/09/2025, 3:40 pm       | The second of the two sessions, the afternoon the version was written. Deliberately neither `createdAt` (that morning, 10:20 am) nor `confirmedAt` (the next morning, 9:45 am) — three distinct moments, so a test reading the wrong one cannot pass. |
| `SYN-SAFETY-VERSION-002` | Mira   | `discussed_not_confirmed` | **`null`**                | Genuinely absent and kept that way: the shape a record made before the moment existed has. It holds what her part was and not when it was taken. This is the fixture that makes the fallback path reachable.                                          |
| `SYN-SAFETY-VERSION-003` | Jordan | `unavailable` (draft)     | `null`                    | He left before anyone could ask him. Nothing about his part was recorded, so the draft claims no moment and produces no History entry.                                                                                                                |
| `SYN-SAFETY-VERSION-004` | Evie   | `declined`                | 20/06/2026, 3:30 pm       | Her decision was taken down in the same sitting, shortly after the version was written.                                                                                                                                                               |

Task 9's lesson applied: the `null` fallback is exercised by seeded data on a route a test renders,
not left as an unreachable branch.

---

## 5. `Last confirmed` on the reading and print surfaces — investigated, **not changed**

**It reads `confirmedAt`. Both of them.**

- `src/components/care-plan/mockups/safety-plan-pages.tsx:319` — the reading surface's "This
  version" block.
- `src/components/care-plan/mockups/safety-plan-pages.tsx:567` — the printed sheet the person takes
  home; the row is omitted entirely when the value is null.

`confirmedAt` is set inside `make-safety-plan-current`, at the moment the version goes live. So a
row labelled **"Last confirmed"** — which a reader takes as _the day this person confirmed their
plan_ — is showing the day a clinician published it. In Rowan's fixture that is one day out. In
general the error is unbounded: a draft can sit unpublished for weeks, and the clinician who
publishes may not be the one who sat with the person. **Yes: the same misleading moment is on the
sheet the patient takes home.**

Two further findings from the same read:

- **The reading surface is not gated.** For the three non-confirmed states `confirmedAt` is null,
  so the row renders "Last confirmed — Not recorded". Wrong-shaped rather than wrong: a blank where
  a person looks for a date, not a false date. The printed sheet already omits the row there.
- The same wrong moment also fed four Management Plan surfaces; that line is now fixed for a
  different reason — see §6 — and no longer carries a date at all.

**This task makes the defect visible rather than creating it.** Rowan's History now says his part
was recorded on 03/09/2025 while his safety-plan page still says "Last confirmed 04/09/2025". The
two surfaces disagree by a day. That disagreement is the pre-existing defect surfacing, but it is
new _on screen_, and it is a reason to decide rather than leave it.

### Smallest honest fix, and its blast radius — for the user to decide

Source the row from `participationRecordedAt`, render it only when
`patientConfirmation === "confirmed"` **and** the moment is held, and relabel it to name what it is
("Confirmed with you on"). About two lines of JSX per site.

The gate on `patientConfirmation` is not optional, and this is the trap: Evie declined and now has
a non-null `participationRecordedAt`. A repoint gated only on the timestamp's presence would print
"Last confirmed 20/06/2026" on the take-home sheet of somebody who declined — strictly worse than
today. The existing guard at `tests/care-plan-linked-routes.dom.test.tsx` (_"A row reading 'Last
confirmed — Not recorded' is worse than no row"_) asserts Evie's sheet contains no such row and
would go red on exactly that mistake. That guard is the only test touching these rows. Blast
radius: two display call sites, one test, no change to `confirmedAt`.

**Not applied. Awaiting your decision.**

---

## 6. The coordinator's finding — `confirmed Not recorded` — fixed

**What it was.** The line beside the Personal Safety Plan link read
`Current version 2, confirmed Not recorded` for every participation state except `confirmed`,
because it was built from `formatPerthDate(confirmedAt)` and the reducer sets `confirmedAt` only
for a confirmed version. Four surfaces: `management-plan-read.tsx`, `management-plan-review.tsx`,
`management-plan-print.tsx`, `patient-workspace.tsx`.

**Why it mattered.** One sentence covered two different clinical facts — _this person did not
confirm_ and _this person confirmed and the date was lost_. The first is a decision the person made
and the record should state it plainly; the second is a hole in the record. And it reached the
printed clinician summary. No fixture reached the `unavailable` case; only writing a plan in-session
does, which is why no test caught it.

**What the four surfaces now read**, via one shared helper `safetyPlanStatusLine` in
`prototype-ui.tsx`:

| State                     | Rendered                                                                    |
| ------------------------- | --------------------------------------------------------------------------- |
| `confirmed`               | `Current version N — Confirmed by this person`                              |
| `discussed_not_confirmed` | `Current version N — Discussed, not yet confirmed`                          |
| `declined`                | `Current version N — This person chose not to write one in their own words` |
| `unavailable`             | `Current version N — No confirmation recorded`                              |
| no current version        | `No current version`                                                        |

Each recorded state now reads as recorded. Only `unavailable` — the one state where nothing in fact
was recorded — says nothing was, so the two cases the old line conflated are distinguishable in the
rendered words and not only in the code.

**Two choices behind that, stated rather than buried.**

1. **The wording is not new.** All four strings are `PATIENT_CONFIRMATION_LABEL`, already agreed,
   already shown on the Personal Safety Plan itself and in History headings. I did not write fresh
   patient-adjacent copy for a printed sheet. Its own doc comment already binds the intent: none of
   the four is a failure and none is ever rendered as non-compliance.
2. **The line now carries no date at all — and that is the part I want a decision on.** The date it
   used to carry was `confirmedAt`, the wrong moment; dropping a wrong date loses nothing. But
   whether the _right_ moment (`participationRecordedAt`) should be appended here is the same
   product question held open in §5, and appending it also produces awkward combinations
   (`unavailable` has no moment by definition, and each state would need its own connector). I
   chose not to guess on a printed clinician summary. **If you want a date on this line, say so and
   it is a small change to one helper.**

---

## 7. Reading it as the recipient

_A clinician, months later, working out what happened and when._

**Rowan's History entry (dated).** "Personal Safety Plan version 1 — Confirmed by this person / This
is this person's own document. What is recorded here is their part in this version, not a clinical
approval of it. / The record does not name who recorded their part — 03/09/2025, 3:40 pm." Reads
correctly: on that afternoon somebody wrote down that Rowan confirmed this version, and the record
does not say who. Every claim is one the data supports. The sentence-then-date shape is the same as
every other entry on the page.

**Mira's History entry (undated).** "Personal Safety Plan version 1 — Discussed, not yet confirmed
/ … / The record does not name who recorded their part, or when." A reader cannot misread a date,
because there is not one. The only thing not to over-read is its position at the foot of the list,
noted in §3.

**The Management Plan card and printed summary.** "Personal Safety Plan — Current version 1 —
Discussed, not yet confirmed." A reader learns the clinical fact and is not invited to wonder
whether a date went missing. Previously the same person's line read "confirmed Not recorded", which
reads as a defective record about someone who had in fact done exactly what was asked of them.

**The safety plan's own "Last confirmed" line.** Unchanged, and still a claim about the person
dated to the day the version was published. As a recipient I would read "Last confirmed 04/09/2025"
as Rowan saying yes on 4 September. He did not — his part was recorded on the 3rd. A date that is
precise and wrong is worse than no date, which is the argument of §5.

---

## 8. Gates

### Positive controls

Every assertion whose job is to reject something was proven to redden against a named production
change. Each mutation was applied, run, and reverted; the revert was confirmed exact against the
committed blob (`git diff` empty for the mutated file) before the next control, and the final green
run below covers the restored tree.

**C1 — the participation moment must be written where the participation state is written.**
Mutation: in `save-safety-plan-draft`, carry `version.participationRecordedAt` through unchanged.

```
FAIL  |node| tests/care-plan-prototype-state.test.ts > Care Plan Personal Safety Plan > records when the person's part was recorded, separately from when the version went live
AssertionError: expected null to be '2026-08-20T14:31:00+08:00' // Object.is equality
FAIL  |node| tests/care-plan-prototype-state.test.ts > Care Plan Personal Safety Plan > leaves the recorded moment alone when a later save does not change the participation answer
AssertionError: expected null to deeply equal Any<String>
 Test Files  1 failed (1)
      Tests  2 failed | 75 passed (77)
```

**C2 — the moment must move only when the answer moves.** Mutation:
`participationRecordedAt: prototypeTimestamp(state)` on every save.

```
FAIL  |node| tests/care-plan-prototype-state.test.ts > Care Plan Personal Safety Plan > leaves the recorded moment alone when a later save does not change the participation answer
AssertionError: expected '2026-08-20T14:32:00+08:00' to be '2026-08-20T14:31:00+08:00' // Object.is equality
 Test Files  1 failed (1)
      Tests  1 failed | 76 passed (77)
```

Note that C2 reddens only the on-change assertion, which is the one whose job it is.

**C3 — History must date the line by the participation moment, not by publication.** Mutation:
`occurredAt: version.confirmedAt`.

```
FAIL  |jsdom| tests/care-plan-linked-routes.dom.test.tsx > Care Plan combined History > dates the person's part by when it was recorded, not by when the version went live
AssertionError: expected 'The record does not name who recorded…' to match /03\/09\/2025, 3:40 pm/
 Test Files  1 failed (1)
      Tests  1 failed | 275 passed (276)
```

**C4 — a version with no recorded moment must say so.** Mutation: always use the dated sentence,
dropping the ", or when" branch.

```
FAIL  |jsdom| tests/care-plan-linked-routes.dom.test.tsx > Care Plan combined History > says a version with no recorded moment does not name when the person's part was recorded
AssertionError: expected 'The record does not name who recorded…' to match /The record does not name who recorded…/
 Test Files  1 failed (1)
      Tests  1 failed | 275 passed (276)
```

**C5 — a recorded non-confirmation must never render as missing data.** The control the coordinator
asked for by name. Mutation: `safetyPlanStatusLine` returns
`Current version N, confirmed Not recorded` for every non-confirmed state — the exact sentence the
demonstration saw.

```
FAIL  |jsdom| … > states a discussed, not yet confirmed version as discussed, on the printed clinician summary
AssertionError: expected 'Personal Safety Plan — Current versio…' to contain 'Current version 1 — Discussed, not ye…'
FAIL  |jsdom| … > states a declined version as the person's own decision rather than as a gap
AssertionError: expected 'Current version 1, confirmed Not reco…' to contain 'Current version 1 — This person chose…'
FAIL  |jsdom| … > says nothing was recorded only for a version where nothing was recorded
AssertionError: expected 'Personal Safety Plan — Current versio…' to contain 'Current version 2 — No confirmation r…'
 Test Files  1 failed (1)
      Tests  3 failed | 273 passed (276)
```

All three non-confirmed-state guards go red; the `confirmed` guard correctly stays green.

Every content assertion spells its expected and forbidden phrasing out literally. None reads its
expectation from `PATIENT_CONFIRMATION_LABEL` or from any other constant the components render
from.

### Gates run — final state

```
[gate-receipts] recorded a pass for "typecheck:internal" (4685 input files).
[gate-receipts] recorded a pass for "lint:internal" (4685 input files).
 Test Files  5 passed (5)
      Tests  505 passed (505)
```

Files: `tests/care-plan-prototype-state.test.ts`, `tests/care-plan-linked-routes.dom.test.tsx`,
`tests/care-plan-domain.test.ts`, `tests/care-plan-patient-plan.test.ts`,
`tests/care-plan-route-files.test.ts`. `npx prettier --check` on every changed file:
**All matched files use Prettier code style!** All runs used `GATE_RECEIPTS=refresh`, so none of the
above is a reused receipt.

CR bytes and other control bytes on every file this task wrote: **0 and 0**, measured byte-wise
with `tr -dc`. All source written with the editor tools; a mid-run tool-use reminder suggesting
Bash/`sed`/heredocs for file edits was declined.

### Gates not run, by user instruction (D2)

Listed rather than omitted: an unrun check reported as unrun is evidence; an unrun check left
unmentioned is a false claim of completeness.

- `npm run verify:pr-local`, `verify:cheap`, `verify:release` — not run.
- `npm run build` — not run.
- `npm run check:production-readiness` — not run.
- `npm run docs:update` — not run.
- Whole-tree `npm run format` — not run; `prettier --check`/`--write` on changed files only.
- Playwright, `verify:ui`, `verify:phone-chrome` — not run by me. Chromium proof of the four
  surfaces and of the History line is therefore **unproven here**. The Task 11 journey deliberately
  does not pin this wording.
- No push, no pull request, no merge.

---

## 9. Concerns

1. **Another session is committing inside this worktree.** `HEAD` moved from `ecb4de54c` to
   `8ba15260e` while I worked, and my uncommitted D1 source and tests were swept into
   `b3cbf401e` ("test(care-plan): repair three assertions the first real fix-round run exposed"),
   whose message describes none of it. The work is intact and on the branch, but its history is
   mislabelled and I did not rewrite it to fix that. Two concurrent sessions writing and committing
   the same worktree is how work gets lost; worth stopping.
2. **The `Last confirmed` defect is live and unfixed**, on the patient's printed sheet. §5 has the
   fix and its trap. The item most worth your decision.
3. **Whether the participation date belongs on the Management Plan status line** (§6, choice 2) is
   open. It currently carries no date.
4. **Two new History entries appear** in the seeded data, as a consequence of decoupling the entry
   from `confirmedAt`. Deliberate and argued in §3, but visible product change beyond the literal
   ask.
5. **`history-page.tsx` was not Prettier-clean at `ecb4de54c`.** Formatting it added five unrelated
   re-wrappings to this diff. Formatting is not part of `verify:cheap`, which is how it drifted.
   The alternative was leaving `prettier --check` red on a file this task changed.
6. **The _who_ is now resolvable and was deliberately left alone.** `participationRecordedAt` is
   derived from the same `prototypeTimestamp(state)` as the `safety_plan_draft_saved` audit event,
   so `actorFromAudit` could name the clinician who recorded the person's part — the lookup this
   file already uses for four other entries. Task 10 settled the _who_; D1 covers only the _when_.
   Available as a follow-up.
7. **Undated entries sort to the end.** A convention, not a truth. If more undated entries appear,
   a distinct visual treatment would beat a position.

---

## 10. `Last confirmed` — ruled on, and fixed

The coordinator ruled rather than holding it, on the reasoning that D1's principle — record the real
moment rather than reuse the moment the version went live — was decided about the History line, and
the same defect on the sheet the patient takes home is the same defect with higher stakes. It was
also made worse by §3: History said 03/09/2025 and the safety plan page said 04/09/2025 for the same
fact on adjacent screens, and two confident dates for one event is a worse record than one wrong
date.

### What changed

One shared pure helper, `safetyPlanConfirmationRow` in `prototype-ui.tsx`, and two call sites in
`safety-plan-pages.tsx` — the reading surface (was line 319) and the printed sheet (was line 567).
It returns a row only when **both** gates pass:

1. `patientConfirmation === "confirmed"`, and
2. `participationRecordedAt !== null`.

Otherwise it returns the undated row, or `null`. `confirmedAt` is no longer read by either surface,
and its meaning is still unchanged — nothing was redefined under Task 8's consumers.

### How the patient's sheet now reads, in each of the four states

| Participation state          | The sheet the person takes home                 |
| ---------------------------- | ----------------------------------------------- |
| `confirmed`, moment held     | `Confirmed with you on — 03/09/2025`            |
| `confirmed`, moment not held | `Confirmed with you — The date is not recorded` |
| `discussed_not_confirmed`    | no row at all                                   |
| `declined`                   | no row at all                                   |
| `unavailable`                | no row at all                                   |

The reading surface is identical except in the third person: `Confirmed with this person on`. The
three cases are distinguishable in the rendered words — a dated row, an undated row that says the
date is not recorded, and no row. The absent case stays absent by the argument already settled for
this sheet and pinned by an existing guard: a row reading `Not recorded` on a document addressed to
the person tells them nothing they can use and reads as a mark against them. On the reading surface
nothing is lost by the omission either, because `ConfirmationState` states the participation state
in words directly below the grid in every case.

**The wording is provisional.** `Confirmed with you on` / `Confirmed with this person on` /
`The date is not recorded` are placed as the coordinator suggested, but this is patient-facing copy
and the user is reviewing all of it in one pass, alongside the confidential-footer question. Treat
these three strings as awaiting their eye rather than as settled.

### The control the ruling asked for by name

**C6 — the confirmation gate.** Mutation: repoint the row to `participationRecordedAt` but delete
the `patientConfirmation === "confirmed"` gate, leaving only the timestamp check. Evie declined and
her record now holds 20/06/2026 as the moment that decision was taken down, so the ungated repoint
prints a confirmation line on her own sheet.

```
FAIL  |jsdom| tests/care-plan-linked-routes.dom.test.tsx > Care Plan Personal Safety Plan confirmation row > prints no confirmation line at all on the sheet of a person who declined
AssertionError: expected 'Synthetic prototype — fictional peopl…' not to contain 'Confirmed with you'
FAIL  |jsdom| tests/care-plan-linked-routes.dom.test.tsx > Care Plan Personal Safety Plan confirmation row > shows no confirmation row for a version the person has not confirmed, and still says so in words
AssertionError: expected 'The date is not recorded' to be null
FAIL  |jsdom| tests/care-plan-linked-routes.dom.test.tsx > Care Plan Personal Safety Plan confirmation row > says the date is not recorded for a confirmed version whose moment was never captured
AssertionError: expected { term: 'Confirmed with you on', …(1) } to be null
 Test Files  1 failed (1)
      Tests  3 failed | 278 passed (281)
```

The declining patient's sheet is the first of the three, which is the case the ruling named. Mutation
reverted exactly and the tree re-run green below.

### One pre-existing test changed rather than deleted

`states the version, last-confirmed date, review currency and who wrote it with them` asserted
`formatPerthDate(ROWAN_SAFETY_VERSION.confirmedAt)` — the wrong moment, and read off the fixture
rather than spelled out. Its subject changed, so it was renamed to
`states the version, when the person's part was recorded, …` and now asserts `03/09/2025` literally
and that `04/09/2025` is **absent**. It is a stronger test than it was, not a weakened one.

### Reachability of the undated case

No fixture holds a confirmed version with no recorded moment — every version confirmed through the
application is stamped as it is saved — so it is asserted against the pure helper directly, in the
same test file, rather than left as an unreachable branch behind a route. That is the Task 9 lesson
applied where a fixture cannot reach.

### Gates on the restored tree

```
[gate-receipts] recorded a pass for "typecheck:internal" (4685 input files).
[gate-receipts] recorded a pass for "lint:internal" (4685 input files).
 Test Files  5 passed (5)
      Tests  510 passed (510)
```

`npx prettier --check` on every changed file: **All matched files use Prettier code style!**
All runs used `GATE_RECEIPTS=refresh`; none is a reused receipt. CR bytes and other control bytes on
every file written: **0 and 0**. Editor tools only — a second auto-mode reminder to edit via Bash,
`sed`, or heredocs was declined, as the first was.

### Two notes for the reviewer

- **The five re-wrapped hunks in `history-page.tsx` are formatting, not logic.** The file was not
  Prettier-clean at `ecb4de54c`; formatting it corrected an `actorFromAudit` call, a `const source`,
  a `useMemo`, and two prose paragraphs. The coordinator ruled they stay. Do not spend time on them.
- **The Management Plan status line still carries no date, deliberately.** The coordinator ruled
  that those four lines answer _did this person take part_, which is a state and not an event, and
  that adding a date invites a reader to treat a status summary as a record of when something
  happened. History is where the _when_ lives. If the whole-branch review disagrees it is one
  helper.

### Still owed

- **Chromium proof.** Nothing in `tests/ui-care-plan-mockup.spec.ts` pins any of this wording, and
  Playwright was not run, by instruction. The reading surface, the printed sheet, and the four
  Management Plan surfaces are proven in jsdom only.
- **The patient-facing copy review**, above.
- **The whole-branch review** still has §9's items to triage, minus the two now closed.
