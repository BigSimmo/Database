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

  it("preserves chrome state across a viewport-height change that looks like upward scroll", () => {
    // Safari toolbar / CI setViewportSize can shrink the viewport and emit a
    // scroll-looking delta. That must not reveal hidden chrome (#146); the next
    // genuine user gesture still can.
    expect(
      computeScrollHideUpdate({
        offset: 480,
        lastOffset: 500,
        maxOffset: 900,
        previousMaxOffset: 836,
        viewportHeightChanged: true,
        currentlyHidden: true,
        direction: "down",
        directionTravel: 200,
      }),
    ).toEqual({
      hidden: true,
      lastOffset: 480,
      direction: null,
      directionTravel: 0,
    });

    expect(
      computeScrollHideUpdate({
        offset: 500,
        lastOffset: 480,
        maxOffset: 900,
        viewportHeightChanged: true,
        currentlyHidden: false,
        direction: "up",
        directionTravel: 20,
      }),
    ).toEqual({
      hidden: false,
      lastOffset: 500,
      direction: null,
      directionTravel: 0,
    });
  });

  it("still reveals at the top of the range when the viewport height changes", () => {
    // The top reveal band is an absolute layout contract and outranks the resize
    // guard. A resize that lands while the chrome is hidden and the scroller is
    // clamped to the top (short page, keyboard dismiss, orientation flip) must
    // not strand the chrome off-screen at offset 0 until the next scroll.
    expect(
      computeScrollHideUpdate({
        offset: 0,
        lastOffset: 240,
        maxOffset: 120,
        previousMaxOffset: 900,
        viewportHeightChanged: true,
        currentlyHidden: true,
        direction: "down",
        directionTravel: 200,
      }),
    ).toEqual({
      hidden: false,
      lastOffset: 0,
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

  it("holds chrome hidden across a mid-page viewport range change with a small upward reading (#146)", () => {
    // Safari toolbar / Playwright setViewportSize shrinks the layout viewport,
    // growing maxOffset. Under CI load that geometry change can arrive with a
    // few pixels of upward scroll noise while the user is still deep in the
    // page — not deliberate reveal intent.
    expect(
      computeScrollHideUpdate({
        offset: 496,
        lastOffset: 500,
        maxOffset: 1200,
        previousMaxOffset: 1100,
        currentlyHidden: true,
        direction: "down",
        directionTravel: 200,
      }),
    ).toEqual({
      hidden: true,
      lastOffset: 496,
      direction: null,
      directionTravel: 0,
    });

    // A deliberate upward gesture that already clears revealIntentDistance must
    // still reveal even when the range changed in the same evaluation.
    const revealed = computeScrollHideUpdate({
      offset: 480,
      lastOffset: 500,
      maxOffset: 1200,
      previousMaxOffset: 1100,
      currentlyHidden: true,
      direction: "down",
      directionTravel: 200,
    });
    expect(revealed.hidden).toBe(false);
    expect(revealed.direction).toBe("up");
  });

  it("reveals when a genuine upward scroll is coalesced with a prior layout clamp", () => {
    // RAF debouncing coalesces a layout-clamp scroll event with any
    // immediately-following user scroll into a single RAF evaluation. The hook
    // reads the FINAL offset (newMaxOffset - userScroll) but lastMaxOffsetRef
    // still holds the pre-collapse maximum. The net offset is more than
    // revealIntentDistance (12px) below the new bottom edge, so the clamp
    // detection must yield to the upward-scroll reveal path.
    const result = computeScrollHideUpdate({
      offset: 904, // newMaxOffset (928) - 24px deliberate scroll
      lastOffset: 1000, // stale: pre-collapse jump-to-bottom offset
      maxOffset: 928, // new max after 72px in-flow header collapse
      previousMaxOffset: 1000, // stale: pre-collapse max (lastMaxOffsetRef)
      currentlyHidden: true,
      direction: null,
      directionTravel: 0,
    });
    expect(result.hidden).toBe(false);
    expect(result.direction).toBe("up");

    // A small simultaneous bounce (<= revealIntentDistance) must still be
    // treated as geometry feedback, not user intent.
    const stillHidden = computeScrollHideUpdate({
      offset: 918, // newMaxOffset (928) - 10px (below revealIntentDistance)
      lastOffset: 1000,
      maxOffset: 928,
      previousMaxOffset: 1000,
      currentlyHidden: true,
      direction: null,
      directionTravel: 0,
    });
    expect(stillHidden.hidden).toBe(true);
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

  it("holds the chrome hidden while a bottom rubber-band overscroll springs back", () => {
    // iOS reports a scrollTop past the maximum during bottom overscroll; as the
    // content springs back the reading moves up but is still the bottom edge.
    // A symmetric `|offset - maxOffset| <= tolerance` window would fall through
    // here and reveal the chrome mid-rubber-band — the one-sided test holds it.
    expect(
      computeScrollHideUpdate({
        offset: 930,
        lastOffset: 962,
        maxOffset: 900,
        currentlyHidden: true,
        direction: "down",
        directionTravel: 120,
      }),
    ).toEqual({
      hidden: true,
      lastOffset: 930,
      direction: null,
      directionTravel: 0,
    });
  });

  it("reproduces the short-page hide → clamp → tiny-reveal oscillation without a collapse budget", () => {
    // Real numbers from a phone standalone mode home (390x844, post-#964):
    // visible-chrome scroll runway maxOffset ≈ 300px; hiding the chrome
    // releases ~240px (header grid collapse + dock reserve-pad shrink). The
    // hide decision itself must be what prevents the trap; every guard below
    // it can only hold state, not restore the lost runway.
    let state = { hidden: false, lastOffset: 0, direction: null as "down" | "up" | null, directionTravel: 0 };
    for (const offset of [40, 80, 100]) {
      state = computeScrollHideUpdate({
        offset,
        lastOffset: state.lastOffset,
        maxOffset: 300,
        currentlyHidden: state.hidden,
        direction: state.direction,
        directionTravel: state.directionTravel,
      });
    }
    // Today the chrome hides at ~100px on a 300px runway…
    expect(state.hidden).toBe(true);

    // …then the 240px geometry release clamps the offset to the shrinking
    // bottom edge (held correctly by the bottom-clamp guard)…
    for (const frame of [90, 75, 60]) {
      state = computeScrollHideUpdate({
        offset: frame,
        lastOffset: state.lastOffset,
        maxOffset: frame,
        currentlyHidden: state.hidden,
        direction: state.direction,
        directionTravel: state.directionTravel,
      });
      expect(state.hidden).toBe(true);
    }

    // …and a mere 12px upward drag re-reveals, snapping ~240px of geometry
    // back under the finger — the "locks to the bottom" oscillation.
    const revealed = computeScrollHideUpdate({
      offset: 48,
      lastOffset: state.lastOffset,
      maxOffset: 60,
      currentlyHidden: state.hidden,
      direction: state.direction,
      directionTravel: state.directionTravel,
    });
    expect(revealed.hidden).toBe(false);
  });

  it("refuses to hide when the collapse budget exceeds the remaining runway", () => {
    // /formulation at 390x844 (measured pre-fix): maxOffset 266 with chrome
    // visible; hiding releases 182px (72px header strip + 110px reserve-pad
    // shrink). At offset 100 only 166px of runway remains — hiding would clamp
    // the offset straight onto the new bottom edge, so the gate must refuse.
    expect(
      computeScrollHideUpdate({
        offset: 100,
        lastOffset: 80,
        maxOffset: 266,
        collapseBudget: 182,
        currentlyHidden: false,
        direction: "down",
        directionTravel: 80,
      }),
    ).toEqual({
      hidden: false,
      lastOffset: 100,
      direction: "down",
      directionTravel: 100,
    });
  });

  it("keeps combined header and page-dock chrome visible with only 96px of post-collapse runway", () => {
    // Calculator at 390x844 with an installed-PWA inset: 72px collapsing
    // header + 59px top inset + 200px page-owned dock reserve. The shell and
    // calculator reporters schedule independently, so a 96px tail is not
    // enough for both animated releases without a scrollTop clamp.
    const collapseBudget = 72 + 59 + 200;
    expect(
      computeScrollHideUpdate({
        offset: 2_323,
        lastOffset: 2_299,
        maxOffset: 2_750,
        collapseBudget,
        collapseKind: "in-flow",
        combinedChrome: true,
        currentlyHidden: false,
        direction: "down",
        directionTravel: 96,
      }).hidden,
    ).toBe(false);
  });

  it("allows a reserve-only overlay to hide when its post-collapse range retains deliberate hide intent", () => {
    // Measured compact Answer result at 390x844 without synthetic content:
    // 159px visible range - 120px reserve = 39px after hiding. A fixed overlay
    // can hide after the 8px top band + 24px intent without collapsing in-flow
    // header geometry or clamping materially.
    const hidden = computeScrollHideUpdate({
      offset: 40,
      lastOffset: 0,
      maxOffset: 159,
      collapseBudget: 120,
      collapseKind: "reserve-only",
      currentlyHidden: false,
    });
    expect(hidden.hidden).toBe(true);

    const clamped = computeScrollHideUpdate({
      offset: 39,
      lastOffset: hidden.lastOffset,
      maxOffset: 39,
      currentlyHidden: hidden.hidden,
      direction: hidden.direction,
      directionTravel: hidden.directionTravel,
    });
    expect(clamped.hidden).toBe(true);
    expect(
      computeScrollHideUpdate({
        offset: 20,
        lastOffset: clamped.lastOffset,
        maxOffset: 39,
        currentlyHidden: clamped.hidden,
        direction: clamped.direction,
        directionTravel: clamped.directionTravel,
      }).hidden,
    ).toBe(false);

    // The same geometry remains protected when an in-flow header participates.
    expect(
      computeScrollHideUpdate({
        offset: 100,
        lastOffset: 80,
        maxOffset: 159,
        collapseBudget: 120,
        collapseKind: "in-flow",
        currentlyHidden: false,
        direction: "down",
        directionTravel: 80,
      }).hidden,
    ).toBe(false);

    // A genuinely short reserve-only result would collapse below the deliberate
    // hide threshold and still risks a top/bottom clamp cycle, so it stays visible.
    expect(
      computeScrollHideUpdate({
        offset: 40,
        lastOffset: 0,
        maxOffset: 145,
        collapseBudget: 120,
        collapseKind: "reserve-only",
        currentlyHidden: false,
      }).hidden,
    ).toBe(false);

    // Near-bottom hides must stay refused even when the post-collapse range is
    // long enough: offset 180 would clamp onto 80 and jump content under the finger.
    expect(
      computeScrollHideUpdate({
        offset: 180,
        lastOffset: 160,
        maxOffset: 200,
        collapseBudget: 120,
        collapseKind: "reserve-only",
        currentlyHidden: false,
        direction: "down",
        directionTravel: 80,
      }).hidden,
    ).toBe(false);
  });

  it("uses a shrinking scroll range, not pixel tolerance, to identify a reserve-collapse clamp", () => {
    // Real PageDown frame from the compact Answer result at 390x844. The
    // animated reserve shrink moved the browser's maximum from 160px to 127px;
    // compositor rounding left scrollTop 1.03px below that integer maximum.
    // This is layout feedback near the new bottom, not upward user intent.
    expect(
      computeScrollHideUpdate({
        offset: 125.9683,
        lastOffset: 160.5079,
        maxOffset: 127,
        previousMaxOffset: 160,
        collapseBudget: 23.3347,
        collapseKind: "reserve-only",
        currentlyHidden: true,
        direction: "down",
        directionTravel: 160.5079,
      }),
    ).toEqual({
      hidden: true,
      lastOffset: 125.9683,
      direction: null,
      directionTravel: 0,
    });

    // The same fractional positions are a genuine upward gesture once the
    // scroll range is stable; no bottom-edge tolerance may suppress it.
    expect(
      computeScrollHideUpdate({
        offset: 125.9683,
        lastOffset: 160.5079,
        maxOffset: 127,
        previousMaxOffset: 127,
        collapseKind: "reserve-only",
        currentlyHidden: true,
        direction: "down",
        directionTravel: 160.5079,
      }).hidden,
    ).toBe(false);

    // Range shrink alone is insufficient: if the old position still fits
    // inside the new range, the browser did not have to clamp it.
    expect(
      computeScrollHideUpdate({
        offset: 100,
        lastOffset: 120,
        maxOffset: 127,
        previousMaxOffset: 160,
        collapseKind: "reserve-only",
        currentlyHidden: true,
        direction: "down",
        directionTravel: 120,
      }).hidden,
    ).toBe(false);
  });

  it("hides normally when ample runway remains below the collapse release", () => {
    expect(
      computeScrollHideUpdate({
        offset: 100,
        lastOffset: 80,
        maxOffset: 2000,
        collapseBudget: 240,
        currentlyHidden: false,
        direction: "down",
        directionTravel: 80,
      }).hidden,
    ).toBe(true);
  });

  it("keeps hiding when the collapse budget is not reported (back-compat)", () => {
    // DocumentViewer / settings-dialog consumers report no budget; their
    // behavior must be untouched even on a short scroller.
    expect(
      computeScrollHideUpdate({
        offset: 100,
        lastOffset: 80,
        maxOffset: 266,
        currentlyHidden: false,
        direction: "down",
        directionTravel: 80,
      }).hidden,
    ).toBe(true);
  });

  it("does not apply combined-phone runway slack to a zero-budget reporter", () => {
    expect(
      computeScrollHideUpdate({
        offset: 100,
        lastOffset: 80,
        maxOffset: 200,
        collapseBudget: 0,
        currentlyHidden: false,
        direction: "down",
        directionTravel: 80,
      }).hidden,
    ).toBe(true);
  });

  it("blocks a hide that would land within one micro-drag of the reveal threshold", () => {
    // runway (500-100) - budget 240 = 160 > 28 → allowed…
    expect(
      computeScrollHideUpdate({
        offset: 100,
        lastOffset: 80,
        maxOffset: 500,
        collapseBudget: 240,
        currentlyHidden: false,
        direction: "down",
        directionTravel: 80,
      }).hidden,
    ).toBe(true);
    // …but with 28px or less of post-collapse runway the position would sit
    // one reveal-intent drag from snapping the geometry back: refused.
    expect(
      computeScrollHideUpdate({
        offset: 100,
        lastOffset: 80,
        maxOffset: 368,
        collapseBudget: 240,
        currentlyHidden: false,
        direction: "down",
        directionTravel: 80,
      }).hidden,
    ).toBe(false);
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
