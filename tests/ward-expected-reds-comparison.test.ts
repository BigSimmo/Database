import { describe, expect, it } from "vitest";

// The gate script is plain .mjs. Its pure half is imported rather than re-implemented here: a
// control that re-writes the logic it checks proves only that two copies agree.
import { compareFailingSet, floorBreaches } from "../scripts/check-ward-expected-reds.mjs";

/**
 * THE CONTROL FOR THE EXPECTED-RED GATE, AND IT EXISTS BECAUSE ONE OF ITS TWO DIRECTIONS NEVER
 * FIRES IN NORMAL USE.
 *
 * "An unexpected red fails the gate" is easy to believe, easy to check, and fires the first time
 * anybody breaks anything. **"An entry that STOPS failing also fails the gate" fires only on a day
 * when everything looks like it is going right** — which is precisely the day it is needed, and
 * precisely why it cannot be left to a habit or a hand-run.
 *
 * 🔴 **IT IS THE PROPERTY THAT WOULD HAVE CAUGHT THE INCIDENT THIS GATE WAS COMMISSIONED FOR.** On
 * 2026-09-06 a deliberate red was retired under CI pressure, using a builder's open position quoted
 * as though it were the owner's ruling. **The suite went green and thanked whoever did it.** Nothing
 * in the repository objected, because nothing was watching that direction.
 *
 * ⚠️ **AND IT IS THE PROPERTY AN `it.fails` TRIPWIRE STRUCTURALLY CANNOT GIVE**, which is the whole
 * argument for a pinned list over a converted test: `it.fails` passes on ANY error including a typo
 * in the test body, and keeps passing after the defect is fixed. It converts a visible red into an
 * invisible green — the opposite of what is wanted.
 *
 * The gate's own comparison is imported rather than re-implemented here. A control that re-writes
 * the logic it is checking proves only that two copies agree.
 */

describe("the expected-red comparison, in both directions", () => {
  it("an unexpected red is reported — the direction everyone tests", () => {
    const { unexpected, recovered } = compareFailingSet({
      failing: [{ file: "tests/ward-a.test.ts", count: 1 }],
      expected: [],
    });
    expect(unexpected).toEqual(["tests/ward-a.test.ts"]);
    expect(recovered).toEqual([]);
  });

  it("🔴 AN ENTRY THAT STOPS FAILING IS REPORTED — the direction that only fires on a good day", () => {
    const { unexpected, recovered } = compareFailingSet({
      failing: [],
      expected: [{ file: "tests/ward-a.test.ts", failing: 1 }],
    });
    expect(
      recovered,
      "a manifest entry that is no longer failing was NOT reported. This is the direction the gate " +
        "was commissioned for: a red retired quietly, by a green nobody questioned. Without it this " +
        "gate is an ordinary failure check wearing a manifest.",
    ).toEqual(["tests/ward-a.test.ts"]);
    expect(unexpected).toEqual([]);
  });

  it("says nothing when the two sets match, including when both are empty", () => {
    expect(compareFailingSet({ failing: [], expected: [] })).toEqual({ unexpected: [], recovered: [], miscounted: [] });
    expect(
      compareFailingSet({
        failing: [{ file: "tests/ward-a.test.ts", count: 1 }],
        expected: [{ file: "tests/ward-a.test.ts", failing: 1 }],
      }),
    ).toEqual({ unexpected: [], recovered: [], miscounted: [] });
  });

  it("reports both directions at once rather than stopping at the first", () => {
    // A run can easily do both — one red fixed, another appearing — and a gate that reported only
    // the first would send somebody to look at half the change.
    const { unexpected, recovered } = compareFailingSet({
      failing: [{ file: "tests/ward-new.test.ts", count: 1 }],
      expected: [{ file: "tests/ward-old.test.ts", failing: 1 }],
    });
    expect(unexpected).toEqual(["tests/ward-new.test.ts"]);
    expect(recovered).toEqual(["tests/ward-old.test.ts"]);
  });

  /*
   * 🔴 THE VACUITY HALF. With an empty manifest — the state this ships in — set equality alone is
   * satisfied by a run that did nothing at all: discover no files, execute no tests, fail nothing,
   * and `{} === {}` reports success. The floors are what stop that, so they get their own control.
   */
  it("a run that discovered or executed almost nothing is refused, not passed", () => {
    expect(
      floorBreaches({ files: 0, filesRan: 0, tests: 0 }, { files: 200, tests: 2500 }),
      "a run that walked no files and executed no tests was accepted. Against an empty manifest that " +
        "is a clean green over nothing, which is the failure mode this gate is most likely to have.",
    ).toHaveLength(2);

    expect(floorBreaches({ files: 3, filesRan: 3, tests: 4000 }, { files: 200, tests: 2500 })).toEqual([
      "files 3 < 200",
    ]);
    expect(floorBreaches({ files: 286, filesRan: 286, tests: 12 }, { files: 200, tests: 2500 })).toEqual([
      "tests 12 < 2500",
    ]);
    expect(floorBreaches({ files: 286, filesRan: 286, tests: 3629 }, { files: 200, tests: 2500 })).toEqual([]);
  });

  /*
   * 🔴 THE DROPPED-FILE CASE, AND IT IS THE ONE THIS GATE ALMOST SHIPPED WITHOUT. Found by Ward
   * Builder Three reviewing the script rather than my description of it.
   *
   * The first version floored on files DISCOVERED and tests EXECUTED, and never checked that the
   * files it asked for came back. This machine dropped test files three times in one night — batches
   * printing a normal summary having silently not run five, and once two. With files dropped, enough
   * tests still run to clear the sum floor, a dropped file that WOULD have failed is simply absent
   * from the failing set, and if it is not in the manifest its red vanishes and the gate reports OK.
   *
   * **A floor on a SUM cannot catch this, because a sum survives losing members.**
   */
  it("🔴 files that were asked for and did not come back are refused", () => {
    expect(
      floorBreaches({ files: 286, filesRan: 281, tests: 3600 }, { files: 200, tests: 2500 }),
      "five files were dropped from the run and the gate accepted it. A red inside a dropped file is " +
        "absent rather than reported — so a NEW failure would be silently absorbed, which is the one " +
        "thing this gate exists to prevent.",
    ).toEqual(["asked for 286 files, 281 came back — 5 dropped"]);

    // And a complete run of the same size is not flagged, or the check would fire constantly and be
    // switched off — the usual fate of a check that cries wolf.
    expect(floorBreaches({ files: 286, filesRan: 286, tests: 3600 }, { files: 200, tests: 2500 })).toEqual([]);
  });

  /*
   * The count half of Three's fix: a second red inside a file that is ALREADY listed. Keying on file
   * alone, this is invisible — the new failure hides inside an entry somebody already approved.
   */
  it("a NEW red inside an already-listed file is reported, not absorbed", () => {
    const { unexpected, recovered, miscounted } = compareFailingSet({
      failing: [{ file: "tests/ward-a.test.ts", count: 2 }],
      expected: [{ file: "tests/ward-a.test.ts", failing: 1 }],
    });
    expect(unexpected, "the file is listed, so it is correctly not 'unexpected'").toEqual([]);
    expect(recovered).toEqual([]);
    expect(
      miscounted,
      "a listed file went from one failing test to two and nothing objected. A manifest entry " +
        "sanctions the reds it records, not any number of them.",
    ).toEqual([{ file: "tests/ward-a.test.ts", expected: 1, actual: 2 }]);
  });
});
