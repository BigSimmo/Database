# Task 11 — Browser journeys, responsive and accessibility proof, documentation, handoff

Branch `claude/care-plan-stage-b-9-11`, worktree `D:\Worktrees\Database\care-plan-impl`.
Base at dispatch `157c48f33`.

Nothing in this build had ever rendered in a browser or on paper. Ten tasks and ~495
committed tests ran under Vitest with `css: false` in jsdom, plus static parsing of the
stylesheet as text — a combination that can see structure and nothing else. Task 11 is the
first Chromium evidence, and it runs against a **production build**, because
`scripts/run-playwright.mjs` builds and starts its own isolated server rather than using the
dev server.

The first run found three wiring defects. None was a rendering problem, and none would ever
have been found by looking harder at the tests.

---

## The defects the browser found

### 1. The Patient Plan was unreachable

Nothing outside its own three pages linked to it. Task 9 built an entire specification
feature — a deterministic offline patient-voice transform, its visible gaps, its own
approval, its printed copy — and the only way a clinician could open it was to type the
address.

The Management Plan's `Review and sharing` section already named the person's copy in prose
(`Current Patient Plan version 1.` / `No current Patient Plan has been written from this
version.`). That sentence now carries a link.

### 2 and 3. Two reading surfaces were dead ends

The Personal Safety Plan and Patient Plan reading surfaces both dropped
`PatientNavigation`, so a clinician who followed the patient navigation's own
`Personal Safety Plan` entry arrived somewhere with no way back into the record but the
browser's Back button. On a phone the dock offers Home, Patients, Reviews and More — so
getting back to the Management Plan meant finding the person again.

**The fingerprint had been sitting in the type system since Task 3.** `PatientSectionKey`
has a `safetyPlan` member and **nothing ever passed it**, because the one route that would
have was the one not rendering the navigation. The Safety Plan surface now passes
`activeSection="safetyPlan"`; the Patient Plan surface passes `activeSection={null}`, which
is the documented value for a surface that is not itself one of the five sections.

### How they were fixed

Five DOM regression tests first, in `tests/care-plan-linked-routes.dom.test.tsx`. All five
failed for exactly the expected reasons —
`Unable to find an accessible element with the role "navigation" and name "Patient sections"`
four times, and `Unable to find an accessible element with the role "link" and name "Open
the Patient Plan"` once. After three small production edits the file went from 264 to
**269 passed (269)**, with nothing previously passing broken.

Rulings 59–62 in the ledger record why these three were fixed rather than only reported,
given that Task 11's brief scopes it to acceptance evidence rather than product behaviour:
a route nothing links to is not a rendering opinion, and none of the three adds behaviour.

---

## Ruling 57's replacement

Ruling 57 froze the static link-affordance guard as a tripwire after it was beaten four
times across five rounds by nine spellings of "paints nothing", and named Task 11 as the
owner of the replacement.

`expectLooksLikeALink` reads **computed style in a real browser**. That is the value the
pixel is painted from: `transparent`, `rgb(0 0 0 / 0.0%)`, a `var()` fallback, one level of
custom-property indirection, `all: unset`, `:is(.x)` and `color: inherit` have all collapsed
into a single resolved value before it looks. It cannot be beaten by a tenth spelling
because it never reads a spelling.

For each of the six named affordances it asserts the ink is painted at all, that it differs
from the element's own background, and that the affordance the class is contracted to carry
is actually drawn — a real underline in opaque ink of non-zero thickness, or a border of
non-zero width in opaque ink that differs from the surface behind it. The reference for
"different from the prose around it" is a throwaway span inserted at the control's own
position in the tree, so it measures the colour this text would have had as ordinary body
copy rather than a hard-coded token.

**Four probes, all killed it.** Each was a real stylesheet mutation, built and run through
the wrapper, then reverted:

| Probe | Mutation                                               | Message                                                                                      |
| ----- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| 1     | shared link rule `text-decoration: underline` → `none` | `` `pinnedBoundaryLink` carries no underline ``                                              |
| 2     | `.specimenLink` colour → `rgb(0 0 0 / 0.0%)`           | `` `specimenLink` paints its text in ink that is effectively invisible (rgba(0, 0, 0, 0)) `` |
| 3     | shared link rule colour → `inherit`                    | `` `pinnedBoundaryLink` is exactly the colour of the text around it (rgb(27, 37, 51)) ``     |
| 4     | `.patientNavItem` border → `1px solid rgb(0 0 0 / 0%)` | `` `patientNavSecondary` draws no visible border on any side ``                              |

Probes 2 and 3 are spellings the frozen tripwire could not see: the decimal-and-percent
alpha that beat it in round 5, and `color: inherit`, which the ledger parks explicitly as an
open residual. Both were resolved without the guard reading a spelling at all.

**One probe corrected the guard rather than confirming it, which is the more useful
outcome.** The first shape required _every_ named affordance to differ in colour from
surrounding prose. Probe 3 was originally aimed at `patientNavSecondary` and went red — for
a change that costs a reader nothing, because a bordered pill with a 48 px box is visible
whatever colour its text is. A guard that reddens for a harmless change is how a guard gets
relaxed later for a harmful one, so the contract is now per class: accent text links must
differ in colour and carry an underline; pill controls must carry a border in ink that
differs from the surface behind them; all six must paint. Probe 3 was re-aimed at
`inlineLink`'s own rule, where the requirement is real, and killed it.

---

## What the first run actually exposed: my own suite

Run 1 was `9 failed / 20 passed (19.7m)`. **Every one of the nine was a fault in the new
test file, not in the product.** Two are worth carrying forward.

**A guard that could not fail, discovered by running it.** `moduleClassSelector` matched a
class token ending `__<name>`, which is the `next dev` CSS-module shape. A production build
emits `care-plan_<name>__<hash>`, so the link-affordance gate found nothing at all in the
only build it actually measures. It now matches the name on `_`/`-` boundaries, which also
keeps `queueActions` (a wrapper) from ever answering for `queueAction` (a control).

**Rendered is not interactive, and this suite is the first thing able to tell.** Role
switches landed before hydration: `selectOption` set the native `<select>` value, React
never saw the event, and the next reconcile silently restored the previous clinician. In a
failure report that is indistinguishable from "the role switcher is broken". Every control
here is server-rendered, so `gotoRoute` now waits for a React root before touching anything,
and `switchRole` retries until the identity block agrees. It is also a genuine, if minor,
observation about the product: on a slow device there is a window after paint in which
clicks do nothing.

Runs 3 and 4 are `29 passed`, 1 skipped.

---

## Reading the surfaces as their recipient

The full account is in `verification-report.md`. The headline:

**Both patient-facing prints carry the shared `PrintOutput` confidential footer** —
`Confidential clinical document. Handle it, keep it, and dispose of it according to local
health service policy.` On a clinician's handover copy that is exactly right. On a person's
own safety plan it comes after the sheet has told them `Keep it somewhere you can find it
quickly`, and it re-frames their own document as an institutional artefact they must dispose
of under somebody else's policy. (Corrected in fix round 1: it is **not** the last thing
they read — `print-output.tsx:124` renders the provenance `<footer>` after it.)

It is also a quiet specification deviation. The specification enumerates what the clinician
print carries and names a confidential-document footer among them; the Personal Safety Plan
print and the Patient Plan print each have their own enumerated list and **neither names
it**.

**Reported, not changed** (Ruling 60). It is a product-copy decision, the user is the one to
make it, and this project has twice lost a line from a printed page by editing print output
in passing. Recommendation: drop `confidential` from the two patient-facing prints and keep
it on the clinician print.

(Blast radius corrected in fix round 1. This does **not** touch the shared primitive:
`CONFIDENTIAL_DOCUMENT_FOOTER`, `PrintOutput` and the clinician print are all untouched and
no other consumer moves. It is two deletions inside Care Plan — the `confidential` prop at
`safety-plan-pages.tsx:540` and at `patient-plan-pages.tsx:585`.)

Otherwise the patient-facing surfaces read well and read as the person's own. The Personal
Safety Plan opens `This is your plan, in your own words`, holds the person's own sentences
in the first person, has nothing empty, and puts `If you need help now` last. The Patient
Plan carries only a preferred name, record number, version and `Agreed on` date — no date of
birth, no home service, no version history — and **omits unfilled sections from the paper
entirely** rather than printing a heading with nothing under it, which is the direct answer
to this project's worst defect.

---

## What was built

| File                                                                               | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tests/ui-care-plan-mockup.spec.ts`                                                | New. 30 cases: 21-route reconstruction, the pinned boundary at five widths and in dark/forced-colours/print, the six link affordances, three print surfaces, the whole authoring lifecycle, the Patient Plan end to end including staleness, the Safety Plan end to end, Review Trigger resolution, contact verification, ED Presentation recording, amendment, CMHT privacy, Identification Review, the 320 px queue strip, audit chronology, eleven degraded specimens, reflow at five widths and at 200 % zoom, reduced motion, keyboard traversal with focus rings, forced colours, dark mode, and the optional evidence capture |
| `tests/playwright-project-isolation.test.ts`                                       | The registration assertion, RED before the project existed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `playwright.config.ts`, `package.json`                                             | `ui-care-plan-mockup` in both matchers and the `test:e2e:care-plan-mockup` script, verbatim from the brief                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `tests/care-plan-linked-routes.dom.test.tsx`                                       | Five navigation regression tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `tests/care-plan-domain.test.ts`                                                   | The cross-product `mailto:` privacy assertion extended from identity to plan, episode and safety-plan content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `src/components/care-plan/mockups/management-plan-read.tsx`                        | The Patient Plan's one inbound link                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `src/components/care-plan/mockups/safety-plan-pages.tsx`, `patient-plan-pages.tsx` | Patient navigation restored on both reading surfaces                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `docs/care-plan/*.md`                                                              | The five handoff documents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `docs/codebase-index.md`                                                           | The Care Plan section, and `/mockups/care-plan/**` on the developer-gate row                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

The brief's five helper names are all present and used: `gotoRoute`,
`expectNoHorizontalOverflow`, `expectSyntheticBoundary`, `expectPhoneDockClearance`,
`expectSinglePageHeading`.

---

## Verification

| Check                                      | Result                                                                                                                                 |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:e2e:care-plan-mockup`        | `29 passed (1.6m)`, 1 skipped, `EXIT=0`                                                                                                |
| Focused Vitest, 7 files                    | `Test Files 7 passed (7)` / `Tests 517 passed (517)`                                                                                   |
| `npm run typecheck`                        | Fresh, exit 0, zero diagnostics                                                                                                        |
| `npm run lint`                             | Fresh, exit 0, `--max-warnings 0` — **the first lint on this branch since the `origin/main` merge**, which the ledger recorded as owed |
| `npx prettier --check` on 16 changed files | 7 markdown files failed, formatted, re-checked clean                                                                                   |
| Privacy and source scans                   | All five run verbatim; scans 1 and 2 have no matches, the other three classified by hand with no overclaim                             |

Everything the user held back is listed as **not run, by user instruction** in
`verification-report.md`: `verify:pr-local`, `verify:cheap`, `verify:release`, `build`,
`check:production-readiness`, `docs:update`, whole-tree `format`, every `eval:*`,
`check:supabase-project`, and anything touching live Supabase, OpenAI or hosted CI. Nothing
was pushed, no pull request was opened, nothing was merged.

**One thing is owed rather than done.** The optional evidence capture
(`CARE_PLAN_CAPTURE_EVIDENCE=1`) was attempted three times and produced no screenshot. The
first two never reached their build — no output at all for more than five minutes each,
which is the run coordinator holding the exclusive heavy lease for another session on this
machine. The third compiled in 69 seconds and then sat in `Running TypeScript ...` for over
thirty minutes, a step that took 68 and 77 seconds in the four earlier browser runs; it was
stopped rather than left holding the exclusive lease. None of that is a red result — it is
"blocked, retry" three times over. But the capture path has never executed, so its own
assertions are untested, and the Patient Plan paper was read from source rather than from a
captured sheet.

---

## Concerns

1. **The confidential footer on the two patient-facing prints.** Above. The user's call.
2. **The capture has never run.** Untested code, and the weaker basis for one recipient read.
3. **This is Chromium only.** Physical iPhone Safari, the installed PWA, real screen
   readers, real printers and WCAG contrast ratios are all untested and are listed as open
   acceptance gaps in `accessibility-acceptance.md`. Nothing here should be described as
   accessibility acceptance.
4. **Comprehension-time criteria cannot be machine-verified.** "Within 10 seconds",
   "within 30 seconds" and "within two minutes" are recorded against the number of actions
   a journey takes, which is a proxy.
5. **A concurrent session committed to this branch mid-task** (`945d14fbb`, `9df392e17`,
   recording the user's decisions D1 and D2). Nothing was lost — verified by diffing the
   ledger across the boundary — but this worktree is not exclusively held, and the ledger's
   own environment-hazard section should be read before anyone assumes otherwise.
6. **Test output is not pristine**, and one claim in the record needed correcting: Ruling
   50 says the shared `Select` warning appears on every Care Plan run, and it did not appear
   in this one. The underlying defect is unchanged and still belongs in `/issues`.
7. **The pinned safety boundary's wording order reads awkwardly** — `Then read the full
section.` arrives before the link naming the section. Cosmetic, recorded, not changed.

---

# Task 11 — fix round 1

The task review returned **spec ✅ / changes needed**: all three navigation fixes approved,
Ruling 57's replacement approved as a genuine computed-style assertion — and then killed with
a tenth spelling none of my four probes covered,
`text-decoration-color: color-mix(in srgb, black 0%, transparent)`, which died on the
fail-closed unparseable branch. That is the right direction and it is how the reviewer found
Important 2 below.

## Critical — a test named for work it does not do

Two cases claimed work they did not perform, and the report listed one of them as delivered.

- `a Review Trigger is resolved without the plan changing by itself` opened the resolution
  sheet and pressed `Escape`. Nothing was resolved.
- `the Reviews worklists open, resolve, and stay operable on a 320px phone` switched tabs.
  Nothing was resolved there either.

Both are now correct. The first genuinely resolves: it reads the Current Plan metadata first,
opens the sheet, **submits it blank and asserts the refusal** — the positive control, without
which a resolution that silently did nothing would look identical to one that worked — then
writes a resolution, asserts `Review Trigger resolved. No plan was changed.`, asserts the
entry has left the queue, and finally asserts the plan is character-for-character what it was.
The second is renamed to `the four Reviews worklists switch and stay operable on a 320px
phone`.

The brief's per-width list was also a third implemented — only overflow and rail/dock
ownership. Heading and action wrapping, Current Plan readability, CMHT and Safety access, the
48 px floor on primary targets and dock clearance now all run at each of the five widths, in
`the plan stays readable and every primary action stays reachable at each width`. Both gaps
are now in the verification report's gap section, which did not mention either.

## The sweep — what re-reading all thirty names against their bodies found

**Three more of the same shape**, all fixed:

| Case                                                                                              | Claimed                                 | Did                                        | Now                                                                                                                                            |
| ------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `a manual Identification Review is recorded without creating a plan`                              | a referral is recorded                  | opened the sheet, pressed `Escape`         | refuses a reasonless referral, records a real one, asserts no plan appeared, follows it into the worklist                                      |
| `the whole authoring lifecycle runs in the browser without losing the Current Plan`               | draft, submit, compare, return, approve | returned for changes only                  | renamed `a submitted version is returned for changes without the Current Plan moving`; the drafting/submission gap is recorded, not named over |
| `a Personal Safety Plan is written, made current, and printed without touching the clinical plan` | the trailing clause                     | asserted nothing about the Management Plan | reads the Current Plan before, walks the interface, asserts it identical after                                                                 |

The remaining twenty-six do what they say. Two are accurate but narrower than they sound and
now say so in a comment: the dark-mode/forced-colours boundary case checks one route rather
than twenty-one, and the keyboard case walks forty tab stops on one surface.

## Important 1 — tap-target guards that could not catch their own regression

Both asserted `>= 44` while their messages said "below the 48px tap convention", so
`min-h-12 → min-h-11` — the exact edit this repository bans, because 44 px reintroduces a
known `ui-smoke` flake — passed them. Both now use a shared `TAP_TARGET_FLOOR = 47.5`
(47.5 rather than 48 because a fractional viewport can round a 48 px box to 47.98; a
`min-h-11` regression measures 44, nowhere near it).

## Important 2 — a guard that silently stopped checking

`parseColour` returns `null` for Chromium's `color(srgb …)` and `color-mix(…)` serialisations.
Text and decoration ink failed closed on `null`; **background did not**. Four checks were
disabled by an unreadable background with nothing going red: the own-background comparison and
the border-versus-surface comparison in `expectLooksLikeALink`, the print monochrome background
check, and the dark-mode luminance check. All four are now explicit non-null assertions. Only a
genuinely transparent background is still exempt from the monochrome check, because that is "no
tint" — the thing being asked for.

## Important 3 — the Patient Plan paper had no monochrome or page-break proof

The two checks lived inline in the clinician and Safety Plan journeys only, while the
accessibility document opened "Three print surfaces…" and stated both as unqualified bullets.
They are now one shared helper each, run against all three papers, so a fourth print surface
cannot be added with only some of them. The bullets say so.

## Important 4 — the defect I had just fixed, one branch along

`management-plan-read.tsx` put the Patient Plan link inside the `currentManagementVersion !==
null` arm only, so a **withdrawn** record lost it again — and that is the branch it matters most
in, because the specification keeps a Patient Plan readable precisely so somebody holding a
printed copy of a withdrawn plan can still be told what they were given. The row is now one
helper called from both branches. Regression test RED first:
`Unable to find an accessible element with the role "link" and name "Open the Patient Plan"`,
then `Tests 269 passed (269)` → `Tests 270 passed (270)`.

## Minor — three evidence corrections

- The confidential footer is **not** "the last thing the reader sees": `print-output.tsx:124`
  renders the provenance `<footer>` after it. Corrected in the verification report, this report
  and Ruling 60.
- The blast radius was overstated. It does **not** touch the shared primitive — it is two
  deletions inside Care Plan, at `safety-plan-pages.tsx:540` and `patient-plan-pages.tsx:585`.
  Corrected everywhere, so the user decides against the real cost. **Not changed**, per
  instruction.
- `accessibility-acceptance.md` stated the colour-difference assertion unconditionally while its
  own table and the code exempt `patientNavSecondary`. The list is now explicit about which
  clause applies to which class, and the table carries a `Colour differs from prose` column.
- `interaction-matrix.md` now records that the Patient Plan link renders on the Current **and**
  withdrawn branches and not on a record that never had a plan.

## Not fixed, by instruction

The affordance table is a hand-maintained list of six classes while the frozen static tripwire
derives eleven. Recorded for the whole-branch review.

## Fix-round verification

| Check                                                           | Result                                                                                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `tests/care-plan-linked-routes.dom.test.tsx`, Important 4 RED   | `Tests 1 failed \| 269 skipped (270)` — `Unable to find an accessible element with the role "link" and name "Open the Patient Plan"` |
| The same file, GREEN after the fix                              | `Test Files 1 passed (1)` / `Tests 270 passed (270)` (269 → 270, nothing previously passing broken)                                  |
| `npx tsc -p tsconfig.typecheck.json --noEmit`                   | Exit 0, zero diagnostics                                                                                                             |
| `npx eslint <7 changed source and test files> --max-warnings 0` | Exit 0, no output                                                                                                                    |
| `npx prettier --check` on every changed file                    | `All matched files use Prettier code style!`                                                                                         |

### Three pieces of evidence are outstanding, and blocked rather than skipped

At the time of writing, the repository's **exclusive heavy lease has been held continuously
for more than two hours** by a concurrent session in a different worktree
(`D:\Repos\Database\.claude\worktrees\browser-test-gate-handoff-d5c1db`, `vitest run
--reporter=dot`, `holderPid 53200`, confirmed alive). Every Playwright attempt fails at
acquisition with `EPERM: operation not permitted, mkdir …\gate.lock` and **exits 1 with no
test output at all** — a third refusal costume alongside the documented exit 0 and exit 75,
and one worth recording. A retry loop is still running.

Still owed, and **not** claimed as done:

1. **The browser suite re-run to green after the fix-round changes.** The last complete run
   before them was `29 passed (1.6m)`. Two partial runs during this round were killed by my own
   `TaskStop` and produced a phantom `worker process exited unexpectedly (code=3221225794)`,
   which is not a result and is not scored here. The one real failure they did surface — the
   Safety Plan journey using the patient section navigation on a **print** route, which
   correctly carries none — is fixed.
2. **The Important 1 control.** Editing a primary tap target from `min-h-12` to `min-h-11` and
   watching `TAP_TARGET_FLOOR` redden. The threshold change is made; the mutation proving it
   catches the banned edit has not been run.
3. **The Important 2 control.** Giving an ancestor an unparseable `color-mix()` background and
   watching `expectLooksLikeALink` redden on `has an unreadable computed background`. The
   fail-closed assertions are in place; the mutation proving they fire has not been run.

Both controls are one-line stylesheet mutations, and both were designed before the lease
blocked them. They are the first thing to run when the lease clears. Reporting them as pending
rather than passing is the point: this fix round exists because a test claimed work it had not
done, and it would be a poor answer to close it with a control claimed but not executed.

Also still not run, and unchanged from the first round: `npm run typecheck` and `npm run lint`
**through the coordinator wrapper** — the underlying compiler and linter were run directly
instead, which is the same check without the lease — the full focused Vitest set of seven
files, and the evidence capture.
