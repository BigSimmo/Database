/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SpecifiersHomePage } from "@/components/specifiers/specifiers-home-page";
import { searchSpecifierCatalog } from "@/lib/specifiers-search-index";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("SpecifiersHomePage filters", () => {
  it("clears a failed search to the browsable catalogue route", () => {
    render(<SpecifiersHomePage query="qzxvjkplm" autoRunSearch />);

    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute("href", "/specifiers/search");
  });

  it("filters the catalogue before applying the 24-item display limit", () => {
    const matches = searchSpecifierCatalog("disorder").filter(({ item }) => item.categoryId === "per");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.length).toBeLessThan(24);
    window.history.replaceState(null, "", "/specifiers?q=disorder&scope=catalogue&category=per");

    render(<SpecifiersHomePage query="disorder" autoRunSearch />);

    const catalogue = screen.getByRole("region", { name: "Full specifier catalogue matches" });
    expect(within(catalogue).getAllByRole("listitem")).toHaveLength(matches.length);
    expect(screen.getByRole("status")).toHaveTextContent(`${matches.length} specifiers`);
    expect(screen.queryByRole("button", { name: /show more/i })).toBeNull();
  });

  it("reports the full total and progressively reveals catalogue matches", async () => {
    const user = userEvent.setup();
    const matches = searchSpecifierCatalog("disorder");
    expect(matches.length).toBeGreaterThan(48);
    window.history.replaceState(null, "", "/specifiers?q=disorder&scope=catalogue");

    render(<SpecifiersHomePage query="disorder" autoRunSearch />);

    const catalogue = screen.getByRole("region", { name: "Full specifier catalogue matches" });
    expect(within(catalogue).getAllByRole("listitem")).toHaveLength(24);
    expect(screen.getByRole("status")).toHaveTextContent(`${matches.length} specifiers`);

    await user.click(screen.getByRole("button", { name: /show more/i }));
    expect(within(catalogue).getAllByRole("listitem")).toHaveLength(48);
  });

  it("respects an explicit guide scope even when that scope is empty", () => {
    expect(searchSpecifierCatalog("type").length).toBeGreaterThan(0);
    window.history.replaceState(null, "", "/specifiers?q=type&scope=guides");

    render(<SpecifiersHomePage query="type" autoRunSearch />);

    expect(screen.getByRole("status")).toHaveTextContent("0 specifiers");
    expect(screen.getByRole("button", { name: "Remove Search in: Clinical guides filter" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Full specifier catalogue matches" })).toBeNull();
  });

  it("writes a stable category URL and hydrates its contextual applied chip", async () => {
    const user = userEvent.setup();
    const category = searchSpecifierCatalog("disorder").find(({ item }) => item.categoryId === "per")?.item.category;
    expect(category).toBeTruthy();
    window.history.replaceState(null, "", "/specifiers?q=disorder&focus=1&scope=catalogue");

    const view = render(<SpecifiersHomePage query="disorder" autoRunSearch />);
    await user.click(screen.getByTestId("specifier-filter-trigger-phone"));
    const panel = screen.getByTestId("specifier-filter-panel");
    await user.click(within(panel).getByRole("button", { name: "Category" }));
    await user.click(within(panel).getByRole("button", { name: new RegExp(`^${category} \\(`) }));

    const params = new URLSearchParams(window.location.search);
    expect(params.get("category")).toBe("per");
    expect(params.get("q")).toBe("disorder");
    expect(params.get("focus")).toBe("1");
    view.rerender(<SpecifiersHomePage query="disorder" autoRunSearch />);
    expect(screen.getByRole("button", { name: `Remove Category: ${category} filter` })).toBeVisible();
  });
});
