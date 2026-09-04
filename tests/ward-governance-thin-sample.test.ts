import { describe, expect, it } from "vitest";

import { effectivenessNumbers, MINIMUM_EFFECTIVENESS_SAMPLE } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";

/**
 * A MEDIAN OF ONE IS NOT PUBLISHED, EVEN WITH ITS BASIS BESIDE IT.
 *
 * Owner ruling, 2026-08-30, on the governance board: below a stated minimum a measure reads *"Not
 * enough data to compute"* rather than printing a figure. The screen was rendering
 * **"30 min — from 1 of 27 recorded acceptances"**, and the argument he approved is:
 *
 * > ⚠️ *The word **Median** means "a typical case" to a clinician, and no caveat printed beside it
 * > undoes that — and this is the one page whose entire purpose is being trusted about its limits.*
 *
 * ⚠️ **THIS DOES NOT OVERTURN THE DISCLOSURE RULE, AND THAT DISTINCTION WAS NEARLY LOST.** The
 * component's own comment says a thin sample *"must say so in the same breath as the figure, not in
 * a tooltip or a footnote"*, and it was read by one session as saying suppress. It does not: the
 * tail clause "say nothing rather than guess" attaches to a median **rendered bare**. Disclosure was
 * a repair somebody deliberately made and it STAYS. `from {sampleSize} of {population}` still
 * renders beside every figure that survives the floor. **This adds a floor beneath the rule rather
 * than replacing it** — a question framed as "your code disagrees with itself" would have got a yes
 * from anybody and quietly deleted a considered decision.
 *
 * ✅ **FIVE IS NOW THE OWNER'S TOO — ruled first-hand, 2026-08-30: hide the governance median below
 * five cases.** It had been recorded here as provisional, proposed by a session, precisely so it
 * would be findable rather than inherited. It was findable, it was put to him, and he decided it.
 *
 * ⚠️ **AND IT IS A DISPLAY THRESHOLD, NOT A CLINICAL ONE.** Five is a convention borrowed from
 * health reporting — the point at which a middle value stops describing anything real. It is not
 * derived from this data and not a figure from anywhere else, and he agreed on that stated basis.
 * Written down because it is the kind of number a later reader assumes came from somewhere.
 *
 * ⚠️ **WHAT THE SCREEN DOES TODAY WILL LOOK LIKE A REGRESSION AND IS NOT.** The board publishes
 * "30 min — from 1 of 27 recorded acceptances", so with the floor in place it reads "Not enough
 * data to compute" until more than four computable durations exist. **That is the correct outcome.**
 * Anyone who "fixes" it back has removed the ruling.
 */
describe("the governance board refuses to publish a figure from a thin sample", () => {
  const state = seedWardFlowState();
  const live = effectivenessNumbers(state.movements);

  it("⚠️ IS ACTUALLY EXERCISED BY THE SEED — the acceptance median really is thin", () => {
    // The canary, and it is the reason this file can prove anything. If the seed happened to carry
    // a healthy sample, every assertion below would pass against a board with no floor at all.
    expect(
      live.medianMinutesToAcceptance.sampleSize,
      "the seeded acceptance median must be BELOW the floor, or this file is not testing the floor",
    ).toBeLessThan(MINIMUM_EFFECTIVENESS_SAMPLE);
    expect(live.medianMinutesToAcceptance.population).toBeGreaterThan(live.medianMinutesToAcceptance.sampleSize);
  });

  it("⚠️ STILL COMPUTES IT — the floor is a PUBLISHING rule and is deliberately not applied here", () => {
    // The first version of this file put the floor in the derivation and it was wrong. Suppressing
    // inside `effectivenessNumbers` broke five unit tests that exist to prove the median arithmetic
    // and the `acceptedAt`-over-fallback preference — they feed it two and three movements ON
    // PURPOSE. A publishing rule enforced inside the calculation stops the calculation being
    // testable at the sizes it is interesting at.
    //
    // So the derivation computes and `EffectivenessValue` decides what a reader is shown.
    // `tests/ward-governance.dom.test.tsx` asserts the suppression where it actually happens.
    expect(
      live.medianMinutesToAcceptance.value,
      "the derivation must keep computing honestly, or the maths stops being testable below the floor",
    ).toBeDefined();
  });

  it("KEEPS THE BASIS, because the floor is added beneath the disclosure rule and not instead of it", () => {
    // `sampleSize` and `population` must survive suppression: the screen still says "from 1 of 27"
    // beside "Not enough data to compute", which is what makes the absence informative rather than
    // merely blank.
    expect(live.medianMinutesToAcceptance.sampleSize).toBeGreaterThanOrEqual(0);
    expect(live.medianMinutesToAcceptance.population).toBeGreaterThan(0);
  });

  it("PUBLISHES a median once the sample reaches the floor — the floor is not a blanket refusal", () => {
    // Built from real movements rather than hand-made objects, so this exercises the same path the
    // board does. Without it, "everything is suppressed" would satisfy every assertion above.
    const enough = effectivenessNumbers([
      ...state.movements,
      ...syntheticAcceptances(state.movements, MINIMUM_EFFECTIVENESS_SAMPLE),
    ]);
    expect(
      enough.medianMinutesToAcceptance.sampleSize,
      "the padded fixture must clear the floor, or this test proves the opposite of what it says",
    ).toBeGreaterThanOrEqual(MINIMUM_EFFECTIVENESS_SAMPLE);
    expect(enough.medianMinutesToAcceptance.value).toBeDefined();
  });

  it("applies the same floor to the sibling figure, because it is the same claim on the same board", () => {
    // `averageUnitsContacted` is rendered by the same component with the same basis line. A floor on
    // one and not the other would publish an average of two beside a suppressed median of four.
    // Stated here so the consistency is deliberate rather than incidental.
    // MEASURED, not assumed: the seeded sibling clears the floor comfortably, so applying the same
    // threshold to it changes nothing visible today. It is applied anyway so a future fixture
    // cannot publish an average of two beside a suppressed median of four.
    expect(
      live.averageUnitsContacted.sampleSize,
      "if this ever drops below the floor the sibling suppresses too, and that is intended",
    ).toBeGreaterThanOrEqual(MINIMUM_EFFECTIVENESS_SAMPLE);
  });

  it("names the floor as a number somebody can find and change", () => {
    expect(MINIMUM_EFFECTIVENESS_SAMPLE).toBe(5);
  });
});

/** Movements carrying an acceptance duration, cloned from the seed so every other field is real. */
function syntheticAcceptances(movements: Movement[], count: number): Movement[] {
  const donor = movements.find((movement) => movement.acceptedAt !== undefined) ?? movements[0];
  return Array.from({ length: count }, (_, index) => ({
    ...donor,
    id: `WF-PAD-${index}`,
    // `acceptanceDurationMinutes` returns undefined without an ACCEPTED UNIT, whatever the
    // timestamps say — the first version of this helper set only `acceptedAt` and padded the
    // fixture with movements that contributed nothing, so the floor test failed for a reason that
    // had nothing to do with the floor. Read the derivation rather than assuming the field.
    acceptedUnitId: donor.acceptedUnitId ?? "fre-adult-open",
    openedAt: donor.openedAt,
    acceptedAt: donor.openedAt + 10 + index,
  }));
}
