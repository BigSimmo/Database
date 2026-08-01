/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";

import { readPhoneOverlayChromeReservePx } from "@/components/clinical-dashboard/use-phone-overlay-chrome-reserve";

function stubOffsetHeight(element: Element, height: number) {
  Object.defineProperty(element, "offsetHeight", {
    configurable: true,
    get: () => height,
  });
}

describe("readPhoneOverlayChromeReservePx", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("falls through a zero-height stack to the collapse row", () => {
    // A present `.phone-sticky-header-stack` with offsetHeight 0 (display:contents
    // / mid-unmount) must not win via `??` and publish 0px over the CSS seed —
    // that is the Services result-anchor jump under CI load (#146 / PR #1562).
    document.body.innerHTML = `
      <div class="phone-sticky-header-stack">
        <div data-testid="universal-header-collapse"></div>
      </div>
    `;
    const stack = document.querySelector(".phone-sticky-header-stack");
    const collapse = document.querySelector('[data-testid="universal-header-collapse"]');
    expect(stack).toBeTruthy();
    expect(collapse).toBeTruthy();
    stubOffsetHeight(stack!, 0);
    stubOffsetHeight(collapse!, 72);
    expect(readPhoneOverlayChromeReservePx()).toBe(72);
  });

  it("returns 0 when neither stack nor collapse is measurable so the publisher can keep the seed", () => {
    document.body.innerHTML = `
      <div class="phone-sticky-header-stack">
        <div data-testid="universal-header-collapse"></div>
      </div>
    `;
    const stack = document.querySelector(".phone-sticky-header-stack");
    const collapse = document.querySelector('[data-testid="universal-header-collapse"]');
    stubOffsetHeight(stack!, 0);
    stubOffsetHeight(collapse!, 0);
    expect(readPhoneOverlayChromeReservePx()).toBe(0);
  });

  it("prefers the stack height when the overlay stack is measurable", () => {
    document.body.innerHTML = `
      <div class="phone-sticky-header-stack">
        <div data-testid="universal-header-collapse"></div>
      </div>
    `;
    const stack = document.querySelector(".phone-sticky-header-stack");
    const collapse = document.querySelector('[data-testid="universal-header-collapse"]');
    stubOffsetHeight(stack!, 131);
    stubOffsetHeight(collapse!, 72);
    expect(readPhoneOverlayChromeReservePx()).toBe(131);
  });
});
