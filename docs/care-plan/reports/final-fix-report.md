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

- **`discussed_not_confirmed` keeps the joint wording**, mirroring `PARTICIPATION_MARKER_STATES`. A
  plan discussed with somebody who did not confirm it is not a plan written without them, and the
  user's instruction is about the case where the person took no part at all. Pinned by its own test.
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

## Still owed after this wave

1. **All five new wordings are provisional**, awaiting the user's patient-facing copy pass, together
   with the first wave's opening sentence. The footer remains the only patient-facing copy the user
   has settled.
2. **The sheet's title `My plan`** on a plan the person took no part in — noted above, not changed.
3. `discussed_not_confirmed` on the joint wording is a deliberate boundary, now pinned by a test
   rather than left implicit.
4. The remaining first-wave items are unchanged: a genuine agreement moment for the Patient Plan, and
   the marker's placement on the paper as a reading of spec line 404.
