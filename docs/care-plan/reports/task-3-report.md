# Task 3 report — gated route family, literal navigation, responsive clinical shell

Branch `claude/ed-care-plans-impl-7f44cd`, worktree `D:\Worktrees\Database\care-plan-impl`,
base `d421bc2dc`. The worktree named in the plan's Global Constraints
(`D:\Repos\Database\.claude\worktrees\ed-care-plans-impl-7f44cd`) no longer exists and was
not used or recreated.

---

## What was built, and why it is shaped this way

**One route registry, one example identifier.** `src/components/care-plan/mockups/routes.ts`
is the only file in the family that contains a synthetic identifier inside a URL.
`CARE_PLAN_ROUTES` is the exact object the brief pins — the twenty-one reconstructable
addresses you can type into a browser — and `carePlanRoute.*` rebuilds the same shapes for
any other record. Every page file imports the finite parameter lists instead of repeating an
identifier, which a test now enforces (`must not repeat a synthetic identifier`).

**Finite parameters derived from the fixtures, never hand-copied.**
`SYNTHETIC_PATIENT_PARAMS` maps `syntheticPatients`, and `SYNTHETIC_PRESENTATION_PARAMS`
maps `syntheticEdPresentations` into `{ patientId, presentationId }` pairs. Two predicates
guard the dynamic pages: `isSyntheticPatientId`, and `isSyntheticPresentationForPatient`,
which is deliberately a _pair_ check — a real episode identifier under the wrong patient is
still an address that does not exist, and it must 404 rather than render someone else's
episode under this patient's heading. That distinction is pinned by its own assertion and by
mutation M18.

**Twenty-one page files, each a thin registration.** Static pages return
`<CarePlanRoutePage />`. Every dynamic page awaits `params: Promise<…>` (Next 16), validates
against the fixtures, calls `notFound()` on anything unknown, and declares
`generateStaticParams()` from the finite list. The episode page supplies both segments,
because no layout in the family declares parameters of its own.

**The shell.** `CarePlanShellFrame` is a desktop rail beside a scrolling column, and a phone
single column with a fixed four-item dock. The rail's primary navigation is exactly the five
the brief names — Home, Patients, Reviews, Team, Governance — and **System states sits in a
separate rail footer navigation** (`Care Plan prototype tools`) rather than inside that list.
That was a judgement call: the brief fixes the primary five, but a desktop user still has to
be able to reach the specimen route, and silently adding a sixth item to a list the brief
enumerates seemed worse than giving it its own labelled group. It is flagged below.

**Every destination is a real link.** No destination is a button that calls a router; every
`href` comes from `routes.ts`, so each is bookmarkable, reconstructable and middle-clickable.
`aria-current="page"` is set from the destination resolved out of the pathname, so a deep
route such as `…/presentations/SYN-PRESENTATION-001` still lights **Patients**.

**One search slot.** A single `role="search"` form with one `SearchField` and one submit
button. It navigates to the Patients route and **deliberately does not put the typed term in
the URL** — URLs in this prototype carry a named specimen state and nothing else. The typed
term stays in the field (the shell stays mounted across navigations), and Task 4 turns it
into real filtering. Mutation M26 proves a query-string leak goes red.

**The standing statement.** The header carries
`Synthetic prototype — fictional data only` and, beside it,
`Nothing is saved. Reloading this page starts over.` — the second sentence is about _state_,
not only about data, as the constraint requires.

**Read primacy, honestly.** The route content for Task 3 is a semantic `RoutePurposeSurface`
carrying the approved heading and purpose copy plus one plain sentence saying the reading and
authoring content arrives later. There are **no** unavailable controls, no `aria-disabled`
placeholders and no "coming soon" titles anywhere in the family; a test asserts both.

**The error boundary.** `CarePlanErrorBoundary` is a client class component using
`getDerivedStateFromError`, mounted **inside `DeveloperAreaGate` and wrapping
`CarePlanPrototypeProvider`**, exactly as directed. Its fallback renders the existing shared
`RouteErrorBoundary` panel — no duplicated markup — with a Care Plan title, description and
log label, supplying `error` from its own state and a `reset` that clears it. A segment
`error.tsx` was not added and would not have worked: `assertSingleCurrentVersion` throws from
inside the reducer, the reducer runs in the render phase of the provider, and the provider
lives in `layout.tsx`, which a segment's own `error.tsx` never covers.

**No connectivity listener.** None was added anywhere. `connectivity.online` remains a
specimen flag set from the System states route only, per the recorded ruling in
`prototype-provider.tsx`.

---

## RED → GREEN cycle

### RED 1 — the whole set fails before anything exists

`npm run test -- tests/care-plan-route-files.test.ts tests/care-plan-linked-routes.dom.test.tsx tests/proxy.test.ts`

```
 FAIL  |jsdom| tests/care-plan-linked-routes.dom.test.tsx [ tests/care-plan-linked-routes.dom.test.tsx ]
Error: Failed to resolve import "@/components/care-plan/mockups/routes" from "tests/care-plan-linked-routes.dom.test.tsx". Does the file exist?

 FAIL  |node| tests/proxy.test.ts > production mockup boundary > lets the Care Plan subtree reach its own developer gate, and keeps look-alike prefixes blocked
AssertionError: /mockups/care-plan: expected true to be false // Object.is equality

 FAIL  |node| tests/proxy.test.ts > developer-area header (x-developer-area) > sets the header only for the two developer-gated paths, and strips a client-supplied copy elsewhere
AssertionError: expected null to be '1' // Object.is equality

 Test Files  3 failed (3)
      Tests  2 failed | 13 passed (15)
```

The proxy assertions fail **directly**, as the brief requires.

### RED 2 — after `routes.ts` only, the file assertions fail directly

```
 FAIL  … > registers all twenty-one approved pages plus the shared layout, loading and route page
AssertionError: src/app/mockups/care-plan/page.tsx is missing: expected false to be true // Object.is equality
 FAIL  … > gates only the Care Plan prefix, leaving similarly prefixed paths outside the developer area
AssertionError: expected [ '/mockups/development', …(1) ] to include '/mockups/care-plan'
 FAIL  … > keeps the Care Plan shell independent from the shared mockup search chrome
AssertionError: expected '"use client";\n\nimport { usePathname…' to contain 'pathname === "/mockups/care-plan"'
 FAIL  … > links the Care Plan surface from the developer index
AssertionError: expected 'import type { Metadata } from "next";…' to contain 'CARE_PLAN_ROUTES'
 Test Files  1 failed (1)
      Tests  10 failed | 6 passed (16)
```

### RED 3 — route-surface stub returning `null`; landmark and navigation assertions fail

Per the brief, `CarePlanRouteSurface` was added first as a signature returning `null` (and
the error boundary as a pass-through), then rerun:

```
 FAIL  … > renders the desktop rail as real links built from the route registry
TestingLibraryElementError: Unable to find an accessible element with the role "navigation" and name "Care Plan sections"
 FAIL  … > renders the phone dock and reaches the remaining destinations through More
TestingLibraryElementError: Unable to find an accessible element with the role "navigation" and name "Care Plan phone navigation"
 FAIL  … > gives every route exactly one first-level heading
TestingLibraryElementError: Unable to find an accessible element with the role "heading"
```

### GREEN

The three brief-named suites:

```
 Test Files  3 passed (3)
      Tests  74 passed (74)
```

Final run after formatting, widened to the neighbouring suites this diff could disturb
(Task 1 and Task 2 domain/reducer, Caring Contact route files, developer-area access):

```
npm run test -- tests/care-plan-route-files.test.ts tests/care-plan-linked-routes.dom.test.tsx \
  tests/proxy.test.ts tests/care-plan-domain.test.ts tests/care-plan-prototype-state.test.ts \
  tests/caring-contact-route-files.test.ts tests/developer-area-access.test.ts

 Test Files  7 passed (7)
      Tests  202 passed (202)
```

`npm run typecheck`

```
> node ./node_modules/typescript/bin/tsc -p tsconfig.typecheck.json --noEmit …
[gate-receipts] recorded a pass for "typecheck:internal" (4419 input files).
```

(One real typecheck failure was fixed on the way: `TS2367` on an assertion that TypeScript
could prove tautological once `/mockups/care-plan` joined the gated-prefix union. It was
replaced with a structural assertion — every gated prefix is a single `/mockups/<one>`
segment — which still fails when the list is widened, proved by mutation M14.)

`npm run lint`

```
[gate-receipts] recorded a pass for "lint:internal" (4419 input files).
```

(One warning was fixed on the way: an unused `CARE_PLAN_ROUTES` import in the shell frame.)

---

## Mutation testing — every guard proved to reject

Each mutation was applied with editor tools, the affected suite run, and the mutation
reverted with its exact inverse. **Thirty-one mutations, thirty-one red suites, zero
survivors.** Every guard in the two new suites is covered, including all four the session
brief named specifically (`fetch(`, storage, provider imports, and the proxy boundary).

| #   | Mutation                                                                  | Suite went red on                                                                           |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| M1  | `fetch("/api/patients")` added to `routes.ts`                             | `routes.ts contains network fetch`                                                          |
| M2  | `localStorage.getItem(…)` seeds the More-sheet state                      | `care-plan-shell-frame.tsx contains browser storage`                                        |
| M3  | commented `from "@supabase/supabase-js"` import                           | `routable-suite.tsx contains provider or analytics import`                                  |
| M4  | focus deferred through `setTimeout`                                       | `contains timers`                                                                           |
| M5  | focus gated on `Math.random()` (timers removed)                           | `contains randomness`                                                                       |
| M6  | focus gated on `Date.now()` (randomness removed)                          | `contains wall-clock read`                                                                  |
| M7  | comment saying "the frequent flyer patients appear first"                 | `contains stigmatising language`                                                            |
| M8  | `/** Identification threshold = 4 presentations. */` + a numeric constant | `contains numeric identification threshold`                                                 |
| M9  | `route.ts` handler added under `care-plan/reviews/`                       | `registers no route handler …` — `expected [ …(1) ] to deeply equal []`                     |
| M10 | a twenty-second `page.tsx` added                                          | `registers no page beyond the twenty-one …` — `expected 22 to be 21`                        |
| M11 | layout nests the provider _outside_ the error boundary                    | `nests the developer gate outside the prototype provider …`                                 |
| M12 | unscoped `body { … }` selector inside `@media print`                      | `body is not scoped below .appRoot`                                                         |
| M13 | `/mockups/care-plan` removed from `DEVELOPER_GATED_PATH_PREFIXES`         | 3 failures across `care-plan-route-files` **and** `proxy.test.ts` (block + header)          |
| M14 | gate widened with a nested `/mockups/care-plan/patients` prefix           | `/mockups/care-plan/patients: expected true to be false`                                    |
| M15 | `!isCarePlanMockup` removed from the composer exclusion                   | `keeps the Care Plan shell independent …` — `expected 1 to be 2`                            |
| M16 | development-index deep links renamed away from the registry labels        | `links the Care Plan surface from the developer index`                                      |
| M17 | `loading.tsx` names a fixture patient                                     | `exposes a busy loading fallback that shows no fabricated record content`                   |
| M18 | `isSyntheticPresentationForPatient` ignores the patient half of the pair  | `recognises only known synthetic identifiers`                                               |
| M19 | `isSyntheticPatientId` accepts any `SYN-` prefix                          | `recognises only known synthetic identifiers`                                               |
| M20 | a dynamic page drops its `notFound()` guard                               | `must refuse an unknown parameter`                                                          |
| M21 | a dynamic page hard-codes `"SYN-PATIENT-000"`                             | `must not repeat a synthetic identifier`                                                    |
| M22 | `withQuery` always uses `?` as the separator                              | `carries only a named specimen scenario in a query string …`                                |
| M23 | registry URL drifts (`/management-plan/approve`)                          | `pins the exact approved URL for every route in the family`                                 |
| M24 | `aria-current="page"` on every rail link                                  | 8 destination failures                                                                      |
| M25 | `data-print-hide` removed from the phone dock                             | `keeps the phone dock out of a printed page`                                                |
| M26 | search submit appends `?q=<typed term>`                                   | `offers exactly one search slot and navigates it without putting record content in the URL` |
| M27 | `getDerivedStateFromError` returns `{ error: null }`                      | error escapes: `Error: Two versions are recorded as Current for SYN-MGMT-PLAN-001.`         |
| M28 | a second `<h1>` in the shell header                                       | `must have one <h1>: expected […] to have a length of 1 but got 2`                          |
| M29 | scenario parser accepts any URL value                                     | `reads the named specimen scenario from the URL and nothing else`                           |
| M30 | Safety Plan purpose copy replaced with an `_Avoid_`-term paraphrase       | `Unable to find an element with the text: Current patient-owned Personal Safety Plan`       |
| M31 | System states rail `href` hand-written instead of taken from the registry | `renders the desktop rail as real links built from the route registry`                      |

The proxy boundary is covered twice over: M13 turns both the production-block assertion and
the `x-developer-area` header assertion red, and M14 proves the "exact prefix, never widened"
assertion is not a tautology.

---

## Other gates run

| Command                                 | Result                                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `npm run sitemap:update`                | `Updated docs/site-map.md` — 21 new Care Plan route rows (`sitemap:check` would otherwise fail) |
| `npm run docs:check-index`              | `coverage OK: all 54 repository roots/modules/routes and all schema tables are indexed`         |
| `npm run check:knip`                    | no unused/unlisted/unresolved findings                                                          |
| `npm run check:type-scale`              | `✓ type-scale: no arbitrary text-[<n>px\|rem\|em] font sizes in src.`                           |
| `npm run check:icon-scale`              | `✓ icon-scale: no retired 4.5 (18px) half-step icon sizes in src.`                              |
| `npm run check:design-system-contract`  | `design-system adoption checked: 54 components, 88 roots` / `design-sync contract checked`      |
| `npm run check:maintainability-budgets` | `Maintainability hotspot budgets passed.`                                                       |
| `npm run check:cross-mode-index`        | current                                                                                         |

Not run, and why: `npm run verify:ui` / `verify:phone-chrome` (Playwright) — Task 3 ships a
shell specimen with no product behaviour to journey through, the DOM suite covers the
landmarks and navigation, and the browser gate belongs with the first real route in Task 4.
`verify:cheap` was not run as a blanket sweep; its constituent parts relevant to this diff
(lint, typecheck, unit, sitemap, docs, knip, design-token gates) were run individually and
are listed above. No provider-backed gate was run and none was needed.

---

## Design sweep

```
npm run workflow:design-sweep -- --files src/app/mockups/care-plan,src/components/care-plan/mockups,src/app/mockups/mockups-layout-client.tsx --write-evidence
```

Risk classes: `ui`. Approval-required commands: none. Evidence written to
`.local/workflow-evidence/2026-08-21T19-38-46-797Z-design-sweep.json` (git-ignored).

The sweep is a **planner**: it emits the recommended local/offline commands (`ensure`,
`test:e2e:critical`, `test:e2e:accessibility`, `verify:ui`, `verify:cheap`) and the proof
rules — cover 320/390/639/768/1440/1920 px, check overflow, scroll ownership, keyboard,
focus, reduced motion and forced colours — and runs none of them.

**Ordering deviation, flagged.** The brief asks for the sweep _before_ UI implementation. It
was run after. The sweep produces no findings and mutates nothing, so nothing about the
implementation would have differed; its checklist was nonetheless applied to the CSS module,
which implements the phone single column, the `max(0.75rem, var(--safe-area-top))` top
reserve, dock clearance in the main padding, `prefers-reduced-motion` and `forced-colors`
overrides, and print suppression via `data-print-hide`. The measured-viewport half of that
checklist remains browser work, deferred with the rest of the Playwright proof to Task 4.

---

## Local server

`npm run ensure` → `Clinical KB is running at http://localhost:3488`.
`GET http://localhost:3488/api/local-project-id` →
`{"appName":"Clinical KB","projectId":"clinical-kb:4573c0c0381a", …}` — this Database
project. No other project's server was touched.

Live route smoke over the printed URL:

```
200  /mockups/care-plan                                                          -> <h1 tabindex="-1" …>Home</h1>
200  /mockups/care-plan/patients/SYN-PATIENT-003/management-plan/review          -> <h1 tabindex="-1" …>Review submitted version</h1>
200  /mockups/care-plan/patients/SYN-PATIENT-005/presentations/SYN-PRESENTATION-018 -> <h1 tabindex="-1" …>ED Presentation</h1>
200  /mockups/care-plan/system-states?scenario=overdue-plan                      -> <h1 tabindex="-1" …>System states</h1>
```

Both unknown addresses take the `notFound()` path:

```
/mockups/care-plan/patients/NOT-SYNTHETIC
  → NEXT_HTTP_ERROR_FALLBACK;404 raised in CarePlanPatientPage
/mockups/care-plan/patients/SYN-PATIENT-001/presentations/SYN-PRESENTATION-009
  → no heading rendered (episode 009 belongs to SYN-PATIENT-002)
```

Calibration: the dev server reports HTTP **200** on those two because Turbopack dev switches
to client rendering when server rendering raises the not-found signal. The `notFound()` call
is verifiably reached (the digest is in the payload). The production status code was **not**
verified — that needs a production build, which was out of scope here.

---

## Byte scan

45 files (both new namespaces recursively, plus every modified file, `docs/site-map.md`, the
SDD ledger and this report) scanned for CR bytes and control bytes, after formatting:

```
scanned 45 files; CR bytes: 0 unless listed; offenders: 0
```

`npm run format` was run and its result committed; a whole-tree `prettier --check .` then
reported `All matched files use Prettier code style!` — the repository-wide check, not a
per-file one.

No source file in this task was written or patched through Python, `sed`, or a shell
heredoc; every write used the editor tools.

---

## Files

**Created (component namespace)**

- `src/components/care-plan/mockups/routes.ts`
- `src/components/care-plan/mockups/care-plan-shell-frame.tsx`
- `src/components/care-plan/mockups/care-plan.module.css`
- `src/components/care-plan/mockups/routable-suite.tsx`
- `src/components/care-plan/mockups/care-plan-error-boundary.tsx` _(not in the brief's file
  list; added under the session's explicit boundary decision)_
- `src/components/care-plan/mockups/index.ts`

**Created (route namespace)**

- `src/app/mockups/care-plan/layout.tsx`, `loading.tsx`, `route-page.tsx`
- the twenty-one `page.tsx` files exactly as listed in the brief

**Created (tests)**

- `tests/care-plan-route-files.test.ts`
- `tests/care-plan-linked-routes.dom.test.tsx`

**Modified**

- `src/lib/developer-area/headers.ts` — `/mockups/care-plan` added to
  `DEVELOPER_GATED_PATH_PREFIXES`, with a comment on why the match is exact-or-slash
- `src/proxy.ts` — explanatory comments only; no behaviour change
- `src/app/mockups/mockups-layout-client.tsx` — `isCarePlanMockup`, excluded from both the
  shared composer and shared chrome
- `src/app/mockups/development/page.tsx` — Care Plan surface with home link and the four deep
  links (Patients, Reviews, Governance, System states)
- `tests/proxy.test.ts` — Care Plan pass-through, look-alike prefixes blocked, header set
- `docs/site-map.md` — regenerated
- `docs/care-plan/sdd-ledger.md` — carried in the commit; see the note under Concerns

---

## Flagged decisions and ambiguities

1. **System states is not in the desktop primary rail.** The brief fixes the desktop rail as
   Home, Patients, Reviews, Team, Governance, and puts System states only in the phone More
   sheet — which would leave it unreachable from a desktop rail. It was given its own labelled
   rail-footer navigation (`Care Plan prototype tools`) rather than added as a sixth primary
   item. Smallest defensible reading; trivially reversible.

2. **Route headings were not supplied.** The session brief gives the twenty-one approved
   _purposes_ but no headings. Headings were written to be distinct, glossary-conformant and
   plain — for example `Draft Management Plan Version` rather than "Edit plan", since _Edit_ is
   an `_Avoid_` term for Presentation Amendment in `docs/care-plan-context.md`. All twenty-one
   are pinned by test, so a later correction is a one-line change with an immediate signal.

3. **The search slot deliberately loses the typed term on submit.** Putting it in the URL would
   break the no-record-content-in-query-strings rule; keeping it while filtering is Task 4's
   job. The field itself retains the text because the shell stays mounted.

4. **The brief's `page.tsx` list has no `route-page.tsx`, `layout.tsx` or `loading.tsx` entry in
   the twenty-one.** Read as three additional shared files (matching Caring Contacts), asserted
   separately, and the twenty-one count is asserted exactly.

5. **"An Care Plan surface"** in the brief (line 90) is a typo for "A Care Plan surface"; the
   requirement was read as intended.

6. **The CSS-selector guard's parser was strengthened mid-task.** Its first form took the text
   before the first `{` in each block, which silently skipped the first rule inside every
   `@media`. At-rule headers are now stripped first, so every rule in every block is checked —
   proved by mutation M12, which puts an unscoped `body` selector inside `@media print`.

7. **The sheet is portalled, so it cannot be styled by the module.** `Sheet` renders through
   `OverlayPortal` outside `.appRoot`, so the More list uses utilities at the call site. The
   module now says so, and the `.appRoot`-scoping guard stays absolute.

---

## Concerns

- **`docs/care-plan/sdd-ledger.md` arrived already modified** in this worktree (the Task 3
  start note and ruling 26, written by the coordinating session and never committed). It is
  included in this commit rather than left loose on disk, given this project's history of
  worktrees being destroyed mid-session. If the coordinator wanted it held back, it is one
  file to revert.
- **No browser proof.** Chromium/phone journeys were deliberately deferred to Task 4. The
  responsive, reduced-motion, forced-colours and print behaviour in `care-plan.module.css` is
  written but has **not** been observed at 320/390/639/768/1440/1920 px.
- **Production 404 status unverified** for unknown parameters (see Local server, above).
- **`docs/codebase-index.md` was not extended** with a Care Plan entry. `docs:check-index`
  passes without one, and the brief does not ask for it, but the repo's new-route checklist
  suggests one is wanted before this branch is handed off.
- **The shared test lease was heavily contended** throughout. Two distinct acquisition
  failures appeared — `Database focused-test capacity is full (current owner PID …)` and one
  `EPERM: operation not permitted, mkdir …\clinical-kb-heavy-locks\…\gate.lock`. Neither is a
  test result and neither was reported as one; every run quoted here carries a real
  `Test Files` summary line, and the retry helper was hardened mid-task to treat the `EPERM`
  form as an acquisition failure too.
- **This report is not in the commit.** `.superpowers/sdd/.gitignore` ignores everything under
  that directory, so the report (and the brief) live on disk only. Given this project's
  history of worktrees being destroyed, it is worth copying somewhere tracked if it needs to
  survive.

---

## Commit

`9d3a104daa39765183f101e5835a3cab2f1aac30` — `feat(care-plan): add gated clinical route shell`
— 39 files, working tree clean afterwards. Not pushed; nothing was fetched, merged, rebased
or deployed, no worktree was created or removed, and no provider-backed command was run.

---

# Fix round 1 — reviewer findings

Reviewer verdict was Spec ❌ / Needs fixes with four Important findings. The coordinator ruled
Important #1 in the implementation's favour (copy stands) but directed the scan behind it to be
widened. Findings #2, #3 and #4 are fixed. The listed Minors are recorded in
`docs/care-plan/sdd-ledger.md` under "Deferred minors → Task 3" and deliberately not fixed —
with one exception noted below that the coordinator brought into scope.

## Important #1 — ruled: copy stands, scan widened

No route-purpose string changed. `"Create or edit a draft version"` and
`"Print-optimised patient copy"` remain verbatim from the binding specification, per the
coordinator's ruling that the glossary's `_Avoid_` lists are concept-scoped rather than a
blanket lexical ban.

What did change is the banned-pattern scan in `tests/care-plan-route-files.test.ts`, which was
three phrases wide and is now built from three sources:

- **Stigmatising labels for a person** — `frequent flyer`, `high utilizer`/`high utiliser`,
  `problem patient`, plus `frequent-presenter`/`frequent presenter` and
  `frequent-attender`/`frequent attender`. These describe a person and no concept in the
  glossary makes any of them acceptable.
- **Quantified risk or severity verdicts** — `risk score`, `severity score`, `acuity score`.
- **Every phrase in `BANNED_ADMISSION_CONSTRUCTIONS`** (17 of them), imported from
  `domain.ts` rather than copied, each becoming its own labelled pattern with the phrase quoted
  in the failure message.

The concept-scoped `_Avoid_` terms (`Edit`, `Copy`, `Visit`, …) are deliberately **not** in the
list, and the test says so in a comment, so a later reader does not "complete" the list and
break the approved copy.

**One trap this created and how it is handled.** `BANNED_ADMISSION_CONSTRUCTIONS` is declared
inside the scanned namespace, so its own array literal matches all seventeen of its own
patterns. The scan strips exactly that one declaration from `domain.ts` before testing —
nothing else, no whole-file exemption — and fails closed with a named message if the
declaration is renamed or stops ending in `];`. Positive control PC4 proves the exclusion is
surgical: a banned phrase placed elsewhere in `domain.ts` is still caught.

## Important #2 — the synthetic marker now survives print (fixed)

`data-print-hide="true"` moved off the `<header>` and onto the search form inside it. The
marker and the "Nothing is saved" line now print; the chrome still does not. A print-scoped
rule strips the header's screen chrome (`border`, `background`, padding) so it reads as a
printed caption rather than an app bar, and the comment in the JSX states why the header is
deliberately not print-hidden.

New assertion, alongside the existing dock assertion, run over all three print routes plus Home:

```ts
const marker = screen.getByTestId("care-plan-synthetic-marker");
expect(marker).toHaveTextContent("Synthetic prototype — fictional data only");
expect(marker.closest("[data-print-hide='true']")).toBeNull();
const memoryNotice = screen.getByText("Nothing is saved. Reloading this page starts over.");
expect(memoryNotice.closest("[data-print-hide='true']")).toBeNull();
expect(screen.getByRole("search").closest("[data-print-hide='true']")).not.toBeNull();
```

The last line matters as much as the first: it stops the fix being "delete `data-print-hide`
from everything", which would print the search bar too.

## Important #3 — route change keyed on the address, and announced once (fixed)

`CarePlanShellFrame` now takes a `pathname` prop, and the focus effect depends on it rather
than on `title`. `CarePlanRouteSurface` passes it through. The reviewer's case is exactly
right: `/patients/SYN-PATIENT-001/management-plan` and `/patients/SYN-PATIENT-002/management-plan`
both resolve to the heading "Management Plan", so the old dependency array never changed and
the effect never re-ran.

**The hand-rolled `aria-live` region was removed** rather than fixed. The coordinator flagged
it as a Minor with an explicit exception if it collided with #3, and it does: with focus
correctly moving to the `<h1>` on every route change, a live region carrying the same heading
text makes every navigation announce twice. The focus move is now the single announcement,
which is the standard SPA route-change pattern and needs no second mechanism. Keying the live
region on the pathname instead would have been worse — it would have put synthetic record
identifiers into a screen-reader announcement.

Three new tests, none of which the old suite could have caught because every existing DOM test
renders exactly one pathname:

- **`moves focus again when only the patient changes and the heading text does not`** — renders
  patient 001's Management Plan, asserts focus, blurs, re-renders at patient 002's, and asserts
  focus returned. It also asserts `headingAfter` is the **same DOM node**, which settles the
  report's previously unverified claim that the shell persists across navigation.
- **`keeps the typed search term across a navigation because the shell persists`** — types into
  the search field, re-renders at a different pathname, asserts the value survived. This is the
  test the coordinator asked for: the search-slot rationale (term stays in the field, never in
  the URL) now rests on a test rather than on an assumption.
- **`announces a route change once, through the heading, not through a second live region`** —
  fails if any `aria-live` element repeats the heading text.

## Important #4 — the developer-index guard can now fail (fixed)

The old assertion ran `toContain` against the whole of `src/app/mockups/development/page.tsx`,
where "Patients" and "System states" already appear in the pre-existing Caring Contact block.
Deleting every Care Plan deep link would have left it green.

It is now scoped to the Care Plan surface object — the slice from `id: "care-plan"` to the next
`id: "` — and asserts the four `CARE_PLAN_ROUTES.*` **accessor names** as well as the labels,
so a label that happens to appear elsewhere cannot satisfy it. The slice itself is guarded
(`expect(surface).not.toContain('id: "caring-contacts"')`) so a future reordering cannot widen
it back to the whole file by accident.

## Positive controls — 8 applied, 8 red, 8 reverted

Every guard touched or widened in this round was proved to reject.

| #   | Mutation                                                                                                                      | Suite went red on                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PC1 | comment: "Ordered by frequent-presenter score, highest risk score first."                                                     | `routes.ts contains stigmatising label for a person`                                                                                                       |
| PC2 | comment: "Ordered by risk score, highest first." (stigmatising label removed, so the next rule has to catch it)               | `routes.ts contains quantified risk or severity verdict`                                                                                                   |
| PC3 | comment: "These patients should not be admitted."                                                                             | `routes.ts contains prohibitive admission construction ("should not be admitted")`                                                                         |
| PC4 | "This patient does not require admission." placed in `domain.ts` **outside** the `BANNED_ADMISSION_CONSTRUCTIONS` declaration | `domain.ts contains prohibitive admission construction ("does not require admission")` — proves the self-match exclusion is surgical, not a file exemption |
| PC5 | the Care Plan surface's `entries` array emptied in the developer index                                                        | `the Care Plan surface is missing the Patients deep link` — the assertion that previously could not fail                                                   |
| PC6 | `data-print-hide="true"` put back on the `<header>`                                                                           | 4 failures, one per print route plus Home: `expected <header …> to be null`                                                                                |
| PC7 | focus effect dependency reverted to `[title]`                                                                                 | `moves focus again when only the patient changes and the heading text does not`                                                                            |
| PC8 | the `aria-live` region restored                                                                                               | `announces a route change once … expected [ <p aria-live="polite" …> ] to deeply equal []`                                                                 |

PC2 is deliberately staged after PC1: with both phrases present the stigmatising-label rule
fires first and the risk-score rule is never reached, so it would have been an unproven rule
hiding behind a proven one.

## Verification after the fixes

```
npm run test -- tests/care-plan-route-files.test.ts tests/care-plan-linked-routes.dom.test.tsx \
  tests/proxy.test.ts tests/care-plan-domain.test.ts tests/care-plan-prototype-state.test.ts \
  tests/caring-contact-route-files.test.ts tests/developer-area-access.test.ts

 Test Files  7 passed (7)
      Tests  209 passed (209)
```

(202 before this round; the 7 new tests are the 4 print-marker cases and the 3 focus,
persistence and single-announcement cases.)

```
npm run typecheck   → [gate-receipts] recorded a pass for "typecheck:internal" (4419 input files).
npm run lint        → [gate-receipts] recorded a pass for "lint:internal" (4419 input files).
```

Both were run with `GATE_RECEIPTS=refresh`, so neither is a reused receipt.

Prettier: the touched files were formatted (all reported `unchanged`, i.e. they were already
compliant) and `--check` on the two remaining files reported
`All matched files use Prettier code style!`.

CR / control-byte scan over the ten touched files: `scanned 10 touched files; offenders: 0`.
Every edit in this round used the editor tools; no source file was written through Python,
`sed`, or a heredoc.

## Files changed in this round

- `src/components/care-plan/mockups/care-plan-shell-frame.tsx` — `pathname` prop; focus effect
  keyed on it; `aria-live` region removed; header no longer print-hidden; search form is;
  `data-testid` on the marker
- `src/components/care-plan/mockups/care-plan.module.css` — print rule stripping the header's
  screen chrome
- `src/components/care-plan/mockups/routable-suite.tsx` — passes `pathname` to the frame
- `tests/care-plan-linked-routes.dom.test.tsx` — 7 new tests
- `tests/care-plan-route-files.test.ts` — widened language scan, `domain.ts` declaration
  exclusion, scoped developer-index guard
- `docs/care-plan/sdd-ledger.md` — the reviewer's Minors recorded under Task 3

`src/components/care-plan/mockups/domain.ts` and `src/app/mockups/development/page.tsx` were
touched only by positive controls and are byte-identical to the previous commit.

## Concerns after this round

- **`frequent presenter` is now banned outright in this namespace**, including as a quotation of
  policy language. That is the intended reading of the coordinator's instruction, but if a later
  task needs to quote an identification policy that uses the phrase, this guard will block it and
  should be narrowed deliberately rather than deleted.
- **The print fix is asserted structurally, not visually.** The test proves the marker is not
  inside a `data-print-hide` subtree; it does not prove the printed page looks right. Print
  rendering still belongs to the browser proof deferred to Task 4.
- **Removing the live region is a judgement call.** Focus-to-heading is the standard pattern and
  is now tested, but it is a behaviour change from what the reviewer saw; if the branch review
  wants a live region back it must be keyed on something that changes per route without carrying
  record content.
- Everything from the first round's concerns still stands: no browser proof, production 404
  status unverified, no `docs/codebase-index.md` entry.
