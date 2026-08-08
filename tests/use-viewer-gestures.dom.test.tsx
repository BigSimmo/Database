import { fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { useViewerGestures } from "@/components/document-viewer/use-viewer-gestures";

// useViewerGestures interprets raw wheel/pointer input into onZoomBy/onPanBy
// callbacks. Wheel zoom always uses a native non-passive listener so
// preventDefault can suppress browser page zoom on Ctrl/⌘+wheel and trackpad
// pinch (Sentry 15760049 / #214 amended). jsdom dispatches real DOM events so
// we can assert modifier gating, the passive flag, preventDefault, and the
// pointer pan/pinch maths here.

type HarnessProps = Omit<Parameters<typeof useViewerGestures>[0], "targetRef">;

function GestureHarness(props: HarnessProps) {
  const targetRef = useRef<HTMLDivElement>(null);
  const { handlers } = useViewerGestures({ targetRef, ...props });
  return <div ref={targetRef} data-testid="stage" {...handlers} />;
}

function stage() {
  return screen.getByTestId("stage");
}

describe("useViewerGestures wheel zoom (jsdom)", () => {
  it("zooms on Ctrl/⌘ + wheel and leaves a plain wheel for native scroll", () => {
    const onZoomBy = vi.fn();
    render(<GestureHarness onZoomBy={onZoomBy} />);

    // Plain wheel is ignored (native scroll) when a modifier is required.
    fireEvent.wheel(stage(), { deltaY: -100 });
    expect(onZoomBy).not.toHaveBeenCalled();

    // Ctrl+wheel zooms in: deltaY < 0 → factor > 1.
    fireEvent.wheel(stage(), { deltaY: -100, ctrlKey: true });
    expect(onZoomBy).toHaveBeenCalledTimes(1);
    expect(onZoomBy.mock.calls[0][0]).toBeGreaterThan(1);

    // ⌘+wheel down zooms out: deltaY > 0 → factor < 1.
    fireEvent.wheel(stage(), { deltaY: 100, metaKey: true });
    expect(onZoomBy).toHaveBeenCalledTimes(2);
    expect(onZoomBy.mock.calls[1][0]).toBeLessThan(1);
  });

  it("attaches a non-passive wheel listener for modifier-gated PDF zoom", () => {
    const addEventListener = vi.spyOn(HTMLElement.prototype, "addEventListener");
    const onZoomBy = vi.fn();
    render(<GestureHarness onZoomBy={onZoomBy} />);

    const wheelCalls = addEventListener.mock.calls.filter(([type]) => type === "wheel");
    expect(wheelCalls.length).toBeGreaterThan(0);
    expect(wheelCalls.some(([, , options]) => (options as AddEventListenerOptions)?.passive === false)).toBe(true);
    addEventListener.mockRestore();
  });

  it("attaches a non-passive wheel listener when unmodified wheel zooms (lightbox)", () => {
    const addEventListener = vi.spyOn(HTMLElement.prototype, "addEventListener");
    const onZoomBy = vi.fn();
    render(<GestureHarness onZoomBy={onZoomBy} wheelNeedsModifier={false} />);

    const wheelCalls = addEventListener.mock.calls.filter(([type]) => type === "wheel");
    expect(wheelCalls.length).toBeGreaterThan(0);
    expect(wheelCalls.some(([, , options]) => (options as AddEventListenerOptions)?.passive === false)).toBe(true);
    addEventListener.mockRestore();
  });

  it("calls preventDefault on Ctrl/⌘ + wheel so the browser does not page-zoom", () => {
    const onZoomBy = vi.fn();
    render(<GestureHarness onZoomBy={onZoomBy} />);

    const event = new WheelEvent("wheel", {
      deltaY: -100,
      ctrlKey: true,
      cancelable: true,
      bubbles: true,
    });
    const preventDefault = vi.spyOn(event, "preventDefault");
    stage().dispatchEvent(event);

    expect(onZoomBy).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalled();
  });

  it("zooms on a plain wheel when the modifier is not required (lightbox mode)", () => {
    const onZoomBy = vi.fn();
    render(<GestureHarness onZoomBy={onZoomBy} wheelNeedsModifier={false} />);

    fireEvent.wheel(stage(), { deltaY: -120 });
    expect(onZoomBy).toHaveBeenCalledTimes(1);
    expect(onZoomBy.mock.calls[0][0]).toBeGreaterThan(1);
  });

  it("never attaches the wheel listener when wheelZoom is off", () => {
    const onZoomBy = vi.fn();
    render(<GestureHarness onZoomBy={onZoomBy} wheelZoom={false} wheelNeedsModifier={false} />);

    fireEvent.wheel(stage(), { deltaY: -100 });
    expect(onZoomBy).not.toHaveBeenCalled();
  });
});

describe("useViewerGestures pointer pan/pinch (jsdom)", () => {
  it("pans by frame deltas during a one-pointer mouse drag", () => {
    const onZoomBy = vi.fn();
    const onPanBy = vi.fn();
    render(<GestureHarness onZoomBy={onZoomBy} onPanBy={onPanBy} />);

    fireEvent.pointerDown(stage(), {
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.pointerMove(stage(), { pointerId: 1, clientX: 30, clientY: 25 });
    expect(onPanBy).toHaveBeenCalledTimes(1);
    expect(onPanBy).toHaveBeenCalledWith(20, 15);

    fireEvent.pointerMove(stage(), { pointerId: 1, clientX: 35, clientY: 20 });
    expect(onPanBy).toHaveBeenNthCalledWith(2, 5, -5);

    fireEvent.pointerUp(stage(), { pointerId: 1 });
    // After release the drag is over: further moves do not pan.
    fireEvent.pointerMove(stage(), { pointerId: 1, clientX: 100, clientY: 100 });
    expect(onPanBy).toHaveBeenCalledTimes(2);
    expect(onZoomBy).not.toHaveBeenCalled();
  });

  it("zooms by the distance ratio during a two-pointer pinch", () => {
    const onZoomBy = vi.fn();
    const onPanBy = vi.fn();
    render(<GestureHarness onZoomBy={onZoomBy} onPanBy={onPanBy} />);

    // Two pointers down 10px apart seed the pinch baseline.
    fireEvent.pointerDown(stage(), { pointerId: 1, pointerType: "touch", isPrimary: true, clientX: 0, clientY: 0 });
    fireEvent.pointerDown(stage(), { pointerId: 2, pointerType: "touch", clientX: 10, clientY: 0 });

    // Spread the second pointer to 30px apart → factor 3×.
    fireEvent.pointerMove(stage(), { pointerId: 2, clientX: 30, clientY: 0 });
    expect(onZoomBy).toHaveBeenCalledTimes(1);
    expect(onZoomBy.mock.calls[0][0]).toBeCloseTo(3, 5);
    // A pinch must never be misread as a pan.
    expect(onPanBy).not.toHaveBeenCalled();
  });

  it("ignores touch drags when touchPan is off (native scroll keeps momentum)", () => {
    const onPanBy = vi.fn();
    render(<GestureHarness onZoomBy={vi.fn()} onPanBy={onPanBy} touchPan={false} />);

    fireEvent.pointerDown(stage(), { pointerId: 1, pointerType: "touch", isPrimary: true, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(stage(), { pointerId: 1, clientX: 40, clientY: 40 });
    expect(onPanBy).not.toHaveBeenCalled();
  });
});

// The PDF surface opens in fit-width mode and used to pass `pinchZoom: !fitWidth`,
// so a two-finger pinch on a freshly opened document reached neither the viewer
// (the hook declined it) nor the browser (the holder's `touch-action: pan-y`
// suppressed native pinch-zoom). Fit mode is the default, so that was the
// default. These pin the enabled/disabled contract the PDF surface relies on.
describe("useViewerGestures pinch gating", () => {
  function pinch(element: HTMLElement) {
    fireEvent.pointerDown(element, { pointerId: 1, clientX: 100, clientY: 100, isPrimary: true });
    fireEvent.pointerDown(element, { pointerId: 2, clientX: 200, clientY: 100 });
    fireEvent.pointerMove(element, { pointerId: 2, clientX: 260, clientY: 100 });
  }

  it("reports a spreading two-finger pinch as a zoom-in when enabled", () => {
    const onZoomBy = vi.fn();
    render(<GestureHarness onZoomBy={onZoomBy} pinchZoom pan={false} touchPan />);

    pinch(stage());

    expect(onZoomBy).toHaveBeenCalledTimes(1);
    expect(onZoomBy.mock.calls[0][0]).toBeGreaterThan(1);
  });

  it("stays silent when pinch is disabled", () => {
    const onZoomBy = vi.fn();
    render(<GestureHarness onZoomBy={onZoomBy} pinchZoom={false} pan={false} touchPan />);

    pinch(stage());

    expect(onZoomBy).not.toHaveBeenCalled();
  });
});
