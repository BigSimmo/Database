import { describe, expect, it } from "vitest";

import { computeScrollHideUpdate } from "@/components/clinical-dashboard/use-hide-on-scroll";

describe("computeScrollHideUpdate", () => {
  it("keeps the chrome visible near the top", () => {
    expect(computeScrollHideUpdate({ offset: 0, lastOffset: 0, currentlyHidden: true })).toEqual({
      hidden: false,
      lastOffset: 0,
    });
    expect(computeScrollHideUpdate({ offset: 8, lastOffset: 20, currentlyHidden: true })).toEqual({
      hidden: false,
      lastOffset: 8,
    });
  });

  it("hides after scrolling down past the activation offset", () => {
    expect(computeScrollHideUpdate({ offset: 80, lastOffset: 10, currentlyHidden: false })).toEqual({
      hidden: true,
      lastOffset: 80,
    });
  });

  it("stays visible when scrolling down but still within the activation band", () => {
    expect(computeScrollHideUpdate({ offset: 40, lastOffset: 10, currentlyHidden: false })).toEqual({
      hidden: false,
      lastOffset: 40,
    });
  });

  it("reveals again on deliberate scroll up", () => {
    expect(computeScrollHideUpdate({ offset: 120, lastOffset: 180, currentlyHidden: true })).toEqual({
      hidden: false,
      lastOffset: 120,
    });
  });

  it("ignores rubber-band overscroll at the top", () => {
    expect(computeScrollHideUpdate({ offset: -12, lastOffset: 4, currentlyHidden: true })).toEqual({
      hidden: true,
      lastOffset: 4,
    });
  });

  it("ignores sub-threshold deltas", () => {
    expect(computeScrollHideUpdate({ offset: 82, lastOffset: 80, currentlyHidden: false })).toEqual({
      hidden: false,
      lastOffset: 80,
    });
  });
});
