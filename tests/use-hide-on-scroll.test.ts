import { describe, expect, it } from "vitest";

import { computeScrollHideUpdate } from "@/components/clinical-dashboard/use-hide-on-scroll";

describe("computeScrollHideUpdate", () => {
  it("keeps the chrome visible near the top", () => {
    expect(computeScrollHideUpdate({ offset: 0, lastOffset: 0, currentlyHidden: true })).toEqual({
      hidden: false,
      lastOffset: 0,
      direction: null,
      directionTravel: 0,
    });
    expect(computeScrollHideUpdate({ offset: 8, lastOffset: 20, currentlyHidden: true })).toEqual({
      hidden: false,
      lastOffset: 8,
      direction: null,
      directionTravel: 0,
    });
  });

  it("waits for deliberate travel beyond the activation offset before hiding", () => {
    const beforeThreshold = computeScrollHideUpdate({
      offset: 92,
      lastOffset: 60,
      currentlyHidden: false,
      direction: "down",
      directionTravel: 60,
    });
    expect(beforeThreshold).toEqual({
      hidden: false,
      lastOffset: 92,
      direction: "down",
      directionTravel: 92,
    });

    expect(
      computeScrollHideUpdate({
        offset: 100,
        lastOffset: beforeThreshold.lastOffset,
        currentlyHidden: beforeThreshold.hidden,
        direction: beforeThreshold.direction,
        directionTravel: beforeThreshold.directionTravel,
      }),
    ).toEqual({
      hidden: true,
      lastOffset: 100,
      direction: "down",
      directionTravel: 100,
    });
  });

  it("stays visible when scrolling down but still within the activation band", () => {
    expect(computeScrollHideUpdate({ offset: 40, lastOffset: 10, currentlyHidden: false })).toEqual({
      hidden: false,
      lastOffset: 40,
      direction: "down",
      directionTravel: 30,
    });
  });

  it("reveals after a short but deliberate upward travel", () => {
    const firstUpwardMove = computeScrollHideUpdate({
      offset: 174,
      lastOffset: 180,
      currentlyHidden: true,
      direction: "down",
      directionTravel: 80,
    });
    expect(firstUpwardMove.hidden).toBe(true);

    expect(
      computeScrollHideUpdate({
        offset: 166,
        lastOffset: firstUpwardMove.lastOffset,
        currentlyHidden: firstUpwardMove.hidden,
        direction: firstUpwardMove.direction,
        directionTravel: firstUpwardMove.directionTravel,
      }),
    ).toEqual({
      hidden: false,
      lastOffset: 166,
      direction: "up",
      directionTravel: 14,
    });
  });

  it("ignores rubber-band overscroll at the top", () => {
    expect(computeScrollHideUpdate({ offset: -12, lastOffset: 4, currentlyHidden: true })).toEqual({
      hidden: true,
      lastOffset: 4,
      direction: null,
      directionTravel: 0,
    });
  });

  it("ignores sub-threshold deltas", () => {
    expect(computeScrollHideUpdate({ offset: 82, lastOffset: 80, currentlyHidden: false })).toEqual({
      hidden: false,
      lastOffset: 80,
      direction: null,
      directionTravel: 0,
    });
  });

  it("resets intent when the user changes direction", () => {
    expect(
      computeScrollHideUpdate({
        offset: 76,
        lastOffset: 80,
        currentlyHidden: false,
        direction: "down",
        directionTravel: 80,
      }),
    ).toEqual({
      hidden: false,
      lastOffset: 76,
      direction: "up",
      directionTravel: 4,
    });
  });
});
