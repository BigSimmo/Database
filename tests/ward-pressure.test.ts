// tests/ward-pressure.test.ts
import { describe, expect, it } from "vitest";

import { edPressure } from "../src/components/ward-management/ward-pressure";
import { isOpen } from "../src/components/ward-management/ward-derivations";
import { wardMovements } from "../src/components/ward-management/ward-movements";
import { NOW_ANCHOR, allEmergencyDepartments } from "../src/components/ward-management/ward-sites";
import type { Movement } from "../src/components/ward-management/ward-model";

// A real, valid, open movement (no legalForm, no closure) to spread from when a test needs a
// hand-built movement list — this keeps every field the type requires without re-typing the
// whole shape, and keeps injected data honestly movement-shaped rather than a partial stub.
const baseMovement = wardMovements.find((movement) => movement.id === "WF-002");
if (!baseMovement) throw new Error("Fixture movement WF-002 is required as a template for ward-pressure tests");

function movementFrom(overrides: Partial<Movement>): Movement {
  // `{ ...baseMovement, ...overrides }` widens every overridden field back to optional under
  // TypeScript's spread-merge rules (a known quirk when the second spread's type is Partial<T>),
  // even though every field is genuinely present at runtime. Object.assign keeps the precise
  // `Movement` type because its overload intersects the source types instead of merging them.
  return Object.assign({}, baseMovement, overrides);
}

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
        // IMPORTANT 3: mirror the implementation's clamp here too. Without it this expectation
        // is only true by coincidence of today's fixture (every open movement's wait happens to
        // be positive) and would go red the moment a future-dated `openedAt` was authored, even
        // though the implementation was doing the conservative, correct thing.
        .map((movement) => Math.max(0, NOW_ANCHOR - movement.openedAt));
      expect(row.longestWaitMinutes).toBe(waits.length ? Math.max(...waits) : 0);
    }
  });

  // Fix wave 1, finding 2. This test derives its expectation from the real fixture, where the
  // count is now zero for every row — so on its own it can no longer fail: hard-wiring
  // `breaching: 0` in ward-pressure.ts passes it, and passes the two zero-expecting breach tests
  // below as well. It is kept because "the row agrees with the fixture" is still worth pinning,
  // but the positive proof it used to carry has been restored as its own test underneath, using
  // an injected movement rather than fixture data.
  it("counts a breach only where a legal deadline has actually passed", () => {
    for (const row of edPressure(NOW_ANCHOR)) {
      const breaching = wardMovements.filter(
        (movement) =>
          isOpen(movement) &&
          movement.originEdId === row.ed.id &&
          movement.legalForm?.dueAt !== undefined &&
          movement.legalForm.dueAt < NOW_ANCHOR,
      ).length;
      expect(row.breaching).toBe(breaching);
    }
  });

  /**
   * Fix wave 1, finding 2 — the restored positive proof that `breaching` can ever be non-zero.
   *
   * `edPressure(now, movements)` takes an explicit array, so this injects its own movement rather
   * than depending on the fixture: after the 2026-08-23 correction no fixture movement carries a
   * past-due deadline, and a suite in which every breach expectation is zero cannot distinguish a
   * working counter from `breaching: 0`.
   *
   * The carrier is a Form **4A** ("Transport order"), which is about moving a person and is
   * unrelated to the examination timeline this project's fabrications were about. `- 45` is
   * arbitrary test scaffolding chosen to sit in the past; it is NOT a Mental Health Act figure
   * and nothing derives it from one.
   */
  it("counts a movement whose deadline has passed — the counter is not hard-wired to zero", () => {
    const breachedMovement = movementFrom({
      id: "TEST-past-due-transport",
      originEdId: "sjgm-ed",
      legalForm: { code: "4A", kind: "transport", dueAt: NOW_ANCHOR - 45 },
    });
    const rows = edPressure(NOW_ANCHOR, [breachedMovement]);

    const row = rows.find((candidate) => candidate.ed.id === "sjgm-ed");
    expect(row, "sjgm-ed must be reported").toBeDefined();
    expect(row?.breaching).toBe(1);

    // Every other department must read zero from the same call, so a counter that returned a
    // constant 1, or counted movements regardless of department, fails here too.
    const others = rows.filter((candidate) => candidate.ed.id !== "sjgm-ed");
    expect(others.length, "the fixture must contain more than one department").toBeGreaterThan(0);
    expect(others.map((candidate) => candidate.breaching)).toEqual(others.map(() => 0));
  });

  it("sorts worst first — breaching, then longest wait, then volume", () => {
    // RULING 1: the brief's original assertion compared two arrays with `>=`, which coerces
    // both sides to strings and compares character-by-character. That reads "2,767,7" against
    // "2,730,6" as text, not numbers — it passes on today's fixture by luck, and it would also
    // pass a genuinely wrong ordering (a longest wait of 95 sorted before 240 compares as
    // "9" > "2" and looks correctly ordered). Compare the tuple numerically instead, with
    // explicit tie-breaking: breaching first, then longest wait, then waiting volume.
    function compareWorstFirst(
      a: { breaching: number; longestWaitMinutes: number; waiting: number },
      b: { breaching: number; longestWaitMinutes: number; waiting: number },
    ): number {
      return b.breaching - a.breaching || b.longestWaitMinutes - a.longestWaitMinutes || b.waiting - a.waiting;
    }

    const rows = edPressure(NOW_ANCHOR);
    for (let index = 1; index < rows.length; index += 1) {
      const previous = rows[index - 1];
      const current = rows[index];
      // previous must not be worse-ranked than current: comparing (previous, current) must not
      // come out positive, i.e. current must not outrank previous.
      expect(compareWorstFirst(previous, current)).toBeLessThanOrEqual(0);
    }
  });

  // IMPORTANT 1: with only the live fixture (where every department has open movements), a
  // dropped-department mutation like `.filter((row) => row.waiting > 0)` still returns 5/5.
  // Injecting an empty movement list is the only way to prove every department survives with
  // zeros rather than vanishing from the coordinator's card row.
  it("reports every department with zeros, never drops one, when there are no open movements at all", () => {
    const rows = edPressure(NOW_ANCHOR, []);
    const departments = allEmergencyDepartments();
    expect(rows).toHaveLength(departments.length);
    for (const department of departments) {
      const row = rows.find((candidate) => candidate.ed.id === department.id);
      expect(row).toBeDefined();
      // The row's `ed` must be the real department object, never a substituted or fabricated
      // one — a quiet department renders as itself with zeros, not as something else.
      expect(row?.ed).toBe(department);
      expect(row?.waiting).toBe(0);
      expect(row?.longestWaitMinutes).toBe(0);
      expect(row?.breaching).toBe(0);
    }
  });

  // IMPORTANT 2: nothing in the other tests pins a count to the *correct* department — a
  // network-wide total and per-row self-consistency both survive rotating each department's
  // count onto its neighbour. A hand-built, known-origin movement list is the only way to prove
  // attribution, not just volume.
  it("attributes each department's count to that department, not a neighbour's", () => {
    const movements: Movement[] = [
      movementFrom({ id: "TEST-peel-1", originEdId: "peel-ed", openedAt: NOW_ANCHOR - 10 }),
      movementFrom({ id: "TEST-peel-2", originEdId: "peel-ed", openedAt: NOW_ANCHOR - 20 }),
      movementFrom({ id: "TEST-peel-3", originEdId: "peel-ed", openedAt: NOW_ANCHOR - 30 }),
      movementFrom({ id: "TEST-fsh-1", originEdId: "fsh-ed", openedAt: NOW_ANCHOR - 5 }),
    ];

    const rows = edPressure(NOW_ANCHOR, movements);
    for (const row of rows) {
      if (row.ed.id === "peel-ed") {
        expect(row.waiting).toBe(3);
      } else if (row.ed.id === "fsh-ed") {
        expect(row.waiting).toBe(1);
      } else {
        expect(row.waiting).toBe(0);
      }
    }
  });

  // IMPORTANT 3: a dedicated, isolated proof of the clamp — independent of the fixture, whose
  // waits are all currently positive by coincidence. This is the test that must go red if the
  // `Math.max(0, …)` clamp is removed from the implementation.
  it("clamps a future-dated openedAt to a zero wait rather than a negative one", () => {
    const movements: Movement[] = [
      movementFrom({ id: "TEST-future-open", originEdId: "rgh-ed", openedAt: NOW_ANCHOR + 30 }),
    ];
    const rows = edPressure(NOW_ANCHOR, movements);
    const row = rows.find((candidate) => candidate.ed.id === "rgh-ed");
    expect(row?.longestWaitMinutes).toBe(0);
  });

  // MINOR 4: `clockState` treats zero remaining as "critical", not "breached" — only strictly
  // negative remaining time counts as a breach. Nothing in the live fixture has a deadline
  // exactly at `now`, so a `<=` substituted for `clockState` would still pass every other test.
  it("does not count a deadline due exactly now as breaching", () => {
    const movements: Movement[] = [
      movementFrom({
        id: "TEST-due-now",
        originEdId: "sjgm-ed",
        legalForm: { code: "4A", kind: "transport", dueAt: NOW_ANCHOR },
      }),
    ];
    const rows = edPressure(NOW_ANCHOR, movements);
    const row = rows.find((candidate) => candidate.ed.id === "sjgm-ed");
    expect(row?.breaching).toBe(0);
  });

  // Task 6A: a Form 3B carries no dueAt at all — the clinician settled that the
  // post-examination clock counts up, so none is recorded. A form in that state must never reach
  // `clockState`'s arithmetic and must never be counted as breaching, however long the patient
  // has waited.
  it("never counts a legal form with no dueAt as breaching, however old the movement", () => {
    const movements: Movement[] = [
      movementFrom({
        id: "TEST-no-deadline",
        originEdId: "sjgm-ed",
        openedAt: NOW_ANCHOR - 10_000,
        legalForm: { code: "3B", kind: "detention" },
      }),
    ];
    const rows = edPressure(NOW_ANCHOR, movements);
    const row = rows.find((candidate) => candidate.ed.id === "sjgm-ed");
    expect(row?.breaching).toBe(0);
  });

  // Task 6A: a Form 3B honestly carries no dueAt at all — the clinician, asked directly, settled
  // that the post-examination clock is elapsed ED wait counting up, not a countdown, so this model
  // records no deadline for a 3B. A form in that state must never reach `clockState`'s arithmetic
  // and must never be counted as breaching, however long the patient has waited.
  it("never counts a legal form with no dueAt as breaching, however old the movement", () => {
    const movements: Movement[] = [
      movementFrom({
        id: "TEST-no-deadline",
        originEdId: "sjgm-ed",
        openedAt: NOW_ANCHOR - 10_000,
        legalForm: { code: "3B", kind: "detention" },
      }),
    ];
    const rows = edPressure(NOW_ANCHOR, movements);
    const row = rows.find((candidate) => candidate.ed.id === "sjgm-ed");
    expect(row?.breaching).toBe(0);
  });
});
