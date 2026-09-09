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

---

# Second wave — the section headings and lead-ins

**Decided by the user**, 25 August 2026, in their own words: _"yes please stop saying that they helped
write it."_ This wave is theirs, not a ruling taken on their behalf.

The first wave made the opening sentence honest and left the eight headings and lead-ins beneath it
still claiming she took part. That was the worse outcome of the two available: one careful line
surrounded by eight casual contradictions of it. This closes it.

## What changed

**One predicate, not a second notion.** `claimsJointAuthorship` moved from `prototype-ui.tsx` to
`domain.ts:501` so the pure transform can reach it without importing React, and
`PARTICIPATION_MARKER_STATES` moved with it. The clinician's `ParticipationMarker`, the paper's
opening sentence, and now every heading and lead-in all read that one function. They cannot drift
apart, because there is nothing to drift from.

Five strings, and only five. Where the predicate returns true, today's copy is untouched — for a
co-produced plan the claim is true, warm and already reviewed.

| `file:line`                         | Joint wording (unchanged, still printed when the person took part)     | Team-written wording (printed otherwise)                                          |
| ----------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `patient-plan-transform.ts:73→105`  | `Why we wrote this together`                                           | `Why this plan was written`                                                       |
| `patient-plan-transform.ts:77→106`  | `What we agreed will happen when you come to the emergency department` | `What your team has agreed will happen when you come to the emergency department` |
| `patient-plan-transform.ts:135→169` | `This is what we wrote down about why this plan exists.`               | `This is what your team wrote down about why this plan exists.`                   |
| `patient-plan-transform.ts:136→170` | `These are the things you have said matter to you.`                    | `This is your team's understanding of what matters to you.`                       |
| `patient-plan-transform.ts:139→171` | `This is the approach you and your team agreed for when you come in.`  | `This is the approach your team has agreed for when you come in.`                 |

**All five wordings are provisional, awaiting the user's copy pass**, alongside the intro sentence
from the first wave.

**Three deliberate boundaries, stated rather than assumed.**

- **`discussed` keeps the joint wording**, mirroring `PARTICIPATION_MARKER_STATES`. A plan discussed
  with somebody who did not confirm it is not a plan written without them, and the user's
  instruction is about the case where the person took no part at all. Pinned by its own test.

  _Corrected 25 August 2026._ Earlier drafts of this report — and of the ledger — wrote this state
  as `discussed_not_confirmed`, which is a **`PatientConfirmationState`** (`types.ts:21`) belonging
  to the Personal Safety Plan. The Management Plan's **`ParticipationState`** (`types.ts:20`) is
  `discussed`, and that is what the code reads. The behaviour was always right and matches the
  user's decision; only the prose named the wrong type.

- **The other six headings are untouched** — `What matters to you`, `What helps you`, `What makes
things harder`, `If something new is happening`, `Who's involved in your care`, `Things that might
help`. None of them ever claimed the person contributed, and rewording an honest line is churn.
  A test pins the replacement sets at exactly two headings and three lead-ins so nobody later
  "finishes the set".
- **`What makes things harder`'s lead-in keeps its "we"** — _"so we can try to avoid them"_. That
  "we" is the care relationship going forward, not a claim about who wrote the page. It promises the
  team will try, which stays true however the plan was written, and removing it would cost the
  person a commitment for no gain in honesty.

**`whatWeAgreedWillHappen` keeps the word "agreed" deliberately.** The section is about an approach
somebody agreed; the honest fix is to say _who_ agreed it, not to strip the agreement out and leave
the person a bare list of what will be done to them.

**Where the wording is selected.** The heading is chosen in the transform, from
`version.participationState`, and stored on the section — so the draft form, the reading surface and
the paper all show it without deciding anything. The lead-in is chosen at render, from the same
predicate, at both surfaces: `patient-plan-pages.tsx:165` and `patient-plan-form.tsx:409`. The form
reads the draft's own `derivedFromManagementVersionId` rather than whatever is Current now, because a
draft written from one version must not change its account of itself when another is approved
underneath it.

## Controls — seven mutations, seven kills, every one reverted

One at a time, `GATE_RECEIPTS=refresh` throughout, none left applied while a run was in flight.

| #   | Mutation                                                                                              | Full `FAIL` line and message                                                                                                                                                                                                                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Heading `whyWeWroteThis` restored to `Why we wrote this together`                                     | `FAIL \|jsdom\| tests/care-plan-linked-routes.dom.test.tsx > Care Plan Patient Plan > never tells a person they helped write a plan the record says was written without them` — `AssertionError: the Patient Plan reading surface still claims joint authorship: /we wrote this together/i: expected true to be false` |
| B   | Heading `whatWeAgreedWillHappen` restored                                                             | same `FAIL … > never tells a person they helped write a plan the record says was written without them` — `the Patient Plan reading surface still claims joint authorship: /what we agreed will happen/i: expected true to be false`                                                                                    |
| C   | Lead-in `whyWeWroteThis` restored                                                                     | same `FAIL … > never tells a person they helped write a plan the record says was written without them` — `the Patient Plan reading surface still claims joint authorship: /what we wrote down/i: expected true to be false`                                                                                            |
| D   | Lead-in `whatMattersToYou` restored to `These are the things you have said …`                         | same `FAIL … > never tells a person they helped write a plan the record says was written without them` — `the Patient Plan reading surface still claims joint authorship: /you have said/i: expected true to be false`                                                                                                 |
| E   | Lead-in `whatWeAgreedWillHappen` restored                                                             | same `FAIL … > never tells a person they helped write a plan the record says was written without them` — `the Patient Plan reading surface still claims joint authorship: /you and your team agreed/i: expected true to be false`                                                                                      |
| F   | A **second notion** of the rule: `participationState !== "declined"` in place of the shared predicate | `FAIL \|node\| tests/care-plan-patient-plan.test.ts > Patient Plan transformation > stops saying the person helped write it when the record says they took no part` — `AssertionError: expected [ 'Why we wrote this together', …(7) ] to deeply equal [ 'Why this plan was written', …(7) ]`                          |
| G   | The **printed** sections pinned to `"co_produced"` while the screen stayed correct                    | `FAIL \|jsdom\| tests/care-plan-linked-routes.dom.test.tsx > Care Plan Patient Plan > never tells a person they helped write a plan the record says was written without them` — `AssertionError: the printed Patient Plan still claims joint authorship: /what we wrote down/i: expected true to be false`             |

Control F is the one worth keeping: it proves the wording follows the shared predicate rather than
a hand-rolled restatement of it, which is precisely how a marker and a sentence come apart. Control G
proves screen and paper are separately guarded, not one assertion counted twice.

The forbidden phrasings are spelled out literally in `JOINT_AUTHORSHIP_CLAIMS`
(`care-plan-linked-routes.dom.test.tsx:3350`) and applied to both surfaces; the generative assertion
that compared a rendered heading against the map it renders from is gone from
`care-plan-patient-plan.test.ts:178`, replaced by the eight literal headings.

## Mira's sheet, read end to end as her

Captured from the rendered DOM in reading order, `patient_unavailable`, then read straight through.
The capture harness was a scratch file, deleted afterwards.

It reads as a document written **for** her, and it does not remind her she was absent. Nothing on the
page mentions an absence, a decline, a reason, or a failure — the words "declined", "unavailable",
"did not" and "were not" appear nowhere on it.

The opening is now consistent with everything under it. `My plan`, her preferred name, her record
number, `Written on 20/08/2026`, then _"This is your copy of the plan your team wrote for you. It is
yours, and it is not fixed…"_ — and the first heading beneath it is `Why this plan was written`,
followed by _"This is what your team wrote down about why this plan exists."_ In the first wave that
same sentence read "what we wrote down", two lines under an intro that had just carefully avoided
saying so. That contradiction is gone.

`This is your team's understanding of what matters to you.` is the line I was least sure of, and
reading it in place it does the right thing: it is honest that this is their understanding, it is
still addressed to her, and being visibly an understanding rather than a transcript is itself the
invitation to correct it. It does not apologise, and it asks nothing of her.

`What your team has agreed will happen when you come to the emergency department` is longer than the
original and worth the words. Keeping "agreed" matters — without it the section would read as a list
of things that will be done to her, which is a worse document, not a more honest one.

The six untouched headings carry the page. `What helps you`, `What makes things harder`, `Who's
involved in your care`, `Things that might help` — read in sequence they are simply about her, and
they do not need an authorship claim to be warm. `What makes things harder` still ends _"so we can
try to avoid them"_, which reads as the team undertaking something rather than as a claim about who
wrote the sheet.

Then her own resources — her CMHT with Devon named, the pain clinic that will come to her, the
door-to-door bus with _"tell them if you need help getting down the front step"_, carer support for
Daniel, a large-print booklet — the crisis block with its real numbers and their real limits, the
printed-at stamp, and the shortened footer.

**Honest answer to the question asked:** it reads as her plan, written by her team, that she is
welcome to change. The one thing I would still put in front of the user is the tension between the
sheet's title, `My plan`, and the fact that she did not write it — the title is not false, since it
is hers to hold and hers to change, but it is the last place on the page where "my" is doing work the
record does not support. It is a title, not a claim about authorship, so I have not touched it.

## Gates — second wave

| Gate                                | Result                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------ |
| Care Plan + primitive Vitest        | `Test Files  6 passed (6)` / `Tests  533 passed (533)` (283.92s)         |
| `npm run typecheck`                 | real `tsc` invocation, exit 0, zero diagnostics, `GATE_RECEIPTS=refresh` |
| `npm run lint`                      | real `eslint … --max-warnings 0`, exit 0, `GATE_RECEIPTS=refresh`        |
| `npx prettier --check` (7 changed)  | `All matched files use Prettier code style!`                             |
| `npm run test:e2e:care-plan-mockup` | `30 passed`, `1 skipped` (the opt-in evidence atlas)                     |
| Byte scan, 7 changed files          | CR=0, control bytes=0, `git ls-files --eol` reports `i/lf w/lf`          |

Not run, by user instruction (D2): `verify:pr-local`, `verify:cheap`, `verify:release`, `build`,
`check:production-readiness`, `docs:update`, whole-tree `format`, every provider-backed gate. No
push, no pull request, no merge.

## Closing re-review — the one gap it found, and the fix

The closing re-review confirmed items 1–6 by probe, re-ran four earlier controls red, and found no
new breakage. It found **one gap, in this wave's own diff**, and it was the shape this project keeps
producing: new production code, correct today, with no assertion on it at all.

`patient-plan-form.tsx:212` chooses the authoring form's wording from the draft's source version.
Replacing that lookup with a hard-coded `"co_produced"` left `Tests 283 passed (283)` — nothing
noticed.

The consequence is not cosmetic. A clinician writing Mira's copy reads those same eight headings and
lead-ins as the prompt for what to type. Left on the joint wording, _"These are the things you have
said matter to you"_ would frame what they write, and **what they write reaches her sheet** — so the
claim this wave removed would arrive on her paper by way of the authoring surface rather than the
rendering one, with every rendering assertion still green.

Closed at `tests/care-plan-linked-routes.dom.test.tsx:3784`, reusing `expectNoClaimOfJointAuthorship`
rather than a second helper: one rule, one set of forbidden phrasings, checked on the form, the
reading surface and the paper alike.

| #   | Mutation                                                                               | Full `FAIL` line and message                                                                                                                                                                                                                                                                                      |
| --- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H   | `draftParticipationState` hard-coded to `"co_produced"` at `patient-plan-form.tsx:212` | `FAIL \|jsdom\| tests/care-plan-linked-routes.dom.test.tsx > Care Plan Patient Plan > never tells a person they helped write a plan the record says was written without them` — `AssertionError: the Patient Plan authoring form still claims joint authorship: /what we wrote down/i: expected true to be false` |

**`My plan` is not a defect and is no longer carried as a residual.** The re-review disagreed with
that note and is right: "my" asserts possession rather than authorship, and the next sentence grants
exactly that possession. `Your plan` would read as issued rather than owned. It goes to the copy pass
as a note.

## Gates — closing pass

| Gate                                | Result                                                              |
| ----------------------------------- | ------------------------------------------------------------------- |
| Care Plan + primitive Vitest        | `Test Files  6 passed (6)` / `Tests  533 passed (533)` (241.70s)    |
| `npm run typecheck`                 | real `tsc` invocation, exit 0, zero diagnostics — **third attempt** |
| `npm run lint`                      | real `eslint … --max-warnings 0`, exit 0                            |
| `npx prettier --check` (3 changed)  | `All matched files use Prettier code style!`                        |
| `npm run test:e2e:care-plan-mockup` | `30 passed (2.1m)`, `1 skipped` — **second attempt**                |
| Byte scan, 3 changed files          | CR=0, control bytes=0, `git ls-files --eol` reports `i/lf w/lf`     |

**Systemic lesson 6 caught two more runs on this pass, and both wore green.** Two typecheck attempts
and one whole Playwright invocation printed `DATABASE_HEAVY_RUN_ADMISSION_BUSY` and **exited 0
without running anything** — no `Test Files` line, no `passed` line, nothing executed. The Playwright
one is the worse of the two, because a wrapper exiting 0 after a two-minute wait is indistinguishable
from a fast green run unless the output is actually read. Every one was retried in a loop until a
real invocation was observed, and only the real invocation is reported above. The interim state was
also briefly mis-described in this session as "still in flight" when it had in fact already
terminated as a refusal; corrected here rather than left standing.

## Still owed — the complete list

1. **All five new headings and lead-ins are provisional**, awaiting the user's patient-facing copy
   pass, together with the first wave's opening sentence. The confidential footer is the only
   patient-facing copy the user has settled.
2. **The team-written paper is proven in jsdom only.** The one Chromium journey that prints Mira's
   sheet creates her copy _before_ `SYN-MGMT-VERSION-004` is approved, so what it prints is the joint
   wording. Proving the team-written sheet in a real browser needs that journey reordered, which is
   more than this sitting warranted. Recorded rather than reached for.
3. **A genuine agreement moment for the Patient Plan** is a recorded option, not work done. If the
   sheet should ever show that the person agreed, it needs its own recorded field, as user decision
   D1 gave the Personal Safety Plan. Do not relabel `Written on` back.
4. **The participation marker's placement on the Patient Plan paper** is a deliberate reading of
   specification line 404's "every view, print, and queue entry": the clinician's third-person marker
   is on both Patient Plan screens, and the paper carries the same fact in the second person in its
   opening sentence. One line either way if the user reads the spec more literally.
5. **A pre-existing clinician-facing overclaim at `patient-plan-pages.tsx:254`** — the stale notice
   says "what this page says they **were given**", of the same class as Minor 3, which was corrected
   in the reducer's audit evidence. Untouched by this diff and not introduced by it. Record only.
6. **`discussed` keeps the joint wording** — a deliberate boundary, now pinned by its own test rather
   than left implicit. Not a defect; listed so the user sees the line that was drawn.
7. Everything the whole-branch review triaged as standing, and the deferred minors neither wave
   named, are unchanged in `docs/care-plan/sdd-ledger.md`.

---

# Third wave — closing the three verification gaps

**Date:** 25 August 2026. **Base:** `da9745deb`, tree clean at start.

Evidence work, not product work: everything below proves something that already existed. No
production file was changed and no patient-facing copy was touched. The whole diff is two test
files and one new test-support module.

## Gap 1 — the team-written sheet now prints in a real browser

`tests/ui-care-plan-mockup.spec.ts:1106` **extends** the staleness journey rather than
reordering it, and the distinction matters. Reordering would have bought the team-written
proof by spending the staleness proof, and the "still owed" note had assumed that trade was
necessary. It is not. The journey now runs the clinician's actual next move: the copy is
stale, the banner it has just printed tells the person to ask somebody to write a new one, and
this is that new one — written from `SYN-MGMT-VERSION-004`, which is now Current and which the
record says was written without her.

Asserted on the rendered page: the authoring form carries no claim of joint authorship
(`:1143`), the copy resolves to Management Plan version **2** (`:1165`, the sequencing pin),
the clinician's third-person marker is on the screen beside it, and on the paper — none of the
five forbidden phrasings, nothing that reads as a reproach, the team-written opening sentence
in full, and the two team-written headings and three lead-ins present (`:1185`–`:1206`).

**The forbidden phrasings are now one list, not two.** `JOINT_AUTHORSHIP_CLAIMS` and the
reproach shapes moved out of `care-plan-linked-routes.dom.test.tsx`, where only jsdom could
reach them, into `tests/helpers/care-plan-patient-copy-claims.ts`, and both suites import
them. A second hand-written list beside the first is how a rule about a patient-facing claim
comes apart: two lists drift, and the one nobody edits is the one guarding the printed page.

**The assertion order was wrong, and a probe is what showed it.** The first shape put the
positive "these headings are present" checks ahead of the forbidden-phrasing check. Probe C
below reddened on a _missing_ team-written line, and `expectNoClaimOfJointAuthorship` — the
assertion that actually carries user decision D4 — was never reached, so it could not be shown
to fail at all. In a guard block the first assertion to fail is the only one anybody sees. The
forbidden check runs first now, and the same probe reddens on it.

## Gap 2 — drafting and submitting a version now has browser proof

`tests/ui-care-plan-mockup.spec.ts:903`, `a replacement version is drafted and submitted
without displacing the Current Plan`. As the liaison clinician — the emergency physician
deliberately cannot author one — it drafts a replacement for Rowan, fills the single field a
new version does not inherit from the Current Plan, submits for senior approval, and confirms.

The assertion it exists for is the specification guarantee: **the Current Plan is not
displaced while the submission is pending.** The metadata block is captured _before_ the draft
exists and compared afterwards (`:952`), so "unchanged" is measured against what was on the
page rather than against an expectation. The submitted version is then shown as
`Awaiting Approval version 3`, painted **below** the plan in use — measured from painted boxes
rather than document order — and the pinned safety boundary still sits above the approved
content.

Approval, return-for-changes and withdrawal already had coverage in this file and are
deliberately not repeated.

## Gap 3 — the evidence capture has now executed

`CARE_PLAN_CAPTURE_EVIDENCE=1 npm run test:e2e:care-plan-mockup` → **`32 passed (1.9m)`**,
with no `1 skipped`, which is how the atlas test reports itself when it actually runs. It
wrote 26 screenshots, a `manifest.json` stamped with the source commit, and the three
`paper-*.txt` files, all under git-ignored `.local/care-plan/atlas`. `git status` shows
nothing untracked beyond the three intended test files, and `git check-ignore -v` confirms
`.gitignore:21 /.local/` covers them. The capture's own assertions — 26 images, exactly three
`paper-` files — passed for the first time, having never executed before.

## Positive controls — five mutations, five kills, every one reverted

Every one a real production change, built and run through the wrapper, then reverted with the
tree confirmed clean. Every result read from that run's own summary line.

| #   | Mutation                                                                                                                                                  | Full `FAIL` line and message                                                                                                                                                                                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | `patientPlanPaperIntro` returns the joint sentence on both branches (`patient-plan-pages.tsx:129`)                                                        | `1 failed` — `[chromium-mockups] › tests\ui-care-plan-mockup.spec.ts:1039:7 › @mockup Care Plan synthetic prototype › a Patient Plan is marked as needing updating, and its replacement never claims she helped write it` — `Error: expect(locator).toHaveText(expected) failed`, `Received: "This is your copy of the plan you and your team wrote together…"` |
| B   | `patientPlanSectionLeadIn` ignores the team-written map (`patient-plan-transform.ts:185`)                                                                 | same `FAIL … › a Patient Plan is marked as needing updating, and its replacement never claims she helped write it` — `Error: the Patient Plan authoring form still claims joint authorship: /what we wrote down/i`                                                                                                                                              |
| C   | The **printed** sections pinned to `participationState="co_produced"` while the screen and the authoring form stay correct (`patient-plan-pages.tsx:713`) | same `FAIL … › a Patient Plan is marked as needing updating, and its replacement never claims she helped write it` — `Error: the printed team-written Patient Plan still claims joint authorship: /what we wrote down/i`                                                                                                                                        |
| D   | The reading surface renders the open draft in the Current Plan card (`management-plan-read.tsx:495`)                                                      | `1 failed` — `[chromium-mockups] › tests\ui-care-plan-mockup.spec.ts:903:7 › @mockup Care Plan synthetic prototype › a replacement version is drafted and submitted without displacing the Current Plan` — `the Current Plan moved when nothing in this journey should have moved it`, `- Current version 2` / `+ Current version 3`                            |
| E   | The copy misreports its source as version 1 (`patient-plan-pages.tsx:470`)                                                                                | same `FAIL … › a Patient Plan is marked as needing updating…` — `Error: the new copy was not written from the Management Plan version approved without her`, `Expected pattern: /Written from Management Plan version 2/i`                                                                                                                                      |

Control C is the one worth keeping. B kills at the authoring form and short-circuits there, so
without a mutation that leaves the form and the screen correct and moves only the paper, the
printed-sheet guard would never have been shown to fail at all. C was run twice — once before
the assertion reorder and once after — and those two runs are the reason the reorder happened.

**Not controlled, and said rather than implied.** `expectNoReproach` on the paper, the
`Awaiting Approval version 3` text, and the two geometry assertions have no mutation of their
own. The first shares its code path with `expectNoClaimOfJointAuthorship`, which control C
killed; the other three do not. They are asserted, not demonstrated falsifiable.

## Reading the three printed sheets as the people who receive them

The first time anybody has read what this application would actually hand over, as text,
rather than asserting things about it.

**The clinician's Management Plan — the 3am sheet.** The strongest of the three, and it is
ordered the way a sheet read under pressure has to be. The fictional-data marker, the identity
block, then `Do not rely on this plan if today is different — assess afresh`, then the warning
that this is a printed copy and may already be out of date, with an instruction to check the
electronic record for a newer version, for anything withdrawn, and for what has happened
since. Only then the plan's currency — version, owner, approver, approval date, next review,
team, and the linked Personal Safety Plan — and the sentence that it never replaces fresh
triage, physical assessment, mental-state assessment, immediate risk assessment, clinical
judgement, or legal obligations. Then the five numbered sections. Section 4 names who agreed
the default and when, says admission remains available whenever the treating team judges it
necessary, and says plainly that it does not set a ceiling on care and does not bind the
clinician in front of the patient. Section 5 is concrete rather than hedged: chest pain, head
injury, a first episode of confusion, an attempt before arrival, a safeguarding concern about
a child or dependent adult. The contact block closes with `Checked details are not a guarantee
that the service is available`, which is the true claim rather than the comfortable one. **One
observation for the user:** the boundary at the top of the paper reads `What would make this
presentation different (5 listed)` — a count, with the five items themselves forty lines below
in section 5. On a screen the pointer is a scroll away; on paper, if the sheet breaks between
them, the reader is holding a pointer with no referent. `break-inside: avoid` keeps each block
whole and says nothing about the distance between two of them.

**Rowan's Personal Safety Plan — confirmed, and unmistakably theirs.** This is the sheet that
reads best as a document belonging to a person. `My Personal Safety Plan`, their name, their
record number, `Confirmed with you on 03/09/2025` — a genuine recorded moment since user
decision D1 — and then their own words under their own headings: two or three nights of broken
sleep in a row, not answering messages from Jess for more than a day, Jess keeping the spare
medicines at her place, the allotment especially in spring, cold water on the wrists and face,
the podcast so the room is not silent, the late-opening library. Nothing on it is written
_about_ them. Then named people with their numbers, the professional and emergency block, and
the crisis numbers with each service's own limitation attached. **Two observations, both the
user's call.** The crisis contacts appear twice — once inside the person's own
`Professional and emergency support` section and again in the `If you need help now` block —
with MHERL and `000` repeated in slightly different words each time. Repeating a crisis number
is defensible and probably right; it is still redundancy on a sheet meant to be read quickly.
And the confirmation date is nearly eleven months before the printed date. The sheet states
that date honestly and this prototype has no staleness notion for a safety plan, so nothing is
wrong — but a person holding it is not told that what they have was last confirmed a long time
ago.

**Rowan's Patient Plan — and the one thing wrong with the artefact rather than the product.**
The frame reads well. `My plan`, preferred name, record number, `Written on`, the co-produced
opening sentence, then the eight headings each with a plain lead-in, then their own resources:
the after-hours drop-in you can turn up to without ringing first, financial counselling that
will ring a company on your behalf and ask for more time to pay, help with the cost of getting
to appointments and a taxi voucher home if you come in at night, a line for Jess or anyone
else who supports them, peer support who will sit with you in the emergency department if you
would like that. Then the crisis numbers, the printed-at stamp and the shortened footer.
Nothing clinical is on it, and `Not recorded` appears nowhere.

**But the body of all eight sections is the same sentence, eight times over:** `We wrote this
together at the bedside, in your words.` That is the test harness's fill text, not the
product's wording. A Patient Plan has no fixture — a copy exists only once somebody writes one
— so the capture writes one, and it writes identical filler into every field. The consequence
is that `paper-patient-plan.txt` is honest evidence of the sheet's **structure, framing and
resources** and no evidence whatsoever of its **content**. Anybody reading the atlas as "what
a patient would be handed" would be misled about the single thing the atlas exists to show.
This is the most useful finding of the wave, and it is a limitation of the evidence rather
than a defect in the product — recorded as owed below rather than fixed, because filling those
eight sections means writing patient-facing clinical prose, which is the user's and not mine.

## Gates — third wave

Every result read from a real summary line in that run's own output, never from an exit code.

| Gate                                                                      | Result                                                                   |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `npm run test:e2e:care-plan-mockup` (with `CARE_PLAN_CAPTURE_EVIDENCE=1`) | **`32 passed (1.9m)`**, no skips                                         |
| Care Plan + primitive Vitest, 6 files                                     | `Test Files  6 passed (6)` / `Tests  533 passed (533)` (105.28s)         |
| `npm run typecheck`                                                       | real `tsc` invocation, exit 0, zero diagnostics, `GATE_RECEIPTS=refresh` |
| `npm run lint`                                                            | real `eslint … --max-warnings 0`, exit 0, `GATE_RECEIPTS=refresh`        |
| `npx prettier --check` (3 changed)                                        | `All matched files use Prettier code style!`                             |
| Byte scan, 3 changed files                                                | CR=0, control bytes=0, no BOM                                            |

Not run, by user instruction (D2): `verify:pr-local`, `verify:cheap`, `verify:release`,
`build`, `check:*`, `docs:update`, whole-tree `format`, every provider-backed gate. No push, no
pull request, no merge.

**A sixth refusal shape, and the worst yet, because this one was a genuine red.** The first
full browser run of this wave reported `1 failed` / `1 skipped` / `30 passed (10.0m)` and the
surrounding shell reported **exit code 0** — the compound command ended in `tail`, so the exit
code belonged to `tail` rather than to Playwright. Every earlier instance recorded on this
branch was a _refusal_ wearing green. This was a _failure_ wearing green, which is strictly
worse, and it was caught only because the summary line was read.

That failure was mine rather than the product's, and it is worth recording as a fact about the
product: the journey treated a search result as a link. A row in the synthetic patient
directory is a **button** that loads the person into the snapshot beside it, and the link to
the full record belongs to that snapshot. The test waited eight minutes for an element the
product has never had. Fixed at `:1128`, with the reason written beside it.

## Still owed after this wave

1. **`paper-patient-plan.txt` shows the frame, not the words.** All eight section bodies are
   the harness's filler, so the atlas cannot answer the question it was built to answer.
   Closing it means either writing eight plausible patient-facing sections into the capture —
   which is copy, and the user's — or capturing a sheet whose content came from the transform
   rather than from a clinician typing. Recorded rather than reached for.
2. **The team-written sheet is not in the atlas.** The capture writes Rowan's co-produced
   copy. Mira's is now proven by assertion in a real browser, but it is not one of the three
   files a person can sit down and read. Ruling 62 pins the capture at three papers, so adding
   a fourth is a decision rather than an edit.
3. **The clinician sheet's top-of-page boundary gives a count, not the five items**, and the
   items sit far enough below that a page break can separate the pointer from what it points
   at. Observation, not a defect.
4. **The Personal Safety Plan repeats its crisis contacts**, and states a confirmation date
   nearly a year old without remarking on it. Both are the user's call.
5. Everything the first two waves left owed — the provisional patient-facing wording, the
   Patient Plan's absent agreement moment, the participation marker's placement against
   specification line 404, `discussed` keeping the joint wording, and the pre-existing
   clinician-facing overclaim at `patient-plan-pages.tsx:254` — is unchanged. Nothing in this
   wave touched any of them.

---

# Fourth wave — the printed boundary carries its lines, not a count

**Date:** 26 August 2026 · **Base:** `cf5a59948`, tree clean at start · one item, closing
"Still owed" item 3 above.

## The defect, as it read on paper

Item 3 of the previous wave was recorded as an observation. Reading
`.local/care-plan/atlas/paper-management-plan.txt` end to end makes it a defect. The clinician
sheet opened with the boundary sentence and then a **count**:

> Do not rely on this plan if today is different — assess afresh. Then read the full section.
>
> What would make this presentation different (5 listed)

The five items it counted sat roughly forty lines below, in section 5. On screen the jump link
resolves the pointer in one click. On paper there is nothing to jump to, and a page break can
land between the pointer and its referent — leaving a clinician at 3am holding `5 listed` with
nothing underneath. Paper is the artefact that gets carried to the bedside.

## What changed

| File                            | Change                                                                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prototype-ui.tsx:530-570`      | `PinnedSafetyBoundary` gains an optional `medium` prop, defaulting to `"screen"`. The screen branch is the committed code, character for character.          |
| `prototype-ui.tsx:557`          | The print branch renders a plain `<p><strong>` label and the boundary's own lines through the existing `ContentList`, in a `styles.pinnedBoundaryLines` box. |
| `management-plan-print.tsx:209` | The one caller that asks for the printed form: `medium="print"`.                                                                                             |
| `care-plan.module.css:503`      | `.pinnedBoundaryLines` — a grid box, no colour of its own.                                                                                                   |
| `care-plan.module.css:1133`     | The same class joins the existing `@media print` `break-inside: avoid` group, beside `.pinnedBoundary` and `.printPaper`.                                    |

**No new mechanism.** The page-break treatment is the group that already keeps the paper's
other blocks whole; the label is a `<p>`, not a heading, because
`care-plan-linked-routes.dom.test.tsx:1188` pins the printed sheet's level-3 headings to
exactly the five first-minute sections and a sixth would have been a silent lie about the
sheet's structure.

**Section 5 keeps its numbered place.** Lines 64–69 of the captured paper are the same five
items in their sequence position. The pinned form is additional; the duplication is the intent.

### Why a prop rather than `@media print`

The medium-scoped route — render both forms, show one per medium — is **closed by a guard this
branch must not weaken.** `care-plan-route-files.test.ts:556` matches every selector matching
`.pinnedBoundary\w*` and fails on `display: none` anywhere in the stylesheet, including inside
`@media print`. Hiding either form by CSS trips it, and the only ways past are renaming the
class to slip the pattern or relaxing the guard. Both defeat a correct rule: a stylesheet rule
that hides pinned-boundary content in some medium is exactly what that guard is for.

So the branch is in the component. **The consequence, stated plainly:** the Management Plan and
patient-workspace screens are untouched — same link, same count, same wording — but the print
route's own on-screen preview now shows what the paper shows. That surface is a rendering of
the sheet, and a preview that disagreed with the paper would be its own defect; but it is a
visible change on a screen, and it belongs in this report rather than in a footnote.

### `Then read the full section.`

**Dropped on the printed form only; kept verbatim on screen.** On paper the sentence pointed at
something the reader had, by then, just finished reading — the printed block carries the whole
of `whatWouldMakeThisDifferent`, the same array section 5 renders. An instruction to go and read
what is already in front of you spends the reader's attention on the one line where attention is
scarcest. The lead sentence itself — `Do not rely on this plan if today is different — assess
afresh.` — is untouched in both media, as ruled.

### The empty case

If the section has no lines, the printed form is **withheld** and the sheet falls back to the
existing `(0 listed)` line. That is unchanged behaviour, and it is the conservative branch: a
count of zero states the absence on its own line, whereas a label with nothing beneath it is the
heading-over-a-blank this project has already shipped once.

## Proof

Print media is invisible to Vitest (`css: false`), so both halves were needed.

| Check                                                                      | Result                                                          |
| -------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Care Plan Vitest — `care-plan-route-files` + `care-plan-linked-routes.dom` | `Test Files  2 passed (2)` / `Tests  307 passed (307)` (167.0s) |
| `npm run test:e2e:care-plan-mockup`                                        | `31 passed (1.7m)`, `1 skipped` (the opt-in capture)            |
| Same, with `CARE_PLAN_CAPTURE_EVIDENCE=1`                                  | `32 passed (1.8m)`, no skips                                    |
| `npm run typecheck`                                                        | real `tsc`, exit 0, zero diagnostics, `GATE_RECEIPTS=refresh`   |
| `npm run lint`                                                             | real `eslint … --max-warnings 0`, exit 0                        |
| `npx prettier --check` (5 changed)                                         | `All matched files use Prettier code style!`                    |
| Byte scan, 5 changed files                                                 | control bytes 0; committed blobs LF (`core.autocrlf=input`)     |

Counts read from the summary lines, not from exit codes.

### Positive controls

**Static print-stylesheet assertion** — `care-plan-route-files.test.ts:756`. Production change:
removed `.appRoot .pinnedBoundaryLines` from the `@media print` `break-inside: avoid` group at
`care-plan.module.css:1133`.

```
 FAIL  |node| tests/care-plan-route-files.test.ts > Care Plan synthetic, memory-only boundary > keeps the printed patient copy readable, unsplit and unpinned on paper
AssertionError: .pinnedBoundaryLines may be split across a page break, so half of it can be lost on the previous sheet: expected undefined to be 'avoid' // Object.is equality
 Test Files  1 failed (1)
      Tests  1 failed | 23 passed (24)
```

Reverted exactly; re-ran: `Test Files  1 passed (1)` / `Tests  24 passed (24)`.

**Chromium print assertion** — `ui-care-plan-mockup.spec.ts:757-786`, inside
`emulateMedia({media:"print"})`. Production change: removed `medium="print"` from
`management-plan-print.tsx:209`.

```
 1 failed
    [chromium-mockups] › tests\ui-care-plan-mockup.spec.ts:737:7 › @mockup Care Plan synthetic prototype › the clinician Management Plan reaches paper whole
    Error: expect(locator).not.toContainText(expected)
    Call log: the printed boundary still counts its lines instead of printing them
      765 |     await expect(boundary, "the printed boundary still counts its lines instead of printing them").not.toContainText(
```

Reverted exactly; re-ran: `ok 1 … the clinician Management Plan reaches paper whole (2.0s)` /
`1 passed (3.1s)`.

## Reading the sheet, top to bottom

`.local/care-plan/atlas/paper-management-plan.txt`, re-captured at this HEAD. Meeting Rowan for
the first time at 3am, the top of the sheet now reads like this.

The synthetic marker, then the person: name, MRN, date of birth, preferred name, pronouns, home
health service. Then, before any plan content, one boxed block. Its first line is the boundary
itself — do not rely on this plan if today is different, assess afresh — and directly beneath it,
under its own label, the five things that make today different: new or worsening physical
symptoms; a first presentation of confusion or altered conscious state; a stated plan with means
and preparation, or an attempt before arrival; pregnancy, a recent medicine change, or a
suspected overdose; a safeguarding concern about Rowan or someone in their household. Each is a
full sentence, and three of the five say what to do rather than only what to notice.

So the boundary is now **self-contained**. A reader who stops at the top of the sheet — the
hurried reader this section was written for — has the whole of it, and can decide before reading
another word whether this plan applies tonight. Nothing is deferred to a page they may not reach,
and nothing can be separated from the sentence that governs it by a page break. Only then comes
the warning that paper goes stale, then the Current Plan card, and section 5 again in its place
at line 64.

The one thing a reader should know I did not change: the sheet still ends its five items and
moves straight into the plan without restating that the plan itself is continuity care rather
than a substitute for assessment — that sentence is there, at line 42, inside the Current Plan
card where it has always been.

## Still owed

Items 1, 2, 4 and 5 of the previous wave are unchanged and untouched. Item 3 is closed by this
wave. Newly owed:

6. **The print route's on-screen preview changed**, as described above. It is correct — a
   preview should match its paper — but it was not separately reviewed, and if the intent was
   that only the paper move, the alternative is a medium-scoped CSS branch, which cannot be
   built without amending the `display: none` guard at `care-plan-route-files.test.ts:556`.
   That is a ruling, not an edit, and it is the user's.
