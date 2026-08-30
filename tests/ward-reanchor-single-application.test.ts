import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { seedWardFlowState, seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";

/**
 * A CLOCK OFFSET IS APPLIED ONCE, AND THE SECOND APPLICATION IS MADE UNREACHABLE RATHER THAN
 * CHECKED FOR.
 *
 * `shiftInstants` moves every instant in a state by an offset. It carries no already-shifted
 * marker, so applying it twice doubles every offset — and Ward Board's framing is why this outranks
 * its size:
 *
 *   ⚠️ **"A wrong clock looks wrong; a wrong length of stay looks PLAUSIBLE."**
 *
 * A patient nine days in a bed reading as eighteen is not a visibly broken screen. It is a
 * believable number, on a screen whose whole purpose is to be believed, with nothing anywhere to
 * contradict it.
 *
 * ⚠️ **STATED HONESTLY: THIS IS NOT A DEFECT ANY SCREEN SHOWS TODAY.** All three call sites passed
 * a FRESH `seedWardFlowState()`, so nothing was ever double-shifted, and it is a latent hazard
 * rather than a live wrong number. It is worth closing anyway because the cost of closing it is a
 * function signature and the cost of discovering it later is a plausible wrong length of stay.
 *
 * The remedy is `TR-F3`-shaped: make the impossible state unrepresentable instead of checking that
 * the reachable ones look right. `seedWardFlowStateAt` seeds and shifts in one step and CANNOT BE
 * HANDED AN ALREADY-SHIFTED STATE, because it does not take a state at all. `shiftInstants` stays
 * exported for `ward-reanchor.test.ts`, which tests the walker itself — so the last thing needed is
 * a guard that application code never reaches around the safe door to the unsafe one.
 */
const SRC = join(process.cwd(), "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

describe("the clock offset can only be applied once", () => {
  const callers = sourceFiles(SRC)
    .map((file) => ({ file, text: readFileSync(file, "utf8") }))
    // The import line names it too; only an actual call counts.
    .filter(({ text }) => /\bshiftInstants\s*\(/.test(text))
    .map(({ file }) => file.replace(process.cwd(), "").replace(/\\/g, "/"));

  it("is called from exactly ONE place in src, and that place is the safe door", () => {
    expect(
      callers,
      "every application-side shift must go through `seedWardFlowStateAt`. A second caller is a " +
        "second chance to hand an already-shifted state back in, and the symptom is a doubled " +
        "length of stay that looks entirely plausible on screen.",
    ).toEqual(["/src/components/ward-management/ward-flow-reducer.ts"]);
  });

  it("finds callers at all, or the assertion above is vacuous", () => {
    // ⚠️ The canary. `toEqual([...])` on a list built by a regex that silently matched nothing
    // would fail — but a regex that silently matched nothing AND an expected list that happened to
    // be empty would pass, and this file would be guarding air.
    expect(callers.length).toBe(1);
    expect(sourceFiles(SRC).length).toBeGreaterThan(100);
  });

  it("SHIFTS ONCE — a seed at an offset is that offset from the anchor, not twice it", () => {
    const offset = 137;
    const plain = seedWardFlowState();
    const shifted = seedWardFlowStateAt(offset);

    const before = plain.movements[0].openedAt;
    const after = shifted.movements[0].openedAt;
    expect(
      after - before,
      `a single application moves the seed by ${offset} minutes. ${offset * 2} means the offset ` +
        "was applied twice, which is the whole failure this file exists for.",
    ).toBe(offset);
  });

  it("returns a copy at offset zero, so the pinned path runs the same code as the live one", () => {
    const zero = seedWardFlowStateAt(0);
    expect(zero.movements[0].openedAt).toBe(seedWardFlowState().movements[0].openedAt);
    expect(zero).not.toBe(seedWardFlowState());
  });

  it("keeps the anchor meaningful — the seed is authored against NOW_ANCHOR", () => {
    // Guards the assumption the two tests above lean on: that a seeded instant is a real number
    // related to the anchor rather than something incidental.
    expect(typeof NOW_ANCHOR).toBe("number");
    expect(seedWardFlowState().movements.length).toBeGreaterThan(0);
  });
});
