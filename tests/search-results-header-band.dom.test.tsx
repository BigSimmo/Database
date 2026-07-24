/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SearchCommandProvider } from "@/components/clinical-dashboard/search-command-context";
import { SearchResultsHeaderBand } from "@/components/clinical-dashboard/search-results-header-band";

describe("SearchResultsHeaderBand", () => {
  it("presents the query and completed count as one labelled results ribbon", () => {
    const query = "a deliberately long clinical search query";

    render(<SearchResultsHeaderBand modeId="services" query={`  ${query}  `} matchCount={12} />);

    expect(screen.getByRole("region", { name: `Search results for ${query}` })).toHaveAttribute("aria-busy", "false");
    expect(screen.getByRole("heading", { name: query })).toHaveAttribute("title", query);
    expect(screen.getByRole("status")).toHaveTextContent("12 matches");
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
});
