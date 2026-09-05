import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 🔴 **A TEST CAN OUTLIVE THE SCREEN IT TESTS, AND NOTHING GOES RED WHEN IT DOES.**
 *
 * Found during the 2026-09-05 fold, and it was created BY that fold rather than by anyone's
 * mistake. Ward Builder Two replaced two `WardModeWorkspace` modes with their own screens and
 * re-pointed the routes: `/mockups/ward-flow/capacity` now renders `CapacityScreen`, and
 * `/mockups/ward-flow/movements` renders `MovementsScreen`. Both changes are improvements and both
 * merged cleanly.
 *
 * **What merged just as cleanly was four test files still rendering `<WardModeWorkspace
 * mode="capacity" />` — a surface no route reaches any more.** Measured at the fold: zero
 * production callers for that mode, four test files exercising it. Those tests do not fail. They
 * cannot fail. They pass forever, describing a screen no user can open, while the screen a user
 * DOES open carries a fraction of the coverage — and the suite's total stays reassuringly high the
 * whole time.
 *
 * ⚠️ **THE DANGEROUS HALF IS NOT THE WASTED TESTS. IT IS THE CLINICAL GUARDS AMONG THEM.**
 * `ward-capacity-freshness-source.dom.test.tsx` and `ward-capacity-sexmix-release.dom.test.tsx`
 * assert real safety properties — that a capacity figure says who confirmed it, and that a sex-mix
 * note fires when occupancy and the recorded mix disagree. **Pointed at a dead surface, those are
 * green statements about a screen nobody sees.** A reader counting green ticks concludes the live
 * capacity screen has freshness attribution. Nothing tells them otherwise.
 *
 * This guard is deliberately about REACHABILITY, not about wording, structure or coverage counts,
 * so a redesign that moves a mode to its own screen does not fight it — it just has to say so here.
 */

const ROOT = process.cwd();
const MODE_PATTERN = /WardModeWorkspace\s+mode=["']([a-z-]+)["']/gu;

function walk(dir: string, keep: (path: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path, keep));
    else if (keep(path)) out.push(path);
  }
  return out;
}

/*
 * ⚠️ **COMMENTS ARE STRIPPED, AND THIS GUARD INVENTED A FALSE ORPHAN BEFORE THEY WERE (2026-09-05).**
 *
 * The moment somebody documented this guard properly — a comment in `ward-delays-screen.dom.test.tsx`
 * explaining that a vocabulary pin had been carried across FROM `<WardModeWorkspace mode="exceptions" />`
 * — the scan matched the literal inside that prose and reported the delays screen as rendering an
 * unreachable mode. **A file that renders nothing was named as an offender because it described the
 * problem accurately.**
 *
 * ⚠️ **THE FAILURE DIRECTION IS WHAT MAKES THIS WORTH A COMMENT OF ITS OWN.** A guard that invents a
 * violation trains people to distrust it and, eventually, to widen it until the real cases fall out —
 * and it punishes exactly the behaviour this project wants, which is writing down why a test points
 * where it points. **A mention is not a render.**
 *
 * Stripping is the right answer HERE specifically because the question is "does this file render the
 * mode", and commented-out code renders nothing. That is not a general licence: `ward-statistics-sections`
 * deliberately does NOT strip, because its assertions are about the source RECORD rather than about
 * what executes, and a pin there guards that difference.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//gu, " ").replace(/\/\/[^\n]*/gu, " ");
}

function modesRenderedIn(files: readonly string[]): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of files) {
    const source = withoutComments(readFileSync(file, "utf8"));
    for (const match of source.matchAll(MODE_PATTERN)) {
      const mode = match[1];
      // De-duplicated: a file rendering the same mode nine times is one file to go and fix, and a
      // failure message that repeats it nine times buries the other modes below it.
      const seen = found.get(mode) ?? [];
      if (!seen.includes(file)) found.set(mode, [...seen, file]);
    }
  }
  return found;
}

describe("every ward mode a test renders is a mode a user can still reach", () => {
  const isSource = (path: string) => /\.tsx?$/u.test(path);
  const productionModes = modesRenderedIn(walk(join(ROOT, "src"), isSource));
  const testedModes = modesRenderedIn(walk(join(ROOT, "tests"), isSource));

  it("finds the surface at all, so a rename cannot make this guard vacuous", () => {
    /*
     * ⚠️ The floor is on the POPULATION WALKED, never on the number of violations. A floor on the
     * findings goes red the moment somebody does the right thing and fixes them all — which trains
     * the next person to delete the guard. This one asks only whether the scan still sees the thing
     * it is scanning for.
     */
    expect(
      testedModes.size + productionModes.size,
      'no file anywhere renders `WardModeWorkspace mode="..."`, so the scan below is measuring ' +
        "nothing. Either the component was renamed — re-derive MODE_PATTERN against its new name — " +
        "or it is genuinely gone and this whole file should go with it.",
    ).toBeGreaterThan(0);
  });

  it("renders no mode in tests that no route or component renders in production", () => {
    const orphans = [...testedModes.entries()].filter(([mode]) => !productionModes.has(mode));

    /*
     * The message names the mode, the files, and WHAT TO DO — because the honest resolution is
     * usually "re-point these at the new screen", not "delete them". Two of the files this first
     * caught assert clinical properties (freshness attribution, the sex-mix mismatch note) that the
     * replacement screen may not carry at all; deleting them would silently drop the question of
     * whether the new screen needs them.
     */
    expect(
      orphans.map(
        ([mode, files]) => `${mode}: ${files.map((f) => f.replace(ROOT, "").replace(/\\/gu, "/")).join(", ")}`,
      ),
      "These tests render a WardModeWorkspace mode that NOTHING in `src/` renders any more, so they " +
        "pass forever while describing a screen no user can open. This is normal after a mode moves " +
        "to its own screen — it is not a broken test. Re-point each one at the replacement screen, " +
        "and where it asserts a clinical property, decide deliberately whether the replacement needs " +
        "that property before dropping the assertion.",
    ).toEqual([]);
  });
});
