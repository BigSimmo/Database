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
    expect(screen.getByRole("status")).toHaveTextContent("12 services");
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
    expect(screen.queryByText("8 differentials")).toBeNull();
  });

  // The clinical invariant. A failed services search that renders "0 matches"
  // asserts "there are no crisis services" when the truth is "we could not
  // check", so no digit may reach the DOM while faulted.
  it("asserts no count when the search failed", () => {
    render(<SearchResultsHeaderBand modeId="services" query="CMHT" matchCount={0} status="error" />);

    const region = screen.getByRole("region", { name: "Search results for CMHT" });
    expect(region).toHaveAttribute("aria-busy", "false");
    expect(screen.getByRole("status")).toHaveTextContent("Couldn’t search");
    // No digit may reach the DOM: that is the whole invariant.
    expect(within(region).queryByText(/\d/)).toBeNull();
  });

  // Suppressing the count in the spine is worthless if a page-supplied filter
  // chip still renders "Forms 0" beside it — the reader still sees a zero
  // asserted about a search that never ran.
  it("drops count-bearing page controls while faulted", () => {
    const { rerender } = render(
      <SearchResultsHeaderBand
        modeId="forms"
        query="transport order"
        matchCount={0}
        status="ready"
        filterControls={<span>Forms 0</span>}
      />,
    );
    expect(screen.getByText("Forms 0")).toBeVisible();

    rerender(
      <SearchResultsHeaderBand
        modeId="forms"
        query="transport order"
        matchCount={0}
        status="error"
        filterControls={<span>Forms 0</span>}
      />,
    );
    const region = screen.getByRole("region", { name: "Search results for transport order" });
    expect(screen.queryByText("Forms 0")).toBeNull();
    // Belt and braces: no digit anywhere in the ribbon, not just in the spine.
    expect(within(region).queryByText(/\d/)).toBeNull();
  });

  // Initial loading is the same untrue-zero risk: forms forces matches to [] until
  // the registry is ready, so ResultTabs would assert "Forms 0" under Searching….
  it("drops count-bearing page controls while loading", () => {
    render(
      <SearchResultsHeaderBand
        modeId="forms"
        query="transport order"
        matchCount={0}
        status="loading"
        filterControls={<span>Forms 0</span>}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Searching…");
    expect(screen.queryByText("Forms 0")).toBeNull();
  });

  it("keeps exactly one status region and one alert while faulted", () => {
    render(<SearchResultsHeaderBand modeId="services" query="CMHT" matchCount={0} status="error" />);

    // Singular role queries throw when they match more than one node, so these
    // also prove the spine's status was not duplicated by the fault panel.
    expect(screen.getByRole("status")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("Services could not be loaded");
  });

  it("distinguishes an expired session from a broken search", () => {
    render(<SearchResultsHeaderBand modeId="services" query="CMHT" matchCount={0} status="unauthorized" />);

    expect(screen.getByRole("status")).toHaveTextContent("Sign in to search");
    expect(screen.getByRole("alert")).toHaveTextContent("Sign in to continue");
  });

  it("offers retry through the shared busy contract when a recovery handler exists", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(<SearchResultsHeaderBand modeId="services" query="CMHT" matchCount={0} status="error" onRetry={onRetry} />);

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("omits the retry affordance when no recovery handler is supplied", () => {
    render(<SearchResultsHeaderBand modeId="services" query="CMHT" matchCount={0} status="error" />);

    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  // Zero is a real answer and must stay distinguishable from a failure.
  it("reports a genuine zero result without raising a fault", () => {
    render(<SearchResultsHeaderBand modeId="services" query="clozapine rechallenge" matchCount={0} />);

    expect(screen.getByRole("status")).toHaveTextContent("0 services");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps the prior count visible while refetching", () => {
    render(<SearchResultsHeaderBand modeId="services" query="CMHT" matchCount={8} status="refetching" />);

    expect(screen.getByRole("region", { name: "Search results for CMHT" })).toHaveAttribute("aria-busy", "true");
    // Text content must match the ready state exactly so the atomic live region
    // does not re-announce an unchanged count.
    expect(screen.getByRole("status")).toHaveTextContent("8 services");
  });

  it("keeps an honest count while labelling a partial-source failure", () => {
    render(<SearchResultsHeaderBand modeId="favourites" query="saved" matchCount={3} status="partial" />);

    const region = screen.getByRole("region", { name: "Search results for saved" });
    expect(region).toHaveAttribute("data-status", "partial");
    expect(screen.getByRole("status")).toHaveTextContent("3 favourites · some sources unavailable");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("offers retry without hiding an honest partial count", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <SearchResultsHeaderBand modeId="favourites" query="saved" matchCount={3} status="partial" onRetry={onRetry} />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("3 favourites · some sources unavailable");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  // The accent used to be an absolutely-positioned bar inside an overflow:hidden
  // rounded card, so the corner arc sliced its ends and it tapered away from the
  // corner while the 1px border curved past it. It is now the card's own
  // border-top, which mitres into the side borders by construction.
  it("carries the accent as a border rather than a clipped overlay bar", () => {
    render(<SearchResultsHeaderBand modeId="services" query="CMHT" matchCount={10} />);

    const region = screen.getByRole("region", { name: "Search results for CMHT" });
    expect(region).toHaveClass("search-band");
    expect(region.querySelector("span.absolute")).toBeNull();
  });

  it("lets an explicit status override the deprecated loading shim", () => {
    render(<SearchResultsHeaderBand modeId="services" query="CMHT" matchCount={4} loading status="ready" />);

    expect(screen.getByRole("region", { name: "Search results for CMHT" })).toHaveAttribute("aria-busy", "false");
    expect(screen.getByRole("status")).toHaveTextContent("4 services");
  });

  it("keeps sort, view, and save controls wired inside the utility row", async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    const onViewChange = vi.fn();
    const onSaveSearch = vi.fn();

    render(
      <SearchCommandProvider value={{ query: "transport order", modeId: "forms" }}>
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

    await user.click(screen.getByRole("button", { name: "A–Z" }));
    await user.click(screen.getByRole("button", { name: "List view" }));
    await user.click(screen.getByRole("button", { name: "Save search" }));

    expect(onSortChange).toHaveBeenCalledWith("alpha");
    expect(onViewChange).toHaveBeenCalledWith("list");
    expect(onSaveSearch).toHaveBeenCalledOnce();
  });

  it("offers sort as a segmented control that shows the active order without opening a menu", async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();

    render(
      <SearchResultsHeaderBand
        modeId="services"
        query="CMHT"
        matchCount={10}
        sortValue="relevance"
        onSortChange={onSortChange}
      />,
    );

    const sort = screen.getByRole("group", { name: "Sort results" });
    expect(within(sort).getByRole("button", { name: "Relevance" })).toHaveAttribute("aria-pressed", "true");
    expect(within(sort).getByRole("button", { name: "A–Z" })).toHaveAttribute("aria-pressed", "false");

    await user.click(within(sort).getByRole("button", { name: "A–Z" }));
    expect(onSortChange).toHaveBeenCalledWith("alpha");
  });

  it("leads with the count, names what it counted, and keeps the query as its anchor", () => {
    render(<SearchResultsHeaderBand modeId="services" query="CMHT" matchCount={10} />);

    const heading = screen.getByRole("heading", { level: 2, name: "CMHT" });
    const status = screen.getByRole("status");
    // The count is the answer to the search, so it comes first and says what it
    // counted. The query still carries the heading role and its accessible name,
    // so anything resolving it by role is unaffected by the reordering.
    expect(status).toHaveTextContent("10 services");
    expect(status.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The count is neutral text, not a success pill, and the band carries no eyebrow.
    expect(status.className).not.toMatch(/success/);
    expect(heading.parentElement?.textContent).not.toMatch(/Query|Results for/);
  });

  it("uses the singular noun for a single result", () => {
    render(<SearchResultsHeaderBand modeId="services" query="CMHT" matchCount={1} />);
    expect(screen.getByRole("status")).toHaveTextContent("1 service");
  });

  it("keeps an acronym intact in the counted noun", () => {
    render(<SearchResultsHeaderBand modeId="dsm" query="bipolar" matchCount={3} />);
    expect(screen.getByRole("status")).toHaveTextContent("3 DSM diagnoses");
  });

  it("singularises an irregular counted noun", () => {
    render(<SearchResultsHeaderBand modeId="dsm" query="bipolar" matchCount={1} />);
    expect(screen.getByRole("status")).toHaveTextContent("1 DSM diagnosis");
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
    await user.click(within(pair).getByRole("button", { name: "A–Z" }));
    await user.selectOptions(within(pair).getByLabelText("Filter by result type"), "diagnosis");

    expect(onSortChange).toHaveBeenCalledWith("alpha");
    expect(onFilterChange).toHaveBeenCalledWith("diagnosis");
    expect(screen.getByTestId("search-query-ribbon-filters")).toHaveClass("hidden", "sm:block");
  });
});
