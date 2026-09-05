import { describe, expect, it } from "vitest";

import { waitingSplit } from "@/components/ward-management/delays/delays-derivations";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { Movement } from "@/components/ward-management/ward-model";

/**
 * 🔴 **THE DELAYS SCREEN CRASHES ON THE BEST DAY IT COULD HAVE.**
 *
 * `WardBar` throws when every segment is zero — deliberately, because an empty rail reads as a
 * loading state rather than as "nothing in any category". `delays-screen.tsx` renders
 *
 *     <WardBar segments={split} caption={`${open.length} people waiting`} />
 *
 * with NO guard around it, and `waitingSplit` returns three zero-valued segments whenever no
 * movement is open. So when nobody is waiting in any emergency department, the screen throws.
 *
 * ⚠️ **NOBODY WAITING IS NOT AN EDGE CASE ON THIS SCREEN. IT IS THE GOAL.** Every other state the
 * Delays screen can be in is worse than this one, and it is the only state that kills it.
 *
 * ⚠️ **THIS IS NOT THE INSTANCE THAT WAS REPORTED TO ME.** Ward Builder Two found a single-segment
 * "Freeing today" bar on the capacity screen. That call site no longer exists on any ref — HEAD, the
 * master line, `main` and `origin/main` all return zero matches for it, because it was deleted
 * earlier the same day and the deletion has since been merged. The report was true when written and
 * describes code that is gone. **The class it belongs to was still live, one screen away, and would
 * have been closed as fixed.**
 *
 * **This asserts the reachable path rather than the screen**, because `DelaysScreen` takes no props
 * and reads its movements from the provider, so a test cannot put it in the empty state at all. That
 * is worth saying out loud rather than working around: the screen most exposed to this defect is
 * also the one whose empty state is unreachable from a test. Guarding the two halves — the
 * derivation produces an all-zero split, and the component refuses one — pins the crash without
 * pretending to have rendered it.
 */

const NOW = NOW_ANCHOR;

describe("an all-zero bar is reachable from real derivations, not just in principle", () => {
  it("waitingSplit returns an all-zero split when no movement is open", () => {
    const split = waitingSplit([] as Movement[], NOW);

    // Anti-vacuity: a split with no segments at all would also sum to zero, and would mean this
    // derivation had been rewritten rather than that it produces zeroes.
    expect(split.length, "waitingSplit no longer returns any segments, so this proves nothing").toBeGreaterThan(1);

    expect(
      split.reduce((sum, segment) => sum + segment.value, 0),
      `waitingSplit over no open movements returned ${JSON.stringify(split)}. If it no longer sums to ` +
        "zero, the crash path this file pins has moved and the assertion below is no longer the one to make.",
    ).toBe(0);
  });

  /*
   * EVERY CALL SITE, DERIVED FROM DISK — because the reported instance and the live one were
   * different files, and a test naming one screen would have agreed the class was closed.
   *
   * ⚠️ **THIS DETECTS THE ABSENCE OF A GUARD, NOT THE CORRECTNESS OF ONE, AND THAT IS THE ONLY
   * CLAIM IT MAKES.** Whether a guard is right cannot be read from the source region above a call.
   * The failure that actually happens here is a call site with NO empty case at all — nobody writes
   * a subtly wrong guard for this, they forget one entirely — and that is what goes red.
   */
  it("every WardBar call site handles its empty case", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const { join } = await import("node:path");

    const root = join(process.cwd(), "src/components/ward-management");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (entry.name.endsWith(".tsx")) files.push(path);
      }
    };
    walk(root);

    const callSites = files
      .map((path) => ({ path, source: readFileSync(path, "utf8") }))
      .filter((file) => file.source.includes("<WardBar"))
      .filter((file) => !file.path.endsWith("ward-bar.tsx"));

    // Floor over the POPULATION WALKED, not over what was found: three screens draw this bar, and a
    // matcher that quietly stopped finding them would otherwise report a clean sweep of nothing.
    expect(
      callSites.map((file) => file.path.split(/[\\/]/u).pop()),
      "fewer than three files render a WardBar. Three screens draw it — Delays, Capacity, Movements — " +
        "so either a screen has dropped its bar or this walk has stopped finding them.",
    ).toHaveLength(3);

    /*
     * 🔴 **THE FIRST VERSION OF THIS SCAN WENT FROM A TRUE RED TO A FALSE GREEN, AND BOTH MISTAKES
     * ARE WORTH KEEPING HERE BECAUSE THEY ARE THE TWO STANDARD ONES.**
     *
     * It searched the WHOLE FILE above the call site, for a pattern that included the bare word
     * `none`. `delays-screen.tsx` — which is the unguarded one — matched on the word "none" inside a
     * JSDoc comment nineteen hundred characters earlier, in a note about tables. A comment satisfied
     * a guard about code, and generalising a correct single-file check turned it green.
     *
     * So: comments are stripped, and only the region IMMEDIATELY before the call is read. A guard
     * that decides whether to render a bar is in the JSX right above it — `{x > 0 ? (` or
     * `{x.length === 0 ? (…) : (` — never four hundred lines up.
     */
    const withoutComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//gu, " ").replace(/\/\/[^\n]*/gu, " ");

    const unguarded = callSites
      .filter((file) => {
        const source = withoutComments(file.source);
        const at = source.indexOf("<WardBar");
        const window = source.slice(Math.max(0, at - 400), at);
        return !/\.length === 0|\.length > 0|=== 0 \?|> 0 \?|Tracked \?|isEmpty/u.test(window);
      })
      .map((file) => file.path.split(/[\\/]/u).pop());

    expect(
      unguarded,
      "these screens render a WardBar with nothing handling the empty case, and WardBar THROWS on an " +
        "all-zero total — so the page goes blank rather than degrading. On Delays that state is no " +
        "movement open, which is the best day the screen can have. Per Ward Lead's ruling of 2026-09-06: " +
        "a MEASURED zero is stated in words as none, and the absence sentence is reserved for a genuine " +
        "unknown — so guard at the call site and do not soften the throw.",
    ).toEqual([]);
  });
});
