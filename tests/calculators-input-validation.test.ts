import { describe, expect, it } from "vitest";

import { calculators } from "@/lib/calculators/calculator-fixtures";
import { deriveCalculator, isValidAnswer, itemScore, type AnswerMap } from "@/components/calculators/calculator-ui";

/**
 * `deriveCalculator` is exported and shared by every calculator surface, so it — not whichever
 * caller happens to be well behaved — is where a malformed answer map has to be rejected.
 *
 * The defect this file pins: `itemScore` fell back to 0 for any value it could not resolve, and
 * completion asked only whether a value was `!== undefined`. An out-of-range option index
 * therefore counted as an answered item scoring 0, and once every item was "answered" that way a
 * final band was published off values the instrument cannot carry.
 */
const auditc = calculators.find((calc) => calc.id === "auditc");
const cage = calculators.find((calc) => calc.id === "cage");

const OPTION_ITEM = {
  id: "a1",
  kind: "options" as const,
  text: "x",
  options: [
    { label: "Never", short: "0", points: 0 },
    { label: "Monthly", short: "1", points: 1 },
  ],
};
const CHECKBOX_ITEM = { id: "c1", kind: "checkbox" as const, text: "x", points: 1 };

describe("answer validity", () => {
  it.each([
    ["unanswered", undefined, true],
    ["first option", 0, true],
    ["last option", 1, true],
    ["index past the last option", 2, false],
    ["negative index", -1, false],
    ["fractional index", 0.5, false],
    ["NaN", Number.NaN, false],
    ["Infinity", Number.POSITIVE_INFINITY, false],
    ["-Infinity", Number.NEGATIVE_INFINITY, false],
  ])("treats %s on an options item as valid=%s", (_label, selection, expected) => {
    expect(isValidAnswer(OPTION_ITEM, selection as number | undefined)).toBe(expected);
  });

  it.each([
    ["explicit No", 0, true],
    ["explicit Yes", 1, true],
    ["any other integer", 2, false],
    ["negative", -1, false],
    ["fractional", 0.5, false],
    ["NaN", Number.NaN, false],
  ])("treats %s on a checkbox item as valid=%s", (_label, selection, expected) => {
    expect(isValidAnswer(CHECKBOX_ITEM, selection as number | undefined)).toBe(expected);
  });

  it("scores a malformed value as zero rather than guessing", () => {
    expect(itemScore(OPTION_ITEM, 9)).toBe(0);
    expect(itemScore(CHECKBOX_ITEM, 7)).toBe(0);
  });
});

describe("a malformed answer map never completes an instrument", () => {
  it("does not treat an out-of-range option index as an answered item", () => {
    expect(auditc).toBeDefined();
    if (!auditc) return;
    const answers: AnswerMap = { a1: 1, a2: 1, a3: 99 };
    const derived = deriveCalculator(auditc, answers);

    expect(derived.invalid).toBe(true);
    expect(derived.invalidItemIds).toEqual(["a3"]);
    expect(derived.complete).toBe(false);
    expect(derived.band).toBeUndefined();
    expect(derived.result.label).toBe("Invalid entry");
    // The two valid answers must not be counted toward completion either, because a partly
    // malformed map is not a partly finished assessment.
    expect(derived.answeredCount).toBe(2);
  });

  it("rejects an answer keyed to an item this instrument does not have", () => {
    expect(auditc).toBeDefined();
    if (!auditc) return;
    const derived = deriveCalculator(auditc, { a1: 0, a2: 0, a3: 0, notAnItem: 1 } as AnswerMap);

    expect(derived.invalid).toBe(true);
    expect(derived.complete).toBe(false);
    expect(derived.band).toBeUndefined();
  });

  it("rejects a checkbox value that is neither an explicit Yes nor an explicit No", () => {
    expect(cage).toBeDefined();
    if (!cage) return;
    const answers = Object.fromEntries(cage.items.map((item) => [item.id, 0])) as AnswerMap;
    answers[cage.items[0].id] = 3;
    const derived = deriveCalculator(cage, answers);

    expect(derived.invalid).toBe(true);
    expect(derived.complete).toBe(false);
    expect(derived.result.label).toBe("Invalid entry");
  });

  it("still completes and bands a fully valid answer map", () => {
    expect(auditc).toBeDefined();
    if (!auditc) return;
    const derived = deriveCalculator(auditc, { a1: 1, a2: 1, a3: 1 });

    expect(derived.invalid).toBe(false);
    expect(derived.complete).toBe(true);
    expect(derived.score).toBe(3);
    expect(derived.band?.label).toBe("At the threshold for women");
  });

  it("keeps a valid safety flag visible while the assessment is invalid", () => {
    const phq9 = calculators.find((calc) => calc.id === "phq9");
    expect(phq9).toBeDefined();
    if (!phq9) return;
    const flagged = phq9.items.find((item) => item.flag);
    expect(flagged).toBeDefined();
    if (!flagged) return;

    const derived = deriveCalculator(phq9, { [flagged.id]: 3, p1: 99 } as AnswerMap);
    expect(derived.invalid).toBe(true);
    expect(derived.flags).toContain(flagged.flag);
  });

  it("stays started so the entry can be cleared and the invalid label renders", () => {
    // Consumers gate the Clear button (`disabled={!derived.started}`) and the result pill
    // (`derived.started ? derived.result.label : "Not started"`) on this flag. An invalid entry
    // that reported `started: false` would tell the user to clear it while disabling Clear.
    expect(auditc).toBeDefined();
    if (!auditc) return;
    const derived = deriveCalculator(auditc, { a1: 99 } as AnswerMap);

    expect(derived.invalid).toBe(true);
    expect(derived.started).toBe(true);
    expect(derived.result.label).toBe("Invalid entry");
  });

  it("is not started when nothing has been entered at all", () => {
    expect(auditc).toBeDefined();
    if (!auditc) return;
    const derived = deriveCalculator(auditc, {});

    expect(derived.started).toBe(false);
    expect(derived.invalid).toBe(false);
    expect(derived.result.label).toBe("Incomplete");
  });

  it("publishes no score in the copyable summary while the map is malformed", async () => {
    const { formatResultSummary } = await import("@/components/calculators/calculator-ui");
    expect(auditc).toBeDefined();
    if (!auditc) return;
    const summary = formatResultSummary(auditc, deriveCalculator(auditc, { a1: 99 } as AnswerMap));

    expect(summary).toContain("Invalid entry");
    expect(summary).not.toMatch(/\d+\/12/);
  });
});
