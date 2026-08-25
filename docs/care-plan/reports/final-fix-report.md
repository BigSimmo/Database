# Care Plan — final fix wave

**Branch:** `claude/care-plan-stage-b-9-11`
**Worktree:** `D:\Worktrees\Database\care-plan-impl`
**Base:** `40a9fae64`, tree clean at start
**Date:** 25 August 2026

One wave, eight items: the whole-branch review's Critical 1, Important 2, Minors 3 and 4, three
deferred minors the review ruled must-fix, and the confidential footer, which the user decided
mid-wave and which is therefore **not** provisional.

---

## What was changed, item by item

### Critical 1 — the person's own copy told them they helped write it

`patient-plan-pages.tsx:608` printed, unconditionally, _"This is your copy of the plan you and your
team wrote together"_. Neither Patient Plan surface read `participationState`, so a Management Plan
Version approved at `declined` or `patient_unavailable` — which carries `ParticipationMarker` on
every clinician surface — produced a sheet telling the person the opposite of what the record holds.

Fixed in three places, all reading the same source of truth.

| File                                                    | Change                                                                                                                                                                                    |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/care-plan/mockups/prototype-ui.tsx:498` | New exported predicate `claimsJointAuthorship(participationState)`, beside the existing `PARTICIPATION_MARKER_STATES`, so the clinician's marker and the paper's sentence cannot disagree |
| `patient-plan-pages.tsx:81`                             | New `sourceManagementVersion(versions, copy)` — resolves `derivedFromManagementVersionId`, the only place any authorship fact lives                                                       |
| `patient-plan-pages.tsx:435`                            | Reading surface: `ParticipationMarker` in the "This copy" metadata marks, the same component and the same words the clinician surfaces use                                                |
| `patient-plan-pages.tsx:597`                            | Print surface: the same marker on screen, inside `data-print-hide`, for the clinician standing at the printer                                                                             |
| `patient-plan-pages.tsx:108`                            | Two literal intro sentences, selected by `claimsJointAuthorship`                                                                                                                          |

`null` — a source version that cannot be resolved — deliberately does **not** count as involvement.
Not knowing is not knowing they took part, and the conservative direction on a handed-over document
is to claim nothing about how it was written.

**Deliberate reading of the specification, flagged for the user.** Spec line 404 requires the
`Written without this person's involvement` marker "on every view, print, and queue entry". On the
Patient Plan's _paper_ that wording would describe the person in the third person as an absence, on
their own sheet. The marker therefore appears on both Patient Plan **screens**, and the paper carries
the same fact in the second person in its opening sentence. If the user reads the spec more literally,
the change is one line.

### Important 2 — `Agreed on` dated a clinician's approval as the person's agreement

`patient-plan-pages.tsx:673` now prints **`Written on`**. `PatientPlanVersion` (`types.ts:247–258`)
holds no participation or confirmation field, so `approvedAt` is only ever the moment a clinician
pressed _Approve patient copy_.

**Recorded option, not work done:** if the sheet should one day show a genuine agreement, it needs
its own recorded moment — exactly as user decision D1 gave the Personal Safety Plan. Do not relabel
this one back.

### Minor 3 — an Audit Event said a copy was given that nobody has given

`prototype-state.ts:1642` now reads _"…is now the copy **to be** given to this person."_ History's own
line for the same event already hedges to "may be holding"; the record no longer contradicts itself
about the one fact it cannot observe.

Bounded today (`patient_plan_approved` is not one of the five intent kinds, so it never renders), so a
new guard was added rather than relying on the surface: `tests/care-plan-patient-plan.test.ts:1127`,
`never records that an approved copy was given to anyone`, with the required and forbidden phrasings
spelled out literally rather than read from the reducer.

### Minor 4 — the numeric-threshold guard could not see a spelled-out threshold

The absence of an approved numeric threshold is a clinical-governance boundary of this prototype, not
a style rule. The guard read digits only.

- `tests/care-plan-route-files.test.ts:317` — new `COUNT` alternation (digits **and** number words),
  and three widened patterns: threshold-with-a-count, count-over-a-lookback-window, and a rule-forming
  verb within 40 characters of a count of presentations.
- `tests/care-plan-linked-routes.dom.test.tsx:4500` — the governance DOM guard widened the same way and
  given the lookback-window shape.

Checked against the existing corpus rather than assumed: the legitimate fixture lines
(`fixtures.ts:703`, `fixtures.ts:1417` — "after two presentations that ended before assessment was
complete") do **not** match, because neither carries a lookback window nor a rule-forming verb before
its count. Ruling 17's reworded trigger is likewise untouched.

### Deferred minor 5 — the amendment-chain invariant's second loop had never run

`tests/care-plan-domain.test.ts:845` restated as `amendmentChainViolations(presentations, amendments)`,
which collects violations instead of asserting, so it can be run over data other than the fixtures.
Two new tests run a **constructed** two-link chain — accepted when each correction replaces the one
before it, rejected when it does not. No fixture was bent.

### Deferred minor 6 — `/verified/i` could not tell a verified team from an unverified one

`tests/care-plan-linked-routes.dom.test.tsx:668` now asserts the literal `Verified on 30/07/2026`
(Rowan's `SYN-CMHT-001`, verified 21 days before `PROTOTYPE_NOW`) and adds a negative assertion that
`Not verified since` is absent.

### Deferred minor 7 — the printed stale banner had still never printed

- **Browser assertion added** to the existing `needing updating` journey
  (`tests/ui-care-plan-mockup.spec.ts:934`): it now prints, asserts the banner is visible on the paper
  with both load-bearing clauses, asserts it never claims an update or estimates how much is still
  right, asserts the clinician wording stays off the sheet, and measures `break-inside: avoid` on the
  real element. **Observed, not owed** — see the Chromium run below.
- **Missing static rule added.** `.patientPlanPaperStale` was the one printed element the
  print-stylesheet guard never named. `care-plan.module.css:1568` adds it to the `break-inside: avoid`
  group; `tests/care-plan-route-files.test.ts:738` adds it to the guard's list.

### Decided by the user — the confidential footer

Previously out of scope; the user decided it mid-wave and the wording is theirs verbatim.

`src/components/ui/print-output.tsx:26`:

```
Confidential clinical document. Handle according to local policy.
```

**Blast radius, verified independently before touching a shared primitive.** `confidential` is set by
exactly three consumers, and all three are Care Plan's own print surfaces —
`management-plan-print.tsx:187`, `patient-plan-pages.tsx:665`, `safety-plan-pages.tsx:558`. No other
product in the repository sets the flag, and no other file contains the old wording. The shared
constant is therefore the right place: one wording, three sheets, nothing to diverge. Therapy
Compass's two `PrintOutput` consumers are unaffected because `confidential` defaults off — confirmed by
running their contract suites.

**Why it is the right answer and not merely a shorter one.** Two of the three sheets are handed to a
patient. Four lines after telling the person to keep the sheet somewhere they can find it quickly, the
old line told them to _dispose of it according to local health service policy_ — it contradicted the
page and instructed a patient to follow a policy they do not hold and cannot consult. The new line
states the document's status and points handling at local policy without asking the reader to act on
one, which stays exactly right on the clinician's print, where the reader can.

**The test that could not fail, closed.** `tests/print-output-capabilities.dom.test.tsx:155` asserted
the rendered footer equalled `CONFIDENTIAL_DOCUMENT_FOOTER` — the constant the component renders from,
so it passed for any wording including a defective one. It now asserts the full sentence literally,
plus literal negatives that the footer no longer instructs disposal, no longer says "keep it", and no
longer points at a health-service policy.

---

## Positive controls — eleven mutations, eleven kills, every one reverted

Every run under `GATE_RECEIPTS=refresh`. One mutation at a time; none left applied while waiting.

| #   | Mutation                                                                                                          | Full `FAIL` line and message                                                                                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `patientPlanPaperIntro` returns the joint sentence unconditionally                                                | `FAIL                                                                                                                                                                                                                      | jsdom | tests/care-plan-linked-routes.dom.test.tsx > Care Plan Patient Plan > never tells a person they helped write a plan the record says was written without them`—`Error: expect(element).toHaveTextContent()`                                                                                                                 |
| 2   | Reading surface renders no `ParticipationMarker`                                                                  | same `FAIL … > never tells a person they helped write a plan the record says was written without them` — `TestingLibraryElementError: Unable to find an element with the text: Written without this person's involvement.` |
| 3   | Print surface's marker reads the literal `"co_produced"` instead of the source version                            | same `FAIL … > never tells a person they helped write a plan the record says was written without them` — `TestingLibraryElementError: Unable to find an element with the text: Written without this person's involvement.` |
| 4   | `Written on` restored to `Agreed on`                                                                              | `FAIL                                                                                                                                                                                                                      | jsdom | tests/care-plan-linked-routes.dom.test.tsx > Care Plan Patient Plan > prints the joint-authorship sentence, dated as written rather than as agreed`—`AssertionError: expected 'Synthetic prototype — fictional peopl…' to contain 'Written on'`                                                                            |
| 5   | Reviewer's exact probe: `// Refer for review after four presentations in three months.` in `operations-pages.tsx` | `FAIL                                                                                                                                                                                                                      | node  | tests/care-plan-route-files.test.ts > Care Plan synthetic, memory-only boundary > keeps every new Care Plan source file free of persistence, providers and non-determinism`—`AssertionError: …operations-pages.tsx contains identification threshold written as a count over a lookback window: expected true to be false` |
| 5b  | Same probe without the window: `// Refer for review after four presentations.`                                    | same `FAIL … > keeps every new Care Plan source file free of persistence, providers and non-determinism` — `…contains identification threshold written as a rule with a count: expected true to be false`                  |
| 5c  | Third spelling: `// Eligible after at least three presentations.`                                                 | same `FAIL … > keeps every new Care Plan source file free of persistence, providers and non-determinism` — `…contains identification threshold written as a rule with a count: expected true to be false`                  |
| 6   | `verificationState === "verified"` inverted in `patient-workspace.tsx`                                            | `FAIL                                                                                                                                                                                                                      | jsdom | tests/care-plan-linked-routes.dom.test.tsx > Care Plan clinical snapshot > keeps identity and currency facts visible in the identity band`—`Error: expect(element).toHaveTextContent()`                                                                                                                                    |
| 7   | `.patientPlanPaperStale` removed from the `break-inside: avoid` group                                             | `FAIL                                                                                                                                                                                                                      | node  | tests/care-plan-route-files.test.ts > Care Plan synthetic, memory-only boundary > keeps the printed patient copy readable, unsplit and unpinned on paper`—`AssertionError: .patientPlanPaperStale may be split across a page break, so half of it can be lost on the previous sheet: expected undefined to be 'avoid'`     |
| 8   | Second loop of `amendmentChainViolations` disabled                                                                | `FAIL                                                                                                                                                                                                                      | node  | tests/care-plan-domain.test.ts > Care Plan fixture safety > rejects a second correction that does not replace what the first one left behind`—`AssertionError: expected [] to deeply equal [ Array(1) ]`                                                                                                                   |
| 9   | `SYN-AMENDMENT-001.originalValue` changed to break the fixture chain's first link                                 | `FAIL                                                                                                                                                                                                                      | node  | tests/care-plan-domain.test.ts > Care Plan fixture safety > keeps every corrected fixture field on an unbroken chain from the value first recorded`—`AssertionError: expected [ Array(1) ] to deeply equal []`, `+ "SYN-PRESENTATION-002.assessmentOutcome must still hold the value it was first recorded as"`            |
| 10  | Audit evidence restored to `is now the copy given to this person`                                                 | `FAIL                                                                                                                                                                                                                      | node  | tests/care-plan-patient-plan.test.ts > Patient Plan lifecycle > never records that an approved copy was given to anyone`—`AssertionError: expected 'Patient Plan version 1 approved by Mo…' to contain 'is now the copy to be given to this p…'`                                                                           |
| 11  | Old footer wording restored to `CONFIDENTIAL_DOCUMENT_FOOTER`                                                     | `FAIL                                                                                                                                                                                                                      | jsdom | tests/print-output-capabilities.dom.test.tsx > PrintOutput confidential-document footer > is off by default and carries the standard wording when asked for`—`Error: expect(element).toHaveTextContent()`                                                                                                                  |

Controls 5, 5b and 5c are the same guard attacked with three different spellings rather than one, on
the principle that a guard nobody has attacked is a guard nobody has tested. Every mutation was
reverted immediately and the tree confirmed clean (`git diff --stat` empty for the probed file).

---

## Reading both patient sheets as their recipient

Captured from the rendered DOM, read straight through, in each participation state. The capture
harness was a scratch file, deleted afterwards; the tree carries no trace of it.

**Patient Plan, `co_produced` (Rowan).** Reads well and reads honestly. It opens "This is your copy of
the plan you and your team wrote together", carries a name and a record number and nothing else about
them, then eight headings each with a plain lead-in, then their own resources with real crisis numbers
carrying their own limitations. The new footer is a marked improvement: the sheet now says keep it
somewhere you can find it quickly and, at the bottom, states the document's status without immediately
contradicting that instruction.

**Patient Plan, `patient_unavailable` (Mira).** The opening sentence is now true, and it does not
read as a reproach: it says who wrote it, says it is hers and not fixed, invites her to change it, and
mentions no absence and no reason. Nothing on the sheet says "declined", "unavailable", or "without
your involvement".

**But the eight section headings and lead-ins still make the claim I removed from the intro.** On
Mira's sheet they read `Why we wrote this together`, `What we agreed will happen when you come to the
emergency department` / _"This is the approach you and your team agreed for when you come in."_, and
`What matters to you` / _"These are the things you have said matter to you."_ — on a plan the record
says she took no part in writing. This is the same defect as Critical 1, one layer down, and it is
**not fixed**: it is eight headings plus eight lead-ins, enumerated in the specification and pinned by
committed tests, and changing them conditionally is a clinical-copy decision rather than an
engineering one. Flagged for the user's copy pass as the remaining half of Critical 1.

**Personal Safety Plan, `confirmed` (Rowan).** Reads as their own document throughout — warning signs,
reasons for living, people who help, then the numbers. `Confirmed with you on 03/09/2025` is now a
genuine recorded moment (user decision D1). Nothing to raise.

**Personal Safety Plan, `declined` (Evie).** The strongest page in the build. It carries only the
numbers and says so: _"Nothing else has been written down, and that is fine — it is your plan and yours
to decide about. If you ever want to add your own part of it, someone on your team can write it with
you."_ No empty headings, no reproach, no implication of failure. This is the tone the Patient Plan's
headings should be measured against.

---

## Gates

All fast checks only, per user decision D2. Every result read from a real summary line in that run's
own output, never from an exit code.

| Gate                                | Result                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------ |
| Care Plan + primitive Vitest        | `Test Files  6 passed (6)` / `Tests  530 passed (530)` (185.70s)         |
| `npm run typecheck`                 | real `tsc` invocation, exit 0, zero diagnostics, `GATE_RECEIPTS=refresh` |
| `npm run lint`                      | real `eslint … --max-warnings 0`, exit 0, `GATE_RECEIPTS=refresh`        |
| `npx prettier --check` (11 changed) | `All matched files use Prettier code style!`                             |
| `npm run test:e2e:care-plan-mockup` | `30 passed (1.3m)`, `1 skipped` (the opt-in evidence atlas)              |
| Byte scan, 11 changed files         | CR=0, control bytes=0, no BOM, `git ls-files --eol` reports `i/lf w/lf`  |

**One environmental interruption, reported rather than rounded.** Two typecheck attempts failed on
`.next/dev/types/routes.d.ts(327,11): error TS1005`. That file is a git-ignored Next artefact and had
been left truncated mid-write by a concurrent session's dev server — the tail read `ver\n "/tools":
never\n}` after the file's real closing brace. Deleting the artefact and re-running gave a clean pass.
Nothing in this diff was involved.

**Not run, by user instruction (D2):** `verify:pr-local`, `verify:cheap`, `verify:release`, `build`,
`check:production-readiness`, `docs:update`, whole-tree `format`, and every provider-backed gate. No
push, no pull request, no merge.

---

## What remains owed

1. **The Patient Plan's eight section headings and lead-ins still assert joint authorship** on a sheet
   the record says was written without the person. Found by reading the page as its recipient; not
   fixed, because it is clinical copy the specification enumerates. This is the largest open item.
2. **The new intro wording is provisional**, awaiting the user's patient-facing copy pass. The footer
   wording is **not** provisional — it is the user's own, decided 25 August 2026.
3. **`discussed` participation still prints the joint sentence.** The predicate deliberately mirrors
   `PARTICIPATION_MARKER_STATES`, so a version discussed with the person but not co-produced is treated
   as joint authorship on the paper. Correct today by construction; worth the user's eye.
4. **A genuine agreement moment for the Patient Plan** is a recorded option, not work done — it needs
   its own field, as D1 gave the Personal Safety Plan.
5. **The marker's placement on the Patient Plan paper** is a deliberate reading of spec line 404's
   "every view, print, and queue entry". One line either way.
6. Everything the whole-branch review triaged as standing, and the deferred minors this wave did not
   name, are unchanged in `docs/care-plan/sdd-ledger.md`.
