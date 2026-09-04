import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MorningPage } from "@/components/ward-management/morning/morning-page";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * The guided tour is PAUSED, and this file is what makes that word mean something.
 *
 * Owner instruction, 2026-08-30: "pause the guided tour for now as the app is not built. That should
 * be done last." The tour, its beats and its own tests are all still here - deleting real work
 * because it is inconvenient now is how a feature disappears with nobody deciding it should, and it
 * comes back when the application it describes exists.
 *
 * BUT A PAUSED THING THAT DISPATCHES NEEDS A CHECK RATHER THAN A COMMENT. The tour drives the real
 * reducer: `RESET_SCENARIO`, real accepts, real declines. If a later refactor re-mounts it - or
 * re-enables one code path inside it - a comment saying "paused" fails to notice, and the first
 * symptom is a demonstration resetting itself under somebody's hands.
 *
 * So this asserts the two halves of paused: the page mounts no tour, and mounting the page emits no
 * Ward Flow event at all. `tests/ward-morning-tour.dom.test.tsx` still exercises the tour itself by
 * mounting it directly, so the feature stays covered while it is switched off.
 *
 * THIS FILE IS THE THING SOMEBODY DELETES WHEN THE TOUR IS SWITCHED BACK ON. That is deliberate: it
 * makes un-pausing a decision rather than an edit, and it gives whoever does it a green-to-red
 * signal telling them the pause is genuinely lifted rather than half-lifted.
 */
function EventProbe() {
  const { movements, referrals, rejections, scenario } = useWardFlow();
  return (
    <div
      data-testid="probe"
      data-movements={movements.length}
      data-referrals={referrals.length}
      data-rejections={rejections.length}
      data-scenario={scenario}
    />
  );
}

describe("the guided tour is paused", () => {
  it("mounts no tour on the morning page", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <MorningPage />
      </WardFlowProvider>,
    );

    expect(
      screen.queryByTestId("ward-morning-tour-start"),
      "the morning page is rendering the guided tour again. It was paused by owner instruction on " +
        "2026-08-30 because the application it describes is not built. If it is being switched back " +
        "on deliberately, remove this file - that is the decision this test exists to force.",
    ).toBeNull();
  });

  it("renders no tour control of any kind, which is the assertion that actually bites", () => {
    /*
     * THE FIRST VERSION OF THIS TEST COULD NOT FAIL, and the mutation found it rather than my
     * reasoning. It asserted that mounting the page emitted no Ward Flow event — and a mounted tour
     * IDLES until somebody presses Start, so it dispatches nothing either way. Re-mounting the tour
     * reddened the control assertion above and left this one green, which is exactly the shape this
     * project keeps finding: a plausible check that passes for the wrong reason.
     *
     * What actually distinguishes paused from running is that no control exists to start it. So this
     * checks the whole control surface rather than one button — Start alone would pass on a tour
     * rendered mid-run, which has Stop and Next but no Start.
     *
     * The seeded-state assertions are kept because they are the canary: a provider that failed to
     * seed would render an empty page with no controls on it and satisfy everything above by
     * accident.
     */
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <MorningPage />
        <EventProbe />
      </WardFlowProvider>,
    );

    const probe = screen.getByTestId("probe");
    expect(Number(probe.dataset.movements), "the fixture must be seeded, or this test proves nothing").toBeGreaterThan(
      30,
    );

    for (const control of ["ward-morning-tour-start", "ward-morning-tour-stop", "ward-morning-tour-next"]) {
      expect(
        screen.queryByTestId(control),
        `${control} is on the morning page, so the guided tour is running again. Start alone is not ` +
          `enough to check: a tour rendered mid-run shows Stop and Next instead.`,
      ).toBeNull();
    }

    expect(
      probe.dataset.scenario,
      "the scenario changed on mount. The tour resets it from an effect rather than a click, so this " +
        "is the one dispatch that could happen with no control on screen at all.",
    ).toBe("standard");
  });
});
