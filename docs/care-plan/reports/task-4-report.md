# Task 4 report — Clinical Snapshot, patient search, Current Plan hierarchy, CMHT actions

Branch `claude/ed-care-plans-impl-7f44cd`, worktree `D:\Worktrees\Database\care-plan-impl`.
Commit `0c9b32c6495e348472722e624a1894bff7e860f0`
(`feat(care-plan): deliver searchable clinical snapshot`), 10 files changed,
1,915 insertions, 21 deletions. Re-run against the committed tree:

```
 Test Files  4 passed (4)
      Tests  219 passed (219)
[gate-receipts] recorded a pass for "vitest run --reporter=dot …" (4425 input files)
```

No worktree was created or removed. Nothing was pushed, fetched, merged or rebased.
`docs/care-plan/sdd-ledger.md` was not touched and is unmodified in the working tree
(last commit `a219158d6`).

## What was built, and why it is shaped this way

Three of the twenty-one routes — Home, Patients, and a patient's Overview — lost their
Task 3 purpose surface and gained the real Clinical Snapshot. Everything else in the family
still renders the purpose surface untouched.

### The Current Plan summary card is five sections, generated from the domain

`CurrentPlanSummary` iterates `FIRST_MINUTE_CONTENT_KEYS` rather than listing headings, so
the card cannot drift from the domain vocabulary and cannot quietly grow a sixth content
field. The five render in the specified order, numbered, with section 5 in its own
visually distinct box (`.firstMinuteSectionBoundary`). No rule anywhere in the stylesheet
collapses, truncates, clips, or hides it, and nothing puts it behind a disclosure.

The brief's own bullet asked for "preferred engagement, what helps, what may increase
distress, immediate continuity considerations, CMHT coordination". That is the superseded
nineteen-field vocabulary and was not implemented. A test asserts that none of those
removed names appears anywhere on the card.

Owner, approver, version, approval date, review date and state, CMHT contact with its
operating hours, the link to the Personal Safety Plan, and the fresh-assessment boundary
are all rendered inside a separate `care-plan-current-plan-metadata` block, above the
content and typographically distinct from it. A test asserts that block contains no `h3`,
so metadata can never be mistaken for a sixth section.

### The pinned safety boundary is a shared component, built here for Task 5

`PinnedSafetyBoundary` and `CurrentPlanSummary` are exported from `prototype-ui.tsx`
rather than written inline, because the specification requires the boundary above all
plan content _wherever plan content appears_ — which includes both this Snapshot and Task
5's Management Plan route. One shared component is the only way both stay correct.

The pinned line sits directly beneath the identity band and above every other plan
element. It links to the full section (`#care-plan-first-minute-whatWouldMakeThisDifferent`)
and never replaces it. It is not inside any `data-print-hide` subtree, and the print block
explicitly keeps `max-height: none; overflow: visible` on it. Position is asserted by
document order (`compareDocumentPosition`), not merely by presence, so the boundary cannot
drift below the card without a test going red.

### Review state is derived at render, never stored

The workspace calls nothing that reads a stored indicator: `buildPatientSnapshot` calls
`deriveReviewState(reviewDueAt, now)` with `PROTOTYPE_NOW`, and `ReviewWarning` renders
from that. An overdue plan keeps every word of its content readable below the warning —
the test opens Mira's overdue plan and asserts a line of her `howToApproach` content is
still on screen.

### A withdrawn plan never looks like a patient who never had one

Evelyn (`SYN-PATIENT-004`) renders `Plan withdrawn on 04/07/2026 by Dr Taylor Fiction — <reason>`
with the withdrawing clinician named, and the string `No Current Plan` appears nowhere on
her record. Jordan and Alex, who have no Current version and no withdrawal, get
`No Current Plan`. The identity band distinguishes the two states too (`Withdrawn on …`
against `None in use`).

### Participation is never invisible

`ParticipationMarker` renders `Written without this person's involvement` for any version
whose participation is `declined` or `patient_unavailable`, wherever that version is
displayed — the Current Plan card and the in-progress version region both call it. In the
fixtures no patient's _Current_ version is in that state, so on this surface the marker
appears on Mira's Awaiting Approval version 2 (`patient_unavailable`) and Alex's Draft
version 1 (`declined`).

### A draft never displaces the Current Plan

The in-progress version is a separate region headed `Version in progress`, always below
the Current Plan card, and it states its own exact state (`Awaiting Approval version 2`,
`Draft version 1`) plus either "Current version 1 remains in use until this version is
approved" or, when there is no Current version, "There is no Current Plan for … and a
version being written is not one."

### Counts are observations, and there is no ranking control

The directory shows each patient's count over the named window and states, on the same
screen, that "Counts describe what happened. They do not determine eligibility for a
Management Plan." There is no sort control, no combobox, and no table header anywhere in
the directory; a test asserts all three, and the mutation that adds a
"Sort by most presentations" button turns it red. The resting order is most-recently-seen
first, which is a recency ordering, not a ranking by how often someone attends.

### Contact actions record a request, never a result

`buildCmhtMailto` / `buildCmhtTel` from `domain.ts` build both URIs; nothing is assembled
by hand. The mailto carries a generic subject and no name, MRN, date of birth,
presentation content or plan content, and a test asserts the absence of each of those plus
any `body=` parameter. Activation dispatches `record-contact-intent`, whose reducer
outcome says only that an application was asked to open — the test additionally asserts
the rendered notice contains none of _sent, delivered, received, replied, notified_.

`unverified-contact`: details stay fully visible and both launch anchors keep working; the
warning names the last-verified date and links to Reviews, and a test asserts the warning
text never implies availability.

`launch-failure`: the anchor's navigation is intercepted, the details stay exactly where
they were, and the notice states what happened ("could not be opened"), what it means
("Nothing was sent, and no message exists"), and what is available (the mailbox and the
duty number, repeated in the message).

## Decisions I had to make, and what they cost

### 1. The brief's worked example contradicts the fixtures (resolved: fixtures win)

The brief's first example test expects `Awaiting Approval version 3` and
`Current version 2 remains in use` after opening `SYN-MRN-0002`. In the fixtures,
`SYN-MRN-0002` is Mira Example, whose plan `SYN-MGMT-PLAN-002` carries version 1 as
Current and version 2 as Awaiting Approval. The example's version numbers describe a plan
that does not exist. I kept every other element of the example verbatim — the route, the
query, the button name, the region name, the heading assertion — and corrected the two
numbers to 2 and 1. The test comment records why.

### 2. Home and Patients own their search; the shell composer stands down there

The brief's example searchbox is named `Search synthetic patients`, while the Task 3 shell
composer is named `Search patients`. Rendering both on Home would put two search fields on
one page, which the repository's search-chrome ownership rule forbids and which would have
broken the Task 3 assertion that Home has exactly one searchbox.

I added one optional prop, `routeOwnsSearch`, to `CarePlanShellFrame`. Home and Patients
own an in-flow directory search where the results actually appear; every other route,
including a patient's Overview, still uses the shell composer unchanged. Three Task 3
tests that happened to exercise the shell composer _on Home_ were re-pointed at
shell-owned routes (`reviews`, `team`); they assert exactly what they asserted before.

### 3. Selecting a patient on Home does not navigate

The brief says the phone should "use route navigation to the full-width patient workspace
rather than retaining a compressed second column". Navigating on every selection would
make the desktop split pointless, and the brief's own example test requires the workspace
to render on Home immediately after the click with `navigate` mocked.

What I built satisfies the constraint the sentence exists for: the split is a single
column below `64rem`, directory first and the workspace full width beneath it, so a
compressed second column never exists at 320 px or 390 px. Route navigation to the
full-width workspace is offered explicitly — the workspace carries an
`Open the full record for <name>` link to the patient route, and the patient navigation's
`Overview` entry goes to the same place. Flagging this as a deliberate departure from the
literal wording.

### 4. A patient route reads its patient from the address, not from the selection

`/patients/<id>` resolves its patient by parsing the address through
`carePlanPatientIdFromPathname`, which re-checks the identifier against
`isSyntheticPatientId`. Home and Patients read `state.selectedPatientId` from the provider.
A deep link therefore always opens the record it names, and a mutation that makes the
patient route read the selection instead turns five tests red.

### 5. Identity uncertainty refuses to render plan content

Not in the brief's checklist, but it is a specification acceptance criterion for a state
this task's surfaces can reach. `scenario=identity-uncertain` renders a refusal that tells
the reader to return to search, and no plan content at all. Fifteen lines; I judged it
cheaper to build than to leave a surface that would show a nearby person's plan.

### 6. A failed launch still records the intent

The audit evidence says an external application "was asked to open" — which is true even
when it does not open. The failure notice is shown _in addition to_ the recorded intent,
so the chronology stays honest rather than silently dropping the attempt. Flagging this in
case the reviewer prefers the opposite.

### 7. Scenario is read from the URL but not dispatched into state

`CarePlanRouteSurface` passes the named scenario down as a prop; it does not dispatch
`apply-scenario`. Switching the state's scenario belongs to the System states route
(Task 8), and dispatching it from every route would reset in-memory state on navigation.
The consequence is that `?scenario=withdrawn-plan` on Home does not change which patient is
selected; the withdrawn, no-plan and unverified specimens are reached by their patient
addresses instead, which is how the tests exercise them.

## RED evidence

Tests written first, run before any Task 4 component existed:

```
 Test Files  1 failed (1)
      Tests  34 failed | 46 passed (80)
```

All 34 failures were the new assertions, each failing because the surface did not exist —
for example:

```
 FAIL  tests/care-plan-linked-routes.dom.test.tsx > Care Plan CMHT contact actions > exposes only intent-safe CMHT launch links
 FAIL  tests/care-plan-linked-routes.dom.test.tsx > Care Plan clinical snapshot > renders exactly the five first-minute sections, in order
 FAIL  tests/care-plan-linked-routes.dom.test.tsx > Care Plan patient directory > offers no way to sort or rank the directory by presentation count
```

The 46 that passed are the Task 3 shell and error-boundary tests, including the three
re-pointed ones, which proves the re-pointing did not weaken them.

## GREEN evidence

```
 Test Files  4 passed (4)
      Tests  219 passed (219)
```

That is `tests/care-plan-domain.test.ts`, `tests/care-plan-prototype-state.test.ts`,
`tests/care-plan-linked-routes.dom.test.tsx` and `tests/care-plan-route-files.test.ts`
together. The DOM file alone is 81 of those 219 (46 Task 3 + 35 Task 4). Counted from the
run output, not from memory.

`npm run typecheck` and `npm run lint` both passed:

```
[gate-receipts] recorded a pass for "typecheck:internal" (4425 input files).
[gate-receipts] recorded a pass for "lint:internal" (4425 input files).
```

`npm run format` was run and its changes are in the commit.

**A note on gate receipts.** This repository memoises `lint`, `typecheck` and Vitest against
a content hash, so a re-run on unchanged content returns a stored pass rather than running.
Every result above is a line reading `recorded a pass`, which is a fresh run; a reused
receipt prints `REUSED` instead. The whole mutation battery ran with `GATE_RECEIPTS=off` so
no mutated tree could ever be answered by a stored result.

### Mutation battery — 41 mutations, 41 killed against the final suite

Every mutation applied one exact string swap to a Care Plan source file, ran the DOM suite,
and required a non-zero exit. Each run was checked for a real `Tests` summary line before
its verdict was recorded: on this machine another worktree frequently holds the focused-test
lease, and a refused run exits non-zero with no summary. Treating that as RED would have
been a fabricated result, so a run with no summary was retried, not counted. The first
battery cost roughly forty such retries.

First pass — 38 mutations, 37 killed:

```
RED   M01 drop the fifth first-minute section — 2 failed | 78 passed (80)
RED   M02 reverse the first-minute order — 2 failed | 78 passed (80)
RED   M03 rename section 4 to removed vocabulary — 2 failed | 78 passed (80)
RED   M04 reintroduce a removed field name in the boundary — 2 failed | 78 passed (80)
RED   M05 drop the continuity boundary statement — 1 failed | 79 passed (80)
RED   M06 hide the overdue review warning — 1 failed | 79 passed (80)
RED   M07 stop marking non-participation — 1 failed | 79 passed (80)
RED   M08 swap day and month in every date — 7 failed | 73 passed (80)
RED   M09 point the pinned line at the wrong section — 1 failed | 79 passed (80)
RED   M10 let colour carry status without words — 4 failed | 76 passed (80)
GREEN M11 collapse section 5 behind a truncation — 80 passed (80)
RED   M12 push the pinned boundary below the plan — 1 failed | 79 passed (80)
RED   M13 render a withdrawn plan as though it never existed — 1 failed | 79 passed (80)
RED   M14 let the draft occupy the Current Plan heading — 4 failed | 76 passed (80)
RED   M15 stop saying the Current version remains in use — 1 failed | 79 passed (80)
RED   M16 show plan content when identity is uncertain — 1 failed | 79 passed (80)
RED   M17 drop the MRN from the identity band — 1 failed | 79 passed (80)
RED   M18 drop the named lookback window from the band — 1 failed | 79 passed (80)
RED   M19 mark the wrong patient section as current — 1 failed | 79 passed (80)
RED   M20 overclaim what a contact intent achieved — 1 failed | 79 passed (80)
RED   M21 put patient information in the mailto — 2 failed | 78 passed (80)
RED   M22 dial the after-hours line from the duty control — 2 failed | 78 passed (80)
RED   M23 hide the unverified-contact warning — 1 failed | 79 passed (80)
RED   M24 imply the unverified team is available — 1 failed | 79 passed (80)
RED   M25 drop the verification Reviews link — 1 failed | 79 passed (80)
RED   M26 swallow the launch failure silently — 1 failed | 79 passed (80)
RED   M27 drop the contact details from the failure message — 1 failed | 79 passed (80)
RED   M28 offer a sort-by-presentation-count control — 1 failed | 79 passed (80)
RED   M29 widen search beyond the identity fields — 2 failed | 78 passed (80)
RED   M30 drop the counts-decide-nothing statement — 1 failed | 79 passed (80)
RED   M31 drop the named lookback window — 1 failed | 79 passed (80)
RED   M32 drop the manual referral entry point — 1 failed | 79 passed (80)
RED   M33 drop the recent-patient resting list — 1 failed | 79 passed (80)
RED   M34 show rows instead of no-results content — 2 failed | 78 passed (80)
RED   M35 drop the row's accessible open name — 9 failed | 71 passed (80)
RED   M36 fall back to the Task 3 purpose surface on Home — 16 failed | 64 passed (80)
RED   M37 keep the shell composer beside the directory search — 2 failed | 78 passed (80)
RED   M38 read the selection instead of the address on a patient route — 6 failed | 74 passed (80)

37/38 mutations killed.
SURVIVORS:
  GREEN M11 collapse section 5 behind a truncation — 80 passed (80)
```

**The survivor was a real gap, and it mattered.** M11 replaced section 5's distinguishing
class with `sr-only` — the section is still in the DOM and still has its heading and its
content, so every assertion I had written passed while the one section the specification
insists is never collapsed had become invisible. Presence testing cannot see that.

I added `keeps the fifth section visually distinct and never collapsed, truncated or hidden`,
which compares section 5's class tokens against an ordinary section's, requires at least one
distinguishing token, rejects the suppression utilities, and rejects a `details` ancestor.
Re-run with two further suppression shapes:

```
RED   M11 collapse section 5 behind a truncation (sr-only) — 1 failed | 80 passed (81)
RED   M39 clip section 5 to a fixed height — 1 failed | 80 passed (81)
RED   M40 make section 5 identical to the other four — 1 failed | 80 passed (81)

3/3 killed.
```

### Two process failures during the battery, both mine, both repaired

1. **The first runner restored files with `git checkout --`, which cannot reach an untracked
   file.** Six of the new components were untracked, so the very first mutation crashed the
   runner and left the mutated file in the tree. The second runner restores from bytes read
   before the swap. I then staged every new file with `git add`, which gives the restore an
   independent second path, and after each run I verified the tree with an anchor sweep over
   every mutated string rather than by eye.
2. **Killing the runner mid-mutation left two files mutated and my first residue check
   missed one**, because the check's pattern list did not cover every mutation. The anchor
   sweep replaced it: it asserts every original string is present in every mutated file, so a
   residue cannot hide behind an incomplete pattern list. Both incidents were caught before
   any verification result was recorded, and the final green run above is against the
   restored tree.

### CR and control-byte scan

Every file this task touched, scanned for carriage returns, byte-order marks, and control
bytes other than newline and tab:

```
prototype-ui.tsx          CR=0 BOM=false ctrl=0
clinical-snapshot-page.tsx CR=0 BOM=false ctrl=0
patient-directory.tsx     CR=0 BOM=false ctrl=0
patient-workspace.tsx     CR=0 BOM=false ctrl=0
patient-navigation.tsx    CR=0 BOM=false ctrl=0
contact-actions.tsx       CR=0 BOM=false ctrl=0
routable-suite.tsx        CR=0 BOM=false ctrl=0
care-plan-shell-frame.tsx CR=0 BOM=false ctrl=0
care-plan.module.css      CR=0 BOM=false ctrl=0
care-plan-linked-routes.dom.test.tsx CR=0 BOM=false ctrl=0
task-4-report.md          CR=0 BOM=false ctrl=0
CLEAN: no CR, no BOM, no control bytes in any touched file
```

All source was written with the editor tools. The mutation runner wrote through Node only to
apply and revert temporary swaps, and the scan above is against the final restored files.

## Files

Created:

- `src/components/care-plan/mockups/prototype-ui.tsx`
- `src/components/care-plan/mockups/clinical-snapshot-page.tsx`
- `src/components/care-plan/mockups/patient-directory.tsx`
- `src/components/care-plan/mockups/patient-workspace.tsx`
- `src/components/care-plan/mockups/patient-navigation.tsx`
- `src/components/care-plan/mockups/contact-actions.tsx`

Modified:

- `src/components/care-plan/mockups/routable-suite.tsx` — wires the three snapshot routes,
  parses the patient identifier from the address, stands the shell composer down on the two
  directory routes.
- `src/components/care-plan/mockups/care-plan-shell-frame.tsx` — one optional
  `routeOwnsSearch` prop.
- `src/components/care-plan/mockups/care-plan.module.css` — the Clinical Snapshot layout.
  Every new selector is scoped below `.appRoot`, which `care-plan-route-files.test.ts`
  independently verifies.
- `tests/care-plan-linked-routes.dom.test.tsx` — 35 new tests (34 written test-first, plus
  the section-5 suppression guard added after the mutation battery found the gap); three Task 3 tests
  re-pointed at shell-owned routes; the route-purpose table lost its three snapshot rows
  and gained a test asserting those three routes no longer render a purpose surface.

Not modified: `types.ts`, `fixtures.ts`, `domain.ts`, `prototype-state.ts`,
`docs/care-plan/sdd-ledger.md`, `index.ts`, and every page file under
`src/app/mockups/care-plan/`. `index.ts` was deliberately left alone: the Task 3 deferred
minors record that the barrel already has zero importers, so adding six more exports to it
would grow unused surface rather than serve anything.

## Concerns

1. **The Home split departs from the brief's literal wording on phone navigation.** The
   brief says selecting a patient should navigate to the full-width workspace. It does not,
   because the brief's own example test requires the workspace to render on Home right after
   the click with `navigate` mocked, and navigating on every selection would make the desktop
   split pointless. The constraint the sentence protects is met — one column below `64rem`,
   directory first, workspace full width, no compressed second column at 320 px — and route
   navigation to the full-width workspace is offered by an explicit link. If the reviewer
   wants the literal behaviour, the change is one line in `PatientDirectory`'s click handler
   and one test rewrite. See decision 2 above.

2. **Phone width, dark mode, forced colours and print are asserted structurally, not
   visually.** The tests prove document order, print-hide containment, class-token
   distinctness, and that no suppression utility is applied. They cannot prove that the
   single-column layout actually holds at 320 px, or that the pinned boundary and section 5
   actually render on paper. That needs Playwright (Task 11's job) or a browser pass. I did
   not run `npm run ensure` or open the app: the route sits behind the developer-area gate,
   the machine's focused-test capacity was contended throughout by two other worktrees, and
   the brief's own gate list is Vitest, typecheck and lint. **This is the largest unverified
   claim in the task and I want it stated plainly rather than implied away.**

3. **Nothing prevents a future stylesheet change from clipping section 5.** The new guard
   watches class tokens on the element, so it catches a component-level suppression. It
   cannot see a rule added to `.firstMinuteSection` in `care-plan.module.css` that sets
   `max-height` or `overflow: hidden`. A static scan of that stylesheet would close it, and
   `tests/care-plan-route-files.test.ts` is the natural home, but that file was outside this
   brief's scope so I left it. Worth a line in the whole-branch review.

4. **The `PLAN_CONTINUITY_BOUNDARY` wording uses `clinical judgement`, Australian spelling.**
   The specification's sentence says `clinical judgment`. Every fixture in `fixtures.ts` uses
   the Australian spelling, and the plan's global constraints require Australian English, so
   I matched the fixtures. If the spec's spelling is meant literally, this is a one-word
   change in one constant and one test.

5. **A failed launch still records the contact intent.** Decision 6 above. I judged that the
   audit line ("an external application was asked to open") stays true when the application
   fails to open, and that dropping the record would hide an attempt that happened. The
   opposite choice is defensible; it is one `if` in `ContactActions`.

6. **`?scenario=` on Home does not change the selected patient.** The route surface reads the
   scenario for behaviour (`launch-failure`, `identity-uncertain`) but never dispatches
   `apply-scenario`, so the state's `selectedPatientId` stays at the default. Deliberate —
   Task 8 owns scenario switching, and dispatching on every route would reset in-memory work
   on navigation — but it means the withdrawn, no-plan and unverified specimens are only
   reachable by their patient addresses, not by their scenario names, until Task 8 lands.

7. **The three re-pointed Task 3 tests now cover `reviews` and `team` rather than `home` and
   `patients`.** They assert exactly what they asserted before and the shell code they cover
   is unchanged, but a reviewer should confirm they are happy that the shell composer's
   behaviour is no longer exercised on the two busiest routes — it is not rendered there at
   all now, which is the point, and `M37` proves a test goes red if it comes back.

8. **The machine's focused-test lease was contended throughout.** Two other worktrees
   (`cc-2a-live`, `dev-hub-phase-1`) held it repeatedly, and roughly forty runs were refused
   with `Database focused-test capacity is full` before succeeding on retry. No refused run
   was recorded as a result. If a reviewer re-runs the battery they should expect the same
   and should not read a refusal as a failure.

---

# Fix round 1

Three Important findings, three Minors, and two judgement calls. All six defects fixed;
both judgement calls answered below. Commit `773da7bf3d576926c7c52fbb8fb4d02dd11e720f`.

## Important #1 — the section-5 suppression guard could not see the regression it existed for

**The finding is correct, and my report's "out of scope" deferral was wrong.** The guard I
added at the end of the first round compares class _tokens_, and `vitest.config.mts` sets no
`css` option, so Vitest's default `css: false` applies: a CSS Module import resolves to a
proxy that echoes the accessed key and no stylesheet is ever applied. Two consequences, both
as the reviewer described them. A token exists whether or not a rule defines it — proved by
`styles.currentPlanCard`, which had no rule at all and still satisfied the
"carries a distinguishing treatment" assertion. And my suppression list was Tailwind utility
names on a component that applies no Tailwind utilities, so it matched the exact shape of
mutation M11 and nothing else.

Fixed with a **static assertion over the stylesheet**, in
`tests/care-plan-route-files.test.ts` beside the `.appRoot` scoping check that already reads
that file: `never lets a stylesheet rule collapse, clip or hide the pinned boundary or a
first-minute section`. It parses every rule whose selector mentions `firstMinuteSection*` or
`pinnedBoundary*`, including inside `@media` blocks, and rejects `max-height` other than
`none`, clipped `overflow`, `display: none`, `visibility: hidden`/`collapse`, any
`line-clamp`, `text-overflow: ellipsis`, and a zero height. It fails closed if fewer than
four protected selectors match, so a rename cannot make it silently match nothing.

**The print reset is allowed by value, not by location.** `@media print` legitimately sets
`max-height: none; overflow: visible` on exactly these selectors, and checking the declared
value is stronger than exempting a block — a suppression added inside the print block is
still caught.

**One thing worth recording, because it is the same failure mode as the finding itself.** My
first version of this guard used a value-aware regex with a negative lookahead to allow
`max-height: none`. It reported the print reset as a suppression on its first run. The cause:
`\s*` before the lookahead is greedy but backtracks, so the engine retried with the lookahead
sitting on the space rather than on `none`, the lookahead passed, and the rule "matched". A
guard that fails on correct input is the mirror image of one that passes on incorrect input,
and I would have had to weaken it to make it pass. It now parses each declaration into a
property and a value and tests those, which is not cleverer, only correct.

## Important #2 — the mailto rejection test omitted two of the five forbidden classes

Correct. The denylist covered name, MRN, date of birth and `body=`; presentation content and
plan content were not covered, and neither was a differently formatted date. Replaced with an
**allowlist** in `puts nothing but the generic subject in the mailto`: the address must equal
`mailto:north-river.cmht@example.org`, the query string must equal
`subject=Care+Plan+%E2%80%94+team+contact+request` exactly, `subject` must be the only
parameter key, and the href must carry no fragment. Any added parameter fails regardless of
what it carries, which is immune to the class rather than to the six strings I happened to
think of.

## Important #3 — selecting a patient moved no focus and announced nothing

Correct, and the reviewer is right that route navigation was what bought the focus move in
the original design and nothing replaced it when I dropped it.

`PatientWorkspace`'s region now takes a `ref` and `tabIndex={-1}`, and
`ClinicalSnapshotSurface` moves focus to it when `resolvedPatientId` changes on a directory
surface. Focusing a named region announces its accessible name
(`Mira Example clinical snapshot`), which is the same mechanism the shell uses for the route
heading — deliberately not a second live region, which Task 3's ruling 28 removed for
double-announcing.

The effect deliberately does nothing on its first pass and nothing on a patient address: the
shell owns route-level focus, and two owners would fight.

## Minor #4 — `styles.currentPlanCard` referenced a class that did not exist

Fixed by **adding the rule**, not by dropping the prop: the Current Plan card is the one
thing on the screen a clinician is meant to act on, and it should be distinguishable from the
inset frame a version-in-progress gets. It now carries the clinical-accent border and the
`--e1` elevation, and it joins the print block's `border-color: CanvasText` list.

I also added a **second static guard for the whole class of defect**, since this was its
second appearance: `defines every CSS Module class the Care Plan components reference` walks
every `styles.<name>` in the namespace and requires a matching rule in the stylesheet. It
fails closed if fewer than ten references are found.

## Minor #5 — `aria-current="page"` on Overview was wrong on Home and Patients

Fixed. `PatientNavigation`'s `activeSection` is now `PatientSectionKey | null`, and
`ClinicalSnapshotSurface` passes `variant === "patient" ? "overview" : null`. On Home and
Patients no patient link claims to be the current page.

## Minor #6 — a Current version with no review date showed no currency signal

Fixed, and the reviewer's framing of it as the inverse of ruling 16 is exactly right.
`ReviewWarning` now accepts `ReviewState | null` and renders a warning-toned
`Review currency unknown` branch; the summary card's status mark shows the same rather than a
green `Within review`; and `patient-workspace.tsx` no longer gates the warning on
`reviewState !== null`. `domain.ts` is untouched — the null is legitimate, the rendering was
what degraded permissively.

No fixture patient reaches this state, so the three tests construct a snapshot from
`createInitialPrototypeState()` and `buildPatientSnapshot`, override `reviewDueAt` to null,
and render `PatientWorkspace` directly.

## The two judgement calls

**Pinned boundary copy — changed, and I agree with the reviewer.** "This plan does not apply
if today is different" claims more than section 5 does: the plan still supports continuity in
that situation, what it stops being is a basis for a decision. An overstated line is also an
easier line to dismiss, and this one prints. Now:

> **Do not rely on this plan if today is different — assess afresh.** Then read the full
> section.

**`judgement` versus `judgment` — kept `judgement`, as instructed, and here is the note for
the ruling.** The binding specification writes `clinical judgment`. Every fixture in
`fixtures.ts` writes `judgement`, the plan's global constraints require Australian English,
and this constant renders beside that fixture prose on the same card. The spelling in the
spec is the defect.

## Verification

Fresh runs, counted from the output.

```
 Test Files  4 passed (4)
      Tests  230 passed (230)
```

That is `tests/care-plan-domain.test.ts`, `tests/care-plan-prototype-state.test.ts`,
`tests/care-plan-linked-routes.dom.test.tsx` and `tests/care-plan-route-files.test.ts`. The
DOM file is 90 of those (was 81); `care-plan-route-files.test.ts` is 21 (was 19). Nine new
tests: the mailto allowlist replacing the denylist, two `aria-current` cases, four focus
cases, and three review-currency-unknown cases — plus the two new static guards.

```
[gate-receipts] recorded a pass for "typecheck:internal" (4425 input files).
[gate-receipts] recorded a pass for "lint:internal" (4425 input files).
```

Both are `recorded a pass`, meaning a fresh run; a memoised answer prints `REUSED`. Every
mutation run below used `GATE_RECEIPTS=off`. `npm run format` was run and its output is in
the commit.

### Positive controls — 20 run, 20 killed

Each makes the code wrongly permit the thing a guard rejects and requires its suite to go
red. Runs with no `Tests` summary line were retried, never recorded: a refused heavy-run
lease is an acquisition failure, not a verdict.

Important #1 and Minor #4, against `tests/care-plan-route-files.test.ts` (19 tests at the
time, 21 now):

```
RED   F01 clip section 5 from the stylesheet (max-height + overflow) — 1 failed | 18 passed (19)
RED   F02 hide the pinned boundary from the stylesheet (display: none) — 1 failed | 18 passed (19)
RED   F03 line-clamp the first-minute sections container — 1 failed | 18 passed (19)
RED   F04 collapse section 5 to zero height — 1 failed | 18 passed (19)
RED   F05 rename the protected classes so the guard matches nothing — 1 failed | 18 passed (19)
RED   F06 reference a CSS Module class that does not exist — 1 failed | 18 passed (19)
```

F01 is the exact regression the reviewer named. F05 proves the guard fails closed rather than
matching nothing. F06 is the `currentPlanCard` defect reintroduced deliberately.

Important #2, #3, Minors #5 and #6, against the DOM suite:

```
RED   F07 plant plan content in the mailto — 2 failed | 87 passed (89)
RED   F08 plant a differently formatted date of birth in the mailto — 2 failed | 87 passed (89)
RED   F09 append a fragment to the mailto — 2 failed | 87 passed (89)
RED   F10 select a patient without moving focus — 1 failed | 89 passed (90)
RED   F11 steal the shell's mount-time focus — 1 failed | 89 passed (90)
RED   F12 remove the workspace focus target — 1 failed | 88 passed (89)
RED   F13 mark Overview as the current page on Home — 2 failed | 87 passed (89)
RED   F14 show nothing when a Current version has no review date — 1 failed | 88 passed (89)
RED   F15 show a reassuring mark when review currency is unknown — 1 failed | 88 passed (89)
RED   F17 move focus on a patient address too, fighting the shell heading — 1 failed | 89 passed (90)
```

F07 is the reviewer's own worked example (`&plan=check%20that%20Mira%20has%20her%20hearing%20aids%20in`).
F08 is the differently formatted date. Both would have passed the old denylist.

### Two controls survived first, and both taught something

**F11 — stealing the shell's mount-time focus — passed all 89 tests on its first run.** The
cause is effect ordering: `ClinicalSnapshotSurface` is deeper in the tree than
`CarePlanShellFrame`, so its effect runs first and the shell's heading focus lands last and
silently repairs the theft. Asserting _final_ focus can never see this, which means my first
version of that test could not fail. Replaced with
`never takes mount-time focus from the shell heading, even momentarily`, which records
`focusin` events across the render and asserts the workspace region never appears among them.
F11 then went red.

**F17 — dropping the "directory surfaces only" guard — passed too**, for the same masked
reason on a patient-to-patient address change. Added
`does not compete with the shell heading when the patient address itself changes`, using the
same event-order technique across a rerender. F17 then went red.

**One mutation was genuinely equivalent, and I changed the code rather than report it.** F16
removed the effect body's "did the id actually change" check. It changed no behaviour,
because the effect's dependency on `resolvedPatientId` is already what makes it a
selection-change effect — the inner check was unreachable belt-and-braces, and a redundant
`focusedPatientId` ref existed only to feed it. Both are gone. An unkillable mutant on dead
code is a signal to delete the code, not a coverage gap to explain away.

### CR and control-byte scan

```
prototype-ui.tsx           CR=0 BOM=false ctrl=0
clinical-snapshot-page.tsx CR=0 BOM=false ctrl=0
patient-workspace.tsx      CR=0 BOM=false ctrl=0
patient-navigation.tsx     CR=0 BOM=false ctrl=0
care-plan.module.css       CR=0 BOM=false ctrl=0
care-plan-linked-routes.dom.test.tsx CR=0 BOM=false ctrl=0
care-plan-route-files.test.ts        CR=0 BOM=false ctrl=0
task-4-report.md           CR=0 BOM=false ctrl=0
CLEAN: no CR, no BOM, no control bytes in any touched file
```

An anchor sweep over every mutated string confirmed no mutation residue survived in any
source file before the commit.

## Files in this round

Modified: `prototype-ui.tsx` (unknown-currency branch, pinned copy, `Link` for the safety-plan
href), `patient-workspace.tsx` (focus ref, `tabIndex`, nullable `activeSection`, ungated
review warning), `patient-navigation.tsx` (nullable `activeSection`),
`clinical-snapshot-page.tsx` (selection focus effect, correct `activeSection`),
`care-plan.module.css` (`.currentPlanCard` rule, print-block entry),
`tests/care-plan-linked-routes.dom.test.tsx` (mailto allowlist, nine new tests),
`tests/care-plan-route-files.test.ts` (two new static guards).

Untouched: `types.ts`, `fixtures.ts`, `domain.ts`, `prototype-state.ts`, `index.ts`,
`docs/care-plan/sdd-ledger.md`, and every page file.

## Deferred minors — for the ledger, not fixed

Recorded here because I am not to edit the ledger. All from the reviewer, none blocking.

1. No one-searchbox assertion on `/patients` — only Home is pinned.
2. The after-hours anchor is untested, and its recorded intent is indistinguishable from the
   duty line's in the audit trail.
3. The no-sort guard matches control names rather than asserting row order, so a directory
   silently pre-sorted by count would pass.
4. `carePlanPatientIdFromPathname` lives in `routable-suite.tsx` rather than beside
   `isSyntheticPatientId` in `routes.ts`, and its `?? pathname` fallback is unreachable.
5. `ContentList` uses bullet text as the React key.
6. Two differently worded synthetic markers appear on one screen (the shell's
   "fictional data only" and the workspace's "fictional people, teams, and hospitals").
7. `toHaveTextContent(/verified/i)` in the identity-band test also matches
   `Not verified since`.
8. Draft-below-Current is proven by document order only.
9. `lastOutcome` persists across a cross-patient deep link, so a contact notice recorded for
   one patient can render on another's workspace.

## Concerns after this round

1. **Phone width, dark mode, forced colours and print remain structurally asserted, not
   visually verified.** This round strengthened the static side considerably — the stylesheet
   guard now catches the realistic clipping regression that the DOM tests never could — but
   nothing here proves the single-column layout holds at 320 px or that the boundary prints.
   That still needs Playwright or a browser pass, and I still have not run one.

2. **The two new static guards are text analysis, not CSS semantics.** They parse declarations
   rather than compute styles, so a suppression expressed some other way — a `clip-path`, a
   `transform: scale(0)`, a `content-visibility: hidden`, a parent rule on `.workspace` that
   clips its children — would pass. The named list covers the shapes anyone would plausibly
   write, and F01–F04 prove it covers those, but it is a list, not a proof.

3. **The focus tests depend on React effect ordering.** They pass because the shell's effect
   is a parent's and runs last. That is stable React semantics, not an accident, but if a
   later task moves the shell or the snapshot in the tree, the mount-time test could start
   failing for a reason unrelated to the behaviour it protects. The `focusin` technique makes
   the failure legible when it happens.

4. **`ReviewWarning` now renders on every Current plan that is not `within_review`.** That is
   deliberate, but it means the warning is on screen for `due_soon`, `overdue` and undated
   plans alike, and only the wording distinguishes them. If the whole-branch review wants the
   undated case handled more quietly, the branch is one `if`.

5. **Machine contention was worse this round.** Every mutation run needed retries against
   `Database focused-test capacity is full` from `cc-2a-live` and `dev-hub-phase-1`. No
   refused run was recorded either way, but it makes the battery slow and a reviewer
   re-running it should expect the same.

---

# Fix round 2

One Important, found in the fix round 1 diff itself. Commit `d66e7a38b73848c9191dfe661fb933d2d405ade5`.

## The finding is correct — here is the trace I checked it against

I was invited to argue it down. I cannot: it fires.

`ClinicalSnapshotSurface` is rendered at one JSX position for all three variants
(`routable-suite.tsx`, the `snapshotVariant === undefined ? … : …` ternary), so React
reconciles the same element type at the same position and never remounts it. Its `useRef`
values therefore survive every Home ⇄ patient address ⇄ Patients move.

The effect's dependencies were `[directorySurface, resolvedPatientId]`, where
`directorySurface = variant !== "patient"` and `resolvedPatientId` falls back to
`state.selectedPatientId` on any non-patient variant.

| Step                      | `directorySurface` | `resolvedPatientId` | Effect                                | Correct? |
| ------------------------- | ------------------ | ------------------- | ------------------------------------- | -------- |
| Mount on Home             | `true`             | A                   | `hasSettled` false → set true, return | yes      |
| Select B on Home          | `true`             | A → **B**           | focus workspace                       | yes      |
| Navigate to `/patients/B` | true → **false**   | B                   | `!directorySurface` → return          | yes      |
| Navigate **back** to Home | false → **true**   | B (unchanged)       | **focus workspace**                   | **no**   |

The last row is a genuine route change, and the shell owns focus on those. `hasSettled` was
set once and never reset, so it could not distinguish "the surface came back" from "the
selection moved".

**Why no existing test could see it.** React commits child effects before the parent's, and
the shell's pathname-keyed heading focus is the parent's, so the shell always lands last and
the final DOM state is correct. Every final-state assertion passes. That is exactly the
"provably cannot fail" pattern round 1 was written to eliminate; it survived one layer up.
Neither `focusin`-order test reached this transition: one is a cold mount, the other is
patient-to-patient with `directorySurface` `false` throughout.

## The fix

The effect now tracks the previous **variant** rather than a collapsed boolean, and fires
only when the surface stayed put and the selection moved underneath it:

```tsx
useEffect(() => {
  const previousVariant = lastVariant.current;
  lastVariant.current = variant;

  if (previousVariant !== variant) return; // first commit, or the address changed
  if (variant === "patient") return; // a patient address has no directory
  if (resolvedPatientId === null) return;
  workspaceRef.current?.focus();
}, [variant, resolvedPatientId]);
```

**Why the variant and not the boolean.** The boolean cannot see Home → Patients at all — it
is `true` on both sides — so that transition was correct only because the dependency array
happened not to change. Tracking the variant makes it correct by intent, and both new tests
cover Home and Patients.

Transition table for the new guard, every path through it:

| From → to                     | Guard hit                     | Focus moves? |
| ----------------------------- | ----------------------------- | ------------ |
| (mount)                       | `previousVariant !== variant` | no           |
| Home, selection changes       | —                             | **yes**      |
| Patients, selection changes   | —                             | **yes**      |
| Home → `/patients/B`          | `previousVariant !== variant` | no           |
| `/patients/B` → Home          | `previousVariant !== variant` | no           |
| Home → Patients (or back)     | `previousVariant !== variant` | no           |
| `/patients/A` → `/patients/B` | `variant === "patient"`       | no           |

No branch is unreachable, and each is individually killed by a control below.

## The deliverable: the ordering test

`does not compete with the shell heading when returning from a patient address to %s`, run
for both Home and Patients. It selects a patient on Home (the correct focus move, and what
leaves the surface in the state the regression needs), navigates to that patient's address,
then records `focusin` events across the navigation back and asserts the workspace region
never appears among them while the shell's heading holds focus.

It watches events rather than final state for the reason above: the shell repairs the damage
half a tick later, so a final-state assertion here could never fail.

## One dead guard removed rather than reported

My first version of the fix kept `if (previousVariant === null) return;` as a separate
first-commit rule. A control proved it unreachable: `previousVariant` is `null` on the first
commit and `null` never equals a variant, so `previousVariant !== variant` already returns
there. Deleting a redundant line reads worse than keeping it only if the reader has to
rediscover why one comparison covers two cases, so the two cases are named in the comment
above it. This is the same call as round 1's `focusedPatientId` ref: an unkillable mutant on
dead code is a signal to delete the code, not a coverage gap to explain.

The replacement control `G05` proves the mount case is still individually pinned — it lets
the first commit through by adding `&& previousVariant !== null`, and the mount-time ordering
test goes red.

## Verification

```
 Test Files  4 passed (4)
      Tests  232 passed (232)
```

`tests/care-plan-domain.test.ts`, `tests/care-plan-prototype-state.test.ts`,
`tests/care-plan-linked-routes.dom.test.tsx`, `tests/care-plan-route-files.test.ts`. The DOM
file is 92 (was 90 — the new `it.each` contributes two).

```
[gate-receipts] recorded a pass for "typecheck:internal" (4425 input files).
[gate-receipts] recorded a pass for "lint:internal" (4425 input files).
```

Both `recorded a pass`, so both are fresh runs rather than memoised answers. The first
`typecheck` attempt was refused with `DATABASE_HEAVY_RUN_ADMISSION_BUSY` from
`dev-hub-phase-1`; that is an acquisition failure and was retried, not recorded.
`npm run format` was run and its output is in the commit.

### Positive controls — 4 run, 4 killed

Each breaks one guard and names the tests that caught it. All ran with `GATE_RECEIPTS=off`.

```
RED   G01 let the effect fire on a route change back to a directory surface (the reported defect) — 3 failed | 89 passed (92)
        killed: never takes mount-time focus from the shell heading, even momentarily
              | does not compete with the shell heading when returning from a patient address to Home
              | does not compete with the shell heading when returning from a patient address to Patients

RED   G05 let the first commit through, stealing the shell's mount-time focus — 1 failed | 91 passed (92)
        killed: never takes mount-time focus from the shell heading, even momentarily

RED   G03 let a patient address focus its own workspace — 1 failed | 91 passed (92)
        killed: does not compete with the shell heading when the patient address itself changes

RED   G04 never move focus on selection at all — 3 failed | 89 passed (92)
        killed: moves focus to the workspace when a patient is selected
              | does not compete with the shell heading when returning from a patient address to Home
              | does not compete with the shell heading when returning from a patient address to Patients
```

**G01 is the round's deliverable.** It removes the "address changed" guard, reproducing the
reported defect exactly, and the two new tests are among the three that catch it. Before this
round, that same mutation left every test green.

An earlier control run against the pre-collapse version of the fix recorded
`GREEN G02 steal the shell's mount-time focus — 92 passed (92)`; that is the redundant-guard
finding described above, and `G05` is its replacement against the collapsed code.

### CR and control-byte scan

```
clinical-snapshot-page.tsx           CR=0 BOM=false ctrl=0
care-plan-linked-routes.dom.test.tsx CR=0 BOM=false ctrl=0
care-plan-route-files.test.ts        CR=0 BOM=false ctrl=0
task-4-report.md                     CR=0 BOM=false ctrl=0
CLEAN: no CR, no BOM, no control bytes in any touched file
```

An anchor sweep over every mutated guard confirmed no mutation residue survived before the
commit.

## The two latent parser notes

Not restructured, as instructed. Both assumptions are now stated in one-line comments where
they are made, in `tests/care-plan-route-files.test.ts`:

- the block parser assumes one `{` per chunk, which holds once at-rule headers are stripped,
  and drops anything after a second one;
- `declarationsOf` assumes no declaration value contains a bare `;`, true of this stylesheet,
  which uses no data URIs or quoted strings.

Both belong on the deferred-minors list for the whole-branch review.

## Files in this round

Modified: `src/components/care-plan/mockups/clinical-snapshot-page.tsx` (the effect),
`tests/care-plan-linked-routes.dom.test.tsx` (the two ordering tests),
`tests/care-plan-route-files.test.ts` (two assumption comments only).

Untouched: every other Care Plan source file, `docs/care-plan/sdd-ledger.md`, and every page
file.

## Concerns after this round

1. **This is the third focus defect in a row that only an event-order test could see**, and
   all three had the same cause: the shell is an ancestor, so its effect lands last and
   repairs whatever a descendant did. Any future descendant that moves focus will have the
   same blind spot, and nothing structurally prevents it — the pattern is a convention held by
   three tests, not an invariant. If the whole-branch review wants it closed properly, the
   shape is a single focus owner the descendants ask, rather than each calling `focus()`.

2. **The ordering tests assume React commits child effects before parent effects.** That is
   documented, stable behaviour rather than an accident, but it is load-bearing here: if it
   changed, these tests would fail for a reason unrelated to the behaviour they protect. The
   `focusin` recording at least makes such a failure legible.

3. **Still no browser verification.** Unchanged from round 1: phone width, dark mode, forced
   colours and print remain structurally asserted only. Focus behaviour in particular is
   asserted in jsdom, which has no real focus ring, no scrolling, and no assistive technology
   — so "the region announces its name" is a claim about the mechanism, not an observation.

4. **Machine contention continued.** Several runs this round were refused with
   `Database focused-test capacity is full` from `dev-hub-phase-1`. None was recorded either
   way.
