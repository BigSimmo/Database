import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AppliedFilters, type AppliedFilter } from "@/components/ui/applied-filters";

const filters: AppliedFilter[] = [
  { id: "f-1", groupLabel: "Domain", valueLabel: "Biological", onRemove: vi.fn() },
  { id: "f-2", groupLabel: "Scope", valueLabel: "Guides", onRemove: vi.fn() },
];

describe("AppliedFilters", () => {
  it("renders chip names from group and value labels", () => {
    render(<AppliedFilters filters={filters} />);

    const row = screen.getByTestId("applied-filters");
    const chips = within(row).getAllByTestId("applied-filter-chip");
    expect(chips).toHaveLength(2);
    expect(chips[0]).toHaveTextContent("Domain: Biological");
    expect(chips[1]).toHaveTextContent("Scope: Guides");
  });

  it("removes a chip through Chip’s removable control", async () => {
    const onRemove = vi.fn();
    render(<AppliedFilters filters={[{ id: "f-1", groupLabel: "Domain", valueLabel: "Biological", onRemove }]} />);

    await userEvent.click(screen.getByRole("button", { name: "Remove filter Domain: Biological" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("fires clear-all from the ghost Button", async () => {
    const onClearAll = vi.fn();
    render(<AppliedFilters filters={filters} onClearAll={onClearAll} />);

    await userEvent.click(screen.getByTestId("applied-filters-clear"));
    expect(onClearAll).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Clear all" }).className).toContain("focus-visible:outline-2");
  });

  it("renders nothing when there are no filters", () => {
    const { container } = render(<AppliedFilters filters={[]} onClearAll={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId("applied-filters")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear all" })).not.toBeInTheDocument();
  });
});
