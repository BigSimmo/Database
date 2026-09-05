import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The reporter's own doc comment promises it "tree-shakes to a no-op" when
 * `NEXT_PUBLIC_WEB_VITALS_DEBUG` is unset. It did not: `useReportWebVitals()` was
 * called unconditionally and Next's hook subscribes onCLS/onFID/onLCP/onINP/onFCP/
 * onTTFB inside a `useEffect` whatever the callback body does, on every route
 * (2026-09-02 audit, L108).
 *
 * These two cases pin both halves: nothing is registered when the flag is unset,
 * and the debug build still reports. `useReportWebVitals` is the observable
 * boundary — registering it is exactly what costs the six PerformanceObservers and
 * keeps `next/dist/compiled/web-vitals` in the client graph.
 */

const useReportWebVitals = vi.fn();
vi.mock("next/web-vitals", () => ({ useReportWebVitals }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  useReportWebVitals.mockClear();
});

describe("WebVitalsReporter", () => {
  it("registers no web-vitals observers and renders nothing when the debug flag is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_WEB_VITALS_DEBUG", "");
    const { WebVitalsReporter } = await import("@/components/web-vitals-reporter");

    const { container } = render(<WebVitalsReporter />);

    expect(useReportWebVitals).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it("still reports when the debug flag is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_WEB_VITALS_DEBUG", "true");
    const { WebVitalsReporter } = await import("@/components/web-vitals-reporter");

    render(<WebVitalsReporter />);

    expect(useReportWebVitals).toHaveBeenCalledTimes(1);
  });
});
