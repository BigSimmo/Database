/** @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTheme } from "@/components/clinical-dashboard/use-theme";
import { THEME_STORAGE_KEY } from "@/lib/theme";

/**
 * Guards the 200ms `theme-transitioning` timer in use-theme.ts.
 *
 * The timer used to run unguarded. A jsdom test file that switched theme could
 * finish inside the window, and the callback then threw
 * `ReferenceError: document is not defined` as an *unhandled* error — which
 * fails an entire Vitest run while still reporting every test as passed. That is
 * exactly how the Unit coverage job went red on PR #2046 with
 * `Test Files 648 passed / Tests 6970 passed / Errors 1 error`, originating in
 * `tests/sidebar-production.dom.test.tsx`.
 */
describe("theme transition timer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    try {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } catch {
      // Storage blocked in this environment; the hook falls back to memory.
    }
    document.documentElement.classList.remove("dark", "theme-transitioning");
  });

  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.classList.remove("dark", "theme-transitioning");
  });

  it("marks the transition and clears it when the timer fires", () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setPreference("dark"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("theme-transitioning")).toBe(true);

    act(() => void vi.advanceTimersByTime(200));
    expect(document.documentElement.classList.contains("theme-transitioning")).toBe(false);
  });

  it("does not throw when the document disappears before the timer fires", () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setPreference("dark"));
    expect(document.documentElement.classList.contains("theme-transitioning")).toBe(true);

    // Reproduce environment teardown mid-transition: the pending callback runs
    // with no `document` in scope, which is what threw before the guard.
    const realDocument = globalThis.document;
    Reflect.deleteProperty(globalThis, "document");
    try {
      expect(() => vi.advanceTimersByTime(200)).not.toThrow();
    } finally {
      Object.defineProperty(globalThis, "document", {
        value: realDocument,
        configurable: true,
        writable: true,
      });
    }
  });

  it("keeps one pending timer across rapid switches so an early one cannot end a later transition", () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setPreference("dark"));
    act(() => void vi.advanceTimersByTime(150));
    act(() => result.current.setPreference("light"));

    // Without the shared handle the first timer fires here and strips the class
    // while the second transition still has 140ms to run.
    act(() => void vi.advanceTimersByTime(60));
    expect(document.documentElement.classList.contains("theme-transitioning")).toBe(true);

    act(() => void vi.advanceTimersByTime(140));
    expect(document.documentElement.classList.contains("theme-transitioning")).toBe(false);
  });
});
