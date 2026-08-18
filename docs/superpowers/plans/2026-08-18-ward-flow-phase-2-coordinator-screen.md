# Ward Flow Phase 2 — the coordinator screen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the flow coordinator's single screen — the one surface that replaces the phone-around — and retire Constellation into it.

**Architecture:** Phase 1 built the model and left the ten legacy routes rendering it. Phase 2 builds one screen properly against that model, in five stacked regions: ED pressure strip, priority queue, flow diagram, explainable shortlist, exceptions. The diagram is reshaped so demand enters from the left (emergency departments), passes through statewide flow, and lands on the right (inpatient units) — the patient journey, rather than the region clustering it has today. Every derivation stays a pure function in `ward-derivations.ts` or a new sibling module; components render, they do not compute.

**Tech Stack:** Next.js 16 App Router (thin server route → `"use client"` workspace), React 19, TypeScript 6 strict, CSS Modules with a local token scale, Vitest for derivations, Playwright Chromium for journeys.

**Spec:** [`docs/superpowers/specs/2026-08-18-ward-flow-metro-patient-flow-design.md`](../specs/2026-08-18-ward-flow-metro-patient-flow-design.md) — §6 (roles and screens), §7 (how a movement travels), §8 (ordering the queue), §10 (failure behaviour), §11 (success criteria).

**Read first:** [`docs/ward-flow-phase-handoff.md`](../../ward-flow-phase-handoff.md) — Phase 1's rulings, parked findings and repo traps. Several parked items land in files this phase touches.

## Global Constraints

- **Nothing auto-allocates.** Every placement is a human confirm or override, with the reason recorded. No timeout default, no "accept if confidence exceeds N". Spec §12.
- **Authorisation gates the destination only.** Detention in an unauthorised emergency department is lawful and normal — it is where nearly every patient waits. No surface may treat a patient's current ED as a compliance problem.
- **The queue orders by urgency tier first.** The operational score orders only _within_ a tier and contains no urgency component. It is labelled operational and never described as severity, acuity or risk. Spec §8.
- **Conservative failure.** Missing or stale data narrows what is shown, never widens it. Unknown legal status requires an authorised destination. A missing lookup renders an explicit empty state — never a substituted record.
- **Display less rather than something plausible.** This is the governing rule of the whole build. Phase 1's final review found a green tick beside "is not authorised under the Mental Health Act", a bed grid that did not reconcile on 10 of 22 units, and "48 open movements" counting closed records. Every one read as true and was not. When a value is unavailable, show its absence.
- **Synthetic only.** No name, date of birth, medical record number, address, diagnosis, narrative history or treatment. `Sex` is the single permitted patient attribute.
- **Determinism.** No `Math.random()`. No wall-clock read outside `ward-clock.ts` — every function takes `now: Instant`.
- **Design tokens only.** No raw hex; no raw padding/gap/z-index/line-height literals in CSS Modules — declare a local token in the module's root block first. `npm run check:design-system-contract` ratchets these and fails on any increase.
- **Tap targets are `3rem` (48px) minimum.** Never reduce to `2.75rem` for a generic WCAG rule — that reintroduces a known `ui-smoke` flake.
- **Button wiring.** Every `<button>` has an `onClick`, is a submit inside a form, or is a `<Link>`. A control unavailable for a stated reason uses `aria-disabled="true"` + inert handler + `title="… — coming soon"` + an `sr-only` note. Never both `disabled` and `aria-disabled`.
- **One composer per page.** Ward Flow routes own their own chrome; do not add a second search composer.
- **`npm run format` and commit the result** before any push — it is in neither `lint`, `typecheck` nor `test`.

## Repo traps that will cost you an hour each

- **`npm run lint` can exit 0 without running,** printing `DATABASE_HEAVY_RUN_ADMISSION_BUSY` when another heavyweight command holds the lock. Read the output, never the exit code.
- **A bare `npx playwright test` is rejected** by the config guard ("Playwright requires a runner-owned local server"), and a backgrounded wrapper still reports exit 0. Use `PLAYWRIGHT_BASE_URL=http://localhost:3718 npx playwright test …` after `npm run ensure`.
- **A new spec file must be added to BOTH** `testMatch` and `productionSpecPattern` in `playwright.config.ts`, or it silently runs zero tests.
- **A new route needs a literal `<Link href="...">`** in `WardModeNavigation` — hrefs built from an array are invisible to `tests/route-reachability.test.ts` and the route fails as an orphan.
- **Every route must be declared** in `docs/design-system/adoption-contract.json` under the `ward-management` surface, then `npm run design-system:adoption:update` run.
- **The pre-commit hook regenerates docs and stops for review.** Stage what it regenerates and commit again. It is slow — allow minutes.
- **Clicking before hydration flakes.** Wait on a client-only artefact first; the diagram's connector paths (`svg path[marker-end]`) are the reliable signal.

---

## What already exists

Phase 1's model, all committed and reviewed:

```ts
// ward-clock.ts
type Instant = number;                     // minutes since midnight, synthetic day
type ClockState = "breached" | "critical" | "due" | "clear";
minutesUntil(due, now); clockState(due, now);
formatRemaining(mins);                     // countdown: "1h 33m left" / "42m overdue"
formatElapsed(mins);                       // elapsed: "1h 35m waiting"
formatInstant(instant);                    // wraps negatives correctly

// ward-model.ts — types only
MOVEMENT_STAGES (7), DECLINE_REASONS (6), PARALLEL_REFERRAL_CAP = 3
Site, EmergencyDepartment, Unit, Movement, CapacityFigure, Decline,
StatusChange, TransportJob, MovementClosure, BedRelease, LegalForm, LegalStatus

// ward-eligibility.ts
requiresAuthorisedDestination(status): boolean
eligibility(movement, unit, now): { eligible: boolean; gates: GateResult[] }   // 8 gates

// ward-sites.ts — 17 sites, 8 EDs, 22 units. NOW_ANCHOR = 10*60+42
wardSites, allUnits(), allEmergencyDepartments(), unitById(id), siteByCode(code)   // undefined on miss

// ward-movements.ts — 48 movements, 6 bed releases
wardMovements, movementById(id), movementsByStage(stage), bedReleases

// ward-derivations.ts — pure, no React
WardRole, stageCopy, stageSummaries, movementStageSummary, wardServiceOrder,
roleLabels, roleTaskLabel, movementHealthService, elapsedLabel, isOpen,
destinationUnit, unitSiteCode, transportStatusLabel, unitCapacity,
eligibleCandidates, candidateReason, InboxItem, buildActionInbox, movementTimeline
```

**There is no operational score.** Phase 1 deleted `operationalPriorityScore` because it folded urgency into a number labelled "not clinical severity". Task 1 below defines the real one.

## File Structure

| File                                                                | Responsibility                                                                             |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/components/ward-management/ward-priority.ts`                   | **New.** The operational score and the queue ordering. Pure, urgency-free, no React.       |
| `src/components/ward-management/ward-pressure.ts`                   | **New.** Per-emergency-department pressure: waiting, longest wait, breaching. Pure.        |
| `src/components/ward-management/coordinator/coordinator-screen.tsx` | **New.** The workspace shell and layout. Composes the five regions; holds selection state. |
| `src/components/ward-management/coordinator/pressure-strip.tsx`     | **New.** ED pressure strip.                                                                |
| `src/components/ward-management/coordinator/priority-queue.tsx`     | **New.** The queue.                                                                        |
| `src/components/ward-management/coordinator/flow-diagram.tsx`       | **New.** EDs → statewide flow → units, with routes for the selected movement.              |
| `src/components/ward-management/coordinator/shortlist-panel.tsx`    | **New.** Candidates, gates, declines, confirm/override.                                    |
| `src/components/ward-management/coordinator/exception-drawer.tsx`   | **New.** Exceptions, collapsed by default.                                                 |
| `src/components/ward-management/coordinator/coordinator.module.css` | **New.** One token block, one layout, region styles.                                       |
| `src/app/ward-management/page.tsx`                                  | **Rewritten** to render `CoordinatorScreen`.                                               |
| `tests/ward-priority.test.ts` · `tests/ward-pressure.test.ts`       | **New.** Derivation contracts.                                                             |
| `tests/ui-ward-coordinator.spec.ts`                                 | **New.** Chromium journeys for the screen.                                                 |

Components live under `coordinator/` because Phase 1's review found fourteen pure functions parked inside a 991-line component that eight routes imported through. Keep computation in `ward-priority.ts` / `ward-pressure.ts` / `ward-derivations.ts`; keep components rendering.

Derivations (Tasks 1–2) come before any screen, because every region reads them.

---

### Task 1: The operational score

Phase 1 deleted the old score for folding urgency into a number labelled "not clinical severity". Rebuild it honestly: it answers _how badly is this movement going_, which is an operations question, and it never touches urgency.

**Files:**

- Create: `src/components/ward-management/ward-priority.ts`
- Create: `tests/ward-priority.test.ts`

**Interfaces:**

- Consumes: `Movement`, `Instant`, `clockState`, `minutesUntil`, `isOpen`.
- Produces: `operationalScore(movement, now): { score: number; factors: ScoreFactor[] }` where `ScoreFactor = { label: string; points: number; detail: string }`; `queueOrder(movements, now): Movement[]`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/ward-priority.test.ts
import { describe, expect, it } from "vitest";

import { operationalScore, queueOrder } from "../src/components/ward-management/ward-priority";
import { wardMovements } from "../src/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import type { Movement } from "../src/components/ward-management/ward-model";

function movementById(id: string) {
  const found = wardMovements.find((movement) => movement.id === id);
  if (!found) throw new Error(`fixture is missing ${id}`);
  return found;
}

describe("operational score", () => {
  it("never reads urgency — two movements differing only in tier score identically", () => {
    const base = movementById("WF-001");
    const tierOne: Movement = { ...base, urgency: 1 };
    const tierThree: Movement = { ...base, urgency: 3 };
    expect(operationalScore(tierOne, NOW_ANCHOR).score).toBe(operationalScore(tierThree, NOW_ANCHOR).score);
  });

  it("scores a longer wait above a shorter one, all else equal", () => {
    const base = movementById("WF-001");
    const waitedLonger: Movement = { ...base, openedAt: base.openedAt - 240 };
    expect(operationalScore(waitedLonger, NOW_ANCHOR).score).toBeGreaterThan(operationalScore(base, NOW_ANCHOR).score);
  });

  it("scores a breached legal deadline above a clear one", () => {
    const base = movementById("WF-001");
    const breached: Movement = {
      ...base,
      legalForm: { code: "1A", label: "Referral for examination", kind: "examination", dueAt: NOW_ANCHOR - 30 },
    };
    const clear: Movement = {
      ...base,
      legalForm: { code: "1A", label: "Referral for examination", kind: "examination", dueAt: NOW_ANCHOR + 400 },
    };
    expect(operationalScore(breached, NOW_ANCHOR).score).toBeGreaterThan(operationalScore(clear, NOW_ANCHOR).score);
  });

  it("explains itself — every point scored is attributed to a named factor", () => {
    for (const movement of wardMovements) {
      const { score, factors } = operationalScore(movement, NOW_ANCHOR);
      expect(factors.reduce((sum, factor) => sum + factor.points, 0)).toBe(score);
      for (const factor of factors) {
        expect(factor.label.length).toBeGreaterThan(0);
        expect(factor.detail.length).toBeGreaterThan(0);
      }
    }
  });

  it("stays inside its stated range so it cannot be read as a percentage of anything", () => {
    for (const movement of wardMovements) {
      const { score } = operationalScore(movement, NOW_ANCHOR);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

describe("queue order", () => {
  it("puts every tier 1 movement above every tier 2, and every tier 2 above every tier 3", () => {
    const ordered = queueOrder(wardMovements, NOW_ANCHOR);
    const tiers = ordered.map((movement) => movement.urgency);
    expect([...tiers].sort((a, b) => a - b)).toEqual(tiers);
  });

  it("orders by operational score within a tier, highest first", () => {
    const ordered = queueOrder(wardMovements, NOW_ANCHOR);
    for (let index = 1; index < ordered.length; index += 1) {
      if (ordered[index].urgency !== ordered[index - 1].urgency) continue;
      expect(operationalScore(ordered[index - 1], NOW_ANCHOR).score).toBeGreaterThanOrEqual(
        operationalScore(ordered[index], NOW_ANCHOR).score,
      );
    }
  });

  it("excludes closed and arrived movements", () => {
    const ordered = queueOrder(wardMovements, NOW_ANCHOR);
    expect(ordered.every((movement) => !movement.closure && movement.stage !== "arrived")).toBe(true);
    expect(ordered.length).toBeLessThan(wardMovements.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ward-priority.test.ts`
Expected: FAIL with "Cannot find module '../src/components/ward-management/ward-priority'".

- [ ] **Step 3: Write the implementation**

```ts
// src/components/ward-management/ward-priority.ts
import { clockState, minutesUntil, type Instant } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { PARALLEL_REFERRAL_CAP, type Movement } from "@/components/ward-management/ward-model";

export type ScoreFactor = { label: string; points: number; detail: string };

/**
 * How badly this movement is going — an operations question, not a clinical one.
 *
 * Deliberately blind to `movement.urgency`. Urgency is the clinician's judgement and orders the
 * queue on its own; folding it in here produced a number labelled "not clinical severity" that
 * partly was, which is why the previous score was deleted rather than migrated.
 */
export function operationalScore(movement: Movement, now: Instant): { score: number; factors: ScoreFactor[] } {
  const factors: ScoreFactor[] = [];

  const waitedMinutes = Math.max(0, now - movement.openedAt);
  const waitPoints = Math.min(40, Math.floor(waitedMinutes / 15));
  if (waitPoints > 0) {
    factors.push({
      label: "Time waiting",
      points: waitPoints,
      detail: `${Math.floor(waitedMinutes / 60)}h ${waitedMinutes % 60}m since the placement request`,
    });
  }

  if (movement.legalForm) {
    const state = clockState(movement.legalForm.dueAt, now);
    const points = state === "breached" ? 30 : state === "critical" ? 20 : state === "due" ? 10 : 0;
    if (points > 0) {
      const remaining = minutesUntil(movement.legalForm.dueAt, now);
      factors.push({
        label: "Statutory timing",
        points,
        detail:
          remaining < 0
            ? `Form ${movement.legalForm.code} passed its deadline ${Math.abs(remaining)} min ago`
            : `Form ${movement.legalForm.code} due in ${remaining} min`,
      });
    }
  }

  if (movement.declines.length > 0) {
    const points = Math.min(15, movement.declines.length * 5);
    factors.push({
      label: "Destinations declined",
      points,
      detail: `${movement.declines.length} of ${PARALLEL_REFERRAL_CAP} parallel referrals declined`,
    });
  }

  if (movement.blocker && movement.blocker !== "No blocker") {
    factors.push({ label: "Active blocker", points: 10, detail: movement.blocker });
  }

  if (movement.transport && !movement.transport.collectedAt && movement.transport.acceptedAt !== undefined) {
    factors.push({ label: "Transport delay", points: 5, detail: "Accepted but not yet collected" });
  }

  const score = Math.min(
    100,
    factors.reduce((sum, factor) => sum + factor.points, 0),
  );
  return { score, factors };
}

/** Urgency tier leads; the operational score only orders movements inside a tier. */
export function queueOrder(movements: Movement[], now: Instant): Movement[] {
  return movements
    .filter(isOpen)
    .slice()
    .sort((a, b) => a.urgency - b.urgency || operationalScore(b, now).score - operationalScore(a, now).score);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ward-priority.test.ts`
Expected: PASS (8 tests).

If the "explains itself" test fails because `score` was clamped below the factor sum, that is the clamp doing its job on an extreme movement — adjust the factor weights so the maximum reachable sum is 100, rather than weakening the assertion.

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/components/ward-management/ward-priority.ts tests/ward-priority.test.ts
git commit -m "feat(ward-flow): define the operational score with no urgency component"
```

---

### Task 2: Emergency department pressure

The first number a coordinator scans at handover is _which department is in the worst state_. That is per-department, not per-patient, and nothing computes it yet.

**Files:**

- Create: `src/components/ward-management/ward-pressure.ts`
- Create: `tests/ward-pressure.test.ts`

**Interfaces:**

- Consumes: `allEmergencyDepartments`, `wardMovements`, `isOpen`, `clockState`, `Instant`.
- Produces: `edPressure(now): EdPressure[]` where `EdPressure = { ed: EmergencyDepartment; waiting: number; longestWaitMinutes: number; breaching: number }`, sorted worst first.

- [ ] **Step 1: Write the failing test**

```ts
// tests/ward-pressure.test.ts
import { describe, expect, it } from "vitest";

import { edPressure } from "../src/components/ward-management/ward-pressure";
import { isOpen } from "../src/components/ward-management/ward-derivations";
import { wardMovements } from "../src/components/ward-management/ward-movements";
import { NOW_ANCHOR, allEmergencyDepartments } from "../src/components/ward-management/ward-sites";

describe("emergency department pressure", () => {
  it("reports every department, including quiet ones", () => {
    expect(edPressure(NOW_ANCHOR)).toHaveLength(allEmergencyDepartments().length);
  });

  it("counts only open movements — an arrived or closed patient is not still waiting", () => {
    const total = edPressure(NOW_ANCHOR).reduce((sum, row) => sum + row.waiting, 0);
    expect(total).toBe(wardMovements.filter(isOpen).length);
  });

  it("never reports a longer wait than the department's longest-waiting movement", () => {
    for (const row of edPressure(NOW_ANCHOR)) {
      const waits = wardMovements
        .filter((movement) => isOpen(movement) && movement.originEdId === row.ed.id)
        .map((movement) => NOW_ANCHOR - movement.openedAt);
      expect(row.longestWaitMinutes).toBe(waits.length ? Math.max(...waits) : 0);
    }
  });

  it("counts a breach only where a legal deadline has actually passed", () => {
    for (const row of edPressure(NOW_ANCHOR)) {
      const breaching = wardMovements.filter(
        (movement) =>
          isOpen(movement) &&
          movement.originEdId === row.ed.id &&
          movement.legalForm !== undefined &&
          movement.legalForm.dueAt < NOW_ANCHOR,
      ).length;
      expect(row.breaching).toBe(breaching);
    }
  });

  it("sorts worst first — breaching, then longest wait, then volume", () => {
    const rows = edPressure(NOW_ANCHOR);
    for (let index = 1; index < rows.length; index += 1) {
      const previous = rows[index - 1];
      const current = rows[index];
      const previousKey = [previous.breaching, previous.longestWaitMinutes, previous.waiting];
      const currentKey = [current.breaching, current.longestWaitMinutes, current.waiting];
      expect(previousKey >= currentKey || previousKey.join() === currentKey.join()).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ward-pressure.test.ts`
Expected: FAIL with "Cannot find module '../src/components/ward-management/ward-pressure'".

- [ ] **Step 3: Write the implementation**

```ts
// src/components/ward-management/ward-pressure.ts
import type { Instant } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import type { EmergencyDepartment } from "@/components/ward-management/ward-model";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";

export type EdPressure = {
  ed: EmergencyDepartment;
  waiting: number;
  longestWaitMinutes: number;
  breaching: number;
};

/** Worst first: a passed legal deadline outranks a long wait, which outranks sheer volume. */
export function edPressure(now: Instant): EdPressure[] {
  return allEmergencyDepartments()
    .map((ed) => {
      const open = wardMovements.filter((movement) => isOpen(movement) && movement.originEdId === ed.id);
      const waits = open.map((movement) => now - movement.openedAt);
      return {
        ed,
        waiting: open.length,
        longestWaitMinutes: waits.length ? Math.max(...waits) : 0,
        breaching: open.filter((movement) => movement.legalForm !== undefined && movement.legalForm.dueAt < now).length,
      };
    })
    .sort((a, b) => b.breaching - a.breaching || b.longestWaitMinutes - a.longestWaitMinutes || b.waiting - a.waiting);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ward-pressure.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/components/ward-management/ward-pressure.ts tests/ward-pressure.test.ts
git commit -m "feat(ward-flow): derive per-department pressure from open movements"
```

---

### Task 3: The screen shell and layout

The frame every later task fills. Build it with all five regions present but stubbed, so the layout is judged before any region is detailed — a five-region screen whose proportions are wrong is cheaper to fix now than after each region is built.

**Files:**

- Create: `src/components/ward-management/coordinator/coordinator-screen.tsx`
- Create: `src/components/ward-management/coordinator/coordinator.module.css`
- Modify: `src/app/ward-management/page.tsx`
- Create: `tests/ui-ward-coordinator.spec.ts`
- Modify: `playwright.config.ts`, `docs/design-system/adoption-contract.json`

**Interfaces:**

- Consumes: `queueOrder` (Task 1), `edPressure` (Task 2), `NOW_ANCHOR`.
- Produces: `CoordinatorScreen()` — no props; owns `selectedMovementId`, `selectedUnitId`, `exceptionsOpen`.

- [ ] **Step 1: Write the failing Chromium test**

```ts
// tests/ui-ward-coordinator.spec.ts
import { expect, test, type Page } from "playwright/test";

async function gotoCoordinator(page: Page) {
  await page.goto("/ward-management", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("ward-coordinator")).toBeVisible({ timeout: 15_000 });
}

test.describe("Ward Flow coordinator screen", () => {
  test.describe.configure({ timeout: 45_000 });

  test("presents the five coordination regions", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoCoordinator(page);

    await expect(page.getByRole("region", { name: "Emergency department pressure" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Priority queue" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Statewide flow" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Explainable shortlist" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Exceptions/ })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Register the spec in BOTH Playwright matchers**

In `playwright.config.ts`, add `ward-coordinator` to the top-level `testMatch` regex **and** the per-project `productionSpecPattern` regex. Missing either yields "Error: No tests found."

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run ensure`, then `PLAYWRIGHT_BASE_URL=http://localhost:3718 npx playwright test tests/ui-ward-coordinator.spec.ts --project=chromium`
Expected: FAIL — `ward-coordinator` test id does not exist.

- [ ] **Step 4: Build the shell**

`CoordinatorScreen` renders `<div className={styles.screen} data-testid="ward-coordinator">` containing, in order: `ClinicalRail`, `WardModeNavigation active="command"`, then a grid with five regions. Each region is a landmark with the exact accessible name the test asserts. Stub the interiors with the real counts only — `edPressure(NOW_ANCHOR).length` departments, `queueOrder(wardMovements, NOW_ANCHOR).length` movements — so the layout is judged against real volume, not three placeholder rows.

Layout at ≥1440px: pressure strip full width across the top; below it a three-column grid — queue (`14rem`), diagram (`minmax(38rem, 1fr)`), shortlist (`23rem`); exceptions a collapsed drawer pinned to the bottom edge.

In `coordinator.module.css`, declare the token block first — `--co-space-*`, `--co-leading-*`, `--co-z-*` mapped to repo tokens — then use only those. No raw padding, gap, z-index or line-height literals.

- [ ] **Step 5: Point the route at it**

```tsx
// src/app/ward-management/page.tsx
import type { Metadata } from "next";

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";

export const metadata: Metadata = {
  title: "Ward Flow",
  description:
    "Flow coordinator view: emergency department pressure, the priority queue, statewide flow and the explainable shortlist for one synthetic movement.",
};

export default function WardManagementPage() {
  return <CoordinatorScreen />;
}
```

- [ ] **Step 6: Declare the surface and regenerate**

Add `src/components/ward-management/coordinator/coordinator-screen.tsx` to the `ward-management` surface `roots`, and `"CoordinatorScreen"` to `sanctionedSpecialPatterns`, in `docs/design-system/adoption-contract.json`.

Run: `npm run design-system:adoption:update && npm run check:design-system-contract`
Expected: passes with no ratchet increase.

- [ ] **Step 7: Run the gates and commit**

```bash
npx tsc --noEmit -p tsconfig.json
npx vitest run tests/route-reachability.test.ts
PLAYWRIGHT_BASE_URL=http://localhost:3718 npx playwright test tests/ui-ward-coordinator.spec.ts --project=chromium
npm run format
git add -A src/app/ward-management src/components/ward-management/coordinator tests playwright.config.ts docs/design-system
git commit -m "feat(ward-flow): add the coordinator screen shell and five regions"
```

- [ ] **Step 8: Screenshot the shell**

Capture `artifacts/ward-management/phase2-shell-1600x1100.png` at 1600×1100 and **look at it**. Phase 1's worst defects were all things that passed tests and were visibly wrong. If the proportions are wrong, fix them now — every later task builds inside this frame.

---

### Task 4: The ED pressure strip

**Files:**

- Create: `src/components/ward-management/coordinator/pressure-strip.tsx`
- Modify: `coordinator-screen.tsx`, `coordinator.module.css`, `tests/ui-ward-coordinator.spec.ts`

**Interfaces:**

- Consumes: `edPressure` (Task 2), `formatElapsed`.
- Produces: `PressureStrip({ now, selectedEdId, onSelectEd })`.

- [ ] **Step 1: Write the failing test**

```ts
// append to tests/ui-ward-coordinator.spec.ts
test("ranks emergency departments worst first and filters the queue when one is chosen", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await gotoCoordinator(page);

  const strip = page.getByRole("region", { name: "Emergency department pressure" });
  const cards = strip.locator('[data-testid^="ward-ed-"]');
  await expect(cards).toHaveCount(8);

  // The worst department leads, and says why it is worst.
  const worst = cards.first();
  await expect(worst).toContainText("waiting");
  await expect(worst).toContainText("longest");

  // Choosing one filters the queue to that department and says so.
  const queue = page.getByRole("region", { name: "Priority queue" });
  const before = await queue.locator('[data-testid^="ward-queue-row-"]').count();
  await worst.click();
  await expect(queue).toContainText("Filtered to");
  const after = await queue.locator('[data-testid^="ward-queue-row-"]').count();
  expect(after).toBeLessThan(before);

  // And clearing restores it.
  await queue.getByRole("button", { name: /Clear filter/ }).click();
  await expect(queue.locator('[data-testid^="ward-queue-row-"]')).toHaveCount(before);
});
```

- [ ] **Step 2: Run to verify it fails**

Expected: FAIL — no `ward-ed-*` cards.

- [ ] **Step 3: Build it**

One card per department, `data-testid={`ward-ed-${row.ed.id}`}`, ordered by `edPressure`. Each shows the department's short name, `waiting`, `formatElapsed(longestWaitMinutes)` labelled "longest", and — **only when non-zero** — a breaching count in the danger tone. A department with no breaches shows no breach element at all rather than a zero.

Cards are `<button>` with `aria-pressed`, min-height `3rem`. Clicking sets `selectedEdId`; clicking the selected one clears it.

- [ ] **Step 4: Run to verify it passes, then screenshot**

Capture `artifacts/ward-management/phase2-pressure-1600x1100.png`. Check the worst department genuinely reads as worst at a glance — that is the strip's only job.

- [ ] **Step 5: Commit**

```bash
npm run format && git add -A src/components/ward-management/coordinator tests
git commit -m "feat(ward-flow): add the emergency department pressure strip"
```

---

### Task 5: The priority queue

**Files:**

- Create: `src/components/ward-management/coordinator/priority-queue.tsx`
- Modify: `coordinator-screen.tsx`, `coordinator.module.css`, `tests/ui-ward-coordinator.spec.ts`

**Interfaces:**

- Consumes: `queueOrder`, `operationalScore` (Task 1), `elapsedLabel`, `clockState`.
- Produces: `PriorityQueue({ movements, selectedId, onSelect, filterEdId, onClearFilter })`.

- [ ] **Step 1: Write the failing test**

```ts
// append to tests/ui-ward-coordinator.spec.ts
test("orders by clinical tier first and labels the score as operational, not clinical", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await gotoCoordinator(page);

  const queue = page.getByRole("region", { name: "Priority queue" });
  const tiers = await queue
    .locator('[data-testid^="ward-queue-row-"] [data-tier]')
    .evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute("data-tier"))));
  expect(tiers).toEqual([...tiers].sort((a, b) => a - b));

  // The score must never read as clinical severity.
  await expect(queue).toContainText("Operational");
  await expect(queue).not.toContainText("Severity");
  await expect(queue).not.toContainText("Acuity");

  // Selecting a movement drives the rest of the screen.
  await queue.locator('[data-testid^="ward-queue-row-"]').first().click();
  const shortlist = page.getByRole("complementary", { name: "Explainable shortlist" });
  const selectedId = await queue.locator('[aria-pressed="true"]').getAttribute("data-testid");
  await expect(shortlist).toContainText(String(selectedId).replace("ward-queue-row-", ""));
});
```

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: Build it**

Rows in `queueOrder`. Each row: `data-testid={`ward-queue-row-${movement.id}`}`, a tier badge carrying `data-tier={movement.urgency}`, the movement id, `elapsedLabel`, cohort and security, origin department, and the operational score with the word **Operational** beside it. Where a legal deadline is breached, show it in the danger tone — this is the row a coordinator must not miss.

Header carries the count and, when `filterEdId` is set, "Filtered to <department>" plus a **Clear filter** button.

Row is a `<button>` with `aria-pressed`, min-height `3rem`.

- [ ] **Step 4: Run to verify it passes, then screenshot** `artifacts/ward-management/phase2-queue-1600x1100.png`.

- [ ] **Step 5: Commit**

```bash
npm run format && git add -A src/components/ward-management/coordinator tests
git commit -m "feat(ward-flow): add the priority queue, tier first and score within tier"
```

---

### Task 6: The flow diagram

The centrepiece, and the reshape the spec asks for: demand enters left from emergency departments, passes through statewide flow, lands right on inpatient units. Today's diagram clusters units by region and never shows where pressure originates.

**Files:**

- Create: `src/components/ward-management/coordinator/flow-diagram.tsx`
- Modify: `coordinator-screen.tsx`, `coordinator.module.css`, `tests/ui-ward-coordinator.spec.ts`

**Interfaces:**

- Consumes: `edPressure`, `allUnits`, `unitCapacity`, `eligibleCandidates`, `destinationUnit`, `siteByCode`.
- Produces: `FlowDiagram({ movement, now, selectedUnitId, onSelectUnit })`.

- [ ] **Step 1: Write the failing test**

```ts
// append to tests/ui-ward-coordinator.spec.ts
test("draws the selected movement's routes from its department to its shortlisted units", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await gotoCoordinator(page);

  const diagram = page.getByRole("region", { name: "Statewide flow" });

  // Connector paths are drawn by a client layout effect — this is the hydration signal.
  await expect(diagram.locator("svg path[marker-end]").first()).toBeAttached({ timeout: 15_000 });

  await page
    .getByRole("region", { name: "Priority queue" })
    .locator('[data-testid^="ward-queue-row-"]')
    .first()
    .click();

  // Exactly the shortlisted units are marked as routed.
  const routed = diagram.locator('[data-routed="true"]');
  await expect(routed).toHaveCount(await routed.count());
  expect(await routed.count()).toBeGreaterThan(0);
  expect(await routed.count()).toBeLessThanOrEqual(3);

  // The origin department is marked, and it is the selected movement's own.
  await expect(diagram.locator('[data-origin="true"]')).toHaveCount(1);
});
```

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: Build it**

Three columns inside a positioned canvas: departments left (ordered by `edPressure`, each showing its waiting count), a statewide-flow hub centre, units right grouped by health service in `wardServiceOrder`.

Connectors are an absolutely positioned `<svg aria-hidden="true">` with `pointer-events: none`, paths computed from real DOM geometry in a `useLayoutEffect` with a `ResizeObserver` — **not** from hard-coded percentages, so the diagram survives resize. Give the node container `pointer-events: none` and the node buttons `pointer-events: auto`; otherwise the overlay swallows clicks, which cost an hour in Phase 1's network diagram.

Grid columns must be pinned explicitly (`grid-column: 1 / 2 / 3`) — auto-placement put the hub in the wrong column previously.

Each unit node shows its name, capability, and the five bed states from `unitCapacity`. Mark the selected movement's shortlisted units `data-routed="true"` and its origin department `data-origin="true"`.

- [ ] **Step 4: Run to verify it passes, then screenshot** `artifacts/ward-management/phase2-diagram-1600x1100.png` **and look hard at it.** Resize to 1280 and screenshot again — connectors recompute or they do not.

- [ ] **Step 5: Commit**

```bash
npm run format && git add -A src/components/ward-management/coordinator tests
git commit -m "feat(ward-flow): add the flow diagram, departments to units"
```

---

### Task 7: The explainable shortlist

Where the placement decision is actually made, and the surface Phase 1's final review found displaying a green tick beside "is not authorised under the Mental Health Act". Build it so that cannot happen.

**Files:**

- Create: `src/components/ward-management/coordinator/shortlist-panel.tsx`
- Modify: `coordinator-screen.tsx`, `coordinator.module.css`, `tests/ui-ward-coordinator.spec.ts`

**Interfaces:**

- Consumes: `eligibleCandidates`, `eligibility`, `candidateReason`, `destinationUnit`, `operationalScore`, `unitCapacity`.
- Produces: `ShortlistPanel({ movement, now, selectedUnitId, onSelectUnit })`.

- [ ] **Step 1: Write the failing test**

```ts
// append to tests/ui-ward-coordinator.spec.ts
test("shows a failing gate as a failure and never auto-allocates", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await gotoCoordinator(page);

  await page
    .getByRole("region", { name: "Priority queue" })
    .locator('[data-testid^="ward-queue-row-"]')
    .first()
    .click();

  const shortlist = page.getByRole("complementary", { name: "Explainable shortlist" });

  // Every gate row states its own verdict in text, not only by icon.
  const gates = shortlist.locator('[data-testid^="ward-gate-"]');
  expect(await gates.count()).toBeGreaterThan(0);
  for (const gate of await gates.all()) {
    const pass = await gate.getAttribute("data-pass");
    await expect(gate).toContainText(pass === "true" ? "Met" : "Not met");
  }

  // A failing gate never renders the success icon.
  const failing = shortlist.locator('[data-testid^="ward-gate-"][data-pass="false"]');
  if (await failing.count()) {
    await expect(failing.first().locator("svg.lucide-circle-check")).toHaveCount(0);
  }

  // Nothing is allocated until a human confirms.
  await expect(shortlist).toContainText("No automatic allocation");
  await expect(shortlist.getByRole("button", { name: /Confirm/ })).toBeVisible();
});
```

Note the selector `svg.lucide-circle-check` — lucide-react emits `lucide-circle-check` for `CheckCircle2`, **not** `lucide-check-circle-2`. Phase 1 shipped a vacuous assertion on the wrong class; do not repeat it.

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: Build it**

Header: movement id, tier badge, cohort, security, origin department, legal status with its form and countdown.

Candidates from `eligibleCandidates(movement, now, 3)`, each a selectable row showing the unit, its capacity, and `candidateReason(verdict)`.

**Gate list for the selected candidate: render all eight, failures first**, each `data-testid={`ward-gate-${gate.gate}`}` and `data-pass={String(gate.pass)}`, with the icon driven by `gate.pass` **and** the words "Met" / "Not met" in the text. Never `.slice()` the list — Phase 1 hid a failing gate behind a four-item slice.

Declines: what has already refused this movement, with the reason and time.

Score: `operationalScore(movement, now).factors` as an expandable list, labelled operational, with the standing note that urgency tier leads and this is not clinical severity.

Confirm/override pair, plus "System suggests, you decide. No automatic allocation."

Where `destinationUnit(movement)` is `undefined` and a candidate is merely suggested, label it **"Suggested destination"** — never let a computed suggestion sit unlabelled in the destination slot.

- [ ] **Step 4: Run to verify it passes, then screenshot** `artifacts/ward-management/phase2-shortlist-1600x1100.png`.

- [ ] **Step 5: Commit**

```bash
npm run format && git add -A src/components/ward-management/coordinator tests
git commit -m "feat(ward-flow): add the explainable shortlist with verdict-stating gates"
```

---

### Task 8: The exceptions drawer and the phone form

Exceptions are the work list, not a report. On a phone the screen collapses to queue, exceptions and one-tap confirm — after-hours coordination happens on a phone.

**Files:**

- Create: `src/components/ward-management/coordinator/exception-drawer.tsx`
- Modify: `coordinator-screen.tsx`, `coordinator.module.css`, `tests/ui-ward-coordinator.spec.ts`

**Interfaces:**

- Consumes: `buildActionInbox`.
- Produces: `ExceptionDrawer({ items, open, onToggle, onSelectMovement })`.

- [ ] **Step 1: Write the failing test**

```ts
// append to tests/ui-ward-coordinator.spec.ts
test("keeps exceptions one tap away and collapses to a queue-first phone form", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await gotoCoordinator(page);

  const toggle = page.getByRole("button", { name: /Exceptions/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  const drawer = page.getByRole("region", { name: "Exceptions" });
  await expect(drawer).toBeVisible();
  await expect(drawer.locator('[data-testid^="ward-exception-"]').first()).toBeVisible();

  // Selecting an exception drives the same selection the queue does.
  await drawer.locator('[data-testid^="ward-exception-"]').first().click();
  await expect(page.getByRole("complementary", { name: "Explainable shortlist" })).toBeVisible();

  // Phone: queue and exceptions survive, the diagram does not, and nothing overflows.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("region", { name: "Priority queue" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Exceptions/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Statewide flow" })).toBeHidden();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
});
```

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: Build it**

Drawer collapsed by default, its toggle showing the count and carrying `aria-expanded`. Items from `buildActionInbox(wardMovements, now)`, each `data-testid={`ward-exception-${item.id}`}`, tone-coded, selecting the underlying movement on click.

Phone (`max-width: 48rem`): hide the diagram and the pressure strip, keep queue and exceptions, keep confirm reachable in one tap. Hiding the diagram is deliberate — a node/edge canvas is unreadable at 390px, and showing an unreadable one is worse than showing none.

- [ ] **Step 4: Run to verify it passes.** Screenshot both `artifacts/ward-management/phase2-exceptions-1600x1100.png` and `artifacts/ward-management/phase2-phone-390x844.png`.

- [ ] **Step 5: Commit**

```bash
npm run format && git add -A src/components/ward-management/coordinator tests
git commit -m "feat(ward-flow): add the exceptions drawer and the phone form"
```

---

### Task 9: Retire Constellation

The spec folds Constellation into the coordinator screen. Retire it properly rather than leaving an orphan — this is the phase's only destructive step.

**Files:**

- Delete: `src/app/ward-management/constellation/page.tsx`
- Modify: `ward-management-navigation.tsx`, `ward-management-modes.tsx`, `tests/ui-ward-management.spec.ts`, `docs/design-system/adoption-contract.json`, `docs/ward-management-mode-map.md`

- [ ] **Step 1: Remove the route and its navigation entry**

Delete the route directory. Remove `"constellation"` from the `WardMode` union, its `<Link>` from `WardModeNavigation`, its `modeCopy` entry, and its `ModeBody` branch. Delete `ConstellationView` and any component now referenced by nothing.

- [ ] **Step 2: Remove it from the contract and regenerate**

Remove the route from `docs/design-system/adoption-contract.json`, then `npm run design-system:adoption:update`.

- [ ] **Step 3: Update the tests that walked it**

`tests/ui-ward-management.spec.ts` navigates to Constellation and confirms a match there. Move that coverage — the confirm journey now lives in `tests/ui-ward-coordinator.spec.ts` (Task 7). Remove the Constellation steps rather than pointing them elsewhere; do not leave an assertion that no longer proves anything.

- [ ] **Step 4: Prove no orphan and no dangling link**

```bash
grep -rn "constellation" src tests docs/site-map.md
npx vitest run tests/route-reachability.test.ts
npm run docs:update
```

Expected: no source or test references remain; route-reachability passes; the site map loses the route.

- [ ] **Step 5: Update the mode map**

`docs/ward-management-mode-map.md` carries a superseded banner from Phase 1. Remove the Constellation row from its route table and note in the banner that Phase 2 has retired it and rebuilt Command as the coordinator screen.

- [ ] **Step 6: Commit**

```bash
npm run format
git add -A
git commit -m "refactor(ward-flow): retire constellation into the coordinator screen"
```

---

### Task 10: Prove the phase

- [ ] **Step 1: Static and unit**

```bash
npx tsc --noEmit -p tsconfig.json
npx vitest run tests/ward-clock.test.ts tests/ward-model.test.ts tests/ward-eligibility.test.ts tests/ward-priority.test.ts tests/ward-pressure.test.ts tests/ward-management.test.ts tests/route-reachability.test.ts tests/tools-catalog.test.ts
```

- [ ] **Step 2: Lint — read the output, not the exit code**

```bash
npm run lint
```

Expected: `0 problems`. `DATABASE_HEAVY_RUN_ADMISSION_BUSY` means it did not run — wait and repeat.

- [ ] **Step 3: Design-system contract**

```bash
npm run check:design-system-contract
```

Expected: no ratchet increase. An increase means a raw literal entered the new CSS module.

- [ ] **Step 4: Browser**

```bash
npm run ensure
PLAYWRIGHT_BASE_URL=http://localhost:3718 npx playwright test tests/ui-ward-coordinator.spec.ts tests/ui-ward-management.spec.ts --project=chromium --reporter=line
```

- [ ] **Step 5: The screenshot pass — the one that matters**

Collect every capture from Tasks 3–8 and review them as a set at full size. Phase 1 shipped `1h 35m overdue` on every queue row, a green tick beside an unmet Mental Health Act gate, and a bed grid that did not add up — through 43 passing tests and eight clean reviews. Ask of each screen: **is every number on it derived from the data, and does every label say what the number actually means?**

Send the set to the owner. Their eyes are the gate this phase cannot pass without.

- [ ] **Step 6: Commit**

```bash
npm run format
git add -A
git commit -m "chore(ward-flow): phase 2 verification pass"
```

---

## Self-Review

**Spec coverage.** §6 coordinator screen → Tasks 3–8 (pressure strip, queue, diagram, shortlist, exceptions, phone form). §8 queue ordering → Task 1. §7 shortlist gates, declines, suggested-destination labelling → Task 7. §10 conservative failure → the empty-state requirements in Tasks 3, 6 and 7. §11 success criteria → Task 2's pressure figures and Task 1's factors are what make time-to-accept and deadlines-passed visible. §15 migration → Task 9.

**Deliberately not in Phase 2.** The ED, ward and transport officer screens (Phase 3). The statutory clock, escalation, shift handover, patient search and governance extensions (Phase 4). Role switching is not rebuilt here — the coordinator screen is one role's screen, and the other three arrive in Phase 3.

**Type consistency.** `operationalScore` and `queueOrder` (Task 1) are consumed under those names in Tasks 5 and 7. `edPressure`/`EdPressure` (Task 2) in Tasks 3, 4 and 6. `CoordinatorScreen` (Task 3) is the only export the route imports. Every component takes `now: Instant` rather than reading a clock.

**Two things a reviewer should watch for.** First, that the operational score has not quietly reacquired an urgency term — the test asserting two tiers score identically is the guard, and it must not be weakened. Second, that the flow diagram's connectors are computed from measured geometry rather than hard-coded percentages; the percentage version looks correct at exactly one viewport width and is wrong everywhere else.
