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

  it("rebases intent when scroll events switch containers", () => {
    expect(
      computeScrollHideUpdate({
        offset: 4,
        lastOffset: 500,
        sourceChanged: true,
        currentlyHidden: true,
        direction: "down",
        directionTravel: 300,
      }),
    ).toEqual({
      hidden: true,
      lastOffset: 4,
      direction: null,
      directionTravel: 0,
    });
  });

  it("holds the chrome hidden across a multi-frame collapse clamp at the bottom", () => {
    // As the collapsing header hands its height back to the scroll container,
    // maxOffset shrinks frame by frame and the browser clamps scrollTop to it,
    // so each reading looks like a small upward scroll while the offset stays
    // pinned to the (moving) bottom edge. Include a frame whose shrink is only
    // `minimumDelta` — the case the previous `lastOffset > maxOffset + delta`
    // guard let slip through and reveal the chrome, starting the bounce.
    const clampFrames = [1000, 996, 988, 980, 974, 970, 968, 940, 928];
    let state = {
      hidden: true,
      lastOffset: clampFrames[0],
      direction: "down" as "down" | "up" | null,
      directionTravel: 160,
    };
    for (const offset of clampFrames.slice(1)) {
      state = computeScrollHideUpdate({
        offset,
        lastOffset: state.lastOffset,
        // offset is pinned to the shrinking bottom edge each frame.
        maxOffset: offset,
        currentlyHidden: state.hidden,
        direction: state.direction,
        directionTravel: state.directionTravel,
      });
      expect(state.hidden).toBe(true);
      expect(state.lastOffset).toBe(offset);
    }

    // Once the collapse settles, a genuine upward scroll that pulls the offset
    // clear of the bottom still reveals the chrome.
    const revealed = computeScrollHideUpdate({
      offset: 900,
      lastOffset: state.lastOffset,
      maxOffset: 928,
      currentlyHidden: state.hidden,
      direction: state.direction,
      directionTravel: state.directionTravel,
    });
    expect(revealed.hidden).toBe(false);
    expect(revealed.direction).toBe("up");
  });

  it("does not reveal on a small phantom clamp when the offset stays pinned to the bottom", () => {
    // Single frame: a 4px upward clamp while glued to the bottom edge. The old
    // guard required the previous offset to sit more than `minimumDelta` above
    // the new maximum, which fails here, so the phantom read reached the reveal
    // path. It must be treated as layout feedback instead.
    expect(
      computeScrollHideUpdate({
        offset: 968,
        lastOffset: 972,
        maxOffset: 968,
        currentlyHidden: true,
        direction: "down",
        directionTravel: 120,
      }),
    ).toEqual({
      hidden: true,
      lastOffset: 968,
      direction: null,
      directionTravel: 0,
    });
  });

  it("ignores an upward clamp caused by the viewport growing at the bottom", () => {
    const clamped = computeScrollHideUpdate({
      offset: 900,
      lastOffset: 972,
      maxOffset: 900,
      currentlyHidden: true,
      direction: "down",
      directionTravel: 140,
    });
    expect(clamped).toEqual({
      hidden: true,
      lastOffset: 900,
      direction: null,
      directionTravel: 0,
    });

    expect(
      computeScrollHideUpdate({
        offset: 884,
        lastOffset: clamped.lastOffset,
        maxOffset: 900,
        currentlyHidden: clamped.hidden,
        direction: clamped.direction,
        directionTravel: clamped.directionTravel,
      }),
    ).toEqual({
      hidden: false,
      lastOffset: 884,
      direction: "up",
      directionTravel: 16,
    });
  });
});
