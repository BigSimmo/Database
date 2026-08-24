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
