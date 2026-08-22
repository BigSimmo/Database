# Task 19 — browser proof at the six required widths, and the close of Phase 2A

Branch `claude/suicide-contact-mockup-b5aaa0`, worktree `D:\Worktrees\Database\cc-2a-live`.

## What was added to the spec, and what was not touched

`tests/ui-caring-contacts-workspace.spec.ts` already existed: Task 15 wrote it under Ruling 51,
because a design-system gate needed a passing browser proof before Task 19 was scheduled to
produce one. Step 1's registration guard was therefore already green, and
`playwright.config.ts`, `scripts/playwright-pr-shards.mjs` and
`tests/playwright-project-isolation.test.ts` all already named the spec. None of the three
needed editing, so none was edited.

**Nothing already in the spec was weakened, and this is checkable rather than asserted.** The
diff of the spec in commit `25495d5ae` contains **zero deleted lines** — one import block added
above the existing import, and one block of tests added below the existing ones:

```
git diff 25495d5ae~1 25495d5ae -- tests/ui-caring-contacts-workspace.spec.ts | grep "^-" | grep -v "^---"
(no output)
```

Nine existing tests, 199 lines, untouched. The file grew from 199 lines to 591.

### The overlay half (brief item 5)

`caring-contacts workspace overlays`, two tests per width at 390 and 1440:

- **`opens all 24 overlays at their frozen modality and geometry`** — each overlay is opened by a
  real deep link (`page.goto("/caring-contacts?overlay=<id>")`, one full page load per overlay,
  48 in total). For each: the URL carries the id; `data-overlay-modality` equals the modality the
  frozen table chooses at that width; `data-overlay-dismissal` equals the table's `dismissal`;
  the surface's geometry matches its modality; the decision control is fully inside the viewport;
  and Escape does what the table says.
- **`returns focus to the control an overlay was opened from`** — for every dismissible row,
  focus starts on a real control, the overlay opens, Escape closes it, and focus must be back on
  that control.

The matrix is driven from `WORKSPACE_OVERLAY_DEFINITIONS` and `widthStateFor`, imported, never
transcribed. A modality typed into the spec by hand would agree with the table on the day it was
typed and drift silently afterwards, which is the one failure a browser proof of a frozen
contract must not have.

Geometry is stated per modality as what the modality _means_, not as the number that happened to
be measured:

| Modality            | What is asserted                                                    |
| ------------------- | ------------------------------------------------------------------- |
| `full-screen-stage` | phone only; fills the viewport in both axes                         |
| `session-gate`      | phone: fills the viewport. Desktop: wider than a dialog may ever be |
| `bottom-sheet`      | phone only; spans the width, anchored to the bottom edge            |
| `inspection-drawer` | desktop only; right-anchored, at most 56% of the viewport width     |
| `dialog`            | desktop only; at most 640px wide                                    |
| `status-banner`     | spans the width, anchored to the bottom edge, at either size        |
| every modality      | no edge outside the viewport (±2px for sub-pixel rounding)          |

Ruling 60's 640–767 band is deliberately not sampled, and the spec says so at the constant that
would have to change to sample it.

**One correction to the brief, taken deliberately.** The brief names only `session-expiry` as
surviving Escape. The frozen table marks `offline-banner` `recovery-only` as well. The spec reads
`dismissal` off the table through a local `dismissesOnEscape()` that **throws** on an
unrecognised value rather than falling through to "dismissible", so both rows hold and a future
third dismissal value cannot be assumed away. That function deliberately does not import
`dismissesOnEscapeOrBackdrop` from the host: a proof that borrows the implementation's own
decision cannot catch that decision being wrong.

### The accessibility half (remainder of brief item 6)

`caring-contacts workspace accessibility modes`:

- **`reflows at the 400% zoom equivalent without spilling sideways`** — no horizontal overflow,
  and the frozen mapping really did drop to `compact` with the phone dock visible.
- **`draws a visible focus ring in {default, dark, forced-colors, zoom-400}`** — Tab to the
  workspace's own `Today` destination, then assert `outlineStyle !== "none"`, outline width
  ≥ 2px, and a non-transparent colour; plus no horizontal overflow in that mode.

**400% zoom is emulated as a divided viewport (1280×800 ÷ 4 = 320×200), not as
`documentElement.style.zoom = "4"`, and that choice was forced by measurement.** With `zoom: 4`
on a 1280px viewport this Chromium reports `innerWidth` 1280, `documentElement.clientWidth` 1280
and `documentElement.scrollWidth` 1280, and `(width < 768px)` still matches false — the page keeps
its `split` desktop layout and any overflow check written against it **can never fail**. The
divided viewport is what WCAG 1.4.10 actually describes, it moves the media queries with it, and
it is the same equivalence `ui-smoke.spec.ts` already uses for 200%.

## Browser runs

Every run below is `node scripts/run-playwright.mjs tests/ui-caring-contacts-workspace.spec.ts
--project=chromium`. **No run was blocked**: no run exited `75` and no
`DATABASE_HEAVY_RUN_ADMISSION_BUSY` marker appeared, so every non-zero exit below is a genuine
red, not lock contention.

**Final run, on the committed and formatted tree, exit code 0:**

```
  18 passed (34.2s)
```

All 18, individually green — the 6 width tests, dark, forced colours, print, the two overlay
matrices (390 and 1440), the two focus-return tests, the reflow test and the four focus-ring
tests:

```
  ok 10 … opens all 24 overlays at their frozen modality and geometry at 390px (7.1s)
  ok 12 … opens all 24 overlays at their frozen modality and geometry at 1440px (7.9s)
  ok 11 … returns focus to the control an overlay was opened from at 390px (2.0s)
  ok 13 … returns focus to the control an overlay was opened from at 1440px (2.5s)
  ok 14 … reflows at the 400% zoom equivalent without spilling sideways (725ms)
```

An earlier identical run before the format commit also reported `18 passed (35.9s)`, exit 0.

One transient: a `run-playwright` invocation reported `Playwright production build failed (status
1)` with no compile error in the output, and the identical command immediately afterwards built
and ran cleanly. Recorded rather than explained; it did not recur.

## Mutation evidence

Six mutations, each run on its own, each checked for **which** assertion it reddened.

Line numbers below are the **committed** file's. Two mutations ran against a file whose numbering
differed slightly, so the run output quoted a different number; both are given.

| #   | Mutation                                                                                              | Target assertion                              | Result                                                             |
| --- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------ |
| M0  | `shell.tsx`: every `WIDTH_STATE_MARKERS` row's `state` set to `compact` (the brief's Step 5)          | width-state equality, line 105                | **red at 768, 1024 and 1440**; 320/390/430 stayed green, correctly |
| M1a | the rendered `data-overlay-modality` forced to `dialog` at 390                                        | stamped modality, line 409 (run quoted 410)   | **red** on the first overlay                                       |
| M1b | the rendered `data-overlay-dismissal` forced to `recovery-only` at 390                                | stamped dismissal, line 410 (run quoted 411)  | **red** on the first overlay                                       |
| M2  | `sheet.tsx`: `sm:max-w-lg` → `sm:max-w-4xl`                                                           | dialog width ≤ 640, line 376                  | **red**, `Expected: <= 640 / Received: 896`                        |
| M3  | `sheet.tsx`: the Escape handler's `onCloseRef.current()` deleted                                      | Escape closes it, line 429                    | **red**, `Expected: 0 / Received: 1`                               |
| M4  | `sheet.tsx`: the focus-restore candidate list reduced to `[null]`                                     | focus returned to the opener, line 482        | **red**                                                            |
| M5  | `shell.tsx`: `<main>` given `min-w-[420px]`                                                           | reflow overflow, line 566 (run quoted 560)    | **red**, `Expected: <= 2 / Received: 100`                          |
| M6  | `shell.tsx` `focusRing` emptied **and** the `globals.css` `:focus-visible` rule set to `outline:none` | focus ring present, line 552 (run quoted 546) | **red** in all four modes                                          |

M1a and M1b each inserted one extra line above the assertion, so the run reported one line later.
M5 and M6 ran before the six-line comment correction described below was made, so the committed
file numbers those two assertions six lines later than the run did.

**Did each reach the assertion it targets, rather than an earlier one?** Checked for every
mutation, and the answer is yes in every case:

- **M0** — the overflow check on line 101 runs first and stayed green; the failure is line 105.
- **M1a** — the deep-link count and the URL assertion run first and stayed green.
- **M1b** — the modality assertion runs first and stayed green; the failure is the next statement.
- **M2** — modality, dismissal and `expectFullyOnScreen` all run before line 376 and all stayed
  green (896px still fits inside 1440).
- **M3** — every assertion in the loop body ran green before the Escape check.
- **M4** — line 481 (`Escape did not close it`) passed; line 482 failed.
- **M5** — the `h1` visibility check ran first; the overflow assertion is the next statement.
- **M6** — the `h1` and the Tab-to-destination helper both ran; the ring assertion failed.

**Two honest qualifications.**

_M1a and M1b mutate the rendered DOM, not production source._ The stamp is written in
`overlay-host.tsx`, which this task is forbidden to edit and which another agent was actively
committing to while this work ran. Forcing the attribute to a wrong-but-valid value through
`page.evaluate` proves the assertion is genuinely wired to the attribute and fires when it
disagrees with the table. It does **not** prove the attribute is produced by the table — that is
held instead by `tests/caring-contacts-overlay-definitions.test.ts`, which parses
`interaction-matrix.md` and checks the table row for row, and by
`tests/caring-contacts-overlay-host.dom.test.tsx`. Stated plainly so nobody reads M1 as stronger
than it is. Every other mutation is a real source mutation, applied and reverted, with a clean
`git status` afterwards.

_M6 needed two edits, and that is the finding._ Removing only the shell's own
`focus-visible:outline-2` utilities left all four focus-ring tests **green**, because the app-wide
`:where(button, a, …):focus-visible` rule in `globals.css` still draws a 2px ring. That is the
correct answer — the ring is still there — but it means the assertion protects the application's
focus ring rather than this shell's classes specifically. The spec now says exactly that at
`expectVisibleFocusRing`, replacing a speculative comment about Chromium's `auto` fallback that
the measurement did not support.

## The atlas comparison, under Ruling 62

Full write-up: `docs/caring-contacts/phase-2a-visual-differences.md`.

**What exists.** Phase 2A builds one production screen — `/caring-contacts` (Today) — plus the 24
overlays. Of the 44 committed atlas images, **18 have a production counterpart**: the two Today
screens, and the eight overlay captures at phone and desktop. All 18 were re-captured against the
production routes at the atlas's own device sizes (390×844 and 1440×1000) by a temporary
Playwright capture writing to `.local/caring-contacts-production-atlas/`, and compared image by
image and dimension by dimension against `docs/caring-contacts/atlas/`.

**What does not exist.** The other **26 images — thirteen screens at both device sizes** — are
`/mockups/caring-contacts/**` routes with no production equivalent: `02-patients`,
`03-patient-overview`, `04-patient-agreement`, `05-pathway-selection`, `06-personalisation`,
`07-review-activation`, `08-plan-detail`, `09-schedule`, `10-delivery-exception`, `11-templates`,
`12-team`, `13-guidance`, `14-reports`. They are Plan 2B. **No 44-image comparison happened and
the document says so in its first section**, with the table.

**What differed, on the 18 that were compared.** Seven differences, every one justified; nothing
unexplained was found, and therefore nothing was fixed under this step:

1. **D1 — the Today body is a statement of intent, not the dashboard** (390×2837 → 390×1203;
   1360×1208 → 1184×721). The mockup has a referral queue, a needs-action list, sending windows,
   an activity feed and three counts. Production has the shell, the heading, the unavailable "New
   plan" control, a "What this screen will show" paragraph and the More destinations panel.
   Justified: those dashboard components _are_ the Plan 2B surfaces, and Ruling 52 governs the
   unbuilt destinations. This is the largest difference and it is the declared shape of Phase 2A.
2. **D2 — overlay copy is the frozen matrix's plain Australian English**, not the mockup's.
   Justified: `interaction-matrix.md` is the frozen record and the mockup predates it.
3. **D3 — one renderer, so the mockup's per-overlay content is absent** (the "Availability:" line,
   the GSM-7 segment facts, the privacy-safe note). Justified by Rule 1 of the Task 18 contract.
4. **D4 — the decision control is inline and tone-styled, not a dark footer button.** Justified:
   a footer would require per-overlay-id branching, which Rule 1 forbids.
5. **D5 — the desktop session gate is a 1392×170 letterbox, not a 512×382 dialog.** Justified: the
   frozen matrix gives `session-expiry` the `session-gate` desktop modality and the mockup drew it
   as a dialog. **Flagged for the owner** — see Concerns.
6. **D6 — the offline notice spans the full viewport width** (717×149 → 1440×169). Justified by
   Rule 4: a `status-banner` is `fixed inset-x-0 bottom-0` by design.
7. **D7 — every other panel geometry is identical.** `pathway-preview`, `message-preview` and
   `delivery-exception` are 512×1000 on desktop in both; all eight phone overlays are 390×844 in
   both. This is the part that genuinely demonstrates non-regression.

Four of the brief's five expected differences (the first-contact-date control, the reply-handling
copy, the `closing` message type, nine sendable contacts) turned out **not to be observable**,
because every screen that would show them is Plan 2B. The fifth — genuine `rail` and `split`
compositions at 768 and 1024 — is not in the atlas at all (it samples only 390 and 1440) but is
proved directly by the browser spec at all six widths.

_Capture caveat, recorded so nobody misreads the image:_ the atlas capture hides the fixed phone
dock with an injected style and this capture did not, so the production phone Today image shows
the dock painted across the middle of a full-height screenshot. That is a capture artefact; dock
clearance is asserted at all six widths in the spec.

## The sticky-banner question (Ruling 63)

**Observed, with numbers.** The service-wide safety-stop banner was raised in the isolated
production server (a synthetic stop through `POST /api/caring-contacts/service-state`; the store
died with the run) and measured at all six widths.

The banner is `position: static`, sitting immediately below a `position: sticky` header, and it
is **tall**: 180px at 768 and above, 228px at 390 and 430, 252px at 320.

| Width | Banner at rest | After scrolling to the bottom | Still in view? |
| ----- | -------------- | ----------------------------- | -------------- |
| 320   | y=88, h=252    | y=−602 (scrolled 690)         | **No**         |
| 390   | y=88, h=228    | y=−530 (scrolled 618)         | **No**         |
| 430   | y=65, h=228    | y=−507 (scrolled 572)         | **No**         |
| 768   | y=65, h=180    | y=−285 (scrolled 350)         | **No**         |
| 1024  | y=65, h=180    | y=0 (scrolled 65)             | Yes            |
| 1440  | y=65, h=180    | y=0 (scrolled 65)             | Yes            |

The sticky header stayed pinned at y=0 at every width. So spec §4.2 is satisfied — the banner is
on the screen — but on a phone the clinician scrolls past it within about 600px and it is gone,
and nothing pinned tells them sending is stopped. It survives at 1024 and 1440 today **only
because the Today screen is nearly empty**: the whole document is 965px against a 900px viewport,
so there are 65px to scroll. Plan 2B's dashboard content will remove that accident.

**Recommendation: make it stick, as a condensed one-line bar pinned under the header once the
full banner scrolls out of view.** Pinning the banner as it stands would cost a quarter of a
390×844 phone screen permanently, which is why the recommendation is the condensed form rather
than a bare `sticky` class. If only one change is wanted, pin it — a stop that scrolls away on the
device most of this work happens on is the worse failure of the two.

No positioning was changed. This is the owner's decision, per Ruling 63.

## `verify:pr-local`

The gate was **already red before this task's commits**, on `docs:check-links`, from three
references inside the Task 15 and Task 18 evidence records:

```
docs/caring-contacts/phase-2a-sdd-archive/task-15-report.md:
  MISSING tests/caring-contacts-width-state.ts
  MISSING src/app/caring-contacts/not-found.tsx
docs/caring-contacts/phase-2a-sdd-archive/task-18-report.md:
  MISSING src/components/caring-contacts/workspace/overlays/guard-probe.tsx
docs link check FAILED: 3 missing path(s) across 2304 checked references.
```

The first is a plain typo — the real file is `tests/caring-contacts-width-state.test.ts` — and was
corrected. The other two are deliberately absent and named in prose that should stay byte-stable:
a nested not-found route Task 15 considered and decided against after reading the Next 16 docs,
and a temporary mutation probe Task 18 created, quoted the failure of, and deleted. Both went on
`scripts/check-docs-links.mjs`'s existing `ALLOWLIST`, which exists for exactly that case
("paths that docs intentionally reference although they do not exist"), with a comment naming why
each is there. After that:

```
docs link check passed: 2302 repo path references resolve.
```

**Decisive lines from the full gate:**

<!-- verify:pr-local result: pasted verbatim below -->

The gate ran four times. The first three ended before reaching anything substantial and each is
reported, because a summary that quoted only the last one would hide two real facts about how this
repository behaves under concurrent agents.

**Run 1 — exit 75, blocked, not red.** `lint` could not get the exclusive heavy-run lease:

```
DATABASE_HEAVY_RUN_ADMISSION_BUSY
Another Database heavyweight command is active (PID 42780, worktree D:\Worktrees\Database\cc-2a-live,
started 2026-08-22T06:31:47.361Z): vitest run --reporter=dot
- failed: lint (exit 75)
```

That is the documented "blocked, retry" exit, not a failure. Another agent held the lease with a
full Vitest run in this same worktree; the gate was re-run once it released.

**Runs 2 and 3 — this report's own defects.** `format:changed` flagged this file as unformatted,
then `docs:check-links` flagged an elided path inside it (`…json` reads as a repo path). Both
fixed here.

**Run 4 — everything green except two unrelated timeouts.** `lint` and `typecheck` both passed:

```
- completed: check:runtime, check:installed-lock-parity, format:changed, check:npm-ci-dry-run,
  sitemap:check, docs:check-index, docs:check-inventory, docs:check-scripts, docs:check-links,
  check:branch-review-ledger, check:outstanding-issues, check:ledger-write-discipline, lint, typecheck
- failed: test (exit 1)
- not reached: build, check:rag:fixtures, check:medication-interactions, check:medication-lexicon-report
```

```
 Test Files  2 failed | 699 passed | 2 skipped (703)
      Tests  2 failed | 7774 passed | 29 skipped (7805)
   Duration  687.74s
```

**The two failures are environmental, not a regression, and that was verified rather than
assumed.** Both are 30-second timeouts in tests that shell out to a child process, in files
nothing in this change touches:

```
FAIL |node| tests/codex-cloud-setup.test.ts > writes managed shell policy behaviorally …
FAIL |node| tests/design-sync-contract.test.ts > keeps sources, entry exports, previews … in parity
Error: Test timed out in 30000ms.
```

Re-run on their own, both pass:

```
 Test Files  2 passed (2)
      Tests  41 passed (41)
   Duration  63.91s
```

The 687-second suite ran while other agents held Vitest and lint leases on the same machine, which
is the load these two child-process tests time out under.

**The four steps run 4 never reached were then run directly, and all four passed:**

```
Client bundle secret surface check passed.
Offline RAG fixture and manifest validation passed (36 golden cases, 26 suites).
[medication-interactions] data/medication-interaction-index.json is up to date (525 rows).
[lexicon-report] docs/medication-interaction-lexicon-review.md is up to date (37 catalogue terms).
EXIT=0
```

So every step of `verify:pr-local` has passed, with `test` carrying two machine-load timeouts that
were individually reproduced green.

## Outstanding work recorded

```
npm run issues:add -- --pri P2 --type task --summary "Caring Contacts Phase 2B — the screens" …
Queued add request at docs/outstanding-issues-inbox/a3f85721-7092-45b0-b292-a70b6546e3d1.json.
```

`docs/outstanding-issues.md` was not touched; the inbox file is the only supported route and
`npm run issues:reconcile` runs from its own branch after this one lands.

## Files changed

| File                                                               | Change                                                                                                                  |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `tests/ui-caring-contacts-workspace.spec.ts`                       | 199 → 591 lines, 0 deletions: the overlay matrix, the focus-return tests, the reflow test and the four focus-ring tests |
| `docs/design-system/adoption-manifest.json`                        | regenerated by the pre-commit hook; the spec now names the Sheet and overlay surfaces it drives                         |
| `docs/caring-contacts/phase-2a-visual-differences.md`              | new — the atlas comparison under Ruling 62                                                                              |
| `docs/caring-contacts/phase-2a-sdd-archive/task-15-report.md`      | one corrected file path                                                                                                 |
| `scripts/check-docs-links.mjs`                                     | two intentional absences added to the existing allowlist                                                                |
| the Phase 2B inbox request file (`docs/outstanding-issues-inbox/`) | the Phase 2B request                                                                                                    |
| `docs/caring-contacts/phase-2a-sdd-archive/task-19-report.md`      | this report                                                                                                             |

Not edited, deliberately: `playwright.config.ts`, `scripts/playwright-pr-shards.mjs`,
`tests/playwright-project-isolation.test.ts` (all three already register the spec);
`docs/caring-contacts/interaction-matrix.md`, `overlays/definitions.ts`, `overlay-host.tsx`
(Tasks 17 and 18 own them); `src/app/mockups/caring-contacts/**` and
`src/components/caring-contacts/mockups/**` (the frozen visual baseline).

## Self-review

- **The matrix cannot drift from the table.** Modality, dismissal and the overlay count are all
  read from `WORKSPACE_OVERLAY_DEFINITIONS`; the test _name_ interpolates
  `WORKSPACE_OVERLAY_DEFINITIONS.length`, so a 25th row renames the test rather than being
  silently skipped.
- **The dismissal helper fails closed.** An unrecognised `dismissal` throws rather than defaulting
  to dismissible.
- **The geometry helper fails closed.** An unrecognised modality throws rather than asserting
  nothing — a new modality cannot slip through with no geometry stated.
- **The recovery-only branch proves a negative properly.** It waits 300ms before asserting the
  overlay is still open, so "Escape did nothing" is a settled observation rather than a race.
- **The focus-return opener is simulated, and the spec says so at the point of use.** No control
  in the workspace opens an overlay yet — `workspace-overlays.tsx` states this itself — so the
  test pushes the parameter and dispatches `popstate`, which is what `openWorkspaceOverlay()`
  does. The two things actually under test (the host capturing `document.activeElement`, the
  Sheet restoring to it) are production code reached exactly as a real button would reach them.
  The simulation deliberately pushes a `null` history state, so it behaves identically under both
  the module-variable and the `history.state`-marker versions of `closeWorkspaceOverlay()`.
- **A concurrent agent held uncommitted edits to `overlay-host.tsx` and `workspace-overlays.tsx`
  for part of this session.** Its work landed as `87cfdd40d` and `c727ac227` before the final
  evidence run, so the `18 passed` above is against the committed tree; the earlier identical run
  was against the same content in the working tree. Nothing of theirs was reverted or staged.
- **`deepLinkOverlay` is a real navigation**, not a client-side push — 48 full page loads. Deep
  linking was verified to genuinely work; an apparent failure seen while probing through a
  background browser tab did not reproduce under Playwright and was a hidden-tab artefact.

## Concerns

1. **The desktop session gate reads as a notification bar** (D5). At 1440 it is 1392×170: full
   width, 170px tall, floating in the middle of the screen. The behaviour is right and proved —
   it survives Escape, offers only its recovery action, renders no close control, is modal — but a
   letterbox is not what "you cannot carry on until you sign in again" should look like, and the
   mockup drew a centred 512×382 dialog. Fixing it means changing either the frozen matrix row or
   the shared `Sheet`, both outside this task. **Owner's call.**
2. **A modal overlay with no close control opens with focus on `document.body`.** Measured for
   `session-expiry` at both widths: the shared Sheet's open-focus controller resolves its target
   as `initialFocusRef ?? [data-sheet-autofocus] ?? closeRef`, and a `recovery-only` overlay has
   no header and therefore no `closeRef`, so nothing is focused. The Tab trap still pulls the
   first Tab into the dialog, so it is reachable — but a screen-reader user is announced outside
   an `aria-modal` dialog. Not asserted either way in this spec, because pinning the current
   behaviour would be wrong and pinning the desired behaviour would be a red gate on a fix nobody
   has agreed. `sheet.tsx` is shared design-system code. **Worth an `/issues` row if the owner
   agrees it is a defect.**
3. **The service-state banner scrolls out of view on phones** — see the Ruling 63 section. This is
   an observation with a recommendation, not a change.
4. **M1's DOM-level mutation is weaker evidence than a source mutation**, for the reason given
   above. If the owner wants source-level falsifiability for the modality stamp, the mutation is
   a one-line swap of `phoneModality`/`desktopModality` in `modalityFor()` — but that file was
   under concurrent edit throughout this task and is off-limits to it.
5. **A `run-playwright` invocation once reported a production build failure with no compile error
   in its output** and the identical command immediately afterwards was clean. Not reproduced, not
   explained.
