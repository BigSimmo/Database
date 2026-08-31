/** @vitest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SpecifiersHomePage } from "@/components/specifiers/specifiers-home-page";
import { searchSpecifierCatalog } from "@/lib/specifiers-search-index";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("SpecifiersHomePage filters", () => {
  it("clears a failed search to the browsable catalogue route", () => {
    render(<SpecifiersHomePage query="qzxvjkplm" autoRunSearch />);

    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute("href", "/specifiers/search");
  });

  it("defaults natural-language searches to their interpreted catalogue results", () => {
    render(<SpecifiersHomePage query="Which specifier describes anxiety symptoms?" autoRunSearch />);

    const catalogue = screen.getByRole("region", { name: "Full specifier catalogue matches" });
    // Several disorder-specific catalogue rows share the same specifier label; assert the
    // intended Smart match is present in the default catalogue lane rather than unique.
    const matches = within(catalogue).getAllByRole("link", { name: /with anxious distress/i });
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]).toBeVisible();
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

  it("reports the filtered catalogue total in the results ribbon", () => {
    const matches = searchSpecifierCatalog("disorder").filter(({ item }) => item.categoryId === "per");
    window.history.replaceState(null, "", "/specifiers?q=disorder&scope=catalogue&category=per");

    render(<SpecifiersHomePage query="disorder" autoRunSearch />);

    expect(screen.getByRole("status")).toHaveTextContent(`${matches.length} specifiers`);
  });
});
