# Ward Flow model correction and missing modes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the four model defects that let Ward Flow propose an unlawful or impossible placement, then add the four modes the WA pathway needs but the prototype cannot currently express.

**Architecture:** Ward Flow is a synthetic, offline product wireframe: one fixture module (`synthetic-fixtures.ts`) feeds every route, each route is a thin server component that renders a client workspace, and every workspace is proved by one Vitest contract test plus one Chromium journey. This plan keeps that shape. Model corrections land first as fixture + type changes with contract tests, because every new mode reads the corrected model. New modes follow, one route per task. No mode performs an allocation; all remain advisory with human confirmation, per ADR 2.

**Tech Stack:** Next.js 16 App Router (server component route → `"use client"` workspace), React 19, TypeScript 6 strict, CSS Modules with local `--net-*`/`--ward-*` token scales, Vitest for contracts, Playwright Chromium for journeys.

**Spec:** [`docs/ward-management-mode-map.md`](../../ward-management-mode-map.md) (route/role model), [`docs/ward-management-context.md`](../../ward-management-context.md) (glossary), [`docs/ward-management-decisions.md`](../../ward-management-decisions.md) (ADRs 1–3)

## Global Constraints

- **Synthetic only.** No record may carry name, date of birth, MRN, address, diagnosis, narrative history or treatment. `tests/ward-management.test.ts` asserts absence of those keys; extend that assertion, never relax it.
- **Advisory only.** No surface may allocate, auto-accept, or default after a timeout (ADR 2). Every placement control is a confirm/override pair.
- **No provider calls.** Everything runs offline against fixtures. Never add a fetch, Supabase call, or OpenAI call to any Ward Flow file.
- **Design tokens only.** No raw hex, and no raw padding/gap/z-index/line-height literals in CSS Modules — declare a local token in the module's root block first. `npm run check:design-system-contract` ratchets these counts and fails on any increase.
- **Tap targets are `3rem` (48px) minimum** on every interactive element. Never reduce to `2.75rem` to satisfy generic WCAG advice.
- **Button wiring.** Every `<button>` has an `onClick`, or is a submit inside a form, or is a `<Link>`. Unavailable-for-a-reason controls use `aria-disabled="true"` + inert handler + `title="… — coming soon"` + `sr-only` note. Never both `disabled` and `aria-disabled`.
- **Literal `<Link href="...">` for every new route** in `WardModeNavigation` — hrefs built from an array are invisible to `tests/route-reachability.test.ts` and the route will fail as an orphan.
- **Every new route must be declared** in `docs/design-system/adoption-contract.json` under the `ward-management` production surface, then `npm run design-system:adoption:update` run to regenerate `ADOPTION.md` and `adoption-manifest.json`.
- **`npm run format` and commit the result** before any push. It is not in `lint`, `typecheck`, or `test`.
- **Playwright config carries two matchers.** A new spec file must be added to BOTH `testMatch` and `productionSpecPattern` in `playwright.config.ts` or it silently runs zero tests.
- **Dev-server hydration.** Any Chromium test that clicks before hydration will flake. Wait on a client-only artefact first (for the network canvas: `svg path[marker-end]`).

---

## File Structure

| File                                                                     | Responsibility                                                                                                                                          |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/ward-management/synthetic-fixtures.ts`                   | Single source of synthetic data and the domain types. Grows: authorisation, catchment ladder, statutory deadlines, discharge forecast, decline records. |
| `src/components/ward-management/eligibility.ts`                          | **New.** Pure functions: hard legal gate, capability match, locality grade. No React. Imported by every mode that ranks or filters.                     |
| `src/components/ward-management/statutory-clock.ts`                      | **New.** Pure functions over `legalForm` deadlines: remaining minutes, breach state, sort order. No React.                                              |
| `src/components/ward-management/ward-management-escalation.tsx`          | **New.** `WardEscalationWorkspace` — the no-bed-anywhere surface.                                                                                       |
| `src/components/ward-management/ward-management-clock.tsx`               | **New.** `WardStatutoryClockWorkspace` — form-expiry board.                                                                                             |
| `src/components/ward-management/ward-management-discharge.tsx`           | **New.** `WardDischargeWorkspace` — release forecast (supply side).                                                                                     |
| `src/components/ward-management/ward-management-handover.tsx`            | **New.** `WardHandoverWorkspace` — printable shift SITREP.                                                                                              |
| `src/components/ward-management/ward-management-navigation.tsx`          | Mode strip. Gains four literal `<Link>` entries and four `WardMode` union members.                                                                      |
| `src/components/ward-management/ward-management-modes.tsx`               | `ModeBody` dispatch. Gains four branches.                                                                                                               |
| `src/app/ward-management/{escalation,clock,discharge,handover}/page.tsx` | **New.** Thin server components, metadata + workspace.                                                                                                  |
| `tests/ward-management-model.test.ts`                                    | **New.** Contract tests for fixtures, eligibility, statutory clock.                                                                                     |
| `tests/ui-ward-management-modes.spec.ts`                                 | **New.** Chromium journeys for the four new modes.                                                                                                      |

Corrections (Tasks 1–4) precede modes (Tasks 5–8) because every new mode consumes `eligibility.ts` and the corrected fixture shape.

---

### Task 1: Close the bed-state arithmetic and make it enforceable

The five bed states never summed: five of sixteen services over-counted their beds, and the model never said whether `potential` was its own bucket or a subset of `occupied`. Settle it as a subset (a bed expected to free is currently occupied) and pin it with a test so no future fixture edit can reopen it.

**Files:**

- Modify: `src/components/ward-management/synthetic-fixtures.ts`
- Create: `tests/ward-management-model.test.ts`
- Modify: `docs/ward-management-context.md` (the "Bed state" entry currently says the point is unresolved)

**Interfaces:**

- Consumes: nothing.
- Produces: the invariant `available + held + blocked + occupied === beds` and `potential <= occupied` on every `WardHospital`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/ward-management-model.test.ts
import { describe, expect, it } from "vitest";

import { wardHospitals } from "../src/components/ward-management/synthetic-fixtures";

describe("Ward Flow bed-state model", () => {
  it("accounts for every bed exactly once", () => {
    for (const hospital of wardHospitals) {
      expect(
        hospital.available + hospital.held + hospital.blocked + hospital.occupied,
        `${hospital.code} bed states do not sum to ${hospital.beds}`,
      ).toBe(hospital.beds);
    }
  });

  it("treats potential capacity as a subset of occupied, never as extra beds", () => {
    for (const hospital of wardHospitals) {
      expect(hospital.potential, `${hospital.code} claims more potential than occupied`).toBeLessThanOrEqual(
        hospital.occupied,
      );
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ward-management-model.test.ts`
Expected: FAIL — five services (`KUN`, `SJG`, `MAN`, `BRM`, `GER`) report a sum greater than `beds`.

- [ ] **Step 3: Derive `occupied` rather than hand-writing it**

In `synthetic-fixtures.ts`, replace each literal `occupied:` value so that `occupied = beds - available - held - blocked`. Keep `potential` as authored and confirm it is `<= occupied`. Document the invariant on the type:

```ts
/** Present but unusable, with a reason. */
blocked: number;
/** In use. `available + held + blocked + occupied` always equals `beds`. */
occupied: number;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ward-management-model.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Update the glossary to record the resolution**

In `docs/ward-management-context.md`, replace the paragraph beginning "Whether _potential_ is disjoint from _occupied_" with:

```markdown
_Potential_ is a subset of _occupied_: the bed is in use now and is expected to free after
a named action. It is never added to a capacity total, because adding it would advertise
beds that cannot be allocated.
```

- [ ] **Step 6: Commit**

```bash
npm run format
git add tests/ward-management-model.test.ts src/components/ward-management/synthetic-fixtures.ts docs/ward-management-context.md
git commit -m "fix(ward-flow): close bed-state arithmetic and pin the potential/occupied relationship"
```

---

### Task 2: Add authorised-hospital status as a hard legal gate

ADR 1. An involuntary patient must be detained at a hospital authorised under the Mental Health Act 2014. Authorisation is a property of the site; a locked door does not confer it. Today the model has only `Open | Secure`, so the system can propose a destination that cannot lawfully receive the patient.

**Files:**

- Modify: `src/components/ward-management/synthetic-fixtures.ts`
- Create: `src/components/ward-management/eligibility.ts`
- Modify: `tests/ward-management-model.test.ts`
- Modify: `docs/ward-management-decisions.md` (flip ADR 1 to Accepted)

**Interfaces:**

- Consumes: `WardHospital`, `WardPatient` from Task 1.
- Produces: `WardHospital.authorised: boolean`; `requiresAuthorisedHospital(patient): boolean`; `legalGate(patient, hospital): { eligible: boolean; reason: string }`.

- [ ] **Step 1: Write the failing test**

```ts
// append to tests/ward-management-model.test.ts
import { legalGate, requiresAuthorisedHospital } from "../src/components/ward-management/eligibility";
import { wardHospitalByCode, wardPatients } from "../src/components/ward-management/synthetic-fixtures";

describe("Ward Flow legal eligibility gate", () => {
  it("requires an authorised hospital for every non-voluntary status", () => {
    for (const patient of wardPatients) {
      expect(requiresAuthorisedHospital(patient)).toBe(patient.voluntaryStatus !== "Voluntary");
    }
  });

  it("refuses a detained patient at an unauthorised site regardless of ward security", () => {
    const detained = wardPatients.find((patient) => patient.voluntaryStatus === "Detained awaiting examination");
    expect(detained).toBeDefined();
    const unauthorised = wardHospitals.find((hospital) => !hospital.authorised);
    expect(unauthorised, "fixture needs at least one unauthorised service").toBeDefined();
    const verdict = legalGate(detained!, unauthorised!);
    expect(verdict.eligible).toBe(false);
    expect(verdict.reason).toContain("not authorised");
  });

  it("never routes a non-voluntary movement to an unauthorised destination", () => {
    for (const patient of wardPatients) {
      if (!requiresAuthorisedHospital(patient)) continue;
      expect(
        wardHospitalByCode(patient.destinationCode).authorised,
        `${patient.id} is routed to an unauthorised service`,
      ).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ward-management-model.test.ts`
Expected: FAIL with "Cannot find module '../src/components/ward-management/eligibility'".

- [ ] **Step 3: Add the field to the fixtures**

In `synthetic-fixtures.ts`, add to `WardHospital`:

```ts
/**
 * Authorised under the Mental Health Act 2014 to detain and treat involuntary patients.
 * A legal property of the site, independent of whether a ward is locked (ADR 1).
 */
authorised: boolean;
```

Set `authorised: true` for `SCGH`, `GRY`, `RPH`, `FSH`, `FRE`, `RCK`, `BTY`, `ARM`, `ALB`, `BUN`, `JND`. Set `authorised: false` for `SJG` (private), `MAN`, `BRM`, `GER`, `KUN` (no authorised inpatient mental health unit in this synthetic model).

Then re-point any non-voluntary movement currently aimed at an unauthorised service. `WF-202` (Involuntary inpatient) already targets `GRY`; verify each of `WF-198`, `WF-209`, `WF-187`, `WF-202` targets an authorised code and change `destinationCode`/`destinationName`/`referredTo` if not.

- [ ] **Step 4: Write the minimal implementation**

```ts
// src/components/ward-management/eligibility.ts
import type { WardHospital, WardPatient } from "@/components/ward-management/synthetic-fixtures";

/** Every status other than Voluntary carries a detention authority under the Act. */
export function requiresAuthorisedHospital(patient: WardPatient) {
  return patient.voluntaryStatus !== "Voluntary";
}

export function legalGate(patient: WardPatient, hospital: WardHospital): { eligible: boolean; reason: string } {
  if (requiresAuthorisedHospital(patient) && !hospital.authorised) {
    return { eligible: false, reason: `${hospital.name} is not authorised to detain under the Mental Health Act` };
  }
  return { eligible: true, reason: "Authorisation requirement satisfied" };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/ward-management-model.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Surface authorisation wherever beds are chosen**

In `ward-management-network.tsx`, add a row to the comparison table between "Catchment fit" and "Open/secure fit":

```tsx
<tr>
  <th scope="row">Legal authorisation</th>
  {candidates.map((candidate) => {
    const verdict = legalGate(patient, candidate.hospital);
    return (
      <td key={candidate.hospital.code} data-tone={verdict.eligible ? "good" : "danger"}>
        {verdict.eligible ? "Authorised" : "Not authorised"}
      </td>
    );
  })}
</tr>
```

In `ward-management-modes.tsx` `CapacityView`, add an `Authorised` column to `dataTable` rendering `hospital.authorised ? "Yes" : "No"`.

- [ ] **Step 7: Flip the ADR**

In `docs/ward-management-decisions.md`, change ADR 1's status line to `**Status:** Accepted — <today>`.

- [ ] **Step 8: Commit**

```bash
npm run format
git add src/components/ward-management tests/ward-management-model.test.ts docs/ward-management-decisions.md
git commit -m "feat(ward-flow): gate placement on authorised-hospital status (ADR 1)"
```

---

### Task 3: Separate catchment from region as a graded locality ladder

ADR 3. One four-value list currently serves both the patient's responsible health service and the hospital's physical region, so every country patient placed in the metro is scored out-of-catchment even when that is the correct pathway, and Broome and Albany read as equally local to each other.

**Files:**

- Modify: `src/components/ward-management/synthetic-fixtures.ts`
- Modify: `src/components/ward-management/eligibility.ts`
- Modify: `tests/ward-management-model.test.ts`
- Modify: `src/components/ward-management/ward-management-network.tsx:58-62` (`catchmentFit`)
- Modify: `docs/ward-management-decisions.md` (flip ADR 3 to Accepted)

**Interfaces:**

- Consumes: `legalGate` from Task 2.
- Produces: `WardPatient.wachsRegion?: WachsRegion`; `WardHospital.wachsRegion?: WachsRegion`; `localityGrade(patient, hospital): { grade: "local" | "in-service" | "escalation"; label: string }`.

- [ ] **Step 1: Write the failing test**

```ts
// append to tests/ward-management-model.test.ts
import { localityGrade } from "../src/components/ward-management/eligibility";

describe("Ward Flow locality ladder", () => {
  it("grades a country patient in their own WACHS region as local", () => {
    const patient = wardPatients.find((candidate) => candidate.id === "WF-210");
    expect(patient?.catchment).toBe("Country");
    expect(localityGrade(patient!, wardHospitalByCode("ALB")).grade).toBe("local");
  });

  it("grades another WACHS region as in-service rather than escalation", () => {
    const patient = wardPatients.find((candidate) => candidate.id === "WF-210");
    expect(localityGrade(patient!, wardHospitalByCode("BUN")).grade).toBe("in-service");
  });

  it("grades a country patient sent to metro as escalation", () => {
    const patient = wardPatients.find((candidate) => candidate.id === "WF-209");
    expect(localityGrade(patient!, wardHospitalByCode("RCK")).grade).toBe("escalation");
  });

  it("grades a metro patient in their own health service as local", () => {
    const patient = wardPatients.find((candidate) => candidate.id === "WF-204");
    expect(localityGrade(patient!, wardHospitalByCode("FSH")).grade).toBe("local");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ward-management-model.test.ts`
Expected: FAIL with "localityGrade is not a function".

- [ ] **Step 3: Add the WACHS region axis to the fixtures**

```ts
export type WachsRegion =
  "Kimberley" | "Pilbara" | "Midwest" | "Wheatbelt" | "Goldfields" | "South West" | "Great Southern";
```

Add `wachsRegion?: WachsRegion` to both `WardPatient` and `WardHospital`. Populate hospitals: `ALB` → `"Great Southern"`, `BUN` → `"South West"`, `BRM` → `"Kimberley"`, `GER` → `"Midwest"`, `KUN` → `"Kimberley"`. Populate the four `catchment: "Country"` patients: `WF-209` → `"Midwest"`, `WF-210` → `"Great Southern"`, `WF-206` → `"South West"`, `WF-221` → `"Great Southern"`.

- [ ] **Step 4: Write the minimal implementation**

```ts
// append to src/components/ward-management/eligibility.ts
export function localityGrade(
  patient: WardPatient,
  hospital: WardHospital,
): { grade: "local" | "in-service" | "escalation"; label: string } {
  if (patient.catchment === "Country") {
    if (hospital.service !== "WACHS") return { grade: "escalation", label: "Metropolitan escalation" };
    if (patient.wachsRegion && hospital.wachsRegion === patient.wachsRegion) {
      return { grade: "local", label: `${hospital.wachsRegion} — local` };
    }
    return { grade: "in-service", label: "Другой WACHS region" };
  }
  if (hospital.region === patient.catchment) return { grade: "local", label: `${hospital.region} — local` };
  return { grade: "escalation", label: "Cross-catchment escalation" };
}
```

Note: the placeholder text in the `in-service` label above is deliberately wrong — replace it with `"Another WACHS region"` when implementing, and let the test for `WF-210`/`BUN` confirm the grade rather than the label.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/ward-management-model.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 6: Consume it in the shortlist**

Replace `catchmentFit` in `ward-management-network.tsx` with a call to `localityGrade`, mapping `local → { label: "Best", tone: "good" }`, `in-service → { label: "In service", tone: "good" }`, `escalation → { label: "Escalation", tone: "warning" }`.

- [ ] **Step 7: Flip the ADR and commit**

Set ADR 3's status to `Accepted — <today>`.

```bash
npm run format
git add src/components/ward-management tests/ward-management-model.test.ts docs/ward-management-decisions.md
git commit -m "feat(ward-flow): grade locality on a catchment ladder instead of string equality (ADR 3)"
```

---

### Task 4: Make statutory timing a deadline instead of prose

`legalDetail` is free text ("Form 1A ready · review timing due 12:15"), so no surface can sort by urgency of expiry, raise an exception, or prove a breach. Statutory timing is the one clock where being late is a legal failure, not a delay.

**Files:**

- Modify: `src/components/ward-management/synthetic-fixtures.ts`
- Create: `src/components/ward-management/statutory-clock.ts`
- Modify: `tests/ward-management-model.test.ts`

**Interfaces:**

- Consumes: `WardPatient`.
- Produces: `WardPatient.legalForm?: { code: string; label: string; dueAt: string; kind: "examination" | "detention" | "transport" | "transfer" }`; `minutesUntil(dueAt, now): number`; `clockState(form, now): "breached" | "critical" | "due" | "clear"`.

- [ ] **Step 1: Write the failing test**

```ts
// append to tests/ward-management-model.test.ts
import { clockState, minutesUntil } from "../src/components/ward-management/statutory-clock";

const NOW = "10:42";

describe("Ward Flow statutory clock", () => {
  it("returns negative minutes for a passed deadline", () => {
    expect(minutesUntil("10:00", NOW)).toBe(-42);
  });

  it("classifies a passed deadline as breached", () => {
    expect(clockState({ code: "1A", label: "Referral", dueAt: "10:00", kind: "examination" }, NOW)).toBe("breached");
  });

  it("classifies under 60 minutes as critical and under 180 as due", () => {
    expect(clockState({ code: "3A", label: "Detention", dueAt: "11:15", kind: "detention" }, NOW)).toBe("critical");
    expect(clockState({ code: "3A", label: "Detention", dueAt: "12:30", kind: "detention" }, NOW)).toBe("due");
    expect(clockState({ code: "3A", label: "Detention", dueAt: "18:00", kind: "detention" }, NOW)).toBe("clear");
  });

  it("gives every non-voluntary movement a parsed form with a deadline", () => {
    for (const patient of wardPatients) {
      if (patient.voluntaryStatus === "Voluntary") continue;
      expect(patient.legalForm, `${patient.id} has no parsed legal form`).toBeDefined();
      expect(patient.legalForm!.dueAt).toMatch(/^\d{2}:\d{2}$/);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ward-management-model.test.ts`
Expected: FAIL with "Cannot find module '../src/components/ward-management/statutory-clock'".

- [ ] **Step 3: Write the minimal implementation**

```ts
// src/components/ward-management/statutory-clock.ts
export type LegalForm = {
  code: string;
  label: string;
  /** Wall-clock "HH:MM" on the synthetic operating day. */
  dueAt: string;
  kind: "examination" | "detention" | "transport" | "transfer";
};

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesUntil(dueAt: string, now: string) {
  return toMinutes(dueAt) - toMinutes(now);
}

export function clockState(form: LegalForm, now: string) {
  const remaining = minutesUntil(form.dueAt, now);
  if (remaining < 0) return "breached" as const;
  if (remaining < 60) return "critical" as const;
  if (remaining < 180) return "due" as const;
  return "clear" as const;
}
```

- [ ] **Step 4: Populate the fixtures**

Add `legalForm?: LegalForm` to `WardPatient` (import the type from `statutory-clock.ts`). Populate the four non-voluntary movements, preserving each patient's existing `legalDetail` prose as the human-readable line:

```ts
// WF-198 — Referred for psychiatric examination
legalForm: { code: "1A", label: "Referral for examination", dueAt: "12:15", kind: "examination" },
// WF-209 — Referred for psychiatric examination
legalForm: { code: "1A", label: "Referral for examination", dueAt: "13:40", kind: "examination" },
// WF-187 — Detained awaiting examination
legalForm: { code: "3A", label: "Detention pending examination", dueAt: "13:00", kind: "detention" },
// WF-202 — Involuntary inpatient
legalForm: { code: "4C", label: "Transfer authority", dueAt: "12:00", kind: "transfer" },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/ward-management-model.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/components/ward-management tests/ward-management-model.test.ts
git commit -m "feat(ward-flow): parse statutory timing into deadlines with a clock state"
```

---

### Task 5: Statutory clock mode

The board that answers "which legal deadline runs out next, and who owns it". Depends on Task 4.

**Files:**

- Create: `src/components/ward-management/ward-management-clock.tsx`
- Create: `src/components/ward-management/ward-management-clock.module.css`
- Create: `src/app/ward-management/clock/page.tsx`
- Create: `tests/ui-ward-management-modes.spec.ts`
- Modify: `src/components/ward-management/ward-management-navigation.tsx`
- Modify: `src/components/ward-management/ward-management-modes.tsx`
- Modify: `playwright.config.ts`, `docs/design-system/adoption-contract.json`

**Interfaces:**

- Consumes: `clockState`, `minutesUntil` (Task 4).
- Produces: `WardStatutoryClockWorkspace()` — no props.

- [ ] **Step 1: Write the failing Chromium test**

```ts
// tests/ui-ward-management-modes.spec.ts
import { expect, test } from "playwright/test";

test.describe("Ward Flow statutory clock", () => {
  test.describe.configure({ timeout: 45_000 });

  test("orders legal deadlines by time remaining and names the breach", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    await page.goto("/ward-management/clock", { waitUntil: "domcontentloaded" });

    const clock = page.getByTestId("ward-clock-view");
    await expect(clock).toBeVisible({ timeout: 15_000 });

    const rows = clock.locator('[data-testid^="ward-clock-row-"]');
    await expect(rows.first()).toHaveAttribute("data-testid", "ward-clock-row-WF-202");
    await expect(rows.first()).toContainText("Form 4C");
    await expect(clock).toContainText("Transfer authority");
    await expect(clock.getByRole("link", { name: /WF-187/ })).toBeVisible();
  });
});
```

- [ ] **Step 2: Register the spec in both Playwright matchers**

In `playwright.config.ts`, add `ward-management-modes` to the top-level `testMatch` regex AND the per-project `productionSpecPattern` regex. Missing either yields "Error: No tests found."

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx playwright test tests/ui-ward-management-modes.spec.ts --project=chromium`
Expected: FAIL — the route 404s.

- [ ] **Step 4: Write the workspace**

```tsx
// src/components/ward-management/ward-management-clock.tsx
"use client";

import Link from "next/link";

import { clockState, minutesUntil } from "@/components/ward-management/statutory-clock";
import { wardPatients } from "@/components/ward-management/synthetic-fixtures";

import styles from "./ward-management-clock.module.css";

const NOW = "10:42";

const stateCopy = {
  breached: "Breached",
  critical: "Under 1 hour",
  due: "Under 3 hours",
  clear: "In time",
} as const;

export function WardStatutoryClockWorkspace() {
  const rows = wardPatients
    .filter((patient) => patient.legalForm)
    .map((patient) => ({ patient, form: patient.legalForm!, remaining: minutesUntil(patient.legalForm!.dueAt, NOW) }))
    .sort((a, b) => a.remaining - b.remaining);

  return (
    <section className={styles.clockPage} data-testid="ward-clock-view">
      <header className={styles.header}>
        <h2>Statutory clock</h2>
        <p>Mental Health Act deadlines only. Sorted by time remaining, soonest first.</p>
      </header>
      <ul className={styles.rows}>
        {rows.map(({ patient, form, remaining }) => (
          <li
            className={styles.row}
            key={patient.id}
            data-testid={`ward-clock-row-${patient.id}`}
            data-state={clockState(form, NOW)}
          >
            <Link className={styles.rowLink} href={`/ward-management/patients/${patient.id}`}>
              <span className={styles.rowId}>{patient.id}</span>
              <span className={styles.rowForm}>
                Form {form.code} · {form.label}
              </span>
              <span className={styles.rowStatus}>{patient.voluntaryStatus}</span>
              <span className={styles.rowDue}>
                due {form.dueAt} · {remaining < 0 ? `${Math.abs(remaining)} min overdue` : `${remaining} min left`}
              </span>
              <span className={styles.rowState}>{stateCopy[clockState(form, NOW)]}</span>
              <span className={styles.rowOwner}>{patient.owner}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className={styles.notice}>
        Voluntary movements carry no Mental Health Act deadline and are deliberately absent from this board.
      </p>
    </section>
  );
}
```

Write `ward-management-clock.module.css` with a `--clk-*` token block mirroring `ward-management-network.module.css` lines 1–32, and style `.row[data-state="breached"]` with `--clk-danger`, `critical` with `--clk-danger` border only, `due` with `--clk-warn`, `clear` with `--clk-muted`. `.rowLink` gets `min-height: 3rem`.

- [ ] **Step 5: Add the route, the nav link and the dispatch**

```tsx
// src/app/ward-management/clock/page.tsx
import type { Metadata } from "next";

import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";

export const metadata: Metadata = {
  title: "Ward Flow statutory clock",
  description: "Mental Health Act form deadlines across open movements, ordered by time remaining.",
};

export default function WardClockPage() {
  return <WardModeWorkspace mode="clock" />;
}
```

Add `"clock"` to the `WardMode` union, add a literal `<Link href="/ward-management/clock">` to `WardModeNavigation` (icon `FileClock`, label "Statutory clock", short label "Clock"), add a `modeCopy.clock` entry, and add `if (mode === "clock") return <WardStatutoryClockWorkspace />;` to `ModeBody`.

- [ ] **Step 6: Declare the route and regenerate**

Add `"src/app/ward-management/clock/page.tsx"` to the `ward-management` surface `routes` array and `"src/components/ward-management/ward-management-clock.tsx"` to its `roots`, plus `"WardStatutoryClockWorkspace"` to `sanctionedSpecialPatterns`.

Run: `npm run design-system:adoption:update`

- [ ] **Step 7: Run the gates**

```bash
npx vitest run tests/route-reachability.test.ts tests/ward-management.test.ts
npm run check:design-system-contract
npm run ensure
npx playwright test tests/ui-ward-management-modes.spec.ts --project=chromium
```

Expected: route-reachability passes (the literal `<Link>` is found), contract reports no ratchet increase, Chromium test passes.

- [ ] **Step 8: Commit**

```bash
npm run format
git add src/app/ward-management/clock src/components/ward-management tests playwright.config.ts docs/design-system
git commit -m "feat(ward-flow): add the statutory clock mode"
```

---

### Task 6: Escalation / no-bed-anywhere mode

Every fixture movement already has a destination, so the state the tool most needs to handle well — nothing suitable anywhere — has no surface. This mode answers "what do we do when the answer is no".

**Files:**

- Create: `src/components/ward-management/ward-management-escalation.tsx`, `.module.css`
- Create: `src/app/ward-management/escalation/page.tsx`
- Modify: `src/components/ward-management/synthetic-fixtures.ts`, `ward-management-navigation.tsx`, `ward-management-modes.tsx`
- Modify: `tests/ui-ward-management-modes.spec.ts`, `tests/ward-management-model.test.ts`, `docs/design-system/adoption-contract.json`

**Interfaces:**

- Consumes: `legalGate` (Task 2), `localityGrade` (Task 3).
- Produces: `WardPatient.declines?: Array<{ hospitalCode: string; at: string; reason: string }>`; `WardEscalationWorkspace()`.

- [ ] **Step 1: Write the failing model test**

```ts
// append to tests/ward-management-model.test.ts
describe("Ward Flow escalation state", () => {
  it("models at least one movement with no eligible destination left", () => {
    const stranded = wardPatients.filter((patient) => (patient.declines?.length ?? 0) > 0);
    expect(stranded.length).toBeGreaterThan(0);
    for (const patient of stranded) {
      for (const decline of patient.declines!) {
        expect(decline.reason.length).toBeGreaterThan(0);
        expect(decline.at).toMatch(/^\d{2}:\d{2}$/);
      }
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/ward-management-model.test.ts`
Expected: FAIL — `stranded.length` is 0.

- [ ] **Step 3: Add declines to the fixtures**

Add to `WardPatient`:

```ts
  /** Destinations that have refused this movement, with the time and stated reason. */
  declines?: Array<{ hospitalCode: string; at: string; reason: string }>;
```

Populate `WF-187` (Adult Secure, East, detained):

```ts
declines: [
  { hospitalCode: "RPH", at: "09:20", reason: "No secure bed; secure unit at capacity" },
  { hospitalCode: "GRY", at: "10:05", reason: "Declined on acuity mix" },
  { hospitalCode: "SCGH", at: "10:31", reason: "Secure bed held for an earlier movement" },
],
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/ward-management-model.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing Chromium test**

```ts
// append to tests/ui-ward-management-modes.spec.ts
test.describe("Ward Flow escalation", () => {
  test.describe.configure({ timeout: 45_000 });

  test("states plainly that no bed is available and names the escalation path", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    await page.goto("/ward-management/escalation", { waitUntil: "domcontentloaded" });

    const escalation = page.getByTestId("ward-escalation-view");
    await expect(escalation).toBeVisible({ timeout: 15_000 });
    await expect(escalation).toContainText("WF-187");
    await expect(escalation).toContainText("No eligible destination");
    await expect(escalation.getByRole("list", { name: "Declined destinations" })).toContainText("Royal Perth");
    await expect(escalation.getByRole("list", { name: "Declined destinations" })).toContainText("09:20");
    await expect(escalation).toContainText("System Flow Centre");
  });
});
```

- [ ] **Step 6: Write the workspace**

The page renders, for each movement with declines: the movement identity line, a **"No eligible destination"** banner, an ordered `<ul aria-label="Declined destinations">` of `{hospital name} · {at} · {reason}`, a "Least-bad options" table of remaining services that pass `legalGate` sorted by `localityGrade` then available beds, and a static escalation-path block naming, in order, the WACHS Mental Health Patient Flow desk, the health service's own after-hours coordinator, and the WA Health System Flow Centre. Every control is a `<Link>` to the movement workspace or an `aria-disabled` placeholder with a `title="… — coming soon"`; nothing on this page allocates.

- [ ] **Step 7: Route, nav, dispatch, contract, gates, commit**

Same shape as Task 5 Steps 5–8, substituting `escalation` / `WardEscalationWorkspace` / icon `TriangleAlert` / label "Escalation".

```bash
git commit -m "feat(ward-flow): add the escalation and no-bed-available mode"
```

---

### Task 7: Discharge and release-forecast mode

The supply side. Beds free because people leave, and the mode map already promises ward managers a release forecast with no data behind it. This is also the only honest source for `potential` capacity, which Task 1 fixed as a subset of occupied.

**Files:**

- Create: `src/components/ward-management/ward-management-discharge.tsx`, `.module.css`
- Create: `src/app/ward-management/discharge/page.tsx`
- Modify: `synthetic-fixtures.ts`, `ward-management-navigation.tsx`, `ward-management-modes.tsx`, `tests/ui-ward-management-modes.spec.ts`, `tests/ward-management-model.test.ts`, `docs/design-system/adoption-contract.json`

**Interfaces:**

- Consumes: `WardHospital` (Task 1).
- Produces: `wardReleases: WardRelease[]` where `WardRelease = { id: string; hospitalCode: string; expectedAt: string; confidence: "confirmed" | "likely" | "possible"; blocker: string }`.

- [ ] **Step 1: Write the failing model test**

```ts
// append to tests/ward-management-model.test.ts
import { wardReleases } from "../src/components/ward-management/synthetic-fixtures";

describe("Ward Flow release forecast", () => {
  it("never forecasts more releases at a service than it has potential beds", () => {
    for (const hospital of wardHospitals) {
      const forecast = wardReleases.filter((release) => release.hospitalCode === hospital.code);
      expect(forecast.length, `${hospital.code} forecasts more releases than potential beds`).toBeLessThanOrEqual(
        hospital.potential,
      );
    }
  });

  it("carries no departing-patient identity", () => {
    for (const release of wardReleases) {
      expect(release.id).toMatch(/^WR-\d{3}$/);
      expect(release).not.toHaveProperty("name");
      expect(release).not.toHaveProperty("mrn");
      expect(release).not.toHaveProperty("diagnosis");
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Expected: FAIL with "Cannot find name 'wardReleases'".

- [ ] **Step 3: Add the fixture**

```ts
export type WardRelease = {
  /** Synthetic release identifier. Deliberately carries no departing-patient detail. */
  id: string;
  hospitalCode: string;
  expectedAt: string;
  confidence: "confirmed" | "likely" | "possible";
  blocker: string;
};

export const wardReleases: WardRelease[] = [
  { id: "WR-101", hospitalCode: "FSH", expectedAt: "12:30", confidence: "confirmed", blocker: "No blocker" },
  { id: "WR-102", hospitalCode: "FSH", expectedAt: "16:00", confidence: "likely", blocker: "Awaiting pharmacy" },
  { id: "WR-103", hospitalCode: "RPH", expectedAt: "13:15", confidence: "confirmed", blocker: "No blocker" },
  { id: "WR-104", hospitalCode: "RPH", expectedAt: "17:45", confidence: "possible", blocker: "Accommodation pending" },
  { id: "WR-105", hospitalCode: "SCGH", expectedAt: "11:50", confidence: "confirmed", blocker: "No blocker" },
  { id: "WR-106", hospitalCode: "GRY", expectedAt: "15:20", confidence: "likely", blocker: "Transport to be booked" },
  { id: "WR-107", hospitalCode: "BUN", expectedAt: "14:10", confidence: "possible", blocker: "Family meeting pending" },
];
```

- [ ] **Step 4: Run to verify it passes**

Expected: PASS.

- [ ] **Step 5: Write the failing Chromium test**

```ts
// append to tests/ui-ward-management-modes.spec.ts
test.describe("Ward Flow discharge forecast", () => {
  test.describe.configure({ timeout: 45_000 });

  test("shows expected releases by service and never presents them as available beds", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    await page.goto("/ward-management/discharge", { waitUntil: "domcontentloaded" });

    const discharge = page.getByTestId("ward-discharge-view");
    await expect(discharge).toBeVisible({ timeout: 15_000 });
    await expect(discharge.getByRole("row", { name: /Fiona Stanley/ })).toContainText("2 expected");
    await expect(discharge).toContainText("Confirmed");
    await expect(discharge).toContainText("not allocatable");
  });
});
```

- [ ] **Step 6: Write the workspace**

A table grouped by service: columns Service, Expected releases, Next release, Confidence mix, Current ready beds, Blocker summary. Under it a per-release list showing `id`, `expectedAt`, `confidence`, `blocker`. A standing notice: "Forecast releases are potential capacity. They are not allocatable and are never added to a ready-bed total." No departing-patient detail anywhere.

- [ ] **Step 7: Route, nav, dispatch, contract, gates, commit**

Icon `CalendarClock`, label "Discharge", short "Release".

```bash
git commit -m "feat(ward-flow): add the discharge and release-forecast mode"
```

---

### Task 8: Shift handover (SITREP) mode

What a coordinator actually produces at changeover: a point-in-time, printable statement of what is open, what is breaching, and who owns it. Depends on Tasks 4–7 because it summarises all of them.

**Files:**

- Create: `src/components/ward-management/ward-management-handover.tsx`, `.module.css`
- Create: `src/app/ward-management/handover/page.tsx`
- Modify: `ward-management-navigation.tsx`, `ward-management-modes.tsx`, `tests/ui-ward-management-modes.spec.ts`, `docs/design-system/adoption-contract.json`

**Interfaces:**

- Consumes: `clockState` (Task 4), `wardReleases` (Task 7), `declines` (Task 6).
- Produces: `WardHandoverWorkspace()`.

- [ ] **Step 1: Write the failing Chromium test**

```ts
// append to tests/ui-ward-management-modes.spec.ts
test.describe("Ward Flow shift handover", () => {
  test.describe.configure({ timeout: 45_000 });

  test("summarises open work and survives print mode", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    await page.goto("/ward-management/handover", { waitUntil: "domcontentloaded" });

    const handover = page.getByTestId("ward-handover-view");
    await expect(handover).toBeVisible({ timeout: 15_000 });
    await expect(handover.getByRole("region", { name: "Breaching or critical" })).toContainText("WF-202");
    await expect(handover.getByRole("region", { name: "No eligible destination" })).toContainText("WF-187");
    await expect(handover.getByRole("region", { name: "Expected releases" })).toContainText("WR-101");
    await expect(handover).toContainText("Point-in-time");

    await page.emulateMedia({ media: "print" });
    await expect(handover.getByRole("region", { name: "Breaching or critical" })).toBeVisible();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Expected: FAIL — route 404s.

- [ ] **Step 3: Write the workspace**

Five `<section>` landmarks, each with an `aria-label` matching the test: "Breaching or critical" (movements whose `clockState` is `breached` or `critical`), "No eligible destination" (movements with declines), "Held beds expiring", "Expected releases" (from `wardReleases`), "Owned next actions" (grouped by `patient.owner`). A header line stating the point-in-time stamp and that the page is a synthetic prototype. In `ward-management-handover.module.css`, add a `@media print` block that removes shadows and borders and forces single-column flow — and do **not** rely on the global print stylesheet keeping the `h1` visible, because it does not.

- [ ] **Step 4: Route, nav, dispatch, contract, gates**

Icon `ClipboardList`, label "Handover", short "Shift".

- [ ] **Step 5: Run the full local gate**

```bash
npm run verify:pr-local
```

Expected: passes. If it selects heavy scope, that is correct — this diff is executable product code.

- [ ] **Step 6: Commit**

```bash
npm run format
git add src/app/ward-management/handover src/components/ward-management tests docs/design-system
git commit -m "feat(ward-flow): add the shift handover SITREP mode"
```

---

### Task 9: Reconcile the docs with the shipped model

Four ADRs, a glossary with four "not yet modelled" entries, and a mode map with nine routes all describe a system that has now changed. Left stale, the docs become the next contributor's source of wrong assumptions.

**Files:**

- Modify: `docs/ward-management-mode-map.md`, `docs/ward-management-context.md`, `docs/ward-management-decisions.md`
- Modify: `docs/codebase-index.md`

- [ ] **Step 1: Update the route table**

Add rows for `/ward-management/clock`, `/escalation`, `/discharge`, `/handover` to the "Primary route system" table in `ward-management-mode-map.md`, each with its primary question, dominant visual and primary owner, matching the existing column shape exactly.

- [ ] **Step 2: Clear the resolved glossary entries**

In `ward-management-context.md`, remove "Not yet modelled" from **Release forecast**, **Decline**, **No bed available** and **Statutory timing**, and replace each with one sentence describing the surface that now owns it.

- [ ] **Step 3: Add ADR 4**

Record the statutory-clock decision: deadlines are structured data with a computed state, prose is retained only as the human-readable line, and the synthetic "now" is a fixed `10:42` because the fixtures carry no date. Alternatives considered: real `Date.now()` (rejected — makes every test time-dependent and every screenshot non-reproducible).

- [ ] **Step 4: Index the new modules**

Add `eligibility.ts`, `statutory-clock.ts` and the four new workspaces to the ward-management section of `docs/codebase-index.md`.

- [ ] **Step 5: Regenerate the site map**

Run: `npm run docs:update`
Expected: `docs/site-map.md` gains the four routes.

- [ ] **Step 6: Commit**

```bash
npm run format
git add docs
git commit -m "docs(ward-flow): reconcile the mode map, glossary and index with the shipped model"
```

---

## Self-Review

**Spec coverage.** ADR 1 → Task 2. ADR 3 → Task 3. Bed-state ambiguity (glossary, "Capacity") → Task 1. Statutory timing ("a deadline, not descriptive text") → Tasks 4 and 5. Decline ("not yet modelled") → Task 6. No bed available ("not yet modelled") → Task 6. Release forecast ("not yet modelled") → Task 7. Shift handover is not in the current spec — Task 9 Step 1 adds it to the mode map, which is the correct direction of travel.

**Known gaps, deliberately out of scope.** Child and adolescent cohort (needs a CAMHS network the fixtures do not model), legal **status change** during a movement (needs an event log rather than a field, which is a larger design question), and the `operationalPriorityScore` question — whether urgency belongs inside the score — which is the product owner's call and is recorded as an open question rather than planned.

**Type consistency.** `legalGate` and `requiresAuthorisedHospital` (Task 2) and `localityGrade` (Task 3) all live in `eligibility.ts` and are consumed under those exact names in Tasks 3, 6 and 7. `clockState`/`minutesUntil`/`LegalForm` (Task 4) are consumed under those names in Tasks 5 and 8. `WardRelease`/`wardReleases` (Task 7) are consumed in Task 8. `WardPatient.declines` (Task 6) is consumed in Task 8.

**One deliberate trap.** Task 3 Step 4 contains a wrong string literal, flagged in the step itself. It is there because that label is the one place in this plan where copying code blindly produces a plausible-looking bug that no test catches — the tests assert `grade`, not `label`.
