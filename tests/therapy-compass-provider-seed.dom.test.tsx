import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TcProvider, useTcBindings } from "@/components/therapy-compass/bindings";

// TcProvider fetches its dataset on mount; stub fetch so it mounts without
// network. The screen/search seed is independent of data loading, which is what
// this test exercises.
afterEach(() => vi.unstubAllGlobals());

function Probe() {
  const b = useTcBindings();
  return <div data-testid="probe" data-screen={b.screen} data-query={b.search.query} />;
}

describe("TcProvider run-enabled seeding", () => {
  it("seeds Search + query on mount and re-seeds when the deep-link query changes", () => {
    // Never-resolving fetch → the provider stays in its loading state without needing data.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );

    const { getByTestId, rerender } = render(
      <TcProvider key="q:alpha" initialQuery="alpha" autoRunSearch>
        <Probe />
      </TcProvider>,
    );
    expect(getByTestId("probe").getAttribute("data-screen")).toBe("search");
    expect(getByTestId("probe").getAttribute("data-query")).toBe("alpha");

    // A fresh /therapy-compass?q=beta&run=1 navigation changes the provider key
    // (as TherapyCompassPage computes it), remounting the provider so its seed
    // re-runs for the new query.
    rerender(
      <TcProvider key="q:beta" initialQuery="beta" autoRunSearch>
        <Probe />
      </TcProvider>,
    );
    expect(getByTestId("probe").getAttribute("data-screen")).toBe("search");
    expect(getByTestId("probe").getAttribute("data-query")).toBe("beta");
  });
});
