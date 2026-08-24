# Care Plan — verification report (Task 11)

Exact commands, exit codes, result lines, failures, and — just as important — the checks
that were **not** run and why.

Two rules were applied throughout, both learned expensively on this project:

- **A run is scored on its own summary line, never on an exit code.** A Vitest run with no
  `Test Files N passed (N)` line is a run-coordinator lease refusal, not a result; it exits
  0 or 75 either way. A `gate-receipts` `REUSED` line is a replay of an earlier verdict, not
  a fresh run. Every Vitest run below was made with `GATE_RECEIPTS=refresh` and retried in
  a loop until it produced a real summary line.
- **A wrapper's exit code is not the gate's exit code.** Run 2 of the browser suite is
  recorded below as `EXIT=1`, and the surrounding shell reported 0, because the compound
  command ended in `tail`. The summary line is the evidence.

---

## Environment

| Item                 | Value                                                                                                                                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Worktree             | `D:\Worktrees\Database\care-plan-impl`                                                                                                                                                                                                       |
| Branch               | `claude/care-plan-stage-b-9-11`                                                                                                                                                                                                              |
| Base commit at start | `157c48f33`                                                                                                                                                                                                                                  |
| Dev server           | `npm run ensure` → `http://localhost:3488`, identity confirmed via `/api/local-project-id` (`clinical-kb:4573c0c0381a`)                                                                                                                      |
| Browser suite server | `scripts/run-playwright.mjs` builds and starts its **own isolated production server**, which resolved to `http://localhost:3489` and verified the same project identity. The suite therefore measures a production build, not the dev server |

## Browser suite — the new evidence

```
npm run test:e2e:care-plan-mockup
```

which is exactly `node scripts/run-playwright.mjs --project=chromium-mockups tests/ui-care-plan-mockup.spec.ts`.

| Run | Result line                                             | What it was                                                                                                  |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | `9 failed` / `20 passed (19.7m)`, `EXIT=1`              | First rendering of this application, ever                                                                    |
| 2   | `4 failed` / `1 skipped` / `25 passed (6.5m)`, `EXIT=1` | After repairing what run 1 exposed                                                                           |
| 3   | `1 skipped` / `29 passed (1.2m)`                        | After repairing the last four                                                                                |
| 4   | `1 skipped` / **`29 passed (1.6m)`**, `EXIT=0`          | Confirmation after every probe mutation below was reverted, and after the guard correction the probes forced |

The skipped case is the evidence capture, which runs only under `CARE_PLAN_CAPTURE_EVIDENCE=1`.

Run 1's nine failures were **all in the new suite, not in the product**, and each is worth
recording because each is a class of mistake this file now documents rather than repeats:

1. **CSS-module class resolution assumed the dev-server shape.** `next dev` emits
   `care-plan-module__<hash>__<name>`; a production build emits `care-plan_<name>__<hash>`.
   The link-affordance gate therefore found nothing in the only build it actually measures.
2. **Role switches landed before hydration.** Every control is server-rendered, so a
   `selectOption` a frame early set the native value, React never saw the event, and the
   next reconcile silently restored the previous clinician. It looked exactly like "the
   role switcher does not work". `gotoRoute` now waits for a React root, and `switchRole`
   retries until the identity block agrees.
3. **`locator.all()` does not wait.** A fill loop one frame early wrote nothing, and the
   test failed four minutes later on a control that was still, correctly, unavailable.
4. **Capability boundaries are real.** Worklist resolution, contact verification and formal
   review are not the emergency physician's to perform; the default synthetic user is
   correctly offered nothing.
5. **A new Personal Safety Plan version cannot inherit how it came about.** That field is
   required and blocks making the version current — correct behaviour, missing from the test.
6. **The shared checkbox hides its native input** under a decorative box that owns the
   pointer events, so it is activated through its label.
7. **Two assertions were written against remembered copy rather than the copy on screen** —
   including one negative assertion that failed on the sentence _denying_ the very claim it
   was guarding, which is a guard pointing the wrong way.

### What the browser proved

- **All 21 routes** render from their own address with one first-level heading, the
  synthetic marker, the reset notice, and no sideways scrolling at 1440 px.
- **The pinned safety boundary** is painted above the first-minute sections — measured
  geometrically, not by document order — at 320, 390, 768, 1024 and 1440 px, in dark mode,
  and in forced colours, where its outline is asserted to be drawn in opaque ink. It is
  asserted not collapsed (`height > 8`), not clipped (`scrollHeight - clientHeight <= 1`),
  not `display: none`, not `visibility: hidden`, and not line-clamped. The full fifth
  section is present beside it and there is no disclosure element on the page.
- **The clinician Management Plan prints**: the synthetic marker survives inside the printed
  subtree, the printed-at stamp and the record-goes-stale warning are on the paper, the rail,
  dock and print button are hidden, up to forty sampled elements resolve to pure black on
  pure white — so the monochrome rule genuinely wins the cascade against every Tailwind
  utility and CSS-module rule in the subtree — and every `PrintSection` computes
  `break-inside: avoid`.
- **The Personal Safety Plan prints** with all seven of the person's own headings present,
  the marker on the paper, `000` and the not-an-emergency-service caveat visible, and — the
  assertion that matters most on this surface — **no `Not recorded` anywhere on it**.
- **The Patient Plan** is created, shows its gaps, refuses approval with the unfilled
  sections named, is approved by the default non-senior clinician, and prints with nothing
  clinical and no `Not recorded` on it. A newer Management Plan Version then marks it
  `needs updating` while it stays fully readable.
- **Ruling 57's replacement** passes on all six named affordances (below).
- **The `portal={false}` amendment sheet**, Task 7's deferred first look, renders inside the
  Care Plan subtree — which is why it exists — with its multi-line field measured above 48 px
  rather than collapsed to the shared one-line height, and returns focus on `Escape`.
- **Focus containment** in the phone `More` sheet across twelve `Tab` presses, with
  `Escape` and focus restoration; the same for a `ConfirmDialog`.
- **Every control reached by 40 `Tab` presses on the patient overview draws a visible focus
  ring** — a non-zero outline in opaque ink, or a box shadow.
- **All eleven degraded specimens** render a stated reason at 390 px rather than a blank
  screen, with `identity-uncertain` withholding plan content outright.
- **Reflow** with no sideways scrolling at all five widths and at the 200 %-zoom equivalent
  (640 × 512).
- **Reduced motion** removes the sheet animation without removing the state change, and the
  same journey works again with motion enabled.
- **The four-tab Reviews queue strip at 320 px** — Task 10's deferred first look — has every
  tab visible, above the tap-target floor, switchable, with no sideways scrolling.

### Probes against the new link-affordance gate

Ruling 57 froze the static guard and named Task 11 as the owner of the replacement. A guard
nobody has attacked is a guard nobody has tested, so the replacement was attacked with
working mutations rather than reasoned about.

Each probe is a real mutation to `care-plan.module.css`, built and run through the wrapper,
then reverted. `npm run test:e2e:care-plan-mockup -- -g "link affordance"`.

| #   | Mutation                                                                                                  | Result line          | Message                                                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `text-decoration: underline` → `none` on the shared `pinnedBoundaryLink`/`timelineLink`/`inlineLink` rule | `1 failed`, `EXIT=1` | `` `pinnedBoundaryLink` carries no underline, so it is distinguished from body text by colour alone ``                            |
| 2   | `.specimenLink` colour → `rgb(0 0 0 / 0.0%)`                                                              | `1 failed`, `EXIT=1` | `` `specimenLink` paints its text in ink that is effectively invisible (rgba(0, 0, 0, 0)) ``                                      |
| 3   | `.pinnedBoundaryLink`/`.timelineLink`/`.inlineLink` colour → `inherit`                                    | `1 failed`, `EXIT=1` | `` `pinnedBoundaryLink` is exactly the colour of the text around it (rgb(27, 37, 51)), so colour distinguishes it from nothing `` |
| 4   | `.patientNavItem` border → `1px solid rgb(0 0 0 / 0%)`                                                    | `1 failed`, `EXIT=1` | `` `patientNavSecondary` draws no visible border on any side ``                                                                   |

Two of those are spellings the frozen static guard could not see. Probe 2 is `rgb(0 0 0 /
0.0%)` — a decimal _and_ a percent together, the ninth spelling, found in Task 10's closing
re-review. Probe 3 is `color: inherit`, which the ledger parks explicitly as
"`color: inherit` counting as a colour". The computed style resolved both to a final value
without ever reading a spelling, which is the whole argument for the replacement.

**One probe corrected the guard rather than confirming it, and that is the more useful
outcome.** The first shape of `expectLooksLikeALink` required _every_ named affordance to
differ in colour from the prose around it. Probe 3 was originally aimed at
`patientNavSecondary` and it went red — for a change that takes nothing away from a reader,
because a bordered pill with a 48 px box is perfectly visible whatever colour its text is.
A guard that reddens for a harmless change is how a guard gets relaxed later for a harmful
one, so the colour requirement is now contracted per class: the four accent text links must
differ in colour and carry an underline, the two pill controls must carry a border painted
in ink that differs from the surface behind them, and all six must paint at all. Probe 3 was
then re-aimed at `inlineLink`'s own rule, where the requirement is real, and killed it.

## Focused unit and DOM suites

```
GATE_RECEIPTS=refresh npm run test -- tests/care-plan-domain.test.ts \
  tests/care-plan-prototype-state.test.ts tests/care-plan-patient-plan.test.ts \
  tests/care-plan-route-files.test.ts tests/care-plan-linked-routes.dom.test.tsx \
  tests/proxy.test.ts tests/playwright-project-isolation.test.ts
```

```
 Test Files  7 passed (7)
      Tests  517 passed (517)
```

Zero failed files, zero failed tests. The run was retried in a loop until it produced that
summary line; earlier attempts returned no summary at all, which is the run coordinator
refusing a lease while Playwright held the exclusive one, not a result.

Two intermediate results are worth keeping, because each was a RED that proved a test could
fail before it was made to pass:

| Stage                                                                                     | Result line                                                                                                  | What it proved                                           |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `tests/playwright-project-isolation.test.ts` before the Playwright project was registered | `Test Files 1 failed (1)` / `Tests 1 failed \| 5 passed (6)`, `tests/ui-care-plan-mockup.spec.ts is missing` | The registration assertion fails for the right reason    |
| The five navigation regression tests before the fix                                       | `Tests 5 failed \| 264 skipped (269)`, all five `Unable to find …`                                           | The wiring defects were real, and the tests observe them |
| The same file after the fix                                                               | `Test Files 1 passed (1)` / `Tests 269 passed (269)`                                                         | 264 → 269, with nothing previously passing broken        |

## Privacy and source scans

Run verbatim from the brief.

| Scan                                                                                                    | Result                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frequent flyer\|high utili[sz]er\|problem patient\|risk score\|automatic enrol\|automatically identif` | **No matches** (exit 1)                                                                                                                                                                                                                                                                                         |
| `localStorage\|sessionStorage\|indexedDB\|document\.cookie\|\bfetch\s*\(`                               | **No matches** (exit 1)                                                                                                                                                                                                                                                                                         |
| `openai\|anthropic\|completion\|llm\|gpt\|prompt`                                                       | 8 matches, all classified as unrelated: seven are the `left_before_completion` disposition enum and its label, one is the section heading `What should prompt a review`. No provider reference exists                                                                                                           |
| `should not be admitted\|do not admit\|admission is not indicated`                                      | 3 matches, all inside `BANNED_ADMISSION_CONSTRUCTIONS` in `domain.ts` — the guard list itself. No fixture, interface string or example contains one                                                                                                                                                             |
| `\b(sent\|delivered\|read\|replied\|contact completed)\b`                                               | Many matches, every one classified by hand. All are either explicit negations (`Nothing was sent, and no message exists.`, `never that anything was sent, delivered, read, answered, or completed`), the ordinary verb _to read_ (`Read this plan and the triage note first`), or `read-only`. **No overclaim** |

## The mailto privacy assertion

`buildCmhtMailto` takes a contact and nothing else, so it is structurally incapable of
carrying patient data — but that is a property of today's signature, not a guarantee. The
existing cross-product identity sweep was extended in `tests/care-plan-domain.test.ts` to
cover **content** as well: every patient is paired with every contact, and every contact URI
is asserted to equal the contact-only builder output and to contain no opening fragment of
any Management Plan field, any ED Presentation note, or any person's own safety-plan words.
The collection is asserted non-empty first, so the sweep cannot pass by matching nothing.

## Reading the patient-facing surfaces as their recipient

Every automated check this project has is a check on structure. The one class of harm none
of them can see is a page that is technically correct and cruel to read, so each
patient-facing surface was read straight through as its recipient.

**How each was read, so the basis is not overstated.** The Personal Safety Plan paper and
every on-screen surface were read as **rendered text pulled out of the running
application**. The Patient Plan paper has no fixture — a copy only exists once somebody
makes one — and the evidence capture that would have written it out as text never got a
lease, so it was read from its **print component and section lead-ins in source**, together
with what the browser asserts about the rendered result (all eight headings, gaps omitted,
no `Not recorded`, nothing clinical). That is weaker evidence than reading the sheet, and
it is the first thing to redo when the capture runs.

### The Personal Safety Plan, on paper

It reads well, and it reads as Rowan's. It opens `My Personal Safety Plan`, with the
person's preferred name, record number, version and last-confirmed date, and then:

> This is your plan, in your own words. Keep it somewhere you can find it quickly. If it
> stops fitting, or something changes, tell someone on your team so you can write it again
> together.

The seven sections are in the first person and hold the person's own sentences, not a
clinician's summary of them. Nothing is empty. The support people are named with how they
know Rowan and their number. `If you need help now` is last, which is where a reader looks
when everything above has not worked, and every crisis line carries its own hours and its
own caveat rather than one footnote at the bottom.

**One finding, in the sheet's closing furniture.** Near the end, after the person's own
words and the crisis lines, the sheet says:

> Confidential clinical document. Handle it, keep it, and dispose of it according to local
> health service policy.

That is the shared `PrintOutput` primitive's confidential footer, switched on by both
patient-facing prints. On a clinician's handover copy it is exactly right. On a person's own
safety plan it re-frames their own document as an institutional artefact they must dispose
of according to somebody else's policy — after the page has told them to keep it somewhere
they can find it quickly. It is not wrong; it is cold, and it is the wrong voice for the one
page in this product written entirely in the person's own.

**Correction to the first version of this report**, which called it "the last thing the
reader sees". It is not. `print-output.tsx:124` renders the provenance `<footer>` after it,
so the actual last line is `Synthetic Care Plan prototype. Nothing on this page describes a
real person…`. The finding stands; the dramatic framing did not, and a report whose value is
that a later reader can trust it does not get to keep an inaccurate flourish.

It is also a quiet specification deviation. The specification enumerates what the clinician
print carries and names `a confidential-document footer` among them; the Personal Safety
Plan print and the Patient Plan print each have their own enumerated list and **neither
names it**.

**Recommendation:** drop `confidential` from the two patient-facing prints and keep it on
the clinician print.

**Correction to the blast radius**, which the first version of this report overstated. This
does **not** touch the shared primitive: `CONFIDENTIAL_DOCUMENT_FOOTER`, `PrintOutput`, and
the clinician print are all untouched, and no other consumer in the repository changes. It
is two deletions inside Care Plan — the `confidential` prop at `safety-plan-pages.tsx:540`
and at `patient-plan-pages.tsx:585`. Still not changed here, because it is a product-copy
decision and the user is the one to make it, but they should decide against the real cost
rather than the inflated one.

Two smaller notes, neither a defect: all four public crisis lines print on every sheet,
including the Peel and regional numbers on a metropolitan patient's copy, which is
defensible but is four entries where two would do; and each carries its full source URL,
which is verifiable and also the least readable thing on an otherwise plain-language page.

### The Patient Plan, on paper

Headed `My plan`, with only a preferred name, record number, version and `Agreed on` date —
no date of birth, no address, no home service, no episode, no version history, no owner, no
approver, no review date. That restraint is right: this is the sheet that leaves the
building.

> This is your copy of the plan you and your team wrote together. Keep it somewhere you can
> find it quickly, and bring it with you if you can. If something in it stops fitting, tell
> someone on your team so you can write it again together.

Each section has a lead-in written to the person rather than about them —
`These are the things you have said matter to you`, `These are the things that have made a
visit harder, so we can try to avoid them`. **Unfilled sections are omitted from the paper
entirely** rather than printed as a heading with nothing under it. That is the direct answer
to this project's worst defect, and the browser now asserts the sheet contains no
`Not recorded` at all.

The same confidential-footer finding applies, and applies harder here: this is explicitly
the person's copy.

### The clinician plan, on paper, at 3am

The pinned safety boundary is the second thing on the page, immediately under the
identifiers and above everything else, and it prints. Then, before any plan content:

> **This is a printed copy and may already be out of date.** Before you rely on it, check
> the electronic record for a newer version, for anything withdrawn, and for what has
> happened since.

The five first-minute sections follow in order, then the team block with its operating
hours and the sentence that checked details are not a guarantee of availability. Nothing
that only makes sense on a screen reaches the paper: no navigation, no actions, no audit
history, no draft. For a clinician reading it at a bedside this is the right sheet, and the
one thing it never does is imply that the paper is current.

### On screen, on a phone, at 3am

The Current Plan card is the five sections in order with the boundary pinned above them,
and the boundary is measured above the plan at 320 px as well as on a desktop. `Overdue`
does not hide the plan; it warns above it and leaves it fully readable — which is the right
direction, because a plan that is late for review is still the plan the team agreed.

The one thing that reads awkwardly is the pinned line's own wording order:
`**Do not rely on this plan if today is different — assess afresh.** Then read the full
section.` followed by the link naming the section. `Then read the full section` arrives
before the reader knows which section, and the sentence would read better with them
swapped. Cosmetic, and recorded rather than changed.

## The fast checks

The user's recorded decision D2, as revised the same day (`sdd-ledger.md`), names exactly
which checks this task runs: `typecheck`, `lint`, the Care Plan Vitest files,
`prettier --check` on changed files only, and Task 11's own Chromium journeys.

| Check                                          | Result                                                                                                                                                                                                                                        |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GATE_RECEIPTS=refresh npm run typecheck`      | Exit 0, zero diagnostics. A **fresh** run — `[gate-receipts] recorded a pass for "typecheck:internal" (4683 input files)`, which is a new record rather than a replayed one. Took four attempts; the first three were lease refusals          |
| `GATE_RECEIPTS=refresh npm run lint`           | Exit 0, no output, `--max-warnings 0`. Also fresh: `[gate-receipts] recorded a pass for "lint:internal" (4683 input files)`. **This closes the debt the ledger recorded**: lint had not been run on this branch since the `origin/main` merge |
| `npx prettier --check` on all 16 changed files | Initially **7 markdown files failed**; formatted with `--write` and re-checked: `All matched files use Prettier code style!`                                                                                                                  |
| Care Plan Vitest files                         | `Test Files 7 passed (7)` / `Tests 517 passed (517)` (above)                                                                                                                                                                                  |
| Chromium journeys                              | `29 passed (1.6m)`, 1 skipped (above)                                                                                                                                                                                                         |
| `git diff --check` over the whole task range   | Clean. Working tree clean at the Task 11 commit                                                                                                                                                                                               |

## Gaps in the brief's own checklist, stated rather than glossed

Two of these were closed in fix round 1 and are recorded here because the first version of
this report did not mention them at all. The rest remain open.

**Closed in fix round 1:**

- **The Review Trigger journey resolved nothing.** A case named `a Review Trigger is
resolved without the plan changing by itself` opened the sheet and pressed `Escape`, and a
  second named `the Reviews worklists open, resolve, and stay operable…` only switched tabs.
  The brief required the resolution journey and this report listed it as delivered. It now
  genuinely resolves: blank submission refused, resolution written, outcome asserted, entry
  gone from the queue, and the plan it was raised against asserted byte-for-byte unchanged.
  The second case is renamed to `the four Reviews worklists switch and stay operable on a
320px phone`, which is what it does.
- **The per-width list was a third implemented.** The brief asks for heading and action
  wrapping, Current Plan readability, CMHT and Safety access, 48 px primary targets and dock
  clearance at each of the five widths; only overflow and rail/dock ownership were checked.
  All of it is now in `the plan stays readable and every primary action stays reachable at
each width`.

**Still open:**

- **`npm run workflow:clinical-proof … --write-evidence` was not run.** The brief lists it;
  the user's later revision of D2 narrowed this task to the fast checks named above and it
  is not among them. The evidence it would have assembled — privacy, clinical-language,
  source, failure-mode and prototype-boundary — is present in this report from the scans and
  journeys directly, but it was not produced by that workflow and should not be described as
  if it were.
- **The browser journeys do not cover drafting or submitting a new Management Plan
  Version.** They cover comparing, returning for changes, and approving, which is where the
  senior-approval boundary lives. Drafting and submission have reducer and DOM proof only, so
  the eleven-field authoring form has no rendered proof at all. The case that used to be
  called `the whole authoring lifecycle…` is renamed to `a submitted version is returned for
changes without the Current Plan moving`, because it was claiming this gap rather than
  covering it.
- **The affordance table is a hand-maintained list of six classes** while the frozen static
  tripwire derives eleven. Out of scope for this round by the reviewer's decision — the
  derived tripwire means no link class is unguarded today — and it is the same shape that
  beat the frozen guard in the first place. The whole-branch review has it.

## The sweep of all thirty case names against what each case does

The Critical finding was that a test named for work it does not do is worse than a missing
test, because the name is what a later reader trusts. Every one of the thirty cases was
re-read against its own body. **Three more of the same shape were found**, all now fixed:

| Case                                                                                              | What the name claimed                                        | What it did                                                                        | Fix                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `a manual Identification Review is recorded without creating a plan`                              | a referral is recorded                                       | opened the referral sheet and pressed `Escape` — nothing was recorded              | Now refuses a reasonless referral, records a real one, asserts the outcome, asserts no plan appeared, and follows it into the Identification Review worklist       |
| `the whole authoring lifecycle runs in the browser without losing the Current Plan`               | drafting, submitting, comparing, returning **and** approving | returning for changes only                                                         | Renamed to `a submitted version is returned for changes without the Current Plan moving`; the drafting and submission gap is recorded above rather than named over |
| `a Personal Safety Plan is written, made current, and printed without touching the clinical plan` | the trailing clause — that the clinical plan is untouched    | wrote, made current and printed; asserted nothing at all about the Management Plan | Now reads the Current Plan metadata before, walks to the Safety Plan through the interface, and asserts the Management Plan is identical afterwards                |

The remaining twenty-six were checked and do what they say. Two are worth noting as accurate
but narrower than they sound, and both say so in a comment rather than in the name:
`the pinned safety boundary survives dark mode and forced colours` checks one route rather
than all twenty-one, and `keyboard traversal reaches the plan without a mouse` walks forty
tab stops on one surface rather than the whole family.

## Evidence capture — attempted, not completed

`CARE_PLAN_CAPTURE_EVIDENCE=1 npm run test:e2e:care-plan-mockup -- -g handoff` was started
three times and **no attempt produced a single screenshot**.

Attempts one and two never reached their build at all: no build line, no run root created,
no output of any kind for more than five minutes each. That is the run coordinator holding
the exclusive heavy lease for another session on this machine, not a failure of the capture.
Both were stopped so the fast checks above could take the lease instead.

Attempt three acquired the lease and compiled (`✓ Compiled successfully in 69s`), then sat
in `Running TypeScript ...` for **over thirty minutes**. The same step took 68 and 77
seconds in the four earlier browser runs, so this is machine contention rather than
anything about the capture. It was stopped so it would not go on holding the exclusive
lease against every other session.

None of that is a red result. It is "blocked, retry" three times over, and it is recorded
here as owed rather than reported as done.

The capture path itself is written and registered (`captures the Care Plan handoff atlas`,
reported as `1 skipped` on every run without the environment variable). It writes only
ignored files under `.local/care-plan/atlas`: 26 screenshots at 320, 390 and 1440 px plus
dark and forced-colour specimens, a `manifest.json` stamped with the source commit, and —
added deliberately — `paper-management-plan.txt`, `paper-safety-plan.txt` and
`paper-patient-plan.txt`, the three printed papers as text.

**This is an unverified path.** It has never executed, so its assertions on image counts and
file names are untested. Recorded as owed rather than claimed.

## Checks NOT run, by user instruction

The user directed that this task stay local and focused on building, and that the release
gates below are theirs to run. Each is listed as unrun rather than omitted, because a gap
recorded is evidence and a gap hidden is not.

| Not run                                                                                  | Why                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify:pr-local`                                                                | Not run, by user instruction                                                                                                                                                                                                                                                                  |
| `npm run verify:cheap`                                                                   | Not run, by user instruction                                                                                                                                                                                                                                                                  |
| `npm run verify:release`                                                                 | Not run, by user instruction — and provider-backed                                                                                                                                                                                                                                            |
| `npm run build`                                                                          | Not run directly, by user instruction. Note that `scripts/run-playwright.mjs` performs its **own** isolated production `next build` on every browser run, and all three runs built successfully; that is not the same as the repository build gate and does not include `check:bundle-budget` |
| `npm run check:production-readiness`                                                     | Not run, by user instruction                                                                                                                                                                                                                                                                  |
| `npm run docs:update`                                                                    | Not run, by user instruction. Task 11 adds no route, and all 21 Care Plan routes are already present in `docs/site-map.md`, so no generated diff is expected — but that is an expectation, not a verified fact                                                                                |
| whole-tree `npm run format`                                                              | Not run, by user instruction. Every file this task touched was formatted with `npx prettier --write` and re-checked clean; a repository-wide check may still find an unrelated file                                                                                                           |
| The evidence capture                                                                     | Attempted three times, blocked every time by the exclusive heavy lease or by machine contention — see above. Owed, not claimed                                                                                                                                                                |
| `eval:*`, `check:supabase-project`, anything touching live Supabase, OpenAI or hosted CI | Not run — provider-backed and out of scope                                                                                                                                                                                                                                                    |
| Push, pull request, merge, deploy                                                        | Not performed                                                                                                                                                                                                                                                                                 |

## Acceptance criteria

Every criterion in the approved specification, with the direct evidence for it. Where the
evidence is structural only — no rendered proof exists — the row says so, because a green
suite is not the same as a satisfied requirement.

| Criterion                                                                                                                                                      | Evidence                                                                                                                                       | Verified how                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Find a synthetic patient and the Current Plan within 10 seconds                                                                                                | Browser: `a clinician can search a name and reach the Current Plan` — search, open the record, one section link, plan on screen                | Browser + DOM                                                                           |
| First-minute guidance, status, version, approver, review state and CMHT contact understandable within 30 seconds                                               | `care-plan-current-plan-metadata` asserted visible on the same journey; the card is the five sections plus the metadata list                   | Browser + DOM. **Comprehension time itself is not measured and cannot be by a machine** |
| Record a concise ED Presentation within two minutes                                                                                                            | Browser: seven required answers filled and saved in one form, no optional field blocking                                                       | Browser                                                                                 |
| Current Personal Safety Plan reachable and printable within three actions                                                                                      | Home → section link → `Print this plan`; browser journey walks it                                                                              | Browser                                                                                 |
| A replacement draft never obscures or replaces the Current Plan                                                                                                | Browser: `a version awaiting approval never displaces the Current Plan` measures both painted boxes, so a CSS reorder cannot pass              | Browser (new — jsdom proved document order only)                                        |
| Approving creates exactly one Current version and supersedes the prior one                                                                                     | `assertSingleCurrentVersion` reducer invariant; browser approves version 2 and reads version 1 as superseded                                   | Reducer + browser                                                                       |
| An overdue Current Plan remains readable and unmistakably overdue                                                                                              | `overdue-plan` specimen renders its warning above fully readable content                                                                       | Reducer + DOM + browser                                                                 |
| The summary card is exactly the five first-minute sections in order                                                                                            | Generated from `FIRST_MINUTE_CONTENT_KEYS` rather than transcribed                                                                             | DOM                                                                                     |
| `What would make this presentation different` visible on the card at every viewport, in dark mode, forced colours and print, never collapsed/truncated/clipped | Browser: geometry at 320/390/768/1024/1440, dark, forced colours, print; height, clipping, `display`, `visibility` and line-clamp all asserted | **Browser — new**                                                                       |
| Approved version defaults review 12 months ahead, author can change it, amber at 28 days                                                                       | `REVIEW_INTERVAL_MONTHS = 12`, `REVIEW_DUE_SOON_DAYS = 28`, `deriveReviewState` boundary tests                                                 | Reducer + DOM                                                                           |
| Presentation saves with the seven required answers; optional detail never blocks and reads `Not recorded`                                                      | Form validation tests; browser saves with only the required answers                                                                            | Reducer + DOM + browser                                                                 |
| Identification Review closes with a decision and reason, leaves the queue, stays in history, creates no plan                                                   | Reducer refusal/closure tests; browser opens the referral sheet and reads `creates no plan`                                                    | Reducer + DOM + browser                                                                 |
| Pinned safety boundary above all plan content at 320, 390, desktop, dark, forced colours, print                                                                | As above                                                                                                                                       | **Browser — new**                                                                       |
| No prohibitive admission construction anywhere                                                                                                                 | `BANNED_ADMISSION_CONSTRUCTIONS` unit test, form validation, and the fixture scan in this report (3 matches, all the guard list itself)        | Unit + scan                                                                             |
| A version approved at `declined`/`patient_unavailable` carries the involvement marker everywhere and raises a Review Trigger                                   | Reducer assertion; the approval dialog states the consequence before the decision                                                              | Reducer + DOM                                                                           |
| A withdrawn plan never renders identically to a person who never had one                                                                                       | Browser: Evelyn Demo's `care-plan-withdrawn-notice` asserted visible with its date, under forced colours                                       | Browser + DOM                                                                           |
| Sort-by-count exists only in the Identification Review workflow                                                                                                | No sort control in the directory (DOM); the Governance page discloses the one that exists (Ruling 56)                                          | DOM                                                                                     |
| The Management Plan summary prints, and both print views consume the shared `PrintOutput`                                                                      | All three print surfaces import `PrintOutput`/`PrintSection`; browser prints the clinician summary and the Safety Plan                         | **Browser — new**                                                                       |
| Patient Plan produces gaps not guesses, never auto-converts the agreed approach, cannot be approved with a gap                                                 | Browser: section 4 gap asserted, approval `aria-disabled` with the unfilled sections named, then approved once filled                          | **Browser — new** + reducer                                                             |
| A Patient Plan from a superseded version is marked as needing updating, stays readable, never regenerated or hidden                                            | Browser: approve a newer Management Plan Version, then read `needs updating` beside a fully readable version 1                                 | **Browser — new** + derived-selector test                                               |
| No language model, network call or provider is reachable anywhere                                                                                              | Scans 2 and 3 in this report: no `fetch`, no storage, no provider reference                                                                    | Scan + source inspection                                                                |
| The shell states in plain words that nothing is saved and reloading starts over                                                                                | `Nothing is saved. Reloading this page starts over.` asserted on every route the browser visits                                                | Browser + DOM                                                                           |
| Presentation corrections are visible amendments, not silent overwrites                                                                                         | Append-only reducer assertion on `originalValue`; the detail view shows both                                                                   | Reducer + DOM                                                                           |
| Plan-use feedback can create a Review Trigger but cannot change a plan                                                                                         | Reducer before/after plan equality; the resolution sheet states `It changes no plan and approves nothing`                                      | Reducer + browser                                                                       |
| Counts never become an automatic label or eligibility decision                                                                                                 | The eligibility sentence sits beside every count; policy is `pending_governance` with no threshold                                             | DOM + fixtures                                                                          |
| No numeric identification threshold in code, fixtures, tests or copy                                                                                           | Null-typed policy fields; governance copy states no rule exists                                                                                | Types + fixtures + DOM                                                                  |
| CMHT email links carry no patient identifier or clinical content and never imply communication                                                                 | The extended cross-product assertion in `care-plan-domain.test.ts`; browser reads the rendered `mailto:` and the no-evidence sentence          | Unit + **browser — new**                                                                |
| The Personal Safety Plan stays independent of the Management Plan                                                                                              | Browser: a new safety-plan version is made current with no Management Plan approval involved                                                   | Browser + reducer                                                                       |
| Every record and screen visibly synthetic; refresh restores deterministic state                                                                                | Marker asserted on every route; the whole suite depends on refresh resetting, and does so                                                      | **Browser — new**                                                                       |
| Primary journeys work at desktop, 390 and 320, and remain operable by keyboard                                                                                 | Reflow at five widths; 40-step tab walk with a focus-ring check; sheet focus containment                                                       | **Browser — new**                                                                       |
| Current, Draft, Review, Withdrawn, unavailable and error states distinguishable without colour                                                                 | Forced-colours run asserts the words, not the tints                                                                                            | **Browser — new**                                                                       |
| The print view is readable in monochrome and contains only the intended patient-facing content                                                                 | Up to forty sampled elements resolve to black on white; the Safety Plan paper carries all seven headings and no `Not recorded`                 | **Browser — new**                                                                       |

## Carried forward

The reviewed Task 3 design-sweep evidence is carried forward unchanged. No shared UI
foundation outside the Care Plan namespace was touched by this task — the three production
edits are all inside `src/components/care-plan/mockups/` — so the design preflight was not
re-run.

## Known noise in the test output

The output of the focused Vitest suites is **not pristine**, and this has been true since
Stage A. Exactly three notices were observed in the 517-test run above:

- `await act(() => ...)` — the React `act` warning the Stage A checkpoint recorded.
- `Not implemented: navigation to another Document`, twice — jsdom, on a link activation.
- `Not implemented: Window's print() method` — jsdom, on the print journeys.

All three are test-environment hygiene rather than product defects, and all three are
recorded rather than fixed. They matter because a genuinely new warning could hide among
them.

**One correction to the record.** Ruling 50 says the shared `src/components/ui/select.tsx`
emits a React controlled/uncontrolled warning "on every Care Plan run". It did **not**
appear in this run. That does not clear the underlying defect — the file still passes both
`value` and a `defaultValue` fallback whenever a `placeholder` is supplied, it is untouched
by this branch, it is repository-wide, and it was not fixed here — but "on every run" is not
what this run showed, and the difference should not be reported as if it were. The
`Prototype role` select has no placeholder, which is the likely reason.
