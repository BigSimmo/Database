import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DeveloperRoutesPage from "@/app/mockups/development/routes/page";
import { loadRepoAwarenessSnapshot } from "@/lib/developer-area/repo-awareness-snapshot";

/**
 * Overrides ride on top of the *real* committed snapshot, following
 * `tests/developer-ledger-page.dom.test.tsx`'s `acuityOverride` pattern: the
 * live snapshot's generator only ever emits `"product"` or `"mockup"` for
 * `page.area`, so an unrecognised area value can only be exercised against a
 * fixture, never against live data. `null` means "do not override".
 */
const areaOverride = vi.hoisted(() => ({ value: null as string | null }));

/**
 * Forces the redirects/API arrays empty on top of the real snapshot, whose 16
 * redirects and 42 API routes mean the existing count-driven assertions never
 * take the "None." branch. `false` means "do not override" for each field
 * independently, so a test exercises exactly one empty section at a time.
 */
const emptyOverride = vi.hoisted(() => ({ redirects: false, api: false }));

vi.mock("@/lib/developer-area/repo-awareness-snapshot", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/developer-area/repo-awareness-snapshot")>();
  return {
    ...actual,
    loadRepoAwarenessSnapshot: () => {
      let snapshot = actual.loadRepoAwarenessSnapshot();
      if (areaOverride.value !== null) {
        const area = areaOverride.value;
        snapshot = {
          ...snapshot,
          routes: {
            ...snapshot.routes,
            pages: snapshot.routes.pages.map((page, index) =>
              index === 0 ? { ...page, area: area as typeof page.area } : page,
            ),
          },
        };
      }
      if (emptyOverride.redirects) {
        snapshot = {
          ...snapshot,
          routes: { ...snapshot.routes, redirects: [], counts: { ...snapshot.routes.counts, redirects: 0 } },
        };
      }
      if (emptyOverride.api) {
        snapshot = {
          ...snapshot,
          routes: { ...snapshot.routes, api: [], counts: { ...snapshot.routes.counts, api: 0 } },
        };
      }
      return snapshot;
    },
  };
});

afterEach(() => {
  areaOverride.value = null;
  emptyOverride.redirects = false;
  emptyOverride.api = false;
});

const snapshot = loadRepoAwarenessSnapshot();

describe("developer routes page", () => {
  it("renders inside the shared shell with its own freshness label", () => {
    render(<DeveloperRoutesPage />);
    expect(screen.getByTestId("developer-routes")).toBeInTheDocument();
    expect(screen.getByTestId("developer-routes-back")).toHaveAttribute("href", "/mockups/development");
    expect(screen.getByTestId("developer-hub-freshness")).toHaveTextContent(/Repository/);
  });

  it("shows each count as its own readable value", () => {
    render(<DeveloperRoutesPage />);
    expect(screen.getByTestId("developer-routes-count-modes-value")).toHaveTextContent(
      String(snapshot.routes.counts.modes),
    );
    expect(screen.getByTestId("developer-routes-count-product-value")).toHaveTextContent(
      String(snapshot.routes.counts.product_pages),
    );
    expect(screen.getByTestId("developer-routes-count-mockup-value")).toHaveTextContent(
      String(snapshot.routes.counts.mockup_pages),
    );
    expect(screen.getByTestId("developer-routes-count-api-value")).toHaveTextContent(
      String(snapshot.routes.counts.api),
    );
  });

  it("lists every mode with a link to its home", () => {
    render(<DeveloperRoutesPage />);
    const modes = within(screen.getByTestId("developer-routes-modes")).getAllByRole("listitem");
    expect(modes).toHaveLength(snapshot.routes.counts.modes);
  });

  it("lists every product page and every mockup page, adding up to the counts", () => {
    render(<DeveloperRoutesPage />);
    expect(within(screen.getByTestId("developer-routes-pages-product")).getAllByRole("listitem")).toHaveLength(
      snapshot.routes.counts.product_pages,
    );
    expect(within(screen.getByTestId("developer-routes-pages-mockup")).getAllByRole("listitem")).toHaveLength(
      snapshot.routes.counts.mockup_pages,
    );
  });

  it("links a concrete route but never a dynamic one", () => {
    // A `[id]` segment is not a URL. Linking it would give the reader a control
    // that always 404s, which the wiring conventions forbid.
    render(<DeveloperRoutesPage />);
    const dynamic = snapshot.routes.pages.find((page) => page.path.includes("["));
    const concrete = snapshot.routes.pages.find((page) => !page.path.includes("["));
    expect(concrete).toBeDefined();
    expect(screen.getByTestId(`developer-routes-page-${concrete!.path}`).tagName).toBe("A");
    if (dynamic) expect(screen.getByTestId(`developer-routes-page-${dynamic.path}`).tagName).not.toBe("A");
  });

  it("says in words when a group is empty rather than rendering a blank list", () => {
    render(<DeveloperRoutesPage />);
    for (const [testId, count] of [
      ["developer-routes-redirects", snapshot.routes.counts.redirects],
      ["developer-routes-api", snapshot.routes.counts.api],
    ] as const) {
      const region = screen.getByTestId(testId);
      if (count === 0) expect(region).toHaveTextContent(/None/i);
      else expect(within(region).getAllByRole("listitem")).toHaveLength(count);
    }
  });

  it("renders a page whose area it does not recognise instead of dropping it, under its own heading", () => {
    // The live snapshot's generator never emits a third `area`, so this state
    // is reached only through the fixture override above (F9-1).
    areaOverride.value = "internal";
    const overridden = loadRepoAwarenessSnapshot();
    const target = overridden.routes.pages[0];
    render(<DeveloperRoutesPage />);

    const other = screen.getByTestId("developer-routes-pages-other");
    expect(within(other).getAllByRole("listitem")).toHaveLength(1);
    expect(within(other).getByTestId(`developer-routes-page-${target.path}`)).toBeInTheDocument();

    // Not double-counted: the row must not also still appear in whichever of
    // product/mockup it used to belong to, and the "Other" list must still add
    // up to the total pages count stated in its own caption.
    expect(
      within(screen.getByTestId("developer-routes-pages-product")).queryByTestId(
        `developer-routes-page-${target.path}`,
      ),
    ).toBeNull();
    expect(
      within(screen.getByTestId("developer-routes-pages-mockup")).queryByTestId(`developer-routes-page-${target.path}`),
    ).toBeNull();
    // The caption sits beside the `<ul>`, not inside it, so this reads the
    // section as a whole rather than the list element `other` above. This
    // pins a *true* claim: `counts.pages` is never shown as its own tile, so
    // the caption cites the product and mockup tiles that are actually shown
    // above it, and the arithmetic (product + mockup + other = counts.pages)
    // is exact because `otherPages` is exactly the complement of the
    // product/mockup union within `pages` — the same invariant the earlier
    // "not double-counted" assertions in this test already establish.
    expect(other.parentElement).toHaveTextContent(
      new RegExp(
        `together with the ${overridden.routes.counts.product_pages} product and ` +
          `${overridden.routes.counts.mockup_pages} design-scratch pages counted above`,
      ),
    );
  });

  it("says in words when there are no redirects at all — the branch the live snapshot's 16 redirects never take", () => {
    // `tests/developer-routes-page.dom.test.tsx`'s existing count-driven
    // assertion always finds `snapshot.routes.counts.redirects > 0` against
    // the real committed snapshot, so it always takes the list branch and has
    // never actually rendered these words. This fixture forces the zero
    // branch so the copy itself is proven, not just the list branch's length.
    emptyOverride.redirects = true;
    render(<DeveloperRoutesPage />);
    const region = screen.getByTestId("developer-routes-redirects");
    expect(region.tagName).toBe("P");
    expect(region).toHaveTextContent("None. No route in the app redirects to another.");
  });

  it("says in words when there are no API routes at all — the branch the live snapshot's 42 API routes never take", () => {
    emptyOverride.api = true;
    render(<DeveloperRoutesPage />);
    const region = screen.getByTestId("developer-routes-api");
    expect(region.tagName).toBe("P");
    expect(region).toHaveTextContent("None. No route in the app serves as an API endpoint.");
  });
});
