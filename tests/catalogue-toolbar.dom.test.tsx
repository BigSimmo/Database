import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CatalogueToolbar } from "@/components/ui/catalogue-toolbar";

describe("CatalogueToolbar DOM and Interactions", () => {
  it("renders search, sort, filter trigger, and match count cleanly", () => {
    const onSearchChange = vi.fn();
    const onSortChange = vi.fn();
    const onToggleFilter = vi.fn();

    render(
      <CatalogueToolbar
        search={{
          query: "neuro",
          onQueryChange: onSearchChange,
          placeholder: "Search differentials...",
          label: "Search differentials",
        }}
        sort={{
          value: "relevance",
          onChange: onSortChange,
          options: [
            { value: "relevance", label: "Relevance" },
            { value: "alpha", label: "A–Z" },
          ],
        }}
        filterTrigger={{
          open: false,
          onToggle: onToggleFilter,
          activeCount: 2,
          label: "Filter differentials",
          panelId: "diff-filter-panel",
        }}
        matchCount={14}
        noun="differential"
      />,
    );

    expect(screen.getByTestId("catalogue-toolbar")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search differentials...")).toHaveValue("neuro");
    expect(screen.getByRole("combobox")).toHaveValue("relevance");

    const trigger = screen.getByTestId("catalogue-filter-trigger");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-controls", "diff-filter-panel");
    expect(screen.getByTestId("catalogue-filter-badge")).toHaveTextContent("2");

    const matchCount = screen.getByTestId("catalogue-match-count");
    expect(matchCount).toHaveTextContent("14 differentials");
  });

  it("handles user interactions for search, sort, and filter trigger", async () => {
    const onSearchChange = vi.fn();
    const onSortChange = vi.fn();
    const onToggleFilter = vi.fn();

    render(
      <CatalogueToolbar
        search={{
          query: "",
          onQueryChange: onSearchChange,
        }}
        sort={{
          value: "relevance",
          onChange: onSortChange,
          options: [
            { value: "relevance", label: "Relevance" },
            { value: "alpha", label: "A–Z" },
          ],
        }}
        filterTrigger={{
          open: false,
          onToggle: onToggleFilter,
        }}
      />,
    );

    const input = screen.getByRole("textbox");
    await userEvent.type(input, "bipolar");
    expect(onSearchChange).toHaveBeenCalled();

    const select = screen.getByRole("combobox");
    await userEvent.selectOptions(select, "alpha");
    expect(onSortChange).toHaveBeenCalledWith("alpha");

    const trigger = screen.getByTestId("catalogue-filter-trigger");
    await userEvent.click(trigger);
    expect(onToggleFilter).toHaveBeenCalledTimes(1);
  });

  it("renders active filter chips and handles remove and clear-all callbacks", async () => {
    const onRemoveDomain = vi.fn();
    const onRemoveScope = vi.fn();
    const onClearAll = vi.fn();

    render(
      <CatalogueToolbar
        appliedFilters={[
          { id: "f-1", groupLabel: "Domain", valueLabel: "Biological", onRemove: onRemoveDomain },
          { id: "f-2", groupLabel: "Scope", valueLabel: "Guides", onRemove: onRemoveScope },
        ]}
        onClearFilters={onClearAll}
      />,
    );

    const chipsStrip = screen.getByTestId("catalogue-applied-filters");
    expect(chipsStrip).toBeInTheDocument();

    const chips = within(chipsStrip).getAllByTestId("catalogue-applied-chip");
    expect(chips).toHaveLength(2);
    expect(chips[0]).toHaveTextContent("Domain: Biological");
    expect(chips[1]).toHaveTextContent("Scope: Guides");

    const removeDomainBtn = screen.getByRole("button", { name: "Remove filter Domain: Biological" });
    await userEvent.click(removeDomainBtn);
    expect(onRemoveDomain).toHaveBeenCalledTimes(1);

    const clearAllBtn = screen.getByTestId("catalogue-clear-filters");
    await userEvent.click(clearAllBtn);
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it("handles singular vs plural noun formatting in results count", () => {
    const { rerender } = render(<CatalogueToolbar matchCount={1} noun="mechanism" />);
    expect(screen.getByTestId("catalogue-match-count")).toHaveTextContent("1 mechanism");

    rerender(<CatalogueToolbar matchCount={0} noun="mechanism" />);
    expect(screen.getByTestId("catalogue-match-count")).toHaveTextContent("0 mechanisms");

    rerender(<CatalogueToolbar matchCount={5} noun="specifier" />);
    expect(screen.getByTestId("catalogue-match-count")).toHaveTextContent("5 specifiers");
  });
});
