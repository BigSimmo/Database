# Task 5 report — Management Plan reading, pinned safety boundary, and clinician print

Branch `claude/ed-care-plans-impl-7f44cd`, worktree `D:\Worktrees\Database\care-plan-impl`.
Task 5 only. The Stage A Checkpoint section of the brief was deliberately **not** run.

---

## 1. What was built, and why

### The Management Plan reading surface (`management-plan-read.tsx`)

`/mockups/care-plan/patients/<id>/management-plan` now renders real content instead of its
Task 3 route-purpose specimen. In document order:

1. **A compact identity block** (`care-plan-plan-identity`) — synthetic marker, name, MRN, date
   of birth, preferred name, pronouns, then the patient-section navigation with
   `Management Plan` marked current.
2. **The pinned safety boundary**, the shared Task 4 `PinnedSafetyBoundary`, directly beneath
   identity and above every other plan element.
3. The outcome notice (screen-only), then the review-currency warning.
4. **The Current Plan summary card**, the shared Task 4 `CurrentPlanSummary` — the five
   first-minute sections generated from `FIRST_MINUTE_CONTENT_KEYS`, plus the approval and
   ownership metadata and the fresh-assessment boundary statement.
5. **The full-plan tier** (`care-plan-full-plan`) — `whyThisPlanExists` first, then the five
   optional sections, each rendering `Not recorded` when empty rather than being omitted.
6. **A version-and-review block** (`care-plan-plan-governance`) — version and state, derived
   review state, participation marker, open Review Triggers with their reasons, whether the
   plan has been shown to this person, and whether a current Patient Plan exists.
7. A subordinate **Version in progress** block when a draft or awaiting version exists.
8. The CMHT contact block (shared `ContactActions`).
9. A link to the print route.

Both shared components named by pre-flight ruling 5 are **consumed, not re-implemented**, so
the Snapshot and the Management Plan page cannot drift into two renderings of a
safety-critical element. The full-plan section labels and the `PlanList`/`PlanSubsection`
helpers are local to this file because they exist nowhere else yet.

**Withdrawn state.** `Plan withdrawn on <date> by <clinician> — <reason>` in
`care-plan-withdrawn-notice`, with the withdrawn version's own content rendered below in a
`Withdrawn version 1` region (`care-plan-superseded-content`) marked "not in use". A withdrawn
plan never renders as `No Current Plan`.

**Read primacy.** No edit entry point, no approval control, no disabled placeholder, and no
link whose href ends `/management-plan/edit` or `/management-plan/review`. Those two routes
keep their Task 3 specimens untouched.

### The printed clinician summary (`management-plan-print.tsx`)

`/…/management-plan/print` renders a `PrintOutput` paper carrying: identifiers, the pinned
safety boundary, a "check the electronic record" warning, the shared summary card (five
sections in order plus version and approval metadata), and the CMHT block as details only.
The paper omits navigation, actions, audit history, and any version that is not in use.

Off the paper, inside a `data-print-hide="true"` wrapper: the print control, a back link, and
the outcome notice.

Three things worth stating plainly:

- **The synthetic marker is rendered inside the printed subtree.** The shared print rule makes
  everything outside `[data-print-output]` `visibility: hidden`, so the shell header's marker —
  the one Task 3 fixed — does **not** reach the paper on a `PrintOutput` route. Task 3's fix
  covered `data-print-hide`; this is a different mechanism with the same consequence, and the
  Task 5 paper carries its own `SyntheticMarker`. A mutation removing it is killed.
- **The printed-at stamp is deterministic**, formatted from `PROTOTYPE_NOW` by a local pure
  function. No clock is read anywhere, in the prototype or in the shared primitive.
- **A withdrawn or absent plan is never offered for printing.** The route says why and links
  back; paper cannot be recalled once it leaves the room.

### The new action

`record-management-plan-print-intent` joins `CarePlanPrototypeAction` in this task, per
pre-flight ruling 3, with its reducer case, its `CAPABILITY_BY_ACTION` entry (`read_plan`), and
four new reducer tests. It appends one attributed audit event and changes no clinical record.
It is **not** added to `CONNECTIVITY_EXEMPT_ACTIONS`: that exemption carries a written
rationale specific to the person's own Personal Safety Plan, and widening it silently would
edit a reviewed decision. Offline therefore blocks the audit record with the standard message,
which the route displays; the browser print itself still happens.

---

## 2. The shared primitive: what was added, and its focused test

`src/components/ui/print-output.tsx` had two consumers outside this prototype
(`therapy-compass/screens/brief-screen.tsx`, `sheets-screen.tsx`) and no test file of its own.
It now has `tests/print-output-capabilities.dom.test.tsx`.

Every addition is additive and default-off. **The default rendering is pinned byte-for-byte**:

```
expect(container.innerHTML).toBe(
  '<div data-print-output="true" class="">Body<footer data-print-provenance="true">Source: a record</footer></div>',
);
```

That single assertion is the strongest guard on the binding constraint — it fails on any node,
attribute, or wrapper a later capability adds without being default-off, which a
per-capability "is the attribute absent?" test would not catch. It was written against the
**measured** pre-change output, not an assumed one.

| Capability                   | Shape                                                                                            | Default                                                                                       | Focused tests                                                                                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-section page breaks      | `<PrintSection breakInside breakBefore>` → `data-print-break-inside` / `data-print-break-before` | `breakInside="avoid"`, no `breakBefore`; the component is new, so nothing existing renders it | 4 tests: opt-in, fresh page, `breakInside="auto"` opts out, plus a static check that `globals.css` really declares `break-inside: avoid` and `break-before: page`                                             |
| Monochrome state treatment   | `monochrome` → `data-print-monochrome`                                                           | `false`                                                                                       | 2 tests: off by default / marks the output; static check that the print rule forces white ground, black ink, black borders                                                                                    |
| Confidential-document footer | `confidential` → `<p data-print-confidential>` with the exported `CONFIDENTIAL_DOCUMENT_FOOTER`  | `false`                                                                                       | 2 tests: off by default and standard wording (the wording itself is pinned separately, so rewording the constant cannot make the test follow it); static check that it is hidden on screen and shown in print |
| Printed-at stamp             | `printedAt` → `<p data-print-stamp>`                                                             | absent                                                                                        | 3 tests: off by default, renders exactly what the caller supplies, primitive reads no clock; static check of the screen/print display pair                                                                    |
| Pre-print hook               | `BrowserPrintButton onBeforePrint`                                                               | `undefined`                                                                                   | 2 tests: without it `window.print()` is still called once and nothing else; with it, the recorded order is exactly `["before", "print"]`                                                                      |

All five are general, and all five are declared once in the shared `@media print` block in
`globals.css` beside the rules that decide what prints at all. **Nothing was kept local for
being Care-Plan-specific** — the Care-Plan-specific parts (the record warning, the paper
layout, the identity and CMHT blocks) live in `care-plan.module.css` and the route component,
and none of them duplicates a rule the primitive should own.

One judgement call: `printedAt` takes a **pre-formatted value from the caller** rather than a
timestamp the primitive formats. A primitive that formatted a date would need a locale and a
timezone it cannot know, and one that read a clock would make every consumer's output
irreproducible and would break the prototype's determinism rule outright. A test asserts the
primitive's source contains no `new Date`, `Date.now`, `toLocaleDateString`, or
`Intl.DateTimeFormat`.

### The mandatory Therapy Compass regression run

```
> node scripts/run-vitest.mjs run --reporter=dot tests/therapy-compass-responsive-contract.test.ts tests/therapy-global-convergence-contract.test.ts

 Test Files  2 passed (2)
      Tests  18 passed (18)
```

Also run, because it slices the same `globals.css` print block:

```
> node scripts/run-vitest.mjs run --reporter=dot tests/therapy-compass-responsive-contract.test.ts tests/therapy-global-convergence-contract.test.ts tests/therapy-review-regressions.test.ts

 Test Files  3 passed (3)
      Tests  25 passed (25)
```

Three existing assertions constrained the edit and were deliberately preserved:
`therapy-compass-responsive-contract` pins the literal source line
`data-therapy-paper={paperTone === "therapy" ? "" : undefined}` and slices the first 1200 bytes
after `@page shared-clinical-output` (so every new rule was appended **after** the existing
provenance rule, never before it); `therapy-global-convergence-contract` asserts
`print-output.tsx` does not match `/pdf|persist|storage/i`, which the new footer wording and
comments respect; `therapy-review-regressions` slices the exact
`"  [data-print-provenance] {"` rule, so that rule and its selector were left untouched and the
new screen-side `display: none` went into a separate rule beside it.

---

## 3. How the print assertions could fail

This is the question the dispatch asked directly, because Vitest runs with `css: false` and a
CSS-module proxy echoes any key whether or not a rule exists — so "a class is present" proves
nothing.

The print assertions come in two halves, and each half can fail on its own:

1. **DOM half.** `[data-print-stamp]`, `[data-print-confidential]`, `data-print-monochrome`,
   `data-print-break-inside` are real attributes on real nodes, and the synthetic marker is
   asserted with `within(paper)` — scoped to the `[data-print-output]` subtree, not the page.
   Deleting the attribute, the node, or the marker turns these red. Mutations M30, M32, M33
   confirm it.
2. **Static-stylesheet half.** `tests/print-output-capabilities.dom.test.tsx` parses
   `globals.css`: it locates the shared print block between `@page shared-clinical-output` and
   the screen-side provenance rule, finds each `[data-print-*]` selector inside it, and reads
   that rule's declarations. Deleting `break-inside: avoid`, deleting `break-before: page`,
   removing the monochrome colour forcing, renaming the furniture selector so it no longer
   prints, or removing the screen-side `display: none` each turns these red. Mutations
   M10–M14 confirm all five. It also fails **closed**: `declarationsFor` asserts the selector
   was found before reading anything, so a renamed selector reports "no print rule mentions
   …" rather than silently matching nothing.
3. **The care-plan module half.** The existing static parser in
   `tests/care-plan-route-files.test.ts` was extended rather than duplicated: its
   `protectedSelector` now covers `fullPlanSection*`, `printPaper`, `printRecordWarning`,
   `printIdentity`, and `printCmht` alongside the first-minute and pinned-boundary selectors,
   and its fail-closed floor was raised from 4 matched blocks to 8. Adding
   `overflow: hidden` to the full-plan tier (M45) or `display: none` to the paper in the print
   block (M46) is rejected.

**What these assertions still cannot see**, stated plainly: no test here renders in a print
medium. Cascade order, specificity against Tailwind utilities, actual pagination, and whether
the monochrome rule wins where it needs to are all unproven offline. That is Task 9 (Chromium,
print preview, physical checks) and has not run.

---

## 4. RED → GREEN evidence

### RED — before any component existed

```
> node scripts/run-vitest.mjs run --reporter=dot tests/care-plan-linked-routes.dom.test.tsx tests/print-output-capabilities.dom.test.tsx

 Test Files  2 failed (2)
      Tests  32 failed | 94 passed (126)
```

The 32 failures were exactly the new tests, failing because the surfaces and the primitive
capabilities did not exist — e.g.
`Care Plan Management Plan reading > pins the safety boundary above all plan content`,
`Care Plan Management Plan print > carries the identifiers, the pinned boundary and exactly the five sections in order`,
`PrintOutput printed-at stamp > is print furniture: hidden on screen, shown on paper`
(`AssertionError: no print rule mentions [data-print-stamp]`), and
`BrowserPrintButton pre-print hook > runs the caller's hook before the browser is asked to print`
(`expected [ 'print' ] to deeply equal [ 'before', 'print' ]`).

Two RED failures were **my test's fault, not the code's**, and both were corrected while still
red rather than worked around:

- The default-markup pin was written against an assumed serialisation. The measured baseline is
  `data-print-output="true" class=""` (React serialises a bare boolean data attribute as
  `"true"`, and `cn(undefined)` yields `""`). The expectation was corrected to the **measured
  pre-change output**, so it still pins the real baseline.
- `PrintSection` was given `testId` rather than a bare `data-testid`, following the repo
  convention recorded in `brief-screen.tsx` that a bare `data-*` cannot be passed to a
  component. The test was updated to match.

One GREEN-phase failure was also a test defect: `/History|audit/i` on the printed paper matched
Mira's own clinical text "repeating the whole history to each new clinician". The assertion was
narrowed to "no link named History" plus `/audit|amendment|Review Trigger|presentation activity/i`,
with a comment saying why the bare word cannot be used.

### GREEN

```
> node scripts/run-vitest.mjs run --reporter=dot tests/care-plan-domain.test.ts tests/care-plan-prototype-state.test.ts tests/care-plan-route-files.test.ts tests/care-plan-linked-routes.dom.test.tsx tests/print-output-capabilities.dom.test.tsx tests/proxy.test.ts

 Test Files  6 passed (6)
      Tests  285 passed (285)
```

```
> npm run typecheck
[gate-receipts] recorded a pass for "typecheck:internal" (4428 input files).

> npm run lint
[gate-receipts] recorded a pass for "lint:internal" (4428 input files).
```

Both were re-run with `GATE_RECEIPTS=refresh` after the final edits, so neither is a reused
receipt.

```
> npx prettier --check src/components/care-plan src/components/ui/print-output.tsx src/app/globals.css tests/care-plan-linked-routes.dom.test.tsx tests/care-plan-prototype-state.test.ts tests/care-plan-route-files.test.ts tests/print-output-capabilities.dom.test.tsx
Checking formatting...
All matched files use Prettier code style!
```

---

## 5. Mutation testing — 46 mutations, 46 killed

A harness in the scratchpad applied one mutation at a time, ran the named test files with
`GATE_RECEIPTS=off`, and restored the original file buffer in a `finally`. `git status`
afterwards showed only the intended files changed.

```
46/46 killed
```

| #   | Mutation                                                   | Result |
| --- | ---------------------------------------------------------- | ------ |
| M01 | `PrintSection` ignores `breakInside="auto"`                | KILLED |
| M02 | `PrintSection` drops `breakBefore`                         | KILLED |
| M03 | `confidential` defaults on                                 | KILLED |
| M04 | `monochrome` defaults on                                   | KILLED |
| M05 | Stamp node rendered when `printedAt` is absent             | KILLED |
| M06 | `onBeforePrint` runs _after_ `window.print()`              | KILLED |
| M07 | `onBeforePrint` never runs                                 | KILLED |
| M08 | Confidential footer reworded (constant _and_ usage)        | KILLED |
| M09 | Primitive reads a clock (`new Date()`)                     | KILLED |
| M10 | `break-inside: avoid` rule deleted from `globals.css`      | KILLED |
| M11 | `break-before: page` rule deleted                          | KILLED |
| M12 | Monochrome rule keeps the tint                             | KILLED |
| M13 | Print furniture never printed (selector renamed)           | KILLED |
| M14 | Print furniture shown on screen (screen rule deleted)      | KILLED |
| M15 | Whole-page print isolation removed                         | KILLED |
| M16 | Full-plan tier loses `practicalNeeds`                      | KILLED |
| M17 | Empty section omitted instead of `Not recorded`            | KILLED |
| M18 | Pinned boundary removed from the reading surface           | KILLED |
| M19 | Review state hard-coded to `within_review`                 | KILLED |
| M20 | Withdrawn plan renders as `No Current Plan`                | KILLED |
| M21 | Superseded content dropped                                 | KILLED |
| M22 | Participation marker dropped from the awaiting block       | KILLED |
| M23 | An authoring (`/edit`) link appears on the reading surface | KILLED |
| M24 | Resolved Review Triggers counted as open                   | KILLED |
| M25 | Sharing with the patient never reported                    | KILLED |
| M26 | A Patient Plan is claimed that does not exist              | KILLED |
| M27 | Print link removed from the reading surface                | KILLED |
| M28 | Banned admission construction in plan copy                 | KILLED |
| M29 | Reference to an undefined stylesheet class                 | KILLED |
| M30 | Synthetic marker dropped from the paper                    | KILLED |
| M31 | Print control loses its `data-print-hide` wrapper          | KILLED |
| M32 | Confidential footer not requested by the route             | KILLED |
| M33 | Printed-at stamp not requested by the route                | KILLED |
| M34 | Stamp formatted from the wrong instant                     | KILLED |
| M35 | "Check the electronic record" warning dropped              | KILLED |
| M36 | A draft is printed alongside the plan in use               | KILLED |
| M37 | Launch actions printed onto the paper                      | KILLED |
| M38 | Print intent never dispatched                              | KILLED |
| M39 | A withdrawn plan is offered for printing                   | KILLED |
| M40 | The print surface steals mount-time focus                  | KILLED |
| M41 | Print intent allowed with no Current Plan                  | KILLED |
| M42 | Print intent bypasses the permission funnel                | KILLED |
| M43 | Print intent evidence claims paper reached a reader        | KILLED |
| M44 | The print route falls back to its Task 3 specimen          | KILLED |
| M45 | The full-plan tier is clipped in print                     | KILLED |
| M46 | The paper is hidden in print                               | KILLED |

Notes on the ones that mattered most:

- **M40** is the focus control. Task 4 established that a final-state focus assertion in this
  shell is provably unable to fail, because the shell's pathname-keyed effect commits last and
  repairs whatever a descendant did. This task adds **no** `focus()` call, and the print route's
  guard asserts the recorded `focusin` order is exactly `["H1"]`. M40 adds a mount-time focus
  steal to the print surface and the guard goes red — so the guard can fail, and it is watching
  events rather than final state.
- **M18** was written as "remove the pinned boundary", not "move it", because removal is what a
  careless refactor actually does. Three separate tests go red: the two ordering tests and the
  print-route test.
- **M08** reworded both the exported constant and every use of it, which a naive
  "does the footer say X?" test would have survived. It is killed by the separate assertion
  that the constant itself starts `Confidential clinical document.`.

---

## 6. CR and control-byte scan

Every touched file was scanned byte-by-byte for CR (0x0D) and stray control bytes:

```
src/app/globals.css                                          CR=0 ctrl=0
src/components/care-plan/mockups/care-plan.module.css        CR=0 ctrl=0
src/components/care-plan/mockups/prototype-state.ts          CR=0 ctrl=0
src/components/care-plan/mockups/routable-suite.tsx          CR=0 ctrl=0
src/components/care-plan/mockups/routes.ts                   CR=0 ctrl=0
src/components/care-plan/mockups/types.ts                    CR=0 ctrl=0
src/components/care-plan/mockups/management-plan-read.tsx    CR=0 ctrl=0
src/components/care-plan/mockups/management-plan-print.tsx   CR=0 ctrl=0
src/components/ui/print-output.tsx                           CR=0 ctrl=0
tests/care-plan-linked-routes.dom.test.tsx                   CR=0 ctrl=0
tests/care-plan-prototype-state.test.ts                      CR=0 ctrl=0
tests/care-plan-route-files.test.ts                          CR=0 ctrl=0
tests/print-output-capabilities.dom.test.tsx                 CR=0 ctrl=0
SCAN CLEAN: no CR bytes, no stray control bytes
```

Non-ASCII characters are present and were inspected: em dashes and curly apostrophes only, no
mojibake. All source was written with editor tools; no Python, `sed`, or shell heredoc touched
a source file. (The mutation harness is a Node script that writes a mutation and restores the
captured original buffer; the tree was verified clean afterwards.)

---

## 7. Files created and modified

**Created**

- `src/components/care-plan/mockups/management-plan-read.tsx`
- `src/components/care-plan/mockups/management-plan-print.tsx`
- `tests/print-output-capabilities.dom.test.tsx`

**Modified**

- `src/components/ui/print-output.tsx` — five additive, default-off capabilities
- `src/app/globals.css` — the print rules backing them, appended after the existing provenance
  rule, plus a screen-side `display: none` for the two furniture attributes
- `src/components/care-plan/mockups/care-plan.module.css` — full-plan and print classes, print
  and forced-colours entries for them
- `src/components/care-plan/mockups/routable-suite.tsx` — routes `managementPlan` and
  `managementPlanPrint` to the new surfaces
- `src/components/care-plan/mockups/types.ts` — `record-management-plan-print-intent`
- `src/components/care-plan/mockups/prototype-state.ts` — its reducer case and capability entry
- `src/components/care-plan/mockups/routes.ts` — `carePlanRoute.managementPlanPrint`
- `tests/care-plan-linked-routes.dom.test.tsx` — new reading and print suites; the two replaced
  routes removed from the route-purpose table and added to the "has real content" list
- `tests/care-plan-prototype-state.test.ts` — four reducer tests for the new action
- `tests/care-plan-route-files.test.ts` — static stylesheet guard extended

`.superpowers/sdd/…/task-5-report.md` (this file). `docs/care-plan/sdd-ledger.md` untouched.

---

## 8. What I found wrong in the brief

The brief's **first worked example is stale against committed Task 4 code**, in two ways. The
fixtures and Task 4 win, and the test was written to the code:

- It uses `screen.getByTestId("care-plan-safety-boundary-pinned")`. The committed identifier is
  `care-plan-pinned-safety-boundary`.
- It expects a level-3 heading named `How to approach Rowan Sample`. The committed heading is
  `1. How to approach this person` — the labels are per-concept, not per-patient, and they are
  numbered.
- Minor, but it would have failed anyway: `expect(pinned.compareDocumentPosition(firstSection))
.toBe(Node.DOCUMENT_POSITION_FOLLOWING)` uses `toBe` on a bitmask. Nodes in different
  subtrees also set `DOCUMENT_POSITION_CONTAINED_BY`, so the committed Task 4 tests use
  `& Node.DOCUMENT_POSITION_FOLLOWING` with `toBeTruthy()`, which is what this task used.

The brief's **second worked example checks out completely**. All three pinned fixture values
are correct: `SYN-PATIENT-004` is Evelyn Demo, her only version `SYN-MGMT-VERSION-005` is
`withdrawn`, `withdrawnAt` is 47 days before `PROTOTYPE_NOW` = **04/07/2026**, and `withdrawnBy`
is `SYN-USER-SENIOR-001` = **Dr Taylor Fiction**. Its final assertion
`queryByText(/^No Current Plan$/)` was written as the exact string `"No Current Plan"` instead,
because the withdrawn version's own content is also rendered on the page and an anchored regex
over a multi-node page is more fragile than it looks.

**The brief's file list is incomplete.** It names five files; the task cannot be delivered
without also touching `types.ts` and `prototype-state.ts` (pre-flight ruling 3 assigns
`record-management-plan-print-intent` to this task), `routes.ts` (a print-route builder, so no
literal identifier is written out), `tests/care-plan-prototype-state.test.ts` (the new action
needs reducer tests), `tests/care-plan-route-files.test.ts` (the static stylesheet guard had to
be extended rather than duplicated), and a new `tests/print-output-capabilities.dom.test.tsx`
(pre-flight ruling 6 requires a focused test per capability, and no such file existed).

---

## 9. Concerns

1. **No print medium was exercised.** Everything above is DOM plus static stylesheet analysis.
   Whether the paper actually paginates, whether the monochrome rule wins the cascade against
   Tailwind utilities, and whether the pinned boundary and section 5 survive a real print
   preview are unproven. This is Task 9 work and has not run.
2. **The monochrome rule is deliberately blunt.** `[data-print-monochrome] *` forces white
   ground, black ink, and black borders with `!important` on every descendant. That is correct
   for a clinical document on a greyscale printer, and it is opt-in — but a future consumer
   wanting one deliberate accent colour on paper will have to fight it. Flagging rather than
   pre-solving.
3. **`safetyPlanStatus` reads awkwardly on paper for a patient whose safety plan has no
   confirmation date**: "Current version 1, confirmed Not recorded". The string is Task 4's,
   already on the Clinical Snapshot, and I copied it verbatim rather than inventing a third
   wording. Worth a small follow-up; I did not change a Task 4 surface for it.
4. **"Copy" was avoided deliberately.** The glossary's `_Avoid_` for **Management Plan Version**
   names "Copy". A printed sheet is not a version, so the word is not strictly banned there —
   but the confusion is exactly the one the glossary guards, so the surface says "printed
   clinician summary" throughout. The route heading in `ROUTE_DEFINITIONS` still reads
   "Print-optimised clinician summary…", which is consistent; I left it alone.
5. **Offline blocks the print-intent audit record**, by choice. Widening
   `CONNECTIVITY_EXEMPT_ACTIONS` would have edited a reviewed rationale written specifically
   about the person's own Personal Safety Plan. The browser print still runs; only the record
   is refused, and the route shows the refusal. If the intent was that a clinician copy is
   equally a "systems are down" artefact, this is the line to revisit.
6. **The read page repeats `deriveReviewState`.** `buildPatientSnapshot` already derives the
   same value into `snapshot.reviewState`. The dispatch and the brief both say to call
   `deriveReviewState` at render, so the surface does — the two are the same function on the
   same inputs, but it is a second call site rather than a reuse.
7. **`FULL_PLAN_SECTION_KEYS` is local, not shared.** Task 6's authoring form will need the
   same list and the same labels. Whoever writes it should move the constant somewhere shared
   rather than transcribing it, for the same reason the first-minute five are generated from a
   constant.

---

# Fix round 1 — review response

Two Important findings (one defect) and five small ones. All addressed. Nothing asked for was
deferred.

## The ruling: the connectivity exemption is widened

`record-management-plan-print-intent` is now in `CONNECTIVITY_EXEMPT_ACTIONS`, and the
rationale comment above it was rewritten to explain that the exemption covers **both** print
intents and why — that "you most want it when systems are down" and "it appends an audit event
rather than changing a record" are properties of the action, not of which document it prints.

The reviewer's mechanism is worse than my original concern described, and it is the part worth
recording. `BrowserPrintButton` calls `onBeforePrint?.()` and then `window.print()`
**unconditionally**, ignoring anything the hook returns — so a reducer refusal could never stop
a print. In the `offline` specimen the net effect was: the dialogue opens, a clinical document
can leave the building, `auditEvents` stays empty, and the reader is told
`This device is offline, so nothing was changed.` The application's own account denied
something that had happened. That is underclaiming, which is the direction this prototype's
audit discipline exists to prevent, and it made two identical operations diverge — the Safety
Plan print intent _was_ recorded offline.

Connectivity remains the only block either intent skips. Identity uncertainty, unavailable
permission, and a version conflict all still apply to both, and the print route additionally
refuses to render at all under `identity-uncertain`.

Per the ruling, `print-output.tsx` was **not** given a veto contract. **Latent limitation,
recorded:** no caller can stop a print from a `BrowserPrintButton` today. With the exemption in
place there is no refusal path left on this route, so nothing depends on that veto — but a
future print route that must be refusable will need the primitive changed, and that is a
deliberate deferral rather than an oversight.

## Important #2 — the behaviour is now pinned either way

Three reducer tests in `tests/care-plan-prototype-state.test.ts`:

- **`still records the print intent when the device is offline`** — asserts the audit event is
  appended against the Current version, the outcome is `info`, and, in the same test, that the
  Safety Plan intent behaves identically offline. The divergence the suite could not see is now
  the thing it asserts.
- **`is still blocked offline by identity uncertainty, permission, and a version conflict`** —
  loops the three degraded states with connectivity also off, so widening the exemption past
  connectivity cannot pass unnoticed.
- The `refuses when there is no Current Plan to print` and `refuses an unknown synthetic
patient…` tests were already in place from the first round.

## The five small findings

**a. Duplicated status marks — fixed.** The version mark, review-state mark and
`ParticipationMarker` are now rendered **once**, on the shared summary card. The governance
block lost all three, was renamed `Review and sharing` to match what it actually carries, and
gained a comment saying why it deliberately carries no marks. Its assertions were rewritten,
and a new test counts across the whole page rather than asserting absence from one block:

```tsx
it("states each version and currency fact exactly once", () => {
  for (const fact of ["Current version 2", "Within review"]) {
    expect(screen.getAllByText(fact), `${fact} must be rendered once`).toHaveLength(1);
  }
});
```

Counting page-wide matters: an "is it absent from the governance block?" test would be
satisfied by moving the second copy somewhere else. A sibling test pins the participation
marker to exactly one occurrence, inside the awaiting-version block.

**b. Duplicated review-state tone mapping — removed, and the export turned out not to be
needed.** The inline ternary reimplementing `REVIEW_STATE_TONE` existed **only** to tone the
duplicated review-state mark that finding (a) deletes. With the mark gone the mapping has no
consumer, so the ternary was deleted rather than replaced by an import.

This is a deliberate deviation from the instruction to "export the constant and consume it":
after (a) there is nothing left to consume it, and exporting a constant with no consumer trades
a duplication smell for an unused-public-symbol one. The underlying risk — two hand-maintained
copies of a colour carrying a safety-relevant state — is gone either way, and it is gone by
deletion rather than by coupling. If a future surface needs the tone, exporting
`REVIEW_STATE_TONE` at that point is the right move.

**c. `FULL_PLAN_SECTION_KEYS` is now derived, and exhaustiveness is pinned.** The transcribed
array is replaced by:

```ts
type FullPlanContentKey = Exclude<
  keyof ManagementPlanContent,
  (typeof FIRST_MINUTE_CONTENT_KEYS)[number] | "whyThisPlanExists"
>;

const FULL_PLAN_SECTION_LABEL: Record<FullPlanContentKey, string> = { … };

export const FULL_PLAN_SECTION_KEYS = Object.keys(FULL_PLAN_SECTION_LABEL) as readonly FullPlanContentKey[];
```

Two guards at two levels. The `Exclude` makes the label record stop compiling the moment a
content field is added without a heading, and the keys are read back off that record rather
than written out a second time. A runtime test measures the rendered set against a **fixture
version's own content object**, so the comparison is against real data rather than another
hand-written list, and it also asserts the two tiers do not overlap.

**d. The clipping guard now covers the containing card.** `currentPlanCard` joined
`protectedSelector` in `tests/care-plan-route-files.test.ts`, with a comment explaining that it
is the card _containing_ the five sections — a print rule hiding it takes all five while every
per-section selector stays clean. The fail-closed floor rose from 8 matched blocks to 9.

**e. One outcome-tone map.** There were three hand-written copies —
`patient-workspace.tsx`, `management-plan-read.tsx`, and `management-plan-print.tsx`, with the
print route disagreeing (`error → warning` instead of `error → danger`). All three now consume
`PROTOTYPE_OUTCOME_TONE`, exported from `prototype-ui.tsx` with
`satisfies Record<PrototypeOutcome["kind"], SemanticChipTone>` so it cannot fall out of step
with the outcome union. Consolidating the Task 4 copy in `patient-workspace.tsx` was a
values-identical refactor; the Clinical Snapshot tests prove no rendering change.

Because nothing asserts a tone, a DOM test could not see this regress. A static test in
`tests/care-plan-route-files.test.ts` asserts all three consumers reference the shared map,
that none declares a local `*OUTCOME_TONE`, that none maps a tone inline from
`outcome.kind ===`, and that the shared constant keeps its `satisfies` clause.

## Recorded, not fixed

1. **The Personal Safety Plan `<Link>` renders onto the paper.** It reads as a cross-reference
   rather than navigation chrome, so it is defensible against "omits navigation", but a reader
   holding paper cannot follow it, and the print tests exclude only `navigation` roles and
   `Email|Call` links — so it is untested either way.
2. **Hex literals in the monochrome print rule** (`globals.css`). Fixed paper ink rather than a
   theme-following token is the point of the rule, and the neighbouring pre-existing rule
   already uses `#ffffff`, so it is consistent with the file. Recorded so the design-token
   reviewer can see it was deliberate.
3. **`safetyPlanStatus` reads "confirmed Not recorded" on paper** for a patient whose safety
   plan has no confirmation date. Task 4's string, not forked.

## Evidence

```
> npm run test -- tests/care-plan-domain.test.ts tests/care-plan-prototype-state.test.ts tests/care-plan-route-files.test.ts tests/care-plan-linked-routes.dom.test.tsx tests/print-output-capabilities.dom.test.tsx tests/proxy.test.ts

 Test Files  6 passed (6)
 Tests  291 passed (291)
```

The shared primitive was touched this round only through its consumers, but the Therapy Compass
regression was re-run regardless:

```
> npm run test -- tests/therapy-compass-responsive-contract.test.ts tests/therapy-global-convergence-contract.test.ts tests/therapy-review-regressions.test.ts

 Test Files  3 passed (3)
 Tests  25 passed (25)
```

```
typecheck: exit=0 | [gate-receipts] recorded a pass for "typecheck:internal" (4428 input files).
lint:      exit=0 | [gate-receipts] recorded a pass for "lint:internal" (4428 input files).
```

Both with `GATE_RECEIPTS=refresh`, so neither is a reused receipt. The care-plan count moved
285 → 291: three reducer tests, two single-rendering tests, one content-exhaustiveness test.
`tests/care-plan-route-files.test.ts` went 19 → 20 with the outcome-tone test.

**A lock-contention trap worth recording.** `npm run typecheck` returned **exit 75** with
`Database focused-test capacity is full (current owner … cc-2a-live … playwright …)` while
another worktree held a heavy lease. That is an acquisition failure, not a result, and my first
mutation harness would have scored it as a kill. Every run reported above, and every positive
control below, now retries until it actually acquires a lease.

## Positive controls — 15 mutations, 15 killed

| #   | Mutation                                               | Result | Failing test                                                                                          |
| --- | ------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------- |
| N01 | Exemption reverted to the Safety Plan alone            | KILLED | `still records the print intent when the device is offline`                                           |
| N02 | Exemption widened past connectivity to identity        | KILLED | `is still blocked offline by identity uncertainty…`, plus the pre-existing Task 2 degraded-state test |
| N03 | Exemption widened past connectivity to permission      | KILLED | same pair                                                                                             |
| N04 | Print intent recorded under the wrong audit type       | KILLED | `records only that a print view was opened…`                                                          |
| N05 | Version mark rendered a second time                    | KILLED | `states each version and currency fact exactly once`                                                  |
| N06 | Review-state mark rendered a second time               | KILLED | same                                                                                                  |
| N07 | Participation marker rendered a second time            | KILLED | `marks a version written without this person's involvement exactly once`                              |
| N08 | A full-plan key dropped from the rendered set          | KILLED | `renders every Management Plan content field across the two tiers`                                    |
| N09 | A first-minute key leaks into the full-plan tier       | KILLED | same                                                                                                  |
| N10 | Reading route declares its own tone map                | KILLED | `maps an outcome to a tone in exactly one place`                                                      |
| N11 | Print route declares its own tone map                  | KILLED | same                                                                                                  |
| N12 | Snapshot reverts to a local copy                       | KILLED | same                                                                                                  |
| N13 | Shared map loses its `satisfies` exhaustiveness clause | KILLED | same                                                                                                  |
| N14 | The card holding the five sections hidden in print     | KILLED | the stylesheet clipping guard                                                                         |
| N15 | The card holding the five sections clipped             | KILLED | the stylesheet clipping guard                                                                         |

Six of these (N01, N02, N03, N09, N10, N11) produced no `Tests` summary line on the first pass,
so **each was re-run individually** and confirmed to fail on a named assertion rather than on a
crash or a lease refusal. All six were genuine assertion failures; the table records the test
each one broke.

### The compile-time control for (c)

Adding a twelfth field to `ManagementPlanContent` and wiring it fully through the fixtures and
`EMPTY_MANAGEMENT_CONTENT` — so that only the _rendering_ side is left unfixed — leaves exactly
one production error:

```
src/components/care-plan/mockups/management-plan-read.tsx(74,7): error TS2741:
Property 'whatWeTriedBefore' is missing in type '{ whatThePersonWants: string; practicalNeeds: string; … }'
```

That is the label record refusing to compile, which is precisely the guard: a content field
cannot be added and silently render on no surface. The only other error is an unrelated test
fixture in `care-plan-prototype-state.test.ts`. Every mutated file was restored from a captured
buffer and `git status` verified afterwards.

## CR and control-byte scan

```
src/components/care-plan/mockups/prototype-state.ts        CR=0 ctrl=0
src/components/care-plan/mockups/prototype-ui.tsx          CR=0 ctrl=0
src/components/care-plan/mockups/patient-workspace.tsx     CR=0 ctrl=0
src/components/care-plan/mockups/management-plan-read.tsx  CR=0 ctrl=0
src/components/care-plan/mockups/management-plan-print.tsx CR=0 ctrl=0
tests/care-plan-linked-routes.dom.test.tsx                 CR=0 ctrl=0
tests/care-plan-prototype-state.test.ts                    CR=0 ctrl=0
tests/care-plan-route-files.test.ts                        CR=0 ctrl=0
SCAN CLEAN: no CR bytes, no stray control bytes
```

All source written with editor tools. Prettier reports every touched file formatted.
`docs/care-plan/sdd-ledger.md` untouched.
