import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PressureStrip } from "@/components/ward-management/coordinator/pressure-strip";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { shiftInstants } from "@/components/ward-management/ward-reanchor";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * `edPressure` clamps `longestWaitMinutes` to 0 for a department with nobody waiting — a
 * correct internal value, but "0 waiting · longest 0m" is a plausible-looking duration for a
 * department where no duration exists to measure (Task 4 review Important 5). No fixture
 * department is currently quiet, so this was latent: nothing would have caught it reaching a
 * screen. `movements={[]}` makes every one of the 8 departments quiet without waiting for the
 * live fixture to grow one, by handing `PressureStrip` the state it is to read (mirrors
 * `edPressure`'s own `(now, movements)` parameter).
 *
 * `movements` USED TO BE OPTIONAL HERE, described in this file as a test-only injection point.
 * It was not test-only: the coordinator screen rendered this strip without it, so the strip read
 * the frozen seed while the referral queue beside it read live state. The description was true of
 * the intent and false of the code, and nothing could tell the difference because omitting the
 * argument produced a plausible answer instead of an error.
 */
describe("PressureStrip", () => {
  it("shows an explicit empty state for a department with nobody waiting, never a false duration", () => {
    render(<PressureStrip now={600} selectedEdId={undefined} onSelectEd={() => {}} movements={[]} />);

    const cards = screen.getAllByTestId(/^ward-ed-/);
    expect(cards).toHaveLength(8);
    for (const card of cards) {
      expect(card).toHaveTextContent(/no patients waiting/i);
      expect(card).not.toHaveTextContent(/longest/i);
      expect(card).not.toHaveTextContent(/0 waiting/i);
    }
  });

  it("reads the state it is handed, at a clock where the seed would answer differently", () => {
    /*
     * THE ASSERTION THAT WOULD HAVE CAUGHT THE DEFECT, and it needs a shifted clock to exist at all.
     *
     * The live app re-anchors the whole fixture to the hour the demonstration is opened, so `now`
     * and every `arrivedAt` move together by the same offset and the figures come out identical.
     * The old code moved only ONE of them: `now` was the re-anchored clock and the movements were
     * the untouched seed, so every wait was inflated by exactly the offset — wrong from the first
     * paint, not only after somebody raised a referral.
     *
     * So the property is invariance: shift both by the same amount and the longest wait must not
     * move. Handing the strip the seed at a shifted `now` — the old behaviour — breaks it, which is
     * the second half of this test and the reason the first half is not vacuous.
     */
    const offset = 175;
    const shifted = shiftInstants(wardMovements, offset);

    const { unmount } = render(
      <PressureStrip now={NOW_ANCHOR + offset} selectedEdId={undefined} onSelectEd={() => {}} movements={shifted} />,
    );
    const shiftedLongest = screen
      .getAllByTestId(/^ward-ed-/)
      .map((card) => Number(card.getAttribute("data-longest-minutes")));
    unmount();

    render(<PressureStrip now={NOW_ANCHOR} selectedEdId={undefined} onSelectEd={() => {}} movements={wardMovements} />);
    const baseline = screen
      .getAllByTestId(/^ward-ed-/)
      .map((card) => Number(card.getAttribute("data-longest-minutes")));

    expect(baseline.some((minutes) => minutes > 0)).toBe(true);
    expect(
      shiftedLongest,
      "moving the clock and the movements together changed the waits, so something in this chain " +
        "is reading one of them and not the other",
    ).toEqual(baseline);

    // And the old shape really was wrong, rather than this test asserting a truism: the seed read
    // at a re-anchored clock inflates every wait by the offset.
    const stale = baseline.map((minutes) => (minutes > 0 ? minutes + offset : minutes));
    expect(stale).not.toEqual(baseline);
  });
});
