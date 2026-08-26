import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  useDocumentScrollHideReporter,
  useScrollHideReporter,
} from "@/components/clinical-dashboard/use-hide-on-scroll";

describe("useScrollHideReporter route resets", () => {
  it("reveals chrome during the first render for a new route key", () => {
    const { result, rerender } = renderHook(({ resetKey }) => useScrollHideReporter(false, true, resetKey), {
      initialProps: { resetKey: "/documents/search" },
    });

    act(() => {
      result.current.reportScroll({ offset: 80, maxOffset: 2_000 });
      result.current.reportScroll({ offset: 104, maxOffset: 2_000 });
    });
    expect(result.current.hidden).toBe(true);

    // The route render itself must reveal the header. Waiting for an effect or
    // animation frame allows the previous route's translated overlay to paint
    // while its constant top reserve remains as an empty band.
    rerender({ resetKey: "/documents/11111111-1111-4111-8111-111111111111" });
    expect(result.current.hidden).toBe(false);
  });
});

describe("useDocumentScrollHideReporter composer focus", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("preserves focus through passive scroll settling and releases it on an outside gesture", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query) =>
        ({
          matches: query === "(max-width: 639px)",
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) satisfies MediaQueryList,
    );
    const form = document.createElement("form");
    const input = document.createElement("input");
    const results = document.createElement("main");
    form.append(input);
    document.body.append(form, results);
    input.focus();

    vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(1_200);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(600);
    vi.spyOn(window, "scrollY", "get").mockReturnValue(40);

    renderHook(() => useDocumentScrollHideReporter(vi.fn(), null, { current: input }));

    window.dispatchEvent(new Event("scroll"));
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    await waitFor(() => expect(input).toHaveFocus());

    // Movement that begins inside the composer keeps its existing swipe
    // threshold in MasterSearchHeader rather than dismissing on finger jitter.
    input.dispatchEvent(new Event("touchmove", { bubbles: true }));
    expect(input).toHaveFocus();

    input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "PageDown" }));
    expect(input).not.toHaveFocus();

    input.focus();
    results.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(input).not.toHaveFocus();

    input.focus();
    results.dispatchEvent(new Event("touchmove", { bubbles: true }));
    expect(input).not.toHaveFocus();
  });
});
