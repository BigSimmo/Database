# Ward Flow merges 1–3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fold nine Ward Flow destinations into six — Delays, Capacity, Movements — built from four
new shared primitives, so the three screens are one design language rather than three.

**Architecture:** Four new presentational primitives join the four that already exist
(`WardPanel`, `WardChip`, `WardFigure`, `WardFreshness`). Each merged screen is then assembled from
primitives plus the existing derivations layer in `ward-derivations.ts` — no screen computes its own
figures. Folded routes become 307 redirects, following the `/constellation` idiom already in the
repository. No data model changes.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6 strict, CSS Modules, Vitest +
Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-05-ward-flow-merges-1-3-design-lock.md`

---

## Global Constraints

Every task's requirements implicitly include this section.

- **⚠️ `GATE_RECEIPTS=off` ON EVERY VERIFICATION RUN.** `scripts/run-vitest.mjs` caches results.
  A second run of the same content prints `[gate-receipts] REUSED — "vitest" already exited 0 on
this exact content` and **reports success without running anything**. A verification step that
  reuses a receipt has verified nothing. Every `Run:` line below carries the flag.
- **⚠️ `npm run test:focused` cannot run these tests.** `scripts/test-focused.mjs` treats any
  `tests/` path as unsafe and exits **2** — neither pass nor fail. Use
  `GATE_RECEIPTS=off node scripts/run-vitest.mjs run <path>` for every unit and DOM test.
- **No raw hex, and no `font-family`, in any Ward Flow stylesheet.** Every colour resolves through a
  `--ward-*` token declared in `ward-tokens.module.css`. Enforced by
  `tests/ward-design-language-contract.test.ts`.
- **Every `--ward-*` token a new module uses must be declared in the canonical layer.** An
  undeclared one is not an error, not a warning and not a test failure — it renders as _nothing_.
- **State is a word before it is a colour.** No row, chip or edge may carry meaning in colour alone.
  New primitives enforce this the way `WardChip` does: throw with a sentence.
- **Absence is stated, never blank.** A zero keeps its place in a key.
- **Group headings count people, not rows.**
- **Every refusal is overridable and the override is recorded.** No screen presents a refusal as a
  block.
- **Copy says "23 → 19", never "23 → 18".** The latter counts merge 4, which is out of scope.
- **Never `git add -A`.** Other agents may share this worktree. Stage the exact paths listed.
- **Do not touch merge 4.** `ward/[unitId]`, `board/[unitId]`, `board/*`, `ward/*` are out of scope.
- **Breakpoints:** use `64rem` only. Any new `file: 64` pair must be added to `KNOWN_BREAKPOINTS` in
  `tests/ward-primitives-shared.test.ts` in the same commit that introduces it.
- **If you reach a decision this plan does not cover, stop and hand it back.**

---

## File Structure

**Created**

| File                                                                                                    | Responsibility                                        |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `src/components/ward-management/ward-bar.tsx`                                                           | `WardBar` — one distribution bar plus its key         |
| `src/components/ward-management/ward-bar.module.css`                                                    | its styles                                            |
| `src/components/ward-management/ward-record-row.tsx`                                                    | `WardRecordRow`, `WardGroupHeading`, `WardRecordList` |
| `src/components/ward-management/ward-record-row.module.css`                                             | their styles                                          |
| `src/components/ward-management/ward-controls.tsx`                                                      | `WardFilters`, `WardSegmented`                        |
| `src/components/ward-management/ward-controls.module.css`                                               | their styles                                          |
| `src/components/ward-management/delays/delays-screen.tsx`                                               | merge 01                                              |
| `src/components/ward-management/delays/delays.module.css`                                               | merge 01 styles                                       |
| `src/components/ward-management/delays/delays-derivations.ts`                                           | grouping the one list by cause                        |
| `src/app/mockups/ward-flow/delays/page.tsx`                                                             | merge 01 route                                        |
| `tests/ward-bar.dom.test.tsx`, `tests/ward-record-row.dom.test.tsx`, `tests/ward-controls.dom.test.tsx` | primitive tests                                       |
| `tests/ward-delays-screen.dom.test.tsx`, `tests/ward-delays-derivations.test.ts`                        | merge 01 tests                                        |
| `tests/ward-capacity-merged.dom.test.tsx`, `tests/ward-movements-merged.dom.test.tsx`                   | merges 02, 03                                         |
| `tests/ward-merged-destinations.test.ts`                                                                | the fold's own contract                               |

**Modified**

| File                                                                                 | Change                                                                            |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `src/components/ward-management/ward-movements.ts`                                   | `fallbackUnitId` respects authorisation                                           |
| `tests/ward-derivations.test.ts`                                                     | count all five inbox categories                                                   |
| `src/components/ward-management/ward-nav.ts`                                         | `WardMode` union, `WARD_VIEWS`, `WARD_NAV`, `WARD_NAV_INTENTIONALLY_UNLISTED`     |
| `src/components/ward-management/ward-nav-icons.ts`                                   | icon for `delays`                                                                 |
| `src/components/ward-management/ward-management-modes.tsx`                           | `ModeBody` routes `delays`; `CapacityView`, `MovementsView` absorb their partners |
| `src/app/mockups/ward-flow/{queue,exceptions,escalation,morning,transport}/page.tsx` | become 307 redirects                                                              |
| `tests/ward-design-language-contract.test.ts`                                        | `NEW_MODULES`, `COVERING_THE_GROUND`                                              |
| `tests/ward-primitives-shared.test.ts`                                               | `KNOWN_BREAKPOINTS`                                                               |

**Deleted — only after its screen has a replacement, and never before Task 8**

`escalation/escalation-board.tsx`, `escalation/escalation.module.css`,
`morning/morning-page.tsx`, `morning/morning.module.css`, `tracker/live-tracker.tsx`,
`tracker/live-tracker.module.css`. Their derivations (`tracker-derivations.ts`,
`ward-morning-rollup.ts`) are **kept** — the merged screens consume them.

---

### Task 1: Clear the pre-existing red

The branch is red before this work starts. Every screen in scope reads `buildActionInbox`, so
nothing else may be built on top of it. Two defects, both fixed here.

**Files:**

- Modify: `src/components/ward-management/ward-movements.ts:758-768` (`fallbackUnitId`)
- Modify: `tests/ward-derivations.test.ts:220-241`
- Test: `tests/ward-derivations.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `fallbackUnitId(cohort: Cohort, security: Security, index: number, legalStatus: LegalStatus): string` — **one new fourth parameter**. Its two call sites are both inside
  `routineMovements` in the same file.

- [ ] **Step 1: Write the failing test — the generator must not place a detainable patient somewhere unauthorised**

Add to `tests/ward-derivations.test.ts`, in a new `describe` at the end of the file:

```ts
describe("the generated fixture never accepts a detainable patient at an unauthorised unit", () => {
  // ⚠️ FLOOR THE POPULATION, not the violation count. If the fixture ever stops generating any
  // movement that requires an authorised destination, every assertion below walks nothing and
  // passes while proving nothing.
  const detainable = wardMovements.filter(
    (movement) => movement.acceptedUnitId !== undefined && requiresAuthorisedDestination(movement.legalStatus),
  );

  it("has movements that require an authorised destination at all", () => {
    expect(
      detainable.length,
      "no movement requires an authorised destination — this file walks nothing",
    ).toBeGreaterThan(0);
  });

  it("accepts none of them at a unit that may not lawfully detain", () => {
    const units = allUnits();
    const offenders = detainable
      .map((movement) => ({ movement, unit: units.find((u) => u.id === movement.acceptedUnitId) }))
      .filter((entry) => entry.unit !== undefined && !entry.unit.authorised)
      .map((entry) => `${entry.movement.id} -> ${entry.unit!.id}`);
    expect(offenders, `accepted at an unauthorised unit: ${offenders.join(", ")}`).toEqual([]);
  });
});
```

Add `requiresAuthorisedDestination` to the file's existing import from `@/components/ward-management/ward-model` if it is not already imported.

- [ ] **Step 2: Run it and watch it fail on the right thing**

Run: `GATE_RECEIPTS=off node scripts/run-vitest.mjs run tests/ward-derivations.test.ts`

Expected: FAIL with `accepted at an unauthorised unit: WF-318 -> sjgs-adult-secure`, **and** the
pre-existing `expected [ … ] to have a length of 4 but got 5`. Two failures, not one. If the new
test passes, stop and hand back — the premise has changed.

- [ ] **Step 3: Make the generator ask the authorisation question**

In `src/components/ward-management/ward-movements.ts`, replace `fallbackUnitId` with:

```ts
/**
 * A deterministic destination for a generated movement. Prefers an exact cohort+security match
 * (the normal case); falls back to a cohort-only match, then to any unit, so the synthetic model —
 * which has no secure older-adult unit anywhere in the network — never throws for a combination it
 * cannot satisfy exactly. `index` is the only varying input, so the pick is stable across runs.
 *
 * ⚠️ `legalStatus` IS NOT COSMETIC AND IS NOT OPTIONAL. Until 2026-09-05 this function had never
 * asked whether the unit it picked may lawfully detain, and it happened not to land on one of the
 * two unauthorised units. Commit be5327210 changed the "exact" filter from a whole-ward flag to a
 * bed-designation question, which changed the pool's size and order, and WF-318 — carrying a status
 * that requires an authorised destination — landed on `sjgs-adult-secure`. The app then correctly
 * reported "Accepted destination no longer lawful" and a test that counted four of five inbox
 * categories went red.
 *
 * That is invented data producing a wrong clinical state, the same class of defect as f08548f1b.
 * Every pool below is now filtered on authorisation FIRST when the movement needs it, so no
 * reordering of the other filters can ever reintroduce it.
 */
function fallbackUnitId(cohort: Cohort, security: Security, index: number, legalStatus: LegalStatus): string {
  const mayHold = (unit: Unit) => !requiresAuthorisedDestination(legalStatus) || unit.authorised;
  const units = allUnits().filter(mayHold);
  // "is this ward of the right kind" for the security requested — mirrors the same locked/open
  // question `ward-eligibility.ts`'s `security` gate asks, not a whole-ward flag anymore.
  const exact = units.filter(
    (unit) => unit.cohort === cohort && (security === "Secure" ? unitHasLockedBeds(unit) : unitHasOpenBeds(unit)),
  );
  const sameCohort = units.filter((unit) => unit.cohort === cohort);
  const pool = exact.length > 0 ? exact : sameCohort.length > 0 ? sameCohort : units;
  /* istanbul ignore next — `units` is non-empty for every legal status in this model: 21 of the 23
   * units are authorised, so the authorised filter can never empty it. Asserted rather than
   * assumed, because an empty pool would be a modulo-by-zero and an undefined `.id`. */
  if (pool.length === 0) {
    throw new Error(`fallbackUnitId found no unit for ${cohort}/${security} under ${legalStatus}`);
  }
  return pool[index % pool.length].id;
}
```

Add `LegalStatus`, `Unit` and `requiresAuthorisedDestination` to the imports from
`@/components/ward-management/ward-model` if absent. Update both call sites inside
`routineMovements` and `stageFields` to pass the movement's own `legalStatus`.

- [ ] **Step 4: Correct the test that could only count four of five categories**

In `tests/ward-derivations.test.ts`, replace the `returns exactly as many items as the four
categories combined` test with:

```ts
/*
 * ⚠️ FIVE CATEGORIES, NOT FOUR. This test counted four of `buildActionInbox`'s five and its own
 * name said "the four categories" — so it was blind to `destination-unlawful-*` BY CONSTRUCTION,
 * not by accident, and could only ever pass while that category was empty. It went red on
 * 2026-09-05 the first time the category was non-empty, which is the only way anybody found out.
 *
 * The fifth count is written the same way as the other four — recomputed from the movements, not
 * read back off the result — so it is a real second opinion rather than a restatement.
 */
it("returns exactly as many items as the five categories combined — no more, no fewer", () => {
  const units = allUnits();
  const unlawfulCount = wardMovements.filter(
    (movement) => destinationNoLongerLawful(movement, units) !== undefined,
  ).length;
  const legalCount = wardMovements.filter(
    (movement) =>
      movement.legalForm?.dueAt !== undefined && clockState(movement.legalForm.dueAt, NOW_ANCHOR) === "breached",
  ).length;
  const declineCount = wardMovements.filter((movement) => movement.declines.length >= PARALLEL_REFERRAL_CAP).length;
  const transportCount = wardMovements.filter(
    (movement) =>
      movement.transport?.acceptedAt !== undefined &&
      movement.transport.enRouteAt === undefined &&
      movement.transport.cancelledAt === undefined,
  ).length;
  const expiredHoldCount = wardMovements.filter(
    (movement) =>
      movement.stage === "pulled" && movement.pullExpiresAt !== undefined && movement.pullExpiresAt < NOW_ANCHOR,
  ).length;

  expect(buildActionInbox(wardMovements, NOW_ANCHOR, units)).toHaveLength(
    unlawfulCount + legalCount + declineCount + transportCount + expiredHoldCount,
  );
});

/*
 * The count above is satisfied by 0 + 0 + … when every category is empty, which is exactly the
 * hole the old test fell into. This names the categories the fixture actually exercises today, so
 * a fixture change that empties one is a deliberate edit here rather than a silent loss of cover.
 */
it("exercises at least three of the five categories in the current fixture", () => {
  const prefixes = new Set(
    buildActionInbox(wardMovements, NOW_ANCHOR, allUnits()).map((item) => item.id.replace(/-WF-\d+$/u, "")),
  );
  expect([...prefixes].sort()).toEqual(["bed-pull", "declines", "transport"]);
});
```

Add `destinationNoLongerLawful` to the existing import from
`@/components/ward-management/ward-derivations`.

- [ ] **Step 5: Run and verify green**

Run: `GATE_RECEIPTS=off node scripts/run-vitest.mjs run tests/ward-derivations.test.ts`

Expected: PASS, 27 tests. If `exercises at least three of the five` fails, read the actual prefixes
in the diff before changing the expectation — a category appearing or vanishing is a finding.

- [ ] **Step 6: Run every test that reads the generated fixture**

Run:

```bash
GATE_RECEIPTS=off node scripts/run-vitest.mjs run tests/ward-model.test.ts tests/ward-eligibility.test.ts tests/ward-locked-not-authorised.test.ts tests/ward-flow-contracts.test.ts tests/ward-seed-reaches-every-branch.test.ts
```

Expected: PASS. Changing which unit a generated movement lands on moves figures on several screens;
anything red here is in scope for this task, not a later one.

- [ ] **Step 7: Commit**

```bash
git add src/components/ward-management/ward-movements.ts tests/ward-derivations.test.ts
git commit -m "fix(ward-flow): the fixture generator now asks whether a unit may lawfully detain

Closes the red this branch has carried since be5327210. Two defects, not one.

fallbackUnitId has never filtered on authorised — it simply happened not to
land on one of the two unauthorised units. be5327210 changed its 'exact'
filter from a whole-ward flag to a bed-designation question, which changed the
pool's size and order, and WF-318 landed on sjgs-adult-secure while carrying a
status that requires an authorised destination. The app was right: it reported
'Accepted destination no longer lawful'.

The test was blind by construction. It counted four of buildActionInbox's five
categories and its name said so, which means it could only ever pass while
destination-unlawful was empty. Counting the fifth is not enough on its own —
five zeroes also sum to zero — so a companion test names the categories the
fixture exercises today.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `WardBar` — the distribution bar

One bar, one meaning, always with a key. Used three times: the wait-time split on Delays, the
locked share on Capacity, the transport lifecycle on Movements.

**Files:**

- Create: `src/components/ward-management/ward-bar.tsx`
- Create: `src/components/ward-management/ward-bar.module.css`
- Test: `tests/ward-bar.dom.test.tsx`
- Modify: `tests/ward-design-language-contract.test.ts` (`NEW_MODULES`)

**Interfaces:**

- Consumes: `--ward-*` tokens only.
- Produces:

  ```ts
  export type WardBarTone = "good" | "warning" | "danger" | "accent" | "rest";
  export type WardBarSegment = { label: string; value: number; tone: WardBarTone };
  export function WardBar({ segments, caption }: { segments: WardBarSegment[]; caption: string }): JSX.Element;
  ```

- [ ] **Step 1: Write the failing test**

```tsx
// tests/ward-bar.dom.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardBar } from "@/components/ward-management/ward-bar";

const SPLIT = [
  { label: "Under 4 hours", value: 16, tone: "good" as const },
  { label: "4 to 12 hours", value: 19, tone: "warning" as const },
  { label: "Over 12 hours", value: 8, tone: "danger" as const },
];

describe("WardBar", () => {
  it("names every segment in words, so the bar never carries meaning in colour alone", () => {
    render(<WardBar segments={SPLIT} caption="43 people waiting" />);
    for (const s of SPLIT) expect(screen.getByText(s.label)).toBeInTheDocument();
  });

  it("states a zero rather than dropping it, so an absence is readable", () => {
    render(<WardBar segments={[...SPLIT, { label: "Over 24 hours", value: 0, tone: "danger" }]} caption="x" />);
    expect(screen.getByText("Over 24 hours").closest("li")).toHaveTextContent("none");
  });

  it("gives the bar itself an accessible description naming every segment and its count", () => {
    render(<WardBar segments={SPLIT} caption="43 people waiting" />);
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "43 people waiting: Under 4 hours 16, 4 to 12 hours 19, Over 12 hours 8.",
    );
  });

  it("refuses a segment with no label, because a coloured band with no word says nothing", () => {
    expect(() => render(<WardBar segments={[{ label: "  ", value: 3, tone: "good" }]} caption="x" />)).toThrow(
      /needs a label/u,
    );
  });

  it("refuses a bar whose segments are all zero, which renders as an empty grey rail", () => {
    expect(() => render(<WardBar segments={[{ label: "None", value: 0, tone: "rest" }]} caption="x" />)).toThrow(
      /every segment is zero/u,
    );
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: `GATE_RECEIPTS=off node scripts/run-vitest.mjs run tests/ward-bar.dom.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/ward-management/ward-bar"`.

- [ ] **Step 3: Write the component**

```tsx
// src/components/ward-management/ward-bar.tsx
import styles from "./ward-bar.module.css";

/**
 * One bar, one meaning, always with a key.
 *
 * ⚠️ A BAR IS THE EASIEST PLACE IN THIS APP TO SAY SOMETHING FALSE. A reader takes a stacked bar as
 * a whole — so a bar whose segments mean two different things (a locked share drawn beside an
 * occupancy share) reads as one fact and is two. `caption` is the bar's single meaning and it is
 * required.
 */
export type WardBarTone = "good" | "warning" | "danger" | "accent" | "rest";
export type WardBarSegment = { label: string; value: number; tone: WardBarTone };

export function WardBar({ segments, caption }: { segments: WardBarSegment[]; caption: string }) {
  for (const segment of segments) {
    if (segment.label.trim() === "") {
      throw new Error("WardBar: every segment needs a label — a coloured band with no word says nothing.");
    }
  }
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total === 0) {
    throw new Error(
      "WardBar: every segment is zero, which renders as an empty grey rail that looks like a loading state. Render the absence in words instead.",
    );
  }

  const description = `${caption}: ${segments.map((s) => `${s.label} ${s.value}`).join(", ")}.`;

  return (
    <div className={styles.bar} data-ward-primitive="bar">
      <div className={styles.track} role="img" aria-label={description}>
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <span
              key={segment.label}
              className={styles.segment}
              data-tone={segment.tone}
              style={{ width: `${(segment.value / total) * 100}%` }}
            />
          ))}
      </div>
      <ul className={styles.key}>
        {segments.map((segment) => (
          <li key={segment.label} className={styles.keyItem}>
            <span className={styles.swatch} data-tone={segment.tone} aria-hidden="true" />
            {segment.label}{" "}
            {segment.value === 0 ? (
              <span className={styles.zero}>none</span>
            ) : (
              <b className={styles.count}>{segment.value}</b>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Write the stylesheet**

```css
/* src/components/ward-management/ward-bar.module.css
 * Every value resolves through a --ward-* token declared in ward-tokens.module.css. */
.bar {
  display: grid;
  gap: var(--ward-space-8);
}
.track {
  display: flex;
  height: var(--ward-space-10);
  overflow: hidden;
  background: var(--ward-chrome);
  border: 1px solid var(--ward-border);
  border-radius: var(--ward-radius-pixel);
}
.segment {
  display: block;
}
.segment[data-tone="good"] {
  background: var(--ward-success);
}
.segment[data-tone="warning"] {
  background: var(--ward-warning);
}
.segment[data-tone="danger"] {
  background: var(--ward-danger);
}
.segment[data-tone="accent"] {
  background: var(--ward-blue);
}
.segment[data-tone="rest"] {
  background: var(--ward-border-strong);
}

.key {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ward-space-6) var(--ward-space-16);
  margin: 0;
  padding: 0;
  list-style: none;
}
.keyItem {
  display: inline-flex;
  align-items: center;
  gap: var(--ward-space-5);
  font-size: 0.6875rem;
  line-height: var(--ward-leading-ui);
  color: var(--ward-muted);
}
.swatch {
  width: var(--ward-space-8);
  height: var(--ward-space-8);
  flex: none;
  border-radius: var(--ward-radius-pixel);
}
.swatch[data-tone="good"] {
  background: var(--ward-success);
}
.swatch[data-tone="warning"] {
  background: var(--ward-warning);
}
.swatch[data-tone="danger"] {
  background: var(--ward-danger);
}
.swatch[data-tone="accent"] {
  background: var(--ward-blue);
}
.swatch[data-tone="rest"] {
  background: var(--ward-border-strong);
}

.count {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--ward-heading);
}
/* ⚠️ NOT the mono face. A zero written as a word is prose, and setting it in the figure face makes
 * "none" line up in a column of numbers as though it were one. */
.zero {
  color: var(--ward-muted);
}
```

> ⚠️ `font-family: var(--font-mono)` is a `var()` call, which is what
> `tests/ward-design-language-contract.test.ts`'s `font-family:\s*(?!var\()\S` regex permits. A bare
> family name here fails that gate.

- [ ] **Step 5: Add the module to the contract test's scope**

In `tests/ward-design-language-contract.test.ts`, extend `NEW_MODULES`:

```ts
const NEW_MODULES = ["ward-panel", "ward-chip", "ward-figure", "ward-shared", "ward-bar"].map((n) =>
  join(ROOT, `${n}.module.css`),
);
```

and change the guard's name and body from "all four new modules" to "all five new modules".

- [ ] **Step 6: Run and verify green**

Run: `GATE_RECEIPTS=off node scripts/run-vitest.mjs run tests/ward-bar.dom.test.tsx tests/ward-design-language-contract.test.ts tests/ward-token-layer.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/ward-management/ward-bar.tsx src/components/ward-management/ward-bar.module.css tests/ward-bar.dom.test.tsx tests/ward-design-language-contract.test.ts
git commit -m "feat(ward-flow): WardBar — one distribution bar, one meaning, always with a key

Three screens draw the same stacked bar today and none of them share a line of
code. This is the one, and it refuses the two ways a bar lies: a segment with
no word, and an all-zero bar that renders as an empty rail a reader takes for a
loading state.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `WardRecordRow` and `WardGroupHeading`

The single shape all three screens repeat: an id, state words, a clock, attributes, an optional
reason, and actions. Measured on 2026-09-05: 53 distinct `*Row` classes and 26 `*Note` classes
across the 41 Ward Flow stylesheets. This is one of each, for these three screens.

**Files:**

- Create: `src/components/ward-management/ward-record-row.tsx`
- Create: `src/components/ward-management/ward-record-row.module.css`
- Test: `tests/ward-record-row.dom.test.tsx`
- Modify: `tests/ward-design-language-contract.test.ts` (`NEW_MODULES`)

**Interfaces:**

- Consumes: `WardChip` from `./ward-chip` (`WardChipLevel`).
- Produces:

  ```ts
  export type WardRecordTone = "danger" | "warning" | "good" | "neutral";
  export function WardRecordRow(props: {
    id: string;
    tone?: WardRecordTone; // default "neutral"
    states: { level: WardChipLevel; text: string }[];
    clock?: { value: string; sub: string; urgent?: boolean };
    attributes: string[]; // rendered as one line, separated
    reason?: { level: "danger" | "warning" | "ok"; text: string };
    actions?: ReactNode;
  }): JSX.Element;

  export function WardGroupHeading(props: {
    title: string;
    people: number; // ⚠️ people, never rows
    note?: string;
    tone?: WardRecordTone;
  }): JSX.Element;

  export function WardRecordList({ children }: { children: ReactNode }): JSX.Element;
  ```

- [ ] **Step 1: Write the failing test**

```tsx
// tests/ward-record-row.dom.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardGroupHeading, WardRecordList, WardRecordRow } from "@/components/ward-management/ward-record-row";

describe("WardRecordRow", () => {
  it("shows the id, every state word, the clock and its attributes", () => {
    render(
      <WardRecordList>
        <WardRecordRow
          id="WF-009"
          tone="danger"
          states={[
            { level: "urgent", text: "5 declined" },
            { level: "stalled", text: "Escalated" },
          ]}
          clock={{ value: "7h 00m", sub: "in ED", urgent: true }}
          attributes={["Adult", "Male", "Involuntary", "Needs a locked bed"]}
        />
      </WardRecordList>,
    );
    expect(screen.getByText("WF-009")).toBeInTheDocument();
    expect(screen.getByText("5 declined")).toBeInTheDocument();
    expect(screen.getByText("Escalated")).toBeInTheDocument();
    expect(screen.getByText("7h 00m")).toBeInTheDocument();
    expect(screen.getByText(/Needs a locked bed/u)).toBeInTheDocument();
  });

  // ⚠️ THE ROW'S COLOURED EDGE IS THE ONLY THING data-tone DRAWS. A row toned danger with no
  // state word is a coloured stripe and nothing else — exactly what WardChip already refuses.
  it("refuses a toned row that carries no state word", () => {
    expect(() =>
      render(
        <WardRecordList>
          <WardRecordRow id="WF-001" tone="danger" states={[]} attributes={["Adult"]} />
        </WardRecordList>,
      ),
    ).toThrow(/colour alone cannot carry a state/u);
  });

  it("allows an untoned row with no state word, because that row makes no claim", () => {
    render(
      <WardRecordList>
        <WardRecordRow id="WF-001" states={[]} attributes={["Adult"]} />
      </WardRecordList>,
    );
    expect(screen.getByText("WF-001")).toBeInTheDocument();
  });

  it("renders the reason as its own block so it cannot be mistaken for an attribute", () => {
    render(
      <WardRecordList>
        <WardRecordRow
          id="WF-019"
          states={[{ level: "urgent", text: "Longest wait" }]}
          attributes={["Adult"]}
          reason={{ level: "warning", text: "Voluntary, but assessed as needing a locked bed." }}
        />
      </WardRecordList>,
    );
    expect(
      screen.getByText(/Voluntary, but assessed/u).closest("[data-ward-primitive='record-reason']"),
    ).not.toBeNull();
  });
});

describe("WardGroupHeading", () => {
  it("counts people and says so, because a patient carries several delays at once", () => {
    render(<WardGroupHeading title="No suitable bed anywhere" people={2} />);
    expect(screen.getByText("2 people")).toBeInTheDocument();
  });

  it("says '1 person', not '1 people'", () => {
    render(<WardGroupHeading title="Legal authority running out" people={1} />);
    expect(screen.getByText("1 person")).toBeInTheDocument();
  });

  // ⚠️ A heading over an empty group is the "absence stated, never blank" rule's failure case:
  // it reads as a category that exists and is fine, when in fact nothing was measured.
  it("refuses a group heading of nought — an empty group is stated in words, not headed", () => {
    expect(() => render(<WardGroupHeading title="Awaiting transport" people={0} />)).toThrow(/nought/u);
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: `GATE_RECEIPTS=off node scripts/run-vitest.mjs run tests/ward-record-row.dom.test.tsx`
Expected: FAIL — module not resolved.

- [ ] **Step 3: Write the component**

```tsx
// src/components/ward-management/ward-record-row.tsx
import type { ReactNode } from "react";

import { WardChip, type WardChipLevel } from "./ward-chip";
import styles from "./ward-record-row.module.css";

export type WardRecordTone = "danger" | "warning" | "good" | "neutral";

/**
 * The one record row for Delays, Capacity and Movements.
 *
 * ⚠️ `tone` DRAWS A COLOURED LEFT EDGE AND NOTHING ELSE, so a toned row with no state word is a
 * coloured stripe carrying meaning on its own — the exact defect `WardChip.requireWords` exists to
 * refuse. An UNTONED row with no states is fine: it makes no claim.
 */
export function WardRecordRow({
  id,
  tone = "neutral",
  states,
  clock,
  attributes,
  reason,
  actions,
}: {
  id: string;
  tone?: WardRecordTone;
  states: { level: WardChipLevel; text: string }[];
  clock?: { value: string; sub: string; urgent?: boolean };
  attributes: string[];
  reason?: { level: "danger" | "warning" | "ok"; text: string };
  actions?: ReactNode;
}) {
  if (tone !== "neutral" && states.length === 0) {
    throw new Error(
      `WardRecordRow ${id} is toned "${tone}" with no state word: colour alone cannot carry a state in this app.`,
    );
  }
  return (
    <li className={styles.row} data-tone={tone} data-ward-primitive="record-row">
      <span className={styles.line}>
        <span className={styles.id}>{id}</span>
        {states.map((state) => (
          <WardChip key={state.text} level={state.level}>
            {state.text}
          </WardChip>
        ))}
        {clock ? (
          <span className={styles.clock} data-urgent={clock.urgent ? "true" : undefined}>
            {clock.value}
            <small className={styles.clockSub}>{clock.sub}</small>
          </span>
        ) : null}
      </span>
      <span className={styles.attrs}>
        {attributes.map((attribute, index) => (
          <span key={attribute} className={styles.attr}>
            {index > 0 ? (
              <span className={styles.sep} aria-hidden="true">
                {" · "}
              </span>
            ) : null}
            {attribute}
          </span>
        ))}
      </span>
      {reason ? (
        <span className={styles.reason} data-level={reason.level} data-ward-primitive="record-reason">
          {reason.text}
        </span>
      ) : null}
      {actions ? <span className={styles.actions}>{actions}</span> : null}
    </li>
  );
}

/**
 * ⚠️ `people`, NEVER a row count. A patient carries several delays at once and appears under the
 * longest-running one; counting rows double-counts the sickest people on the page. The prop is
 * named for the unit so a caller passing `items.length` has to notice it is doing so.
 */
export function WardGroupHeading({
  title,
  people,
  note,
  tone = "neutral",
}: {
  title: string;
  people: number;
  note?: string;
  tone?: WardRecordTone;
}) {
  if (people <= 0) {
    throw new Error(
      `WardGroupHeading "${title}" was given a count of nought. An empty group is stated in words ("nobody is waiting on transport today"), never headed — a heading over nothing reads as a category that exists and is fine.`,
    );
  }
  return (
    <div className={styles.groupHeading} data-tone={tone} data-ward-primitive="group-heading">
      <h3 className={styles.groupTitle}>{title}</h3>
      <span className={styles.groupCount}>{people === 1 ? "1 person" : `${people} people`}</span>
      {note ? <span className={styles.groupNote}>{note}</span> : null}
    </div>
  );
}

export function WardRecordList({ children }: { children: ReactNode }) {
  return (
    <ul className={styles.list} data-ward-primitive="record-list">
      {children}
    </ul>
  );
}
```

- [ ] **Step 4: Write the stylesheet**

```css
/* src/components/ward-management/ward-record-row.module.css */
.list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.row {
  display: grid;
  gap: var(--ward-space-6);
  min-height: 2.375rem;
  padding: var(--ward-space-10) var(--ward-space-16);
  border-top: 1px solid var(--ward-divider);
  border-left: var(--ward-space-3) solid transparent;
}
.row[data-tone="danger"] {
  border-left-color: var(--ward-danger);
}
.row[data-tone="warning"] {
  border-left-color: var(--ward-warning);
}
.row[data-tone="good"] {
  border-left-color: var(--ward-success);
}
.row:hover {
  background: var(--ward-subtle);
}

.line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ward-space-8);
}
.id {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--ward-heading);
}
.clock {
  margin-left: auto;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--ward-heading);
  white-space: nowrap;
}
.clock[data-urgent="true"] {
  color: var(--ward-danger);
}
.clockSub {
  margin-left: var(--ward-space-4);
  font-family: var(--font-sans);
  font-size: 0.6875rem;
  font-weight: 400;
  color: var(--ward-muted);
}
.attrs {
  font-size: 0.6875rem;
  line-height: var(--ward-leading-ui);
  color: var(--ward-muted);
}
.sep {
  color: var(--ward-border-strong);
}

.reason {
  padding: var(--ward-space-7) var(--ward-space-10);
  border: 1px solid var(--ward-border);
  border-radius: var(--ward-radius-pixel);
  font-size: 0.6875rem;
  line-height: var(--ward-leading-relaxed);
}
.reason[data-level="danger"] {
  background: var(--ward-danger-soft);
  color: var(--ward-danger);
}
.reason[data-level="warning"] {
  background: var(--ward-warning-soft);
  color: var(--ward-warning);
}
.reason[data-level="ok"] {
  background: var(--ward-success-soft);
  color: var(--ward-success);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ward-space-8);
}

.groupHeading {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--ward-space-12);
  padding: var(--ward-space-12) var(--ward-space-16) var(--ward-space-4);
  border-top: 1px solid var(--ward-border);
  background: var(--ward-canvas);
}
.groupTitle {
  margin: 0;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--ward-heading);
}
.groupHeading[data-tone="danger"] .groupTitle {
  color: var(--ward-danger);
}
.groupCount {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 0.6875rem;
  color: var(--ward-muted);
}
.groupNote {
  font-size: 0.6875rem;
  color: var(--ward-muted);
}
```

- [ ] **Step 5: Add to `NEW_MODULES` and run**

Extend `NEW_MODULES` in `tests/ward-design-language-contract.test.ts` with `"ward-record-row"` and
update the guard's name to "all six new modules".

Run: `GATE_RECEIPTS=off node scripts/run-vitest.mjs run tests/ward-record-row.dom.test.tsx tests/ward-design-language-contract.test.ts tests/ward-primitives-shared.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/ward-management/ward-record-row.tsx src/components/ward-management/ward-record-row.module.css tests/ward-record-row.dom.test.tsx tests/ward-design-language-contract.test.ts
git commit -m "feat(ward-flow): one record row and one group heading for the merged screens

53 distinct *Row classes and 26 *Note classes across 41 Ward Flow stylesheets,
counted 2026-09-05. This is one of each for the three screens being merged;
nothing outside those three is migrated here.

Two rules are enforced rather than documented: a toned row must carry a state
word, because tone draws a coloured edge and nothing else; and a group heading
counts PEOPLE, refusing nought, because a heading over an empty group reads as
a category that exists and is fine.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: `WardFilters` and `WardSegmented`

**Files:**

- Create: `src/components/ward-management/ward-controls.tsx`
- Create: `src/components/ward-management/ward-controls.module.css`
- Test: `tests/ward-controls.dom.test.tsx`
- Modify: `tests/ward-design-language-contract.test.ts` (`NEW_MODULES`)

**Interfaces:**

- Produces:

  ```ts
  export type WardFilterOption = { id: string; label: string; count: number };
  export function WardFilters(props: {
    legend: string;
    options: WardFilterOption[];
    activeId: string;
    onChange: (id: string) => void;
  }): JSX.Element;

  export type WardSegmentedOption = { id: string; label: string };
  export function WardSegmented(props: {
    legend: string;
    options: WardSegmentedOption[];
    activeId: string;
    onChange: (id: string) => void;
  }): JSX.Element;
  ```

- [ ] **Step 1: Write the failing test**

```tsx
// tests/ward-controls.dom.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WardFilters, WardSegmented } from "@/components/ward-management/ward-controls";

const OPTIONS = [
  { id: "all", label: "People waiting", count: 43 },
  { id: "wards", label: "Wards not freeing beds", count: 7 },
  { id: "done", label: "Resolved today", count: 11 },
];

describe("WardFilters", () => {
  it("shows every count, because a filter with no count hides how much it removes", () => {
    render(<WardFilters legend="Show" options={OPTIONS} activeId="all" onChange={() => {}} />);
    expect(screen.getByRole("group", { name: "Show" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "People waiting 43" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Resolved today 11" })).toHaveAttribute("aria-pressed", "false");
  });

  it("reports the id it was given, not an index", async () => {
    const onChange = vi.fn();
    render(<WardFilters legend="Show" options={OPTIONS} activeId="all" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Resolved today 11" }));
    expect(onChange).toHaveBeenCalledWith("done");
  });

  // ⚠️ An activeId matching no option renders every pill unpressed — a filter bar that looks like
  // nothing is selected while a filter is in fact applied.
  it("refuses an activeId that matches no option", () => {
    expect(() => render(<WardFilters legend="Show" options={OPTIONS} activeId="nope" onChange={() => {}} />)).toThrow(
      /matches no option/u,
    );
  });
});

describe("WardSegmented", () => {
  it("presses exactly one option", () => {
    render(
      <WardSegmented
        legend="As at"
        options={[
          { id: "now", label: "Now" },
          { id: "morning", label: "This morning" },
        ]}
        activeId="morning"
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "This morning" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Now" })).toHaveAttribute("aria-pressed", "false");
  });
});
```

- [ ] **Step 2: Run and verify it fails**

Run: `GATE_RECEIPTS=off node scripts/run-vitest.mjs run tests/ward-controls.dom.test.tsx`
Expected: FAIL — module not resolved.

- [ ] **Step 3: Write the component**

```tsx
// src/components/ward-management/ward-controls.tsx
"use client";

import styles from "./ward-controls.module.css";

export type WardFilterOption = { id: string; label: string; count: number };

/**
 * ⚠️ THE COUNT IS NOT DECORATION. A filter pill without one hides how much of the list it removes,
 * which on this app's screens is the difference between "nobody is waiting on transport" and "you
 * filtered them out". It is required, and it is announced as part of the button's name.
 */
export function WardFilters({
  legend,
  options,
  activeId,
  onChange,
}: {
  legend: string;
  options: WardFilterOption[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  if (!options.some((option) => option.id === activeId)) {
    throw new Error(
      `WardFilters "${legend}": activeId "${activeId}" matches no option, so every pill would render unpressed while a filter is applied.`,
    );
  }
  return (
    <div className={styles.filters} role="group" aria-label={legend} data-ward-primitive="filters">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={styles.pill}
          aria-pressed={option.id === activeId}
          onClick={() => onChange(option.id)}
        >
          {option.label} <span className={styles.pillCount}>{option.count}</span>
        </button>
      ))}
    </div>
  );
}

export type WardSegmentedOption = { id: string; label: string };

export function WardSegmented({
  legend,
  options,
  activeId,
  onChange,
}: {
  legend: string;
  options: WardSegmentedOption[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  if (!options.some((option) => option.id === activeId)) {
    throw new Error(`WardSegmented "${legend}": activeId "${activeId}" matches no option.`);
  }
  return (
    <div className={styles.segmented} role="group" aria-label={legend} data-ward-primitive="segmented">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={styles.segment}
          aria-pressed={option.id === activeId}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Write the stylesheet**

```css
/* src/components/ward-management/ward-controls.module.css */
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ward-space-5);
}
.pill {
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: var(--ward-leading-ui);
  padding: var(--ward-space-5) var(--ward-space-10);
  cursor: pointer;
  white-space: nowrap;
  color: var(--ward-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--ward-radius-pixel);
}
.pill:hover {
  background: var(--ward-chrome);
}
.pill[aria-pressed="true"] {
  color: var(--ward-blue);
  background: var(--ward-blue-soft);
  border-color: var(--ward-blue-border);
}
.pillCount {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 0.6875rem;
}

.segmented {
  display: inline-flex;
  overflow: hidden;
  background: var(--ward-canvas);
  border: 1px solid var(--ward-border);
  border-radius: var(--ward-radius-pixel);
}
.segment {
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: var(--ward-leading-ui);
  padding: var(--ward-space-6) var(--ward-space-12);
  cursor: pointer;
  color: var(--ward-muted);
  background: transparent;
  border: 0;
  border-right: 1px solid var(--ward-divider);
}
.segment:last-child {
  border-right: 0;
}
.segment[aria-pressed="true"] {
  color: var(--ward-blue);
  background: var(--ward-blue-soft);
}
```

- [ ] **Step 5: Add to `NEW_MODULES` and run**

Extend `NEW_MODULES` with `"ward-controls"`; update the guard's name to "all seven new modules".

Run: `GATE_RECEIPTS=off node scripts/run-vitest.mjs run tests/ward-controls.dom.test.tsx tests/ward-design-language-contract.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/ward-management/ward-controls.tsx src/components/ward-management/ward-controls.module.css tests/ward-controls.dom.test.tsx tests/ward-design-language-contract.test.ts
git commit -m "feat(ward-flow): shared filter pills and a segmented control

Both refuse an activeId matching no option — the state in which every control
renders unpressed while a filter is in fact applied, which reads as an unfiltered
list and is the one failure a screenshot cannot show.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Merge 01 — Delays

Priority queue + Exceptions + Escalation become one screen answering one question: _why is this
person still waiting?_

**Files:**

- Create: `src/components/ward-management/delays/delays-derivations.ts`
- Create: `src/components/ward-management/delays/delays-screen.tsx`
- Create: `src/components/ward-management/delays/delays.module.css`
- Create: `src/app/mockups/ward-flow/delays/page.tsx`
- Modify: `src/app/mockups/ward-flow/{queue,exceptions,escalation}/page.tsx` → redirects
- Modify: `src/components/ward-management/ward-nav.ts`, `ward-nav-icons.ts`
- Modify: `src/components/ward-management/ward-management-modes.tsx` (`ModeBody`)
- Test: `tests/ward-delays-derivations.test.ts`, `tests/ward-delays-screen.dom.test.tsx`

**Interfaces:**

- Consumes: `WardBar`, `WardRecordRow`, `WardGroupHeading`, `WardRecordList`, `WardFilters`,
  `WardSegmented`, `WardPanel`, `WardFigure`, `WardFigureStrip`; and from `ward-derivations.ts`:
  `buildActionInbox`, `escalationBoard`, `queueStageSummaries`, `isOpen`, `elapsedLabel`.
- Produces:

  ```ts
  export type DelayCause =
    | "legal_expiring"
    | "no_eligible_bed"
    | "awaiting_ward_answer"
    | "awaiting_bed_ready"
    | "awaiting_transport"
    | "patient_or_family"
    | "awaiting_coordinator";
  export type DelayGroup = { cause: DelayCause; title: string; note: string; movements: Movement[] };
  export function delayGroups(movements: Movement[], units: Unit[], now: Instant): DelayGroup[];
  export function waitingSplit(movements: Movement[], now: Instant): WardBarSegment[];
  ```

- [ ] **Step 1: Write the failing derivation test**

```ts
// tests/ward-delays-derivations.test.ts
import { describe, expect, it } from "vitest";

import { delayGroups, waitingSplit } from "@/components/ward-management/delays/delays-derivations";
import { allUnits } from "@/components/ward-management/ward-sites";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { isOpen } from "@/components/ward-management/ward-derivations";

const NOW = 10 * 60 + 42;

describe("delayGroups", () => {
  it("places every open movement in exactly one group — a patient is not counted twice", () => {
    const open = wardMovements.filter(isOpen);
    const grouped = delayGroups(wardMovements, allUnits(), NOW).flatMap((g) => g.movements.map((m) => m.id));
    expect(new Set(grouped).size, "a movement appears in two groups").toBe(grouped.length);
    expect([...grouped].sort()).toEqual(open.map((m) => m.id).sort());
  });

  it("puts an expiring legal authority first, above a longer wait", () => {
    const groups = delayGroups(wardMovements, allUnits(), NOW);
    // Only assert the ordering rule when the fixture actually exercises it, and say so when it
    // does not — a silently skipped ordering rule is how one comes back wrong.
    const legal = groups.findIndex((g) => g.cause === "legal_expiring");
    if (legal === -1) {
      expect(groups.map((g) => g.cause)).not.toContain("legal_expiring");
      return;
    }
    expect(legal).toBe(0);
  });

  it("returns no empty group, because a heading over nothing reads as a category that is fine", () => {
    for (const group of delayGroups(wardMovements, allUnits(), NOW)) {
      expect(group.movements.length, `${group.cause} is empty`).toBeGreaterThan(0);
    }
  });
});

describe("waitingSplit", () => {
  it("splits every open movement and nothing else", () => {
    const total = waitingSplit(wardMovements, NOW).reduce((sum, s) => sum + s.value, 0);
    expect(total).toBe(wardMovements.filter(isOpen).length);
  });
});
```

- [ ] **Step 2: Run and verify it fails**

Run: `GATE_RECEIPTS=off node scripts/run-vitest.mjs run tests/ward-delays-derivations.test.ts`
Expected: FAIL — module not resolved.

- [ ] **Step 3: Write `delays-derivations.ts`**

One movement, one cause. The cause is decided in this order and the first match wins — the order is
the clinical ranking from the design lock, §5.4.

```ts
// src/components/ward-management/delays/delays-derivations.ts
import type { Instant, Movement, Unit } from "@/components/ward-management/ward-model";
import type { WardBarSegment } from "@/components/ward-management/ward-bar";
import { destinationNoLongerLawful, isOpen, shortlistCandidates } from "@/components/ward-management/ward-derivations";
import { clockState } from "@/components/ward-management/ward-clock";

export type DelayCause =
  | "legal_expiring"
  | "no_eligible_bed"
  | "awaiting_ward_answer"
  | "awaiting_bed_ready"
  | "awaiting_transport"
  | "patient_or_family"
  | "awaiting_coordinator";

export type DelayGroup = { cause: DelayCause; title: string; note: string; movements: Movement[] };

const ORDER: { cause: DelayCause; title: string; note: string }[] = [
  {
    cause: "legal_expiring",
    title: "Legal authority running out",
    note: "nothing else on this page outranks it",
  },
  { cause: "no_eligible_bed", title: "No suitable bed anywhere in the network", note: "" },
  { cause: "awaiting_ward_answer", title: "Awaiting a ward's answer", note: "" },
  { cause: "awaiting_bed_ready", title: "Awaiting the bed itself", note: "each has a named bed" },
  { cause: "awaiting_transport", title: "Awaiting transport", note: "" },
  { cause: "patient_or_family", title: "Patient or family factors", note: "" },
  { cause: "awaiting_coordinator", title: "Awaiting a decision from the coordinator", note: "that is you" },
];

/**
 * ⚠️ ONE MOVEMENT, ONE CAUSE, FIRST MATCH WINS. A patient routinely satisfies several of these at
 * once — the whole reason the three old screens listed the same people three times. The row sits
 * under the highest-ranked cause and the rest show as chips on the row.
 *
 * ⚠️ The list is DELIBERATELY the owner's ruling that a fixed list of delay kinds exists; its exact
 * membership is a clinical question the owner has NOT ruled on (design lock §7). Do not add a
 * cause here without asking.
 */
export function delayGroups(movements: Movement[], units: Unit[], now: Instant): DelayGroup[] {
  const causeOf = (movement: Movement): DelayCause => {
    if (movement.legalForm?.dueAt !== undefined && clockState(movement.legalForm.dueAt, now) !== "ok") {
      return "legal_expiring";
    }
    if (destinationNoLongerLawful(movement, units) !== undefined) return "no_eligible_bed";
    if (movement.acceptedUnitId === undefined && shortlistCandidates(movement, units, now).length === 0) {
      return "no_eligible_bed";
    }
    if (movement.acceptedUnitId === undefined && movement.referredUnitIds.length > 0) {
      return "awaiting_ward_answer";
    }
    if (movement.stage === "pulled") return "awaiting_bed_ready";
    if (movement.transport !== undefined) return "awaiting_transport";
    if (movement.urgentFlag) return "patient_or_family";
    return "awaiting_coordinator";
  };

  const open = movements.filter(isOpen);
  return ORDER.map((entry) => ({
    ...entry,
    movements: open.filter((movement) => causeOf(movement) === entry.cause),
  })).filter((group) => group.movements.length > 0);
}

/** How long the whole waiting population has waited. One bar, one meaning. */
export function waitingSplit(movements: Movement[], now: Instant): WardBarSegment[] {
  const open = movements.filter(isOpen);
  const waited = (movement: Movement) => now - movement.openedAt;
  return [
    { label: "Under 4 hours", value: open.filter((m) => waited(m) < 4 * 60).length, tone: "good" },
    {
      label: "4 to 12 hours",
      value: open.filter((m) => waited(m) >= 4 * 60 && waited(m) < 12 * 60).length,
      tone: "warning",
    },
    { label: "Over 12 hours", value: open.filter((m) => waited(m) >= 12 * 60).length, tone: "danger" },
  ];
}
```

> If `Movement` has no `urgentFlag` or `openedAt` field under those exact names, **stop and hand
> back** rather than inventing one — `tests/ward-urgent-flag.test.ts` and the `openedAt` clock
> defect recorded in `docs/superpowers/plans/2026-09-04-ward-expected-free-time.md` both bear on it.

- [ ] **Step 4: Run the derivation test and verify green**

Run: `GATE_RECEIPTS=off node scripts/run-vitest.mjs run tests/ward-delays-derivations.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the screen's DOM test**

```tsx
// tests/ward-delays-screen.dom.test.tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";

function renderScreen() {
  return render(
    <WardFlowProvider>
      <DelaysScreen />
    </WardFlowProvider>,
  );
}

describe("the Delays screen", () => {
  it("says how many of the waiting population it is showing, and does not imply it shows them all", () => {
    renderScreen();
    expect(screen.getByText(/of 43 shown/u)).toBeInTheDocument();
  });

  it("carries the three panels the three old screens each carried alone", () => {
    renderScreen();
    expect(screen.getByRole("region", { name: /How long/u })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Who is waiting/u })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Worth your attention/u })).toBeInTheDocument();
  });

  // ⚠️ THE WHOLE POINT OF THE MERGE. The old screens listed the same person up to three times.
  it("lists every patient at most once across every group", () => {
    renderScreen();
    const ids = screen.getAllByTestId("delays-record-id").map((node) => node.textContent ?? "");
    expect(new Set(ids).size, `duplicated: ${ids.join(", ")}`).toBe(ids.length);
  });

  it("never presents a refusal as a block — an override is offered wherever one is refused", () => {
    renderScreen();
    for (const reason of screen.queryAllByText(/declined/iu)) {
      const row = reason.closest("[data-ward-primitive='record-row']");
      expect(row).not.toBeNull();
      expect(within(row as HTMLElement).getByRole("button", { name: /Override/u })).toBeInTheDocument();
    }
  });
});
```

- [ ] **Step 6: Write `delays-screen.tsx`**

Compose only the primitives already specified. The screen computes nothing itself: figures come from
`buildActionInbox` and `waitingSplit`, groups from `delayGroups`, attention items from
`escalationBoard`.

```tsx
// src/components/ward-management/delays/delays-screen.tsx
"use client";

import { useState } from "react";

import { WardBar } from "../ward-bar";
import { WardFilters } from "../ward-controls";
import { WardFigure, WardFigureStrip } from "../ward-figure";
import { WardPanel } from "../ward-panel";
import { WardGroupHeading, WardRecordList, WardRecordRow } from "../ward-record-row";
import { useWardFlow } from "../ward-flow-provider";
import { buildActionInbox, escalationBoard, isOpen } from "../ward-derivations";
import { delayGroups, waitingSplit } from "./delays-derivations";
import styles from "./delays.module.css";

export function DelaysScreen() {
  const { movements, units, now } = useWardFlow();
  const [filter, setFilter] = useState("waiting");

  const open = movements.filter(isOpen);
  const groups = delayGroups(movements, units, now);
  const shown = groups.reduce((sum, group) => sum + group.movements.length, 0);
  const inbox = buildActionInbox(movements, now, units);
  const board = escalationBoard(movements, units, now);

  return (
    <div className={styles.screen}>
      <WardFigureStrip>
        <WardFigure label="Waiting for a bed" value={String(open.length)} sub="Since 08:00" />
        <WardFigure
          label="Nowhere eligible in the network"
          value={String(groups.find((g) => g.cause === "no_eligible_bed")?.movements.length ?? 0)}
          flagged
        />
        <WardFigure label="Recorded for action" value={String(inbox.length)} flagged />
      </WardFigureStrip>

      <WardPanel title="How long the waiting population has waited" count={`${open.length} people`}>
        <WardBar segments={waitingSplit(movements, now)} caption={`${open.length} people waiting`} />
      </WardPanel>

      <WardPanel title="Who is waiting, and on what" count={`${shown} of ${open.length} shown`}>
        <WardFilters
          legend="Show"
          activeId={filter}
          onChange={setFilter}
          options={[
            { id: "waiting", label: "People waiting", count: open.length },
            { id: "action", label: "Recorded for action", count: inbox.length },
          ]}
        />
        {groups.map((group) => (
          <div key={group.cause}>
            <WardGroupHeading
              title={group.title}
              people={group.movements.length}
              note={group.note === "" ? undefined : group.note}
              tone={group.cause === "legal_expiring" || group.cause === "no_eligible_bed" ? "danger" : "neutral"}
            />
            <WardRecordList>
              {group.movements.map((movement) => (
                <WardRecordRow key={movement.id} id={movement.id} {...rowPropsFor(movement)} />
              ))}
            </WardRecordList>
          </div>
        ))}
      </WardPanel>

      <WardPanel title="Worth your attention" count={String(board.placementGoneWrong.length)}>
        {/* escalationBoard's own entries, rendered as WardRecordRow — no new shape */}
      </WardPanel>
    </div>
  );
}
```

`rowPropsFor(movement)` is a local helper in the same file. It must:

- put `data-testid="delays-record-id"` on the id (pass it through `WardRecordRow`'s `id` and add the
  testid in the primitive's `.id` span — **change `WardRecordRow` to always carry
  `data-testid="record-id"` on that span**, and have the DOM test query `record-id`);
- render an **Override** button on any row whose states include a decline; and
- take every attribute string from the movement's own fields, never from a literal.

> ⚠️ Amend the test in Step 5 to query `getAllByTestId("record-id")` to match. Do not add a
> screen-specific testid to a shared primitive.

- [ ] **Step 7: Write `delays.module.css`**

```css
/* src/components/ward-management/delays/delays.module.css
 * ⚠️ NO `background: var(--surface)` ON `.screen`. The ground exists so panels float on it; every
 * other ward screen paints over it, which is exactly the backlog COVERING_THE_GROUND records. */
.screen {
  display: grid;
  gap: var(--ward-space-12);
  padding: var(--ward-space-12);
}
@media (min-width: 64rem) {
  .screen {
    padding: var(--ward-space-16);
  }
}
```

- [ ] **Step 8: Add the route, the nav entry and the icon**

Create `src/app/mockups/ward-flow/delays/page.tsx`:

```tsx
import type { Metadata } from "next";

import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";

export const metadata: Metadata = {
  title: "Delays - Ward Flow",
  description:
    "Synthetic prototype: every patient whose placement is held up, under the one thing holding it up. Replaces the priority queue, the action inbox and the escalation board.",
};

export default function WardDelaysPage() {
  return <WardModeWorkspace mode="delays" />;
}
```

In `ward-nav.ts`: add `"delays"` to the `WardMode` union, remove `"queue"` and `"exceptions"`;
replace those two `WARD_VIEWS` entries with
`{ id: "delays", href: "/mockups/ward-flow/delays", label: "Delays" }` in their position; remove
`"escalation"` from `WardNavId` and from `WARD_NAV`.

In `ward-nav-icons.ts`: add a `delays` entry and remove `queue`, `exceptions`, `escalation`. The
union is compiler-guarded, so a missing icon is a type error, not a runtime crash.

In `ward-management-modes.tsx` `ModeBody`: replace the `queue` and `exceptions` branches with
`if (mode === "delays") return <DelaysScreen />;`. Delete `QueueView` and `ExceptionsView` **only if
nothing else imports them** — check with `grep -rn "QueueView\|ExceptionsView" src tests` first.

- [ ] **Step 9: Turn the three old routes into redirects**

Each of `queue`, `exceptions`, `escalation` `page.tsx` becomes, following the `/constellation`
idiom already in the tree:

```tsx
import { redirect } from "next/navigation";

/**
 * Folded into /delays on 2026-09-05 (design lock 2026-09-05-ward-flow-merges-1-3). Kept as a 307
 * rather than deleted: this path is in browser histories and in three committed documents, and a
 * dead bookmark inside a prototype reads as the prototype being broken.
 */
export default function WardQueuePage(): never {
  redirect("/mockups/ward-flow/delays");
}
```

Add all three paths to `WARD_NAV_INTENTIONALLY_UNLISTED` in `ward-nav.ts`, each with that reason.

- [ ] **Step 10: Run the whole affected set**

Run:

```bash
GATE_RECEIPTS=off node scripts/run-vitest.mjs run tests/ward-delays-derivations.test.ts tests/ward-delays-screen.dom.test.tsx tests/ward-nav.test.ts tests/ward-escalation.test.ts tests/ward-escalation.dom.test.tsx tests/ward-flow-queue-selection.dom.test.tsx tests/ward-network-queue-count.dom.test.tsx tests/ward-landmarks.test.ts
```

Expected: PASS. `ward-escalation.dom.test.tsx` will fail until it is re-pointed at `DelaysScreen`;
re-point it, do not delete it — `check:diff-integrity` enforces a test-case floor.

- [ ] **Step 11: Commit**

```bash
git add src/components/ward-management/delays src/app/mockups/ward-flow/delays src/app/mockups/ward-flow/queue src/app/mockups/ward-flow/exceptions src/app/mockups/ward-flow/escalation src/components/ward-management/ward-nav.ts src/components/ward-management/ward-nav-icons.ts src/components/ward-management/ward-management-modes.tsx src/components/ward-management/ward-record-row.tsx tests/ward-delays-derivations.test.ts tests/ward-delays-screen.dom.test.tsx tests/ward-escalation.dom.test.tsx
git commit -m "feat(ward-flow): the priority queue, the action inbox and the escalation board become Delays

Three screens listing the same forty-three people. WF-009 stood on all three at
once — as a long wait, as five wards declining, and as a recorded escalation.
Three rows, one man, one problem.

One movement gets one cause, first match wins, and the row carries the rest as
chips. Group headings count PEOPLE, not rows, because a patient satisfies
several causes at once and counting rows double-counts the sickest.

The three old paths are 307 redirects, not deletions, following the
/constellation idiom already in the tree.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Merge 02 — Capacity absorbs the morning bed state

The morning figures are a _time filter_ on one screen, not a second screen.

**Files:**

- Modify: `src/components/ward-management/ward-management-modes.tsx` (`CapacityView`)
- Create: `src/components/ward-management/capacity/capacity.module.css` (if `CapacityView` moves)
- Modify: `src/app/mockups/ward-flow/morning/page.tsx` → redirect
- Modify: `src/components/ward-management/ward-nav.ts`, `ward-nav-icons.ts`
- Test: `tests/ward-capacity-merged.dom.test.tsx`
- Keep: `ward-morning-rollup.ts` and `tests/ward-morning-rollup.test.ts` — the merged screen consumes them

**Interfaces:**

- Consumes: `WardSegmented` (`now` | `morning`), `WardBar`, `WardFreshness`, `unitCapacity`,
  and the existing morning roll-up in `ward-morning-rollup.ts`.
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/ward-capacity-merged.dom.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";

describe("Capacity, with the morning bed state folded in", () => {
  it("offers now and this morning as one control on one screen", async () => {
    render(<WardModeWorkspace mode="capacity" />);
    const group = screen.getByRole("group", { name: "As at" });
    expect(group).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /This morning/u }));
    expect(screen.getByRole("button", { name: /This morning/u })).toHaveAttribute("aria-pressed", "true");
  });

  // ⚠️ Staleness is shown as AGE, never as withdrawal. A figure nobody has refreshed is still the
  // best figure anyone has, and removing it leaves the reader with nothing at all.
  it("keeps a stale ward's figure on screen and marks its age", () => {
    render(<WardModeWorkspace mode="capacity" />);
    const stale = screen.getAllByTestId("capacity-confirmed").filter((n) => /old/u.test(n.textContent ?? ""));
    expect(stale.length).toBeGreaterThan(0);
    for (const node of stale) expect(node.textContent).toMatch(/\d/u);
  });

  it("draws the locked share and says so, so the bar cannot be read as occupancy", () => {
    render(<WardModeWorkspace mode="capacity" />);
    expect(screen.getAllByRole("img", { name: /locked/iu }).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run and verify it fails**

Run: `GATE_RECEIPTS=off node scripts/run-vitest.mjs run tests/ward-capacity-merged.dom.test.tsx`
Expected: FAIL — no `group` named "As at".

- [ ] **Step 3: Fold the morning view into `CapacityView`**

In `ward-management-modes.tsx`, `CapacityView` gains:

```tsx
const [asAt, setAsAt] = useState<"now" | "morning">("now");
```

and renders, above the table:

```tsx
<WardSegmented
  legend="As at"
  activeId={asAt}
  onChange={(id) => setAsAt(id as "now" | "morning")}
  options={[
    { id: "now", label: `Now · ${formatInstant(now)}` },
    { id: "morning", label: "This morning · 08:00" },
  ]}
/>
```

When `asAt === "morning"`, the figures come from the existing roll-up in `ward-morning-rollup.ts`
rather than from `unitCapacity(unit, bedReleases)` — **the same functions the morning page already
calls.** Do not re-derive them.

Each row's confirmation cell becomes `<WardFreshness … data-testid="capacity-confirmed" />` and each
row's designation cell becomes:

```tsx
<WardBar
  caption={`${unit.id} locked share`}
  segments={[
    { label: "Locked beds", value: unit.lockedBeds, tone: "accent" },
    { label: "Open beds", value: unit.beds - unit.lockedBeds, tone: "rest" },
  ]}
/>
```

- [ ] **Step 4: Redirect `/morning`, update the nav**

`src/app/mockups/ward-flow/morning/page.tsx`:

```tsx
import { redirect } from "next/navigation";

/** Folded into /capacity on 2026-09-05: the morning figures are a time filter on one screen, not a
 *  second screen. Kept as a 307 because ui-ward-morning.spec.ts and three documents reference it. */
export default function WardMorningPage(): never {
  redirect("/mockups/ward-flow/capacity?as-at=morning");
}
```

Remove `"morning"` from `WardNavId` and `WARD_NAV`; add the path to
`WARD_NAV_INTENTIONALLY_UNLISTED`; remove its icon.

`CapacityView` reads `as-at` from `useSearchParams()` for its initial state, so the redirect lands on
the morning figures rather than on today's.

- [ ] **Step 5: Re-point the morning tests, do not delete them**

`tests/ward-morning-page.dom.test.tsx`, `tests/ward-morning-tour.dom.test.tsx`,
`tests/ward-morning-tour-paused.dom.test.tsx` and `tests/ward-morning-print.test.ts` all render
`MorningPage`. Re-point each at `<WardModeWorkspace mode="capacity" />` with `as-at=morning`.
`tests/ui-ward-morning.spec.ts` navigates to `/mockups/ward-flow/morning`; leave the URL as it is —
it now exercises the redirect, which is worth keeping.

- [ ] **Step 6: Run**

Run:

```bash
GATE_RECEIPTS=off node scripts/run-vitest.mjs run tests/ward-capacity-merged.dom.test.tsx tests/ward-capacity-view.dom.test.tsx tests/ward-capacity-freshness-source.dom.test.tsx tests/ward-capacity-reconciliation.test.ts tests/ward-capacity-sexmix-release.dom.test.tsx tests/ward-morning-rollup.test.ts tests/ward-morning-page.dom.test.tsx tests/ward-morning-tour.dom.test.tsx tests/ward-morning-tour-paused.dom.test.tsx tests/ward-morning-print.test.ts tests/ward-nav.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/ward-management/ward-management-modes.tsx src/app/mockups/ward-flow/morning src/components/ward-management/ward-nav.ts src/components/ward-management/ward-nav-icons.ts tests/ward-capacity-merged.dom.test.tsx tests/ward-morning-page.dom.test.tsx tests/ward-morning-tour.dom.test.tsx tests/ward-morning-tour-paused.dom.test.tsx tests/ward-morning-print.test.ts
git commit -m "feat(ward-flow): the morning bed state becomes a time filter on Capacity

It was this screen at eight o'clock. That is a filter, not a destination — and
the morning figures still matter, because they are what today is compared
against. The roll-up is unchanged and is still the only place those figures are
computed.

The locked-share bar carries a caption naming its one meaning, so it can never
be read as occupancy — the mistake the column layout invited.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Merge 03 — Movements absorbs Transport

**Files:**

- Modify: `src/components/ward-management/ward-management-modes.tsx` (`MovementsView`)
- Modify: `src/app/mockups/ward-flow/transport/page.tsx` → redirect
- Modify: `src/components/ward-management/ward-nav.ts`, `ward-nav-icons.ts`
- Test: `tests/ward-movements-merged.dom.test.tsx`
- Keep: `tracker/tracker-derivations.ts` — the merged screen consumes it
- **Do not touch** `src/app/mockups/ward-flow/transport/officer/page.tsx`

**Interfaces:**

- Consumes: `stageSummaries`, `transportLeg`, `transportStatusLabel` from `ward-derivations.ts`;
  the tracker's own derivations; `WardBar`, `WardRecordRow`, `WardSegmented`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/ward-movements-merged.dom.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";

describe("Movements, with Transport folded in", () => {
  it("shows the transport lifecycle as a panel on this screen, not a separate destination", () => {
    render(<WardModeWorkspace mode="movements" />);
    expect(screen.getByRole("region", { name: /Transport, as a lifecycle/u })).toBeInTheDocument();
  });

  it("counts a within-site move as a journey even though no vehicle is involved", () => {
    render(<WardModeWorkspace mode="movements" />);
    expect(screen.getByRole("region", { name: /no transport need/iu })).toBeInTheDocument();
  });

  // ⚠️ The stage rail IS the board. Its counts must equal the rows the screen can show, or the
  // rail is a second, independently computed number — the defect the merge exists to remove.
  it("has stage counts that sum to the journeys in flight", () => {
    render(<WardModeWorkspace mode="movements" />);
    const counts = screen.getAllByTestId("stage-count").map((n) => Number(n.textContent));
    const total = Number(screen.getByTestId("in-flight-total").textContent);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(total);
  });
});
```

- [ ] **Step 2: Run and verify it fails**

Run: `GATE_RECEIPTS=off node scripts/run-vitest.mjs run tests/ward-movements-merged.dom.test.tsx`
Expected: FAIL — no region named "Transport, as a lifecycle".

- [ ] **Step 3: Fold the tracker into `MovementsView`**

Add to `MovementsView`, as an aside beside the stage list:

```tsx
<WardPanel title="Transport, as a lifecycle" count={`${active.length} active`}>
  <WardBar
    caption="Transport jobs in flight"
    segments={[
      { label: "Booked, not accepted", value: byLeg("Requested"), tone: "warning" },
      { label: "Accepted", value: byLeg("Accepted"), tone: "accent" },
      { label: "En route to collect", value: byLeg("En route"), tone: "accent" },
      { label: "Collected, moving", value: byLeg("Collected"), tone: "good" },
    ]}
  />
</WardPanel>

<WardPanel title="Journeys with no transport need" count={String(noTransport.length)}>
  <p className={styles.absent}>
    {noTransport.length === 0
      ? "Every journey in flight involves a vehicle today."
      : `${noTransport.length} of the journeys in flight are moves within one hospital, so no vehicle is involved. They still occupy a stage — a within-site move can stall exactly like any other, and the old Transport board could not see them at all.`}
  </p>
</WardPanel>
```

`byLeg` uses the existing `transportLeg(movement.transport)`. `noTransport` uses the existing
`transportNeedState(movement) === "not_needed"`. Neither is re-derived.

Put `data-testid="stage-count"` on each stage count and `data-testid="in-flight-total"` on the
in-flight total.

- [ ] **Step 4: Redirect `/transport`, update the nav, leave the officer alone**

```tsx
// src/app/mockups/ward-flow/transport/page.tsx
import { redirect } from "next/navigation";

/**
 * Folded into /movements on 2026-09-05. A transport job has no life of its own: it is created when
 * a bed is pulled, and its last two events are the same events that advance the patient.
 *
 * ⚠️ `transport/officer` IS NOT AFFECTED. It is a nested route and does not need this parent page;
 * it stays in WARD_NAV in its own right. It is a different person doing four things on a phone,
 * possibly in a car park, and folding it in would ruin the one screen that must work one-handed.
 */
export default function WardTransportPage(): never {
  redirect("/mockups/ward-flow/movements");
}
```

Remove `"transport"` from the `WardMode` union, from `WARD_VIEWS` and from `WARD_VIEW_ICONS`; add
`/mockups/ward-flow/transport` to `WARD_NAV_INTENTIONALLY_UNLISTED`. Removing the union member makes
`ModeBody`'s `if (mode === "transport") return <TransportView />;` a type error — delete that branch
and `TransportView` with it. **That is the whole of the dead-code removal this plan sanctions**, and
it is safe because the union change is what proves nothing else can reach it.

- [ ] **Step 5: Run**

Run:

```bash
GATE_RECEIPTS=off node scripts/run-vitest.mjs run tests/ward-movements-merged.dom.test.tsx tests/ward-transport-page-name.test.ts tests/ward-book-transport.test.ts tests/ward-transport-cancel-permission.test.ts tests/ward-tracker-leg-badge.dom.test.tsx tests/ward-officer-blocked-reason-parity.test.ts tests/ward-nav.test.ts
```

Expected: PASS. `ward-transport-page-name.test.ts` asserts the old page's name — re-point it at the
merged panel rather than deleting it.

- [ ] **Step 6: Commit**

```bash
git add src/components/ward-management/ward-management-modes.tsx src/app/mockups/ward-flow/transport/page.tsx src/components/ward-management/ward-nav.ts src/components/ward-management/ward-nav-icons.ts tests/ward-movements-merged.dom.test.tsx tests/ward-transport-page-name.test.ts
git commit -m "feat(ward-flow): Transport becomes a lifecycle panel on Movements

A transport job has no life of its own. It is created when a bed is pulled and
moves accepted -> en route -> collected -> arrived; the last two are the same
events that advance the patient to Moving and close the journey. One thing,
tracked twice, on two screens.

Removing 'transport' from the WardMode union is what proves TransportView was
unreachable — no route ever rendered WardModeWorkspace mode='transport' — so
the branch and the component go together, by compiler error rather than by
search.

transport/officer is untouched.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: The fold's own contract, and the guard-list sweep

Two things nothing above can check: that the fold actually happened, and that the guards which
maintain lists were updated rather than left stale.

**Files:**

- Create: `tests/ward-merged-destinations.test.ts`
- Modify: `tests/ward-design-language-contract.test.ts` (`COVERING_THE_GROUND`)
- Modify: `tests/ward-primitives-shared.test.ts` (`KNOWN_BREAKPOINTS`)
- Delete: `escalation/`, `morning/morning-page.tsx`, `morning/morning.module.css`, `tracker/live-tracker.tsx`, `tracker/live-tracker.module.css`

- [ ] **Step 1: Write the contract test**

```ts
// tests/ward-merged-destinations.test.ts
import { describe, expect, it } from "vitest";

import { WARD_NAV, WARD_NAV_INTENTIONALLY_UNLISTED, WARD_VIEWS } from "@/components/ward-management/ward-nav";

/**
 * ⚠️ THE FOLD'S OWN GATE. `ward-nav.test.ts` checks that every link resolves and every route is
 * accounted for — it would stay green if all nine old destinations came back tomorrow. This one
 * says what the merge decided, and it is the only thing that does.
 */
describe("merges 1–3 as decided in the 2026-09-05 design lock", () => {
  const destinations = WARD_VIEWS.length + WARD_NAV.length;

  it("leaves nineteen destinations, not twenty-three", () => {
    expect(destinations).toBe(19);
  });

  it("has folded away every one of the five old destinations", () => {
    const hrefs = new Set([...WARD_VIEWS, ...WARD_NAV].map((item) => item.href));
    for (const gone of [
      "/mockups/ward-flow/queue",
      "/mockups/ward-flow/exceptions",
      "/mockups/ward-flow/escalation",
      "/mockups/ward-flow/morning",
      "/mockups/ward-flow/transport",
    ]) {
      expect(hrefs.has(gone), `${gone} is still a navigation destination`).toBe(false);
      expect(
        WARD_NAV_INTENTIONALLY_UNLISTED.has(gone),
        `${gone} was removed from the nav but never recorded as a deliberate redirect`,
      ).toBe(true);
    }
  });

  it("keeps the officer screen, which is deliberately NOT folded in", () => {
    const hrefs = new Set(WARD_NAV.map((item) => item.href));
    expect(hrefs.has("/mockups/ward-flow/transport/officer")).toBe(true);
  });

  it("keeps both merge-4 destinations, which this work does not touch", () => {
    const hrefs = new Set(WARD_NAV.map((item) => item.href));
    expect([...hrefs].some((h) => h.startsWith("/mockups/ward-flow/ward/"))).toBe(true);
    expect([...hrefs].some((h) => h.startsWith("/mockups/ward-flow/board/"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and read what fails**

Run: `GATE_RECEIPTS=off node scripts/run-vitest.mjs run tests/ward-merged-destinations.test.ts`
Expected: PASS if Tasks 5–7 landed. **If the count is not 19, do not change the expectation** — recount
`WARD_VIEWS` and `WARD_NAV` and find the entry that did not move.

- [ ] **Step 3: Remove the three folded screens' files**

```bash
git rm src/components/ward-management/escalation/escalation-board.tsx \
       src/components/ward-management/escalation/escalation.module.css \
       src/components/ward-management/morning/morning-page.tsx \
       src/components/ward-management/morning/morning.module.css \
       src/components/ward-management/tracker/live-tracker.tsx \
       src/components/ward-management/tracker/live-tracker.module.css
```

Keep `morning/morning-tour.tsx`, `morning/morning-tour.module.css`,
`tracker/tracker-derivations.ts` and `ward-morning-rollup.ts` — the merged screens consume all four.

> ⚠️ If a `git rm` is refused by this machine's worktree-protection hook, **stop and hand back**.
> Do not use `CLAUDE_ALLOW_PROTECTED_DELETE=1`; that override is the owner's to grant.

- [ ] **Step 4: Update the two guard lists in the same commit**

`tests/ward-design-language-contract.test.ts` — remove from `COVERING_THE_GROUND`:

```
    "escalation/escalation.module.css",
    "tracker/live-tracker.module.css",
```

That list is checked in **both** directions, so leaving them makes the suite red with
`freed — remove from COVERING_THE_GROUND`. That is the guard working.

`tests/ward-primitives-shared.test.ts` — add to `KNOWN_BREAKPOINTS`, sorted:

```
    "src/components/ward-management/delays/delays.module.css: 64",
```

- [ ] **Step 5: Run the full ward suite**

Run:

```bash
GATE_RECEIPTS=off node scripts/run-vitest.mjs run tests/ward-*.test.ts tests/ward-*.dom.test.tsx
```

Expected: PASS. **Refuse a silent zero** — if the run reports fewer than 200 test files, the glob did
not expand and the green means nothing.

- [ ] **Step 6: Format, then the broad local gate**

```bash
npm run format
GATE_RECEIPTS=off npm run verify:cheap
```

Format is in neither `test`, `typecheck` nor `lint`, and an uncommitted format leaves CI red on the
pushed blob. Commit the formatting result.

- [ ] **Step 7: Commit**

```bash
git add tests/ward-merged-destinations.test.ts tests/ward-design-language-contract.test.ts tests/ward-primitives-shared.test.ts
git commit -m "test(ward-flow): pin the fold, and clear the two guard lists it changes

ward-nav.test.ts checks that every link resolves and every route is accounted
for; it would stay green if all nine old destinations came back tomorrow. This
says what the merge decided — nineteen destinations, five folded and recorded
as redirects, the officer screen kept out of it, and both merge-4 destinations
untouched.

COVERING_THE_GROUND loses escalation and live-tracker. That list is checked in
both directions on purpose, so a screen that is freed and not removed from it
goes red rather than quietly tolerating the cover coming back.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Self-review

**Spec coverage.** §1 fold arithmetic → Tasks 5–8. §2 redirects → Tasks 5, 6, 7 (steps 9, 4, 4) and
pinned in Task 8. §3 token map → Tasks 2–4 stylesheets; the three deviations are stated in the spec
and carried by "no `font-family` outside a `var()`" and the absence of any teal token. §4 primitive
inventory → Tasks 2–4. §5 behaviour rules 1, 2, 3 → enforced in code by Tasks 2 and 3; rule 4 →
`delayGroups` ORDER + its test; rule 5 → Task 5 step 5's override test; rule 6 → Task 6 step 1's
staleness test; rule 7 → already pinned by `ward-locked-not-authorised.test.ts`, untouched; rule 8 →
Task 5's "of 43 shown" test. §6 layout → Task 5 step 7 and Task 8 step 4. §8 blocker → Task 1.

**Gap found and closed:** §5 rule 7 has no new task because an existing test already pins it — stated
rather than left looking uncovered.

**Placeholder scan.** No "TBD", no "add error handling", no "similar to Task N". Two steps
deliberately say _stop and hand back_ rather than guessing (Task 5 step 3 on field names, Task 8
step 3 on the deletion hook); both name the exact condition.

**Type consistency.** `WardBarSegment` is produced in Task 2 and consumed by name in Tasks 5, 6, 7.
`WardChipLevel` is imported from the existing `ward-chip.tsx`, not redefined. `WardRecordRow`'s `id`
prop is the movement id in every call site. `fallbackUnitId`'s new fourth parameter is `LegalStatus`
in both its definition and its two call sites. One inconsistency was found and fixed inline: Task 5
step 5's test queried `delays-record-id` while step 6 puts `record-id` on the shared primitive — the
step now says to amend the test rather than add a screen-specific testid to a shared component.
