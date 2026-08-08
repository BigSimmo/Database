import { fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

describe("useViewerGestures double tap (jsdom)", () => {
  /**
   * Double tap is opt-in. The PDF canvas is the hook's other consumer and has
   * its own fit controls; silently repurposing a double tap there would be a
   * behaviour change nobody asked for, so the "not opted in" case below is the
   * real regression guard.
   *
   * jsdom's Event.timeStamp is read-only and always 0, so the hook falls back to
   * performance.now(). Driving that clock is what makes the 300ms window
   * testable at all — without it, two synchronous fireEvent taps are always
   * within the window and the timing branch is never actually exercised.
   */
  let clock = 0;
  const at = (time: number) => {
    clock = time;
  };

  beforeEach(() => {
    clock = 0;
    vi.spyOn(performance, "now").mockImplementation(() => clock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const tap = (point: { x: number; y: number }, pointerId: number) => {
    fireEvent.pointerDown(stage(), {
      pointerId,
      pointerType: "touch",
      isPrimary: true,
      clientX: point.x,
      clientY: point.y,
    });
    // clientX/clientY must be present on pointerup: the hook only completes a
    // tap when the release stays inside the movement slop of the press.
    fireEvent.pointerUp(stage(), {
      pointerId,
      pointerType: "touch",
      isPrimary: true,
      clientX: point.x,
      clientY: point.y,
    });
  };

  it("does nothing when the consumer has not opted in", () => {
    render(<GestureHarness onZoomBy={vi.fn()} />);
    at(1000);
    tap({ x: 50, y: 50 }, 1);
    at(1100);
    expect(() => tap({ x: 50, y: 50 }, 2)).not.toThrow();
  });

  it("fires with the tap point on two quick taps in the same place", () => {
    const onDoubleTap = vi.fn();
    render(<GestureHarness onZoomBy={vi.fn()} onDoubleTap={onDoubleTap} />);

    at(1000);
    tap({ x: 50, y: 60 }, 1);
    expect(onDoubleTap).not.toHaveBeenCalled(); // one tap is not a double tap

    at(1150);
    tap({ x: 52, y: 62 }, 2);
    expect(onDoubleTap).toHaveBeenCalledTimes(1);
    expect(onDoubleTap.mock.calls[0][0]).toEqual({ x: 52, y: 62 });
  });

  it("does not treat a third quick tap as another double tap", () => {
    // Without resetting the anchor on a match, a slow triple tap would fire
    // twice and the view would flap between fit and zoom.
    const onDoubleTap = vi.fn();
    render(<GestureHarness onZoomBy={vi.fn()} onDoubleTap={onDoubleTap} />);

    at(1000);
    tap({ x: 50, y: 60 }, 1);
    at(1100);
    tap({ x: 50, y: 60 }, 2);
    at(1200);
    tap({ x: 50, y: 60 }, 3);
    expect(onDoubleTap).toHaveBeenCalledTimes(1);
  });

  it("ignores two taps that are too far apart in time", () => {
    const onDoubleTap = vi.fn();
    render(<GestureHarness onZoomBy={vi.fn()} onDoubleTap={onDoubleTap} />);

    at(1000);
    tap({ x: 50, y: 60 }, 1);
    at(1400); // 400ms > the 300ms window
    tap({ x: 50, y: 60 }, 2);
    expect(onDoubleTap).not.toHaveBeenCalled();
  });

  it("ignores two taps that are too far apart on screen", () => {
    const onDoubleTap = vi.fn();
    render(<GestureHarness onZoomBy={vi.fn()} onDoubleTap={onDoubleTap} />);

    at(1000);
    tap({ x: 20, y: 20 }, 1);
    at(1100);
    tap({ x: 200, y: 200 }, 2); // well beyond the 24px slop
    expect(onDoubleTap).not.toHaveBeenCalled();
  });

  it("never reads a two-finger pinch as a double tap", () => {
    const onDoubleTap = vi.fn();
    render(<GestureHarness onZoomBy={vi.fn()} onDoubleTap={onDoubleTap} />);

    // Second finger lands while the first is still down — a pinch, not a tap.
    at(1000);
    fireEvent.pointerDown(stage(), {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      clientX: 50,
      clientY: 50,
    });
    at(1050);
    fireEvent.pointerDown(stage(), { pointerId: 2, pointerType: "touch", clientX: 55, clientY: 55 });
    fireEvent.pointerUp(stage(), { pointerId: 1, pointerType: "touch", isPrimary: true });
    fireEvent.pointerUp(stage(), { pointerId: 2, pointerType: "touch" });
    expect(onDoubleTap).not.toHaveBeenCalled();
  });

  it("does not treat two quick pan strokes as a double tap", () => {
    // Recording a completed tap on pointerdown made any two nearby drag starts
    // toggle zoom while the reader was trying to move the table.
    const onDoubleTap = vi.fn();
    const onPanBy = vi.fn();
    render(<GestureHarness onZoomBy={vi.fn()} onPanBy={onPanBy} onDoubleTap={onDoubleTap} touchPan />);

    at(1000);
    fireEvent.pointerDown(stage(), {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      clientX: 40,
      clientY: 40,
    });
    fireEvent.pointerMove(stage(), { pointerId: 1, pointerType: "touch", clientX: 80, clientY: 40 });
    fireEvent.pointerUp(stage(), {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      clientX: 80,
      clientY: 40,
    });

    at(1100);
    fireEvent.pointerDown(stage(), {
      pointerId: 2,
      pointerType: "touch",
      isPrimary: true,
      clientX: 42,
      clientY: 42,
    });
    fireEvent.pointerMove(stage(), { pointerId: 2, pointerType: "touch", clientX: 90, clientY: 42 });
    fireEvent.pointerUp(stage(), {
      pointerId: 2,
      pointerType: "touch",
      isPrimary: true,
      clientX: 90,
      clientY: 42,
    });

    expect(onPanBy).toHaveBeenCalled();
    expect(onDoubleTap).not.toHaveBeenCalled();
  });

  it("does not complete a double tap on pointerdown alone", () => {
    const onDoubleTap = vi.fn();
    render(<GestureHarness onZoomBy={vi.fn()} onDoubleTap={onDoubleTap} />);

    at(1000);
    fireEvent.pointerDown(stage(), {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      clientX: 50,
      clientY: 50,
    });
    fireEvent.pointerUp(stage(), {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      clientX: 50,
      clientY: 50,
    });
    at(1100);
    fireEvent.pointerDown(stage(), {
      pointerId: 2,
      pointerType: "touch",
      isPrimary: true,
      clientX: 50,
      clientY: 50,
    });
    expect(onDoubleTap).not.toHaveBeenCalled();
    fireEvent.pointerUp(stage(), {
      pointerId: 2,
      pointerType: "touch",
      isPrimary: true,
      clientX: 50,
      clientY: 50,
    });
    expect(onDoubleTap).toHaveBeenCalledTimes(1);
  });
});
