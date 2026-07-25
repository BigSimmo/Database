/** @vitest-environment jsdom */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SearchCommandProvider } from "@/components/clinical-dashboard/search-command-context";
import {
  MobileResultFilterControl,
  SearchResultsHeaderBand,
} from "@/components/clinical-dashboard/search-results-header-band";

describe("SearchResultsHeaderBand", () => {
  it("presents the query and completed count as one labelled results ribbon", () => {
    const query = "a deliberately long clinical search query";

    render(<SearchResultsHeaderBand modeId="services" query={`  ${query}  `} matchCount={12} />);

    expect(screen.getByRole("region", { name: `Search results for ${query}` })).toHaveAttribute("aria-busy", "false");
    expect(screen.getByRole("heading", { level: 2, name: query })).toHaveAttribute("title", query);
    expect(screen.getByRole("status")).toHaveTextContent("12 matches");
  });

  it("can provide the primary heading on standalone search routes", () => {
    render(<SearchResultsHeaderBand modeId="specifiers" query="seasonal pattern" matchCount={2} headingLevel={1} />);

    expect(screen.getByRole("heading", { level: 1, name: "seasonal pattern" })).toBeVisible();
    expect(screen.queryByRole("heading", { level: 2, name: "seasonal pattern" })).toBeNull();
  });

  it("announces the loading state without exposing a stale result count", () => {
    render(<SearchResultsHeaderBand modeId="differentials" query="acute confusion" matchCount={8} loading />);

    expect(screen.getByRole("region", { name: "Search results for acute confusion" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Searching…");
    expect(screen.queryByText("8 matches")).toBeNull();
  });

  it("does not render an empty utility strip for a stale scope from another mode", () => {
    render(
      <SearchCommandProvider
        value={{
          query: "transport order",
          modeId: "forms",
          commandScopes: ["scope-from-another-mode"],
          onRemoveScope: vi.fn(),
          onClearScopes: vi.fn(),
        }}
      >
        <SearchResultsHeaderBand modeId="forms" query="transport order" matchCount={3} />
      </SearchCommandProvider>,
    );

    expect(screen.queryByTestId("search-query-ribbon-utilities")).toBeNull();
  });

  it("keeps scope, sort, view, and save controls wired inside the utility row", async () => {
    const user = userEvent.setup();
    const onRemoveScope = vi.fn();
    const onSortChange = vi.fn();
    const onViewChange = vi.fn();
    const onSaveSearch = vi.fn();

    render(
      <SearchCommandProvider
        value={{
          query: "transport order",
          modeId: "forms",
          commandScopes: ["official"],
          onRemoveScope,
          onClearScopes: vi.fn(),
        }}
      >
        <SearchResultsHeaderBand
          modeId="forms"
          query="transport order"
          matchCount={3}
          sortValue="relevance"
          onSortChange={onSortChange}
          view="table"
          onViewChange={onViewChange}
          onSaveSearch={onSaveSearch}
        />
      </SearchCommandProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Remove Official only filter" }));
    await user.selectOptions(screen.getByLabelText("Sort results"), "alpha");
    await user.click(screen.getByRole("button", { name: "List view" }));
    await user.click(screen.getByRole("button", { name: "Save search" }));

    expect(onRemoveScope).toHaveBeenCalledWith("official");
    expect(onSortChange).toHaveBeenCalledWith("alpha");
    expect(onViewChange).toHaveBeenCalledWith("list");
    expect(onSaveSearch).toHaveBeenCalledOnce();
  });

  it("keeps page-specific actions and filters inside the shared ribbon", async () => {
    const user = userEvent.setup();
    const onOpenSources = vi.fn();
    const onFilterTables = vi.fn();

    render(
      <SearchResultsHeaderBand
        modeId="documents"
        query="lithium monitoring"
        matchCount={4}
        utilityControls={
          <button type="button" onClick={onOpenSources}>
            Sources
          </button>
        }
        filterLabel="Filter documents by source type"
        filterControls={
          <button type="button" onClick={onFilterTables}>
            Tables
          </button>
        }
      />,
    );

    const ribbon = screen.getByRole("region", { name: "Search results for lithium monitoring" });
    expect(within(ribbon).getByRole("group", { name: "Filter documents by source type" })).toBeVisible();

    await user.click(within(ribbon).getByRole("button", { name: "Sources" }));
    await user.click(within(ribbon).getByRole("button", { name: "Tables" }));

    expect(onOpenSources).toHaveBeenCalledOnce();
    expect(onFilterTables).toHaveBeenCalledOnce();
  });

  it("pairs sort with a page-specific dropdown on mobile without changing either action", async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    const onFilterChange = vi.fn();

    render(
      <SearchResultsHeaderBand
        modeId="differentials"
        query="acute confusion"
        matchCount={8}
        sortValue="relevance"
        onSortChange={onSortChange}
        filterLabel="Filter differential result type"
        mobileControls={
          <MobileResultFilterControl
            label="Show"
            ariaLabel="Filter by result type"
            value="all"
            options={[
              { value: "all", label: "All (8)" },
              { value: "presentation", label: "Presentations (1)" },
              { value: "diagnosis", label: "Diagnoses (7)" },
            ]}
            onChange={onFilterChange}
          />
        }
        filterControls={
          <button type="button" onClick={vi.fn()}>
            Desktop filters
          </button>
        }
      />,
    );

    const pair = screen.getByTestId("search-query-ribbon-mobile-control-pair");
    await user.selectOptions(within(pair).getByLabelText("Sort results"), "alpha");
    await user.selectOptions(within(pair).getByLabelText("Filter by result type"), "diagnosis");

    expect(onSortChange).toHaveBeenCalledWith("alpha");
    expect(onFilterChange).toHaveBeenCalledWith("diagnosis");
    expect(screen.getByTestId("search-query-ribbon-filters")).toHaveClass("hidden", "sm:block");
  });
});
