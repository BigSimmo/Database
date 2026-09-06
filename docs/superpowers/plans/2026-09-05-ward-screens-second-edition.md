# Ward Screens — Second Edition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the two ward screens — `/mockups/ward-flow/ward/[unitId]` and
`/mockups/ward-flow/board/[unitId]` — on the second-edition Board design language, adding the
functionality the approved mockups show.

**Architecture:** The visual language already exists as one file and is not re-derived here. The
work is: extend the shared ward token layer with the roles the second edition adds, build the new
components as shared primitives rather than screen-local markup, then move each screen onto them.
The ward home screen has never adopted the token layer at all, so it is a bigger job than the board.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6 strict, CSS Modules with
`composes:`, Vitest for unit and DOM tests, Playwright for journeys.

**Spec:** 🔴 **the ward home screen is built from
`docs/ward-flow/design/prototypes/mockup-ward-home-v4.html`, NOT v3.** The owner locked v4 in on
2026-09-05 after asking for the sizes, the heading, the colour scheme, a where-to-refer panel and a
daily summary. **v3 is kept, unchanged apart from the shared style block, and is no longer the
spec** — it is the record of what was approved earlier that night, and it contains one sentence
about the ready figure that v4 exists partly to correct. The board is still built from
`mockup-ward-board-v3.html`. Both share `design-language.html`, the style block held once.

⚠️ **`DESIGN-LANGUAGE.md` is unchanged and still governs Ward Flow.** The owner locked in these
mockups; he did not rule on whether their style block replaces the first edition elsewhere, and this
plan does not assume he did.

**What v4 changes that this plan must build, beyond what v3 showed** — each is a task note below, and
each is composition rather than a new primitive except where said:

- The heading is a name, a one-line sentence of identity, and a single accented bed-split chip —
  not six equal chips. Its right-hand side is a small call-to-action box (`.head-cta`) that routes
  to the questions panel.
- **One alarm colour on the figures strip.** `Out of service` and `Occupied` carry no tone.
- The first tile is labelled **`Ready`**, which is what `CAPACITY_FIGURE_LABELS.availableNow`
  already says, and its caption states that one of the three is already pulled.
- **`Today on this ward`** — full width under the strip: the six `CAPACITY_FIGURE_LABELS` figures
  and the day as recorded. **No roster, ward round or meeting**, because the model holds none.
- **`Where to refer`** — in the bed column after the discharges, drawing `ward-catchment.ts` and
  showing all four `CatchmentLookup` states, including the two that refuse to return one answer.
- **The referral decisions live in the middle column**, not the rail. The rail carries only what is
  read rather than acted on.
- **Six bed tiles to a row** at the three-column breakpoint, and one tile height for all eighteen.
- **`.btn--go`** — the route to the bed board, in both places, with one label.
- The print fix is **already hoisted** into the canonical block (2026-09-05); Task 2's
  `forced-colors` decision D3 is unaffected, but do not re-add a print token block anywhere. Every rule in
  `DESIGN-LANGUAGE.md` that is about clinical safety rather than appearance still binds here and is
  listed under Global Constraints below. Read `docs/ward-flow/design/screen-adoption-playbook.md` before Task 1 — it is 455 lines
  of traps, every one of which passes every gate in the repository.

---

## Global Constraints

Every task's requirements implicitly include this section.

- **Tokens only. No raw hex, and no `color-mix` either.** The playbook's rule: a blended colour is a
  raw colour computation the hex sweep cannot see, and it reads as _more_ careful adoption than a
  hardcoded value. If a role is missing, add a token in Task 1 — do not blend one at the call site.
- **Match tokens by VALUE, never by name.** `--ward-leading-body` is 1.4 and a screen's
  `--xx-leading-body` may be 1.45; the correct target is then `--ward-leading-relaxed`. No test in
  this repository renders a line box.
- **State is a word before it is a colour.** Every chip, tile and marker carries text. A coloured
  edge may only reinforce a word already present.
- **Contrast floor 4.5:1, computed against every surface the text can sit on, in both themes.**
  Re-derive; never quote a figure from a document.
- **A screen root paints nothing.** `WardGround` owns the ground. Do not repoint a root background
  to `--ward-ground` — that looks exactly like adoption and is the same mistake in the Board's own
  vocabulary.
- **Never delete a `@media` block or a `composes:` line without diffing it by name.** Check
  `forced-colors`, `print`, `prefers-reduced-motion`, `:focus-visible` **and** every `composes:` on
  the root rule, before and after. 2 of 11 ward files carry their reduced-motion protection as a
  `composes:` line with no `@media` anywhere.
- **Zero raw `#hex` may be added to any stylesheet.** `board/board.module.css` is already in
  `KNOWN_HEX_BACKLOG` for `#ff9ca4 #fff #000` and in `KNOWN_FONT_BACKLOG`; those rows may only
  shrink, never grow.
- **Never use `--text-soft` on a text node.** It is `3.07:1`, and the design system counts it as a
  decoration-only compatibility alias that production code must not consume. `board.module.css`
  already reasons its way to `--text-muted` in three separate comments; a rebuild must not undo
  that. Ward Builder One found and fixed 22 such misuses on another surface this week — the UMRN
  column, every date of birth, every reference and its elapsed time.
- **A red row, bar or rule carries the word that says why — and ⚠️ check the number beside it
  agrees.** A flagged row showing the _smallest_ elapsed time of three, because its urgency came
  from a deadline rather than a duration, is a real defect found on this project this week. Colour
  and the only figure in the row said opposite things, and both were individually correct.
- **Never `git add -A`.** Another agent may share this worktree.
- **Commit each coherent unit** — a component and its test, a stylesheet and its contract run.

## Verified facts this plan rests on

Measured on `codex/task-ward-flow-live-state-20260831`, 2026-09-05. Re-derive anything you are about
to depend on; these will go stale.

| Fact                         | Value                                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `--clinical-accent`          | `var(--primary-500)` = `#1d6fb8` — **identical to the mockup's accent**                                        |
| `--clinical-accent-strong`   | `var(--primary-700)` = `#185c99` — identical to the mockup's `--accent-strong`                                 |
| `--ward-tap`                 | already exists, `var(--spacing-tap)` = `3rem`                                                                  |
| App radius steps             | `--radius-xs` 0.25rem, `--radius-sm` 0.375rem, `--radius-md` 0.625rem                                          |
| App elevation                | `--shadow-card`, `--shadow-hover`, `--shadow-overlay`                                                          |
| `ward/ward.module.css`       | 811 lines, 61 classes, **zero `composes:` — has never adopted the token layer**                                |
| `board/board.module.css`     | 2,288 lines, 119 classes, `composes: wardTokens` at line 35                                                    |
| `ward/ward-screen.tsx`       | 1,982 lines, `export function WardScreen({ unitId }: { unitId: string })`                                      |
| `board/ward-board.tsx`       | 1,798 lines, `export function WardBoard({ unitId }: { unitId: string })`                                       |
| Radius tokens in ward CSS    | `--radius-md` 110, `--radius-sm` 70, `--radius-lg` 65, `--radius-xs` 15 — used directly; **add no ward alias** |
| Shadow tokens in ward CSS    | **zero of any kind** — elevation is new to this layer                                                          |
| `Admission` → patient        | via `referralId` → `Referral.patientId?`, **optional by design**                                               |
| Files composing `wardTokens` | 28                                                                                                             |
| `COVERING_THE_GROUND`        | `["statistics/statistics.module.css"]` — neither ward file is in it                                            |
| Ward test files in scope     | 17 (listed in Task 0)                                                                                          |

⚠️ **The mockup's radii (5/8/12px) have no exact match in the app.** Nearest by value are
`--radius-xs` (4px), `--radius-sm` (6px), `--radius-md` (10px). **Use the app's steps directly** —
the ward stylesheets already do, 260 times. Ward Flow is a scoped layer over the v2 palette, not a
second palette, and a 1–2px difference is not visible. **Adding a parallel `--ward-radius-*` scale is
the start of a fork, and the first draft of this plan proposed exactly that.**

---

## Decisions that gate work, and who owns them

**Do not start the gated task until the decision is recorded.** Each names the owner.

| #   | Decision                                                                                                                                                                                                                                                                                    | Gates        | Owner                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ---------------------------------------- |
| D1  | **Should a bed reach a patient directly, or only through the referral that created it?** ⚠️ CORRECTED — a link already exists (`Admission.referralId` → `Referral.patientId`) and is optional BY DESIGN, so some occupied beds correctly have no person. Task 13 recommends adding nothing. | Task 13 only | Product owner                            |
| D2  | **May interpreter language be displayed on a ward board?** `ward-patients.ts` marks it and Aboriginal/Torres Strait Islander status "NOT SETTLED FOR DISPLAY" pending the Aboriginal health review. A ward board is exactly where interpreter need would be acted on.                       | Task 13 only | Product owner + Aboriginal health review |
| D3  | **Should `ward-tokens.module.css` carry a `forced-colors` block** so adopting screens can delete theirs? The adoption playbook handed this back unanswered. **This plan answers it yes** (Task 2) — reverse it there if the owner disagrees.                                                | Task 2       | Ward Lead, recorded                      |

**Nothing else in this plan is blocked.** Tasks 1–12 and 14–15 proceed regardless of D1 and D2; Task
13 is the only one that touches them, and it has a defined path for either answer.

---

## File Structure

**New files**

| Path                                                                   | Responsibility                                                                            |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/components/ward-management/ward-app-bar.tsx` + `.module.css`      | The sticky application bar: product mark, switcher slot, page segment, right-hand actions |
| `src/components/ward-management/ward-switcher.tsx` + `.module.css`     | The ward switcher popover — search, hospital groups, ready counts                         |
| `src/components/ward-management/ward-kpi.tsx` + `.module.css`          | `WardKpi` / `WardKpiStrip` — the toned figure tiles                                       |
| `src/components/ward-management/ward-bed-map.tsx` + `.module.css`      | `WardBedMap`, `WardBedTile`, `WardOccupancyBar` — shared by both screens                  |
| `src/components/ward-management/ward-record-panel.tsx` + `.module.css` | The board's selected-bed record panel                                                     |
| `tests/ward-design-language-canonical.test.ts`                         | Pins the canonical block identical across the v3 prototypes                               |
| `tests/ward-forced-colors-tokens.test.ts`                              | Pins that the shared layer declares a forced-colors block                                 |

**Modified**

| Path                                                    | Change                                                            |
| ------------------------------------------------------- | ----------------------------------------------------------------- |
| `src/components/ward-management/ward-tokens.module.css` | New roles: radius, elevation, accent aliases, forced-colors block |
| `src/components/ward-management/ward/ward.module.css`   | Adopt the token layer (it composes nothing today), then rebuild   |
| `src/components/ward-management/ward/ward-screen.tsx`   | Rebuild onto the primitives and the approved layout               |
| `src/components/ward-management/board/board.module.css` | Rebuild onto the shared bed map and record panel                  |
| `src/components/ward-management/board/ward-board.tsx`   | Same, plus bed tiles become buttons                               |

**Why these boundaries:** the bed map is the only component both screens render, and it is the one
that carries a clinical distinction (locked versus open beds). Putting it in one file is what stops
the two screens disagreeing about what a bed state looks like — which is the defect the whole second
edition exists to prevent.

---

## Task 0: Establish the baseline before touching anything

**Files:** none — this task writes no code.

- [ ] **Step 1: Confirm this worktree is yours and no peer owns these files**

Run:

```bash
cat /c/Users/joshs/.claude/worktree-ownership.md | head -40
git -C D:/Worktrees/Database/ward-lead status --porcelain
```

Expected: a clean tree, and no other live chat claiming `ward-lead`. If another branch holds
`src/components/ward-management/ward/ward-screen.tsx`, stop and hand back.

- [ ] **Step 2: Run both contract tests BY NAME and record what you saw**

⚠️ **Do this first, not after.** Once you have edited a file, a red you inherited and a red you
caused are indistinguishable.

```bash
node scripts/run-vitest.mjs run --reporter=dot tests/ward-design-language-contract.test.ts tests/ward-primitives-shared.test.ts
```

⚠️ **`npm run test:focused` will never select these.** It is `vitest related --run`, which picks by
the import graph, and 16 ward test files import nothing from `src/` — they read stylesheets off disk
with `readFileSync`. A focused green structurally omits the only guard on the rule you are changing.

- [ ] **Step 3: Run the seventeen ward screen and board tests, discovered from disk**

Do not hand-pick this list; hand-picked subsets have shipped red twice on this project.

```bash
node scripts/run-vitest.mjs run --reporter=dot $(ls tests/ward-screen*.ts tests/ward-screen*.tsx tests/ward-board*.ts tests/ward-board*.tsx)
```

- [ ] **Step 4: Write the baseline to the ledger file**

Record the exact counts — files, tests, passed, failed — and name every pre-existing failure. State
the denominator: "1,138 files" and "17 files" are different sentences and neither can be mistaken
for the other.

- [ ] **Step 5: Commit nothing.** This task produces a record, not a change.

---

## Task 1: Map the mockup's tokens onto the app's, by value

**Files:**

- Read: `docs/ward-flow/design/prototypes/design-language.html`
- Read: `src/components/ward-management/ward-tokens.module.css`
- Create: `docs/ward-flow/design/token-map-2026-09-05.md`

**Interfaces:**

- Produces: a table every later task reads, mapping each `--<mockup token>` to the `--ward-*` token
  it becomes. Tasks 2 and 4–13 use only names from this table.

- [ ] **Step 1: Extract every custom property the canonical block declares**

```bash
grep -oE "^\s+--[a-z0-9-]+:" docs/ward-flow/design/prototypes/design-language.html | tr -d ' :' | sort -u
```

- [ ] **Step 2: For each, find the ward token with the same VALUE**

For a colour, resolve it to a hex and compare hexes. For a length, compare rem values. Do not match
`--faint` to a ward token because both are called faint.

- [ ] **Step 3: Write the table with three columns — mockup token, ward token, and one of
      `exact` / `nearest (Δ)` / `MISSING`**

Every `MISSING` row is an input to Task 2. Every `nearest` row records the delta so a reviewer can
see what was accepted.

- [ ] **Step 4: Commit**

```bash
git add docs/ward-flow/design/token-map-2026-09-05.md
git commit -m "docs(ward-flow): map the second edition's tokens onto the app's, by value"
```

---

## Task 2: Add the one role the ward layer is missing

⚠️ **CORRECTED 2026-09-05, after Ward Builder One's finding and an independent re-measure.** The
first version of this task added `--ward-radius-*` and `--ward-elevation-*` aliases. **That was
wrong and would have started the fork this plan spends a paragraph warning against.** Measured
across `src/components/ward-management/**/*.css`:

| Token            | Uses in ward stylesheets                  |
| ---------------- | ----------------------------------------- |
| `--radius-md`    | 110                                       |
| `--radius-sm`    | 70                                        |
| `--radius-lg`    | 65                                        |
| `--radius-xs`    | 15                                        |
| `--ward-radius*` | 4, and all four are `--ward-radius-pixel` |

**The ward stylesheets already use the app's radius tokens directly, 260 times.** `ward-tokens`
aliases ckb-v2 surfaces and text in the same way (`--ward-canvas: var(--surface)`). Adding a fifth
name for a thing already named would be a fork with 260 existing counter-examples.

**So: use `--radius-xs`, `--radius-sm` and `--radius-md` directly. Add no radius token.**

Elevation measured at **zero uses of any shadow token in any ward stylesheet** — `--shadow-card`,
`--shadow-hover`, `--shadow-overlay`, `--shadow-lift` and any `--ward-*` equivalent all return 0. The
second edition introduces elevation to this layer for the first time. Follow the radius precedent
and use the app's `--shadow-card` / `--shadow-hover` / `--shadow-overlay` directly.

⚠️ **This leaves Task 1's table with fewer `MISSING` rows than expected. That is the right answer,
not a shortfall** — most of the second edition's palette already exists in the app under its own
name, which is exactly why the accent matched to the byte.

**The only genuinely new role is high-contrast handling — and it is narrower than the first draft
of this plan said.**

⚠️ **CORRECTED after Ward Builder One challenged the claim and a re-measure sharpened it.** The
first draft said the shared layer had no forced-colors handling at all. **Too broad.**
`src/app/ckb-v2-tokens.css:427` carries a `@media (forced-colors: active)` block re-pointing **83
tokens**, scoped to `.ckb-v2.ckb-v2` — and `.ckb-v2` sits on the `<html>` element
(`src/app/layout.tsx:124`), so **every ward screen is already inside it**.

Measured: of the ward layer's 19 colour roles, **11 inherit high-contrast handling automatically**
because they alias a v2 token that block re-points — `--ward-canvas: var(--surface)`,
`--ward-text: var(--text)`, `--ward-blue: var(--clinical-accent)` and eight more.

**Eight do not:**

| Uncovered role                           | Resolves to                       | Why it is not covered                                   |
| ---------------------------------------- | --------------------------------- | ------------------------------------------------------- |
| `--ward-border`                          | `--neutral-500`                   | the v2 block re-points `--border`, not the neutral ramp |
| `--ward-divider`                         | `--neutral-500`                   | same                                                    |
| `--ward-success` / `--ward-success-soft` | `--success-text` / `--success-bg` | status colours are not in the v2 block                  |
| `--ward-warning` / `--ward-warning-soft` | `--warning-text` / `--warning-bg` | same                                                    |
| `--ward-danger` / `--ward-danger-soft`   | `--danger-text` / `--danger-bg`   | same                                                    |

🔴 **The original conclusion survives and is now precise: the two roles carrying every panel edge
and every row rule are exactly the two that inherit nothing.** A screen that adopts the layer and
deletes its own forced-colors block does lose its high-contrast borders — but keeps its text and
its surfaces, which is why the defect is easy to miss by looking at it.

**Files:**

- Modify: `src/components/ward-management/ward-tokens.module.css`
- Create: `tests/ward-forced-colors-tokens.test.ts`

**Interfaces:**

- Consumes: Task 1's table.
- Produces: a `forced-colors` block on `.wardTokens`. No new custom property names.

- [ ] **Step 1: Re-derive the counts above before trusting them**

```bash
for t in radius-xs radius-sm radius-md radius-lg ward-radius shadow-card shadow-hover; do
  printf "%-14s %s\n" "--$t" "$(grep -rho -- "--$t\b" src/components/ward-management/*.css src/components/ward-management/*/*.css | wc -l)"
done
```

If these disagree with the table, the table is stale and yours is right. Update it.

- [ ] **Step 2: Write the failing forced-colors test**

```ts
// tests/ward-forced-colors-tokens.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const TOKENS = join(process.cwd(), "src/components/ward-management/ward-tokens.module.css");

describe("the shared ward layer carries its own high-contrast handling", () => {
  /*
   * ⚠️ Before this existed, NOTHING in the shared layer had a forced-colors block —
   * not ward-tokens, ward-panel, ward-chip or ward-figure, all four measured at zero.
   * A screen that adopted the layer and deleted its own block was not inheriting a
   * replacement, it was losing high-contrast borders outright, and no test in this
   * repository renders under forced colours, so nothing said so.
   *
   * ⚠️ THIS FILE IS INVISIBLE TO `npm run test:focused`. It reads a stylesheet off
   * disk and imports nothing from src/, so `vitest related` can never select it.
   * Run it by name.
   */
  it("re-points its border and text roles under forced-colors", () => {
    const css = readFileSync(TOKENS, "utf8");
    const at = css.indexOf("@media (forced-colors: active)");
    expect(at, "no forced-colors block in the token layer").toBeGreaterThan(-1);
    const block = css.slice(at);
    for (const token of ["--ward-border", "--ward-divider", "--ward-danger", "--ward-warning"]) {
      expect(block, `${token} is not re-pointed under forced colours`).toContain(`${token}:`);
    }
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

```bash
node scripts/run-vitest.mjs run --reporter=dot tests/ward-forced-colors-tokens.test.ts
```

Expected: FAIL on `no forced-colors block in the token layer`.

- [ ] **Step 4: Add the block to `.wardTokens`**

```css
/* ⚠️ EXACTLY the eight roles ckb-v2's own forced-colors block does not reach.
     The other eleven ward colour roles alias a v2 token that block re-points
     and already inherit correctly; re-pointing them here too would bury which
     eight were actually broken, and the next reader could not tell the list
     from a guess.

     This COLLAPSES the semantic hues into one, which is the mode working as
     intended. It is survivable only because every state on these screens
     already carries its own word. */
@media (forced-colors: active) {
  --ward-border: CanvasText;
  --ward-divider: CanvasText;
  --ward-success: CanvasText;
  --ward-success-soft: Canvas;
  --ward-warning: CanvasText;
  --ward-warning-soft: Canvas;
  --ward-danger: CanvasText;
  --ward-danger-soft: Canvas;
}
```

- [ ] **Step 5: Run it and watch it pass.**

- [ ] **Step 6: Mutate to prove the guard can fail**

Delete the `--ward-border` line from the new block, re-run, confirm RED naming `--ward-border`,
restore it, then verify the restore by content:

```bash
git diff --stat src/components/ward-management/ward-tokens.module.css
```

Expected after restore: no diff for that line. ⚠️ **A guard that has never been seen red is not
evidence.**

- [ ] **Step 7: Run both contract tests by name, then commit.**

---

## Task 3: Adopt the token layer on the ward home stylesheet

`ward/ward.module.css` contains **zero** `composes:` lines. This is the one purely mechanical task
in the plan and it is large; keep it separate so it can be reviewed on its own.

**Files:**

- Modify: `src/components/ward-management/ward/ward.module.css`
- Test: `tests/ward-design-language-contract.test.ts`, `tests/ward-screen.dom.test.tsx`

- [ ] **Step 1: Read the whole stylesheet first, comments included.** They carry decisions no test
      encodes, and at least one will stop you deleting something load-bearing.

- [ ] **Step 2: Record every protection by name, before you touch anything**

```bash
grep -nE "@media|composes:|:focus-visible" src/components/ward-management/ward/ward.module.css
```

Keep this output. Step 7 diffs against it.

- [ ] **Step 3: Add `composes: wardTokens from "../ward-tokens.module.css";` to the root rule**, then
      remap every local token to its `--ward-*` equivalent using Task 1's table.

- [ ] **Step 4: Fix `--wd-tap-target`**

`ward.module.css:124` uses it and **it is declared nowhere in `src/`**. An undefined custom property
is not a CSS error, not a warning and not a test failure. Replace it with `var(--ward-tap)`.

- [ ] **Step 5: Delete any root background declaration and leave a comment where it was**

The shell owns the ground. Do not repoint it to `--ward-ground`.

- [ ] **Step 6: Repoint the `forced-colors` block — do not delete it.** If the file's border token
      was split into outline and divider roles, the block must set **both** `--ward-border` and
      `--ward-divider`.

- [ ] **Step 7: Diff the protections by name**

Re-run the Step 2 command and compare. Every block and every `composes:` line present before must be
present after.

- [ ] **Step 8: Run the screen's own tests, then both contract tests, then typecheck**

```bash
node scripts/run-vitest.mjs run --reporter=dot tests/ward-screen.dom.test.tsx tests/ward-design-language-contract.test.ts tests/ward-primitives-shared.test.ts
npm run typecheck
```

⚠️ **Vitest runs no typechecker.** A green suite says nothing about types.

- [ ] **Step 9: Commit**

---

## Task 4: `WardAppBar`

**Files:**

- Create: `src/components/ward-management/ward-app-bar.tsx`, `ward-app-bar.module.css`
- Test: `tests/ward-app-bar.dom.test.tsx`

**Interfaces:**

- Produces:

```ts
export function WardAppBar({
  productName,
  switcher,
  pages,
  liveness,
  action,
}: {
  productName: string;
  switcher?: ReactNode;
  pages?: { label: string; href: string; current: boolean }[];
  liveness?: ReactNode;
  action?: ReactNode;
}): JSX.Element;
```

- [ ] **Step 1: Write the failing test**

```tsx
it("marks the current page and never clips the switcher", () => {
  render(
    <WardAppBar
      productName="Ward Flow"
      pages={[
        { label: "Ward home", href: "/a", current: false },
        { label: "Bed board", href: "/b", current: true },
      ]}
    />,
  );
  expect(screen.getByRole("link", { name: "Bed board" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Ward home" })).not.toHaveAttribute("aria-current");
});
```

- [ ] **Step 2: Run it and watch it fail** — expected: `WardAppBar is not defined`.

- [ ] **Step 3: Implement it**, composing `wardTokens` on the root and using `--ward-elevation-1`.

⚠️ **Never set `overflow` on the bar.** The switcher's popover escapes it, and an `overflow` of any
value creates a containing block that clips it.

- [ ] **Step 4: Run it and watch it pass.**

- [ ] **Step 5: Commit.**

---

## Task 5: `WardSwitcher`

**Files:**

- Create: `src/components/ward-management/ward-switcher.tsx`, `ward-switcher.module.css`
- Test: `tests/ward-switcher.dom.test.tsx`

**Interfaces:**

- Consumes: `wardSites` from `src/components/ward-management/ward-sites.ts`, and
  `designationSummary` from `ward-bed-designation.ts`.
- Produces:

```ts
export function WardSwitcher({
  currentUnitId,
  readyByUnitId,
}: {
  currentUnitId: string;
  readyByUnitId: ReadonlyMap<string, number>;
}): JSX.Element;
```

- [ ] **Step 1: Write the failing tests — three of them**

```tsx
it("lists every unit the model holds, not the nine the prototypes drew", () => {
  render(<WardSwitcher currentUnitId="fsh-adult-secure" readyByUnitId={new Map()} />);
  // Floored on the POPULATION, so it fails loudly rather than passing over an empty set.
  const units = allUnits();
  expect(units.length).toBeGreaterThan(20);
  for (const unit of units) {
    expect(screen.getByText(unit.name)).toBeInTheDocument();
  }
});

it("marks the current ward in words as well as with aria-current", () => {
  render(<WardSwitcher currentUnitId="fsh-adult-secure" readyByUnitId={new Map()} />);
  const row = screen.getByRole("link", { name: /FSH Adult Secure/ });
  expect(row).toHaveAttribute("aria-current", "true");
  expect(row).toHaveTextContent(/you are here/i);
});

it("renders a ready count of zero as the word none, never as 0", () => {
  render(<WardSwitcher currentUnitId="fsh-adult-secure" readyByUnitId={new Map([["rgh-adult-secure", 0]])} />);
  const row = screen.getByRole("link", { name: /RGH Adult Secure/ });
  expect(row).toHaveTextContent(/none/i);
});
```

- [ ] **Step 2: Run them and watch all three fail.**

- [ ] **Step 3: Implement with `<details>`/`<summary>`.** A disclosure that works without JavaScript
      is the correct default for a control this important. Hide the marker with both
      `list-style: none` and `summary::-webkit-details-marker { display: none }`.

- [ ] **Step 4: Run them and watch them pass.**

- [ ] **Step 5: Mutate to prove the population floor works.** Change the floor from `20` to `200`,
      re-run, confirm RED, restore, confirm by content.

- [ ] **Step 6: Commit.**

---

## Task 6: `WardKpiStrip`

**Files:**

- Create: `src/components/ward-management/ward-kpi.tsx`, `ward-kpi.module.css`
- Test: `tests/ward-kpi.dom.test.tsx`

**Interfaces:**

- Produces:

```ts
export type WardKpiTone = "neutral" | "good" | "signal" | "crit" | "accent";
export function WardKpi({
  label,
  value,
  caption,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  caption?: string;
  tone?: WardKpiTone;
}): JSX.Element;
export function WardKpiStrip({ children }: { children: ReactNode }): JSX.Element;
```

⚠️ **This is deliberately not `WardFigure`.** `WardFigure` takes `flagged: boolean` — one attention
state. The second edition needs five tones, and widening `flagged` into an enum would change every
existing caller. Build beside it and retire `WardFigure` only when nothing imports it.

- [ ] **Step 1: Write the failing test, including the zero rule**

```tsx
it("renders a zero as the word none", () => {
  render(<WardKpi label="Out of service" value={0} />);
  expect(screen.getByText(/none/i)).toBeInTheDocument();
  expect(screen.queryByText("0")).not.toBeInTheDocument();
});

it("caps attention tones at two per strip", () => {
  // The rule is a design rule, so the guard is a lint on the composed strip.
  render(
    <WardKpiStrip>
      <WardKpi label="a" value={1} tone="signal" />
      <WardKpi label="b" value={2} tone="crit" />
      <WardKpi label="c" value={3} tone="signal" />
    </WardKpiStrip>,
  );
  expect(screen.getByTestId("ward-kpi-tone-warning")).toHaveTextContent(/3 attention tones/);
});
```

- [ ] **Step 2: Run and watch both fail.**
- [ ] **Step 3: Implement.** The strip lays out 2 / 3 / 5 by width, with a lone final tile spanning
      at the two-column step — five items never leave an orphan row.
- [ ] **Step 4: Run and watch them pass.**
- [ ] **Step 5: Commit.**

---

## Task 7: `WardBedMap`

The one component both screens render, and the one carrying a clinical distinction.

**Files:**

- Create: `src/components/ward-management/ward-bed-map.tsx`, `ward-bed-map.module.css`
- Test: `tests/ward-bed-map.dom.test.tsx`

**Interfaces:**

- Consumes: `unitHasLockedBeds`, `unitHasOpenBeds`, `lockedBedsFree`, `openBedsFree` from
  `ward-bed-designation.ts`.
- Produces:

```ts
export type BedTileKind = "ready" | "held" | "blocked" | "occupied" | "waiting" | "leave";
export type BedTile = {
  number: number;
  kind: BedTileKind;
  locked: boolean;
  stayDays: number | null;
  bandLabel: string | null;
  note: string | null;
  marks: string[];
};
export function WardBedMap({
  tiles,
  detail,
  onSelect,
  selectedBedNumber,
}: {
  tiles: readonly BedTile[];
  detail: "capacity" | "people";
  onSelect?: (bedNumber: number) => void;
  selectedBedNumber?: number;
}): JSX.Element;
export function WardOccupancyBar({ tiles }: { tiles: readonly BedTile[] }): JSX.Element;
```

`detail: "capacity"` renders the ward-home tile (state and note only); `detail: "people"` renders the
board tile (stay, band, markers). One component, two densities — **not two components**, because two
would be free to disagree about what a bed state looks like.

- [ ] **Step 1: Write the failing tests**

```tsx
it("groups beds into the locked bay and the open beds, and says what each means", () => {
  render(<WardBedMap tiles={FIXTURE} detail="capacity" />);
  expect(screen.getByRole("heading", { name: /locked bay/i })).toBeInTheDocument();
  expect(screen.getByText(/only beds that can hold a detained patient/i)).toBeInTheDocument();
  expect(screen.getByText(/a detained patient cannot be placed here/i)).toBeInTheDocument();
});

it("carries every state as a word, not only as a colour", () => {
  render(<WardBedMap tiles={FIXTURE} detail="capacity" />);
  for (const word of ["Ready", "Held", "Out of service", "Occupied"]) {
    expect(screen.getAllByText(word).length).toBeGreaterThan(0);
  }
});

it("keeps a state with no members in the key rather than dropping it", () => {
  const noneHeld = FIXTURE.filter((t) => t.kind !== "held");
  render(<WardBedMap tiles={noneHeld} detail="capacity" />);
  // Absence is stated, never blank.
  expect(screen.getByText(/held/i).closest("li")).toHaveTextContent(/none/i);
});

it("selects a bed with a button, not a link", () => {
  const onSelect = vi.fn();
  render(<WardBedMap tiles={FIXTURE} detail="people" onSelect={onSelect} selectedBedNumber={9} />);
  const bed = screen.getByRole("button", { name: /bed 09/i });
  expect(bed).toHaveAttribute("aria-pressed", "true");
  // A link takes Enter but not Space, and selecting a bed is not navigation.
  expect(screen.queryByRole("link", { name: /bed 09/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run and watch all four fail.**

- [ ] **Step 3: Implement.**

⚠️ **Give `.bed` `grid-template-columns: minmax(0, 1fr)`.** A grid item keeps `min-width: auto` and
will grow past its track to fit a `white-space: nowrap` marker, spilling over the next tile. This was
measured during the mockup: tile 145.9px, its own top row 272px. Constraining the marker does
nothing — the tile is the overflowing box.

- [ ] **Step 4: Run and watch them pass.**

- [ ] **Step 5: Add the overflow guard**

```tsx
it("keeps every tile's content inside its own tile", () => {
  const { container } = render(<WardBedMap tiles={FIXTURE} detail="people" />);
  // jsdom has no layout, so this is a STRUCTURAL pin on the rule that prevents it.
  const css = readFileSync(BED_MAP_CSS, "utf8");
  expect(css).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});
```

⚠️ **Say in a comment that this is structural, not observed.** jsdom does no layout; the only real
proof is the browser measurement in Task 15.

- [ ] **Step 6: Commit.**

---

## Task 8: Rebuild the ward home screen

**Files:**

- Modify: `src/components/ward-management/ward/ward-screen.tsx` (1,982 lines)
- Modify: `src/components/ward-management/ward/ward.module.css`
- Test: the six `tests/ward-screen*.{ts,tsx}` files

**Interfaces:**

- Consumes: `WardAppBar`, `WardSwitcher`, `WardKpiStrip`, `WardBedMap` from Tasks 4–7.
- Produces: no new exports. `WardScreen({ unitId })` keeps its signature.

- [ ] **Step 1: Run the six ward-screen tests and record the baseline.**

- [ ] **Step 2: Replace the hero and governance banner with the app bar, masthead and scope note.**

⚠️ **`.heroCta` carries neither `disabled` nor `aria-disabled` under any value of `confirmedToday`,
and two independent assertions pin that** — the words and the missing attributes both. A coordinator
decision is never blocked, only recorded. Keep that true of whatever replaces it.

- [ ] **Step 3: Replace the bed chips with `WardBedMap detail="capacity"`.**

- [ ] **Step 4: Rebuild the three daily questions as a table with inline controls.** Nothing
      stretches: the "Confirm capacity" control is a three-character field and a small button.

- [ ] **Step 5: Add the four features the mockup shows and the screen lacks**

  - the coordinator's refresh-request mark (`latestRefreshRequest` already exists and is rendered —
    keep it, move it to the offering panel header)
  - the decline reasons opened inline, from `REFERRAL_DECLINE_REASONS` and `DECLINE_REASON_LABELS`
  - "Being made ready", from `BED_PREPARATION_NOTES`
  - the leave-bed form — both questions about the **bed**, nothing about the person

- [ ] **Step 6: Run the six tests, both contract tests, and typecheck.**

- [ ] **Step 7: Commit.**

---

## Task 9: Ward home — the three-column layout

Split from Task 8 so a reviewer can reject the layout without rejecting the features.

**Files:** `ward-screen.tsx`, `ward.module.css`

- [ ] **Step 1: Lay the body out as `.grid` — one column, two from 62rem, two plus a 21rem rail from
      90rem.**

- [ ] **Step 2: Assign each column one job** — what the ward has (bed map, beds out, coming in),
      what it is asked to say (the questions, the offer, flagging a bed), and what is waiting on a
      person here (attention, referrals, arrivals).

- [ ] **Step 3: Check the columns end within roughly one panel of each other.** A column ending far
      short reads as a missing panel. Move a panel rather than padding one.

- [ ] **Step 4: Run the six tests and both contract tests.**

- [ ] **Step 5: Commit.**

---

## Task 10: Ward home — phone

**Files:** `ward.module.css`, `tests/ward-sidebar-phone-contract.test.ts`

- [ ] **Step 1: Read `docs/search-chrome-behaviour.md`** before touching any phone chrome. The
      one-composer rule and the hidden-means-zero-reserve rule are gated.

- [ ] **Step 2: Confirm controls reach `--ward-tap` under `(pointer: coarse)` and below 40rem.**

- [ ] **Step 3: Run `npm run verify:phone-chrome`.** Its smart selector must keep focused
      owner/journey proof before any recommended full `verify:ui` escalation.

- [ ] **Step 4: Commit.**

---

## Task 11: Rebuild the bed board

**Files:**

- Modify: `src/components/ward-management/board/ward-board.tsx` (1,798 lines)
- Modify: `src/components/ward-management/board/board.module.css` (2,288 lines)
- Test: the eight `tests/ward-board*.{ts,tsx}` files

- [ ] **Step 1: Run the eight board tests and record the baseline.**

- [ ] **Step 2: Replace the local bed grid with `WardBedMap detail="people"`.**

- [ ] **Step 3: Fix the borrowed spacing scale**

`board.module.css` uses another screen's `--sd-*` spacing tokens and declares **zero** of its own;
its rendered 14px padding comes entirely from the literal fallback written beside each `var()`.
Replace with `--ward-space-*` by value. This is what lets its `KNOWN_HEX_BACKLOG` and
`KNOWN_FONT_BACKLOG` rows shrink.

- [ ] **Step 4: Remove only your own rows from the pinned lists, and only the ones your change
      actually freed.** `board.module.css` appears in three: `KNOWN_HEX_BACKLOG`,
      `KNOWN_FONT_BACKLOG`, and `KNOWN_BREAKPOINTS` (at 60 and 84). If you change a breakpoint,
      update that row rather than deleting it.

- [ ] **Step 5: Run the eight tests, both contract tests, and typecheck.**

- [ ] **Step 6: Commit.**

---

## Task 12: The board's working surface — filters, order, and the record panel

**Files:**

- Create: `src/components/ward-management/ward-record-panel.tsx`, `.module.css`
- Modify: `ward-board.tsx`, `board.module.css`
- Test: `tests/ward-board-selection.dom.test.tsx`, `tests/ward-record-panel.dom.test.tsx`

**Interfaces:**

- Produces:

```ts
export function WardRecordPanel({
  bed,
  onClose,
}: {
  bed: BedTile & { admission: Admission | null };
  onClose: () => void;
}): JSX.Element;
```

- [ ] **Step 1: Write the failing tests**

```tsx
it("can be closed back to nothing selected", async () => {
  const onClose = vi.fn();
  render(<WardRecordPanel bed={BED_09} onClose={onClose} />);
  await userEvent.click(screen.getByRole("button", { name: /close this record/i }));
  expect(onClose).toHaveBeenCalled();
});

it("says a discharge date has moved, and how many times", () => {
  render(<WardRecordPanel bed={{ ...BED_09, admission: { ...ADMISSION, dischargeDateMoves: 3 } }} onClose={noop} />);
  expect(screen.getByText(/moved 3 times/i)).toBeInTheDocument();
});

it("states an absent expected-discharge date rather than leaving it blank", () => {
  render(
    <WardRecordPanel bed={{ ...BED_09, admission: { ...ADMISSION, expectedDischargeAt: null } }} onClose={noop} />,
  );
  // An absent date must never read as "past due", and equally never as "not yet due".
  expect(screen.getByText(/no expected date recorded/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run and watch all three fail.**

- [ ] **Step 3: Implement the filter row and the order control.** Each filter carries its own live
      count; a filter matching nothing renders its count as `none`.

- [ ] **Step 4: Implement the record panel from the real `Admission` fields only** — stay, band, sex,
      home region, tentative diagnosis, specialling against `Unit.speciallingCapacity`, arrival,
      away-at-an-ED, the expected discharge with `dischargeDateMoves` and `dischargeDateSetBy`, the
      blocker, and the seven `LeavingDestination` values.

⚠️ **Do not add a patient block here.** That is Task 13 and it is gated on D1.

- [ ] **Step 5: Run and watch them pass.**

- [ ] **Step 6: Commit.**

---

## Task 13: The patient block — GATED on D1 and D2

🔴 **CORRECTED 2026-09-05. THE FIRST VERSION OF THIS TASK WAS WRONG, AND WRONG IN THE DIRECTION
THAT DOES DAMAGE.** It said `Admission` holds no patient link and instructed adding
`patientId: PatientId` as a **required** field.

**A link already exists.** Ward Builder One reported it and it is confirmed here independently:

```
Admission.referralId  →  Referral.patientId  →  Patient
```

`Admission.referralId` is `string | null`. `Referral.patientId` is `patientId?: PatientId` —
optional — and `ward-flow-reducer.ts` says why, in a comment on the line that sets it:

> ⚠️ COPIED THROUGH, NEVER DEFAULTED. `undefined` here means the referral was raised without a
> person on file — which is a real case, not a gap to be filled. Inventing an id to avoid an empty
> field is how a referral comes to point at the wrong human being.

**So making a patient reference required would not have been an improvement. It would have
contradicted a deliberate clinical decision**, forced a person onto every bed, and made the model
unable to express the case the reducer exists to protect: a bed occupied by someone with no record
on file yet. The original step even argued for `required` on the grounds that `tsc` catches a
missing required field — a true statement recruited to enforce the wrong thing.

⚠️ **AND THE CONSEQUENCE FOR THE SCREEN IS THE OPPOSITE OF WHAT WAS PLANNED.** The join is doubly
optional, so **some occupied beds have no linked person, permanently and correctly.** A board that
walks admissions expecting names will render blanks that read as missing patients — a data-integrity
alarm where there is none.

### What D1 actually asks

Not "may we add a link" — there is one. **"Should a bed be able to reach a patient directly, or only
through the referral that created it?"**

| Option                                                | What it costs                                                                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Use the existing chain. Add nothing.** (default) | A bed admitted without a referral, or from a referral with no person on file, shows no name — correctly. Two hops to resolve.                                       |
| **B. Add an optional `patientId` to `Admission`.**    | One hop. A second place a patient id can live, so the two can disagree — and the reducer's whole point is that a patient id must never be invented to fill a field. |

**Recommend A.** B buys one hop and risks the exact defect the reducer's comment names. If the owner
picks B, the field is **optional**, and a guard must pin that it never disagrees with the referral's.

- [ ] **Step 1: Measure the coverage before designing the empty state**

```bash
node scripts/run-vitest.mjs run --reporter=dot tests/ward-admissions.test.ts
```

Then, in a scratch script, count over the seed: how many admissions have a `referralId`, how many of
those referrals carry a `patientId`, and how many therefore resolve to a person. **Write the three
numbers down.** The empty state is not an edge case if it is a third of the ward.

- [ ] **Step 2: Write the failing test for the resolver, including the honest absence**

```ts
// The floor is on the POPULATION, so a green over an empty set proves nothing.
it("resolves a person where the chain is complete, and says so plainly where it is not", () => {
  expect(admissions.length).toBeGreaterThan(10);
  let resolved = 0;
  for (const admission of admissions) {
    const person = personForAdmission(admission, referrals, patients);
    if (person !== null) {
      resolved += 1;
      expect(person.id).toMatch(/^PT-/);
    }
  }
  // Both directions pinned: some resolve, and it is not all of them.
  expect(resolved).toBeGreaterThan(0);
  expect(resolved).toBeLessThanOrEqual(admissions.length);
});

it("distinguishes no referral from a referral with nobody on file", () => {
  // These are different facts and the screen must not merge them into one blank.
  expect(absenceReason({ ...ADMISSION, referralId: null })).toBe("no-referral");
  expect(absenceReason({ ...ADMISSION, referralId: "WF-208" })).toBe("no-person-on-file");
});
```

- [ ] **Step 3: Run and watch both fail.**

- [ ] **Step 4: Implement `personForAdmission` and `absenceReason` in
      `src/components/ward-management/ward-admissions.ts`.** Add no field to `Admission` under
      option A.

- [ ] **Step 5: Render the patient block, and render the two absences as sentences**

Where the chain resolves: preferred name, full name, age derived from `dateOfBirth`, UMRN, sex or
gender, legal status, suburb, community team, GP.

Where it does not, **say which absence it is** — "This bed was not filled from a referral, so no
person is linked" versus "The referral that filled this bed was raised before anyone was on file".
⚠️ **Never a blank, and never one message for both.** Rule 5: absence is stated, never blank.

⚠️ **Age is derived from `dateOfBirth` and never stored.** Do not add an age field, and do not write
a test that computes the expected age by calling the same helper the component calls — that is a
mirror, and it will agree with the code forever, including when the code is wrong. Derive it
independently in the test.

- [ ] **Step 6: Retire the `.proposal` fence and the footnote in the mockup**

The mockup fences the patient block and says at the foot that the link does not exist. **That
sentence is now false.** Replace it with what is actually true: the link exists, runs through the
referral, and is optional by design. ⚠️ **A fence left over a field that has a producer is a false
statement that reads as caution.**

- [ ] **Step 7 (D2): Interpreter language.** If and only if D2 is approved, render it. Aboriginal or
      Torres Strait Islander status is **not** in scope of D2 and stays undrawn either way.

- [ ] **Step 8: Run the board tests, both contract tests, and typecheck. Commit.**

---

## Task 14: The guards that keep the language in one place

**Files:**

- Create: `tests/ward-design-language-canonical.test.ts`
- Modify: `docs/ward-flow/design/prototypes/README.md`

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DIR = join(process.cwd(), "docs/ward-flow/design/prototypes");

function styleBlock(file: string): string {
  const html = readFileSync(join(DIR, file), "utf8");
  const open = html.indexOf("<style>") + "<style>".length;
  const close = html.indexOf("</style>", open);
  return html.slice(open, close);
}

describe("the second-edition language lives in exactly one place", () => {
  const canonical = styleBlock("design-language.html");
  const mockups = readdirSync(DIR).filter((f) => /^mockup-.*-v3\.html$/.test(f));

  it("has v3 mockups to check", () => {
    // Floor the POPULATION, not the finding: a pass over zero files proves nothing.
    expect(mockups.length).toBeGreaterThanOrEqual(2);
  });

  it.each(mockups)("%s begins with the canonical block, byte for byte", (file) => {
    expect(styleBlock(file).startsWith(canonical)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and watch it pass**, then **mutate to prove it can fail**: change one
      character inside a mockup's copied block, re-run, confirm RED naming that file, then restore
      and verify by content with `git diff --stat`.

⚠️ **Name the file this test cannot select from a focused run.** It reads from disk and imports
nothing from `src/`, so `npm run test:focused` will never run it. Say so in a comment.

- [ ] **Step 3: Re-derive the README's measured figures** — the canonical block's character count and
      hash — rather than copying the line already there. Update it.

- [ ] **Step 4: Commit.**

---

## Task 15: Look at the screens, and measure something

**Nobody has yet looked at an adopted ward screen.** Every claim in the adoption playbook is
structural. This task is the one that is not.

**Files:** none — this task produces a record.

- [ ] **Step 1: Start the app**

```bash
npm run ensure
```

Use the URL it prints. Never assume a port.

- [ ] **Step 2: Open both screens at three widths** — a phone, a laptop, and wide enough for the
      three-column layout. Confirm the column balance and that no tile overflows its track:

```js
[...document.querySelectorAll(".bed")].filter((b) =>
  [...b.querySelectorAll("*")].some((k) => k.getBoundingClientRect().right > b.getBoundingClientRect().right + 0.5),
).length; // must be 0
```

- [ ] **Step 3: Force dark and confirm every surface, chip, tile and button inverts legibly.**

- [ ] **Step 4: Print-preview the board.** Confirm the dark stamp does not survive into print — this
      is the specific failure the print block's `:root[data-theme="dark"]` selector exists to stop.

- [ ] **Step 5: Collapse the surfaces and ask what became uncountable**

⚠️ **Re-pointing tokens fixes ROLES. It does not fix a LAYOUT that separated two things by two
roles that now resolve to the same keyword.** Every `--surface*` role maps to `Canvas` under forced
colours, so anything distinguished by a **fill alone** disappears while every token behaves
perfectly — and text and borders keep working, which is why nobody notices. Task 2's eight-role fix
cannot catch this; it is a different layer.

Run it in the browser and read the result, not the tokens:

```js
const r = document.documentElement.style;
for (const t of [
  "--ground",
  "--surface",
  "--surface-2",
  "--sunken",
  "--accent-wash",
  "--good-wash",
  "--signal-wash",
  "--crit-wash",
  "--cool-wash",
])
  r.setProperty(t, "#ffffff");
for (const t of ["--shadow-1", "--shadow-2", "--shadow-3"]) r.setProperty(t, "none");
```

Then ask of every screen: **what is now uncountable, unreadable, or unfindable?** Compare a
selected thing against an unselected one by computed style, not by eye — identical
`backgroundColor` and `borderTopWidth: 0px` is the signature.

**Two were found this way on the mockups, and neither was visible any other way:**

- 🔴 the selected page tab in `.seg` was carried by a fill and a shadow and nothing else — selected
  and unselected measured identical. It now has a real border.
- the toned figure tiles kept their 3px top rule but its **colour** was what said "look here", and
  every tone collapses to one. Flagged tiles became unfindable as flagged. Width is
  colour-independent and restores the scan.

**Ward Builder One found the same defect on their own tab control, independently, an hour earlier**
— and the worst instance on their side failed at the design's own premise: a timer built as
countable blocks lost the unelapsed ones to `Canvas`-on-`Canvas`, so a plain bar would have degraded
better than the thing built to beat a bar.

⚠️ **`board/board.module.css` is where to look first** when the real screens are adopted: any well,
header row, inset or chip separated from its parent by fill alone has this defect today.

- [ ] **Step 6: Record what you could NOT observe.** Forced colours cannot be emulated by the
      available tooling. Say so plainly rather than implying it was checked.

- [ ] **Step 7: Run the full gate and state the denominator**

```bash
npm run verify:cheap
```

Report as "N files, M tests, K failed" — never as "green". Two sessions on this project have said
"green" about runs that had not measured what the word implied.

- [ ] **Step 8: Commit the record.**

---

## Rollback

Every task is one commit. The riskiest are Task 3 (the token adoption, large and mechanical) and
Task 11 (the board's borrowed spacing scale). Both are revertible on their own:

```bash
git revert --no-edit <sha>
```

⚠️ **Verify a revert by content, not by the word "Reverted".** Compare the file's blob against the
pre-task commit:

```bash
git diff --stat <pre-task-sha> HEAD -- src/components/ward-management/ward/ward.module.css
```

## What this plan does not cover

- **The other eight Ward Flow screens.** They stay on the first edition until each is built. That is
  deliberate: the two ward screens are the proof that the second edition survives contact with real
  code, and eight simultaneous adoptions would make a regression unattributable.
- **Retiring `WardFigure`.** `WardKpi` is built beside it in Task 6; retirement waits until nothing
  imports `WardFigure`, and that is a separate change with its own dead-code checks.
- **`WardKindChip`.** It has zero importers outside its own file today. Not touched, not deleted —
  deleting an exported symbol has its own procedure in `docs/agents/dead-code-deletion.md`.
