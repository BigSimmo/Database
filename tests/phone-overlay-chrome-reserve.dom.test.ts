/** @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  readPhoneOverlayChromeReservePx,
  usePhoneOverlayChromeReserve,
} from "@/components/clinical-dashboard/use-phone-overlay-chrome-reserve";

function stubOffsetHeight(element: Element, height: number) {
  Object.defineProperty(element, "offsetHeight", {
    configurable: true,
    get: () => height,
  });
}

describe("readPhoneOverlayChromeReservePx", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.documentElement.style.removeProperty("--phone-overlay-chrome-h");
    vi.unstubAllGlobals();
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

  it("keeps the CSS seed until ResizeObserver publishes the settled phone height", () => {
    let stackHeight = 200;
    let notifyResize: ResizeObserverCallback | null = null;

    document.body.innerHTML = `
      <div class="phone-sticky-header-stack">
        <div data-testid="universal-header-collapse"></div>
      </div>
    `;
    const stack = document.querySelector(".phone-sticky-header-stack");
    const collapse = document.querySelector('[data-testid="universal-header-collapse"]');
    expect(stack).toBeTruthy();
    expect(collapse).toBeTruthy();
    Object.defineProperty(stack!, "offsetHeight", {
      configurable: true,
      get: () => stackHeight,
    });
    stubOffsetHeight(collapse!, 72);

    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          notifyResize = callback;
        }

        observe() {}
        disconnect() {}
      },
    );

    const { unmount } = renderHook(() => usePhoneOverlayChromeReserve());

    // The synchronous layout read sees a transient expanded stack. Publishing
    // it would create the recorded CSS seed -> 200px -> 72px CLS round trip.
    expect(document.documentElement.style.getPropertyValue("--phone-overlay-chrome-h")).toBe("");

    stackHeight = 72;
    act(() => {
      expect(notifyResize).toBeTypeOf("function");
      notifyResize!([], {} as ResizeObserver);
    });

    expect(document.documentElement.style.getPropertyValue("--phone-overlay-chrome-h")).toBe("72px");
    unmount();
  });
});
