/** @vitest-environment jsdom */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SearchCommandProvider } from "@/components/clinical-dashboard/search-command-context";
import {
  MobileResultFilterControl,
  SearchResultsEmptyState,
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

  // The accent was first an absolutely-positioned bar inside an overflow:hidden
  // rounded card, so the corner arc sliced its ends; then the card's own
  // border-top; and now an 18px lead mark inside the padding, because at 58px a
  // line across the full width reads as a divider between the composer and the
  // results rather than as the band's accent. Still in flow, never absolute —
  // that is what the clipping fix bought and it must not be spent again.
  it("carries the accent as an in-flow lead rule, not a clipped overlay bar", () => {
    render(<SearchResultsHeaderBand modeId="services" query="CMHT" matchCount={10} />);

    const region = screen.getByRole("region", { name: "Search results for CMHT" });
    expect(region).toHaveClass("search-band");
    expect(region.querySelector("span.absolute")).toBeNull();
    const lead = region.querySelector(".search-band-lead");
    expect(lead).not.toBeNull();
    expect(lead).toHaveAttribute("data-tone", "accent");
    expect(lead).toHaveAttribute("aria-hidden");
  });

  // The tile is gone, and with it the shape channel it carried: alert when the
  // search faulted, a spinner while one ran. The mockup encoded those as colour
  // alone, which makes a failed search identical to a successful one for a
  // reader who cannot separate the hues — so state keeps a shape here, on three
  // independent non-chromatic channels: the mark's stroke count, a glyph that
  // renders only when something is wrong, and the absence of a number.
  it.each([
    ["error" as const, "warning", "Couldn’t search"],
    ["unauthorized" as const, "warning", "Sign in to search"],
    ["partial" as const, "warning", "6 services"],
    ["ready" as const, "accent", "6 services"],
    ["refetching" as const, "accent", "6 services"],
  ])("carries %s state as shape, not only hue", (status, tone, text) => {
    render(<SearchResultsHeaderBand modeId="services" query="CMHT" matchCount={6} status={status} />);

    const region = screen.getByRole("region", { name: "Search results for CMHT" });
    expect(region.querySelector(".search-band-lead")).toHaveAttribute("data-tone", tone);
    expect(screen.getByRole("status")).toHaveTextContent(text);

    // The clinical invariant, restated where the shape is: a faulted search has
    // no count to report, so no digit may reach the DOM.
    if (status === "error" || status === "unauthorized") {
      expect(screen.getByRole("status").textContent ?? "").not.toMatch(/\d/);
    }
  });

  it("pins Filter and Retry outside the scrolling track so neither can be swiped away", () => {
    render(
      <SearchResultsHeaderBand
        modeId="favourites"
        query="ward round"
        matchCount={3}
        status="partial"
        onRetry={vi.fn()}
        onSortChange={vi.fn()}
        mobileControlsPlacement="inline"
        mobileControls={<button type="button">Filter</button>}
      />,
    );

    const utilities = screen.getByTestId("search-query-ribbon-utilities");
    const track = screen.getByTestId("search-query-ribbon-utility-track");
    const pageFilters = screen.getByTestId("search-query-ribbon-mobile-controls");

    // Only the optional controls scroll. Sort is inside the track; Filter and
    // Retry are siblings after it. Before this, Filter was the track's last
    // child, so it was the first control to fall off the right edge once a mode
    // added anything — the one control carrying filter state.
    expect(track.contains(screen.getByRole("group", { name: "Sort results" }))).toBe(true);
    expect(track.contains(pageFilters)).toBe(false);
    expect(track.contains(screen.getByRole("button", { name: "Retry" }))).toBe(false);
    expect(track.className).toContain("overflow-x-auto");
    // Still the last child of the group: `ui-tools` asserts that placement,
    // because the right edge is where the thumb already is.
    expect(utilities.lastElementChild).toBe(pageFilters);
  });

  it("keeps a full-width phone control on its own row unless the page says otherwise", () => {
    const control = <button type="button">Wide filter</button>;

    const { rerender } = render(
      <SearchResultsHeaderBand modeId="formulation" query="pattern" matchCount={4} mobileControls={control} />,
    );
    // Six modes pass a `w-full` native select here — two of them pass a pair in
    // a two-column grid — and pinning one into a 58px line at 320px makes it
    // unreadable. Unannounced page controls therefore keep today's own row.
    expect(screen.getByTestId("search-query-ribbon-mobile-controls").className).toContain("w-full");

    rerender(
      <SearchResultsHeaderBand
        modeId="documents"
        query="pattern"
        matchCount={4}
        mobileControlsPlacement="inline"
        mobileControls={control}
      />,
    );
    expect(screen.getByTestId("search-query-ribbon-mobile-controls").className).not.toContain("w-full");
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

    // Sort and the page filter are no longer paired: Sort is inboard and the page
    // filter renders last, hard against the ribbon's right edge, because it is the
    // only control carrying state and the one a thumb reaches for.
    const utilities = screen.getByTestId("search-query-ribbon-utilities");
    const pageFilters = screen.getByTestId("search-query-ribbon-mobile-controls");
    expect(utilities.lastElementChild).toBe(pageFilters);
    await user.click(within(utilities).getByRole("button", { name: "A–Z" }));
    await user.selectOptions(within(pageFilters).getByLabelText("Filter by result type"), "diagnosis");

    expect(onSortChange).toHaveBeenCalledWith("alpha");
    expect(onFilterChange).toHaveBeenCalledWith("diagnosis");
    expect(screen.getByTestId("search-query-ribbon-filters")).toHaveClass("hidden", "sm:block");
  });
});

describe("SearchResultsEmptyState", () => {
  const filters = [
    { id: "medication", label: "Lithium", onRemove: vi.fn() },
    { id: "action", label: "Discharge", onRemove: vi.fn() },
  ];

  it("leads with relaxing a filter when the set is empty because of them", async () => {
    const user = userEvent.setup();
    const onClearFilters = vi.fn();
    const onRemove = vi.fn();
    const onBrowseAll = vi.fn();

    render(
      <SearchResultsEmptyState
        modeId="documents"
        query="lithium monitoring"
        appliedFilters={[filters[0], { ...filters[1], onRemove }]}
        onClearFilters={onClearFilters}
        onBrowseAll={onBrowseAll}
        browseAllLabel="Browse all 2,014 sources"
      />,
    );

    // The heading counts the filters rather than quoting the query: the query is
    // not what emptied the set, and saying so sends the reader to rewrite the one
    // thing that was working.
    expect(screen.getByText("No documents match all 2 filters")).toBeVisible();
    // The failure is attributed. "The search itself ran fine" is the sentence
    // that stops a filtered-to-zero result reading as a broken search.
    expect(screen.getByText(/The search itself ran fine/)).toBeVisible();

    // Naming the filter in the label is what makes it a one-tap undo instead of
    // a second thing to go and find.
    await user.click(screen.getByRole("button", { name: "Remove “Discharge”" }));
    expect(onRemove).toHaveBeenCalledTimes(1);

    // Separate control, separate label — the single button that said "Clear
    // filters" and reset the query too is exactly what this replaces.
    await user.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Browse all 2,014 sources" }));
    expect(onBrowseAll).toHaveBeenCalledTimes(1);
  });

  it("keeps the example and cross-mode routes, demoted below a rule", () => {
    render(
      <SearchResultsEmptyState
        modeId="documents"
        query="lithium monitoring"
        appliedFilters={filters}
        onClearFilters={vi.fn()}
        onTryExample={vi.fn()}
      />,
    );

    const example = screen.getByRole("button", { name: /^Try:/ });
    expect(example).toBeVisible();
    // Demotion is structural, not just ordering: an example query is a different
    // search, and the reader has not finished this one.
    expect(example.parentElement).toHaveClass("border-t");
  });

  it("is unchanged when nothing is applied", () => {
    render(<SearchResultsEmptyState modeId="documents" query="lithium monitoring" onTryExample={vi.fn()} />);

    expect(screen.getByText("No matches for “lithium monitoring”")).toBeVisible();
    expect(screen.getByText("Try an example, or jump to another mode.")).toBeVisible();
    expect(screen.queryByTestId("search-results-empty-remove-filter")).toBeNull();
    expect(screen.queryByTestId("search-results-empty-clear-filters")).toBeNull();
    expect(screen.getByRole("button", { name: /^Try:/ }).parentElement).not.toHaveClass("border-t");
  });

  it("offers no Clear all for a single filter, because Remove already is one", () => {
    render(
      <SearchResultsEmptyState
        modeId="documents"
        query="lithium monitoring"
        appliedFilters={[filters[0]]}
        onClearFilters={vi.fn()}
      />,
    );

    expect(screen.getByText("No documents match the selected filter")).toBeVisible();
    expect(screen.getByTestId("search-results-empty-remove-filter")).toBeVisible();
    expect(screen.queryByTestId("search-results-empty-clear-filters")).toBeNull();
  });

  it("announces query-only emptiness and offers a clear-search recovery", async () => {
    const user = userEvent.setup();
    const onClearSearch = vi.fn();

    render(
      <SearchResultsEmptyState
        modeId="therapy-compass"
        query="unmatched therapy"
        onClearSearch={onClearSearch}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("No matches for “unmatched therapy”");
    await user.click(screen.getByTestId("search-results-empty-clear-search"));
    expect(onClearSearch).toHaveBeenCalledTimes(1);
  });
});
