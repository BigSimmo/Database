import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TcProvider, useTcBindings } from "@/components/therapy-compass/bindings";

// TcProvider now derives the active screen from the pathname and seeds the search
// query from a `?q=` deep link (universal-search "view all", recent-search picks),
// so mock next/navigation to drive both. Hoisted so the mock factory can read it.
const navState = vi.hoisted(() => ({ pathname: "/therapy-compass/search", search: "q=alpha" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navState.pathname,
  useSearchParams: () => new URLSearchParams(navState.search),
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {} }),
}));

// TcProvider fetches its dataset on mount; stub fetch so it mounts without network.
// The screen/search seed is independent of data loading, which is what this exercises.
afterEach(() => vi.unstubAllGlobals());

function Probe() {
  const b = useTcBindings();
  return <div data-testid="probe" data-screen={b.screen} data-query={b.search.query} />;
}

describe("TcProvider URL-driven seeding", () => {
  it("resolves the screen from the pathname and seeds the query from ?q, re-seeding when it changes", () => {
    // Never-resolving fetch → the provider stays in its loading state without needing data.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );

    navState.pathname = "/therapy-compass/search";
    navState.search = "q=alpha";
    const { getByTestId, rerender } = render(
      <TcProvider>
        <Probe />
      </TcProvider>,
    );
    expect(getByTestId("probe").getAttribute("data-screen")).toBe("search");
    expect(getByTestId("probe").getAttribute("data-query")).toBe("alpha");

    // A fresh /therapy-compass/search?q=beta&run=1 navigation updates the query param;
    // the provider re-seeds the search query without needing a remount.
    navState.search = "q=beta";
    rerender(
      <TcProvider>
        <Probe />
      </TcProvider>,
    );
    expect(getByTestId("probe").getAttribute("data-screen")).toBe("search");
    expect(getByTestId("probe").getAttribute("data-query")).toBe("beta");
  });

  it("resolves a therapy detail screen + slug from the pathname", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );

    navState.pathname = "/therapy-compass/cognitive-behavioural-therapy-cbt";
    navState.search = "";
    const { getByTestId } = render(
      <TcProvider>
        <Probe />
      </TcProvider>,
    );
    expect(getByTestId("probe").getAttribute("data-screen")).toBe("detail");
  });

  it("clears the seeded query when navigating from ?q=… back to a query-less URL", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );

    navState.pathname = "/therapy-compass/search";
    navState.search = "q=act";
    const { getByTestId, rerender } = render(
      <TcProvider>
        <Probe />
      </TcProvider>,
    );
    expect(getByTestId("probe").getAttribute("data-query")).toBe("act");

    // Navigating to the query-less search URL must reset the query so the rendered
    // state matches the URL (not leave a stale "act").
    navState.search = "";
    rerender(
      <TcProvider>
        <Probe />
      </TcProvider>,
    );
    expect(getByTestId("probe").getAttribute("data-query")).toBe("");
  });
});
