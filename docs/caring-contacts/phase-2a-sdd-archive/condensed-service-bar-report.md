# Condensed service-stop bar — report

Closes the defect Task 19's browser proof measured: with a service-wide stop active, the full
service-state banner sits in normal flow beneath a `sticky` header, so at 320, 390, 430 and 768 px
it scrolls **completely out of view** (measured y from −285 to −602), and survives at 1024 and 1440
only because the one built page is nearly empty. Spec §4.2 requires the stop to be visible on every
screen while it is active, and a statement that has scrolled away states nothing.

The owner's decision, implemented here: a **condensed one-line bar**, pinned once the full banner
has gone. Not the full banner pinned — that costs about a quarter of a phone screen at all times,
on every screen.

---

## 1. What was built, and the shape chosen

Three source changes and one new pair of modules.

**The bar is an absolutely positioned child of the workspace's sticky `<header>`, at `top-full`.**
That single decision is the whole shape, and it buys three properties without a magic number:

1. **It rides the header.** No second `sticky` element, and no pin offset to get wrong.
2. **It is out of flow.** Revealing it moves no content. A bar that pushed the page down as it
   appeared would push the banner it is watching back towards view — the oscillation this avoids
   by construction rather than by hysteresis.
3. **It inherits the header's stacking context**, so it needs no `z-index` of its own. It covers
   page content; the phone dock (`--z-chrome`) and the overlay layer (`--z-modal`) still cover it.
   No new `z-` value was introduced at all.

The measured reason a fixed offset was never an option: the header is **87.5 px** tall at 320 and
390 (its contents wrap there) and **65 px** from 430 up, against a `--header-h` token of **64 px**.
Any offset written down would have buried the bar behind the header at every single review width.

**Wording** (`condensedServiceStopStatement`):

> `Sending stopped for the whole service. 0 of 3 restart approvals recorded.`

- The state label `Sending stopped` is the _same constant_ the full banner uses, not a second copy.
- `for the whole service` is retained deliberately. Abbreviating to "Sending stopped" alone would
  read as one patient's plan having halted — a **weaker and vaguer** claim than the banner's, which
  the brief forbids. Everything the bar says is a strict subset of what the banner says.
- The approval count is read from the facts and from `REQUIRED_RESTART_APPROVAL_ROLES.length` on
  every render, never frozen — a pinned bar still saying "0 of 3" after two approvals would be
  staler than the banner directly above it.
- The reason category and the outstanding roles are left to the full banner: one line cannot carry
  them at 320 px, and the banner is one scroll away.

**Status through text, icon and structure, never colour alone.** The words carry the state; the
`OctagonX` icon is `aria-hidden` decoration on top of them. Asserted in JSDOM, and asserted again
in the browser under `forced-colors: active`, where the author tint is dropped entirely.

**Only ever one statement.** The bar is displayed exactly when the banner's bottom edge has passed
the header's bottom edge — which is where the bar begins. The two therefore cannot be on screen at
the same moment; it is a mutual exclusion in geometry, not a coincidence of timing.

**Accessibility.** The bar is `aria-hidden="true"`. The full banner is still in the document and
still announces as the single `role="status"`. A screen-reader user does not scroll past anything,
so a second live region would say the same thing twice — the same failure mode in the aural channel
that the owner named in the visual one.

**Print.** `print:hidden`. The print rule in `globals.css` makes the header `position: static` so
the synthetic marker survives a printout; an absolutely positioned child would then drop onto the
printed content.

---

## 2. How the incident note is kept structurally unreachable

`ServiceState.note` is free text a responder types mid-incident, classified as patient data.

- The bar renders from **`ServiceStopBannerFacts`**, the type that omits `note` by construction —
  exactly as `describeServiceStop` and `StoppedServiceBanner` already do. `CondensedServiceStopBar`
  takes the whole `ServiceState` (because that is what a caller holds), reads two fields, and hands
  them to `CondensedStoppedBar`, where the note is not in scope.
- **Nothing derived from the record crosses a client boundary.** The one new Client Component,
  `service-stop-scroll-watcher.tsx`, **takes no props at all** and renders `null`. It decides _when_
  the bar is shown and never _what it says_. This is the same technique — and the same stated
  reason — as `overlays/workspace-overlays.tsx`.
- Proof that the type actually holds, rather than the comment holding it: interpolating
  `${facts.note}` into the statement is a **compile error**, not a judgement call.

  ```
  src/components/caring-contacts/workspace/service-state-banner.tsx(120,70): error TS2339:
  Property 'note' does not exist on type '{ stopped: true; reason: ServiceStopReason;
  restartApprovals: readonly ServiceRestartApproval[]; }'.
  ```

---

## 3. Client allowlist

One entry added to `ALLOWED_CLIENT_COMPONENTS` in
`tests/caring-contacts-explained-automation.dom.test.tsx`: **`service-stop-scroll-watcher.tsx`**,
with a comment giving its reason and its three conditions.

Why a client boundary was unavoidable: a scroll position and two element rectangles are browser
facts. There is no CSS-only expression of "reveal B once A has left the region below a sticky
header whose height is not a token" — the two candidate CSS techniques were considered and rejected
(a grid-stacked sticky bar covered by the banner hides by _occlusion_ rather than absence, and
breaks wherever a background is not opaque; scroll-driven `animation-timeline: view()` degrades to
its base state on any engine that does not support it, which for a safety surface is a bet rather
than a guarantee).

Why it is safe under the standing condition:

- It receives **no `serviceState`-derived prop under any name** — it receives no props at all.
- Its source names neither `service-state` nor `ServiceState` (checked by the companion test that
  covers every allowlist entry). It imports only three id strings and one attribute name from
  `service-stop-bar-anchors.ts`, a module holding nothing but strings.
- The bar it toggles is **server-rendered from the note-free facts type**, so the wording never
  enters the client module graph.
- Server render is `data-full-banner-out-of-view="false"`, so a browser that never runs the script
  shows no bar. That is the conservative direction: the workspace degrades to exactly the behaviour
  it had before this change, and can never show two statements of one stop.

**Next.js 16 docs read** (from `node_modules/next/dist/docs/`):
`01-app/01-getting-started/05-server-and-client-components.md` — specifically the RSC Payload
section ("Any props passed from a Server Component to a Client Component" are in the payload), which
is the exact mechanism the no-props design defends against, and the note at line 178 that Server
Components passed as children are rendered on the server rather than entering the Client
Component's module graph. Directory listing of `01-app/03-api-reference/01-directives/use-client.md`
was located but the boundary semantics needed came from the getting-started guide.

---

## 4. TDD evidence

Test first, watched fail for the stated reason, then built.

**Red** — six new DOM tests written against a bar that did not exist:

```
 Test Files  1 failed (1)
      Tests  5 failed | 17 passed (22)
```

(Five of the six failed; the sixth — "renders nothing at all while the service is running" — passes
vacuously before the bar exists, which is expected and is why it is not counted as proof on its own.
Its mutation is M4 below.)

**Green** — after building, DOM tests plus the untouched shell suite:

```
 Test Files  2 passed (2)
      Tests  32 passed (32)
```

**Browser, first run** — and it found a real defect nothing else could (§6):

```
  4 failed
  27 passed (3.0m)
```

**Browser, after the fix**:

```
  31 passed (1.5m)
```

Exit code **0** — a real completed run, not the `75` /
`DATABASE_HEAVY_RUN_ADMISSION_BUSY` lock-contention refusal.

---

## 5. Mutation evidence

Every mutation below was checked twice: that it changes a value some assertion reads, **and** that
it reddens the assertion it was meant to prove rather than tripping an earlier one.

| #   | Mutation                                                                   | Reddened                                                                                                                   | Reached the intended assertion?                                                                                                                                                                                                                                                                |
| --- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | Drop `for the whole service` from the statement                            | `states that sending is stopped for the whole service, in words`, line 441                                                 | Yes. The preceding `Sending stopped` assertion (line 438) passed — visible in the received text `"Sending stopped. 0 of 3 restart approvals recorded."`                                                                                                                                        |
| M2  | Freeze the count: `const recorded = 0`                                     | `carries the same restart-approval count the full banner carries`, line 458                                                | Yes. Failed on the `recorded === 1` loop iteration, so the `recorded === 0` iteration passed through the same assertion first                                                                                                                                                                  |
| M3  | Remove `aria-hidden="true"` from the bar                                   | `adds no second announced statement of the same stop`, line 490                                                            | Yes. The preceding `getAllByRole("status")).toHaveLength(1)` (line 489) passed, because the bar carries no role                                                                                                                                                                                |
| M4  | Render the bar even when the service is running                            | `renders nothing at all while the service is running`, line 427                                                            | Yes — the only assertion in that test, and the rendered bar is shown in the failure output                                                                                                                                                                                                     |
| M5  | Interpolate `${facts.note}`                                                | `tsc --noEmit`, TS2339                                                                                                     | Structural: it never reaches a test at all, which is the point                                                                                                                                                                                                                                 |
| M6  | Add a control inside the bar                                               | `adds no second control competing with the banner's service-stop control`, line 499                                        | Yes — the added `<button>` appears in the failure output                                                                                                                                                                                                                                       |
| B1  | Display the bar unconditionally (`hidden` → `flex`, drop the data variant) | `keeps the stop stated exactly once at every scroll position` at **all six widths**, at the "statements at rest" assertion | Yes. Both preceding `toHaveCount(1)` assertions passed. The failure prints exactly the owner's failure mode: two objects on screen, `#caring-contacts-service-stop-banner` (top 88, bottom 339) **and** `#caring-contacts-condensed-service-stop` (top 87, bottom 141). `8 failed / 23 passed` |
| B2  | Watcher never reveals the bar (`outOfView ? "false" : "false"`)            | see below                                                                                                                  | see below                                                                                                                                                                                                                                                                                      |

B2 result — `9 failed / 22 passed (4.9m)`, and it reddened in both of the two places the bar's
whole purpose lives:

```
Error: statements at scroll 320 at 320px
  Expected length: 1
  Received length: 0
  Received array:  []
  > 763 |  expect(statements, `statements at scroll ${offset} at ${width}px`).toHaveLength(1);

Error: the condensed bar did not appear at 320px
  Expected: true   Received: false
  > 824 |  expect(geometry.barDisplayed, `the condensed bar did not appear at ${width}px`).toBe(true);
```

Reachability: the invariant test failed at scroll **320** (200 at 768 px), meaning the earlier
offsets 40, 80, 120 and 200 passed through the _same_ assertion first — so it is the intended
assertion that reddened, mid-loop, not an earlier one. The pin test failed at line 824, having
already passed the `bannerGone` branch check above it. Received length `0` is exactly the defect
this whole change exists to close: the stop stated nowhere on screen.

Two assertion groups did **not** need a synthetic mutation, because they failed for real on the
first implementation and were fixed — which is stronger evidence than a mutation (§6).

---

## 6. The defect the browser found, that nothing else could

The first implementation gave the bar `-inset-x-4 sm:-inset-x-6 lg:-inset-x-8` to "undo" the
header's own padding, on the reasoning that an absolutely positioned child is laid out against the
padding box.

That reasoning is half right and the wrong half. The containing block **is** the padding box — and
a padding box is measured **outside** the padding, not inside it. So `inset-x-0` already spans the
header's full width, and the negative insets pushed the bar past the header on each side:

```
Error: condensed bar left edge at 320px      Expected: 0    Received: -16
Error: condensed bar left edge at 768px      Expected: 80   Received: 56
```

Typecheck, lint and all twenty-two DOM tests were green with that bug in place. Only the browser's
left/right edge assertions could see it. Fixed by using plain `inset-x-0`; the bar keeps its own
`px-4 sm:px-6 lg:px-8` so its content still lines up with the header's.

---

## 7. Browser evidence

Command (against the isolated production build `run-playwright.mjs` makes for itself):

```
node scripts/run-playwright.mjs tests/ui-caring-contacts-workspace.spec.ts --project=chromium
```

Decisive line, final run:

```
  31 passed (1.5m)
```

Exit code **0**. Not exit `75`, and no `DATABASE_HEAVY_RUN_ADMISSION_BUSY` marker — the run
genuinely executed. (Focused Vitest runs during mutation testing were refused several times with
`Database focused-test capacity is full` from another worktree; those were retried, never counted.)

Thirteen of the thirty-one tests are new. Nothing above them in that file was rewritten, weakened,
or deleted; the file only grew, and the eighteen pre-existing tests still pass unchanged.

What the new tests assert:

- **At all six review widths (320, 390, 430, 768, 1024, 1440), at every sampled scroll offset**
  (0, 40, 80, 120, 200, 320, 480 and the bottom of the document), **exactly one** statement of the
  stopped state is on screen, and it always carries the service-wide scope. "On screen" is
  deliberately _not_ Playwright's `toBeVisible()`, which counts an element with a box as visible
  even when it has scrolled far above the viewport — that is precisely the defect being fixed, so
  the naive assertion would have reported the broken page as fine. On screen here means displayed
  **and** overlapping the region below the sticky header. Sampling across the range rather than only
  at the ends is what covers the handover: a gap in it would be a moment with no statement, an
  overlap a moment with two.
- **At all six widths**, once the banner has gone: the bar is displayed, sits at or below the
  header's bottom edge, is within the viewport, is **topmost at its own centre** (via
  `elementFromPoint`, so nothing is painted over it), spans the header's full width exactly, does
  not reach the phone dock, and adds no horizontal overflow. Where the page is too short for the
  banner to leave (this can happen at 1024/1440 with only the Task 15 page built), the same test
  asserts the bar stays **away** instead.
- **Dark** and **forced colours**: the bar resolves real ink and a real surface in dark, and under
  `forced-colors: active` the stop is still stated exactly once, in words, with the scope intact.

---

## 8. Arranging a stopped service, and a finding worth recording

The browser test raises the stop through the **real HTTP boundary** —
`POST /api/caring-contacts/service-state` — so no test-only hook was added to production code. It
accepts `service-already-stopped` as the same arranged condition, because the first record of an
incident is permanent by design.

The stop is **irreversible in the demo**: restarting needs three approvals from three _different_
people, and only two demo roles (`teamLead`, `clinicalProgrammeLead`) hold `approveServiceRestart`.
The new block is therefore declared **last** in the spec file. `run-playwright.mjs` starts a fresh
server for every run, and the config is `fullyParallel: false` with `workers: 1`, so every test
above it still runs against a running service exactly as before.

**Finding (not fixed here, and worth the owner's attention):** in the **dev server**, the workspace
page cannot see a stop raised through the API at all. Verified directly — after a clean restart,
`POST` then `GET` on `/api/caring-contacts/service-state` both report `stopped: true`, and the
access-trail route (a _different_ route handler) sees the `stopService` event, so route handlers
share one store; but `GET /caring-contacts` renders no banner. Turbopack gives app **pages** and
app **route handlers** separate module registries, so `store.ts`'s module-scope `cachedStore` — the
in-memory reference store's only copy of its data — is a different object on each side. The
production build (webpack, shared server chunks through Node's require cache) does share it, which
is why the browser proof works. The practical consequence: **the service-state banner cannot be
demonstrated in `npm run dev` at all**, and any future workspace screen that writes through the API
and reads back on a page will behave the same way. This is a dev-mode-only architectural gap in the
demo store, not something this change introduced or should fix.

---

## 9. Files changed

| File                                                                        | Change                                                                                                                                           |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/components/caring-contacts/workspace/service-stop-bar-anchors.ts`      | **New.** Three DOM ids and one attribute name. Strings only, so the watcher can share them without importing anything that could carry the note. |
| `src/components/caring-contacts/workspace/service-stop-scroll-watcher.tsx`  | **New.** The one new Client Component. No props, renders `null`, toggles one attribute from a one-read-per-frame `scroll`/`resize` handler.      |
| `src/components/caring-contacts/workspace/service-state-banner.tsx`         | Added `id` to the full banner; added `condensedServiceStopStatement`, `CondensedStoppedBar` and `CondensedServiceStopBar`.                       |
| `src/components/caring-contacts/workspace/shell.tsx`                        | Added `id` to the header; rendered `<CondensedServiceStopBar>` inside it.                                                                        |
| `tests/caring-contacts-explained-automation.dom.test.tsx`                   | Six new DOM tests; one deliberate allowlist entry with its reason. Nothing existing changed.                                                     |
| `tests/ui-caring-contacts-workspace.spec.ts`                                | Thirteen new browser tests appended. Nothing existing changed.                                                                                   |
| `docs/caring-contacts/phase-2a-sdd-archive/condensed-service-bar-report.md` | This report.                                                                                                                                     |

---

## 10. Self-review

- **No existing assertion deleted or loosened.** Both test files only gained lines. The one edit
  inside an existing structure is the additive `ALLOWED_CLIENT_COMPONENTS` entry, which the brief
  sanctions explicitly and which _tightens_ rather than loosens: the companion test immediately
  holds the new entry to the same three proofs as the others.
- **Repository contracts.** `min-h-tap`, never `min-h-11`. Tokens only — every colour is
  `var(--danger-*)` / `var(--text)`, no hex, no raw pixel lengths, no `dark:` colour override. **No
  `z-` value was added at all**, which is the strongest form of compliance with the ladder for a
  pinned element. `widthStateFor` is untouched and no second breakpoint or `matchMedia` was written
  — the bar has no width-dependent behaviour. Lucide icon carries `aria-hidden`. No new `<button>`.
- **Prohibited vocabulary.** The statement contains none of the forbidden terms, makes no claim
  that replies are monitored, and uses no transport word as a state label. Australian English,
  sentence case, no bare dash.
- **Verification actually run:** focused Vitest (green), `tsc --noEmit` (clean), `eslint` on all
  five changed files (clean), the full offline suite, and the Chromium browser proof.

## 11. Concerns

1. **No-JavaScript degradation is silent.** With scripting off the bar never appears and the page
   behaves as it did before this change. That is the conservative direction and it was chosen
   deliberately, but it does mean the §4.2 guarantee rests on a client script in that one case.
2. **Dev mode cannot show the banner at all** (§8). Not introduced here, but it means a reviewer
   who checks this by hand in `npm run dev` will see nothing and may conclude the bar is broken. It
   must be reviewed against a production build.
3. **1024 and 1440 are proved conditionally.** With only the Task 15 page built, the document at
   those widths may be too short for the banner to leave view, so the pin assertion takes its
   "stays away" branch there. The exactly-one-statement invariant still covers them unconditionally.
   Once Phase 2B fills those pages the pin branch will start exercising, which is the intent.
4. **The bar's height is not literally one line at 320 px.** The statement wraps to two lines on the
   narrowest phone. It is `min-h-tap` and grows; it is still roughly a quarter of the full banner's
   height, which is what the owner's decision was buying.
