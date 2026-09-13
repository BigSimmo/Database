import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDirtyStateGuard } from "@/components/ui/use-dirty-state-guard";

describe("useDirtyStateGuard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not attach beforeunload listener when isDirty is false", () => {
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");
    renderHook(() => useDirtyStateGuard(false));

    expect(addEventListenerSpy).not.toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });

  it("attaches beforeunload listener when isDirty is true", () => {
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");
    renderHook(() => useDirtyStateGuard(true));

    expect(addEventListenerSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });

  it("removes beforeunload listener when isDirty transitions to false", () => {
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
    const { rerender } = renderHook(({ isDirty }) => useDirtyStateGuard(isDirty), {
      initialProps: { isDirty: true },
    });

    rerender({ isDirty: false });

    expect(removeEventListenerSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });

  it("removes beforeunload listener on unmount", () => {
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useDirtyStateGuard(true));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });

  it("prevents default when beforeunload event is dispatched", () => {
    renderHook(() => useDirtyStateGuard(true));

    const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");

    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });
});
