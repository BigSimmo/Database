import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FormsSearchResultsPage } from "@/components/forms/forms-search-results-page";
import { deriveFormCategories, filterFormMatches } from "@/lib/form-filters";
import { formRecords } from "@/lib/forms";
import { rankFormRecords } from "@/lib/form-ranker";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/use-registry-records", () => ({
  useRegistryRecords: () => ({
    status: "ready",
    records: formRecords,
    total: formRecords.length,
    demoMode: true,
    governance: {},
    refetch: vi.fn(),
  }),
}));

vi.mock("@/components/use-result-sort", () => ({
  useResultSort: () => ["relevance", vi.fn()] as const,
}));

vi.mock("@/components/clinical-dashboard/universal-search-also-matches", () => ({
  UniversalSearchAlsoMatches: () => null,
}));

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
  navigation.push.mockReset();
});

function escapePattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("FormsSearchResultsPage filters", () => {
  it("interprets natural-language detention extension queries as form search", () => {
    expect(
      rankFormRecords(formRecords, "Which form extends detention?", formRecords.length, [], true)[0]?.service.slug,
    ).toBe("form-7b");
  });

  it("renders functional category, clinical-risk, and availability facets", async () => {
    const user = userEvent.setup();
    const query = "form";
    window.history.replaceState(null, "", "/forms?q=form");
    const matches = rankFormRecords(formRecords, query);
    const category = deriveFormCategories(matches).find((candidate) => {
      const filtered = filterFormMatches(matches, {
        categories: new Set([candidate]),
        risks: new Set(),
        availability: new Set(),
      });
      return filtered.length > 0 && filtered.length < matches.length;
    });
    expect(category).toBeTruthy();

    const view = render(<FormsSearchResultsPage query={query} />);
    await user.click(screen.getByTestId("form-filter-trigger-phone"));
    const panel = screen.getByTestId("form-filter-panel");
    expect(within(panel).getByRole("group", { name: "Category" })).toBeVisible();
    expect(within(panel).getByRole("group", { name: "Clinical risk" })).toBeVisible();
    expect(within(panel).getByRole("group", { name: "Availability" })).toBeVisible();
    expect(within(panel).getByRole("button", { name: /^Downloadable \(/ })).toBeVisible();
    expect(within(panel).getByRole("button", { name: /^Contact required \(/ })).toBeVisible();
    expect(within(panel).getByRole("button", { name: /^Unavailable \(/ })).toBeVisible();

    const categoryOption = within(within(panel).getByRole("group", { name: "Category" })).getByRole("button", {
      name: new RegExp(`^${escapePattern(category!)} \\(`),
    });
    await user.click(categoryOption);

    expect(window.location.search).toContain("q=form");
    expect(window.location.search).toContain("category=");
    view.rerender(<FormsSearchResultsPage query={query} />);

    const expected = filterFormMatches(matches, {
      categories: new Set([category!]),
      risks: new Set(),
      availability: new Set(),
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      `${expected.length} ${expected.length === 1 ? "form" : "forms"}`,
    );
    expect(screen.getByRole("button", { name: `Remove Category: ${category} filter` })).toBeVisible();
  });
});
