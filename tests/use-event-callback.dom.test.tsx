import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useEventCallback } from "@/components/clinical-dashboard/use-event-callback";

// renderHook seed for the jsdom project: the "useEvent" pattern promises a stable
// callback identity that always calls the latest handler. Both halves matter —
// stable identity is what preserves React.memo children, latest-handler is what
// avoids stale closures — so both are asserted here.

describe("useEventCallback (jsdom)", () => {
  it("keeps a stable identity across re-renders", () => {
    const { result, rerender } = renderHook(({ fn }) => useEventCallback(fn), {
      initialProps: { fn: () => "a" },
    });

    const first = result.current;
    rerender({ fn: () => "b" });

    expect(result.current).toBe(first);
  });

  it("always invokes the most recently rendered handler", () => {
    const handlerA = vi.fn(() => "a");
    const handlerB = vi.fn(() => "b");

    const { result, rerender } = renderHook(({ fn }) => useEventCallback<[string], string>(fn), {
      initialProps: { fn: handlerA as (arg: string) => string },
    });

    expect(result.current("x")).toBe("a");
    expect(handlerA).toHaveBeenCalledWith("x");

    rerender({ fn: handlerB });

    let returned: string | undefined;
    act(() => {
      returned = result.current("y");
    });

    expect(returned).toBe("b");
    expect(handlerB).toHaveBeenCalledWith("y");
    expect(handlerA).toHaveBeenCalledTimes(1);
  });
});
