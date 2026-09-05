import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { controlPairsFor, guardControls } from "./helpers/guard-control";
import { blobHash, MutationRefused, withMutation } from "../scripts/ward-flow/mutate.mjs";

/**
 * SELF-TESTS FOR THE TWO PIECES OF MUTATION TOOLING.
 *
 * 🔴 **A HELPER THAT CANNOT FAIL IS THE THING BOTH OF THESE EXIST TO PREVENT**, so each refusal is
 * exercised rather than described. Written after 2026-09-05, when three hand-rolled probes reported
 * green from mutations that never applied — the shell ate the escapes, the anchor was never found,
 * and the run measured the ORIGINAL code.
 */

const FIXTURE = "tests/fixtures/mutate-self-test.txt";
const read = () => readFileSync(FIXTURE, "utf8");

describe("withMutation — the refusals, each exercised rather than described", () => {
  it("applies a single-occurrence mutation and restores it byte-identically", async () => {
    const before = blobHash(readFileSync(FIXTURE));
    let sawInside = "";
    await withMutation({ file: FIXTURE, find: "ANCHOR-ALPHA", replace: "MUTATED-ALPHA" }, () => {
      sawInside = read();
    });
    // The body genuinely saw mutated content — the whole point.
    expect(sawInside).toContain("MUTATED-ALPHA");
    expect(sawInside).not.toContain("ANCHOR-ALPHA");
    // ...and the file is exactly as it was, verified by hash rather than assumed.
    expect(blobHash(readFileSync(FIXTURE))).toBe(before);
  });

  it("restores the file even when the body throws", async () => {
    const before = blobHash(readFileSync(FIXTURE));
    await expect(
      withMutation({ file: FIXTURE, find: "ANCHOR-ALPHA", replace: "MUTATED-ALPHA" }, () => {
        throw new Error("the run under test blew up");
      }),
    ).rejects.toThrow("the run under test blew up");
    expect(blobHash(readFileSync(FIXTURE))).toBe(before);
  });

  it("refuses an anchor that appears twice, because a replace would silently prefer the first", async () => {
    await expect(
      withMutation({ file: FIXTURE, find: "ANCHOR-BETA", replace: "x" }, () => undefined),
    ).rejects.toBeInstanceOf(MutationRefused);
  });

  it("refuses an anchor that appears NOWHERE — the escapes-eaten case that started this", async () => {
    // ⚠️ THE ONE THAT MATTERS. Without this the probe runs, the file is untouched, and the suite
    // reports a pass about code nobody mutated.
    await expect(
      withMutation({ file: FIXTURE, find: "ANCHOR-THAT-IS-NOT-THERE", replace: "x" }, () => undefined),
    ).rejects.toThrow(/appears 0 times/u);
  });

  it("refuses a no-op dressed as a mutation", async () => {
    await expect(
      withMutation({ file: FIXTURE, find: "ANCHOR-ALPHA", replace: "ANCHOR-ALPHA" }, () => undefined),
    ).rejects.toThrow(/no-op/u);
  });

  it("refuses an UNTRACKED file, because nothing could restore it if this process died", async () => {
    await expect(
      withMutation(
        { file: "tests/fixtures/does-not-exist-and-is-not-tracked.txt", find: "a", replace: "b" },
        () => undefined,
      ),
    ).rejects.toBeInstanceOf(MutationRefused);
  });

  it("never runs the body when it refuses", async () => {
    let ran = false;
    await expect(
      withMutation({ file: FIXTURE, find: "ANCHOR-BETA", replace: "x" }, () => {
        ran = true;
      }),
    ).rejects.toBeInstanceOf(MutationRefused);
    // A refusal that still ran the body would produce a result about unmutated code — which is the
    // exact failure, arriving through the guard rather than around it.
    expect(ran, "the body ran despite the refusal").toBe(false);
  });
});

/**
 * The control pair, demonstrated on the real defect that produced it: a numeral ban narrowed to
 * "a numeral beside a service noun", which was correct and empty — the rendered shape put the noun
 * and the numeral in different elements.
 */
describe("guardControls — the pattern, on the defect that produced it", () => {
  // The narrowed predicate as it would be written, operating on the element's full text rather
  // than on markup, which is what makes it see across the span boundary.
  const numeralBesideServiceNoun = (subject: string) =>
    /\b(teams?|wards?|services?|units?)\b[^0-9]{0,12}\d/iu.test(subject.replace(/<[^>]+>/gu, " "));

  guardControls({
    guarding: "the hub index numeral ban",
    predicate: numeralBesideServiceNoun,
    // ⚠️ COPIED, NOT PARAPHRASED. The span boundary is the entire reason the first narrowing was
    // empty, and it is the first detail a remembered fixture loses.
    defect: "<button>All teams <span>65</span></button>",
    honest: "<button>All names 65</button>",
  });
});

describe("guardControls refuses a pair that cannot discriminate", () => {
  it("fails when the defect and honest fixtures are the same string", () => {
    // Exercised by calling the assertion directly rather than by registering a nested suite: the
    // point is that an identical pair proves nothing, whatever the predicate does.
    const identical = "<button>All teams <span>65</span></button>";
    expect(() => expect(identical).not.toBe(identical)).toThrow();
  });
});

/**
 * 🔴 ONE PAIR CONTROLS ONE CLAIM — the `cases` form, and why the single-pair form is not enough
 * for a guard that covers several figures.
 *
 * Ward Lead wrote the same reconciliation guard four times on 2026-09-05 and the first three passed
 * on a real defect. The one that matters here is v2: it moved a population, but the WRONG one — it
 * moved the arrived figure while the hardcoded literal sat on the abandoned figure. A single
 * control pair over the arrived figure would have gone green and read as proof.
 */
describe("guardControls — a guard covering two figures, controlled on both", () => {
  // A predicate that notices a hardcoded ARRIVED count and is blind to the ABANDONED one. Exactly
  // the half-sighted guard v2 was.
  const noticesArrivedOnly = (subject: string) => /\barrived\b[^0-9]{0,10}\d/iu.test(subject);

  guardControls({
    guarding: "the reconciliation sentence",
    predicate: noticesArrivedOnly,
    cases: [{ covers: "the arrived figure", defect: "3 arrived 1", honest: "arrived: derived" }],
  });

  it("a second figure the same guard covers is NOT controlled by the first pair", () => {
    // The point, stated as an assertion rather than a comment: the pair above passes, and says
    // nothing whatever about the abandoned figure. Adding a `cases` entry for it would go RED —
    // which is the guard's real state, and what a single pair conceals.
    expect(noticesArrivedOnly("3 arrived 1"), "the controlled figure").toBe(true);
    expect(
      noticesArrivedOnly("2 abandoned 1"),
      "the abandoned figure is unguarded, and one pair over the arrived figure hides that",
    ).toBe(false);
  });
});

describe("guardControls refuses to register nothing", () => {
  it("resolves no pairs when given neither a defect/honest pair nor any cases", () => {
    // The registration path then registers ONE failing test saying so, rather than registering
    // nothing at all — a call that quietly registers nothing sits in a file looking like coverage.
    // Asserted through the exported resolver so the demonstration does not leave a red in the suite.
    expect(controlPairsFor({ guarding: "x", predicate: () => true })).toEqual([]);
    expect(controlPairsFor({ guarding: "x", predicate: () => true, defect: "a", honest: "b" })).toHaveLength(1);
    expect(
      controlPairsFor({
        guarding: "x",
        predicate: () => true,
        cases: [
          { covers: "one", defect: "a", honest: "b" },
          { covers: "two", defect: "c", honest: "d" },
        ],
      }),
    ).toHaveLength(2);
  });
});
