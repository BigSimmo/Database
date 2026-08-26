# Ward Flow Phase 4 — specialist boards, implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the eleven Phase 4 items — a scarcer scenario, mid-flight urgency and legal-status
changes, the undo the prototype has never had, and six specialist boards — leaving the statutory
clock board deliberately unbuilt.

**Architecture:** Every change follows the existing shape. New behaviour arrives as a reducer event
with a role gate and a `Rejection` on refusal; new reads arrive as pure derivations in
`ward-derivations.ts`; new screens are route components under `src/app/ward-management/` rendering
components under `src/components/ward-management/`. The reducer stays pure, `now` arrives on every
event, and nothing reads the wall clock outside `ward-clock.ts`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6 strict, CSS modules with `@theme`
design tokens, Vitest for unit and DOM tests, Playwright (Chromium) for journeys.

**Spec:** `docs/superpowers/specs/2026-08-25-ward-flow-phase-4-specialist-boards-design.md`

## Global Constraints

Copied verbatim from spec §1. Every task's requirements implicitly include this section.

1. **Never invent, infer, restate or "correct" any figure, requirement, title or classification from
   the Mental Health Act.** If a legal quantity is needed it comes from the product owner or it does
   not exist. Form titles resolve from the official register (`formTitleForCode`) or render as the
   bare code.
2. **Synthetic data only.** No name, date of birth, medical record number, address, diagnosis,
   narrative history or treatment. **Sex is the only permitted patient attribute. Free text counts.**
3. **Advisory only.** The system proposes; a human confirms or overrides, always, with the reason
   recorded. Nothing auto-allocates and nothing defaults after a timeout.
4. **Conservative failure.** Missing data narrows what is shown. An absence renders as an explicit
   absence, never as a substituted default. No `?? array[0]`, no `.find()!`.
5. **Not a medical device**, and the pages say so.
6. **Repo gates:** design tokens only (no raw hex); every `<button>` has a real handler, is a submit
   inside a form, or is a `<Link>`; never both `disabled` and `aria-disabled`; production tap targets
   `3rem`/48px, never `2.75rem`; one search composer per page; internal navigation via
   `<Link>`/`router.push`, never a raw `<a href>`; a new production route needs an inbound nav link
   plus a reachability assertion in `tests/route-reachability.test.ts`.
7. **Purity:** no `Math.random()`; no wall-clock read outside `ward-clock.ts`; the reducer stays pure
   and `now` arrives on the event.

**Additional execution constraints for every task:**

- **Mutation-test every test you add or change.** Make the single edit that should kill it, **print
  the edited line back from the file**, run it, watch it fail, revert, confirm green. A mutation you
  did not read back did not happen. **If a mutation does not kill the test, say so and stop** — do
  not reshape the test until something goes red.
- **No assertion may be weakened, removed, or made unable to fail.**
- Read counts, never exit codes. Leave no stray files, including in the repository root.
- **Do not run Playwright, `npm run lint`, or a build** — the controller runs those gates.
- One commit per task. **Do not push.**

## File Structure

| File                                                                             | Responsibility                                                                                  | New?    |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------- |
| `src/components/ward-management/ward-scenarios.ts`                               | The two synthetic nights and the tightening rule                                                | **new** |
| `src/components/ward-management/ward-change-reasons.ts`                          | The four fixed reason lists and the escalation contact list                                     | **new** |
| `src/components/ward-management/ward-flow-events.ts`                             | Event union + role table                                                                        | modify  |
| `src/components/ward-management/ward-flow-reducer.ts`                            | New handlers, widened role gate, scenario seed                                                  | modify  |
| `src/components/ward-management/ward-model.ts`                                   | `ChangeRecord`, `BedRelease` writer fields                                                      | modify  |
| `src/components/ward-management/ward-derivations.ts`                             | `handoverSnapshot`, `escalationBoard`, `searchMovements`, `effectivenessNumbers`, `changeAudit` | modify  |
| `src/components/ward-management/handover/handover-page.tsx` + `.module.css`      | Item 1                                                                                          | **new** |
| `src/components/ward-management/escalation/escalation-board.tsx` + `.module.css` | Item 4                                                                                          | **new** |
| `src/components/ward-management/search/patient-search.tsx` + `.module.css`       | Item 5                                                                                          | **new** |
| `src/app/ward-management/handover/page.tsx`                                      | Route for item 1                                                                                | **new** |
| `src/app/ward-management/escalation/page.tsx`                                    | Route for item 4                                                                                | **new** |
| `src/app/ward-management/search/page.tsx`                                        | Route for item 5                                                                                | **new** |

---

## Task 1: The scarce-beds scenario (spec item 2)

**Files:**

- Create: `src/components/ward-management/ward-scenarios.ts`
- Modify: `src/components/ward-management/ward-flow-events.ts` (add `SET_SCENARIO`)
- Modify: `src/components/ward-management/ward-flow-reducer.ts` (`seedWardFlowState`, `SET_SCENARIO`, `subjectId`)
- Modify: `src/components/ward-management/ward-demo-controls.tsx`
- Test: `tests/ward-scenarios.test.ts` (new)

**Interfaces:**

- Consumes: `allUnits()` from `ward-sites.ts`; `wardMovements` from `ward-movements.ts`;
  `eligibility(movement, unit, now)` from `ward-eligibility.ts`; `isOpen(movement)` from
  `ward-derivations.ts`; `NOW_ANCHOR` from `ward-sites.ts`.
- Produces:
  - `export type WardScenario = "standard" | "scarce";`
  - `export const WARD_SCENARIOS: readonly WardScenario[];`
  - `export function scenarioUnits(scenario: WardScenario): Unit[];`
  - `export const scenarioLabels: Record<WardScenario, string>;`
  - `WardFlowState` gains `scenario: WardScenario`.
  - Event `{ type: "SET_SCENARIO"; role: WardFlowRole; now: Instant; scenario: WardScenario }`,
    `EVENT_ROLE.SET_SCENARIO = "demo"`.

**Why this task is first:** four later boards have nothing to show without it. Measured on the
standard night, every one of the 41 open movements has **at least six** eligible wards.

- [ ] **Step 1: Write the failing measurement test**

`tests/ward-scenarios.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { eligibility } from "@/components/ward-management/ward-eligibility";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { scenarioUnits } from "@/components/ward-management/ward-scenarios";

function eligibleCounts(scenario: "standard" | "scarce") {
  const units = scenarioUnits(scenario);
  return wardMovements
    .filter(isOpen)
    .map((movement) => units.filter((unit) => eligibility(movement, unit, NOW_ANCHOR).eligible).length);
}

describe("ward scenarios", () => {
  it("the standard night leaves every open movement several eligible wards", () => {
    const counts = eligibleCounts("standard");
    expect(counts.length).toBeGreaterThan(30);
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(5);
  });

  it("the scarce night exhausts the network for at least one open movement", () => {
    const counts = eligibleCounts("scarce");
    expect(counts.length).toBeGreaterThan(30);
    expect(Math.min(...counts)).toBe(0);
    expect(counts.filter((count) => count === 0).length).toBeGreaterThanOrEqual(1);
  });

  it("the scarce night is strictly tighter than the standard night, movement for movement", () => {
    const standard = eligibleCounts("standard");
    const scarce = eligibleCounts("scarce");
    expect(scarce.every((count, index) => count <= standard[index])).toBe(true);
    const scarceTotal = scarce.reduce((sum, count) => sum + count, 0);
    const standardTotal = standard.reduce((sum, count) => sum + count, 0);
    expect(scarceTotal).toBeLessThan(standardTotal / 2);
  });

  it("changes operational numbers only — never a patient attribute", () => {
    const standard = scenarioUnits("standard");
    const scarce = scenarioUnits("scarce");
    expect(scarce.map((unit) => unit.id)).toEqual(standard.map((unit) => unit.id));
    expect(scarce.map((unit) => unit.cohort)).toEqual(standard.map((unit) => unit.cohort));
    expect(scarce.map((unit) => unit.security)).toEqual(standard.map((unit) => unit.security));
    expect(scarce.map((unit) => unit.authorised)).toEqual(standard.map((unit) => unit.authorised));
    expect(scarce.map((unit) => unit.name)).toEqual(standard.map((unit) => unit.name));
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/ward-scenarios.test.ts`
Expected: FAIL — `ward-scenarios` does not exist.

- [ ] **Step 3: Write `ward-scenarios.ts`**

The tightening levers, read from `ward-eligibility.ts`, are exactly three: `allocatable.value`
(the `sex_mix` gate needs more than one free bed when there are no same-sex occupants),
`speciallingCapacity` (the `specialling` gate), and `sexMix`. **Cohort, security, authorisation
and identity must not move** — the fourth test pins that.

Start from this deterministic rule and **adjust the constants until the second and third tests
pass**. No `Math.random()`. Every unit keeps its identity:

```ts
import type { Unit } from "@/components/ward-management/ward-model";
import { allUnits } from "@/components/ward-management/ward-sites";

export type WardScenario = "standard" | "scarce";
export const WARD_SCENARIOS: readonly WardScenario[] = ["standard", "scarce"] as const;

export const scenarioLabels: Record<WardScenario, string> = {
  standard: "Standard night",
  scarce: "Scarce beds",
};

/**
 * The scarce night differs from the standard night in OPERATIONAL NUMBERS ONLY. It carries the
 * same units, the same patients and the same identities; what changes is how many beds a ward
 * can actually allocate and how much one-to-one observation it can staff. Nothing here is a
 * clinical, legal or patient-level difference, and nothing here may become one.
 */
export function scenarioUnits(scenario: WardScenario): Unit[] {
  const units = structuredClone(allUnits());
  if (scenario === "standard") return units;
  return units.map((unit, index) => ({
    ...unit,
    // Every third unit keeps a single allocatable bed; the rest have none. A single bed still
    // fails the sex_mix gate unless the ward already holds same-sex occupants, which is exactly
    // the squeeze a real scarce night produces.
    allocatable: { ...unit.allocatable, value: index % 3 === 0 ? 1 : 0 },
    speciallingCapacity: 0,
  }));
}
```

**Report the full eligible-ward distribution for both scenarios in your task report** — spec §4
item 2 makes that measurement the acceptance test, not a screenshot.

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run tests/ward-scenarios.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Add the `SET_SCENARIO` event**

In `ward-flow-events.ts`, add to the union and to `EVENT_ROLE`:

```ts
  | { type: "SET_SCENARIO"; role: WardFlowRole; now: Instant; scenario: WardScenario }
```

```ts
  SET_SCENARIO: "demo",
```

In `ward-flow-reducer.ts`: add `scenario: WardScenario` to `WardFlowState`; change
`seedWardFlowState()` to `seedWardFlowState(scenario: WardScenario = "standard")` returning
`{ ...state, scenario, units: scenarioUnits(scenario) }`; handle the event as
`case "SET_SCENARIO": return seedWardFlowState(event.scenario);`; add `"SET_SCENARIO"` to the
`subjectId` switch alongside `ADVANCE_CLOCK`/`RESET_SCENARIO`, returning `"none"`.

**`RESET_SCENARIO` keeps calling `seedWardFlowState()` with no argument, so reset always returns
to the standard night** (spec D3). Do not make reset scenario-sticky.

- [ ] **Step 6: Add reducer tests**

Add to `tests/ward-flow-reducer.test.ts`: `SET_SCENARIO` to `"scarce"` replaces the units and
leaves movement ids unchanged; `SET_SCENARIO` raised by role `"ward"` is refused with a
`Rejection`; `RESET_SCENARIO` after `SET_SCENARIO` returns `state.scenario === "standard"`.

- [ ] **Step 7: Add the scenario switch to the demo menu**

`ward-demo-controls.tsx` already carries the `demo` role, an `aria-label` naming it "not a
clinical action", and a notice sentence before any reachable button. Add one button per entry in
`WARD_SCENARIOS`, labelled from `scenarioLabels`, dispatching `SET_SCENARIO`. Mark the active one
with `aria-pressed`. **Do not put a scenario control on any clinical screen.**

- [ ] **Step 8: Run the ward unit suites, then commit**

Run: `npx vitest run tests/ward-*.test.ts tests/ward-*.dom.test.tsx`
Report the file and test counts. Then:

```bash
git add src/components/ward-management tests/ward-scenarios.test.ts tests/ward-flow-reducer.test.ts
git commit -m "Ward Flow: a scarce-beds scenario, so the escalation surfaces have something to show"
```

---

## Task 2: Urgency and legal status can change (spec item 3)

**Files:**

- Create: `src/components/ward-management/ward-change-reasons.ts`
- Modify: `ward-model.ts`, `ward-flow-events.ts`, `ward-flow-reducer.ts`
- Modify: `src/components/ward-management/coordinator/shortlist-panel.tsx`, `ed/ed-screen.tsx`
- Test: `tests/ward-flow-reducer.test.ts`, `tests/ward-change-reasons.test.ts` (new)

**Interfaces:**

- Consumes: `Movement.urgency`, `Movement.legalStatus`, `Movement.statusChanges`, `StatusChange`
  (`{ at; from; to; by }`), `EVENT_ROLE`, `reject()`.
- Produces:
  - `export const URGENCY_CHANGE_REASONS = ["reassessed", "new_information", "correcting_an_error"] as const;`
  - `export const LEGAL_STATUS_CHANGE_REASONS = ["recorded_by_treating_team", "correcting_an_error"] as const;`
  - `Movement.urgencyChanges: UrgencyChange[]` where
    `UrgencyChange = { at: Instant; from: 1 | 2 | 3; to: 1 | 2 | 3; by: string; reason: UrgencyChangeReason }`
  - `StatusChange` gains `reason: LegalStatusChangeReason`.
  - Events `CHANGE_URGENCY` and `CHANGE_LEGAL_STATUS`.
  - **`EVENT_ROLE` becomes `Record<WardFlowEvent["type"], readonly WardFlowRole[]>`** — see step 3.

**The structural change this task carries.** `EVENT_ROLE` is today
`Record<WardFlowEvent["type"], WardFlowRole>` — exactly one role per event — and the reducer gate
is `if (requiredRole !== event.role)`. Spec D2 requires **two** roles for both new events, and
Task 3 requires two for its events as well. **Widen the table to arrays in this task.** Do not
special-case the new events past a single-role table; do not pick one role and quietly drop the
other.

- [ ] **Step 1: Write the failing reducer tests**

Add to `tests/ward-flow-reducer.test.ts`:

```ts
it("records an urgency change with who made it, from both permitted roles", () => {
  const seeded = seedWardFlowState();
  const movement = seeded.movements.find((candidate) => candidate.urgency !== 1)!;
  const after = wardFlowReducer(seeded, {
    type: "CHANGE_URGENCY",
    role: "coordinator",
    now: NOW_ANCHOR,
    movementId: movement.id,
    urgency: 1,
    reason: "reassessed",
  });
  const updated = after.movements.find((candidate) => candidate.id === movement.id)!;
  expect(updated.urgency).toBe(1);
  expect(updated.urgencyChanges).toHaveLength(1);
  expect(updated.urgencyChanges[0]).toMatchObject({
    from: movement.urgency,
    to: 1,
    by: "coordinator",
    reason: "reassessed",
  });
  expect(after.rejections).toHaveLength(0);

  const fromEd = wardFlowReducer(seeded, {
    type: "CHANGE_URGENCY",
    role: "ed",
    now: NOW_ANCHOR,
    movementId: movement.id,
    urgency: 1,
    reason: "reassessed",
  });
  expect(fromEd.rejections).toHaveLength(0);
});

it("refuses an urgency change from a role that may not make one", () => {
  const seeded = seedWardFlowState();
  const movement = seeded.movements[0];
  const after = wardFlowReducer(seeded, {
    type: "CHANGE_URGENCY",
    role: "officer",
    now: NOW_ANCHOR,
    movementId: movement.id,
    urgency: 1,
    reason: "reassessed",
  });
  expect(after.rejections).toHaveLength(1);
  expect(after.movements.find((candidate) => candidate.id === movement.id)!.urgency).toBe(movement.urgency);
});

it("records a legal status change and never re-sorts or un-accepts the patient", () => {
  const seeded = seedWardFlowState();
  const movement = seeded.movements.find(
    (candidate) => candidate.legalStatus === "Voluntary" && candidate.acceptedUnitId !== undefined,
  )!;
  const after = wardFlowReducer(seeded, {
    type: "CHANGE_LEGAL_STATUS",
    role: "ed",
    now: NOW_ANCHOR,
    movementId: movement.id,
    legalStatus: "Involuntary inpatient",
    reason: "recorded_by_treating_team",
  });
  const updated = after.movements.find((candidate) => candidate.id === movement.id)!;
  expect(updated.legalStatus).toBe("Involuntary inpatient");
  expect(updated.statusChanges).toHaveLength(1);
  expect(updated.statusChanges[0]).toMatchObject({ from: "Voluntary", to: "Involuntary inpatient", by: "ed" });
  // Nothing auto-allocates: the accepted unit, the stage and the referrals are untouched.
  expect(updated.acceptedUnitId).toBe(movement.acceptedUnitId);
  expect(updated.stage).toBe(movement.stage);
  expect(updated.referredUnitIds).toEqual(movement.referredUnitIds);
});

it("refuses both changes on a closed movement, naming the closure reason", () => {
  const seeded = seedWardFlowState();
  const movement = seeded.movements[0];
  const closed = {
    ...seeded,
    movements: seeded.movements.map((candidate) =>
      candidate.id === movement.id
        ? { ...candidate, closure: { at: NOW_ANCHOR, outcome: "arrived" as const, reason: "arrived at unit" } }
        : candidate,
    ),
  };
  const after = wardFlowReducer(closed, {
    type: "CHANGE_URGENCY",
    role: "coordinator",
    now: NOW_ANCHOR,
    movementId: movement.id,
    urgency: 1,
    reason: "reassessed",
  });
  expect(after.rejections).toHaveLength(1);
  expect(after.rejections[0].reason).toContain("arrived at unit");
});
```

If a fixture movement matching a test's precondition does not exist, **say so in your report and
construct the precondition explicitly from `seedWardFlowState()`** rather than deleting the test.

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run tests/ward-flow-reducer.test.ts`
Expected: FAIL — `CHANGE_URGENCY` is not a known event type.

- [ ] **Step 3: Widen the role table**

In `ward-flow-events.ts`:

```ts
export const EVENT_ROLE: Record<WardFlowEvent["type"], readonly WardFlowRole[]> = {
  RAISE_REFERRAL: ["ed"],
  RECORD_EXAMINATION: ["ed"],
  REFER_TO_UNITS: ["coordinator"],
  ACCEPT_IN_PRINCIPLE: ["ward"],
  HOLD_BED: ["ward"],
  DECLINE: ["ward"],
  HANDOVER_READY: ["ed"],
  TRANSPORT_ACCEPTED: ["officer"],
  TRANSPORT_EN_ROUTE: ["officer"],
  PATIENT_COLLECTED: ["officer"],
  PATIENT_ARRIVED: ["officer"],
  CONFIRM_CAPACITY: ["ward"],
  RECORD_ESCALATION: ["coordinator"],
  ADVANCE_CLOCK: ["demo"],
  RESET_SCENARIO: ["demo"],
  SET_SCENARIO: ["demo"],
  CHANGE_URGENCY: ["coordinator", "ed"],
  CHANGE_LEGAL_STATUS: ["coordinator", "ed"],
};
```

In `ward-flow-reducer.ts`, replace the gate:

```ts
const permittedRoles = EVENT_ROLE[event.type];
if (!permittedRoles.includes(event.role)) {
  return reject(
    state,
    event,
    `${event.type} requires role ${permittedRoles.join(" or ")}, but was raised by role ${event.role}`,
  );
}
```

**Every existing role-refusal test must still pass unchanged in behaviour.** If a test asserts the
exact refusal string, update it to the new wording and say so in your report — that is a message
change, not a weakened assertion.

- [ ] **Step 4: Add the reason lists**

`src/components/ward-management/ward-change-reasons.ts`:

```ts
/**
 * Fixed reason lists. Chosen, never typed — the same treatment `DECLINE_REASONS` already has,
 * and for the same reason: the synthetic-data promise must be true by construction rather than
 * by a user reading a label and complying.
 *
 * These are deliberately operational and content-free. NONE of them describes a patient, a
 * diagnosis, a clinical judgement or a legal requirement. A reason reading "patient
 * deteriorated" would be narrative clinical content; one reading "order made" would be a claim
 * about the Mental Health Act. Both are forbidden. If richer reasons are wanted they come from
 * the product owner; no agent adds one.
 */
export const URGENCY_CHANGE_REASONS = ["reassessed", "new_information", "correcting_an_error"] as const;
export type UrgencyChangeReason = (typeof URGENCY_CHANGE_REASONS)[number];

export const LEGAL_STATUS_CHANGE_REASONS = ["recorded_by_treating_team", "correcting_an_error"] as const;
export type LegalStatusChangeReason = (typeof LEGAL_STATUS_CHANGE_REASONS)[number];

export const changeReasonLabels: Record<UrgencyChangeReason | LegalStatusChangeReason, string> = {
  reassessed: "Reassessed",
  new_information: "New information",
  correcting_an_error: "Correcting an error",
  recorded_by_treating_team: "Recorded by treating team",
};
```

- [ ] **Step 5: Add the model fields and the two handlers**

`ward-model.ts`: add `reason: LegalStatusChangeReason` to `StatusChange`; add the `UrgencyChange`
type and `urgencyChanges: UrgencyChange[]` to `Movement`. Seed `urgencyChanges: []` everywhere
`statusChanges: []` is seeded, in `ward-movements.ts` and in the reducer's `RAISE_REFERRAL`.

`ward-flow-reducer.ts`: both handlers reject a closed movement (naming `movement.closure.reason`),
reject an unknown movement id, and otherwise append the change record and set the new value.
`by: event.role`. Neither handler may touch `stage`, `acceptedUnitId`, `referredUnitIds`,
`declines`, `transport`, `legalForm` or `bedHeldUntil`.

- [ ] **Step 6: Run and watch them pass**

Run: `npx vitest run tests/ward-flow-reducer.test.ts`
Expected: PASS. Report the count.

- [ ] **Step 7: Surface the lawfulness exception**

A legal status change can make an already-accepted destination unlawful. Add a derivation to
`ward-derivations.ts`:

```ts
/**
 * A movement whose CURRENT legal status requires an authorised destination, but whose already
 * accepted unit is not authorised. This is a real situation created by a mid-flight status
 * change, and it is surfaced as an exception for a human to resolve. It NEVER re-sorts,
 * re-suggests or un-accepts the patient: nothing in this prototype auto-allocates, and that
 * rule does not bend because the trigger was a status change.
 */
export function destinationNoLongerLawful(movement: Movement, units: Unit[]): Unit | undefined {
  if (!isOpen(movement)) return undefined;
  if (!requiresAuthorisedDestination(movement.legalStatus)) return undefined;
  if (movement.acceptedUnitId === undefined) return undefined;
  const unit = units.find((candidate) => candidate.id === movement.acceptedUnitId);
  if (unit === undefined) return undefined;
  return unit.authorised ? undefined : unit;
}
```

Add an `InboxItem` for it in `buildActionInbox` with tone `"danger"`, so it reaches the
coordinator's existing exceptions band. Test it in `tests/ward-derivations.test.ts` — a movement
with an unauthorised accepted unit and a status requiring authorisation returns the unit; the same
movement Voluntary returns `undefined`; a closed movement returns `undefined`.

- [ ] **Step 8: Add the two controls**

On the coordinator's `shortlist-panel.tsx` and the ED screen (`ed-screen.tsx`): an urgency picker
(tiers 1–3) and a legal-status picker (the four existing statuses), each with a **required reason
`<select>`** from the lists in step 4, submitting a form. Follow the existing legal-status select
in `ed-screen.tsx` exactly rather than inventing a control pattern; every `<select>` needs a real
associated `<label>`. Test-ids: `ward-change-urgency`, `ward-change-legal-status`.

- [ ] **Step 9: Run the ward suites and commit**

Run: `npx vitest run tests/ward-*.test.ts tests/ward-*.dom.test.tsx`

```bash
git add src/components/ward-management tests
git commit -m "Ward Flow: urgency and legal status can change mid-flight, each change recorded"
```

---

## Task 3: Release a hold, cancel a transport (spec item 10)

**Files:**

- Modify: `ward-model.ts`, `ward-flow-events.ts`, `ward-flow-reducer.ts`, `ward-change-reasons.ts`
- Modify: `src/components/ward-management/coordinator/shortlist-panel.tsx`, `ward/ward-screen.tsx`
- Test: `tests/ward-flow-reducer.test.ts`

**Interfaces:**

- Consumes: the widened `EVENT_ROLE` from Task 2; `Movement.bedHeldUntil`,
  `Movement.acceptedUnitId`, `Movement.transport`, `TransportJob.cancelledAt`; the
  `CONFIRM_CAPACITY` `actingUnitId` precedent.
- Produces:
  - `RELEASE_HOLD_REASONS`, `CANCEL_TRANSPORT_REASONS` in `ward-change-reasons.ts`.
  - Events `RELEASE_HOLD` and `CANCEL_TRANSPORT`, both `["coordinator", "ward"]`, both carrying
    `actingUnitId?: string`.
  - `Movement.unwinds: UnwindRecord[]` where
    `UnwindRecord = { at: Instant; kind: "hold_released" | "transport_cancelled"; by: string; reason: string }`.

**Why this matters.** Measured: the **only** path that releases a held bed today is closing the
movement by recording an examination with outcome `community_order` or `revoked` — so a
coordinator who holds the wrong bed must declare the patient does not need admission. Seven beds
are held, one hold has already expired and six expire within the hour, and nobody can act on any
of them.

- [ ] **Step 1: Add the reason lists**

Append to `ward-change-reasons.ts`, extending `changeReasonLabels` to cover every new entry:

```ts
export const RELEASE_HOLD_REASONS = [
  "patient_no_longer_coming",
  "bed_needed_for_another_patient",
  "ward_withdrew_the_bed",
  "hold_made_in_error",
] as const;
export type ReleaseHoldReason = (typeof RELEASE_HOLD_REASONS)[number];

export const CANCEL_TRANSPORT_REASONS = [
  "provider_unavailable",
  "patient_not_ready",
  "destination_changed",
  "job_created_in_error",
] as const;
export type CancelTransportReason = (typeof CANCEL_TRANSPORT_REASONS)[number];
```

- [ ] **Step 2: Write the failing tests**

Add to `tests/ward-flow-reducer.test.ts`. The four behaviours that must hold:

```ts
it("releases a held bed back to allocatable and returns the movement to accepted_awaiting_bed", () => {
  const seeded = seedWardFlowState();
  const movement = seeded.movements.find((candidate) => candidate.stage === "bed_held")!;
  const unitBefore = seeded.units.find((candidate) => candidate.id === movement.acceptedUnitId)!;
  const after = wardFlowReducer(seeded, {
    type: "RELEASE_HOLD",
    role: "coordinator",
    now: NOW_ANCHOR,
    movementId: movement.id,
    reason: "hold_made_in_error",
  });
  const updated = after.movements.find((candidate) => candidate.id === movement.id)!;
  const unitAfter = after.units.find((candidate) => candidate.id === movement.acceptedUnitId)!;
  expect(updated.stage).toBe("accepted_awaiting_bed");
  expect(updated.bedHeldUntil).toBeUndefined();
  expect(unitAfter.allocatable.value).toBe(unitBefore.allocatable.value + 1);
  // The movement survives, keeps its acceptance, and is not re-referred anywhere.
  expect(updated.closure).toBeUndefined();
  expect(updated.acceptedUnitId).toBe(movement.acceptedUnitId);
  expect(updated.legalForm).toEqual(movement.legalForm);
  expect(updated.unwinds.at(-1)).toMatchObject({ kind: "hold_released", by: "coordinator" });
});

it("refuses a release once the patient is handover_ready or moving", () => {
  const seeded = seedWardFlowState();
  const movement = seeded.movements.find((candidate) => candidate.stage === "moving")!;
  const after = wardFlowReducer(seeded, {
    type: "RELEASE_HOLD",
    role: "coordinator",
    now: NOW_ANCHOR,
    movementId: movement.id,
    reason: "hold_made_in_error",
  });
  expect(after.rejections).toHaveLength(1);
  expect(after.movements.find((candidate) => candidate.id === movement.id)!.stage).toBe("moving");
});

it("refuses a ward caller acting as a unit that is not holding the bed, naming both ids", () => {
  const seeded = seedWardFlowState();
  const movement = seeded.movements.find((candidate) => candidate.stage === "bed_held")!;
  const otherUnit = seeded.units.find((candidate) => candidate.id !== movement.acceptedUnitId)!;
  const after = wardFlowReducer(seeded, {
    type: "RELEASE_HOLD",
    role: "ward",
    now: NOW_ANCHOR,
    movementId: movement.id,
    actingUnitId: otherUnit.id,
    reason: "ward_withdrew_the_bed",
  });
  expect(after.rejections).toHaveLength(1);
  expect(after.rejections[0].reason).toContain(otherUnit.id);
  expect(after.rejections[0].reason).toContain(movement.acceptedUnitId!);
});

it("cancels a transport job without closing the movement", () => {
  const seeded = seedWardFlowState();
  const movement = seeded.movements.find(
    (candidate) => candidate.transport !== undefined && candidate.transport.cancelledAt === undefined,
  )!;
  const after = wardFlowReducer(seeded, {
    type: "CANCEL_TRANSPORT",
    role: "coordinator",
    now: NOW_ANCHOR,
    movementId: movement.id,
    reason: "provider_unavailable",
  });
  const updated = after.movements.find((candidate) => candidate.id === movement.id)!;
  expect(updated.transport?.cancelledAt).toBe(NOW_ANCHOR);
  expect(updated.closure).toBeUndefined();
  expect(updated.stage).toBe("handover_ready");
  expect(updated.unwinds.at(-1)).toMatchObject({ kind: "transport_cancelled" });
});
```

- [ ] **Step 3: Run and watch them fail**

Run: `npx vitest run tests/ward-flow-reducer.test.ts`
Expected: FAIL — unknown event types.

- [ ] **Step 4: Implement both handlers**

`RELEASE_HOLD`: reject a closed movement (naming the closure reason); reject unless
`movement.stage === "bed_held"`; when `event.role === "ward"`, reject unless
`event.actingUnitId === movement.acceptedUnitId`, naming both ids. On success: return the bed
(`allocatable.value + 1`, `confirmedAt: event.now`), clear `bedHeldUntil`, set stage to
`accepted_awaiting_bed`, append the unwind record. **Do not** close the movement, clear
`legalForm`, or alter `referredUnitIds`.

`CANCEL_TRANSPORT`: reject a closed movement; reject when there is no transport job, when it is
already cancelled, or when `movement.transport.arrivedAt` is set; same acting-unit rule for a ward
caller. On success: set `cancelledAt`, set stage to `handover_ready`, append the unwind record.

Carry this comment on `actingUnitId`, matching the `CONFIRM_CAPACITY` precedent:

```ts
/**
 * The unit the caller stated it was acting as. Required for a `ward` caller, unused for a
 * `coordinator` caller. This records the caller's CLAIM about itself and does not prove it:
 * nothing here authenticates anything, and this model has no identity model. The comparison
 * constrains future callers rather than this one.
 */
```

- [ ] **Step 5: Run and watch them pass**

Run: `npx vitest run tests/ward-flow-reducer.test.ts`. Report the count.

- [ ] **Step 6: Add the controls**

Coordinator (`shortlist-panel.tsx`) and ward screen (`ward-screen.tsx`): "Release the held bed"
and "Cancel transport", each opening a form with a required reason `<select>`. The ward screen
passes its own route `unitId` as `actingUnitId`. Each control renders **only when the reducer
would accept it** — stage `bed_held` for release, a live transport job for cancel — rather than
dispatching optimistically and letting the reducer refuse silently. Test-ids:
`ward-release-hold`, `ward-cancel-transport`.

- [ ] **Step 7: Run the ward suites and commit**

```bash
git add src/components/ward-management tests
git commit -m "Ward Flow: a held bed can be released and a transport cancelled without closing the patient"
```

---

## Task 4: Shift handover (spec item 1)

**Files:**

- Create: `src/components/ward-management/handover/handover-page.tsx`, `handover.module.css`
- Create: `src/app/ward-management/handover/page.tsx`
- Modify: `ward-derivations.ts` (`handoverSnapshot`), the left rail
  (`ward-management-navigation.tsx` / `ClinicalRail`), `tests/route-reachability.test.ts`
- Test: `tests/ward-handover.test.ts`, `tests/ward-handover.dom.test.tsx` (both new)

**Interfaces:**

- Consumes: `isOpen`, `elapsedLabel`, `transportLeg`, `destinationUnit`, `stageCopy`,
  `eligibleCandidatesAmong` from `ward-derivations.ts`; `Movement.bedHeldUntil`,
  `Movement.escalation`, `Movement.declines`, `Movement.referredUnitIds`.
- Produces:

  ```ts
  export type HandoverSnapshot = {
    frozenAt: Instant;
    longestWaits: { movement: Movement; unit: Unit | undefined }[];
    heldBeds: { movement: Movement; unit: Unit | undefined; expired: boolean }[];
    inTransit: { movement: Movement; leg: TransportLeg | "Cancelled" | undefined }[];
    placementGoneWrong: { movement: Movement; kind: "escalated" | "declined_by_all" }[];
  };
  export function handoverSnapshot(movements: Movement[], units: Unit[], now: Instant): HandoverSnapshot;
  ```

- [ ] **Step 1: Write the failing derivation test**

`tests/ward-handover.test.ts` — assert, against `seedWardFlowState()` at `NOW_ANCHOR`:

- `longestWaits` contains every open movement, in strictly non-increasing wait order, and its
  first entry's wait is the maximum across open movements.
- `heldBeds` contains exactly the open movements with a `bedHeldUntil`, and `expired` is true
  exactly when `bedHeldUntil <= now`.
- `inTransit` contains exactly the open movements with a transport job, each with its `leg`.
- `placementGoneWrong` contains movements with an `escalation` (`kind: "escalated"`) and
  movements with at least one referral where every referred unit has declined
  (`kind: "declined_by_all"`), with no movement appearing twice.
- `frozenAt` equals the `now` passed in.
- **A non-vacuity floor:** `longestWaits.length` is greater than 30, so the test fails if the
  fixture stops producing open movements.

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run tests/ward-handover.test.ts` — FAIL, `handoverSnapshot` not exported.

- [ ] **Step 3: Implement `handoverSnapshot`**

Pure, no wall-clock read, `now` passed in. Sort by `now - movement.openedAt` descending.

- [ ] **Step 4: Run and watch it pass**

- [ ] **Step 5: Build the page**

`handover-page.tsx` is a client component that calls `handoverSnapshot` **once, in a `useState`
initialiser**, so the page is frozen at open and does not re-derive on the 30-second clock tick.
Render the freeze time. Four sections in this order, each with a heading and each rendering an
explicit "None" line when empty:

1. `ward-handover-longest-waits` — rank, id, wait, stage, department, destination or "No
   destination chosen".
2. `ward-handover-held-beds` — id, unit, "Expired" or "Expires in …".
3. `ward-handover-in-transit` — id, unit, leg.
4. `ward-handover-placement-gone-wrong` — id, wait, and which kind.

Root test-id `ward-handover-page`, freeze time `ward-handover-frozen-at`. Print styles live in
`handover.module.css` using design tokens only. Add a "Print" button calling `window.print()`.

**No section may invent a threshold, a deadline, or a legal claim.** Section 1 has no threshold by
design: 0 of 41 open movements are past the 24-hour departmental access target, so a breach-led
handover would be blank.

- [ ] **Step 6: Wire the route and prove it is reachable**

`src/app/ward-management/handover/page.tsx` renders the component with `metadata`. Add the
left-rail entry, run `npm run docs:update`, add the `docs/codebase-index.md` entry, and add the
assertion to `tests/route-reachability.test.ts`.

- [ ] **Step 7: DOM test**

`tests/ward-handover.dom.test.tsx`: renders inside `WardFlowProvider` with a fixed `initialNow`;
asserts all four sections present; asserts the frozen time does **not** change after dispatching
`ADVANCE_CLOCK`; asserts an empty section renders its explicit "None" line.

- [ ] **Step 8: Run the ward suites and commit**

```bash
git add src tests docs
git commit -m "Ward Flow: the shift handover, frozen when opened and printable"
```

---

## Task 5: Escalation board (spec item 4)

**Files:**

- Create: `src/components/ward-management/escalation/escalation-board.tsx`, `escalation.module.css`
- Create: `src/app/ward-management/escalation/page.tsx`
- Modify: `ward-derivations.ts` (`escalationBoard`), left rail, `tests/route-reachability.test.ts`
- Test: `tests/ward-escalation.test.ts`, `tests/ward-escalation.dom.test.tsx` (both new)

**Interfaces:**

- Consumes: `isOpen`, `elapsedLabel`, `eligibleCandidatesAmong(movement, units, now, limit)`,
  `Movement.escalation`.
- Produces:

  ```ts
  export type EscalationBoard = {
    escalated: { movement: Movement; triedUnits: Unit[] }[];
    nowhereEligible: Movement[];
  };
  export function escalationBoard(movements: Movement[], units: Unit[], now: Instant): EscalationBoard;
  ```

- [ ] **Step 1: Write the failing test**

`tests/ward-escalation.test.ts`: on the **standard** night `nowhereEligible` is empty and
`escalated` has exactly the movements carrying an escalation; on the **scarce** night (units from
`scenarioUnits("scarce")`) `nowhereEligible` is non-empty. Both assertions matter — the first is
the honest empty state, the second proves the board works. Use a large `limit` when calling
`eligibleCandidatesAmong` so the count is real rather than capped at its default of 3.

- [ ] **Step 2: Run and watch it fail.** `npx vitest run tests/ward-escalation.test.ts`

- [ ] **Step 3: Implement `escalationBoard`.** Closed movements are excluded from both groups.

- [ ] **Step 4: Run and watch it pass.**

- [ ] **Step 5: Build the board**

Two sections: `ward-escalation-escalated` (when, units tried, contact, wait) and
`ward-escalation-nowhere-eligible` (id, wait, stage, department). Both **read-only**. Each renders
an explicit "None" line when empty.

**It records and shows. It suggests nothing.** No "least-bad options", no ranking of wards the
patient does not fit, no statement of what would need to change. If you find yourself computing a
near-miss, stop — that is item 4's explicit prohibition.

- [ ] **Step 6: Route, left rail, reachability assertion, `npm run docs:update`.**

- [ ] **Step 7: DOM test, then commit**

```bash
git add src tests docs
git commit -m "Ward Flow: the escalation board — records and shows, suggests nothing"
```

---

## Task 6: The last free-text box becomes a fixed list (spec item 11)

**Files:**

- Modify: `ward-change-reasons.ts` (the contact list), `coordinator/shortlist-panel.tsx`
- Test: `tests/ward-shortlist.dom.test.tsx` (or the existing shortlist DOM test file)

**Interfaces:**

- Produces:

  ```ts
  export const ESCALATION_CONTACTS = [
    "State bed coordination desk",
    "Duty psychiatrist",
    "Bed management",
    "Nurse unit manager (destination ward)",
    "Escort or transport provider",
    "Other service",
  ] as const;
  export type EscalationContact = (typeof ESCALATION_CONTACTS)[number];
  ```

- [ ] **Step 1: Write the failing DOM test**

Assert that the escalation form renders a `<select>` (or radio group) whose options are exactly
`ESCALATION_CONTACTS`, and that **no `<textarea>` and no free-text `<input>` exists anywhere in the
escalation form**. Assert the dispatched `RECORD_ESCALATION` carries one of the listed values.

- [ ] **Step 2: Run and watch it fail.**

- [ ] **Step 3: Replace the `<textarea>`**

`shortlist-panel.tsx` currently renders a `<textarea id="ward-shortlist-escalation-contact">` whose
label reads "Role or service being contacted next — a role or service only, never a person's name
(synthetic data only)". Replace it with a picker over `ESCALATION_CONTACTS`, keeping the label
text's meaning and the existing test-id. Delete the `escalationContact` free-text state.

**Why this matters more than its size:** the synthetic-data promise currently depends on a user
reading a label and complying. After this it is true by construction.

**Migration check:** the one authored escalation in `ward-movements.ts` uses "State bed
coordination desk", which is on the list. Confirm by reading it back; if any other authored value
exists, report it rather than silently mapping it.

- [ ] **Step 4: Run and watch it pass. Then grep the whole ward tree for any remaining free-text
      input and report the result:**

Run: `grep -rn "<textarea" src/components/ward-management/`
Expected: no matches. Quote the output either way.

- [ ] **Step 5: Commit**

```bash
git add src/components/ward-management tests
git commit -m "Ward Flow: the escalation contact becomes a fixed list, so synthetic-only is true by construction"
```

---

## Task 7: Patient search (spec item 5)

**Files:**

- Create: `src/components/ward-management/search/patient-search.tsx`, `search.module.css`
- Create: `src/app/ward-management/search/page.tsx`
- Modify: `ward-derivations.ts` (`searchMovements`), left rail, `tests/route-reachability.test.ts`
- Test: `tests/ward-patient-search.test.ts`, `tests/ward-patient-search.dom.test.tsx`

**Interfaces:**

- Produces:

  ```ts
  export type MovementSearchQuery = {
    text: string;
    stage?: MovementStage;
    edId?: string;
  };
  export function searchMovements(movements: Movement[], units: Unit[], query: MovementSearchQuery): Movement[];
  ```

- [ ] **Step 1: Write the failing test.** `searchMovements` matches on movement id, `originEdId`,
      destination unit id and name, `stage`, and `owner`; is case-insensitive; returns everything
      for an empty query; and **never returns a closed movement**.

- [ ] **Step 2: Run and watch it fail.**

- [ ] **Step 3: Implement it.** Pure, no wall-clock read.

- [ ] **Step 4: Run and watch it pass.**

- [ ] **Step 5: Build the page.** One search field plus a stage `<select>` and a department
      `<select>`, each with a real `<label>`. Results table: identifier, stage, department,
      destination, time since arrival, and a `<Link>` to
      `/ward-management/patients/[patientId]`. **One search composer per page** — the page owns its
      composer and must not also mount the shell's; read `docs/search-chrome-behaviour.md` before
      placing it. Render "No matches" explicitly rather than an empty table. Root test-id
      `ward-patient-search`.

- [ ] **Step 6: Route, left rail, reachability assertion, `npm run docs:update`, DOM test, commit.**

```bash
git add src tests docs
git commit -m "Ward Flow: patient search, on its own page"
```

---

## Task 8: Capacity board extensions (spec item 6)

**Files:**

- Modify: `src/components/ward-management/ward-management-modes.tsx` (`CapacityView`),
  `ward-management.module.css`
- Test: `tests/ward-capacity-view.dom.test.tsx` (new, or the existing modes DOM test)

- [ ] **Step 1: Write the failing DOM test.** For each unit row the capacity table renders the
      unit's current sex mix (both counts), its `speciallingCapacity`, and its authorisation state.
      Pick one unit with `authorised: false` and assert its row says so; pick one with
      `authorised: true` and assert it does not carry the not-authorised wording.

- [ ] **Step 2: Run and watch it fail.**

- [ ] **Step 3: Add three columns to the existing table** — "Sex mix", "Specialling", "MHA
      authorised". All three values already exist on `Unit` and already gate placement in
      `ward-eligibility.ts`; they are simply invisible on the board whose job is capacity. **The
      authorisation flag is a property the model already carries about a unit.** Rendering it is not
      a legal claim and must not be dressed as one. Do not explain what authorisation requires or
      means.

- [ ] **Step 4: Run and watch it pass. Commit.**

```bash
git add src/components/ward-management tests
git commit -m "Ward Flow: the capacity board shows the three things that actually decide placement"
```

---

## Task 9: Governance extensions (spec item 7)

**Files:**

- Modify: `ward-management-modes.tsx` (`GovernanceView`), `ward-derivations.ts`
- Test: `tests/ward-governance.test.ts`, `tests/ward-governance.dom.test.tsx`

**Interfaces:**

- Consumes: `Movement.urgencyChanges`, `Movement.statusChanges`, `Movement.unwinds` from Tasks 2
  and 3; `Movement.declines`, `Movement.referredUnitIds`, `Movement.withdrawnReferrals`.
- Produces:

  ```ts
  export type ChangeAuditEntry = {
    at: Instant;
    movementId: string;
    kind: "urgency" | "legal_status" | "hold_released" | "transport_cancelled";
    by: string;
    detail: string;
  };
  export function changeAudit(movements: Movement[]): ChangeAuditEntry[]; // newest first
  export function effectivenessNumbers(movements: Movement[]): {
    medianMinutesToAcceptance: number | undefined;
    averageUnitsContacted: number | undefined;
  };
  ```

- [ ] **Step 1: Write the failing tests.** `changeAudit` returns one entry per recorded change
      across all four kinds, newest first. `effectivenessNumbers` returns `undefined` for a measure
      it cannot compute rather than `0` — **conservative failure, rule 4** — and computes the median
      over movements that reached acceptance and the average units contacted over movements with at
      least one referral.

- [ ] **Step 2: Run and watch them fail.**

- [ ] **Step 3: Implement both derivations.** Pure.

- [ ] **Step 4: Run and watch them pass.**

- [ ] **Step 5: Extend `GovernanceView`** with three additions: the **not-a-medical-device**
      statement, reusing the exact wording from `coordinator-screen.tsx`; the **change audit**,
      newest first and with an explicit empty state; and the **two effectiveness numbers**, each
      rendering an explicit absence when `undefined`. **The third success measure is dropped and the
      page says so.** The binding spec §11 lists "legal deadlines passed while a patient waits" as
      one of three measures; it no longer exists and cannot be computed. Record the drop rather than
      silently omitting it. **Neither number may be presented as evidence the prototype works.** They
      describe the synthetic scenario, and the page must say so.

- [ ] **Step 6: DOM test, then commit.**

```bash
git add src/components/ward-management tests
git commit -m "Ward Flow: governance carries the change audit and two honest effectiveness numbers"
```

---

## Task 10: Patient page extensions (spec item 8)

**Files:**

- Modify: `src/components/ward-management/ward-management-console.tsx` (`WardPatientWorkspace`)
- Test: `tests/ward-patient-page.dom.test.tsx`

- [ ] **Step 1: Write the failing DOM test.** For a patient with declines, the page lists each
      decline's unit, fixed reason and time. For a patient with status or urgency changes, it lists
      each. For a patient with an escalation, it shows when, units tried, and contact. For a patient
      with none of these, each section renders its own explicit absence line — **not** a hidden
      section.

- [ ] **Step 2: Run and watch it fail.**

- [ ] **Step 3: Add the three sections.** Test-ids `ward-patient-declines`,
      `ward-patient-changes`, `ward-patient-escalation`. Reuse `changeReasonLabels` for reason
      display; never render a raw snake-case reason code to a user.

- [ ] **Step 4: Run and watch it pass. Commit.**

```bash
git add src/components/ward-management tests
git commit -m "Ward Flow: the patient page carries declines, changes and the escalation record"
```

---

## Task 11: Bed release flagging (spec item 9)

**Files:**

- Modify: `ward-model.ts` (`BedRelease`), `ward-flow-events.ts`, `ward-flow-reducer.ts`,
  `ward-derivations.ts` (`unitCapacity`), `ward/ward-screen.tsx`
- Test: `tests/ward-flow-reducer.test.ts`, `tests/ward-bed-release.dom.test.tsx`

**Interfaces:**

- Consumes: the existing `BedRelease` type and the `bedReleases` fixture, which
  `unitCapacity` already reads for its `potential` figure; the widened `EVENT_ROLE`.
- Produces: event
  `{ type: "FLAG_BED_RELEASE"; role; now; unitId; actingUnitId; confidence: "confirmed" | "likely" | "possible"; blocker: BedReleaseBlocker }`,
  `EVENT_ROLE.FLAG_BED_RELEASE = ["ward"]`, and `WardFlowState.bedReleases: BedRelease[]`.

**Why this exists.** Bed releases are static fixture data feeding the _potential_ capacity figure;
**no ward can flag one**. This was named as part of Phase 3 and did not get built.

- [ ] **Step 1: Move `bedReleases` into reducer state.** `seedWardFlowState` seeds
      `structuredClone(bedReleases)`; `unitCapacity` takes the releases as a parameter rather than
      importing the module constant, so a flagged release actually moves the number. Update every
      existing `unitCapacity` call site and report how many there were.

- [ ] **Step 2: Write the failing tests.** `FLAG_BED_RELEASE` appends a release for the acting
      unit and increases that unit's `potential` by one; a ward acting as a different unit is
      refused, naming both ids; a `coordinator` caller is refused.

- [ ] **Step 3: Run and watch them fail.**

- [ ] **Step 4: Implement it.** The blocker is a **fixed list**, not free text — add
      `BED_RELEASE_BLOCKERS` to `ward-change-reasons.ts` drawn from the blocker wording the fixture
      already uses (for example "awaiting clean", "awaiting pharmacy", "awaiting transport"). Do
      not invent a blocker that describes a person. **A bed release carries nothing whatsoever about
      the departing patient.** It has no identifier, identifying timing, or reason relating to that
      person. That privacy rule comes from binding spec §4 and is not negotiable. Add a test that
      asserts the `BedRelease` type has no field capable of carrying a patient reference, and say
      plainly in your report how you proved it.

- [ ] **Step 5: Run and watch them pass.**

- [ ] **Step 6: Add the ward-screen control.** "Flag a bed coming free", with confidence and
      blocker pickers, passing the route `unitId` as `actingUnitId`. Test-id
      `ward-flag-bed-release`.

- [ ] **Step 7: Run the full ward suites and commit.**

```bash
git add src/components/ward-management tests
git commit -m "Ward Flow: a ward can flag a bed coming free"
```

---

## Not built: the statutory clock board (spec item 12)

**Deliberately absent from this plan.** It was a board of legal countdowns; every legal deadline
was removed from the model on the product owner's instruction, so it has nothing to show and any
rebuild would either be empty or would re-invent the statutory figures this project has fabricated
four times. It waits for the owner's real figures. **No agent may supply them.** If a task in this
plan appears to need a legal deadline, that is a defect in the task, not a licence.

## Final verification (controller, after Task 11)

- `npx tsc --noEmit -p tsconfig.json` — quote the output.
- Full unit suite — quote the file and test counts. Baseline before this plan: **821 files passed,
  9865 passed, 74 skipped, 0 failed.**
- Ward Chromium journeys against a warmed dev server on this worktree's printed port (`npm run
ensure` first) — quote the "N passed" line.
- Dark, forced-colours and print coverage for the three new pages, following the established
  `emulateMedia` pattern in `tests/ui-ward-management.spec.ts`.
- `npm run docs:update`, then `npx prettier --check` on every changed file.
- **Do not run** `verify:release`, `eval:*`, `check:supabase-project`, or anything touching
  OpenAI, Supabase, GitHub Actions or the live database.
