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

  it("publishes only a frame-confirmed observer height and preserves later geometry changes", () => {
    let stackHeight = 200;
    let collapseHeight = 72;
    let notifyResize: ResizeObserverCallback | null = null;
    let notifyMediaChange: EventListener | null = null;
    let mediaMatches = true;
    let nextFrameId = 1;
    const pendingFrames = new Map<number, FrameRequestCallback>();

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
    Object.defineProperty(collapse!, "offsetHeight", {
      configurable: true,
      get: () => collapseHeight,
    });

    vi.stubGlobal("matchMedia", () => ({
      get matches() {
        return mediaMatches;
      },
      addEventListener: (_type: string, listener: EventListener) => {
        notifyMediaChange = listener;
      },
      removeEventListener: vi.fn(),
    }));
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
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      const frameId = nextFrameId++;
      pendingFrames.set(frameId, callback);
      return frameId;
    });
    vi.stubGlobal("cancelAnimationFrame", (frameId: number) => {
      pendingFrames.delete(frameId);
    });

    const deliverResize = () => {
      expect(notifyResize).toBeTypeOf("function");
      notifyResize!([], {} as ResizeObserver);
    };
    const flushFrame = () => {
      expect(pendingFrames.size).toBe(1);
      const [frameId, callback] = pendingFrames.entries().next().value!;
      pendingFrames.delete(frameId);
      callback(0);
    };

    const { unmount } = renderHook(() => usePhoneOverlayChromeReserve());

    // The synchronous layout read sees a transient expanded stack. Publishing
    // it would create the recorded CSS seed -> 200px -> 72px CLS round trip.
    expect(document.documentElement.style.getPropertyValue("--phone-overlay-chrome-h")).toBe("");

    act(deliverResize);
    expect(document.documentElement.style.getPropertyValue("--phone-overlay-chrome-h")).toBe("");

    stackHeight = 72;
    act(deliverResize);
    expect(document.documentElement.style.getPropertyValue("--phone-overlay-chrome-h")).toBe("");
    act(flushFrame);

    expect(document.documentElement.style.getPropertyValue("--phone-overlay-chrome-h")).toBe("72px");

    // A legitimate later addon/orientation geometry change uses the same
    // confirmation path and is not starved after the initial stabilization.
    stackHeight = 96;
    act(deliverResize);
    expect(document.documentElement.style.getPropertyValue("--phone-overlay-chrome-h")).toBe("72px");
    act(flushFrame);
    expect(document.documentElement.style.getPropertyValue("--phone-overlay-chrome-h")).toBe("96px");

    // A transient zero keeps the last confirmed positive value.
    stackHeight = 0;
    collapseHeight = 0;
    act(deliverResize);
    expect(document.documentElement.style.getPropertyValue("--phone-overlay-chrome-h")).toBe("96px");
    expect(pendingFrames.size).toBe(0);

    // Desktop owns an explicit zero. Returning to phone releases that inline
    // override back to the CSS seed until a new height is confirmed.
    mediaMatches = false;
    act(() => notifyMediaChange!(new Event("change")));
    expect(document.documentElement.style.getPropertyValue("--phone-overlay-chrome-h")).toBe("0px");
    stackHeight = 80;
    collapseHeight = 72;
    act(deliverResize);
    expect(pendingFrames.size).toBe(0);

    mediaMatches = true;
    act(() => notifyMediaChange!(new Event("change")));
    expect(document.documentElement.style.getPropertyValue("--phone-overlay-chrome-h")).toBe("");
    act(deliverResize);
    act(flushFrame);
    expect(document.documentElement.style.getPropertyValue("--phone-overlay-chrome-h")).toBe("80px");

    // Cleanup cancels an outstanding confirmation and removes the inline value.
    stackHeight = 88;
    act(deliverResize);
    expect(pendingFrames.size).toBe(1);
    unmount();
    expect(pendingFrames.size).toBe(0);
    expect(document.documentElement.style.getPropertyValue("--phone-overlay-chrome-h")).toBe("");
  });
});
