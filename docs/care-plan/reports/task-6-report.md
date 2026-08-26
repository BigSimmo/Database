# Task 6 report — governed Management Plan authoring

Stage B opens with the first authoring surface in the product: drafting a replacement version,
comparing it against the Current Plan, senior approval, return-for-changes, formal review, and
withdrawal — plus the role switcher that makes the central governance rule demonstrable at all.

**Status: DONE_WITH_CONCERNS.** Everything the brief asks for is built and proved. Three things are
worth the reader's attention and are set out under "Concerns": a third component file beyond the
brief's list, a scenario-plumbing gap that Task 6 could only work around rather than close, and a
double focus move that follows from reusing the repository `ErrorSummary`.

---

## 1. What was built, and why it is shaped this way

### 1.1 The role switcher (correction 3)

`care-plan-shell-frame.tsx` now renders a `Select` labelled exactly `Prototype role` inside the
existing `care-plan-active-user` block, beneath the displayed clinician's name and title. Choosing
an option dispatches `set-active-user` — the action Task 2 already built. Options are the four
synthetic users, labelled `<name> — <role>`, and the field carries a hint saying in plain words that
this explains which actions are offered, is not a sign-in, and protects nothing.

It lives in the rail, which already carries `data-print-hide="true"`, so it never reaches paper.

A new display-facing `PROTOTYPE_ROLE_LABEL` sits in `prototype-ui.tsx`. `prototype-state.ts` keeps
its own lower-case `ROLE_LABEL` for refusal prose; the two are deliberately different registers
("signed in with the named senior clinician role" versus "Dr Taylor Fiction — Named senior
clinician") and neither reads correctly in the other's position.

### 1.2 The route builders (correction 2)

`carePlanRoute.managementPlanEdit` and `carePlanRoute.managementPlanReview` added, matching the
literals `CARE_PLAN_ROUTES` already held. The registry test now pins both, including the identity
`carePlanRoute.managementPlanEdit("SYN-PATIENT-001") === CARE_PLAN_ROUTES.managementPlanEdit`, so
the builder and the reconstructable example cannot drift apart.

### 1.3 The one new reducer action

`record-plan-shared-with-patient` sets `sharedWithPatientAt` on the Current version and appends one
`management_plan_shared_with_patient` audit event. It writes no Patient Plan — Task 9 owns that, and
a reducer test asserts `patientPlans` and `patientPlanVersions` stay empty.

Two decisions inside it:

- **Capability is `read_plan`.** Showing someone their own plan is something any role that may read
  the plan does at a bedside, and recording that it happened is the same event written down.
  Gating it to the authoring roles would leave the person most likely to actually do it — the
  clinician in front of the patient — unable to say so. It is _not_ connectivity-exempt: unlike a
  print intent it changes a clinical record, so offline blocks it like everything else.
- **A second record is refused, not overwritten.** `sharedWithPatientAt` is one date. Recording a
  second sharing would silently replace a recorded fact with a different one and the first sharing
  would leave the record with nothing saying so. The refusal names the date already held and is
  `kind: "info"`, not an error — nothing went wrong, the fact is simply already there.

### 1.4 `ManagementPlanFormSurface` — `/management-plan/edit`

Five states, chosen in this order:

1. **No synthetic patient** → the shared `EmptyState`.
2. **Identity uncertain** → refuses outright; nothing can be written against an unconfirmed record.
3. **Role cannot author** → one sentence naming the signed-in clinician and their role. Absent
   controls, not refused ones (see §2).
4. **A version is awaiting approval** → read-only notice plus a link to the review route. No field
   is rendered at all, so "read-only" is a property of the DOM rather than of a disabled attribute.
5. **A Draft exists** → the form.
6. **No open version** → a single `Start a replacement version` control. The reducer already
   initialises a new draft from the Current version's content, so nothing already agreed is retyped.

The form exposes owner, next review date (defaulted from `REVIEW_INTERVAL_MONTHS`, editable),
revision reason, participation state, the five first-minute sections, and the six full-plan
sections with the optional five each hinted `Optional. Leaving it empty is a complete answer, and it
reads as Not recorded.` Content fields are one point per line; unchanged sections survive the round
trip because the form is seeded from the version and written back whole.

**Validation splits by action, deliberately.** `Save Draft` enforces only what the reducer itself
enforces (a parsable review date, a known owner) plus the wording guard. A Draft is work in
progress and must be storable while incomplete; refusing to save partial work would push authors to
keep it somewhere this prototype cannot see. `Submit for senior approval` enforces the full set —
exactly `MANAGEMENT_PLAN_REQUIRED_CONTENT_KEYS` plus owner, review date, revision reason and
participation state — because a submission is a request for a decision, and an incomplete one wastes
the senior clinician's time and the reducer will refuse it anyway.

The banned-wording guard reads `BANNED_ADMISSION_CONSTRUCTIONS` from `domain.ts` (imported, never
retyped), scans `agreedEdApproach` case-insensitively, and reports the construction it found by
name. The message tells the author what to write instead. It takes no view on whether the clinical
position is right — it refuses a _form of words_, which is the whole of its remit.

### 1.5 `ManagementPlanDiff` — the change table

`diffManagementPlanContent(current, proposed)` is a pure function exported on its own. Every one of
the eleven content fields appears, in the reading order the two tiers already use, labelled `Added`,
`Changed`, `Removed`, or `Unchanged`. Blank lines are trimmed before comparison so trailing
whitespace never reads as a change. Prose (`whyThisPlanExists`) is compared as a single line.

Unchanged sections are shown, not omitted: a reviewer needs to see that a section was left alone as
much as that it was rewritten, and a table that drops the unchanged sections cannot be told apart
from one that forgot them.

It makes no clinical judgement. There is no "improved", no "risk", no severity, no ordering by
importance — only what is different.

### 1.6 `ManagementPlanReviewSurface` — `/management-plan/review`

Order on the page: identity → outcome → **the Current Plan in full** → the submitted version's
metadata (author, owner, proposed approver, submitted date, proposed review date, revision reason,
participation marker) → the change table → the decision controls.

The Current Plan card comes first because the reader deciding whether a replacement is right has to
be able to read the plan it would replace, and because a version awaiting a decision is not a plan
in use at any moment on any surface. It also means the surface satisfies the standing rule that
authoring controls never appear above reading content.

- **Approve** opens a plain-language `ConfirmDialog` naming what happens: the version becomes
  Current immediately, the approver's name is recorded, and the previously Current version becomes
  Superseded and stays readable rather than being deleted.
- **At `declined` or `patient_unavailable` participation** the dialog adds the consequence before
  the decision: approving is allowed (a person's absence must never block their plan being written),
  the version will carry a permanent marker saying it was written without this person's involvement,
  and approving raises an open Review Trigger so going through the plan with them lands on
  somebody's list rather than only on that page.
- **Return for changes** opens a `Sheet` with a required reason, then dispatches and navigates to
  the edit route. The reason is all the author has to work from, so the field-level error says that.

When nothing is awaiting a decision the route still renders the Current Plan and says plainly that
no version is awaiting approval — which is also what the reader sees immediately after approving.

### 1.7 The reading surface's action block

`management-plan-read.tsx` gained one `PlanActions` section at the very foot of the page: below the
plan, below the version in progress, and below the team's telephone number. It carries the drafting
link, the sharing record, formal review, and withdrawal. Withdrawal is a `Sheet` with a required
reason and an explicit confirm, and afterwards the page shows the Task 5 withdrawal line rather than
a bare `No Current Plan`.

---

## 2. How I decided what to show and what to hide

The ruling was that the stated-reason pattern is right for an action a permitted role _could_ take
but cannot right now, and is not a licence to render every senior-only control to every non-senior
reader as a row of disabled buttons. I resolved that into one rule with two halves:

> **On a reading surface, a control the signed-in role can never use is absent.**
> **On an authoring or decision surface the reader deliberately opened, it is present with the
> reason stated.**

**Absent, on the reading surface.** An ED clinician opening a Management Plan at 3am sees the plan,
the team's contact details, and — because there is a Current Plan — one control: _Record that this
plan has been shown to this person_. No draft link, no approve, no withdraw, no formal review, and
no greyed-out placeholders. Four unavailable buttons at the foot of a clinical document tell that
reader nothing they can act on, and on a 320px phone they are four more thumb-lengths between the
reader and the end of the page. Proved by `shows a reader with no authoring permission no authoring
controls at all`, which also asserts no `/management-plan/edit|review` link exists anywhere in the
DOM for that role.

**Present with the reason, on the review route.** A liaison clinician who submitted a version and
follows the link to `/management-plan/review` sees `Approve version 2` carrying
`aria-disabled="true"`, an inert handler, `aria-describedby` pointing at the reducer's own sentence
— _"Morgan Sample is signed in with the … role, which does not carry this action"_ — and clicking it
opens nothing. Hiding it there would leave that clinician with no way to learn who may approve or
why the page appears to do nothing. Nobody reaches that address by accident: it is linked from the
plan's own authoring controls and from the Reviews queue, and the role switcher that changes the
answer is on the same screen.

**The degraded states are always stated, never hidden**, for both surfaces, because they are the
"could but cannot right now" case exactly: offline, unconfirmed identity, and version conflict each
render the reducer's own refusal text beside the control. The text comes from
`getPrototypeMutationBlockReason`, so the surface and the guard can never say different things.

No control anywhere in this task uses `title="… — coming soon"`. Nothing here is unbuilt; every
stated reason is a true statement about now, and the existing assertion that no reading surface
carries a "coming soon" title still passes untouched.

---

## 3. RED / GREEN evidence

Baseline before any change — `npm run test -- tests/care-plan-linked-routes.dom.test.tsx
tests/care-plan-prototype-state.test.ts tests/care-plan-route-files.test.ts`:

```
 Test Files  3 passed (3)
      Tests  203 passed (203)
```

### Stage 1 — route builders. RED:

```
 FAIL  |node| tests/care-plan-route-files.test.ts > Care Plan route registry > rebuilds every deep route from a patient identifier without a second literal
TypeError: carePlanRoute.managementPlanEdit is not a function
 ❯ tests/care-plan-route-files.test.ts:93:26
 Test Files  1 failed (1)
      Tests  1 failed | 19 passed (20)
```

### Stage 2 — the new reducer action. RED (three of the five new tests; the other two passed

vacuously because an unmatched action falls out of the switch returning `state`, and because an
absent capability entry is `undefined`, not `null`, so the degraded-state funnel still ran):

```
 FAIL  tests/care-plan-prototype-state.test.ts > Care Plan sharing the plan with the person > records the date against the Current version and audits it
 FAIL  tests/care-plan-prototype-state.test.ts > Care Plan sharing the plan with the person > refuses when there is no Current Plan to show anyone
 FAIL  tests/care-plan-prototype-state.test.ts > Care Plan sharing the plan with the person > refuses a second record and names the date already held
 Test Files  1 failed (1)
      Tests  3 failed | 71 passed (74)
```

### Stage 3 — role switcher. RED:

```
 FAIL  > Care Plan route shell > offers a prototype role switcher beside the signed-in clinician
TestingLibraryElementError: Unable to find an accessible element with the role "combobox" and name "Prototype role"
 FAIL  > Care Plan route shell > changes the signed-in synthetic clinician when a different role is chosen
 FAIL  > Care Plan route shell > says plainly that the role switcher is not authentication
 FAIL  > Care Plan route shell > keeps the role switcher off a printed page
 Test Files  1 failed (1)
      Tests  4 failed | 114 passed (118)
```

### Stage 4 — the authoring surfaces. RED (the whole Stage B block; the surfaces did not exist), then

after implementation four remaining failures, each a wrong expectation of mine rather than a defect:
the review-warning assertion after a formal review (the plan is no longer overdue, so the warning
correctly disappears — reworded to assert the new date on the summary card and the warning's
absence), a truncated banned-wording phrase, and the two degraded-state tests described in §5.2.

### GREEN — the four Care Plan test files, `GATE_RECEIPTS=refresh`:

```
 Test Files  4 passed (4)
      Tests  299 passed (299)
   Duration  22.47s
```

### GREEN — `npm run lint` and `npm run typecheck`:

```
[gate-receipts] recorded a pass for "lint:internal" (4431 input files).
[gate-receipts] recorded a pass for "typecheck:internal" (4431 input files).
```

### The whole offline unit suite — `npm run test`:

```
 Test Files  1 failed | 698 passed | 2 skipped (701)
      Tests  2 failed | 8029 passed | 58 skipped (8089)
```

Both failures are `tests/gate-receipts.test.ts > … file modes`, and both are environmental on this
machine, not caused by this diff. Proof, rather than assertion:

```
mode before: 100666 after: 100666 changed: false
```

`fs.chmodSync(file, 0o755)` is a no-op on this Windows Dev Drive, so a test that asserts the
signature changes when only the working-tree mode changes cannot pass here. `git diff --stat --
scripts/ .githooks/` is empty: this diff touches nothing either test reads.

---

## 4. Mutation testing — 19 mutations, 19 killed

Every test whose job is to reject something got a positive control: the code was made to wrongly
permit it, the test was watched going red, and the code was restored byte-for-byte from a backup
copy (`cp`), never retyped.

| #   | Mutation                                                 | Test(s) killed                                                                                                                           |
| --- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | Reducer: drop the "already shared" refusal               | `refuses a second record and names the date already held`                                                                                |
| M2  | Reducer: turn "no Current Plan" into a success           | `refuses when there is no Current Plan to show anyone`                                                                                   |
| M3  | Reducer: capability `read_plan` → `null` (no gate)       | `is blocked offline, like every other action that changes a record`                                                                      |
| M4  | `managementPlanEdit` returns the review path             | `rebuilds every deep route from a patient identifier without a second literal`                                                           |
| M5  | Role switcher `onChange` becomes a no-op                 | 20 tests, including `changes the signed-in synthetic clinician when a different role is chosen` — the whole Stage B suite depends on it  |
| M6  | Read surface: `mayAuthor = true` for every role          | `shows a reader with no authoring permission no authoring controls at all`                                                               |
| M7  | Read surface: `mayWithdraw = true` for every role        | that test, plus `offers a drafting entry point to a clinician who may author`                                                            |
| M8  | Move `PlanActions` above the pinned safety boundary      | `keeps every authoring control below the whole reading surface`                                                                          |
| M9  | Validate only the first required content key             | `lists every required field in a linked summary and moves focus to the first invalid one`                                                |
| M10 | `bannedConstructionIn` always returns `null`             | `rejects a prohibitive admission construction and names the one it found`                                                                |
| M11 | Make the five optional sections required                 | `does not require the five optional full-plan sections`, plus `submits a draft through a confirmation and navigates to the review route` |
| M12 | Remove the focus move on validation failure              | `lists every required field in a linked summary and moves focus to the first invalid one`                                                |
| M13 | Form: `saveBlockedReason` forced to `null`               | `states why nothing can be saved while the device is offline`                                                                            |
| M14 | `statusOf` never returns `Removed`                       | `labels a section that gains content Added and one that loses it Removed`                                                                |
| M15 | Equal content labelled `Changed`, never `Unchanged`      | that test, plus `compares the submitted version against the Current one with semantic labels`                                            |
| M16 | Review: `decisionBlockedReason` forced to `null`         | `states why a clinician who is not the named senior cannot approve` and `states why a version conflict blocks the decision`              |
| M17 | Drop the involvement paragraph from the approval dialog  | `states the involvement consequence in the dialog and raises the Review Trigger`                                                         |
| M18 | `handleReturn` skips the blank-reason check              | `returns a version for changes with a required reason and sends the author to the draft`                                                 |
| M19 | Reducer: stop superseding the previously Current version | `leaves exactly one Current version and supersedes the one it replaced`                                                                  |

**M12 deserves its own note**, because three focus defects on this project came from a guard that
could not fail. M9 and M11 also touch that test, so M12 was re-run in isolation. Its decisive line:

```
 FAIL  > Care Plan Management Plan drafting > lists every required field in a linked summary and moves focus to the first invalid one
AssertionError: expected 'error-summary' to be 'care-plan-management-form-revisionRea…'
Expected: "care-plan-management-form-revisionReason"
Received: "error-summary"
 ❯ tests/care-plan-linked-routes.dom.test.tsx:1495:26
```

The assertion is on the **order of `focusin` events**, not on final state: the last recorded focus
event must be the first invalid field, and `error-summary` must appear before it. With the focus
move removed, focus stops at the error summary and the test goes red — so the guard demonstrably
can fail.

**M19's kill is the invariant firing where it should**:

```
Error: Management plan SYN-MGMT-PLAN-002 has more than one current version: SYN-MGMT-VERSION-003, SYN-MGMT-VERSION-004
 ❯ assertSingleCurrentVersion src/components/care-plan/mockups/domain.ts:394:13
 ❯ prototypeReducer src/components/care-plan/mockups/prototype-state.ts:786:7
```

---

## 5. What I found wrong in the brief

### 5.1 The four corrections, confirmed against the fixtures

All four held. Specifically on correction 1: `SYN-MGMT-VERSION-004` on `SYN-MGMT-PLAN-002` is
`state: "awaiting_approval"` at **version 2**, and the version it would replace,
`SYN-MGMT-VERSION-003`, is `state: "current"` at **version 1**. The worked example's `version 3` and
`Current version 3` are both wrong; the route, the role selection (`SYN-USER-SENIOR-001` is Dr
Taylor Fiction, Consultant Psychiatrist, `senior_clinician`) and `Approved by Dr Taylor Fiction` all
check out. The example is committed nearly verbatim with 3 → 2 and 2 → 1.

### 5.2 A fifth thing the brief could not have known: the URL scenario never reaches the reducer

The brief asks for DOM tests covering "offline/version-conflict refusal". Those could not be written
as the brief implies, because **`?scenario=offline` does not degrade the prototype state**.
`CarePlanPrototypeProvider` is mounted in a server layout that cannot read a query string, so it
always started at `"normal"`; the scenario reached only the `data-care-plan-scenario` attribute and
the surfaces' `scenario` prop. `apply-scenario` is the mechanism that sets the flags, and the System
states route that dispatches it belongs to Task 7.

I took the smallest change that lets the refusal be proved without pre-empting Task 7's design:
`CarePlanPrototypeProvider` now accepts an optional `scenario` prop that seeds the initial state and
is read once. The layout passes nothing, so **application behaviour is unchanged**. `renderRoute` in
the DOM tests passes the scenario parsed from the same query string the surface reads, so a specimen
now degrades the reducer as well as the rendering and the refusals are asserted against a state that
really is offline.

The consequence is honest but worth stating: the components' offline and version-conflict refusals
are proved, and the URL-to-reducer plumbing is not, because it does not exist yet. See Concerns.

### 5.3 One small wrong expectation of my own, worth recording

My first draft of the formal-review test asserted the new date on the review warning. It failed —
correctly. Moving the next review date from an overdue date to 2027 takes the plan _out_ of the
overdue state, so `ReviewWarning` returns `null` by design. The test now asserts the new date on the
summary card, the warning's absence, and that the plan content is untouched, which is a stronger
statement about what a formal review does.

---

## 6. Files created and modified

**Created**

- `src/components/care-plan/mockups/management-plan-form.tsx`
- `src/components/care-plan/mockups/management-plan-diff.tsx`
- `src/components/care-plan/mockups/management-plan-review.tsx` — beyond the brief's list; see
  Concerns

**Modified**

- `src/components/care-plan/mockups/management-plan-read.tsx` — the `PlanActions` block; the
  full-plan label constants moved out; a stale header comment about "a later task" corrected
- `src/components/care-plan/mockups/routable-suite.tsx` — the two authoring routes wired, their
  route-purpose specimens removed, the role switcher's props supplied
- `src/components/care-plan/mockups/care-plan-shell-frame.tsx` — the role switcher (correction 3)
- `src/components/care-plan/mockups/routes.ts` — the two builders (correction 2)
- `src/components/care-plan/mockups/types.ts` — `record-plan-shared-with-patient`; the deferred-list
  comment updated
- `src/components/care-plan/mockups/prototype-state.ts` — that action's capability entry and case
- `src/components/care-plan/mockups/prototype-ui.tsx` — `PROTOTYPE_ROLE_LABEL`, `PlanTextArea`,
  and the full-plan section keys/labels moved here from the reading surface, where three surfaces
  now need them
- `src/components/care-plan/mockups/prototype-provider.tsx` — the optional `scenario` seed (§5.2)
- `src/components/care-plan/mockups/care-plan.module.css` — form, action-row, change-table and
  textarea rules, all scoped below `.appRoot`
- `tests/care-plan-linked-routes.dom.test.tsx` — 44 new tests; the two authoring routes moved from
  the route-purpose list to the real-content list; the superseded "reserves no space … of a later
  task" test replaced by the four role-visibility tests that now state the rule directly
- `tests/care-plan-prototype-state.test.ts` — 5 tests for the new action
- `tests/care-plan-route-files.test.ts` — the two builders pinned; the two new components added to
  the shared-outcome-tone consumer list

No file outside that list was edited.

## 7. CR and control-byte scan

Every touched file, read as bytes:

```
management-plan-form.tsx      bytes= 26496 CR=0 CTRL=0 NUL=0
management-plan-diff.tsx      bytes=  5723 CR=0 CTRL=0 NUL=0
management-plan-review.tsx    bytes= 14446 CR=0 CTRL=0 NUL=0
management-plan-read.tsx      bytes= 22272 CR=0 CTRL=0 NUL=0
prototype-ui.tsx              bytes= 18083 CR=0 CTRL=0 NUL=0
prototype-state.ts            bytes= 66787 CR=0 CTRL=0 NUL=0
prototype-provider.tsx        bytes=  2265 CR=0 CTRL=0 NUL=0
care-plan-shell-frame.tsx     bytes= 12365 CR=0 CTRL=0 NUL=0
routable-suite.tsx            bytes= 13120 CR=0 CTRL=0 NUL=0
routes.ts                     bytes=  6873 CR=0 CTRL=0 NUL=0
types.ts                      bytes= 19545 CR=0 CTRL=0 NUL=0
care-plan.module.css          bytes= 20155 CR=0 CTRL=0 NUL=0
care-plan-linked-routes.dom.test.tsx  bytes= 92498 CR=0 CTRL=0 NUL=0
care-plan-prototype-state.test.ts     bytes= 63396 CR=0 CTRL=0 NUL=0
care-plan-route-files.test.ts         bytes= 26396 CR=0 CTRL=0 NUL=0
CLEAN: no CR, control, or NUL bytes in any touched file
```

All source was written with editor tools. No Python, `sed`, or shell heredoc touched a source file;
the only shell writes were `cp` restores of byte-identical backups during mutation testing.

`npm run format` was run and its result is included in the commit. `npx prettier --check` on the
Care Plan namespace afterwards: `All matched files use Prettier code style!`

---

## 8. Concerns

1. **A third component file, beyond the brief's list.** The brief names `management-plan-form.tsx`
   and `management-plan-diff.tsx` only, but it also requires a review page that shows author, owner,
   proposed approver, revision reason, both versions, participation state, the change table, and the
   approve and return controls. Putting that inside the diff module would have made one file two
   unrelated things, and inside the form module would have put an approval surface in a drafting
   one. `management-plan-review.tsx` is the smallest defensible home. Flagging it because
   correction 4 said the file list is a guide, not a limit — and also said not to wander.

2. **The URL scenario still does not reach the reducer.** Task 6 proves that the surfaces refuse
   correctly _given_ a degraded state, and the provider now accepts a seed so that can be asserted.
   It does not close the gap: in the running app today, `?scenario=offline` on the edit route shows
   no refusal, because `connectivity.online` is still `true`. Task 7 owns the System states route
   and `apply-scenario`; whoever does it should decide whether the URL should drive the reducer on
   every route (which would make every specimen address genuinely reconstructable) or only from the
   System states controls. I deliberately did not build that sync, because a route-level effect
   dispatching `apply-scenario` resets the whole world and could collide with Task 7's own design.

3. **Two focus moves on a failed submit.** The repository's `ErrorSummary` focuses _itself_ by
   design ("moving focus is both the announcement and the navigation"), while this task's stated
   requirement is to focus the first invalid field. I use the repository component rather than
   re-implementing it, and move focus to the field from the form's own effect — which, being the
   parent's, lands last. The result is correct (focus ends on the field, and the ordering test pins
   that), but a screen-reader user gets two focus events in quick succession. If that reads badly in
   the Task 11 browser pass, the fix is an opt-out on `ErrorSummary`, not a change here.

4. **The review route is long.** Rendering the Current Plan in full above the comparison is the
   right call under "authoring never appears above reading content", and it means a reviewer can
   read the plan they are replacing. It also means a senior clinician on a phone scrolls past five
   first-minute sections before reaching the change table. Worth looking at with real eyes in Task
   11; a jump link rather than a reordering would be my suggestion.

5. **Browser proof is outstanding**, as expected. Nothing in this task has been seen rendered: the
   browser pane does not composite in this environment, so phone layout at 320px and 390px, dark
   mode, forced colours, reduced motion, visible focus, and print behaviour for the new form, change
   table and sheets are all asserted structurally and unverified visually. Task 11 owns it. The
   stylesheet guard in `tests/care-plan-route-files.test.ts` covers the protected selectors only,
   and none of the new classes are on that list — correctly, since none of them carries
   safety-critical plan content.

6. **`Save Draft` and `Submit` validate different sets**, which is a real product decision I made
   rather than one the brief made. If a reviewer disagrees, the change is one filter in `handleSave`.

---

# Fix round 1 of 5

Seven findings addressed, two of them Critical and both invisible to every gate. Nine mutations, all
killed, with the decisive line pasted for each. One mutation initially _survived_, and the
investigation changed a test rather than being written up as a kill — that is set out in full below.

## Critical 1 — the pinned safety boundary's link had been silently rebound

**What was wrong.** `care-plan.module.css` previously read `.appRoot .pinnedBoundaryLink,` on one
line and `.appRoot .inlineLink { color… font-weight… text-decoration: underline… }` on the next. My
Task 6 block went in between the comma and its continuation. After comment-stripping the rule became
`.appRoot .pinnedBoundaryLink, .appRoot .planTextArea { height: auto; min-height: 5.5rem; … }`, and
`.inlineLink` became a standalone rule that no longer included the boundary's link.

The anchor in `prototype-ui.tsx` carries `styles.pinnedBoundaryLink` and nothing else, so the jump
link inside the pinned safety boundary — the element the specification says is never collapsed,
truncated or hidden, the one the hurried reader is meant to follow — lost its accent colour, its
weight and its underline, and inherited textarea sizing.

**The fix.** The `.pinnedBoundaryLink, .inlineLink` rule is now closed before the
`/* --- Authoring surfaces --- */` comment and sits with the other pinned-boundary rules, where it
belongs; the authoring block follows it; the duplicate standalone `.inlineLink` further down is gone.
The rule carries a comment naming the defect and the guard.

**The guard, which is the part that matters.** `keeps the pinned boundary's jump link, and every
inline link, looking like a link` in `tests/care-plan-route-files.test.ts` parses the stylesheet,
collects the union of declarations from every rule whose selector list names each link class, and
asserts each still declares a colour, a font weight, and an underline. It fails closed when a class
matches no rule at all, so a rename cannot make it silently vacuous. It covers `inlineLink` too,
because the same insertion one line lower would have hit that instead.

Why the existing gates could not see it, restated so the next person does not re-derive it: Vitest
runs `css: false`, so DOM tests only ever observe that a class token was applied; the suppression
guard does match `pinnedBoundary\w*` but inspects declarations for _hiding_, and a rebinding hides
nothing; and the `.appRoot` scoping guard splits the selector list on `,`, after which both halves
still began with `.appRoot`.

**Positive control (N1).** Rebound the class again by reinserting a block between the comma and its
continuation:

```
 FAIL  |node| tests/care-plan-route-files.test.ts > Care Plan synthetic, memory-only boundary > keeps the pinned boundary's jump link, and every inline link, looking like a link
AssertionError: .pinnedBoundaryLink declares no colour, so it does not read as a link: expected false to be true
```

## Critical 2 — a first plan was compared against itself

**What was wrong.** `current={currentManagementVersion?.content ?? awaiting.content}` and
`currentVersionNumber={currentManagementVersion?.version ?? 0}`. With no Current Plan the proposed
content was diffed against itself: all eleven sections read `Unchanged in both versions`, under
`Comparing Current version 0 with proposed version 1`. A senior clinician deciding on a person's
first plan was told nothing had changed, against a version number that does not exist. Reachable
today via `SYN-PATIENT-005`.

**The fix.** A new `ManagementPlanFirstVersion` in `management-plan-diff.tsx` renders the whole of
the proposed version, section by section, and says why there is no table: "This is the first version
of Alex's Management Plan, so there is no earlier version to compare it against. The whole of version
1 is shown instead." The review surface chooses between it and the change table on
`currentManagementVersion === null`, which is the same null branch its two neighbours already handle
correctly.

**The test follows the navigation.** The submit test asserted on the mocked `navigate` and never
rendered the destination, which is exactly why nothing caught this. `shows a first version as a first
version, not as a comparison against nothing` submits Alex's draft on the edit route, re-renders at
the review route, and asserts the first-version panel, the content, the decision control, and the
absence of both `Unchanged in both versions` and `version 0`.

**Positive control (N2).** Restored the self-comparison:

```
 FAIL  > Care Plan Management Plan drafting > shows a first version as a first version, not as a comparison against nothing
TestingLibraryElementError: Unable to find an element by: [data-testid="care-plan-review-first-version"]
```

## Important 3 — every plan action now states its own reason

`PlanActions` computed a blocked reason for the sharing control only. `Record a formal review` and
`Withdraw this plan` were plain enabled buttons; a clinician discovered the refusal only after opening
the sheet, typing a reason and confirming. My previous report's §2 claimed "the degraded states are
always stated, never hidden", which was not what the code did — the claim was true of the review route
and false of this one.

All three reasons are now computed through `getPrototypeMutationBlockReason`, and identical reasons
are stated once and shared by `aria-describedby` rather than repeated per control, since offline
blocks all three at the same moment.

**Positive controls.** N3, dropping the withdrawal wiring:

```
Error: /Withdraw this plan/i must say why it is unavailable: expect(element).toHaveAttribute("aria-disabled", "true")
```

N3b, giving each control its own notice instead of sharing one:

```
 FAIL  > states one shared reason once rather than repeating it per control
AssertionError: expected [ <p …(4)></p>, <p …(4)></p>, …(1) ] to have a length of 1 but got 3
```

## Important 4 — the URL now reaches the reducer

Built in this round, per the ruling, following the guarded sync in the sibling Caring Contacts
prototype. `CarePlanRouteSurface` dispatches `apply-scenario` only when the scenario named in the URL
differs from the one the reducer holds, and resets to `normal` on leaving a scenario address only when
the current scenario was the one that address put there — so a scenario chosen by hand on the System
states screen is left alone.

Three tests: a scenario named in the URL reaches the reducer; leaving the address returns to the
ordinary world; and navigating inside one scenario reconstructs nothing.

**Positive control (N4)**, removing the dispatch — both directions go red:

```
 FAIL  > applies a scenario named in the URL to the reducer, not only to the rendering
 FAIL  > returns to the ordinary world when the reader leaves a scenario address
TestingLibraryElementError: Unable to find an element by: [data-testid="care-plan-form-blocked"]
```

### The mutation that survived, and what it found

Removing the `state.scenario !== scenario` guard should have destroyed the in-session draft. The test
stayed green. Two reasons, and both were worth finding:

1. **`apply-scenario` already carries its own no-op guard** in the reducer, so the component-level
   check is a second line rather than the only one.
2. **More importantly, my test was not exercising the effect at all.** It navigated only the
   _pathname_. The effect's dependencies are `[dispatch, queryParams, scenario, state.scenario]`, and
   `queryParams` is memoised on the query string — so a path-only navigation leaves every dependency
   untouched and the effect never re-runs. The test would have passed whatever the guard did.

The navigation that does re-run it is one that keeps the scenario and changes another query parameter
— exactly what `carePlanRoute.withQuery` builds, and what the registry test already pins as
`?scenario=empty&view=awaiting`. The test now performs both navigations. With the strengthened test:

**N5a — both guards removed → RED.** The world is reconstructed, the signed-in clinician reverts to
the ED clinician, and the form the draft lived in is no longer rendered at all:

```
 FAIL  > Care Plan specimen scenarios reach the reducer > does not reconstruct the world when navigating inside one scenario
TestingLibraryElementError: Unable to find an accessible element with the role "textbox" and name `/What helps/i`
```

**N5b — reducer guard removed, component guard intact → GREEN** (`Tests 1 passed | 152 skipped`),
which is the evidence that the component-level guard is load-bearing on its own rather than leaning on
the reducer's.

I am reporting the component-only mutation as **equivalent, not killed**. Both guards protect the same
harm independently, and the honest statement is that the test detects the harm and either guard alone
prevents it.

## Important 5 — one focus owner, and it is the field

`ErrorSummary` gained `manageFocus?: boolean`, additive and defaulting to `true`, so every existing
caller is untouched. The Care Plan form passes `false` and owns the move, so a failed submit produces
exactly one focus event, onto the first invalid field. The summary stays rendered, visible and linked,
and its anchors still move focus to each field when activated.

The focus test now asserts the ordering _and_ that `error-summary` never appears among the events.

**Positive controls.** N6, removing the form's own move — with the opt-out on, nothing takes focus at
all, which is the failure mode the new prop's doc comment warns about:

```
AssertionError: expected '' to be 'care-plan-management-form-revisionReason'
```

N6b, setting `manageFocus` back to `true` — the double move returns and is visible in the event order:

```
AssertionError: the summary must not take focus as well: expected [ '', 'error-summary', …(1) ] to not include 'error-summary'
```

**A tension I should flag rather than bury.** The stated harm was that a screen-reader user is moved
off the summary before its seven errors can be read. My fix removes the interruption but not the
inaccessibility: the summary is now never announced automatically. The alternative reading — delete
the form's move and let the summary keep focus — would announce all seven but contradicts the brief's
explicit "Render a linked error summary and focus the first invalid field". I chose the brief, and
chose it partly because the named fix was an opt-out on `ErrorSummary`, which is only needed if the
summary must stop focusing itself. It is a one-line flip (drop `manageFocus={false}` and delete the
form's effect) if the other reading was intended.

## Minor 6 — the two unreachable validation branches are gone

Dropped. Both `ownerId` and `participationState` are `<select>` values seeded from the version being
edited, and both are typed unions with no empty member, so neither branch could ever fire. Dead code
inside the one function this task's error tests exercise is worse than a shorter validator. A comment
records why, and that the reducer remains the guard — it already refuses an owner who is not a
synthetic user. If either control ever gains a placeholder, the branch returns with a test that
reaches it.

## Minor 7 — the version-conflict refusal now clicks

Brought into line with its two siblings: it clicks the refused control and asserts no dialog opens,
the awaiting version is untouched, and the Current Plan is still version 1.

**Positive control (N7)**, wiring the real handler while leaving `aria-disabled` in place — isolating
exactly the value the added click contributes:

```
 FAIL  > states why a clinician who is not the named senior cannot approve
 FAIL  > states why a version conflict blocks the decision
AssertionError: expected <div …(6)>…(4)</div> to be null
```

## Did any earlier test change meaning under the seeded provider? Yes — one, now repaired

I checked all five pre-existing tests that pass a query.

- `systemStates` with `overdue-plan` and with `not-a-scenario` (×2) — assert only the
  `data-care-plan-scenario` attribute. Unchanged.
- `patient` with `identity-uncertain` — the surface branches on the prop; seeding additionally sets
  `identity.certain: false`, so the world now matches the address. Unchanged, marginally strengthened.
- `patient` with `launch-failure` — that scenario sets no reducer flag at all. Unchanged.
- `managementPlan` / `managementPlanPrint` for `SYN-PATIENT-004` with `withdrawn-plan` (×3) — seeding
  sets `selectedPatientId`, but these routes take the patient from the pathname. Unchanged.

**The one that did change: `finds a synthetic patient and keeps Current Plan above an awaiting draft`
(Task 4).** It renders Home with `scenario=overdue-plan`, searches for Mira's MRN, clicks _Open Mira
Example_, and asserts on her workspace. Seeding pre-selects Mira, so the workspace was already hers
before the click — the test would have passed even if the search and the click did nothing. That is a
real weakening, and it happened inside my diff.

Repaired rather than merely reported: the scenario is dropped from that render, because Mira's overdue
date and her awaiting version are fixture facts that need no specimen, and an assertion that Rowan's
workspace is showing _before_ the search now pins the transition the test exists to exercise.

## Deferred minors for the ledger (recorded, not fixed)

1. `management-plan-form.tsx` is 661 lines with nine pure helpers — `linesFrom`, `contentFrom`,
   `valuesFrom`, `validate`, `bannedConstructionIn` and others — reachable only through a rendered
   form. The same argument that earned `diffManagementPlanContent` its own export applies.
2. `.roleSwitcher` declares a redundant `min-height` when `fieldControl` already sets `h-tap`.
3. The review route renders the Current Plan in full above the change table. Correct under read
   primacy, but long on a phone; a jump link is worth considering rather than a reordering.

## Verification

All commands run locally and offline; nothing provider-backed.

Care Plan suites — `tests/care-plan-linked-routes.dom.test.tsx`,
`tests/care-plan-prototype-state.test.ts`, `tests/care-plan-route-files.test.ts`,
`tests/care-plan-domain.test.ts`, with `GATE_RECEIPTS=refresh`:

```
 Test Files  4 passed (4)
      Tests  306 passed (306)
```

`form-field.tsx` is a shared primitive, so its other consumers were re-run —
`tests/ui-v2-form-field.dom.test.tsx`, `tests/ui-v2-components.dom.test.tsx`,
`tests/design-sync-visual-exports.test.ts`, `tests/settings-dialog-actions.dom.test.tsx`:

```
 Test Files  4 passed (4)
      Tests  161 passed (161)
```

That set caught one thing worth naming: `design-sync-visual-exports` went red because the generated
props metadata no longer matched the component. `npm run design-system:design-sync:update`
regenerated it, and the whole diff is the one new prop:

```
-    "ErrorSummary": "attempt?: number; className?: string; errors: {…}[]; heading?: string;",
+    "ErrorSummary": "attempt?: number; className?: string; errors: {…}[]; heading?: string; manageFocus?: boolean;",
```

`npm run lint` and `npm run typecheck`:

```
[gate-receipts] recorded a pass for "lint:internal" (4431 input files).
[gate-receipts] recorded a pass for "typecheck:internal" (4431 input files).
```

Whole offline unit suite:

```
 Test Files  1 failed | 698 passed | 2 skipped (701)
      Tests  2 failed | 8036 passed | 58 skipped (8096)
```

**The gate is not clean.** The two failures are `tests/gate-receipts.test.ts > … file modes`, and they
are the known Windows Dev Drive trap: `fs.chmodSync` is a no-op on this filesystem
(`mode before: 100666 after: 100666 changed: false`), and this diff touches nothing under `scripts/`
or `.githooks/`. Reporting it as red-with-an-explanation rather than rounding it to green.

## CR and control-byte scan

Every file touched this round, read as bytes:

```
care-plan.module.css                  bytes= 20598 CR=0 CTRL=0 NUL=0
management-plan-diff.tsx              bytes=  7376 CR=0 CTRL=0 NUL=0
management-plan-review.tsx            bytes= 15090 CR=0 CTRL=0 NUL=0
management-plan-read.tsx              bytes= 23981 CR=0 CTRL=0 NUL=0
management-plan-form.tsx              bytes= 26918 CR=0 CTRL=0 NUL=0
routable-suite.tsx                    bytes= 15085 CR=0 CTRL=0 NUL=0
prototype-state.ts                    bytes= 66787 CR=0 CTRL=0 NUL=0
ui/form-field.tsx                     bytes=  8864 CR=0 CTRL=0 NUL=0
.design-sync/config.json              bytes=199894 CR=0 CTRL=0 NUL=0
care-plan-linked-routes.dom.test.tsx  bytes=101632 CR=0 CTRL=0 NUL=0
care-plan-route-files.test.ts         bytes= 29633 CR=0 CTRL=0 NUL=0
CLEAN: no CR, control, or NUL bytes in any file touched this round
```

All source was written with editor tools. One attempt to append this section with a shell heredoc
failed on a quoting error and was abandoned rather than retried — the repository's own rule about
heredocs earning its keep. Mutation restores were byte-exact `cp` of backups taken before each
mutation; a residue scan for every mutation marker afterwards found none, and the four guards the
mutations targeted were each confirmed present again before the final run.

## Concerns after this round

1. **The `ErrorSummary` focus reading** described under Important 5 — one line to flip if I chose the
   wrong horn.
2. **`apply-scenario` and the System states screen (Task 7).** The sync re-applies the URL's scenario
   whenever `state.scenario` diverges from it, so a scenario toggled by hand on a page whose URL still
   names a different one will be pulled back. That is exactly how the Caring Contacts precedent
   behaves, and Task 7 owns the screen that makes it reachable; it should decide whether that control
   updates the URL as well as the state.
3. **Still no browser proof.** The pinned-boundary link defect is precisely the class of thing a
   browser pass finds and a DOM test cannot, and it took a human reviewer to catch this one. The new
   stylesheet guard closes this specific hole; it does not close the general one. Task 11 remains the
   only place the rendered result is actually looked at.

---

# Fix round 2 of 5

One decision and its consequences. Ruling accepted: the repository default stands, `ErrorSummary`
focuses itself, and the opt-out I added is gone.

## What changed

**`src/components/ui/form-field.tsx` is untouched by this task.** Restored from the base commit with
`git checkout f0ab0d41b -- src/components/ui/form-field.tsx`, which is byte-exact rather than a
retyped revert. Confirmed:

```
$ git diff f0ab0d41b --stat -- src/components/ui/form-field.tsx .design-sync/
(no output)
```

No additive prop, no default-off flag, no new contract on a shared file. `.design-sync/config.json`
is in that same check because the generated props metadata had moved when the prop existed;
regenerating it after the revert returned it to base exactly, so the whole design-system contract is
back where it started too. A search for `manageFocus` across `src/` and `tests/` returns nothing.

**The form's competing focus effect is gone**, along with the now-unused `useEffect` import. There is
exactly one focus move on a failed submit and it lands on the summary. In its place is a comment
saying why the form does not own focus — the repository made this decision for every form in the
product, and with up to seven errors the linked summary is the better landing place because a reader
hears how many problems there are and picks one, rather than discovering the rest by walking the form.

**The ordering test now pins the summary**, and is still an ordering assertion rather than a
final-state one:

- the last `focusin` event is `error-summary`;
- no event afterwards belongs to a form field, asserted by filtering the recorded ids for the
  `care-plan-management-form-` prefix and requiring the result to be empty — so a second owner
  reintroduced later cannot hide by landing after the summary;
- the summary's first link still points at the first invalid field, which is how a reader reaches it
  by their own choice.

Renamed to `lists every required field in a linked summary and leaves focus on it`, since the old name
asserted the behaviour that has just been overruled.

## Positive control

Reintroduced the field-focus effect, exactly as it was:

```
 FAIL  |jsdom| tests/care-plan-linked-routes.dom.test.tsx > Care Plan Management Plan drafting > lists every required field in a linked summary and leaves focus on it
AssertionError: expected 'care-plan-management-form-revisionRea…' to be 'error-summary' // Object.is equality

Expected: "error-summary"
Received: "care-plan-management-form-revisionReason"
 ❯ tests/care-plan-linked-routes.dom.test.tsx:1547:26
```

The second owner is visible in the event order, which is the point: the summary did take focus, and
something moved the reader off it.

## Verification

Care Plan suites — `tests/care-plan-linked-routes.dom.test.tsx`,
`tests/care-plan-prototype-state.test.ts`, `tests/care-plan-route-files.test.ts`,
`tests/care-plan-domain.test.ts`, with `GATE_RECEIPTS=refresh`:

```
 Test Files  4 passed (4)
      Tests  306 passed (306)
```

`form-field.tsx`'s other consumers, re-run to show the shared primitive ends this task exactly as it
started — `tests/ui-v2-form-field.dom.test.tsx`, `tests/ui-v2-components.dom.test.tsx`,
`tests/design-sync-visual-exports.test.ts`, `tests/settings-dialog-actions.dom.test.tsx`, with
`GATE_RECEIPTS=refresh`:

```
 Test Files  4 passed (4)
      Tests  161 passed (161)
```

`design-sync-visual-exports` passing without a regenerated contract is the useful signal there: last
round it went red because the component had gained a prop, and this round it is green against the
base metadata, which is independent confirmation that the primitive is genuinely back to its original
shape rather than merely looking like it.

`npm run lint` and `npm run typecheck`:

```
[gate-receipts] recorded a pass for "lint:internal" (4431 input files).
[gate-receipts] recorded a pass for "typecheck:internal" (4431 input files).
```

## CR and control-byte scan

```
management-plan-form.tsx              bytes= 27068 CR=0 CTRL=0 NUL=0
care-plan-linked-routes.dom.test.tsx  bytes=102525 CR=0 CTRL=0 NUL=0
ui/form-field.tsx                     bytes=  8107 CR=0 CTRL=0 NUL=0
.design-sync/config.json              bytes=199871 CR=0 CTRL=0 NUL=0
CLEAN: no CR, control, or NUL bytes in any file touched this round
```

## Concerns

None from this round. The change is a revert to an established repository behaviour, the shared
primitive is provably back to base, and the ordering test has a control showing it fails when a second
focus owner returns.

The three standing concerns from earlier rounds are unchanged: browser proof is still outstanding and
is where a rendered defect like Critical 1 would actually be seen; the `apply-scenario` versus System
states question now belongs to Task 10; and the deferred minors recorded in round 1 — the size of
`management-plan-form.tsx`, the redundant `min-height` on `.roleSwitcher`, and the review route's
length — are still open for the ledger.
