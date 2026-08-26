# Task 15 report — the templates library

**Branch:** `claude/caring-contacts-demo-seed` · **Worktree:** `D:\Worktrees\Database\cc-templates`
**Status:** complete. Nothing pushed, no pull request opened, no subagent dispatched.

## Commits

Every SHA below was re-checked with `git cat-file -e <sha>^{commit}` after the last amend-free commit.

| SHA         | What it is                                                            |
| ----------- | --------------------------------------------------------------------- |
| `398745495` | the page, the library component, the nav link, both test files, docs  |
| `6e6893b06` | declares the route on the `caring-contacts-workspace` design surface  |
| `c9e8a0d9c` | pins both filtered empty states to one lifecycle filter (mutation M7) |
| `26f8a8e95` | static proxies for the forced-colors and 320px proofs                 |
| `f074a4a8d` | makes the forced-colors check examine a version row (mutation M17)    |

Full HEAD: `f074a4a8ddeed6ccd79eff06933ffc7903b40e94`.

## What was built

`/caring-contacts/templates` — a Server Component page and one Server Component library
(`src/components/caring-contacts/workspace/templates-library.tsx`). The screen adds no client
component of its own.

Each row is one governed pathway version and carries: the version identifier; a lifecycle chip
(Current / Pending / Retired, words plus an icon, never colour alone); the exact recorded state in
plain words beneath it; publication as a recorded fact; retirement as a recorded fact including what
the urgency means for plans already running; the cadence the snapshot holds; which of the three
message types the record holds wording for and which are unwritten; and the approvals with their
provenance qualification.

A URL filter (`?lifecycle=current|pending|retired`) narrows the list server-side. An unrecognised or
repeated value widens to "all" rather than throwing.

The Templates rail destination gained `href: CARING_CONTACTS_ROUTES.templates` in the same change
(Ruling 89), and each row of the shell's destination table now says in a comment which task built
its screen, so the table states that per row instead of a list elsewhere going stale.

## The governance claim

`ApprovalRecord` resolves the approvals **and** their qualification in one component. There is no
path through it that prints "Approved by …" without having asked `pathwayVersionProvenanceWording`
for its qualification — the two are not siblings a later edit could separate, which is how the
sign-up defect became possible. It takes `provenance` as `string | null | undefined` rather than as
the narrow union, deliberately: the Postgres store casts the stored snapshot with an unchecked `as`,
so the type at that call site is a claim about what should be there, and widening it means an
unrecognised value reaches the resolver's structural fallback instead of being assumed away.

The resolution happens in the component rather than on the page — a deliberate departure from
`plans/new/page.tsx`, which resolves on the page because the wizard beneath it is a Client
Component. This screen has no client boundary, so both domain modules stay on the server either way,
and resolving in the component is what makes the fail-safe directly testable: a test can hand it a
version carrying a provenance value no fixture produces and watch the weakening claim appear.

`PATHWAY_APPROVAL_ROLE_WORDING` is imported, never copied. No role identifier is rendered.

## Message wording — what the screen says, and one place the brief does not match the tree

The screen shows no message wording, and a fixture marker string proves it: `messageTextByType`
carries `MESSAGE-BODY-THAT-MUST-NEVER-RENDER` and the assertion requires it never to reach the
document.

**Finding.** The brief says "the message-content column is empty and no row exists anywhere". That
is true of the Postgres column. It is **not** true of the running demo: `demo-seed.ts`'s
`pathwaySnapshot` writes `EXACT_PATIENT_VISIBLE_MESSAGE` into `snapshot.messageTextByType.standard`
and leaves `first` and `closing` empty strings, with the seed's own note explaining that an empty
string is the truthful representation of "not yet written". So a seeded version's record does hold
wording for one message type.

A screen-level sentence saying "message content is not yet authored" would therefore have been false
against the seeded record. Each row instead states what its own record holds — "Wording is held for
the standard message. Nothing has been written for the first message and the closing message." —
derived from the snapshot, showing none of the text. Ruling [127]'s point is stated once at the top
of the section instead: no version holds wording of its own.

The held/unwritten test uses `typeof stored === "string" && stored.trim() !== ""` rather than
truthiness, and that is load-bearing rather than habit: the same unchecked cast means a key absent
from the stored object arrives as `undefined` with the type saying it cannot. Absent and empty both
fall to the unwritten side, which is the direction that cannot overstate what a record holds.

## Ruling [46] — no new `AccessedObjectType` member, and why that IS the ruling followed

The brief says to add a member rather than overload one. I reused the existing `pathwayVersion`, and
this is the decision most worth contesting if you disagree with it, so the reasoning is here in full.

The read is `{ kind: "view", objectType: "pathwayVersion", objectId: "all" }` — byte for byte the
identity `api/caring-contacts/pathway-versions/route.ts`'s `GET` records, and the one
`plans/new/page.tsx` already reuses. The brief's own instruction is that a page read uses the same
access identity the API side uses; those two instructions point the same way only if this read is
not a different kind of thing.

Ruling 46's named defect is a type carrying reads of **different objects**: `patientDirectory` held
two referral reads, so recording a patient-name read against it would have been visible by eye and
unaskable, because the trail's query surface filters on `objectType` with no `objectId` filter at
all. This read releases the same objects, at the same sensitivity, through the same repository
method as the wizard's read. A `pathwayVersionLibrary` member would name a **screen**, not an
object, and would split the answer to "who read this team's governed pathway versions, and when"
across two values that cannot be asked for together — which is the harm Ruling 46 exists to prevent,
arriving from the other direction.

Consequence: the `z.enum` in `access-trail/route.ts` needed no change, so Task 12's pin was not
exercised by this task.

## Four empty facts, and one that is not emptiness

`ListEmptyState` carries three of them: nothing exists; a filter is hiding records; the acting role
may not read a version at all (`listPathwayVersions` answers such an actor with `[]`, exactly as it
answers a team holding nothing, so the capability is decided on the page from the actor through
`PATHWAY_VERSION_READ_ACTIONS` itself — the same any-of list the store asks — and never inferred
from an empty list).

The fourth is a filtered-empty list where **every** held version is retired. It gets its own
`because` and, more importantly, its own `changedBy`: clearing the filter reveals the retired
records and still leaves nothing a plan can be started on, so "clear the filter" would be a
misdirection. A new version has to be written and approved by two people, and no control on this
screen does that.

The fact that is **not** an empty list at all is stated above a **full** one: when every held
version is retired, a `role="note"` says no version is available for a new plan. That is what those
rows add up to and no single row says it. `plans/new` offers only `approved` versions, so with every
version retired a coordinator would otherwise discover this only after walking into the sign-up.

## Verification

Every line below is pasted from the run, not summarised. Suite: `npm run test:cc-guards`, 22 files,
worktree `cc-templates`.

**Final state of the tree (re-run after the last edit, not merely last in order):**

```
WORKTREE-CLEAN
 Test Files  22 passed (22)
      Tests  457 passed (457)
```

**Typecheck** (`npx tsc --noEmit -p tsconfig.json`): `TSC-EXIT=0`.

**Uncached lint** (`node_modules/.cache/eslint` removed first, then `npx eslint <changed paths>`):
`ESLINT-EXIT=0`.

**Prettier** on every file this task changed: `All matched files use Prettier code style!`

### Sensitivity controls for the two gates that print nothing on success

A clean typecheck and a clean lint both print nothing, which reads exactly like a command that never
examined the file.

| Control | What was applied                                              | Result                                                                             |
| ------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| C1      | `const held: number = heldMessageTypes(...)` in the component | `TS2322: Type 'readonly MessageType[]' is not assignable to type 'number'`, EXIT=2 |
| C2a     | a bare `const … = "#ff0000"` in the component                 | `ESLINT-EXIT=0` — **my control was wrong, not the rule**                           |
| C2b     | `bg-[#ff0000]` on the filter-chip class                       | `local/no-hardcoded-hex` fired at 198:3, `ESLINT-EXIT=1`                           |

C2a is recorded rather than dropped: `no-hardcoded-hex` matches only Tailwind utilities of the shape
`bg-[#…]` / `text-[#…]` / `border-[#…]`, so a bare hex constant is outside its stated scope. The
rule behaved correctly; the control did not, and re-running it in the right shape is what proved the
lint run reaches this file.

### Mutation ledger

Itemised, no aggregate total. Every row records the tree it ran against by test count — 455 before
the two static-proxy assertions landed, 457 after — because a result that does not name itself
cannot be attributed. All mutations were applied and restored by a driver namespaced to this
worktree (`scratchpad/cc-templates/cc-templates-mutation-driver.mjs`), which asserts
`git diff --quiet` clean on both sides, checks mutation presence by reading the file in process
rather than through a shell, and runs the gate with `GATE_RECEIPTS=refresh`.

| #   | Mutation                                                               | Predicted                                              | Observed                                                                                                         |
| --- | ---------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| M1  | domain fallback → `null`                                               | testid absent; unrecognised + inherited-key cases red  | **RED as predicted.** 4 failed / 453 passed (457). `Unable to find an element by: [data-testid=…provenance]`     |
| M2  | domain fallback → `""` (the sign-up defect shape exactly)              | `expected '' not to be ''`                             | **RED as predicted.** 4 failed / 453 passed (457). The element renders and says nothing                          |
| M3  | render guard `note === null` → `note === undefined`                    | absent-provenance case red: queryByTestId not null     | **RED as predicted.** 1 failed / 454 passed (455). `expected <span …> to be null`                                |
| M4  | the qualification never rendered at all                                | component AND page seeded cases red                    | **RED as predicted.** 4 failed / 453 passed (457), including the page's seeded-record case                       |
| M5a | all-retired empty state's REASON → the ordinary one                    | `toContain('every version … has been retired')` fails  | **RED as predicted.** 1 failed / 454 passed (455)                                                                |
| M5b | all-retired empty state's REMEDY → the ordinary one                    | `toContain('It does not make one available…')` fails   | **RED as predicted.** 1 failed / 454 passed (455)                                                                |
| M6  | `if (everyHeldVersionRetired)` → `if (!everyHeldVersionRetired)`       | both content cases red; **pairwise stays GREEN**       | **As predicted, including the green.** 2 failed / 453 passed (455) — see the note below                          |
| M7  | all-retired empty state collapsed into the ordinary one, word for word | pairwise case red                                      | **GREEN on the first run — a mismatch, and a real defect in my test.** RED after the fixture fix (`c9e8a0d9c`)   |
| M8  | `held.every(...)` → `held.some(...)`                                   | the "does not claim every version is retired" case red | **RED**, plus one more than predicted: the ordinary-filtered case also flipped. 2 failed / 453 passed (455)      |
| M9  | held-wording check drops `.trim() !== ""`                              | all three message types read as held                   | **RED as predicted.** 1 failed / 454 passed (455)                                                                |
| M10 | held-wording check drops the `typeof` guard                            | a `TypeError` on the missing key                       | **RED as predicted.** `TypeError: Cannot read properties of undefined (reading 'trim')`                          |
| M11 | row prints `messageTextByType[type]` instead of the plain-words name   | the marker string reaches the document                 | **RED as predicted.** `expected … not to contain 'MESSAGE-BODY-THAT-MUST-NEVER-RENDER'`. 2 failed / 453 (455)    |
| M12 | page's access identity `pathwayVersion` → `report`                     | the two identity cases red                             | **RED**, three cases: the allowed-empty read, the identity case, and the failed-read attempt. 3 failed / 452     |
| M13 | capability computed as a constant rather than from the actor           | the auditor case red                                   | **RED as predicted.** The not-permitted group is absent. 1 failed / 454 passed (455)                             |
| M14 | `released == null` → `released === undefined`                          | a `TypeError`, not `/returned no list/`                | **RED, message mismatched** — `promise resolved instead of rejecting`. See the note below                        |
| M15 | the shell's `href` for Templates removed                               | shell cases red AND route-reachability red             | **RED as predicted.** 4 failed / 451 passed (455), including `Orphan page route(s) … /caring-contacts/templates` |
| M16 | a bare hex constant, as an over-sensitivity control                    | vitest stays GREEN                                     | **GREEN as predicted.** 22 files / 455 passed. Colour is not asserted by this suite                              |
| M17 | forced-colors fallback stripped from the version row                   | the forced-colors case red                             | **GREEN on the first run — a mismatch, and a real defect in my test.** RED after the fixture fix (`f074a4a8d`)   |
| M18 | `w-[400px]` added to the version row                                   | the fixed-width case red                               | **RED as predicted.** `LI carries a fixed width: expected 'w-[400px] …' not to match /\b(min-)?w-\[[0-9]/`       |

**Lock refusals, recorded as neither pass nor failure.** M1 was refused twice, M7 once, M10 once and
M2 once, each time by another worktree's exclusive lease (`Database focused-test capacity is full`,
owner in `browser-test-gate-handoff-d5c1db`). The driver detects the refusal and reports UNRUN with
its verdict line rather than counting it as a red. Every one was retried until it ran; **no row in
the ledger above is unrun.**

**M6 is the over-sensitivity control that matters.** It swapped the branch condition, so both
filtered empty states rendered the other's words — and the pairwise comparison stayed green while
both content assertions went red. That is the demonstration, on this screen's own code, of why
holding empty states only against each other is not coverage.

**M7 was a prediction mismatch, and the mismatch was the finding.** I predicted the pairwise
comparison would go red when the all-retired branch was overwritten with the ordinary one. It stayed
green. Every filtered empty state interpolates its own filter's label, and my two fixtures asked for
different filters (Pending and Current), so two branches now saying the same thing still rendered
different text. The pairwise check was appearing to carry weight it did not carry. Both fixtures now
ask for the same filter, so the label is no longer a source of difference; M7 then went red on
exactly the predicted message.

**M17 was the same shape and worse.** The forced-colors check rendered one library — a retired
version under a Pending filter, which is an empty list — so no row was in the document at all.
Stripping the fallback from the row left it green: the `bordered.length > 0` vacuity guard was
satisfied by the filter chips and the empty state, and the surface the mutation attacked was never
examined. A "there is something here" guard is not a guard that the right something is here. The
check now walks two scenarios, one required to contain a row.

**M14's message mismatched and the assertion still held.** I predicted a `TypeError` from
`versions.filter`; the page function instead **resolved**, returning an element carrying a `null`
prop that would throw during React's render rather than in the page function. The assertion — that
the page rejects — fired correctly. The guard is load-bearing; it fails _earlier and more legibly_
than the alternative rather than being the difference between failing and not.

**M8 produced one more red than predicted.** With `some` in place of `every`, a mixed library also
took the all-retired branch, so the ordinary-filtered case went red too. Foreseeable, and
under-predicted.

## Concerns and seams

### 1. Templates is unreachable on a phone. This is the one I would act on first.

The rail is `hidden` below 768px, `PHONE_DESTINATIONS` filters Templates out of the phone dock, and
the More panel lists only destinations that have no page. So below 768px there is now **no inbound
link to `/caring-contacts/templates` anywhere in the workspace.**

`tests/route-reachability.test.ts` passes, and correctly: it reads the shell's destination table,
which is a fact about what is linked, not about at what width. The exclusion was written when
Templates had no page and the phone bar carried three built destinations plus More.

I did not fix it. Either fix is a shell decision rather than a screen one — swapping what the phone
bar carries, or giving the More panel the ability to hold a real link — and `shell.tsx` is shared
with three live branches. Flagging it rather than choosing.

### 2. A gate the brief does not mention, which Task 16 will hit

`checkAdoptionManifest` is a **census**: a production page route that no design surface declares
fails `tests/design-system-adoption.test.ts`, which is inside `test:cc-guards`. Adding the page
turned that suite red with `production page route is undeclared`. The fix is three steps, all in
`6e6893b06`: add the route to the `caring-contacts-workspace` surface in
`docs/design-system/adoption-contract.json`, run `npm run design-system:adoption:update`, and update
the route-count assertion in `tests/design-system-adoption.test.ts`. Task 16 adds
`/caring-contacts/templates/[pathwayId]` and will need the same three steps.

### 3. The browser proof is owed, and I have not written it

`tests/ui-caring-contacts-workspace.spec.ts` gained `TEMPLATES_ROUTE` and a `WORKSPACE_SCREENS`
entry, because `tests/caring-contacts-workspace-screens.test.ts` requires every production workspace
route to appear there and goes red otherwise. **It has no proof block.** I did not write one: I
cannot run Playwright from this worktree, and an unrun browser block is worse than an absent one —
it would look like coverage. The spec's own constant says so in a comment, so the omission is stated
in the file rather than only here.

What it needs, if you want my reading: a `caring-contacts templates library` block that opens
`TEMPLATES_ROUTE` through `openWorkspace`, asserts the `h1` is `Templates`, and covers
forced-colors, 320px and the service-stop banner on this screen. On that server the screen renders
its empty state — `demoSeedRequested()` excludes the isolated Playwright server unless
`CARING_CONTACTS_DEMO_SEED=on` — which is a real production state, not a fixture. **Do not turn the
seed on for that server to get a populated screen**; the seed's own note explains that doing so
deletes the empty-caseload observations rather than adding one.

Offline, the two regressions that are mechanically visible in the markup are covered — a bordered
surface with no forced-colors fallback, and a fixed pixel width — and both are labelled in the test
file as static proxies. jsdom evaluates no media query and no forced-colors mode; they say nothing
about how the screen paints.

### 4. Seams left for Task 16

- `/caring-contacts/templates/[pathwayId]` — the detail route. `pathwayRoute(pathwayId)` already
  exists in `caring-contacts-routes.ts` and is unused; nothing on my screen links to it, because the
  destination does not exist yet (Ruling 89 in the direction it is usually forgotten). Adding that
  link belongs in the same change as that page. It will also need a
  `CARING_CONTACTS_DYNAMIC_ROUTE_BUILDERS` entry in `tests/route-reachability.test.ts`, which is
  mandatory rather than optional for a dynamic workspace family.
- The message-preview surface and the `message-preview` overlay — untouched.
- The `template-changed-retired` overlay — untouched. My all-retired notice is a plain `role="note"`
  above the list and deliberately does not open an overlay; if Task 16 wants that control there, the
  notice is the place to put it.
- Dual-approval controls — untouched. Nothing on this screen mutates anything; there is not one
  `<button>` in the library, only `<Link>`s.
- `TEMPLATE_LIFECYCLE_LABELS`, `TEMPLATE_LIFECYCLE_ORDER`, `templateLifecycleOf`,
  `parseTemplatesLibraryFilter` and `templatesLibraryHref` are exported for reuse by the detail
  screen, so the grouping is not re-derived there.

### 5. Files that will conflict, left for the controller as instructed

`src/components/caring-contacts/workspace/shell.tsx`, `package.json` (`test:cc-guards`),
`tests/caring-contacts-workspace-shell.dom.test.tsx`, `tests/ui-caring-contacts-workspace.spec.ts`,
`tests/design-system-adoption.test.ts`, `docs/codebase-index.md`, `docs/site-map.md`, and the three
generated `docs/design-system/` artefacts.

The shell test's expectations moved with the change: the rail's Templates entry is now a `link`, the
internal-href set gained `CARING_CONTACTS_ROUTES.templates`, and the exact unavailable-control count
went from 13 to 12. The floor assertion beneath it was left at 5 — it is written as a floor, the
exact count is asserted above it, and lowering a floor a change did not breach is loosening for its
own sake.

### 6. One thing I did not verify

I never ran the app. Everything here is offline evidence: unit and DOM tests, typecheck, lint, and
static reads of the markup. The screen has not been seen rendering in a browser by me.
