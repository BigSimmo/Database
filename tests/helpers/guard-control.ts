import { expect, it } from "vitest";

/**
 * A POSITIVE AND A NEGATIVE CONTROL FOR A GUARD, SEEDED FROM THE DEFECT IT WAS WRITTEN FOR.
 *
 * 🔴 **THE FAILURE THIS EXISTS FOR, MEASURED ON 2026-09-05.** A guard forbidding a numeral in a
 * hub index kept firing after the copy was honestly corrected, because it forbade every digit
 * rather than the claim. It was narrowed to its own stated property — a numeral paired with a
 * *service* noun — which is the right narrowing. **The narrowed guard was then GREEN on the
 * original defect**, because the rendered shape was
 * `<button>All teams <span>65</span></button>`: noun and numeral in different elements, so the
 * predicate could never match. A correct narrowing, and an empty one.
 *
 * Ward Lead's rule, which this is the mechanical form of:
 *
 *     After narrowing any guard, re-run the original defect.
 *     A narrowing that goes green on it is worse than the over-broad version it replaced.
 *
 * As a discipline that depends on somebody remembering. As two tests beside the guard, it re-runs
 * on every change and cannot be forgotten — which is the difference that mattered, because the
 * mutation harness meant to catch this was bypassable and a test beside the assertion is not.
 *
 * ⚠️ **ITS OWN FAILURE MODE, AND IT IS NOT A FREE WIN.** The fixture is a snippet somebody writes
 * from memory of the defect, and a snippet that does not reproduce the defect faithfully gives a
 * positive control that passes for the wrong reason — the worst kind, because it reads as proof.
 * **Copy the actual rendered shape; do not paraphrase it.** The `<span>` boundary above is exactly
 * the detail a remembered version smooths away, and smoothing it away turns this helper into
 * decoration.
 *
 * Usage, inside a `describe`:
 *
 *     guardControls({
 *       guarding: "the hub index numeral ban",
 *       predicate: (html) => NUMERAL_BESIDE_SERVICE_NOUN.test(html),
 *       defect: "<button>All teams <span>65</span></button>",   // copied from the real render
 *       honest: "<button>All names 65</button>",
 *     });
 */
/**
 * 🔴 **ONE PAIR CONTROLS ONE CLAIM. A GUARD COVERING N FIGURES NEEDS N PAIRS.**
 *
 * Added after Ward Lead wrote the same guard four times, 2026-09-05, and the first three passed on
 * a real defect:
 *
 *     v1  compared the sentence with the model — but a figure HARDCODED to today's value AGREES
 *         with the model, so a literal `1` stayed green. It could not tell a derivation from a
 *         coincidence.
 *     v2  moved a population — the WRONG one. It moved the arrived figure; the literal was on the
 *         abandoned one.
 *     v3  moved the right population to ZERO and asserted the clause vanished. Green: the literal
 *         sits behind `if (abandoned.length > 0)`, so zero HIDES it rather than exposing it.
 *     v4  a population with TWO. A literal `1` cannot say "2". Red at last.
 *
 * **Each figure needs its own population moved, in a direction where a wrong value MUST be wrong —
 * and zero is not that direction when the clause is conditional on being non-zero.** "Call it with
 * different data" is not one check; it is one per figure.
 *
 * A single pair passed to a guard that covers five figures controls the one and says nothing about
 * the other four, **while reading as though the guard is controlled** — which is the shape this
 * whole helper exists to remove. So `cases` is the honest form; the single-pair shorthand remains
 * for a guard that genuinely covers one claim.
 */
export interface GuardCase {
  /** Which claim this pair controls, named in the test titles. */
  readonly covers: string;
  /** The real defect, copied from what actually rendered. The guard MUST fire on it. */
  readonly defect: string;
  /** The corrected version. The guard must NOT fire on it. */
  readonly honest: string;
}

export interface GuardControls {
  /** Named in both test titles, so a failure says which guard lost its teeth. */
  readonly guarding: string;
  /** The guard's own predicate. `true` means "this guard fires / objects". */
  readonly predicate: (subject: string) => boolean;
  /** The real defect, copied from what actually rendered. The guard MUST fire on it. */
  readonly defect?: string;
  /** The corrected version. The guard must NOT fire on it. */
  readonly honest?: string;
  /** One pair per claim the guard covers. Use this whenever the guard covers more than one. */
  readonly cases?: readonly GuardCase[];
}

/**
 * The pairs a call resolves to. Exported so the empty case can be ASSERTED rather than demonstrated
 * — a demonstration of "this registers a failing test" leaves a failing test in the suite, and a
 * red parked in a file as documentation is how a real red stops being read.
 */
export function controlPairsFor({ guarding, defect, honest, cases }: GuardControls): readonly GuardCase[] {
  if (cases !== undefined) return cases;
  return defect !== undefined && honest !== undefined ? [{ covers: guarding, defect, honest }] : [];
}

export function guardControls(options: GuardControls): void {
  const { guarding, predicate } = options;
  const pairs = controlPairsFor(options);

  if (pairs.length === 0) {
    it(`${guarding} has control fixtures at all`, () => {
      expect(
        pairs.length,
        `guardControls for ${guarding} was given neither a defect/honest pair nor any cases, so it ` +
          "registers no controls and proves nothing.",
      ).toBeGreaterThan(0);
    });
    return;
  }

  for (const pair of pairs) registerPair(guarding, predicate, pair);
}

function registerPair(
  guarding: string,
  predicate: (subject: string) => boolean,
  { covers, defect, honest }: GuardCase,
): void {
  const label = covers === guarding ? guarding : `${guarding} — ${covers}`;
  registerControlPair(label, predicate, defect, honest);
}

function registerControlPair(
  guarding: string,
  predicate: (subject: string) => boolean,
  defect: string,
  honest: string,
): void {
  it(`${guarding} still fires on the defect it was written for`, () => {
    // Anti-vacuity on the CONTROL itself: two identical fixtures cannot discriminate, and a pair
    // that cannot discriminate passes whatever the predicate does.
    expect(
      defect,
      `the defect and honest fixtures for ${guarding} are identical, so this pair proves nothing`,
    ).not.toBe(honest);
    expect(defect.length, `the defect fixture for ${guarding} is empty`).toBeGreaterThan(0);

    expect(
      predicate(defect),
      `${guarding} NO LONGER FIRES on the defect it was written for:\n  ${defect}\n\n` +
        "A narrowing that goes green on the original defect is worse than the over-broad guard it " +
        "replaced — the noise is gone and so is the cover. Widen it back, or record here why this " +
        "defect is now somebody else's guard.",
    ).toBe(true);
  });

  it(`${guarding} does not fire on the corrected version`, () => {
    expect(
      predicate(honest),
      `${guarding} fires on copy that is CORRECT:\n  ${honest}\n\n` +
        "A guard that objects to the fix is the reason guards get deleted, and the honest ones go " +
        "with them in the same tidy-up.",
    ).toBe(false);
  });
}
