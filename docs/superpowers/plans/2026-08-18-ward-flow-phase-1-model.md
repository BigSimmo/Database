# Ward Flow Phase 1 — the model — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat hospital/patient fixture with a model that can express WA metro psychiatry patient flow correctly — sites that have emergency departments and/or units, seven stages, a destination-only authorisation gate, sex mix and specialling, capacity with source and age, recorded declines, mid-movement status change, closure without arrival, running clocks, and realistic data volume.

**Architecture:** Phase 1 ships **no new screens**. It replaces one 736-line fixture file with five focused modules — clock, types, eligibility, site data, movement data — behind a barrel that keeps the existing ten routes compiling throughout. Every rule that Phase 2–4 screens will rely on becomes a pure function with a contract test, so the screens can be built against something already proved. Migration happens inside the tasks that cause it; no task leaves the build red.

**Tech Stack:** TypeScript 6 strict, Vitest for contracts, Playwright Chromium only to confirm existing routes still render. No React changes beyond keeping consumers compiling.

**Spec:** [`docs/superpowers/specs/2026-08-18-ward-flow-metro-patient-flow-design.md`](../specs/2026-08-18-ward-flow-metro-patient-flow-design.md)

## Global Constraints

- **Synthetic only.** No record may carry name, date of birth, medical record number, address, diagnosis, narrative history or treatment. Sex is the single permitted patient attribute beyond operational facts, and only because bed allocation turns on ward mix. `tests/ward-management.test.ts` asserts the absence of the forbidden keys — extend that assertion, never relax it.
- **Authorisation gates the destination only.** Detention in an unauthorised emergency department is lawful and normal. No check may treat a patient's current ED as a compliance problem.
- **Nothing auto-allocates.** Phase 1 adds no action that changes a destination without a human.
- **Conservative failure.** Missing or stale data must narrow the suggestion set, never widen it. Unknown legal status is treated as requiring an authorised destination.
- **No provider calls.** Everything offline against fixtures. Never add fetch, Supabase or OpenAI to a Ward Flow file.
- **`now` is injected, never read implicitly.** Every function that needs the current time takes it as a parameter. Only one module may read the wall clock.
- **Design tokens only** in any CSS touched: no raw hex, and no raw padding/gap/z-index/line-height literals — declare a local token first. `npm run check:design-system-contract` ratchets these and fails on any increase.
- **`npm run format` and commit the result** before any push. It is in neither `lint`, `typecheck` nor `test`.
- **Heavy gates are lock-coordinated.** `npm run lint` can exit `0` without running, printing `DATABASE_HEAVY_RUN_ADMISSION_BUSY`. Exit code alone is not proof — read the output.
- **Do not run** `verify:ui`, `verify:release`, `eval:*`, `check:supabase-project` or any provider-backed gate in this phase.

---

## File Structure

| File                                                   | Responsibility                                                                                                                                                                |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/ward-management/ward-clock.ts`         | **New.** The only module that may read the wall clock. Duration parsing, `minutesUntil`, `clockState`, formatting.                                                            |
| `src/components/ward-management/ward-model.ts`         | **New.** Domain types only — no data, no logic. `Site`, `EmergencyDepartment`, `Unit`, `Movement`, `CapacityFigure`, `Decline`, `StatusChange`, `BedRelease`, `TransportJob`. |
| `src/components/ward-management/ward-eligibility.ts`   | **New.** Pure gates: authorisation, cohort, security, sex mix, specialling, prior declines. Returns structured verdicts, never booleans alone.                                |
| `src/components/ward-management/ward-sites.ts`         | **New.** The eight metro sites plus WACHS, each with its ED and/or units.                                                                                                     |
| `src/components/ward-management/ward-movements.ts`     | **New.** Seeded movement data and the deterministic builder that expands it to realistic volume.                                                                              |
| `src/components/ward-management/synthetic-fixtures.ts` | **Shrinks to a barrel.** Re-exports the above so the ten existing routes keep compiling while they migrate.                                                                   |
| `tests/ward-model.test.ts`                             | **New.** Every model invariant.                                                                                                                                               |
| `tests/ward-eligibility.test.ts`                       | **New.** Every gate, including the ED-detention-is-lawful case.                                                                                                               |
| `tests/ward-clock.test.ts`                             | **New.** Time arithmetic and states.                                                                                                                                          |

Types come before data; pure functions before fixtures; fixtures before volume. Each task keeps `npm run typecheck` green.

---

### Task 1: The clock

Everything downstream needs a notion of "now" that tests can pin. Build it first and in isolation, because it is the only module allowed to read the wall clock.

**Files:**

- Create: `src/components/ward-management/ward-clock.ts`
- Create: `tests/ward-clock.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `type Instant = number` (minutes since the synthetic day began); `wallClockNow(): Instant`; `minutesUntil(due: Instant, now: Instant): number`; `clockState(due: Instant, now: Instant): ClockState`; `formatRemaining(minutes: number): string`; `formatInstant(instant: Instant): string`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/ward-clock.test.ts
import { describe, expect, it } from "vitest";

import { clockState, formatInstant, formatRemaining, minutesUntil } from "../src/components/ward-management/ward-clock";

const NOW = 10 * 60 + 42; // 10:42 on the synthetic day

describe("ward clock", () => {
  it("counts minutes forward and backward from now", () => {
    expect(minutesUntil(NOW + 93, NOW)).toBe(93);
    expect(minutesUntil(NOW - 42, NOW)).toBe(-42);
  });

  it("classifies a deadline by how much time is left", () => {
    expect(clockState(NOW - 1, NOW)).toBe("breached");
    expect(clockState(NOW + 30, NOW)).toBe("critical");
    expect(clockState(NOW + 120, NOW)).toBe("due");
    expect(clockState(NOW + 400, NOW)).toBe("clear");
  });

  it("formats a remaining duration for a coordinator, not a machine", () => {
    expect(formatRemaining(93)).toBe("1h 33m left");
    expect(formatRemaining(45)).toBe("45m left");
    expect(formatRemaining(-42)).toBe("42m overdue");
    expect(formatRemaining(-93)).toBe("1h 33m overdue");
  });

  it("formats an instant as a wall-clock time", () => {
    expect(formatInstant(NOW)).toBe("10:42");
    expect(formatInstant(9 * 60 + 5)).toBe("09:05");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ward-clock.test.ts`
Expected: FAIL with "Cannot find module '../src/components/ward-management/ward-clock'".

- [ ] **Step 3: Write the implementation**

```ts
// src/components/ward-management/ward-clock.ts

/**
 * Minutes elapsed since midnight on the synthetic operating day.
 *
 * The whole model stores durations rather than fixed times so the board can tick. This is
 * the ONLY module permitted to read the wall clock: everything else receives `now` as a
 * parameter, which is what keeps tests and screenshots deterministic.
 */
export type Instant = number;

export type ClockState = "breached" | "critical" | "due" | "clear";

export function wallClockNow(): Instant {
  const date = new Date();
  return date.getHours() * 60 + date.getMinutes();
}

export function minutesUntil(due: Instant, now: Instant) {
  return due - now;
}

export function clockState(due: Instant, now: Instant): ClockState {
  const remaining = minutesUntil(due, now);
  if (remaining < 0) return "breached";
  if (remaining < 60) return "critical";
  if (remaining < 180) return "due";
  return "clear";
}

function splitDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${minutes}m`;
}

export function formatRemaining(minutes: number) {
  if (minutes < 0) return `${splitDuration(Math.abs(minutes))} overdue`;
  return `${splitDuration(minutes)} left`;
}

export function formatInstant(instant: Instant) {
  const hours = Math.floor(instant / 60) % 24;
  const minutes = instant % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ward-clock.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/components/ward-management/ward-clock.ts tests/ward-clock.test.ts
git commit -m "feat(ward-flow): add the injectable clock the model will run on"
```

---

### Task 2: Domain types

Types alone, no data and no logic. Everything after this task refers to these names, so getting them right here prevents the rename churn that would otherwise run through five files.

**Files:**

- Create: `src/components/ward-management/ward-model.ts`
- Create: `tests/ward-model.test.ts`

**Interfaces:**

- Consumes: `Instant` from Task 1.
- Produces: the type names listed below, plus `MOVEMENT_STAGES`, `DECLINE_REASONS`, `PARALLEL_REFERRAL_CAP`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/ward-model.test.ts
import { describe, expect, it } from "vitest";

import { DECLINE_REASONS, MOVEMENT_STAGES, PARALLEL_REFERRAL_CAP } from "../src/components/ward-management/ward-model";

describe("ward model constants", () => {
  it("carries the seven stages in pathway order", () => {
    expect(MOVEMENT_STAGES).toEqual([
      "placement_requested",
      "destination_review",
      "accepted_awaiting_bed",
      "bed_held",
      "handover_ready",
      "moving",
      "arrived",
    ]);
  });

  it("offers a fixed decline vocabulary rather than free text", () => {
    expect(DECLINE_REASONS).toContain("no_bed");
    expect(DECLINE_REASONS).toContain("sex_mix");
    expect(DECLINE_REASONS).toContain("specialling_unavailable");
    expect(DECLINE_REASONS).toContain("acuity_mix");
    expect(DECLINE_REASONS).toContain("capability_mismatch");
    expect(DECLINE_REASONS).toContain("bed_held_for_earlier_referral");
  });

  it("caps parallel referrals so wards are not spammed", () => {
    expect(PARALLEL_REFERRAL_CAP).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ward-model.test.ts`
Expected: FAIL with "Cannot find module '../src/components/ward-management/ward-model'".

- [ ] **Step 3: Write the implementation**

```ts
// src/components/ward-management/ward-model.ts
import type { Instant } from "@/components/ward-management/ward-clock";

export type HealthService = "North Metro" | "South Metro" | "East Metro" | "WACHS" | "Private";
export type Cohort = "Adult" | "Older adult";
export type Security = "Open" | "Secure";
export type Sex = "Female" | "Male";

export const MOVEMENT_STAGES = [
  "placement_requested",
  "destination_review",
  "accepted_awaiting_bed",
  "bed_held",
  "handover_ready",
  "moving",
  "arrived",
] as const;
export type MovementStage = (typeof MOVEMENT_STAGES)[number];

export const DECLINE_REASONS = [
  "no_bed",
  "sex_mix",
  "specialling_unavailable",
  "acuity_mix",
  "capability_mismatch",
  "bed_held_for_earlier_referral",
] as const;
export type DeclineReason = (typeof DECLINE_REASONS)[number];

/** Referring to more than three units at once spams wards and erodes trust between services. */
export const PARALLEL_REFERRAL_CAP = 3;

export type LegalStatus =
  "Voluntary" | "Referred for psychiatric examination" | "Detained awaiting examination" | "Involuntary inpatient";

export type LegalForm = {
  code: string;
  label: string;
  kind: "examination" | "detention" | "transport" | "transfer";
  dueAt: Instant;
};

/**
 * A capacity number is meaningless without where it came from and when.
 * `feed` knows which beds are physically empty; `ward` knows which are actually allocatable
 * once staffing, sex mix, acuity mix, single rooms and holds are accounted for.
 */
export type CapacitySource = "feed" | "ward";

export type CapacityFigure = {
  value: number;
  source: CapacitySource;
  confirmedAt: Instant;
  staleAfterMinutes: number;
};

export type EmergencyDepartment = {
  id: string;
  siteCode: string;
  name: string;
};

export type Unit = {
  id: string;
  siteCode: string;
  name: string;
  cohort: Cohort;
  security: Security;
  /** Authorised under the Mental Health Act 2014 to receive involuntary admissions. */
  authorised: boolean;
  beds: number;
  /** Physically empty beds, per the feed. */
  empty: CapacityFigure;
  /** Beds the ward says it can actually allocate. Never greater than `empty` in practice. */
  allocatable: CapacityFigure;
  held: number;
  blocked: number;
  /** Current occupants by sex, which is what constrains who the next admission can be. */
  sexMix: Record<Sex, number>;
  /** How many 1:1 observation patients this unit can staff beyond its current load. */
  spellingCapacity: number;
};

export type Site = {
  code: string;
  name: string;
  service: HealthService;
  emergencyDepartment?: EmergencyDepartment;
  units: Unit[];
};

export type Decline = {
  unitId: string;
  at: Instant;
  reason: DeclineReason;
  note?: string;
};

export type StatusChange = {
  at: Instant;
  from: LegalStatus;
  to: LegalStatus;
  by: string;
};

export type TransportJob = {
  id: string;
  provider: string;
  escortRequired: boolean;
  formRequired?: string;
  acceptedAt?: Instant;
  enRouteAt?: Instant;
  collectedAt?: Instant;
  arrivedAt?: Instant;
  cancelledAt?: Instant;
};

export type MovementClosure = {
  at: Instant;
  outcome: "arrived" | "did_not_proceed";
  reason: string;
};

export type Movement = {
  id: string;
  /** Where the patient physically is. Detention here is lawful even when unauthorised. */
  originEdId: string;
  openedAt: Instant;
  urgency: 1 | 2 | 3;
  cohort: Cohort;
  security: Security;
  sex: Sex;
  specialling: boolean;
  legalStatus: LegalStatus;
  legalForm?: LegalForm;
  statusChanges: StatusChange[];
  stage: MovementStage;
  owner: string;
  /** Units currently holding a live referral. Never longer than PARALLEL_REFERRAL_CAP. */
  referredUnitIds: string[];
  acceptedUnitId?: string;
  declines: Decline[];
  transport?: TransportJob;
  blocker: string;
  closure?: MovementClosure;
};

export type BedRelease = {
  id: string;
  unitId: string;
  expectedAt: Instant;
  confidence: "confirmed" | "likely" | "possible";
  blocker: string;
  confirmedAt: Instant;
  confirmedBy: string;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ward-model.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/components/ward-management/ward-model.ts tests/ward-model.test.ts
git commit -m "feat(ward-flow): define the phase 1 domain types"
```

---

### Task 3: Eligibility gates

The rules that decide which units may receive a patient. Pure, tested, and consumed by every screen in later phases. This is where the corrected authorisation rule lives, so the test that proves ED detention is lawful belongs here.

**Files:**

- Create: `src/components/ward-management/ward-eligibility.ts`
- Create: `tests/ward-eligibility.test.ts`

**Interfaces:**

- Consumes: types from Task 2.
- Produces: `requiresAuthorisedDestination(status): boolean`; `eligibility(movement, unit, now): EligibilityVerdict` where `EligibilityVerdict = { eligible: boolean; gates: GateResult[] }` and `GateResult = { gate: string; pass: boolean; detail: string }`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/ward-eligibility.test.ts
import { describe, expect, it } from "vitest";

import { eligibility, requiresAuthorisedDestination } from "../src/components/ward-management/ward-eligibility";
import type { Movement, Unit } from "../src/components/ward-management/ward-model";

const NOW = 10 * 60 + 42;

function unit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: "u-test",
    siteCode: "RPH",
    name: "Test Unit",
    cohort: "Adult",
    security: "Open",
    authorised: true,
    beds: 20,
    empty: { value: 3, source: "feed", confirmedAt: NOW - 2, staleAfterMinutes: 15 },
    allocatable: { value: 2, source: "ward", confirmedAt: NOW - 10, staleAfterMinutes: 120 },
    held: 0,
    blocked: 0,
    sexMix: { Female: 10, Male: 8 },
    spellingCapacity: 1,
    ...overrides,
  };
}

function movement(overrides: Partial<Movement> = {}): Movement {
  return {
    id: "WF-001",
    originEdId: "ed-rph",
    openedAt: NOW - 300,
    urgency: 2,
    cohort: "Adult",
    security: "Open",
    sex: "Female",
    specialling: false,
    legalStatus: "Voluntary",
    statusChanges: [],
    stage: "destination_review",
    owner: "Flow coordinator",
    referredUnitIds: [],
    declines: [],
    blocker: "No blocker",
    ...overrides,
  };
}

describe("authorisation", () => {
  it("requires an authorised destination for every non-voluntary status", () => {
    expect(requiresAuthorisedDestination("Voluntary")).toBe(false);
    expect(requiresAuthorisedDestination("Referred for psychiatric examination")).toBe(true);
    expect(requiresAuthorisedDestination("Detained awaiting examination")).toBe(true);
    expect(requiresAuthorisedDestination("Involuntary inpatient")).toBe(true);
  });

  it("blocks a detained patient from an unauthorised unit", () => {
    const verdict = eligibility(
      movement({ legalStatus: "Detained awaiting examination" }),
      unit({ authorised: false }),
      NOW,
    );
    expect(verdict.eligible).toBe(false);
    expect(verdict.gates.find((gate) => gate.gate === "authorisation")?.pass).toBe(false);
  });

  it("treats unknown-status movements as requiring authorisation, failing safe", () => {
    const verdict = eligibility(
      // @ts-expect-error deliberately malformed to prove conservative failure
      movement({ legalStatus: undefined }),
      unit({ authorised: false }),
      NOW,
    );
    expect(verdict.eligible).toBe(false);
  });
});

describe("clinical and operational gates", () => {
  it("refuses a cohort mismatch", () => {
    const verdict = eligibility(movement({ cohort: "Older adult" }), unit({ cohort: "Adult" }), NOW);
    expect(verdict.gates.find((gate) => gate.gate === "cohort")?.pass).toBe(false);
  });

  it("refuses when the ward cannot staff the required specialling", () => {
    const verdict = eligibility(movement({ specialling: true }), unit({ spellingCapacity: 0 }), NOW);
    expect(verdict.gates.find((gate) => gate.gate === "specialling")?.pass).toBe(false);
  });

  it("refuses a unit that has already declined this movement", () => {
    const declined = movement({ declines: [{ unitId: "u-test", at: NOW - 60, reason: "no_bed" }] });
    const verdict = eligibility(declined, unit(), NOW);
    expect(verdict.gates.find((gate) => gate.gate === "prior_decline")?.pass).toBe(false);
  });

  it("drops a unit whose allocatable figure has gone stale rather than showing it hopefully", () => {
    const stale = unit({
      allocatable: { value: 4, source: "ward", confirmedAt: NOW - 200, staleAfterMinutes: 120 },
    });
    const verdict = eligibility(movement(), stale, NOW);
    expect(verdict.gates.find((gate) => gate.gate === "capacity_freshness")?.pass).toBe(false);
  });

  it("passes every gate for a well-matched voluntary movement", () => {
    const verdict = eligibility(movement(), unit(), NOW);
    expect(verdict.eligible).toBe(true);
    expect(verdict.gates.every((gate) => gate.pass)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ward-eligibility.test.ts`
Expected: FAIL with "Cannot find module '../src/components/ward-management/ward-eligibility'".

- [ ] **Step 3: Write the implementation**

```ts
// src/components/ward-management/ward-eligibility.ts
import type { Instant } from "@/components/ward-management/ward-clock";
import type { LegalStatus, Movement, Unit } from "@/components/ward-management/ward-model";

export type GateResult = { gate: string; pass: boolean; detail: string };
export type EligibilityVerdict = { eligible: boolean; gates: GateResult[] };

/**
 * Every status other than Voluntary carries a detention authority, so the receiving unit must
 * be authorised. This governs the DESTINATION only — detaining a referred patient in an
 * unauthorised emergency department is lawful and is the normal state while they wait.
 */
export function requiresAuthorisedDestination(status: LegalStatus | undefined) {
  return status !== "Voluntary";
}

function capacityIsFresh(unit: Unit, now: Instant) {
  return now - unit.allocatable.confirmedAt <= unit.allocatable.staleAfterMinutes;
}

export function eligibility(movement: Movement, unit: Unit, now: Instant): EligibilityVerdict {
  const authorisationNeeded = requiresAuthorisedDestination(movement.legalStatus);
  const declined = movement.declines.some((decline) => decline.unitId === unit.id);
  const fresh = capacityIsFresh(unit, now);
  const sameSexOccupants = unit.sexMix[movement.sex] ?? 0;

  const gates: GateResult[] = [
    {
      gate: "authorisation",
      pass: !authorisationNeeded || unit.authorised,
      detail: authorisationNeeded
        ? unit.authorised
          ? "Authorised to receive an involuntary admission"
          : `${unit.name} is not authorised under the Mental Health Act`
        : "Voluntary admission needs no authorisation",
    },
    {
      gate: "cohort",
      pass: unit.cohort === movement.cohort,
      detail: `${unit.cohort} unit for a ${movement.cohort.toLowerCase()} movement`,
    },
    {
      gate: "security",
      pass: movement.security === "Open" || unit.security === "Secure",
      detail: `${unit.security} ward for a ${movement.security.toLowerCase()} requirement`,
    },
    {
      gate: "sex_mix",
      pass: sameSexOccupants > 0 || unit.allocatable.value > 1,
      detail:
        sameSexOccupants > 0
          ? `${sameSexOccupants} ${movement.sex.toLowerCase()} occupants already`
          : "No same-sex occupants; needs more than one free bed",
    },
    {
      gate: "specialling",
      pass: !movement.specialling || unit.spellingCapacity > 0,
      detail: movement.specialling ? `${unit.spellingCapacity} specialling slots available` : "No specialling required",
    },
    {
      gate: "prior_decline",
      pass: !declined,
      detail: declined ? "Already declined this movement" : "No prior decline",
    },
    {
      gate: "capacity_freshness",
      pass: fresh,
      detail: fresh
        ? `Confirmed ${now - unit.allocatable.confirmedAt} min ago`
        : `Last confirmed ${now - unit.allocatable.confirmedAt} min ago — stale`,
    },
    {
      gate: "allocatable_bed",
      pass: unit.allocatable.value > 0,
      detail: `${unit.allocatable.value} allocatable`,
    },
  ];

  return { eligible: gates.every((gate) => gate.pass), gates };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ward-eligibility.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/components/ward-management/ward-eligibility.ts tests/ward-eligibility.test.ts
git commit -m "feat(ward-flow): add eligibility gates with destination-only authorisation"
```

---

### Task 4: Site, ED and unit fixtures

Replace the flat hospital list with sites that carry an emergency department, inpatient units, or both. The asymmetry is the point: Fremantle and Bentley have units and no ED; Peel and Joondalup have EDs feeding elsewhere.

**Files:**

- Create: `src/components/ward-management/ward-sites.ts`
- Modify: `tests/ward-model.test.ts`

**Interfaces:**

- Consumes: types from Task 2.
- Produces: `wardSites: Site[]`; `allUnits(): Unit[]`; `allEmergencyDepartments(): EmergencyDepartment[]`; `unitById(id): Unit | undefined`; `siteByCode(code): Site | undefined`.

- [ ] **Step 1: Write the failing test**

```ts
// append to tests/ward-model.test.ts
import { allEmergencyDepartments, allUnits, siteByCode, wardSites } from "../src/components/ward-management/ward-sites";

describe("ward sites", () => {
  it("models the eight metro emergency departments", () => {
    const codes = allEmergencyDepartments()
      .map((ed) => ed.siteCode)
      .sort();
    expect(codes).toEqual(["ARM", "FSH", "JHC", "PEEL", "RGH", "RPH", "SCGH", "SJGM"]);
  });

  it("includes sites that have units but no emergency department", () => {
    expect(siteByCode("FRE")?.emergencyDepartment).toBeUndefined();
    expect(siteByCode("FRE")?.units.length).toBeGreaterThan(0);
    expect(siteByCode("BTY")?.emergencyDepartment).toBeUndefined();
  });

  it("includes emergency departments that feed elsewhere and hold no units", () => {
    expect(siteByCode("PEEL")?.emergencyDepartment).toBeDefined();
    expect(siteByCode("PEEL")?.units).toHaveLength(0);
  });

  it("accounts for every bed in every unit", () => {
    for (const unit of allUnits()) {
      expect(unit.allocatable.value, `${unit.id} claims more allocatable than empty`).toBeLessThanOrEqual(
        unit.empty.value,
      );
      expect(unit.held + unit.blocked + unit.empty.value, `${unit.id} exceeds its bed count`).toBeLessThanOrEqual(
        unit.beds,
      );
      const occupants = unit.sexMix.Female + unit.sexMix.Male;
      expect(occupants + unit.empty.value + unit.blocked, `${unit.id} occupancy does not reconcile`).toBe(unit.beds);
    }
  });

  it("keeps at least one older-adult unit at zero allocatable, because scarcity is the norm", () => {
    const olderAdult = allUnits().filter((unit) => unit.cohort === "Older adult");
    expect(olderAdult.length).toBeGreaterThan(2);
    expect(olderAdult.some((unit) => unit.allocatable.value === 0)).toBe(true);
  });

  it("marks private and non-authorised units honestly", () => {
    expect(allUnits().some((unit) => !unit.authorised)).toBe(true);
    expect(wardSites.some((site) => site.service === "Private")).toBe(true);
    expect(wardSites.some((site) => site.service === "WACHS")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ward-model.test.ts`
Expected: FAIL with "Cannot find module '../src/components/ward-management/ward-sites'".

- [ ] **Step 3: Write the implementation**

Create `ward-sites.ts` exporting `wardSites: Site[]`. Build it from a compact literal per site so the file stays readable. Required shape:

- **Both ED and units:** `RPH` (Royal Perth, East Metro), `SCGH` (Sir Charles Gairdner, North Metro), `FSH` (Fiona Stanley, South Metro), `ARM` (Armadale, East Metro), `SJGM` (St John of God Midland, East Metro), `RGH` (Rockingham, South Metro).
- **ED only, no units:** `JHC` (Joondalup, North Metro), `PEEL` (Peel Health Campus, South Metro).
- **Units only, no ED:** `FRE` (Fremantle, South Metro), `BTY` (Bentley, East Metro), `GRY` (Graylands, North Metro).
- **WACHS, units only:** `ALB` (Albany), `BUN` (Bunbury), `BRM` (Broome), `GER` (Geraldton), `KUN` (Kununurra).
- **Private:** `SJGS` (St John of God Subiaco), units only, `authorised: false`.

Each unit follows this shape — vary the numbers, keep the invariants:

```ts
{
  id: "rph-adult-secure",
  siteCode: "RPH",
  name: "RPH Adult Secure",
  cohort: "Adult",
  security: "Secure",
  authorised: true,
  beds: 20,
  empty: { value: 2, source: "feed", confirmedAt: NOW_ANCHOR - 3, staleAfterMinutes: 15 },
  allocatable: { value: 1, source: "ward", confirmedAt: NOW_ANCHOR - 24, staleAfterMinutes: 120 },
  held: 1,
  blocked: 0,
  sexMix: { Female: 8, Male: 9 },
  spellingCapacity: 1,
}
```

`NOW_ANCHOR` is `10 * 60 + 42`. Give every site at least one adult unit; give `RPH`, `SCGH`, `FSH`, `GRY`, `FRE` and `BTY` an older-adult unit as well, and set **at least one older-adult unit to `allocatable.value: 0`**. Make at least two units stale (`confirmedAt` more than `staleAfterMinutes` ago) so the freshness gate has something to catch, and make at least one unit disagree with its feed by two or more beds.

Then the helpers:

```ts
export function allUnits() {
  return wardSites.flatMap((site) => site.units);
}

export function allEmergencyDepartments() {
  return wardSites.flatMap((site) => (site.emergencyDepartment ? [site.emergencyDepartment] : []));
}

export function unitById(id: string) {
  return allUnits().find((unit) => unit.id === id);
}

export function siteByCode(code: string) {
  return wardSites.find((site) => site.code === code);
}
```

Note the deliberate absence of a fallback: `unitById` and `siteByCode` return `undefined` for an unknown key. The old `wardHospitalByCode` silently returned a _different hospital_, which is the opposite of degrading conservatively.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ward-model.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/components/ward-management/ward-sites.ts tests/ward-model.test.ts
git commit -m "feat(ward-flow): model sites with emergency departments and units"
```

---

### Task 5: Movements at realistic volume

Fourteen calm movements produce screens that collapse on first contact with a real night. Build the seed data and a deterministic expander that reaches forty to sixty, with the bad night as the default.

**Files:**

- Create: `src/components/ward-management/ward-movements.ts`
- Modify: `tests/ward-model.test.ts`

**Interfaces:**

- Consumes: types from Task 2, `allUnits`/`allEmergencyDepartments` from Task 4.
- Produces: `wardMovements: Movement[]`; `movementById(id): Movement | undefined`; `movementsByStage(stage): Movement[]`; `bedReleases: BedRelease[]`.

- [ ] **Step 1: Write the failing test**

```ts
// append to tests/ward-model.test.ts
import { requiresAuthorisedDestination } from "../src/components/ward-management/ward-eligibility";
import { bedReleases, movementById, wardMovements } from "../src/components/ward-management/ward-movements";
import { PARALLEL_REFERRAL_CAP } from "../src/components/ward-management/ward-model";

const NOW_ANCHOR = 10 * 60 + 42;

describe("ward movements", () => {
  it("runs at realistic pressure, not comfortable pressure", () => {
    expect(wardMovements.length).toBeGreaterThanOrEqual(40);
    expect(wardMovements.length).toBeLessThanOrEqual(60);
    const eds = new Set(wardMovements.map((movement) => movement.originEdId));
    expect(eds.size).toBe(8);
  });

  it("gives every movement an emergency department it is actually sitting in", () => {
    for (const movement of wardMovements) {
      expect(movement.originEdId, `${movement.id} has no origin`).toBeTruthy();
    }
  });

  it("carries no patient identity beyond sex", () => {
    for (const movement of wardMovements) {
      expect(movement.id).toMatch(/^WF-\d{3}$/);
      expect(movement).not.toHaveProperty("name");
      expect(movement).not.toHaveProperty("dateOfBirth");
      expect(movement).not.toHaveProperty("mrn");
      expect(movement).not.toHaveProperty("address");
      expect(movement).not.toHaveProperty("diagnosis");
      expect(movement).not.toHaveProperty("clinicalHistory");
    }
  });

  it("never exceeds the parallel referral cap", () => {
    for (const movement of wardMovements) {
      expect(movement.referredUnitIds.length).toBeLessThanOrEqual(PARALLEL_REFERRAL_CAP);
    }
  });

  it("never leaves an open movement without an owner", () => {
    for (const movement of wardMovements) {
      if (movement.closure) continue;
      expect(movement.owner.length, `${movement.id} is ownerless`).toBeGreaterThan(0);
    }
  });

  it("gives every non-voluntary movement a legal form with a deadline", () => {
    for (const movement of wardMovements) {
      if (!requiresAuthorisedDestination(movement.legalStatus)) continue;
      expect(movement.legalForm, `${movement.id} has no legal form`).toBeDefined();
    }
  });

  it("includes the states the old fixture could not express", () => {
    expect(wardMovements.some((movement) => movement.stage === "accepted_awaiting_bed")).toBe(true);
    expect(wardMovements.some((movement) => movement.declines.length >= 3)).toBe(true);
    expect(wardMovements.some((movement) => movement.statusChanges.length > 0)).toBe(true);
    expect(wardMovements.some((movement) => movement.closure?.outcome === "did_not_proceed")).toBe(true);
    expect(wardMovements.some((movement) => (movement.legalForm?.dueAt ?? Infinity) < NOW_ANCHOR)).toBe(true);
  });

  it("never records a decline against a unit that is also a live referral", () => {
    for (const movement of wardMovements) {
      for (const decline of movement.declines) {
        expect(movement.referredUnitIds).not.toContain(decline.unitId);
      }
    }
  });

  it("flags bed releases without any departing-patient detail", () => {
    expect(bedReleases.length).toBeGreaterThan(4);
    for (const release of bedReleases) {
      expect(release.id).toMatch(/^WR-\d{3}$/);
      expect(release).not.toHaveProperty("name");
      expect(release).not.toHaveProperty("mrn");
      expect(release).not.toHaveProperty("diagnosis");
    }
  });

  it("returns undefined for an unknown movement rather than a different patient", () => {
    expect(movementById("WF-999")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ward-model.test.ts`
Expected: FAIL with "Cannot find module '../src/components/ward-management/ward-movements'".

- [ ] **Step 3: Write the implementation**

Hand-author roughly **eighteen "interesting" movements** covering every state the tests demand: one with three declines and no eligible destination left, one at `accepted_awaiting_bed`, one with a status change from Voluntary to Detained, one closed as `did_not_proceed`, at least two with a breached `legalForm.dueAt`, several older-adult, several requiring specialling, at least one at each of the seven stages.

Then expand deterministically to volume:

```ts
/**
 * Routine movements filling out a busy metro night. Deterministic — index drives every
 * varying field — so screenshots and tests never shift between runs.
 */
function routineMovements(count: number, startIndex: number): Movement[] {
  const eds = allEmergencyDepartments();
  return Array.from({ length: count }, (_, offset) => {
    const index = startIndex + offset;
    const ed = eds[index % eds.length];
    const cohort = index % 4 === 0 ? "Older adult" : "Adult";
    const sex = index % 2 === 0 ? "Female" : "Male";
    const urgency = ((index % 3) + 1) as 1 | 2 | 3;
    return {
      id: `WF-${String(index).padStart(3, "0")}`,
      originEdId: ed.id,
      openedAt: NOW_ANCHOR - (60 + ((index * 37) % 900)),
      urgency,
      cohort,
      security: index % 7 === 0 ? "Secure" : "Open",
      sex,
      specialling: index % 11 === 0,
      legalStatus: index % 3 === 0 ? "Referred for psychiatric examination" : "Voluntary",
      legalForm:
        index % 3 === 0
          ? {
              code: "1A",
              label: "Referral for examination",
              kind: "examination" as const,
              dueAt: NOW_ANCHOR + (((index * 53) % 400) - 60),
            }
          : undefined,
      statusChanges: [],
      stage: MOVEMENT_STAGES[index % MOVEMENT_STAGES.length],
      owner: index % 2 === 0 ? "Flow coordinator" : "ED mental health team",
      referredUnitIds: [],
      declines: [],
      blocker: index % 5 === 0 ? "Awaiting destination response" : "No blocker",
    } satisfies Movement;
  });
}

export const wardMovements: Movement[] = [...seededMovements, ...routineMovements(30, 300)];
```

Add `bedReleases` with at least five entries across different units, each carrying `expectedAt`, `confidence`, `blocker`, `confirmedAt` and `confirmedBy`, and nothing about the departing patient.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ward-model.test.ts`
Expected: PASS (19 tests).

- [ ] **Step 5: Commit**

```bash
npm run format
git add src/components/ward-management/ward-movements.ts tests/ward-model.test.ts
git commit -m "feat(ward-flow): build movements at realistic metro pressure"
```

---

### Task 6: Migrate the ten existing routes onto the new model

The old fixture and the new one now coexist. Move every consumer across in one task so the tree never holds two models, and delete the old file.

**Files:**

- Modify: `src/components/ward-management/synthetic-fixtures.ts` (becomes a barrel, then is deleted)
- Modify: `src/components/ward-management/ward-management-console.tsx`
- Modify: `src/components/ward-management/ward-management-modes.tsx`
- Modify: `src/components/ward-management/ward-management-network.tsx`
- Modify: `tests/ward-management.test.ts`
- Modify: `tests/ui-ward-management.spec.ts`

**Interfaces:**

- Consumes: everything from Tasks 1–5.
- Produces: no `synthetic-fixtures.ts`; all imports point at `ward-sites`, `ward-movements`, `ward-model`, `ward-eligibility`, `ward-clock`.

- [ ] **Step 1: Point the barrel at the new modules**

Replace the body of `synthetic-fixtures.ts` with re-exports only:

```ts
export * from "@/components/ward-management/ward-model";
export * from "@/components/ward-management/ward-sites";
export * from "@/components/ward-management/ward-movements";
```

- [ ] **Step 2: Run typecheck to see the real migration surface**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: FAIL, listing every consumer using `wardPatients`, `wardHospitals`, `wardHospitalByCode`, `operationalPriorityScore` or `movementStages`. That list is the work.

- [ ] **Step 3: Migrate the consumers**

Mechanical replacements across the three components:

- `wardPatients` → `wardMovements`
- `wardHospitals` → `allUnits()`
- `wardHospitalByCode(code)` → `unitById(id)`, handling `undefined` explicitly rather than falling back
- `patient.destinationCode` → `movement.acceptedUnitId ?? movement.referredUnitIds[0]`
- `patient.catchment` → the health service of `siteByCode(originEd.siteCode)`
- `hospital.available` → `unit.allocatable.value`
- `movementStages` → `MOVEMENT_STAGES` with counts derived from `wardMovements`
- `operationalPriorityScore` → **delete it.** It folded urgency into a number labelled "not clinical severity". Replace call sites with the raw score field for now; Phase 2 defines the real one.

Where a component displayed a field that no longer exists, render the nearest true equivalent rather than inventing one. Do not add new UI in this task.

- [ ] **Step 4: Run typecheck and the unit suite**

Run: `npx tsc --noEmit -p tsconfig.json && npx vitest run tests/ward-model.test.ts tests/ward-eligibility.test.ts tests/ward-clock.test.ts tests/ward-management.test.ts tests/route-reachability.test.ts`
Expected: typecheck clean, all suites pass.

- [ ] **Step 5: Delete the barrel and repoint the last imports**

```bash
git rm src/components/ward-management/synthetic-fixtures.ts
```

Then fix the resulting import errors by pointing each at the specific module it needs. Re-run the command from Step 4 until clean.

- [ ] **Step 6: Confirm the existing routes still render**

```bash
npm run ensure
npx playwright test tests/ui-ward-management.spec.ts --project=chromium --reporter=line
```

Expected: passes. Chromium journeys will need their expectations updated wherever a label changed — update the expectation to the new true value, never loosen an assertion to make it pass.

- [ ] **Step 7: Commit**

```bash
npm run format
git add -A src/components/ward-management tests
git commit -m "refactor(ward-flow): migrate every route onto the phase 1 model"
```

---

### Task 7: Correct the decision records and the glossary

ADR 1 is wrong as written — it reads as though detaining a patient in an emergency department were unlawful. Left uncorrected it will mislead whoever builds Phase 2.

**Files:**

- Modify: `docs/ward-management-decisions.md`
- Modify: `docs/ward-management-context.md`
- Modify: `docs/ward-management-mode-map.md`
- Modify: `docs/codebase-index.md`

- [ ] **Step 1: Rewrite ADR 1**

Replace its Context and Decision so the rule gates the destination of an involuntary admission only. State plainly that detention under Form 3A or 3B in an unauthorised general hospital emergency department is lawful and is the normal state while a patient waits. Set status to `Accepted — 2026-08-18`. Add to Consequences: _"The system never treats a patient's current location as a compliance problem."_

- [ ] **Step 2: Accept ADR 3 and add ADR 4**

Set ADR 3 (catchment and region) to Accepted. Add ADR 4 for the time model: durations rather than fixed times, one module reads the wall clock, `now` injected everywhere else. Alternatives considered: reading `Date.now()` at each call site — rejected because it makes every test and screenshot time-dependent.

- [ ] **Step 3: Update the glossary**

In `ward-management-context.md`: resolve **Bed state** (potential is a subset of occupied), **Decline** (now modelled, fixed reason list), **Statutory timing** (now a deadline with a computed state), **Status change** (now modelled as an event that re-runs eligibility). Add **Authorised hospital** wording matching the corrected ADR 1, and add **Emergency department**, **Site**, **Unit** and **Parallel referral**.

- [ ] **Step 4: Update the mode map and index**

Add a note at the top of `ward-management-mode-map.md` pointing at the new spec and stating that the nine-mode strip it describes is superseded by the role-first structure. Add the five new modules to the ward-management section of `docs/codebase-index.md`.

- [ ] **Step 5: Run the docs gate**

Run: `npm run docs:update && npx vitest run tests/route-reachability.test.ts`
Expected: passes.

- [ ] **Step 6: Commit**

```bash
npm run format
git add docs
git commit -m "docs(ward-flow): correct ADR 1 and reconcile the glossary with the phase 1 model"
```

---

### Task 8: Prove the whole phase

One pass over the local gates that this diff can plausibly break, and nothing broader.

- [ ] **Step 1: Static and unit**

```bash
npx tsc --noEmit -p tsconfig.json
npx vitest run tests/ward-clock.test.ts tests/ward-model.test.ts tests/ward-eligibility.test.ts tests/ward-management.test.ts tests/route-reachability.test.ts tests/tools-catalog.test.ts
```

Expected: typecheck clean; all suites pass.

- [ ] **Step 2: Lint — and read the output, not the exit code**

```bash
npm run lint
```

Expected: `0 problems`. If it prints `DATABASE_HEAVY_RUN_ADMISSION_BUSY` it exited without running — wait for the other heavyweight command and run it again.

- [ ] **Step 3: Design-system contract**

```bash
npm run check:design-system-contract
```

Expected: no ratchet increase. Phase 1 touches almost no CSS, so any increase means something was added that shouldn't have been.

- [ ] **Step 4: Existing browser journeys**

```bash
npm run ensure
npx playwright test tests/ui-ward-management.spec.ts --project=chromium --reporter=line
```

Expected: passes.

- [ ] **Step 5: Format and commit**

```bash
npm run format
git add -A
git commit -m "chore(ward-flow): phase 1 verification pass"
```

---

## Self-Review

**Spec coverage.** Section 4 of the spec (what the system holds) → Tasks 2, 4, 5. Section 3 (legal grounding) → Task 3, and the correction in Task 7. Section 5 (seven stages) → Task 2. Section 7's declines, status change, parallel cap and close-without-arrival → Tasks 2 and 5. Section 9 (time) → Task 1. Section 10 (conservative failure) → Task 3's stale-capacity and unknown-status gates, and Task 4's no-fallback lookups. Section 14 (data volume) → Task 5. Section 15 (migration) → Task 6. Section 17 (ADR reconciliation) → Task 7.

**Deliberately not in Phase 1.** Every screen. The operational score's real formula — it is deleted in Task 6 and defined in Phase 2, because the queue that consumes it does not exist yet. Transport events beyond the type. Escalation records beyond the decline data that feeds them.

**Type consistency.** `Instant` (Task 1) is the time type on `LegalForm.dueAt`, `CapacityFigure.confirmedAt`, `Decline.at`, `StatusChange.at`, `MovementClosure.at`, `BedRelease.expectedAt` and every `TransportJob` timestamp. `eligibility`/`requiresAuthorisedDestination` (Task 3) are consumed under those names in Tasks 5 and 6. `allUnits`/`allEmergencyDepartments`/`unitById`/`siteByCode` (Task 4) are consumed in Tasks 5 and 6.

**One inconsistency worth naming rather than hiding.** `Unit.spellingCapacity` is a typo for _specialling_ capacity, and it appears in the type, the gate and the fixtures. Fixing it during implementation is correct — just fix it in all three places at once, and update the Task 3 test with it.
