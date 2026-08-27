# Ward Flow Phase 6 — The morning page

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** one page a bed coordinator opens at the start of a shift that answers "how many beds are
there right now, and where" — built entirely from figures Phase 5 already produces, frozen to a named
morning instant so two people see the same page, printable on one sheet, and able to demonstrate
itself in sixty seconds.

**Architecture:** one new pure derivation module rolls Phase 5's per-unit `capacityBreakdown()` up to
site and service level and computes the oldest-contributor freshness. One new page renders it, frozen
inside a `useState` initialiser exactly as the existing `HandoverPage` does. One new component drives
a four-beat tour by dispatching existing events into the existing reducer. **No new event, no new
reducer case, and no change to `WardFlowState`.**

**Tech Stack:** TypeScript 6 strict, React 19, Next.js 16 App Router, CSS modules with `@theme`
tokens, Vitest (`tests/**/*.test.ts`, `tests/**/*.dom.test.tsx`), Playwright
(`tests/ui-ward-*.spec.ts`, project `chromium-mockups`).

**Spec:** `docs/superpowers/specs/2026-08-27-ward-flow-phase-6-morning-page-design.md`
**Direction and settled decisions:** `docs/ward-flow-roadmap.md`,
`docs/ward-flow-phase-6-7-decisions.md`

---

## Global Constraints

Every task's requirements implicitly include all of these.

- **Never invent a legal figure.** No figure, timeframe, threshold or duration from the Mental Health
  Act may be cited, paraphrased or inferred anywhere in code, copy, comment, test or fixture. A plain
  `Voluntary` / `Involuntary` label is permitted and is not a legal figure. If a figure seems needed,
  stop and report it — do not author one.
- **Synthetic data only.** No name, date of birth, medical record number, address, diagnosis,
  narrative history or treatment. Free text counts as data.
- **Not one new fact about any patient may enter the system in this phase.** This phase adds no field
  to any type that describes a person. If a task appears to need one, it is wrong — report it.
- **The rule Phase 5 exists to hold, which this phase must not break:** nothing predicted,
  confirmed-but-unreleased, or on leave is ever added into "available now". The headline figure is the
  sum of `capacityBreakdown().availableNow` and nothing else, ever.
- **This page computes no figure of its own** (spec D1). Every number is either a field of
  `CapacityBreakdown` or a sum produced by the one new derivation module. No component performs
  arithmetic on beds.
- **One vocabulary** (spec D3). The five figure labels are `Available now`, `Confirmed today`,
  `Predicted today`, `Held`, `Leave (usable)` — defined **once**, next to the derivation, and rendered
  from that one definition at every level. A hardcoded label anywhere fails spec D14.
- **Local and offline checks only.** Never run `verify:release`, any `eval:*` script,
  `check:supabase-project`, `test:live`, or anything touching OpenAI, Supabase, hosted CI or a live
  database.
- **Read the exit status AND the decisive output line.** `node scripts/run-playwright.mjs` exits `75`
  with a `DATABASE_HEAVY_RUN_ADMISSION_BUSY` marker when the run coordinator refuses admission
  (blocked — retry later), propagates Playwright's own status when tests fail (red), and exits 1 on a
  wrapper error. A run can also exit 0 having printed no "N passed" line at all, which proves nothing
  ran. Quote the `N passed` line **and** the status.
- **Take the shared test lease.** Run Vitest through `node scripts/run-vitest.mjs run <files>`, never
  bare `npx vitest`, which bypasses the run coordinator and takes no lease.
- **Every `<button>` must do something** — a handler, a submit inside a form, or navigation.
  `eslint-rules/require-button-wiring.mjs` fails the build otherwise. Never blanket-disable it.
- **Design tokens, not hex.** Production tap targets are `min-h-12` / `3rem`; never "fix" them down to
  `min-h-11`, which reintroduces a known `ui-smoke` flake.
- **Ward Flow is a sandbox.** No new link may point anywhere in the clinical application. The
  developer hub (`/mockups/development`) is the only way out.
- **`MORNING_HANDOVER_MINUTES` is 08:00, expressed once as a named constant**, never as a repeated
  literal, and documented as a synthetic convenience rather than a claim about any real service.
- **Mutation-test every new test.** Break what the test guards, watch it go red, quote the failure
  line in your report, then restore. A test that was never watched to fail is not evidence.

---

## File structure

| File                                                             | Responsibility                                                                                                                    |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/ward-management/ward-morning-rollup.ts`          | **New.** Pure derivations: `MORNING_HANDOVER_MINUTES`, the figure labels, site and service roll-ups, roll-up freshness. No React. |
| `src/components/ward-management/morning/morning-page.tsx`        | **New.** The page: frozen/live pair, service roll-up, per-hospital blocks, print control.                                         |
| `src/components/ward-management/morning/morning.module.css`      | **New.** Its styles, including the phone layout and the `@media print` block.                                                     |
| `src/components/ward-management/morning/morning-tour.tsx`        | **New.** The four-beat guided tour: script, controls, caption strip.                                                              |
| `src/components/ward-management/morning/morning-tour.module.css` | **New.** Its styles, including the reduced-motion branch.                                                                         |
| `src/app/mockups/ward-flow/morning/page.tsx`                     | **New.** Its route.                                                                                                               |
| `src/components/ward-management/ward-nav.ts`                     | The page's nav entry.                                                                                                             |
| `src/components/ward-management/handover/handover-page.tsx`      | One cross-link to the morning page, naming the question each answers (spec D9).                                                   |
| `scripts/ci-change-scope.mjs`                                    | The new route registered in CI's change-scope map.                                                                                |
| `data/repo-awareness-snapshot.json`                              | Regenerated with `npm run snapshot:repo-awareness`. **Never hand-edited.**                                                        |
| `tests/ward-morning-rollup.test.ts`                              | **New.** The derivation's unit tests, including the structural contract test.                                                     |
| `tests/ward-morning-page.dom.test.tsx`                           | **New.** The page's DOM tests: frozen/live pair, never-confirmed floor, label single-sourcing.                                    |
| `tests/ward-morning-tour.dom.test.tsx`                           | **New.** The tour's DOM tests: beats, stop control, reduced-motion branch.                                                        |
| `tests/ui-ward-morning.spec.ts`                                  | **New.** The Chromium journey.                                                                                                    |
| Route-contract test maps                                         | The new route added wherever `discharges` appears in `tests/route-reachability.test.ts` and its sibling map.                      |

---

## Task 1: The roll-up derivation

**Files:**

- Create: `src/components/ward-management/ward-morning-rollup.ts`
- Test: `tests/ward-morning-rollup.test.ts` (create)

**Interfaces:**

- Consumes: `capacityBreakdown`, `CapacityBreakdown` from `ward-bed-availability.ts`; `Instant`,
  `MINUTES_PER_DAY` from `ward-clock.ts`; `Site`, `Unit`, `BedRelease`, `LeaveBed` from
  `ward-model.ts`.
- Produces, and every later task consumes these exact names:

```ts
export const MORNING_HANDOVER_MINUTES = 8 * 60; // 08:00

/** The five figure labels, defined once (spec D3, D14). Every level renders from this. */
export const CAPACITY_FIGURE_LABELS = {
  availableNow: "Available now",
  confirmedToday: "Confirmed today",
  predictedToday: "Predicted today",
  held: "Held",
  leaveUsable: "Leave (usable)",
} as const;

export type RollupFreshness =
  | { kind: "confirmed"; oldestConfirmedAt: Instant; unitsConfirmed: number; unitsTotal: number }
  | { kind: "partial"; oldestConfirmedAt: Instant; unitsConfirmed: number; unitsTotal: number }
  | { kind: "never" };

export type CapacityRollup = CapacityBreakdown & {
  unitsTotal: number;
  freshness: RollupFreshness;
};

export type UnitRollup = { unit: Unit; breakdown: CapacityBreakdown; freshness: RollupFreshness };
export type SiteRollup = { site: Site; rollup: CapacityRollup; units: UnitRollup[] };
export type ServiceRollup = { service: CapacityRollup; sites: SiteRollup[]; at: Instant };

export function morningHandoverInstant(now: Instant): Instant | null;
export function serviceRollup(sites: Site[], releases: BedRelease[], leave: LeaveBed[], now: Instant): ServiceRollup;
```

**Rules, each of which gets its own test:**

1. Every figure in a `CapacityRollup` is the plain sum of the corresponding `CapacityBreakdown` field
   across the units below it. Nothing is re-derived.
2. `freshness` uses the **oldest** contributing `unit.allocatable.confirmedAt`, never the newest
   (spec D4).
3. `kind` is `"never"` when **no** unit below has ever confirmed; `"partial"` when at least one has
   and at least one has not, carrying `unitsConfirmed` and `unitsTotal`; `"confirmed"` when all have.
4. `morningHandoverInstant(now)` returns the 08:00 instant of `now`'s operating day when
   `now >= that instant`, and **`null`** when `now` is earlier in the day. It never returns a previous
   day's instant and never falls back to `now` (spec D5).
5. A unit with no `allocatable.confirmedAt` at all counts as never-confirmed. Treat a unit as
   never-confirmed when `unit.allocatable.confirmedAt` is absent or not a finite number — do not
   invent a sentinel value.

**Operating day** is `Math.floor(instant / MINUTES_PER_DAY)`, the same expression `releaseBand()`
already uses in `ward-bed-availability.ts`. Reuse the concept; do not introduce a second definition of
a day.

- [ ] **Step 1: Write the failing tests**

Cover all five rules above, plus this structural contract test, which is spec D2's protection and must
be written as its own named test with its reasoning in a comment:

```ts
it("never lets a release or a leave bed reach the headline figure", () => {
  const withReleases = serviceRollup(sites, seededReleases, seededLeaveBeds, NOW_ANCHOR);
  const withNone = serviceRollup(sites, [], [], NOW_ANCHOR);
  // availableNow is computed from unit.allocatable/unit.empty before any release is examined.
  // If a release could ever reach it, these two would differ.
  expect(withReleases.service.availableNow).toBe(withNone.service.availableNow);
});
```

- [ ] **Step 2: Run them and watch them fail**

```bash
node scripts/run-vitest.mjs run tests/ward-morning-rollup.test.ts --reporter dot
```

- [ ] **Step 3: Implement the module**

Pure functions only, no React, no JSX, no imports from a component file.

- [ ] **Step 4: Mutation-test every new test**

At minimum: change the oldest-confirmed reduction to take the newest and watch rule 2's test go red;
make `morningHandoverInstant` fall back to `now` and watch rule 4's test go red. Quote both failure
lines in your report, then restore.

- [ ] **Step 5: Run, watch pass, commit**

```bash
node scripts/run-vitest.mjs run tests/ward-morning-rollup.test.ts --reporter dot
git add src/components/ward-management/ward-morning-rollup.ts tests/ward-morning-rollup.test.ts
git commit -m "Roll Phase 5's per-unit figures up to hospital and service, oldest confirmation wins"
```

---

## Task 2: The morning page

**Files:**

- Create: `src/components/ward-management/morning/morning-page.tsx`
- Create: `src/components/ward-management/morning/morning.module.css`
- Create: `src/app/mockups/ward-flow/morning/page.tsx`
- Test: `tests/ward-morning-page.dom.test.tsx` (create)

**Interfaces:**

- Consumes: everything Task 1 produced; `useWardFlow()` from `ward-flow-provider.tsx`;
  `WardFreshness` from `ward-freshness.tsx`; `formatInstant` from `ward-clock.ts`.
- Produces: `export function MorningPage()`, default-exported route at `/mockups/ward-flow/morning`
  with `metadata.title = "Morning bed state — Ward Flow"`.

**The freeze, and it must be done this way** (spec D5): read `now` **once** inside a `useState`
initialiser and hold it, exactly as `handover/handover-page.tsx` does — read that file's doc comment
before writing this. No section of the page may read `now` from `useWardFlow()` again while the fixed
view is selected. Freeze to `morningHandoverInstant(now)`, not to `now`.

**Layout, top to bottom:**

1. The "not a medical device" prose banner, matching the five screens that already carry one.
2. The headline: **Beds available right now**, one number, service-wide, with its own freshness stamp.
3. The remaining four figures, in `CAPACITY_FIGURE_LABELS` order, rendered from that constant.
4. The beyond-tonight exclusion count, **stated even when it is zero**.
5. The fixed/live control: `Handover 08:00` | `Live HH:MM`. Visibly different states, not colour
   alone — colour alone fails under forced-colors and in print.
6. One block per hospital in site-table order, each with its own five figures and freshness, and its
   units beneath.
7. A print control, and a one-line cross-link to `/mockups/ward-flow/handover` naming the question
   each page answers (spec D9).

**No sort control, no filter, no column chooser, no collapsible section, no saved preference**
(spec D7). Order is the site table's order, always.

**Failure branches, each of which gets a test:**

- `morningHandoverInstant(now)` is `null` → render "The 08:00 handover has not been taken for this
  day", offer the live view, and show **no figures at all** for the fixed view. Never a previous day's
  snapshot, never a silent fall back to `now`.
- `freshness.kind === "never"` → the unit or roll-up reads `Never confirmed`, never `0`.
- `freshness.kind === "partial"` → state it in words: `14 of 15 wards confirmed · 1 never confirmed`.
- A site with no units → render it with `No units recorded`. Never omit the site.

- [ ] **Step 1: Write the failing tests**

Cover every failure branch above, the frozen/live pair, and this label test, which is what makes spec
D14's cheap reversal real rather than aspirational:

```tsx
it("renders every figure label from the one definition, so a model change is three strings", () => {
  render(<MorningPage />);
  for (const label of Object.values(CAPACITY_FIGURE_LABELS)) {
    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  }
});
```

- [ ] **Step 2: Run them and watch them fail**

```bash
node scripts/run-vitest.mjs run tests/ward-morning-page.dom.test.tsx --reporter dot
```

- [ ] **Step 3: Implement the page, its styles and its route**

Follow `ward-role-switcher.module.css`'s self-contained-token convention: declare every `--ward-*`
this file uses on its own root class. Tokens only, no hex.

The `@media print` block starts from `handover/handover.module.css`'s — read its comments first. It
already solves two traps: the global print reset forces a white page, and `CanvasText` is used so ink
colour follows the print medium rather than inheriting a screen theme that is nearly invisible on
paper. Print hides the rail, the chrome, the fixed/live control and the print button itself.

- [ ] **Step 4: Mutation-test every new test**

At minimum: make the null-handover branch fall back to `now` and watch that test go red; replace one
rendered label with a hardcoded string and watch the label test go red. Quote both failure lines,
then restore.

- [ ] **Step 5: Run, watch pass, commit**

```bash
node scripts/run-vitest.mjs run tests/ward-morning-page.dom.test.tsx --reporter dot
git add src/components/ward-management/morning src/app/mockups/ward-flow/morning tests/ward-morning-page.dom.test.tsx
git commit -m "The morning bed state: one page, frozen to the handover, five figures, one vocabulary"
```

---

## Task 3: The sixty-second guided tour

**Files:**

- Create: `src/components/ward-management/morning/morning-tour.tsx`
- Create: `src/components/ward-management/morning/morning-tour.module.css`
- Modify: `src/components/ward-management/morning/morning-page.tsx` (mount the tour)
- Test: `tests/ward-morning-tour.dom.test.tsx` (create)

**Interfaces:**

- Consumes: `useWardFlow()` and existing `WardFlowEvent` variants only.
- Produces: `export function MorningTour()`.

**Four beats, in this order, each dispatching real events into the real reducer with the real acting
role, through the same `EVENT_ROLE` gate every screen uses** (spec D10):

| Beat | What it shows               | Acting role   |
| ---- | --------------------------- | ------------- |
| 1    | A patient waiting           | `demo`        |
| 2    | A coordinator finding a bed | `coordinator` |
| 3    | A ward confirming           | `ward`        |
| 4    | The board updating          | —             |

**Hard requirements:**

- **No new event, no new reducer case, and no change to `WardFlowState`.** Read
  `ward-flow-events.ts` and pick from the variants that already exist. If a beat cannot be expressed
  with an existing event, report it as a concern rather than adding one — that would be a finding
  about the model, not a licence to extend it.
- Tour progress (which beat, running or not) lives in **local component state only** and never enters
  the reducer's shared state (spec D11).
- It **begins with `RESET_SCENARIO`** and says so on screen, and **ends by resetting**.
- A **Stop** control is visible for the tour's whole duration, is a real control with a real handler,
  and takes effect at the current beat.
- Under `prefers-reduced-motion: reduce` the tour **does not auto-advance**. Same four beats, a
  **Next** control, no timed transitions, no animation (spec D12). Detect it with
  `window.matchMedia("(prefers-reduced-motion: reduce)")`, guarded for absence, and mirror the
  approach already used in the ward-flow CSS modules for the styling half.
- A caption strip stays visible for the whole duration, states that every figure is invented, and
  describes what the screen is doing — **never what is clinically correct** (spec D13).
- A refused dispatch surfaces as the existing `Rejection` and the tour **stops at that beat** rather
  than skipping ahead.
- Tap targets `min-h-12` / `3rem`.

- [ ] **Step 1: Write the failing tests**

Cover: the four beats advance in order; Stop halts at the current beat and does not advance further;
under a mocked reduced-motion match the tour does not auto-advance and a Next control is present; the
caption strip is present at every beat.

- [ ] **Step 2: Run them and watch them fail**

```bash
node scripts/run-vitest.mjs run tests/ward-morning-tour.dom.test.tsx --reporter dot
```

- [ ] **Step 3: Implement the tour, its styles, and mount it on the page**

- [ ] **Step 4: Mutation-test every new test**

At minimum: make Stop a no-op and watch that test go red; make the reduced-motion branch auto-advance
and watch that test go red. Quote both failure lines, then restore.

- [ ] **Step 5: Run, watch pass, commit**

```bash
node scripts/run-vitest.mjs run tests/ward-morning-tour.dom.test.tsx --reporter dot
git add src/components/ward-management/morning tests/ward-morning-tour.dom.test.tsx
git commit -m "A sixty-second tour that drives the real reducer and stops when told"
```

---

## Task 4: Registration, so the route is not an orphan

**Files:**

- Modify: `src/components/ward-management/ward-nav.ts`
- Modify: `src/components/ward-management/handover/handover-page.tsx`
- Modify: `scripts/ci-change-scope.mjs`
- Modify: `tests/route-reachability.test.ts` and its sibling route-contract map
- Regenerate: `data/repo-awareness-snapshot.json`

**This is the fail-closed part and all five places travel together.** Phase 5's discharge board needed
exactly these five; find each by searching for `discharges` and add the morning route alongside it.

- [ ] **Step 1: Find every registration site**

```bash
grep -rn "ward-flow/discharges" --include=*.ts --include=*.tsx --include=*.mjs --include=*.json src tests scripts data
```

Report what you find. If there are more than five, register all of them; if fewer, say which are
missing and why.

- [ ] **Step 2: Add the morning route to each**

Nav entry title **Morning bed state**, in the Boards group, using the existing nav-icon convention.
Internal navigation uses `<Link>` — never a raw `<a href="/…">`.

- [ ] **Step 3: Regenerate the snapshot with the repo's own tool**

```bash
npm run snapshot:repo-awareness
```

Never hand-edit `data/repo-awareness-snapshot.json`.

- [ ] **Step 4: Prove reachability and scope**

```bash
node scripts/run-vitest.mjs run tests/route-reachability.test.ts --reporter dot
npm run sitemap:check
npm run check:repo-awareness-snapshot
```

Quote the decisive line from each.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Register the morning page in all five fail-closed places"
```

---

## Task 5: The Chromium journey

**Files:**

- Create: `tests/ui-ward-morning.spec.ts`

**One journey**, in project `chromium-mockups`, following `tests/ui-ward-discharges.spec.ts`'s shape:

1. The fixed page renders and states its instant.
2. The live toggle changes the instant, and the two views are distinguishable in the DOM.
3. The tour runs to completion and the board visibly changes at beat 4.
4. **Stop** halts the tour at the current beat.

**Prove it can fail before trusting it.** Mutate the page (for example, make the live toggle a no-op),
run the spec, quote the red failure line, then restore and quote the green line.

**Read the exit status AND the "N passed" line.** `75` with a `DATABASE_HEAVY_RUN_ADMISSION_BUSY`
marker means blocked — retry later, do not report it as a pass or a failure. Any other non-zero is
red. Exit 0 with no "N passed" line means nothing ran.

```bash
node scripts/run-playwright.mjs tests/ui-ward-morning.spec.ts --project=chromium-mockups
```

- [ ] **Step 1: Write the spec**
- [ ] **Step 2: Run it, quote the status and the count**
- [ ] **Step 3: Prove it can fail, quote the red line, restore**
- [ ] **Step 4: Commit**

---

## Task 6: Verification sweep and the screenshots

**Files:** none, unless a defect is found — in which case fix it with a regression assertion that
would catch its return, and report both.

**This is the task that has historically found the real defects.** Phase 4 and Phase 5 each shipped
defects that were invisible to more than ten thousand passing tests and were caught only by looking at
the rendered screen.

- [ ] **Step 1: Start the server the repo's own way**

```bash
npm run ensure
```

Use the URL it prints. **Never assume `localhost:3000`.** Verify project identity via
`/api/local-project-id` before attaching.

- [ ] **Step 2: Capture and LOOK AT the morning page at 390, 820 and 1440**

Capture the fixed view, the live view, and at least one mid-tour beat at each width. Report body
overflow, `h1` count, and console errors for each.

- [ ] **Step 3: Capture and LOOK AT the printed page**

Render at print width. Confirm: one sheet, portrait, no dark background, no empty control boxes, no
content that only exists behind an interaction, and legible ink.

- [ ] **Step 4: Check the whole-page vocabulary by eye**

Read every bed figure on the screen at once and confirm no two places describe the same beds with
different words. This is exactly the check that caught Phase 5's four defects.

- [ ] **Step 5: Report honestly**

For each item: proven by test, proven by screenshot, or not proven. Do not report a screenshot as
proof of something you did not look at.

---

## Self-review

Before reporting DONE, each implementer confirms in its report:

- Every new test was mutation-tested, with the quoted failure line.
- No new field describing a person was added anywhere.
- No Mental Health Act figure appears in code, copy, comment, test or fixture.
- No component performs arithmetic on beds (spec D1).
- Every figure label is rendered from `CAPACITY_FIGURE_LABELS` (spec D14).
- Every `<button>` has a handler, a submit, or navigation.
- No hex colours; tap targets are `min-h-12` / `3rem`.
- Commands were run through `scripts/run-vitest.mjs` / `scripts/run-playwright.mjs`, and both the
  exit status and the decisive output line were read and quoted.

## Parallelism

Tasks 1 → 2 → 3 are strictly serial: each consumes what the previous produced. Task 4 depends on
Task 2's route existing. Task 5 depends on Tasks 2 and 3. Task 6 is last and depends on everything.

**There is no genuine fan-out in this phase** — it is a small, linear phase, and pretending otherwise
would produce file conflicts for no gain. Dispatch one implementer at a time.

The expensive checks — full unit suite, lint, format, build, browser, screenshots — run **once at the
end**, not after every task, because the heavyweight lock is machine-wide and other sessions queue
behind it.
