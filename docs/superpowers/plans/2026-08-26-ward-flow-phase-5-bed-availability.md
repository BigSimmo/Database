# Ward Flow Phase 5 — Bed availability becomes real

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** wards record when their beds are actually coming free, and the coordinator's capacity
figure becomes a number that can be planned against for the rest of today.

**Architecture:** extend the `BedRelease` concept Phase 4 already built — it has a unit, an expected
time, a confidence, a blocker chosen from a fixed list, and a ward-only flag event — with a state
machine, a sibling `LeaveBed` type, band derivations over today, and a discharge board that renders
them. Every number stays a pure derivation from `WardFlowState`; no screen computes its own version.

**Tech Stack:** TypeScript 6 strict, React 19, Next.js 16 App Router, CSS modules with `@theme`
tokens, Vitest (`tests/**/*.test.ts`, `tests/**/*.dom.test.tsx`), Playwright (`tests/ui-ward-*.spec.ts`,
project `chromium-mockups`).

**Spec:** `docs/superpowers/specs/2026-08-26-ward-flow-phase-5-bed-availability-design.md`
**Direction and settled decisions:** `docs/ward-flow-roadmap.md`

## Global Constraints

Every task's requirements implicitly include all of these.

- **Never invent a legal figure.** No figure or requirement from the Mental Health Act may be cited,
  paraphrased or inferred anywhere in code, copy, comment, test or fixture.
- **Synthetic data only.** No name, date of birth, medical record number, address, diagnosis,
  narrative history or treatment. **Sex is the only permitted patient attribute**, and per spec D11
  neither `BedRelease` nor `LeaveBed` may carry even that. Free text counts as data.
- **Neither `BedRelease` nor `LeaveBed` may gain a field describing the departing or absent patient.**
  `tests/ward-flow-reducer.test.ts`'s bed-release privacy suite asserts this against the type's own
  field set. Do not weaken it; extend it.
- **`confirmedBy` is a role, never a person** — a unit or service label such as
  `"NUM RPH Adult Secure"`. Never a personal name.
- **Blockers are chosen, never typed.** Every blocker value comes from `BED_RELEASE_BLOCKERS`.
- **Local and offline checks only.** Never run `verify:release`, `eval:*`, `check:supabase-project`,
  `test:live`, or anything touching OpenAI, Supabase, hosted CI or a live database.
- **Read counts, never exit codes.** `node scripts/run-playwright.mjs` exits `0` on test failure and
  on lock refusal alike. Quote the `N passed` line. On `DATABASE_HEAVY_RUN_ADMISSION_BUSY` or an
  `EPERM … owner.json` stack trace the command did not run — retry, do not treat as a pass.
- **Every `<button>` must do something** — a handler, a submit inside a form, or navigation.
  `eslint-rules/require-button-wiring.mjs` fails the build otherwise. Never blanket-disable it.
- **Design tokens, not hex.** Production tap targets are `min-h-12` / `3rem`; never "fix" them down.
- **Ward Flow is a sandbox.** No new link may point anywhere in the clinical application. The
  developer hub (`/mockups/development`) is the only way out.
- **"Tonight" ends at 22:00**, expressed once as a named constant, never as a repeated literal.

## File structure

| File                                                              | Responsibility                                                                                                                                |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/ward-management/ward-model.ts`                    | `BedRelease` gains `state`; `confidence` narrows; `blocker` becomes state-dependent. New `LeaveBed`. New `BedReleaseState`, `LeaveBed` types. |
| `src/components/ward-management/ward-change-reasons.ts`           | `BED_RELEASE_BLOCKERS` gains three operational entries.                                                                                       |
| `src/components/ward-management/ward-movements.ts`                | `bedReleases` fixture migrated to states and seeded across every state (D13); new `leaveBeds` fixture.                                        |
| `src/components/ward-management/ward-bed-availability.ts`         | **New.** Pure derivations: band bucketing, the five-figure breakdown, the excluded count. One responsibility, no React.                       |
| `src/components/ward-management/ward-flow-events.ts`              | Four new events plus their `EVENT_ROLE` entries.                                                                                              |
| `src/components/ward-management/ward-flow-reducer.ts`             | The transitions, their role and state guards, and their `Rejection`s. `WardFlowState` gains `leaveBeds` and `refreshRequests`.                |
| `src/components/ward-management/ward-freshness.tsx`               | **New.** One shared freshness stamp used by every board.                                                                                      |
| `src/components/ward-management/ward-freshness.module.css`        | **New.** Its styles.                                                                                                                          |
| `src/components/ward-management/discharges/discharge-board.tsx`   | **New.** The discharge and egress board.                                                                                                      |
| `src/components/ward-management/discharges/discharges.module.css` | **New.** Its styles, including the phone card layout.                                                                                         |
| `src/app/mockups/ward-flow/discharges/page.tsx`                   | **New.** Its route.                                                                                                                           |
| `src/components/ward-management/ward-nav.ts`                      | The board's nav entry.                                                                                                                        |
| `src/components/ward-management/ward/ward-screen.tsx`             | The lifecycle controls, leave beds, and the refresh-requested mark.                                                                           |
| `src/components/ward-management/ward-management-modes.tsx`        | The capacity board's five figures and the coordinator's refresh-request control.                                                              |

---

## Task 1: The model, the blockers, and the fixtures

**Files:**

- Modify: `src/components/ward-management/ward-model.ts`
- Modify: `src/components/ward-management/ward-change-reasons.ts`
- Modify: `src/components/ward-management/ward-movements.ts`
- Test: `tests/ward-bed-availability-model.test.ts` (create)

**Interfaces:**

- Consumes: nothing — this is the first task.
- Produces: `BedReleaseState`, the narrowed `BedReleaseConfidence`, the widened
  `BED_RELEASE_BLOCKERS`, `LeaveBed`, and the `bedReleases` / `leaveBeds` fixtures. Every later task
  depends on these exact names.

**Why this is serial and first.** Every other task reads these types. Running it alongside anything
else produces conflicts in the same three files for no gain.

- [ ] **Step 1: Write the failing test**

Create `tests/ward-bed-availability-model.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { BED_RELEASE_BLOCKERS } from "@/components/ward-management/ward-change-reasons";
import {
  BED_RELEASE_CONFIDENCE_LEVELS,
  BED_RELEASE_STATES,
  type BedRelease,
  type LeaveBed,
} from "@/components/ward-management/ward-model";
import { bedReleases, leaveBeds } from "@/components/ward-management/ward-movements";

describe("bed release model", () => {
  it("has four lifecycle states in the order a bed moves through them", () => {
    expect(BED_RELEASE_STATES).toEqual(["predicted", "confirmed", "blocked", "released"]);
  });

  it("no longer treats 'confirmed' as a confidence, because it is a state", () => {
    expect(BED_RELEASE_CONFIDENCE_LEVELS).toEqual(["likely", "possible"]);
  });

  it("offers seven blockers, all of them about the bed and none about a person", () => {
    expect(BED_RELEASE_BLOCKERS).toEqual([
      "Awaiting clean",
      "Awaiting pharmacy",
      "Awaiting placement confirmation",
      "Awaiting service coordination",
      "Awaiting accommodation",
      "Awaiting transport",
      "Awaiting receiving-service acceptance",
    ]);
  });

  /**
   * The privacy rule is structural, not a matter of fixture hygiene: a future field named
   * `patientId` would pass a content check and fail this one.
   */
  it("gives neither a bed release nor a leave bed any field describing a person", () => {
    const releaseFields = Object.keys(bedReleases[0]).sort();
    expect(releaseFields).toEqual(
      ["blocker", "confidence", "confirmedAt", "confirmedBy", "expectedAt", "id", "state", "unitId"].sort(),
    );
    const leaveFields = Object.keys(leaveBeds[0]).sort();
    expect(leaveFields).toEqual(["confirmedAt", "confirmedBy", "expectedReturn", "id", "unitId", "usable"].sort());
  });

  /** D13: the board must open on its worst case, not its best. */
  it("seeds releases in every state, at least two of them blocked", () => {
    const byState = (state: BedRelease["state"]) => bedReleases.filter((r) => r.state === state);
    expect(byState("predicted").length).toBeGreaterThanOrEqual(1);
    expect(byState("confirmed").length).toBeGreaterThanOrEqual(1);
    expect(byState("blocked").length).toBeGreaterThanOrEqual(2);
    expect(byState("released").length).toBeGreaterThanOrEqual(1);
  });

  it("seeds at least one leave bed the ward says cannot be filled", () => {
    expect(leaveBeds.some((bed: LeaveBed) => bed.usable === false)).toBe(true);
  });

  /** D3: a blocker belongs to the blocked state and to no other. */
  it("carries a blocker exactly when blocked, and a confidence exactly when predicted", () => {
    for (const release of bedReleases) {
      expect(release.blocker === null).toBe(release.state !== "blocked");
      expect(release.confidence === null).toBe(release.state !== "predicted");
      if (release.blocker !== null) {
        expect(BED_RELEASE_BLOCKERS).toContain(release.blocker);
      }
    }
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

```bash
npx vitest run tests/ward-bed-availability-model.test.ts --project node --reporter dot
```

Expected: fails at import — `BED_RELEASE_STATES` and `leaveBeds` do not exist.

- [ ] **Step 3: Add the states and the leave bed to `ward-model.ts`**

Replace the `BED_RELEASE_CONFIDENCE_LEVELS` block and the `BedRelease` type with:

```ts
/**
 * A bed release's lifecycle, in the order a bed moves through it. Hand-listed (never derived) for
 * the same reason `DECLINE_REASONS` is: a UI picker needs a runtime list, not just a type.
 */
export const BED_RELEASE_STATES = ["predicted", "confirmed", "blocked", "released"] as const;
export type BedReleaseState = (typeof BED_RELEASE_STATES)[number];

/**
 * Narrowed from `confirmed | likely | possible` (Phase 5, spec D1). "Confirmed" was doing two jobs
 * at once — a position in the lifecycle and a degree of belief — and the lifecycle now owns it.
 * A confirmed release has no confidence, because it is not a belief any more.
 */
export const BED_RELEASE_CONFIDENCE_LEVELS = ["likely", "possible"] as const;
export type BedReleaseConfidence = (typeof BED_RELEASE_CONFIDENCE_LEVELS)[number];

/**
 * A bed release carries **nothing whatsoever about the departing patient** — no identifier, no
 * timing that could identify them, no reason relating to them, and (spec D11) not even sex, the
 * one otherwise-permitted patient attribute. Every field below is about the BED or the confirming
 * WARD. `tests/ward-flow-reducer.test.ts` and `tests/ward-bed-availability-model.test.ts` both
 * assert this structurally against the type's own field set, not against fixture content.
 */
export type BedRelease = {
  id: string;
  unitId: string;
  state: BedReleaseState;
  expectedAt: Instant;
  /** Non-null only while `state` is `"predicted"`. */
  confidence: BedReleaseConfidence | null;
  /** Non-null only while `state` is `"blocked"`. Always a `BedReleaseBlocker`. */
  blocker: string | null;
  confirmedAt: Instant;
  /** A role — a unit or service label. Never a personal name. */
  confirmedBy: string;
};

/**
 * A bed occupied by someone on approved leave. It may or may not be fillable while they are away,
 * and a coordinator needs to see which — so it is its own count and is **never** merged into
 * `available` (spec D4). Carries nothing about the person on leave: no identifier, no reason, no
 * destination.
 */
export type LeaveBed = {
  id: string;
  unitId: string;
  /** The ward's statement that this bed can be filled while its occupant is away. */
  usable: boolean;
  expectedReturn: Instant;
  confirmedAt: Instant;
  /** A role. Never a personal name. */
  confirmedBy: string;
};
```

- [ ] **Step 4: Widen the blocker list**

In `ward-change-reasons.ts`, extend `BED_RELEASE_BLOCKERS` to exactly:

```ts
export const BED_RELEASE_BLOCKERS = [
  "Awaiting clean",
  "Awaiting pharmacy",
  "Awaiting placement confirmation",
  "Awaiting service coordination",
  // Phase 5 (spec D3). Operational facts about the bed, chosen for the "ready but cannot leave"
  // case. Deliberately NOT added: guardianship, financial arrangements, family availability — each
  // describes the person rather than the bed, and so follows "Pending case review outcome" out of
  // this list. Adding one is a recorded product decision, never an implementer's convenience.
  "Awaiting accommodation",
  "Awaiting transport",
  "Awaiting receiving-service acceptance",
] as const;
```

- [ ] **Step 5: Migrate and extend the fixtures**

In `ward-movements.ts`, rewrite every entry of `bedReleases` to the new shape, and add `leaveBeds`
below it. Migration rule: an entry whose old `confidence` was `"confirmed"` becomes
`state: "confirmed", confidence: null`; any other becomes `state: "predicted"` keeping its
confidence. Every old free-text `blocker` maps to the nearest `BED_RELEASE_BLOCKERS` value
(`"Bed clean pending"` → `"Awaiting clean"`), and becomes `null` unless the entry is `blocked`.

Then add entries so the seeded set satisfies D13 — at least one `predicted`, one `confirmed`, **two
`blocked`**, one `released`. Use `WR-0NN` ids continuing the existing sequence, real unit ids from
`ward-sites.ts`, `NOW_ANCHOR`-relative times, and `confirmedBy` role labels in the existing
`"NUM <Unit Name>"` form. Two examples to follow exactly:

```ts
  {
    id: "WR-007",
    unitId: "fsh-adult-secure",
    state: "blocked",
    expectedAt: NOW_ANCHOR + 120,
    confidence: null,
    blocker: "Awaiting accommodation",
    confirmedAt: NOW_ANCHOR - 35,
    confirmedBy: "NUM FSH Adult Secure",
  },
  {
    id: "WR-008",
    unitId: "arm-adult-open",
    state: "released",
    expectedAt: NOW_ANCHOR - 15,
    confidence: null,
    blocker: null,
    confirmedAt: NOW_ANCHOR - 15,
    confirmedBy: "NUM ARM Adult Open",
  },
```

And the new fixture:

```ts
/**
 * Beds held by someone on approved leave. Never merged into availability (spec D4) — a usable
 * leave bed is its own figure. Carries nothing about the person on leave.
 */
export const leaveBeds: LeaveBed[] = [
  {
    id: "WL-001",
    unitId: "rph-adult-secure",
    usable: true,
    expectedReturn: NOW_ANCHOR + 300,
    confirmedAt: NOW_ANCHOR - 60,
    confirmedBy: "NUM RPH Adult Secure",
  },
  {
    id: "WL-002",
    unitId: "scgh-older-adult",
    usable: false,
    expectedReturn: NOW_ANCHOR + 180,
    confirmedAt: NOW_ANCHOR - 25,
    confirmedBy: "NUM SCGH Older Adult",
  },
];
```

- [ ] **Step 6: Run the test and watch it pass**

```bash
npx vitest run tests/ward-bed-availability-model.test.ts --project node --reporter dot
```

Expected: `Tests  6 passed (6)`. Read the count, not the exit code.

- [ ] **Step 7: Mutation-test the privacy assertion**

Temporarily add `sex: "Female",` to the first `bedReleases` entry and to the `BedRelease` type, and
re-run. The structural field-set test **must** fail. If it passes, the test is checking nothing and
must be fixed before proceeding. Revert the mutation afterwards and re-run to confirm green.

- [ ] **Step 8: Run the whole ward suite, because this changed shared types**

```bash
npx vitest run tests/ward-*.test.ts tests/ward-*.dom.test.tsx --reporter dot
```

Expect failures in files that read `confidence: "confirmed"` or an untyped `blocker` — fix each by
migrating it to the new shape, never by loosening a type. Quote the final `Test Files` and `Tests`
lines.

- [ ] **Step 9: Commit**

```bash
git add src/components/ward-management/ward-model.ts src/components/ward-management/ward-change-reasons.ts src/components/ward-management/ward-movements.ts tests/
git commit -m "Give a bed release a lifecycle, and a leave bed its own type"
```

---

## Task 2: The derivations

**Files:**

- Create: `src/components/ward-management/ward-bed-availability.ts`
- Test: `tests/ward-bed-availability.test.ts` (create)

**Interfaces:**

- Consumes: `BedRelease`, `BedReleaseState`, `LeaveBed`, `Instant` from Task 1.
- Produces:
  - `export const EVENING_SHIFT_END_MINUTES = 22 * 60;`
  - `export const RELEASE_BANDS = ["now", "by-midday", "by-1600", "tonight"] as const;`
  - `export type ReleaseBand = (typeof RELEASE_BANDS)[number];`
  - `export function releaseBand(release: BedRelease, now: Instant): ReleaseBand | "beyond-today"`
  - `export type CapacityBreakdown = { availableNow: number; confirmedToday: number; predictedToday: number; held: number; leaveUsable: number; excludedBeyondToday: number }`
  - `export function capacityBreakdown(unit: Unit, releases: BedRelease[], leave: LeaveBed[], now: Instant): CapacityBreakdown`

**Interpretation of `Instant`.** `Instant` is `number` (`ward-clock.ts`), minutes from the scenario
anchor. Bands are computed from the **time of day** the instant falls on, not from an offset — read
`formatInstant` in `ward-clock.ts` and reuse whatever it uses to get hours and minutes. Do not
reimplement clock arithmetic in this file.

- [ ] **Step 1: Write the failing test**

Create `tests/ward-bed-availability.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  capacityBreakdown,
  EVENING_SHIFT_END_MINUTES,
  releaseBand,
} from "@/components/ward-management/ward-bed-availability";
import type { BedRelease, LeaveBed } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

const unit = allUnits[0];

function release(overrides: Partial<BedRelease>): BedRelease {
  return {
    id: "WR-T01",
    unitId: unit.id,
    state: "predicted",
    expectedAt: NOW_ANCHOR + 60,
    confidence: "likely",
    blocker: null,
    confirmedAt: NOW_ANCHOR,
    confirmedBy: "NUM Test Unit",
    ...overrides,
  };
}

function leave(overrides: Partial<LeaveBed>): LeaveBed {
  return {
    id: "WL-T01",
    unitId: unit.id,
    usable: true,
    expectedReturn: NOW_ANCHOR + 300,
    confirmedAt: NOW_ANCHOR,
    confirmedBy: "NUM Test Unit",
    ...overrides,
  };
}

describe("release bands", () => {
  it("ends the evening shift at 22:00, expressed once", () => {
    expect(EVENING_SHIFT_END_MINUTES).toBe(1320);
  });

  it("puts an already-released bed in 'now' whatever its expected time said", () => {
    expect(releaseBand(release({ state: "released", expectedAt: NOW_ANCHOR + 600 }), NOW_ANCHOR)).toBe("now");
  });

  it("excludes anything expected after the evening shift ends", () => {
    // 1440 minutes is a full day past the anchor, so it lands beyond tonight whatever hour the
    // anchor sits at.
    expect(releaseBand(release({ expectedAt: NOW_ANCHOR + 1440 }), NOW_ANCHOR)).toBe("beyond-today");
  });
});

describe("capacity breakdown", () => {
  it("never adds a predicted or confirmed bed into availableNow", () => {
    const bare = capacityBreakdown(unit, [], [], NOW_ANCHOR);
    const loaded = capacityBreakdown(
      unit,
      [release({ state: "predicted" }), release({ id: "WR-T02", state: "confirmed", confidence: null })],
      [],
      NOW_ANCHOR,
    );
    expect(loaded.availableNow).toBe(bare.availableNow);
    expect(loaded.predictedToday).toBe(1);
    expect(loaded.confirmedToday).toBe(1);
  });

  it("never merges a usable leave bed into availableNow either", () => {
    const bare = capacityBreakdown(unit, [], [], NOW_ANCHOR);
    const withLeave = capacityBreakdown(unit, [], [leave({ usable: true })], NOW_ANCHOR);
    expect(withLeave.availableNow).toBe(bare.availableNow);
    expect(withLeave.leaveUsable).toBe(1);
  });

  it("counts an unusable leave bed in neither figure", () => {
    const result = capacityBreakdown(unit, [], [leave({ usable: false })], NOW_ANCHOR);
    expect(result.leaveUsable).toBe(0);
  });

  it("reports what it excluded rather than dropping it silently", () => {
    const result = capacityBreakdown(unit, [release({ expectedAt: NOW_ANCHOR + 1440 })], [], NOW_ANCHOR);
    expect(result.predictedToday).toBe(0);
    expect(result.excludedBeyondToday).toBe(1);
  });

  it("ignores releases and leave beds belonging to another unit", () => {
    const result = capacityBreakdown(
      unit,
      [release({ unitId: "not-this-unit" })],
      [leave({ unitId: "not-this-unit" })],
      NOW_ANCHOR,
    );
    expect(result.predictedToday).toBe(0);
    expect(result.leaveUsable).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

```bash
npx vitest run tests/ward-bed-availability.test.ts --project node --reporter dot
```

Expected: fails at import — the module does not exist.

- [ ] **Step 3: Write the module**

Create `src/components/ward-management/ward-bed-availability.ts`. `availableNow` and `held` keep
**exactly** the meanings `unitCapacity` gives them today — copy those two lines from
`unitCapacity` in `ward-derivations.ts` rather than inventing new arithmetic, so the one number a
coordinator acts on cannot drift.

```ts
/**
 * Every figure the capacity board shows, derived in one place so no screen computes its own
 * version. Phase 5, spec D5 and D6.
 *
 * The rule this file exists to enforce: **nothing predicted, confirmed-but-unreleased, or on leave
 * is ever added into `availableNow`.** A coordinator must be able to point at that number and say
 * "that is a bed I can fill this minute", and it must never have been softened by an expectation.
 */
```

Implement the six figures per the test. `excludedBeyondToday` counts this unit's non-`released`
releases whose band is `"beyond-today"`.

- [ ] **Step 4: Run the test and watch it pass**

```bash
npx vitest run tests/ward-bed-availability.test.ts --project node --reporter dot
```

Expected: `Tests  8 passed (8)`.

- [ ] **Step 5: Mutation-test the two load-bearing assertions**

Mutate `availableNow` to add `predictedToday`. The "never adds a predicted or confirmed bed" test
must fail. Then mutate `excludedBeyondToday` to return `0` always; the exclusion test must fail.
Revert both, re-run, confirm green. Report any mutation that survived rather than reshaping the test.

- [ ] **Step 6: Commit**

```bash
git add src/components/ward-management/ward-bed-availability.ts tests/ward-bed-availability.test.ts
git commit -m "Derive the five capacity figures in one place, and count what they exclude"
```

---

## Task 3: The transitions

**Files:**

- Modify: `src/components/ward-management/ward-flow-events.ts`
- Modify: `src/components/ward-management/ward-flow-reducer.ts`
- Test: `tests/ward-bed-release-lifecycle.test.ts` (create)

**Interfaces:**

- Consumes: `BedRelease`, `BedReleaseState`, `LeaveBed`, `BedReleaseBlocker` from Task 1.
- Produces: events `CONFIRM_BED_RELEASE`, `BLOCK_BED_RELEASE`, `RELEASE_BED`,
  `RECORD_LEAVE_BED`, `END_LEAVE_BED`, `REQUEST_CAPACITY_REFRESH`; `WardFlowState` gains
  `leaveBeds: LeaveBed[]` and `refreshRequests: { unitId: string; at: Instant; byRole: string }[]`.

**Read first:** the existing `FLAG_BED_RELEASE` case in `ward-flow-reducer.ts`, the `reject(state,
event, reason)` helper at line ~96, and the `EVENT_ROLE` table in `ward-flow-events.ts`. Follow all
three exactly; a new transition that refuses differently from every existing one is a defect even if
it works.

- [ ] **Step 1: Write the failing test**

Create `tests/ward-bed-release-lifecycle.test.ts`. Cover, one `it` each:

1. A ward confirms a `predicted` release → its state is `confirmed` and its `confidence` is `null`.
2. A ward blocks a release with a blocker from the list → state `blocked`, blocker recorded.
3. A ward blocks with no blocker → **rejected**, `state.rejections` grows by one, the release is
   unchanged.
4. A ward releases a `confirmed` release → state `released`, and that unit's `availableNow` (via
   `capacityBreakdown`) is one higher than before.
5. A **coordinator** attempting each of `CONFIRM_BED_RELEASE`, `BLOCK_BED_RELEASE`, `RELEASE_BED`
   → rejected, three rejections, no state change. (Spec D2.)
6. A ward whose `actingUnitId` does not match the release's `unitId` → rejected. (Same claim-not-proof
   discipline as `FLAG_BED_RELEASE`.)
7. `RECORD_LEAVE_BED` adds a leave bed; `END_LEAVE_BED` removes it.
8. A coordinator's `REQUEST_CAPACITY_REFRESH` is **accepted** — it is the one thing a coordinator may
   do — and changes no bed figure at all: `capacityBreakdown` before and after are deeply equal.

Build state with `seedWardFlowState()` from `ward-flow-reducer.ts` and drive it through
`wardFlowReducer`, the way `tests/ward-flow-reducer.test.ts` already does. Copy that file's setup
rather than inventing another.

- [ ] **Step 2: Run the test and watch it fail**

```bash
npx vitest run tests/ward-bed-release-lifecycle.test.ts --project node --reporter dot
```

Expected: fails — the event types do not exist.

- [ ] **Step 3: Add the events and their role entries**

In `ward-flow-events.ts`, add six variants to `WardFlowEvent`. Each of the five ward events carries
`role`, `now`, `releaseId` (or `leaveBedId` / `unitId`), and `actingUnitId`. `BLOCK_BED_RELEASE`
additionally carries `blocker: BedReleaseBlocker`. Then extend `EVENT_ROLE`:

```ts
  CONFIRM_BED_RELEASE: ["ward"],
  BLOCK_BED_RELEASE: ["ward"],
  RELEASE_BED: ["ward"],
  RECORD_LEAVE_BED: ["ward"],
  END_LEAVE_BED: ["ward"],
  // The one thing a coordinator may do to a ward's bed data. It changes no number: it marks that
  // somebody asked. Spec D12.
  REQUEST_CAPACITY_REFRESH: ["coordinator"],
```

Adding an event without an `EVENT_ROLE` entry is a compile error, which is the point.

- [ ] **Step 4: Add `leaveBeds` and `refreshRequests` to the state and seed them**

In `ward-flow-reducer.ts`, extend `WardFlowState` and `seedWardFlowState()`:
`leaveBeds: structuredClone(leaveBeds)` and `refreshRequests: []`.

- [ ] **Step 5: Implement the six cases**

Each ward case: find the release, refuse via `reject(...)` with a specific reason when it is missing,
when `actingUnitId !== release.unitId`, or when the transition is invalid from the current state.
Legal transitions and nothing else:

- `predicted → confirmed | blocked`
- `confirmed → released | blocked`
- `blocked → confirmed | released`
- `released →` nothing. It is terminal.

`BLOCK_BED_RELEASE` sets `confidence: null` and the given blocker. `CONFIRM_BED_RELEASE` and
`RELEASE_BED` set `blocker: null` and `confidence: null`.

- [ ] **Step 6: Run the test and watch it pass**

```bash
npx vitest run tests/ward-bed-release-lifecycle.test.ts --project node --reporter dot
```

Expected: `Tests  8 passed (8)`.

- [ ] **Step 7: Mutation-test the role gate**

Change `CONFIRM_BED_RELEASE` in `EVENT_ROLE` to `["ward", "coordinator"]`. Test 5 must fail. Revert,
re-run green. A role gate that cannot fail is the most expensive kind of passing test here.

- [ ] **Step 8: Commit**

```bash
git add src/components/ward-management/ward-flow-events.ts src/components/ward-management/ward-flow-reducer.ts tests/ward-bed-release-lifecycle.test.ts
git commit -m "A ward moves its own beds through the lifecycle; a coordinator may only ask"
```

---

## Task 4: The freshness stamp

**Files:**

- Create: `src/components/ward-management/ward-freshness.tsx`
- Create: `src/components/ward-management/ward-freshness.module.css`
- Test: `tests/ward-freshness.dom.test.tsx` (create)

**Interfaces:**

- Consumes: `Instant`, and `formatInstant` from `ward-clock.ts`.
- Produces: `export function WardFreshness({ confirmedAt, confirmedByRole, now }: { confirmedAt?: Instant | null; confirmedByRole?: string | null; now: Instant })`

Three renderings, and no fourth:

| Input                                    | Renders                              |
| ---------------------------------------- | ------------------------------------ |
| both `confirmedAt` and `confirmedByRole` | `Confirmed 10:22 · RPH Adult Secure` |
| neither                                  | `Never confirmed`                    |
| `confirmedAt` absent, `now` given        | `As at 10:42`                        |

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardFreshness } from "@/components/ward-management/ward-freshness";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("freshness stamp", () => {
  it("names the time and the confirming role", () => {
    render(<WardFreshness confirmedAt={NOW_ANCHOR - 20} confirmedByRole="RPH Adult Secure" now={NOW_ANCHOR} />);
    expect(screen.getByText(/Confirmed/)).toHaveTextContent("RPH Adult Secure");
  });

  it("says 'Never confirmed' rather than showing a blank or a dash", () => {
    render(<WardFreshness now={NOW_ANCHOR} />);
    expect(screen.getByText("Never confirmed")).toBeTruthy();
    expect(screen.queryByText("—")).toBeNull();
  });

  it("falls back to the time it was computed when there is nothing to confirm", () => {
    render(<WardFreshness confirmedByRole={null} confirmedAt={null} now={NOW_ANCHOR} />);
    expect(screen.getByText(/^(Never confirmed|As at )/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run tests/ward-freshness.dom.test.tsx --reporter dot
```

- [ ] **Step 3: Write the component and its styles**

Muted small text, tokens only, no hex. Follow `ward-role-switcher.module.css`'s self-contained-token
convention: declare every `--ward-*` this file uses on its own root class.

- [ ] **Step 4: Run it and watch it pass, then commit**

```bash
npx vitest run tests/ward-freshness.dom.test.tsx --reporter dot
git add src/components/ward-management/ward-freshness.tsx src/components/ward-management/ward-freshness.module.css tests/ward-freshness.dom.test.tsx
git commit -m "One freshness stamp, so every board can say how old it is"
```

---

## Task 5: The ward's controls

**Files:**

- Modify: `src/components/ward-management/ward/ward-screen.tsx`
- Modify: `src/components/ward-management/ward/ward.module.css`
- Test: `tests/ward-screen.dom.test.tsx` (extend)

**Interfaces:** consumes Task 1's types, Task 3's events, Task 4's `WardFreshness`.

The existing flagging panel already collects confidence and blocker and dispatches
`FLAG_BED_RELEASE`. Extend the same panel; do not add a second one.

- [ ] **Step 1: Write the failing tests** — extend `tests/ward-screen.dom.test.tsx` with four cases:
      confirming a predicted release updates the row; blocking asks for a reason and refuses without
      one; releasing removes it from the pending list; and a refresh request raised by a coordinator
      appears on this ward's screen as a visible mark naming the time and the requesting role.
- [ ] **Step 2: Run and watch them fail.**
      `npx vitest run tests/ward-screen.dom.test.tsx --reporter dot`
- [ ] **Step 3: Add the controls.** Each release row gets Confirm / Blocked / Released, each a real
      `<button>` with a real handler. Blocking opens the existing blocker `<select>`. Add a small
      leave-bed form: unit implied, `usable` a checkbox, expected return a time. Render
      `<WardFreshness>` beside the unit's capacity.
- [ ] **Step 4: Run and watch them pass.**
- [ ] **Step 5: Commit.** `git commit -m "The ward moves its own beds, and sees when it was asked to refresh"`

---

## Task 6: The discharge and egress board

**Files:**

- Create: `src/components/ward-management/discharges/discharge-board.tsx`
- Create: `src/components/ward-management/discharges/discharges.module.css`
- Create: `src/app/mockups/ward-flow/discharges/page.tsx`
- Modify: `src/components/ward-management/ward-nav.ts`
- Test: `tests/ward-discharge-board.dom.test.tsx` (create)

**Interfaces:** consumes Task 1's types, Task 2's `capacityBreakdown` / `releaseBand`, Task 4's
`WardFreshness`.

Group order is **Blocked, Confirmed, Predicted, Released today** — blocked first because those are
the rows somebody must act on. Within a group, order by band. The excluded-beyond-today count sits
at the foot of the board and is **stated even when it is zero**.

Copy the route and screen shape from `src/components/ward-management/handover/handover-page.tsx` and
its route file — same shell, same `<ClinicalRail />`, same `<main id="main-content">`, same
governance banner.

- [ ] **Step 1: Write the failing test** — assert the four group headings in that order; that a
      blocked row names its blocker; that the excluded count renders with the text `0` when nothing
      is excluded; and that every row carries a freshness stamp.
- [ ] **Step 2: Run and watch it fail.**
- [ ] **Step 3: Build the board, the styles and the route.** Add
      `{ id: "discharges", href: "/mockups/ward-flow/discharges", label: "Discharges", group: "board" }`
      to `WARD_NAV`, and an icon to `WARD_NAV_ICONS` in `ward-nav-icons.ts` (use `LogOut`).
- [ ] **Step 4: Run the nav contract test**, which enumerates routes from the filesystem both ways:
      `npx vitest run tests/ward-nav.test.ts --project node --reporter dot`
- [ ] **Step 5: Add the phone card layout.** Below `40rem` the board is cards, not a squeezed table
      — one card per release, blocker and band prominent. Follow
      `src/components/ward-management/search/search.module.css`'s `.tableScroll` / `.table` pattern
      for anything that stays tabular.
- [ ] **Step 6: Commit.** `git commit -m "A board for the beds on their way out, blocked ones first"`

---

## Task 7: The capacity headline and the coordinator's one action

**Files:**

- Modify: `src/components/ward-management/ward-management-modes.tsx`
- Modify: `src/components/ward-management/ward-management-modes.module.css`
- Modify: `src/components/ward-management/ward-derivations.ts`
- Test: `tests/ward-capacity-view.dom.test.tsx` (extend)

**Interfaces:** consumes Task 2's `capacityBreakdown`, Task 3's `REQUEST_CAPACITY_REFRESH`, Task 4's
`WardFreshness`.

**This task changes existing rendered behaviour** — the only one in the phase that does.
`unitCapacity().potential` is a raw count of every release regardless of state or timing, and it is
replaced by the breakdown. Say so in the commit message and in a comment where it happens.

- [ ] **Step 1: Write the failing tests** — the headline renders five separate figures and never a
      sum; `Available now` is unchanged by adding a predicted release; the coordinator's refresh
      control is a real button that dispatches `REQUEST_CAPACITY_REFRESH`; and the excluded count
      appears when a release falls beyond tonight.
- [ ] **Step 2: Run and watch them fail.**
- [ ] **Step 3: Replace the headline and add the control.** Five figures as five separate cards:
      `Available now · Confirmed today · Predicted today · Held · Leave (usable)`. Deprecate
      `unitCapacity().potential` in favour of `capacityBreakdown`, leaving a comment at the old call
      site naming this task.
- [ ] **Step 4: Run and watch them pass.**
- [ ] **Step 5: Commit.** `git commit -m "Capacity becomes five numbers, and none of them is a guess added to a fact"`

---

## Task 8: Verification sweep

**Files:** `tests/ui-ward-discharges.spec.ts` (create), plus `playwright.config.ts` if the spec
pattern needs the new file name — check `mockupSpecPattern` and `testMatch` before assuming.

- [ ] **Step 1: Write one Chromium journey.** A ward flags a release, confirms it, blocks it with a
      reason, then releases it — and the coordinator's capacity board reflects each change **without
      a reload**. Tag it `@mockup`. Model it on
      `tests/ui-ward-roles.spec.ts`'s "a ward confirming zero allocatable beds updates its own
      screen, then the coordinator" journey, which already proves this pattern works.
- [ ] **Step 2: Run the ward journeys.**

```bash
node scripts/run-playwright.mjs tests/ui-ward-management.spec.ts tests/ui-ward-coordinator.spec.ts tests/ui-ward-roles.spec.ts tests/ui-ward-discharges.spec.ts --project=chromium-mockups
```

Retry on `DATABASE_HEAVY_RUN_ADMISSION_BUSY` or `EPERM … owner.json`. Quote the `N passed` line.

- [ ] **Step 3: Capture and LOOK AT screenshots** at 390px, 820px and 1440px: the discharge board,
      the capacity board, and the ward screen. Every defect found in the Phase 4 sweep was invisible
      to structural checks and visible in a screenshot. Report what you see; do not assume.
- [ ] **Step 4: Run the full local gates once.**

```bash
npx vitest run tests/ward-*.test.ts tests/ward-*.dom.test.tsx --reporter dot
npm run typecheck
npm run lint
npm run format
```

- [ ] **Step 5: Commit the format result and push once**, with every commit assembled first. Pushing
      mid-run cancels the checks already running and restarts them.

---

## Self-review

**Spec coverage.** D1 → Task 1. D2 → Task 3. D3 → Tasks 1 and 3. D4 → Tasks 1, 2, 5. D5 → Task 2.
D6 → Tasks 2 and 7. D7 → Tasks 4, 5, 6, 7. D8 → Task 1 (`confirmedBy` role labels) and the global
constraints. D9 → Task 6. D10 → Task 5. D11 → Task 1's structural privacy test. D12 → Tasks 3, 5, 7.
D13 → Task 1's fixtures. D14 is a recorded risk with no code, correctly.

**Placeholders.** None: every code step carries the actual content, and every "follow the existing
pattern" instruction names the exact file to copy from.

**Type consistency.** `BedReleaseState`, `BedRelease.state`, `BedRelease.blocker: string | null`,
`LeaveBed.usable`, `capacityBreakdown`, `releaseBand`, `EVENING_SHIFT_END_MINUTES`, `WardFreshness`
are used with identical names and shapes in every task that mentions them.

**One known gap, stated rather than hidden.** Tasks 5, 6 and 7 specify their tests by description
rather than as literal code, because their assertions depend on markup that exists in files this
plan does not reproduce. Each names the exact file to model on and the exact behaviour to assert.
An implementer who cannot write the test from that should stop and ask rather than guess.

## Parallelism

Task 1 is serial and first. Then Tasks 2, 3 and 4 may run concurrently — different files, no shared
edits. Then Tasks 5, 6 and 7 may run concurrently. Task 8 is serial and last.

Each implementer runs **only** its own focused Vitest file. The repository permits two focused test
leases at once and serialises everything heavier across every worktree on the machine, so agents that
each run the full suite will queue behind each other and lose the parallelism the fan-out bought.
Full suite, lint, format, typecheck, build and Playwright run **once**, in Task 8.
