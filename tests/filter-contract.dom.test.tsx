import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ResultFilterSheet,
  resultFilterFacetGroup,
  resultFilterGroup,
  type ResultFilterOption,
} from "@/components/search/ResultFilterSheet";

afterEach(() => {
  cleanup();
});

describe("filter contract and density rendering", () => {
  it("renders facet groups with <= 5 options as compact wrapping chips", () => {
    const onToggle = vi.fn();
    const group = resultFilterFacetGroup({
      id: "small-facet",
      label: "Category",
      selected: new Set(["a"]),
      options: [
        { value: "a", label: "Option A", hint: "3" },
        { value: "b", label: "Option B", hint: "5" },
        { value: "c", label: "Option C", hint: "2" },
      ],
      onToggle,
    });

    render(
      <ResultFilterSheet
        open={true}
        onClose={vi.fn()}
        panelId="small-filter-panel"
        testId="small-filter-panel"
        title="Filter results"
        groups={[group]}
      />,
    );

    const buttonA = screen.getByRole("button", { name: /^Option A/ });
    expect(buttonA).toHaveAttribute("aria-pressed", "true");
    expect(buttonA.className).toContain("inline-flex");
    expect(buttonA.className.split(/\s+/)).not.toContain("w-full");
    expect(buttonA.className).toContain("min-h-tap");
  });

  it("renders facet groups with 6–20 options as dense full-width vertical list with right-aligned counts", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const options: ResultFilterOption<string>[] = Array.from({ length: 9 }, (_, i) => ({
      value: `option-${i + 1}`,
      label: `Domain ${i + 1}`,
      hint: `${(i + 1) * 2}`,
    }));

    const group = resultFilterFacetGroup({
      id: "dense-domains",
      label: "Domains",
      selected: new Set(["option-2"]),
      options,
      onToggle,
    });

    render(
      <ResultFilterSheet
        open={true}
        onClose={vi.fn()}
        panelId="dense-filter-panel"
        testId="dense-filter-panel"
        title="Filter mechanisms"
        groups={[group]}
      />,
    );

    const groupEl = screen.getByRole("group", { name: "Domains" });
    expect(groupEl).toBeInTheDocument();
    expect(groupEl.className).toContain("grid");

    const buttons = within(groupEl).getAllByRole("button");
    expect(buttons).toHaveLength(9);

    const firstButton = buttons[0];
    expect(firstButton.className).toContain("w-full");
    expect(firstButton.className).toContain("justify-between");
    expect(firstButton.className).toContain("min-h-tap");
    expect(firstButton).toHaveAttribute("aria-pressed", "false");

    const secondButton = buttons[1];
    expect(secondButton).toHaveAttribute("aria-pressed", "true");

    await user.click(firstButton);
    expect(onToggle).toHaveBeenCalledWith("option-1");
  });

  it("adds find-a-filter and disclosure header when total facet options exceed 20 or facet groups exceed 3", () => {
    const onToggle = vi.fn();
    const groups = Array.from({ length: 4 }, (_, groupIndex) =>
      resultFilterFacetGroup({
        id: `facet-group-${groupIndex + 1}`,
        label: `Group ${groupIndex + 1}`,
        selected: new Set<string>(),
        options: [
          { value: `g${groupIndex}-1`, label: `Item 1`, hint: "1" },
          { value: `g${groupIndex}-2`, label: `Item 2`, hint: "2" },
        ],
        onToggle,
      }),
    );

    render(
      <ResultFilterSheet
        open={true}
        onClose={vi.fn()}
        panelId="super-dense-panel"
        testId="super-dense-panel"
        title="Filter services"
        groups={groups}
      />,
    );

    expect(screen.getByTestId("super-dense-panel-find")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Group 1/ })).toHaveAttribute("aria-expanded", "false");
  });

  it("handles roving radio selection for lens groups", () => {
    const onChange = vi.fn();
    const lensGroup = resultFilterGroup({
      id: "view-lens",
      label: "View",
      value: "all",
      options: [
        { value: "all", label: "All items" },
        { value: "presentations", label: "Presentations" },
        { value: "diagnoses", label: "Diagnoses" },
      ],
      onChange,
    });

    render(
      <ResultFilterSheet
        open={true}
        onClose={vi.fn()}
        panelId="lens-panel"
        testId="lens-panel"
        title="Filter view"
        groups={[lensGroup]}
      />,
    );

    const radioAll = screen.getByRole("radio", { name: "All items" });
    expect(radioAll).toHaveAttribute("aria-checked", "true");
    expect(radioAll).toHaveAttribute("tabindex", "0");

    const radioPres = screen.getByRole("radio", { name: "Presentations" });
    expect(radioPres).toHaveAttribute("aria-checked", "false");
    expect(radioPres).toHaveAttribute("tabindex", "-1");

    fireEvent.click(radioPres);
    expect(onChange).toHaveBeenCalledWith("presentations");
  });
});
