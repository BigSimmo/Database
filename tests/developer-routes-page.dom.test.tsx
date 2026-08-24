import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DeveloperRoutesPage from "@/app/mockups/development/routes/page";
import { loadRepoAwarenessSnapshot } from "@/lib/developer-area/repo-awareness-snapshot";

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
});
