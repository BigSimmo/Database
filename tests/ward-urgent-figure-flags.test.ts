import { describe, expect, it } from "vitest";

import { URGENT_FIGURE_FLAG_CEILING, urgentFigureFlags } from "@/components/ward-management/ward-management-console";

/**
 * 🔴 **THE SICKEST PATIENT WAS LOSING A SIGNAL AND NOTHING SAID SO.**
 *
 * Three facts on the patient workspace can carry amber — a breached deadline on the legal form,
 * wards that have declined, and a bed hold that has run out. `WardFigureStrip` throws above two
 * flagged tiles, deliberately: amber means "look here" and directs the eye nowhere when everything
 * carries it. Until 2026-09-06 the third was silently truncated, so on the one patient for whom all
 * three were true — declined, past the deadline, holding an expired bed — the screen asserted that
 * the other two were the urgent things and dropped the declines without a word.
 *
 * ⚠️ **THIS FILE DELIBERATELY DOES NOT PIN THE ORDER, and that is the point.** A test asserting
 * "declines comes second" goes green the day somebody reorders it back to the defect. What is
 * asserted instead is the property that made the old behaviour wrong:
 *
 *   **every urgent fact is either flagged or named — never silently absent.**
 *
 * That holds under any ordering, so a future owner ruling can change the priority without touching
 * this file, and no ordering can satisfy it while dropping something.
 *
 * The order itself IS pinned, once, in the last test — separately, and labelled as an owner ruling
 * rather than as a property, so it is obvious which assertion to change when he changes his mind.
 */

type Conditions = Parameters<typeof urgentFigureFlags>[0];

const KEYS = ["deadlineBreached", "declined", "pullExpired"] as const;

/** All eight combinations, so the three-flag case cannot be the one nobody constructed. */
const ALL_COMBINATIONS: Conditions[] = Array.from({ length: 8 }, (_, mask) => ({
  deadlineBreached: Boolean(mask & 1),
  declined: Boolean(mask & 2),
  pullExpired: Boolean(mask & 4),
}));

function urgentCount(conditions: Conditions): number {
  return KEYS.filter((key) => conditions[key]).length;
}

describe("urgent figures: the ceiling decides the colour, never what the reader is told", () => {
  it("covers every combination, including the three-flag case (anti-vacuity)", () => {
    expect(ALL_COMBINATIONS).toHaveLength(8);
    expect(
      ALL_COMBINATIONS.filter((c) => urgentCount(c) === 3),
      "no combination sets all three, so the case this guard exists for is never exercised",
    ).toHaveLength(1);
  });

  it("never flags more tiles than WardFigureStrip permits, so the strip cannot throw", () => {
    for (const conditions of ALL_COMBINATIONS) {
      const { flagged } = urgentFigureFlags(conditions);
      expect(
        flagged.size,
        `${JSON.stringify(conditions)} flags ${flagged.size} tiles; WardFigureStrip throws above ${URGENT_FIGURE_FLAG_CEILING} and the patient page would crash`,
      ).toBeLessThanOrEqual(URGENT_FIGURE_FLAG_CEILING);
    }
  });

  it("accounts for EVERY urgent fact — flagged or named, never silently dropped", () => {
    /*
     * This is the assertion the old code failed. It is stated over the COUNT rather than over any
     * particular key, so it survives a reordering and cannot be satisfied by moving the loss around.
     */
    for (const conditions of ALL_COMBINATIONS) {
      const { flagged, withheldFlags } = urgentFigureFlags(conditions);
      expect(
        flagged.size + withheldFlags.length,
        `${JSON.stringify(conditions)}: ${urgentCount(conditions)} facts are urgent but only ` +
          `${flagged.size} are flagged and ${withheldFlags.length} are named — the difference is a signal the ` +
          "screen drops without telling anybody, which is the defect this guard exists for",
      ).toBe(urgentCount(conditions));
    }
  });

  it("says nothing extra when everything urgent already fits", () => {
    for (const conditions of ALL_COMBINATIONS.filter((c) => urgentCount(c) <= URGENT_FIGURE_FLAG_CEILING)) {
      const { withheldFlags } = urgentFigureFlags(conditions);
      expect(
        withheldFlags,
        `${JSON.stringify(conditions)} fits inside the ceiling, so the page must not add a note about a signal it did not withhold`,
      ).toEqual([]);
    }
  });

  it("names the withheld fact in words a coordinator can act on, never a key", () => {
    const { withheldFlags } = urgentFigureFlags({ deadlineBreached: true, declined: true, pullExpired: true });
    expect(withheldFlags).toHaveLength(1);
    const [withheld] = withheldFlags;
    expect(withheld, "the withheld signal is reported as a bare key rather than a sentence").not.toMatch(
      /^(deadline|declines|pull)$/u,
    );
    expect(withheld!.length, `"${withheld}" is too short to tell a coordinator what is wrong`).toBeGreaterThan(15);
  });

  it("OWNER RULING 2026-09-06 — with all three urgent, the expired hold yields and the declines keep their amber", () => {
    /*
     * ⚠️ This is the only order-dependent assertion in the file, and it is deliberately alone.
     * It records a decision, not a property: a refusal is a fact a coordinator must act on, whereas
     * an expired hold is usually already known to whoever let it expire. **If the owner rules
     * differently, change THIS test and leave the four above untouched** — they hold under any
     * ordering, and that separation is what stops a future reorder from quietly restoring the
     * silent-drop behaviour.
     */
    const { flagged, withheldFlags } = urgentFigureFlags({
      deadlineBreached: true,
      declined: true,
      pullExpired: true,
    });
    expect(flagged.has("deadline")).toBe(true);
    expect(flagged.has("declines")).toBe(true);
    expect(flagged.has("pull")).toBe(false);
    expect(withheldFlags[0]).toContain("hold on the bed");
  });
});
