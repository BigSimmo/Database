# Task 7 report — ED Presentation timeline, concise recording, plan-use feedback, and visible amendments

Branch `claude/ed-care-plans-impl-7f44cd`, worktree `D:\Worktrees\Database\care-plan-impl`.
One commit, message exactly `feat(care-plan): track ED presentation continuity`. Not pushed.

---

## What was built, and why it is shaped this way

Three surfaces, one shared display vocabulary, and one route builder.

### `presentation-timeline.tsx` — the timeline and the shared vocabulary

`PresentationTimeline` renders an `<ol>` of `<li>` entries, newest first, each carrying its own
arrival date and time, site, the one-line account, presenting indication, assessment outcome,
disposition, the plan version that was available, the plan-use summary, the community-team contact
outcome, the review-suggested text, and the correction count. The line-and-node visual treatment is a
CSS `::before` rule plus an `aria-hidden` node span, so **everything the line implies — episodes, in
time, in order — is carried by the semantic list and the labelled pairs inside it.** A reader who
never sees the line loses nothing. That is the arrangement the Global Constraints require for dense
presentation data, and it is why mutation 26 (turning each `<li>` into a `<div>`) had to fail four
tests.

The file also owns the label records every episode surface reads — dispositions, the three plan-use
scales, the community-team attempt, and `AMENDABLE_FIELD_LABEL`. The select options are read back off
those records rather than transcribed, so a seventh disposition cannot enter the domain without
appearing in every control that offers one.

`linkedPlanLabel` deliberately never degrades a superseded or withdrawn version to "No Current Plan".
An episode from March says which version the clinician actually had in front of them, because that is
the fact the record exists to preserve.

### `presentation-pages.tsx` — the timeline surface and one episode

The **timeline surface** states objective counts over an explicitly named observation window (`7 ED
Presentations recorded in the 12 months to 20/08/2026`), the per-site breakdown, and the sentence that
the counts decide nothing — no threshold, no eligibility, no pathway. It offers a site filter and a
disposition filter. It offers **no ranking or sort control of any kind**; that belongs to the
Identification Review workflow in Task 10, and the tests assert the absence positively. The filters
narrow the list only; the counts describe the window and do not move when a filter does, which is
asserted.

The **episode surface** shows the immutable record, who recorded it and when, the linked plan version,
the plan-use answers, the deviation, the Review Trigger raised from that episode, and every
correction. It validates that the episode belongs to the patient **against the reducer state**, and on
a mismatch shows identity uncertainty and nothing else — no name, no site, no note. The test proves
the other patient's note text is absent from the document, not merely that a warning appeared.

The **amendment Sheet** offers all six `AmendableField` values, each stating the value it is
correcting (and the value the field currently reads, when a correction has already moved it), with the
three plan-use answers inside one `<fieldset>` under one legend and one required reason. On save it
appends **one amendment per changed answer, all under that single reason** — so the interface groups
them and the stored evidence stays one field per record, exactly as the specification requires.

The Sheet is rendered with `portal={false}`. This is deliberate and load-bearing: every Care Plan
stylesheet selector is scoped below `.appRoot`, which is what stops this prototype's CSS reaching the
rest of the product — so a portalled sheet would render its fields with none of that styling and the
multi-line controls would collapse to the shared one-line field height. `portal={false}` is the
documented escape hatch for exactly this, and `tools-search-results-page.tsx` already uses it.

### `presentation-form.tsx` — recording an episode

Six required answers are the whole visible form. Arrival date and time default to `PROTOTYPE_NOW` and
stay editable. Presenting indication, assessment outcome, the community-team attempt and outcome, and
the deviation flag sit behind one `Add more detail` disclosure, closed on open, and never block the
save — proved by a test that saves successfully without ever opening it and then asserts the untouched
optional fields read `Not recorded`.

The linked Management Plan Version is the **Current** version at form open, or `null`. A Draft is
never linked: for Mira (Current version 1 plus version 2 awaiting approval) the form links version 1;
for Alex (a draft and nothing else) it says `No Current Plan was available` and submits
`managementPlanVersionId: null`.

On save it calls `nextPresentationId(state)`, dispatches `record-presentation` with that identifier,
announces only local synthetic recording, and navigates to the matching episode address. The
confirmation panel it renders is the state the surface holds while the router commits; it carries the
announcement, the six answers, the linked version, and any Review Trigger, and the episode page shows
the same facts once the address changes.

### Two design decisions worth flagging

**`reviewSuggested` is `suggestReview || reviewReason` is non-blank.** A clinician who writes what the
team should look at has suggested a review whether or not they also ticked the box, and discarding the
sentence they wrote is the worse of the two readings — the queue would receive a generic "the plan
helped only in part" instead of the specific request. Ticking the box with a blank reason is still
refused, which is where the conditional requirement lives and what mutation 3 kills.

**The episode page's server-side guard was loosened, deliberately.** See "Things I changed that the
brief did not list" below.

---

## Corrections applied, as instructed

1. **Free-text label** — used the specification's `In one line: why they came and what happened`
   verbatim, everywhere: the form, the episode, the correction sheet, and `AMENDABLE_FIELD_LABEL`.
2. **Version number** — the worked example's `Current version 3` was not used. Rowan's plan carries
   `SYN-MGMT-VERSION-002` at `state: "current"`, version 2. The test asserts `Current version 2`.
   Everything else in the example — the route, the four field labels, the announcement text, the
   `Review Suggested` assertion — is kept.
3. **`carePlanRoute.newPresentation`** — added beside the other builders and pinned in
   `tests/care-plan-route-files.test.ts`, exactly as Task 6 did for the two authoring builders.

---

## RED evidence

Tests written first. The route builder and all three surfaces absent:

```
 FAIL  |node| tests/care-plan-route-files.test.ts > Care Plan route registry > rebuilds every deep route from a patient identifier without a second literal
TypeError: carePlanRoute.newPresentation is not a function
 FAIL  |jsdom| tests/care-plan-linked-routes.dom.test.tsx > Care Plan ED Presentation timeline > lists every episode for this patient newest first, as a semantic list with the recorded facts
TestingLibraryElementError: Unable to find an element by: [data-testid="care-plan-presentation-timeline"]
 FAIL  |jsdom| tests/care-plan-linked-routes.dom.test.tsx > Care Plan ED Presentation detail and corrections > refuses to show an episode recorded against another patient
TestingLibraryElementError: Unable to find an element by: [data-testid="care-plan-presentation-identity-uncertain"]

 Test Files  2 failed (2)
      Tests  28 failed | 173 passed (201)
```

Every one of the 28 failures named a missing surface, a missing test id, or the missing route builder.
None failed for an unrelated reason.

## GREEN evidence

Final run of the four Care Plan suites:

```
 Test Files  4 passed (4)
      Tests  332 passed (332)
```

`npm run typecheck`:

```
> node ./node_modules/typescript/bin/tsc -p tsconfig.typecheck.json --noEmit …
[gate-receipts] recorded a pass for "typecheck:internal" (4434 input files).
```

`npm run lint` (includes `eslint-rules/require-button-wiring.mjs`, the design-token rules, and the
icon/z-index rules):

```
> node --max-old-space-size=8192 ./node_modules/eslint/bin/eslint.js src tests scripts worker … --max-warnings 0 …
[gate-receipts] recorded a pass for "lint:internal" (4434 input files).
```

Both were run with `GATE_RECEIPTS=refresh`, so neither is a reused receipt.

Formatting:

```
Checking formatting...
All matched files use Prettier code style!
```

Not run, and why: the full `npm run test`, `verify:cheap`, `verify:ui`, and every provider-backed
gate. The only files outside the Care Plan namespace that import anything I changed are the four Care
Plan test suites and `src/app/mockups/development/page.tsx` (which reads route constants I did not
alter) — I verified that with a namespace-wide import sweep. `typecheck` and `lint` cover
cross-module compilation for the whole repository. Browser proof is Task 11 and is unavailable here.

---

## Mutation testing — 34 mutations, all killed

Every refusal, every filter, every conditional, and every load-bearing assertion was made to fail on
purpose and restored. Run in nine batches of mutually disjoint code paths so each failure is
attributable. Decisive lines below; where a batch produced identical-shape output, the distinct value
is quoted.

### Recording form — validation and conditionals

| #   | Mutation                                          | Test killed                                                      | Decisive line                                                                             |
| --- | ------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | `validate`: drop the `siteId` check               | refuses to record until every required answer is given           | `Unable to find an element with the text: /Emergency department/`                         |
| 2   | `validate`: drop the `note` check                 | refuses to record until every required answer is given           | `Unable to find an element with the text: /In one line: why they came and what happened/` |
| 3   | `validate`: drop the review-reason conditional    | requires a reason when a plan review is suggested                | `Unable to find an element by: [data-testid="error-summary"]`                             |
| 4   | `validate`: drop the deviation-reason conditional | requires a reason when the agreed approach could not be followed | `Unable to find an element by: [data-testid="error-summary"]`                             |

### Recording form — linkage, announcement, navigation, gates

| #   | Mutation                                                 | Test killed                                                                             | Decisive line                                                                                                    |
| --- | -------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 5   | link the open draft in preference to the Current version | links the Current version at form open and never a version still being written          | `Expected … /Current version 1/  Received: Plan available at the time: Awaiting Approval version 2.`             |
| 6   | (same mutation)                                          | says no Current Plan was available and records no plan version when only a draft exists | `Expected … /No Current Plan was available/i  Received: Plan available at the time: Draft version 1.`            |
| 7   | `reviewSuggested` from the checkbox alone                | records plan-use feedback and creates a Review Suggested item                           | `Expected … /The sensory guidance needs clarification/  Received: … says the Current Plan helped only in part …` |
| 8   | navigate to the timeline instead of the episode          | navigates to the episode the reducer actually appended                                  | `- "…/presentations/SYN-PRESENTATION-021"  + "…/presentations"`                                                  |
| 9   | drop `aria-disabled` from the submit control             | refuses to record while the prototype is offline                                        | `Expected the element to have attribute: aria-disabled="true"  Received: null`                                   |
| 10  | disable the identity-uncertain branch                    | writes nothing against a record that is not confirmed as the right person               | `Unable to find an element by: [data-testid="care-plan-identity-uncertain"]`                                     |
| 11  | `mayRecord = actor !== null` (drop the capability check) | offers no recording form at all to a role that does not carry the action                | `Unable to find an element by: [data-testid="care-plan-presentation-unavailable"]`                               |
| 12  | replace the announcement wording                         | records plan-use feedback and creates a Review Suggested item                           | `Expected … /ED Presentation recorded in this synthetic session/i  Received: Saved. Nothing was sent anywhere …` |
| 13  | drop the "Management Plan itself is unchanged" sentence  | records plan-use feedback and creates a Review Suggested item                           | `Expected … /The Management Plan itself is unchanged/i  Received: … Recording an episode never edits a plan.`    |
| 14  | `Disclosure defaultOpen`                                 | keeps the optional detail behind one disclosure that is closed on open                  | `Expected … aria-expanded="false"  Received: aria-expanded="true"`                                               |
| 15  | (same mutation)                                          | opens the optional detail on request                                                    | `Expected … aria-expanded="true"  Received: aria-expanded="false"`                                               |

### Timeline surface

| #   | Mutation                                         | Test killed                                                                             | Decisive line                                                                                                           |
| --- | ------------------------------------------------ | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 16  | drop the site-filter condition                   | filters the timeline by emergency department                                            | `expected [ <li …(1)>…(2)</li>, …(7) ] to have a length of 2 but got 8`                                                 |
| 17  | drop the disposition-filter condition            | filters the timeline by disposition and says plainly when nothing matches               | `expected [ <li …(1)>…(2)</li>, …(7) ] to have a length of 1 but got 8`                                                 |
| 18  | render the timeline instead of the empty state   | filters the timeline by disposition and says plainly when nothing matches               | `expected <ol …(2)></ol> to be null`                                                                                    |
| 19  | count all episodes, not the window               | states the observation window and the objective counts                                  | `Expected … /7 ED Presentations recorded in the 12 months to 20\/08\/2026/i  Received: … 8 ED Presentations recorded …` |
| 20  | drop the "counts decide nothing" sentence        | states the observation window and the objective counts                                  | `Expected … /Counts describe what happened. They decide nothing/i`                                                      |
| 21  | reverse the entry order                          | lists every episode for this patient newest first                                       | `Unable to find an element with the text: /Mental health admission/`                                                    |
| 22  | always report zero corrections                   | shows how many corrections an episode carries                                           | `Unable to find an element with the text: /1 correction recorded/i`                                                     |
| 23  | link each entry to the timeline, not the episode | shows how many corrections an episode carries and links each episode to its own address | `Expected href="…/presentations/SYN-PRESENTATION-001"  Received: href="…/presentations"`                                |
| 24  | render "Suggested" instead of the review reason  | lists every episode for this patient newest first                                       | `Unable to find an element with the text: /First admission since the plan was agreed/`                                  |
| 25  | pass `null` as the linked version                | lists every episode for this patient newest first                                       | `Unable to find an element with the text: /Current version 2/`                                                          |
| 26  | `<li>` → `<div>` for each entry                  | four timeline tests                                                                     | `Unable to find an accessible element with the role "listitem"`                                                         |

### Episode surface and corrections

| #   | Mutation                                                 | Test killed                                                                               | Decisive line                                                                                                                      |
| --- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 27  | disable the belongs-to-this-patient check                | refuses to show an episode recorded against another patient                               | `Unable to find an element by: [data-testid="care-plan-presentation-identity-uncertain"]`                                          |
| 28  | attribution drops the recorder lookup                    | shows the immutable episode, who recorded it and when                                     | `Expected … /Dr Casey Example/  Received: Recorded by an unrecorded clinician on 11/08/2026, 11:15 pm.`                            |
| 29  | trigger looked up by position, not `sourceId`            | shows the immutable episode, who recorded it and when                                     | `Expected … /First mental-health admission since this version was agreed/i`                                                        |
| 30  | show the _effective_ value as "Recorded as"              | shows an existing correction beside the value first recorded                              | `Expected … /Recorded as Helpful/  Received: … Was the plan helpful?Recorded as Helped in partCorrected to Helped in part …`       |
| 31  | drop the "Recorded as" span entirely                     | shows an existing correction beside the value first recorded                              | `Expected … /Recorded as Helpful/`                                                                                                 |
| 32  | drop the reason check in the sheet                       | refuses a correction with no reason, and one that changes nothing                         | `Unable to find an element by: [data-testid="care-plan-amendment-error"]`                                                          |
| 33  | drop the nothing-changed check                           | refuses a correction with no reason, and one that changes nothing                         | `Expected … /Change at least one answer before recording a correction/i  Received: A correction needs a reason …`                  |
| 34  | dispatch only the first changed field                    | appends one correction per changed plan-use answer under a single reason                  | `expected [ <li …(1)><p …(1)></p>` (2 expected, 1 rendered)                                                                        |
| 35  | dispatch a fixed reason instead of the typed one         | appends one correction per changed plan-use answer under a single reason                  | `Expected … /On reflection only part of the plan could be followed/  Received: … Corrected.Dr Casey Example — 20/08/2026, 2:31 pm` |
| 36  | `isSyntheticPresentationId` accepts any non-empty string | accepts an episode identifier recorded in this session while still refusing a non-address | `expected true to be false` at `isSyntheticPresentationId("SYN-PATIENT-001")`                                                      |

(Thirty-four distinct mutations; rows 5/6 and 14/15 are one mutation each proved against two tests,
and row 26 is one mutation proved against four.)

Mutation 30 is the most valuable of the set. Its decisive line — `Recorded as Helped in part /
Corrected to Helped in part` — is precisely the append-only failure the specification exists to
prevent: the correction printed twice and the value it replaced lost from the screen. See "The
fixtures and the reducer disagree" below for why that mutation is not hypothetical.

**No lease-refused run was scored.** `Database focused-test capacity is full` was hit repeatedly on
this machine; every such run produced no `Test Files` line and was retried in a loop until a lease was
held. The retry loop is in the transcript.

---

## Things I changed that the brief did not list, and why

The brief's file list named five files. As Tasks 5 and 6 both found, it was incomplete.

1. **`routes.ts`** — added `carePlanRoute.newPresentation`, per Correction 3. Also added
   `isSyntheticPresentationId`, for item 2 below.

2. **`src/app/mockups/care-plan/patients/[patientId]/presentations/[presentationId]/page.tsx`** — the
   guard was `isSyntheticPresentationForPatient`, which answers from the fixtures. **That would have
   404'd every episode recorded in a session.** The page is a server component with no view of the
   in-memory state, so it cannot answer the question that matters; `SYN-PRESENTATION-021` is a real
   address the fixture pairing has never heard of, and the brief's own requirement to "navigate to the
   matching detail route" would have landed a clinician on a not-found page for the record they had
   just created. The page now refuses only what is not an address at all, and the surface — which
   holds the state — makes the belongs-to-this-patient decision and shows identity uncertainty rather
   than a nearby person's episode. That is a strictly stronger check than the one it replaced, because
   it also covers records the fixtures do not contain. Both halves carry tests.

3. **`domain.ts`** — added `getPresentationAmendments`, `getEffectivePresentationValue`, and
   `getRecordedPresentationValue`. The first two encode a rule the reducer already had privately;
   rather than write a second copy in the reading surfaces I moved the rule to the pure-selector
   module and had the reducer call it. A reading surface and the reducer disagreeing about "the
   current value of this field" would let a correction be refused as a no-op against a value the
   screen never showed.

4. **`prototype-state.ts`** — two lines: the import, and `effectiveFieldValue` now delegating to the
   shared selector. **No action was added, no branch changed, no behaviour altered.** All 1,416 lines
   of the reducer suite still pass unchanged.

5. **`prototype-ui.tsx`** — added `formatPerthDateTime`. An episode is read by time of night as much
   as by date, and the module is the shared formatting vocabulary the brief tells me to consume rather
   than duplicate.

6. **`care-plan.module.css`** — the timeline, correction, and disclosure classes. `timelineLink`
   joins the existing `.pinnedBoundaryLink, .inlineLink` rule, and I added both new link classes to
   the `keeps the pinned boundary's jump link … looking like a link` guard, since sharing that rule is
   the exact arrangement that broke once on 2026-08-22.

7. **`tests/care-plan-route-files.test.ts`** — the `newPresentation` builder pin, the
   `isSyntheticPresentationId` shape test, and the two new link classes on the link-affordance guard.

8. **Three Task 3 route-purpose tests** for `presentations`, `newPresentation`, and `presentation`
   were removed and those three routes added to `replaces the route-purpose surface on every route
that now has real content`. Tasks 4, 5 and 6 each did the same for their routes.

---

## What I found wrong, and one thing I did not fix

### The worked example's test would not have passed as written

Separately from the version number the controller already corrected: the example fills three answers
(disposition, plan use, plan helpfulness) and submits. The specification requires six. The example
would have hit the error summary. I kept the route, the four field labels, the announcement text and
the `Review Suggested` assertion verbatim, and filled the remaining three required answers.

Also, `screen.getByLabelText("Disposition")` as an exact string does not match: the shared `FormField`
puts `(required)` in the label text, which is deliberate repository behaviour (`COMPONENTS §4` —
the requirement is in the label text so it survives colour loss and is read as part of the accessible
name). Every label query in the new tests is therefore anchored (`/^Disposition/`) rather than exact.

### The fixtures and the reducer disagree about append-only — **not fixed, and it needs a ruling**

This is the one thing I want the controller to look at.

- The reducer never touches `edPresentations` when it appends a correction. `tests/care-plan-prototype-state.test.ts`
  pins that: _"adds a visible amendment without changing the original ED Presentation"_.
- The **fixtures do the opposite.** `SYN-PRESENTATION-003` stores `planHelpfulness: "mixed"` while
  `SYN-AMENDMENT-002` records `originalValue: "helpful" → replacementValue: "mixed"`. Same shape for
  `SYN-PRESENTATION-002` and `SYN-AMENDMENT-001`. And `tests/care-plan-domain.test.ts` **pins that
  convention deliberately** — _"records one attributed amendment per amendable field, matching the
  corrected record"_ asserts `String(presentation[amendment.field]) === amendment.replacementValue`.

So the seeded data models "the episode carries the corrected value", and the reducer models "the
episode is never rewritten". Both are pinned by committed tests. The specification is unambiguous —
_"ED Presentation records are append-only in the domain model"_ — so the reducer is right and the
fixture convention is wrong.

I did **not** change the fixtures. Doing so means editing a Task 1 file and deleting an assertion a
Task 1 test wrote on purpose, which is the controller's call, not mine. Instead the episode surface
reads the value first recorded from the **first correction's `originalValue`**, falling back to the
stored field when the field has never been corrected. That is the truthful original under both
models — for reducer-written corrections the two are the same string — so nothing renders wrongly
today, in the fixtures or in a live session.

The cost of leaving it: `edPresentations` is not literally append-only in the seeded state, so any
future code that reads the stored field expecting the original will be wrong for two fixture records.
Mutation 30 shows exactly what that looks like on screen.

### Verification-integrity notes

- **The three focus assertions the brief's hazard warning names were not written.** No test in this
  task asserts final-state focus in a Care Plan component, because the shell's pathname-keyed effect
  commits last and would repair whatever a descendant did — such an assertion cannot fail. The
  `ErrorSummary` is the single focus owner and `form-field.tsx` was not touched, per the instruction.
- **The disclosure's "closed on open" is asserted through `aria-expanded`, not through absence.**
  Vitest runs `css: false`, so the collapsed panel's `hidden` utility does nothing in jsdom and its
  fields remain queryable. Asserting `queryByLabelText(...)` to be null there would be a test that
  cannot fail for the right reason. `aria-expanded` plus a successful save without opening it is what
  the requirement actually needs.

### CR and control-byte scan

Every file was written with the editor tools; no Python, `sed`, or shell heredoc touched source.

All twelve staged blobs: **CR = 0, control bytes = 0, non-breaking spaces = 0, BOM = 0.**

The working tree shows CRLF on the files I edited (the editor writes CRLF on this Windows checkout).
`core.autocrlf=input` plus `.gitattributes` `* text=auto eol=lf` normalise on staging, and I verified
the staged blobs directly rather than trusting that — the numbers above are read out of
`git show :<path>`, not off disk. `prettier --check` passes on both. No committed file carries a CR.

---

## Files

**Created**

- `src/components/care-plan/mockups/presentation-timeline.tsx`
- `src/components/care-plan/mockups/presentation-form.tsx`
- `src/components/care-plan/mockups/presentation-pages.tsx`

**Modified**

- `src/components/care-plan/mockups/routable-suite.tsx` — three routes wired
- `src/components/care-plan/mockups/routes.ts` — `newPresentation` builder, `isSyntheticPresentationId`
- `src/components/care-plan/mockups/domain.ts` — three amendment selectors
- `src/components/care-plan/mockups/prototype-state.ts` — two lines, delegating to the shared selector
- `src/components/care-plan/mockups/prototype-ui.tsx` — `formatPerthDateTime`
- `src/components/care-plan/mockups/care-plan.module.css` — timeline, correction, disclosure classes
- `src/app/mockups/care-plan/patients/[patientId]/presentations/[presentationId]/page.tsx` — guard split
- `tests/care-plan-linked-routes.dom.test.tsx` — 30 new tests, 3 Task 3 tests retired
- `tests/care-plan-route-files.test.ts` — builder pin, shape test, two link classes on the guard

**Not touched:** `fixtures.ts`, `types.ts`, `src/components/ui/form-field.tsx`,
`docs/care-plan/sdd-ledger.md`. No reducer action was added.

---

## Concerns

1. **The fixture/reducer append-only contradiction above needs a ruling.** It is the only genuine
   defect I found and left in place.
2. **The confirmation panel on the recording form is transient in the running application.** The
   surface dispatches, announces, and navigates, as the brief specifies, so the router replaces the
   panel almost immediately. The panel is what the tests assert on, and the episode page shows the
   same facts afterwards, but a reviewer may reasonably prefer the panel to _be_ the destination with
   an explicit link. I followed the brief.
3. **`presentationIdFromPathname` parses the address rather than reading a route parameter.** That is
   consistent with `carePlanPatientIdFromPathname`, which Task 3 established, but it is a second place
   the URL shape is known.
4. **No browser proof.** The line-and-node treatment, the phone single-column layout at 320 px and
   390 px, forced colours, and the in-tree Sheet's overlay behaviour have not been seen rendered. The
   `portal={false}` decision in particular is reasoned from the stylesheet-scoping rule and the
   primitive's own documentation, not observed. Task 11 should look at it first.
5. **`npm run verify:cheap` was not run.** The change is confined to the Care Plan namespace and its
   only external consumer reads route constants I did not alter; `typecheck` and `lint` cover
   cross-module compilation. If the controller wants the broad offline gate before handoff, it has not
   been run.

---

# Fix round 1 — the append-only ruling, three Important findings, and the minors

Second commit on the same branch. Everything below is additive to the work described above; nothing
already reported was undone.

## The ruling: the fixtures were corrected, and the invariant is now a guard

Two seeded episodes carried the value a correction _made_ them rather than the value they were first
recorded as, and `tests/care-plan-domain.test.ts` pinned that convention on purpose while
`tests/care-plan-prototype-state.test.ts` pinned the opposite. The glossary settles it — a
Presentation Amendment "preserves the original record" — so the reducer was right and the fixtures
were wrong, and fixtures on this project are written to be imitated.

- `SYN-PRESENTATION-002.assessmentOutcome` → `"Settled with a quiet room; home the same evening"`,
  the value `SYN-AMENDMENT-001` records as the original.
- `SYN-PRESENTATION-003.planHelpfulness` → `"helpful"`, the value `SYN-AMENDMENT-002` records as the
  original.

Both now carry a comment naming the amendment that corrected them, so the next person to imitate a
fixture imitates the right shape.

`tests/care-plan-domain.test.ts` was inverted as instructed: the episode field must equal the
**earliest** amendment's `originalValue` for that field, not the replacement. The comment there
records why, because a bare inversion would look like a mistake to whoever reads it next.

A dedicated invariant guard was added beside it —
_"keeps every corrected fixture field on an unbroken chain from the value first recorded"_ — asserting
both halves: the episode still holds what it was first recorded as, and each later correction's
`originalValue` equals the previous one's `replacementValue`. It fails closed if the fixtures ever
carry no corrections at all, so it cannot become vacuous the way the divergence it exists for did.

**Blast radius, checked rather than assumed.** All 335 tests pass. Neither corrected field is a
`disposition`, and `countPresentationActivity` keys only on `siteId` and `arrivedAt`, so no count or
filter moved. `reviewTriggerReasonFor` only ever sees newly recorded episodes. The existing detail
test at `tests/care-plan-linked-routes.dom.test.tsx` reads the amendment rather than the episode and
needed no change — `getRecordedPresentationValue` returns `"helpful"` from the amendment chain either
way, which is precisely why the reading model survived a fixture change underneath it.

## Important 1 — the dynamic-parameter guard was inert for the episode page

`isSyntheticPatientId|isSyntheticPresentationForPatient` was one alternation covering two different
parameters, and the patient half satisfied it alone. Deleting the presentation check from the page
left the identifier unvalidated at the server with nothing going red.

Replaced with a per-parameter rule: a page whose path declares `[patientId]` must call
`isSyntheticPatientId(patientId)`, and a page declaring `[presentationId]` must call a presentation
guard on `presentationId`. Both are matched by name, so no page can satisfy one parameter's rule with
another parameter's check. It also asserts that exactly one page carries `[presentationId]`, so the
presentation half cannot quietly stop being exercised.

## Important 2 — a correction could be dropped behind a success banner

`recordCorrection` now refuses the whole save rather than dispatching a partial one. It checks, before
dispatching anything: the degraded-state block, the missing reason, nothing-changed, and — the new
one — any changed free-text field whose replacement is blank, naming the field. Replacements are
trimmed before both the comparison and the dispatch, so trailing whitespace is neither mistaken for a
change nor written into the record. The sheet stays open holding the clinician's work whenever a
refusal applies.

Refusing the whole save is deliberate over refusing per field: the reducer's refusal lands only in
`lastOutcome`, which the next successful correction in the same batch overwrites, so there is no
arrangement in which a partial save can report itself honestly.

## Important 3 — the timeline showed pre-correction values

`effectivePresentation` returns the stored record with every corrected field replaced by its latest
correction, and the timeline renders that. The episode page still shows the value first recorded
beside each correction, because that is where the full history belongs; a timeline entry states what
the record says today. `correctionSummaryLabel` now names which answers moved
(`1 correction recorded — Was the plan helpful?`), because a bare count tells a reader a correction
exists but not whether the values beside it are the current ones.

This was invisible until the fixture correction above, exactly as the review predicted.

## Minors fixed

- **Label drift.** `AMENDABLE_FIELDS`, `PRESENTING_INDICATION_LABEL` and `REVIEW_REASON_TERM` now live
  beside `AMENDABLE_FIELD_LABEL` in `presentation-timeline.tsx`, and the timeline, the episode page
  and the form all read them. The timeline was the fourth caller doing what that file's own docblock
  forbids; it now calls each field what every other surface calls it.
- **Arrival time has its own error.** Date and time are validated separately and the time control is
  bound to its own message, so an error-summary link lands on the control that is actually wrong.
  This mattered because the summary is the sole focus owner in that form.
- **`timelineLink` carries `min-height: var(--spacing-tap)`** in its own rule; colour, weight and
  underline still come from the shared link rule, so the link-affordance guard still sees all four.
- **Three copy defects**: `1 ED Presentation` is now singular; the empty-filter message only tells a
  reader to widen a filter when one is actually set, and otherwise says plainly that nothing has been
  recorded; and the older-episodes line handles both zero and one.

## Recorded for the ledger, not fixed

As instructed — `linkedPlanLabel` conflating "version unknown" with "there was none";
`isSyntheticPresentationForPatient` having no production consumer while reading as a live guard; the
reason-required sentence duplicated between `presentation-pages.tsx` and `prototype-state.ts`;
`presentation-pages.tsx` at ~660 lines carrying two surfaces plus the sheet; and `AmendableRow`
re-filtering the amendment array twice per field. Plus `portal={false}` on the Sheet as Task 11's
first look, since with `css: false` no committed test can see its overlay, backdrop, or focus trap.

## Verification

```
 Test Files  4 passed (4)
      Tests  335 passed (335)
```

`tests/care-plan-domain.test.ts`, `tests/care-plan-prototype-state.test.ts`,
`tests/care-plan-linked-routes.dom.test.tsx`, `tests/care-plan-route-files.test.ts` — the complete
consumer set for every file touched. Three new tests (the fixture chain invariant, the dropped-
correction refusal, the corrected timeline entry) and one strengthened assertion on the correction
summary.

`npm run typecheck` and `npm run lint`, both with `GATE_RECEIPTS=refresh` so neither is a reused
receipt:

```
[gate-receipts] recorded a pass for "typecheck:internal" (4434 input files).
[gate-receipts] recorded a pass for "lint:internal" (4434 input files).
```

```
Checking formatting...
All matched files use Prettier code style!
```

### Positive controls — five, all killed

| Mutation                                                                                     | Test killed                                                                                | Decisive line                                                                                                                                  |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Restore the old fixture convention: `SYN-PRESENTATION-003.planHelpfulness` back to `"mixed"` | records one attributed amendment per amendable field, preserving the value first recorded  | `AssertionError: expected 'mixed' to be 'helpful'`                                                                                             |
| (same mutation)                                                                              | keeps every corrected fixture field on an unbroken chain from the value first recorded     | `SYN-PRESENTATION-003.planHelpfulness must still hold the value it was first recorded as: expected 'mixed' to be 'helpful'`                    |
| Delete `!isSyntheticPresentationId(presentationId)` from the episode page                    | validates every dynamic parameter and repeats no synthetic identifier in a page file       | `…[presentationId]/page.tsx must validate its presentationId parameter, by name: expected 'import { notFound } from "next/nav…'`               |
| Drop the blanked-replacement refusal in `recordCorrection`                                   | refuses the whole correction rather than dropping a blanked answer behind a success banner | `Unable to find an element by: [data-testid="care-plan-amendment-error"]`                                                                      |
| Timeline renders the stored record instead of `effectivePresentation`                        | shows the corrected answer on a timeline entry, not the value it replaced                  | `Unable to find an element with the text: /Available · Partly used · Helped in part/` — the entry rendered `Available · Partly used · Helpful` |
| `correctionSummaryLabel` → `correctionCountLabel`                                            | shows how many corrections an episode carries and links each episode to its own address    | `Unable to find an element with the text: /1 correction recorded — Was the plan helpful\?/i`                                                   |

The first mutation is the one worth keeping in mind: restoring the old convention on a single fixture
field takes down both halves of the invariant at once, which is the coverage the six preceding tasks
did not have.

No lease-refused run was scored; the retry loop was used throughout.

### CR and control-byte scan

Every file written with the editor tools. All fifteen staged blobs: **CR = 0, control bytes = 0,
non-breaking spaces = 0, BOM = 0**, read out of `git show :<path>` rather than off disk.

## Concerns after this round

1. **The reading model now depends on the fixtures being right, where before it tolerated both.**
   `getRecordedPresentationValue` reads the amendment chain, so it survived the fixture change without
   an edit — but the new invariant guard is what keeps the two conventions from drifting apart again,
   and it only covers fixtures. Nothing checks the same property over reducer-produced state, because
   the reducer cannot violate it by construction.
2. **Refusing the whole correction is a deliberate trade.** A clinician who blanks one field loses
   nothing, but they must fix that field before any of their other corrections are recorded. The
   alternative — recording what is valid and reporting what was not — needs the reducer to return
   per-dispatch outcomes, which is a reducer change and out of scope here.
3. **The timeline now shows corrected values while the episode page shows both.** That is the right
   split, but it means the same field reads differently on two screens. The correction summary naming
   the moved fields is what ties them together; whether that is enough is a judgement worth making
   with the rendered page in front of you at Task 11.
4. Still no browser proof, and `portal={false}` remains unobserved.
