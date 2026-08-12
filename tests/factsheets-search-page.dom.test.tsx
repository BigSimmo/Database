/** @vitest-environment jsdom */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import { FactsheetsSearchPage } from "@/components/factsheets/factsheets-search-page";
import { filterFactsheets } from "@/components/factsheets/factsheets-data";

// "sertraline" matches exactly one factsheet (Medications) — a small, stable
// fixture that still exercises real counting rather than an empty result set.
const query = "sertraline";
const results = filterFactsheets(query);

describe("FactsheetsSearchPage category filter", () => {
  it("renders one shared, counted option array on both breakpoints — the desktop rail is no longer raw links", () => {
    render(<FactsheetsSearchPage query={query} results={results} />);

    // Desktop: a real SegmentedControl (radiogroup), not `<Link>` chips —
    // the drift this PR closes (docs/filter-contract.md section 2).
    const desktopGroup = screen.getByRole("radiogroup", { name: "Category" });
    expect(within(desktopGroup).getByRole("radio", { name: "All (1)" })).toBeChecked();
    expect(within(desktopGroup).getByRole("radio", { name: "Medications (1)" })).toBeInTheDocument();
    expect(within(desktopGroup).getByRole("radio", { name: "Conditions (0)" })).toBeInTheDocument();
  });

  it("opens the phone sheet with the same counted options as the desktop rail", async () => {
    const user = userEvent.setup();
    render(<FactsheetsSearchPage query={query} results={results} />);

    await user.click(screen.getByTestId("factsheet-filter-trigger-phone"));
    const sheet = screen.getByTestId("factsheet-filter-panel");
    const sheetGroup = within(sheet).getByRole("radiogroup", { name: "Category" });
    expect(within(sheetGroup).getByRole("radio", { name: "All (1)" })).toBeChecked();
    expect(within(sheetGroup).getByRole("radio", { name: "Medications (1)" })).toBeInTheDocument();
  });

  it("selecting a category narrows within the query rather than replacing it", async () => {
    const user = userEvent.setup();
    push.mockClear();
    render(<FactsheetsSearchPage query={query} results={results} />);

    const desktopGroup = screen.getByRole("radiogroup", { name: "Category" });
    await user.click(within(desktopGroup).getByRole("radio", { name: "Medications (1)" }));

    expect(push).toHaveBeenCalledTimes(1);
    const href = push.mock.calls[0][0] as string;
    // Both params survive — category narrows, it does not replace the search.
    expect(href).toContain(`q=${encodeURIComponent(query)}`);
    expect(href).toContain("category=Medications");
  });

  it("clearing the category preserves the query", async () => {
    const user = userEvent.setup();
    push.mockClear();
    render(<FactsheetsSearchPage query={query} category="Medications" results={results} />);

    await user.click(screen.getByTestId("factsheet-filter-trigger-phone"));
    await user.click(screen.getByTestId("factsheet-filter-panel-clear"));

    expect(push).toHaveBeenCalledTimes(1);
    const href = push.mock.calls[0][0] as string;
    expect(href).toContain(`q=${encodeURIComponent(query)}`);
    expect(href).not.toContain("category=");
  });

  it("counts answer 'how many at the current query', not a permanently declared total", () => {
    // A query with zero factsheets: every option — including a category with
    // real catalogue members overall — must read 0, not a stale full count.
    render(<FactsheetsSearchPage query="zzz-no-such-factsheet" results={[]} />);
    const desktopGroup = screen.getByRole("radiogroup", { name: "Category" });
    expect(within(desktopGroup).getByRole("radio", { name: "All (0)" })).toBeInTheDocument();
    expect(within(desktopGroup).getByRole("radio", { name: "Medications (0)" })).toBeInTheDocument();
  });
});
