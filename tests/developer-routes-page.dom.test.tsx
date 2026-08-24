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

vi.mock("@/lib/developer-area/repo-awareness-snapshot", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/developer-area/repo-awareness-snapshot")>();
  return {
    ...actual,
    loadRepoAwarenessSnapshot: () => {
      const snapshot = actual.loadRepoAwarenessSnapshot();
      if (areaOverride.value === null) return snapshot;
      const area = areaOverride.value;
      return {
        ...snapshot,
        routes: {
          ...snapshot.routes,
          pages: snapshot.routes.pages.map((page, index) =>
            index === 0 ? { ...page, area: area as typeof page.area } : page,
          ),
        },
      };
    },
  };
});

afterEach(() => {
  areaOverride.value = null;
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
      within(screen.getByTestId("developer-routes-pages-mockup")).queryByTestId(
        `developer-routes-page-${target.path}`,
      ),
    ).toBeNull();
    // The caption sits beside the `<ul>`, not inside it, so this reads the
    // section as a whole rather than the list element `other` above.
    expect(other.parentElement).toHaveTextContent(
      new RegExp(`add up to the ${overridden.routes.counts.pages} pages counted above`),
    );
  });
});
