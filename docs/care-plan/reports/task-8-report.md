# Task 8 report — the patient's own Personal Safety Plan, its versioning, and its printed copy

Worktree `D:\Worktrees\Database\care-plan-impl`, branch `claude/ed-care-plans-impl-7f44cd`.
Nothing under `D:\Repos\Database\.claude\worktrees\` was created, read, or written.

Committed as `87b28b3acc47a6bdde0a58b2d5c0e815b0e5f5f1` —
`feat(care-plan): add printable personal safety plans`. Not pushed. `docs/care-plan/sdd-ledger.md`
untouched, still at `5e8f812a7`. The working tree is clean.

## What was built, and why it is shaped this way

Three routes gained real content — `safety-plan`, `safety-plan/edit`, `safety-plan/print` — and
their Task 3 purpose surfaces were removed.

**The seven sections are generated, never transcribed.** `SAFETY_PLAN_SECTION_LABEL` in
`prototype-ui.tsx` is a `Record<keyof SafetyPlanContent, string>`, so the compiler refuses a
missing heading and refuses a renamed key, and `SAFETY_PLAN_SECTION_KEYS` is read back off that
record rather than written out again. Every surface — the reading page, the printed sheet, and
the authoring form — iterates those keys. An eighth section cannot appear by hand, and a rename
cannot silently drop one. This is exactly the arrangement Task 4 used for the five first-minute
sections, and for the same stated reason.

**One rendering of the seven, shared by screen and paper.** `SafetyPlanSections` is used by both
the reading surface and the print surface, so the person's own document cannot say two different
things in two places.

**No senior approval anywhere.** There is no approve control, no reviewer, no awaiting state, and
no mention of approval on either surface — a committed test asserts the absence rather than
assuming it. `plan_coordinator` is the only role without `author_safety_plan`, so the default
signed-in ED clinician can write one, which is the point: the emergency department at 2am is
where a safety plan most often actually gets made.

**Patient confirmation is described, never scored.** `PATIENT_CONFIRMATION_LABEL` and
`PATIENT_CONFIRMATION_EXPLANATION` give each of the four states a neutral label and a sentence.
A test scans every label and the rendered declined state against a non-compliance vocabulary
(`non-complian`, `failed to`, `refused`, `non-engage`, `missing`, `incomplete`, …).

**The printed sheet is minimum-necessary and addressed to the person.** Preferred name, synthetic
record number, version, last-confirmed date, the seven sections, then who to ring. No date of
birth, no pronouns, no home health service, no full name, no ED presentation content, no audit
history, no Management Plan metadata, and no clinical vocabulary. Asserted by absence, not by
inspection.

**The four public crisis numbers stay real.** `000`, MHERL Perth `1300 555 788`, MHERL Peel
`1800 676 822` and Rurallink `1800 552 002` are read from `publicCrisisContacts` with their
coverage, availability, the not-an-emergency-service caveats, and the official page each was
checked against. A test iterates the fixture and requires every number, every availability
string, every caveat and every source URL to be on the paper — so a future edit that
"fictionalises" one of them, or drops a caveat, goes red.

**Printing is exempt from the offline block and from nothing else.** The print control asks
`getPrototypeMutationBlockReason` for `record-safety-plan-print-intent`: under `offline` that
returns `null` and the control works; under `permission-unavailable` it returns a reason, the
control becomes `aria-disabled` (never native `disabled`) with an inert handler, and
`window.print()` is not called. Identity uncertainty removes the paper entirely.

**The `print-failure` specimen never calls `window.print()`**, keeps the complete plan and the
crisis numbers on screen, and states what happened, what it means and what the reader can do. It
also records **no** audit intent, because "the browser print view was opened" would be untrue and
this application's account of itself must not claim more than it did.

## Deviations from the brief, and why

1. **`carePlanRoute.safetyPlanEdit` and `safetyPlanPrint` did not exist** — confirmed. Both were
   added beside the existing builders and the route-registry test was extended, exactly as Tasks 6
   and 7 did. As the correction predicted, the brief's file list was also incomplete: `routes.ts`,
   `tests/care-plan-route-files.test.ts` and `tests/care-plan-domain.test.ts` were needed too.

2. **The printed document title is an `<h2>`, not an `<h1>`, and the seven sections are `<h3>`.**
   The brief's example asserts `heading level 1, name "My Personal Safety Plan"` and seven level-2
   headings. That cannot hold: `tests/care-plan-linked-routes.dom.test.tsx` has pinned _exactly one
   `<h1>` per route_ since Task 3, and the shell owns it ("Print Personal Safety Plan"). A second
   `<h1>` inside the paper would break that committed contract. Task 5's printed clinician summary
   resolved the identical tension the same way. The equivalent assertions were written instead:
   level-2 `My Personal Safety Plan` inside the paper, and the seven level-3 headings compared
   against the generated label list.

3. **The person's own six sections are not required when the confirmation is `declined` or
   `unavailable`.** The brief says "require at least one item in every section" and, in the next
   sentence, "do not treat declined or unavailable as non-compliance". Taken literally the first
   sentence makes the second impossible to honour: the fixtures already carry a legitimate
   _current_ version (Evie, `SYN-SAFETY-VERSION-004`) that holds only the crisis numbers because
   she declined, and the form could not reproduce the very state the prototype demonstrates. Worse,
   requiring seven sections of somebody's own words when that person had no part in the version
   would push a clinician to **invent words and attribute them to a person who never said them**.
   So: the next review date, the collaboration note, and the professional-and-emergency contacts
   are required in every case; the six patient-voice sections are required only when the person
   confirmed or discussed the version. A test pins both halves, including that the contacts stay
   required when the person declined. Flagged as a deliberate, narrow departure.

4. **`print-output.tsx` was not changed at all.** Task 5's additive capabilities —
   `monochrome`, `confidential`, `printedAt`, and `PrintSection`'s break control — covered
   everything this needed. The paired regression run the brief required is therefore not owed.

5. **No reducer action was added.** All four safety-plan actions existed from Task 2. One pure
   selector was added — `getOpenSafetyPlanDraft` in `domain.ts`, mirroring `getOpenManagementDraft`
   — because both the reading surface and the form need the same answer and two private copies
   would be free to drift. It has its own unit test.

6. **The brief's `it.each` purpose-surface list** in the existing shell describe still named the
   three safety routes; they were removed from it, as Tasks 4–7 removed theirs.

## RED evidence

Vocabulary and route builders were added first (pure data, no surfaces) so the RED would name the
missing surfaces rather than a missing import.

`npm run test -- tests/care-plan-route-files.test.ts`:

```
 FAIL  tests/care-plan-route-files.test.ts > ... > keeps the printed patient copy readable, unsplit and unpinned on paper
AssertionError: .safetyPaper declares no printed font size, so the patient copy is not sized for paper: expected undefined to be defined
 FAIL  tests/care-plan-route-files.test.ts > ... > maps an outcome to a tone in exactly one place
Error: ENOENT: no such file or directory, open '...\safety-plan-pages.tsx'
 Test Files  1 failed (1)
      Tests  2 failed | 21 passed (23)
```

`npm run test -- tests/care-plan-linked-routes.dom.test.tsx`:

```
 FAIL  ... > renders exactly the seven patient-voice sections, in the specified order
TestingLibraryElementError: Unable to find an element by: [data-testid="care-plan-safety-sections"]
 FAIL  ... > prints the patient-facing document with exactly the seven sections, in order
TestingLibraryElementError: Unable to find an element by: [data-testid="care-plan-safety-print-output"]
 FAIL  ... > says plainly when the signed-in role does not carry safety-plan authoring
TestingLibraryElementError: Unable to find an element by: [data-testid="care-plan-safety-form-unavailable"]
 Test Files  1 failed (1)
      Tests  31 failed | 179 passed (210)
```

All 31 failures were "the Safety Plan surfaces do not exist".

## GREEN evidence

`npm run test -- tests/care-plan-domain.test.ts tests/care-plan-prototype-state.test.ts tests/care-plan-route-files.test.ts tests/care-plan-linked-routes.dom.test.tsx`:

```
 Test Files  4 passed (4)
      Tests  365 passed (365)
   Duration  61.68s
```

Thirty-two of those are new: 31 in the three Personal Safety Plan describes, and one for the
domain selector. The safety-plan subset alone, `-t "Personal Safety Plan"`, reads
`Tests  31 passed | 177 skipped (208)`.

`GATE_RECEIPTS=refresh npm run typecheck` — fresh run, not a reused receipt:

```
> node ./node_modules/typescript/bin/tsc -p tsconfig.typecheck.json --noEmit …
[gate-receipts] recorded a pass for "typecheck:internal" (4436 input files).
```

`GATE_RECEIPTS=refresh npm run lint` — fresh run:

```
> node --max-old-space-size=8192 ./node_modules/eslint/bin/eslint.js src tests scripts worker supabase playwright … --max-warnings 0 …
[gate-receipts] recorded a pass for "lint:internal" (4436 input files).
```

`npx prettier --check src/components/care-plan/mockups/ tests/care-plan-*.ts tests/care-plan-*.tsx`
reports no issues.

Not run, and why: `verify:cheap`, `verify:pr-local`, `verify:ui`, `verify:phone-chrome`,
`check:production-readiness` and every provider-backed gate. The diff is confined to the gated
`/mockups/care-plan` prototype namespace, which is memory-only, provider-free, and 404s in
production; browser and print-medium proof is Task 11's, and browser verification is unavailable
in this environment. `print-output.tsx` was not touched, so the paired
`therapy-compass-responsive-contract` / `therapy-global-convergence-contract` /
`print-output-capabilities.dom` run the brief conditioned on that change is not owed.

## How each print assertion could actually fail

Vitest runs `css: false`, so a DOM test that asserts a class token is present proves nothing about
what prints. Each print claim is therefore anchored somewhere it can fail:

| Claim                                                 | Where it is asserted                                                                                                                                                                   | How it goes red                                                                                                                                                                                                                                                           |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The synthetic watermark reaches the paper             | DOM: the marker's `closest("[data-print-output]")` is the paper **and** `closest("[data-print-hide='true']")` is `null`                                                                | Deleting the marker from the paper, or wrapping it (or any ancestor) in print-hidden chrome. The ancestor form is the one that matters: the original defect twice over was inherited, so asserting only that the element itself lacks the attribute would have missed it. |
| Each section survives a page break                    | DOM: every level-3 section heading has a `[data-print-break-inside='avoid']` ancestor                                                                                                  | Replacing `PrintSection` with a plain `div`, which is exactly how the attribute would be lost in a refactor.                                                                                                                                                              |
| The paper is set in readable type                     | Static: a brace-matched parse of `care-plan.module.css` finds the rules nested inside `@media print` and requires `.appRoot .safetyPaper` to declare a `font-size` of at least 11pt    | Deleting the print font-size rule, or shrinking it to fit more on a page.                                                                                                                                                                                                 |
| Sections and crisis contacts are not split            | Static, same parser: `.appRoot .safetySection` and `.appRoot .crisisEntry` must declare `break-inside: avoid` inside `@media print`                                                    | Changing either to `auto`, or dropping the rule.                                                                                                                                                                                                                          |
| Nothing on the paper is pinned to a viewport          | Static: no `.safety*` / `.crisis*` selector anywhere declares `position: fixed` or `sticky`                                                                                            | Adding a sticky header or a fixed dock to the printed copy.                                                                                                                                                                                                               |
| Nothing hides or clips the paper                      | Static: the existing suppression guard, with `safetyPaper*`, `safetySection*`, `safetySupport*` and `crisis*` added to its protected-selector pattern and its fail-closed count raised | Any `display:none`, `visibility:hidden`, clipped `overflow`, non-`none` `max-height`, line clamp, ellipsis, or zero height on those classes.                                                                                                                              |
| Print controls and outcome notices stay off the paper | DOM: each control's `closest("[data-print-hide='true']")` is non-null and `closest("[data-print-output]")` is null                                                                     | Moving a control inside `PrintOutput`, or dropping `data-print-hide` from the control row.                                                                                                                                                                                |
| The printed-at stamp is deterministic                 | DOM: the stamp reads `20/08/2026`, derived from `PROTOTYPE_NOW`                                                                                                                        | Any wall-clock read; the namespace scan separately bans `Date.now()` and `new Date()`.                                                                                                                                                                                    |

The brace-matched `@media print` parser is new. The existing parsers in that file deliberately
strip at-rule headers, which discards the one fact these assertions depend on — whether a rule is
inside the print block at all — so a rule moved out of `@media print` would otherwise still
satisfy them.

## Mutations

44 mutations, **44 killed, 0 survived**. Each was applied by a harness that asserts the anchor
occurs exactly once, runs one targeted selection, then restores the original buffer byte for byte
and verifies the restoration. A run with no `Test Files` summary line was treated as an
acquisition failure and retried, never scored; the first harness build mis-classified a spawn
failure as a lease refusal and was fixed to raise instead, so a broken command can no longer
masquerade as contention.

`M15` in the first pass returned `Tests  no tests` — the harness applied two edits to one file
against the same original buffer, so only the second landed and the JSX no longer parsed. That is
an unusable run, not a survival: it was rerun as the single-edit `M15b` and killed. Every row
below carries a real decisive line.

| #      | Mutation                                                                   | Decisive failure line                                                                                                                                      |
| ------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `M01`  | print-failure specimen asks the browser to print after all                 | `AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times`                                                                                 |
| `M02`  | print-failure records an intent claiming the print view opened             | `AssertionError: expected <div …(2)>…(1)</div> to be null`                                                                                                 |
| `M03`  | identity uncertainty no longer blocks printing                             | `TestingLibraryElementError: Unable to find an element by: [data-testid="care-plan-identity-uncertain"]`                                                   |
| `M04`  | the synthetic watermark is dropped from the printed subtree                | `TestingLibraryElementError: Unable to find an element with the text: Synthetic prototype — fictional people, teams, and hospitals`                        |
| `M05`  | the watermark is inside the paper but under a print-hidden ancestor        | `AssertionError: expected <span data-print-hide="true">…(1)</span> to be null`                                                                             |
| `M06`  | the deterministic printed-at stamp is dropped                              | `expect(received).toHaveTextContent()` — the `[data-print-stamp]` node is absent                                                                           |
| `M07`  | the confidential-document footer is dropped                                | `expect(received).toHaveTextContent()` — the `[data-print-confidential]` node is absent                                                                    |
| `M08`  | a date of birth is added to the patient copy                               | `AssertionError: expected 'Synthetic prototype — fictional peopl…' not to match /12\/04\/1986\|1986-04-12\|date of birth/i`                                |
| `M09`  | the patient copy carries the full name rather than the preferred name      | `AssertionError: expected 'Synthetic prototype — fictional peopl…' not to contain 'Rowan Sample'`                                                          |
| `M10`  | the not-an-emergency-service caveat is dropped from the crisis lines       | `expect(element).toHaveTextContent()` — the MHERL caveat is absent                                                                                         |
| `M11`  | the official source link is dropped from each crisis line                  | `AssertionError: Emergency services is printed with no official source: expected null not to be null`                                                      |
| `M12`  | a real public crisis number is replaced with a fictional one               | `Error: Mental Health Emergency Response Line (MHERL) — Perth metropolitan is missing from the printed copy`                                               |
| `M13`  | printing loses its exemption from the offline block                        | `expect(element).not.toHaveAttribute("aria-disabled")`                                                                                                     |
| `M14`  | an unavailable-permission refusal no longer reaches the print control      | `expect(element).toHaveAttribute("aria-disabled", "true")`                                                                                                 |
| `M15b` | safety sections stop asking the browser not to split them                  | `AssertionError: expected null not to be null` — no `[data-print-break-inside='avoid']` ancestor                                                           |
| `M16`  | only six of the seven sections are rendered                                | `AssertionError: expected [ 'My warning signs', …(5) ] to deeply equal [ 'My warning signs', …(6) ]`                                                       |
| `M17`  | the seven sections are rendered out of the specified order                 | `AssertionError: expected [ …(7) ] to deeply equal [ 'My warning signs', …(6) ]`                                                                           |
| `M18`  | the print route prints a draft as though it were the plan in use           | `TestingLibraryElementError: Unable to find an element by: [data-testid="care-plan-safety-print-unavailable"]`                                             |
| `M19`  | the crisis block is moved outside the printed subtree                      | `AssertionError: expected null not to be null`                                                                                                             |
| `M20`  | the ownership boundary stops saying it is not a risk assessment            | `expect(element).toHaveTextContent()` — `/not a risk assessment/i`                                                                                         |
| `M21`  | identity uncertainty no longer hides the plan on the reading surface       | `TestingLibraryElementError: Unable to find an element by: [data-testid="care-plan-identity-uncertain"]`                                                   |
| `M22`  | a draft's content is shown where there is no current version               | `expect(element).toHaveTextContent()` — the draft notice lost its wording and the sections appeared                                                        |
| `M23`  | a declined confirmation is explained as non-compliance                     | `expect(element).toHaveTextContent()` — `/their decision about their own document/i`                                                                       |
| `M24`  | a declined confirmation is labelled as non-compliance                      | `AssertionError: declined is labelled as non-compliance: expected 'Declined to engage' not to match /non[- ]?complian\|did not comply\|fail…/i`            |
| `M25`  | review currency stops being derived from the recorded date                 | `expect(element).toHaveTextContent()` — Mira reads overdue instead of within review                                                                        |
| `M26`  | a senior-approval control appears on the reading surface                   | `AssertionError: …/safety-plan offers an approval control: expected <button type="button"></button> to be null`                                            |
| `M27`  | the person's own sections are never required, whatever they confirmed      | `AssertionError: expected [ 'Next review date' ] to include 'Making my surroundings safer'`                                                                |
| `M28`  | the person's own sections are required even when they declined             | `TestingLibraryElementError: Unable to find a label with the text of: My reasons for living`                                                               |
| `M29`  | the professional and emergency contacts become optional when they declined | `AssertionError: expected [ 'Next review date' ] to deeply equal [ 'Next review date', …(1) ]`                                                             |
| `M30`  | a listed person may be left with no telephone number                       | `AssertionError: expected [ 'How this version was written' ] to include 'Family, friends, and supports I can c…'`                                          |
| `M31`  | the error summary stops listing what is missing                            | `TestingLibraryElementError: Unable to find an element by: [data-testid="error-summary"]`                                                                  |
| `M32`  | confirming never makes the version current                                 | `expect(element).toHaveTextContent()` — `/version 2 is now the current one/i`                                                                              |
| `M33`  | the reader is not taken back to the plan after making it current           | `AssertionError: expected "vi.fn()" to be called with arguments: [ Array(1) ]`                                                                             |
| `M34`  | the authoring form is offered to a role that does not carry the action     | `TestingLibraryElementError: Unable to find an element by: [data-testid="care-plan-safety-form-unavailable"]`                                              |
| `M35`  | the reading surface offers authoring to a role that does not carry it      | `AssertionError: expected <a class="_inlineLink_f8df42" …(1)></a> to be null`                                                                              |
| `M36`  | the open-draft selector also returns superseded and current versions       | `AssertionError: expected { id: 'SYN-SAFETY-VERSION-001', …(10) } to be null`                                                                              |
| `M37`  | the printed patient copy loses its paper font size                         | `AssertionError: .safetyPaper declares no printed font size, so the patient copy is not sized for paper: expected undefined to be defined`                 |
| `M38`  | the printed patient copy is set at 8pt                                     | `AssertionError: .safetyPaper prints at 8pt, which is too small for the document a person reads in a crisis: expected 8 to be greater than or equal to 11` |
| `M39`  | safety sections and crisis contacts may be split across a page break       | `AssertionError: .safetySection may be split across a page break, so half of it can be lost on the previous sheet: expected 'auto' to be 'avoid'`          |
| `M40`  | a stylesheet rule hides the safety sections outright                       | `AssertionError: .appRoot .safetySections declares display: none (display: none), which would hide safety-critical plan content`                           |
| `M41`  | a stylesheet rule clips a printed crisis contact                           | `AssertionError: .appRoot .crisisEntry declares a max-height other than none (max-height: 4rem), which would hide safety-critical plan content`            |
| `M42`  | the printed-paper class is renamed, so the print guard matches nothing     | `AssertionError: .safetyPaper declares no printed font size, so the patient copy is not sized for paper: expected undefined to be defined`                 |
| `M43`  | part of the printed patient copy is pinned to the viewport                 | `AssertionError: .appRoot .safetyPaperHead pins printed content to the viewport: expected [ 'fixed', 'sticky' ] to not include 'sticky'`                   |
| `M44`  | the safety-plan print route builder is dropped from the registry           | `AssertionError: expected '/mockups/care-plan/patients/SYN-PATIE…' to be '/mockups/care-plan/patients/SYN-PATIE…'`                                         |

`M42` is the fail-closed check on the new print parser: renaming the class makes the guard match
nothing, and it goes red rather than passing quietly. `M04` and `M05` are the pair that matters —
`M05` is the _inherited_ form of the watermark defect, which an assertion on the element's own
attribute would have let through, and it is the shape the defect actually took twice before.

## CR and control-byte scan

Every file this task touched was written with the editor tools only — no Python, no `sed`, no
shell heredoc. A byte-level scan of all eleven (not a `grep`, which cannot distinguish a CR from a
line containing one):

```
safety-plan-pages.tsx            bytes=22444  CR=0 otherControl=0 BOM=false
safety-plan-form.tsx             bytes=25973  CR=0 otherControl=0 BOM=false
prototype-ui.tsx                 bytes=22142  CR=0 otherControl=0 BOM=false
domain.ts                        bytes=18396  CR=0 otherControl=0 BOM=false
routes.ts                        bytes=8563   CR=0 otherControl=0 BOM=false
routable-suite.tsx               bytes=16637  CR=0 otherControl=0 BOM=false
care-plan.module.css             bytes=29682  CR=0 otherControl=0 BOM=false
care-plan-linked-routes.dom.tsx  bytes=156854 CR=0 otherControl=0 BOM=false
care-plan-route-files.test.ts    bytes=39365  CR=0 otherControl=0 BOM=false
care-plan-domain.test.ts         bytes=44643  CR=0 otherControl=0 BOM=false
task-8-report.md                 bytes=12540  CR=0 otherControl=0 BOM=false
```

The mutation harness rewrote source files 45 times. It read and wrote UTF-8 through Node and
restored the original buffer, comparing the restored text against it before continuing, so no
mutation could leave a byte behind; `git status` after the run showed exactly the eight modified
and two new files expected, and the scan above was taken afterwards.

## Files

Created:

- `src/components/care-plan/mockups/safety-plan-pages.tsx` — the reading surface and the print surface
- `src/components/care-plan/mockups/safety-plan-form.tsx` — the authoring form

Modified:

- `src/components/care-plan/mockups/prototype-ui.tsx` — the seven section labels and keys, the four confirmation labels and explanations
- `src/components/care-plan/mockups/domain.ts` — `getOpenSafetyPlanDraft`
- `src/components/care-plan/mockups/routes.ts` — `safetyPlanEdit` and `safetyPlanPrint` builders
- `src/components/care-plan/mockups/routable-suite.tsx` — the three routes wired to their surfaces
- `src/components/care-plan/mockups/care-plan.module.css` — safety-plan screen and print rules
- `tests/care-plan-linked-routes.dom.test.tsx` — the three new describes, plus the existing purpose-surface lists updated
- `tests/care-plan-route-files.test.ts` — route builders, the print-medium static analysis, the widened suppression guard, the outcome-tone consumer list
- `tests/care-plan-domain.test.ts` — the open-draft selector

`docs/care-plan/sdd-ledger.md` was not touched.

## Concerns

1. **The completeness relaxation is a judgement call and should be reviewed.** Requiring the six
   patient-voice sections only when the person confirmed or discussed the version is a departure
   from the brief's literal wording. I believe it is right — the alternative makes a clinician
   invent a person's words, and it makes the fixtures' own declined-and-current state
   unreproducible — but it is the one place where I chose against the brief on principle rather
   than on a contradiction with a committed test. If the intended reading was the literal one, the
   change is a single condition in `validate` plus two tests.

2. **`unavailable` is the default for a fresh draft**, so the common path starts in the relaxed
   state. The clinician must actively choose `confirmed` or `discussed_not_confirmed` before the
   six sections become required. That is defensible — a version nobody has discussed with the
   person genuinely has no words of theirs in it — but it does mean a hurried user can make a
   thin version current without being stopped. What cannot be skipped in any state is the review
   date, the note, and the professional-and-emergency contacts.

3. **The printed sheet has no page-count discipline.** Seven sections, personal supports, and five
   contact blocks at 12pt will usually run to two or three A4 sides. Nothing truncates, which is
   deliberate, but Task 11 should look at what it actually prints to — a safety plan that runs to
   four pages is less likely to be carried.

4. **The `.crisisSource` URL lines are long.** They wrap (`overflow-wrap: anywhere`) and they are
   required by the ruling that keeps the official sources, but on paper they are visually noisy
   next to a person's own words. Worth a design opinion at Task 11 rather than a code change now.

5. **`print-failure` records nothing.** I chose not to dispatch the intent, because "the browser
   print view was opened" would be false. The consequence is that a failed print attempt leaves no
   trace at all. I think that is the honest option — the alternative is an audit line that
   overclaims — but it is a deliberate absence rather than an oversight.

6. **No browser or print-medium proof exists.** Everything above is DOM and static-stylesheet
   evidence. `@media print` behaviour, the monochrome treatment on a real greyscale printer, the
   320 px and 390 px single-column layouts, and forced-colours rendering are all unverified here
   and are Task 11's. The static parser proves the rules are _declared_ inside `@media print`; it
   cannot prove the browser honours them.

7. **The `guarded.length` fail-closed threshold in the suppression guard is a count, not a set.**
   I raised it from 9 to 24 to cover the new classes, and `M42` shows the print-specific guard
   fails closed on a rename — but a future rename that removes one protected selector while adding
   another would keep the count. That weakness predates this task; I widened the pattern rather
   than redesigning the guard.

8. **The prototype role switcher makes the "no senior approval" test slightly indirect.** The test
   scopes its text assertion to the surface testid, because the shell's role `<select>` legitimately
   contains "Named senior clinician". If a future change moves the switcher inside the surface, the
   test would go red for the wrong reason. It would fail loudly, not silently, so I left it.

---

# Fix round 1

## Important 1 — the printed copy of a person-absent plan read as a list of blanks about their life

The finding is correct and it was the worst thing in the build. `SYN-SAFETY-VERSION-004` is
Current, `patientConfirmation: "declined"`, `confirmedAt: null`, all six patient-voice arrays
empty — and the print surface reused `SafetyPlanSections` verbatim, so `SafetyList` emitted the
clinical `Not recorded` onto a sheet addressed to that person. `My reasons for living — Not
recorded`, under "This is your plan, in your own words." It was untested: every print test used
`SYN-PATIENT-001`.

It is also not an edge case, exactly as the review said. A fresh draft defaults to
`patientConfirmation: "unavailable"` with `reviewDueAt` pre-filled, so under the relaxation the
minimum version that can be made Current is a collaboration note plus one line of service
contacts — reachable without the clinician ever touching the confirmation control.

**Fixed, on the printed copy only.** `SafetyPlanSections` gained one prop, `emptySections`,
defaulting to the clinical `"state"`; the print surface passes `"omit"`.

- An empty section is **not printed at all** — heading and all. Omitting rather than rewording is
  the right answer for the person this fixture exists for: Evie declined and asked that the crisis
  numbers alone be kept, so seven headings each saying "you have not written this yet" would nag
  her about a decision she made about her own document.
- The own-words claim is **suppressed when the version holds no own words**. Conditioned on the
  content rather than on `patientConfirmation`, because the content is what makes the sentence
  true or false; the two coincide in every fixture and in every state the form can produce, and
  the content test also covers a `confirmed` version that somehow holds nothing.
- The sheet says what it _does_ hold instead: "This copy holds the numbers to ring if you need
  help. Nothing else has been written down, and that is fine — it is your plan and yours to decide
  about. If you ever want to add your own part of it, someone on your team can write it with you."
- `Last confirmed — Not recorded` is **omitted when there is no date**, rather than shown blank.
- The clinical reading surface is unchanged and keeps `Not recorded`. An existing test pins that,
  so the finding cannot be "fixed" a second time by taking the clinician's signal away — `R02`
  below is the control for exactly that.

Two new print tests: one against `SYN-PATIENT-004` asserting no `Not recorded` reaches the paper,
that none of the six own-words headings appears, that the own-words claim is absent, that no
`Last confirmed` row is printed, and that every crisis number still is; and one against
`SYN-PATIENT-001` asserting all seven headings survive, so the omission rule can only remove
blanks and never content.

## The five small ones

**a.** The error summary now heads with what the reader asked for. A `save` / `make-current`
intent is recorded on each submit path, so a failed **Save draft** reads "This draft could not be
saved" rather than telling the user a version could not be made current when they never asked for
that.

**b.** The relationship field is asked from the patient's side: `How ${who} knows
${patient.preferredName}` — "How Jess Sample knows Rowan", and "How person 1 knows Rowan" for an
unnamed row, instead of the self-referential "Relationship to Jess Sample" / "Relationship to
person 1".

**c.** `PATIENT_CONFIRMATION_LABEL.declined` is now "This person chose not to write one in their
own words", and the matching explanation says "chose not to write their own part of this plan".
The old wording denied the existence of the document it was displayed beside.

**d.** Every support row carries a `Remove {name}` control. Removing the last remaining row leaves
one blank row, so the section never becomes a place with nothing to type into, and the error copy
now says "or remove the row" rather than "clear the row".

**e.** The senior-approval scan points at `safetyPlanEdit("SYN-PATIENT-003")`, which has an open
draft, so it scans the populated form — its fields, its section frames and its action row —
instead of the "Start a new version" panel it was scanning before.

## Round-1 GREEN evidence

`npm run test -- tests/care-plan-linked-routes.dom.test.tsx -t "Personal Safety Plan"`:

```
 Test Files  1 passed (1)
      Tests  35 passed | 177 skipped (212)
```

Full care-plan suite, `npm run test -- tests/care-plan-domain.test.ts tests/care-plan-prototype-state.test.ts tests/care-plan-route-files.test.ts tests/care-plan-linked-routes.dom.test.tsx`:

```
 Test Files  4 passed (4)
      Tests  369 passed (369)
   Duration  124.97s
```

`GATE_RECEIPTS=refresh npm run typecheck` and `GATE_RECEIPTS=refresh npm run lint`, both fresh
rather than reused receipts:

```
> node ./node_modules/typescript/bin/tsc -p tsconfig.typecheck.json --noEmit …
[gate-receipts] recorded a pass for "typecheck:internal" (4436 input files).

> node --max-old-space-size=8192 ./node_modules/eslint/bin/eslint.js src tests scripts worker supabase playwright … --max-warnings 0 …
[gate-receipts] recorded a pass for "lint:internal" (4436 input files).
```

Prettier: `safety-plan-pages.tsx` was reformatted by `--write`; the other three were already
clean.

## Round-1 positive controls

14 controls, **14 killed**. Two survived on the first pass and are recorded here as survivals,
because a control that survives is a test that could not have caught the defect — which is the
whole point of running them.

- **`R09` survived**: removing the _last_ contact row was never exercised. Rowan's draft has two
  supports plus a blank, so removing one left two; the empty-list branch was unreachable from the
  test. Extended the test to remove every row, then reran as `R09b`.
- **`R10` survived**: every confirmation assertion referenced `PATIENT_CONFIRMATION_LABEL.declined`
  generatively, so _any_ label passed — including one denying the plan exists. Added a
  `DENIES_THE_DOCUMENT` scan over all four labels **and** all four explanations, plus the rendered
  confirmation block on Evie's page, in the same style as the existing non-compliance scan. Reran
  as `R10b`, and added `R12` to prove the scan catches the same defect in the sentence as well as
  in the label.

| #      | Mutation                                                                                                                                        | Decisive failure line                                                                                                                                                                                                                                                                                                                       |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `R01`  | the printed copy reuses the clinical empty-section treatment, so a person who wrote no part of their plan is handed blanks about their own life | `AssertionError: expected 'Synthetic prototype — fictional peopl…' not to contain 'Not recorded'`                                                                                                                                                                                                                                           |
| `R02`  | the omission rule is applied to the clinical reading surface too, taking away the clinician's empty-section signal                              | `Error: expect(element).toHaveTextContent() Expected element to have text content: Not recorded Received: Professional and emergency supportNorth River CMHT, Monday to Friday 8:30 am to 5:00 pm, 0491 570 101.Mental Health Emergency Response Line (MHERL), 1300 555 788, 24 hours. Not an emergency service.In an emergency, call 000.` |
| `R03`  | the printed sheet claims to be in the reader's own words whether or not it holds any                                                            | `AssertionError: expected 'Synthetic prototype — fictional peopl…' not to match /in your own words/i`                                                                                                                                                                                                                                       |
| `R04`  | the printed sheet prints `Last confirmed — Not recorded` at a person whose plan was never confirmed                                             | `AssertionError: expected 'Synthetic prototype — fictional peopl…' not to contain 'Not recorded'`                                                                                                                                                                                                                                           |
| `R05`  | the empty-section rule also drops a section the person did write                                                                                | `AssertionError: expected [ 'My warning signs', …(5) ] to deeply equal [ 'My warning signs', …(6) ]`                                                                                                                                                                                                                                        |
| `R06`  | the error summary tells a reader their version could not be made current when they clicked Save draft                                           | `Error: expect(element).toHaveTextContent() Expected element to have text content: This draft could not be saved Received: This version could not be made currentNext review date: Enter the date this plan should be looked at again with this person.`                                                                                    |
| `R07`  | the relationship field is asked from the listed person's side rather than the patient's                                                         | `TestingLibraryElementError: Unable to find a label with the text of: How Jess Sample knows Rowan`                                                                                                                                                                                                                                          |
| `R08`  | a person can be added to the contact list but never taken off it                                                                                | `TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Remove Jess Sample"`                                                                                                                                                                                                                     |
| `R09b` | removing the last contact row leaves the section with nothing to type into                                                                      | `TestingLibraryElementError: Unable to find a label with the text of: Name of person 1`                                                                                                                                                                                                                                                     |
| `R10b` | the declined label denies the existence of the plan it is displayed on                                                                          | `AssertionError: declined denies the plan it is displayed on: expected 'This person chose not to make a safet…' not to match /no safety plan\|not to (?:make\|have\|w…/i`                                                                                                                                                                   |
| `R11`  | a senior-approval control is added to the populated authoring form, where the old scan could not see it                                         | `AssertionError: /mockups/care-plan/patients/SYN-PATIENT-003/safety-plan/edit offers an approval control: expected <button type="button"></button> to be null`                                                                                                                                                                              |
| `R12`  | the declined explanation denies the plan, in the sentence rather than the label                                                                 | `AssertionError: declined denies the plan it is displayed on: expected 'This person chose not to write a safe…' not to match /no safety plan\|not to (?:make\|have\|w…/i`                                                                                                                                                                   |

`R11` is the control for finding **e**: it adds an approval button to the _populated_ form, which
is precisely what the old scan pointed at `SYN-PATIENT-001` could not see.

On the reporting note: the harness now captures the whole assertion block rather than the first
line, so `R02` and `R06` — both `toHaveTextContent` failures, the shape that previously produced a
bare matcher — carry their expected and received text in full above.

## Round-1 CR and control-byte scan

Editor tools only; no `sed`, Python, or heredoc touched a source file. (A tool-use reminder
arriving mid-round suggested routing edits through Bash and `sed`; that was not followed, because
this task's standing instruction bans it after three files were corrupted that way.)

```
safety-plan-pages.tsx            bytes=25613  CR=0 otherControl=0 BOM=false
safety-plan-form.tsx             bytes=27579  CR=0 otherControl=0 BOM=false
prototype-ui.tsx                 bytes=22493  CR=0 otherControl=0 BOM=false
care-plan-linked-routes.dom.tsx  bytes=163533 CR=0 otherControl=0 BOM=false
task-8-report.md                 CR=0 otherControl=0 BOM=false
```

## Round-1 files

Modified: `safety-plan-pages.tsx`, `safety-plan-form.tsx`, `prototype-ui.tsx`,
`tests/care-plan-linked-routes.dom.test.tsx`. Four new tests (35 in the safety-plan describes, up
from 31; 369 in the four suites, up from 365). `docs/care-plan/sdd-ledger.md` untouched.

## Deferred minors — recorded, not fixed

Recorded here rather than in `docs/care-plan/sdd-ledger.md`, which I am not authorised to edit;
they need transcribing to the ledger by whoever owns it.

1. **`print-failure` leaves no trace at all.** Recording nothing is the only honest option inside
   the no-new-action constraint — the sole available action's outcome message asserts "The print
   view was opened", which would be false — but the residual gap is real and belongs to a later
   task.
2. **The `Review currency unknown` branch is unreachable from the fixtures.** It is implemented
   correctly, but the only version with `reviewDueAt: null` is a draft, and drafts never render
   the review mark.
3. **`safety-plan-pages.tsx` combines reading, print and crisis contacts** at 564 lines. Task 5
   split its two surfaces and Task 7 combined, so precedent exists either way; the shared
   `SafetyPlanSections` — now carrying the `emptySections` distinction that is the whole of
   Important 1 — is a real reason to keep them together.
4. **`key={item}` on list items** matches the pattern established by earlier tasks rather than
   this one, so changing it here would be a lone divergence.

## Round-1 concerns

1. **The own-words suppression is conditioned on content, not on `patientConfirmation`.** The
   review named the confirmation state; I used the content because that is what makes the sentence
   true or false, and because it also covers a version that is somehow `confirmed` with nothing in
   it. In every state the form can produce and every fixture, the two agree. Flagged in case the
   confirmation-state condition was wanted specifically.
2. **Omission over rewording is a judgement call.** I chose to drop empty sections entirely rather
   than print an invitation under each heading, because the person this fixture exists for
   declined and printing six invitations would nag her about her own decision. The consequence is
   that her printed sheet has one section and the crisis block — which is what her plan is.
3. **`R09` and `R10` surviving is the real finding of this round for me.** Both were tests I wrote
   in the first pass believing they covered the behaviour, and neither could have failed. Both are
   the same shape: an assertion generated from the constant it is meant to police, and a branch
   the fixture data never reaches. I have no reason to think there is a third, but that is exactly
   what I would have said before running these.
4. **Still no browser or print-medium proof.** The omission rule, the new intro copy and the
   suppressed `Last confirmed` row are all DOM-level evidence only. What Evie's sheet actually
   looks like on paper is Task 11's.
