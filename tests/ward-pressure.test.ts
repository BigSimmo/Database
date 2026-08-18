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
});
